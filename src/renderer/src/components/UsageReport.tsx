import { useEffect, useState } from 'react'
import { BarChart3, Download, X } from 'lucide-react'
import type { SongUsage } from '@shared/types'
import { isoDay, today } from '@/lib/serviceDates'
import { useModal } from '@/lib/modal'
import { formatDay, useT } from '@/i18n'

type Range = 3 | 6 | 12 | 'custom'

const monthsAgo = (n: number): string => {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return isoDay(d)
}

const csvCell = (v: string | number): string => {
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Song usage between two dates (for licence reporting): title, author, times used, last used. */
export default function UsageReport({ onClose }: { onClose: () => void }) {
  useModal(true, onClose)
  const { t, tn } = useT()
  const [range, setRange] = useState<Range>(3)
  const [from, setFrom] = useState(monthsAgo(3))
  const [to, setTo] = useState(today())
  const [rows, setRows] = useState<SongUsage[] | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    if (range !== 'custom') {
      setFrom(monthsAgo(range))
      setTo(today())
    }
  }, [range])

  useEffect(() => {
    let alive = true
    window.nl.usage.report(from, to).then((r) => alive && setRows(r))
    return () => {
      alive = false
    }
  }, [from, to])

  const total = rows?.reduce((n, r) => n + r.count, 0) ?? 0

  const exportCsv = async (): Promise<void> => {
    if (!rows) return
    const lines = [
      [
        t('songs.usage.colTitle'),
        t('songs.usage.colAuthor'),
        t('songs.usage.colCcli'),
        t('songs.usage.colCopyright'),
        t('songs.usage.colTimes'),
        t('songs.usage.colLast')
      ],
      ...rows.map((r) => [r.title, r.author ?? '', r.ccli ?? '', r.copyright ?? '', r.count, r.last])
    ]
    const csv = lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n'
    const path = await window.nl.usage.exportCsv(csv, t('songs.usage.fileName', { from, to }))
    if (path) setSaved(t('songs.usage.saved', { path }))
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-[min(640px,88vh)] w-[min(640px,94vw)] flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl">
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-text">
            <BarChart3 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">{t('songs.usage.title')}</div>
            <div className="text-[12px] text-muted">{t('songs.usage.subtitle')}</div>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-muted hover:bg-panel-2 hover:text-fg">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <div className="flex rounded-md bg-panel-2 p-0.5 text-[12px]">
            {([3, 6, 12, 'custom'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`whitespace-nowrap rounded px-2.5 py-1 ${range === r ? 'bg-panel-3 text-fg' : 'text-muted hover:text-fg'}`}
              >
                {r === 'custom' ? t('songs.usage.custom') : tn('songs.usage.months', r)}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-1.5 text-[12px] text-muted">
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-7 rounded bg-panel-2 px-2 text-fg outline-none [color-scheme:dark]" />
              {t('songs.usage.to')}
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-7 rounded bg-panel-2 px-2 text-fg outline-none [color-scheme:dark]" />
            </div>
          )}
          <span className="ml-auto text-[12px] text-dim">
            {rows ? `${tn('songs.usage.songs', rows.length)} · ${tn('songs.usage.uses', total)}` : t('common.loading')}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
          {rows && !rows.length ? (
            <p className="py-10 text-center text-[13px] text-muted">{t('songs.usage.none', { from: formatDay(from), to: formatDay(to) })}</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="label-caps text-left">
                  <th className="py-2 font-normal">{t('songs.usage.colTitle')}</th>
                  <th className="py-2 font-normal">{t('songs.usage.colAuthor')}</th>
                  <th className="py-2 font-normal">{t('songs.usage.colCcli')}</th>
                  <th className="py-2 text-right font-normal">{t('songs.usage.colTimes')}</th>
                  <th className="py-2 pl-4 text-right font-normal">{t('songs.usage.colLast')}</th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((r) => (
                  <tr key={r.songId} className="border-t border-line">
                    <td className="py-1.5 pr-3">{r.title}</td>
                    <td className="py-1.5 pr-3 text-muted">{r.author ?? ''}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-muted">{r.ccli ?? ''}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.count}</td>
                    <td className="py-1.5 pl-4 text-right tabular-nums text-muted">{formatDay(r.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-3">
          {saved && <span className="min-w-0 flex-1 truncate text-[12px] text-emerald-400">{saved}</span>}
          <button
            onClick={exportCsv}
            disabled={!rows?.length}
            className="flex items-center gap-1.5 rounded-md bg-accent-fill px-3 py-1.5 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-50"
          >
            <Download size={14} /> {t('songs.usage.exportCsv')}
          </button>
        </div>
      </div>
    </div>
  )
}
