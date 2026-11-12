import { useEffect, useState } from 'react'
import { Metronome, Music2, RotateCcw, Volume2 } from 'lucide-react'
import { BPM_MAX, BPM_MIN, tempoLabel } from '@shared/tempo'
import { metronomeTempo, useMetronome } from '@/lib/metronome'
import { liveTempo, useApp } from '@/store/useApp'
import { useT } from '@/i18n'

/** Live panel: the operator's click (this computer's speakers only) and "Beat 1 now" for the stage beat pulse. */
export default function MetronomeControl() {
  const { t } = useT()
  const m = useMetronome()
  const song = liveTempo(useApp())
  const tempo = metronomeTempo(m, song)
  const [draft, setDraft] = useState(String(tempo.bpm))
  useEffect(() => setDraft(String(tempo.bpm)), [tempo.bpm])
  const commit = (): void => {
    const n = Number(draft)
    if (Number.isFinite(n) && n > 0) m.set({ bpm: n, follow: false })
    else setDraft(String(tempo.bpm))
  }

  return (
    <div className="mt-3 rounded-md border border-line bg-panel-2/60 px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <button
          onClick={m.toggle}
          aria-pressed={m.on}
          title={t('live.metro.clickHint')}
          className={`flex h-7 shrink-0 items-center gap-1.5 rounded px-2 text-[12px] font-medium ${
            m.on ? 'bg-accent-fill text-on-accent' : 'bg-panel-3 text-fg/85 hover:text-fg'
          }`}
        >
          <Metronome size={14} />
          <span className="whitespace-nowrap">{t('live.metro.click')}</span>
        </button>
        <input
          type="number"
          min={BPM_MIN}
          max={BPM_MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation() // arrows and Enter must not change the live slide
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          placeholder="BPM" // i18n-ignore
          title={t('live.metro.bpmHint')}
          className="h-7 w-14 shrink-0 rounded bg-panel-3 px-1.5 text-right text-[12px] tabular-nums outline-none focus:ring-1 focus:ring-accent/50"
        />
        {song && (
          <button
            onClick={() => m.set({ follow: !m.follow })}
            aria-pressed={m.follow}
            title={t('live.metro.songHint', { tempo: tempoLabel(song.bpm, song.time) })}
            className={`flex h-7 min-w-0 shrink items-center gap-1 rounded px-1.5 text-[11.5px] ${
              m.follow ? 'bg-sky-400/15 text-sky-300' : 'text-muted hover:text-fg'
            }`}
          >
            <Music2 size={12} className="shrink-0" />
            <span className="whitespace-nowrap">{t('live.metro.song')}</span>
          </button>
        )}
        <span className="flex-1" />
        <button
          onClick={m.beatOne}
          title={t('live.metro.beatOneHint')}
          className="flex h-7 shrink-0 items-center gap-1 rounded px-1.5 text-[11.5px] text-muted hover:bg-panel-3 hover:text-fg"
        >
          <RotateCcw size={12} />
          <span className="whitespace-nowrap">{t('live.metro.beatOne')}</span>
        </button>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11.5px] text-muted">
        <Volume2 size={13} className="shrink-0" aria-label={t('live.metro.volume')} />
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(m.volume * 100)}
          onChange={(e) => m.set({ volume: Number(e.target.value) / 100 })}
          title={t('live.metro.volume')}
          className="min-w-0 flex-1 accent-[var(--color-accent)]"
        />
        <label className="flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap" title={t('live.metro.accentHint')}>
          <input type="checkbox" checked={m.accent} onChange={(e) => m.set({ accent: e.target.checked })} className="accent-[var(--color-accent)]" />
          {t('live.metro.accent')}
        </label>
      </div>
    </div>
  )
}
