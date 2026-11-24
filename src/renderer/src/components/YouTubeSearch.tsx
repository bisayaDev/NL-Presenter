import { useEffect, useRef, useState } from 'react'
import { Check, KeyRound, Loader2, Play, Plus, Search } from 'lucide-react'
import type { YouTubeHit, YouTubeSearch as Result } from '@shared/types'
import { formatTime, usePlayer, ytId } from '@/store/usePlayer'
import { useT } from '@/i18n'

const KEY_HELP = 'https://developers.google.com/youtube/v3/getting-started'

type ErrorKind = Extract<Result, { ok: false }>['error']

/** Music window → search YouTube and add videos to the playlist (they play in YouTube's embedded player). */
export default function YouTubeSearch() {
  const { t } = useT()
  const [key, setKey] = useState<{ saved: boolean; hint: string } | null>(null)
  const [editingKey, setEditingKey] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [hits, setHits] = useState<YouTubeHit[] | null>(null)
  const [error, setError] = useState<ErrorKind | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.nl.youtube.keyStatus().then(setKey)
  }, [])
  useEffect(() => {
    if (key?.saved && !editingKey) input.current?.focus()
  }, [key?.saved, editingKey])

  const run = async (): Promise<void> => {
    if (!q.trim() || busy) return
    setBusy(true)
    setError(null)
    const r = await window.nl.youtube.search(q)
    setBusy(false)
    if (r.ok) setHits(r.hits)
    else {
      setHits(null)
      setError(r.error)
      if (r.error === 'noKey') setKey({ saved: false, hint: '' })
    }
  }

  if (!key) return null
  if (!key.saved || editingKey)
    return (
      <KeySetup
        canCancel={key.saved}
        onCancel={() => setEditingKey(false)}
        onSaved={(hint) => {
          setKey({ saved: true, hint })
          setEditingKey(false)
          setError(null)
        }}
      />
    )

  return (
    <div className="flex min-h-0 shrink-0 flex-col border-y border-line bg-panel">
      <form
        className="flex items-center gap-1.5 px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
      >
        <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md bg-panel-3 px-2 focus-within:ring-1 focus-within:ring-accent/50">
          <Search size={13} className="shrink-0 text-dim" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('topbar.player.yt.placeholder')}
            aria-label={t('topbar.player.yt.search')}
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-dim"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="h-7 shrink-0 rounded-md bg-accent-fill px-2.5 text-[12px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : t('topbar.player.yt.search')}
        </button>
      </form>

      {error && error !== 'noKey' && (
        <p className="px-3 pb-2 text-[11.5px] leading-snug text-amber-300">
          {t(`topbar.player.yt.err.${error}`)}{' '}
          {error === 'badKey' && (
            <button onClick={() => setEditingKey(true)} className="underline hover:text-fg">
              {t('topbar.player.yt.changeKey')}
            </button>
          )}
        </p>
      )}

      <div className="max-h-56 overflow-y-auto px-1 pb-1">
        {busy && !hits && <div className="px-2 py-2 text-[11.5px] text-dim">{t('topbar.player.yt.searching')}</div>}
        {hits?.length === 0 && <div className="px-2 py-2 text-[11.5px] text-dim">{t('topbar.player.yt.noResults')}</div>}
        {hits?.map((h) => (
          <Hit key={h.videoId} hit={h} />
        ))}
      </div>

      <div className="flex items-center gap-1.5 border-t border-line px-3 py-1 text-[10.5px] text-dim">
        <KeyRound size={11} className="shrink-0" />
        <span className="truncate">{t('topbar.player.yt.keySaved', { hint: key.hint })}</span>
        <span className="flex-1" />
        <button onClick={() => setEditingKey(true)} className="shrink-0 hover:text-fg">
          {t('topbar.player.yt.changeKey')}
        </button>
      </div>
    </div>
  )
}

function Hit({ hit }: { hit: YouTubeHit }) {
  const { t } = useT()
  const inList = usePlayer((s) => s.playlist.includes(ytId(hit.videoId)))
  const addYouTube = usePlayer((s) => s.addYouTube)
  return (
    <div className="group flex items-center gap-2 rounded px-1.5 py-1 hover:bg-panel-3">
      <button onClick={() => addYouTube([hit], true)} title={t('topbar.player.yt.playNow')} className="relative h-[34px] w-[60px] shrink-0 overflow-hidden rounded bg-black">
        {hit.thumb && <img src={hit.thumb} alt="" className="h-full w-full object-cover" draggable={false} />}
        <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 group-hover:opacity-100">
          <Play size={14} fill="currentColor" className="text-white" />
        </span>
        {!!hit.duration && (
          <span className="absolute bottom-0 right-0 rounded-tl bg-black/75 px-1 text-[9.5px] tabular-nums text-white">{formatTime(hit.duration)}</span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[11.5px] leading-tight text-fg/90" title={hit.title}>
          {hit.title}
        </div>
        <div className="truncate text-[10.5px] text-dim">{hit.channel}</div>
      </div>
      <button
        onClick={() => addYouTube([hit])}
        disabled={inList}
        title={inList ? t('topbar.player.yt.inList') : t('topbar.player.yt.add')}
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:bg-panel-2 hover:text-accent-text disabled:text-accent-text"
      >
        {inList ? <Check size={13} /> : <Plus size={14} />}
      </button>
    </div>
  )
}

/** First use (or a refused key): paste the YouTube Data API key. */
function KeySetup({ canCancel, onCancel, onSaved }: { canCancel: boolean; onCancel: () => void; onSaved: (hint: string) => void }) {
  const { t } = useT()
  const [value, setValue] = useState('')
  const save = async (): Promise<void> => {
    const k = value.trim()
    if (!k) return
    await window.nl.youtube.setKey(k)
    onSaved(k.slice(-4))
  }
  return (
    <div className="flex shrink-0 flex-col gap-2 border-y border-line bg-panel px-3 py-2.5">
      <p className="text-[11.5px] leading-snug text-muted">{t('topbar.player.yt.keyNeeded')}</p>
      <a href={KEY_HELP} target="_blank" rel="noreferrer" className="w-fit text-[11.5px] text-accent-text underline hover:brightness-110">
        {t('topbar.player.yt.getKey')}
      </a>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('topbar.player.yt.keyPlaceholder')}
          spellCheck={false}
          className="h-7 min-w-0 flex-1 rounded-md bg-panel-3 px-2 font-mono text-[11.5px] outline-none placeholder:font-sans placeholder:text-dim focus:ring-1 focus:ring-accent/50"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="h-7 shrink-0 rounded-md bg-accent-fill px-2.5 text-[12px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
        >
          {t('common.save')}
        </button>
        {canCancel && (
          <button type="button" onClick={onCancel} className="h-7 shrink-0 rounded-md px-2 text-[12px] text-muted hover:text-fg">
            {t('common.cancel')}
          </button>
        )}
      </form>
      <p className="text-[10.5px] text-dim">{t('topbar.player.yt.quotaNote')}</p>
    </div>
  )
}
