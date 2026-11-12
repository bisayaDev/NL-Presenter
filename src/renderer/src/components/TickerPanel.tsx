import { useState } from 'react'
import { Megaphone, Save, Send, Square, Trash2, X } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { TICKER_MAX } from '@/lib/ticker'
import { useT } from '@/i18n'

const REPEATS = [1, 2, 3, 5]
const SECONDS = [10, 15, 30, 60]

/**
 * Stage & OBS tab: announcements on the audience screen ("Parent of child #12, please come to the nursery").
 * A scrolling ticker or a still band along the bottom; messages sent while one plays wait their turn.
 */
export default function TickerPanel() {
  const tk = useApp((s) => s.ticker)
  const presets = useApp((s) => s.tickerPresets)
  const rehearsal = useApp((s) => !!s.rehearsal)
  const { t, tn } = useT()
  const { setTickerOptions, sendTicker, stopTicker, clearTickerQueue, saveTickerPreset, deleteTickerPreset } = useApp.getState()
  const [draft, setDraft] = useState('')
  const text = draft.trim()

  const send = (): void => {
    if (!text) return
    sendTicker(text)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center gap-2">
        <Megaphone size={15} className="text-accent-text" />
        <span className="label-caps">{t('stage.ticker.title')}</span>
        {tk.current && (
          <span className="ml-auto whitespace-nowrap rounded bg-live px-1.5 py-px text-[10px] font-bold uppercase text-white">{t('stage.ticker.showing')}</span>
        )}
      </div>

      <textarea
        value={draft}
        maxLength={TICKER_MAX}
        onChange={(e) => setDraft(e.target.value.replace(/\n/g, ' '))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            send()
          }
        }}
        placeholder={t('stage.ticker.placeholder')}
        className="h-16 w-full resize-none rounded-lg bg-panel-2 p-3 text-[13px] outline-none placeholder:text-dim focus:ring-1 focus:ring-accent/50"
      />

      <div className="flex gap-2">
        <button
          onClick={send}
          disabled={!text}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-fill py-2 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
        >
          <Send size={14} /> {t('stage.ticker.send')}
        </button>
        <button
          onClick={() => saveTickerPreset(text)}
          disabled={!text || presets.includes(text)}
          title={t('stage.ticker.saveHint')}
          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] text-muted hover:text-fg disabled:opacity-40"
        >
          <Save size={14} /> {t('common.save')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="label-caps mb-1 truncate">{t('stage.ticker.style')}</div>
          <div className="flex rounded-md bg-panel-2 p-0.5 text-[12px]">
            {(
              [
                ['scroll', t('stage.ticker.scroll'), t('stage.ticker.scrollHint')],
                ['band', t('stage.ticker.band'), t('stage.ticker.bandHint')]
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                onClick={() => setTickerOptions({ kind: id })}
                title={hint}
                className={`min-w-0 flex-1 truncate rounded px-1 py-1 ${tk.kind === id ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label-caps mb-1 truncate">{tk.kind === 'scroll' ? t('stage.ticker.repeat') : t('stage.ticker.duration')}</div>
          <div className="flex rounded-md bg-panel-2 p-0.5 text-[12px]">
            {(tk.kind === 'scroll' ? REPEATS : SECONDS).map((n) => {
              const on = tk.kind === 'scroll' ? tk.repeat === n : tk.seconds === n
              return (
                <button
                  key={n}
                  onClick={() => setTickerOptions(tk.kind === 'scroll' ? { repeat: n } : { seconds: n })}
                  className={`min-w-0 flex-1 truncate rounded py-1 ${on ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'}`}
                >
                  {tk.kind === 'scroll' ? t('stage.ticker.times', { n }) : t('stage.caption.seconds', { n })}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-lg bg-panel-2 px-3 py-2 text-[13px]">
        {t('stage.ticker.overlay')}
        <input type="checkbox" checked={tk.overlay} onChange={(e) => setTickerOptions({ overlay: e.target.checked })} className="accent-[var(--color-accent)]" />
      </label>

      {(tk.current || tk.queue.length > 0) && (
        <div className="flex flex-col gap-1.5 rounded-md bg-panel-2 p-2">
          {tk.current && (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{tk.current.text}</span>
              <button
                onClick={stopTicker}
                title={t('stage.ticker.stopHint')}
                className="flex shrink-0 items-center gap-1 rounded-md bg-live/15 px-2 py-1 text-[12px] font-medium text-live hover:bg-live/25"
              >
                <Square size={11} /> {t('stage.ticker.stop')}
              </button>
            </div>
          )}
          {tk.queue.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted" title={tk.queue.map((q) => q.text).join('\n')}>
                {tn('stage.ticker.waiting', tk.queue.length)}
              </span>
              <button
                onClick={clearTickerQueue}
                className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-[12px] text-muted hover:text-fg"
              >
                <X size={12} /> {t('stage.ticker.clearQueue')}
              </button>
            </div>
          )}
        </div>
      )}
      {rehearsal && <p className="text-[11.5px] text-amber-400">{t('stage.ticker.rehearsal')}</p>}

      {presets.length > 0 && (
        <div>
          <div className="label-caps mb-1">{t('stage.ticker.saved')}</div>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {presets.map((p, i) => (
              <div key={p} className="group flex items-center rounded-md bg-panel-2 hover:bg-panel-3">
                <button onClick={() => sendTicker(p)} title={t('stage.ticker.sendThis')} className="min-w-0 flex-1 truncate px-3 py-1.5 text-left text-[12.5px]">
                  {p}
                </button>
                <button
                  onClick={() => deleteTickerPreset(i)}
                  title={t('common.delete')}
                  className="mr-1 rounded p-1.5 text-dim opacity-0 hover:text-live group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-[11.5px] text-dim">{t('stage.ticker.note')}</p>
    </div>
  )
}
