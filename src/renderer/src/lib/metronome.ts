// Operator metronome: an audible click through this computer's sound output only (never sent to any screen).
//
// Web Audio with lookahead scheduling ("A Tale of Two Clocks"): a short timer looks a little ahead and books each
// click on the audio clock, so clicks land exactly even if the page is busy. Beat times come from the same beat clock
// as the stage pulse (StageTempo.startedAt), so the click and the stage screens agree.

import { create } from 'zustand'
import { BPM_MAX, BPM_MIN, normalizeBpm, type StageTempo } from '@shared/tempo'
import { liveTempo, useApp } from '@/store/useApp'

const STORE_KEY = 'nl-metronome'

interface Saved {
  bpm: number
  follow: boolean
  volume: number
  accent: boolean
}

interface MetronomeState extends Saved {
  on: boolean
  /** The control is shown in the live panel (it also shows by itself while a song with a BPM is live). */
  open: boolean
  /** Manual tempo: when beat 1 fell (set on start, on a BPM change and by "Beat 1 now"). */
  manualStart: number
  toggle: () => void
  set: (patch: Partial<Saved & { open: boolean }>) => void
  /** Beat 1 is now: restarts the shared beat clock (stage screens too) and the manual count. */
  beatOne: () => void
}

function load(): Saved {
  const d: Saved = { bpm: 72, follow: true, volume: 0.7, accent: true }
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Partial<Saved>
    return {
      bpm: normalizeBpm(s.bpm) ?? d.bpm,
      follow: typeof s.follow === 'boolean' ? s.follow : d.follow,
      volume: typeof s.volume === 'number' ? Math.min(1, Math.max(0, s.volume)) : d.volume,
      accent: typeof s.accent === 'boolean' ? s.accent : d.accent
    }
  } catch {
    return d
  }
}

export const useMetronome = create<MetronomeState>()((set, get) => ({
  ...load(),
  on: false,
  open: false,
  manualStart: Date.now(),
  toggle: () => {
    const on = !get().on
    set({ on, manualStart: Date.now() })
    if (on) engine.start()
    else engine.stop()
  },
  set: (patch) => {
    const bpm = patch.bpm !== undefined ? Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(patch.bpm))) : undefined
    set({ ...patch, ...(bpm !== undefined ? { bpm, manualStart: Date.now() } : {}) })
    const { bpm: b, follow, volume, accent } = get()
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ bpm: b, follow, volume, accent }))
    } catch {
      /* private mode: not remembered */
    }
  },
  beatOne: () => {
    useApp.getState().restartBeat()
    set({ manualStart: Date.now() })
  }
}))

/** The tempo the click plays: the live song's (when following and it has one), else the manual BPM in 4. */
export function metronomeTempo(m: Pick<MetronomeState, 'follow' | 'bpm' | 'manualStart'>, song: StageTempo | null): StageTempo & { fromSong: boolean } {
  if (m.follow && song) return { ...song, fromSong: true }
  return { bpm: m.bpm, beatsPerBar: 4, startedAt: m.manualStart, fromSong: false }
}

// ---------- engine ----------

const TICK_MS = 25
const AHEAD_S = 0.12
/** Background windows get their timers slowed down to about once a second: book further ahead then. */
const AHEAD_HIDDEN_S = 1.5

const engine = (() => {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let unsub: (() => void) | undefined
  let key = ''
  let next = 0 // index of the next beat to book
  let anchor = { audio: 0, epoch: 0 } // the same moment on the audio clock (s) and the wall clock (ms)
  let booked: { osc: OscillatorNode; at: number }[] = []

  const current = (): StageTempo => metronomeTempo(useMetronome.getState(), liveTempo(useApp.getState()))

  /** Drop clicks booked for later (tempo changed or stopped). */
  const cancelFuture = (): void => {
    if (!ctx) return
    const now = ctx.currentTime
    for (const b of booked)
      if (b.at > now)
        try {
          b.osc.stop()
        } catch {
          /* already stopped */
        }
    booked = []
  }

  const click = (at: number, accent: boolean): void => {
    if (!ctx || !master) return
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = accent ? 1760 : 1175
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, at + 0.002)
    env.gain.exponentialRampToValueAtTime(0.0001, at + (accent ? 0.06 : 0.04))
    osc.connect(env).connect(master)
    osc.start(at)
    osc.stop(at + 0.08)
    booked.push({ osc, at })
  }

  const tick = (): void => {
    if (!ctx || !master) return
    const m = useMetronome.getState()
    master.gain.setTargetAtTime(m.volume, ctx.currentTime, 0.02)
    const t = current()
    const beatMs = 60_000 / t.bpm
    const k = `${t.bpm}|${t.beatsPerBar}|${t.startedAt}`
    const nowAudio = ctx.currentTime
    const nowEpoch = anchor.epoch + (nowAudio - anchor.audio) * 1000
    if (k !== key) {
      key = k
      cancelFuture()
      next = Math.ceil((nowEpoch + 5 - t.startedAt) / beatMs)
    }
    // Sound leaves the speakers this much after it is booked: book early by that much so it lines up with the screens.
    const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
    const ahead = (document.hidden ? AHEAD_HIDDEN_S : AHEAD_S) * 1000
    booked = booked.filter((b) => b.at > nowAudio - 0.2)
    while (t.startedAt + next * beatMs < nowEpoch + ahead) {
      const at = anchor.audio + (t.startedAt + next * beatMs - anchor.epoch) / 1000 - latency
      const bar = Math.max(1, t.beatsPerBar)
      if (at >= nowAudio) click(at, m.accent && ((next % bar) + bar) % bar === 0)
      next++
    }
  }

  return {
    async start(): Promise<void> {
      ctx ??= new AudioContext({ latencyHint: 'interactive' })
      if (!master) {
        master = ctx.createGain()
        master.gain.value = useMetronome.getState().volume
        master.connect(ctx.destination)
      }
      await ctx.resume()
      if (!useMetronome.getState().on) return
      anchor = { audio: ctx.currentTime, epoch: Date.now() }
      key = ''
      clearInterval(timer)
      timer = setInterval(tick, TICK_MS)
      // Re-book at once when the tempo changes (a new song goes live, "Beat 1 now").
      unsub?.()
      const a = useApp.subscribe((s, p) => {
        if (s.live !== p.live || s.beatStartedAt !== p.beatStartedAt || s.service !== p.service) tick()
      })
      const b = useMetronome.subscribe(tick)
      unsub = () => {
        a()
        b()
      }
      tick()
    },
    stop(): void {
      clearInterval(timer)
      timer = undefined
      unsub?.()
      unsub = undefined
      cancelFuture()
      key = ''
    }
  }
})()
