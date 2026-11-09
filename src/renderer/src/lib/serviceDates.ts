// Dates for the service library. Stored as local "YYYY-MM-DD".
import { getLocale } from '@/i18n'

const pad = (n: number): string => String(n).padStart(2, '0')

export const isoDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = (): string => isoDay(new Date())

/** "YYYY-MM-DD" as a local date (no timezone shift). */
export function parseDay(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

/** The Sunday after `from` (a week on when `from` is itself a Sunday). */
export function nextSunday(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7))
  return isoDay(d)
}

/** "15 Nov" (with the year when it isn't this year). */
export function shortDate(day: string | undefined): string {
  const d = day ? parseDay(day) : null
  if (!d) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** "Sunday 15 November 2026" for print headers. */
export function longDate(day: string | undefined): string {
  const d = day ? parseDay(day) : null
  return d ? d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

/** A service name without its trailing date ("Sunday Service – 8 Nov" → "Sunday Service"). */
export const baseName = (name: string): string =>
  name.replace(/\s+[–-]\s+\d{1,2} [A-Za-z]{3,9}( \d{4})?\s*$/, '').trim() || 'Sunday Service'

export const datedName = (base: string, day: string): string => `${base} – ${shortDate(day)}`

/** "today", "yesterday", "3 days ago", "3 weeks ago", "5 months ago", "2 years ago", in the chosen language. */
export function agoText(day: string): string {
  const d = parseDay(day)
  if (!d) return ''
  const days = Math.round((parseDay(today())!.getTime() - d.getTime()) / 86_400_000)
  // Intl words every language itself ("today", "hôm qua", "3 दिन पहले"); `numeric: 'auto'` gives today/yesterday.
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' })
  if (days <= 0) return rtf.format(0, 'day')
  if (days < 14) return rtf.format(-days, 'day')
  if (days < 60) return rtf.format(-Math.round(days / 7), 'week')
  if (days < 365) return rtf.format(-Math.round(days / 30), 'month')
  return rtf.format(-Math.round(days / 365), 'year')
}
