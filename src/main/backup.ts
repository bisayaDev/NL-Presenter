// Full backup / restore.
// File format (.nlbackup): gzip stream of
//   "NLPRESENTER-BACKUP 1\n" + <header JSON> + "\n" + <media file bytes, back to back, in header order>
//   (media files first, then the page pictures of each presentation)
// Streaming in both directions, so large video libraries never have to fit in memory.
import { createReadStream, createWriteStream, closeSync, openSync, writeSync, statSync, renameSync, unlinkSync } from 'node:fs'
import { once } from 'node:events'
import { createHash } from 'node:crypto'
import { finished } from 'node:stream/promises'
import { createGunzip, createGzip } from 'node:zlib'
import { basename, join } from 'node:path'
import type { BackupSummary, Service, Song } from '@shared/types'
import * as db from './db'
import { hasMedia, insertMediaRow, mediaDir, mediaRows, type MediaRow } from './media'
import { insertLoops, loopRows, type LoopRow } from './loops'
import { deckRows, hasDeck, insertDeckRow, type DeckRow } from './decks'
import { tm } from './i18n'

const MAGIC = 'NLPRESENTER-BACKUP 1'

interface Header {
  app: 'NLPresenter'
  format: 1
  createdAt: number
  songs: Song[]
  services: Service[]
  settings: Record<string, unknown>
  bibles: db.BibleExport[]
  media: MediaRow[]
  loops?: LoopRow[] // background loops (added after format 1 shipped; older backups have none)
  decks?: DeckRow[] // presentations; their page files follow the media files
}

/** Every file in the byte stream, in order, and what to do once it has been written. */
interface FileEntry {
  file: string
  size: number
  keep: boolean
  done: () => void
}

function fileEntries(h: Header, summary: BackupSummary): FileEntry[] {
  const out: FileEntry[] = h.media.map((m) => ({
    file: basename(m.file),
    size: m.size,
    keep: !hasMedia(m.id),
    done: () => {
      insertMediaRow({ ...m, file: basename(m.file) })
      summary.media++
    }
  }))
  for (const d of h.decks ?? []) {
    const keep = !hasDeck(d.id)
    if (!keep) summary.skipped.media++
    d.pages.forEach((p, i) =>
      out.push({
        file: basename(p.file),
        size: p.size,
        keep,
        // The presentation is listed once its last page is on disk.
        done: () => {
          if (i < d.pages.length - 1) return
          insertDeckRow({ ...d, pages: d.pages.map((x) => ({ ...x, file: basename(x.file) })) })
          summary.media++
        }
      })
    )
  }
  return out
}

const onDisk = (file: string): number | null => {
  try {
    const st = statSync(join(mediaDir(), file))
    return st.isFile() ? st.size : null
  } catch {
    return null
  }
}

export async function createBackup(target: string): Promise<BackupSummary> {
  const media = mediaRows().filter((m) => {
    try {
      return statSync(join(mediaDir(), m.file)).isFile()
    } catch {
      return false // file missing on disk: leave it out
    }
  })
  const header: Header = {
    app: 'NLPresenter',
    format: 1,
    createdAt: Date.now(),
    songs: db.listSongs(),
    services: db.listServices(),
    settings: db.getSettings(),
    bibles: db
      .listBibles()
      .filter((b) => !b.builtin) // built-in Bibles ship with the app
      .map((b) => db.exportBible(b.id)!)
      .filter(Boolean),
    media: media.map((m) => ({ ...m, size: statSync(join(mediaDir(), m.file)).size })),
    loops: loopRows(),
    // Presentations with a missing page picture are left out.
    decks: deckRows()
      .map((d) => {
        const sizes = d.pages.map((p) => onDisk(p.file))
        return sizes.every((n) => n !== null) ? { ...d, pages: d.pages.map((p, i) => ({ ...p, size: sizes[i]! })) } : null
      })
      .filter((d): d is DeckRow => !!d)
  }

  const gzip = createGzip({ level: 6 })
  const out = createWriteStream(target)
  gzip.pipe(out)
  const write = async (chunk: Buffer | string): Promise<void> => {
    if (!gzip.write(chunk)) await once(gzip, 'drain')
  }
  await write(`${MAGIC}\n${JSON.stringify(header)}\n`)
  const files = [...header.media.map((m) => m.file), ...header.decks!.flatMap((d) => d.pages.map((p) => p.file))]
  for (const f of files) {
    for await (const chunk of createReadStream(join(mediaDir(), f))) await write(chunk as Buffer)
  }
  gzip.end()
  await finished(out)

  return {
    songs: header.songs.length,
    services: header.services.length,
    bibles: header.bibles.length,
    media: header.media.length + (header.loops?.length ?? 0) + (header.decks?.length ?? 0),
    settings: true,
    skipped: { songs: 0, bibles: 0, media: 0 },
    bytes: statSync(target).size
  }
}

/** Restore a backup into the current library. Existing items are kept; duplicates are skipped. */
export async function restoreBackup(source: string): Promise<BackupSummary> {
  const stream = createReadStream(source).pipe(createGunzip())
  let buf = Buffer.alloc(0)
  let header: Header | null = null
  let files: FileEntry[] = []
  let fileIndex = 0
  let remaining = 0
  let fd: number | null = null
  let tmpPath = ''
  const summary: BackupSummary = {
    songs: 0,
    services: 0,
    bibles: 0,
    media: 0,
    settings: false,
    skipped: { songs: 0, bibles: 0, media: 0 },
    bytes: statSync(source).size
  }

  const startFile = (): void => {
    while (fileIndex < files.length) {
      const m = files[fileIndex]
      remaining = m.size
      if (m.keep) {
        tmpPath = join(mediaDir(), `.restore-${m.file}`)
        fd = openSync(tmpPath, 'w')
      } else {
        fd = null
      }
      if (remaining > 0) return
      finishFile() // empty file
    }
  }

  const finishFile = (): void => {
    const m = files[fileIndex]
    if (fd !== null) {
      closeSync(fd)
      fd = null
      renameSync(tmpPath, join(mediaDir(), m.file))
      m.done()
    }
    fileIndex++
  }

  try {
    for await (const chunk of stream) {
      let data: Buffer = chunk as Buffer
      if (!header) {
        buf = Buffer.concat([buf, data])
        const first = buf.indexOf(10)
        const second = first >= 0 ? buf.indexOf(10, first + 1) : -1
        if (second < 0) {
          if (buf.length > 512 * 1024 * 1024) throw new Error(tm('main.backup.tooLarge'))
          continue
        }
        if (buf.subarray(0, first).toString('utf8') !== MAGIC) throw new Error(tm('main.backup.notBackup'))
        header = JSON.parse(buf.subarray(first + 1, second).toString('utf8')) as Header
        restoreRecords(header, summary)
        files = fileEntries(header, summary)
        summary.skipped.media += header.media.filter((m) => hasMedia(m.id)).length
        data = buf.subarray(second + 1)
        buf = Buffer.alloc(0)
        startFile()
      }
      // Media bytes: split the chunk across files by their sizes.
      while (data.length && fileIndex < files.length) {
        const take = Math.min(remaining, data.length)
        if (fd !== null) writeSync(fd, data, 0, take)
        remaining -= take
        data = data.subarray(take)
        if (remaining === 0) {
          finishFile()
          startFile()
        }
      }
    }
    if (!header) throw new Error(tm('main.backup.notBackup'))
    if (fileIndex < files.length) throw new Error(tm('main.backup.incomplete'))
  } catch (e) {
    if (fd !== null) {
      closeSync(fd)
      try {
        unlinkSync(tmpPath)
      } catch {
        /* ignore */
      }
    }
    if (e instanceof SyntaxError) throw new Error(tm('main.backup.damaged'))
    if ((e as NodeJS.ErrnoException).code === 'Z_DATA_ERROR') throw new Error(tm('main.backup.notBackup'))
    throw e
  }
  return summary
}

function restoreRecords(h: Header, summary: BackupSummary): void {
  // Songs: skip the same id, or the same title and lyrics (e.g. typed in on both computers).
  const known = db.songKeys()
  const fresh: Song[] = []
  for (const s of h.songs ?? []) {
    const key = db.songContentKey(s)
    if (known.ids.has(s.id) || known.content.has(key)) {
      summary.skipped.songs++
      continue
    }
    known.ids.add(s.id)
    known.content.add(key)
    fresh.push(s)
  }
  db.saveSongs(fresh)
  summary.songs = fresh.length

  const serviceIds = new Set(db.listServices().map((s) => s.id))
  for (const svc of h.services ?? []) {
    if (serviceIds.has(svc.id)) continue // keep the local copy
    db.saveService(svc)
    summary.services++
  }

  const existing = db.listBibles()
  for (const b of h.bibles ?? []) {
    if (existing.some((x) => x.id === b.info.id || (x.name === b.info.name && x.abbrev === b.info.abbrev))) {
      summary.skipped.bibles++
      continue
    }
    db.insertBible(
      { ...b.info, builtin: false },
      { books: new Map(b.books), verses: b.verses.map(([book, chapter, verse, text]) => ({ book, chapter, verse, text })) }
    )
    summary.bibles++
  }

  const loops = h.loops ?? []
  let at = Date.now()
  for (const l of loops) {
    // insertLoops skips ids already present; keep the original order.
    if (insertLoops([l], l.createdAt ?? at++).length) summary.media++
    else summary.skipped.media++
  }

  // This machine's automatic-backup state (folder, last run) stays as it is.
  for (const [k, v] of Object.entries(h.settings ?? {})) if (k !== 'seeded' && !k.startsWith('autoBackup')) db.setSetting(k, v)
  summary.settings = true
}

/** Settings that change on their own (session, window, history): they don't make a new backup worth it. */
const VOLATILE = new Set([
  'cleanExit',
  'lastExitUnclean',
  'session',
  'sessionOutputs',
  'serviceStartedAt',
  'preflightDay',
  'scriptureHistory',
  'uiZoom',
  'netUsedBefore',
  'countdown'
])

/**
 * A short hash of everything a backup would hold (records, not media bytes: media files are named by content
 * and listed with their size). Automatic backups skip when it has not changed since the last one.
 */
export function backupFingerprint(): string {
  const settings = Object.entries(db.getSettings())
    .filter(([k]) => !VOLATILE.has(k) && !k.startsWith('autoBackup'))
    .sort(([a], [b]) => (a < b ? -1 : 1))
  const h = createHash('sha1')
  h.update(JSON.stringify(db.listSongs()))
  h.update(JSON.stringify(db.listServices()))
  h.update(JSON.stringify(settings))
  h.update(JSON.stringify(db.listBibles().map((b) => b.id)))
  h.update(JSON.stringify(mediaRows().map((m) => [m.file, onDisk(m.file)])))
  h.update(JSON.stringify(loopRows()))
  h.update(JSON.stringify(deckRows().map((d) => [d, d.pages.map((p) => onDisk(p.file))])))
  return h.digest('hex')
}
