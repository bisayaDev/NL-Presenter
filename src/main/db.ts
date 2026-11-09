// Local SQLite storage using Node's built-in node:sqlite. No native modules, so Mac and
// Windows builds need no per-platform compilation.
import { DatabaseSync } from 'node:sqlite'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { BOOKS, formatRef, parseReference } from '@shared/bible'
import type { BibleInfo, BibleBook, Service, ServiceSummary, Song, SongUsage, Verse, VerseHit } from '@shared/types'
import type { ParsedBible } from './zefania'

let db: DatabaseSync

export function openDb(file: string): void {
  db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      slides TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      items TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bibles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      abbrev TEXT NOT NULL,
      lang TEXT,
      license TEXT,
      builtin INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bible_books (
      bible_id TEXT NOT NULL REFERENCES bibles(id) ON DELETE CASCADE,
      book INTEGER NOT NULL,
      name TEXT NOT NULL,
      chapters INTEGER NOT NULL,
      PRIMARY KEY (bible_id, book)
    );

    CREATE TABLE IF NOT EXISTS verses (
      bible_id TEXT NOT NULL REFERENCES bibles(id) ON DELETE CASCADE,
      book INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      text TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS verses_ref ON verses(bible_id, book, chapter, verse);

    CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
      text, content='verses', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2'
    );
  `)
  // Columns added after the first release.
  const songCols = new Set(db.prepare('PRAGMA table_info(songs)').all().map((c) => c.name as string))
  if (!songCols.has('key')) db.exec('ALTER TABLE songs ADD COLUMN key TEXT')
  if (!songCols.has('template_id')) db.exec('ALTER TABLE songs ADD COLUMN template_id TEXT')
  if (!songCols.has('copyright')) db.exec('ALTER TABLE songs ADD COLUMN copyright TEXT')
  if (!songCols.has('ccli')) db.exec('ALTER TABLE songs ADD COLUMN ccli TEXT')
  if (!songCols.has('language_mode')) db.exec('ALTER TABLE songs ADD COLUMN language_mode TEXT')
  const serviceCols = new Set(db.prepare('PRAGMA table_info(services)').all().map((c) => c.name as string))
  if (!serviceCols.has('date')) db.exec('ALTER TABLE services ADD COLUMN date TEXT')
  // Song usage: one row per song, service and day it went live.
  db.exec(`
    CREATE TABLE IF NOT EXISTS song_usage (
      song_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      day TEXT NOT NULL,
      at INTEGER NOT NULL,
      UNIQUE (song_id, service_id, day)
    );
  `)
}

export const getDb = (): DatabaseSync => db

const tx = <T>(fn: () => T): T => {
  db.exec('BEGIN')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

// ---------- songs ----------

type Row = Record<string, unknown>

const toSong = (r: Row): Song => ({
  id: r.id as string,
  title: r.title as string,
  author: (r.author as string) || undefined,
  key: (r.key as string) || undefined,
  templateId: (r.template_id as string) || undefined,
  copyright: (r.copyright as string) || undefined,
  ccli: (r.ccli as string) || undefined,
  languageMode: r.language_mode === 'primary' || r.language_mode === 'secondary' ? r.language_mode : undefined,
  tags: JSON.parse(r.tags as string),
  slides: JSON.parse(r.slides as string),
  updatedAt: r.updated_at as number
})

export function listSongs(): Song[] {
  return db.prepare('SELECT * FROM songs ORDER BY title COLLATE NOCASE').all().map(toSong)
}

export function saveSong(s: Song): Song {
  const song = { ...s, updatedAt: Date.now() }
  db.prepare(
    `INSERT INTO songs (id, title, author, tags, slides, key, template_id, copyright, ccli, language_mode, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, author=excluded.author, tags=excluded.tags,
       slides=excluded.slides, key=excluded.key, template_id=excluded.template_id, copyright=excluded.copyright,
       ccli=excluded.ccli, language_mode=excluded.language_mode, updated_at=excluded.updated_at`
  ).run(
    song.id,
    song.title,
    song.author ?? null,
    JSON.stringify(song.tags),
    JSON.stringify(song.slides),
    song.key ?? null,
    song.templateId ?? null,
    song.copyright?.trim() || null,
    song.ccli?.trim() || null,
    song.languageMode && song.languageMode !== 'both' ? song.languageMode : null,
    song.updatedAt
  )
  return song
}

export function saveSongs(songs: Song[]): void {
  tx(() => songs.forEach(saveSong))
}

export function deleteSong(id: string): void {
  db.prepare('DELETE FROM songs WHERE id = ?').run(id)
}

// ---------- services ----------

const toService = (r: Row): Service => ({
  id: r.id as string,
  name: r.name as string,
  items: JSON.parse(r.items as string),
  ...(r.date ? { date: r.date as string } : {})
})

export function getLatestService(): Service | null {
  const r = db.prepare('SELECT * FROM services ORDER BY updated_at DESC LIMIT 1').get()
  return r ? toService(r) : null
}

export function getService(id: string): Service | null {
  const r = db.prepare('SELECT * FROM services WHERE id = ?').get(id)
  return r ? toService(r) : null
}

export function deleteService(id: string): void {
  db.prepare('DELETE FROM services WHERE id = ?').run(id)
}

/** The service library: newest date first (undated last), then most recently changed. */
export function listServiceSummaries(): ServiceSummary[] {
  return db
    .prepare(
      `SELECT id, name, date, updated_at,
         (SELECT COUNT(*) FROM json_each(services.items) WHERE json_extract(value, '$.kind') IS NOT 'section') AS count
       FROM services ORDER BY date IS NULL, date DESC, updated_at DESC`
    )
    .all()
    .map((r) => ({
      id: r.id as string,
      name: r.name as string,
      ...(r.date ? { date: r.date as string } : {}),
      updatedAt: r.updated_at as number,
      count: Number(r.count)
    }))
}

export function saveService(s: Service): void {
  db.prepare(
    `INSERT INTO services (id, name, items, date, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, items=excluded.items, date=excluded.date, updated_at=excluded.updated_at`
  ).run(s.id, s.name, JSON.stringify(s.items), s.date ?? null, Date.now())
}

// ---------- song usage ----------

export function logSongUsage(songId: string, serviceId: string, day: string): void {
  db.prepare('INSERT OR IGNORE INTO song_usage (song_id, service_id, day, at) VALUES (?, ?, ?, ?)').run(songId, serviceId, day, Date.now())
}

/** Times used and last day used per song, between two days (inclusive, "YYYY-MM-DD"; open ends allowed). */
export function songUsageReport(from?: string, to?: string): SongUsage[] {
  return db
    .prepare(
      `SELECT u.song_id, s.title, s.author, s.copyright, s.ccli, COUNT(*) AS n, MAX(u.day) AS last
       FROM song_usage u JOIN songs s ON s.id = u.song_id
       WHERE u.day >= ? AND u.day <= ?
       GROUP BY u.song_id ORDER BY n DESC, s.title COLLATE NOCASE`
    )
    .all(from || '0000-00-00', to || '9999-99-99')
    .map((r) => ({
      songId: r.song_id as string,
      title: r.title as string,
      ...(r.author ? { author: r.author as string } : {}),
      ...(r.copyright ? { copyright: r.copyright as string } : {}),
      ...(r.ccli ? { ccli: r.ccli as string } : {}),
      count: Number(r.n),
      last: r.last as string
    }))
}

// ---------- settings ----------

export function getSettings(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key as string] = JSON.parse(r.value as string)
  return out
}

export function setSetting(key: string, value: unknown): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(
    key,
    JSON.stringify(value)
  )
}

// ---------- bibles ----------

export function listBibles(): BibleInfo[] {
  return db
    .prepare('SELECT id, name, abbrev, lang, license, builtin FROM bibles ORDER BY builtin DESC, created_at')
    .all()
    .map((r) => ({
      id: r.id as string,
      name: r.name as string,
      abbrev: r.abbrev as string,
      lang: (r.lang as string) || '',
      license: (r.license as string) || '',
      builtin: !!r.builtin
    }))
}

export function hasBible(id: string): boolean {
  return !!db.prepare('SELECT 1 FROM bibles WHERE id = ?').get(id)
}

export function insertBible(meta: Omit<BibleInfo, 'builtin'> & { builtin?: boolean }, parsed: Pick<ParsedBible, 'books' | 'verses'>): BibleInfo {
  tx(() => {
    // created_at doubles as sort order; max+1 keeps install order stable within one millisecond.
    const last = (db.prepare('SELECT MAX(created_at) AS m FROM bibles').get()?.m as number) ?? 0
    db.prepare('INSERT INTO bibles (id, name, abbrev, lang, license, builtin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      meta.id,
      meta.name,
      meta.abbrev,
      meta.lang,
      meta.license,
      meta.builtin ? 1 : 0,
      Math.max(Date.now(), last + 1)
    )
    const ins = db.prepare('INSERT OR REPLACE INTO verses (bible_id, book, chapter, verse, text) VALUES (?, ?, ?, ?, ?)')
    const chapters = new Map<number, number>()
    for (const v of parsed.verses) {
      ins.run(meta.id, v.book, v.chapter, v.verse, v.text)
      chapters.set(v.book, Math.max(chapters.get(v.book) ?? 0, v.chapter))
    }
    const insBook = db.prepare('INSERT INTO bible_books (bible_id, book, name, chapters) VALUES (?, ?, ?, ?)')
    for (const [book, count] of [...chapters].sort((a, b) => a[0] - b[0])) {
      const name = parsed.books.get(book) || BOOKS[book - 1].name
      insBook.run(meta.id, book, name, count)
    }
    db.prepare(
      'INSERT INTO verses_fts (rowid, text) SELECT rowid, text FROM verses WHERE bible_id = ?'
    ).run(meta.id)
  })
  return listBibles().find((b) => b.id === meta.id)!
}

/** Change a translation's short code (the badge and the "(NKJV)" on slides). */
export function setBibleAbbrev(id: string, abbrev: string): void {
  db.prepare('UPDATE bibles SET abbrev = ? WHERE id = ?').run(abbrev, id)
}

export function deleteBible(id: string): void {
  const row = db.prepare('SELECT builtin FROM bibles WHERE id = ?').get(id)
  if (!row || row.builtin) return // built-in Bibles stay
  tx(() => {
    // External-content FTS: remove the index entries before the rows go away.
    db.prepare(
      "INSERT INTO verses_fts (verses_fts, rowid, text) SELECT 'delete', rowid, text FROM verses WHERE bible_id = ?"
    ).run(id)
    db.prepare('DELETE FROM bibles WHERE id = ? AND builtin = 0').run(id)
  })
}

export function getBooks(bibleId: string): BibleBook[] {
  return db
    .prepare('SELECT book, name, chapters FROM bible_books WHERE bible_id = ? ORDER BY book')
    .all(bibleId)
    .map((r) => ({ book: r.book as number, name: r.name as string, chapters: r.chapters as number }))
}

export function getChapter(bibleId: string, book: number, chapter: number): Verse[] {
  return db
    .prepare('SELECT verse, text FROM verses WHERE bible_id = ? AND book = ? AND chapter = ? ORDER BY verse')
    .all(bibleId, book, chapter)
    .map((r) => ({ verse: r.verse as number, text: r.text as string }))
}

/** Search by reference ("jn 3:16") or by words ("loved the world"). */
export function searchBible(bibleId: string, query: string): { ref: boolean; hits: VerseHit[] } {
  const books = getBooks(bibleId)
  const local = new Map(books.map((b) => [b.book, b.name]))
  const name = (n: number): string => local.get(n) ?? BOOKS[n - 1].name

  const ref = parseReference(query, local)
  if (ref) {
    const rows = db
      .prepare(
        `SELECT book, chapter, verse, text FROM verses WHERE bible_id = ? AND book = ? AND chapter = ?
         AND verse BETWEEN ? AND ? ORDER BY verse`
      )
      .all(bibleId, ref.book, ref.chapter, ref.verseStart ?? 1, ref.verseEnd ?? 999)
    return { ref: true, hits: rows.map((r) => hit(r, name)) }
  }

  const words = query
    .toLowerCase()
    .match(/[\p{L}\p{N}']+/gu)
    ?.map((w) => w.replace(/'/g, ''))
    .filter(Boolean)
  if (!words?.length) return { ref: false, hits: [] }
  const match = words.map((w, i) => (i === words.length - 1 ? `"${w}"*` : `"${w}"`)).join(' ')
  const rows = db
    .prepare(
      `SELECT v.book, v.chapter, v.verse, v.text FROM verses_fts f JOIN verses v ON v.rowid = f.rowid
       WHERE verses_fts MATCH ? AND v.bible_id = ? ORDER BY v.book, v.chapter, v.verse LIMIT 200`
    )
    .all(match, bibleId)
  return { ref: false, hits: rows.map((r) => hit(r, name)) }
}

function hit(r: Row, name: (n: number) => string): VerseHit {
  const book = r.book as number
  const chapter = r.chapter as number
  const verse = r.verse as number
  return { book, chapter, verse, text: r.text as string, label: formatRef(name(book), chapter, [verse]) }
}

/** Import the bundled Bibles (resources/bibles/*.tsv.gz) that aren't installed yet. */
export function seedBundledBibles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const added: string[] = []
  // Install order is the display order; KJV first so it is the default translation.
  const rank = (f: string): number => ['kjv', 'asv'].indexOf(f.replace('.tsv.gz', '')) >>> 0
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.tsv.gz'))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  for (const file of files) {
    const content = gunzipSync(readFileSync(join(dir, file))).toString('utf8')
    const nl = content.indexOf('\n')
    const meta = JSON.parse(content.slice(0, nl))
    if (hasBible(meta.id)) continue
    const verses = content
      .slice(nl + 1)
      .split('\n')
      .map((line) => {
        const [b, c, v, ...t] = line.split('\t')
        return { book: Number(b), chapter: Number(c), verse: Number(v), text: t.join('\t') }
      })
    insertBible({ ...meta, builtin: true }, { books: new Map(), verses })
    added.push(meta.abbrev)
  }
  return added
}

// ---------- backup helpers ----------

export function listServices(): Service[] {
  return db
    .prepare('SELECT * FROM services ORDER BY updated_at')
    .all()
    .map(toService)
}

export interface BibleExport {
  info: BibleInfo
  books: [number, string][]
  verses: [number, number, number, string][] // book, chapter, verse, text
}

export function exportBible(id: string): BibleExport | null {
  const info = listBibles().find((b) => b.id === id)
  if (!info) return null
  return {
    info,
    books: getBooks(id).map((b) => [b.book, b.name]),
    verses: db
      .prepare('SELECT book, chapter, verse, text FROM verses WHERE bible_id = ? ORDER BY book, chapter, verse')
      .all(id)
      .map((r) => [r.book as number, r.chapter as number, r.verse as number, r.text as string])
  }
}

/** Songs already in the library, keyed by id and by title + lyrics, for duplicate detection on restore. */
export function songKeys(): { ids: Set<string>; content: Set<string> } {
  const ids = new Set<string>()
  const content = new Set<string>()
  for (const s of listSongs()) {
    ids.add(s.id)
    content.add(songContentKey(s))
  }
  return { ids, content }
}

export const songContentKey = (s: Song): string =>
  `${s.title.trim().toLowerCase()}\u0000${s.slides.map((x) => x.text.trim()).join('\n\n')}`
