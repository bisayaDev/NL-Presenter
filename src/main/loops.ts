// Background loops in the library. They are small JSON definitions (no media file), kept in their own table
// and listed alongside the media files.
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { MediaItem } from '@shared/types'
import { parseLoopFile, sanitizeDefinition, type LoopRecord } from '@shared/loops'
import { getDb } from './db'

export function initLoops(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS loops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT NOT NULL,
      definition TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)
}

export interface LoopRow extends LoopRecord {
  createdAt: number
}

const toRow = (r: Record<string, unknown>): LoopRow | null => {
  const definition = sanitizeDefinition(JSON.parse(r.definition as string))
  if (!definition) return null
  return {
    id: r.id as string,
    name: r.name as string,
    category: r.category as string,
    tags: JSON.parse(r.tags as string) as string[],
    definition,
    createdAt: r.created_at as number
  }
}

export const loopToItem = (l: LoopRow): MediaItem => ({
  id: l.id,
  name: l.name,
  kind: 'loop',
  ref: `loop:${l.id}`,
  size: 0,
  createdAt: l.createdAt,
  loop: { category: l.category, tags: l.tags, definition: l.definition }
})

export function loopRows(): LoopRow[] {
  return getDb()
    .prepare('SELECT * FROM loops ORDER BY created_at DESC')
    .all()
    .map(toRow)
    .filter((r): r is LoopRow => !!r)
}

export function hasLoop(id: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM loops WHERE id = ?').get(id)
}

/** Insert loops not in the library yet (same id = same loop). Returns the ones added. */
export function insertLoops(loops: LoopRecord[], createdAt = Date.now()): LoopRow[] {
  const ins = getDb().prepare('INSERT INTO loops (id, name, category, tags, definition, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  const added: LoopRow[] = []
  for (const l of loops) {
    if (hasLoop(l.id)) continue
    const at = createdAt + added.length
    ins.run(l.id, l.name, l.category, JSON.stringify(l.tags), JSON.stringify(l.definition), at)
    added.push({ ...l, createdAt: at })
  }
  return added
}

/** Import .json loop files. Files that hold no loops are reported back by name. */
export async function importLoopFiles(paths: string[]): Promise<{ added: MediaItem[]; skipped: string[]; duplicates: number }> {
  const added: MediaItem[] = []
  const skipped: string[] = []
  let duplicates = 0
  for (const p of paths) {
    try {
      const loops = parseLoopFile(await readFile(p, 'utf8'))
      const fresh = insertLoops(loops)
      duplicates += loops.length - fresh.length
      added.push(...fresh.map(loopToItem))
    } catch (e) {
      skipped.push(`${basename(p)} (${(e as Error).message})`)
    }
  }
  return { added, skipped, duplicates }
}

export function deleteLoop(id: string): boolean {
  return getDb().prepare('DELETE FROM loops WHERE id = ?').run(id).changes > 0
}

export function renameLoop(id: string, name: string): boolean {
  return getDb().prepare('UPDATE loops SET name = ? WHERE id = ?').run(name.trim() || 'Untitled loop', id).changes > 0
}
