// Songs tab → Find a song: lyrics search on LRCLIB (https://lrclib.net), a free, open lyrics database.
// No key or account. It returns full plain lyrics (no chords, no section names) with each hit.

import type { WebSongHit, WebSongSearch } from '../shared/types'

const API = 'https://lrclib.net/api/search'
// LRCLIB asks clients to name themselves in the User-Agent.
const UA = { 'User-Agent': 'NLPresenter (church presentation app)' }

interface LrclibTrack {
  id: number
  trackName: string
  artistName: string
  albumName?: string
  duration?: number
  instrumental?: boolean
  plainLyrics?: string | null
}

/** Words only, for spotting the same lyrics uploaded twice. */
const fingerprint = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 400)

export async function searchWebSongs(q: string): Promise<WebSongSearch> {
  const query = q.trim()
  if (!query) return { ok: true, hits: [] }
  let rows: LrclibTrack[]
  try {
    const res = await fetch(`${API}?q=${encodeURIComponent(query)}`, { headers: UA, signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return { ok: false, error: 'failed' }
    rows = (await res.json()) as LrclibTrack[]
  } catch (e) {
    const msg = String((e as Error)?.cause ?? e)
    return { ok: false, error: /ENOTFOUND|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|timeout|aborted/i.test(msg) ? 'offline' : 'failed' }
  }
  const seen = new Set<string>()
  const hits: WebSongHit[] = []
  for (const r of Array.isArray(rows) ? rows : []) {
    const lyrics = r.plainLyrics?.trim()
    if (r.instrumental || !lyrics) continue
    // The same lyrics uploaded for the album, the single and the live version: show it once.
    const fp = fingerprint(lyrics)
    if (seen.has(fp)) continue
    seen.add(fp)
    hits.push({
      id: `lrclib:${r.id}`,
      title: r.trackName,
      artist: r.artistName,
      album: r.albumName || undefined,
      duration: r.duration ? Math.round(r.duration) : undefined,
      plainLyrics: lyrics,
      source: 'lrclib'
    })
  }
  return { ok: true, hits: rank(hits, query) }
}

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1)

/** Versions that are rarely what a church wants, unless the search asks for them. */
const UNLIKELY = /\b(remix|cover|karaoke|instrumental|parody|mashup|medley|tribute|8d|sped up|slowed|nightcore)\b/i

/**
 * LRCLIB's order is loose (a search for "Oceans" can put an unrelated remix first). Rank by how much of the search is
 * in the title, then the artist; push remixes and covers down; keep LRCLIB's order otherwise.
 */
function rank(hits: WebSongHit[], query: string): WebSongHit[] {
  const q = words(query)
  const score = (h: WebSongHit): number => {
    const title = new Set(words(h.title))
    const artist = new Set(words(h.artist))
    let s = 0
    for (const w of q) s += title.has(w) ? 3 : artist.has(w) ? 1 : 0
    // Title is exactly the search (or the search minus the artist's name).
    const t = words(h.title).join(' ')
    if (t === q.join(' ') || t === q.filter((w) => !artist.has(w)).join(' ')) s += 4
    if (UNLIKELY.test(`${h.title} ${h.album ?? ''}`) && !UNLIKELY.test(query)) s -= 6
    return s
  }
  return hits
    .map((h, i) => ({ h, i, s: score(h) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.h)
}
