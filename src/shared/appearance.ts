/** Interface size presets for the operator window (zoom factors). Ctrl/Cmd + = / - / 0 steps through them. */
export const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25]

/** Snap a saved value to the nearest preset (1 when missing or invalid). */
export function snapZoom(v: unknown): number {
  if (typeof v !== 'number' || !isFinite(v)) return 1
  return ZOOM_STEPS.reduce((best, z) => (Math.abs(z - v) < Math.abs(best - v) ? z : best), 1)
}

/** Next preset up (+1) or down (-1) from the current factor. */
export function stepZoom(current: number, dir: 1 | -1): number {
  const i = ZOOM_STEPS.indexOf(snapZoom(current))
  return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir))]
}
