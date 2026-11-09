// Turn PowerPoint / Keynote / OpenDocument presentations into a PDF, using whatever is installed:
//   Windows: PowerPoint (best fidelity), then LibreOffice.
//   macOS:   LibreOffice (silent), then Keynote. Keynote files go to Keynote first.
// The PDF is then drawn page by page in the renderer (pdf.js).
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, delimiter, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tm } from './i18n'

export const DECK_EXT = ['pdf', 'pptx', 'ppt', 'pps', 'ppsx', 'key', 'odp']

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

export class ConvertError extends Error {
  constructor(
    message: string,
    readonly code: 'no-converter' | 'failed'
  ) {
    super(message)
  }
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).toString().trim().split('\n').slice(-3).join(' ')))
      else resolve(stdout.toString())
    })
  })
}

function findSoffice(): string | null {
  const candidates = isMac
    ? ['/Applications/LibreOffice.app/Contents/MacOS/soffice', join(process.env['HOME'] ?? '', 'Applications/LibreOffice.app/Contents/MacOS/soffice')]
    : isWin
      ? [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']]
          .filter(Boolean)
          .map((d) => join(d!, 'LibreOffice', 'program', 'soffice.exe'))
      : ['/usr/bin/soffice', '/usr/bin/libreoffice', '/snap/bin/libreoffice']
  for (const c of candidates) if (existsSync(c)) return c
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    for (const name of isWin ? ['soffice.exe'] : ['soffice', 'libreoffice']) {
      const p = join(dir, name)
      if (dir && existsSync(p)) return p
    }
  }
  return null
}

const KEYNOTE_IDS = ['com.apple.Keynote', 'com.apple.iWork.Keynote']
function findKeynote(): boolean {
  if (!isMac) return false
  return ['/Applications/Keynote.app', '/Applications/Keynote Creator Studio.app'].some((p) => existsSync(p))
}

async function viaSoffice(soffice: string, src: string, out: string): Promise<void> {
  // Own profile folder, so it works even while LibreOffice is open on the desktop.
  const profile = pathToFileURL(join(out, 'profile')).toString()
  await run(soffice, [`-env:UserInstallation=${profile}`, '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', out, src], 180_000)
}

async function viaKeynote(src: string, pdf: string): Promise<void> {
  // Keynote opens .key and PowerPoint files. Quit it again if we were the ones who started it.
  const script = (id: string): string => `
on run argv
  set inFile to POSIX file (item 1 of argv)
  set outFile to POSIX file (item 2 of argv)
  set wasRunning to application id "${id}" is running
  tell application id "${id}"
    set n0 to count of documents
    set d to open inFile
    -- PowerPoint files are imported in the background: wait for the document to appear.
    if d is missing value then
      repeat 180 times
        if (count of documents) > n0 then exit repeat
        delay 0.5
      end repeat
      if (count of documents) = n0 then
        if not wasRunning then quit
        error "Keynote did not open the file. Open Keynote once to finish its setup, then try again." number 1001
      end if
      set d to front document
    end if
    export d to outFile as PDF with properties {PDF image quality:Best, skipped slides:false}
    close d saving no
    if not wasRunning then quit
  end tell
end run`
  let last: Error | null = null
  for (const id of KEYNOTE_IDS) {
    try {
      await run('osascript', ['-e', script(id), src, pdf], 240_000)
      return
    } catch (e) {
      last = e as Error
      if (!/-1728|-10814|can.t get application|Can’t get application/i.test(last.message)) break // Keynote found but failed
    }
  }
  if (last && /\b1001\b/.test(last.message)) throw new Error(tm('main.convert.keynoteSetup'))
  throw new Error((last?.message ?? 'Keynote failed').replace(/^.*execution error: (?:Keynote[^:]*got an error: )?/, '').replace(/ \(-?\d+\)$/, ''))
}

async function viaPowerPoint(src: string, pdf: string, out: string): Promise<void> {
  const ps1 = join(out, 'export.ps1')
  await writeFile(
    ps1,
    `$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
$p = $app.Presentations.Open($args[0], $true, $false, $false)
try { $p.SaveAs($args[1], 32) } finally { $p.Close() }
if ($app.Presentations.Count -eq 0) { $app.Quit() }
`,
    'utf8'
  )
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1, src, pdf], 240_000)
}

/** Convert a presentation to PDF and return the PDF's path inside a temp folder (caller removes `dir`). */
export async function convertToPdf(src: string, onStep?: (what: string) => void): Promise<{ pdf: string; dir: string }> {
  const ext = extname(src).slice(1).toLowerCase()
  const dir = await mkdtemp(join(tmpdir(), 'nl-deck-'))
  const pdf = join(dir, `${basename(src, extname(src))}.pdf`)
  // Automated tests: stand in for the office program with a ready-made PDF.
  const fake = process.env['NL_TEST_CONVERT_PDF']
  if (fake) {
    onStep?.('Test converter')
    await copyFile(fake, pdf)
    return { pdf, dir }
  }
  const soffice = findSoffice()
  const keynote = findKeynote()
  type Way = { name: string; go: () => Promise<void> }
  const ways: Way[] = []
  const so: Way | null = soffice ? { name: 'LibreOffice', go: () => viaSoffice(soffice, src, dir) } : null
  const kn: Way | null = keynote && ext !== 'odp' ? { name: 'Keynote', go: () => viaKeynote(src, pdf) } : null
  const pp: Way | null = isWin && ext !== 'key' ? { name: 'PowerPoint', go: () => viaPowerPoint(src, pdf, dir) } : null
  if (isWin) ways.push(...[pp, so].filter((w): w is Way => !!w))
  else if (ext === 'key') ways.push(...[kn, so].filter((w): w is Way => !!w))
  else ways.push(...[so, kn].filter((w): w is Way => !!w))

  if (!ways.length) {
    await rm(dir, { recursive: true, force: true })
    throw new ConvertError(
      isMac ? tm('main.convert.noConverterMac') : tm('main.convert.noConverterWin'),
      'no-converter'
    )
  }
  const errors: string[] = []
  for (const w of ways) {
    onStep?.(w.name)
    try {
      await w.go()
      const made = (await readdir(dir)).find((f) => f.toLowerCase().endsWith('.pdf'))
      if (made) return { pdf: join(dir, made), dir }
      errors.push(tm('main.convert.noPdf', { app: w.name }))
    } catch (e) {
      errors.push(`${w.name}: ${(e as Error).message}`)
    }
  }
  await rm(dir, { recursive: true, force: true })
  throw new ConvertError(tm('main.convert.failed', { file: basename(src), errors: errors.join('; ') }), 'failed')
}
