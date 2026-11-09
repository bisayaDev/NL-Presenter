// Operator window look: accent color and interface size. Never used by output, stage or phone pages.

export const DEFAULT_ACCENT = '#7c6cff'

export const ACCENT_PRESETS: { name: string; color: string }[] = [
  { name: 'Violet', color: '#7c6cff' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Teal', color: '#14b8a6' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Amber', color: '#f59e0b' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Rose', color: '#f43f5e' }
]

export { ZOOM_STEPS } from '@shared/appearance'

const isHex = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = (c: number[]): string => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
const luminance = (c: number[]): number => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

const DARK_TEXT = '#0b0d12'

/**
 * Fill and label colors for filled accent buttons, keeping the label at 4.5:1 (WCAG AA).
 * White text when the accent allows it, or after darkening the fill by at most 25%
 * (violet, blue, rose); otherwise dark text on the accent itself (teal, green, amber, orange).
 */
export function accentButton(color: string): { fill: string; on: string } {
  const base = rgb(color)
  for (let k = 0; k <= 0.25; k += 0.01) {
    const c = base.map((v) => v * (1 - k))
    if (contrast(1, luminance(c)) >= 4.5) return { fill: toHex(c), on: '#ffffff' }
  }
  return { fill: color.toLowerCase(), on: DARK_TEXT }
}

/** Accent as text: mixed toward white until it keeps 4.5:1 on panel-3 (#222734), the lightest surface. */
export function accentText(color: string): string {
  const base = rgb(color)
  const surface = luminance(rgb('#222734'))
  for (let k = 0; k <= 1; k += 0.02) {
    const c = base.map((v) => v + (255 - v) * k)
    if (contrast(luminance(c), surface) >= 4.5) return toHex(c)
  }
  return '#ffffff'
}

/** Set the accent tokens on this window only. */
export function applyAccent(color: unknown): void {
  const c = isHex(color) ? color : DEFAULT_ACCENT
  const root = document.documentElement.style
  if (c.toLowerCase() === DEFAULT_ACCENT) {
    for (const p of ['--color-accent', '--color-accent-soft', '--color-accent-text', '--color-accent-fill', '--color-on-accent'])
      root.removeProperty(p)
    return
  }
  const [r, g, b] = rgb(c)
  const btn = accentButton(c)
  root.setProperty('--color-accent', c)
  root.setProperty('--color-accent-soft', `rgb(${r} ${g} ${b} / 0.14)`)
  root.setProperty('--color-accent-text', accentText(c))
  root.setProperty('--color-accent-fill', btn.fill)
  root.setProperty('--color-on-accent', btn.on)
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

/** Apply now, save shortly after (the color picker fires on every drag step). */
export function saveAccent(color: string): void {
  applyAccent(color)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void window.nl.data.setSetting('accent', color.toLowerCase()), 300)
}
