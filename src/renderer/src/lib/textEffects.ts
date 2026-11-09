import type { CSSProperties } from 'react'
import type { TextStyle } from '@shared/types'

// Text effects shared by the projector, previews and the OBS overlay. Sizes are in em so they scale with the text.

const SHADOWS: Record<TextStyle['shadowStrength'], string> = {
  soft: '0 0.03em 0.12em rgba(0,0,0,.45)',
  medium: '0 0.05em 0.22em rgba(0,0,0,.65), 0 0.025em 0.05em rgba(0,0,0,.6)',
  strong: '0 0.05em 0.25em rgba(0,0,0,.9), 0 0.03em 0.06em rgba(0,0,0,.95), 0 0 0.03em #000'
}

/** "#rrggbb" + opacity → "rgba(r,g,b,a)". */
export function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0')
  const n = parseInt(full.slice(0, 6), 16) || 0
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/** Italic, spacing, outline, glow and shadow. `shadow: false` leaves the shadow to the caller. */
export function textEffects(style: TextStyle, opts: { shadow?: boolean } = {}): CSSProperties {
  const shadows: string[] = []
  if (opts.shadow !== false && style.shadow) shadows.push(SHADOWS[style.shadowStrength ?? 'medium'])
  const glow = style.glow ?? 0
  if (glow > 0) {
    const c = style.glowColor ?? '#ffffff'
    shadows.push(`0 0 ${(glow * 0.035).toFixed(3)}em ${c}`, `0 0 ${(glow * 0.09).toFixed(3)}em ${rgba(c, 0.7)}`)
  }
  const outline = style.outline ?? 0
  return {
    fontStyle: style.italic ? 'italic' : 'normal',
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}em` : undefined,
    textShadow: shadows.length ? shadows.join(', ') : 'none',
    // The stroke is drawn under the fill, so only its outer half shows: the letters keep their shape.
    ...(outline > 0
      ? { WebkitTextStroke: `${(outline * 0.024).toFixed(3)}em ${style.outlineColor ?? '#000'}`, paintOrder: 'stroke fill' }
      : {})
  }
}

/** Background box behind each line of text (used for textBg 'line'). */
export function lineBackground(style: TextStyle): CSSProperties {
  return {
    background: rgba(style.textBgColor ?? '#000000', style.textBgOpacity ?? 0.55),
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
    padding: '0.04em 0.28em',
    borderRadius: '0.12em'
  }
}
