import { formatClock } from '@/lib/time'
import { useT } from '@/i18n'

// Small stage-screen blocks (sized in "u", see StageView): the service timer and song slide notes.

const u = (n: number): string => `calc(var(--u) * ${n})`

/** "SERVICE 0:42" beside the clock in the top bar. */
export function StageServiceTimer({ since, now }: { since: number; now: number }) {
  const { t } = useT()
  return (
    <span className="flex shrink-0 flex-col items-end leading-none text-white/60" title={t('stage.view.serviceHint')}>
      <span className="whitespace-nowrap font-bold uppercase tracking-wider text-white/40" style={{ fontSize: u(1.7) }}>
        {t('stage.view.service')}
      </span>
      <span className="font-semibold tabular-nums" style={{ fontSize: u(2.9) }}>
        {formatClock(Math.max(0, Math.floor((now - since) / 1000) * 1000))}
      </span>
    </span>
  )
}

/** Notes on a song slide: a short band under the lyrics (the lyrics keep the rest of the space). */
export function StageSlideNotes({ notes }: { notes: string }) {
  const { t } = useT()
  return (
    <div
      className="flex shrink-0 items-baseline rounded-[0.5em] bg-white/[.07] text-white/80"
      style={{ margin: `0 ${u(2.4)} ${u(1.2)}`, padding: `${u(0.8)} ${u(1.4)}`, gap: u(1.2), maxHeight: '22%' }}
    >
      <span className="shrink-0 font-bold uppercase tracking-wider text-white/45" style={{ fontSize: u(2) }}>
        {t('stage.view.notes')}
      </span>
      <span className="line-clamp-3 min-w-0 whitespace-pre-line font-semibold" style={{ fontSize: u(2.8), lineHeight: 1.25 }}>
        {notes}
      </span>
    </div>
  )
}
