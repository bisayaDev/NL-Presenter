// Automatic backups: a full .nlbackup into a folder (default <userData>/autobackups) once a day while the app
// is open and when it quits. Keeps the newest N, skips when nothing changed since the last one, never runs two
// at once, and skips (with a warning) when the disk has less than 1 GB free.
import { mkdir, readdir, rename, statfs, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { AutoBackupStatus } from '@shared/types'
import * as db from './db'
import { backupFingerprint, createBackup } from './backup'
import { tm } from './i18n'

const DAY = 24 * 60 * 60 * 1000
const MIN_FREE = 1024 ** 3 // 1 GB
const PREFIX = 'NLPresenter-auto-'
const DEFAULT_KEEP = 10

let defaultDir = ''
let running = false
let timer: ReturnType<typeof setInterval> | undefined
let onChange: (s: AutoBackupStatus) => void = () => {}

// Settings (all under "autoBackup…", which restore leaves alone):
//   autoBackup: boolean (default on) · autoBackupDir: string · autoBackupKeep: number
//   autoBackupLast: { at, path, bytes } · autoBackupSig: fingerprint of the last one · autoBackupError: string
function conf(): { enabled: boolean; dir: string; keep: number } {
  const s = db.getSettings()
  const keep = Number(s['autoBackupKeep'])
  return {
    enabled: s['autoBackup'] !== false,
    dir: typeof s['autoBackupDir'] === 'string' && s['autoBackupDir'] ? (s['autoBackupDir'] as string) : defaultDir,
    keep: Number.isFinite(keep) && keep >= 1 ? Math.floor(keep) : DEFAULT_KEEP
  }
}

const safeSig = (): string | null => {
  try {
    return backupFingerprint()
  } catch {
    return null
  }
}

export function autoBackupStatus(): AutoBackupStatus {
  const s = db.getSettings()
  const c = conf()
  const last = s['autoBackupLast'] as { at: number; path: string; bytes: number } | undefined
  return {
    enabled: c.enabled,
    dir: c.dir,
    defaultDir,
    keep: c.keep,
    running,
    lastAt: last?.at ?? null,
    lastPath: last?.path ?? null,
    lastBytes: last?.bytes ?? null,
    current: !!last && !running && safeSig() === s['autoBackupSig'],
    error: typeof s['autoBackupError'] === 'string' ? (s['autoBackupError'] as string) : null
  }
}

export function setAutoBackup(patch: { enabled?: boolean; dir?: string | null; keep?: number }): AutoBackupStatus {
  if (patch.enabled !== undefined) db.setSetting('autoBackup', patch.enabled)
  if (patch.dir !== undefined) db.setSetting('autoBackupDir', patch.dir || '')
  if (patch.keep !== undefined) db.setSetting('autoBackupKeep', Math.max(1, Math.floor(patch.keep)))
  const st = autoBackupStatus()
  onChange(st)
  return st
}

const stamp = (d: Date): string => {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function prune(dir: string, keep: number): Promise<void> {
  const names = await readdir(dir).catch(() => [] as string[])
  // Leftovers of an interrupted run (app closed mid-backup).
  for (const n of names) if (n.startsWith(PREFIX) && n.endsWith('.part')) await unlink(join(dir, n)).catch(() => {})
  const done = names.filter((n) => n.startsWith(PREFIX) && n.endsWith('.nlbackup')).sort() // names sort by time
  for (const n of done.slice(0, Math.max(0, done.length - keep))) await unlink(join(dir, n)).catch(() => {})
}

export type AutoBackupResult = { done: true; path: string } | { done: false; reason: 'off' | 'busy' | 'unchanged' | 'low-disk' | 'error'; message?: string }

/** Run one automatic backup now (`force`: even when off or unchanged, e.g. "Back up now"). */
export async function runAutoBackup(why: 'daily' | 'quit' | 'now'): Promise<AutoBackupResult> {
  const force = why === 'now'
  if (running) return { done: false, reason: 'busy' }
  const c = conf()
  if (!c.enabled && !force) return { done: false, reason: 'off' }
  let sig: string
  try {
    sig = backupFingerprint()
  } catch (e) {
    return { done: false, reason: 'error', message: String((e as Error).message) }
  }
  if (!force && sig === db.getSettings()['autoBackupSig']) return { done: false, reason: 'unchanged' }

  running = true
  onChange(autoBackupStatus())
  try {
    await mkdir(c.dir, { recursive: true })
    const fs = await statfs(c.dir)
    const free = Number(fs.bavail) * Number(fs.bsize)
    if (free < MIN_FREE) {
      const message = tm('main.auto.lowDisk', { dir: c.dir })
      db.setSetting('autoBackupError', message)
      console.warn(message)
      return { done: false, reason: 'low-disk', message }
    }
    const file = join(c.dir, `${PREFIX}${stamp(new Date())}.nlbackup`)
    const part = `${file}.part`
    const summary = await createBackup(part)
    await rename(part, file)
    db.setSetting('autoBackupLast', { at: Date.now(), path: file, bytes: summary.bytes })
    db.setSetting('autoBackupSig', sig)
    db.setSetting('autoBackupError', null)
    await prune(c.dir, c.keep)
    console.log(`Automatic backup (${why}): ${file}`)
    return { done: true, path: file }
  } catch (e) {
    const message = tm('main.auto.failed', { error: String((e as Error).message) })
    db.setSetting('autoBackupError', message)
    console.warn(message)
    return { done: false, reason: 'error', message }
  } finally {
    running = false
    onChange(autoBackupStatus())
  }
}

/** True when a quit-time backup would run (on, and something changed). Cheap enough to call on quit. */
export function quitBackupWanted(): boolean {
  if (running || !conf().enabled) return false
  try {
    return backupFingerprint() !== db.getSettings()['autoBackupSig']
  } catch {
    return false
  }
}

/** Start the daily schedule: checks every 30 minutes (first check 2 minutes after start). */
export function initAutoBackup(dir: string, notify: (s: AutoBackupStatus) => void): void {
  defaultDir = dir
  onChange = notify
  const check = (): void => {
    const st = autoBackupStatus()
    if (st.enabled && (!st.lastAt || Date.now() - st.lastAt >= DAY)) void runAutoBackup('daily')
  }
  setTimeout(check, 2 * 60 * 1000)
  clearInterval(timer)
  timer = setInterval(check, 30 * 60 * 1000)
}
