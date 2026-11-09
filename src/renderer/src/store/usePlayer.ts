import { create } from 'zustand'
import type { MediaItem } from '@shared/types'
import { mediaUrl } from '@/lib/media'
import { useApp } from './useApp'

// Music player for walk-in music, offering, background songs. It plays in the operator window, through
// this computer's sound output. The playlist holds media-library ids; the library is the source of truth.

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

  setOpen: (v: boolean) => void
  setCollapsed: (v: boolean) => void
  setPos: (p: { x: number; y: number }) => void
  add: (ids: string[]) => void
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

const tracks = (ids: string[]): MediaItem[] => {
  const media = useApp.getState().media
  return ids.map((id) => media.find((m) => m.id === id && m.kind === 'audio')).filter((m): m is MediaItem => !!m)
}

/** Playlist entries that still exist in the library. */
export const selectTracks = (s: PlayerState): MediaItem[] => tracks(s.playlist)

function load(id: string, play: boolean): void {
  const m = tracks([id])[0]
  if (!m) return
  const a = el()
  a.src = mediaUrl(m.ref)
  a.currentTime = 0
  usePlayer.setState({ current: id, time: 0, duration: 0 })
  if (play) a.play().catch(() => usePlayer.setState({ playing: false }))
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

  setOpen: (open) => set({ open }),
  setCollapsed: (collapsed) => set({ collapsed }),
  setPos: (pos) => set({ pos }),
  add: (ids) => set((s) => ({ playlist: [...s.playlist, ...ids.filter((id) => !s.playlist.includes(id))], open: true })),
  remove: (id) => {
    if (get().current === id) get().stop()
    set((s) => ({ playlist: s.playlist.filter((x) => x !== id), current: s.current === id ? null : s.current }))
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
    set({ playlist: [], current: null })
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
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  },
  stop: () => {
    const a = el()
    a.pause()
    a.currentTime = 0
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
    if (a.currentTime > 3) {
      a.currentTime = 0
      return
    }
    const list = selectTracks(s)
    if (!list.length) return
    const i = list.findIndex((m) => m.id === s.current)
    load(list[(i - 1 + list.length) % list.length].id, true)
  },
  seek: (t) => {
    el().currentTime = t
    set({ time: t })
  },
  setVolume: (volume) => {
    el().volume = volume
    set({ volume })
  },
  cycleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  hydrate: (saved) => {
    const v = (saved ?? {}) as Partial<PlayerState>
    const volume = typeof v.volume === 'number' ? Math.min(1, Math.max(0, v.volume)) : 0.8
    el().volume = volume
    set({
      playlist: Array.isArray(v.playlist) ? v.playlist.filter((x) => typeof x === 'string') : [],
      volume,
      repeat: v.repeat === 'all' || v.repeat === 'one' ? v.repeat : 'off',
      shuffle: !!v.shuffle,
      pos: v.pos && typeof v.pos.x === 'number' && typeof v.pos.y === 'number' ? v.pos : null,
      collapsed: !!v.collapsed
    })
  }
}))

/** Persist the playlist and preferences (not the playback position). */
let saveTimer: ReturnType<typeof setTimeout> | undefined
let lastSaved = ''
usePlayer.subscribe((s) => {
  const { playlist, volume, repeat, shuffle, pos, collapsed } = s
  const key = JSON.stringify({ playlist, volume, repeat, shuffle, pos, collapsed })
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
  if (p.current && !s.media.some((m) => m.id === p.current)) {
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
