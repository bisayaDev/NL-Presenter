import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronDown, ClipboardCheck, Copy, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import type { ServiceSummary } from '@shared/types'
import { useApp } from '@/store/useApp'
import { useModal } from '@/lib/modal'
import { today } from '@/lib/serviceDates'
import { formatDay, t, useT } from '@/i18n'
import PrintDialog from './PrintDialog'
import { openSundayCheck, SundayCheckHost } from './PreflightDialog'

/** Ask before anything that clears the screen. Returns false when the operator says no. */
function okToLeave(): boolean {
  const s = useApp.getState()
  if (!s.live) return true
  return window.confirm(t('service.confirmLeave'))
}

/** Top-bar service menu: the service library (open, new, copy for next week, rename, date, delete, print). */
export default function ServiceMenu() {
  const service = useApp((s) => s.service)
  const rehearsing = useApp((s) => !!s.rehearsal)
  const [open, setOpen] = useState(false)
  const { tn } = useT()
  useModal(open, () => setOpen(false))
  const [list, setList] = useState<ServiceSummary[]>([])
  const [mode, setMode] = useState<'list' | 'rename' | 'date'>('list')
  const [draft, setDraft] = useState('')
  const [printing, setPrinting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const refresh = (): void => {
    window.nl.data.listServices().then(setList)
  }

  useEffect(() => {
    if (!open) return
    refresh()
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const toggle = (): void => {
    setMode('list')
    setOpen((o) => !o)
  }

  const run = async (fn: () => Promise<boolean>, leaves = true): Promise<void> => {
    if (leaves && !okToLeave()) return
    await fn()
    setMode('list')
    setOpen(false)
  }

  const s = useApp.getState()
  const blocked = rehearsing ? t('service.endRehearsalFirst') : undefined

  return (
    <div ref={ref} className="no-drag relative">
      <button
        onClick={toggle}
        title={t('service.menuHint')}
        className={`flex max-w-[360px] items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] text-fg/90 ${open ? 'bg-panel-3' : 'bg-panel-2 hover:bg-panel-3'}`}
      >
        <span className="truncate">{service.name}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-[340px] overflow-hidden rounded-lg border border-line bg-panel-2 shadow-2xl">
          {mode === 'rename' && (
            <form
              className="flex items-center gap-2 p-3"
              onSubmit={(e) => {
                e.preventDefault()
                s.renameService(draft)
                setMode('list')
              }}
            >
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setMode('list')}
                className="h-8 flex-1 rounded-md bg-panel-3 px-2.5 text-[13px] outline-none ring-accent/50 focus:ring-1"
              />
              <button type="submit" className="rounded-md bg-accent-fill px-3 py-1.5 text-[12.5px] font-semibold text-on-accent hover:brightness-110">
                {t('common.save')}
              </button>
            </form>
          )}

          {mode === 'date' && (
            <form
              className="flex items-center gap-2 p-3"
              onSubmit={(e) => {
                e.preventDefault()
                s.setServiceDate(draft || undefined)
                setMode('list')
              }}
            >
              <input
                autoFocus
                type="date"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setMode('list')}
                className="h-8 flex-1 rounded-md bg-panel-3 px-2.5 text-[13px] outline-none ring-accent/50 [color-scheme:dark] focus:ring-1"
              />
              {service.date && (
                <button
                  type="button"
                  onClick={() => {
                    s.setServiceDate(undefined)
                    setMode('list')
                  }}
                  className="rounded-md px-2 py-1.5 text-[12.5px] text-muted hover:text-fg"
                >
                  {t('service.noDate')}
                </button>
              )}
              <button type="submit" className="rounded-md bg-accent-fill px-3 py-1.5 text-[12.5px] font-semibold text-on-accent hover:brightness-110">
                {t('common.save')}
              </button>
            </form>
          )}

          {mode === 'list' && (
            <>
              <div className="label-caps px-3 pb-1 pt-2.5">{t('service.services')}</div>
              <div className="max-h-[320px] overflow-y-auto pb-1">
                {list.map((x) => {
                  const current = x.id === service.id
                  const name = current ? service.name : x.name
                  const date = current ? service.date : x.date
                  return (
                    <button
                      key={x.id}
                      disabled={!current && rehearsing}
                      title={!current ? blocked : undefined}
                      onClick={() => (current ? setOpen(false) : run(() => s.openService(x.id)))}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] disabled:opacity-50 ${
                        current ? 'bg-accent-soft text-accent-text' : 'hover:bg-panel-3'
                      }`}
                    >
                      <span className="w-3.5 shrink-0">{current && <Check size={13} />}</span>
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <span className={`shrink-0 text-[11px] tabular-nums ${current ? 'text-accent-text/80' : 'text-muted'}`}>
                        {date ? formatDay(date) : t('service.noDate')}
                        {date && date < today() ? ` · ${t('service.past')}` : ''} ·{' '}
                        {tn('service.itemCount', current ? service.items.filter((i) => i.kind !== 'section').length : x.count)}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="border-t border-line py-1">
                <Action icon={Plus} label={t('service.new')} disabled={rehearsing} title={blocked} onClick={() => run(s.newService)} />
                <Action icon={Copy} label={t('service.copyNextWeek')} disabled={rehearsing} title={blocked ?? t('service.copyNextWeekHint')} onClick={() => run(s.duplicateService)} />
              </div>
              <div className="border-t border-line py-1">
                <Action
                  icon={Pencil}
                  label={t('service.rename')}
                  onClick={() => {
                    setDraft(service.name)
                    setMode('rename')
                  }}
                />
                <Action
                  icon={CalendarDays}
                  label={service.date ? t('service.dateIs', { date: formatDay(service.date) }) : t('service.setDate')}
                  onClick={() => {
                    setDraft(service.date ?? '')
                    setMode('date')
                  }}
                />
                <Action
                  icon={ClipboardCheck}
                  label={t('service.sundayCheck')}
                  title={t('service.sundayCheckHint')}
                  onClick={() => {
                    setOpen(false)
                    openSundayCheck()
                  }}
                />
                <Action
                  icon={Printer}
                  label={t('service.print')}
                  onClick={() => {
                    setOpen(false)
                    setPrinting(true)
                  }}
                />
                <Action
                  icon={Trash2}
                  label={t('service.delete')}
                  danger
                  disabled={rehearsing}
                  title={blocked}
                  onClick={async () => {
                    if (!window.confirm(t('service.confirmDelete', { name: service.name }))) return
                    await run(() => s.deleteService(service.id))
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}
      {printing && <PrintDialog onClose={() => setPrinting(false)} />}
      <SundayCheckHost />
    </div>
  )
}

function Action({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
  danger
}: {
  icon: typeof Plus
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] disabled:opacity-50 disabled:hover:bg-transparent ${
        danger ? 'text-muted hover:bg-live/15 hover:text-live' : 'hover:bg-panel-3'
      }`}
    >
      <Icon size={14} className={danger ? '' : 'text-accent-text'} /> {label}
    </button>
  )
}
