import type { Song } from '@shared/types'
// Small helpers for "Show me" buttons (first-run checklist, Sunday check) and the "Create 'xyz' as a new song" shortcut.

/**
 * Find a control on screen: a CSS selector, or `heading:<id>` for a `.label-caps` heading marked `data-guide="<id>"`
 * (or, failing that, with this exact text); its section is used. Prefer data-guide: visible text is translated.
 */
function find(target: string): HTMLElement | null {
  if (target.startsWith('heading:')) {
    const text = target.slice(8)
    const h =
      document.querySelector<HTMLElement>(`.label-caps[data-guide="${text}"]`) ??
      [...document.querySelectorAll<HTMLElement>('.label-caps')].find((el) => el.textContent?.trim() === text)
    return h?.parentElement ?? null
  }
  return document.querySelector<HTMLElement>(target)
}

/**
 * Point at a control: scroll it into view and pulse a ring around it for a few seconds. `click` presses it too
 * (to open a menu). Waits a moment so a tab switch can render first.
 */
export function spotlight(target: string, opts: { click?: boolean } = {}): void {
  setTimeout(() => {
    const el = find(target)
    if (!el) return
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (opts.click) el.click()
    const prev = { outline: el.style.outline, offset: el.style.outlineOffset, transition: el.style.transition }
    el.style.transition = 'outline-color 0.4s'
    el.style.outlineOffset = '3px'
    let on = true
    el.style.outline = '2px solid var(--color-accent)'
    const pulse = setInterval(() => {
      on = !on
      el.style.outline = `2px solid ${on ? 'var(--color-accent)' : 'transparent'}`
    }, 450)
    setTimeout(() => {
      clearInterval(pulse)
      el.style.outline = prev.outline
      el.style.outlineOffset = prev.offset
      el.style.transition = prev.transition
    }, 3200)
  }, 80)
}

// The song editor reads this once when it opens a new song (Songs tab: "Create 'xyz' as a new song").
// Not cleared on read (React may run state initializers twice); it simply expires.
let pendingSongTitle = ''
let pendingAt = 0
export const setNewSongTitle = (t: string): void => {
  pendingSongTitle = t
  pendingAt = Date.now()
}
export const takeNewSongTitle = (): string => (Date.now() - pendingAt < 2000 ? pendingSongTitle : '')

// Find a song: the song editor opens on an imported song for checking before it is saved (same expiry as above).
export interface SongDraftHandoff {
  song: Omit<Song, 'id' | 'updatedAt'>
  /** Where it came from, shown above the editor (e.g. "Lyrics from LRCLIB"). */
  source: string
}
let pendingDraft: SongDraftHandoff | null = null
let draftAt = 0
export const setNewSongDraft = (d: SongDraftHandoff): void => {
  pendingDraft = d
  draftAt = Date.now()
}
export const takeNewSongDraft = (): SongDraftHandoff | null => (Date.now() - draftAt < 2000 ? pendingDraft : null)
