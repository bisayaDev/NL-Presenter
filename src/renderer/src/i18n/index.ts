// UI translations. See ./README.md for the conventions and which area file each screen uses.
//
//   const { t, tn } = useT()            // in a component: re-renders when the language changes
//   t('settings.title')                 // "Settings" / "Mga Setting" / …
//   t('topbar.output', { name })        // "Output: {name}"
//   tn('service.itemCount', 3)          // "3 items" (plural forms per language)
//   formatTime(new Date())              // "7:30 PM" / "19:30" in the chosen language
//
// Outside React (event handlers, lib code) import `t` / `tn` directly: they read the current language.
import { create } from 'zustand'
import { isLang, LANGS, localeOf, matchLang, translate, type Lang, type Vars } from '@shared/i18n-core'
import { STRINGS, type StringKey } from './strings'

export { LANGS, isLang, type Lang, type Vars }
export type { StringKey }

/** Language of this device's browser / OS, if we support it. */
export const systemLang = (): Lang => matchLang(typeof navigator !== 'undefined' ? navigator.language : null) ?? 'en'

const useLangStore = create<{ lang: Lang }>(() => ({ lang: systemLang() }))

function applyDocLang(lang: Lang): void {
  if (typeof document !== 'undefined') document.documentElement.lang = localeOf(lang)
}
applyDocLang(useLangStore.getState().lang)

export const getLang = (): Lang => useLangStore.getState().lang
export const getLocale = (): string => localeOf(getLang())

/** Switch the UI language now (does not save it: the operator's Settings save `language`, phones use setPhoneLang). */
export function setLang(lang: Lang): void {
  if (lang === getLang()) return
  useLangStore.setState({ lang })
  applyDocLang(lang)
}

/** Subscribe outside React (e.g. to republish the snapshot when the operator changes language). */
export const onLangChange = (cb: (lang: Lang) => void): (() => void) => useLangStore.subscribe((s) => cb(s.lang))

// ----- operator window -----

/** Operator: the saved `language` setting, else the OS language if supported, else English. */
export function applySavedLang(saved: unknown): void {
  setLang(isLang(saved) ? saved : systemLang())
}

// ----- phones, tablets and screens (no preload bridge) -----

const PHONE_KEY = 'nl-lang'
let operatorLang: Lang | null = null

/** This device's own choice, or null to follow the operator. */
export function phoneLang(): Lang | null {
  try {
    const v = localStorage.getItem(PHONE_KEY)
    return isLang(v) ? v : null
  } catch {
    return null
  }
}

/** Phone landing / PIN screen: pick a language for this device (null = follow the operator). */
export function setPhoneLang(lang: Lang | null): void {
  try {
    if (lang) localStorage.setItem(PHONE_KEY, lang)
    else localStorage.removeItem(PHONE_KEY)
  } catch {
    // private mode: just switch for now
  }
  setLang(lang ?? operatorLang ?? systemLang())
}

/** The operator's language arrived (welcome message or snapshot). Used unless this device chose its own. */
export function adoptOperatorLang(lang: unknown, force = false): void {
  if (!isLang(lang)) return
  operatorLang = lang
  if (force || !phoneLang()) setLang(lang)
}

/** Start-up for pages without the operator's settings: own choice, else browser language. */
export function initPhoneLang(): void {
  setLang(phoneLang() ?? systemLang())
}

// ----- lookup -----

const warned = new Set<string>()
const onMissing = (key: string): void => {
  if (!import.meta.env.DEV || warned.has(key)) return
  warned.add(key)
  console.warn(`[i18n] missing string "${key}"`)
}

/** Translate a key. `vars` fill `{name}` placeholders. Missing → English → the key itself. */
export function t(key: StringKey, vars?: Vars): string {
  return translate(STRINGS, getLang(), key, vars, undefined, onMissing)
}

/** Plural: picks one/few/many/other for `count` and fills `{count}` (formatted for the language). */
export function tn(key: StringKey, count: number, vars?: Vars): string {
  return translate(STRINGS, getLang(), key, vars, count, onMissing)
}

/** True when the key exists (for keys built at runtime, e.g. `tabs.${id}`). */
export const hasKey = (key: string): key is StringKey => key in STRINGS

/** Re-renders the component when the language changes. */
export function useT(): { t: typeof t; tn: typeof tn; lang: Lang; locale: string } {
  const lang = useLangStore((s) => s.lang)
  return { t, tn, lang, locale: localeOf(lang) }
}

// ----- dates, times and numbers in the chosen language -----

/** "7:30 PM" / "19:30". */
export const formatTime = (d: Date | number, opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }): string =>
  new Date(d).toLocaleTimeString(getLocale(), opts)

/** Dates; default "15 Nov 2026"-style medium date. */
export const formatDate = (d: Date | number, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string =>
  new Date(d).toLocaleDateString(getLocale(), opts)

/** A local "YYYY-MM-DD" day as a short date ("15 Nov", with the year when it isn't this year). */
export function formatDay(day: string | undefined, opts?: Intl.DateTimeFormatOptions): string {
  const m = day ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(day) : null
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(getLocale(), opts ?? { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export const formatNumber = (n: number, opts?: Intl.NumberFormatOptions): string => new Intl.NumberFormat(getLocale(), opts).format(n)

/** "just now", "5 min ago", "2 hours ago", "3 days ago" in the chosen language. */
export function formatAgo(at: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - at) / 60_000))
  if (m < 1) return t('common.justNow')
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto', style: 'short' })
  if (m < 60) return rtf.format(-m, 'minute')
  const h = Math.round(m / 60)
  if (h < 24) return rtf.format(-h, 'hour')
  return rtf.format(-Math.round(h / 24), 'day')
}

/** Every language with its native name, for pickers. */
export const LANG_OPTIONS = LANGS.map((l) => ({ code: l.code as Lang, name: l.name }))

// Dev builds: let automated checks (NL_SNAPSHOT_JS) switch the language.
if (import.meta.env.DEV) (window as unknown as { __i18n: unknown }).__i18n = { setLang, getLang, setPhoneLang }
