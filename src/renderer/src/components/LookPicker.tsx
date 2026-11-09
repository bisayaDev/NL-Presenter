import { useEffect, useRef, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import type { Template } from '@shared/types'
import SlideView from './SlideView'
import { allTemplates, useApp } from '@/store/useApp'
import { useModal } from '@/lib/modal'
import { useT } from '@/i18n'

/** Shows how a look draws a line of text. */
export function LookSwatch({ t, className, scripture }: { t: Template | null; className?: string; scripture?: boolean }) {
  // No look: the default style, which for Scripture is its own (when set).
  const style = useApp((s) => (scripture && s.scriptureStyle) || s.style)
  const background = useApp((s) => s.background)
  return (
    <SlideView
      slide={{ id: 'look', text: 'Amazing grace\nhow sweet the sound' }}
      style={t ? t.style : style}
      background={t?.background ?? background}
      aspect="16:9"
      thumbnail
      className={`aspect-video ${className ?? ''}`}
    />
  )
}

/**
 * Pick a look (template) or "Default" (the global text style). Used in the slide grid header (per service item)
 * and in the song editor (per song).
 */
export default function LookPicker({
  value,
  onChange,
  defaultLabel: defaultLabelProp,
  compact,
  scripture
}: {
  value: string | undefined
  onChange: (id: string | undefined) => void
  defaultLabel?: string
  /** The small header button ("Look"). */
  compact?: boolean
  /** A Scripture item: "Default" means Scripture's text style. */
  scripture?: boolean
}) {
  const templates = useApp((s) => s.templates)
  const { t: tr } = useT()
  const defaultLabel = defaultLabelProp ?? tr(scripture ? 'presentation.scriptureTextStyle' : 'presentation.defaultTextStyle')
  const list = allTemplates({ templates })
  const current = list.find((t) => t.id === value)
  const [open, setOpen] = useState(false)
  useModal(open, () => setOpen(false))
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  const pick = (id: string | undefined): void => {
    onChange(id)
    setOpen(false)
  }
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={tr('presentation.lookHint')}
        className={
          compact
            ? `flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] ${current ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-panel-2 hover:text-fg'}`
            : 'flex h-7 items-center gap-1.5 rounded bg-panel-2 px-2 text-[12.5px] text-fg hover:bg-panel-3'
        }
      >
        <Palette size={13} />
        {/* Compact (slide-grid toolbar): the name shows when the toolbar has room (container query). */}
        <span className={compact ? 'hidden max-w-[110px] truncate @xl:inline' : ''}>{compact ? (current?.name ?? tr('presentation.look')) : (current?.name ?? defaultLabel)}</span>
      </button>
      {open && (
        <div
          className={`absolute left-0 top-full z-30 mt-1.5 max-h-[60vh] w-64 overflow-y-auto rounded-lg border border-line bg-panel-2 p-2 shadow-2xl`}
        >
          <div className="label-caps mb-1.5 px-1">{tr('presentation.look')}</div>
          <Row active={!current} label={defaultLabel} onClick={() => pick(undefined)} t={null} scripture={scripture} />
          {list.map((t) => (
            <Row key={t.id} active={current?.id === t.id} label={t.name} sub={t.builtin ? tr('presentation.builtIn') : undefined} onClick={() => pick(t.id)} t={t} />
          ))}
          <p className="mt-1.5 px-1 text-[11px] leading-snug text-dim">{tr('presentation.saveLooksHint')}</p>
        </div>
      )}
    </div>
  )
}

function Row({
  active,
  label,
  sub,
  onClick,
  t,
  scripture
}: {
  active: boolean
  label: string
  sub?: string
  onClick: () => void
  t: Template | null
  scripture?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md p-1 text-left text-[12.5px] ${active ? 'bg-accent-soft text-fg' : 'text-muted hover:bg-panel-3 hover:text-fg'}`}
    >
      <LookSwatch t={t} scripture={scripture} className="w-16 shrink-0 rounded" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {sub && <span className="text-[10.5px] text-dim">{sub}</span>}
      </span>
      {active && <Check size={13} className="shrink-0 text-accent-text" />}
    </button>
  )
}
