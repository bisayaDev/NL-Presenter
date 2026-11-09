// Fullscreen output windows: the audience screen (projector) and the stage screen (performer monitor).
import { BrowserWindow, powerSaveBlocker, screen, type WebPreferences } from 'electron'
import type { DisplayInfo, ScreenKind, ScreensStatus } from '@shared/types'
import { outputsToReconnect, type WantedOutputs } from '@shared/outputs'
import { tm, type MainKey } from './i18n'

const isMac = process.platform === 'darwin'

interface Opts {
  webPreferences: WebPreferences
  load: (win: BrowserWindow, route: string) => void
  onChange: () => void
  focusOperator: () => void
  /** Something happened the operator should hear about (lost, reconnected, restarted). */
  notice?: (text: string, tone: 'ok' | 'warn') => void
}

const wins: Record<ScreenKind, BrowserWindow | null> = { audience: null, stage: null }
const displayOf: Record<ScreenKind, number | null> = { audience: null, stage: null }
/** Outputs the operator opened and hasn't closed; kept while their display is unplugged. */
const wanted: WantedOutputs = { audience: null, stage: null }
const NAME: Record<ScreenKind, MainKey> = { audience: 'main.screen.output', stage: 'main.screen.stage' }
let sleepBlockerId: number | null = null
let opts: Opts

export function initScreens(o: Opts): void {
  opts = o
}

export function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || tm('main.screen.display', { n: i + 1 }),
    width: d.size.width,
    height: d.size.height,
    primary: d.id === primaryId
  }))
}

export function screensStatus(): ScreensStatus {
  return {
    audience: { open: !!wins.audience, displayId: displayOf.audience, lost: !wins.audience && !!wanted.audience },
    stage: { open: !!wins.stage, displayId: displayOf.stage, lost: !wins.stage && !!wanted.stage }
  }
}

/** For the crash-safe session: where each output should be (null = closed on purpose). */
export function wantedOutputs(): WantedOutputs {
  return { audience: wanted.audience, stage: wanted.stage }
}

export function screenWindow(kind: ScreenKind): BrowserWindow | null {
  const w = wins[kind]
  return w && !w.isDestroyed() ? w : null
}

export function screenWindows(): BrowserWindow[] {
  return [wins.audience, wins.stage].filter((w): w is BrowserWindow => !!w && !w.isDestroyed())
}

function updateSleepBlocker(): void {
  const anyOpen = !!wins.audience || !!wins.stage
  if (anyOpen && sleepBlockerId === null) sleepBlockerId = powerSaveBlocker.start('prevent-display-sleep')
  if (!anyOpen && sleepBlockerId !== null) {
    powerSaveBlocker.stop(sleepBlockerId)
    sleepBlockerId = null
  }
}

export function openScreen(kind: ScreenKind, displayId: number | null): ScreensStatus {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const other = kind === 'audience' ? 'stage' : 'audience'
  // Default: a non-primary display the other screen isn't using. If none is free, open a
  // window instead of covering the other screen (the operator can still pick a display explicitly).
  const target =
    displays.find((d) => d.id === displayId) ??
    displays.find((d) => d.id !== primary.id && d.id !== displayOf[other]) ??
    null

  closeScreen(kind, false)
  // Automatic reopen (display came back) must not pull focus away from whatever the operator is using.
  const hadFocus = !!BrowserWindow.getFocusedWindow()

  const fullscreen = !!target && target.id !== primary.id
  const offset = kind === 'audience' ? 80 : 140
  const bounds = fullscreen
    ? target!.bounds
    : { x: primary.bounds.x + offset, y: primary.bounds.y + offset, width: 960, height: 540 }

  const win = new BrowserWindow({
    ...bounds,
    show: false,
    frame: !fullscreen,
    title: kind === 'audience' ? tm('main.window.output') : tm('main.window.stage'),
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: opts.webPreferences
  })
  wins[kind] = win
  displayOf[kind] = target?.id ?? primary.id
  const used = target ?? primary
  const label = listDisplays().find((d) => d.id === used.id)?.label ?? used.label
  wanted[kind] = { displayId: used.id, label, width: used.size.width, height: used.size.height }

  win.once('ready-to-show', () => {
    if (fullscreen) {
      // simpleFullScreen avoids macOS creating a separate Space for the projector.
      if (isMac) win.setSimpleFullScreen(true)
      else win.setFullScreen(true)
    }
    win.showInactive()
    if (hadFocus) opts.focusOperator()
  })
  watchRenderer(kind, win)
  win.on('closed', () => {
    if (wins[kind] === win) {
      // Closed from its own window frame: the operator doesn't want it back.
      wanted[kind] = null
      wins[kind] = null
      displayOf[kind] = null
      updateSleepBlocker()
      opts.onChange()
    }
  })
  opts.load(win, kind === 'audience' ? 'output' : 'stage')
  updateSleepBlocker()
  opts.onChange()
  return screensStatus()
}

/** `forget`: the operator closed it (default). Pruning an unplugged display keeps it wanted. */
export function closeScreen(kind: ScreenKind, notify = true, forget = true): ScreensStatus {
  const win = wins[kind]
  if (forget) wanted[kind] = null
  wins[kind] = null
  displayOf[kind] = null
  if (win && !win.isDestroyed()) win.close()
  updateSleepBlocker()
  if (notify) opts.onChange()
  return screensStatus()
}

export function closeAllScreens(): void {
  closeScreen('audience', false)
  closeScreen('stage', false)
}

/** Close screens whose display was unplugged, but remember them so they can come back. */
export function pruneScreens(): void {
  const ids = new Set(screen.getAllDisplays().map((d) => d.id))
  for (const kind of ['audience', 'stage'] as const) {
    if (displayOf[kind] !== null && !ids.has(displayOf[kind]!)) {
      const label = wanted[kind]?.label
      closeScreen(kind, true, false)
      opts.notice?.(label ? tm('main.screen.lostOn', { name: tm(NAME[kind]), display: label }) : tm('main.screen.lost', { name: tm(NAME[kind]) }), 'warn')
    }
  }
}

/** A display came back: reopen wanted outputs on it (same id, or same name and size). */
export function reconnectScreens(): ScreenKind[] {
  const plan = outputsToReconnect(
    wanted,
    { audience: !!wins.audience, stage: !!wins.stage },
    listDisplays(),
    { audience: displayOf.audience, stage: displayOf.stage }
  )
  for (const { kind, display } of plan) {
    openScreen(kind, display.id)
    opts.notice?.(kind === 'audience' ? tm('main.screen.projectorBack') : tm('main.screen.stageBack', { display: display.label }), 'ok')
  }
  return plan.map((p) => p.kind)
}

/** The operator no longer waits for a lost output. */
export function forgetScreen(kind: ScreenKind): ScreensStatus {
  if (!wins[kind]) wanted[kind] = null
  opts.onChange()
  return screensStatus()
}

/** Output page crashed or froze: reload it (it reads the current picture with state:get on load). */
function watchRenderer(kind: ScreenKind, win: BrowserWindow): void {
  const wc = win.webContents
  let recent: number[] = []
  let hang: ReturnType<typeof setTimeout> | undefined
  const restart = (why: string): void => {
    if (win.isDestroyed() || wins[kind] !== win) return
    const now = Date.now()
    recent = recent.filter((t) => now - t < 60_000)
    if (recent.length >= 3) {
      opts.notice?.(tm('main.screen.failing', { name: tm(NAME[kind]), why }), 'warn')
      return
    }
    recent.push(now)
    wc.reload()
    opts.notice?.(tm('main.screen.restarted', { name: tm(NAME[kind]), why }), 'warn')
  }
  let froze = false
  wc.on('render-process-gone', (_e, d) => {
    if (d.reason === 'clean-exit') return
    const why = froze ? 'it froze' : 'it crashed'
    froze = false
    setTimeout(() => restart(why), 300)
  })
  wc.on('unresponsive', () => {
    clearTimeout(hang)
    // Give it a moment; a long video decode can stall briefly. Killing it fires render-process-gone → reload.
    hang = setTimeout(() => {
      if (win.isDestroyed() || wins[kind] !== win) return
      froze = true
      wc.forcefullyCrashRenderer()
    }, 3000)
  })
  wc.on('responsive', () => clearTimeout(hang))
}
