import { useEffect, useRef, useState } from 'react'
import { formatTime, t, useT } from '@/i18n'
import LangPicker from '@/i18n/LangPicker'
import { BookOpen, Check, ChevronLeft, ChevronRight, EyeOff, Guitar, LayoutGrid, ListOrdered, Loader2, MessageCircle, Minus, Plus, RotateCcw, Search, Send, Square, Star, X } from 'lucide-react'
import type { ChatMessage, ItemSummary, Slide, Snapshot, VerseHit } from '@shared/types'
import SlideView from '@/components/SlideView'
import { useLanConnection } from '@/lib/net'
import { useWakeLock } from './StageApp'
import { uid } from '@/lib/defaults'
import { BrandLockup } from '@/components/BrandMark'
import { transposeKey } from '@shared/chords'
import { tempoLabel } from '@shared/tempo'

type View = 'flow' | 'slides' | 'bible' | 'chat'
const NAME_KEY = 'nl-remote-name'

/** Phone/tablet remote control, served by the desktop app over the local network. */
export default function RemoteApp() {
  const conn = useLanConnection('remote')
  useT() // re-render when the language changes (operator's arrives with the welcome message)
  const [view, setView] = useState<View>('flow')
  useWakeLock()
  // Unread operator messages, shown as a dot on the Chat tab.
  const [seen, setSeen] = useState(0)
  const fromOperator = conn.chat.filter((m) => m.from === 'operator').length
  useEffect(() => {
    if (view === 'chat') setSeen(fromOperator)
  }, [view, fromOperator])
  const unread = view !== 'chat' && fromOperator > seen

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', '#12151c')
  }, [])

  if (conn.state === 'pin')
    return <PinScreen error={conn.deniedCode ? t(`remote.pin.${conn.deniedCode}`) : conn.error} onSubmit={conn.submitPin} />
  if (!conn.snap)
    return (
      <div className="grid h-[100dvh] place-items-center text-sm text-muted">
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> {conn.state === 'offline' ? t('common.reconnecting') : t('common.connecting')}
        </div>
      </div>
    )

  const snap = conn.snap
  const cmd = conn.send
  const f = snap.frame
  const liveItem = findItem(snap, snap.live?.itemId)

  return (
    <div className="flex h-[100dvh] flex-col bg-bg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-4">
        <span className="min-w-0 truncate text-[15px] font-semibold">{snap.serviceName}</span>
        <span
          className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            conn.state === 'connected' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-live/15 text-live'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${conn.state === 'connected' ? 'bg-emerald-400' : 'bg-live'}`} />
          {conn.state === 'connected' ? t('remote.status.connected') : t('remote.status.reconnecting')}
        </span>
      </header>

      <div className="shrink-0 p-3 pb-2">
        <div className="relative">
          <SlideView
            slide={f.slide}
            background={f.background}
            style={f.style}
            aspect={f.aspect}
            hideText={f.hideText}
            black={f.black}
            countdown={f.countdown}
            logo={f.logo}
            ticker={f.ticker}
            clockOffset={conn.offset}
            className={`${f.aspect === '16:9' ? 'aspect-video' : 'aspect-[4/3]'} w-full rounded-lg ring-1 ring-line`}
          />
          {snap.live && (
            <span className="absolute left-2 top-2 rounded bg-live px-1.5 py-px text-[10px] font-bold uppercase text-white">{t('remote.live')}</span>
          )}
          {f.slide?.label && (
            <span
              className="absolute right-2 top-2 rounded bg-black/60 px-1.5 text-[11px] font-semibold uppercase text-accent-text"
              style={{ color: findItem(snap, snap.live?.itemId)?.slides[snap.live?.index ?? -1]?.labelColor }}
            >
              {f.slide.label}
            </span>
          )}
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 gap-1 px-3">
        {(
          [
            ['flow', ListOrdered],
            ['slides', LayoutGrid],
            ['bible', BookOpen],
            ['chat', MessageCircle]
          ] as const
        ).map(([id, Icon]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`relative flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-1 text-[13px] font-semibold ${
              view === id ? 'bg-accent-fill text-on-accent' : 'text-muted'
            }`}
          >
            <Icon size={16} className="shrink-0" /> <span className="truncate">{t(`remote.tab.${id}`)}</span>
            {id === 'chat' && unread && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-live" />}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" style={{ WebkitOverflowScrolling: 'touch' }}>
        {view === 'flow' && <FlowView snap={snap} onGo={(itemId) => cmd({ t: 'cmd', cmd: { type: 'goto', itemId, index: 0 } })} />}
        {view === 'slides' && (
          <SlidesView
            item={liveItem ?? snap.items.find((i) => i.slides.length) ?? null}
            liveIndex={liveItem ? snap.live!.index : -1}
            snap={snap}
            onGo={(itemId, index) => cmd({ t: 'cmd', cmd: { type: 'goto', itemId, index } })}
            onTranspose={(itemId, by) => cmd({ t: 'cmd', cmd: { type: 'transpose', itemId, by } })}
          />
        )}
        {view === 'bible' && (
          <BibleView
            search={conn.search}
            pins={snap.pins ?? []}
            onPin={(id) => cmd({ t: 'cmd', cmd: { type: 'pin', id } })}
            onShow={(title, slides, index) => cmd({ t: 'cmd', cmd: { type: 'scripture', title, slides, index } })}
          />
        )}
        {view === 'chat' && <ChatView messages={conn.chat} quick={snap.quickChat ?? []} onSend={conn.sendChat} />}
      </div>

      <div
        className="grid shrink-0 grid-cols-4 gap-2 border-t border-line bg-panel px-3 pt-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <Ctl onClick={() => cmd({ t: 'cmd', cmd: { type: 'prev' } })} tone="accent" label={t('common.previous')}>
          <ChevronLeft size={26} />
        </Ctl>
        <Ctl onClick={() => cmd({ t: 'cmd', cmd: { type: 'hideText' } })} tone="amber" active={f.hideText} label={t('remote.ctl.hideText')}>
          <EyeOff size={21} />
        </Ctl>
        <Ctl onClick={() => cmd({ t: 'cmd', cmd: { type: 'black' } })} tone="amber" active={f.black} label={t('remote.ctl.black')}>
          <Square size={19} fill="currentColor" />
        </Ctl>
        <Ctl onClick={() => cmd({ t: 'cmd', cmd: { type: 'next' } })} tone="accent" label={t('common.next')}>
          <ChevronRight size={26} />
        </Ctl>
      </div>
    </div>
  )
}

const findItem = (snap: Snapshot, id?: string): ItemSummary | null =>
  !id ? null : snap.scratch?.id === id ? snap.scratch : snap.items.find((i) => i.id === id) ?? null

function FlowView({ snap, onGo }: { snap: Snapshot; onGo: (itemId: string) => void }) {
  const { t, tn } = useT()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="label-caps px-1 py-1">{t('remote.flow.title', { n: snap.items.filter((it) => it.kind !== 'section').length })}</div>
      {snap.items.map((it) => {
        if (it.kind === 'section')
          return (
            <div
              key={it.id}
              className="mt-3 flex items-center gap-2 px-1 text-[12px] font-bold uppercase tracking-wider first:mt-0"
              style={{ color: it.color ?? '#7c6cff' }}
            >
              <span className="h-3 w-1 rounded-full" style={{ background: it.color ?? '#7c6cff' }} />
              {it.title}
            </div>
          )
        const num = snap.items.slice(0, snap.items.indexOf(it) + 1).filter((x) => x.kind !== 'section').length
        const live = snap.live?.itemId === it.id
        return (
          <button
            key={it.id}
            onClick={() => it.slides.length && onGo(it.id)}
            className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left ${
              live ? 'border-accent bg-accent-soft' : 'border-line bg-panel'
            }`}
          >
            <span className="w-5 text-right text-[12px] text-dim">{num}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{it.title}</span>
              <span className="text-[12px] text-dim">
                {t(`remote.kind.${it.kind}`)} · {tn('remote.flow.slides', it.slides.length)}
              </span>
            </span>
            {live && <span className="shrink-0 rounded bg-live px-1.5 text-[10px] font-bold uppercase text-white">{t('remote.live')}</span>}
          </button>
        )
      })}
    </div>
  )
}

function SlidesView({
  item,
  liveIndex,
  snap,
  onGo,
  onTranspose
}: {
  item: ItemSummary | null
  liveIndex: number
  snap: Snapshot
  onGo: (itemId: string, index: number) => void
  onTranspose: (itemId: string, by: number) => void
}) {
  const liveRef = useRef<HTMLButtonElement>(null)
  const { t } = useT()
  useEffect(() => {
    liveRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [liveIndex, item?.id])
  if (!item) return <div className="p-6 text-center text-[13px] text-muted">{t('remote.slides.empty')}</div>
  return (
    <div>
      <div className="label-caps px-1 py-1">{item.title}</div>
      {item.chords && <TransposeBar chords={item.chords} onTranspose={(by) => onTranspose(item.id, by)} />}
      <div className="grid grid-cols-2 gap-2">
        {item.slides.map((sl, i) => (
          <button
            key={i}
            ref={i === liveIndex ? liveRef : undefined}
            onClick={() => onGo(item.id, i)}
            className={`relative rounded-lg ring-2 ${i === liveIndex ? 'ring-live' : 'ring-transparent'}`}
          >
            <SlideView
              slide={{ id: String(i), ...sl }}
              background={
                sl.image ? { kind: 'image', src: sl.image, fit: 'contain' } : sl.video ? { kind: 'video', src: sl.video } : snap.frame.background
              }
              style={snap.frame.style}
              aspect={snap.frame.aspect}
              thumbnail
              className={`${snap.frame.aspect === '16:9' ? 'aspect-video' : 'aspect-[4/3]'} w-full rounded-lg`}
            />
            <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1 text-[10px] text-white/90">{i + 1}</span>
            {sl.label && (
              <span
                className="absolute right-1.5 top-1.5 max-w-[70%] truncate rounded bg-accent-fill px-1 text-[9px] font-bold uppercase text-on-accent"
                style={sl.labelColor ? { background: sl.labelColor } : undefined}
              >
                {sl.label}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Live transpose for the song shown (this service only; changes the chords on stage screens). */
function TransposeBar({ chords, onTranspose }: { chords: NonNullable<ItemSummary['chords']>; onTranspose: (by: number) => void }) {
  const { t } = useT()
  const semis = chords.transpose
  const played = transposeKey(chords.key, semis)
  const btn = 'grid h-10 w-11 shrink-0 place-items-center rounded-lg bg-panel-2 text-fg active:bg-accent-soft disabled:opacity-30'
  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-panel px-2 py-1.5">
      <Guitar size={16} className="ml-1 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate text-[14px]">
        {played ? t('remote.transpose.key', { key: played }) : t('remote.transpose.title')}
        {semis !== 0 && (
          <span className="ml-1.5 text-[12px] text-amber-400">
            {semis > 0 ? '+' : ''}
            {semis}
            {chords.key ? ` · ${t('remote.transpose.written', { key: chords.key })}` : ''}
          </span>
        )}
        {chords.bpm ? <span className="block truncate text-[12px] text-muted">{tempoLabel(chords.bpm, chords.time)}</span> : null}
      </span>
      <button onClick={() => onTranspose(0)} disabled={semis === 0} className={btn} title={t('remote.transpose.reset')} aria-label={t('remote.transpose.reset')}>
        <RotateCcw size={16} />
      </button>
      <button onClick={() => onTranspose(-1)} className={btn} title={t('remote.transpose.down')} aria-label={t('remote.transpose.down')}>
        <Minus size={18} />
      </button>
      <button onClick={() => onTranspose(1)} className={btn} title={t('remote.transpose.up')} aria-label={t('remote.transpose.up')}>
        <Plus size={18} />
      </button>
    </div>
  )
}

function BibleView({
  search,
  pins,
  onPin,
  onShow
}: {
  search: (q: string) => Promise<{ hits: VerseHit[]; abbrev: string }>
  pins: { id: string; title: string }[]
  onPin: (id: string) => void
  onShow: (title: string, slides: Slide[], index: number) => void
}) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<{ hits: VerseHit[]; abbrev: string } | null>(null)
  const { t, tn } = useT()

  const run = async (): Promise<void> => {
    if (!q.trim()) return
    setBusy(true)
    setRes(await search(q))
    setBusy(false)
  }

  const slidesOf = (hits: VerseHit[], abbrev: string): Slide[] =>
    hits.map((h) => ({ id: uid(), label: h.label, reference: `${h.label} (${abbrev})`, text: h.text }))

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ;(document.activeElement as HTMLElement)?.blur()
          run()
        }}
        className="flex items-center gap-2 rounded-xl bg-panel-2 px-3"
      >
        <Search size={16} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('remote.bible.placeholder')}
          enterKeyHint="search"
          className="h-11 flex-1 bg-transparent text-[16px] outline-none placeholder:text-dim"
        />
        {busy ? (
          <Loader2 size={16} className="animate-spin text-muted" />
        ) : (
          q && (
            <button type="button" onClick={() => (setQ(''), setRes(null))} className="text-muted">
              <X size={16} />
            </button>
          )
        )}
      </form>
      {!res && pins.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="label-caps flex items-center gap-1.5 px-1 pt-1">
            <Star size={12} className="shrink-0 fill-current text-amber-400" /> {t('remote.bible.pinned')}
          </div>
          {pins.map((p) => (
            <button
              key={p.id}
              onClick={() => onPin(p.id)}
              className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-3 text-left active:bg-accent-soft"
            >
              <BookOpen size={15} className="shrink-0 text-accent-text" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.title}</span>
            </button>
          ))}
        </div>
      )}
      {res && res.hits.length > 1 && (
        <button
          onClick={() => onShow(rangeTitle(res.hits, res.abbrev), slidesOf(res.hits, res.abbrev), 0)}
          className="rounded-xl bg-accent-fill py-2.5 text-[14px] font-semibold text-on-accent"
        >
          {tn('remote.bible.showAll', res.hits.length)}
        </button>
      )}
      {res?.hits.length === 0 && <div className="p-4 text-center text-[13px] text-muted">{t('remote.bible.none')}</div>}
      {res?.hits.map((h, i) => (
        <button
          key={`${h.book}-${h.chapter}-${h.verse}`}
          onClick={() => onShow(rangeTitle(res.hits, res.abbrev), slidesOf(res.hits, res.abbrev), i)}
          className="rounded-xl border border-line bg-panel px-3 py-2.5 text-left"
        >
          <div className="text-[12px] font-semibold text-accent-text">{h.label}</div>
          <div className="text-[14px] leading-snug text-fg/90">{h.text}</div>
        </button>
      ))}
    </div>
  )
}

function ChatView({
  messages,
  quick,
  onSend
}: {
  messages: ChatMessage[]
  quick: string[]
  onSend: (text: string, name: string) => void
}) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '')
  const [text, setText] = useState('')
  // The quick message just sent: shows a tick on its button for a moment.
  const [sent, setSent] = useState<number | null>(null)
  const sentTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const end = useRef<HTMLDivElement>(null)
  const { t } = useT()
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])
  useEffect(() => () => clearTimeout(sentTimer.current), [])

  const sendQuick = (i: number): void => {
    onSend(quick[i], name)
    setSent(i)
    clearTimeout(sentTimer.current)
    sentTimer.current = setTimeout(() => setSent(null), 1200)
  }

  const submit = (): void => {
    if (!text.trim()) return
    onSend(text, name)
    setText('')
  }

  return (
    <div className="flex min-h-full flex-col gap-2">
      <input
        value={name}
        onChange={(e) => {
          setName(e.target.value.slice(0, 30))
          localStorage.setItem(NAME_KEY, e.target.value.slice(0, 30))
        }}
        placeholder={t('remote.chat.namePlaceholder')}
        className="h-10 rounded-xl bg-panel-2 px-3 text-[15px] outline-none placeholder:text-dim"
      />
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('remote.chat.quick')}>
          {quick.map((q, i) => (
            <button
              key={`${i}-${q}`}
              type="button"
              onClick={() => sendQuick(i)}
              className={`flex min-h-10 items-center gap-1.5 rounded-xl border px-3.5 text-[15px] font-medium active:scale-[0.97] ${
                sent === i ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-line bg-panel-2 text-fg active:bg-panel-3'
              }`}
            >
              {sent === i && <Check size={15} aria-hidden />}
              {q}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 py-1">
        {messages.length === 0 && (
          <div className="p-6 text-center text-[13px] text-muted">{t('remote.chat.empty')}</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.from === 'remote' ? 'items-end' : 'items-start'}`}>
            <span className="px-1 text-[11px] text-dim">
              {m.name} · {formatTime(m.at)}
            </span>
            <span
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[15px] ${
                m.from === 'remote' ? 'bg-accent-fill text-on-accent' : 'bg-amber-400 text-black'
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="sticky bottom-0 flex gap-2 bg-bg pb-1"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          placeholder={t('remote.chat.placeholder')}
          enterKeyHint="send"
          className="h-11 min-w-0 flex-1 rounded-xl bg-panel-2 px-3 text-[16px] outline-none placeholder:text-dim"
        />
        <button disabled={!text.trim()} aria-label={t('remote.chat.send')} className="grid h-11 w-11 place-items-center rounded-xl bg-accent-fill text-on-accent disabled:opacity-40">
          <Send size={17} />
        </button>
      </form>
    </div>
  )
}

function rangeTitle(hits: VerseHit[], abbrev: string): string {
  if (hits.length === 1) return `${hits[0].label} (${abbrev})`
  const a = hits[0]
  const b = hits[hits.length - 1]
  const sameChapter = hits.every((h) => h.book === a.book && h.chapter === a.chapter)
  return sameChapter ? `${a.label}–${b.verse} (${abbrev})` : t('remote.bible.results', { abbrev })
}

function Ctl({
  children,
  onClick,
  tone,
  active,
  label
}: {
  children: React.ReactNode
  onClick: () => void
  tone: 'accent' | 'amber'
  active?: boolean
  label: string
}) {
  const base =
    tone === 'accent'
      ? 'border-accent/70 text-accent-text active:bg-accent active:text-white'
      : active
        ? 'border-amber-400 bg-amber-400 text-black'
        : 'border-amber-400/70 text-amber-300 active:bg-amber-400/20'
  return (
    <button aria-label={label} onClick={onClick} className={`grid h-14 place-items-center rounded-xl border-2 ${base}`}>
      {children}
    </button>
  )
}

function PinScreen({ error, onSubmit }: { error: string | null; onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState('')
  const { t } = useT()
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-5 px-8">
      <BrandLockup size={52} />
      <div className="text-center">
        <div className="text-[18px] font-semibold">{t('remote.pin.title')}</div>
        <div className="mt-1 text-[13px] text-muted">{t('remote.pin.prompt')}</div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (pin.length === 4) onSubmit(pin)
        }}
        className="flex w-full max-w-xs flex-col gap-3"
      >
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          autoFocus
          placeholder="••••"
          className="h-14 rounded-xl bg-panel-2 text-center text-[28px] font-semibold tracking-[0.5em] outline-none ring-accent focus:ring-2"
        />
        {error && <div className="text-center text-[13px] text-live">{error}</div>}
        <button disabled={pin.length !== 4} className="h-12 rounded-xl bg-accent-fill text-[15px] font-semibold text-on-accent disabled:opacity-40">
          {t('remote.pin.connect')}
        </button>
        <LangPicker className="mt-2" />
      </form>
    </div>
  )
}
