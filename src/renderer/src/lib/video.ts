import type { Transition, VideoPlayback } from '@shared/types'

export const DEFAULT_TRANSITION: Transition = { kind: 'fade', ms: 400 }

export type VideoCommand =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'restart' }
  | { type: 'seek'; t: number } // seconds
  | { type: 'mute'; on?: boolean } // no value: toggle
  | { type: 'loop'; on?: boolean }

/** Where the video should be now (seconds). Unknown duration: the raw position. */
export function videoPosition(v: VideoPlayback, now: number, duration?: number): number {
  const raw = v.playing ? v.offset + (now - v.startedAt) / 1000 : v.offset
  if (!duration || !isFinite(duration) || duration <= 0) return Math.max(0, raw)
  if (v.loop) return ((raw % duration) + duration) % duration
  return Math.min(Math.max(0, raw), duration)
}

/** Has a video that plays once reached its end? */
export function videoEnded(v: VideoPlayback, now: number, duration?: number): boolean {
  return !v.loop && !!duration && v.playing && v.offset + (now - v.startedAt) / 1000 >= duration - 0.05
}

export function applyVideoCommand<T extends VideoPlayback & { duration?: number }>(v: T, cmd: VideoCommand, now: number): T {
  const pos = videoPosition(v, now, v.duration)
  switch (cmd.type) {
    case 'play':
      if (v.playing) return v
      // Play after the end of a video that plays once: start over.
      return { ...v, playing: true, startedAt: now, offset: !v.loop && v.duration && pos >= v.duration - 0.1 ? 0 : pos }
    case 'pause':
      return v.playing ? { ...v, playing: false, offset: pos } : v
    case 'toggle':
      return applyVideoCommand(v, { type: v.playing ? 'pause' : 'play' }, now)
    case 'restart':
      return { ...v, playing: true, startedAt: now, offset: 0 }
    case 'seek': {
      const t = Math.max(0, v.duration ? Math.min(cmd.t, v.duration) : cmd.t)
      return { ...v, startedAt: now, offset: t }
    }
    case 'mute':
      return { ...v, muted: cmd.on ?? !v.muted }
    case 'loop':
      // Re-anchor at the current position so the picture doesn't jump.
      return { ...v, loop: cmd.on ?? !v.loop, startedAt: now, offset: pos }
  }
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

/** Read a video file's length without playing it. */
export function probeDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    const done = (d: number | null): void => {
      v.removeAttribute('src')
      v.load()
      resolve(d)
    }
    v.onloadedmetadata = () => done(isFinite(v.duration) ? v.duration : null)
    v.onerror = () => done(null)
    v.src = url
  })
}
