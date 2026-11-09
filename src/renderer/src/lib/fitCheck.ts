// "Text too small": how far the projector would shrink a slide's text to make it fit.
// The real SlideText component is drawn once, offscreen, at the projector's size (same shrink-to-fit code as the
// audience screen), and the font size it settles on is compared with the look's font size.
import { createElement, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { AspectRatio, LanguageMode, ServiceItem, Slide, TextStyle } from '@shared/types'
import { itemLook, useApp } from '@/store/useApp'
import { stripChords } from '@shared/chords'
import { languageText, hasSecondLanguage } from '@shared/bilingual'
import { STAGE, SlideText } from '@/components/SlideView'
import { uid } from './defaults'

/** Below this share of the look's font size, a slide is flagged. */
export const SMALL_TEXT = 0.6

let host: HTMLDivElement | null = null
let root: Root | null = null
const cache = new Map<string, number>()

function mount(w: number, h: number): Root {
  if (!host) {
    host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    Object.assign(host.style, { position: 'fixed', left: '-30000px', top: '0', visibility: 'hidden', pointerEvents: 'none', overflow: 'hidden' })
    document.body.appendChild(host)
  }
  host.style.width = `${w}px`
  host.style.height = `${h}px`
  root ??= createRoot(host)
  return root
}

/**
 * The font size the projector would use for this slide, as a share of the look's font size (1 = full size).
 * 0 when the text does not fit even at the smallest size. Must not be called during a React render.
 */
export function measureScale(slide: Slide, style: TextStyle, aspect: AspectRatio, mode?: LanguageMode): number {
  const text = languageText(stripChords(slide.text), mode)
  if (!text.trim() && !slide.heading?.trim()) return 1
  const key = JSON.stringify([text, slide.heading ?? '', slide.reference ?? '', slide.parallel ?? null, slide.parallelLayout ?? '', style, aspect])
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const { w, h } = STAGE[aspect]
  const r = mount(w, h)
  flushSync(() => r.render(createElement(SlideText, { slide: { ...slide, text }, style, w, h, visible: true, animate: false })))
  const el = host!.querySelector<HTMLElement>('[data-scale]')
  const px = el ? parseFloat(el.style.fontSize) : style.fontSize
  const scale = !el ? 1 : el.dataset.overflow === 'true' ? 0 : px / style.fontSize
  if (cache.size > 2000) cache.clear()
  cache.set(key, scale)
  return scale
}

/** Ids of slides whose text the projector would shrink below SMALL_TEXT (recomputed shortly after changes). */
export function useSmallSlides(slides: Slide[] | undefined, style: TextStyle, aspect: AspectRatio, mode?: LanguageMode): Set<string> {
  const [small, setSmall] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    if (!slides?.length) return setSmall((p) => (p.size ? new Set() : p))
    let dead = false
    const t = setTimeout(() => {
      void document.fonts.ready.then(() => {
        if (dead) return
        const next = new Set(slides.filter((sl) => measureScale(sl, style, aspect, mode) < SMALL_TEXT).map((sl) => sl.id))
        setSmall((p) => (p.size === next.size && [...next].every((id) => p.has(id)) ? p : next))
      })
    }, 200)
    return () => {
      dead = true
      clearTimeout(t)
    }
  }, [slides, style, aspect, mode])
  return small
}

export interface SmallText {
  item: ServiceItem
  slide: Slide
  index: number
  /** Can be split in two with one click (a text item, or a song still in the library). */
  canSplit: boolean
}

/** Every slide in the service whose text the projector would shrink below SMALL_TEXT (Sunday check). */
export async function findSmallText(): Promise<SmallText[]> {
  await document.fonts.ready
  const s = useApp.getState()
  const out: SmallText[] = []
  for (const item of s.service.items) {
    if (!['song', 'text', 'scripture', 'blank'].includes(item.kind)) continue
    const { style } = itemLook(s, item)
    item.slides.forEach((slide, index) => {
      if (measureScale(slide, style, s.aspect, item.languageMode) >= SMALL_TEXT) return
      const song = item.kind === 'song' && item.sourceId ? s.songs.find((x) => x.id === item.sourceId) : undefined
      out.push({ item, slide, index, canSplit: !!splitSlide(slide) && (item.kind === 'text' || !!song) })
    })
  }
  return out
}

/** Split a flagged slide in two: in the service item (text slides) or in the library song (all services follow). */
export async function splitSmallText(t: SmallText): Promise<void> {
  const parts = splitSlide(t.slide)
  if (!parts) return
  const s = useApp.getState()
  if (t.item.kind === 'text') {
    const item = s.service.items.find((i) => i.id === t.item.id)
    if (item) s.setItemSlides(item.id, item.title, item.slides.flatMap((x) => (x.id === t.slide.id ? parts : [x])))
    return
  }
  const song = s.songs.find((x) => x.id === t.item.sourceId)
  if (!song) return
  const id = t.slide.id.replace(/~\d+$/, '') // repeated sections in an arrangement get "~2" ids
  const src = song.slides.find((x) => x.id === id)
  const split = src && splitSlide(src)
  if (!split) return
  await s.saveSong({ ...song, slides: song.slides.flatMap((x) => (x.id === id ? split : [x])) })
}

/** Split a slide's lines into two slides of about equal length (null when it can't be split simply). */
export function splitSlide(sl: Slide): [Slide, Slide] | null {
  if (hasSecondLanguage(sl.text)) return null
  const lines = sl.text.split('\n')
  if (lines.length < 2) return null
  const half = Math.ceil(lines.length / 2)
  return [
    { ...sl, text: lines.slice(0, half).join('\n') },
    { ...sl, id: uid(), notes: undefined, text: lines.slice(half).join('\n') }
  ]
}
