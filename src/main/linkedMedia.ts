// Linked media folders: pictures and videos shown from where they are, never copied into the library.
// The folder list and the files found in them are kept in the "linkedMedia" setting, so a backup keeps only the
// paths (restored on another computer, the files show as missing until the folder is linked there).
// A linked file's ref is "media/linked-<id>.<ext>": it goes through the same nlmedia:// protocol, LAN /media/ route
// and Sunday check as library files, and mediaPath() only resolves it to a file inside a linked folder.
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import type { MediaItem } from '@shared/types'
import { getSettings, setSetting } from './db'

const IMAGES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif']
const VIDEOS = ['mp4', 'webm', 'mov', 'm4v']
const MAX_FILES = 5000
const MAX_DEPTH = 3

export const LINKED_PREFIX = 'linked-'

interface LinkedRow {
  id: string
  folder: string
  path: string
  name: string
  kind: 'image' | 'video'
  size: number
  createdAt: number
}

interface LinkedData {
  folders: string[]
  items: LinkedRow[]
  /** Files the operator removed from the list: a refresh doesn't bring them back. */
  hidden?: string[]
}

// Short cache: video playback asks for the same file many times a second (Range requests). A backup restore writes
// the setting directly, so the cache only lives briefly.
let cache: { at: number; d: LinkedData } | null = null

function load(): LinkedData {
  if (cache && Date.now() - cache.at < 2000) return structuredClone(cache.d)
  const v = getSettings().linkedMedia as Partial<LinkedData> | undefined
  const d: LinkedData = {
    folders: Array.isArray(v?.folders) ? v.folders.filter((f) => typeof f === 'string') : [],
    items: Array.isArray(v?.items) ? v.items.filter((r) => r && typeof r.path === 'string' && typeof r.id === 'string') : [],
    hidden: Array.isArray(v?.hidden) ? v.hidden.filter((p) => typeof p === 'string') : []
  }
  cache = { at: Date.now(), d }
  return structuredClone(d)
}

const save = (d: LinkedData): void => {
  cache = { at: Date.now(), d: structuredClone(d) }
  setSetting('linkedMedia', d)
}

/** Same file, same id: slides that use a linked file keep working after a refresh. */
const idFor = (path: string): string => createHash('sha1').update(path).digest('hex').slice(0, 12)

const kindOf = (file: string): LinkedRow['kind'] | null => {
  const ext = extname(file).slice(1).toLowerCase()
  return IMAGES.includes(ext) ? 'image' : VIDEOS.includes(ext) ? 'video' : null
}

/** True when `path` is inside `folder` (after resolving "..", so nothing outside can be reached). */
function inside(folder: string, path: string): boolean {
  const f = resolve(folder)
  const p = resolve(path)
  return p.startsWith(f.endsWith(sep) ? f : f + sep)
}

async function scan(folder: string): Promise<{ path: string; size: number; mtime: number }[]> {
  const out: { path: string; size: number; mtime: number }[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (out.length >= MAX_FILES) return
      if (e.name.startsWith('.')) continue
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (depth < MAX_DEPTH) await walk(p, depth + 1)
      } else if (e.isFile() && kindOf(e.name)) {
        try {
          const s = await stat(p)
          out.push({ path: p, size: s.size, mtime: s.mtimeMs })
        } catch {
          /* unreadable: skip */
        }
      }
    }
  }
  await walk(folder, 0)
  return out
}

/**
 * Scan every linked folder: new files are added, files that are gone stay listed (flagged missing) so a slide
 * that uses one can still be found. A folder that can't be read at all (drive unplugged) keeps its list.
 */
export async function refreshLinked(): Promise<void> {
  const d = load()
  const byPath = new Map(d.items.map((r) => [r.path, r]))
  const hidden = new Set(d.hidden ?? [])
  for (const folder of d.folders) {
    if (!existsSync(folder)) continue
    for (const f of await scan(folder)) {
      if (hidden.has(f.path)) continue
      const row = byPath.get(f.path)
      if (row) {
        row.size = f.size
        row.folder = folder
      } else {
        const r: LinkedRow = {
          id: idFor(f.path),
          folder,
          path: f.path,
          name: basename(f.path, extname(f.path)),
          kind: kindOf(f.path)!,
          size: f.size,
          createdAt: f.mtime || Date.now()
        }
        byPath.set(f.path, r)
        d.items.push(r)
      }
    }
  }
  save(d)
}

export function linkedFolders(): { path: string; missing: boolean; count: number }[] {
  const d = load()
  return d.folders.map((f) => ({ path: f, missing: !existsSync(f), count: d.items.filter((r) => r.folder === f).length }))
}

export async function linkFolder(folder: string): Promise<number> {
  const d = load()
  const f = resolve(folder)
  if (!d.folders.includes(f)) d.folders.push(f)
  save(d)
  const before = load().items.length
  await refreshLinked()
  return load().items.length - before
}

/** Stop listing a folder (its files are never touched). */
export function unlinkFolder(folder: string): void {
  const d = load()
  save({
    folders: d.folders.filter((f) => f !== folder),
    items: d.items.filter((r) => r.folder !== folder),
    hidden: (d.hidden ?? []).filter((p) => !inside(folder, p))
  })
}

export function linkedItems(): MediaItem[] {
  return load().items.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    ref: `media/${LINKED_PREFIX}${r.id}${extname(r.path).toLowerCase()}`,
    size: r.size,
    createdAt: r.createdAt,
    linked: true,
    path: r.path,
    ...(existsSync(r.path) ? {} : { missing: true as const })
  }))
}

/**
 * "linked-<id>.<ext>" → the file's path, only if it is still listed, still inside a linked folder and a picture or
 * video. Anything else: null (the protocol and the LAN server answer 404).
 */
export function linkedPath(name: string): string | null {
  if (!name.startsWith(LINKED_PREFIX)) return null
  const id = basename(name, extname(name)).slice(LINKED_PREFIX.length)
  const d = load()
  const r = d.items.find((x) => x.id === id)
  if (!r || !kindOf(r.path)) return null
  if (!d.folders.some((f) => f === r.folder && inside(f, r.path))) return null
  return r.path
}

/** Linked file's path by media id (Show in Finder), or null. */
export function linkedPathById(id: string): string | null {
  return load().items.find((x) => x.id === id)?.path ?? null
}

/** Remove a linked file from the list (the file itself stays). False if it isn't a linked file. */
export function forgetLinked(id: string): boolean {
  const d = load()
  const r = d.items.find((x) => x.id === id)
  if (!r) return false
  save({ ...d, items: d.items.filter((x) => x.id !== id), hidden: [...(d.hidden ?? []), r.path] })
  return true
}

export function renameLinked(id: string, name: string): boolean {
  const d = load()
  const r = d.items.find((x) => x.id === id)
  if (!r) return false
  r.name = name.trim() || 'Untitled'
  save(d)
  return true
}
