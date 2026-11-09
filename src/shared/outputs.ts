// Crash-safe resume and projector reconnect: pure decisions, shared by main and the operator window.
// No Electron imports, so this can be checked with plain Node.

export type OutputKind = 'audience' | 'stage'

/** The display an output was open on, remembered so it can come back there. */
export interface WantedOutput {
  displayId: number
  label: string
  width: number
  height: number
}

export type WantedOutputs = Record<OutputKind, WantedOutput | null>

export interface DisplayLike {
  id: number
  label: string
  width: number
  height: number
}

/** Live position saved by the operator window (setting `session`). */
export interface SavedSession {
  serviceId: string
  live: { itemId: string; index: number } | null
  at: number
}

/**
 * The display to use for a remembered output: same id first, then same label and size
 * (macOS and Windows can hand a replugged display a new id). Displays in `exclude` are skipped.
 */
export function matchDisplay<D extends DisplayLike>(want: WantedOutput, displays: D[], exclude: number[] = []): D | null {
  const free = displays.filter((d) => !exclude.includes(d.id))
  return (
    free.find((d) => d.id === want.displayId) ??
    free.find((d) => d.label === want.label && d.width === want.width && d.height === want.height) ??
    null
  )
}

/**
 * After displays change: which outputs that are wanted but not open should reopen now, and where.
 * Outputs the operator closed are not wanted, so they never come back by themselves.
 */
export function outputsToReconnect<D extends DisplayLike>(
  wanted: WantedOutputs,
  open: Record<OutputKind, boolean>,
  displays: D[],
  usedBy: Record<OutputKind, number | null>
): { kind: OutputKind; display: D }[] {
  const out: { kind: OutputKind; display: D }[] = []
  const taken = [usedBy.audience, usedBy.stage].filter((x): x is number => x !== null)
  for (const kind of ['audience', 'stage'] as const) {
    const want = wanted[kind]
    if (!want || open[kind]) continue
    const d = matchDisplay(want, displays, taken)
    if (d) {
      out.push({ kind, display: d })
      taken.push(d.id)
    }
  }
  return out
}

/** Whether to offer "Resume where you left off", and what to show. */
export function resumeOffer<I extends { id: string; title: string; slides: unknown[] }>(
  uncleanExit: boolean,
  session: SavedSession | null | undefined,
  service: { id: string; items: I[] }
): { item: I; index: number } | null {
  if (!uncleanExit || !session?.live || session.serviceId !== service.id) return null
  const item = service.items.find((i) => i.id === session.live!.itemId)
  if (!item || !item.slides.length) return null
  return { item, index: Math.min(Math.max(0, session.live.index), item.slides.length - 1) }
}
