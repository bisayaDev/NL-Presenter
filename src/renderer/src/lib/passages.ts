// Scripture passages kept in the Bible tab's Recent list and pins (see ScripturePassage in shared/types.ts).
import type { ScriptureOptions, ScripturePassage, Slide } from '@shared/types'
import { formatRef, scriptureSlides } from '@shared/bible'
import { uid } from './defaults'

export const HISTORY_MAX = 30

/** The Compare translations (at most two), including the single one older settings saved. */
export const compareIds = (opts: Pick<ScriptureOptions, 'parallelIds' | 'parallelId'>): string[] =>
  (opts.parallelIds?.length ? opts.parallelIds : opts.parallelId ? [opts.parallelId] : []).slice(0, 2)

export const passageId = (p: Pick<ScripturePassage, 'bibleId' | 'book' | 'chapter' | 'verses'>): string =>
  `${p.bibleId}:${p.book}:${p.chapter}:${[...p.verses].sort((a, b) => a - b).join(',')}`

/** "John 3:16–17 (KJV)" */
export const passageTitle = (p: ScripturePassage): string => `${formatRef(p.bookName, p.chapter, p.verses)} (${p.abbrev})`

/** Newest first, no duplicates, at most HISTORY_MAX. */
export function addToHistory(list: ScripturePassage[], p: ScripturePassage): ScripturePassage[] {
  return [p, ...list.filter((x) => x.id !== p.id)].slice(0, HISTORY_MAX)
}

/**
 * Fetch the passage's verses again and build slides with the current options (verses per slide, numbers,
 * Compare translation). Null when the translation was removed or the verses are gone.
 */
export async function passageSlides(p: ScripturePassage, opts: ScriptureOptions): Promise<{ title: string; slides: Slide[] } | null> {
  const bibles = await window.nl.bible.list()
  const main = bibles.find((b) => b.id === p.bibleId)
  if (!main) return null
  const [verses, books] = await Promise.all([window.nl.bible.chapter(main.id, p.book, p.chapter), window.nl.bible.books(main.id)])
  const bookName = books.find((b) => b.book === p.book)?.name ?? p.bookName
  const pars = compareIds(opts)
    .filter((id) => id !== main.id)
    .map((id) => bibles.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => !!b)
  const others: { bookName: string; abbrev: string; verses: typeof verses }[] = []
  for (const par of pars) {
    const [pv, pb] = await Promise.all([window.nl.bible.chapter(par.id, p.book, p.chapter), window.nl.bible.books(par.id)])
    const pName = pb.find((b) => b.book === p.book)?.name
    if (pName && pv.length) others.push({ bookName: pName, abbrev: par.abbrev, verses: pv })
  }
  const slides = scriptureSlides(p.chapter, p.verses, { bookName, abbrev: main.abbrev, verses }, opts, others).map((sl) => ({
    id: uid(),
    ...sl
  }))
  if (!slides.length) return null
  const abbrevs = [main.abbrev, ...others.map((o) => o.abbrev)].join(' + ')
  return { title: `${formatRef(bookName, p.chapter, p.verses)} (${abbrevs})`, slides }
}
