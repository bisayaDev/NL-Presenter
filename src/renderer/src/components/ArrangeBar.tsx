import { useEffect, useRef, useState } from 'react'
import { BookmarkCheck, ImagePlus, Image as ImageIcon, ListOrdered, Plus, RotateCcw, Save, TriangleAlert, X } from 'lucide-react'
import type { Background, BackgroundCue, MediaItem, ServiceItem } from '@shared/types'
import { labelColor } from '@shared/labels'
import { cueEntry, cueId, isCue, songOrder, songSections, usedCues } from '@/lib/arrangement'
import { backgroundFor, useApp } from '@/store/useApp'
import { uid } from '@/lib/defaults'
import { useModal } from '@/lib/modal'
import MediaThumb from './MediaThumb'
import { t, useT } from '@/i18n'

/** Display name of a section: its label, or "Slide 3" for unlabeled slides. */
const nameOf = (name: string): string => (name.startsWith('#') ? t('presentation.slideN', { n: name.slice(1) }) : name)

/** Slide-grid header button for song items; the dot warns that some arranged sections are gone from the song. */
export function ArrangeButton({ item, open, onToggle }: { item: ServiceItem; open: boolean; onToggle: () => void }) {
  const saved = useApp((s) => !!s.songs.find((x) => x.id === item.sourceId)?.arrangement?.length)
  const custom = !!item.arrangement?.length || saved
  const warn = !!item.arrangementMissing?.length
  const { t } = useT()
  return (
    <button
      onClick={onToggle}
      title={warn ? t('presentation.arrangeMissingHint', { names: item.arrangementMissing!.join(', ') }) : t('presentation.arrangeHint')}
      className={`relative flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] ${
        open || custom ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-panel-2 hover:text-fg'
      }`}
    >
      <ListOrdered size={13} /> <span className="hidden @lg:inline">{custom ? t('presentation.arranged') : t('presentation.arrange')}</span>
      {warn && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-panel" />}
    </button>
  )
}

/** Where the background picker puts its choice: a new background slide at a position, or an existing one. */
type Picking = { insertAt: number } | { change: string } | null

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * The arrangement strip: section chips to drag, repeat (+) and remove (×), and background slides (a picture or video
 * that stays on until the next one). Applies to this service item; "Save to song" keeps it for every later service.
 */
export default function ArrangeBar({ item }: { item: ServiceItem }) {
  const song = useApp((s) => s.songs.find((x) => x.id === item.sourceId))
  const labelColors = useApp((s) => s.labelColors)
  const setItemArrangement = useApp((s) => s.setItemArrangement)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [picking, setPicking] = useState<Picking>(null)
  const [busy, setBusy] = useState(false)
  const { t, tn } = useT()
  useModal(adding, () => setAdding(false))
  const addRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!adding) return
    const close = (e: MouseEvent): void => {
      if (!addRef.current?.contains(e.target as Node)) setAdding(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [adding])

  if (!song) return null
  const sections = songSections(song.slides)
  const own = !!item.arrangement?.length
  const savedOrder = song.arrangement?.length ? song.arrangement : undefined
  // What the item follows when it has no order of its own: the song's saved order, else the song order.
  const baseOrder = savedOrder ?? songOrder(song.slides)
  const baseCues = savedOrder ? song.cues : undefined
  const order = own ? item.arrangement! : baseOrder
  const cues = (own ? item.cues : baseCues) ?? {}
  const choices = [...new Map(sections.map((s) => [s.name, s])).values()] // each name once, in song order
  const slidesIn = (name: string): number => sections.find((s) => s.name === name)?.slides.length ?? 0

  const apply = (next: string[], nextCues: Record<string, BackgroundCue> = cues): void => {
    const kept = usedCues(next, nextCues)
    // Same as what the item would follow anyway: no order of its own.
    const asBase = sameJson(next, baseOrder) && sameJson(kept, usedCues(baseOrder, baseCues))
    setItemArrangement(item.id, next.length && !asBase ? next : undefined, kept)
  }
  const remove = (i: number): void => apply(order.filter((_, j) => j !== i))
  const repeat = (i: number): void => apply([...order.slice(0, i + 1), order[i], ...order.slice(i + 1)])
  const drop = (to: number): void => {
    if (dragFrom === null || dragFrom === to) return
    const next = [...order]
    const [moved] = next.splice(dragFrom, 1)
    next.splice(to, 0, moved)
    apply(next)
  }
  const choose = (bg: Background): void => {
    if (!picking) return
    if ('change' in picking) {
      apply(order, { ...cues, [picking.change]: { ...cues[picking.change], background: bg } })
    } else {
      const id = uid()
      const name = picking.insertAt === 0 ? t('presentation.cue.intro') : t('presentation.cue.name')
      apply([...order.slice(0, picking.insertAt), cueEntry(id), ...order.slice(picking.insertAt)], { ...cues, [id]: { background: bg, name } })
    }
    setPicking(null)
  }
  const saveToSong = async (): Promise<void> => {
    setBusy(true)
    await useApp.getState().saveArrangementToSong(item.id)
    setBusy(false)
  }
  const forgetSaved = async (): Promise<void> => {
    setBusy(true)
    await useApp.getState().clearSongArrangement(song.id)
    setBusy(false)
  }

  const chipEvents = (i: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move'
      setDragFrom(i)
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(i)
    },
    onDragEnd: () => {
      setDragFrom(null)
      setDragOver(null)
    },
    onDrop: () => {
      drop(i)
      setDragFrom(null)
      setDragOver(null)
    }
  })
  const dragRing = (i: number): string => `${dragOver === i && dragFrom !== i ? 'ring-2 ring-fg/70' : ''} ${dragFrom === i ? 'opacity-40' : ''}`

  return (
    <div className="relative flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line bg-panel px-4 py-2">
      <span className="label-caps mr-1">{t('presentation.order')}</span>
      {order.map((name, i) => {
        if (isCue(name)) {
          const id = cueId(name)
          const cue = cues[id]
          if (!cue) return null
          return (
            <div
              key={`${name}-${i}`}
              {...chipEvents(i)}
              title={t('presentation.cue.hint')}
              className={`group flex cursor-grab items-center gap-0.5 rounded-md border border-dashed border-fg/40 bg-panel-3 py-0.5 pl-1.5 pr-0.5 text-[11.5px] font-semibold uppercase tracking-wide text-fg ${dragRing(i)}`}
            >
              <span className="mr-0.5 tabular-nums opacity-60">{i + 1}</span>
              <button onClick={() => setPicking({ change: id })} className="flex items-center gap-1 rounded px-0.5 hover:bg-black/25">
                <ImageIcon size={12} className="shrink-0 text-accent-text" />
                {cue.name || t('presentation.cue.name')}
              </button>
              <button onClick={() => remove(i)} title={t('presentation.removeFromService')} className="rounded p-0.5 opacity-60 hover:bg-black/25 hover:opacity-100">
                <X size={11} />
              </button>
            </div>
          )
        }
        const sec = sections.find((s) => s.name === name)
        const color = labelColor(sec?.label, labelColors) ?? 'var(--color-accent)'
        return (
          <div
            key={`${name}-${i}`}
            {...chipEvents(i)}
            title={t('presentation.chipHint', { name: nameOf(name), slides: tn('presentation.slideCount', slidesIn(name)) })}
            className={`group flex cursor-grab items-center gap-0.5 rounded-md py-0.5 pl-2 pr-0.5 text-[11.5px] font-semibold uppercase tracking-wide text-white ${dragRing(i)}`}
            style={{ background: color }}
          >
            <span className="mr-0.5 tabular-nums opacity-60">{i + 1}</span>
            {nameOf(name)}
            <button onClick={() => setPicking({ insertAt: i })} title={t('presentation.cue.before')} className="ml-0.5 rounded p-0.5 opacity-60 hover:bg-black/25 hover:opacity-100">
              <ImagePlus size={11} />
            </button>
            <button onClick={() => repeat(i)} title={t('presentation.repeatSection')} className="rounded p-0.5 opacity-60 hover:bg-black/25 hover:opacity-100">
              <Plus size={11} />
            </button>
            <button
              onClick={() => remove(i)}
              disabled={order.filter((n) => !isCue(n)).length < 2}
              title={t('presentation.removeFromService')}
              className="rounded p-0.5 opacity-60 hover:bg-black/25 hover:opacity-100 disabled:hidden"
            >
              <X size={11} />
            </button>
          </div>
        )
      })}
      <div ref={addRef} className="relative">
        <button
          onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1 rounded-md border border-dashed border-line px-2 py-0.5 text-[11.5px] text-muted hover:border-accent/50 hover:text-accent-text"
        >
          <Plus size={12} /> {t('common.add')}
        </button>
        {adding && (
          <div className="absolute left-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border border-line bg-panel-2 py-1 shadow-2xl">
            <button
              onClick={() => {
                setAdding(false)
                setPicking({ insertAt: 0 })
              }}
              className="flex w-full items-center gap-2 border-b border-line px-3 py-1.5 text-left text-[12.5px] hover:bg-panel-3"
            >
              <ImagePlus size={13} className="shrink-0 text-accent-text" />
              <span className="truncate">{t('presentation.cue.add')}</span>
            </button>
            {choices.map((s) => (
              <button
                key={s.name}
                onClick={() => {
                  apply([...order, s.name])
                  setAdding(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-panel-3"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: labelColor(s.label, labelColors) ?? 'var(--color-accent)' }} />
                <span className="truncate">{nameOf(s.name)}</span>
                <span className="ml-auto text-[11px] text-dim">{s.slides.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="flex-1" />
      {item.arrangementMissing?.length ? (
        <span className="flex items-center gap-1 text-[11.5px] text-amber-300" title={t('presentation.missingEditedHint')}>
          <TriangleAlert size={12} className="shrink-0" /> {t('presentation.missingSections', { names: item.arrangementMissing.join(', ') })}
          <button onClick={() => setItemArrangement(item.id, item.arrangement, item.cues)} className="rounded p-0.5 hover:bg-panel-2" title={t('presentation.dismiss')}>
            <X size={12} />
          </button>
        </span>
      ) : null}
      {own ? (
        <>
          <button
            onClick={saveToSong}
            disabled={busy}
            title={t('presentation.saveToSongHint')}
            className="flex items-center gap-1 whitespace-nowrap rounded-md bg-accent-fill px-2 py-0.5 text-[12px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-50"
          >
            <Save size={12} className="shrink-0" /> {t('presentation.saveToSong')}
          </button>
          <button
            onClick={() => setItemArrangement(item.id, undefined)}
            className="flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] text-muted hover:bg-panel-2 hover:text-fg"
          >
            <RotateCcw size={12} className="shrink-0" /> {savedOrder ? t('presentation.resetSaved') : t('presentation.resetOrder')}
          </button>
        </>
      ) : savedOrder ? (
        <>
          <span className="flex items-center gap-1 whitespace-nowrap text-[12px] text-accent-text">
            <BookmarkCheck size={12} className="shrink-0" /> {t('presentation.savedOrder')}
          </span>
          <button
            onClick={forgetSaved}
            disabled={busy}
            title={t('presentation.clearSavedHint')}
            className="flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-50"
          >
            <RotateCcw size={12} className="shrink-0" /> {t('presentation.clearSaved')}
          </button>
        </>
      ) : (
        <button disabled className="flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] text-muted opacity-40">
          <RotateCcw size={12} className="shrink-0" /> {t('presentation.resetOrder')}
        </button>
      )}
      {picking && <BackgroundChooser onPick={choose} onClose={() => setPicking(null)} />}
    </div>
  )
}

/** Pictures, videos and loops from the media library, for a background slide (popover under the Arrange bar). */
function BackgroundChooser({ onPick, onClose }: { onPick: (bg: Background) => void; onClose: () => void }) {
  const { t } = useT()
  useModal(true, onClose)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [onClose])
  return (
    <div ref={ref} className="absolute left-4 right-4 top-full z-40 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-line bg-panel-2 p-3 shadow-2xl">
      <div className="mb-2 flex items-center">
        <span className="label-caps">{t('presentation.cue.pick')}</span>
        <span className="flex-1" />
        <button onClick={onClose} className="rounded p-1 text-muted hover:bg-panel-3 hover:text-fg">
          <X size={14} />
        </button>
      </div>
      <MediaBackgroundGrid onPick={onPick} />
    </div>
  )
}

/** The same picker as a dialog (slide grid: right-click a background slide → Change Background). */
export function BackgroundPickerDialog({ current, onPick, onClose }: { current?: Background; onPick: (bg: Background) => void; onClose: () => void }) {
  const { t } = useT()
  useModal(true, onClose)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div aria-modal="true" role="dialog" className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-line bg-panel p-4 shadow-2xl">
        <div className="mb-3 flex items-center">
          <span className="text-[15px] font-semibold">{t('presentation.cue.pick')}</span>
          <span className="flex-1" />
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-panel-2 hover:text-fg">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto">
          <MediaBackgroundGrid onPick={onPick} current={current} />
        </div>
      </div>
    </div>
  )
}

/** The media library's pictures, videos and loops as tiles; `current` is ringed. */
function MediaBackgroundGrid({ onPick, current }: { onPick: (bg: Background) => void; current?: Background }) {
  const media = useApp((s) => s.media)
  const { t } = useT()
  const usable = media.filter((m): m is MediaItem => !m.missing && (m.kind === 'image' || m.kind === 'video' || m.kind === 'loop'))
  const isCurrent = (m: MediaItem): boolean =>
    !!current && (current.kind === 'loop' ? m.kind === 'loop' && current.id === m.id : (current.kind === 'image' || current.kind === 'video') && current.src === m.ref)
  if (!usable.length) return <p className="py-4 text-center text-[12.5px] text-muted">{t('presentation.cue.empty')}</p>
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
      {usable.map((m) => (
        <button
          key={m.id}
          onClick={() => {
            const bg = backgroundFor(m)
            if (bg) onPick(bg)
          }}
          className={`overflow-hidden rounded-md bg-panel-2 text-left ring-2 ${isCurrent(m) ? 'ring-accent' : 'ring-transparent hover:ring-accent/60'}`}
        >
          <div className="relative aspect-video bg-black">
            <MediaThumb m={m} />
          </div>
          <div className="truncate px-2 py-1 text-[11.5px]">{m.name}</div>
        </button>
      ))}
    </div>
  )
}
