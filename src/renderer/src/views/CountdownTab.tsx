import { Clock, Eye, EyeOff, Hourglass, Palette, Pause, Play, RotateCcw, Target } from 'lucide-react'
import type { Background, CountdownMode, CountdownTarget } from '@shared/types'
import SlideView from '@/components/SlideView'
import MediaThumb from '@/components/MediaThumb'
import { BACKGROUNDS, BACKGROUND_NAMES } from '@/lib/defaults'
import { countdownText, countdownTitle, useNow } from '@/lib/time'
import { backgroundFor, useApp, usesMedia } from '@/store/useApp'
import { useT } from '@/i18n'

const PRESETS = [1, 3, 5, 10, 15, 30]

export default function CountdownTab() {
  const c = useApp((s) => s.countdown)
  const { updateCountdown, countdownStart, countdownPause, countdownReset, setCountdownVisible, style, aspect, background } =
    useApp()
  const now = useNow()
  const { t } = useT()
  const { text, over } = countdownText(c, now)
  const editable = c.status === 'idle'
  const mins = Math.floor(c.durationSec / 60)
  const secs = c.durationSec % 60

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-[440px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-line p-5">
        <Section label={t('countdown.title')}>
          {/* The built-in default shows in the current language; typing replaces it with the operator's own text. */}
          <input value={countdownTitle(c.title)} onChange={(e) => updateCountdown({ title: e.target.value })} className="input w-full" />
        </Section>
        <Section label={t('countdown.subtext')}>
          <input
            value={c.subtext}
            onChange={(e) => updateCountdown({ subtext: e.target.value })}
            placeholder={t('countdown.subtextPlaceholder')}
            className="input w-full"
          />
        </Section>

        <Section label={t('countdown.mode')}>
          <Segmented<CountdownMode>
            value={c.mode}
            onChange={(mode) => updateCountdown({ mode })}
            disabled={!editable}
            options={[
              ['duration', t('countdown.modeDuration'), Hourglass],
              ['target', t('countdown.modeTarget'), Target],
              ['clock', t('countdown.modeClock'), Clock]
            ]}
          />
        </Section>

        {c.mode === 'duration' && (
          <Section label={t('countdown.modeDuration')}>
            <div className="flex items-center gap-2">
              <NumberBox value={mins} disabled={!editable} onChange={(m) => updateCountdown({ durationSec: m * 60 + secs })} />
              <span className="text-[12px] text-muted">{t('countdown.min')}</span>
              <NumberBox value={secs} max={59} disabled={!editable} onChange={(s2) => updateCountdown({ durationSec: mins * 60 + s2 })} />
              <span className="text-[12px] text-muted">{t('countdown.sec')}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  disabled={!editable}
                  onClick={() => updateCountdown({ durationSec: m * 60 })}
                  className={`rounded-md px-2.5 py-1 text-[12px] disabled:opacity-40 ${
                    c.durationSec === m * 60 ? 'bg-accent-fill text-on-accent' : 'bg-panel-2 text-muted hover:text-fg'
                  }`}
                >
                  {t('countdown.presetMin', { n: m })}
                </button>
              ))}
            </div>
          </Section>
        )}

        {c.mode === 'target' && (
          <Section label={t('countdown.target')}>
            <input
              type="time"
              value={c.targetTime}
              disabled={!editable}
              onChange={(e) => updateCountdown({ targetTime: e.target.value })}
              className="input w-40 [color-scheme:dark]"
            />
          </Section>
        )}

        {c.mode !== 'clock' && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-panel p-3">
            <input
              type="checkbox"
              checked={c.overtime}
              onChange={(e) => updateCountdown({ overtime: e.target.checked })}
              className="mt-0.5 accent-[var(--color-accent)]"
            />
            <span>
              <span className="block text-[13px] font-medium">{t('countdown.overtime')}</span>
              <span className="text-[12px] text-muted">{t('countdown.overtimeSub')}</span>
            </span>
          </label>
        )}

        <Section label={t('countdown.showOn')}>
          <Segmented<CountdownTarget>
            value={c.showOn}
            onChange={(showOn) => updateCountdown({ showOn })}
            options={[
              ['both', t('countdown.showBoth')],
              ['main', t('countdown.showMain')],
              ['stage', t('countdown.showStage')]
            ]}
          />
          <p className="mt-1.5 text-[11.5px] text-dim">{t('countdown.showOnNote')}</p>
        </Section>

        {c.mode !== 'clock' && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-panel p-3">
            <input
              type="checkbox"
              checked={!!c.goLiveAtZero}
              onChange={(e) => updateCountdown({ goLiveAtZero: e.target.checked || undefined })}
              className="mt-0.5 accent-[var(--color-accent)]"
            />
            <span>
              <span className="block text-[13px] font-medium">{t('countdown.goLive')}</span>
              <span className="text-[12px] text-muted">{t('countdown.goLiveSub')}</span>
            </span>
          </label>
        )}

        <CountdownBackground />

        <Section label={t('countdown.textSize')}>
          <div className="flex flex-col gap-2">
            <SizeSlider label={t('countdown.title')} value={c.titleScale} onChange={(v) => updateCountdown({ titleScale: v })} />
            <SizeSlider label={t('countdown.sizeTime')} value={c.timeScale} onChange={(v) => updateCountdown({ timeScale: v })} />
            <SizeSlider label={t('countdown.sizeSubtext')} value={c.subtextScale} onChange={(v) => updateCountdown({ subtextScale: v })} />
          </div>
        </Section>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <span className="label-caps">{t('countdown.preview')}</span>
          <span className="text-[12px] text-muted">
            {c.status === 'running' ? t('countdown.running') : c.status === 'paused' ? t('countdown.paused') : t('countdown.ready')}
            {c.visible ? ` · ${c.mainHidden && c.showOn !== 'stage' ? t('countdown.onStageOnly') : t('countdown.onScreen')}` : ''}
          </span>
        </div>
        <SlideView
          slide={null}
          countdown={c}
          style={style}
          aspect={aspect}
          background={background}
          className={`${aspect === '16:9' ? 'aspect-video' : 'aspect-[4/3]'} w-full max-w-4xl rounded-xl ring-1 ring-line`}
        />

        <div className="flex max-w-4xl items-center gap-2">
          {c.mode === 'clock' ? null : c.status === 'running' ? (
            <Big onClick={countdownPause} tone="amber">
              <Pause size={17} /> {t('countdown.pause')}
            </Big>
          ) : (
            <Big onClick={countdownStart} tone="accent">
              <Play size={17} /> {c.status === 'paused' ? t('countdown.resume') : t('countdown.start')}
            </Big>
          )}
          {c.visible && c.mainHidden && c.showOn !== 'stage' && (
            <Big onClick={() => setCountdownVisible(true)} tone="plain">
              <Eye size={17} /> {t('countdown.backOnAudience')}
            </Big>
          )}
          <Big onClick={() => setCountdownVisible(!c.visible)} tone={c.visible ? 'live' : 'plain'}>
            {c.visible ? <EyeOff size={17} /> : <Eye size={17} />} {c.visible ? t('countdown.hide') : t('countdown.show')}
          </Big>
          {c.mode !== 'clock' && (
            <button
              onClick={countdownReset}
              title={t('common.reset')}
              className="grid h-11 w-11 place-items-center rounded-lg border border-line text-muted hover:text-fg"
            >
              <RotateCcw size={17} />
            </button>
          )}
          <span className={`ml-auto text-[28px] font-bold tabular-nums ${over ? 'text-live' : ''}`}>{text}</span>
        </div>
      </div>
    </div>
  )
}

/** The countdown's own background: the normal one, a color or gradient, or a picture, video or loop from Media. */
function CountdownBackground() {
  const bg = useApp((s) => s.countdown.background)
  const media = useApp((s) => s.media)
  const updateCountdown = useApp((s) => s.updateCountdown)
  const { t } = useT()
  const set =(background: Background | undefined): void => updateCountdown({ background })
  const same = (b: Background): boolean => !!bg && JSON.stringify(b) === JSON.stringify(bg)
  const ring = (on: boolean): string => (on ? 'ring-2 ring-accent' : 'ring-1 ring-line hover:ring-fg/30')
  const pics = media.filter((m) => (m.kind === 'image' || m.kind === 'video' || m.kind === 'loop') && !m.missing)
  return (
    <Section label={t('countdown.background')}>
      <div className="grid grid-cols-5 gap-1.5">
        <button
          onClick={() => set(undefined)}
          className={`aspect-video truncate rounded bg-panel-2 px-0.5 text-[10.5px] leading-tight text-muted ${ring(!bg)}`}
          title={t('countdown.normalHint')}
        >
          {t('countdown.normal')}
        </button>
        {BACKGROUNDS.map((b, i) => (
          <button
            key={i}
            onClick={() => set(b)}
            title={t(BACKGROUND_NAMES[i])}
            aria-label={t(BACKGROUND_NAMES[i])}
            aria-pressed={same(b)}
            className={`aspect-video rounded ${ring(same(b))}`}
            style={{ background: b.kind === 'color' || b.kind === 'gradient' ? b.value : '#000' }}
          />
        ))}
        <label
          title={t('countdown.pickColor')}
          className={`relative grid aspect-video cursor-pointer place-items-center overflow-hidden rounded bg-panel-2 text-muted ${ring(bg?.kind === 'color' && !BACKGROUNDS.some(same))}`}
          style={bg?.kind === 'color' ? { background: bg.value } : undefined}
        >
          <Palette size={13} />
          <input
            type="color"
            value={bg?.kind === 'color' ? bg.value : '#000000'}
            onChange={(e) => set({ kind: 'color', value: e.target.value })}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
      {pics.length > 0 && (
        <div className="mt-1.5 grid max-h-40 grid-cols-5 gap-1.5 overflow-y-auto p-0.5">
          {pics.map((m) => (
            <button
              key={m.id}
              title={m.name}
              onClick={() => {
                const b = backgroundFor(m)
                if (b) set(b)
              }}
              className={`aspect-video overflow-hidden rounded bg-black ${ring(usesMedia(bg, m))}`}
            >
              <MediaThumb m={m} />
            </button>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-[11.5px] text-dim">{t('countdown.bgNote')}</p>
    </Section>
  )
}

function SizeSlider({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  const v = value ?? 100
  const { t } = useT()
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 truncate text-[12.5px] text-muted" title={label}>
        {label}
      </span>
      <input
        type="range"
        min={40}
        max={180}
        step={5}
        value={v}
        onChange={(e) => onChange(Number(e.target.value) === 100 ? undefined : Number(e.target.value))}
        onDoubleClick={() => onChange(undefined)}
        title={t('countdown.resetHint')}
        className="min-w-0 flex-1 accent-[var(--color-accent)]"
      />
      <span className="w-10 text-right text-[11.5px] tabular-nums text-muted">{v}%</span>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-caps mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled
}: {
  value: T
  onChange: (v: T) => void
  options: [T, string, React.ComponentType<{ size?: number }>?][]
  disabled?: boolean
}) {
  return (
    <div className={`flex rounded-lg bg-panel-2 p-0.5 ${disabled ? 'opacity-50' : ''}`}>
      {options.map(([v, label, Icon]) => (
        <button
          key={v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-1 py-1.5 text-[12.5px] ${
            value === v ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'
          }`}
        >
          {Icon && <Icon size={14} />}
          {label}
        </button>
      ))}
    </div>
  )
}

function NumberBox({
  value,
  onChange,
  max = 600,
  disabled
}: {
  value: number
  onChange: (n: number) => void
  max?: number
  disabled?: boolean
}) {
  return (
    <input
      type="number"
      min={0}
      max={max}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
      className="input w-20 text-center text-[16px] font-semibold tabular-nums disabled:opacity-50"
    />
  )
}

function Big({
  children,
  onClick,
  tone
}: {
  children: React.ReactNode
  onClick: () => void
  tone: 'accent' | 'amber' | 'live' | 'plain'
}) {
  const cls = {
    accent: 'bg-accent-fill text-on-accent hover:brightness-110',
    amber: 'bg-amber-400 text-black hover:brightness-105',
    live: 'bg-live/15 text-live hover:bg-live/25',
    plain: 'border border-line text-fg hover:bg-panel-2'
  }[tone]
  return (
    <button onClick={onClick} className={`flex h-11 items-center gap-2 rounded-lg px-5 text-[14px] font-semibold ${cls}`}>
      {children}
    </button>
  )
}
