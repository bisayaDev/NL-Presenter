// Speaker notes from a .pptx, in slide order. PDF exports usually leave hidden slides out, so the notes
// are returned for every slide with a hidden flag; the caller lines them up with the exported pages.
import { posix } from 'node:path'
import { readZip, type ZipEntry } from './zip'

export interface PptxSlideNotes {
  hidden: boolean
  notes: string
}

const decode = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')

/** Relationship id → target path, resolved against the part's folder. */
function rels(zip: Map<string, ZipEntry>, part: string): Map<string, { type: string; target: string }> {
  const dir = posix.dirname(part)
  const relPath = posix.join(dir, '_rels', `${posix.basename(part)}.rels`)
  const out = new Map<string, { type: string; target: string }>()
  const xml = zip.get(relPath)?.read().toString('utf8')
  if (!xml) return out
  for (const m of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attr = (n: string): string => new RegExp(`\\b${n}="([^"]*)"`).exec(m[1])?.[1] ?? ''
    const target = attr('Target')
    out.set(attr('Id'), { type: attr('Type'), target: target.startsWith('/') ? target.slice(1) : posix.normalize(posix.join(dir, target)) })
  }
  return out
}

/** Text of the notes placeholder ("body"), one line per paragraph. */
function notesText(xml: string): string {
  for (const sp of xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? []) {
    if (!/<p:ph\b[^>]*type="body"/.test(sp)) continue
    const paras = (sp.match(/<a:p>[\s\S]*?<\/a:p>|<a:p\/>/g) ?? []).map((p) =>
      (p.match(/<a:t>([\s\S]*?)<\/a:t>|<a:t\/>/g) ?? []).map((t) => decode(t.replace(/<\/?a:t\/?>/g, ''))).join('')
    )
    return paras.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }
  return ''
}

export function pptxNotes(file: Buffer): PptxSlideNotes[] {
  const zip = readZip(file)
  const pres = zip.get('ppt/presentation.xml')?.read().toString('utf8')
  if (!pres) return []
  const presRels = rels(zip, 'ppt/presentation.xml')
  const out: PptxSlideNotes[] = []
  for (const m of pres.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)) {
    const slidePath = presRels.get(m[1])?.target
    const slideXml = slidePath ? zip.get(slidePath)?.read().toString('utf8') : undefined
    if (!slidePath || !slideXml) continue
    const hidden = /<p:sld\b[^>]*\bshow="(0|false)"/.test(slideXml)
    const notesRel = [...rels(zip, slidePath).values()].find((r) => r.type.endsWith('/notesSlide'))
    const notesXml = notesRel ? zip.get(notesRel.target)?.read().toString('utf8') : undefined
    out.push({ hidden, notes: notesXml ? notesText(notesXml) : '' })
  }
  return out
}

/** Notes per exported page: exports skip hidden slides unless the page count says otherwise. */
export function notesForPages(slides: PptxSlideNotes[], pages: number): string[] | null {
  const visible = slides.filter((s) => !s.hidden)
  if (visible.length === pages) return visible.map((s) => s.notes)
  if (slides.length === pages) return slides.map((s) => s.notes)
  return null
}
