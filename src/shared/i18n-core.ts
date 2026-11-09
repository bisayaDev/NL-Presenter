// Translation core shared by the main process and the UI: the language list, string-table types, lookup with
// fallback, {name} interpolation and plural forms. No Electron, React or DOM imports here.

export const LANGS = [
  { code: 'en', name: 'English', english: 'English', locale: 'en-US' },
  { code: 'tl', name: 'Tagalog', english: 'Tagalog', locale: 'fil-PH' },
  { code: 'es', name: 'Español', english: 'Spanish', locale: 'es' },
  { code: 'pt', name: 'Português', english: 'Portuguese (Brazil)', locale: 'pt-BR' },
  { code: 'fr', name: 'Français', english: 'French', locale: 'fr' },
  { code: 'it', name: 'Italiano', english: 'Italian', locale: 'it' },
  { code: 'ko', name: '한국어', english: 'Korean', locale: 'ko' },
  { code: 'zh', name: '中文', english: 'Chinese (Simplified)', locale: 'zh-CN' },
  { code: 'id', name: 'Bahasa Indonesia', english: 'Indonesian', locale: 'id' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi', locale: 'hi' },
  { code: 'ta', name: 'தமிழ்', english: 'Tamil', locale: 'ta' },
  { code: 'ru', name: 'Русский', english: 'Russian', locale: 'ru' },
  { code: 'uk', name: 'Українська', english: 'Ukrainian', locale: 'uk' }
] as const

export type Lang = (typeof LANGS)[number]['code']
export const LANG_CODES: readonly Lang[] = LANGS.map((l) => l.code)

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANG_CODES as readonly string[]).includes(v)

/** BCP 47 locale for Intl (dates, numbers, plural rules). */
export const localeOf = (lang: Lang): string => LANGS.find((l) => l.code === lang)?.locale ?? 'en-US'

/** Best supported language for a browser/OS tag ("pt-PT" → pt, "fil" → tl, "zh-Hant-TW" → zh, "in" → id). Null if none. */
export function matchLang(tag: string | null | undefined): Lang | null {
  if (!tag) return null
  const base = tag.toLowerCase().split(/[-_]/)[0]
  const alias: Record<string, Lang> = { fil: 'tl', in: 'id' }
  const code = alias[base] ?? base
  return isLang(code) ? code : null
}

/** Plural forms (CLDR categories). Only `other` is required; missing forms fall back to `other`. */
export type Plural = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string }
export type Text = string | Plural
/** One string in every language. English is required; the rest fall back to English when missing. */
export type Entry = { en: Text } & { [L in Exclude<Lang, 'en'>]?: Text }
/** An area file: `{ 'area.key': { en, tl, es, … } }`. */
export type AreaStrings = Record<string, Entry>

export type Vars = Record<string, string | number>

/** "Hello {name}" + { name: 'Ana' } → "Hello Ana". Unknown {placeholders} stay as they are. */
export function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

const pluralRules = new Map<string, Intl.PluralRules>()
function pluralCategory(lang: Lang, n: number): Intl.LDMLPluralRule {
  const loc = localeOf(lang)
  let r = pluralRules.get(loc)
  if (!r) pluralRules.set(loc, (r = new Intl.PluralRules(loc)))
  return r.select(n)
}

function pick(text: Text, lang: Lang, count?: number): string {
  if (typeof text === 'string') return text
  const cat = count === undefined ? 'other' : pluralCategory(lang, count)
  return text[cat] ?? text.other
}

function entryText(e: Entry | undefined, lang: Lang): { text: Text; lang: Lang } | null {
  if (!e) return null
  const own = e[lang]
  if (own !== undefined && own !== '') return { text: own, lang }
  return { text: e.en, lang: 'en' }
}

/**
 * Look a key up: the language, then English, then the key itself (and `onMissing` is called).
 * With `count`, plural forms are chosen with Intl.PluralRules and `{count}` is filled in.
 */
export function translate(
  table: Record<string, Entry>,
  lang: Lang,
  key: string,
  vars?: Vars,
  count?: number,
  onMissing?: (key: string) => void
): string {
  const hit = entryText(table[key], lang)
  if (!hit) {
    onMissing?.(key)
    return key
  }
  const s = pick(hit.text, hit.lang, count)
  if (count === undefined) return interpolate(s, vars)
  return interpolate(s, { count: new Intl.NumberFormat(localeOf(hit.lang)).format(count), ...vars })
}
