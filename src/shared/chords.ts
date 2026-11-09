// Chords for musicians.
//
// Chords live inline in the slide text, in brackets before the syllable they fall on:
//   [G]Amazing [C]grace, how [G]sweet the [D/F#]sound
// Nashville numbers work the same way ([1], [4], [6m], [b7], [5/7]) and are read against the song key.
// A line with only chords (plus bar lines and repeat marks) is an instrumental line: [G] [C] | [D] x2.
//
// The audience never sees chords: stripChords() removes them (and chord-only lines) for every audience
// screen, OBS overlay and wireless screen. Only the stage display draws them.

const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Keys offered in the song editor (major, then minor). */
export const KEYS = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'
]

// Chord quality: only known building blocks, so words like [Chorus] or [Bridge] are never read as chords.
const QUALITY = String.raw`(?:maj|min|m|M|dim|aug|sus|add|alt|no|omit|Δ|°|ø|\+|-|\d{1,2}|[#b♯♭]\d{1,2}|\((?:[#b♯♭]?\d{1,2},?)+\)|\/(?=\d))*`
const LETTER_RE = new RegExp(String.raw`^([A-G])([#b♯♭]?)(${QUALITY})(?:\/([A-G])([#b♯♭]?))?$`)
// Numbers: no "6/9"-style slash in the quality, so "5/7" reads as 5 over 7.
const QUALITY_N = QUALITY.replace(String.raw`|\/(?=\d)`, '')
const NASH_RE = new RegExp(String.raw`^([#b♯♭]?)([1-7])(${QUALITY_N})(?:\/([#b♯♭]?)([1-7]))?$`)

export interface Chord {
  kind: 'letter' | 'number'
  root: number // pitch class (letter) or semitones above the key (number)
  quality: string
  bass: number | null
  /** Written with flats (keeps the author's spelling when no key says otherwise). */
  flat: boolean
}

const acc = (a: string): number => (a === '#' || a === '♯' ? 1 : a === 'b' || a === '♭' ? -1 : 0)
const mod = (n: number): number => ((n % 12) + 12) % 12
const DEGREE = [0, 2, 4, 5, 7, 9, 11] // major scale

export function parseChord(token: string): Chord | null {
  const t = token.trim()
  let m = LETTER_RE.exec(t)
  if (m) {
    return {
      kind: 'letter',
      root: mod(LETTER_PC[m[1]] + acc(m[2])),
      quality: m[3],
      bass: m[4] ? mod(LETTER_PC[m[4]] + acc(m[5])) : null,
      flat: m[2] === 'b' || m[2] === '♭' || m[5] === 'b' || m[5] === '♭'
    }
  }
  m = NASH_RE.exec(t)
  if (m) {
    return {
      kind: 'number',
      root: mod(DEGREE[Number(m[2]) - 1] + acc(m[1])),
      quality: m[3],
      bass: m[5] ? mod(DEGREE[Number(m[5]) - 1] + acc(m[4])) : null,
      flat: false
    }
  }
  return null
}

export const isChord = (token: string): boolean => token === 'N.C.' || parseChord(token) !== null

// ---------- keys ----------

export interface Key {
  tonic: number
  minor: boolean
  flats: boolean
}

const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6]) // F Bb Eb Ab Db Gb
const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3]) // Dm Gm Cm Fm Bbm Ebm

export function parseKey(k?: string | null): Key | null {
  if (!k) return null
  const m = /^\s*([A-G])([#b♯♭]?)\s*(m|min|minor)?\s*$/i.exec(k)
  if (!m) return null
  const tonic = mod(LETTER_PC[m[1].toUpperCase()] + acc(m[2]))
  const minor = !!m[3]
  const flats = acc(m[2]) < 0 || (acc(m[2]) === 0 && (minor ? FLAT_MINOR : FLAT_MAJOR).has(tonic))
  return { tonic, minor, flats: acc(m[2]) > 0 ? false : flats }
}

export function keyName(k: Key): string {
  return (k.flats ? NOTES_FLAT : NOTES_SHARP)[k.tonic] + (k.minor ? 'm' : '')
}

/** Move a key by semitones, spelled the way musicians expect (Bb not A#, F# not Gb). */
export function transposeKey(key: string | undefined, semis: number): string | undefined {
  const k = parseKey(key)
  if (!k) return key
  const tonic = mod(k.tonic + semis)
  const flatSet = k.minor ? FLAT_MINOR : FLAT_MAJOR
  // Six-sharp/six-flat: prefer the common spelling (F# major, Eb minor).
  const flats = flatSet.has(tonic) && !(tonic === 6 && !k.minor)
  return keyName({ tonic, minor: k.minor, flats })
}

// ---------- formatting ----------

const pretty = (s: string): string => s.replace(/#/g, '♯').replace(/(?<=[A-G1-7]|^|\/)b(?=\d|$|[^a-z])/g, '♭')

function noteName(pc: number, flats: boolean): string {
  return (flats ? NOTES_FLAT : NOTES_SHARP)[mod(pc)]
}

function numberName(semis: number): string {
  const s = mod(semis)
  const i = DEGREE.indexOf(s)
  if (i >= 0) return String(i + 1)
  // Between scale degrees: b3, b6, b7, b2, #4.
  return s === 6 ? '#4' : `b${DEGREE.indexOf(s + 1) + 1}`
}

export type ChordNotation = 'standard' | 'nashville'

/**
 * How one chord should be written on the stage.
 * key: the song key (before any live transpose). semis: live transpose. Letters move; numbers stay.
 */
export function renderChord(token: string, opts: { key?: string; semis?: number; notation?: ChordNotation; symbols?: boolean }): string {
  const c = parseChord(token)
  if (!c) return token
  const key = parseKey(opts.key)
  const semis = opts.semis ?? 0
  const notation = opts.notation ?? 'standard'
  const target = key ? parseKey(transposeKey(opts.key, semis)) : null
  let out: string

  if (notation === 'nashville' && key) {
    // Relative to the original key, so a transpose never changes the numbers.
    const rel = c.kind === 'number' ? c.root : c.root - key.tonic
    const bass = c.bass === null ? null : c.kind === 'number' ? c.bass : c.bass - key.tonic
    out = numberName(rel) + c.quality + (bass === null ? '' : `/${numberName(bass)}`)
  } else if (c.kind === 'number') {
    if (!target) return opts.symbols === false ? token : pretty(token)
    const flats = target.flats
    out = noteName(target.tonic + c.root, flats) + c.quality + (c.bass === null ? '' : `/${noteName(target.tonic + c.bass, flats)}`)
  } else {
    const flats = target ? target.flats : c.flat
    out = noteName(c.root + semis, flats) + c.quality + (c.bass === null ? '' : `/${noteName(c.bass + semis, flats)}`)
  }
  return opts.symbols === false ? out : pretty(out)
}

/** Transpose every chord in a text permanently (Song editor). Numbers are left alone. */
export function transposeText(text: string, semis: number, fromKey?: string): string {
  if (!semis) return text
  const toKey = transposeKey(fromKey, semis)
  const target = parseKey(toKey)
  return text.replace(/\[([^\]\n]{1,24})\]/g, (all, inner: string) => {
    const c = parseChord(inner)
    if (!c || c.kind === 'number') return all
    const flats = target ? target.flats : c.flat
    return `[${noteName(c.root + semis, flats)}${c.quality}${c.bass === null ? '' : `/${noteName(c.bass + semis, flats)}`}]`
  })
}

// ---------- lines ----------

export interface ChordSegment {
  chord: string | null
  text: string
}

const CHORD_TAG = /\[([^\]\n]{1,24})\]/g
const BAR_TOKEN = /^(\||\|\||\|:|:\||\/|-|–|x\d+|\d+x|\(x?\d+x?\)|\.\.\.|%)$/i

/** Split one line into chord + following lyric. Text in brackets that isn't a chord stays text. */
export function splitLine(line: string): ChordSegment[] {
  const out: ChordSegment[] = []
  let last = 0
  let pending: string | null = null
  for (const m of line.matchAll(CHORD_TAG)) {
    if (!isChord(m[1])) continue
    const before = line.slice(last, m.index)
    if (pending !== null || before) out.push({ chord: pending, text: before })
    pending = m[1]
    last = m.index! + m[0].length
  }
  const rest = line.slice(last)
  if (pending !== null || rest || !out.length) out.push({ chord: pending, text: rest })
  return out
}

export const lineHasChords = (line: string): boolean => splitLine(line).some((s) => s.chord !== null)

/** Instrumental line: only chords, bar lines and repeat marks. */
export function isChordOnlyLine(line: string): boolean {
  const segs = splitLine(line)
  if (!segs.some((s) => s.chord)) return false
  return segs.every((s) => s.text.split(/\s+/).filter(Boolean).every((t) => BAR_TOKEN.test(t)))
}

/** Lyrics without chords, as the audience sees them. Instrumental lines disappear. */
export function stripChords(text: string): string {
  if (!text.includes('[')) return text
  return text
    .split('\n')
    .filter((l) => !isChordOnlyLine(l))
    .map((l) =>
      splitLine(l)
        .map((s) => s.text)
        .join('')
        .replace(/ {2,}/g, ' ')
        .trim()
    )
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
}

export const hasChords = (text: string): boolean => text.includes('[') && text.split('\n').some(lineHasChords)

// ---------- chord sheets (chords on the line above the words) ----------

/** A plain line made only of chord names (no brackets), e.g. "G     C/E    D". */
function isBareChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return false
  let chords = 0
  for (const t of tokens) {
    const clean = t.replace(/^\(|\)$/g, '')
    if (isChord(clean)) chords++
    else if (!BAR_TOKEN.test(t)) return false
  }
  return chords > 0
}

/** Put chords from a chords-above line into the lyric line below, by column. */
function mergeChordLine(chordLine: string, lyric: string): string {
  const marks: { col: number; chord: string }[] = []
  for (const m of chordLine.matchAll(/\S+/g)) {
    const clean = m[0].replace(/^\(|\)$/g, '')
    if (isChord(clean)) marks.push({ col: m.index!, chord: clean })
  }
  let out = ''
  let pos = 0
  const padded = lyric.padEnd(Math.max(lyric.length, (marks.at(-1)?.col ?? 0) + 1), ' ')
  for (const { col, chord } of marks) {
    out += padded.slice(pos, col) + `[${chord}]`
    pos = col
  }
  return (out + padded.slice(pos)).trimEnd()
}

/**
 * Convert a chord sheet to inline chords. Lines of chords directly above a lyric line are merged into it;
 * chord lines on their own become instrumental lines ([G] [C] [D]). Text that is already inline is unchanged.
 */
export function chordSheetToInline(raw: string): string {
  const lines = raw.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.includes('[') && isBareChordLine(line)) {
      const next = lines[i + 1]
      if (next !== undefined && next.trim() && !isBareChordLine(next) && !/^\s*\[.*\]\s*$/.test(next) && !isHeading(next)) {
        out.push(mergeChordLine(line, next))
        i++
      } else {
        out.push(
          line
            .trim()
            .split(/\s+/)
            .map((t) => (isChord(t.replace(/^\(|\)$/g, '')) ? `[${t.replace(/^\(|\)$/g, '')}]` : t))
            .join(' ')
        )
      }
    } else out.push(line)
  }
  return out.join('\n')
}

const isHeading = (l: string): boolean =>
  /^\s*(verse|chorus|bridge|pre-chorus|tag|intro|outro|ending|instrumental|interlude)\b.*:?\s*$/i.test(l)

/** "Key: B" anywhere in the first lines of a pasted sheet. Returns the key and the text without that line. */
export function extractKey(raw: string): { key?: string; text: string } {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const m = /^\s*key\s*[:=-]\s*([A-G][#b♯♭]?\s*m?(?:in(?:or)?)?)\s*$/i.exec(lines[i])
    if (m && parseKey(m[1])) {
      lines.splice(i, 1)
      return { key: keyName(parseKey(m[1])!), text: lines.join('\n') }
    }
  }
  return { text: raw }
}

/** The seven chords of a key (for the chord palette): I ii iii IV V vi vii° or the minor equivalents. */
export function diatonicChords(key?: string): string[] {
  const k = parseKey(key)
  if (!k) return ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'G7']
  const name = (s: number): string => noteName(k.tonic + s, k.flats)
  if (k.minor) return [`${name(0)}m`, `${name(2)}dim`, name(3), `${name(5)}m`, `${name(7)}m`, name(8), name(10), name(7)]
  return [name(0), `${name(2)}m`, `${name(4)}m`, name(5), name(7), `${name(9)}m`, `${name(11)}dim`, `${name(7)}/${name(11)}`]
}

export const NASHVILLE_PALETTE = ['1', '2m', '3m', '4', '5', '6m', '7dim', 'b7', '5/7', '4/6']

// Scale degrees of the major key and whether the chord on each is minor (dim counts as minor).
const MAJOR_DEG = [0, 2, 4, 5, 7, 9, 11]
const MAJOR_MINORQ = [false, true, true, false, false, true, true]

/**
 * Guess a song's key from its letter chords: the key whose scale holds the most of them (with the right major /
 * minor quality); the first and last chord break ties (songs tend to start and end on the home chord).
 * Undefined when the lyrics have no letter chords.
 */
export function guessKey(text: string): string | undefined {
  const chords: Chord[] = []
  for (const m of text.matchAll(CHORD_TAG)) {
    const c = parseChord(m[1])
    if (c?.kind === 'letter') chords.push(c)
  }
  if (!chords.length) return undefined
  const isMinor = (c: Chord): boolean => /^(m(?!aj)|min|-|dim|°|ø)/.test(c.quality)
  let best: { tonic: number; minor: boolean; score: number } | null = null
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const minor of [false, true]) {
      const major = minor ? mod(tonic + 3) : tonic // relative major: same chords
      let score = 0
      for (const c of chords) {
        const i = MAJOR_DEG.indexOf(mod(c.root - major))
        score += i < 0 ? -1 : MAJOR_MINORQ[i] === isMinor(c) ? 1 : 0.25
      }
      const home = (c: Chord): boolean => c.root === tonic && isMinor(c) === minor
      if (home(chords[0])) score += 1.5
      if (home(chords[chords.length - 1])) score += 1
      if (!best || score > best.score + 1e-9) best = { tonic, minor, score }
    }
  }
  if (!best) return undefined
  const flats = chords.some((c) => c.flat) || (best.minor ? FLAT_MINOR : FLAT_MAJOR).has(best.tonic)
  return keyName({ tonic: best.tonic, minor: best.minor, flats: flats && !(best.tonic === 6 && !best.minor) })
}
