import { useLayoutEffect, useRef } from 'react'
import type { TickerMessage } from '@shared/types'
import { TICKER_FAMILY, TICKER_FONT, TICKER_HEIGHT, useReducedMotion, useTickerActive } from '@/lib/ticker'

/**
 * Audience announcement along the bottom: a scrolling ticker or a static band. Position comes from the message's
 * start time (epoch ms), so screens that join late or run on another device show the same moment. `u(n)` turns
 * "n % of the screen height" into a CSS length (px on SlideView's virtual stage, cqh on the OBS overlay).
 */
export function TickerBand({ ticker, u, offset = 0 }: { ticker: TickerMessage | null | undefined; u: (n: number) => string; offset?: number }) {
  const active = useTickerActive(ticker, offset)
  const reduce = useReducedMotion()
  const band = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const scroll = ticker?.kind === 'scroll' && !reduce

  useLayoutEffect(() => {
    const b = band.current
    const tx = text.current
    if (!active || !ticker || !b || !tx) return
    const total = ticker.endsAt - ticker.startedAt
    const elapsed = (): number => Date.now() + offset - ticker.startedAt
    const fade = Math.min(300, total / 4)
    // Band fades in and out over the whole message.
    const fadeAnim = b.animate(
      [{ opacity: 0 }, { opacity: 1, offset: fade / total }, { opacity: 1, offset: 1 - fade / total }, { opacity: 0 }],
      { duration: total, fill: 'both' }
    )
    fadeAnim.currentTime = elapsed()
    let move: Animation | null = null
    const start = (): void => {
      move?.cancel()
      if (!scroll) return
      // offsetWidth: layout px, unaffected by SlideView's scale transform.
      const from = b.offsetWidth
      const to = -tx.offsetWidth
      move = tx.animate([{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }], {
        duration: ticker.passMs,
        iterations: ticker.repeat,
        fill: 'both'
      })
      move.currentTime = elapsed()
    }
    start()
    const ro = new ResizeObserver(start)
    ro.observe(b)
    return () => {
      ro.disconnect()
      fadeAnim.cancel()
      move?.cancel()
    }
  }, [active, ticker?.id, ticker?.startedAt, ticker?.passMs, ticker?.repeat, ticker?.endsAt, scroll, offset]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!active || !ticker) return null
  const long = ticker.text.length > 70
  return (
    <div
      ref={band}
      className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center overflow-hidden"
      style={{
        minHeight: u(TICKER_HEIGHT),
        background: 'rgba(10,12,18,.86)',
        borderTop: `${u(0.35)} solid var(--color-accent, #7c6cff)`,
        fontFamily: TICKER_FAMILY,
        color: '#fff',
        fontWeight: 600
      }}
    >
      {scroll ? (
        <div ref={text} className="absolute left-0 whitespace-nowrap" style={{ fontSize: u(TICKER_FONT), lineHeight: 1.2, willChange: 'transform' }}>
          {ticker.text}
        </div>
      ) : (
        <div
          ref={text}
          className="w-full text-center"
          style={{
            fontSize: u(long ? TICKER_FONT * 0.8 : TICKER_FONT),
            lineHeight: 1.2,
            padding: `${u(0.9)} ${u(3)}`,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {ticker.text}
        </div>
      )}
    </div>
  )
}

/** On the audience screen (inside SlideView's virtual stage, so sizes are in px). */
export default function TickerLayer({ ticker, h, offset }: { ticker: TickerMessage | null | undefined; h: number; offset?: number }) {
  return <TickerBand ticker={ticker} u={(n) => `${(n * h) / 100}px`} offset={offset} />
}
