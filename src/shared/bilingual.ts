// Bilingual lyrics. Inside a song slide, a line holding only "--" splits the primary language (above) from the
// second language (below):
//
//   [G]Amazing grace, how [C]sweet the sound
//   --
//   Kamangha-manghang biyaya
//
// The separator line itself is never shown on any screen. Chords belong to the primary text.

import type { LanguageMode } from './types'
export type { LanguageMode }

const SEP = /^[ \t]*--[ \t]*$/

export function splitLanguages(text: string): { primary: string; secondary: string | null } {
  if (!text.includes('--')) return { primary: text, secondary: null }
  const lines = text.split('\n')
  const i = lines.findIndex((l) => SEP.test(l))
  if (i < 0) return { primary: text, secondary: null }
  const primary = lines.slice(0, i).join('\n').replace(/\n+$/, '')
  // A second separator further down is dropped too.
  const secondary = lines
    .slice(i + 1)
    .filter((l) => !SEP.test(l))
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
  return { primary, secondary: secondary.trim() ? secondary : null }
}

export const hasSecondLanguage = (text: string): boolean => splitLanguages(text).secondary !== null

/**
 * The slide text for one language mode. 'both' keeps the separator (SlideView and the overlay draw the two parts);
 * a slide without a second language shows its primary text in every mode.
 */
export function languageText(text: string, mode: LanguageMode | undefined): string {
  if (!mode || mode === 'both') return text
  const { primary, secondary } = splitLanguages(text)
  if (secondary === null) return primary
  return mode === 'primary' ? primary : secondary
}

/** Both languages as plain text (separator → blank line), for screens that draw text as-is. */
export function plainLanguages(text: string): string {
  const { primary, secondary } = splitLanguages(text)
  return secondary === null ? primary : `${primary}\n\n${secondary}`
}
