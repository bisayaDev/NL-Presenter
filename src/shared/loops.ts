// Background loops: animated, lyric-safe backgrounds drawn with CSS (no video file).
// Loop packs are JSON files. Besides NLPresenter's own format this reads the "background loop pack"
// JSON exported by G-Presenter's loop library, so existing loop collections can be imported as-is.
//
// Everything read from a file goes through sanitizeLoop(): colours are limited to plain colour syntax and
// numbers are clamped, so a crafted file cannot inject CSS (url(), extra declarations) into the screens.

export type LoopMotion = 'drift' | 'curl' | 'rise' | 'pulse' | 'wisp' | 'billow'
export type LoopBlend = 'screen' | 'overlay' | 'multiply' | 'soft-light' | 'normal'
export type LoopShape = 'round' | 'organic-a' | 'organic-b' | 'organic-c' | 'veil' | 'band'
export type LoopPatternKind = 'grid' | 'dot-grid' | 'diagonal' | 'crosshatch' | 'concentric' | 'triangles' | 'bezier-waves'

export interface LoopLayer {
  color: string
  opacity: number
  x: number // centre, % of width
  y: number // centre, % of height
  width: number // %
  height: number // %
  blur: number // px on the 1920-wide stage
  shape: LoopShape
  blendMode: LoopBlend
  motion: LoopMotion
  duration: number // s
  delay: number // s
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
}

export interface LoopPattern {
  kind: LoopPatternKind
  color: string
  opacity: number
  scale: number // px
  strokeWidth: number // px
  motion: LoopMotion
  blendMode: LoopBlend
  duration: number
  delay: number
}

/** A twinkling star or dot. */
export interface LoopSpark {
  x: number
  y: number
  size: number
  opacity: number
  duration: number
  delay: number
}

export interface LoopDefinition {
  background: { angle: number; stops: { color: string; position: number }[] }
  layers: LoopLayer[]
  patterns: LoopPattern[]
  effects: {
    prismLines?: { opacity: number; density: number }
    starfield: LoopSpark[]
    dotfield: LoopSpark[]
  }
  overlay: { vignette: number; grain: number }
}

export interface LoopRecord {
  id: string
  name: string
  category: string
  tags: string[]
  definition: LoopDefinition
}

export const NL_LOOP_FORMAT = 'nlpresenter-background-loops'

// ---------- sanitising ----------

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

const num = (v: unknown, min: number, max: number, def: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], def: T): T =>
  allowed.includes(v as T) ? (v as T) : def

const COLOR = [
  /^#[0-9a-f]{3,8}$/i,
  /^(rgb|rgba|hsl|hsla)\(\s*[-+\d.%\s,/a-z]{1,60}\)$/i, // digits, %, deg, separators only (checked below)
  /^[a-z]{3,24}$/i // named colours and "transparent"
]

export function safeColor(v: unknown, def = '#000000'): string {
  if (typeof v !== 'string') return def
  const c = v.trim()
  if (!COLOR.some((re) => re.test(c))) return def
  // Function syntax: allow only unit letters, never nested functions or url().
  if (c.includes('(') && /[a-z]{4,}/i.test(c.slice(c.indexOf('(') + 1))) return def
  return c
}

const text = (v: unknown, max: number, def = ''): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) || def : def

const list = <T>(v: unknown, max: number, f: (x: unknown) => T | null): T[] =>
  Array.isArray(v) ? v.slice(0, max).map(f).filter((x): x is T => x !== null) : []

const MOTIONS = ['drift', 'curl', 'rise', 'pulse', 'wisp', 'billow'] as const
const BLENDS = ['screen', 'overlay', 'multiply', 'soft-light', 'normal'] as const
const SHAPES = ['round', 'organic-a', 'organic-b', 'organic-c', 'veil', 'band'] as const
const PATTERNS = ['grid', 'dot-grid', 'diagonal', 'crosshatch', 'concentric', 'triangles', 'bezier-waves'] as const
const DIRS = ['normal', 'reverse', 'alternate', 'alternate-reverse'] as const

const spark = (v: unknown): LoopSpark | null =>
  !isObj(v)
    ? null
    : {
        x: num(v.x, -20, 120, 50),
        y: num(v.y, -20, 120, 50),
        size: num(v.size, 0.05, 20, 0.6),
        opacity: num(v.opacity, 0, 1, 0.8),
        duration: num(v.duration, 0.5, 600, 12),
        delay: num(v.delay, -600, 600, 0)
      }

export function sanitizeDefinition(d: unknown): LoopDefinition | null {
  if (!isObj(d)) return null
  const bg = isObj(d.background) ? d.background : {}
  const stops = list(bg.stops, 12, (s) =>
    isObj(s) ? { color: safeColor(s.color), position: num(s.position, 0, 100, 0) } : null
  )
  const layers = list(d.layers, 40, (l): LoopLayer | null =>
    !isObj(l)
      ? null
      : {
          color: safeColor(l.color, '#ffffff'),
          opacity: num(l.opacity, 0, 1, 0.3),
          x: num(l.x, -50, 150, 50),
          y: num(l.y, -50, 150, 50),
          width: num(l.width, 1, 300, 60),
          height: num(l.height, 1, 300, 60),
          blur: num(l.blur, 0, 200, 40),
          shape: pick(l.shape, SHAPES, 'round'),
          blendMode: pick(l.blendMode, BLENDS, 'screen'),
          motion: pick(l.motion, MOTIONS, 'drift'),
          duration: num(l.duration, 0.5, 600, 14),
          delay: num(l.delay, -600, 600, 0),
          direction: pick(l.direction, DIRS, 'normal')
        }
  )
  const patterns = list(d.patterns, 10, (p): LoopPattern | null =>
    !isObj(p)
      ? null
      : {
          kind: pick(p.kind, PATTERNS, 'bezier-waves'),
          color: safeColor(p.color, '#ffffff'),
          opacity: num(p.opacity, 0, 1, 0.5),
          scale: num(p.scale, 4, 600, 60),
          strokeWidth: num(p.strokeWidth, 0.25, 40, 2),
          motion: pick(p.motion, MOTIONS, 'drift'),
          blendMode: pick(p.blendMode, BLENDS, 'screen'),
          duration: num(p.duration, 0.5, 600, 24),
          delay: num(p.delay, -600, 600, 0)
        }
  )
  const fx = isObj(d.effects) ? d.effects : {}
  const prism = isObj(fx.prismLines)
    ? { opacity: num(fx.prismLines.opacity, 0, 1, 0.5), density: num(fx.prismLines.density, 0, 100, 30) }
    : undefined
  const ov = isObj(d.overlay) ? d.overlay : {}
  if (!stops.length && !layers.length && !patterns.length) return null
  return {
    background: {
      angle: num(bg.angle, -360, 360, 135),
      stops: stops.length ? stops : [{ color: '#05060a', position: 0 }, { color: '#05060a', position: 100 }]
    },
    layers,
    patterns,
    effects: { prismLines: prism, starfield: list(fx.starfield, 200, spark), dotfield: list(fx.dotfield, 200, spark) },
    overlay: { vignette: num(ov.vignette, 0, 1, 0.45), grain: num(ov.grain, 0, 1, 0.04) }
  }
}

function sanitizeLoop(v: unknown): LoopRecord | null {
  if (!isObj(v)) return null
  const definition = sanitizeDefinition(v.definition)
  if (!definition) return null
  const id = text(v.id, 80).replace(/[^\w.:-]/g, '-')
  return {
    id: id || `loop-${Math.random().toString(36).slice(2, 10)}`,
    name: text(v.name, 80, 'Untitled loop'),
    category: text(v.category, 40, 'Loops'),
    tags: list(v.tags, 20, (t) => (typeof t === 'string' ? text(t, 30) || null : null)),
    definition
  }
}

/** custom-gradient-loop://<id>?data=<base64url JSON> (the "media" entries of a G-Presenter pack). */
function decodeLoopUrl(url: unknown): unknown {
  if (typeof url !== 'string' || !url.startsWith('custom-gradient-loop://')) return null
  const data = /[?&]data=([A-Za-z0-9_-]+)/.exec(url)?.[1]
  if (!data) return null
  try {
    const b64 = data.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (data.length % 4)) % 4)
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

/**
 * Read a loop file. Accepts a pack ({ loops: [...] }, NLPresenter or G-Presenter), a bare array of loops,
 * or a single loop. Throws a readable error when nothing usable is inside.
 */
export function parseLoopFile(raw: string): LoopRecord[] {
  let data: unknown
  try {
    data = JSON.parse(raw.replace(/^﻿/, ''))
  } catch {
    throw new Error('not valid JSON')
  }
  let candidates: unknown[] = []
  if (Array.isArray(data)) candidates = data
  else if (isObj(data)) {
    if (Array.isArray(data.loops) && data.loops.length) candidates = data.loops
    else if (Array.isArray(data.media)) candidates = data.media.map((m) => (isObj(m) ? decodeLoopUrl(m.objectURL) : null))
    else if ('definition' in data) candidates = [data]
  }
  const seen = new Set<string>()
  const out: LoopRecord[] = []
  for (const c of candidates.slice(0, 500)) {
    const loop = sanitizeLoop(c)
    if (loop && !seen.has(loop.id)) {
      seen.add(loop.id)
      out.push(loop)
    }
  }
  if (!out.length) throw new Error('no background loops found in this file')
  return out
}
