import type { Song, SongText } from '@shared/types'
import { lyricsToSlides, slidesToLyrics, uid } from './defaults'
import { extractKey, keyName, parseKey } from '@shared/chords'
import { normalizeBpm, normalizeTimeSignature } from '@shared/tempo'

// Plain-text song files:
//
//   Title: Amazing Grace
//   Author: John Newton
//   Tags: hymn, classic
//   Key: G
//   Copyright: Public domain
//   CCLI: 22025
//   Tempo: 72          ("BPM: 72" is read too)
//   Time: 3/4
//
//   [Verse 1]
//   Amazing grace! How sweet the sound
//   …
//
// The header is optional; without it the file name becomes the title. Lyrics may carry inline chords
// ([G]Amazing [C]grace) or be a chord sheet with chords on the line above the words.

export function songToText(s: Song): SongText {
  const head = [`Title: ${s.title}`]
  if (s.author) head.push(`Author: ${s.author}`)
  if (s.tags.length) head.push(`Tags: ${s.tags.join(', ')}`)
  if (s.key) head.push(`Key: ${s.key}`)
  if (s.copyright) head.push(`Copyright: ${s.copyright}`)
  if (s.ccli) head.push(`CCLI: ${s.ccli}`)
  if (s.bpm) head.push(`Tempo: ${s.bpm}`)
  if (s.timeSignature) head.push(`Time: ${s.timeSignature}`)
  return { name: s.title, text: `${head.join('\n')}\n\n${slidesToLyrics(s.slides)}\n` }
}

export function textToSong(file: SongText): Song | null {
  const lines = file.text.replace(/\r\n?/g, '\n').split('\n')
  const meta: Record<string, string> = {}
  let i = 0
  while (i < lines.length) {
    const m = lines[i].match(/^\s*(title|author|tags|ccli|copyright|key|tempo|bpm|time|time signature)\s*:\s*(.*)$/i)
    if (!m) break
    meta[m[1].toLowerCase()] = m[2].trim()
    i++
  }
  // A "Key:" line may also sit lower, e.g. under the title of a chord sheet.
  const body = extractKey(lines.slice(i).join('\n'))
  const slides = lyricsToSlides(body.text)
  if (!slides.length) return null
  const key = parseKey(meta.key) ? keyName(parseKey(meta.key)!) : body.key
  return {
    id: uid(),
    title: meta.title || file.name || 'Untitled',
    author: meta.author || undefined,
    tags: (meta.tags ?? '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
    slides,
    key,
    copyright: meta.copyright || undefined,
    // "CCLI: 1234567", "CCLI Song # 1234567" or just the number.
    ccli: meta.ccli?.replace(/^(song\s*)?#?\s*/i, '').trim() || undefined,
    bpm: normalizeBpm(meta.tempo ?? meta.bpm),
    timeSignature: normalizeTimeSignature(meta.time ?? meta['time signature']),
    updatedAt: Date.now()
  }
}
