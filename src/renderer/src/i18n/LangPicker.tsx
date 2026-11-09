import { Languages } from 'lucide-react'
import { LANG_OPTIONS, phoneLang, setPhoneLang, useT, type Lang } from './index'

/**
 * Language choice for phones, tablets and browser screens (no preload bridge). Saved in this browser's
 * localStorage; "Same as computer" follows the operator's language (sent in the welcome message / snapshot).
 */
export default function LangPicker({ className = '' }: { className?: string }) {
  const { t } = useT()
  const own = phoneLang()
  return (
    <label className={`flex items-center gap-2 text-[13px] text-muted ${className}`}>
      <Languages size={16} className="shrink-0" aria-hidden />
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={own ?? ''}
        onChange={(e) => setPhoneLang((e.target.value || null) as Lang | null)}
        className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-panel px-2 text-[14px] text-fg outline-none"
        aria-label={t('common.language')}
      >
        <option value="">{t('remote.lang.follow')}</option>
        {LANG_OPTIONS.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  )
}
