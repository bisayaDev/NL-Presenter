// Optional YouTube → MP3 downloads. Nothing ships with the app: when the operator turns the feature on in Settings,
// the latest yt-dlp (github.com/yt-dlp/yt-dlp) and ffmpeg (github.com/eugeneware/ffmpeg-static) are downloaded
// from their GitHub releases into <data>/tools, and can be updated or removed later. yt-dlp is checked against the
// SHA-256 sums published with each release.

import { spawn, type ChildProcess } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import type { DownloadToolsStatus, ToolName, YouTubeDownloadProgress, YouTubeDownloadResult } from '../shared/types'
import * as db from './db'
import { importMedia } from './media'

const GH = { Accept: 'application/vnd.github+json', 'User-Agent': 'NLPresenter' }
const exe = process.platform === 'win32' ? '.exe' : ''
const FILE: Record<ToolName, string> = { ytdlp: `yt-dlp${exe}`, ffmpeg: `ffmpeg${exe}` }

/** Release asset for this computer, or null when the tool has no build for it. */
function assetName(tool: ToolName): string | null {
  const { platform, arch } = process
  if (tool === 'ytdlp') {
    if (platform === 'darwin') return 'yt-dlp_macos' // universal (Intel + Apple Silicon)
    if (platform === 'win32') return 'yt-dlp.exe'
    if (platform === 'linux') return arch === 'arm64' ? 'yt-dlp_linux_aarch64' : arch === 'x64' ? 'yt-dlp_linux' : null
    return null
  }
  const a = arch === 'arm64' && platform !== 'win32' ? 'arm64' : arch === 'x64' || platform === 'win32' ? 'x64' : null
  if (!a || !['darwin', 'win32', 'linux'].includes(platform)) return null
  return `ffmpeg-${platform}-${a}.gz`
}

const REPO: Record<ToolName, string> = { ytdlp: 'yt-dlp/yt-dlp', ffmpeg: 'eugeneware/ffmpeg-static' }

let dir = ''
let notify: (s: DownloadToolsStatus) => void = () => {}
let latest: Record<ToolName, string | null> = { ytdlp: null, ffmpeg: null }
let checkedAt: number | null = null
let busy: DownloadToolsStatus['busy'] = null
let lastError: string | null = null

type Manifest = Partial<Record<ToolName, { version: string }>>
const manifestPath = (): string => join(dir, 'tools.json')
async function manifest(): Promise<Manifest> {
  try {
    return JSON.parse(await readFile(manifestPath(), 'utf8')) as Manifest
  } catch {
    return {}
  }
}
const toolPath = (t: ToolName): string => join(dir, FILE[t])

/** `toolsDir`: where the tools live; `onChange`: tell the operator window about status changes. */
export function initDownloadTools(toolsDir: string, onChange: (s: DownloadToolsStatus) => void): void {
  dir = toolsDir
  notify = onChange
  // Turned on: look for newer versions a little after start-up (at most once a day).
  if (enabled())
    setTimeout(() => {
      const last = Number(db.getSettings()['ytToolsCheckedAt'] ?? 0)
      if (Date.now() - last > 24 * 3600_000) void checkForToolUpdates().catch(() => {})
    }, 20_000)
}

const enabled = (): boolean => db.getSettings()['ytDownloads'] === true

export async function toolsStatus(): Promise<DownloadToolsStatus> {
  const m = await manifest()
  const installed = (t: ToolName): string | null => (m[t] && existsSync(toolPath(t)) ? m[t]!.version : null)
  return {
    enabled: enabled(),
    supported: !!assetName('ytdlp') && !!assetName('ffmpeg'),
    tools: {
      ytdlp: { installed: installed('ytdlp'), latest: latest.ytdlp },
      ffmpeg: { installed: installed('ffmpeg'), latest: latest.ffmpeg }
    },
    checkedAt,
    busy,
    error: lastError
  }
}

async function changed(): Promise<DownloadToolsStatus> {
  const s = await toolsStatus()
  notify(s)
  return s
}

interface Release {
  tag_name: string
  assets: { name: string; browser_download_url: string; size: number }[]
}
async function release(tool: ToolName): Promise<Release> {
  const res = await fetch(`https://api.github.com/repos/${REPO[tool]}/releases/latest`, { headers: GH, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${REPO[tool]}`)
  return (await res.json()) as Release
}

/** Ask GitHub for the newest versions (no download). */
export async function checkForToolUpdates(): Promise<DownloadToolsStatus> {
  lastError = null
  try {
    const [a, b] = await Promise.all([release('ytdlp'), release('ffmpeg')])
    latest = { ytdlp: a.tag_name, ffmpeg: b.tag_name }
    checkedAt = Date.now()
    db.setSetting('ytToolsCheckedAt', checkedAt)
  } catch (e) {
    lastError = offline(e) ? 'offline' : String((e as Error).message ?? e)
  }
  return changed()
}

/** A whole download in memory (largest asset ~40 MB), reporting progress. */
async function fetchAsset(url: string, size: number, onPct: (pct: number) => void): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': GH['User-Agent'] }, signal: AbortSignal.timeout(10 * 60_000) })
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`)
  const total = Number(res.headers.get('content-length')) || size
  const chunks: Uint8Array[] = []
  let got = 0
  const reader = res.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    got += value.length
    if (total) onPct(Math.min(99, Math.round((got / total) * 100)))
  }
  return Buffer.concat(chunks)
}

/** Run a tool and return its first line of output (its version), or throw if it does not start. */
function runVersion(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(file, args, { windowsHide: true })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve(out.split('\n')[0].trim()) : reject(new Error(`${file} exited with ${code}`))))
  })
}

async function install(tool: ToolName): Promise<void> {
  const name = assetName(tool)
  if (!name) throw new Error('Not available for this computer')
  const rel = await release(tool)
  const asset = rel.assets.find((a) => a.name === name)
  if (!asset) throw new Error(`${name} is missing from ${REPO[tool]} ${rel.tag_name}`)
  busy = { tool, pct: 0 }
  await changed()
  let last = -1
  let bytes = await fetchAsset(asset.browser_download_url, asset.size, (pct) => {
    if (pct === last) return
    last = pct
    busy = { tool, pct }
    void changed()
  })
  busy = { tool, pct: 100 } // 100: downloaded, now being checked
  void changed()
  if (tool === 'ytdlp') {
    // Checked against the release's own SHA-256 list.
    const sums = rel.assets.find((a) => a.name === 'SHA2-256SUMS')
    if (!sums) throw new Error('yt-dlp release has no SHA2-256SUMS')
    const list = await (await fetch(sums.browser_download_url, { headers: { 'User-Agent': GH['User-Agent'] } })).text()
    const want = list.split('\n').find((l) => l.trim().endsWith(` ${name}`) || l.trim().endsWith(`*${name}`))?.split(/\s+/)[0]
    const got = createHash('sha256').update(bytes).digest('hex')
    if (!want || want.toLowerCase() !== got) throw new Error('yt-dlp download did not match its published checksum')
  } else bytes = gunzipSync(bytes)

  await mkdir(dir, { recursive: true })
  const tmp = join(dir, `${FILE[tool]}.${randomUUID().slice(0, 8)}.part`)
  await writeFile(tmp, bytes)
  await chmod(tmp, 0o755)
  // Make sure it runs on this computer before replacing the working copy.
  try {
    await runVersion(tmp, tool === 'ytdlp' ? ['--version'] : ['-version'])
  } catch (e) {
    await rm(tmp, { force: true })
    throw new Error(`The downloaded ${tool === 'ytdlp' ? 'yt-dlp' : 'ffmpeg'} does not run on this computer (${(e as Error).message})`)
  }
  await rename(tmp, toolPath(tool))
  const m = await manifest()
  m[tool] = { version: rel.tag_name }
  await writeFile(manifestPath(), JSON.stringify(m, null, 1))
  latest[tool] = rel.tag_name
}

let installing: Promise<DownloadToolsStatus> | null = null

/** Download the tools that are missing or out of date (`force`: both, again). */
export function installTools(force = false): Promise<DownloadToolsStatus> {
  if (installing) return installing
  busy = { tool: 'ytdlp', pct: 0 } // shows at once; install() refines it
  installing = (async () => {
    lastError = null
    try {
      const s = await toolsStatus()
      for (const t of ['ytdlp', 'ffmpeg'] as const) {
        const { installed } = s.tools[t]
        if (force || !installed) await install(t)
        else {
          const rel = await release(t)
          latest[t] = rel.tag_name
          if (rel.tag_name !== installed) await install(t)
        }
      }
      checkedAt = Date.now()
    } catch (e) {
      lastError = offline(e) ? 'offline' : String((e as Error).message ?? e)
    } finally {
      busy = null
      installing = null
    }
    return changed()
  })()
  return installing
}

export async function setDownloadsEnabled(on: boolean): Promise<DownloadToolsStatus> {
  db.setSetting('ytDownloads', on)
  if (!on) return changed()
  const s = await toolsStatus()
  // Missing tools download in the background; progress arrives as status changes.
  if (!s.tools.ytdlp.installed || !s.tools.ffmpeg.installed) void installTools()
  return changed()
}

/** Delete the tools and turn the feature off. */
export async function removeTools(): Promise<DownloadToolsStatus> {
  for (const job of jobs.values()) job.kill()
  db.setSetting('ytDownloads', false)
  await rm(dir, { recursive: true, force: true })
  latest = { ytdlp: null, ffmpeg: null }
  lastError = null
  return changed()
}

const offline = (e: unknown): boolean => /ENOTFOUND|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|timeout|aborted|fetch failed/i.test(String((e as Error)?.cause ?? e))

// ---------- downloading a video's audio ----------

const jobs = new Map<string, ChildProcess>()

/** File-name-safe title (the media library shows the file name). */
const safeName = (s: string): string =>
  s
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'YouTube audio'

/**
 * Save a YouTube video's audio as MP3 and add it to the media library. Progress goes to `onProgress`
 * (downloading 0–100, then converting).
 */
export async function downloadAudio(
  videoId: string,
  title: string,
  onProgress: (p: YouTubeDownloadProgress) => void
): Promise<YouTubeDownloadResult> {
  if (!/^[\w-]{6,20}$/.test(videoId)) return { ok: false, error: 'failed', message: 'Bad video id' }
  if (!enabled()) return { ok: false, error: 'off' }
  const s = await toolsStatus()
  if (!s.tools.ytdlp.installed || !s.tools.ffmpeg.installed) return { ok: false, error: 'off' }
  if (jobs.has(videoId)) return { ok: false, error: 'busy' }

  const tmp = join(dir, 'tmp', `${videoId}-${randomUUID().slice(0, 8)}`)
  await mkdir(tmp, { recursive: true })
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--newline',
    '--progress',
    '-f',
    'bestaudio/best',
    '-x',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '--ffmpeg-location',
    toolPath('ffmpeg'),
    '-o',
    join(tmp, `${safeName(title)}.%(ext)s`),
    '--print',
    'after_move:filepath',
    `https://www.youtube.com/watch?v=${videoId}`
  ]
  try {
    const { file, error } = await new Promise<{ file?: string; error?: string }>((resolve) => {
      const p = spawn(toolPath('ytdlp'), args, { windowsHide: true })
      jobs.set(videoId, p)
      let lastLine = ''
      let errLine = ''
      const onLine = (line: string): void => {
        const pct = /\[download\]\s+([\d.]+)%/.exec(line)
        if (pct) onProgress({ videoId, stage: 'download', pct: Math.round(Number(pct[1])) })
        else if (/^\[(ExtractAudio|ffmpeg|Metadata)\]/.test(line)) onProgress({ videoId, stage: 'convert', pct: 100 })
        else if (line.trim() && !line.startsWith('[')) lastLine = line.trim()
      }
      let buf = ''
      p.stdout.on('data', (d: Buffer) => {
        buf += d.toString()
        const lines = buf.split(/\r?\n/)
        buf = lines.pop() ?? ''
        lines.forEach(onLine)
      })
      p.stderr.on('data', (d: Buffer) => {
        for (const l of d.toString().split(/\r?\n/)) if (/ERROR/.test(l)) errLine = l.replace(/^.*?ERROR:\s*/, '').trim()
      })
      p.on('error', (e) => resolve({ error: e.message }))
      p.on('close', (code, signal) => {
        if (buf) onLine(buf)
        jobs.delete(videoId)
        if (signal || code === null) resolve({ error: 'cancelled' })
        else if (code === 0 && lastLine && existsSync(lastLine)) resolve({ file: lastLine })
        else resolve({ error: errLine || `yt-dlp exited with code ${code}` })
      })
    })
    if (!file) {
      if (error === 'cancelled') return { ok: false, error: 'cancelled' }
      return { ok: false, error: /sign in|bot|age/i.test(error ?? '') ? 'blocked' : 'failed', message: error }
    }
    const r = await importMedia([file])
    if (!r.added[0]) return { ok: false, error: 'failed', message: 'The MP3 could not be added to the media library' }
    return { ok: true, media: r.added[0] }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

export function cancelDownload(videoId: string): void {
  jobs.get(videoId)?.kill()
}
