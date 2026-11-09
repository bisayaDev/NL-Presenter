import { AlertTriangle, Loader2, Presentation, X } from 'lucide-react'
import { useDeckJob } from '@/lib/deck'
import { useT } from '@/i18n'

/** Bottom-right card while a presentation imports, and any files that could not be imported. */
export default function DeckProgress() {
  const { t, tn } = useT()
  const { job, errors, dismiss } = useDeckJob()
  if (!job && !errors.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[360px] flex-col gap-2">
      {job && (
        <div className="rounded-lg border border-line bg-panel-2 p-3 shadow-2xl">
          <div className="flex items-center gap-2 text-[13px]">
            <Presentation size={15} className="shrink-0 text-accent-text" />
            <span className="min-w-0 flex-1 truncate font-medium">{job.file}</span>
            <Loader2 size={14} className="shrink-0 animate-spin text-muted" />
          </div>
          <div className="mt-1 text-[12px] text-muted">
            {job.app ? t('media.deck.converting', { app: job.app }) : t(`media.deck.${job.step}`)}
            {job.pages ? ` · ${t('media.deck.pageOf', { page: job.page, pages: job.pages })}` : '…'}
            {job.queued ? ` · ${tn('media.deck.queued', job.queued)}` : ''}
          </div>
          {job.pages > 0 && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel-3">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${(job.page / job.pages) * 100}%` }} />
            </div>
          )}
        </div>
      )}
      {errors.length > 0 && (
        <div className="rounded-lg border border-live/40 bg-panel-2 p-3 shadow-2xl">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <AlertTriangle size={15} className="shrink-0 text-live" />
            <span className="flex-1">
              {errors.length === 1 ? t('media.deck.errorOne') : tn('media.deck.errorMany', errors.length)}
            </span>
            <button onClick={dismiss} className="rounded p-0.5 text-muted hover:text-fg" title={t('media.deck.dismiss')}>
              <X size={14} />
            </button>
          </div>
          <ul className="mt-1.5 flex max-h-48 flex-col gap-1.5 overflow-y-auto text-[12px]">
            {errors.map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.file}</span>
                <span className="block text-muted select-text">{e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
