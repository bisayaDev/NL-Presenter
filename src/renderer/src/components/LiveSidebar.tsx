import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Drama, EyeOff, Metronome, MonitorOff, Timer, X } from 'lucide-react'
import SlideView from './SlideView'
import CuePreview from './CuePreview'
import ServiceTimers from './ServiceTimers'
import VideoTransport from './VideoTransport'
import MetronomeControl from './MetronomeControl'
import { useMetronome } from '@/lib/metronome'
import { SECTION_COLORS } from '@/lib/defaults'
import { audienceSlide, buildFrame, itemLook, liveTempo, nextLocation, selectLiveSlide, slideBackground, useApp } from '@/store/useApp'
import { labelColor } from '@shared/labels'
import { formatTime, t, useT } from '@/i18n'

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  useT()
  return <span>{formatTime(now)}</span>
}

/** Auto-advance: time left on this slide, with a draining bar. */
function AutoTimer({ at, seconds }: { at: number; seconds: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, at - now)
  useT()
  return (
    <div className="mt-1 flex items-center gap-2 text-[11px] text-accent-text" title={t('live.autoAdvanceHint')}>
      <Timer size={12} className="shrink-0" />
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-panel-3">
        <div className="h-full bg-accent" style={{ width: `${(left / (seconds * 1000)) * 100}%` }} />
      </div>
      <span className="shrink-0 text-right tabular-nums">{t('live.autoNext', { s: Math.ceil(left / 1000) })}</span>
    </div>
  )
}

export default function LiveSidebar() {
  const state = useApp()
  useT()
  const frame = buildFrame(state)
  const live = selectLiveSlide(state)
  const nx = nextLocation(state)
  const upNext = nx?.slide ?? null
  const nextLook = itemLook(state, nx?.item) // drawn as the audience will see it
  const { next, prev, toggleHideText, toggleBlack, clearLive, hideText, black, service, goLive } = state
  const metro = useMetronome()
  // Metronome: shown while a song with a BPM is live, while it clicks, or when opened from the header.
  const showMetro = metro.open || metro.on || !!liveTempo(state)

  return (
    <aside className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-l border-line bg-panel">
      <CuePreview />
      <div className="flex h-11 items-center justify-between px-4">
        {state.rehearsal ? (
          <span className="flex items-center gap-2 text-[12px] font-semibold tracking-wider uppercase text-amber-300" title={t('live.notFollowing')}>
            <Drama size={14} /> {t('live.rehearsal')}
          </span>
        ) : live ? (
          <span className="flex items-center gap-2 text-[12px] font-semibold tracking-wider uppercase text-live">
            <span className="h-2 w-2 animate-pulse rounded-full bg-live" /> {t('live.live')}
          </span>
        ) : (
          <span className="label-caps">{t('live.outputPreview')}</span>
        )}
        <span className="flex-1" />
        <button
          onClick={() => metro.set({ open: !metro.open })}
          aria-pressed={showMetro}
          title={t('live.metro.title')}
          className={`mr-1.5 grid h-7 w-7 place-items-center rounded-md ${metro.on ? 'text-accent-text' : 'text-muted hover:text-fg'}`}
        >
          <Metronome size={14} />
        </button>
        {live && (
          <button
            onClick={clearLive}
            className="flex items-center gap-1 rounded-md bg-live/15 px-2 py-1 text-[12px] font-medium text-live hover:bg-live/25"
          >
            <X size={13} /> {t('live.clear')}
          </button>
        )}
      </div>

      <div className="px-4">
        <SlideView
          {...frame}
          className={`aspect-video w-full rounded-lg ring-1 ${state.rehearsal ? 'ring-2 ring-amber-400/70' : 'ring-line'}`}
        />
        <div className="mt-1.5 flex h-5 items-center justify-between text-[11.5px] text-muted">
          <span className="truncate">{live ? live.item.title : t('live.nothingLive')}</span>
          {live?.slide.label && (
            <span className="font-medium text-accent-text" style={{ color: labelColor(live.slide.label, state.labelColors) }}>
              {live.slide.label}
            </span>
          )}
        </div>
        {state.autoNextAt && live?.item.advance && <AutoTimer at={state.autoNextAt} seconds={live.item.advance.seconds} />}
        {frame.video && <VideoTransport />}

        <div className="mt-2 grid grid-cols-4 gap-1.5">
          <CtlButton onClick={prev} disabled={!live} label={t('live.prev')} title={t('live.prevHint')}>
            <ChevronLeft size={17} />
          </CtlButton>
          <CtlButton onClick={toggleHideText} disabled={!live && !hideText} active={hideText} label={t('live.hide')} title={t('live.hideHint')}>
            <EyeOff size={15} />
          </CtlButton>
          <CtlButton onClick={toggleBlack} disabled={!live && !black} active={black} label={t('live.black')} title={t('live.blackHint')}>
            <MonitorOff size={15} />
          </CtlButton>
          <CtlButton
            onClick={next}
            disabled={!live && !service.items.some((i) => i.slides.length)}
            label={t('live.next')}
            title={live ? t('live.nextHint') : t('live.startHint')}
          >
            <ChevronRight size={17} />
          </CtlButton>
        </div>
        {showMetro && <MetronomeControl />}
      </div>

      <div className="mt-5 px-4">
        <div className="label-caps mb-2">{t('live.upNext')}</div>
        <SlideView
          slide={audienceSlide(upNext, nx?.item)}
          background={slideBackground(upNext, nx?.item, nextLook.background, state.mediaFit)}
          style={nextLook.style}
          aspect={state.aspect}
          thumbnail
          className="aspect-video w-full rounded-md opacity-80 ring-1 ring-line"
        />
        <div className="mt-1.5 flex h-5 items-center justify-between gap-2 text-[11.5px] text-muted">
          <span className="truncate">{nx ? nx.item.title : t('live.nothingNext')}</span>
          {upNext?.label && (
            <span className="shrink-0 font-medium text-accent-text" style={{ color: labelColor(upNext.label, state.labelColors) }}>
              {upNext.label}
            </span>
          )}
        </div>
      </div>

      {/* Keeps a usable height even when Preview, video controls and timers crowd the panel; scrolls inside. */}
      <div className="mt-5 flex min-h-[168px] flex-1 flex-col">
        <div className="label-caps px-4 pb-2">{t('live.serviceFlow')}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {service.items.map((it) => {
            if (it.kind === 'section')
              return (
                <div
                  key={it.id}
                  className="mt-2 truncate px-2 pb-0.5 pt-1 text-[10.5px] font-semibold uppercase tracking-wider first:mt-0"
                  style={{ color: it.color ?? SECTION_COLORS[0] }}
                >
                  {it.title}
                </div>
              )
            const isLive = live?.item.id === it.id
            return (
              <button
                key={it.id}
                onClick={() => it.slides.length && (state.clickMode === 'preview' ? state.setCue(it.id, 0) : goLive(it.id, 0))}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] ${
                  isLive ? 'bg-accent-soft text-fg ring-1 ring-accent/40' : 'text-muted hover:bg-panel-2 hover:text-fg'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-accent' : 'bg-dim'}`} />
                <span className="truncate">{it.title}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex h-10 items-center justify-between border-t border-line px-4 text-[13px] font-medium">
        <ServiceTimers clock={<Clock />} />
        <span className="text-[11px] text-dim">{state.aspect}</span>
      </div>
    </aside>
  )
}

function CtlButton({
  children,
  onClick,
  active,
  disabled,
  label,
  title
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-md border transition-colors disabled:cursor-default disabled:opacity-35 ${
        active
          ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
          : 'border-line bg-panel-2 text-fg/85 enabled:hover:bg-panel-3 enabled:hover:text-fg'
      }`}
    >
      {children}
      <span className="max-w-full truncate px-0.5 text-[10px] font-medium leading-none">{label}</span>
    </button>
  )
}
