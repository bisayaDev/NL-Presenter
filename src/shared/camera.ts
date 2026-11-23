import type { CameraLook, CameraOverlay } from './types'

// Camera framing and the camera overlay: defaults and clean-up of saved settings.

export const DEFAULT_CAMERA_LOOK: CameraLook = {
  zoom: 1,
  x: 0.5,
  y: 0.5,
  fit: 'cover',
  mirror: false,
  flip: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  grayscale: false,
  blur: 0
}

export const DEFAULT_CAMERA_OVERLAY: CameraOverlay = {
  on: false,
  deviceId: '',
  layout: 'pip',
  corner: 'br',
  size: 32,
  side: 'left',
  rounded: true,
  border: false,
  sound: false
}

const clamp = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)

/** A saved look made safe: every field present and in range. */
export function cleanLook(v: Partial<CameraLook> | undefined): CameraLook {
  const d = DEFAULT_CAMERA_LOOK
  const l = v ?? {}
  return {
    zoom: clamp(l.zoom, 1, 4, d.zoom),
    x: clamp(l.x, 0, 1, d.x),
    y: clamp(l.y, 0, 1, d.y),
    fit: l.fit === 'contain' ? 'contain' : 'cover',
    mirror: l.mirror === true,
    flip: l.flip === true,
    brightness: clamp(l.brightness, 30, 200, d.brightness),
    contrast: clamp(l.contrast, 30, 200, d.contrast),
    saturation: clamp(l.saturation, 0, 200, d.saturation),
    warmth: clamp(l.warmth, -100, 100, d.warmth),
    grayscale: l.grayscale === true,
    blur: clamp(l.blur, 0, 40, d.blur)
  }
}

/** Same as the default (nothing to save)? */
export const isDefaultLook = (l: CameraLook): boolean => JSON.stringify(cleanLook(l)) === JSON.stringify(DEFAULT_CAMERA_LOOK)

/** Saved overlay settings made safe. It always starts switched off. */
export function cleanOverlay(v: Partial<CameraOverlay> | undefined): CameraOverlay {
  const d = DEFAULT_CAMERA_OVERLAY
  const o = v ?? {}
  return {
    on: false,
    deviceId: typeof o.deviceId === 'string' ? o.deviceId : '',
    ...(typeof o.label === 'string' ? { label: o.label } : {}),
    layout: o.layout === 'side' || o.layout === 'behind' ? o.layout : 'pip',
    corner: o.corner === 'tl' || o.corner === 'tr' || o.corner === 'bl' ? o.corner : 'br',
    size: clamp(o.size, 15, 60, d.size),
    side: o.side === 'right' ? 'right' : 'left',
    rounded: o.rounded !== false,
    border: o.border === true,
    sound: o.sound === true
  }
}
