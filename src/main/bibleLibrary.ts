// Translation library: the open catalogue of eBible.org (only translations marked redistributable and
// downloadable). Installing downloads the verse file, plus the book names in the translation's language.
import { existsSync, statSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import type { BibleCatalog, BibleInfo, BibleInstallProgress, LibraryBible } from '@shared/types'
import { BOOK_BY_CODE } from '@shared/bible'
import * as db from './db'
import { readZip } from './zip'
import { tm } from './i18n'

const BASE = 'https://ebible.org/Scriptures/'
const CATALOG_URL = `${BASE}translations.csv`
const UA = { 'User-Agent': 'NLPresenter (church presentation app)' }
const MAX_AGE = 7 * 24 * 3600 * 1000

/** Built-in Bibles and the catalogue entry they were made from. */
const BUILTIN: Record<string, string> = { 'eng-kjv': 'kjv', 'eng-kjv2006': 'kjv', 'eng-asv': 'asv', tglulb: 'tlulb' }
const appId = (ebibleId: string): string => BUILTIN[ebibleId] ?? `eb-${ebibleId}`

let cacheFile = ''
export function initBibleLibrary(file: string): void {
  cacheFile = file
}

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.length > 1 || row[0]) rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) rows.push([...row, field])
  return rows
}

/** Short label for the picker: the id without its language prefix ("engwebp" → "WEBP", "spaRV1909" → "RV1909"). */
function abbrevFor(id: string, lang: string): string {
  let rest = id.toLowerCase().startsWith(lang.toLowerCase()) ? id.slice(lang.length) : id
  rest = rest.replace(/^[-_]+/, '')
  return (rest || id).toUpperCase().slice(0, 9)
}

interface Entry extends Omit<LibraryBible, 'installedId'> {
  abbrev: string
}

function toEntries(csv: string): Entry[] {
  const [head, ...rows] = parseCsv(csv.replace(/^﻿/, ''))
  const col = (name: string): number => head.indexOf(name)
  const c = {
    lang: col('languageCode'),
    id: col('translationId'),
    local: col('languageName'),
    english: col('languageNameInEnglish'),
    title: col('title'),
    short: col('shortTitle'),
    redist: col('Redistributable'),
    copyright: col('Copyright'),
    ot: col('OTbooks'),
    nt: col('NTbooks'),
    dir: col('textDirection'),
    dl: col('downloadable')
  }
  if (c.id < 0 || c.redist < 0) throw new Error(tm('main.bible.badFormat'))
  const out: Entry[] = []
  for (const r of rows) {
    if (r[c.redist] !== 'True' || r[c.dl] !== 'True') continue
    const ot = Number(r[c.ot]) || 0
    const nt = Number(r[c.nt]) || 0
    if (!ot && !nt) continue // deuterocanon or other books only
    const id = r[c.id]
    out.push({
      id,
      name: (r[c.short] || r[c.title] || id).trim(),
      title: (r[c.title] || '').trim(),
      lang: r[c.lang],
      language: r[c.english] || r[c.local] || r[c.lang],
      languageLocal: r[c.local] || '',
      copyright: (r[c.copyright] || '').trim(),
      coverage: ot >= 39 && nt >= 27 ? 'full' : nt >= 27 && !ot ? 'nt' : ot >= 39 && !nt ? 'ot' : 'portions',
      books: ot + nt,
      rtl: r[c.dir] === 'rtl',
      abbrev: abbrevFor(id, r[c.lang])
    })
  }
  // One name per language code ("Español" and "Spanish" are both spa): the most common one wins.
  const names = new Map<string, Map<string, number>>()
  for (const e of out) {
    const m = names.get(e.lang) ?? new Map<string, number>()
    m.set(e.language, (m.get(e.language) ?? 0) + 1)
    names.set(e.lang, m)
  }
  for (const e of out) {
    const best = [...names.get(e.lang)!].sort((a, b) => b[1] - a[1] || Number(/^[\x20-\x7e]+$/.test(b[0])) - Number(/^[\x20-\x7e]+$/.test(a[0])))[0][0]
    if (best !== e.language && !e.languageLocal) e.languageLocal = e.language
    e.language = best
  }
  return out.sort((a, b) => a.language.localeCompare(b.language) || a.name.localeCompare(b.name))
}

let entries: Entry[] | null = null
let entriesAt = 0

/** The catalogue: fresh from eBible.org once a week, otherwise (or offline) the saved copy. */
export async function bibleCatalog(refresh = false): Promise<BibleCatalog> {
  let offline = false
  const cached = cacheFile && existsSync(cacheFile) ? statSync(cacheFile).mtimeMs : 0
  if (!entries || refresh || Date.now() - entriesAt > MAX_AGE) {
    let csv: string | null = null
    if (refresh || !cached || Date.now() - cached > MAX_AGE) {
      try {
        const res = await fetch(CATALOG_URL, { headers: UA, signal: AbortSignal.timeout(20_000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        csv = await res.text()
        if (cacheFile) await writeFile(cacheFile, csv, 'utf8')
        entriesAt = Date.now()
      } catch {
        offline = true
      }
    }
    if (!csv && cached) {
      csv = await readFile(cacheFile, 'utf8')
      entriesAt = cached
    }
    if (!csv) throw new Error(tm('main.bible.noList'))
    entries = toEntries(csv)
  }
  const installed = new Set(db.listBibles().map((b) => b.id))
  return {
    bibles: entries.map(({ abbrev: _a, ...e }) => ({ ...e, installedId: installed.has(appId(e.id)) ? appId(e.id) : null })),
    updated: entriesAt,
    offline
  }
}

async function download(url: string, onBytes?: (received: number, total: number) => void): Promise<Buffer> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(300_000) })
  if (!res.ok || !res.body) throw new Error(res.status === 404 ? tm('main.bible.unavailable') : tm('main.bible.downloadFailed', { status: res.status }))
  const total = Number(res.headers.get('content-length')) || 0
  const parts: Uint8Array[] = []
  let received = 0
  const reader = res.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
    received += value.length
    onBytes?.(received, total)
  }
  return Buffer.concat(parts)
}

const decode = (s: string): string =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, '&')

/** Verses from an eBible "_vpl.xml" file (the 66 books; other books are skipped). */
export function parseVpl(xml: string): { book: number; chapter: number; verse: number; text: string }[] {
  const out: { book: number; chapter: number; verse: number; text: string }[] = []
  for (const m of xml.matchAll(/<v b="(\w+)" c="(\d+)" v="(\d+)[^"]*">([\s\S]*?)<\/v>/g)) {
    const book = BOOK_BY_CODE.get(m[1])?.n
    if (!book) continue
    const text = decode(m[4]).replace(/¶/g, '').replace(/\s+/g, ' ').trim()
    if (text) out.push({ book, chapter: Number(m[2]), verse: Number(m[3]), text })
  }
  return out
}

/** Book names in the translation's own language, from BookNames.xml. */
export function parseBookNames(xml: string): Map<number, string> {
  const names = new Map<number, string>()
  for (const m of xml.matchAll(/<book\b([^>]*)\/?>/g)) {
    const attr = (k: string): string => decode(m[1].match(new RegExp(`\\b${k}="([^"]*)"`))?.[1] ?? '').trim()
    const n = BOOK_BY_CODE.get(attr('code'))?.n
    const name = attr('short') || attr('long') || attr('abbr')
    if (n && name) names.set(n, name)
  }
  return names
}

/** Download and install one catalogue translation. */
export async function installLibraryBible(ebibleId: string, progress: (p: BibleInstallProgress) => void): Promise<BibleInfo> {
  if (!entries) await bibleCatalog()
  const e = entries!.find((x) => x.id === ebibleId)
  if (!e) throw new Error(tm('main.bible.notInLibrary'))
  const id = appId(e.id)
  if (db.hasBible(id)) return db.listBibles().find((b) => b.id === id)!

  progress({ id: e.id, step: 'download', received: 0, total: 0 })
  const zip = readZip(await download(`${BASE}${e.id}_vpl.zip`, (received, total) => progress({ id: e.id, step: 'download', received, total })))
  const vpl = [...zip.values()].find((z) => z.name.endsWith('_vpl.xml'))
  if (!vpl) throw new Error(tm('main.bible.noText'))
  const verses = parseVpl(vpl.read().toString('utf8'))
  if (!verses.length) throw new Error(tm('main.bible.noVerses'))

  // Book names in the translation's language (optional: English names if this part fails).
  progress({ id: e.id, step: 'names', received: 0, total: 0 })
  let books = new Map<number, string>()
  try {
    const usfx = readZip(await download(`${BASE}${e.id}_usfx.zip`))
    const names = [...usfx.values()].find((z) => /(^|\/)BookNames\.xml$/i.test(z.name))
    if (names) books = parseBookNames(names.read().toString('utf8'))
  } catch {
    /* keep English names */
  }

  progress({ id: e.id, step: 'install', received: 0, total: 0 })
  const license = `${/^public domain$/i.test(e.copyright) ? 'Public domain' : e.copyright || 'Open license'}. Source: eBible.org`
  return db.insertBible({ id, name: e.name, abbrev: e.abbrev, lang: e.lang, license }, { books, verses })
}
