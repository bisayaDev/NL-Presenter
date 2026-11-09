// Minimal, dependency-free Zefania XML Bible parser.
// Handles <XMLBIBLE biblename> <BIBLEBOOK bnumber bname> <CHAPTER cnumber> <VERS vnumber>,
// strips inline markup (STYLE, gr, etc.) and drops NOTE/footnote content.
import { tm } from './i18n'

export interface ParsedBible {
  name: string
  abbrev: string
  lang: string
  books: Map<number, string> // number → local name
  verses: { book: number; chapter: number; verse: number; text: string }[]
}

const decode = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')

const attr = (attrs: string, name: string): string | undefined => {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))
  return m ? decode(m[2] ?? m[3] ?? '') : undefined
}

export function parseZefania(xml: string, fallbackName: string): ParsedBible {
  const root = xml.match(/<XMLBIBLE\b([^>]*)>/i)
  if (!root) throw new Error(tm('main.xml.notZefania'))

  const info = (tag: string): string | undefined => {
    const m = xml.match(new RegExp(`<INFORMATION\\b[\\s\\S]*?<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
    return m ? decode(m[1].replace(/<[^>]+>/g, '')).trim() || undefined : undefined
  }

  const name = attr(root[1], 'biblename') || info('title') || fallbackName
  const abbrev = (info('identifier') || name.split(/\s+/).map((w) => w[0]).join('')).slice(0, 12).toUpperCase()
  const lang = (info('language') || '').slice(0, 8).toLowerCase()

  const books = new Map<number, string>()
  const verses: ParsedBible['verses'] = []

  let book = 0
  let chapter = 0
  let verse = 0
  let inVerse = false
  let skipDepth = 0 // inside NOTE / footnote
  let buf = ''

  const tag = /<(\/?)([A-Za-z_][\w.-]*)\b([^>]*?)(\/?)>|([^<]+)/g
  for (let m = tag.exec(xml); m; m = tag.exec(xml)) {
    const [, close, rawName, attrs, selfClose, text] = m
    if (text !== undefined) {
      if (inVerse && !skipDepth) buf += text
      continue
    }
    const name = rawName.toUpperCase()
    if (name === 'NOTE' || name === 'FOOTNOTE') {
      if (selfClose) continue
      skipDepth += close ? -1 : 1
      if (skipDepth < 0) skipDepth = 0
      continue
    }
    if (close) {
      if (name === 'VERS' && inVerse) {
        const t = decode(buf).replace(/\s+/g, ' ').trim()
        if (book >= 1 && book <= 66 && chapter && verse && t) verses.push({ book, chapter, verse, text: t })
        inVerse = false
      }
      continue
    }
    if (name === 'BIBLEBOOK') {
      book = Number(attr(attrs, 'bnumber')) || 0
      const bname = attr(attrs, 'bname') || attr(attrs, 'bsname')
      if (book >= 1 && book <= 66 && bname) books.set(book, bname)
    } else if (name === 'CHAPTER') {
      chapter = Number(attr(attrs, 'cnumber')) || 0
    } else if (name === 'VERS') {
      verse = Number(attr(attrs, 'vnumber')) || 0
      buf = ''
      inVerse = !selfClose
    } else if (name === 'BR' && inVerse) {
      buf += ' '
    }
  }

  if (!verses.length) throw new Error(tm('main.xml.noVerses'))
  return { name, abbrev, lang, books, verses }
}

/**
 * "<bible translation=…><testament><book number><chapter number><verse number>" XML (used by several
 * Bible-text collections). Book numbers 1–66 follow the same order as Zefania.
 */
export function parseSimpleBibleXml(xml: string, fallbackName: string): ParsedBible {
  const root = xml.match(/<bible\b([^>]*)>/i)
  if (!root) throw new Error(tm('main.xml.unsupported'))
  const title = (attr(root[1], 'translation') || attr(root[1], 'name') || '').replace(/\s+/g, ' ').trim()
  // "English (YLT) 1898 Young's Literal Translation" → language "English", abbrev "YLT", name the rest.
  const m = title.match(/^([^()]+?)\s*\(([^)]+)\)\s*(.*)$/)
  const name = (m?.[3] || title || fallbackName).trim() || fallbackName
  const abbrev = (m?.[2] || attr(root[1], 'abbreviation') || name.split(/\s+/).map((w) => w[0]).join('')).slice(0, 12).toUpperCase()
  const lang = (m?.[1] || '').trim().toLowerCase().slice(0, 8)

  const verses: ParsedBible['verses'] = []
  let book = 0
  let chapter = 0
  const tag = /<(book|chapter)\b([^>]*)>|<verse\b([^>]*?)(?:\/>|>([\s\S]*?)<\/verse>)/gi
  for (let t = tag.exec(xml); t; t = tag.exec(xml)) {
    if (t[1]?.toLowerCase() === 'book') book = Number(attr(t[2], 'number')) || 0
    else if (t[1]?.toLowerCase() === 'chapter') chapter = Number(attr(t[2], 'number')) || 0
    else {
      const verse = parseInt(attr(t[3], 'number') ?? '', 10) || 0
      const text = decode((t[4] ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
      if (book >= 1 && book <= 66 && chapter && verse && text) verses.push({ book, chapter, verse, text })
    }
  }
  if (!verses.length) throw new Error(tm('main.xml.noVerses'))
  return { name, abbrev, lang, books: new Map(), verses }
}

/** Zefania or the simple <bible><book><chapter><verse> format, detected from the content. */
export function parseBibleXml(xml: string, fallbackName: string): ParsedBible & { info?: string } {
  if (/<XMLBIBLE\b/i.test(xml)) return parseZefania(xml, fallbackName)
  const parsed = parseSimpleBibleXml(xml, fallbackName)
  const info = xml.match(/<bible\b([^>]*)>/i)?.[1]
  return { ...parsed, info: info ? attr(info, 'info') : undefined }
}
