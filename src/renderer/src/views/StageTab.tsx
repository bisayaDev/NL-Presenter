import { useEffect, useState } from 'react'
import { AlignCenter, AlignLeft, AlignRight, Monitor, MonitorOff, RotateCcw, Send, X } from 'lucide-react'
import type { DisplayInfo, ScreensStatus } from '@shared/types'
import StageView from '@/components/StageView'
import NetworkPanel from '@/components/NetworkPanel'
import BroadcastPanel from '@/components/BroadcastPanel'
import OverlayView from '@/components/OverlayView'
import CaptionPanel from '@/components/CaptionPanel'
import { buildFrame, buildSnapshot, buildStage, liveTempo, useApp } from '@/store/useApp'
import { tempoLabel } from '@shared/tempo'
import TickerPanel from '@/components/TickerPanel'
import { useT } from '@/i18n'

// Keys only: translated at render (the message is sent in the operator's language).
const QUICK = ['nextSong', 'prayer', 'offering', 'wrapUp', 'slowDown', 'repeatChorus', 'announcements'] as const

export default function StageTab() {
  const state = useApp()
  const { t } = useT()
  const stage = buildStage(state)
  const { setStage } = state
  const [draft, setDraft] = useState(state.stage.message)
  const overlay = buildSnapshot(state).overlay
  const overlayEmpty = (overlay.hidden || !overlay.slide?.text) && !overlay.countdown && !overlay.caption && !overlay.ticker

  const send = (text: string): void => {
    setDraft(text)
    setStage({ message: text.trim() })
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-[440px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-line p-5">
        <div>
          <div className="label-caps mb-1.5">{t('stage.message.title')}</div>
          <textarea
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(draft)
              }
            }}
            placeholder={t('stage.message.placeholder')}
            className="h-24 w-full resize-none rounded-lg bg-panel-2 p-3 text-[14px] outline-none focus:ring-1 focus:ring-accent/50"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => send(draft)}
              disabled={!draft.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-fill py-2 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
            >
              <Send size={14} /> {t('stage.message.send')}
            </button>
            <button
              onClick={() => send('')}
              disabled={!state.stage.message}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] text-muted hover:text-fg disabled:opacity-40"
            >
              <X size={14} /> {t('stage.message.clear')}
            </button>
            <span className="w-12 text-right text-[11px] text-dim">{draft.length}/200</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex rounded-lg bg-panel-2 p-0.5" role="group" aria-label={t('stage.message.alignment')}>
              {(
                [
                  ['left', AlignLeft, t('stage.message.alignLeft')],
                  ['center', AlignCenter, t('stage.message.alignCenter')],
                  ['right', AlignRight, t('stage.message.alignRight')]
                ] as const
              ).map(([id, Icon, title]) => (
                <button
                  key={id}
                  title={title}
                  onClick={() => setStage({ messageAlign: id })}
                  className={`grid h-7 w-8 place-items-center rounded-md ${state.stage.messageAlign === id ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'}`}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
            <label className="flex flex-1 cursor-pointer items-center justify-end gap-2 text-[12.5px] text-muted" title={t('stage.message.flashHint')}>
              {t('stage.message.flash')}
              <input
                type="checkbox"
                checked={state.stage.messageFlash}
                onChange={(e) => setStage({ messageFlash: e.target.checked })}
                className="accent-[var(--color-accent)]"
              />
            </label>
          </div>
        </div>

        <div>
          <div className="label-caps mb-1.5">{t('stage.quick.title')}</div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((id) => t(`stage.quick.${id}`)).map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className={`rounded-md px-2.5 py-1.5 text-[12.5px] ${
                  state.stage.message === q ? 'bg-amber-400 text-black' : 'bg-panel-2 text-fg/85 hover:bg-panel-3'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <TickerPanel />

        <StageLayoutPicker />

        <div>
          <div className="label-caps mb-1.5">{t('stage.show.title')}</div>
          <div className="flex flex-col gap-1.5">
            <Toggle checked={state.stage.showNext} onChange={(v) => setStage({ showNext: v })} label={t('stage.show.next')} />
            <Toggle checked={state.stage.showClock} onChange={(v) => setStage({ showClock: v })} label={t('stage.show.clock')} />
            <Toggle checked={state.stage.showServiceTimer} onChange={(v) => setStage({ showServiceTimer: v })} label={t('stage.show.serviceTimer')} />
            <Toggle checked={state.stage.showItemTime} onChange={(v) => setStage({ showItemTime: v })} label={t('stage.show.itemTime')} />
            <Toggle checked={state.stage.showTitles} onChange={(v) => setStage({ showTitles: v })} label={t('stage.show.titles')} />
            <Toggle checked={state.stageSecondLanguage} onChange={state.setStageSecondLanguage} label={t('stage.show.secondLanguage')} />
            <Toggle checked={state.stage.mirror} onChange={(v) => setStage({ mirror: v })} label={t('stage.show.mirror')} />
          </div>
          <p className="mt-1.5 text-[11.5px] text-dim">{t('stage.show.countdownNote')}</p>
        </div>

        <div>
          <div className="label-caps mb-1.5">{t('stage.chords.title')}</div>
          <div className="flex rounded-lg bg-panel-2 p-0.5 text-[12.5px]">
            {(
              [
                ['off', t('stage.chords.off')],
                ['standard', t('stage.chords.standard')],
                ['nashville', t('stage.chords.nashville')]
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setStage({ chords: id })}
                className={`flex-1 rounded-md py-1.5 ${state.stage.chords === id ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-dim">{t('stage.chords.note')}</p>
        </div>

        <BeatPulsePicker />

        <WiredStage />

        <div className="rounded-lg border border-line bg-panel">
          <div className="label-caps px-4 pt-3">{t('stage.wireless.title')}</div>
          <NetworkPanel target="stage" />
        </div>

        <CaptionPanel />

        <BroadcastPanel />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
        <span className="label-caps">{t('stage.preview')}</span>
        <div className="aspect-video w-full max-w-5xl shrink-0 overflow-hidden rounded-xl ring-1 ring-line">
          <StageView frame={stage} audience={buildFrame(state)} />
        </div>
        <span className="label-caps mt-3">{t('stage.overlayPreview')}</span>
        <div className="checker relative aspect-video w-full max-w-5xl shrink-0 overflow-hidden rounded-xl ring-1 ring-line">
          <OverlayView frame={overlay} style={state.style} className="h-full w-full" />
          {overlayEmpty && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
              <span className="rounded-md bg-panel/85 px-3 py-1.5 text-center text-[12.5px] text-muted">
                {t('stage.overlayEmpty')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const LAYOUTS = ['standard', 'lyrics', 'chords'] as const

/** Stage screen layout and text size (wireless tablets can pick their own layout from their corner menu). */
function StageLayoutPicker() {
  const layout = useApp((s) => s.stage.layout)
  const scale = useApp((s) => s.stage.scale)
  const setStage = useApp((s) => s.setStage)
  const { t } = useT()
  return (
    <div>
      <div className="label-caps mb-1.5">{t('stage.layout.title')}</div>
      <div className="grid grid-cols-3 gap-1.5">
        {LAYOUTS.map((id) => (
          <button
            key={id}
            onClick={() => setStage({ layout: id })}
            className={`rounded-lg px-2 py-2 text-left ${layout === id ? 'bg-accent-fill text-on-accent' : 'bg-panel-2 text-fg/85 hover:bg-panel-3'}`}
          >
            <span className="block text-[12.5px] font-semibold">{t(`stage.layout.${id}`)}</span>
            <span className={`block text-[10.5px] leading-tight ${layout === id ? 'text-on-accent' : 'text-dim'}`}>{t(`stage.layout.${id}Sub`)}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="label-caps shrink-0">{t('stage.layout.textSize')}</span>
        <input
          type="range"
          min={70}
          max={150}
          step={5}
          value={Math.round(scale * 100)}
          onChange={(e) => setStage({ scale: Number(e.target.value) / 100 })}
          onDoubleClick={() => setStage({ scale: 1 })}
          title={t('stage.layout.resetHint')}
          className="min-w-0 flex-1 accent-[var(--color-accent)]"
        />
        <span className="w-10 text-right text-[11.5px] tabular-nums text-muted">{Math.round(scale * 100)}%</span>
      </div>
    </div>
  )
}

/** Beat pulse for the band: off, pips in the stage top bar, or pips plus a flashing frame; and "Beat 1 now". */
function BeatPulsePicker() {
  const pulse = useApp((s) => s.stage.beatPulse)
  const setStage = useApp((s) => s.setStage)
  const restartBeat = useApp((s) => s.restartBeat)
  const tempo = liveTempo(useApp())
  const { t } = useT()
  return (
    <div>
      <div className="label-caps mb-1.5">{t('stage.beat.title')}</div>
      <div className="flex rounded-lg bg-panel-2 p-0.5 text-[12.5px]">
        {(
          [
            ['off', t('stage.beat.off')],
            ['dot', t('stage.beat.dot')],
            ['edge', t('stage.beat.edge')]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setStage({ beatPulse: id })}
            className={`min-w-0 flex-1 truncate rounded-md px-1 py-1.5 ${pulse === id ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={restartBeat}
          disabled={!tempo}
          title={t('stage.beat.restartHint')}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-muted hover:text-fg disabled:opacity-40"
        >
          <RotateCcw size={13} /> {t('stage.beat.restart')}
        </button>
        <span className="min-w-0 truncate text-[12px] tabular-nums text-sky-300">{tempo ? tempoLabel(tempo.bpm, tempo.time) : ''}</span>
      </div>
      <p className="mt-1.5 text-[11.5px] text-dim">{t('stage.beat.note')}</p>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg bg-panel-2 px-3 py-2 text-[13px]">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--color-accent)]" />
    </label>
  )
}

function WiredStage() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [status, setStatus] = useState<ScreensStatus | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const { t } = useT()

  useEffect(() => {
    window.nl.displays.list().then(setDisplays)
    window.nl.screens.status().then(setStatus)
    const a = window.nl.displays.onChange(setDisplays)
    const b = window.nl.screens.onStatus(setStatus)
    return () => {
      a()
      b()
    }
  }, [])

  const open = status?.stage.open
  const usedByAudience = status?.audience.displayId

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="label-caps mb-2">{t('stage.wired.title')}</div>
      <div className="flex gap-2">
        <select
          value={pick ?? ''}
          onChange={(e) => setPick(e.target.value ? Number(e.target.value) : null)}
          disabled={open}
          className="h-9 min-w-0 flex-1 rounded-md bg-panel-2 px-2 text-[13px] outline-none disabled:opacity-50"
        >
          <option value="">{t('common.automatic')}</option>
          {displays.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label} ({d.width}×{d.height}){d.primary ? ` · ${t('stage.wired.main')}` : ''}
              {d.id === usedByAudience ? ` · ${t('stage.wired.audience')}` : ''}
            </option>
          ))}
        </select>
        {open ? (
          <button
            onClick={() => window.nl.screens.close('stage')}
            className="flex items-center gap-1.5 rounded-md bg-live/15 px-3 text-[13px] font-medium text-live hover:bg-live/25"
          >
            <MonitorOff size={14} /> {t('common.close')}
          </button>
        ) : (
          <button
            onClick={() => window.nl.screens.open('stage', pick)}
            className="flex items-center gap-1.5 rounded-md bg-accent-fill px-3 text-[13px] font-semibold text-on-accent hover:brightness-110"
          >
            <Monitor size={14} /> {t('common.open')}
          </button>
        )}
      </div>
      {displays.length < 2 && (
        <p className="mt-2 text-[11.5px] text-dim">{t('stage.wired.oneDisplay')}</p>
      )}
    </div>
  )
}
