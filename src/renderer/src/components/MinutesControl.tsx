import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock3 } from 'lucide-react'
import type { ServiceItem } from '@shared/types'
import { useApp } from '@/store/useApp'
import { useModal } from '@/lib/modal'
import { t, useT } from '@/i18n'

const PRESETS = [2, 3, 5, 8, 10, 15, 20, 30, 45]

/** "5 min", "1 h 15 min" (in the current language; call at render time). */
export function minutesText(min: number): string {
  if (min < 60) return t('presentation.minutesShort', { n: min })
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? t('presentation.hoursMinutesShort', { h, m }) : t('presentation.hoursShort', { h })
}

/** Planned time of a list of items (sections have none). */
export const plannedTotal = (items: ServiceItem[]): number => items.reduce((t, it) => t + (it.kind === 'section' ? 0 : it.minutes ?? 0), 0)

/** Small clock button on a service order row: set how long the item should take. */
export default function MinutesControl({ item }: { item: ServiceItem }) {
  const setItemMinutes = useApp((s) => s.setItemMinutes)
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useT()
  useModal(!!at)
  useEffect(() => {
    if (!at) return
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setAt(null)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setAt(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc, true)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc, true)
    }
  }, [at])
  const pick = (n: number | undefined): void => setItemMinutes(item.id, n)
  return (
    <>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          const r = e.currentTarget.getBoundingClientRect()
          setAt(at ? null : { x: r.left, y: r.bottom + 4 })
        }}
        className={`rounded p-1 hover:bg-panel-3 hover:text-fg ${item.minutes ? 'text-muted' : 'text-dim'} ${at ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        title={t('presentation.plannedLength')}
      >
        <Clock3 size={13} />
      </button>
      {at &&
        createPortal(
          <div
            ref={ref}
            onClick={(e) => e.stopPropagation()}
            style={{ left: Math.min(at.x, window.innerWidth - 232), top: Math.min(at.y, window.innerHeight - 170) }}
            className="fixed z-50 w-56 rounded-lg border border-line bg-panel-2 p-3 shadow-2xl"
          >
            <div className="label-caps mb-2">{t('presentation.plannedLength')}</div>
            <div className="grid grid-cols-5 gap-1">
              <button
                onClick={() => pick(undefined)}
                title={t('common.none')}
                className={`truncate rounded px-0.5 py-1 text-[12px] ${!item.minutes ? 'bg-accent-fill text-on-accent' : 'bg-panel-3 text-muted hover:text-fg'}`}
              >
                {t('common.none')}
              </button>
              {PRESETS.map((n) => (
                <button
                  key={n}
                  onClick={() => pick(n)}
                  className={`rounded py-1 text-[12px] tabular-nums ${item.minutes === n ? 'bg-accent-fill text-on-accent' : 'bg-panel-3 text-muted hover:text-fg'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-2 text-[12px] text-muted">
              {t('presentation.custom')}
              <input
                type="number"
                min={1}
                max={600}
                value={item.minutes ?? ''}
                placeholder={t('presentation.minPlaceholder')}
                onChange={(e) => pick(Math.max(0, Math.min(600, Math.round(Number(e.target.value) || 0))) || undefined)}
                className="h-7 w-16 rounded-md bg-panel-3 px-2 text-fg outline-none focus:ring-1 focus:ring-accent/50"
              />
              {t('presentation.minutesWord')}
            </label>
            <p className="mt-2 text-[11px] leading-snug text-dim">{t('presentation.minutesNote')}</p>
          </div>,
          document.body
        )}
    </>
  )
}
