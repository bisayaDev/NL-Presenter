import { useEffect, useRef, useState } from 'react'
import { beatPhase, tempoLabel, type StageTempo } from '@shared/tempo'
import { useT } from '@/i18n'

// Beat pulse on stage screens (never on the audience screen or the overlay). The phase comes from the shared beat
// clock (StageTempo.startedAt, operator clock) plus this screen's clock offset, so every screen pulses together. Drawn
// with requestAnimationFrame straight onto the DOM: no React render per beat, no timer drift.

const u = (n: number): string => `calc(var(--u) * ${n})`

const DOWNBEAT = '252 211 77' // amber-300
const BEAT = '255 255 255'
const REDUCED = '(prefers-reduced-motion: reduce)'

/** True when the system asks for less motion: then no flashing, a steady beat counter instead. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => !!window.matchMedia?.(REDUCED).matches)
  useEffect(() => {
    const query = window.matchMedia?.(REDUCED)
    if (!query) return
    const on = (): void => setReduced(query.matches)
    query.addEventListener('change', on)
    return () => query.removeEventListener('change', on)
  }, [])
  return reduced
}

/** Calls `draw` on every animation frame with the beat in the bar and how far into it (0–1). */
function useBeatFrames(tempo: StageTempo, offset: number, draw: (beat: number, frac: number) => void): void {
  const ref = useRef(draw)
  ref.current = draw
  useEffect(() => {
    let raf = 0
    const tick = (): void => {
      const p = beatPhase(tempo, Date.now() + offset)
      ref.current(p.beat, p.frac)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [tempo.bpm, tempo.beatsPerBar, tempo.startedAt, offset])
}

/** Light that falls off quickly after the beat (1 on the beat, 0 after a quarter of it). */
const glow = (frac: number): number => Math.max(0, 1 - frac * 4)

/** "72 BPM · 4/4" badge for the top bar. */
export function StageTempoBadge({ tempo }: { tempo: StageTempo }) {
  return (
    <span className="shrink-0 whitespace-nowrap rounded font-bold tabular-nums text-sky-300 ring-1 ring-sky-300/40" style={{ fontSize: u(2.5), padding: `${u(0.2)} ${u(0.8)}` }}>
      {tempoLabel(tempo.bpm, tempo.time)}
    </span>
  )
}

/**
 * One pip per beat, the current one lit and fading; beat 1 is amber and larger. With reduced motion: the beat number,
 * steady (it changes on each beat but never flashes).
 */
export function StageBeatPips({ tempo, offset }: { tempo: StageTempo; offset: number }) {
  const { t } = useT()
  const reduced = useReducedMotion()
  const pips = useRef<(HTMLSpanElement | null)[]>([])
  const counter = useRef<HTMLSpanElement>(null)
  const count = Math.min(tempo.beatsPerBar, 12)
  useBeatFrames(tempo, offset, (beat, frac) => {
    if (reduced) {
      const text = String(beat + 1)
      if (counter.current && counter.current.textContent !== text) counter.current.textContent = text
      return
    }
    const g = glow(frac)
    pips.current.forEach((el, i) => {
      if (!el) return
      const on = i === beat % count
      const rgb = i === 0 ? DOWNBEAT : BEAT
      el.style.backgroundColor = `rgb(${rgb} / ${on ? 0.3 + 0.7 * g : 0.18})`
      el.style.transform = `scale(${on ? 1 + 0.35 * g : 1})`
      el.style.boxShadow = on && g > 0 ? `0 0 ${(g * 1.2).toFixed(2)}em rgb(${rgb} / ${(0.8 * g).toFixed(2)})` : 'none'
    })
  })
  if (reduced)
    return (
      <span
        ref={counter}
        title={t('stage.view.beatHint')}
        className="shrink-0 rounded font-bold tabular-nums text-sky-300 ring-1 ring-sky-300/40"
        style={{ fontSize: u(2.5), padding: `${u(0.2)} ${u(0.8)}`, minWidth: u(4), textAlign: 'center' }}
      >
        1
      </span>
    )
  return (
    <span className="flex shrink-0 items-center" style={{ gap: u(0.7) }} title={t('stage.view.beatHint')} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            pips.current[i] = el
          }}
          className="block rounded-full"
          style={{ width: u(i === 0 ? 1.9 : 1.4), height: u(i === 0 ? 1.9 : 1.4), fontSize: u(1.6), willChange: 'transform' }}
        />
      ))}
    </span>
  )
}

/** A thin frame round the whole stage screen that flashes on each beat (amber and brighter on beat 1). For drummers. */
export function StageEdgeFlash({ tempo, offset }: { tempo: StageTempo; offset: number }) {
  const reduced = useReducedMotion()
  const el = useRef<HTMLDivElement>(null)
  useBeatFrames(tempo, offset, (beat, frac) => {
    if (!el.current || reduced) return
    const g = glow(frac)
    const down = beat === 0
    el.current.style.opacity = (g * (down ? 1 : 0.6)).toFixed(3)
    el.current.style.borderColor = `rgb(${down ? DOWNBEAT : BEAT})`
  })
  if (reduced) return null
  return <div ref={el} aria-hidden className="pointer-events-none absolute inset-0 z-[5]" style={{ borderStyle: 'solid', borderWidth: u(0.9), opacity: 0 }} />
}
