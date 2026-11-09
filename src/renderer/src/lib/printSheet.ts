// Print sheets for a service: run sheet, lyrics, chord charts. Builds one self-contained HTML page
// (no scripts, no external files) that main/print.ts turns into a PDF or sends to a printer.
import type { Service, ServiceItem, Song } from '@shared/types'
import {
  type ChordNotation,
  hasChords,
  isChordOnlyLine,
  renderChord,
  splitLine,
  stripChords,
  transposeKey
} from '@shared/chords'
import { plainLanguages } from '@shared/bilingual'
import { formatDay, getLang, t, tn, type StringKey } from '@/i18n'

// Fixed labels are translated when the page is built (the operator's language); item titles, lyrics, notes and
// the church name are content and print as they are.

export type PrintKind = 'runsheet' | 'lyrics' | 'chords'

export interface PrintOptions {
  kind: PrintKind
  notation: ChordNotation
  /** Shown above the service name when set. */
  churchName?: string
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const KIND_LABEL: Partial<Record<ServiceItem['kind'], StringKey>> = {
  media: 'service.sheet.kind.media',
  song: 'service.sheet.kind.song',
  scripture: 'service.sheet.kind.scripture',
  blank: 'service.sheet.kind.blank',
  web: 'service.sheet.kind.web',
  camera: 'service.sheet.kind.camera',
  deck: 'service.sheet.kind.deck',
  section: 'service.sheet.kind.section',
  text: 'service.sheet.kind.text'
}
const kindLabel = (kind: ServiceItem['kind']): string => {
  const key = KIND_LABEL[kind]
  return key ? t(key) : ''
}

/** Text slides (announcements, sermon points) as plain text: title line, then the body. */
const textSlidesHtml = (it: ServiceItem): string =>
  it.slides
    .map((sl) => {
      const head = sl.heading?.trim()
      const body = sl.text.trim()
      if (!head && !body) return ''
      return `<div class="tslide">${head ? `<b>${esc(head)}</b>` : ''}${head && body ? '\n' : ''}${esc(body)}</div>`
    })
    .join('')

/** Key the band plays in tonight (song key moved by the live transpose). */
export const playedKey = (item: ServiceItem): string | undefined => transposeKey(item.key, item.transpose ?? 0)

const CSS = `
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; }
  html, body { background: #fff; color: #000; }
  body { font: 11pt/1.4 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; margin: 0; }
  header.sheet { border-bottom: 1.5pt solid #000; padding-bottom: 6pt; margin-bottom: 12pt; }
  header.sheet .church { font-size: 9pt; letter-spacing: .12em; text-transform: uppercase; color: #444; }
  header.sheet h1 { font-size: 18pt; margin: 2pt 0 0; }
  header.sheet .date { font-size: 11pt; color: #333; margin-top: 2pt; }
  header.sheet .what { float: right; font-size: 9pt; color: #555; margin-top: 4pt; }
  table.run { width: 100%; border-collapse: collapse; }
  table.run th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .08em; color: #555;
    border-bottom: 1pt solid #000; padding: 3pt 6pt; }
  table.run td { padding: 5pt 6pt; border-bottom: .5pt solid #bbb; vertical-align: top; }
  table.run td.n { width: 22pt; text-align: right; color: #555; font-variant-numeric: tabular-nums; }
  table.run td.k, table.run td.c { width: 52pt; white-space: nowrap; font-variant-numeric: tabular-nums; }
  table.run td.t .kind { color: #666; font-size: 9pt; margin-left: 4pt; }
  table.run td.t .notes { color: #333; font-size: 9.5pt; margin-top: 2pt; white-space: pre-wrap; }
  table.run tr.section td { border-bottom: 1pt solid #000; padding-top: 12pt; font-weight: 700; font-size: 10pt;
    text-transform: uppercase; letter-spacing: .06em; }
  table.run tr { break-inside: avoid; }
  table.run td.t .tslides { font-size: 9.5pt; color: #222; margin-top: 3pt; }
  table.run td.t .tslide { white-space: pre-wrap; margin-top: 3pt; padding-left: 6pt; border-left: 1.5pt solid #bbb; }
  .item { margin-top: 16pt; break-inside: avoid-page; }
  .item h2 { font-size: 14pt; margin: 0 0 2pt; }
  .item .meta { font-size: 9.5pt; color: #444; margin-bottom: 6pt; }
  h2.section { font-size: 10pt; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1pt solid #000;
    margin: 20pt 0 0; padding-bottom: 2pt; }
  .slide { margin: 0 0 8pt; break-inside: avoid; }
  .slide .label { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #333; }
  .slide .ref { font-size: 9pt; color: #555; }
  .lyrics { white-space: pre-wrap; }
  .page { break-before: page; }
  .chart h2 { font-size: 16pt; margin: 0; }
  .chart .meta { font-size: 10pt; color: #333; margin: 2pt 0 10pt; }
  .chart .meta b { font-size: 11pt; }
  .chart .slide { margin-bottom: 10pt; }
  .cl { white-space: pre-wrap; line-height: 1.15; margin: 0 0 3pt; }
  .seg { display: inline-block; vertical-align: bottom; }
  .seg .ch { display: block; font-weight: 700; font-size: 10pt; min-height: 1.2em; padding-right: 4pt; }
  .seg .w { display: block; }
  .inst { font-weight: 700; font-size: 10pt; white-space: pre-wrap; margin: 0 0 3pt; }
  .empty { color: #666; font-style: italic; }
`

function header(service: Service, opts: PrintOptions, what: string): string {
  return `<header class="sheet">
    <div class="what">${esc(what)}</div>
    ${opts.churchName ? `<div class="church">${esc(opts.churchName)}</div>` : ''}
    <h1>${esc(service.name)}</h1>
    ${service.date ? `<div class="date">${esc(formatDay(service.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div>` : ''}
  </header>`
}

function runSheet(service: Service): string {
  let n = 0
  const rows = service.items
    .map((it) => {
      if (it.kind === 'section') return `<tr class="section"><td colspan="4">${esc(it.title)}</td></tr>`
      n++
      const key = it.kind === 'song' ? playedKey(it) : undefined
      const count = it.slides.length
      return `<tr>
        <td class="n">${n}</td>
        <td class="t">${esc(it.title)}<span class="kind">${esc(kindLabel(it.kind))}</span>${
          it.notes?.trim() ? `<div class="notes">${esc(it.notes.trim())}</div>` : ''
        }${it.kind === 'text' ? `<div class="tslides">${textSlidesHtml(it)}</div>` : ''}</td>
        <td class="k">${key ? esc(key) : ''}</td>
        <td class="c">${esc(tn('service.sheet.slideCount', count))}</td>
      </tr>`
    })
    .join('')
  return service.items.length
    ? `<table class="run"><thead><tr><th></th><th>${esc(t('service.sheet.item'))}</th><th>${esc(t('service.sheet.key'))}</th><th>${esc(
        t('service.sheet.slides')
      )}</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<p class="empty">${esc(t('service.sheet.noItems'))}</p>`
}

/** A slide's label, left out when it repeats the previous slide's (a verse split over two slides). */
const labelHtml = (it: ServiceItem, i: number): string => {
  const label = it.slides[i].label
  return label && label !== it.slides[i - 1]?.label ? `<div class="label">${esc(label)}</div>` : ''
}

function lyricsOf(it: ServiceItem): string {
  const slides = it.slides
    .map((sl, i) => {
      const text = plainLanguages(stripChords(sl.text)).trim()
      if (!text && !sl.label) return ''
      return `<div class="slide">${labelHtml(it, i)}<div class="lyrics">${esc(text)}</div>${
        sl.reference ? `<div class="ref">${esc(sl.reference)}</div>` : ''
      }</div>`
    })
    .join('')
  return slides
}

function lyricsSheet(service: Service, songs: Song[]): string {
  const out: string[] = []
  for (const it of service.items) {
    if (it.kind === 'section') {
      out.push(`<h2 class="section">${esc(it.title)}</h2>`)
      continue
    }
    if (it.kind !== 'song' && it.kind !== 'scripture') continue
    const body = lyricsOf(it)
    if (!body) continue
    const author = it.kind === 'song' ? songs.find((s) => s.id === it.sourceId)?.author : undefined
    out.push(`<div class="item"><h2>${esc(it.title)}</h2>${author ? `<div class="meta">${esc(author)}</div>` : ''}${body}</div>`)
  }
  return out.join('')
}

/** One line with chords written above the words. */
function chordLine(line: string, item: ServiceItem, notation: ChordNotation): string {
  const chord = (c: string): string => renderChord(c, { key: item.key, semis: item.transpose ?? 0, notation })
  if (isChordOnlyLine(line)) {
    const text = splitLine(line)
      .map((s) => (s.chord ? chord(s.chord) + ' ' : '') + s.text)
      .join('')
      .replace(/ {2,}/g, '  ')
      .trim()
    return `<div class="inst">${esc(text)}</div>`
  }
  const segs = splitLine(line)
  if (!segs.some((s) => s.chord)) return `<div class="cl">${esc(line) || '&nbsp;'}</div>`
  return `<div class="cl">${segs
    .map((s) => `<span class="seg"><span class="ch">${s.chord ? esc(chord(s.chord)) : ''}</span><span class="w">${esc(s.text) || '&nbsp;'}</span></span>`)
    .join('')}</div>`
}

function chordCharts(service: Service, songs: Song[], notation: ChordNotation): string {
  const out: string[] = []
  for (const it of service.items) {
    if (it.kind !== 'song') continue
    const song = songs.find((s) => s.id === it.sourceId)
    const key = playedKey(it)
    const withChords = it.slides.some((sl) => hasChords(sl.text))
    const meta = [
      song?.author ? esc(song.author) : '',
      key
        ? esc(t('service.sheet.keyIs', { key: '\u0000' })).replace('\u0000', `<b>${esc(key)}</b>`) +
          (it.transpose && it.key ? ` ${esc(t('service.sheet.writtenIn', { key: it.key }))}` : '')
        : '',
      withChords && notation === 'nashville' ? esc(t('service.sheet.nashville')) : ''
    ]
      .filter(Boolean)
      .join(' · ')
    const body = withChords
      ? it.slides
          .map(
            (sl, i) =>
              `<div class="slide">${labelHtml(it, i)}${sl.text
                .split('\n')
                // The "--" line between two languages prints as a gap.
                .map((l) => (/^\s*--\s*$/.test(l) ? '<div class="cl">&nbsp;</div>' : chordLine(l, it, notation)))
                .join('')}</div>`
          )
          .join('')
      : lyricsOf(it)
    out.push(`<div class="page chart"><h2>${esc(it.title)}</h2>${meta ? `<div class="meta">${meta}</div>` : ''}${body}</div>`)
  }
  return out.length ? out.join('') : `<p class="empty page">${esc(t('service.sheet.noSongs'))}</p>`
}

/** Title of each kind of sheet (also the labels in the print dialog). */
export const KIND_TITLE: Record<PrintKind, StringKey> = { runsheet: 'service.pd.runsheet', lyrics: 'service.pd.lyrics', chords: 'service.pd.chords' }

/** The whole print page, with its labels in the current language. */
export function buildPrintHtml(service: Service, songs: Song[], opts: PrintOptions): string {
  const what = t(KIND_TITLE[opts.kind])
  let body = header(service, opts, what) + runSheet(service)
  if (opts.kind === 'lyrics') body += lyricsSheet(service, songs)
  if (opts.kind === 'chords') body += chordCharts(service, songs, opts.notation)
  return `<!doctype html><html lang="${getLang()}"><head><meta charset="utf-8"><title>${esc(`${service.name} – ${what}`)}</title><style>${CSS}</style></head><body>${body}</body></html>`
}

export const printFileName = (service: Service, kind: PrintKind): string => `${service.name} – ${t(KIND_TITLE[kind])}`

// Dev aid for snapshot tests: build a sheet from the console.
if (import.meta.env.DEV) (window as unknown as { __print: unknown }).__print = { buildPrintHtml, printFileName }
