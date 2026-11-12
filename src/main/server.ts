// LAN server for phones and tablets: serves the web UI over HTTP and pushes live state over WebSocket.
// The phone remote needs a PIN. Stage, overlay and wireless audience screens are read-only and open without one.
import { createServer, request, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { extname, join, normalize } from 'node:path'
import { randomInt, randomUUID } from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'
import type { ClientMsg, ClientRole, ServerMsg } from '@shared/ipc'
import type { ChatMessage, ItemSummary, NetStatus, RemoteCommand, Snapshot, VerseHit } from '@shared/types'

interface ServerOpts {
  /** Built renderer folder (production) or Vite dev server URL (development). */
  staticDir: string | null
  devUrl: string | null
  onCommand: (cmd: RemoteCommand) => void
  searchBible: (q: string) => { hits: VerseHit[]; abbrev: string } | null
  currentBible: () => { id: string; abbrev: string } | null
  /** The operator's UI language, sent in `welcome` so phones and screens can follow it. */
  lang: () => string
  onStatus: () => void
  /** Every chat message (from a remote or the operator), so the operator window can show it. */
  onChat: (msg: ChatMessage) => void
  /** Resolve /media/<file> to a path in the media library (null if not allowed). */
  mediaPath: (p: string) => string | null
  mediaMime: (ext: string) => string | undefined
  /** Setting "Allow control API" (HTTP commands for Stream Deck / Companion). */
  apiEnabled: () => boolean
  /** A PIN to keep across sessions (while the control API is on, so Stream Deck buttons keep working), else null. */
  fixedPin: () => string | null
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json'
}

let http: Server | null = null
let wss: WebSocketServer | null = null
let port: number | null = null
let pin = String(randomInt(0, 10000)).padStart(4, '0')
let lastError: string | undefined
let latest: Snapshot | null = null
const roles = new Map<WebSocket, ClientRole>()
let opts: ServerOpts
let chat: ChatMessage[] = [] // this sharing session only
const ROLES: ClientRole[] = ['remote', 'stage', 'overlay', 'display']

export function lanAddresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) out.push(a.address)
  }
  return out
}

export function netStatus(): NetStatus {
  const counts = { remote: 0, stage: 0, overlay: 0, display: 0 }
  for (const r of roles.values()) counts[r]++
  return {
    running: !!http,
    port,
    urls: port ? lanAddresses().map((ip) => `http://${ip}:${port}`) : [],
    pin,
    clients: counts,
    error: lastError
  }
}

function send(ws: WebSocket, msg: ServerMsg): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

export function publishSnapshot(snap: Snapshot): void {
  latest = snap
  for (const ws of roles.keys()) send(ws, { t: 'snap', snap })
}

/** Media files with HTTP Range support (iOS Safari requires it for video). */
function serveMedia(path: string, req: IncomingMessage, res: ServerResponse): void {
  const file = opts.mediaPath(path)
  if (!file || !existsSync(file)) {
    res.writeHead(404)
    res.end('Not found')
    return
  }
  const size = statSync(file).size
  const type = opts.mediaMime(extname(file).slice(1).toLowerCase()) ?? 'application/octet-stream'
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
  if (range) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2])
    let end = range[1] && range[2] ? Number(range[2]) : size - 1
    if (!range[1]) end = size - 1
    start = Math.max(0, start)
    end = Math.min(end, size - 1)
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` })
      res.end()
      return
    }
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Cache-Control': 'public, max-age=86400'
    })
    createReadStream(file, { start, end }).pipe(res)
    return
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' })
  createReadStream(file).pipe(res)
}

function json(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

/** Service items as numbered in the API: 1, 2, 3… skipping section headers. */
const apiItems = (): ItemSummary[] => (latest?.items ?? []).filter((i) => i.kind !== 'section')

function apiStatus(): unknown {
  const items = apiItems()
  const live = latest?.live ?? null
  const scratch = live && latest?.scratch?.id === live.itemId ? latest.scratch : null
  const n = live ? items.findIndex((i) => i.id === live.itemId) : -1
  const item = scratch ?? (n >= 0 ? items[n] : null)
  return {
    service: latest?.serviceName ?? null,
    live:
      live && item
        ? {
            item: n >= 0 ? n + 1 : null, // null: Scripture shown straight from the Bible tab
            itemId: item.id,
            title: item.title,
            slide: live.index + 1,
            slides: item.slides.length,
            label: item.slides[live.index]?.label ?? null
          }
        : null,
    black: !!latest?.frame.black,
    hideText: !!latest?.frame.hideText,
    items: items.map((i, k) => ({ item: k + 1, id: i.id, title: i.title, kind: i.kind, slides: i.slides.length }))
  }
}

/**
 * Control API for Stream Deck, Bitfocus Companion and clickers (off unless "Allow control API" is on):
 *   GET  /api/status                          live item and slide, black, hide text (no PIN: read-only, like stage)
 *   POST /api/<next|prev|black|hideText|clear>?pin=1234
 *   POST /api/goto?pin=1234&item=3&slide=2    item: number (1 = first, sections skipped) or item id; slide from 1
 *   POST /api/transpose?pin=1234&by=1         live song up/down by semitones (by=0: written key); item= as goto, else live
 * The PIN can also go in an "X-PIN" header. Wrong PINs count towards the same lockout as phone remotes.
 */
function serveApi(path: string, req: IncomingMessage, res: ServerResponse, ip: string): void {
  if (!opts.apiEnabled()) return json(res, 403, { error: 'The control API is off. Turn on “Allow control API” in NLPresenter.' })
  const cmd = path.slice('/api/'.length).replace(/\/$/, '')
  const q = new URL(req.url ?? '/', 'http://x').searchParams
  if (cmd === 'status') {
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Use GET' })
    return json(res, 200, apiStatus())
  }
  const simple: Record<string, RemoteCommand['type']> = { next: 'next', prev: 'prev', black: 'black', hidetext: 'hideText', clear: 'clear' }
  const known = ['goto', 'transpose'].includes(cmd.toLowerCase()) || cmd.toLowerCase() in simple
  if (!known)
    return json(res, 404, { error: `Unknown command “${cmd}”. Use next, prev, black, hideText, clear, goto, transpose or status.` })
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST' })

  const f = failures.get(ip)
  if (f && f.until > Date.now()) return json(res, 429, { error: 'Too many wrong PINs. Try again in a minute.' })
  const given = q.get('pin') ?? (req.headers['x-pin'] as string | undefined) ?? ''
  if (given !== pin) {
    const count = (f?.count ?? 0) + 1
    failures.set(ip, { count, until: count >= 8 ? Date.now() + 60_000 : 0 })
    return json(res, 403, { error: given ? 'Wrong PIN' : 'PIN required (?pin=…)' })
  }
  failures.delete(ip)

  if (cmd.toLowerCase() === 'goto') {
    const items = apiItems()
    const ref = q.get('item') ?? ''
    const item = /^\d+$/.test(ref) ? items[Number(ref) - 1] : items.find((i) => i.id === ref)
    if (!item) return json(res, 400, { error: `No item “${ref}”. Items are numbered from 1 (see /api/status).` })
    const slide = Number(q.get('slide') ?? '1')
    if (!Number.isInteger(slide) || slide < 1 || slide > item.slides.length)
      return json(res, 400, { error: `“${item.title}” has ${item.slides.length} slide${item.slides.length === 1 ? '' : 's'}.` })
    opts.onCommand({ type: 'goto', itemId: item.id, index: slide - 1 })
  } else if (cmd.toLowerCase() === 'transpose') {
    const items = apiItems()
    const ref = q.get('item')
    const item = ref ? (/^\d+$/.test(ref) ? items[Number(ref) - 1] : items.find((i) => i.id === ref)) : items.find((i) => i.id === latest?.live?.itemId)
    if (!item) return json(res, 400, { error: ref ? `No item “${ref}”. Items are numbered from 1 (see /api/status).` : 'Nothing live. Add item=…' })
    if (!item.chords) return json(res, 400, { error: `“${item.title}” is not a song with chords.` })
    const by = Number(q.get('by') ?? '1')
    if (!Number.isInteger(by) || Math.abs(by) > 11) return json(res, 400, { error: 'by must be a whole number from -11 to 11 (0 = written key).' })
    opts.onCommand({ type: 'transpose', itemId: item.id, by })
  } else opts.onCommand({ type: simple[cmd.toLowerCase()] } as RemoteCommand)
  json(res, 200, { ok: true })
}

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0])
  if (path.startsWith('/api/')) return serveApi(path, req, res, req.socket.remoteAddress ?? '?')
  if (path.startsWith('/media/')) return serveMedia(path, req, res)
  // The operator's UI language, for the phone landing page (no PIN; just a language code).
  if (path === '/lang') return json(res, 200, { lang: opts.lang() })

  // Development: forward everything to the Vite dev server.
  if (opts.devUrl) {
    const target = new URL(path + (req.url?.includes('?') ? '?' + req.url.split('?')[1] : ''), opts.devUrl)
    const proxied = request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers)
      r.pipe(res)
    })
    proxied.on('error', () => {
      res.writeHead(502)
      res.end('Dev server unavailable')
    })
    req.pipe(proxied)
    return
  }

  const root = opts.staticDir!
  const file = normalize(join(root, path === '/' ? 'index.html' : path))
  if (!file.startsWith(normalize(root)) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404)
    res.end('Not found')
    return
  }
  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600'
  })
  createReadStream(file).pipe(res)
}

const failures = new Map<string, { count: number; until: number }>() // PIN brute-force guard, per IP

function onMessage(ws: WebSocket, ip: string, raw: string): void {
  let msg: ClientMsg
  try {
    msg = JSON.parse(raw)
  } catch {
    return
  }
  if (msg.t === 'hello') {
    if (!ROLES.includes(msg.role)) return
    if (msg.role === 'remote') {
      const f = failures.get(ip)
      if (f && f.until > Date.now()) {
        send(ws, { t: 'denied', reason: 'Too many attempts. Try again in a minute.', code: 'locked' })
        return
      }
      if (msg.pin !== pin) {
        if (msg.pin) {
          const count = (f?.count ?? 0) + 1
          failures.set(ip, { count, until: count >= 8 ? Date.now() + 60_000 : 0 })
        }
        send(ws, { t: 'denied', reason: msg.pin ? 'Wrong PIN' : 'PIN required', code: msg.pin ? 'wrong' : 'required' })
        return
      }
      failures.delete(ip)
    }
    roles.set(ws, msg.role)
    send(ws, { t: 'welcome', role: msg.role, bible: opts.currentBible(), chat: msg.role === 'remote' ? chat : undefined, lang: opts.lang() })
    if (latest) send(ws, { t: 'snap', snap: { ...latest, serverTime: Date.now() } })
    opts.onStatus()
    return
  }
  if (roles.get(ws) !== 'remote') return // only an authenticated remote can control or search
  if (msg.t === 'cmd') opts.onCommand(msg.cmd)
  if (msg.t === 'bible-search') {
    const r = opts.searchBible(msg.q)
    send(ws, { t: 'bible-results', reqId: msg.reqId, hits: r?.hits.slice(0, 60) ?? [], abbrev: r?.abbrev ?? '' })
  }
  if (msg.t === 'chat') addChat('remote', String(msg.name ?? ''), String(msg.text ?? ''))
}

/** Store a chat message and deliver it to every remote and the operator. */
export function addChat(from: ChatMessage['from'], name: string, text: string): ChatMessage | null {
  const body = text.trim().slice(0, 500)
  if (!body || !http) return null
  const msg: ChatMessage = {
    id: randomUUID(),
    from,
    name: name.trim().slice(0, 30) || (from === 'operator' ? 'Operator' : 'Remote'),
    text: body,
    at: Date.now()
  }
  chat = [...chat.slice(-99), msg]
  for (const [ws, role] of roles) if (role === 'remote') send(ws, { t: 'chat', msg })
  opts.onChat(msg)
  return msg
}

export function chatLog(): ChatMessage[] {
  return chat
}

export function startServer(o: ServerOpts, preferredPort = 4777): Promise<NetStatus> {
  opts = o
  if (http) return Promise.resolve(netStatus())
  lastError = undefined
  const fixed = o.fixedPin()
  if (fixed && /^\d{4}$/.test(fixed)) pin = fixed
  return new Promise((resolve) => {
    const tryPort = (p: number, attemptsLeft: number): void => {
      const srv = createServer(serveStatic)
      srv.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && attemptsLeft > 0) return tryPort(p + 1, attemptsLeft - 1)
        lastError = err.message
        resolve(netStatus())
      })
      srv.listen(p, '0.0.0.0', () => {
        http = srv
        port = p
        wss = new WebSocketServer({ server: srv, path: '/ws' })
        wss.on('connection', (ws, req) => {
          const ip = req.socket.remoteAddress ?? '?'
          ws.on('message', (data) => onMessage(ws, ip, data.toString()))
          ws.on('close', () => {
            roles.delete(ws)
            opts.onStatus()
          })
        })
        opts.onStatus()
        resolve(netStatus())
      })
    }
    tryPort(preferredPort, 10)
  })
}

export function stopServer(): NetStatus {
  for (const ws of roles.keys()) ws.terminate()
  roles.clear()
  wss?.close()
  http?.close()
  http = null
  wss = null
  port = null
  pin = String(randomInt(0, 10000)).padStart(4, '0') // new PIN each session
  chat = []
  opts?.onStatus()
  return netStatus()
}
