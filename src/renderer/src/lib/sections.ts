// Song section labels by kind (Verse, Chorus, Bridge…), in English, Spanish and Tagalog, for quick-jump keys.
import type { Slide } from '@shared/types'
import { labelKey } from '@shared/labels'

export type SectionKind = 'verse' | 'chorus' | 'pre-chorus' | 'bridge' | 'ending' | 'intro'

const KINDS: [SectionKind, RegExp][] = [
  // Pre-chorus first: "pre-coro" must not match "coro".
  ['pre-chorus', /^(pre[\s-]?(chorus|coro|koro)|precoro|prechorus|pre)$/],
  ['chorus', /^(chorus|coro|koro|refrain|estribillo|koro ng awit)$/],
  ['verse', /^(verse|verso|talata|estrofa|v)$/],
  ['bridge', /^(bridge|puente|tulay)$/],
  ['ending', /^(tag|ending|outro|final|coda|wakas|cierre)$/],
  ['intro', /^(intro|introduction|introducción|introduccion|panimula)$/]
]

/** "Chorus 2" → chorus, "Coro" → chorus, "Talata 1" → verse, "Puente" → bridge. Null when not a known section. */
export function labelKind(label: string | undefined): SectionKind | null {
  if (!label) return null
  const k = labelKey(label)
  for (const [kind, re] of KINDS) if (re.test(k)) return kind
  return null
}

/** The number at the end of a label ("Verse 2" → 2), or null. */
export function labelNumber(label: string | undefined): number | null {
  const m = label?.trim().match(/(\d+)[a-z]?$/i)
  return m ? Number(m[1]) : null
}

/** Slides where a section starts (the label changes from the slide before). */
const isStart = (slides: Slide[], i: number): boolean => i === 0 || slides[i - 1].label !== slides[i].label

/** The next slide that starts a section of this kind after `from`, wrapping round to the top. */
export function findNextSection(slides: Slide[], kind: SectionKind, from: number): number | null {
  const n = slides.length
  for (let step = 1; step <= n; step++) {
    const i = (from + step + n) % n
    if (labelKind(slides[i].label) === kind && isStart(slides, i)) return i
  }
  return null
}

/** Verse n: the slide labelled "Verse n", else the n-th verse block in the song. */
export function findVerse(slides: Slide[], n: number): number | null {
  const byNumber = slides.findIndex((sl) => labelKind(sl.label) === 'verse' && labelNumber(sl.label) === n)
  if (byNumber >= 0) return byNumber
  let count = 0
  for (let i = 0; i < slides.length; i++) {
    if (labelKind(slides[i].label) === 'verse' && isStart(slides, i) && ++count === n) return i
  }
  return null
}

export const KIND_NAMES: Record<SectionKind, string> = {
  verse: 'Verse',
  chorus: 'Chorus',
  'pre-chorus': 'Pre-Chorus',
  bridge: 'Bridge',
  ending: 'Ending',
  intro: 'Intro'
}
