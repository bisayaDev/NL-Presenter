import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import type { ChatMessage } from '@shared/types'
import { useNetStatus } from './NetworkPanel'
import { useModal } from '@/lib/modal'
import { formatTime, useT } from '@/i18n'

/** Chat with people on phone remotes (pastor, worship leader). Shows an unread badge and a toast. */
export default function ChatButton() {
  const net = useNetStatus()
  const { t } = useT()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [open, setOpen] = useState(false)
  useModal(open, () => setOpen(false))
  const [unread, setUnread] = useState(0)
  const [toast, setToast] = useState<ChatMessage | null>(null)
  const [text, setText] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const openRef = useRef(open)
  openRef.current = open

  useEffect(() => {
    window.nl.chat.list().then(setMessages)
    let t: ReturnType<typeof setTimeout>
    const off = window.nl.chat.onMessage((m) => {
      setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list.slice(-99), m]))
      if (m.from === 'remote' && !openRef.current) {
        setUnread((n) => n + 1)
        setToast(m)
        clearTimeout(t)
        t = setTimeout(() => setToast(null), 6000)
      }
    })
    return () => {
      off()
      clearTimeout(t)
    }
  }, [])

  // A new sharing session starts with an empty chat.
  useEffect(() => {
    if (net && !net.running) {
      setMessages([])
      setUnread(0)
    }
  }, [net?.running])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setToast(null)
      end.current?.scrollIntoView({ block: 'end' })
    }
  }, [open, messages.length])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const send = async (): Promise<void> => {
    if (!text.trim()) return
    await window.nl.chat.send(text)
    setText('')
  }

  return (
    <div ref={ref} className="no-drag relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative rounded-md p-1.5 ${open ? 'text-accent-text' : 'text-muted hover:bg-panel-2 hover:text-fg'}`}
        title={t('network.chat.button')}
      >
        <MessageCircle size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-live px-1 text-[9.5px] font-bold text-white">{unread}</span>
        )}
      </button>

      {toast && !open && (
        <button
          onClick={() => setOpen(true)}
          className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-amber-400/40 bg-panel-2 p-3 text-left shadow-2xl"
        >
          <div className="text-[11px] font-semibold text-amber-300">{toast.name}</div>
          <div className="line-clamp-3 text-[13px]">{toast.text}</div>
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 flex h-[420px] w-[360px] flex-col rounded-lg border border-line bg-panel-2 shadow-2xl">
          <div className="label-caps px-4 pb-2 pt-3">{t('network.chat.title')}</div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3">
            {!net?.running ? (
              <p className="p-4 text-center text-[12.5px] text-muted">{t('network.chat.notRunning')}</p>
            ) : messages.length === 0 ? (
              <p className="p-4 text-center text-[12.5px] text-muted">{t('network.chat.empty')}</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`mb-2 flex flex-col ${m.from === 'operator' ? 'items-end' : 'items-start'}`}>
                  <span className="px-1 text-[10.5px] text-dim">
                    {m.name} · {formatTime(m.at)}
                  </span>
                  <span
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-[13px] select-text ${
                      m.from === 'operator' ? 'bg-accent-fill text-on-accent' : 'bg-amber-400 text-black'
                    }`}
                  >
                    {m.text}
                  </span>
                </div>
              ))
            )}
            <div ref={end} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex gap-2 border-t border-line p-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              disabled={!net?.running}
              placeholder={t('network.chat.placeholder')}
              className="h-9 min-w-0 flex-1 rounded-md bg-panel px-3 text-[13px] outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50"
            />
            <button disabled={!text.trim() || !net?.running} aria-label={t('network.chat.send')} className="grid h-9 w-9 place-items-center rounded-md bg-accent-fill text-on-accent disabled:opacity-40">
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
