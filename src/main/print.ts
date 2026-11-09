// Print sheets (run sheet, lyrics, chord charts). The renderer builds a self-contained HTML page; it is
// loaded here in a hidden window with scripts off, then saved as PDF or sent to a printer.
import { app, BrowserWindow, dialog } from 'electron'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tm } from './i18n'

async function withPage<T>(html: string, fn: (win: BrowserWindow) => Promise<T>): Promise<T> {
  // A temp file, not a data: URL (long services would hit the URL size limit).
  const file = join(app.getPath('temp'), `nlpresenter-print-${Date.now().toString(36)}.html`)
  await writeFile(file, html, 'utf8')
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: { sandbox: true, contextIsolation: true, javascript: false }
  })
  try {
    await win.loadFile(file)
    return await fn(win)
  } finally {
    if (!win.isDestroyed()) win.destroy()
    rm(file, { force: true }).catch(() => {})
  }
}

const safeName = (s: string): string => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 120) || 'Service'

/** Save as PDF. Without `path`, asks where with a save dialog. Returns the saved path, or null if cancelled. */
export async function printToPdf(parent: BrowserWindow | null, html: string, name: string, path?: string): Promise<string | null> {
  let target = path
  if (!target) {
    const opts = {
      title: tm('main.dlg.savePdf'),
      defaultPath: join(app.getPath('documents'), `${safeName(name)}.pdf`),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    }
    const pick = parent ? await dialog.showSaveDialog(parent, opts) : await dialog.showSaveDialog(opts)
    if (pick.canceled || !pick.filePath) return null
    target = pick.filePath
  }
  const pdf = await withPage(html, (win) =>
    win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false })
  )
  await writeFile(target, pdf)
  return target
}

/** Open the system print dialog for the page. Resolves true when it was printed. */
export function printHtml(html: string): Promise<boolean> {
  return withPage(
    html,
    (win) =>
      new Promise<boolean>((resolve) => {
        win.webContents.print({ printBackground: true }, (ok) => resolve(ok))
      })
  )
}
