import { useState } from 'react'
import { ChevronDown, ChevronRight, Clock, Plus, Star } from 'lucide-react'
import type { ScripturePassage } from '@shared/types'
import { passageSlides, passageTitle } from '@/lib/passages'
import { useApp } from '@/store/useApp'
import { t, useT } from '@/i18n'

/** Bible tab: pinned passages and the Recent list (last 30 shown live or added). Click shows live. */
export default function PassageList() {
  useT()
  const pins = useApp((s) => s.scripturePins)
  const history = useApp((s) => s.scriptureHistory)
  // Folded by default once there is something in it, so the book list keeps its room.
  const [open, setOpen] = useState(() => history.length === 0)
  const [error, setError] = useState<string | null>(null)

  const show = async (p: ScripturePassage): Promise<void> => {
    setError((await useApp.getState().showPassage(p)) ? null : t('scripture.notFound', { title: passageTitle(p) }))
  }
  const add = async (p: ScripturePassage): Promise<void> => {
    const s = useApp.getState()
    const r = await passageSlides(p, s.scripture)
    if (!r) return setError(t('scripture.notFound', { title: passageTitle(p) }))
    setError(null)
    s.addScripture(r.title, r.slides)
    s.recordScripture({ ...p, at: Date.now() })
  }

  return (
    <div className="flex max-h-[40%] shrink-0 flex-col border-t border-line">
      {pins.length > 0 && (
        <div className="shrink-0 px-1.5 pt-2">
          <div className="label-caps flex items-center gap-1.5 px-1 pb-1">
            <Star size={11} className="fill-current text-amber-400" /> {t('scripture.pinned')}
          </div>
          <div className="max-h-32 overflow-y-auto">
            {pins.map((p) => (
              <Row key={p.id} p={p} pinned onShow={show} onAdd={add} />
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="label-caps flex shrink-0 items-center gap-1.5 px-2.5 py-2 text-left hover:text-fg"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Clock size={11} /> {t('scripture.recent')}
        {history.length ? ` · ${history.length}` : ''}
        {open && history.length > 0 && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm(t('scripture.confirmClearRecent'))) useApp.getState().clearScriptureHistory()
            }}
            className="ml-auto normal-case tracking-normal text-dim hover:text-fg"
          >
            {t('scripture.clear')}
          </span>
        )}
      </button>
      {open && (
        <div className="max-h-44 min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {history.length === 0 && <div className="px-2 pb-1 text-[11.5px] text-dim">{t('scripture.recentEmpty')}</div>}
          {history.map((p) => (
            <Row key={p.id} p={p} pinned={pins.some((x) => x.id === p.id)} onShow={show} onAdd={add} />
          ))}
        </div>
      )}
      {error && <div className="shrink-0 px-2.5 pb-2 text-[11px] text-live">{error}</div>}
    </div>
  )
}

function Row({
  p,
  pinned,
  onShow,
  onAdd
}: {
  p: ScripturePassage
  pinned: boolean
  onShow: (p: ScripturePassage) => void
  onAdd: (p: ScripturePassage) => void
}) {
  useT()
  return (
    <div className="group flex items-center rounded-md hover:bg-panel-2">
      <button onClick={() => onShow(p)} title={t('scripture.showLive')} className="min-w-0 flex-1 truncate px-2 py-1 text-left text-[12.5px]">
        {passageTitle(p)}
      </button>
      <button
        onClick={() => onAdd(p)}
        title={t('scripture.addToService')}
        className="rounded p-1 text-dim opacity-0 hover:text-accent-text group-hover:opacity-100"
      >
        <Plus size={13} />
      </button>
      <button
        onClick={() => useApp.getState().togglePin(p)}
        title={pinned ? t('scripture.unpin') : t('scripture.pin')}
        className={`rounded p-1 ${pinned ? 'text-amber-400' : 'text-dim opacity-0 hover:text-amber-400 group-hover:opacity-100'}`}
      >
        <Star size={13} className={pinned ? 'fill-current' : ''} />
      </button>
    </div>
  )
}
