// Music player → YouTube search, through the YouTube Data API v3 (official; needs a free Google API key, which the
// church pastes in once and is kept in the settings). Nothing is downloaded: results play in YouTube's own embedded
// player in the music window.
//
// A search costs 100 quota units and the durations lookup 1, so a free key (10,000 units a day) allows about 99
// searches a day.

import { session } from 'electron'
import type { YouTubeHit, YouTubeSearch } from '../shared/types'

const API = 'https://www.googleapis.com/youtube/v3'

/**
 * YouTube's embedded player refuses to play without a Referer saying which site or app embeds it, and pages loaded
 * from file:// (the packaged app) send none. Name the app the way YouTube asks desktop and WebView apps to.
 */
export function identifyToYouTube(appId: string): void {
  const urls = ['https://www.youtube-nocookie.com/*', 'https://www.youtube.com/*', 'https://*.ytimg.com/*', 'https://*.googlevideo.com/*']
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls }, (details, cb) => {
    const headers = details.requestHeaders
    if (!headers['Referer'] && !headers['referer']) headers['Referer'] = `https://${appId}/`
    cb({ requestHeaders: headers })
  })
}

/** "PT4M13S" → 253. */
function isoSeconds(d: string | undefined): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d ?? '')
  if (!m) return 0
  return (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0)
}

/** Titles come HTML-escaped ("Rock &amp; Roll", "It&#39;s"). */
const unescape = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

type ApiError = { error?: { code?: number; errors?: { reason?: string }[]; details?: { reason?: string }[] } }

/** Google's error reply → what the music window says about it. */
function errorKind(status: number, body: ApiError): 'badKey' | 'quota' | 'failed' {
  const reasons = [...(body.error?.errors ?? []), ...(body.error?.details ?? [])].map((e) => e.reason ?? '').join(' ')
  if (/quota|dailyLimit|rateLimit/i.test(reasons)) return 'quota'
  if (/keyInvalid|API_KEY_INVALID|accessNotConfigured|SERVICE_DISABLED|forbidden|API_KEY_SERVICE_BLOCKED|ipRefererBlocked/i.test(reasons)) return 'badKey'
  if (status === 400 || status === 401 || status === 403) return 'badKey'
  return 'failed'
}

async function getJson(url: string): Promise<{ ok: true; body: unknown } | { ok: false; error: 'badKey' | 'quota' | 'failed' }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  const body = (await res.json().catch(() => ({}))) as ApiError
  return res.ok ? { ok: true, body } : { ok: false, error: errorKind(res.status, body) }
}

interface SearchItem {
  id?: { videoId?: string }
  snippet?: { title?: string; channelTitle?: string; liveBroadcastContent?: string; thumbnails?: Record<string, { url?: string }> }
}

export async function searchYouTube(q: string, key: string | undefined): Promise<YouTubeSearch> {
  const query = q.trim()
  if (!key?.trim()) return { ok: false, error: 'noKey' }
  if (!query) return { ok: true, hits: [] }
  const k = encodeURIComponent(key.trim())
  try {
    const found = await getJson(`${API}/search?part=snippet&type=video&videoEmbeddable=true&maxResults=15&q=${encodeURIComponent(query)}&key=${k}`)
    if (!found.ok) return found
    const items = ((found.body as { items?: SearchItem[] }).items ?? []).filter((it) => it.id?.videoId)
    const hits: YouTubeHit[] = items.map((it) => {
      const th = it.snippet?.thumbnails ?? {}
      return {
        videoId: it.id!.videoId!,
        title: unescape(it.snippet?.title ?? ''),
        channel: unescape(it.snippet?.channelTitle ?? ''),
        thumb: th['default']?.url ?? th['medium']?.url
      }
    })
    if (!hits.length) return { ok: true, hits }
    // Durations (1 unit). Results still show if this fails.
    const details = await getJson(`${API}/videos?part=contentDetails&id=${hits.map((h) => h.videoId).join(',')}&key=${k}`).catch(() => null)
    if (details?.ok) {
      const byId = new Map(
        ((details.body as { items?: { id: string; contentDetails?: { duration?: string } }[] }).items ?? []).map((v) => [v.id, isoSeconds(v.contentDetails?.duration)])
      )
      for (const h of hits) h.duration = byId.get(h.videoId) ?? 0
    }
    return { ok: true, hits }
  } catch (e) {
    const msg = String((e as Error)?.cause ?? e)
    return { ok: false, error: /ENOTFOUND|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|timeout|aborted/i.test(msg) ? 'offline' : 'failed' }
  }
}
