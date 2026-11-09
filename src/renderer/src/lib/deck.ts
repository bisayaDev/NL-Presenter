import { create } from 'zustand'
import type { MediaItem } from '@shared/types'
import { useApp } from '@/store/useApp'
import { t } from '@/i18n'

// Import presentations: the main process reads a PDF (or converts PowerPoint / Keynote to one), this file
// draws every page with pdf.js into a JPEG at projector size, and the main process stores the pictures.

/** Pages are drawn to fit this box (1080p projectors and TVs). */
const BOX_W = 1920
const BOX_H = 1080
const MAX_PAGES = 500

export interface DeckJob {
  file: string
  /** Shown as `media.deck.<step>` (translated when drawn). */
  step: 'opening' | 'drawing' | 'saving'
  /** Set while PowerPoint / Keynote / LibreOffice converts the file. */
  app?: string
  page: number
  pages: number
  queued: number // files after this one
}

interface DeckJobState {
  job: DeckJob | null
  errors: { file: string; message: string; noConverter: boolean }[]
  dismiss: () => void
}

export const useDeckJob = create<DeckJobState>()((set) => ({
  job: null,
  errors: [],
  dismiss: () => set({ errors: [] })
}))

type PdfJs = typeof import('pdfjs-dist')
let pdfjs: Promise<PdfJs> | null = null
const lib = (): Promise<PdfJs> =>
  (pdfjs ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([m, worker]) => {
    m.GlobalWorkerOptions.workerSrc = worker.default
    return m
  }))

const baseName = (p: string): string => p.split(/[/\\]/).pop() ?? p

/** Draw every page of a PDF. */
export async function renderPdf(
  data: Uint8Array,
  onPage?: (page: number, pages: number) => void
): Promise<{ pages: Uint8Array[]; width: number; height: number }> {
  const { getDocument } = await lib()
  // Fonts, character maps (Asian scripts) and image decoders ship with the app (see electron.vite.config.ts).
  const assets = new URL('pdfjs/', document.baseURI).toString()
  const doc = await getDocument({
    data,
    cMapUrl: `${assets}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`,
    wasmUrl: `${assets}wasm/`,
    iccUrl: `${assets}iccs/`
  }).promise
  try {
    const count = Math.min(doc.numPages, MAX_PAGES)
    const pages: Uint8Array[] = []
    let width = 0
    let height = 0
    const canvas = document.createElement('canvas')
    for (let n = 1; n <= count; n++) {
      onPage?.(n, count)
      const page = await doc.getPage(n)
      const one = page.getViewport({ scale: 1 })
      const vp = page.getViewport({ scale: Math.min(BOX_W / one.width, BOX_H / one.height) })
      canvas.width = Math.round(vp.width)
      canvas.height = Math.round(vp.height)
      if (n === 1) [width, height] = [canvas.width, canvas.height]
      await page.render({ canvas, viewport: vp, background: '#ffffff' }).promise
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
      if (!blob) throw new Error(t('media.deck.drawFailed', { n }))
      pages.push(new Uint8Array(await blob.arrayBuffer()))
      page.cleanup()
    }
    return { pages, width, height }
  } finally {
    await doc.destroy()
  }
}

/**
 * Import presentation files (no paths: ask with a file picker). Adds them to the media library and
 * returns them; problems are collected in useDeckJob().errors.
 */
export async function importDecks(paths?: string[]): Promise<MediaItem[]> {
  const files = paths ?? (await window.nl.deck.pick())
  const added: MediaItem[] = []
  const set = useDeckJob.setState
  for (const [i, path] of files.entries()) {
    const file = baseName(path)
    const queued = files.length - i - 1
    set({ job: { file, step: 'opening', page: 0, pages: 0, queued } })
    const off = window.nl.deck.onStep((app) => set((s) => (s.job ? { job: { ...s.job, app } } : {})))
    try {
      const r = await window.nl.deck.load(path)
      off()
      if ('error' in r) {
        set((s) => ({ errors: [...s.errors, { file, message: r.error, noConverter: r.code === 'no-converter' }] }))
        continue
      }
      const { pages, width, height } = await renderPdf(r.ok.pdf, (page, total) =>
        set({ job: { file, step: 'drawing', page, pages: total, queued } })
      )
      set({ job: { file, step: 'saving', page: pages.length, pages: pages.length, queued } })
      const item = await window.nl.deck.save({ name: r.ok.name, source: r.ok.source, width, height, pages, notes: r.ok.notes })
      added.push(item)
      useApp.setState((s) => ({ media: [item, ...s.media] }))
    } catch (e) {
      off()
      const msg = (e as Error).message || String(e)
      set((s) => ({
        errors: [
          ...s.errors,
          {
            file,
            message: /password/i.test(msg) ? t('media.deck.password') : /Invalid PDF/i.test(msg) ? t('media.deck.damaged') : msg,
            noConverter: false
          }
        ]
      }))
    }
  }
  set({ job: null })
  return added
}
