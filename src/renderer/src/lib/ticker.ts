import { useEffect, useState } from 'react'
import type { AspectRatio, TickerMessage } from '@shared/types'
import { uid } from './defaults'

/**
 * Audience announcements (Stage & OBS tab → Announcements): a band along the bottom of the audience screen, either a
 * ticker that scrolls right-to-left `repeat` times or a static band that stays `seconds`. Sizes are % of the screen
 * height so the audience screen (virtual px) and the OBS overlay (cqh) draw the same thing.
 */
export const TICKER_HEIGHT = 7 // band height
export const TICKER_FONT = 3.8 // text size
const SPEED = 22 // scroll speed, screen heights per 100 s
export const TICKER_FAMILY = 'Inter, system-ui, sans-serif'
export const TICKER_MAX = 200 // characters

export interface TickerOptions {
  kind: 'scroll' | 'band'
  repeat: number // scroll: times across the screen
  seconds: number // band: time on screen
  overlay: boolean // also on the OBS overlay
}

export const DEFAULT_TICKER_OPTIONS: TickerOptions = { kind: 'scroll', repeat: 3, seconds: 15, overlay: false }

/** A message waiting its turn (it keeps the options it was sent with). */
export interface QueuedTicker extends TickerOptions {
  id: string
  text: string
}

export function restoreTickerOptions(saved: unknown): TickerOptions {
  const o = { ...DEFAULT_TICKER_OPTIONS, ...(saved && typeof saved === 'object' ? (saved as Partial<TickerOptions>) : {}) }
  return {
    kind: o.kind === 'band' ? 'band' : 'scroll',
    repeat: clamp(Math.round(Number(o.repeat)) || 3, 1, 10),
    seconds: clamp(Math.round(Number(o.seconds)) || 15, 3, 600),
    overlay: o.overlay === true
  }
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

export const queueTicker = (text: string, o: TickerOptions): QueuedTicker => ({ id: uid(), text: text.trim().slice(0, TICKER_MAX), ...o })

let canvas: HTMLCanvasElement | null = null
/** Text width on the 1080-high virtual stage. */
function textWidth(text: string): number {
  const size = (TICKER_FONT * 1080) / 100
  try {
    canvas ??= document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.font = `600 ${size}px ${TICKER_FAMILY}`
      return ctx.measureText(text).width
    }
  } catch {
    /* fall through */
  }
  return text.length * size * 0.55
}

/** Start a queued message now: one pass = the screen width plus the text width at the scroll speed. */
export function startTicker(q: QueuedTicker, aspect: AspectRatio, now = Date.now()): TickerMessage {
  const w = aspect === '4:3' ? 1440 : 1920
  const pxPerSec = (SPEED * 1080) / 100
  const passMs = Math.round(((w + textWidth(q.text) + 40) / pxPerSec) * 1000)
  const total = q.kind === 'band' ? q.seconds * 1000 : passMs * q.repeat
  return { id: q.id, text: q.text, kind: q.kind, passMs, repeat: q.repeat, startedAt: now, endsAt: now + total, overlay: q.overlay }
}

/** Whether the message is on screen now (re-renders when it starts and ends). `offset` = server clock − local clock. */
export function useTickerActive(m: TickerMessage | null | undefined, offset = 0): boolean {
  const on = (): boolean => {
    if (!m) return false
    const now = Date.now() + offset
    return now >= m.startedAt && now < m.endsAt
  }
  const [active, setActive] = useState(on)
  useEffect(() => {
    setActive(on())
    if (!m) return
    const now = Date.now() + offset
    const timers = [m.startedAt, m.endsAt].filter((t) => t > now).map((t) => setTimeout(() => setActive(on()), t - now + 5))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id, m?.startedAt, m?.endsAt, offset])
  return active
}

/** Reduced motion: the ticker becomes a static band. */
export function useReducedMotion(): boolean {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const [reduce, setReduce] = useState(!!q?.matches)
  useEffect(() => {
    if (!q) return
    const f = (): void => setReduce(q.matches)
    q.addEventListener('change', f)
    return () => q.removeEventListener('change', f)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return reduce
}
