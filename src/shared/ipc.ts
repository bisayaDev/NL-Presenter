// IPC channel names, in one place so main, preload and renderers agree.
export const IPC = {
  displaysList: 'displays:list',
  displaysChanged: 'displays:changed',

  // Screens: "audience" (projector) and "stage" (performer monitor).
  screenOpen: 'screen:open',
  screenClose: 'screen:close',
  screenStatus: 'screen:status',
  screenForget: 'screen:forget', // stop waiting for a lost output
  screenNotice: 'screen:notice', // main → operator: lost / reconnected / restarted

  // Live picture: operator → main → screens / devices.
  stateSet: 'state:set',
  stateGet: 'state:get',
  stateSnapshot: 'state:snapshot',
  remoteCommand: 'remote:command',

  // LAN server for phones and tablets.
  netStart: 'net:start',
  netStop: 'net:stop',
  netStatus: 'net:status',
  netQr: 'net:qr',
  chatSend: 'chat:send',
  chatList: 'chat:list',
  chatMessage: 'chat:message',
  cameraAccess: 'camera:access',

  bootstrap: 'data:bootstrap',
  songSave: 'songs:save',
  songsSaveMany: 'songs:save-many',
  songDelete: 'songs:delete',
  serviceSave: 'service:save',
  serviceList: 'service:list',
  serviceGet: 'service:get',
  serviceDelete: 'service:delete',
  usageLog: 'usage:log',
  usageReport: 'usage:report',
  usageExportCsv: 'usage:export-csv',
  printPdf: 'print:pdf',
  printPrint: 'print:print',
  settingSet: 'settings:set',

  mediaList: 'media:list',
  mediaImport: 'media:import',
  mediaDelete: 'media:delete',
  mediaRename: 'media:rename',
  mediaCheck: 'media:check', // Sunday check: which media refs are missing on disk, and free disk space
  mediaLinkFolder: 'media:link-folder', // pick a folder and list its pictures and videos without copying
  mediaUnlinkFolder: 'media:unlink-folder',
  mediaLinkedFolders: 'media:linked-folders',
  mediaRefreshLinked: 'media:refresh-linked', // scan linked folders again
  mediaShowInFolder: 'media:show-in-folder', // Finder / Explorer
  deckPick: 'deck:pick',
  deckLoad: 'deck:load',
  deckSave: 'deck:save',
  deckStep: 'deck:step',

  backupCreate: 'backup:create',
  backupRestore: 'backup:restore',
  autoBackupStatus: 'autobackup:status',
  autoBackupSet: 'autobackup:set',
  autoBackupPickDir: 'autobackup:pick-dir',
  autoBackupOpenDir: 'autobackup:open-dir',
  autoBackupRun: 'autobackup:run',
  autoBackupChanged: 'autobackup:changed', // main → operator
  // Start-up options read before the app is ready (a JSON file in userData), e.g. CPU-only video decoding.
  bootPrefsGet: 'bootprefs:get',
  bootPrefsSet: 'bootprefs:set',
  songsExportTxt: 'songs:export-txt',
  songsImportTxt: 'songs:import-txt',
  songsWebSearch: 'songs:web-search',
  appInfo: 'app:info',
  updateStatus: 'update:status',
  updateCheck: 'update:check',
  updateAvailable: 'update:available',
  updateOpen: 'update:open',
  uiZoomGet: 'ui:zoom-get',
  uiZoomSet: 'ui:zoom-set',
  uiZoomChanged: 'ui:zoom-changed',

  biblesList: 'bibles:list',
  biblesChanged: 'bibles:changed',
  bibleBooks: 'bible:books',
  bibleChapter: 'bible:chapter',
  bibleSearch: 'bible:search',
  bibleImport: 'bible:import',
  bibleDelete: 'bible:delete',
  bibleRename: 'bible:rename',
  bibleCatalog: 'bible:catalog',
  bibleInstall: 'bible:install',
  bibleInstallProgress: 'bible:install-progress'
} as const

/** WebSocket protocol between the LAN server and browser clients. */
export type ClientRole = 'remote' | 'stage' | 'overlay' | 'display'

export type ClientMsg =
  | { t: 'hello'; role: ClientRole; pin?: string }
  | { t: 'cmd'; cmd: import('./types').RemoteCommand }
  | { t: 'bible-search'; q: string; reqId: number }
  | { t: 'chat'; text: string; name?: string }

export type ServerMsg =
  | { t: 'welcome'; role: ClientRole; bible: { id: string; abbrev: string } | null; chat?: import('./types').ChatMessage[]; lang?: string }
  /** `reason` is English; `code` lets the device show it in its own language. */
  | { t: 'denied'; reason: string; code?: 'wrong' | 'required' | 'locked' }
  | { t: 'snap'; snap: import('./types').Snapshot }
  | { t: 'bible-results'; reqId: number; hits: import('./types').VerseHit[]; abbrev: string }
  | { t: 'chat'; msg: import('./types').ChatMessage }
