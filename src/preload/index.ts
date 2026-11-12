import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AutoBackupStatus,
  BootPrefs,
  BackupSummary,
  BibleBook,
  BibleCatalog,
  BibleInfo,
  BibleInstallProgress,
  Bootstrap,
  UpdateInfo,
  UpdateStatus,
  ChatMessage,
  DeckLoadResult,
  DeckSaveInput,
  DisplayInfo,
  MediaItem,
  NetStatus,
  RemoteCommand,
  ScreenKind,
  ScreensStatus,
  Service,
  ServiceSummary,
  Snapshot,
  Song,
  SongText,
  WebSongSearch,
  SongUsage,
  Verse,
  VerseHit
} from '@shared/types'

function subscribe<T>(channel: string, cb: (value: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, value: T): void => cb(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  platform: process.platform,
  displays: {
    list: (): Promise<DisplayInfo[]> => ipcRenderer.invoke(IPC.displaysList),
    onChange: (cb: (d: DisplayInfo[]) => void) => subscribe(IPC.displaysChanged, cb)
  },
  screens: {
    open: (kind: ScreenKind, displayId: number | null): Promise<ScreensStatus> =>
      ipcRenderer.invoke(IPC.screenOpen, kind, displayId),
    close: (kind: ScreenKind): Promise<ScreensStatus> => ipcRenderer.invoke(IPC.screenClose, kind),
    status: (): Promise<ScreensStatus> => ipcRenderer.invoke(IPC.screenStatus),
    onStatus: (cb: (s: ScreensStatus) => void) => subscribe(IPC.screenStatus, cb),
    /** Stop waiting for an output whose display was unplugged. */
    forget: (kind: ScreenKind): Promise<ScreensStatus> => ipcRenderer.invoke(IPC.screenForget, kind),
    onNotice: (cb: (n: { text: string; tone: 'ok' | 'warn' }) => void) => subscribe(IPC.screenNotice, cb)
  },
  state: {
    /** Operator publishes the live picture. */
    set: (snap: Snapshot): void => ipcRenderer.send(IPC.stateSet, snap),
    get: (): Promise<Snapshot | null> => ipcRenderer.invoke(IPC.stateGet),
    onSnapshot: (cb: (s: Snapshot) => void) => subscribe(IPC.stateSnapshot, cb),
    /** Commands from phones, executed by the operator window. */
    onCommand: (cb: (c: RemoteCommand) => void) => subscribe(IPC.remoteCommand, cb)
  },
  net: {
    start: (): Promise<NetStatus> => ipcRenderer.invoke(IPC.netStart),
    stop: (): Promise<NetStatus> => ipcRenderer.invoke(IPC.netStop),
    status: (): Promise<NetStatus> => ipcRenderer.invoke(IPC.netStatus),
    onStatus: (cb: (s: NetStatus) => void) => subscribe(IPC.netStatus, cb),
    qr: (text: string): Promise<string> => ipcRenderer.invoke(IPC.netQr, text)
  },
  chat: {
    list: (): Promise<ChatMessage[]> => ipcRenderer.invoke(IPC.chatList),
    send: (text: string): Promise<ChatMessage | null> => ipcRenderer.invoke(IPC.chatSend, text),
    onMessage: (cb: (m: ChatMessage) => void) => subscribe(IPC.chatMessage, cb)
  },
  /** macOS camera permission (asks once). Always true elsewhere. */
  cameraAccess: (): Promise<boolean> => ipcRenderer.invoke(IPC.cameraAccess),
  data: {
    bootstrap: (): Promise<Bootstrap> => ipcRenderer.invoke(IPC.bootstrap),
    saveSong: (s: Song): Promise<Song> => ipcRenderer.invoke(IPC.songSave, s),
    saveSongs: (s: Song[]): Promise<void> => ipcRenderer.invoke(IPC.songsSaveMany, s),
    deleteSong: (id: string): Promise<void> => ipcRenderer.invoke(IPC.songDelete, id),
    saveService: (s: Service): Promise<void> => ipcRenderer.invoke(IPC.serviceSave, s),
    listServices: (): Promise<ServiceSummary[]> => ipcRenderer.invoke(IPC.serviceList),
    getService: (id: string): Promise<Service | null> => ipcRenderer.invoke(IPC.serviceGet, id),
    deleteService: (id: string): Promise<void> => ipcRenderer.invoke(IPC.serviceDelete, id),
    setSetting: (key: string, value: unknown): Promise<void> => ipcRenderer.invoke(IPC.settingSet, key, value)
  },
  media: {
    list: (): Promise<MediaItem[]> => ipcRenderer.invoke(IPC.mediaList),
    /** No paths: show a file picker ("audio" limits it to music files). */
    /** Presentation files come back in `decks`, to be drawn with deck.load / deck.save. */
    import: (paths?: string[], only?: 'audio'): Promise<{ added: MediaItem[]; skipped: string[]; decks: string[] }> =>
      ipcRenderer.invoke(IPC.mediaImport, paths, only),
    remove: (id: string): Promise<void> => ipcRenderer.invoke(IPC.mediaDelete, id),
    rename: (id: string, name: string): Promise<void> => ipcRenderer.invoke(IPC.mediaRename, id, name),
    /** Sunday check: the refs ("media/<file>") whose file is gone, and free space in the data folder (bytes, null if unknown). */
    check: (refs: string[]): Promise<{ missing: string[]; freeBytes: number | null }> => ipcRenderer.invoke(IPC.mediaCheck, refs),
    /** Link a folder (no path: folder picker). Its pictures and videos are listed, not copied. Null if cancelled. */
    linkFolder: (path?: string): Promise<{ folder: string; added: number } | null> => ipcRenderer.invoke(IPC.mediaLinkFolder, path),
    unlinkFolder: (path: string): Promise<void> => ipcRenderer.invoke(IPC.mediaUnlinkFolder, path),
    linkedFolders: (): Promise<{ path: string; missing: boolean; count: number }[]> => ipcRenderer.invoke(IPC.mediaLinkedFolders),
    refreshLinked: (): Promise<void> => ipcRenderer.invoke(IPC.mediaRefreshLinked),
    /** Reveal a media file in Finder / Explorer (false if it isn't there). */
    showInFolder: (ref: string): Promise<boolean> => ipcRenderer.invoke(IPC.mediaShowInFolder, ref),
    /** Disk path of a dropped File. */
    pathFor: (file: File): string => webUtils.getPathForFile(file)
  },
  deck: {
    pick: (): Promise<string[]> => ipcRenderer.invoke(IPC.deckPick),
    load: (path: string): Promise<DeckLoadResult> => ipcRenderer.invoke(IPC.deckLoad, path),
    save: (input: DeckSaveInput): Promise<MediaItem> => ipcRenderer.invoke(IPC.deckSave, input),
    /** Which program is converting right now ("Keynote", "LibreOffice", "PowerPoint"). */
    onStep: (cb: (step: string) => void) => subscribe(IPC.deckStep, cb)
  },
  backup: {
    create: (path?: string): Promise<{ path: string; summary: BackupSummary } | null> =>
      ipcRenderer.invoke(IPC.backupCreate, path),
    restore: (path?: string): Promise<{ path: string; summary: BackupSummary } | null> =>
      ipcRenderer.invoke(IPC.backupRestore, path),
    /** Automatic backups: daily while open and on quit. */
    auto: {
      status: (): Promise<AutoBackupStatus> => ipcRenderer.invoke(IPC.autoBackupStatus),
      set: (patch: { enabled?: boolean; dir?: string | null; keep?: number }): Promise<AutoBackupStatus> =>
        ipcRenderer.invoke(IPC.autoBackupSet, patch),
      /** Choose the folder with a dialog; null when cancelled. */
      pickDir: (): Promise<AutoBackupStatus | null> => ipcRenderer.invoke(IPC.autoBackupPickDir),
      openDir: (): Promise<void> => ipcRenderer.invoke(IPC.autoBackupOpenDir),
      /** Back up now (even if nothing changed). */
      run: (): Promise<{ done: boolean; path?: string; reason?: string; message?: string }> => ipcRenderer.invoke(IPC.autoBackupRun),
      onChange: (cb: (s: AutoBackupStatus) => void) => subscribe(IPC.autoBackupChanged, cb)
    }
  },
  /** Start-up options (take effect after a restart). */
  bootPrefs: {
    get: (): Promise<BootPrefs> => ipcRenderer.invoke(IPC.bootPrefsGet),
    set: (patch: Partial<BootPrefs>): Promise<BootPrefs> => ipcRenderer.invoke(IPC.bootPrefsSet, patch)
  },
  /** Song usage log (one entry per song, service and day it went live). */
  usage: {
    log: (songId: string, serviceId: string, day: string): Promise<void> => ipcRenderer.invoke(IPC.usageLog, songId, serviceId, day),
    report: (from?: string, to?: string): Promise<SongUsage[]> => ipcRenderer.invoke(IPC.usageReport, from, to),
    /** Save CSV text with a save dialog (or straight to `path`). */
    exportCsv: (csv: string, name: string, path?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.usageExportCsv, csv, name, path)
  },
  /** Print sheets: an HTML page saved as PDF (save dialog, or `path`) or sent to a printer. */
  print: {
    pdf: (html: string, name: string, path?: string): Promise<string | null> => ipcRenderer.invoke(IPC.printPdf, html, name, path),
    print: (html: string): Promise<boolean> => ipcRenderer.invoke(IPC.printPrint, html)
  },
  songFiles: {
    export: (files: SongText[], folder?: string): Promise<{ folder: string; count: number } | null> =>
      ipcRenderer.invoke(IPC.songsExportTxt, files, folder),
    import: (paths?: string[]): Promise<SongText[] | null> => ipcRenderer.invoke(IPC.songsImportTxt, paths),
    /** Lyrics search online (LRCLIB). */
    webSearch: (q: string): Promise<WebSongSearch> => ipcRenderer.invoke(IPC.songsWebSearch, q)
  },
  appInfo: (): Promise<{ version: string; dataDir: string; platform: string; bibles: BibleInfo[] }> =>
    ipcRenderer.invoke(IPC.appInfo),
  /** Update notice: GitHub's latest release vs this version (nothing is downloaded or installed). */
  updates: {
    status: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.updateStatus),
    check: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.updateCheck),
    /** Opens the release page in the browser. */
    open: (): Promise<void> => ipcRenderer.invoke(IPC.updateOpen),
    onAvailable: (cb: (info: UpdateInfo) => void) => subscribe(IPC.updateAvailable, cb)
  },
  /** Operator window interface size (zoom factor, saved). */
  uiZoom: {
    get: (): Promise<number> => ipcRenderer.invoke(IPC.uiZoomGet),
    set: (factor: number): Promise<number> => ipcRenderer.invoke(IPC.uiZoomSet, factor),
    onChange: (cb: (factor: number) => void) => subscribe(IPC.uiZoomChanged, cb)
  },
  bible: {
    list: (): Promise<BibleInfo[]> => ipcRenderer.invoke(IPC.biblesList),
    onChange: (cb: (b: BibleInfo[]) => void) => subscribe(IPC.biblesChanged, cb),
    books: (id: string): Promise<BibleBook[]> => ipcRenderer.invoke(IPC.bibleBooks, id),
    chapter: (id: string, book: number, chapter: number): Promise<Verse[]> =>
      ipcRenderer.invoke(IPC.bibleChapter, id, book, chapter),
    search: (id: string, q: string): Promise<{ ref: boolean; hits: VerseHit[] }> =>
      ipcRenderer.invoke(IPC.bibleSearch, id, q),
    import: (): Promise<BibleInfo | null> => ipcRenderer.invoke(IPC.bibleImport),
    catalog: (refresh?: boolean): Promise<BibleCatalog> => ipcRenderer.invoke(IPC.bibleCatalog, refresh),
    install: (ebibleId: string): Promise<BibleInfo> => ipcRenderer.invoke(IPC.bibleInstall, ebibleId),
    onInstallProgress: (cb: (p: BibleInstallProgress) => void) => subscribe(IPC.bibleInstallProgress, cb),
    remove: (id: string): Promise<void> => ipcRenderer.invoke(IPC.bibleDelete, id),
    rename: (id: string, abbrev: string): Promise<void> => ipcRenderer.invoke(IPC.bibleRename, id, abbrev)
  }
}

export type NLApi = typeof api

contextBridge.exposeInMainWorld('nl', api)
