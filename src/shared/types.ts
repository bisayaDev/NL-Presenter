// Types shared by the main process, preload and every renderer window.
import type { LoopDefinition } from './loops'
import type { ChordNotation } from './chords'
import type { StageTempo } from './tempo'

export type AspectRatio = '16:9' | '4:3'

/**
 * An entry in the media library. Files: `ref` is "media/<file>" (see lib/media.ts).
 * Background loops have no file: `ref` is "loop:<id>" and `loop` holds the animation.
 */
export interface MediaItem {
  id: string
  name: string
  kind: 'image' | 'video' | 'audio' | 'loop' | 'deck'
  ref: string // decks: the first page
  size: number
  createdAt: number
  loop?: { category: string; tags: string[]; definition: LoopDefinition }
  /** An imported presentation (PDF / PowerPoint / Keynote): one picture per page. */
  deck?: { pages: DeckPage[]; width: number; height: number; source: string }
  /** From a linked folder: shown from where it is, never copied. `ref` is "linked/<id>" (see main/media.ts). */
  linked?: true
  /** Linked files: the full path on this computer. */
  path?: string
  /** Linked files: the file is gone (moved, renamed or the drive is not plugged in). */
  missing?: true
}

export interface DeckPage {
  ref: string // media ref of the page picture
  notes?: string // speaker notes (PowerPoint)
}

export interface Logo {
  src: string // media ref
  corner: 'tl' | 'tr' | 'bl' | 'br'
  size: number // % of screen width
  opacity: number // 0–1
  /** Also show it, small, in a corner of stage screens. */
  stage?: boolean
}

/**
 * How a picture or video sits on the screen (CSS object-fit). 'cover': fill the screen, cropping the edges (default).
 * 'contain': the whole picture, black bars where the shape differs. 'fill': stretched to the screen. 'none': original
 * size, centred on black.
 */
export type MediaFit = 'cover' | 'contain' | 'fill' | 'none'

export type Background =
  | { kind: 'color'; value: string }
  | { kind: 'gradient'; value: string }
  /** fit: see MediaFit. Presentation pages are 'contain'; the Media tab's choice per file wins (see `fitted`). */
  | { kind: 'image'; src: string; fit?: MediaFit }
  | { kind: 'video'; src: string; loop?: boolean; muted?: boolean; fit?: MediaFit }
  /** A website or vdo.ninja feed, drawn at the projector's resolution. */
  | { kind: 'web'; url: string; muted?: boolean }
  /** A webcam, USB camera or capture card on the presentation computer. */
  | { kind: 'camera'; deviceId: string; label?: string; muted?: boolean }
  /** An animated CSS background loop. The definition travels with it so every screen can draw it. */
  | { kind: 'loop'; id: string; name: string; def: LoopDefinition }

export interface TextStyle {
  fontFamily: string
  fontSize: number // px on the 1920-wide stage
  fontWeight: number
  color: string
  uppercase: boolean
  align: 'left' | 'center' | 'right'
  valign: 'top' | 'center' | 'bottom'
  marginX: number // px from the left/right edge on the 1920-wide stage
  marginY: number // px from the top/bottom edge
  lineHeight: number
  shadow: boolean
  shadowStrength: 'soft' | 'medium' | 'strong'
  italic: boolean
  letterSpacing: number // em
  outline: number // 0 = off, 1–10 thickness
  outlineColor: string
  glow: number // 0 = off, 1–10 strength
  glowColor: string
  /** Box behind the words: each line, one block around all lines, or a band across the full width. */
  textBg: 'off' | 'line' | 'block' | 'full'
  textBgColor: string
  textBgOpacity: number // 0–1
}

/** A saved look: a full text style and, optionally, a background. Built-ins ship with the app and can't be deleted. */
export interface Template {
  id: string
  name: string
  style: TextStyle
  background?: Background
  builtin?: boolean
}

export interface Slide {
  id: string
  label?: string // "Verse 1", "Chorus", "John 3:16"
  text: string // songs may hold inline chords: "[G]Amazing [C]grace" (see shared/chords.ts)
  reference?: string // shown under scripture text
  /**
   * Scripture: the same verses in up to two more translations. Older saves hold a single object: read it through
   * parallelOf() in shared/bible.ts.
   */
  parallel?: ParallelText[]
  /** How the translations sit: side by side (default) or stacked. */
  parallelLayout?: ParallelLayout
  /** Text slides: a title line drawn above the body. */
  heading?: string
  background?: Background // this slide only (presentation pages); wins over the item's background
  notes?: string // speaker notes, shown on stage screens
}

/**
 * 'section': a header in the service order (no slides); the items below it belong to it.
 * 'media': pictures (a slideshow, one slide per picture) or a video from the media library.
 */
export type ItemKind = 'song' | 'scripture' | 'blank' | 'web' | 'camera' | 'deck' | 'section' | 'media' | 'text'

export interface ParallelText {
  text: string
  reference: string
}
export type ParallelLayout = 'side' | 'stacked'

/** Which language(s) of a bilingual song the audience sees (see shared/bilingual.ts). */
export type LanguageMode = 'both' | 'primary' | 'secondary'

/** Copyright line on the audience screen: on the first and last slide of a song, on every slide, or off. */
export type CopyrightFooter = 'edges' | 'every' | 'off'

export interface CopyrightSettings {
  licence: string // CCLI licence number of the church
  footer: CopyrightFooter
  overlay: boolean // also on the OBS overlay
}

export interface ServiceItem {
  id: string
  kind: ItemKind
  title: string
  slides: Slide[]
  background?: Background
  sourceId?: string // song id in the library (decks: the presentation's id)
  key?: string // song key, copied from the library song
  /** Bilingual songs: copied from the library song (see Song.languageMode). */
  languageMode?: LanguageMode
  transpose?: number // live transpose for this service only (semitones; stage display)
  /** Move to the next slide by itself while live (announcements, photo slideshows). */
  advance?: { seconds: number; loop: boolean }
  /** Sections: folded in the service order, and their color. */
  collapsed?: boolean
  color?: string
  /** Look (template) for this item; wins over the global text style. Copied from the song when added. */
  templateId?: string
  /** Planning notes for this item, printed on the run sheet. */
  notes?: string
  /** Planned length in minutes (service order and the item timer). */
  minutes?: number
  /** Songs: section order for this service only (slide labels; see lib/arrangement.ts). Slides are rebuilt from it. */
  arrangement?: string[]
  /** Arrangement labels the library song no longer has (dropped; shown as a warning on the Arrange button). */
  arrangementMissing?: string[]
  /** Songs: tempo copied from the library song (see Song.bpm / Song.timeSignature). */
  bpm?: number
  timeSignature?: string
}

export interface Song {
  id: string
  title: string
  author?: string
  tags: string[]
  slides: Slide[]
  key?: string // e.g. "G", "Bb", "F#m"; chords and Nashville numbers are read against it
  templateId?: string // look used when the song goes into a service
  copyright?: string // "© 1990 Hillsong Music"
  ccli?: string // CCLI song number
  /** Bilingual songs: which language(s) the audience sees. Default both. */
  languageMode?: LanguageMode
  /** Tempo for the band (stage beat pulse, metronome): 30–300, and a time signature such as "4/4" or "6/8". */
  bpm?: number
  timeSignature?: string
  updatedAt: number
}

export interface Service {
  id: string
  name: string
  items: ServiceItem[]
  date?: string // "YYYY-MM-DD", the day the service is held
}

/** One row of the service library (top-bar service menu). */
export interface ServiceSummary {
  id: string
  name: string
  date?: string
  updatedAt: number
  count: number // items, sections not counted
}

/** Song usage: how often a library song went live (once per service per day). */
export interface SongUsage {
  songId: string
  title: string
  author?: string
  copyright?: string
  ccli?: string
  count: number
  last: string // "YYYY-MM-DD"
}

export interface BibleInfo {
  id: string
  name: string
  abbrev: string
  lang: string
  license: string
  builtin: boolean
}

/** One translation in the online library (eBible.org catalogue). */
export interface LibraryBible {
  id: string // eBible translation id, e.g. "engwebp"
  name: string
  title: string // title in the translation's own language
  lang: string // ISO 639-3
  language: string // language name in English
  languageLocal: string
  copyright: string
  coverage: 'full' | 'nt' | 'ot' | 'portions'
  books: number
  rtl: boolean
  installedId: string | null // the Bible's id in the app when installed
}

export interface BibleCatalog {
  bibles: LibraryBible[]
  updated: number // when the list was fetched (ms)
  offline: boolean // could not refresh; showing the saved list
}

export interface BibleInstallProgress {
  id: string
  step: 'download' | 'names' | 'install'
  received: number
  total: number
}

/** How the Bible tab turns selected verses into slides. */
export interface ScriptureOptions {
  perSlide: number // verses on each slide; 0 = all on one slide
  numbers: boolean // small verse numbers when a slide holds more than one verse
  /** Up to two more translations shown with the main one ("Compare"). */
  parallelIds: string[]
  parallelLayout: ParallelLayout
  /** Older saves: the single Compare translation (read once into parallelIds). */
  parallelId?: string | null
}

export interface BibleBook {
  book: number
  name: string
  chapters: number
}

export interface Verse {
  verse: number
  text: string
}

export interface VerseHit {
  book: number
  chapter: number
  verse: number
  text: string
  label: string // "John 3:16"
}

/** A newer published release (from GitHub). */
export interface UpdateInfo {
  version: string // "0.3.0"
  url: string // release page
  notes: string // release notes (Markdown), shortened
  publishedAt: string
}

export interface UpdateStatus {
  current: string
  available: UpdateInfo | null // only when newer than `current`
  checkedAt: number | null
  error: string | null // last check failed (offline…)
  auto: boolean // setting `updateCheck`: check by itself after start-up and every 6 hours
  skipped: string | null // setting `updateSkip`: "Skip this version"
}

export interface Bootstrap {
  songs: Song[]
  service: Service | null
  settings: Record<string, unknown>
}

export type CountdownMode = 'duration' | 'target' | 'clock'
export type CountdownTarget = 'main' | 'stage' | 'both'

export interface CountdownState {
  title: string
  subtext: string
  mode: CountdownMode
  durationSec: number
  targetTime: string // "HH:MM" (24h), for mode 'target'
  overtime: boolean // keep counting past zero (shown in red)
  showOn: CountdownTarget
  visible: boolean
  /** Runtime: a slide went live, so the countdown stepped off the audience screen (it stays on stage). */
  mainHidden: boolean
  status: 'idle' | 'running' | 'paused'
  endsAt: number | null // epoch ms while running
  remainingMs: number // while idle or paused
  /** Its own background while it shows (not set: the normal background). */
  background?: Background
  /** Text sizes in % of the standard size (not set: 100). */
  titleScale?: number
  timeScale?: number
  subtextScale?: number
  /** At 0:00, go live with the first item (sections and blanks skipped; never during rehearsal). */
  goLiveAtZero?: boolean
}

/** Everything an output screen needs to draw one frame. */
export interface LiveFrame {
  slide: Slide | null
  background: Background
  style: TextStyle
  aspect: AspectRatio
  hideText: boolean
  black: boolean
  countdown: CountdownState | null // set when the countdown takes over the audience screen
  logo: Logo | null
  /** Name caption, when the operator sends it to the audience screen too. */
  caption?: Caption | null
  /** How a new slide comes in on the audience and wireless screens (operator previews always cut). */
  transition?: Transition
  /** Playback of the live video background, so every screen plays it in step. */
  video?: VideoPlayback
  /** Song copyright line, small in the lower left ("© … · CCLI Song #… · CCLI Licence #…"). */
  footer?: string | null
  /** Announcement along the bottom (scrolling ticker or static band) while one is playing. */
  ticker?: TickerMessage | null
}

/** Audience announcement ("Parent of child #12, please come to the nursery"). Times are epoch ms, so every screen agrees. */
export interface TickerMessage {
  id: string
  text: string
  kind: 'scroll' | 'band'
  /** Scroll: one crossing of the screen (ms); `repeat` crossings fit between startedAt and endsAt. */
  passMs: number
  repeat: number
  startedAt: number
  endsAt: number
  /** Also on the OBS overlay. */
  overlay: boolean
}

export type TransitionKind = 'cut' | 'fade' | 'rise' | 'zoom'
export interface Transition {
  kind: TransitionKind
  ms: number
}

/** Position = offset + (now − startedAt) while playing; offset alone while paused. Times: s, startedAt: epoch ms. */
export interface VideoPlayback {
  src: string
  playing: boolean
  startedAt: number
  offset: number
  loop: boolean
  muted: boolean
}

/** Lower-third name caption ("Ptr. Juan Dela Cruz · Senior Pastor"). */
export interface Caption {
  name: string
  title: string
}

/** Stage screen layouts: today's view, big lyrics for singers, or big chords with a thin next strip. */
export type StageLayout = 'standard' | 'lyrics' | 'chords'

export interface StageFrame {
  slide: Slide | null
  next: Slide | null
  itemTitle: string
  nextItemTitle: string | null // set when the next slide belongs to another item
  message: string
  countdown: CountdownState | null
  showNext: boolean
  showClock: boolean
  live: boolean
  /** Chords on the stage screen (each wireless tablet can override this for itself). */
  chords: StageChords
  key?: string
  transpose: number
  nextKey?: string
  nextTranspose: number
  /** Layout and text size (0.7–1.5); each wireless tablet can override the layout for itself. */
  layout?: StageLayout
  scale?: number
  showTitles?: boolean // song title in the top bar and the next song's title
  mirror?: boolean // small picture of the audience screen in a corner
  /** Service timer under the clock: when the service started (epoch ms), or null when off / not started. */
  serviceStartedAt?: number | null
  /** Item time left: when the live item went live (epoch ms) and its planned minutes. Null when off or not planned. */
  itemStartedAt?: number | null
  itemMinutes?: number | null
  /** Messages: flash until cleared (otherwise a new message flashes 3 times), and the text alignment. */
  messageFlash?: boolean
  messageAlign?: 'left' | 'center' | 'right'
  /** The logo, small in a stage corner (when "Also show on stage screens" is on). */
  logo?: Logo | null
  /** The live song's tempo and beat clock (see shared/tempo.ts), or null when it has none. */
  tempo?: StageTempo | null
  /** Beat pulse in the stage header ('dot'), plus a thin flashing frame for drummers ('edge'). */
  beatPulse?: BeatPulse
}

export type BeatPulse = 'off' | 'dot' | 'edge'

export type StageChords = 'off' | ChordNotation

/** Transparent overlay for OBS / vMix browser sources. */
export interface OverlaySettings {
  position: 'lower' | 'center' | 'top'
  size: number // max text height as % of the screen height
  band: boolean // dark band behind the text
  showCountdown: boolean
  showReference: boolean
}

export interface OverlayFrame {
  slide: Slide | null
  hidden: boolean // hide text or black screen in the app
  countdown: CountdownState | null
  settings: OverlaySettings
  caption?: Caption | null
  transition?: Transition
  /** Song copyright line, only when the copyright settings ask for it on the overlay. */
  footer?: string | null
  /** Audience announcement, when the operator also sends it to the overlay. */
  ticker?: TickerMessage | null
}

/** A Scripture passage in the Bible tab's Recent list or pins. Verses are fetched again when shown. */
export interface ScripturePassage {
  id: string // bibleId:book:chapter:verses
  bibleId: string
  abbrev: string
  book: number
  bookName: string
  chapter: number
  verses: number[]
  at: number
}

export interface ItemSummary {
  id: string
  kind: ItemKind
  title: string
  color?: string // sections
  /** Songs with chords only, so the phone remote can transpose: written key and the live transpose (semitones). */
  chords?: { key?: string; transpose: number; bpm?: number; time?: string }
  slides: { label?: string; labelColor?: string; text: string; reference?: string; image?: string; video?: string }[] // image: presentation page / picture ref; video: video ref
}

/** The whole live picture, published by the operator window and relayed to every screen and device. */
export interface Snapshot {
  frame: LiveFrame
  stage: StageFrame
  overlay: OverlayFrame
  serviceName: string
  items: ItemSummary[]
  scratch: ItemSummary | null // scripture shown straight from the Bible tab
  live: { itemId: string; index: number } | null
  serverTime: number // set by the main process when it relays, so devices can correct their clocks
  /** Pinned Scripture passages, so the phone remote can send one (command 'pin'). */
  pins?: { id: string; title: string }[]
  /** One-tap messages on the phone remote's Chat tab (Settings → Phone remote). */
  quickChat?: string[]
  /** The operator's UI language (a Lang code), so screens and devices can show fixed labels in it. */
  lang?: string
}

export type RemoteCommand =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goto'; itemId: string; index: number }
  | { type: 'hideText' }
  | { type: 'black' }
  | { type: 'clear' }
  | { type: 'scripture'; title: string; slides: Slide[]; index?: number }
  | { type: 'pin'; id: string } // show a pinned passage live
  | { type: 'transpose'; itemId: string; by: number } // live transpose a song by ±semitones; by 0 = back to the written key

export interface NetStatus {
  running: boolean
  port: number | null
  urls: string[]
  pin: string
  clients: { remote: number; stage: number; overlay: number; display: number }
  error?: string
}

export interface DisplayInfo {
  id: number
  label: string
  width: number
  height: number
  primary: boolean
}

export type ScreenKind = 'audience' | 'stage'

/** `lost`: the operator wants this output but its display is gone (it reopens when the display returns). */
export type ScreensStatus = Record<ScreenKind, { open: boolean; displayId: number | null; lost?: boolean }>

export interface BackupSummary {
  songs: number
  services: number
  bibles: number
  media: number // files and background loops
  settings: boolean
  skipped: { songs: number; bibles: number; media: number }
  bytes: number
}

/** Automatic backups (Settings → Backup & restore; Sunday check). */
export interface AutoBackupStatus {
  enabled: boolean
  dir: string // folder in use
  defaultDir: string // <userData>/autobackups
  keep: number // newest backups kept
  running: boolean
  lastAt: number | null // ms
  lastPath: string | null
  lastBytes: number | null
  /** Nothing changed since the last backup (so an old date is fine). */
  current: boolean
  error: string | null // last skip or failure, e.g. low disk
}

/** Start-up options, kept in <userData>/boot.json so they can be read before the app is ready. */
export interface BootPrefs {
  /** Decode video on the CPU (turns off GPU acceleration). For machines where videos flicker. */
  cpuVideo: boolean
  /** Read-only: what this run started with (a change shows "Restart to apply"). */
  active?: { cpuVideo: boolean }
}

/** A song as plain text for .txt import/export. */
export interface SongText {
  name: string // file name without extension
  text: string
  /** The file's extension (".cho", ".usr"…) so the importer can tell the formats apart. */
  ext?: string
}

/** One song found online (Songs tab → Find a song). Lyrics only: no chords. */
export interface WebSongHit {
  id: string
  title: string
  artist: string
  album?: string
  /** Seconds. */
  duration?: number
  plainLyrics: string
  /** Where it came from, for the label in the results. */
  source: 'lrclib'
}

export type WebSongSearch = { ok: true; hits: WebSongHit[] } | { ok: false; error: 'offline' | 'failed' }

/** Chat between people on phone remotes and the operator. */
export interface ChatMessage {
  id: string
  from: 'operator' | 'remote'
  name: string
  text: string
  at: number
}

/** A presentation file as a PDF, ready to be drawn page by page (see main/decks.ts). */
export interface DeckSourceData {
  name: string
  source: string // original file type: pdf, pptx, key…
  pdf: Uint8Array
  notes: { hidden: boolean; notes: string }[] // per slide, PowerPoint only
}

export type DeckLoadResult = { ok: DeckSourceData } | { error: string; code: 'no-converter' | 'failed' }

export interface DeckSaveInput {
  name: string
  source: string
  width: number
  height: number
  pages: Uint8Array[] // JPEG bytes
  notes: DeckSourceData['notes']
}
