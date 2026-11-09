// Media library: imported images, videos and audio are copied into one folder and listed in SQLite.
// Electron windows load them via nlmedia://media/<file>; phones via http://<host>/media/<file>.
import { net, protocol } from 'electron'
import { copyFile, mkdir, stat, unlink } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import type { MediaItem } from '@shared/types'
import { getDb } from './db'
import { deleteLoop, importLoopFiles, initLoops, loopRows, loopToItem, renameLoop } from './loops'
import { deckRows, deckToItem, deleteDeck, initDecks, renameDeck } from './decks'
import { DECK_EXT } from './convert'
import { forgetLinked, LINKED_PREFIX, linkedItems, linkedPath, renameLinked } from './linkedMedia'

export const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif']
export const VIDEO_EXT = ['mp4', 'webm', 'mov', 'm4v']
export const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac']

export const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac'
}

let dir = ''

/** Must run before app "ready". */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'nlmedia', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ])
}

export async function initMedia(mediaDir: string): Promise<void> {
  dir = mediaDir
  await mkdir(dir, { recursive: true })
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      file TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)
  initLoops()
  initDecks(dir)
  // nlmedia://media/<file>. Forward Range headers so video seeking/streaming works.
  protocol.handle('nlmedia', (req) => {
    const file = mediaPath(decodeURIComponent(new URL(req.url).pathname))
    if (!file) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString(), { headers: req.headers })
  })
}

export function mediaDir(): string {
  return dir
}

/**
 * Resolve "/<file>" or "media/<file>" to a path inside the media folder (never outside it). Linked files
 * ("linked-<id>.<ext>") resolve only to a listed file inside a linked folder (see linkedMedia.ts).
 */
export function mediaPath(p: string): string | null {
  const name = basename(p)
  if (!name || name.startsWith('.')) return null
  if (name.startsWith(LINKED_PREFIX)) return linkedPath(name)
  return join(dir, name)
}

const toItem = (r: Record<string, unknown>): MediaItem => ({
  id: r.id as string,
  name: r.name as string,
  kind: r.kind as MediaItem['kind'],
  ref: `media/${r.file as string}`,
  size: r.size as number,
  createdAt: r.created_at as number
})

/** Files, background loops, presentations and files from linked folders, newest first. */
export function listMedia(): MediaItem[] {
  const files = getDb().prepare('SELECT * FROM media ORDER BY created_at DESC').all().map(toItem)
  return [...files, ...loopRows().map(loopToItem), ...deckRows().map(deckToItem), ...linkedItems()].sort((a, b) => b.createdAt - a.createdAt)
}

/** A library file's path on disk (linked files: where they are), for "Show in Finder". */
export function mediaFilePath(ref: string): string | null {
  if (typeof ref !== 'string' || !ref.startsWith('media/')) return null
  return mediaPath(ref)
}

/**
 * Copy files into the library. Presentations (PDF, PowerPoint, Keynote) are not imported here: they are
 * returned in `decks` for the renderer to draw page by page.
 */
export async function importMedia(paths: string[]): Promise<{ added: MediaItem[]; skipped: string[]; decks: string[] }> {
  const added: MediaItem[] = []
  const skipped: string[] = []
  const decks = paths.filter((p) => DECK_EXT.includes(extname(p).slice(1).toLowerCase()))
  paths = paths.filter((p) => !decks.includes(p))
  // .json files are background loop packs.
  const json = paths.filter((p) => extname(p).toLowerCase() === '.json')
  if (json.length) {
    const r = await importLoopFiles(json)
    added.push(...r.added)
    skipped.push(...r.skipped)
    if (r.duplicates) skipped.push(`${r.duplicates} loop${r.duplicates === 1 ? '' : 's'} already in the library`)
    paths = paths.filter((p) => !json.includes(p))
  }
  const ins = getDb().prepare('INSERT INTO media (id, name, kind, file, size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  for (const src of paths) {
    const ext = extname(src).slice(1).toLowerCase()
    const kind = IMAGE_EXT.includes(ext) ? 'image' : VIDEO_EXT.includes(ext) ? 'video' : AUDIO_EXT.includes(ext) ? 'audio' : null
    if (!kind) {
      skipped.push(basename(src))
      continue
    }
    const id = randomUUID().slice(0, 12)
    const file = `${id}.${ext}`
    await copyFile(src, join(dir, file))
    const { size } = await stat(join(dir, file))
    const name = basename(src, extname(src))
    const now = Date.now() + added.length // keep import order stable
    ins.run(id, name, kind, file, size, now)
    added.push({ id, name, kind, ref: `media/${file}`, size, createdAt: now })
  }
  return { added, skipped, decks }
}

export async function deleteMedia(id: string): Promise<void> {
  if (forgetLinked(id)) return // linked: only taken off the list, the file stays
  if (deleteLoop(id)) return
  if (await deleteDeck(id)) return
  const db = getDb()
  const row = db.prepare('SELECT file FROM media WHERE id = ?').get(id)
  if (!row) return
  db.prepare('DELETE FROM media WHERE id = ?').run(id)
  await unlink(join(dir, row.file as string)).catch(() => {})
}

export function renameMedia(id: string, name: string): void {
  if (renameLinked(id, name) || renameLoop(id, name) || renameDeck(id, name)) return
  getDb().prepare('UPDATE media SET name = ? WHERE id = ?').run(name.trim() || 'Untitled', id)
}

// ---------- backup helpers ----------

export interface MediaRow {
  id: string
  name: string
  kind: string
  file: string
  size: number
  created_at: number
}

export function mediaRows(): MediaRow[] {
  return getDb().prepare('SELECT * FROM media ORDER BY created_at').all() as unknown as MediaRow[]
}

export function hasMedia(id: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM media WHERE id = ?').get(id)
}

export function insertMediaRow(r: MediaRow): void {
  getDb()
    .prepare('INSERT INTO media (id, name, kind, file, size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(r.id, r.name, r.kind, r.file, r.size, r.created_at)
}
