import { selectLiveSlide, useApp } from '@/store/useApp'
import { formatClock, useNow } from '@/lib/time'
import { useT } from '@/i18n'

/** "0:42" / "1:05:10" for elapsed time. */
export const elapsed = (ms: number): string => formatClock(Math.max(0, Math.floor(ms / 1000) * 1000))

/** Live sidebar footer: the clock, then time since the service started and time on the live item. */
export default function ServiceTimers({ clock }: { clock: React.ReactNode }) {
  const now = useNow(0, 1000)
  const { t } = useT()
  const serviceStartedAt = useApp((s) => s.serviceStartedAt)
  const itemStartedAt = useApp((s) => s.itemStartedAt)
  const resetServiceTimer = useApp((s) => s.resetServiceTimer)
  const isLive = useApp((s) => !!selectLiveSlide(s))
  const planned = useApp((s) => selectLiveSlide(s)?.item.minutes)
  const onItem = itemStartedAt && isLive ? now - itemStartedAt : null
  const over = onItem !== null && !!planned && onItem > planned * 60_000
  return (
    <span className="flex min-w-0 items-center gap-1.5 tabular-nums">
      {clock}
      {serviceStartedAt && (
        <>
          <span className="text-dim">·</span>
          <button
            onClick={resetServiceTimer}
            className="rounded px-1 text-muted hover:bg-panel-2 hover:text-fg"
            title={t('live.timer.serviceHint')}
          >
            <span className="text-[11px] text-dim">{t('live.timer.service')}</span> {elapsed(now - serviceStartedAt)}
          </button>
        </>
      )}
      {onItem !== null && (
        <>
          <span className="text-dim">·</span>
          <span
            className={over ? 'text-amber-300' : 'text-muted'}
            title={planned ? t('live.timer.itemPlannedHint', { min: planned }) : t('live.timer.itemHint')}
          >
            <span className={`text-[11px] ${over ? 'text-amber-300/80' : 'text-dim'}`}>{t('live.timer.item')}</span> {elapsed(onItem)}
            {planned ? <span className="text-[11px] text-dim"> / {t('live.timer.minutes', { min: planned })}</span> : null}
          </span>
        </>
      )}
    </span>
  )
}
