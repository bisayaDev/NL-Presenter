// Talks to YouTube's embedded player (an <iframe> in the music window) with postMessage: the same messages YouTube's
// IFrame API script sends, without loading that script (the page's Content-Security-Policy allows only our own).

/** What the player reports. `state`: -1 not started, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued. */
export type YouTubeEvent =
  | { kind: 'ready' }
  | { kind: 'info'; time?: number; duration?: number; state?: number }
  | { kind: 'error'; code: number }

let frame: HTMLIFrameElement | null = null
let handler: ((e: YouTubeEvent) => void) | null = null
/** Frames whose player has started reporting. */
const answered = new WeakSet<HTMLIFrameElement>()

const ORIGIN = /^https:\/\/www\.youtube(-nocookie)?\.com$/

/** The embed address for a video (the player is controlled through postMessage). */
export function embedUrl(videoId: string, autoplay: boolean): string {
  const q = new URLSearchParams({ enablejsapi: '1', autoplay: autoplay ? '1' : '0', playsinline: '1', rel: '0', iv_load_policy: '3' })
  // Pages served over http(s) (development) name themselves; the packaged app (file://) has no origin to give.
  if (/^https?:/.test(location.protocol)) q.set('origin', location.origin)
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${q}`
}

const send = (msg: object): void => frame?.contentWindow?.postMessage(JSON.stringify({ ...msg, id: 1, channel: 'widget' }), '*')

/** Call a player function (playVideo, pauseVideo, seekTo, setVolume…). Does nothing while no video is loaded. */
export function ytCommand(func: string, args: unknown[] = []): void {
  send({ event: 'command', func, args })
}

/** The music window's <iframe> (null when it goes away). Asks the player to start reporting once it has loaded. */
export function attachYouTubeFrame(el: HTMLIFrameElement | null): void {
  frame = el
  if (!el) return
  // The player only reports to a page that said it is listening; say so until it answers (it may load slowly).
  let tries = 0
  const hello = (): void => {
    if (frame !== el || tries++ > 40) return
    send({ event: 'listening' })
    if (!answered.has(el)) setTimeout(hello, 250)
  }
  el.addEventListener('load', () => {
    tries = 0
    hello()
  })
}
export function onYouTubeEvent(fn: (e: YouTubeEvent) => void): void {
  handler = fn
}

window.addEventListener('message', (e) => {
  if (!frame || e.source !== frame.contentWindow || !ORIGIN.test(e.origin)) return
  let data: { event?: string; info?: unknown }
  try {
    data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
  } catch {
    return
  }
  answered.add(frame)
  if (data.event === 'onReady' || data.event === 'initialDelivery') handler?.({ kind: 'ready' })
  if (data.event === 'onError') handler?.({ kind: 'error', code: Number(data.info) })
  if (data.event === 'onStateChange') handler?.({ kind: 'info', state: Number(data.info) })
  if ((data.event === 'infoDelivery' || data.event === 'initialDelivery') && data.info && typeof data.info === 'object') {
    const i = data.info as { currentTime?: number; duration?: number; playerState?: number }
    handler?.({ kind: 'info', time: i.currentTime, duration: i.duration, state: i.playerState })
  }
})
