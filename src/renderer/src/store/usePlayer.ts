import { create } from 'zustand'
import type { YouTubeHit } from '@shared/types'
import { mediaUrl } from '@/lib/media'
import { onYouTubeEvent, ytCommand } from '@/lib/youtubeEmbed'
import { useApp } from './useApp'

// Music player for walk-in music, offering, background songs. It plays in the operator window, through
// this computer's sound output. The playlist holds media-library ids (the library is the source of truth for
// those) and YouTube videos as "yt:<videoId>", which play in YouTube's embedded player in the music window.

export type RepeatMode = 'off' | 'all' | 'one'

interface PlayerState {
  open: boolean
  collapsed: boolean
  pos: { x: number; y: number } | null // top-left in the window; null = default corner
  playlist: string[]
  current: string | null
  playing: boolean
  time: number
  duration: number
  volume: number
  repeat: RepeatMode
  shuffle: boolean
  /** YouTube videos in the playlist, by track id ("yt:<videoId>"). */
  yt: Record<string, YouTubeHit>
  /** The video the embedded player shows; `n` changes on every load so the same video can start over. */
  ytVideo: { videoId: string; autoplay: boolean; n: number } | null
  /** Why the current YouTube video cannot play (YouTube's error code), until another track loads. */
  ytError: number | null

  setOpen: (v: boolean) => void
  setCollapsed: (v: boolean) => void
  setPos: (p: { x: number; y: number }) => void
  add: (ids: string[]) => void
  /** Add YouTube videos to the playlist (`play`: start the first one now). */
  addYouTube: (hits: YouTubeHit[], play?: boolean) => void
  remove: (id: string) => void
  move: (from: number, to: number) => void
  clear: () => void
  playMedia: (id: string) => void
  toggle: () => void
  stop: () => void
  next: (auto?: boolean) => void
  prev: () => void
  seek: (t: number) => void
  setVolume: (v: number) => void
  cycleRepeat: () => void
  toggleShuffle: () => void
  hydrate: (saved: unknown) => void
}

let audio: HTMLAudioElement | null = null
function el(): HTMLAudioElement {
  if (audio) return audio
  audio = new Audio()
  audio.preload = 'auto'
  const s = usePlayer.getState
  audio.addEventListener('timeupdate', () => usePlayer.setState({ time: audio!.currentTime }))
  audio.addEventListener('durationchange', () => usePlayer.setState({ duration: Number.isFinite(audio!.duration) ? audio!.duration : 0 }))
  audio.addEventListener('play', () => usePlayer.setState({ playing: true }))
  audio.addEventListener('pause', () => usePlayer.setState({ playing: false }))
  audio.addEventListener('ended', () => s().next(true))
  audio.addEventListener('error', () => {
    usePlayer.setState({ playing: false })
  })
  return audio
}

/** A playlist entry: an audio file from the media library, or a YouTube video. */
export interface Track {
  id: string
  name: string
  /** Media-library file (audio files). */
  ref?: string
  youtube?: YouTubeHit
}

export const ytId = (videoId: string): string => `yt:${videoId}`
export const isYouTube = (id: string | null | undefined): boolean => !!id?.startsWith('yt:')

const tracks = (ids: string[], yt: Record<string, YouTubeHit> = usePlayer.getState().yt): Track[] => {
  const media = useApp.getState().media
  return ids
    .map((id): Track | undefined => {
      if (isYouTube(id)) return yt[id] ? { id, name: yt[id].title, youtube: yt[id] } : undefined
      const m = media.find((x) => x.id === id && x.kind === 'audio')
      return m ? { id, name: m.name, ref: m.ref } : undefined
    })
    .filter((t): t is Track => !!t)
}

/** Playlist entries that can play (library files still in the library, and YouTube videos). */
export const selectTracks = (s: PlayerState): Track[] => tracks(s.playlist, s.yt)

let ytLoads = 0
function load(id: string, play: boolean): void {
  const m = tracks([id])[0]
  if (!m) return
  const a = el()
  if (m.youtube) {
    a.pause()
    a.removeAttribute('src')
    usePlayer.setState({
      current: id,
      time: 0,
      duration: m.youtube.duration ?? 0,
      playing: false,
      ytError: null,
      ytVideo: { videoId: m.youtube.videoId, autoplay: play, n: ++ytLoads }
    })
    return
  }
  // From a YouTube video back to a file: stop the video.
  if (usePlayer.getState().ytVideo) unloadYouTube()
  a.src = mediaUrl(m.ref!)
  a.currentTime = 0
  usePlayer.setState({ current: id, time: 0, duration: 0, ytError: null })
  if (play) a.play().catch(() => usePlayer.setState({ playing: false }))
}

function unloadYouTube(): void {
  ytCommand('stopVideo')
  usePlayer.setState({ ytVideo: null, ytError: null })
}

/** The current track plays in YouTube's player (not the audio element). */
const onYouTube = (): boolean => {
  const s = usePlayer.getState()
  return isYouTube(s.current) && !!s.ytVideo
}

export const usePlayer = create<PlayerState>()((set, get) => ({
  open: false,
  collapsed: false,
  pos: null,
  playlist: [],
  current: null,
  playing: false,
  time: 0,
  duration: 0,
  volume: 0.8,
  repeat: 'off',
  shuffle: false,
  yt: {},
  ytVideo: null,
  ytError: null,

  setOpen: (open) => set({ open }),
  setCollapsed: (collapsed) => set({ collapsed }),
  setPos: (pos) => set({ pos }),
  add: (ids) => set((s) => ({ playlist: [...s.playlist, ...ids.filter((id) => !s.playlist.includes(id))], open: true })),
  addYouTube: (hits, play) => {
    if (!hits.length) return
    set((s) => ({ yt: { ...s.yt, ...Object.fromEntries(hits.map((h) => [ytId(h.videoId), h])) } }))
    get().add(hits.map((h) => ytId(h.videoId)))
    if (play) load(ytId(hits[0].videoId), true)
  },
  remove: (id) => {
    if (get().current === id) get().stop()
    if (get().current === id && isYouTube(id)) unloadYouTube()
    set((s) => {
      const { [id]: _gone, ...yt } = s.yt
      return { playlist: s.playlist.filter((x) => x !== id), current: s.current === id ? null : s.current, yt }
    })
  },
  move: (from, to) =>
    set((s) => {
      const list = [...s.playlist]
      const [m] = list.splice(from, 1)
      list.splice(to, 0, m)
      return { playlist: list }
    }),
  clear: () => {
    get().stop()
    unloadYouTube()
    set({ playlist: [], current: null, yt: {} })
  },
  playMedia: (id) => {
    get().add([id])
    set({ open: true })
    load(id, true)
  },
  toggle: () => {
    const s = get()
    const a = el()
    if (!s.current || !tracks([s.current]).length) {
      const first = selectTracks(s)[0]
      if (first) load(first.id, true)
      return
    }
    if (onYouTube()) {
      if (s.ytError !== null) return
      ytCommand(s.playing ? 'pauseVideo' : 'playVideo')
      return
    }
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  },
  stop: () => {
    const a = el()
    a.pause()
    a.currentTime = 0
    if (onYouTube()) {
      ytCommand('pauseVideo')
      ytCommand('seekTo', [0, true])
    }
    set({ playing: false, time: 0 })
  },
  next: (auto) => {
    const s = get()
    const list = selectTracks(s)
    if (!list.length) return
    if (auto && s.repeat === 'one' && s.current) return load(s.current, true)
    const i = list.findIndex((m) => m.id === s.current)
    let n: number
    if (s.shuffle && list.length > 1) {
      do n = Math.floor(Math.random() * list.length)
      while (n === i)
    } else n = i + 1
    if (n >= list.length) {
      if (auto && s.repeat === 'off') {
        set({ playing: false })
        return
      }
      n = 0
    }
    load(list[n].id, auto ? true : s.playing || auto === undefined)
  },
  prev: () => {
    const s = get()
    const a = el()
    // Like most players: restart the song unless it only just began.
    if ((onYouTube() ? s.time : a.currentTime) > 3) {
      s.seek(0)
      return
    }
    const list = selectTracks(s)
    if (!list.length) return
    const i = list.findIndex((m) => m.id === s.current)
    load(list[(i - 1 + list.length) % list.length].id, true)
  },
  seek: (t) => {
    if (onYouTube()) ytCommand('seekTo', [t, true])
    else el().currentTime = t
    set({ time: t })
  },
  setVolume: (volume) => {
    el().volume = volume
    ytCommand('setVolume', [Math.round(volume * 100)])
    set({ volume })
  },
  cycleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  hydrate: (saved) => {
    const v = (saved ?? {}) as Partial<PlayerState>
    const volume = typeof v.volume === 'number' ? Math.min(1, Math.max(0, v.volume)) : 0.8
    el().volume = volume
    const yt: Record<string, YouTubeHit> = {}
    for (const [id, h] of Object.entries(v.yt && typeof v.yt === 'object' ? v.yt : {}))
      if (isYouTube(id) && h && typeof h.videoId === 'string' && typeof h.title === 'string') yt[id] = h
    set({
      yt,
      playlist: Array.isArray(v.playlist) ? v.playlist.filter((x) => typeof x === 'string' && (!isYouTube(x) || !!yt[x])) : [],
      volume,
      repeat: v.repeat === 'all' || v.repeat === 'one' ? v.repeat : 'off',
      shuffle: !!v.shuffle,
      pos: v.pos && typeof v.pos.x === 'number' && typeof v.pos.y === 'number' ? v.pos : null,
      collapsed: !!v.collapsed
    })
  }
}))

// YouTube's player reports its state like the audio element's events do.
onYouTubeEvent((e) => {
  const s = usePlayer.getState()
  if (!isYouTube(s.current) || !s.ytVideo) return
  if (e.kind === 'ready') ytCommand('setVolume', [Math.round(s.volume * 100)])
  else if (e.kind === 'error') usePlayer.setState({ ytError: e.code, playing: false })
  else {
    const patch: Partial<PlayerState> = {}
    if (typeof e.time === 'number' && Number.isFinite(e.time)) patch.time = e.time
    if (typeof e.duration === 'number' && e.duration > 0) patch.duration = e.duration
    if (e.state === 1 || e.state === 3) patch.playing = true
    if (e.state === 2 || e.state === 0 || e.state === 5) patch.playing = false
    usePlayer.setState(patch)
    if (e.state === 0) s.next(true)
  }
})

/** Persist the playlist and preferences (not the playback position). */
let saveTimer: ReturnType<typeof setTimeout> | undefined
let lastSaved = ''
usePlayer.subscribe((s) => {
  const { playlist, volume, repeat, shuffle, pos, collapsed } = s
  const yt = Object.fromEntries(playlist.filter(isYouTube).map((id) => [id, s.yt[id]]).filter(([, h]) => h))
  const key = JSON.stringify({ playlist, volume, repeat, shuffle, pos, collapsed, yt })
  if (key === lastSaved) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    lastSaved = key
    window.nl?.data.setSetting('player', JSON.parse(key))
  }, 500)
})

// A song deleted from the library stops playing.
useApp.subscribe((s, prev) => {
  if (s.media === prev.media) return
  const p = usePlayer.getState()
  if (p.current && !isYouTube(p.current) && !s.media.some((m) => m.id === p.current)) {
    p.stop()
    usePlayer.setState({ current: null })
  }
})

export const formatTime = (t: number): string => {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Dev builds: expose the player for automated end-to-end checks (NL_SNAPSHOT_JS).
if (import.meta.env.DEV) (window as unknown as { __player: typeof usePlayer }).__player = usePlayer
