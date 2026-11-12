import { createElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Globe, Video } from 'lucide-react'
import type { AspectRatio, Background, CountdownState, Logo, MediaFit, Slide, TextStyle, Transition, VideoPlayback } from '@shared/types'
import { countdownText, countdownTitle, useNow } from '@/lib/time'
import { t, useT } from '@/i18n'
import { mediaUrl } from '@/lib/media'
import { videoPosition } from '@/lib/video'
import LoopView from './LoopView'
import CaptionLayer from './CaptionLayer'
import TickerLayer from './TickerLayer'
import { TICKER_HEIGHT, useTickerActive } from '@/lib/ticker'
import { stripChords } from '@shared/chords'
import { splitLanguages } from '@shared/bilingual'
import { parallelOf } from '@shared/bible'
import { lineBackground, rgba, textEffects } from '@/lib/textEffects'

const inElectron = typeof window !== 'undefined' && typeof window.nl !== 'undefined'

// Slides are laid out on a fixed virtual stage and scaled to fit, so the
// operator preview, thumbnails and the projector all render identically.
export const STAGE: Record<AspectRatio, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '4:3': { w: 1440, h: 1080 }
}
const PAD = 110

interface Props {
  slide: Slide | null
  background: Background
  style: TextStyle
  aspect: AspectRatio
  hideText?: boolean
  black?: boolean
  /** Thumbnails skip video playback and transitions. */
  thumbnail?: boolean
  /** When set, the countdown replaces the slide text. */
  countdown?: CountdownState | null
  /** Server clock − local clock, for devices on the network. */
  clockOffset?: number
  logo?: Logo | null
  caption?: import('@shared/types').Caption | null // name caption (see CaptionLayer)
  /** Play sound (only the audience screen does, so audio never comes out twice). */
  audio?: boolean
  /** Draw websites and cameras live. Default: in Electron, except thumbnails. */
  liveSources?: boolean
  /** How a new slide comes in (audience, wireless and overlay screens). Not set: cut (operator previews). */
  motion?: Transition
  /** Live video playback: the video background follows it (play/pause/seek), corrected by `clockOffset`. */
  video?: VideoPlayback
  /** Song copyright line, small in the lower left (audience screens only; thumbnails never show it). */
  footer?: string | null
  /** Announcement band along the bottom (audience and wireless screens; never stage or thumbnails). */
  ticker?: import('@shared/types').TickerMessage | null
  className?: string
}

export default function SlideView({
  slide,
  background,
  style,
  aspect,
  hideText,
  black,
  thumbnail,
  countdown,
  clockOffset,
  logo,
  caption,
  audio,
  liveSources,
  motion,
  video,
  footer,
  ticker,
  className
}: Props) {
  const outer = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const { w, h } = STAGE[aspect]
  // Thumbnails and previews (no `motion`) cut instantly.
  const anim: Transition | null = !thumbnail && motion && motion.kind !== 'cut' && motion.ms > 0 ? motion : null
  // While an announcement plays, the caption and copyright line move up above its band.
  const tickerOn = useTickerActive(thumbnail ? null : ticker, clockOffset ?? 0)

  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    const fit = (): void => setScale(Math.min(el.clientWidth / w, el.clientHeight / h))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [w, h])

  return (
    <div ref={outer} className={`relative overflow-hidden ${className ?? ''}`} style={{ containerType: 'size' }}>
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden"
        style={{ width: w, height: h, transform: `translate(-50%, -50%) scale(${scale})`, background: '#000' }}
      >
        <BackgroundStack
          bg={background}
          anim={anim}
          still={thumbnail}
          audio={!!audio && !thumbnail}
          live={liveSources ?? (inElectron && !thumbnail)}
          video={video}
          clockOffset={clockOffset ?? 0}
          w={w}
          h={h}
        />
        <TextStack
          content={{ slide, countdown: countdown ?? null, style, hideText: !!hideText }}
          anim={anim}
          animateHide={!thumbnail}
          clockOffset={clockOffset ?? 0}
          w={w}
          h={h}
        />
        {logo && <LogoLayer logo={logo} w={w} />}
        {caption !== undefined && !thumbnail && <CaptionLayer caption={caption} w={w} h={h} lift={tickerOn ? TICKER_HEIGHT : 0} />}
        {footer && !thumbnail && !countdown && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: MARGIN,
              bottom: 30 + (tickerOn ? (TICKER_HEIGHT * h) / 100 : 0),
              maxWidth: w * 0.62,
              fontFamily: style.fontFamily,
              fontSize: 22,
              lineHeight: 1.3,
              color: 'rgba(255,255,255,.78)',
              textShadow: '0 1px 4px rgba(0,0,0,.85)',
              opacity: hideText ? 0 : 1,
              transition: 'opacity 350ms ease, bottom 300ms ease'
            }}
          >
            {footer}
          </div>
        )}
        {ticker && !thumbnail && <TickerLayer ticker={ticker} h={h} offset={clockOffset ?? 0} />}
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: black ? 1 : 0, transition: thumbnail ? undefined : 'opacity 300ms ease' }}
        />
      </div>
    </div>
  )
}

// ---------- transitions ----------
// The current picture and, while a transition runs, the one it replaces. Layers are keyed so the current
// one stays mounted while its key doesn't change (a video or loop keeps playing across slide changes).

interface Leaving<T> {
  id: number
  value: T
  anim: Transition
}

function useLayers<T>(key: string, value: T, anim: Transition | null) {
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  })
  const [st, setSt] = useState<{ id: number; key: string; anim: Transition | null; out: Leaving<T>[] }>({ id: 0, key, anim: null, out: [] })
  if (st.key !== key) {
    // Render-time update ("derived state"): React re-renders right away, before anything is painted.
    setSt({
      id: st.id + 1,
      key,
      anim,
      out: anim ? [...st.out.slice(-1), { id: st.id, value: latest.current, anim }] : []
    })
  }
  const drop = (upTo: number): void => setSt((s) => (s.out.some((l) => l.id <= upTo) ? { ...s, out: s.out.filter((l) => l.id > upTo) } : s))
  // Fallback when animation events don't arrive (hidden window, reduced motion settings…).
  const last = st.out[st.out.length - 1]
  useEffect(() => {
    if (!last) return
    const t = setTimeout(() => drop(last.id), last.anim.ms + 250)
    return () => clearTimeout(t)
  }, [last?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return { id: st.id, anim: st.anim, out: st.out, drop }
}

const animStyle = (a: Transition | null, phase: 'in' | 'out', kind?: Transition['kind']): { className: string; style: CSSProperties } =>
  a ? { className: `nl-${phase}-${kind ?? a.kind}`, style: { animationDuration: `${a.ms}ms` } } : { className: '', style: {} }

/** CSS for each MediaFit: black shows wherever the picture doesn't cover the screen. */
const FIT_CLASS: Record<MediaFit, string> = {
  cover: 'object-cover',
  contain: 'object-contain bg-black',
  fill: 'object-fill',
  none: 'object-none bg-black'
}

/** What identifies a background: the same key means the same picture, so it is not redrawn or restarted. */
function bgKey(bg: Background): string {
  switch (bg.kind) {
    case 'color':
    case 'gradient':
      return `${bg.kind}:${bg.value}`
    case 'image':
      return `image:${bg.src}:${bg.fit ?? ''}`
    case 'video':
      return `video:${bg.src}`
    case 'web':
      return `web:${bg.url}`
    case 'camera':
      return `camera:${bg.deviceId}`
    case 'loop':
      return `loop:${bg.id}`
  }
}

type BgProps = { still?: boolean; audio: boolean; live: boolean; video?: VideoPlayback; clockOffset: number; w: number; h: number }

/** Backgrounds crossfade (the new one fades in over the old) only when the background really changes. */
function BackgroundStack({ bg, anim, ...rest }: BgProps & { bg: Background; anim: Transition | null }) {
  const L = useLayers(bgKey(bg), bg, anim)
  const cur = animStyle(L.anim, 'in', 'fade')
  // One keyed list: the current layer keeps its element (and its playing video) when it becomes the old one.
  return [
    ...L.out.map((l) => (
      <div key={l.id} className="absolute inset-0">
        <BackgroundLayer bg={l.value} {...rest} video={undefined} />
      </div>
    )),
    <div
      key={L.id}
      className={`absolute inset-0 ${L.out.length ? cur.className : ''}`}
      style={L.out.length ? cur.style : undefined}
      onAnimationEnd={(e) => e.target === e.currentTarget && L.drop(L.id - 1)}
    >
      <BackgroundLayer bg={bg} {...rest} />
    </div>
  ]
}

interface TextContent {
  slide: Slide | null
  countdown: CountdownState | null
  style: TextStyle
  hideText: boolean
}

const shownText = (sl: Slide | null): string => (sl ? [sl.heading?.trim(), stripChords(sl.text)].filter(Boolean).join('\n') : '')

/** Slide text (or the countdown): the old text goes out while the new one comes in. */
function TextStack({
  content,
  anim,
  animateHide,
  clockOffset,
  w,
  h
}: {
  content: TextContent
  anim: Transition | null
  animateHide: boolean
  clockOffset: number
  w: number
  h: number
}) {
  const { slide, countdown } = content
  const key = countdown ? 'countdown' : shownText(slide) ? `${slide!.id}\u0001${shownText(slide)}\u0001${slide!.reference ?? ''}` : ''
  const L = useLayers(key, content, anim)
  const draw = (c: TextContent): React.ReactNode =>
    c.countdown ? (
      <CountdownLayer c={c.countdown} style={c.style} offset={clockOffset} w={w} h={h} />
    ) : c.slide && shownText(c.slide) ? (
      <SlideText
        slide={c.slide.text.includes('[') ? { ...c.slide, text: stripChords(c.slide.text) } : c.slide}
        style={c.style}
        w={w}
        h={h}
        visible={!c.hideText}
        animate={animateHide}
      />
    ) : null
  const cur = animStyle(L.anim, 'in')
  return [
    ...L.out.map((l) => {
      const a = animStyle(l.anim, 'out')
      return (
        <div
          key={l.id}
          className={`pointer-events-none absolute inset-0 ${a.className}`}
          style={a.style}
          onAnimationEnd={(e) => e.target === e.currentTarget && L.drop(l.id)}
        >
          {draw(l.value)}
        </div>
      )
    }),
    <div key={L.id} className={`absolute inset-0 ${cur.className}`} style={cur.style}>
      {draw(content)}
    </div>
  ]
}

function BackgroundLayer({
  bg,
  still,
  audio,
  live,
  video,
  clockOffset,
  w,
  h
}: BgProps & { bg: Background }) {
  if (bg.kind === 'color') return <div className="absolute inset-0" style={{ background: bg.value }} />
  if (bg.kind === 'gradient') return <div className="absolute inset-0" style={{ backgroundImage: bg.value }} />
  if (bg.kind === 'image')
    return <img src={mediaUrl(bg.src)} className={`absolute inset-0 h-full w-full ${FIT_CLASS[bg.fit ?? 'cover']}`} draggable={false} />
  if (bg.kind === 'loop') return <LoopView def={bg.def} still={still} />
  if (bg.kind === 'web')
    return live ? (
      <WebLayer key={bg.url} url={bg.url} muted={!audio || (bg.muted ?? true)} w={w} h={h} />
    ) : (
      <SourcePlaceholder icon="web" title={hostOf(bg.url)} sub={t('stage.source.website')} />
    )
  if (bg.kind === 'camera')
    return live && inElectron ? (
      <CameraLayer key={bg.deviceId} deviceId={bg.deviceId} label={bg.label} sound={audio && bg.muted === false} />
    ) : (
      <SourcePlaceholder
        icon="camera"
        title={bg.label || t('stage.source.camera')}
        sub={inElectron ? t('stage.source.camera') : t('stage.source.cameraWired')}
      />
    )
  const ctl = video?.src === bg.src ? video : undefined
  return (
    <VideoLayer
      key={bg.src}
      src={bg.src}
      fit={bg.fit ?? 'cover'}
      still={still}
      loop={ctl?.loop ?? bg.loop ?? true}
      muted={!audio || (ctl ? ctl.muted : (bg.muted ?? true))}
      ctl={ctl}
      clockOffset={clockOffset}
    />
  )
}

/**
 * Thumbnails show a still frame; the live screen plays. With `ctl` (the live video's playback), the video follows
 * the operator: play/pause, and a seek whenever it is more than half a second off.
 */
function VideoLayer({
  src,
  fit,
  still,
  loop,
  muted,
  ctl,
  clockOffset
}: {
  src: string
  fit: MediaFit
  still?: boolean
  loop: boolean
  muted: boolean
  ctl?: VideoPlayback
  clockOffset: number
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const playing = !ctl || ctl.playing
  useEffect(() => {
    const v = ref.current
    if (!v || still) return
    v.muted = muted
    if (!playing) return
    // Browsers refuse to autoplay with sound until the page is tapped: fall back to muted playback.
    v.play().catch(() => {
      v.muted = true
      v.play().catch(() => {})
    })
  }, [muted, still, playing])
  useEffect(() => {
    const v = ref.current
    if (!v || still || !ctl) return
    const sync = (): void => {
      if (v.readyState < 1) return
      const d = isFinite(v.duration) && v.duration > 0 ? v.duration : undefined
      let t = videoPosition(ctl, Date.now() + clockOffset, d)
      if (d && !ctl.loop && t >= d - 0.05) t = Math.max(0, d - 0.05) // hold the last frame
      let off = Math.abs(v.currentTime - t)
      if (d && ctl.loop) off = Math.min(off, d - off) // just wrapped round
      if (off > 0.5) v.currentTime = t
      if (!ctl.playing && !v.paused) v.pause()
      if (ctl.playing && v.paused && !(d && !ctl.loop && t >= d - 0.05)) v.play().catch(() => {})
    }
    sync()
    v.addEventListener('loadedmetadata', sync)
    const iv = setInterval(sync, 1000)
    return () => {
      v.removeEventListener('loadedmetadata', sync)
      clearInterval(iv)
    }
  }, [ctl, clockOffset, still])
  return (
    <video
      ref={ref}
      src={still ? `${mediaUrl(src)}#t=0.5` : mediaUrl(src)}
      className={`absolute inset-0 h-full w-full ${FIT_CLASS[fit]}`}
      loop={loop}
      muted
      preload={still ? 'metadata' : 'auto'}
      playsInline
    />
  )
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

function SourcePlaceholder({ icon, title, sub, error }: { icon: 'web' | 'camera'; title: string; sub: string; error?: boolean }) {
  useT()
  const Icon = icon === 'web' ? Globe : Video
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center"
      style={{ background: 'radial-gradient(circle at 50% 40%, #2a2550 0%, #0d0f16 70%)', padding: 120 }}
    >
      <Icon size={150} strokeWidth={1.4} color={error ? '#f87171' : '#a99dff'} />
      <div style={{ fontSize: 64, fontWeight: 700, color: '#fff', maxWidth: '100%', overflowWrap: 'anywhere' }}>{title}</div>
      <div style={{ fontSize: 40, color: error ? '#fca5a5' : 'rgba(255,255,255,.55)' }}>{sub}</div>
    </div>
  )
}

interface WebviewEl extends HTMLElement {
  setAudioMuted: (m: boolean) => void
}

/**
 * A website at the projector's resolution. Electron uses <webview> (sites that refuse to be framed still load,
 * and sound can be muted per screen); browsers on the network fall back to an iframe.
 */
function WebLayer({ url, muted, w, h }: { url: string; muted: boolean; w: number; h: number }) {
  const ref = useRef<WebviewEl>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onReady = (): void => setReady(true)
    const onFail = (e: Event): void => {
      const ev = e as Event & { errorCode: number; errorDescription: string; isMainFrame: boolean }
      if (ev.isMainFrame && ev.errorCode !== -3) setFailed(ev.errorDescription || t('stage.source.loadFailed'))
    }
    el.addEventListener('dom-ready', onReady)
    el.addEventListener('did-fail-load', onFail)
    return () => {
      el.removeEventListener('dom-ready', onReady)
      el.removeEventListener('did-fail-load', onFail)
    }
  }, [])

  useEffect(() => {
    if (ready) ref.current?.setAudioMuted(muted)
  }, [ready, muted])

  const box: CSSProperties = { position: 'absolute', inset: 0, width: w, height: h, border: 0, pointerEvents: 'none', background: '#000' }
  if (failed) return <SourcePlaceholder icon="web" title={hostOf(url)} sub={failed} error />
  if (!inElectron) {
    // Same-origin pages must not get script access to this one.
    const sameOrigin = (() => {
      try {
        return new URL(url).origin === location.origin
      } catch {
        return true
      }
    })()
    return (
      <iframe
        src={url}
        style={box}
        allow="autoplay; fullscreen"
        referrerPolicy="no-referrer"
        sandbox={`allow-scripts allow-forms allow-presentation${sameOrigin ? '' : ' allow-same-origin'}`}
      />
    )
  }
  return createElement('webview', { ref, src: url, partition: 'persist:web', style: { ...box, display: 'flex' } })
}

/** A local camera or capture device. Sound only on the audience screen, and only when turned on. */
function CameraLayer({ deviceId, label, sound }: { deviceId: string; label?: string; sound: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let dead = false
    setError(null)
    ;(async () => {
      try {
        let audio: MediaTrackConstraints | false = false
        if (sound) {
          // A capture card's audio input shares its groupId with the video input.
          const devices = await navigator.mediaDevices.enumerateDevices()
          const cam = devices.find((d) => d.kind === 'videoinput' && d.deviceId === deviceId)
          const mic = cam && devices.find((d) => d.kind === 'audioinput' && d.groupId === cam.groupId)
          if (mic) audio = { deviceId: { exact: mic.deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio
        })
        if (dead) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (ref.current) {
          ref.current.srcObject = s
          ref.current.muted = !sound // React doesn't keep the muted property in sync
        }
      } catch (e) {
        if (!dead) setError((e as Error).name === 'OverconstrainedError' ? t('stage.source.notConnected') : (e as Error).message || t('stage.source.unavailable'))
      }
    })()
    return () => {
      dead = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [deviceId, sound])

  if (error) return <SourcePlaceholder icon="camera" title={label || t('stage.source.camera')} sub={error} error />
  return <video ref={ref} className="absolute inset-0 h-full w-full object-cover" autoPlay playsInline muted={!sound} />
}

const MARGIN = 48

function LogoLayer({ logo, w }: { logo: Logo; w: number }) {
  const size = (logo.size / 100) * w
  const pos: CSSProperties = {
    position: 'absolute',
    width: size,
    maxHeight: size,
    objectFit: 'contain',
    opacity: logo.opacity,
    ...(logo.corner[0] === 't' ? { top: MARGIN } : { bottom: MARGIN }),
    ...(logo.corner[1] === 'l' ? { left: MARGIN } : { right: MARGIN })
  }
  return <img src={mediaUrl(logo.src)} style={pos} draggable={false} />
}

/** Smallest size shrink-to-fit goes down to (px on the stage). */
export const MIN_FONT = 28

/**
 * Shrink-to-fit: step the font size down from `base` until the element fits `maxW` × `maxH` (or MIN_FONT).
 * Shared by the projector (SlideText) and the "text too small" check (lib/fitCheck.ts).
 */
export function fitFontSize(el: HTMLElement, base: number, maxH: number, maxW: number): number {
  let s = base
  el.style.fontSize = `${s}px`
  while (s > MIN_FONT && (el.scrollHeight > maxH || el.scrollWidth > maxW)) {
    s -= 4
    el.style.fontSize = `${s}px`
  }
  return s
}

/** The words of one part of a slide; a second language (below a "--" line) is smaller, italic and softer. */
function SlideWords({ text, style, bg }: { text: string; style: TextStyle; bg: string }) {
  const wrap = (t: string): React.ReactNode => (bg === 'line' ? <span style={lineBackground(style)}>{t}</span> : t)
  const { primary, secondary } = splitLanguages(text)
  if (secondary === null) return <>{wrap(primary)}</>
  return (
    <>
      {primary ? wrap(primary) : null}
      <div style={{ fontSize: '0.7em', fontStyle: 'italic', opacity: 0.8, marginTop: primary ? '0.35em' : 0 }}>{wrap(secondary)}</div>
    </>
  )
}

export function SlideText({
  slide,
  style,
  w,
  h,
  visible,
  animate
}: {
  slide: Slide
  style: TextStyle
  w: number
  h: number
  visible: boolean
  animate: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const isScripture = !!slide.reference
  const baseSize = isScripture ? Math.round(style.fontSize * 0.78) : style.fontSize
  const [size, setSize] = useState(baseSize)
  // Margins from the text style (older saved styles fall back to the original 110 px).
  const mx = Math.max(0, Math.min(style.marginX ?? PAD, w / 2 - 100))
  const my = Math.max(0, Math.min(style.marginY ?? PAD, h / 2 - 60))
  const bg = style.textBg ?? 'off'
  // A full-width band reaches the screen edges; the text inside still keeps the side margins.
  const availW = bg === 'full' ? w : w - mx * 2

  // Shrink-to-fit: step the font size down until the text fits inside the safe area.
  const cols = parallelOf(slide)
  const stacked = slide.parallelLayout === 'stacked'
  const heading = slide.heading?.trim()
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    setSize(fitFontSize(el, baseSize, h - my * 2, availW))
    // Still too long at the smallest size (read by the "text too small" check).
    el.dataset.overflow = String(el.scrollHeight > h - my * 2 + 2 || el.scrollWidth > availW + 2)
  }, [slide.text, slide.reference, slide.parallel, slide.parallelLayout, heading, baseSize, w, h, mx, my, availW, bg, style.lineHeight, style.fontFamily, style.uppercase, style.letterSpacing, style.italic])

  const css: CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: size,
    fontWeight: isScripture ? Math.min(style.fontWeight, 600) : style.fontWeight,
    color: style.color,
    textTransform: style.uppercase && !isScripture ? 'uppercase' : 'none',
    textAlign: style.align,
    lineHeight: style.lineHeight,
    ...textEffects(style),
    whiteSpace: 'pre-line',
    boxSizing: 'border-box',
    maxWidth: availW,
    ...(bg === 'block'
      ? { background: rgba(style.textBgColor ?? '#000000', style.textBgOpacity ?? 0.55), padding: '0.3em 0.55em', borderRadius: '0.16em' }
      : bg === 'full'
        ? {
            background: rgba(style.textBgColor ?? '#000000', style.textBgOpacity ?? 0.55),
            width: w,
            margin: `0 ${-mx}px`,
            padding: `0.35em ${mx}px`
          }
        : {}),
    opacity: visible ? 1 : 0,
    transition: animate ? 'opacity 350ms ease' : undefined
  }

  return (
    <div
      className="absolute inset-0 flex justify-center"
      style={{
        padding: `${my}px ${mx}px`,
        alignItems: style.valign === 'top' ? 'flex-start' : style.valign === 'bottom' ? 'flex-end' : 'center'
      }}
    >
      {cols.length ? (
        // Two or three translations, side by side or stacked, each with its own reference.
        <div
          ref={box}
          data-scale={size / baseSize}
          style={{
            ...css,
            width: bg === 'full' ? w : w - mx * 2,
            display: 'flex',
            flexDirection: stacked ? 'column' : 'row',
            gap: stacked ? '0.5em' : '1.2em',
            alignItems: stacked ? 'stretch' : style.valign === 'top' ? 'flex-start' : style.valign === 'bottom' ? 'flex-end' : 'center'
          }}
        >
          {[{ text: slide.text, reference: slide.reference ?? '' }, ...cols].map((col, i) => (
            <div
              key={i}
              style={{
                flex: stacked ? '0 0 auto' : '1 1 0',
                minWidth: 0,
                ...(i
                  ? stacked
                    ? { borderTop: `2px solid ${style.color}33`, paddingTop: '0.5em' }
                    : { borderLeft: `2px solid ${style.color}33`, paddingLeft: '1.2em' }
                  : {})
              }}
            >
              {bg === 'line' ? <span style={lineBackground(style)}>{col.text}</span> : col.text}
              <div style={{ fontSize: '0.55em', fontWeight: 500, marginTop: stacked ? '0.3em' : '0.8em', opacity: 0.85 }}>
                {bg === 'line' ? <span style={lineBackground(style)}>{col.reference}</span> : col.reference}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div ref={box} data-scale={size / baseSize} style={css}>
          {heading && (
            <div style={{ fontSize: '1.1em', fontWeight: Math.max(700, style.fontWeight), marginBottom: slide.text.trim() ? '0.35em' : 0 }}>
              {bg === 'line' ? <span style={lineBackground(style)}>{heading}</span> : heading}
            </div>
          )}
          {heading ? (
            slide.text.trim() ? (
              <div style={{ fontSize: '0.8em' }}>
                <SlideWords text={slide.text} style={style} bg={bg} />
              </div>
            ) : null
          ) : (
            <SlideWords text={slide.text} style={style} bg={bg} />
          )}
          {isScripture && (
            <div style={{ fontSize: '0.55em', fontWeight: 500, marginTop: '0.8em', opacity: 0.85 }}>
              {bg === 'line' ? <span style={lineBackground(style)}>{slide.reference}</span> : slide.reference}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CountdownLayer({ c, style, offset, w = 1920, h = 1080 }: { c: CountdownState; style: TextStyle; offset: number; w?: number; h?: number }) {
  const now = useNow(offset)
  useT() // the default title follows the language
  const { text, over } = countdownText(c, now)
  const shadow = style.shadow ? '0 4px 18px rgba(0,0,0,.65)' : 'none'
  // Sizes: % of the standard sizes (68 / 300 / 44 px on the virtual stage).
  const k = (v: number | undefined): number => Math.max(0.3, Math.min(2, (v ?? 100) / 100))
  return (
    <div
      className="absolute inset-0 isolate flex flex-col items-center justify-center text-center"
      style={{ fontFamily: style.fontFamily, color: style.color, textShadow: shadow, padding: PAD }}
    >
      {/* Its own background (covers the normal one while the countdown shows). */}
      {c.background && (
        <div className="absolute inset-0 -z-10">
          <BackgroundLayer bg={c.background} audio={false} live={false} clockOffset={offset} w={w} h={h} />
        </div>
      )}
      {c.title && <div style={{ fontSize: 68 * k(c.titleScale), fontWeight: 600, marginBottom: 10 }}>{countdownTitle(c.title)}</div>}
      <div
        style={{
          fontSize: 300 * k(c.timeScale),
          fontWeight: 700,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          color: over ? '#f87171' : style.color
        }}
      >
        {text}
      </div>
      {c.subtext && <div style={{ fontSize: 44 * k(c.subtextScale), marginTop: 24, opacity: 0.85 }}>{c.subtext}</div>}
    </div>
  )
}
