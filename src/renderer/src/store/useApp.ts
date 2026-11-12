import { create } from 'zustand'
import { applySavedLang, t } from '@/i18n'
import type {
  AspectRatio,
  Background,
  CountdownState,
  LiveFrame,
  Logo,
  MediaFit,
  MediaItem,
  OverlaySettings,
  RemoteCommand,
  ScriptureOptions,
  Caption,
  ScripturePassage,
  StageLayout,
  Service,
  ServiceItem,
  Slide,
  Snapshot,
  Song,
  StageChords,
  StageFrame,
  Template,
  TextStyle,
  Transition,
  VideoPlayback,
  CopyrightSettings
} from '@shared/types'
import { hasChords, stripChords } from '@shared/chords'
import type { BeatPulse } from '@shared/types'
import { beatsPerBar, type StageTempo } from '@shared/tempo'
import { languageText, plainLanguages, splitLanguages } from '@shared/bilingual'
import { labelColor, labelKey } from '@shared/labels'
import type { SavedSession } from '@shared/outputs'
import { BUILTIN_TEMPLATES } from '@/lib/templates'
import { DEFAULT_TRANSITION, applyVideoCommand, probeDuration, videoEnded, type VideoCommand } from '@/lib/video'
import { mediaUrl } from '@/lib/media'
import { addToHistory, passageSlides, passageTitle } from '@/lib/passages'
import { arrangeSlides } from '@/lib/arrangement'
import { DEFAULT_BG, DEFAULT_STYLE, SEED_SCRIPTURE, SEED_SONGS, uid } from '@/lib/defaults'
import { baseName, datedName, nextSunday, parseDay, today } from '@/lib/serviceDates'
import { DEFAULT_TICKER_OPTIONS, queueTicker, restoreTickerOptions, startTicker, type QueuedTicker, type TickerOptions } from '@/lib/ticker'

export type Tab = 'presentation' | 'songs' | 'scripture' | 'media' | 'countdown' | 'stage'
export type ClickMode = 'live' | 'preview'

/** Live can point at a service item or at the "scratch" item (scripture shown straight from the Bible tab). */
export const SCRATCH_ID = '__scratch__'

const DEFAULT_SCRIPTURE: ScriptureOptions = { perSlide: 1, numbers: true, parallelIds: [], parallelLayout: 'side' }

/** Older settings kept one Compare translation in `parallelId`. */
function restoreScripture(saved?: Partial<ScriptureOptions>): ScriptureOptions {
  const { parallelId, ...rest } = saved ?? {}
  const o = { ...DEFAULT_SCRIPTURE, ...rest }
  if (!Array.isArray(o.parallelIds)) o.parallelIds = []
  if (!o.parallelIds.length && parallelId) o.parallelIds = [parallelId]
  o.parallelIds = o.parallelIds.slice(0, 2)
  return o
}

export const DEFAULT_COPYRIGHT: CopyrightSettings = { licence: '', footer: 'edges', overlay: false }

/** Phone remote one-tap messages: at most this many, each this long. */
export const QUICK_CHAT_MAX = 16
export const QUICK_CHAT_LEN = 30
/** The built-in quick messages, in the operator's language ("|"-separated string). */
export const defaultQuickChat = (): string[] =>
  t('settings.quickChat.defaults')
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean)

interface AppState {
  ready: boolean
  tab: Tab
  songs: Song[]
  service: Service
  scratch: ServiceItem | null
  selectedItemId: string | null
  live: { itemId: string; index: number } | null
  /** Preview first: the slide cued for the operator only (never sent to screens). */
  cue: { itemId: string; index: number } | null
  /** What a click on a slide does: take it live, or cue it in Preview. Saved. */
  clickMode: ClickMode
  hideText: boolean
  black: boolean
  aspect: AspectRatio
  style: TextStyle
  /** Scripture's own text style (Bible tab and Scripture items). null = same as `style`. Saved. */
  scriptureStyle: TextStyle | null
  background: Background
  /** The user's saved looks (built-ins are in BUILTIN_TEMPLATES, not stored). */
  templates: Template[]
  /** Slide label colors chosen by the user, by label name (see shared/labels.ts). */
  labelColors: Record<string, string>
  bibleId: string | null
  scripture: ScriptureOptions
  editingSongId: string | 'new' | null
  /** Text slides item open in the slide editor. */
  editingTextId: string | null
  /** CCLI licence and the copyright footer (Settings → Church). Saved. */
  copyright: CopyrightSettings
  setCopyright: (patch: Partial<CopyrightSettings>) => void
  /** Phone remote one-tap chat messages (Settings → Phone remote). null = the built-in list in the current language. Saved. */
  quickChat: string[] | null
  setQuickChat: (list: string[] | null) => void
  /** Bilingual songs: also show the second language on stage screens (default: primary only). Saved. */
  stageSecondLanguage: boolean
  setStageSecondLanguage: (on: boolean) => void
  /** A new Text slides item (announcements, sermon points) after the selected item; returns its id. */
  addTextItem: (title?: string) => string
  /** Replace a text item's title and slides (Text slides editor). */
  setItemSlides: (itemId: string, title: string, slides: Slide[]) => void
  openTextEditor: (id: string | null) => void
  countdown: CountdownState
  stage: {
    message: string
    showNext: boolean
    showClock: boolean
    chords: StageChords
    layout: StageLayout
    scale: number // 0.7–1.5
    showTitles: boolean
    mirror: boolean
    showServiceTimer: boolean
    /** "12:34 left" for the live item when it has planned minutes. */
    showItemTime: boolean
    messageFlash: boolean // flash until cleared (otherwise a new message flashes 3 times)
    messageAlign: 'left' | 'center' | 'right'
    /** Beat pulse for the band (songs with a BPM): off, a dot in the header, or the dot plus a flashing frame. */
    beatPulse: BeatPulse
  }
  /** Lower-third name caption for the livestream overlay (and optionally the audience screen). */
  caption: CaptionState
  captionPresets: Caption[]
  /** Bible tab: last passages shown or added (newest first) and pinned passages. */
  scriptureHistory: ScripturePassage[]
  scripturePins: ScripturePassage[]
  media: MediaItem[]
  logo: Logo | null
  overlay: OverlaySettings
  /** When auto-advance moves to the next slide (ms), or null. */
  autoNextAt: number | null
  /** Slide transition on the audience, wireless and overlay screens (global setting). */
  transition: Transition
  /** Playback of the live video background (null when the live background is not a video). */
  video: (VideoPlayback & { duration?: number; key: string }) | null
  setTransition: (patch: Partial<Transition>) => void
  videoCtl: (cmd: VideoCommand) => void
  /** Pictures and videos from the media library as service items: several pictures → one slideshow, each video → its own item. */
  addMediaToService: (items: MediaItem[]) => void
  /** Rehearsal: the operator works as usual while every screen keeps what it showed when rehearsal began. */
  rehearsal: Rehearsal | null
  /** Service timer: set by the first go-live of the day (see startTimers). Item timer: when the live item changed. */
  serviceStartedAt: number | null
  itemStartedAt: number | null
  /** Beat clock for stage screens and the metronome: when beat 1 fell (set when a song goes live; "Beat 1 now"). */
  beatStartedAt: number | null
  /** Restart the beat count: beat 1 is now (re-syncs every stage screen and the metronome). */
  restartBeat: () => void
  resetServiceTimer: () => void
  /** Planned length of an item (undefined = none). */
  setItemMinutes: (itemId: string, minutes: number | undefined) => void
  /** Song section order for this service item (undefined = song order). Slides are rebuilt from the library song. */
  setItemArrangement: (itemId: string, arrangement: string[] | undefined) => void

  hydrate: () => Promise<void>
  setTab: (t: Tab) => void
  selectItem: (id: string) => void
  goLive: (itemId: string, index: number) => void
  setCue: (itemId: string, index: number) => void
  /** Take the cued slide live. */
  takeCue: () => void
  setClickMode: (m: ClickMode) => void
  showScratch: (title: string, slides: Slide[], index?: number) => void
  next: () => void
  prev: () => void
  clearLive: () => void
  toggleHideText: () => void
  toggleBlack: () => void
  setAspect: (a: AspectRatio) => void
  setBackground: (b: Background) => void
  setBibleId: (id: string) => void
  setScripture: (patch: Partial<ScriptureOptions>) => void
  addSongToService: (songId: string) => void
  addScripture: (title: string, slides: Slide[]) => void
  addBlank: () => void
  /** A website / vdo.ninja feed or a camera as its own service item (one slide, the source as background). */
  addSourceItem: (title: string, bg: Background) => void
  /** An imported presentation from the media library, one slide per page. */
  addDeckToService: (m: MediaItem) => void
  startRehearsal: () => void
  endRehearsal: () => void
  setRehearsalStage: (follow: boolean) => void
  removeItem: (id: string) => void
  /** Move an item; a section moves together with the items under it. */
  moveItem: (from: number, to: number) => void
  /** Add a section header after the selected item (or at the end) and return its id. */
  addSection: (title?: string) => string
  updateItem: (id: string, patch: Partial<Pick<ServiceItem, 'title' | 'collapsed' | 'color'>>) => void
  openSongEditor: (id: string | 'new' | null) => void
  saveSong: (song: Song) => Promise<Song>
  deleteSong: (id: string) => Promise<void>
  updateCountdown: (patch: Partial<CountdownState>) => void
  countdownStart: () => void
  countdownPause: () => void
  countdownReset: () => void
  setCountdownVisible: (v: boolean) => void
  setStage: (patch: Partial<AppState['stage']>) => void
  /** Live transpose of one service item (stage chords only; the library song is unchanged). */
  setItemTranspose: (itemId: string, semis: number) => void
  /** Auto-advance for one service item (undefined = off). */
  setItemAdvance: (itemId: string, advance: ServiceItem['advance']) => void
  runCommand: (cmd: RemoteCommand) => void
  setStyle: (patch: Partial<TextStyle>) => void
  /** Change Scripture's style; the first change starts from the songs style. null = follow the songs style again. */
  setScriptureStyle: (patch: Partial<TextStyle> | null) => void
  /** Save a text style (default: the global one; optionally the default background) as a named look. Returns its id. */
  saveTemplate: (name: string, withBackground: boolean, style?: TextStyle) => string
  renameTemplate: (id: string, name: string) => void
  deleteTemplate: (id: string) => void
  /** Copy a look onto the global text style (and background, if it has one), or onto Scripture's style only. */
  applyTemplate: (id: string, target?: 'main' | 'scripture') => void
  setItemTemplate: (itemId: string, templateId: string | undefined) => void
  /** null = back to the default color. */
  setLabelColor: (label: string, color: string | null) => void
  setLogo: (logo: Logo | null) => void
  setItemBackground: (itemId: string, bg: Background | undefined) => void
  importMedia: (paths?: string[], only?: 'audio') => Promise<{ added: MediaItem[]; skipped: string[] }>
  deleteMedia: (id: string) => Promise<void>
  renameMedia: (id: string, name: string) => Promise<void>
  /** How each picture/video sits on the screen, by media ref (Media tab). Missing = fill the screen. Saved. */
  mediaFit: Record<string, MediaFit>
  setMediaFit: (ref: string, fit: MediaFit) => void
  /** What newly imported pictures/videos start on (existing files keep theirs). Saved. */
  mediaFitDefault: MediaFit
  setMediaFitDefault: (fit: MediaFit) => void
  /** Give newly added pictures/videos the default fit (call with what was just added to the library). */
  fitNewMedia: (items: MediaItem[]) => void
  setOverlay: (patch: Partial<OverlaySettings>) => void
  setCaption: (patch: Partial<CaptionState>) => void
  /** Show the caption (optionally with new wording); hides itself after `autoHide` seconds when set. */
  showCaption: (c?: Caption) => void
  hideCaption: () => void
  saveCaptionPreset: () => void
  deleteCaptionPreset: (index: number) => void
  /** Audience announcements (lib/ticker.ts): options (saved), the playing message and the queue (per session). */
  ticker: TickerState
  tickerPresets: string[] // saved
  setTickerOptions: (patch: Partial<TickerOptions>) => void
  /** Queue a message with the current options; it plays as soon as nothing else is (not during rehearsal). */
  sendTicker: (text: string) => void
  /** End the playing message (the next queued one follows). */
  stopTicker: () => void
  clearTickerQueue: () => void
  saveTickerPreset: (text: string) => void
  deleteTickerPreset: (index: number) => void
  recordScripture: (p: ScripturePassage) => void
  togglePin: (p: ScripturePassage) => void
  clearScriptureHistory: () => void
  /** Fetch a passage again and show it live with the current Scripture options. */
  showPassage: (p: ScripturePassage) => Promise<boolean>
  addSongs: (songs: Song[]) => Promise<void>
  /** Service library. Switching clears the screen; it is refused during rehearsal (returns false). */
  openService: (id: string) => Promise<boolean>
  /** A new empty service for next Sunday. */
  newService: () => Promise<boolean>
  /** "Copy for next week": same order, fresh ids, songs re-read from the library, live transpose reset. */
  duplicateService: () => Promise<boolean>
  renameService: (name: string) => void
  setServiceDate: (date: string | undefined) => void
  /** Delete a service; deleting the open one opens the next (or a new empty one). */
  deleteService: (id: string) => Promise<boolean>
}

export interface Rehearsal {
  frozen: Snapshot // what the screens keep showing
  saved: Pick<AppState, 'live' | 'hideText' | 'black' | 'scratch'> & { countdown: CountdownState }
  stageFollows: boolean // band practice: stage screens follow the operator, the audience screen stays put
}

export interface CaptionState extends Caption {
  visible: boolean
  target: 'overlay' | 'both' // OBS overlay only, or the audience screen too
  autoHide: number // seconds, 0 = stays until hidden
}

export interface TickerState extends TickerOptions {
  current: import('@shared/types').TickerMessage | null
  queue: QueuedTicker[]
}

const DEFAULT_CAPTION: CaptionState = { name: '', title: '', visible: false, target: 'overlay', autoHide: 0 }
let captionTimer: ReturnType<typeof setTimeout> | undefined

export const DEFAULT_OVERLAY: OverlaySettings = {
  position: 'lower',
  size: 22,
  band: true,
  showCountdown: true,
  showReference: true
}

export const DEFAULT_COUNTDOWN: CountdownState = {
  title: 'The service is about to start', // i18n-ignore: stored English default, shown translated via countdownTitle (lib/time.ts)
  subtext: '',
  mode: 'duration',
  durationSec: 300,
  targetTime: '10:00',
  overtime: true,
  showOn: 'both',
  visible: false,
  mainHidden: false,
  status: 'idle',
  endsAt: null,
  remainingMs: 300_000
}

/** Next occurrence of "HH:MM" today or tomorrow, as epoch ms. */
export function targetToEpoch(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h || 0, m || 0, 0, 0)
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1)
  return d.getTime()
}

const songToItem = (s: Song): ServiceItem => ({
  id: uid(),
  kind: 'song',
  title: s.title,
  sourceId: s.id,
  key: s.key,
  ...(s.templateId ? { templateId: s.templateId } : {}),
  ...(s.languageMode && s.languageMode !== 'both' ? { languageMode: s.languageMode } : {}),
  ...songTempo(s),
  slides: arrangeSlides(s.slides).slides
})

/** A song's tempo fields for its service items (both keys present, so a removed tempo is cleared on update). */
const songTempo = (s: Pick<Song, 'bpm' | 'timeSignature'>): Pick<ServiceItem, 'bpm' | 'timeSignature'> =>
  ({ bpm: s.bpm, timeSignature: s.timeSignature })

/** A song item's slides from the library song, in the item's arrangement (labels the song lost are dropped). */
function arrangedItem<T extends ServiceItem>(it: T, song: Song): T {
  if (!it.arrangement?.length) return { ...it, slides: arrangeSlides(song.slides).slides }
  const r = arrangeSlides(song.slides, it.arrangement)
  const missing = [...(it.arrangementMissing ?? []), ...r.missing]
  return { ...it, slides: r.slides, arrangement: r.arrangement, arrangementMissing: missing.length ? missing : undefined }
}

const seedService = (songs: Song[]): Service => ({
  id: uid(),
  name: 'Sunday Service',
  items: [
    { id: uid(), kind: 'blank', title: 'Welcome (blank)', slides: [{ id: uid(), text: '' }] },
    ...songs.slice(0, 2).map(songToItem),
    { id: uid(), kind: 'scripture', title: 'John 3:16–17', slides: SEED_SCRIPTURE }
  ]
})

let hydrating: Promise<void> | null = null
/** Settings as loaded at startup, for stores outside this one (e.g. the music player). */
export let bootSettings: Record<string, unknown> = {}

export const useApp = create<AppState>()((set, get) => ({
  ready: false,
  tab: 'presentation',
  songs: [],
  service: { id: uid(), name: 'Sunday Service', items: [] },
  scratch: null,
  selectedItemId: null,
  live: null,
  cue: null,
  clickMode: 'live',
  hideText: false,
  black: false,
  aspect: '16:9',
  style: DEFAULT_STYLE,
  scriptureStyle: null,
  mediaFit: {},
  mediaFitDefault: 'cover',
  background: DEFAULT_BG,
  templates: [],
  labelColors: {},
  bibleId: null,
  scripture: DEFAULT_SCRIPTURE,
  editingSongId: null,
  editingTextId: null,
  copyright: DEFAULT_COPYRIGHT,
  quickChat: null,
  stageSecondLanguage: false,
  countdown: DEFAULT_COUNTDOWN,
  stage: { message: '', showNext: true, showClock: true, chords: 'standard', layout: 'standard', scale: 1, showTitles: true, mirror: false, showServiceTimer: false, showItemTime: true, messageFlash: false, messageAlign: 'center', beatPulse: 'off' },
  caption: DEFAULT_CAPTION,
  captionPresets: [],
  ticker: { ...DEFAULT_TICKER_OPTIONS, current: null, queue: [] },
  tickerPresets: [],
  scriptureHistory: [],
  scripturePins: [],
  media: [],
  logo: null,
  overlay: DEFAULT_OVERLAY,
  rehearsal: null,
  autoNextAt: null,
  transition: DEFAULT_TRANSITION,
  video: null,
  serviceStartedAt: null,
  itemStartedAt: null,
  beatStartedAt: null,
  restartBeat: () => set({ beatStartedAt: Date.now() }),

  // Single-flight: concurrent calls (e.g. React StrictMode running effects twice) share one load,
  // so a first run can't create two starter services.
  hydrate: () =>
    (hydrating ??= (async () => {
      const [data, media] = await Promise.all([window.nl.data.bootstrap(), window.nl.media.list()])
      let songs = data.songs
      const s = data.settings
      bootSettings = s
      applySavedLang(s.language) // UI language: setting `language`, else the OS language
      // First run: seed the library with starter hymns.
      if (!s.seeded) {
        await window.nl.data.saveSongs(SEED_SONGS)
        await window.nl.data.setSetting('seeded', true)
        songs = SEED_SONGS
      }
      const service = data.service ?? seedService(songs)
      if (!data.service) await window.nl.data.saveService(service)
      set({
        ready: true,
        songs,
        service,
        aspect: (s.aspect as AspectRatio) ?? '16:9',
        style: { ...DEFAULT_STYLE, ...((s.style as Partial<TextStyle>) ?? {}) },
        mediaFit: s.mediaFit && typeof s.mediaFit === 'object' ? (s.mediaFit as Record<string, MediaFit>) : {},
        mediaFitDefault: (['cover', 'contain', 'fill', 'none'] as const).includes(s.mediaFitDefault as MediaFit)
          ? (s.mediaFitDefault as MediaFit)
          : 'cover',
        scriptureStyle: s.scriptureStyle && typeof s.scriptureStyle === 'object' ? { ...DEFAULT_STYLE, ...(s.scriptureStyle as Partial<TextStyle>) } : null,
        background: (s.background as Background) ?? DEFAULT_BG,
        templates: Array.isArray(s.templates)
          ? (s.templates as Template[]).map((t) => ({ ...t, builtin: undefined, style: { ...DEFAULT_STYLE, ...t.style } }))
          : [],
        labelColors: (s.labelColors as Record<string, string>) ?? {},
        clickMode: s.clickMode === 'preview' ? 'preview' : 'live',
        bibleId: (s.bibleId as string) ?? null,
        scripture: restoreScripture(s.scripture as Partial<ScriptureOptions> | undefined),
        copyright: { ...DEFAULT_COPYRIGHT, ...((s.copyright as Partial<CopyrightSettings>) ?? {}) },
        quickChat: Array.isArray(s.quickChat)
          ? (s.quickChat as unknown[]).filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, QUICK_CHAT_MAX)
          : null,
        stageSecondLanguage: s.stageSecondLanguage === true,
        media,
        logo: (s.logo as Logo) ?? null,
        overlay: { ...DEFAULT_OVERLAY, ...((s.overlay as Partial<OverlaySettings>) ?? {}) },
        countdown: restoreCountdown(s.countdown as Partial<CountdownState> | undefined),
        // Saved: showNext/showClock. The message is per session.
        stage: {
          showNext: true,
          showClock: true,
          chords: 'standard',
          layout: 'standard',
          scale: 1,
          showTitles: true,
          mirror: false,
          showServiceTimer: false,
          showItemTime: true,
          messageFlash: false,
          messageAlign: 'center',
          beatPulse: 'off',
          ...((s.stage as object) ?? {}),
          message: ''
        },
        // Saved: wording, target and auto-hide. Never visible after a restart.
        caption: { ...DEFAULT_CAPTION, ...((s.caption as Partial<CaptionState>) ?? {}), visible: false },
        captionPresets: Array.isArray(s.captionPresets) ? (s.captionPresets as Caption[]) : [],
        ticker: { ...restoreTickerOptions(s.tickerOptions), current: null, queue: [] },
        tickerPresets: Array.isArray(s.tickerPresets) ? (s.tickerPresets as unknown[]).filter((x): x is string => typeof x === 'string') : [],
        scriptureHistory: Array.isArray(s.scriptureHistory) ? (s.scriptureHistory as ScripturePassage[]) : [],
        scripturePins: Array.isArray(s.scripturePins) ? (s.scripturePins as ScripturePassage[]) : [],
        transition: { ...DEFAULT_TRANSITION, ...((s.transition as Partial<Transition>) ?? {}) },
        // A restart during the service keeps its timer (same day only).
        serviceStartedAt: typeof s.serviceStartedAt === 'number' && sameDay(s.serviceStartedAt, Date.now()) ? s.serviceStartedAt : null
      })
      startAutosave()
      startAutoAdvance()
      startVideoTracking()
      startUsageLog()
      startTimers()
      startCountdownAutoLive()
      startBeatClock()
      startTickerQueue()
    })().finally(() => (hydrating = null))),

  setTab: (tab) => set({ tab }),
  selectItem: (id) => set({ selectedItemId: id }),
  goLive: (itemId, index) =>
    set((s) => ({
      live: { itemId, index },
      black: false,
      countdown: releaseMain(s.countdown),
      ...(itemId !== SCRATCH_ID ? { selectedItemId: itemId } : {})
    })),

  setCue: (itemId, index) => set({ cue: { itemId, index }, selectedItemId: itemId }),
  takeCue: () => {
    const { cue, service } = get()
    const item = cue && service.items.find((i) => i.id === cue.itemId)
    if (!cue || !item || cue.index >= item.slides.length) return set({ cue: null })
    get().goLive(cue.itemId, cue.index)
    set({ cue: null })
  },
  setClickMode: (clickMode) => set((s) => ({ clickMode, cue: clickMode === 'live' ? null : s.cue })),

  showScratch: (title, slides, index = 0) => {
    if (!slides.length) return
    set((s) => ({
      scratch: { id: SCRATCH_ID, kind: 'scripture', title, slides },
      live: { itemId: SCRATCH_ID, index },
      black: false,
      countdown: releaseMain(s.countdown)
    }))
  },

  next: () => {
    const { live, scratch } = get()
    if (live?.itemId === SCRATCH_ID) {
      if (scratch && live.index < scratch.slides.length - 1) set({ live: { itemId: SCRATCH_ID, index: live.index + 1 } })
      return
    }
    const items = get().service.items
    if (!live) {
      const first = items.find((i) => i.slides.length)
      if (first) get().goLive(first.id, 0)
      return
    }
    const i = items.findIndex((it) => it.id === live.itemId)
    if (i < 0) return
    if (live.index < items[i].slides.length - 1) {
      set({ live: { itemId: live.itemId, index: live.index + 1 } })
      return
    }
    // Past the last slide: continue into the next item that has slides.
    const nextItem = items.slice(i + 1).find((it) => it.slides.length)
    if (nextItem) get().goLive(nextItem.id, 0)
  },

  prev: () => {
    const { live } = get()
    if (!live) return
    if (live.itemId === SCRATCH_ID) {
      if (live.index > 0) set({ live: { itemId: SCRATCH_ID, index: live.index - 1 } })
      return
    }
    const items = get().service.items
    if (live.index > 0) {
      set({ live: { itemId: live.itemId, index: live.index - 1 } })
      return
    }
    const i = items.findIndex((it) => it.id === live.itemId)
    const prevItem = items.slice(0, Math.max(i, 0)).reverse().find((it) => it.slides.length)
    if (prevItem) get().goLive(prevItem.id, prevItem.slides.length - 1)
  },

  // Clear also ends the announcement and its queue (not during rehearsal: the screens keep theirs).
  clearLive: () => set((s) => ({ live: null, hideText: false, black: false, ...(s.rehearsal ? {} : { ticker: { ...s.ticker, current: null, queue: [] } }) })),
  toggleHideText: () => set((s) => ({ hideText: !s.hideText })),
  toggleBlack: () => set((s) => ({ black: !s.black })),
  setAspect: (aspect) => set({ aspect }),
  setBackground: (background) => set({ background }),
  setBibleId: (bibleId) => set({ bibleId }),
  setScripture: (patch) => set((s) => ({ scripture: { ...s.scripture, ...patch } })),

  addSongToService: (songId) => {
    const song = get().songs.find((s) => s.id === songId)
    if (!song) return
    const item = songToItem(song)
    set((s) => ({ service: { ...s.service, items: [...s.service.items, item] }, selectedItemId: item.id }))
  },

  addScripture: (title, slides) => {
    const item: ServiceItem = { id: uid(), kind: 'scripture', title, slides }
    set((s) => ({ service: { ...s.service, items: [...s.service.items, item] }, selectedItemId: item.id }))
  },

  addBlank: () => {
    const item: ServiceItem = { id: uid(), kind: 'blank', title: 'Blank', slides: [{ id: uid(), text: '' }] }
    set((s) => ({ service: { ...s.service, items: [...s.service.items, item] } }))
  },

  addSourceItem: (title, bg) => {
    const kind = bg.kind === 'camera' ? 'camera' : 'web'
    const item: ServiceItem = { id: uid(), kind, title, slides: [{ id: uid(), text: '' }], background: bg }
    set((s) => ({ service: { ...s.service, items: [...s.service.items, item] }, selectedItemId: item.id }))
  },

  addDeckToService: (m) => {
    if (m.kind !== 'deck' || !m.deck) return
    const item: ServiceItem = {
      id: uid(),
      kind: 'deck',
      title: m.name,
      sourceId: m.id,
      slides: m.deck.pages.map((p) => ({
        id: uid(),
        text: '',
        background: { kind: 'image', src: p.ref, fit: 'contain' },
        ...(p.notes ? { notes: p.notes } : {})
      }))
    }
    set((s) => ({ service: { ...s.service, items: [...s.service.items, item] }, selectedItemId: item.id }))
  },

  startRehearsal: () => {
    const s = get()
    if (s.rehearsal) return
    set({
      rehearsal: {
        frozen: buildSnapshot(s),
        saved: { live: s.live, hideText: s.hideText, black: s.black, scratch: s.scratch, countdown: s.countdown },
        stageFollows: false
      }
    })
  },

  endRehearsal: () => {
    const r = get().rehearsal
    if (!r) return
    // Back to exactly what the screens show, so the next click continues from there. Countdown wording and
    // duration edits made while rehearsing are kept; only its running state goes back.
    const { visible, mainHidden, status, endsAt, remainingMs } = r.saved.countdown
    set((s) => ({
      rehearsal: null,
      live: r.saved.live,
      hideText: r.saved.hideText,
      black: r.saved.black,
      scratch: r.saved.scratch,
      countdown: { ...s.countdown, visible, mainHidden, status, endsAt, remainingMs }
    }))
  },

  setRehearsalStage: (stageFollows) => set((s) => (s.rehearsal ? { rehearsal: { ...s.rehearsal, stageFollows } } : {})),

  removeItem: (id) =>
    set((s) => ({
      service: { ...s.service, items: s.service.items.filter((i) => i.id !== id) },
      selectedItemId: s.selectedItemId === id ? null : s.selectedItemId,
      live: s.live?.itemId === id ? null : s.live
    })),

  moveItem: (from, to) =>
    set((s) => {
      const items = [...s.service.items]
      let len = 1
      if (items[from]?.kind === 'section') {
        const end = items.findIndex((it, i) => i > from && it.kind === 'section')
        len = (end < 0 ? items.length : end) - from
      }
      if (to >= from && to < from + len) return {} // onto itself
      const block = items.splice(from, len)
      items.splice(to > from ? to - len + 1 : to, 0, ...block)
      return { service: { ...s.service, items } }
    }),

  addSection: (title = t('presentation.newSection')) => {
    const item: ServiceItem = { id: uid(), kind: 'section', title, slides: [] }
    set((s) => {
      const items = [...s.service.items]
      const at = s.selectedItemId ? items.findIndex((i) => i.id === s.selectedItemId) : -1
      items.splice(at < 0 ? items.length : at + 1, 0, item)
      return { service: { ...s.service, items } }
    })
    return item.id
  },

  updateItem: (id, patch) =>
    set((s) => ({ service: { ...s.service, items: s.service.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) } })),

  openSongEditor: (id) => set({ editingSongId: id }),
  openTextEditor: (id) => set({ editingTextId: id }),

  setCopyright: (patch) => set((s) => ({ copyright: { ...s.copyright, ...patch } })),
  setQuickChat: (quickChat) => set({ quickChat }),
  setStageSecondLanguage: (stageSecondLanguage) => set({ stageSecondLanguage }),

  addTextItem: (title = t('presentation.announcements')) => {
    const item: ServiceItem = { id: uid(), kind: 'text', title, slides: [{ id: uid(), heading: '', text: '' }] }
    set((s) => {
      const items = [...s.service.items]
      const at = s.selectedItemId ? items.findIndex((i) => i.id === s.selectedItemId) : -1
      items.splice(at < 0 ? items.length : at + 1, 0, item)
      return { service: { ...s.service, items }, selectedItemId: item.id }
    })
    return item.id
  },

  setItemSlides: (itemId, title, slides) =>
    set((s) => {
      const items = s.service.items.map((it) => (it.id === itemId ? { ...it, title: title.trim() || it.title, slides } : it))
      // The live slide may be gone now.
      const live = s.live?.itemId === itemId && s.live.index >= slides.length ? (slides.length ? { itemId, index: slides.length - 1 } : null) : s.live
      return { service: { ...s.service, items }, live }
    }),

  saveSong: async (song) => {
    const saved = await window.nl.data.saveSong(song)
    set((s) => {
      const before = s.songs.find((x) => x.id === saved.id)
      const songs = before ? s.songs.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...s.songs]
      // Keep service copies of this song in step with the library. A look picked for the item itself stays.
      const items = s.service.items.map((it) =>
        it.sourceId === saved.id && it.kind === 'song'
          ? {
              ...arrangedItem(it, saved),
              title: saved.title,
              key: saved.key,
              languageMode: saved.languageMode && saved.languageMode !== 'both' ? saved.languageMode : undefined,
              ...songTempo(saved),
              templateId: it.templateId === before?.templateId ? saved.templateId : it.templateId
            }
          : it
      )
      const liveItem = s.live && items.find((i) => i.id === s.live!.itemId)
      const live = s.live && liveItem && s.live.index >= liveItem.slides.length ? null : s.live
      return { songs, service: { ...s.service, items }, live }
    })
    return saved
  },

  deleteSong: async (id) => {
    await window.nl.data.deleteSong(id)
    set((s) => ({ songs: s.songs.filter((x) => x.id !== id) }))
  },

  updateCountdown: (patch) =>
    set((s) => {
      const c = { ...s.countdown, ...patch }
      // Changing the duration while idle resets the displayed time.
      if (c.status === 'idle' && (patch.durationSec !== undefined || patch.mode !== undefined)) c.remainingMs = c.durationSec * 1000
      return { countdown: c }
    }),

  countdownStart: () =>
    set((s) => {
      const c = s.countdown
      if (c.status === 'running') return {}
      const endsAt = c.mode === 'target' && c.status === 'idle' ? targetToEpoch(c.targetTime) : Date.now() + c.remainingMs
      return { countdown: { ...c, status: 'running', endsAt, visible: true, mainHidden: false } }
    }),

  countdownPause: () =>
    set((s) => {
      const c = s.countdown
      if (c.status !== 'running' || c.endsAt === null) return {}
      return { countdown: { ...c, status: 'paused', remainingMs: c.endsAt - Date.now(), endsAt: null } }
    }),

  countdownReset: () =>
    set((s) => ({ countdown: { ...s.countdown, status: 'idle', endsAt: null, remainingMs: s.countdown.durationSec * 1000 } })),

  setCountdownVisible: (visible) => set((s) => ({ countdown: { ...s.countdown, visible, mainHidden: false } })),

  setStage: (patch) => set((s) => ({ stage: { ...s.stage, ...patch } })),

  setItemAdvance: (itemId, advance) =>
    set((s) => ({
      service: { ...s.service, items: s.service.items.map((it) => (it.id === itemId ? { ...it, advance } : it)) }
    })),

  resetServiceTimer: () => set((s) => ({ serviceStartedAt: s.live ? Date.now() : null })),

  setItemMinutes: (itemId, minutes) =>
    set((s) => ({
      service: {
        ...s.service,
        items: s.service.items.map((it) => (it.id === itemId ? { ...it, minutes: minutes && minutes > 0 ? minutes : undefined } : it))
      }
    })),

  setItemArrangement: (itemId, arrangement) =>
    set((s) => {
      const it = s.service.items.find((x) => x.id === itemId)
      const song = it?.kind === 'song' && it.sourceId ? s.songs.find((x) => x.id === it.sourceId) : undefined
      if (!it || !song) return {}
      // Editing the arrangement clears the "labels missing" warning.
      const next = arrangedItem({ ...it, arrangement: arrangement?.length ? arrangement : undefined, arrangementMissing: undefined }, song)
      const items = s.service.items.map((x) => (x.id === itemId ? next : x))
      const live = s.live?.itemId === itemId && s.live.index >= next.slides.length ? { itemId, index: next.slides.length - 1 } : s.live
      return { service: { ...s.service, items }, live }
    }),

  setItemTranspose: (itemId, semis) =>
    set((s) => ({
      service: {
        ...s.service,
        items: s.service.items.map((it) => (it.id === itemId ? { ...it, transpose: ((((semis + 6) % 12) + 12) % 12) - 6 || undefined } : it))
      }
    })),

  setStyle: (patch) => set((s) => ({ style: { ...s.style, ...patch } })),
  setScriptureStyle: (patch) =>
    set((s) => ({ scriptureStyle: patch === null ? null : { ...(s.scriptureStyle ?? s.style), ...patch } })),

  saveTemplate: (name, withBackground, style) => {
    const s = get()
    const look: Template = {
      id: uid(),
      name: name.trim() || t('presentation.untitledLook'),
      style: { ...(style ?? s.style) },
      ...(withBackground ? { background: s.background } : {})
    }
    set({ templates: [...s.templates, look] })
    return look.id
  },

  renameTemplate: (id, name) =>
    set((s) => ({ templates: s.templates.map((t) => (t.id === id ? { ...t, name: name.trim() || t.name } : t)) })),

  deleteTemplate: (id) =>
    set((s) => ({
      templates: s.templates.filter((t) => t.id !== id),
      // Items that used it go back to the global style (library songs fall back on their own: the id no longer resolves).
      service: { ...s.service, items: s.service.items.map((it) => (it.templateId === id ? { ...it, templateId: undefined } : it)) }
    })),

  applyTemplate: (id, target = 'main') => {
    const t = findTemplate(get(), id)
    if (!t) return
    if (target === 'scripture') set({ scriptureStyle: { ...DEFAULT_STYLE, ...t.style } })
    else set((s) => ({ style: { ...DEFAULT_STYLE, ...t.style }, background: t.background ?? s.background }))
  },

  setItemTemplate: (itemId, templateId) =>
    set((s) => ({
      service: { ...s.service, items: s.service.items.map((it) => (it.id === itemId ? { ...it, templateId } : it)) }
    })),

  setLabelColor: (label, color) =>
    set((s) => {
      const k = labelKey(label)
      if (!k) return {}
      const labelColors = { ...s.labelColors }
      if (color) labelColors[k] = color
      else delete labelColors[k]
      return { labelColors }
    }),

  setLogo: (logo) => set({ logo }),

  setItemBackground: (itemId, bg) =>
    set((s) => ({
      service: { ...s.service, items: s.service.items.map((it) => (it.id === itemId ? { ...it, background: bg } : it)) }
    })),

  importMedia: async (paths, only) => {
    const r = await window.nl.media.import(paths, only)
    if (r.added.length) set((s) => ({ media: [...r.added.slice().reverse(), ...s.media] }))
    get().fitNewMedia(r.added)
    // Presentations are drawn page by page here (they add themselves to the library as they finish).
    if (r.decks.length) {
      const { importDecks } = await import('@/lib/deck')
      r.added.push(...(await importDecks(r.decks)))
    }
    return { added: r.added, skipped: r.skipped }
  },

  deleteMedia: async (id) => {
    const item = get().media.find((m) => m.id === id)
    await window.nl.media.remove(id)
    set((s) => {
      // Anything still pointing at the deleted file falls back to the default.
      const uses = (b?: Background): boolean => !!item && usesMedia(b, item)
      return {
        media: s.media.filter((m) => m.id !== id),
        mediaFit: item && item.ref in s.mediaFit ? Object.fromEntries(Object.entries(s.mediaFit).filter(([r]) => r !== item.ref)) : s.mediaFit,
        background: uses(s.background) ? DEFAULT_BG : s.background,
        logo: item && s.logo?.src === item.ref ? null : s.logo,
        service: {
          ...s.service,
          items: s.service.items
            // A deleted presentation leaves the service order too: its pages are gone.
            .filter((it) => !(item?.kind === 'deck' && it.kind === 'deck' && it.sourceId === item.id))
            .map((it) => (uses(it.background) ? { ...it, background: undefined } : it))
        },
        live: s.live && item?.kind === 'deck' && s.service.items.some((it) => it.id === s.live!.itemId && it.sourceId === item.id) ? null : s.live
      }
    })
  },

  setMediaFit: (ref, fit) =>
    set((s) => {
      const next = { ...s.mediaFit }
      if (fit === 'cover') delete next[ref]
      else next[ref] = fit
      return { mediaFit: next }
    }),

  setMediaFitDefault: (mediaFitDefault) => set({ mediaFitDefault }),

  fitNewMedia: (items) =>
    set((s) => {
      const fit = s.mediaFitDefault
      const fresh = items.filter((m) => (m.kind === 'image' || m.kind === 'video') && !(m.ref in s.mediaFit))
      if (fit === 'cover' || !fresh.length) return {}
      const next = { ...s.mediaFit }
      for (const m of fresh) next[m.ref] = fit
      return { mediaFit: next }
    }),

  renameMedia: async (id, name) => {
    await window.nl.media.rename(id, name)
    set((s) => ({ media: s.media.map((m) => (m.id === id ? { ...m, name: name.trim() || 'Untitled' } : m)) }))
  },

  setOverlay: (patch) => set((s) => ({ overlay: { ...s.overlay, ...patch } })),

  setTransition: (patch) => set((s) => ({ transition: { ...s.transition, ...patch } })),

  videoCtl: (cmd) => set((s) => (s.video ? { video: applyVideoCommand(s.video, cmd, Date.now()) } : {})),

  addMediaToService: (list) => {
    const pics = list.filter((m) => m.kind === 'image')
    const vids = list.filter((m) => m.kind === 'video')
    const added: ServiceItem[] = []
    if (pics.length)
      added.push({
        id: uid(),
        kind: 'media',
        title: pics.length === 1 ? pics[0].name : 'Slideshow',
        slides: pics.map((m) => ({ id: uid(), label: m.name, text: '', background: { kind: 'image', src: m.ref, fit: 'contain' } })),
        ...(pics.length > 1 ? { advance: { seconds: 8, loop: true } } : {})
      })
    for (const m of vids)
      added.push({
        id: uid(),
        kind: 'media',
        title: m.name,
        slides: [{ id: uid(), label: 'Video', text: '', background: { kind: 'video', src: m.ref, loop: false, muted: false } }]
      })
    if (!added.length) return
    set((s) => {
      // After the selected item, else at the end.
      const items = [...s.service.items]
      const at = s.selectedItemId ? items.findIndex((i) => i.id === s.selectedItemId) : -1
      items.splice(at < 0 ? items.length : at + 1, 0, ...added)
      return { service: { ...s.service, items }, selectedItemId: added[added.length - 1].id }
    })
  },

  setCaption: (patch) => set((s) => ({ caption: { ...s.caption, ...patch } })),

  showCaption: (c) => {
    clearTimeout(captionTimer)
    const next = { ...get().caption, ...(c ? { name: c.name, title: c.title } : {}) }
    if (!next.name.trim() && !next.title.trim()) return
    set({ caption: { ...next, visible: true } })
    if (next.autoHide > 0) captionTimer = setTimeout(() => get().hideCaption(), next.autoHide * 1000)
  },

  hideCaption: () => {
    clearTimeout(captionTimer)
    set((s) => (s.caption.visible ? { caption: { ...s.caption, visible: false } } : {}))
  },

  saveCaptionPreset: () =>
    set((s) => {
      const name = s.caption.name.trim()
      const title = s.caption.title.trim()
      if (!name && !title) return {}
      const rest = s.captionPresets.filter((p) => !(p.name === name && p.title === title))
      return { captionPresets: [{ name, title }, ...rest] }
    }),

  deleteCaptionPreset: (index) => set((s) => ({ captionPresets: s.captionPresets.filter((_, i) => i !== index) })),

  setTickerOptions: (patch) => set((s) => ({ ticker: { ...s.ticker, ...patch } })),
  sendTicker: (text) => {
    if (!text.trim()) return
    set((s) => ({ ticker: { ...s.ticker, queue: [...s.ticker.queue, queueTicker(text, s.ticker)] } }))
  },
  stopTicker: () => set((s) => (s.ticker.current ? { ticker: { ...s.ticker, current: null } } : {})),
  clearTickerQueue: () => set((s) => ({ ticker: { ...s.ticker, queue: [] } })),
  saveTickerPreset: (text) =>
    set((s) => {
      const tx = text.trim()
      return tx ? { tickerPresets: [tx, ...s.tickerPresets.filter((p) => p !== tx)] } : {}
    }),
  deleteTickerPreset: (index) => set((s) => ({ tickerPresets: s.tickerPresets.filter((_, i) => i !== index) })),

  recordScripture: (p) => set((s) => ({ scriptureHistory: addToHistory(s.scriptureHistory, p) })),

  togglePin: (p) =>
    set((s) =>
      s.scripturePins.some((x) => x.id === p.id)
        ? { scripturePins: s.scripturePins.filter((x) => x.id !== p.id) }
        : { scripturePins: [...s.scripturePins, p] }
    ),

  clearScriptureHistory: () => set({ scriptureHistory: [] }),

  showPassage: async (p) => {
    const r = await passageSlides(p, get().scripture)
    if (!r) return false
    get().showScratch(r.title, r.slides)
    get().recordScripture({ ...p, at: Date.now() })
    return true
  },

  addSongs: async (songs) => {
    if (!songs.length) return
    await window.nl.data.saveSongs(songs)
    set((s) => ({ songs: [...s.songs, ...songs].sort((a, b) => a.title.localeCompare(b.title)) }))
  },

  openService: async (id) => {
    const s = get()
    if (s.rehearsal) return false
    if (id === s.service.id) return true
    const svc = await window.nl.data.getService(id)
    if (!svc) return false
    await switchService(svc)
    return true
  },

  newService: async () => {
    if (get().rehearsal) return false
    await switchService(emptyService(), true)
    return true
  },

  duplicateService: async () => {
    const s = get()
    if (s.rehearsal) return false
    const src = s.service
    const srcDay = src.date ? parseDay(src.date) : null
    const date = nextSunday(srcDay && srcDay > new Date() ? srcDay : new Date())
    const items = src.items.map((it): ServiceItem => {
      const song = it.kind === 'song' && it.sourceId ? s.songs.find((x) => x.id === it.sourceId) : undefined
      const { transpose: _live, ...rest } = it
      return {
        ...rest,
        id: uid(),
        ...(song ? { title: song.title, key: song.key, languageMode: song.languageMode && song.languageMode !== 'both' ? song.languageMode : undefined, ...songTempo(song) } : {}),
        slides: song ? song.slides.map((sl) => ({ ...sl })) : it.slides.map((sl) => ({ ...sl, id: uid() }))
      }
    }).map((it) => {
      // Songs keep their arrangement for this service.
      const song = it.kind === 'song' && it.arrangement && s.songs.find((x) => x.id === it.sourceId)
      return song ? arrangedItem(it, song) : it
    })
    await switchService({ id: uid(), name: datedName(baseName(src.name), date), date, items }, true)
    return true
  },

  renameService: (name) => set((s) => ({ service: { ...s.service, name: name.trim() || s.service.name } })),

  setServiceDate: (date) =>
    set((s) => {
      const { date: _old, ...rest } = s.service
      return { service: date ? { ...rest, date } : rest }
    }),

  deleteService: async (id) => {
    const s = get()
    if (id === s.service.id) {
      if (s.rehearsal) return false
      const list = await window.nl.data.listServices()
      const i = list.findIndex((x) => x.id === id)
      const rest = list.filter((x) => x.id !== id)
      const pick = rest[Math.min(Math.max(i, 0), rest.length - 1)]
      const next = pick ? await window.nl.data.getService(pick.id) : null
      await switchService(next ?? emptyService(), !next)
    }
    await window.nl.data.deleteService(id)
    return true
  },

  runCommand: (cmd) => {
    const s = get()
    switch (cmd.type) {
      case 'next':
        return s.next()
      case 'prev':
        return s.prev()
      case 'goto':
        return s.goLive(cmd.itemId, cmd.index)
      case 'hideText':
        return s.toggleHideText()
      case 'black':
        return s.toggleBlack()
      case 'clear':
        return s.clearLive()
      case 'scripture':
        return s.showScratch(cmd.title, cmd.slides, cmd.index ?? 0)
      case 'pin': {
        const pin = s.scripturePins.find((p) => p.id === cmd.id)
        if (pin) void s.showPassage(pin)
        return
      }
      case 'transpose': {
        const it = s.service.items.find((x) => x.id === cmd.itemId)
        if (it?.kind !== 'song' || !Number.isInteger(cmd.by) || Math.abs(cmd.by) > 11) return
        return s.setItemTranspose(it.id, cmd.by === 0 ? 0 : (it.transpose ?? 0) + cmd.by)
      }
    }
  }
}))

/** What a slide shows behind its text: its own picture (presentation pages), the item's, or the default. */
/**
 * The background a slide is drawn on: its own, else its item's, else `fallback`. Pass `fits` (state.mediaFit) so
 * pictures and videos sit on the screen the way the Media tab says.
 */
export function slideBackground(
  slide: Slide | null | undefined,
  item: ServiceItem | null | undefined,
  fallback: Background,
  fits?: Record<string, MediaFit>
): Background {
  const bg = slide?.background ?? item?.background ?? fallback
  return fits ? fitted(bg, fits) : bg
}

/** A picture or video with the Media tab's fit for that file (same object when nothing changes). */
export function fitted(bg: Background, fits: Record<string, MediaFit>): Background {
  if (bg.kind !== 'image' && bg.kind !== 'video') return bg
  const f = fits[bg.src]
  return f && f !== (bg.fit ?? 'cover') ? { ...bg, fit: f } : bg
}

/** A look by id: built-in or saved. */
export function findTemplate(s: Pick<AppState, 'templates'>, id: string | undefined): Template | undefined {
  if (!id) return undefined
  return BUILTIN_TEMPLATES.find((t) => t.id === id) ?? s.templates.find((t) => t.id === id)
}

/** Built-in looks first, then the user's. */
export const allTemplates = (s: Pick<AppState, 'templates'>): Template[] => [...BUILTIN_TEMPLATES, ...s.templates]

/** The style an item uses when it has no look: Scripture's own style for Scripture, else the global one. */
export const baseStyle = (
  s: Pick<AppState, 'style' | 'scriptureStyle'>,
  item: { kind?: ServiceItem['kind'] } | null | undefined
): TextStyle => (item?.kind === 'scripture' && s.scriptureStyle ? s.scriptureStyle : s.style)

/**
 * The text style and fallback background an item is drawn with: its look (template) if it has one, else the global
 * style (Scripture: its own style, when set). The item's own background and a slide's background still win (pass
 * `background` to slideBackground).
 */
export function itemLook(
  s: Pick<AppState, 'templates' | 'style' | 'scriptureStyle' | 'background'>,
  item: (Pick<ServiceItem, 'templateId'> & { kind?: ServiceItem['kind'] }) | null | undefined
): { style: TextStyle; background: Background; template?: Template } {
  const t = findTemplate(s, item?.templateId)
  if (!t) return { style: baseStyle(s, item), background: s.background }
  return { style: { ...DEFAULT_STYLE, ...t.style }, background: t.background ?? s.background, template: t }
}

/** Does this background show that library entry? */
export function usesMedia(b: Background | undefined, m: MediaItem): boolean {
  if (!b) return false
  if (b.kind === 'image' || b.kind === 'video') return b.src === m.ref
  if (b.kind === 'loop') return m.kind === 'loop' && b.id === m.id
  return false
}

/** The background a library entry becomes (audio has none). */
export function backgroundFor(m: MediaItem, opts?: { loop?: boolean; muted?: boolean }): Background | null {
  if (m.kind === 'image') return { kind: 'image', src: m.ref }
  if (m.kind === 'video') return { kind: 'video', src: m.ref, loop: opts?.loop ?? true, muted: opts?.muted ?? true }
  if (m.kind === 'loop' && m.loop) return { kind: 'loop', id: m.id, name: m.name, def: m.loop.definition }
  return null
}

/** When a slide goes live, the countdown leaves the audience screen but stays on stage. */
function releaseMain(c: CountdownState): CountdownState {
  if (!c.visible || c.showOn === 'stage' || c.mainHidden) return c
  return { ...c, mainHidden: true }
}

function restoreCountdown(saved?: Partial<CountdownState>): CountdownState {
  const c = { ...DEFAULT_COUNTDOWN, ...(saved ?? {}) }
  // Runtime state doesn't survive a restart.
  return { ...c, visible: false, mainHidden: false, status: 'idle', endsAt: null, remainingMs: c.durationSec * 1000 }
}

/** Persist the service and settings whenever they change (debounced). */
let autosaveStarted = false
let savedCountdownKey = ''
let savedStageKey = ''
let savedCaptionKey = ''
let savedTickerKey = ''
function startAutosave(): void {
  if (autosaveStarted) return
  autosaveStarted = true
  // Crash-safe resume: the live position and service (main saves where the outputs are). Rehearsal moves don't count.
  let sessionTimer: ReturnType<typeof setTimeout> | undefined
  useApp.subscribe((s, prev) => {
    if (s.live === prev.live && s.service.id === prev.service.id && s.rehearsal === prev.rehearsal) return
    clearTimeout(sessionTimer)
    sessionTimer = setTimeout(() => {
      const st = useApp.getState()
      const live = st.rehearsal ? st.rehearsal.saved.live : st.live
      window.nl.data.setSetting('session', { serviceId: st.service.id, live, at: Date.now() } satisfies SavedSession)
    }, 500)
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  useApp.subscribe((s, prev) => {
    if (s.service !== prev.service) {
      clearTimeout(timer)
      // Switching to another service: switchService() already saved both, so nothing is pending.
      if (s.service.id === prev.service.id)
        timer = setTimeout(() => window.nl.data.saveService(useApp.getState().service), 400)
    }
    if (s.aspect !== prev.aspect) window.nl.data.setSetting('aspect', s.aspect)
    if (s.style !== prev.style) window.nl.data.setSetting('style', s.style)
    if (s.mediaFit !== prev.mediaFit) window.nl.data.setSetting('mediaFit', s.mediaFit)
    if (s.mediaFitDefault !== prev.mediaFitDefault) window.nl.data.setSetting('mediaFitDefault', s.mediaFitDefault)
    if (s.scriptureStyle !== prev.scriptureStyle) window.nl.data.setSetting('scriptureStyle', s.scriptureStyle)
    if (s.background !== prev.background) window.nl.data.setSetting('background', s.background)
    if (s.templates !== prev.templates) window.nl.data.setSetting('templates', s.templates)
    if (s.labelColors !== prev.labelColors) window.nl.data.setSetting('labelColors', s.labelColors)
    if (s.clickMode !== prev.clickMode) window.nl.data.setSetting('clickMode', s.clickMode)
    if (s.logo !== prev.logo) window.nl.data.setSetting('logo', s.logo)
    if (s.overlay !== prev.overlay) window.nl.data.setSetting('overlay', s.overlay)
    if (s.transition !== prev.transition) window.nl.data.setSetting('transition', s.transition)
    if (s.bibleId !== prev.bibleId) window.nl.data.setSetting('bibleId', s.bibleId)
    if (s.scripture !== prev.scripture) window.nl.data.setSetting('scripture', s.scripture)
    if (s.copyright !== prev.copyright) window.nl.data.setSetting('copyright', s.copyright)
    if (s.quickChat !== prev.quickChat) window.nl.data.setSetting('quickChat', s.quickChat)
    if (s.stageSecondLanguage !== prev.stageSecondLanguage) window.nl.data.setSetting('stageSecondLanguage', s.stageSecondLanguage)
    if (s.countdown !== prev.countdown) {
      const { title, subtext, mode, durationSec, targetTime, overtime, showOn } = s.countdown
      const { background, titleScale, timeScale, subtextScale, goLiveAtZero } = s.countdown
      const key = JSON.stringify({ title, subtext, mode, durationSec, targetTime, overtime, showOn, background, titleScale, timeScale, subtextScale, goLiveAtZero })
      if (key !== savedCountdownKey) {
        savedCountdownKey = key
        window.nl.data.setSetting('countdown', JSON.parse(key))
      }
    }
    if (s.stage !== prev.stage) {
      // Everything but the message (that one is per session).
      const { message: _m, ...keep } = s.stage
      const key = JSON.stringify(keep)
      if (key !== savedStageKey) {
        savedStageKey = key
        window.nl.data.setSetting('stage', keep)
      }
    }
    if (s.caption !== prev.caption) {
      const { name, title, target, autoHide } = s.caption
      const key = JSON.stringify({ name, title, target, autoHide })
      if (key !== savedCaptionKey) {
        savedCaptionKey = key
        window.nl.data.setSetting('caption', JSON.parse(key))
      }
    }
    if (s.captionPresets !== prev.captionPresets) window.nl.data.setSetting('captionPresets', s.captionPresets)
    if (s.tickerPresets !== prev.tickerPresets) window.nl.data.setSetting('tickerPresets', s.tickerPresets)
    if (s.ticker !== prev.ticker) {
      const key = JSON.stringify(restoreTickerOptions(s.ticker))
      if (key !== savedTickerKey) {
        savedTickerKey = key
        window.nl.data.setSetting('tickerOptions', JSON.parse(key))
      }
    }
    if (s.scriptureHistory !== prev.scriptureHistory) window.nl.data.setSetting('scriptureHistory', s.scriptureHistory)
    if (s.scripturePins !== prev.scripturePins) window.nl.data.setSetting('scripturePins', s.scripturePins)
  })
}

// ---------- service library ----------

const emptyService = (): Service => {
  const date = nextSunday()
  return { id: uid(), name: datedName('Sunday Service', date), date, items: [] }
}

/** Open another service: save the one we leave, clear the screen, remember the choice for next launch. */
async function switchService(next: Service, saveNext = false): Promise<void> {
  await window.nl.data.saveService(useApp.getState().service)
  if (saveNext) await window.nl.data.saveService(next)
  useApp.setState({ service: next, selectedItemId: null, live: null, hideText: false, black: false })
  window.nl.data.setSetting('currentServiceId', next.id)
}

// ---------- song usage ----------
// The first time a library song goes live in a service on a given day, it is logged (never during rehearsal).
// ---------- service and item timers ----------
// The service timer starts at the first go-live of the day; the item timer restarts when the live item changes.
// Rehearsal doesn't touch either: they follow what the screens show (and ending rehearsal puts that back, unchanged).
const sameDay = (a: number, b: number): boolean => new Date(a).toDateString() === new Date(b).toDateString()
let timersStarted = false
function startTimers(): void {
  if (timersStarted) return
  timersStarted = true
  useApp.subscribe((s, prev) => {
    if (s.serviceStartedAt !== prev.serviceStartedAt) window.nl.data.setSetting('serviceStartedAt', s.serviceStartedAt)
    if (s.rehearsal || prev.rehearsal || s.live?.itemId === prev.live?.itemId) return
    const now = Date.now()
    if (!s.live) return useApp.setState({ itemStartedAt: null })
    const fresh = !s.serviceStartedAt || !sameDay(s.serviceStartedAt, now)
    useApp.setState({ itemStartedAt: now, ...(fresh ? { serviceStartedAt: now } : {}) })
  })
}

// ---------- beat clock ----------
// Beat 1 falls when a song goes live (a new live item, or the same song after a tempo change); "Beat 1 now" moves it.
let beatClockStarted = false
function startBeatClock(): void {
  if (beatClockStarted) return
  beatClockStarted = true
  useApp.subscribe((s, prev) => {
    const a = s.live ? findItem(s, s.live.itemId) : undefined
    const b = prev.live ? findItem(prev, prev.live.itemId) : undefined
    if (a?.id === b?.id && a?.bpm === b?.bpm && a?.timeSignature === b?.timeSignature) return
    const beatStartedAt = a?.bpm ? Date.now() : null
    if (beatStartedAt !== s.beatStartedAt) useApp.setState({ beatStartedAt })
  })
}

// ---------- countdown: go live at 0:00 ----------
// Optional: when a running countdown reaches zero, the first real item (no sections, no blanks) goes live and the
// countdown goes away (this wins over "keep counting past 0:00"). Never during rehearsal.
let countdownLiveStarted = false
function startCountdownAutoLive(): void {
  if (countdownLiveStarted) return
  countdownLiveStarted = true
  let timer: ReturnType<typeof setTimeout> | undefined
  let key = ''
  const schedule = (s: AppState): void => {
    const c = s.countdown
    const active = !!c.goLiveAtZero && c.mode !== 'clock' && c.status === 'running' && c.endsAt !== null && !s.rehearsal
    const k = active ? String(c.endsAt) : ''
    if (k === key) return
    key = k
    clearTimeout(timer)
    if (!active) return
    const endsAt = c.endsAt!
    timer = setTimeout(() => {
      const now = useApp.getState()
      const cd = now.countdown
      if (now.rehearsal || !cd.goLiveAtZero || cd.status !== 'running' || cd.endsAt !== endsAt) return
      const first = now.service.items.find((it) => it.kind !== 'section' && it.kind !== 'blank' && it.slides.length)
      useApp.setState({
        countdown: { ...cd, visible: false, mainHidden: false, status: 'idle', endsAt: null, remainingMs: cd.durationSec * 1000 }
      })
      if (first) now.goLive(first.id, 0)
    }, Math.max(0, endsAt - Date.now()))
  }
  useApp.subscribe(schedule)
  schedule(useApp.getState())
}

// ---------- announcements ----------
// One message plays at a time; the next queued one starts a moment after it ends. During rehearsal the queue waits
// (the screens keep what they showed), and starts when rehearsal ends.
let tickerStarted = false
function startTickerQueue(): void {
  if (tickerStarted) return
  tickerStarted = true
  let endTimer: ReturnType<typeof setTimeout> | undefined
  let startTimer: ReturnType<typeof setTimeout> | undefined
  let key = ''
  const run = (s: AppState): void => {
    const cur = s.ticker.current
    const k = cur ? `${cur.id}:${cur.endsAt}` : ''
    if (k !== key) {
      key = k
      clearTimeout(endTimer)
      if (cur)
        endTimer = setTimeout(() => {
          const tk = useApp.getState().ticker
          if (tk.current?.id === cur.id) useApp.setState({ ticker: { ...tk, current: null } })
        }, Math.max(0, cur.endsAt - Date.now()))
    }
    if (cur || !s.ticker.queue.length || s.rehearsal) {
      clearTimeout(startTimer)
      startTimer = undefined
      return
    }
    if (startTimer) return
    // Outside this listener, so every subscriber sees the states in order.
    startTimer = setTimeout(() => {
      startTimer = undefined
      const now = useApp.getState()
      const [q, ...rest] = now.ticker.queue
      if (now.ticker.current || !q || now.rehearsal) return
      useApp.setState({ ticker: { ...now.ticker, current: startTicker(q, now.aspect), queue: rest } })
    }, 400)
  }
  useApp.subscribe(run)
  run(useApp.getState())
}

let usageStarted = false
const usageLogged = new Set<string>()
function startUsageLog(): void {
  if (usageStarted) return
  usageStarted = true
  useApp.subscribe((s, prev) => {
    if (!s.live || s.rehearsal || s.live.itemId === prev.live?.itemId) return
    const item = s.service.items.find((i) => i.id === s.live!.itemId)
    if (!item || item.kind !== 'song' || !item.sourceId) return
    const day = today()
    const key = `${item.sourceId}|${s.service.id}|${day}`
    if (usageLogged.has(key)) return
    usageLogged.add(key)
    window.nl.usage.log(item.sourceId, s.service.id, day).then(() => window.dispatchEvent(new Event('nl-usage')))
  })
}

// ---------- live video ----------
// A new video background starts playing from the top; the same video on the next slide keeps playing. A video
// that plays once holds its last frame at the end, and a video item with auto-advance moves on to the next item.
let videoStarted = false
function startVideoTracking(): void {
  if (videoStarted) return
  videoStarted = true
  let endTimer: ReturnType<typeof setTimeout> | undefined
  let endKey = ''
  const track = (s: AppState, prev?: AppState): void => {
    const live = selectLiveSlide(s)
    const bg = slideBackground(live?.slide, live?.item, itemLook(s, live?.item).background, s.mediaFit)
    const src = bg.kind === 'video' ? bg.src : null
    // A Video item is its own playback (the same file in two items restarts); a background video follows its file.
    const key = src && live?.item.kind === 'media' ? `${src}|${live.item.id}` : src
    // Sending a finished video live again plays it from the start.
    const replay =
      !!prev && s.live !== prev.live && !!s.live && !!s.video && !s.video.playing && !!s.video.duration && s.video.offset >= s.video.duration - 0.1
    if (key !== (s.video?.key ?? null) || replay) {
      if (!src || bg.kind !== 'video') return useApp.setState({ video: null })
      useApp.setState({
        video: { key: key!, src, playing: true, startedAt: Date.now(), offset: 0, loop: bg.loop ?? true, muted: bg.muted ?? true }
      })
      probeDuration(mediaUrl(src)).then((d) => {
        const v = useApp.getState().video
        if (d && v?.key === key && !v.duration) useApp.setState({ video: { ...v, duration: d } })
      })
      return
    }
    const v = s.video
    const k = v && !v.loop && v.playing && v.duration ? `${v.src}:${v.startedAt}:${v.offset}:${v.duration}` : ''
    if (k === endKey) return
    endKey = k
    clearTimeout(endTimer)
    if (!v || !k) return
    const left = (v.duration! - v.offset) * 1000 - (Date.now() - v.startedAt)
    endTimer = setTimeout(() => {
      const now = useApp.getState()
      const cur = now.video
      if (!cur || !videoEnded(cur, Date.now() + 60, cur.duration)) return
      // Hold the last frame.
      useApp.setState({ video: { ...cur, playing: false, offset: cur.duration! } })
      const at = selectLiveSlide(now)
      if (at?.item.kind === 'media' && at.item.advance && at.index >= at.item.slides.length - 1) now.next()
    }, Math.max(0, left))
  }
  useApp.subscribe(track)
  track(useApp.getState())
}

// ---------- auto-advance ----------
let autoStarted = false
function startAutoAdvance(): void {
  if (autoStarted) return
  autoStarted = true
  let timer: ReturnType<typeof setTimeout> | undefined
  let key = ''
  const schedule = (s: AppState): void => {
    const live = selectLiveSlide(s)
    const adv = live?.item.advance
    const count = live?.item.slides.length ?? 0
    const last = !!live && live.index >= count - 1
    const active = !!live && !!adv && adv.seconds > 0 && count > 1 && (!last || adv.loop)
    const k = active ? `${live!.item.id}:${live!.index}:${adv!.seconds}:${adv!.loop}:${count}` : ''
    if (k === key) return
    key = k
    clearTimeout(timer)
    if (!active) {
      if (s.autoNextAt !== null) useApp.setState({ autoNextAt: null })
      return
    }
    const ms = adv!.seconds * 1000
    useApp.setState({ autoNextAt: Date.now() + ms })
    const { item, index } = live!
    timer = setTimeout(() => {
      const now = useApp.getState()
      if (now.live?.itemId !== item.id || now.live.index !== index) return
      key = '#' // force a fresh schedule (the same slide can come round again when looping)
      // Only the slide changes: a blacked-out or hidden screen stays that way.
      useApp.setState({ live: { itemId: item.id, index: last ? 0 : index + 1 } })
    }, ms)
  }
  useApp.subscribe(schedule)
  schedule(useApp.getState())
}

type S = AppState

const findItem = (s: S, id: string): ServiceItem | undefined =>
  id === SCRATCH_ID ? s.scratch ?? undefined : s.service.items.find((i) => i.id === id)

/** Resolve the current live slide (or null). */
export function selectLiveSlide(s: S): { item: ServiceItem; slide: Slide; index: number } | null {
  if (!s.live) return null
  const item = findItem(s, s.live.itemId)
  const slide = item?.slides[s.live.index]
  return item && slide ? { item, slide, index: s.live.index } : null
}

/** The slide that "next" would show, for the Up Next panel. */
export function selectUpNext(s: S): Slide | null {
  const items = s.service.items
  if (!s.live) return items.find((i) => i.slides.length)?.slides[0] ?? null
  if (s.live.itemId === SCRATCH_ID) return s.scratch?.slides[s.live.index + 1] ?? null
  const i = items.findIndex((it) => it.id === s.live!.itemId)
  if (i < 0) return null
  const cur = items[i]
  if (s.live.index < cur.slides.length - 1) return cur.slides[s.live.index + 1]
  return items.slice(i + 1).find((it) => it.slides.length)?.slides[0] ?? null
}

export function buildFrame(s: S): LiveFrame {
  const live = selectLiveSlide(s)
  const look = itemLook(s, live?.item)
  const background = slideBackground(live?.slide, live?.item, look.background, s.mediaFit)
  return {
    transition: s.transition,
    ...(background.kind === 'video' && s.video?.src === background.src ? { video: s.video } : {}),
    slide: audienceSlide(live?.slide ?? null, live?.item),
    footer: copyrightFooter(s, live),
    background,
    style: look.style,
    aspect: s.aspect,
    hideText: s.hideText,
    black: s.black,
    countdown:
      s.countdown.visible && s.countdown.showOn !== 'stage' && !s.countdown.mainHidden
        ? s.countdown.background && fitted(s.countdown.background, s.mediaFit) !== s.countdown.background
          ? { ...s.countdown, background: fitted(s.countdown.background, s.mediaFit) }
          : s.countdown
        : null,
    logo: s.logo,
    caption: s.caption.target === 'both' ? captionOf(s) : null,
    ticker: s.ticker.current
  }
}

/** Where "next" goes: the slide and the item it belongs to (Up Next preview, stage screens). */
export function nextLocation(s: S): { item: ServiceItem; slide: Slide } | null {
  const items = s.service.items
  if (!s.live) {
    const first = items.find((i) => i.slides.length)
    return first ? { item: first, slide: first.slides[0] } : null
  }
  if (s.live.itemId === SCRATCH_ID) {
    const sl = s.scratch?.slides[s.live.index + 1]
    return sl && s.scratch ? { item: s.scratch, slide: sl } : null
  }
  const i = items.findIndex((it) => it.id === s.live!.itemId)
  if (i < 0) return null
  if (s.live.index < items[i].slides.length - 1) return { item: items[i], slide: items[i].slides[s.live.index + 1] }
  const nx = items.slice(i + 1).find((it) => it.slides.length)
  return nx ? { item: nx, slide: nx.slides[0] } : null
}

export function buildStage(s: S): StageFrame {
  const live = selectLiveSlide(s)
  const nx = nextLocation(s)
  return {
    slide: stageSlide(live?.slide ?? null, s.stageSecondLanguage),
    next: stageSlide(nx?.slide ?? null, s.stageSecondLanguage),
    itemTitle: live?.item.title ?? '',
    nextItemTitle: nx && nx.item.id !== live?.item.id ? nx.item.title : null,
    message: s.stage.message,
    countdown: s.countdown.visible && s.countdown.showOn !== 'main' ? s.countdown : null,
    showNext: s.stage.showNext,
    showClock: s.stage.showClock,
    live: !!live,
    chords: s.stage.chords,
    key: live?.item.key,
    transpose: live?.item.transpose ?? 0,
    nextKey: nx?.item.key,
    nextTranspose: nx?.item.transpose ?? 0,
    serviceStartedAt: s.stage.showServiceTimer ? s.serviceStartedAt : null,
    itemStartedAt: s.stage.showItemTime && live?.item.minutes ? s.itemStartedAt : null,
    itemMinutes: s.stage.showItemTime && live?.item.minutes ? live.item.minutes : null,
    messageFlash: s.stage.messageFlash,
    messageAlign: s.stage.messageAlign,
    logo: s.logo?.stage ? s.logo : null,
    layout: s.stage.layout,
    scale: s.stage.scale,
    showTitles: s.stage.showTitles,
    mirror: s.stage.mirror,
    tempo: liveTempo(s),
    beatPulse: s.stage.beatPulse
  }
}

/** The live song's tempo and beat clock (stage screens, metronome), or null when it has no BPM. */
export function liveTempo(s: Pick<S, 'live' | 'scratch' | 'service' | 'beatStartedAt'>): StageTempo | null {
  const item = s.live ? findItem(s as S, s.live.itemId) : undefined
  const bpm = item?.kind === 'song' ? item.bpm : undefined
  if (!bpm || s.beatStartedAt === null) return null
  const time = item?.timeSignature
  return { bpm, ...(time ? { time } : {}), beatsPerBar: beatsPerBar(time), startedAt: s.beatStartedAt }
}

/** The caption while it is showing. */
const captionOf = (s: S): Caption | null =>
  s.caption.visible ? { name: s.caption.name.trim(), title: s.caption.title.trim() } : null

const pinsOf = (s: S): Snapshot['pins'] => s.scripturePins.map((p) => ({ id: p.id, title: passageTitle(p) }))
const quickChatOf = (s: S): string[] => s.quickChat ?? defaultQuickChat()

/**
 * The slide as the audience sees it: no chords, and for bilingual songs the language(s) the song is set to
 * (with both, the "--" separator stays in and SlideView / the overlay draw the second language smaller).
 */
export function audienceSlide(sl: Slide | null, item?: Pick<ServiceItem, 'languageMode'> | null): Slide | null {
  if (!sl) return sl
  let text = sl.text.includes('[') ? stripChords(sl.text) : sl.text
  if (item?.languageMode) text = languageText(text, item.languageMode)
  return text === sl.text ? sl : { ...sl, text }
}

/** Stage screens: the primary language only (chords kept), or both as plain lines; a text slide's title on top. */
function stageSlide(sl: Slide | null, both: boolean): Slide | null {
  if (!sl) return sl
  let text = both ? plainLanguages(sl.text) : splitLanguages(sl.text).primary
  if (sl.heading?.trim()) text = text.trim() ? `${sl.heading.trim()}\n${text}` : sl.heading.trim()
  return text === sl.text ? sl : { ...sl, text }
}

/** Overlay: the audience text (the overlay draws a second language itself), a text slide's title line first. */
const flatOverlayText = (sl: Slide, item?: Pick<ServiceItem, 'languageMode'> | null): string => {
  const t = audienceSlide(sl, item)!.text
  const h = sl.heading?.trim()
  return h ? (t.trim() ? `${h}\n${t}` : h) : t
}

/** Phone lists: one plain text, the title line first. */
const flatText = (sl: Slide, item?: Pick<ServiceItem, 'languageMode'> | null): string => plainLanguages(flatOverlayText(sl, item))

/** "© 2004 … · CCLI Song #123 · CCLI Licence #456" for the live song, when the copyright settings show it on this slide. */
export function copyrightFooter(s: Pick<S, 'copyright' | 'songs'>, live: { item: ServiceItem; index: number } | null): string | null {
  const c = s.copyright
  if (!live || c.footer === 'off' || live.item.kind !== 'song') return null
  const last = live.item.slides.length - 1
  if (c.footer === 'edges' && live.index !== 0 && live.index !== last) return null
  const song = live.item.sourceId ? s.songs.find((x) => x.id === live.item.sourceId) : undefined
  return songCopyrightLine(song, c.licence)
}

export function songCopyrightLine(song: Pick<Song, 'copyright' | 'ccli'> | undefined, licence: string): string | null {
  const copy = song?.copyright?.trim()
  const ccli = song?.ccli?.trim()
  if (!copy && !ccli) return null
  return [copy ? (/^(©|\(c\)|copyright)/i.test(copy) ? copy : `© ${copy}`) : '', ccli ? `CCLI Song #${ccli}` : '', licence.trim() ? `CCLI Licence #${licence.trim()}` : '']
    .filter(Boolean)
    .join(' · ')
}

/** What the screens get: the live picture, or during rehearsal what they showed when it began. */
export function publishedSnapshot(s: S): Snapshot {
  const r = s.rehearsal
  if (!r) return buildSnapshot(s)
  return { ...r.frozen, stage: r.stageFollows ? buildStage(s) : r.frozen.stage, pins: pinsOf(s), quickChat: quickChatOf(s), serverTime: Date.now() }
}

export function buildSnapshot(s: S): Snapshot {
  const frame = buildFrame(s)
  const liveNow = selectLiveSlide(s)
  return {
    frame,
    stage: buildStage(s),
    overlay: {
      slide: liveNow ? { ...liveNow.slide, text: flatOverlayText(liveNow.slide, liveNow.item) } : null,
      footer: s.copyright.overlay ? frame.footer ?? null : null,
      hidden: s.hideText || s.black,
      countdown: s.overlay.showCountdown ? frame.countdown : null, // follows the audience screen
      settings: s.overlay,
      transition: s.transition,
      caption: captionOf(s),
      ticker: s.ticker.current?.overlay && !s.black ? s.ticker.current : null
    },
    serviceName: s.service.name,
    items: s.service.items.map((it) => ({
      id: it.id,
      kind: it.kind,
      title: it.title,
      ...(it.color ? { color: it.color } : {}),
      ...(it.kind === 'song' && it.slides.some((sl) => hasChords(sl.text)) ? { chords: { key: it.key, transpose: it.transpose ?? 0, bpm: it.bpm, time: it.timeSignature } } : {}),
      slides: it.slides.map((sl) => ({
        label: sl.label,
        ...(labelColor(sl.label, s.labelColors) ? { labelColor: labelColor(sl.label, s.labelColors) } : {}),
        text: flatText(sl, it),
        reference: sl.reference,
        ...(sl.background?.kind === 'image' && (sl.background.fit === 'contain' || it.kind === 'media') ? { image: sl.background.src } : {}),
        ...(sl.background?.kind === 'video' && it.kind === 'media' ? { video: sl.background.src } : {})
      }))
    })),
    scratch: s.scratch && {
      id: s.scratch.id,
      kind: s.scratch.kind,
      title: s.scratch.title,
      slides: s.scratch.slides.map((sl) => ({ label: sl.label, text: sl.text, reference: sl.reference }))
    },
    live: s.live,
    pins: pinsOf(s),
    quickChat: quickChatOf(s),
    serverTime: Date.now()
  }
}

// Dev builds: expose the store for automated end-to-end checks (NL_SNAPSHOT_JS).
if (import.meta.env.DEV) (window as unknown as { __app: typeof useApp }).__app = useApp
