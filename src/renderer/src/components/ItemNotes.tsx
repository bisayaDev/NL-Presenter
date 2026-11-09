import { useEffect, useRef, useState } from 'react'
import { NotebookPen } from 'lucide-react'
import type { ServiceItem } from '@shared/types'
import { useApp } from '@/store/useApp'
import { useModal } from '@/lib/modal'
import { useT } from '@/i18n'

/** Team notes for a service item (printed on the run sheet, never shown on screens). */
export function setItemNotes(itemId: string, notes: string): void {
  const text = notes.trim() ? notes : undefined
  useApp.setState((s) => ({
    service: { ...s.service, items: s.service.items.map((it) => (it.id === itemId ? { ...it, notes: text } : it)) }
  }))
}

/** Slide-grid header button: a note icon that opens a small text box for the selected item's notes. */
export default function ItemNotesButton({ item }: { item: ServiceItem }) {
  const [open, setOpen] = useState(false)
  useModal(open)
  const [draft, setDraft] = useState(item.notes ?? '')
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useT()

  useEffect(() => {
    if (!open) setDraft(item.notes ?? '')
  }, [item.id, item.notes, open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  // Save as you type (debounced by the service autosave).
  const change = (v: string): void => {
    setDraft(v)
    setItemNotes(item.id, v)
  }

  const has = !!item.notes?.trim()
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={has ? t('presentation.teamNotesHint', { notes: item.notes! }) : t('presentation.teamNotesEmptyHint')}
        className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] ${
          has ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-panel-2 hover:text-fg'
        }`}
      >
        <NotebookPen size={13} /> {t('presentation.notes')}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1.5 w-80 rounded-lg border border-line bg-panel-2 p-3 shadow-2xl"
          onKeyDown={(e) => {
            e.stopPropagation() // typing here must not trigger slide shortcuts
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          <div className="label-caps mb-1.5">{t('presentation.notesForTeam')}</div>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => change(e.target.value)}
            rows={5}
            placeholder={t('presentation.notesPlaceholder')}
            className="w-full resize-y rounded-md bg-panel-3 px-2.5 py-2 text-[12.5px] leading-snug outline-none placeholder:text-dim focus:ring-1 focus:ring-accent/50"
          />
          <p className="mt-1.5 text-[11px] text-dim">{t('presentation.notesPrinted')}</p>
        </div>
      )}
    </div>
  )
}
