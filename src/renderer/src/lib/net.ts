// Browser-side connection to the NLPresenter LAN server (phones, tablets, wireless stage screens).
import { useEffect, useRef, useState } from 'react'
import type { ClientMsg, ClientRole, ServerMsg } from '@shared/ipc'
import type { ChatMessage, Snapshot, VerseHit } from '@shared/types'
import { adoptOperatorLang } from '@/i18n'

export type ConnState = 'connecting' | 'pin' | 'connected' | 'offline'

interface Conn {
  state: ConnState
  error: string | null
  /** Why the PIN was refused, for a message in this device's language. */
  deniedCode: 'wrong' | 'required' | 'locked' | null
  snap: Snapshot | null
  offset: number // server clock − local clock
  bible: { id: string; abbrev: string } | null
  send: (msg: ClientMsg) => void
  submitPin: (pin: string) => void
  search: (q: string) => Promise<{ hits: VerseHit[]; abbrev: string }>
  chat: ChatMessage[]
  sendChat: (text: string, name: string) => void
}

const PIN_KEY = 'nl-remote-pin'

export function useLanConnection(role: ClientRole): Conn {
  const [state, setState] = useState<ConnState>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [deniedCode, setDeniedCode] = useState<Conn['deniedCode']>(null)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [offset, setOffset] = useState(0)
  const [bible, setBible] = useState<Conn['bible']>(null)
  const [chat, setChat] = useState<ChatMessage[]>([])
  const ws = useRef<WebSocket | null>(null)
  const pinRef = useRef<string | undefined>(role === 'remote' ? localStorage.getItem(PIN_KEY) ?? undefined : undefined)
  const pending = useRef(new Map<number, (r: { hits: VerseHit[]; abbrev: string }) => void>())
  const reqId = useRef(0)

  useEffect(() => {
    let closed = false
    let retry: ReturnType<typeof setTimeout>

    const connect = (): void => {
      const sock = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
      ws.current = sock
      sock.onopen = () => {
        if (role === 'remote' && !pinRef.current) {
          setState('pin')
          return
        }
        sock.send(JSON.stringify({ t: 'hello', role, pin: pinRef.current } satisfies ClientMsg))
      }
      sock.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as ServerMsg
        if (msg.t === 'welcome') {
          setState('connected')
          setError(null)
          setDeniedCode(null)
          adoptOperatorLang(msg.lang)
          setBible(msg.bible)
          if (msg.chat) setChat(msg.chat)
          if (pinRef.current) localStorage.setItem(PIN_KEY, pinRef.current)
        } else if (msg.t === 'denied') {
          pinRef.current = undefined
          localStorage.removeItem(PIN_KEY)
          setError(msg.reason)
          setDeniedCode(msg.code ?? null)
          setState('pin')
        } else if (msg.t === 'snap') {
          setOffset(msg.snap.serverTime - Date.now())
          adoptOperatorLang(msg.snap.lang)
          setSnap(msg.snap)
        } else if (msg.t === 'chat') {
          setChat((c) => (c.some((m) => m.id === msg.msg.id) ? c : [...c.slice(-99), msg.msg]))
        } else if (msg.t === 'bible-results') {
          pending.current.get(msg.reqId)?.({ hits: msg.hits, abbrev: msg.abbrev })
          pending.current.delete(msg.reqId)
        }
      }
      sock.onclose = () => {
        if (closed) return
        setState((s) => (s === 'pin' ? s : 'offline'))
        retry = setTimeout(connect, 1500)
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      ws.current?.close()
    }
  }, [role])

  const send = (msg: ClientMsg): void => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg))
  }

  return {
    state,
    error,
    deniedCode,
    snap,
    offset,
    bible,
    send,
    submitPin: (pin) => {
      pinRef.current = pin
      setError(null)
      setState('connecting')
      send({ t: 'hello', role, pin })
    },
    chat,
    sendChat: (text, name) => send({ t: 'chat', text, name }),
    search: (q) =>
      new Promise((resolve) => {
        const id = ++reqId.current
        pending.current.set(id, resolve)
        send({ t: 'bible-search', q, reqId: id })
        setTimeout(() => {
          if (pending.current.delete(id)) resolve({ hits: [], abbrev: '' })
        }, 5000)
      })
  }
}
