import type { CSSProperties } from 'react'
import type { LoopDefinition, LoopPattern, LoopShape, LoopSpark } from '@shared/loops'

// Draws a background loop: a gradient base, blurred colour layers, optional patterns, twinkles, prism lines,
// then smoke, vignette and grain. Animations are in styles.css (.nl-loop-*). Sizes are in px for the
// 1920-wide virtual stage, so render it inside SlideView's stage. `still` freezes it (thumbnails).

const RADIUS: Record<LoopShape, string> = {
  round: '50%',
  'organic-a': '58% 42% 68% 32% / 44% 60% 40% 56%',
  'organic-b': '34% 66% 42% 58% / 62% 36% 64% 38%',
  'organic-c': '72% 28% 54% 46% / 36% 52% 48% 64%',
  veil: '42% 58% 48% 52% / 18% 22% 78% 82%',
  band: '32% 68% 70% 30% / 46% 44% 56% 54%'
}

function patternCss(p: LoopPattern): { background: string; backgroundSize: string } {
  const c = p.color
  const w = p.strokeWidth
  const t = p.scale
  const svg = (width: number, height: number, body: string): string =>
    `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>${body}</svg>`
    )}")`
  switch (p.kind) {
    case 'grid':
      return {
        background: `linear-gradient(${c} ${w}px, transparent ${w}px), linear-gradient(90deg, ${c} ${w}px, transparent ${w}px)`,
        backgroundSize: `${t}px ${t}px`
      }
    case 'dot-grid':
      return { background: `radial-gradient(${c} ${w}px, transparent ${w + 1}px)`, backgroundSize: `${t}px ${t}px` }
    case 'diagonal':
      return { background: `repeating-linear-gradient(45deg, ${c} 0 ${w}px, transparent ${w}px ${t}px)`, backgroundSize: 'auto' }
    case 'crosshatch':
      return {
        background: `repeating-linear-gradient(45deg, ${c} 0 ${w}px, transparent ${w}px ${t}px), repeating-linear-gradient(-45deg, ${c} 0 ${w}px, transparent ${w}px ${t}px)`,
        backgroundSize: 'auto'
      }
    case 'concentric':
      return {
        background: `repeating-radial-gradient(circle at 50% 50%, transparent 0 ${t - w}px, ${c} ${t - w}px ${t}px)`,
        backgroundSize: 'auto'
      }
    case 'triangles': {
      const h = Math.round(0.88 * t)
      return {
        background: svg(t, h, `<path d='M${t / 2} 0 L${t} ${h} L0 ${h} Z' fill='none' stroke='${c}' stroke-width='${w}'/>`),
        backgroundSize: `${t}px ${h}px`
      }
    }
    default: {
      const h = Math.round(0.6 * t)
      const wave = (y: number, a: number, b: number, extra = ''): string =>
        `<path d='M0 ${y * h} C ${0.3 * t} ${a * h} ${0.7 * t} ${b * h} ${t} ${y * h}' fill='none' stroke='${c}' stroke-width='${w}'${extra}/>`
      return {
        background: svg(t, h, wave(0.35, 0.02, 0.68) + wave(0.75, 0.42, 1.08, " opacity='0.55'")),
        backgroundSize: `${t}px ${h}px`
      }
    }
  }
}

const sparkStyle = (s: LoopSpark): CSSProperties => ({
  left: `${s.x}%`,
  top: `${s.y}%`,
  width: `${s.size}%`,
  height: `${s.size}%`,
  opacity: s.opacity,
  animationDuration: `${s.duration}s`,
  animationDelay: `${s.delay}s`
})

export default function LoopView({ def, still }: { def: LoopDefinition; still?: boolean }) {
  const base = `linear-gradient(${def.background.angle}deg, ${def.background.stops.map((s) => `${s.color} ${s.position}%`).join(', ')})`
  const prism = def.effects.prismLines
  const gap = prism ? Math.max(6, 42 - prism.density) : 0
  return (
    <div className={`nl-loop ${still ? 'nl-loop--still' : ''}`} style={{ background: base }}>
      {def.layers.map((l, i) => (
        <span
          key={`l${i}`}
          className={`nl-loop-layer nl-loop-m-${l.motion}`}
          style={{
            left: `${l.x - l.width / 2}%`,
            top: `${l.y - l.height / 2}%`,
            width: `${l.width}%`,
            height: `${l.height}%`,
            background: `radial-gradient(ellipse at center, ${l.color} 0%, ${l.color} 36%, transparent 76%)`,
            opacity: l.opacity,
            borderRadius: RADIUS[l.shape],
            filter: `blur(${l.blur}px)`,
            mixBlendMode: l.blendMode,
            animationDuration: `${l.duration}s`,
            animationDelay: `${l.delay}s`,
            animationDirection: l.direction
          }}
        />
      ))}
      {prism && (
        <span
          className="nl-loop-prism"
          style={{
            opacity: prism.opacity,
            background: `linear-gradient(90deg, rgba(0,0,0,.74), transparent 10%, transparent 90%, rgba(0,0,0,.76)), repeating-linear-gradient(90deg, rgba(0,0,0,.44) 0 1px, rgba(0,0,0,.15) 1px 2px, transparent 2px ${gap}px)`
          }}
        />
      )}
      {def.effects.starfield.map((s, i) => (
        <span key={`s${i}`} className="nl-loop-star" style={sparkStyle(s)} />
      ))}
      {def.effects.dotfield.map((s, i) => (
        <span key={`d${i}`} className="nl-loop-dot" style={sparkStyle(s)} />
      ))}
      {def.patterns.map((p, i) => {
        const css = patternCss(p)
        return (
          <span
            key={`p${i}`}
            className={`nl-loop-pattern nl-loop-m-${p.motion}`}
            style={{
              background: css.background,
              backgroundSize: css.backgroundSize,
              opacity: p.opacity,
              mixBlendMode: p.blendMode,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`
            }}
          />
        )
      })}
      <span className="nl-loop-smoke" />
      <span className="nl-loop-vignette" style={{ opacity: def.overlay.vignette }} />
      <span className="nl-loop-grain" style={{ opacity: def.overlay.grain }} />
    </div>
  )
}
