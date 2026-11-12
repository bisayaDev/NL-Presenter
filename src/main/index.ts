import { app, BrowserWindow, dialog, ipcMain, screen, session, shell, systemPreferences } from 'electron'
import { mkdir, readFile, statfs, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import QRCode from 'qrcode'
import { IPC } from '@shared/ipc'
import { snapZoom, stepZoom } from '@shared/appearance'
import type { BibleInfo, Bootstrap, RemoteCommand, ScreenKind, Service, Snapshot, Song, SongText } from '@shared/types'
import { bootPrefsView, writeBootPrefs } from './bootPrefs' // first: may turn off GPU acceleration before ready
import { createBackup, restoreBackup } from './backup'
import { autoBackupStatus, initAutoBackup, quitBackupWanted, runAutoBackup, setAutoBackup } from './autoBackup'
import { printHtml, printToPdf } from './print'
import { checkForUpdate, startUpdateChecks, updateStatus } from './updates'
import * as db from './db'
import { parseBibleXml } from './zefania'
import { bibleCatalog, initBibleLibrary, installLibraryBible } from './bibleLibrary'
import { searchWebSongs } from './songSearch'
import {
  AUDIO_EXT,
  deleteMedia,
  IMAGE_EXT,
  importMedia,
  initMedia,
  listMedia,
  MIME,
  mediaPath,
  registerMediaScheme,
  renameMedia,
  VIDEO_EXT,
  mediaFilePath
} from './media'
import { linkedFolders, linkFolder, refreshLinked, unlinkFolder } from './linkedMedia'
import {
  closeAllScreens,
  closeScreen,
  initScreens,
  listDisplays,
  openScreen,
  pruneScreens,
  forgetScreen,
  reconnectScreens,
  wantedOutputs,
  screensStatus,
  screenWindow,
  screenWindows
} from './screens'
import { ConvertError, loadDeckSource, saveDeck } from './decks'
import { DECK_EXT } from './convert'
import { addChat, chatLog, netStatus, publishSnapshot, startServer, stopServer } from './server'
import { mainLang, tm, tmn } from './i18n'

const isMac = process.platform === 'darwin'
registerMediaScheme()
const devUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] ?? null : null
// Tests: a synthetic camera, and no permission prompt.
if (process.env['NL_FAKE_CAMERA']) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream')
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream')
}

/** Websites shown on screen (browser slides) run in their own session, with every permission denied. */
const WEB_PARTITION = 'persist:web'

let operatorWin: BrowserWindow | null = null
let lastSnapshot: Snapshot | null = null

function loadRoute(win: BrowserWindow, route: string): void {
  if (devUrl) win.loadURL(`${devUrl}#/${route}`)
  else win.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/${route}` })
}

const webPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: true,
  contextIsolation: true,
  // Video backgrounds and timers must keep running when the window is not focused.
  backgroundThrottling: false,
  // Browser slides use <webview>, hardened in will-attach-webview below.
  webviewTag: true
}

/** Lock down every <webview>: no preload or Node, sandboxed, own session, http(s) only, no popups. */
function hardenWebviews(): void {
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (ev, prefs, params) => {
      delete prefs.preload
      prefs.nodeIntegration = false
      prefs.contextIsolation = true
      prefs.sandbox = true
      prefs.backgroundThrottling = false
      params.partition = WEB_PARTITION
      ;(prefs as { partition?: string }).partition = WEB_PARTITION
      if (!/^https?:\/\//i.test(params.src)) ev.preventDefault()
    })
    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    }
  })
  const web = session.fromPartition(WEB_PARTITION)
  web.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  web.setPermissionCheckHandler(() => false)
}

/** Operator interface size. Isolated zoom, so projector/stage windows on the same origin stay at 100%. */
function setOperatorZoom(factor: number): number {
  const z = snapZoom(factor)
  db.setSetting('uiZoom', z)
  if (operatorWin && !operatorWin.isDestroyed()) {
    operatorWin.webContents.setZoomFactor(z)
    operatorWin.webContents.send(IPC.uiZoomChanged, z)
  }
  return z
}

function createOperatorWindow(): void {
  const zoom = snapZoom(db.getSettings().uiZoom)
  operatorWin = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    title: 'NLPresenter',
    backgroundColor: '#0b0d12',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: { ...webPreferences, zoomFactor: zoom }
  })
  operatorWin.webContents.setZoomMode('isolated')
  operatorWin.webContents.on('did-finish-load', () => operatorWin?.webContents.setZoomFactor(snapZoom(db.getSettings().uiZoom)))
  // Ctrl/Cmd + = / - / 0 step the interface size (before the page or the default menu sees them).
  operatorWin.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown' || !(isMac ? input.meta : input.control) || input.alt) return
    const cur = operatorWin?.webContents.getZoomFactor() ?? 1
    if (input.key === '=' || input.key === '+') setOperatorZoom(stepZoom(cur, 1))
    else if (input.key === '-' || input.key === '_') setOperatorZoom(stepZoom(cur, -1))
    else if (input.key === '0') setOperatorZoom(1)
    else return
    e.preventDefault()
  })
  operatorWin.once('ready-to-show', () => operatorWin?.show())
  operatorWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  operatorWin.on('closed', () => {
    operatorWin = null
    closeAllScreens()
    stopServer()
    if (!isMac) app.quit()
  })
  loadRoute(operatorWin, 'operator')
  // Operator page crashed: reload it and offer to resume (outputs keep showing the last picture meanwhile).
  operatorWin.webContents.on('render-process-gone', (_e, d) => {
    if (d.reason === 'clean-exit') return
    db.setSetting('lastExitUnclean', true)
    setTimeout(() => operatorWin?.webContents.reload(), 300)
  })
}

const sendOperator = (channel: string, value: unknown): void => {
  if (operatorWin && !operatorWin.isDestroyed()) operatorWin.webContents.send(channel, value)
}

function notifyBibles(): void {
  sendOperator(IPC.biblesChanged, db.listBibles())
}

function bundledBiblesDir(): string {
  return app.isPackaged ? join(process.resourcesPath, 'bibles') : join(app.getAppPath(), 'resources/bibles')
}

function currentBible(): { id: string; abbrev: string } | null {
  const bibles = db.listBibles()
  const id = db.getSettings().bibleId as string | undefined
  const b = bibles.find((x) => x.id === id) ?? bibles[0]
  return b ? { id: b.id, abbrev: b.abbrev } : null
}

function registerIpc(): void {
  // ----- screens -----
  ipcMain.handle(IPC.displaysList, () => listDisplays())
  ipcMain.handle(IPC.screenOpen, (_e, kind: ScreenKind, displayId: number | null) => openScreen(kind, displayId))
  ipcMain.handle(IPC.screenClose, (_e, kind: ScreenKind) => closeScreen(kind))
  ipcMain.handle(IPC.screenStatus, () => screensStatus())
  ipcMain.handle(IPC.screenForget, (_e, kind: ScreenKind) => forgetScreen(kind))

  // ----- live state relay -----
  ipcMain.handle(IPC.stateGet, () => lastSnapshot && { ...lastSnapshot, serverTime: Date.now() })
  ipcMain.on(IPC.stateSet, (_e, snap: Snapshot) => {
    lastSnapshot = { ...snap, serverTime: Date.now() }
    for (const w of screenWindows()) w.webContents.send(IPC.stateSnapshot, lastSnapshot)
    publishSnapshot(lastSnapshot)
  })

  // ----- LAN server -----
  ipcMain.handle(IPC.netStart, async () => {
    const st = await startServer({
      staticDir: devUrl ? null : join(__dirname, '../renderer'),
      devUrl,
      onCommand: (cmd: RemoteCommand) => sendOperator(IPC.remoteCommand, cmd),
      currentBible,
      lang: mainLang,
      searchBible: (q) => {
        const b = currentBible()
        return b ? { ...db.searchBible(b.id, q), abbrev: b.abbrev } : null
      },
      onStatus: () => sendOperator(IPC.netStatus, netStatus()),
      onChat: (msg) => sendOperator(IPC.chatMessage, msg),
      mediaPath,
      mediaMime: (ext) => MIME[ext],
      apiEnabled: () => db.getSettings()['controlApi'] === true,
      fixedPin: () => {
        const s = db.getSettings()
        return s['controlApi'] === true && typeof s['controlApiPin'] === 'string' ? (s['controlApiPin'] as string) : null
      }
    })
    if (!app.isPackaged) console.log(`LAN server on port ${st.port} PIN ${st.pin} ${st.error ?? ''}`)
    return st
  })
  ipcMain.handle(IPC.netStop, () => stopServer())
  ipcMain.handle(IPC.netStatus, () => netStatus())
  ipcMain.handle(IPC.chatList, () => chatLog())
  ipcMain.handle(IPC.chatSend, (_e, text: string) => addChat('operator', 'Operator', text))
  // macOS asks the user once; the answer is remembered in System Settings → Privacy → Camera.
  ipcMain.handle(IPC.cameraAccess, async () => {
    if (!isMac) return true
    if (systemPreferences.getMediaAccessStatus('camera') === 'granted') return true
    return systemPreferences.askForMediaAccess('camera')
  })
  ipcMain.handle(IPC.netQr, (_e, text: string) =>
    QRCode.toDataURL(text, { margin: 1, width: 360, color: { dark: '#0b0d12', light: '#ffffff' } })
  )

  // ----- library data -----
  ipcMain.handle(IPC.bootstrap, (): Bootstrap => ({
    songs: db.listSongs(),
    // The service the operator had open last (falls back to the newest).
    service: db.getService(String(db.getSettings().currentServiceId ?? '')) ?? db.getLatestService(),
    settings: db.getSettings()
  }))
  ipcMain.handle(IPC.songSave, (_e, song: Song) => db.saveSong(song))
  ipcMain.handle(IPC.songsSaveMany, (_e, songs: Song[]) => db.saveSongs(songs))
  ipcMain.handle(IPC.songDelete, (_e, id: string) => db.deleteSong(id))
  ipcMain.handle(IPC.serviceSave, (_e, service: Service) => db.saveService(service))
  ipcMain.handle(IPC.serviceList, () => db.listServiceSummaries())
  ipcMain.handle(IPC.serviceGet, (_e, id: string) => db.getService(id))
  ipcMain.handle(IPC.serviceDelete, (_e, id: string) => db.deleteService(id))
  ipcMain.handle(IPC.usageLog, (_e, songId: string, serviceId: string, day: string) => db.logSongUsage(songId, serviceId, day))
  ipcMain.handle(IPC.usageReport, (_e, from?: string, to?: string) => db.songUsageReport(from, to))
  ipcMain.handle(IPC.usageExportCsv, async (_e, csv: string, name: string, path?: string) => {
    let target = path
    if (!target) {
      if (!operatorWin) return null
      const pick = await dialog.showSaveDialog(operatorWin, {
        title: tm('main.dlg.exportUsage'),
        defaultPath: join(app.getPath('documents'), `${name.replace(/[\\/:*?"<>|]/g, '')}.csv`),
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (pick.canceled || !pick.filePath) return null
      target = pick.filePath
    }
    await writeFile(target, '﻿' + csv, 'utf8') // BOM: Excel reads it as UTF-8
    return target
  })
  ipcMain.handle(IPC.printPdf, (_e, html: string, name: string, path?: string) => printToPdf(operatorWin, html, name, path))
  ipcMain.handle(IPC.printPrint, (_e, html: string) => printHtml(html))
  ipcMain.handle(IPC.settingSet, (_e, key: string, value: unknown) => db.setSetting(key, value))
  ipcMain.handle(IPC.uiZoomGet, () => operatorWin?.webContents.getZoomFactor() ?? snapZoom(db.getSettings().uiZoom))
  ipcMain.handle(IPC.uiZoomSet, (_e, factor: number) => setOperatorZoom(factor))

  // ----- media -----
  ipcMain.handle(IPC.mediaList, () => listMedia())
  ipcMain.handle(IPC.mediaImport, async (_e, paths?: string[], only?: 'audio') => {
    let files = paths ?? []
    if (!files.length) {
      if (!operatorWin) return { added: [], skipped: [] }
      const audio = { name: tm('main.filter.audio'), extensions: AUDIO_EXT }
      const pick = await dialog.showOpenDialog(operatorWin, {
        title: only === 'audio' ? tm('main.dlg.importMusic') : tm('main.dlg.importMedia'),
        properties: ['openFile', 'multiSelections'],
        filters:
          only === 'audio'
            ? [audio]
            : [
                { name: tm('main.filter.allMedia'), extensions: [...IMAGE_EXT, ...VIDEO_EXT, ...AUDIO_EXT, 'json', ...DECK_EXT] },
                { name: tm('main.filter.images'), extensions: IMAGE_EXT },
                { name: tm('main.filter.videos'), extensions: VIDEO_EXT },
                audio,
                { name: tm('main.filter.loops'), extensions: ['json'] },
                { name: tm('main.filter.decks'), extensions: DECK_EXT }
              ]
      })
      if (pick.canceled) return { added: [], skipped: [], decks: [] }
      files = pick.filePaths
    }
    return importMedia(files)
  })
  // Presentations: pick files, then for each one get a PDF (converted if needed); the renderer draws the
  // pages and hands the pictures back to be saved.
  ipcMain.handle(IPC.deckPick, async () => {
    if (!operatorWin) return []
    const pick = await dialog.showOpenDialog(operatorWin, {
      title: tm('main.dlg.importDeck'),
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF, PowerPoint, Keynote', extensions: DECK_EXT }]
    })
    return pick.canceled ? [] : pick.filePaths
  })
  ipcMain.handle(IPC.deckLoad, async (_e, path: string) => {
    if (!DECK_EXT.includes(extname(path).slice(1).toLowerCase())) return { error: tm('main.err.notDeck'), code: 'failed' }
    try {
      return { ok: await loadDeckSource(path, (step) => sendOperator(IPC.deckStep, step)) }
    } catch (e) {
      return { error: (e as Error).message, code: e instanceof ConvertError ? e.code : 'failed' }
    }
  })
  ipcMain.handle(IPC.deckSave, (_e, input: Parameters<typeof saveDeck>[0]) => saveDeck(input))
  ipcMain.handle(IPC.mediaDelete, (_e, id: string) => deleteMedia(id))
  ipcMain.handle(IPC.mediaRename, (_e, id: string, name: string) => renameMedia(id, name))
  // Linked folders: pictures and videos listed from where they are (see linkedMedia.ts).
  ipcMain.handle(IPC.mediaLinkFolder, async (_e, path?: string) => {
    let folder = typeof path === 'string' ? path : ''
    if (!folder) {
      if (!operatorWin) return null
      const pick = await dialog.showOpenDialog(operatorWin, { title: tm('main.dlg.linkFolder'), properties: ['openDirectory'] })
      if (pick.canceled || !pick.filePaths[0]) return null
      folder = pick.filePaths[0]
    }
    return { folder, added: await linkFolder(folder) }
  })
  ipcMain.handle(IPC.mediaUnlinkFolder, (_e, path: string) => unlinkFolder(path))
  ipcMain.handle(IPC.mediaLinkedFolders, () => linkedFolders())
  ipcMain.handle(IPC.mediaRefreshLinked, () => refreshLinked())
  ipcMain.handle(IPC.mediaShowInFolder, (_e, ref: string) => {
    const p = mediaFilePath(ref)
    if (!p || !existsSync(p)) return false
    shell.showItemInFolder(p)
    return true
  })
  ipcMain.handle(IPC.mediaCheck, async (_e, refs: string[]) => {
    const missing = (Array.isArray(refs) ? refs : []).filter((r) => {
      if (typeof r !== 'string' || !r.startsWith('media/')) return false
      const p = mediaPath(r)
      return !p || !existsSync(p)
    })
    let freeBytes: number | null = null
    try {
      const probe = mediaPath('probe')
      const s = await statfs(probe ? dirname(probe) : app.getPath('userData'))
      freeBytes = Number(s.bavail) * Number(s.bsize)
    } catch {
      freeBytes = null
    }
    return { missing, freeBytes }
  })

  // ----- backup and song files -----
  // Each handler takes an optional path; without one it asks with a native dialog.
  ipcMain.handle(IPC.backupCreate, async (_e, path?: string) => {
    if (path) return { path, summary: await createBackup(path) }
    if (!operatorWin) return null
    const day = new Date().toISOString().slice(0, 10)
    const pick = await dialog.showSaveDialog(operatorWin, {
      title: tm('main.dlg.saveBackup'),
      defaultPath: join(app.getPath('documents'), `NLPresenter-backup-${day}.nlbackup`),
      filters: [{ name: tm('main.filter.backup'), extensions: ['nlbackup'] }]
    })
    if (pick.canceled || !pick.filePath) return null
    return { path: pick.filePath, summary: await createBackup(pick.filePath) }
  })
  ipcMain.handle(IPC.backupRestore, async (_e, path?: string) => {
    if (path) {
      const summary = await restoreBackup(path)
      notifyBibles()
      return { path, summary }
    }
    if (!operatorWin) return null
    const pick = await dialog.showOpenDialog(operatorWin, {
      title: tm('main.dlg.restoreBackup'),
      properties: ['openFile'],
      filters: [{ name: tm('main.filter.backup'), extensions: ['nlbackup'] }]
    })
    if (pick.canceled || !pick.filePaths[0]) return null
    const summary = await restoreBackup(pick.filePaths[0])
    notifyBibles()
    return { path: pick.filePaths[0], summary }
  })
  // ----- automatic backups -----
  ipcMain.handle(IPC.autoBackupStatus, () => autoBackupStatus())
  ipcMain.handle(IPC.autoBackupSet, (_e, patch: { enabled?: boolean; dir?: string | null; keep?: number }) => setAutoBackup(patch))
  ipcMain.handle(IPC.autoBackupPickDir, async () => {
    if (!operatorWin) return null
    const pick = await dialog.showOpenDialog(operatorWin, {
      title: tm('main.dlg.backupFolder'),
      defaultPath: autoBackupStatus().dir,
      properties: ['openDirectory', 'createDirectory']
    })
    if (pick.canceled || !pick.filePaths[0]) return null
    return setAutoBackup({ dir: pick.filePaths[0] })
  })
  ipcMain.handle(IPC.autoBackupOpenDir, async () => {
    const st = autoBackupStatus()
    await mkdir(st.dir, { recursive: true }).catch(() => {})
    if (st.lastPath && existsSync(st.lastPath)) shell.showItemInFolder(st.lastPath)
    else await shell.openPath(st.dir)
  })
  ipcMain.handle(IPC.autoBackupRun, () => runAutoBackup('now'))
  ipcMain.handle(IPC.bootPrefsGet, () => bootPrefsView())
  ipcMain.handle(IPC.bootPrefsSet, (_e, patch: { cpuVideo?: boolean }) => writeBootPrefs(patch))

  ipcMain.handle(IPC.songsExportTxt, async (_e, files: SongText[], dir?: string) => {
    if (!operatorWin || !files.length) return null
    let folder = dir
    if (!folder) {
      const pick = await dialog.showOpenDialog(operatorWin, {
        title: tmn('main.dlg.exportSongs', files.length),
        buttonLabel: tm('main.dlg.exportHere'),
        properties: ['openDirectory', 'createDirectory']
      })
      if (pick.canceled || !pick.filePaths[0]) return null
      folder = pick.filePaths[0]
    }
    for (const f of files) {
      const safe = f.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 120) || 'Untitled'
      let target = join(folder, `${safe}.txt`)
      for (let n = 2; existsSync(target); n++) target = join(folder, `${safe} (${n}).txt`)
      await writeFile(target, f.text.replace(/\n/g, '\r\n'), 'utf8') // CRLF opens cleanly in Notepad too
    }
    return { folder, count: files.length }
  })
  ipcMain.handle(IPC.songsImportTxt, async (_e, paths?: string[]): Promise<SongText[] | null> => {
    let files = paths ?? []
    if (!files.length) {
      if (!operatorWin) return null
      const pick = await dialog.showOpenDialog(operatorWin, {
        title: tm('main.dlg.importSongs'),
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: tm('main.filter.songs'), extensions: ['txt', 'cho', 'chordpro', 'chopro', 'crd', 'pro', 'usr'] }]
      })
      if (pick.canceled) return null
      files = pick.filePaths
    }
    return Promise.all(
      files.map(async (f) => ({
        name: basename(f, extname(f)),
        ext: extname(f).toLowerCase(),
        text: (await readFile(f, 'utf8')).replace(/^\uFEFF/, '')
      }))
    )
  })
  ipcMain.handle(IPC.songsWebSearch, (_e, q: string) => searchWebSongs(String(q ?? '')))
  ipcMain.handle(IPC.updateStatus, () => updateStatus())
  ipcMain.handle(IPC.updateCheck, () => checkForUpdate())
  ipcMain.handle(IPC.updateOpen, () => {
    const url = updateStatus().available?.url ?? 'https://github.com/bisayaDev/NL-Presenter/releases/latest'
    if (/^https:\/\/github\.com\//.test(url)) void shell.openExternal(url)
  })
  ipcMain.handle(IPC.appInfo, () => ({
    version: app.getVersion(),
    dataDir: app.getPath('userData'),
    platform: process.platform,
    bibles: db.listBibles()
  }))

  // ----- bibles -----
  ipcMain.handle(IPC.biblesList, () => db.listBibles())
  ipcMain.handle(IPC.bibleBooks, (_e, id: string) => db.getBooks(id))
  ipcMain.handle(IPC.bibleChapter, (_e, id: string, book: number, chapter: number) => db.getChapter(id, book, chapter))
  ipcMain.handle(IPC.bibleSearch, (_e, id: string, q: string) => db.searchBible(id, q))
  ipcMain.handle(IPC.bibleCatalog, (_e, refresh?: boolean) => bibleCatalog(!!refresh))
  ipcMain.handle(IPC.bibleInstall, async (_e, ebibleId: string) => {
    const info = await installLibraryBible(ebibleId, (p) => sendOperator(IPC.bibleInstallProgress, p))
    notifyBibles()
    return info
  })
  ipcMain.handle(IPC.bibleRename, (_e, id: string, abbrev: string) => {
    const code = String(abbrev).trim().replace(/\s+/g, ' ').slice(0, 12)
    if (code) db.setBibleAbbrev(id, code)
    notifyBibles()
  })
  ipcMain.handle(IPC.bibleDelete, (_e, id: string) => {
    db.deleteBible(id)
    notifyBibles()
  })
  ipcMain.handle(IPC.bibleImport, async () => {
    if (!operatorWin) return null
    const pick = await dialog.showOpenDialog(operatorWin, {
      title: tm('main.dlg.importBible'),
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: tm('main.filter.bibleXml'), extensions: ['xml'] }]
    })
    if (pick.canceled || !pick.filePaths.length) return null
    let last: BibleInfo | null = null
    const failed: string[] = []
    for (const file of pick.filePaths) {
      try {
        const parsed = parseBibleXml(await readFile(file, 'utf8'), basename(file, '.xml'))
        last = db.insertBible(
          {
            id: `z-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            name: parsed.name,
            abbrev: parsed.abbrev,
            lang: parsed.lang,
            license: `${parsed.info ? `${parsed.info}. ` : ''}Imported from ${basename(file)}`
          },
          parsed
        )
      } catch (e) {
        failed.push(`${basename(file)}: ${(e as Error).message}`)
      }
    }
    notifyBibles()
    if (failed.length && !last) throw new Error(failed.join('\n'))
    if (failed.length) dialog.showMessageBox(operatorWin, { type: 'warning', message: tm('main.msg.someFailed'), detail: failed.join('\n') })
    return last
  })

}

/**
 * Dev aid: NL_SNAPSHOT_DIR=/path npm run dev → saves operator + screen screenshots, then quits.
 * NL_SNAPSHOT_JS=/file.js runs that script in the operator window first and prints its result.
 */
async function runSnapshot(dir: string): Promise<void> {
  const { writeFile } = await import('node:fs/promises')
  const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
  await wait(2500)
  if (!operatorWin) return
  const scriptFile = process.env['NL_SNAPSHOT_JS']
  if (scriptFile) {
    try {
      const result = await operatorWin.webContents.executeJavaScript(await readFile(scriptFile, 'utf8'))
      console.log('SNAPSHOT_RESULT ' + JSON.stringify(result, null, 1))
    } catch (e) {
      console.log('SNAPSHOT_ERROR ' + String(e))
    }
  } else {
    openScreen('audience', null)
    await wait(1500)
    for (const key of ['Right', 'Right']) {
      operatorWin.webContents.sendInputEvent({ type: 'keyDown', keyCode: key })
      operatorWin.webContents.sendInputEvent({ type: 'keyUp', keyCode: key })
      await wait(300)
    }
  }
  await wait(1200)
  await writeFile(join(dir, 'operator.png'), (await operatorWin.webContents.capturePage()).toPNG())
  for (const kind of ['audience', 'stage'] as const) {
    const w = screenWindow(kind)
    if (w) await writeFile(join(dir, kind === 'audience' ? 'output.png' : 'stage.png'), (await w.webContents.capturePage()).toPNG())
  }
  // NL_SNAPSHOT_WEB=remote,stage: load those pages like a phone would (no preload bridge) and capture them.
  const st = netStatus()
  for (const route of (process.env['NL_SNAPSHOT_WEB'] ?? '').split(',').filter(Boolean)) {
    if (!st.port) break
    const phone = new BrowserWindow({ show: false, width: 390, height: 844, webPreferences: { sandbox: true } })
    const url = `http://127.0.0.1:${st.port}/#/${route}`
    await phone.loadURL(url)
    await phone.webContents.executeJavaScript(`localStorage.setItem('nl-remote-pin', '${st.pin}'); location.reload()`)
    await wait(3000)
    await writeFile(join(dir, `web-${route}.png`), (await phone.webContents.capturePage()).toPNG())
    phone.destroy()
  }
  app.exit(0)
}

app.whenReady().then(async () => {
  // Development: show the app icon in the Dock (packaged apps get it from the bundle).
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(join(app.getAppPath(), 'build', 'icon.png'))
  const dbFile = process.env['NL_DB_FILE'] || join(app.getPath('userData'), 'nlpresenter.db')
  db.openDb(dbFile)
  // Crash-safe resume: `cleanExit` is set on before-quit and cleared now. If it wasn't set, the last run
  // ended in a crash (or power loss), so the operator window offers to resume (setting `lastExitUnclean`).
  {
    const st = db.getSettings()
    const unclean = st['cleanExit'] === false
    db.setSetting('lastExitUnclean', unclean)
    db.setSetting('cleanExit', false)
  }
  // Test databases get their own media folder next to them.
  // Saved copy of the online translation list, next to the database (works offline).
  initBibleLibrary(join(dirname(dbFile), process.env['NL_DB_FILE'] ? `${basename(dbFile, extname(dbFile))}-bible-catalog.csv` : 'bible-catalog.csv'))
  await initMedia(
    process.env['NL_DB_FILE'] ? join(dirname(dbFile), `${basename(dbFile, extname(dbFile))}-media`) : join(app.getPath('userData'), 'media')
  )
  initScreens({
    webPreferences,
    load: loadRoute,
    onChange: () => {
      sendOperator(IPC.screenStatus, screensStatus())
      db.setSetting('sessionOutputs', wantedOutputs()) // where outputs were, for resume after a crash
    },
    focusOperator: () => operatorWin?.focus(),
    notice: (text, tone) => sendOperator(IPC.screenNotice, { text, tone })
  })
  hardenWebviews()
  registerIpc()
  createOperatorWindow()
  // Automatic backups: next to a test database, else <userData>/autobackups.
  initAutoBackup(
    process.env['NL_DB_FILE'] ? join(dirname(dbFile), 'autobackups') : join(app.getPath('userData'), 'autobackups'),
    (st) => sendOperator(IPC.autoBackupChanged, st)
  )

  // First run: install the bundled Bibles once the window is up, then tell the UI.
  setTimeout(() => {
    const t0 = Date.now()
    const added = db.seedBundledBibles(bundledBiblesDir())
    if (added.length) {
      console.log(`Installed bundled Bibles ${added.join(', ')} in ${Date.now() - t0}ms`)
      notifyBibles()
    }
  }, 300)
  if (process.env['NL_SNAPSHOT_DIR']) runSnapshot(process.env['NL_SNAPSHOT_DIR'])
  startUpdateChecks({
    enabled: () => db.getSettings()['updateCheck'] !== false,
    skipped: () => {
      const v = db.getSettings()['updateSkip']
      return typeof v === 'string' ? v : null
    },
    notify: (info) => sendOperator(IPC.updateAvailable, info)
  })

  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  const onDisplaysChanged = (): void => {
    sendOperator(IPC.displaysChanged, listDisplays())
    pruneScreens()
    // A replugged display settles its size and position a moment after it appears.
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(reconnectScreens, 1500)
  }
  screen.on('display-added', onDisplaysChanged)
  screen.on('display-removed', onDisplaysChanged)

  app.on('activate', () => {
    if (!operatorWin) createOperatorWindow()
  })
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})

// Automatic backup on quit (only when on and something changed). Holds the quit until it's written, at most
// 2 minutes; an unfinished ".part" file is cleaned up next time.
let quitBackupDone = false
app.on('before-quit', (e) => {
  if (quitBackupDone) return
  quitBackupDone = true
  let wanted = false
  try {
    wanted = quitBackupWanted()
  } catch {
    // database not open yet
  }
  if (!wanted) return
  e.preventDefault()
  operatorWin?.setTitle(tm('main.quitBackup'))
  const limit = new Promise((r) => setTimeout(r, 120_000))
  Promise.race([runAutoBackup('quit'), limit]).finally(() => app.quit())
})

// Normal quit: no resume offer next time. (A crash, force quit or the dev snapshot's app.exit skips this.)
app.on('before-quit', () => {
  try {
    db.setSetting('cleanExit', true)
  } catch {
    // database not open yet
  }
})
