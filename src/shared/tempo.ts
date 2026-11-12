// Song tempo: BPM and time signature, the beat clock shared by stage screens, and the operator's metronome.
//
// Beats are counted from a shared epoch (StageTempo.startedAt, epoch ms on the operator computer): beat n falls at
// startedAt + n · 60000 / bpm, and beat 0 is a downbeat. Every screen works the phase out from its own clock plus
// the server clock offset, so wired and wireless screens pulse together without any messages per beat.

export const BPM_MIN = 30
export const BPM_MAX = 300

/** Time signatures offered in the song editor. Others ("5/4", "7/8") are kept when imported. */
export const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '12/8'] as const

/** What stage screens need to pulse in step: the song's tempo and when beat 1 of bar 1 fell. */
export interface StageTempo {
  bpm: number
  /** "4/4", "6/8"…; absent when the song only has a BPM (then 4 beats a bar). */
  time?: string
  beatsPerBar: number
  startedAt: number // epoch ms (operator clock)
}

/** A BPM in range, rounded to a whole number; undefined for anything else. */
export function normalizeBpm(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN
  if (!Number.isFinite(n)) return undefined
  const r = Math.round(n)
  return r >= BPM_MIN && r <= BPM_MAX ? r : undefined
}

/** "3/4", "6 / 8", "C" (common time) → "3/4", "6/8", "4/4"; undefined when it isn't a time signature. */
export function normalizeTimeSignature(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  if (/^c$/i.test(s)) return '4/4'
  if (/^c\|$/i.test(s)) return '2/2'
  const m = s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/)
  if (!m) return undefined
  const top = Number(m[1])
  const bottom = Number(m[2])
  if (top < 1 || top > 16 || ![1, 2, 4, 8, 16].includes(bottom)) return undefined
  return `${top}/${bottom}`
}

/**
 * Beats in a bar, as the band counts them. Compound time (6/8, 9/8, 12/8) counts dotted-quarter beats (2, 3, 4 a
 * bar), so the BPM is the dotted-quarter pulse there. Everything else counts the top number.
 */
export function beatsPerBar(time: string | undefined): number {
  const m = time?.match(/^(\d+)\/(\d+)$/)
  if (!m) return 4
  const top = Number(m[1])
  const bottom = Number(m[2])
  if (bottom >= 8 && top > 3 && top % 3 === 0) return top / 3
  return Math.max(1, top)
}

/** "72 BPM · 4/4", "72 BPM", or "" when there's no tempo. */
export function tempoLabel(bpm: number | undefined, time?: string): string {
  if (!bpm) return ''
  return time ? `${bpm} BPM · ${time}` : `${bpm} BPM`
}

/** Where the beat is at `now` (epoch ms): the beat number in the bar (0 = downbeat) and how far into it (0–1). */
export function beatPhase(t: Pick<StageTempo, 'bpm' | 'beatsPerBar' | 'startedAt'>, now: number): { beat: number; frac: number; index: number } {
  const beatMs = 60_000 / t.bpm
  const pos = (now - t.startedAt) / beatMs
  const index = Math.floor(pos)
  const bar = Math.max(1, t.beatsPerBar)
  return { index, beat: ((index % bar) + bar) % bar, frac: pos - index }
}

/**
 * Tap tempo: add a tap (ms) to the list and get the BPM from the last taps. A pause of more than 2 s starts over.
 * Returns the taps to keep and the BPM (undefined until there are two taps).
 */
export function tapTempo(taps: number[], at: number): { taps: number[]; bpm: number | undefined } {
  const last = taps[taps.length - 1]
  const kept = last !== undefined && at - last <= 2000 ? [...taps, at].slice(-8) : [at]
  if (kept.length < 2) return { taps: kept, bpm: undefined }
  const avg = (kept[kept.length - 1] - kept[0]) / (kept.length - 1)
  return { taps: kept, bpm: normalizeBpm(60_000 / avg) }
}
