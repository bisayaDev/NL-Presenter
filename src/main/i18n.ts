// Main-process translations: native dialogs, message boxes, notices and errors shown in the UI.
// The language is the operator's `language` setting (read on every call, so a change applies at once),
// else the OS language when supported, else English. Strings live in src/shared/i18n-main.ts.
import { app } from 'electron'
import { isLang, matchLang, translate, type Lang, type Vars } from '@shared/i18n-core'
import MAIN_STRINGS from '@shared/i18n-main'
import * as db from './db'

export type MainKey = keyof typeof MAIN_STRINGS

function systemLang(): Lang {
  try {
    return matchLang(app.getPreferredSystemLanguages()[0] ?? app.getLocale()) ?? 'en'
  } catch {
    return 'en'
  }
}

/** The operator's language (setting `language`), else the OS language, else English. */
export function mainLang(): Lang {
  try {
    const saved = db.getSettings()['language']
    if (isLang(saved)) return saved
  } catch {
    // database not open yet
  }
  return systemLang()
}

const onMissing = (key: string): void => {
  if (!app.isPackaged) console.warn(`[i18n] missing main string "${key}"`)
}

/** Translate a main-process string. */
export const tm = (key: MainKey, vars?: Vars): string => translate(MAIN_STRINGS, mainLang(), key, vars, undefined, onMissing)

/** Plural form for `count` (fills {count}). */
export const tmn = (key: MainKey, count: number, vars?: Vars): string => translate(MAIN_STRINGS, mainLang(), key, vars, count, onMissing)
