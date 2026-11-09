// Start-up options that must be known before `app.whenReady` (the settings database opens later):
// a small JSON file, <userData>/boot.json (next to the test database when NL_DB_FILE is set).
import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { BootPrefs } from '@shared/types'

const DEFAULTS: BootPrefs = { cpuVideo: false }

const file = (): string => {
  const testDb = process.env['NL_DB_FILE']
  return testDb ? join(dirname(testDb), 'boot.json') : join(app.getPath('userData'), 'boot.json')
}

export function readBootPrefs(): BootPrefs {
  try {
    const raw = JSON.parse(readFileSync(file(), 'utf8')) as Partial<BootPrefs>
    return { cpuVideo: raw.cpuVideo === true }
  } catch {
    return { ...DEFAULTS }
  }
}

/** Applied once at start-up, before the app is ready. Changes need a restart. */
export const bootPrefsAtStart: BootPrefs = readBootPrefs()

/** Saved prefs plus what this run is using. */
export const bootPrefsView = (): BootPrefs => ({ ...readBootPrefs(), active: { cpuVideo: bootPrefsAtStart.cpuVideo } })

export function writeBootPrefs(patch: Partial<BootPrefs>): BootPrefs {
  const next: BootPrefs = { cpuVideo: patch.cpuVideo ?? readBootPrefs().cpuVideo }
  mkdirSync(dirname(file()), { recursive: true })
  writeFileSync(file(), JSON.stringify(next, null, 2))
  return bootPrefsView()
}
if (bootPrefsAtStart.cpuVideo) {
  app.disableHardwareAcceleration()
  console.log('Video decoding: CPU only (GPU acceleration off)')
}
