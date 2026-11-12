import { useLayoutEffect, useRef, useState } from 'react'
import type { LiveFrame, Slide, StageFrame, StageLayout } from '@shared/types'
import SlideView from './SlideView'
import { mediaUrl } from '@/lib/media'
import { countdownText, countdownTitle, formatClock, useNow } from '@/lib/time'
import { formatTime, useT } from '@/i18n'
import FitText from './FitText'
import ChordText from './ChordText'
import { StageServiceTimer, StageSlideNotes } from './StageExtras'
import { StageBeatPips, StageEdgeFlash, StageTempoBadge } from './StageBeat'
import { transposeKey } from '@shared/chords'
import { parallelOf } from '@shared/bible'

// Performer-facing screen. Chrome is sized in "u" (see .stage in styles.css: 1u = the smaller of
// 1% of the height and 0.5625% of the width) and the text fills its box, so the same component
// works as a preview, on a wired monitor, and on a phone in portrait or landscape.

const u = (n: number): string => `calc(var(--u) * ${n})`

/** Presentation page picture of a slide, if it is one. */
const pageOf = (sl: Slide | null): string | null =>
  sl && !sl.text && sl.background?.kind === 'image' && sl.background.fit === 'contain' ? mediaUrl(sl.background.src) : null

/**
 * Largest text size per layout at 100%, in u. Long text still shrinks to fit. 100% is the original look (short
 * lines fill the screen); the slider goes smaller or larger from there.
 */
const MAIN_MAX: Record<StageLayout, number> = { standard: 30, lyrics: 39, chords: 30 }

/** 1u in px for this element (same formula as .stage in styles.css, including the portrait rule). */
function useUnitPx(ref: React.RefObject<HTMLDivElement | null>): number {
  const [px, setPx] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (): void => {
      const w = el.clientWidth
      const h = el.clientHeight
      setPx(Math.min(h / 100, w * (h > w ? 0.011 : 0.005625)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return px
}

export default function StageView({
  frame,
  audience,
  offset = 0,
  className
}: {
  frame: StageFrame
  /** The audience picture, for "Mirror audience screen". */
  audience?: LiveFrame | null
  offset?: number
  className?: string
}) {
  const now = useNow(offset, 500)
  const { t } = useT()
  const root = useRef<HTMLDivElement>(null)
  const unit = useUnitPx(root)
  const side = !!frame.countdown || !!frame.message
  const slide = frame.slide
  const page = pageOf(slide)
  const nextPage = pageOf(frame.next)
  const layout = frame.layout ?? 'standard'
  const scale = frame.scale ?? 1
  const titles = frame.showTitles ?? true
  // Lyrics only: never chords. Chords focus: always chords (standard letters if the operator turned them off).
  const chords = layout === 'lyrics' ? 'off' : layout === 'chords' && frame.chords === 'off' ? 'standard' : frame.chords
  const mainMax = unit ? Math.round(MAIN_MAX[layout] * unit * scale) : 600
  const nextMax = unit ? Math.round((layout === 'chords' ? 5 : 9) * unit * scale) : 200
  const showNext = frame.showNext && layout !== 'lyrics'
  const itemTime = frame.live && frame.itemStartedAt && frame.itemMinutes ? true : false
  // Beat pulse (songs with a BPM, when the operator turned it on): pips in the top bar, optionally a flashing frame.
  const pulse = frame.tempo && frame.beatPulse && frame.beatPulse !== 'off' ? frame.tempo : null
  // Lyrics only hides the bar when it has nothing to show; the service and item timers keep it.
  const topBar = layout !== 'lyrics' || titles || frame.showClock || !!frame.serviceStartedAt || itemTime || !!pulse
  const logo = frame.logo ? <img src={mediaUrl(frame.logo.src)} className="shrink-0 object-contain" style={{ height: u(5.2), maxWidth: u(16), opacity: frame.logo.opacity }} draggable={false} /> : null
  // Mirror: placed in the side panel, else at the end of the next strip, else in a row under the lyrics (never on top).
  const mirrorIn = !(frame.mirror && audience) ? null : side ? 'side' : showNext ? 'next' : 'row'
  const mirror = audience ? <MirrorBox audience={audience} offset={offset} byHeight={mirrorIn !== 'side'} /> : null

  return (
    <div ref={root} className={`stage relative flex h-full w-full flex-col bg-black text-white ${className ?? ''}`}>
      {/* top bar */}
      {topBar && (
      <div className="flex shrink-0 items-center border-b border-white/10" style={{ height: u(8), gap: u(1.6), padding: `0 ${u(2.4)}` }}>
        {logo}
        {frame.live && (
          <span className="shrink-0 whitespace-nowrap rounded bg-red-600 font-bold uppercase tracking-wider" style={{ fontSize: u(2.6), padding: `${u(0.3)} ${u(1)}` }}>
            {t('stage.view.live')}
          </span>
        )}
        <span className="min-w-0 truncate font-semibold text-white/85" style={{ fontSize: u(3.2) }}>
          {titles ? frame.itemTitle : ''}
        </span>
        {slide?.label && (
          <span className="shrink-0 font-semibold uppercase text-[#a99dff]" style={{ fontSize: u(2.7) }}>
            {slide.label}
          </span>
        )}
        {chords !== 'off' && frame.key && (
          <span className="shrink-0 whitespace-nowrap rounded font-bold text-amber-300 ring-1 ring-amber-300/40" style={{ fontSize: u(2.5), padding: `${u(0.2)} ${u(0.8)}` }}>
            {t('stage.view.key', { key: transposeKey(frame.key, frame.transpose) ?? frame.key })}
            {frame.transpose ? ` (${frame.transpose > 0 ? '+' : ''}${frame.transpose})` : ''}
          </span>
        )}
        {frame.tempo && <StageTempoBadge tempo={frame.tempo} />}
        {pulse && <StageBeatPips tempo={pulse} offset={offset} />}
        <span className="flex-1" />
        {frame.showClock && (
          <span className="shrink-0 font-semibold tabular-nums text-white/85" style={{ fontSize: u(3.8) }}>
            {formatTime(now)}
          </span>
        )}
        {itemTime ? <StageItemTime since={frame.itemStartedAt!} minutes={frame.itemMinutes!} now={now} /> : null}
        {frame.serviceStartedAt ? <StageServiceTimer since={frame.serviceStartedAt} now={now} /> : null}
      </div>
      )}
      {pulse && frame.beatPulse === 'edge' && <StageEdgeFlash tempo={pulse} offset={offset} />}
      {!topBar && logo && (
        <div className="absolute z-[4]" style={{ left: u(1.6), top: u(1.4) }}>
          {logo}
        </div>
      )}

      <div className="stage-body flex min-h-0 flex-1">
        {/* current + next */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {page ? (
            <PageWithNotes src={page} notes={slide?.notes} />
          ) : !slide || !slide.text ? (
            // Nothing live (countdown, between items) or a blank slide: a quiet screen, never big grey words.
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {!slide && (
                <span className="font-semibold tracking-wider text-white/25" style={{ fontSize: u(2.6) }}>
                  {t('stage.view.standingBy')}
                </span>
              )}
            </div>
          ) : (
          <FitText
            deps={[slide?.text, slide?.reference, slide?.parallel, chords, frame.transpose, frame.key, mainMax]}
            max={mainMax}
            className="flex flex-1 items-center justify-center"
            style={{ padding: `${u(2)} ${u(3)}`, textAlign: 'center', fontWeight: 700, whiteSpace: 'pre-line', ...(slide?.parallel ? { width: '100%' } : {}) }}
          >
            {!slide ? null : slide.parallel ? (
              <div className="flex items-center" style={{ gap: '0.8em' }}>
                {[{ text: slide.text, reference: slide.reference }, ...parallelOf(slide)].map((col, i) => (
                  <div key={i} className={`min-w-0 flex-1 ${i ? 'border-l border-white/20 pl-[0.8em]' : ''}`}>
                    {col.text}
                    <div className="mt-[0.3em] text-[0.45em] font-medium text-white/60">{col.reference}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <ChordText text={slide.text} mode={chords} songKey={frame.key} transpose={frame.transpose} />
                {slide.reference && <div className="mt-[0.3em] text-[0.45em] font-medium text-white/60">{slide.reference}</div>}
              </div>
            )}
          </FitText>
          )}
          {!page && slide?.notes ? <StageSlideNotes notes={slide.notes} /> : null}

          {showNext && (
            <div className="flex shrink-0 border-t border-white/10" style={{ height: layout === 'chords' ? '13%' : '27%' }}>
            <div
              className={`flex min-w-0 flex-1 ${layout === 'chords' ? 'items-center' : 'flex-col'}`}
              style={{ padding: `${u(1.2)} ${u(2.4)}`, gap: layout === 'chords' ? u(2) : undefined }}
            >
              <div className="flex shrink-0 items-center text-white/45" style={{ fontSize: u(2.3), gap: u(1) }}>
                <span className="shrink-0 whitespace-nowrap font-bold uppercase tracking-wider">{t('stage.view.next')}</span>
                {frame.next?.label && <span className="font-semibold uppercase text-[#a99dff]/70">{frame.next.label}</span>}
                {titles && frame.nextItemTitle && <span className="truncate font-semibold text-amber-300/90">▸ {frame.nextItemTitle}</span>}
              </div>
              {nextPage ? (
                <div className="flex min-h-0 flex-1 items-center" style={{ gap: u(2), paddingTop: u(0.8) }}>
                  <img src={nextPage} className="h-full max-w-[45%] rounded object-contain opacity-75" draggable={false} />
                  {frame.next?.notes && (
                    <div className="line-clamp-3 min-w-0 flex-1 text-white/50" style={{ fontSize: u(2.6) }}>
                      {frame.next.notes}
                    </div>
                  )}
                </div>
              ) : frame.next?.text ? (
                <FitText
                  deps={[frame.next.text, chords, frame.nextTranspose, nextMax, layout]}
                  max={nextMax}
                  className="flex-1 self-stretch"
                  style={{
                    fontWeight: 600,
                    // Chords focus: the next slide on one line, so the strip stays thin.
                    whiteSpace: layout === 'chords' ? 'nowrap' : 'pre-line',
                    color: 'rgb(255 255 255 / .6)',
                    paddingTop: layout === 'chords' ? 0 : u(0.6)
                  }}
                >
                  <div>
                    <ChordText
                      text={layout === 'chords' ? frame.next.text.replace(/\s*\n\s*/g, '  ·  ') : frame.next.text}
                      mode={chords}
                      songKey={frame.nextKey}
                      transpose={frame.nextTranspose}
                      color="rgb(252 211 77 / .7)"
                    />
                  </div>
                </FitText>
              ) : (
                <div className="text-white/35" style={{ fontSize: u(3), paddingTop: u(1) }}>
                  {frame.next ? t('stage.view.blankSlide') : t('stage.view.endOfService')}
                </div>
              )}
            </div>
            {mirrorIn === 'next' && (
              <div className="flex shrink-0" style={{ padding: `${u(1.2)} ${u(1.6)} ${u(1.2)} 0` }}>
                {mirror}
              </div>
            )}
            </div>
          )}
          {mirrorIn === 'row' && (
            <div className="flex shrink-0 justify-end" style={{ height: '24%', padding: `0 ${u(1.6)} ${u(1.6)}` }}>
              {mirror}
            </div>
          )}
        </div>

        {/* countdown and operator message */}
        {side && (
          <div className="stage-side flex shrink-0 flex-col border-white/10" style={{ gap: u(1.6), padding: u(1.6) }}>
            {frame.countdown && <StageCountdown frame={frame} now={now} />}
            {frame.message && (
              // Keyed by the text: a new message flashes 3 times (or until cleared).
              <div
                key={frame.message}
                className={`flex min-h-0 flex-1 flex-col rounded-[0.6em] bg-amber-400 text-black ${frame.messageFlash ? 'stage-flash-forever' : 'stage-flash'}`}
                style={{ padding: u(1.6) }}
              >
                <div className="shrink-0 truncate font-bold uppercase tracking-wider opacity-60" style={{ fontSize: u(2.2), textAlign: frame.messageAlign ?? 'center' }}>
                  {t('stage.view.message')}
                </div>
                <FitText
                  deps={[frame.message, frame.messageAlign]}
                  max={160}
                  className={`flex flex-1 items-center ${frame.messageAlign === 'left' ? 'justify-start' : frame.messageAlign === 'right' ? 'justify-end' : 'justify-center'}`}
                  style={{ fontWeight: 800, textAlign: frame.messageAlign ?? 'center' }}
                >
                  {frame.message}
                </FitText>
              </div>
            )}
            {mirrorIn === 'side' && mirror}
          </div>
        )}
      </div>
    </div>
  )
}

/** "Mirror audience screen": what the audience sees, in space kept free for it (it never covers the words). */
function MirrorBox({ audience, offset, byHeight }: { audience: LiveFrame; offset: number; byHeight: boolean }) {
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-[0.4em] ring-1 ring-white/25 ${byHeight ? 'h-full' : 'w-full'}`}
      style={{ aspectRatio: audience.aspect === '16:9' ? '16 / 9' : '4 / 3' }}
    >
      <SlideView
        slide={audience.slide}
        background={audience.background}
        style={audience.style}
        aspect={audience.aspect}
        hideText={audience.hideText}
        black={audience.black}
        countdown={audience.countdown}
        logo={audience.logo}
        caption={audience.caption ?? null}
        clockOffset={offset}
        liveSources={false}
        className="h-full w-full"
      />
    </div>
  )
}

/** "12:34 left" for the live item's planned minutes: amber in the last 2 minutes, red and counting up when over. */
function StageItemTime({ since, minutes, now }: { since: number; minutes: number; now: number }) {
  const left = minutes * 60_000 - (now - since)
  const tone = left < 0 ? 'text-red-400' : left <= 120_000 ? 'text-amber-300' : 'text-white/85'
  const { t } = useT()
  return (
    <span className={`flex shrink-0 flex-col items-end leading-none ${tone}`} title={t('stage.view.itemTimeHint')}>
      <span className="whitespace-nowrap font-bold uppercase tracking-wider opacity-60" style={{ fontSize: u(1.7) }}>
        {left < 0 ? t('stage.view.over') : t('stage.view.item')}
      </span>
      <span className="whitespace-nowrap font-semibold tabular-nums" style={{ fontSize: u(3.4) }}>
        {left < 0 ? formatClock(left) : t('stage.view.left', { time: formatClock(left) })}
      </span>
    </span>
  )
}

/** A presentation page on stage, with the speaker notes beside it (or under it on tall screens). */
function PageWithNotes({ src, notes }: { src: string; notes?: string }) {
  const { t } = useT()
  return (
    <div className="stage-page flex min-h-0 flex-1" style={{ gap: u(2.4), padding: `${u(2)} ${u(2.4)}` }}>
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
        <img src={src} className="max-h-full max-w-full rounded-[0.4em] object-contain ring-1 ring-white/10" draggable={false} />
      </div>
      {notes && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[0.6em] bg-white/[.06]" style={{ padding: u(1.6) }}>
          <div className="shrink-0 font-bold uppercase tracking-wider text-white/45" style={{ fontSize: u(2.2) }}>
            {t('stage.view.notes')}
          </div>
          <FitText deps={[notes]} max={90} className="flex-1" style={{ fontWeight: 600, whiteSpace: 'pre-line', lineHeight: 1.3, paddingTop: u(0.6) }}>
            {notes}
          </FitText>
        </div>
      )}
    </div>
  )
}

function StageCountdown({ frame, now }: { frame: StageFrame; now: number }) {
  const c = frame.countdown!
  const { text, over } = countdownText(c, now)
  const { t } = useT()
  return (
    <div className="stage-countdown flex shrink-0 flex-col rounded-[0.6em] bg-white/[.07] text-center" style={{ padding: u(1.4) }}>
      <div className="truncate font-semibold text-white/55" style={{ fontSize: u(2.4) }}>
        {c.mode === 'clock' ? t('stage.view.time') : countdownTitle(c.title) || t('stage.view.countdown')}
      </div>
      <FitText
        deps={[text.length]}
        max={300}
        className="min-h-[3em] flex-1"
        style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: over ? '#f87171' : '#fff' }}
      >
        {text}
      </FitText>
      {c.status === 'paused' && (
        <div className="font-semibold uppercase text-amber-300" style={{ fontSize: u(2.2) }}>
          {t('stage.view.paused')}
        </div>
      )}
    </div>
  )
}
