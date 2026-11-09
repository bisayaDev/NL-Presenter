import { useEffect, useRef, useState } from 'react'
import { ListOrdered, Plus, RotateCcw, TriangleAlert, X } from 'lucide-react'
import type { ServiceItem } from '@shared/types'
import { labelColor } from '@shared/labels'
import { isSongOrder, songOrder, songSections } from '@/lib/arrangement'
import { useApp } from '@/store/useApp'
import { useModal } from '@/lib/modal'
import { t, useT } from '@/i18n'

/** Display name of a section: its label, or "Slide 3" for unlabeled slides. */
const nameOf = (name: string): string => (name.startsWith('#') ? t('presentation.slideN', { n: name.slice(1) }) : name)

/** Slide-grid header button for song items; the dot warns that some arranged sections are gone from the song. */
export function ArrangeButton({ item, open, onToggle }: { item: ServiceItem; open: boolean; onToggle: () => void }) {
  const custom = !!item.arrangement?.length
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

/** The arrangement strip: section chips to drag, repeat (+) and remove (×). Applies to this service item only. */
export default function ArrangeBar({ item }: { item: ServiceItem }) {
  const song = useApp((s) => s.songs.find((x) => x.id === item.sourceId))
  const labelColors = useApp((s) => s.labelColors)
  const setItemArrangement = useApp((s) => s.setItemArrangement)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
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
  const order = item.arrangement?.length ? item.arrangement : songOrder(song.slides)
  const choices = [...new Map(sections.map((s) => [s.name, s])).values()] // each name once, in song order
  const slidesIn = (name: string): number => sections.find((s) => s.name === name)?.slides.length ?? 0

  const apply = (next: string[]): void => setItemArrangement(item.id, next.length && !isSongOrder(song.slides, next) ? next : undefined)
  const remove = (i: number): void => apply(order.filter((_, j) => j !== i))
  const repeat = (i: number): void => apply([...order.slice(0, i + 1), order[i], ...order.slice(i + 1)])
  const drop = (to: number): void => {
    if (dragFrom === null || dragFrom === to) return
    const next = [...order]
    const [moved] = next.splice(dragFrom, 1)
    next.splice(to, 0, moved)
    apply(next)
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line bg-panel px-4 py-2">
      <span className="label-caps mr-1">{t('presentation.order')}</span>
      {order.map((name, i) => {
        const sec = sections.find((s) => s.name === name)
        const color = labelColor(sec?.label, labelColors) ?? 'var(--color-accent)'
        return (
          <div
            key={`${name}-${i}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              setDragFrom(i)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(i)
            }}
            onDragEnd={() => {
              setDragFrom(null)
              setDragOver(null)
            }}
            onDrop={() => {
              drop(i)
              setDragFrom(null)
              setDragOver(null)
            }}
            title={t('presentation.chipHint', { name: nameOf(name), slides: tn('presentation.slideCount', slidesIn(name)) })}
            className={`group flex cursor-grab items-center gap-0.5 rounded-md py-0.5 pl-2 pr-0.5 text-[11.5px] font-semibold uppercase tracking-wide text-white ${
              dragOver === i && dragFrom !== i ? 'ring-2 ring-fg/70' : ''
            } ${dragFrom === i ? 'opacity-40' : ''}`}
            style={{ background: color }}
          >
            <span className="mr-0.5 tabular-nums opacity-60">{i + 1}</span>
            {nameOf(name)}
            <button onClick={() => repeat(i)} title={t('presentation.repeatSection')} className="ml-0.5 rounded p-0.5 opacity-60 hover:bg-black/25 hover:opacity-100">
              <Plus size={11} />
            </button>
            <button
              onClick={() => remove(i)}
              disabled={order.length < 2}
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
          <div className="absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-panel-2 py-1 shadow-2xl">
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
          <button onClick={() => setItemArrangement(item.id, item.arrangement)} className="rounded p-0.5 hover:bg-panel-2" title={t('presentation.dismiss')}>
            <X size={12} />
          </button>
        </span>
      ) : null}
      <button
        onClick={() => setItemArrangement(item.id, undefined)}
        disabled={!item.arrangement?.length}
        className="flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-40"
      >
        <RotateCcw size={12} className="shrink-0" /> {t('presentation.resetOrder')}
      </button>
    </div>
  )
}
