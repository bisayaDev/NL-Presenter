import { Drama } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { useT } from '@/i18n'

/** Shown while rehearsing, so nobody forgets the screens are not following. */
export default function RehearsalBar() {
  const r = useApp((s) => s.rehearsal)
  const end = useApp((s) => s.endRehearsal)
  const setStage = useApp((s) => s.setRehearsalStage)
  const { t } = useT()
  if (!r) return null
  const note = r.stageFollows ? t('topbar.rb.stageFollows') : t('topbar.rb.nothingOut')
  return (
    <div className="flex h-9 shrink-0 items-center gap-3 border-b border-amber-400/30 bg-amber-400/12 px-4 text-[12.5px] text-amber-200">
      <Drama size={15} className="shrink-0 text-amber-300" />
      <span className="shrink-0 font-semibold text-amber-300">{t('live.rehearsal')}</span>
      <span className="min-w-0 flex-1 truncate text-amber-100/80" title={note}>
        {note}
      </span>
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-amber-100/90" title={t('topbar.rb.stageHint')}>
        <input type="checkbox" checked={r.stageFollows} onChange={(e) => setStage(e.target.checked)} className="accent-amber-400" />
        {t('topbar.rb.stageFollow')}
      </label>
      <button onClick={end} className="shrink-0 whitespace-nowrap rounded-md bg-amber-400 px-3 py-1 text-[12px] font-semibold text-black hover:brightness-110">
        {t('topbar.endRehearsal')}
      </button>
    </div>
  )
}
