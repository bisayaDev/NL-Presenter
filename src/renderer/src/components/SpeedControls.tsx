import { Keyboard } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { openHelp } from './QuickKeys'
import { useT } from '@/i18n'

/** Slide grid header: what a click on a slide does. */
export function ClickModeToggle() {
  const mode = useApp((s) => s.clickMode)
  const setMode = useApp((s) => s.setClickMode)
  const { t } = useT()
  const opt = (m: typeof mode, label: string, title: string) => (
    <button
      onClick={() => setMode(m)}
      title={title}
      className={`whitespace-nowrap rounded px-2 py-0.5 ${
        mode === m ? (m === 'preview' ? 'bg-amber-400/20 text-amber-300' : 'bg-accent-fill text-on-accent') : 'text-muted hover:text-fg'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="flex shrink-0 items-center rounded-md bg-panel-2 p-0.5 text-[12px]">
      {opt('live', t('presentation.goLive'), t('presentation.goLiveHint'))}
      {opt('preview', t('presentation.previewFirst'), t('presentation.previewFirstHint'))}
    </div>
  )
}

/** Slide grid bottom bar: opens the keyboard cheat sheet. */
export function ShortcutsButton({ className = '' }: { className?: string }) {
  const { t } = useT()
  return (
    <button
      onClick={openHelp}
      title={t('presentation.shortcutsHint')}
      className={`flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-muted hover:bg-panel-2 hover:text-fg ${className}`}
    >
      <Keyboard size={14} /> ?
    </button>
  )
}
