// Turning songs from outside the app into library songs: lyrics from the web (LRCLIB), ChordPro files,
// SongSelect lyrics (.txt) and SongSelect import files (.usr). Our own .txt format stays in songText.ts.
//
// Every importer produces a SongDraft: song details plus lyrics in our text format ([Section] headings, inline
// [G]chords). draftToSong then makes slides of at most MAX_LINES lines.

import type { Song, SongText } from '@shared/types'
import { guessKey, keyName, parseKey } from '@shared/chords'
import { normalizeBpm, normalizeTimeSignature } from '@shared/tempo'
import { lyricsToSlides, uid } from './defaults'
import { textToSong } from './songText'

export interface SongDraft {
  title: string
  author?: string
  copyright?: string
  ccli?: string
  key?: string
  bpm?: number
  timeSignature?: string
  /** Our lyrics format: blocks separated by blank lines, "[Chorus]" headings, inline chords. */
  lyrics: string
}

/** Lines per slide when a section is split up. */
const MAX_LINES = 4

/** A section name on a line of its own (SongSelect, ChordPro comments, many lyric sites). */
const SECTION_RE =
  /^\[?\s*((?:verse|chorus|pre[- ]?chorus|bridge|tag|intro|outro|ending|instrumental|interlude|refrain|vamp|misc|turnaround|coda|channel|breakdown|hook|post[- ]?chorus)(?:\s*\d+[a-z]?)?)\s*:?\s*\]?$/i

const normLabel = (s: string): string =>
  s
    .trim()
    .replace(/^pre[- ]?chorus/i, 'Pre-Chorus')
    .replace(/^post[- ]?chorus/i, 'Post-Chorus')
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(/\s+(\d)/, ' $1')

/** Split blocks longer than MAX_LINES into even parts (6 → 3 + 3, 5 → 3 + 2). Headings stay on the first part. */
function splitLongBlocks(lyrics: string): string {
  return lyrics
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n').filter((l) => l.trim())
      const heading = lines.length && /^\[[^\]]+\]$/.test(lines[0].trim()) && SECTION_RE.test(lines[0].trim()) ? lines.shift()! : null
      if (lines.length <= MAX_LINES) return [heading, ...lines].filter((l) => l !== null).join('\n')
      const parts = Math.ceil(lines.length / MAX_LINES)
      const size = Math.ceil(lines.length / parts)
      const chunks: string[] = []
      for (let i = 0; i < lines.length; i += size) chunks.push(lines.slice(i, i + size).join('\n'))
      if (heading) chunks[0] = `${heading}\n${chunks[0]}`
      return chunks.join('\n\n')
    })
    .join('\n\n')
}

export function draftToSong(d: SongDraft): Song | null {
  const slides = lyricsToSlides(splitLongBlocks(d.lyrics))
  if (!slides.length) return null
  const k = parseKey(d.key)
  return {
    id: uid(),
    title: d.title.trim() || 'Untitled',
    author: d.author?.trim() || undefined,
    tags: [],
    slides,
    key: k ? keyName(k) : guessKey(d.lyrics),
    copyright: d.copyright?.trim() || undefined,
    ccli: d.ccli?.trim() || undefined,
    bpm: normalizeBpm(d.bpm),
    timeSignature: normalizeTimeSignature(d.timeSignature),
    updatedAt: Date.now()
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Web lyrics (LRCLIB): typed out from a recording. No section names, repeats written out, no chords.

const clean = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

interface Line {
  text: string
  key: string
  /** A blank line came before it. */
  gap: boolean
}

/** Share of lines two blocks have in common (0–1), for repeats that differ by a line or a word. */
function overlap(a: string[], b: string[]): number {
  const sb = new Set(b)
  const same = new Set(a.filter((x) => sb.has(x))).size
  return same / Math.max(new Set(a).size, new Set(b).size)
}

/**
 * Cut the lines into blocks along their repeats: a run of 2+ lines that also appears elsewhere in the song is one
 * block; lines in between are another, split where the lyrics have blank lines. This finds a chorus even when the
 * lyrics have no blank lines, or blank lines in odd places.
 */
function cutAtRepeats(lines: Line[]): { lines: Line[]; repeated: boolean }[] {
  const n = lines.length
  /** Longest run starting at i that also occurs somewhere else (not overlapping itself). */
  const runAt = (i: number): number => {
    let best = 0
    for (let j = 0; j < n; j++) {
      if (j === i) continue
      let r = 0
      while (i + r < n && j + r < n && r < Math.abs(j - i) && lines[i + r].key === lines[j + r].key) r++
      best = Math.max(best, r)
    }
    return Math.min(best, 12)
  }
  const runs = lines.map((_, i) => runAt(i))
  const out: { lines: Line[]; repeated: boolean }[] = []
  let i = 0
  while (i < n) {
    let k = runs[i]
    if (k >= 2) {
      // Split at a blank line when both halves are real sections (2+ lines each).
      const gap = lines.slice(i + 2, i + k - 1).findIndex((l) => l.gap)
      if (gap >= 0) k = gap + 2
      out.push({ lines: lines.slice(i, i + k), repeated: true })
      i += k
      continue
    }
    const from = i
    i++
    while (i < n && runs[i] < 2 && !lines[i].gap) i++
    out.push({ lines: lines.slice(from, i), repeated: false })
  }
  return out
}

/**
 * Plain lyrics → our format with section names, guessed from the repeats:
 * the block sung most often is the Chorus; another repeated block sung just before it is the Pre-Chorus; a repeated
 * block that first comes after the second chorus is the Bridge; everything else is a verse (a short last line on its
 * own is the Ending). Each section's words appear once; the order is set per service with Arrange.
 */
export function tidyWebLyrics(plain: string): string {
  const text = plain.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim()
  if (!text) return ''
  const raw = text.split('\n')
  // Already labelled ("Chorus" or "[Verse 1]" lines): keep the labels, only tidy the layout.
  if (raw.some((l) => SECTION_RE.test(l.trim()))) {
    return raw
      .map((l) => (SECTION_RE.test(l.trim()) ? `\n[${normLabel(l.trim().match(SECTION_RE)![1])}]` : l.trim()))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
  const lines: Line[] = []
  let gap = false
  for (const l of raw) {
    const t = l.trim()
    // Lines wholly in brackets are directions or backing vocals: "(Sing "When darkness")", "(Oh-oh)".
    if (/^\([^()]*\)$/.test(t) || /^\[[^\]]*\]$/.test(t)) continue
    if (!t) {
      gap = true
      continue
    }
    lines.push({ text: t, key: clean(t), gap })
    gap = false
  }

  // Group blocks that are the same section (allowing small differences); a group's text is its fullest version.
  const groups: { keys: string[]; text: string[]; count: number; first: number }[] = []
  const order: number[] = []
  for (const b of cutAtRepeats(lines)) {
    const keys = b.lines.map((l) => l.key)
    let g = b.repeated ? groups.findIndex((x) => overlap(x.keys, keys) >= 0.6) : -1
    if (g < 0) {
      g = groups.push({ keys, text: b.lines.map((l) => l.text), count: 0, first: order.length }) - 1
    } else if (keys.length > groups[g].keys.length) {
      groups[g].keys = keys
      groups[g].text = b.lines.map((l) => l.text)
    }
    if (order.at(-1) === g) continue // the same section twice in a row is sung, not written, twice
    groups[g].count++
    order.push(g)
  }

  const chorus = groups
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.count >= 2)
    .sort((a, b) => b.g.count - a.g.count || b.g.text.length - a.g.text.length || a.g.first - b.g.first)[0]?.i
  const chorusAt = order.flatMap((g, i) => (g === chorus ? [i] : []))
  const secondChorus = chorusAt[1] ?? Infinity

  const labels: string[] = []
  let verse = 0
  let bridge = 0
  let tag = 0
  let pre = false
  groups.forEach((g, i) => {
    if (i === chorus) labels[i] = 'Chorus'
    else if (g.count >= 2) {
      const beforeChorus = order.some((x, j) => x === i && order[j + 1] === chorus)
      if (!pre && beforeChorus && g.first < secondChorus) {
        labels[i] = 'Pre-Chorus'
        pre = true
      } else if (g.first > secondChorus) labels[i] = ++bridge === 1 ? 'Bridge' : `Bridge ${bridge}`
      else labels[i] = `Verse ${++verse}`
    } else if (g.text.length <= 2 && g.first === order.length - 1 && chorus !== undefined) labels[i] = 'Ending'
    // A lone line mid-song (an ad-lib or a tag line).
    else if (g.text.length === 1 && chorus !== undefined) labels[i] = ++tag === 1 ? 'Tag' : `Tag ${tag}`
    else labels[i] = `Verse ${++verse}`
  })
  if (verse === 1) labels.forEach((l, i) => l === 'Verse 1' && (labels[i] = 'Verse'))
  return groups.map((g, i) => `[${labels[i]}]\n${g.text.join('\n')}`).join('\n\n')
}

/**
 * Track names as uploaded → song titles: "SINACH | WAY MAKER - OFFICIAL VIDEO" → "Way Maker",
 * "Pat Barrett - Build My Life (feat. Chris Tomlin) (Live)" → "Build My Life".
 */
export function cleanSongTitle(title: string, artist = ''): string {
  let t = title.trim()
  const a = artist.split(/[,/&]|\bfeat\./i)[0].trim().toLowerCase()
  // "Artist - Title" / "Artist | Title"
  const m = t.match(/^(.+?)\s+[-–|]\s+(.+)$/)
  if (m && a && m[1].trim().toLowerCase() === a) t = m[2]
  t = t
    .replace(/\s*[([](?:feat\.?|ft\.?|featuring|with)\s[^)\]]*[)\]]/gi, '')
    .replace(/\s*[([](?:live|acoustic|radio edit|lyrics?|lyric video|official[^)\]]*|audio|single version|remastered[^)\]]*)[)\]]/gi, '')
    .replace(/\s+[-–|]\s+(?:live\b.*|official.*|lyrics?\b.*|lyric video.*|audio)$/i, '')
    .trim()
  // SHOUTED titles → Title Case.
  if (t.length > 3 && t === t.toUpperCase() && /[A-Z]/.test(t)) t = t.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, s, c) => s + c.toUpperCase())
  return t || title.trim()
}

/** A web search result as the window shows it. */
export function webLyricsDraft(r: { title: string; artist: string; plainLyrics: string }): SongDraft {
  return { title: cleanSongTitle(r.title, r.artist), author: r.artist, lyrics: tidyWebLyrics(r.plainLyrics) }
}

// ---------------------------------------------------------------------------------------------------------------
// ChordPro (.cho, .chordpro, .chopro, .pro, and SongSelect's ChordPro download).

const DIRECTIVE = /^\{\s*([a-z_-]+)\s*(?::\s*(.*?))?\s*\}$/i

export function chordProToDraft(text: string, name = ''): SongDraft {
  const d: SongDraft = { title: '', lyrics: '' }
  const out: string[] = []
  const authors: string[] = []
  let skip = false // tabs and grids: not for the screen
  const section = (label: string): void => {
    out.push('', `[${normLabel(label)}]`)
  }
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    if (line.trimStart().startsWith('#')) continue
    const m = line.trim().match(DIRECTIVE)
    if (m) {
      const name = m[1].toLowerCase()
      const val = (m[2] ?? '').trim()
      if (skip) {
        if (/^(end_of_tab|eot|end_of_grid|eog)$/.test(name)) skip = false
        continue
      }
      switch (name) {
        case 'title':
        case 't':
          d.title = val
          break
        case 'artist':
        case 'composer':
        case 'lyricist':
        case 'subtitle':
        case 'st':
          if (val) authors.push(val)
          break
        case 'key':
          d.key = val
          break
        case 'copyright':
          d.copyright = val
          break
        case 'tempo':
          // "{tempo: 72}"; also "72 bpm"
          d.bpm = normalizeBpm(val.replace(/\s*bpm\s*$/i, '')) ?? d.bpm
          break
        case 'time':
          d.timeSignature = normalizeTimeSignature(val) ?? d.timeSignature
          break
        case 'ccli':
        case 'ccli_number':
        case 'ccli-song-number':
          d.ccli = val.replace(/\D/g, '')
          break
        case 'comment':
        case 'c':
        case 'comment_italic':
        case 'ci':
        case 'comment_box':
        case 'cb':
        case 'highlight':
          if (SECTION_RE.test(val)) section(val.match(SECTION_RE)![1])
          break
        case 'start_of_chorus':
        case 'soc':
          section(val || 'Chorus')
          break
        case 'end_of_chorus':
        case 'eoc':
          out.push('')
          break
        case 'chorus':
          // "Repeat the chorus": the section is already in the song once; arrangements handle repeats.
          break
        case 'start_of_verse':
        case 'sov':
          section(val || 'Verse')
          break
        case 'start_of_bridge':
        case 'sob':
          section(val || 'Bridge')
          break
        case 'end_of_verse':
        case 'eov':
        case 'end_of_bridge':
        case 'eob':
          out.push('')
          break
        case 'start_of_tab':
        case 'sot':
        case 'start_of_grid':
        case 'sog':
          skip = true
          break
      }
      continue
    }
    if (skip) continue
    // SongSelect's footer lines.
    if (/^CCLI Song\s*#/i.test(line.trim())) {
      d.ccli ||= line.replace(/\D/g, '')
      continue
    }
    if (/^©|^\(c\)\s/i.test(line.trim())) {
      d.copyright ||= line.trim().replace(/^©\s*|^\(c\)\s*/i, '')
      continue
    }
    if (/For use solely with the SongSelect|CCLI License\s*#|www\.ccli\.com/i.test(line)) continue
    // A plain "Verse 1" / "Chorus" line on its own.
    if (SECTION_RE.test(line.trim()) && !/\[[^\]]*\]/.test(line.replace(SECTION_RE, ''))) {
      section(line.trim().match(SECTION_RE)![1])
      continue
    }
    out.push(line.trim())
  }
  d.title ||= name
  if (authors.length) d.author = [...new Set(authors)].join(', ')
  d.lyrics = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return d
}

// ---------------------------------------------------------------------------------------------------------------
// SongSelect lyrics download (.txt): title, sections, then "CCLI Song #", authors, © and the licence lines.

export const isSongSelectText = (text: string): boolean => /^CCLI Song\s*#\s*\d+/im.test(text)

export function songSelectTextToDraft(text: string, name = ''): SongDraft {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim())
  const footer = lines.findIndex((l) => /^CCLI Song\s*#/i.test(l))
  const body = footer >= 0 ? lines.slice(0, footer) : lines
  const tail = footer >= 0 ? lines.slice(footer) : []
  const d: SongDraft = { title: '', lyrics: '' }
  // Title: the first line, when a blank line follows it (the lyrics start with a section name).
  const first = body.findIndex(Boolean)
  if (first >= 0 && !SECTION_RE.test(body[first])) {
    d.title = body[first]
    body.splice(0, first + 1)
  }
  d.title ||= name
  const blocks: string[] = []
  for (const block of body.join('\n').split(/\n\s*\n/)) {
    const ls = block.split('\n').filter(Boolean)
    if (!ls.length) continue
    if (SECTION_RE.test(ls[0])) ls[0] = `[${normLabel(ls[0].match(SECTION_RE)![1])}]`
    blocks.push(ls.join('\n'))
  }
  d.lyrics = blocks.join('\n\n')
  if (tail.length) {
    d.ccli = tail[0].replace(/\D/g, '') || undefined
    const rest = tail.slice(1).filter((l) => l && !/For use solely with the SongSelect|CCLI License\s*#|www\.ccli\.com/i.test(l))
    const copy = rest.find((l) => /^©|^\(c\)|copyright|public domain/i.test(l))
    if (copy) d.copyright = copy.replace(/^©\s*|^\(c\)\s*/i, '')
    const authors = rest.filter((l) => l !== copy)[0]
    if (authors) d.author = authors.split(/\s*\|\s*/).join(', ')
  }
  return d
}

// ---------------------------------------------------------------------------------------------------------------
// SongSelect import file (.usr): INI-style; "/t" separates sections, "/n" lines.

export const isUsr = (text: string): boolean => /^\s*\[File\]/i.test(text) && /^Words=/im.test(text)

export function usrToDraft(text: string, name = ''): SongDraft {
  const get = (k: string): string => text.match(new RegExp(`^${k}=(.*)$`, 'im'))?.[1]?.trim() ?? ''
  const fields = get('Fields').split('/t')
  const words = get('Words').split('/t')
  const blocks = words.map((w, i) => {
    const label = fields[i]?.trim()
    const lines = w.split('/n').map((l) => l.trim()).filter(Boolean)
    return [label ? `[${normLabel(label)}]` : '', ...lines].filter(Boolean).join('\n')
  })
  const authors = get('Author').split(/\s*\|\s*/).filter(Boolean)
  return {
    title: get('Title') || name,
    author: authors.join(', ') || undefined,
    copyright: get('Copyright') || undefined,
    ccli: text.match(/^\[S\s*A?(\d+)\]/im)?.[1],
    key: get('Keys').split(/[\s,/]/)[0] || undefined,
    lyrics: blocks.filter(Boolean).join('\n\n')
  }
}

// ---------------------------------------------------------------------------------------------------------------

const CHORDPRO_EXT = /\.(cho|chordpro|chopro|crd|pro)$/i

/** Any supported song file → library song (null when it has no lyrics). Our own .txt format goes through as before. */
export function fileToSong(file: SongText & { ext?: string }): Song | null {
  const text = file.text
  const ext = file.ext ?? ''
  if (isUsr(text) || /\.usr$/i.test(ext)) return draftToSong(usrToDraft(text, file.name))
  if (CHORDPRO_EXT.test(ext) || /^\s*\{\s*(title|t)\s*:/im.test(text)) return draftToSong(chordProToDraft(text, file.name))
  if (isSongSelectText(text)) return draftToSong(songSelectTextToDraft(text, file.name))
  return textToSong(file)
}
