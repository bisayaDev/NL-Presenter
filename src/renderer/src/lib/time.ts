import { useEffect, useState } from 'react'
import type { CountdownState } from '@shared/types'
import { formatTime, t } from '@/i18n'

/** Current time, corrected by `offset` (server clock − local clock), refreshed every `interval` ms. */
export function useNow(offset = 0, interval = 250): number {
  const [now, setNow] = useState(() => Date.now() + offset)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), interval)
    setNow(Date.now() + offset)
    return () => clearInterval(t)
  }, [offset, interval])
  return now
}

/** Milliseconds left (negative when past zero). */
export function remainingMs(c: CountdownState, now: number): number {
  if (c.status === 'running' && c.endsAt !== null) return c.endsAt - now
  return c.remainingMs
}

/** "4:59", "1:02:03", or "+0:12" in overtime. */
export function formatClock(ms: number): string {
  const neg = ms < 0
  // Round up while counting down so the display reaches 0:00 exactly at zero.
  const total = neg ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const body = h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
  return neg ? `+${body}` : body
}

/** English default title stored in DEFAULT_COUNTDOWN (store/useApp.ts); shown in the current language. */
const DEFAULT_TITLE = 'The service is about to start' // i18n-ignore

/** The countdown title to show: the built-in default in this screen's language, else the operator's own text. */
export const countdownTitle = (title: string): string => (title === DEFAULT_TITLE ? t('countdown.defaultTitle') : title)

export function countdownText(c: CountdownState, now: number): { text: string; over: boolean } {
  if (c.mode === 'clock') {
    return { text: formatTime(now), over: false }
  }
  const ms = remainingMs(c, now)
  if (ms <= 0 && !c.overtime) return { text: '0:00', over: false }
  return { text: formatClock(ms), over: ms < 0 }
}
