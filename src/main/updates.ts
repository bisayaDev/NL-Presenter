// Update notice: asks GitHub for the latest published release and tells the operator window when it's newer
// than this app. It never downloads or installs anything (unsigned Mac builds can't self-update); the user
// gets a link to the release page. Settings: `updateCheck` (default on), `updateSkip` (a version to stay quiet about).
import { app, net } from 'electron'
import type { UpdateInfo, UpdateStatus } from '@shared/types'

const REPO = 'bisayaDev/NL-Presenter'
const FIRST_CHECK_MS = 20_000 // after start-up, so it never competes with opening the service
const EVERY_MS = 6 * 60 * 60 * 1000

/** Compare dotted versions ("0.10.0" > "0.9.2"); a leading "v" and anything after "-" or "+" are ignored. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string): number[] => v.replace(/^v/i, '').split(/[-+]/)[0].split('.').map((n) => parseInt(n, 10) || 0)
  const x = parts(a)
  const y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}

let latest: UpdateInfo | null = null
let lastError: string | null = null
let checkedAt: number | null = null
let settings: { enabled: () => boolean; skipped: () => string | null } | null = null

async function fetchLatest(): Promise<UpdateInfo | null> {
  // Test hook: NL_UPDATE_TEST=9.9.9 pretends that version was released (no network).
  const fake = process.env['NL_UPDATE_TEST']
  if (fake) return { version: fake.replace(/^v/i, ''), url: `https://github.com/${REPO}/releases`, notes: 'Test release notes.', publishedAt: new Date().toISOString() }
  const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'NLPresenter-update-check' }
  })
  if (res.status === 404) return null // no published release yet
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const r = (await res.json()) as { tag_name?: string; html_url?: string; body?: string; published_at?: string; draft?: boolean; prerelease?: boolean }
  if (!r.tag_name || r.draft || r.prerelease) return null
  return {
    version: r.tag_name.replace(/^v/i, ''),
    url: r.html_url ?? `https://github.com/${REPO}/releases/latest`,
    notes: (r.body ?? '').slice(0, 4000),
    publishedAt: r.published_at ?? ''
  }
}

/** Ask GitHub now. Returns the status; `available` is set only when the release is newer than this app. */
export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    const info = await fetchLatest()
    latest = info && compareVersions(info.version, app.getVersion()) > 0 ? info : null
    lastError = null
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e)
  }
  checkedAt = Date.now()
  return updateStatus()
}

export function updateStatus(): UpdateStatus {
  return {
    current: app.getVersion(),
    available: latest,
    checkedAt,
    error: lastError,
    auto: settings?.enabled() ?? true,
    skipped: settings?.skipped() ?? null
  }
}

/**
 * Automatic checks: once shortly after start-up, then every 6 hours while the app is open. `enabled()` and
 * `skipped()` are read on every run, so turning the setting off takes effect at once.
 */
export function startUpdateChecks(opts: { enabled: () => boolean; skipped: () => string | null; notify: (info: UpdateInfo) => void }): void {
  settings = opts
  // Test runs and snapshots stay off the network unless the test hook asks for a fake release.
  if (process.env['NL_SNAPSHOT_DIR'] && !process.env['NL_UPDATE_TEST']) return
  const run = async (): Promise<void> => {
    if (!opts.enabled()) return
    const st = await checkForUpdate()
    if (st.available && st.available.version !== opts.skipped()) opts.notify(st.available)
  }
  setTimeout(() => void run(), process.env['NL_UPDATE_TEST'] ? 1500 : FIRST_CHECK_MS)
  setInterval(() => void run(), EVERY_MS)
}
