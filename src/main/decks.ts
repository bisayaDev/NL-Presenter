// Imported presentations (PDF, PowerPoint, Keynote). Each page is drawn to a JPEG in the media folder by the
// renderer (pdf.js); this table remembers which pictures make up which presentation, plus speaker notes.
import { readFile, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { MediaItem } from '@shared/types'
import { getDb } from './db'
import { convertToPdf, ConvertError } from './convert'
import { notesForPages, pptxNotes, type PptxSlideNotes } from './pptxNotes'
import { tm } from './i18n'

let dir = ''

export function initDecks(mediaDir: string): void {
  dir = mediaDir
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pages TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)
}

export interface DeckRow {
  id: string
  name: string
  pages: { file: string; size: number; notes?: string }[]
  width: number
  height: number
  source: string // original file type: pdf, pptx, key…
  createdAt: number
}

const toRow = (r: Record<string, unknown>): DeckRow => ({
  id: r.id as string,
  name: r.name as string,
  pages: JSON.parse(r.pages as string),
  width: r.width as number,
  height: r.height as number,
  source: r.source as string,
  createdAt: r.created_at as number
})

export const deckToItem = (d: DeckRow): MediaItem => ({
  id: d.id,
  name: d.name,
  kind: 'deck',
  ref: `media/${d.pages[0]?.file ?? ''}`,
  size: d.pages.reduce((n, p) => n + p.size, 0),
  createdAt: d.createdAt,
  deck: {
    pages: d.pages.map((p) => ({ ref: `media/${p.file}`, ...(p.notes ? { notes: p.notes } : {}) })),
    width: d.width,
    height: d.height,
    source: d.source
  }
})

export function deckRows(): DeckRow[] {
  return getDb().prepare('SELECT * FROM decks ORDER BY created_at DESC').all().map(toRow)
}

export function hasDeck(id: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM decks WHERE id = ?').get(id)
}

export function insertDeckRow(d: DeckRow): void {
  getDb()
    .prepare('INSERT INTO decks (id, name, pages, width, height, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(d.id, d.name, JSON.stringify(d.pages), d.width, d.height, d.source, d.createdAt)
}

export interface DeckSource {
  name: string
  source: string
  pdf: Uint8Array
  notes: PptxSlideNotes[]
}

/** Read a PDF, or convert a presentation to one. Speaker notes come from the .pptx itself. */
export async function loadDeckSource(path: string, onStep?: (what: string) => void): Promise<DeckSource> {
  const ext = extname(path).slice(1).toLowerCase()
  const name = basename(path, extname(path))
  let notes: PptxSlideNotes[] = []
  if (ext === 'pptx' || ext === 'ppsx') {
    try {
      notes = pptxNotes(await readFile(path))
    } catch {
      notes = [] // notes are a bonus; the slides still import
    }
  }
  if (ext === 'pdf') return { name, source: ext, pdf: await readFile(path), notes }
  const { pdf, dir: tmp } = await convertToPdf(path, onStep)
  try {
    return { name, source: ext, pdf: await readFile(pdf), notes }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

export { ConvertError }

/** Store rendered pages as a new presentation in the library. */
export async function saveDeck(input: {
  name: string
  source: string
  width: number
  height: number
  pages: Uint8Array[]
  notes: PptxSlideNotes[]
}): Promise<MediaItem> {
  if (!input.pages.length) throw new Error(tm('main.deck.noPages'))
  const id = randomUUID().slice(0, 12)
  const notes = notesForPages(input.notes, input.pages.length)
  const pages: DeckRow['pages'] = []
  try {
    for (const [i, bytes] of input.pages.entries()) {
      const file = `deck-${id}-${String(i + 1).padStart(3, '0')}.jpg`
      await writeFile(join(dir, file), bytes)
      const n = notes?.[i]?.trim()
      pages.push({ file, size: (await stat(join(dir, file))).size, ...(n ? { notes: n.slice(0, 5000) } : {}) })
    }
  } catch (e) {
    await Promise.all(pages.map((p) => unlink(join(dir, p.file)).catch(() => {})))
    throw e
  }
  const row: DeckRow = {
    id,
    name: input.name.trim().slice(0, 200) || 'Presentation',
    pages,
    width: Math.round(input.width),
    height: Math.round(input.height),
    source: input.source.slice(0, 8),
    createdAt: Date.now()
  }
  insertDeckRow(row)
  return deckToItem(row)
}

export async function deleteDeck(id: string): Promise<boolean> {
  const row = getDb().prepare('SELECT * FROM decks WHERE id = ?').get(id)
  if (!row) return false
  getDb().prepare('DELETE FROM decks WHERE id = ?').run(id)
  await Promise.all(toRow(row).pages.map((p) => unlink(join(dir, basename(p.file))).catch(() => {})))
  return true
}

export function renameDeck(id: string, name: string): boolean {
  return getDb().prepare('UPDATE decks SET name = ? WHERE id = ?').run(name.trim() || 'Presentation', id).changes > 0
}
