import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Copy, Image as ImageIcon, Pencil, SquarePlus, Trash2 } from 'lucide-react'
import type { ServiceItem } from '@shared/types'
import { useApp, type SlideOp } from '@/store/useApp'
import { useModal } from '@/lib/modal'
import { isMac } from './CommandPalette'
import { useT } from '@/i18n'

// Slide grid (Presentation tab): right-click a slide for Quick Edit, Insert, Duplicate and Delete. Song slides change
// the library song (so every repeat and every service follows); other items change only this service.

/** Items whose slides the menu can change (not section headers, live sources or Scripture shown from its tab). */
export function canEditSlides(item: ServiceItem | undefined): item is ServiceItem {
  if (!item || item.kind === 'section' || item.kind === 'web' || item.kind === 'camera') return false
  return useApp.getState().service.items.some((i) => i.id === item.id)
}

/** Slides with words to edit (pictures, presentation pages and background slides have none). */
const hasText = (item: ServiceItem, index: number): boolean => item.kind !== 'media' && item.kind !== 'deck' && !item.slides[index]?.cue

const fromLibrary = (item: ServiceItem): boolean => item.kind === 'song' && !!item.sourceId && useApp.getState().songs.some((s) => s.id === item.sourceId)

export default function SlideMenu({
  item,
  index,
  at,
  onClose,
  onQuickEdit,
  onChangeBackground
}: {
  item: ServiceItem
  index: number
  at: { x: number; y: number }
  onClose: () => void
  onQuickEdit: (index: number) => void
  /** Background slides: open the media picker for this slide. */
  onChangeBackground: (index: number) => void
}) {
  const { t } = useT()
  useModal(true, onClose)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(at)
  // Keep the menu on screen near the pointer.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ x: Math.max(8, Math.min(at.x, window.innerWidth - r.width - 8)), y: Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8)) })
  }, [at.x, at.y])
  useEffect(() => {
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const sl = item.slides[index]
  if (!sl) return null
  const cue = !!sl.cue
  const song = fromLibrary(item)
  const run = async (op: SlideOp): Promise<number | null> => {
    onClose()
    return useApp.getState().editSlide(item.id, index, op)
  }
  const insert = async (): Promise<void> => {
    const at = await run({ kind: 'insert' })
    // A new blank slide: straight into Quick Edit (it stays blank if cancelled).
    if (at !== null && item.kind !== 'media' && item.kind !== 'deck') onQuickEdit(at)
  }
  const remove = (): void => {
    const ask = cue
      ? t('presentation.confirmRemoveCue')
      : song
        ? t('presentation.confirmDeleteSongSlide', { n: index + 1, title: item.title })
        : t('presentation.confirmDeleteSlide', { n: index + 1 })
    onClose()
    if (window.confirm(ask)) useApp.getState().editSlide(item.id, index, { kind: 'delete' })
  }
  const lastSlide = !cue && item.slides.filter((x) => !x.cue).length < 2

  return (
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[70] w-56 overflow-hidden rounded-lg border border-line bg-panel-2 py-1 text-[13px] shadow-2xl"
      style={{ left: pos.x, top: pos.y }}
    >
      {song && !cue && <div className="px-3 pb-1 pt-0.5 text-[11px] text-dim">{t('presentation.slideMenu.songNote')}</div>}
      {hasText(item, index) && (
        <Row
          icon={Pencil}
          label={t('presentation.slideMenu.quickEdit')}
          onClick={() => {
            onClose()
            onQuickEdit(index)
          }}
        />
      )}
      {cue && (
        <Row
          icon={ImageIcon}
          label={t('presentation.slideMenu.changeBg')}
          onClick={() => {
            onClose()
            onChangeBackground(index)
          }}
        />
      )}
      {!cue && <Row icon={SquarePlus} label={t('presentation.slideMenu.insert')} onClick={insert} />}
      {!cue && <Row icon={Copy} label={t('presentation.duplicate')} onClick={() => run({ kind: 'duplicate' })} />}
      <div className="my-1 border-t border-line" />
      <Row
        icon={Trash2}
        label={cue ? t('presentation.slideMenu.removeCue') : t('presentation.slideMenu.delete')}
        onClick={remove}
        disabled={lastSlide}
        danger
      />
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger
}: {
  icon: typeof Pencil
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left disabled:opacity-40 ${danger ? 'text-live hover:bg-live/15' : 'hover:bg-panel-3'}`}
    >
      <Icon size={14} className="shrink-0" /> {label}
    </button>
  )
}

/** Quick Edit: the slide's words in a box. Cmd/Ctrl+Enter saves, Esc cancels. */
export function QuickEditDialog({ item, index, onClose }: { item: ServiceItem; index: number; onClose: () => void }) {
  const { t } = useT()
  const sl = item.slides[index]
  const [text, setText] = useState(sl?.text ?? '')
  const [saving, setSaving] = useState(false)
  useModal(true, onClose)
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  if (!sl) return null
  const song = fromLibrary(item)
  const save = async (): Promise<void> => {
    if (text === sl.text) return onClose()
    setSaving(true)
    await useApp.getState().editSlide(item.id, index, { kind: 'text', text })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div aria-modal="true" role="dialog" className="flex w-full max-w-xl flex-col gap-3 rounded-xl border border-line bg-panel p-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold">{t('presentation.quickEdit.title', { n: index + 1 })}</span>
          {sl.label && <span className="rounded bg-panel-2 px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-muted">{sl.label}</span>}
          <span className="min-w-0 flex-1 truncate text-right text-[12px] text-dim">{item.title}</span>
        </div>
        <textarea
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation() // typing here must not trigger slide shortcuts
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              save()
            }
          }}
          rows={8}
          className="w-full resize-y rounded-md bg-panel-2 px-3 py-2.5 text-[14px] leading-relaxed outline-none focus:ring-1 focus:ring-accent/50"
        />
        {song && <p className="text-[12px] text-amber-300">{t('presentation.quickEdit.songNote')}</p>}
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-dim">{t('presentation.quickEdit.saveHint', { key: isMac ? '⌘↩' : 'Ctrl+Enter' })}</span>
          <span className="flex-1" />
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-[13px] text-muted hover:bg-panel-2 hover:text-fg">
            {t('common.cancel')}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-accent-fill px-4 py-1.5 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-50"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
