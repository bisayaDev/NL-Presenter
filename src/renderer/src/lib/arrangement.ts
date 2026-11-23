import type { BackgroundCue, Slide } from '@shared/types'

// Song arrangement for one service item: the order of the song's sections ("Verse 1, Chorus, Verse 2, Chorus, Chorus").
// A section is a run of consecutive slides with the same label. The arrangement stores labels; slides are rebuilt from
// the library song each time it changes, so lyric edits flow into arranged services.
// Background slides sit in the arrangement as `@cue:<id>` (the cue itself is kept beside it, by id).

const CUE = '@cue:'
export const isCue = (name: string): boolean => name.startsWith(CUE)
export const cueId = (name: string): string => name.slice(CUE.length)
export const cueEntry = (id: string): string => CUE + id

/** Only the cues an arrangement still places (undefined when none). */
export function usedCues(arrangement: string[] | undefined, cues: Record<string, BackgroundCue> | undefined): Record<string, BackgroundCue> | undefined {
  const kept = Object.fromEntries((arrangement ?? []).filter(isCue).map(cueId).filter((id) => cues?.[id]).map((id) => [id, cues![id]]))
  return Object.keys(kept).length ? kept : undefined
}

export interface SongSection {
  name: string // the label, or "#3" for unlabeled slides (by the first slide's number)
  label?: string
  slides: Slide[]
}

/** The song's sections in song order. */
export function songSections(slides: Slide[]): SongSection[] {
  const out: SongSection[] = []
  slides.forEach((sl, i) => {
    const last = out.at(-1)
    if (last && last.label === sl.label) last.slides.push(sl)
    else out.push({ name: sl.label ?? `#${i + 1}`, label: sl.label, slides: [sl] })
  })
  return out
}

/** The song order as an arrangement. */
export const songOrder = (slides: Slide[]): string[] => songSections(slides).map((s) => s.name)

/**
 * Expand an arrangement into slides. The n-th "Chorus" uses the song's n-th Chorus section if it has one, else the
 * first. A slide used again gets a new id (`<id>~2`), so every slide in the grid has its own key.
 * Labels the song no longer has are dropped and returned in `missing`.
 */
export function arrangeSlides(
  slides: Slide[],
  arrangement?: string[],
  cues?: Record<string, BackgroundCue>
): { slides: Slide[]; arrangement?: string[]; missing: string[] } {
  if (!arrangement?.length) return { slides: slides.map((sl) => ({ ...sl })), missing: [] }
  const sections = songSections(slides)
  const seenName = new Map<string, number>()
  const usedSlide = new Map<string, number>()
  const out: Slide[] = []
  const kept: string[] = []
  const missing: string[] = []
  for (const name of arrangement) {
    if (isCue(name)) {
      const cue = cues?.[cueId(name)]
      if (!cue) continue // its background is gone: drop it quietly
      kept.push(name)
      out.push({ id: `cue-${cueId(name)}`, label: cue.name, text: '', background: cue.background, cue: true })
      continue
    }
    const all = sections.filter((s) => s.name === name)
    if (!all.length) {
      missing.push(name)
      continue
    }
    const n = seenName.get(name) ?? 0
    seenName.set(name, n + 1)
    const sec = all[n] ?? all[0]
    kept.push(name)
    for (const sl of sec.slides) {
      const uses = (usedSlide.get(sl.id) ?? 0) + 1
      usedSlide.set(sl.id, uses)
      out.push({ ...sl, id: uses === 1 ? sl.id : `${sl.id}~${uses}` })
    }
  }
  // No words left: fall back to the song order.
  if (!out.some((sl) => !sl.cue)) return { slides: slides.map((sl) => ({ ...sl })), missing }
  return { slides: out, arrangement: kept, missing }
}

/** Same order as the song itself? */
export const isSongOrder = (slides: Slide[], arrangement?: string[]): boolean =>
  !arrangement || JSON.stringify(arrangement) === JSON.stringify(songOrder(slides))
