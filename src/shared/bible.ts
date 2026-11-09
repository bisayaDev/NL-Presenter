// Canonical 66-book list, reference parsing and formatting. Shared by main and renderer.
import type { ParallelLayout, ParallelText } from './types'

export interface BookDef {
  n: number // 1–66, the same numbering Zefania XML uses
  code: string // USFM code
  name: string
  abbr: string
  aliases?: string[]
}

export const BOOKS: BookDef[] = [
  { n: 1, code: 'GEN', name: 'Genesis', abbr: 'Gen', aliases: ['gn'] },
  { n: 2, code: 'EXO', name: 'Exodus', abbr: 'Exod', aliases: ['ex'] },
  { n: 3, code: 'LEV', name: 'Leviticus', abbr: 'Lev', aliases: ['lv'] },
  { n: 4, code: 'NUM', name: 'Numbers', abbr: 'Num', aliases: ['nm', 'nb'] },
  { n: 5, code: 'DEU', name: 'Deuteronomy', abbr: 'Deut', aliases: ['dt'] },
  { n: 6, code: 'JOS', name: 'Joshua', abbr: 'Josh', aliases: ['jsh'] },
  { n: 7, code: 'JDG', name: 'Judges', abbr: 'Judg', aliases: ['jdg', 'jg'] },
  { n: 8, code: 'RUT', name: 'Ruth', abbr: 'Ruth', aliases: ['rth', 'ru'] },
  { n: 9, code: '1SA', name: '1 Samuel', abbr: '1Sam', aliases: ['1sm', '1s'] },
  { n: 10, code: '2SA', name: '2 Samuel', abbr: '2Sam', aliases: ['2sm', '2s'] },
  { n: 11, code: '1KI', name: '1 Kings', abbr: '1Kgs', aliases: ['1kgs', '1k'] },
  { n: 12, code: '2KI', name: '2 Kings', abbr: '2Kgs', aliases: ['2kgs', '2k'] },
  { n: 13, code: '1CH', name: '1 Chronicles', abbr: '1Chr', aliases: ['1chr'] },
  { n: 14, code: '2CH', name: '2 Chronicles', abbr: '2Chr', aliases: ['2chr'] },
  { n: 15, code: 'EZR', name: 'Ezra', abbr: 'Ezra' },
  { n: 16, code: 'NEH', name: 'Nehemiah', abbr: 'Neh' },
  { n: 17, code: 'EST', name: 'Esther', abbr: 'Esth' },
  { n: 18, code: 'JOB', name: 'Job', abbr: 'Job', aliases: ['jb'] },
  { n: 19, code: 'PSA', name: 'Psalms', abbr: 'Ps', aliases: ['ps', 'psa', 'psalm', 'pss'] },
  { n: 20, code: 'PRO', name: 'Proverbs', abbr: 'Prov', aliases: ['prv', 'pr'] },
  { n: 21, code: 'ECC', name: 'Ecclesiastes', abbr: 'Eccl', aliases: ['ec', 'qoh'] },
  { n: 22, code: 'SNG', name: 'Song of Solomon', abbr: 'Song', aliases: ['sos', 'song', 'songofsongs', 'canticles', 'ss'] },
  { n: 23, code: 'ISA', name: 'Isaiah', abbr: 'Isa', aliases: ['is'] },
  { n: 24, code: 'JER', name: 'Jeremiah', abbr: 'Jer', aliases: ['jr'] },
  { n: 25, code: 'LAM', name: 'Lamentations', abbr: 'Lam' },
  { n: 26, code: 'EZK', name: 'Ezekiel', abbr: 'Ezek', aliases: ['ezk', 'eze'] },
  { n: 27, code: 'DAN', name: 'Daniel', abbr: 'Dan', aliases: ['dn'] },
  { n: 28, code: 'HOS', name: 'Hosea', abbr: 'Hos' },
  { n: 29, code: 'JOL', name: 'Joel', abbr: 'Joel', aliases: ['jl'] },
  { n: 30, code: 'AMO', name: 'Amos', abbr: 'Amos' },
  { n: 31, code: 'OBA', name: 'Obadiah', abbr: 'Obad', aliases: ['ob'] },
  { n: 32, code: 'JON', name: 'Jonah', abbr: 'Jonah', aliases: ['jnh'] },
  { n: 33, code: 'MIC', name: 'Micah', abbr: 'Mic' },
  { n: 34, code: 'NAM', name: 'Nahum', abbr: 'Nah' },
  { n: 35, code: 'HAB', name: 'Habakkuk', abbr: 'Hab' },
  { n: 36, code: 'ZEP', name: 'Zephaniah', abbr: 'Zeph' },
  { n: 37, code: 'HAG', name: 'Haggai', abbr: 'Hag' },
  { n: 38, code: 'ZEC', name: 'Zechariah', abbr: 'Zech' },
  { n: 39, code: 'MAL', name: 'Malachi', abbr: 'Mal' },
  { n: 40, code: 'MAT', name: 'Matthew', abbr: 'Matt', aliases: ['mt'] },
  { n: 41, code: 'MRK', name: 'Mark', abbr: 'Mark', aliases: ['mk', 'mrk'] },
  { n: 42, code: 'LUK', name: 'Luke', abbr: 'Luke', aliases: ['lk'] },
  { n: 43, code: 'JHN', name: 'John', abbr: 'John', aliases: ['jn', 'jhn'] },
  { n: 44, code: 'ACT', name: 'Acts', abbr: 'Acts' },
  { n: 45, code: 'ROM', name: 'Romans', abbr: 'Rom', aliases: ['rm'] },
  { n: 46, code: '1CO', name: '1 Corinthians', abbr: '1Cor' },
  { n: 47, code: '2CO', name: '2 Corinthians', abbr: '2Cor' },
  { n: 48, code: 'GAL', name: 'Galatians', abbr: 'Gal' },
  { n: 49, code: 'EPH', name: 'Ephesians', abbr: 'Eph' },
  { n: 50, code: 'PHP', name: 'Philippians', abbr: 'Phil', aliases: ['php', 'phil'] },
  { n: 51, code: 'COL', name: 'Colossians', abbr: 'Col' },
  { n: 52, code: '1TH', name: '1 Thessalonians', abbr: '1Thess', aliases: ['1th'] },
  { n: 53, code: '2TH', name: '2 Thessalonians', abbr: '2Thess', aliases: ['2th'] },
  { n: 54, code: '1TI', name: '1 Timothy', abbr: '1Tim' },
  { n: 55, code: '2TI', name: '2 Timothy', abbr: '2Tim' },
  { n: 56, code: 'TIT', name: 'Titus', abbr: 'Titus' },
  { n: 57, code: 'PHM', name: 'Philemon', abbr: 'Phlm', aliases: ['phm', 'phlm'] },
  { n: 58, code: 'HEB', name: 'Hebrews', abbr: 'Heb' },
  { n: 59, code: 'JAS', name: 'James', abbr: 'Jas', aliases: ['jm'] },
  { n: 60, code: '1PE', name: '1 Peter', abbr: '1Pet', aliases: ['1pt', '1p'] },
  { n: 61, code: '2PE', name: '2 Peter', abbr: '2Pet', aliases: ['2pt', '2p'] },
  { n: 62, code: '1JN', name: '1 John', abbr: '1John', aliases: ['1jn', '1jo'] },
  { n: 63, code: '2JN', name: '2 John', abbr: '2John', aliases: ['2jn', '2jo'] },
  { n: 64, code: '3JN', name: '3 John', abbr: '3John', aliases: ['3jn', '3jo'] },
  { n: 65, code: 'JUD', name: 'Jude', abbr: 'Jude', aliases: ['jud', 'jd'] },
  { n: 66, code: 'REV', name: 'Revelation', abbr: 'Rev', aliases: ['rv', 'apocalypse', 'revelations'] }
]

export const BOOK_BY_CODE = new Map(BOOKS.map((b) => [b.code, b]))
const SINGLE_CHAPTER = new Set([31, 57, 63, 64, 65]) // Obadiah, Philemon, 2–3 John, Jude
export const isNT = (book: number): boolean => book >= 40

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(i{1,3})\s+(?=[a-z])/, (m) => String(m.trim().length)) // "II Kings" → "2kings"
    .replace(/^first\s+/, '1')
    .replace(/^second\s+/, '2')
    .replace(/^third\s+/, '3')
    .replace(/[\s.]/g, '')

/**
 * Find a book from free text: exact alias, then name prefix.
 * `localNames` lets an imported Bible's own book names ("Juan", "Mateo") match too.
 */
export function findBook(input: string, localNames?: Map<number, string>): number | null {
  const q = norm(input)
  if (!q) return null
  for (const b of BOOKS) {
    if (norm(b.abbr) === q || b.aliases?.includes(q) || norm(b.name) === q) return b.n
    if (localNames && norm(localNames.get(b.n) ?? '') === q) return b.n
  }
  for (const b of BOOKS) {
    if (norm(b.name).startsWith(q)) return b.n
    if (localNames && norm(localNames.get(b.n) ?? '').startsWith(q)) return b.n
  }
  return null
}

export interface ParsedRef {
  book: number
  chapter: number
  verseStart?: number
  verseEnd?: number
}

/** Parse "jn 3:16", "John 3:16-18", "1 cor 13", "ps 23 1-3", "Juan 3.16". */
export function parseReference(input: string, localNames?: Map<number, string>): ParsedRef | null {
  const m = input.trim().match(/^((?:[1-3]|i{1,3})?\s*[^\d:.\s][^\d:]*?)\s*(\d+)(?:\s*[:.\s]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/i)
  if (!m) return null
  const book = findBook(m[1], localNames)
  if (!book) return null
  // One-chapter books: "Jude 3" means verse 3.
  if (SINGLE_CHAPTER.has(book) && !m[3]) return { book, chapter: 1, verseStart: Number(m[2]), verseEnd: Number(m[2]) }
  const chapter = Number(m[2])
  const verseStart = m[3] ? Number(m[3]) : undefined
  const verseEnd = m[4] ? Number(m[4]) : verseStart
  return { book, chapter, verseStart, verseEnd: verseEnd && verseStart && verseEnd < verseStart ? verseStart : verseEnd }
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
/** Verse number as superscript digits ("¹⁶"), so it stays small on every screen without markup. */
export const supNum = (n: number): string => String(n).replace(/\d/g, (d) => SUP[Number(d)])

export interface ScriptureText {
  bookName: string
  abbrev: string
  verses: { verse: number; text: string }[]
}

/**
 * A slide's extra translations as a list. Older saves stored one object (`parallel: { text, reference }`);
 * every screen reads it through here, so those still show.
 */
export function parallelOf(slide: { parallel?: unknown } | null | undefined): ParallelText[] {
  const p = slide?.parallel as ParallelText[] | ParallelText | undefined | null
  if (!p) return []
  const list = Array.isArray(p) ? p : [p]
  return list.filter((x) => x && typeof x.text === 'string')
}

/**
 * Group selected verses into slides: `perSlide` verses each (0 = all on one), with superscript
 * verse numbers on multi-verse slides, and optionally up to two more translations (side by side or stacked).
 */
export function scriptureSlides(
  chapter: number,
  nums: number[],
  main: ScriptureText,
  opts: { perSlide: number; numbers: boolean; parallelLayout?: ParallelLayout },
  parallel?: ScriptureText | ScriptureText[] | null
): { label: string; reference: string; text: string; parallel?: ParallelText[]; parallelLayout?: ParallelLayout }[] {
  const others = (Array.isArray(parallel) ? parallel : parallel ? [parallel] : []).slice(0, 2)
  const picked = main.verses.filter((v) => nums.includes(v.verse))
  const size = opts.perSlide > 0 ? opts.perSlide : picked.length || 1
  const join = (list: { verse: number; text: string }[]): string =>
    list.length === 1 || !opts.numbers ? list.map((v) => v.text).join(' ') : list.map((v) => `${supNum(v.verse)}${v.text}`).join(' ')
  const out: ReturnType<typeof scriptureSlides> = []
  for (let i = 0; i < picked.length; i += size) {
    const group = picked.slice(i, i + size)
    const label = formatRef(main.bookName, chapter, group.map((v) => v.verse))
    const slide: (typeof out)[number] = { label, reference: `${label} (${main.abbrev})`, text: join(group) }
    const cols: ParallelText[] = []
    for (const other of others) {
      const p = group.flatMap((g) => other.verses.filter((v) => v.verse === g.verse))
      if (!p.length) continue
      const ref = formatRef(other.bookName, chapter, p.map((v) => v.verse))
      cols.push({ text: join(p), reference: `${ref} (${other.abbrev})` })
    }
    if (cols.length) {
      slide.parallel = cols
      if (opts.parallelLayout === 'stacked') slide.parallelLayout = 'stacked'
    }
    out.push(slide)
  }
  return out
}

/** "John 3:16", "John 3:16–18", "John 3:16, 18". */
export function formatRef(bookName: string, chapter: number, verses: number[]): string {
  if (!verses.length) return `${bookName} ${chapter}`
  const sorted = [...new Set(verses)].sort((a, b) => a - b)
  const parts: string[] = []
  let start = sorted[0]
  let prev = start
  for (const v of [...sorted.slice(1), Infinity]) {
    if (v === prev + 1) {
      prev = v
      continue
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`)
    start = prev = v
  }
  return `${bookName} ${chapter}:${parts.join(', ')}`
}
