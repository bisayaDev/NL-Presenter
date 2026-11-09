import { useEffect, useMemo, useRef, useState } from 'react'
import { stripChords } from '@shared/chords'
import type { Song, SongUsage } from '@shared/types'
import SlideView from '@/components/SlideView'
import { modalBlocks } from '@/lib/modal'
import { BarChart3, Download, Globe, Music, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import UsageReport from '@/components/UsageReport'
import FindSongDialog from '@/components/FindSongDialog'
import { NoSongMatch } from '@/components/EmptyStates'
import { parseDay, today } from '@/lib/serviceDates'
import { getLocale, tn, useT } from '@/i18n'
import { songToText } from '@/lib/songText'
import { fileToSong } from '@/lib/songImport'
import { findTemplate, itemLook, useApp } from '@/store/useApp'

/** "3 weeks ago" for a YYYY-MM-DD day, in the chosen language. */
function usedAgo(day: string): string {
  const d = parseDay(day)
  const now = parseDay(today())
  if (!d || !now) return ''
  const days = Math.max(0, Math.round((now.getTime() - d.getTime()) / 86_400_000))
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' })
  if (days < 14) return rtf.format(-days, 'day')
  if (days < 60) return rtf.format(-Math.round(days / 7), 'week')
  if (days < 365) return rtf.format(-Math.round(days / 30), 'month')
  return rtf.format(-Math.round(days / 365), 'year')
}

export default function SongsTab() {
  const { t } = useT()
  const songs = useApp((s) => s.songs)
  const addSongToService = useApp((s) => s.addSongToService)
  const serviceName = useApp((s) => s.service.name)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const openSongEditor = useApp((s) => s.openSongEditor)
  const deleteSong = useApp((s) => s.deleteSong)
  const [flash, setFlash] = useState<string | null>(null)

  const tags = useMemo(() => {
    const m = new Map<string, number>()
    songs.forEach((s) => s.tags.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)))
    return [...m.entries()].sort()
  }, [songs])

  // Search title, author, tags and lyrics.
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return songs.filter((s) => {
      if (tag && !s.tags.includes(tag)) return false
      if (!needle) return true
      const hay = [s.title, s.author ?? '', s.tags.join(' '), ...s.slides.map((x) => stripChords(x.text))].join('\n').toLowerCase()
      return hay.includes(needle)
    })
  }, [songs, q, tag])

  // Song usage (all time): "Last used 3 weeks ago" and the Last used / Most used sorts.
  const [usage, setUsage] = useState<Map<string, SongUsage>>(new Map())
  const [sort, setSort] = useState<'title' | 'last' | 'most'>('title')
  const [reportOpen, setReportOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  useEffect(() => {
    const load = (): void => {
      window.nl.usage.report().then((rows) => setUsage(new Map(rows.map((r) => [r.songId, r]))))
    }
    load()
    window.addEventListener('nl-usage', load)
    return () => window.removeEventListener('nl-usage', load)
  }, [])
  const shown = useMemo(() => {
    if (sort === 'title') return results
    const val = (id: string): string | number => (sort === 'last' ? usage.get(id)?.last ?? '' : usage.get(id)?.count ?? 0)
    return [...results].sort((a, b) => {
      const x = val(a.id)
      const y = val(b.id)
      return x < y ? 1 : x > y ? -1 : a.title.localeCompare(b.title)
    })
  }, [results, sort, usage])

  const toast = (text: string): void => {
    setFlash(text)
    setTimeout(() => setFlash(null), 2500)
  }
  const add = (id: string, title: string): void => {
    addSongToService(id)
    toast(t('songs.toastAdded', { title }))
  }

  // Selected song (preview pane) and keyboard: ↑/↓ move, Enter adds, E edits, Del deletes.
  const [selId, setSelId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selected = shown.find((s) => s.id === selId) ?? null
  const select = (id: string | null): void => {
    setSelId(id)
    if (id) requestAnimationFrame(() => listRef.current?.querySelector(`[data-song-id="${id}"]`)?.scrollIntoView({ block: 'nearest' }))
  }
  const move = (d: 1 | -1): void => {
    if (!shown.length) return
    const i = shown.findIndex((s) => s.id === selId)
    const next = i < 0 ? (d === 1 ? 0 : shown.length - 1) : Math.min(shown.length - 1, Math.max(0, i + d))
    select(shown[next].id)
  }
  const remove = (id: string): void => {
    const song = songs.find((s) => s.id === id)
    if (!song || !window.confirm(t('songs.confirmDelete', { title: song.title }))) return
    const i = shown.findIndex((s) => s.id === id)
    const after = shown[i + 1] ?? shown[i - 1] ?? null
    deleteSong(id)
    setSelId(after?.id ?? null)
    listRef.current?.focus()
  }
  const showLive = (id: string): void => {
    addSongToService(id)
    const s = useApp.getState()
    if (s.selectedItemId) s.goLive(s.selectedItemId, 0)
    toast(t('songs.toastShownLive'))
  }
  const onListKey = (e: React.KeyboardEvent): void => {
    const el = e.target as HTMLElement
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (el !== e.currentTarget && ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault()
      move(key === 'ArrowDown' ? 1 : -1)
    } else if (!selected) return
    else if (key === 'Enter') {
      e.preventDefault()
      add(selected.id, selected.title)
    } else if (key === 'e') {
      e.preventDefault()
      openSongEditor(selected.id)
    } else if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault()
      remove(selected.id)
    }
  }
  // ↑/↓ with nothing focused (e.g. after Esc in the search) also move the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target !== document.body || modalBlocks(e) || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
      e.preventDefault()
      listRef.current?.focus()
      move(e.key === 'ArrowDown' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line p-3">
        <div className="flex flex-1 items-center gap-2 rounded-md bg-panel-2 px-3 ring-accent/50 focus-within:ring-1">
          <Search size={15} className="text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && shown.length) {
                e.preventDefault()
                listRef.current?.focus()
                if (!selected) select(shown[0].id)
              } else if (e.key === 'Enter' && shown.length) {
                // Enter in the search: pick the first match, ready for Enter again to add it.
                e.preventDefault()
                listRef.current?.focus()
                select(selected?.id ?? shown[0].id)
              }
            }}
            data-tab-search="songs"
            placeholder={t('songs.searchPlaceholder')}
            className="h-9 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-dim"
          />
          {q && (
            <button onClick={() => setQ('')} className="text-muted hover:text-fg">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setFindOpen(true)}
          title={t('songs.find.buttonHint')}
          className="flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-[13px] text-muted hover:border-accent hover:text-accent-text"
        >
          <Globe size={15} /> <span className="whitespace-nowrap">{t('songs.find.button')}</span>
        </button>
        <button
          onClick={async () => {
            const files = await window.nl.songFiles.import()
            if (!files) return
            const parsed = files.map((f) => fileToSong(f))
            const songs = parsed.filter((x): x is NonNullable<typeof x> => !!x)
            await useApp.getState().addSongs(songs)
            const bad = parsed.length - songs.length
            toast(tn('songs.imported', songs.length) + (bad ? ` · ${tn('songs.noLyricsFiles', bad)}` : ''))
          }}
          title={t('songs.importHint')}
          className="flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-[13px] text-muted hover:border-accent hover:text-accent-text"
        >
          <Upload size={15} /> <span className="whitespace-nowrap">{t('songs.importTxt')}</span>
        </button>
        <button
          onClick={async () => {
            const r = await window.nl.songFiles.export(results.map(songToText))
            if (r) toast(tn('songs.exported', r.count, { folder: r.folder }))
          }}
          disabled={!results.length}
          title={t('songs.exportHint')}
          className="flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-[13px] text-muted hover:border-accent hover:text-accent-text disabled:opacity-40"
        >
          <Download size={15} /> <span className="whitespace-nowrap">{t('songs.exportCount', { count: results.length })}</span>
        </button>
        <button
          onClick={() => setReportOpen(true)}
          title={t('songs.usageHint')}
          className="flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-[13px] text-muted hover:border-accent hover:text-accent-text"
        >
          <BarChart3 size={15} /> <span className="whitespace-nowrap">{t('songs.usageReport')}</span>
        </button>
        <button
          onClick={() => openSongEditor('new')}
          className="flex h-9 items-center gap-1.5 rounded-md bg-accent-fill px-3 text-[13px] font-semibold text-on-accent hover:brightness-110"
        >
          <Plus size={15} /> <span className="whitespace-nowrap">{t('songs.newSong')}</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-2">
        <Chip active={!tag} onClick={() => setTag(null)}>
          {t('songs.all')} <span className="opacity-60">{songs.length}</span>
        </Chip>
        {tags.map(([tg, n]) => (
          <Chip key={tg} active={tag === tg} onClick={() => setTag(tag === tg ? null : tg)}>
            {tg} <span className="opacity-60">{n}</span>
          </Chip>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          title={t('songs.sortHint')}
          className="ml-auto h-6 rounded-md bg-panel-2 px-1.5 text-[12px] text-muted outline-none hover:text-fg"
        >
          <option value="title">{t('songs.sortTitle')}</option>
          <option value="last">{t('songs.sortLast')}</option>
          <option value="most">{t('songs.sortMost')}</option>
        </select>
        <span className="ml-2 min-w-0 truncate text-[11.5px] text-dim">
          {t('songs.countOf', { shown: results.length, total: songs.length })} · {t('songs.listHint', { service: serviceName })}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
      <div
        ref={listRef}
        tabIndex={0}
        role="listbox"
        aria-label={t('songs.listLabel')}
        data-own-keys
        onKeyDown={onListKey}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 outline-none"
      >
        {shown.length === 0 && <NoSongMatch query={q} onSearchOnline={() => setFindOpen(true)} />}
        {shown.map((s) => (
          <div
            key={s.id}
            data-song-id={s.id}
            role="option"
            aria-selected={s.id === selId}
            onClick={() => setSelId(s.id)}
            onDoubleClick={() => add(s.id, s.title)}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 ${
              s.id === selId ? 'bg-accent-soft ring-1 ring-accent/40' : 'hover:bg-panel-2'
            }`}
          >
            <div className="grid h-9 w-9 place-items-center rounded-md bg-accent-soft text-accent-text">
              <Music size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-medium">{s.title}</span>
                <span className="rounded-full bg-panel-3 px-1.5 text-[10.5px] text-muted">{s.slides.length}</span>
              </div>
              <div className="truncate text-[12px] text-muted">
                {s.author ?? t('songs.unknownAuthor')} {s.tags.length > 0 && <span className="text-dim">· {s.tags.join(', ')}</span>}
                {usage.get(s.id) && (
                  <span className="text-dim" title={tn('songs.usedTimes', usage.get(s.id)!.count)}>
                    {' '}· {t('songs.lastUsedAgo', { ago: usedAgo(usage.get(s.id)!.last) })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button
                onClick={() => openSongEditor(s.id)}
                title={t('songs.editSong')}
                className="rounded-md p-1.5 text-muted hover:bg-panel-3 hover:text-fg"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => remove(s.id)}
                title={t('songs.deleteHint')}
                className="rounded-md p-1.5 text-muted hover:bg-live/15 hover:text-live"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => add(s.id, s.title)}
                className="ml-1 whitespace-nowrap rounded-md border border-line px-2.5 py-1 text-[12px] text-muted hover:border-accent hover:text-accent-text"
              >
                + {t('songs.addToService')}
              </button>
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <SongPreview
          song={selected}
          lastUsed={usage.get(selected.id)}
          onAdd={() => add(selected.id, selected.title)}
          onEdit={() => openSongEditor(selected.id)}
          onLive={() => showLive(selected.id)}
          onClose={() => setSelId(null)}
        />
      )}
      </div>

      {reportOpen && <UsageReport onClose={() => setReportOpen(false)} />}
      {findOpen && <FindSongDialog initialQuery={q} onClose={() => setFindOpen(false)} onImported={toast} />}
      {flash && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-panel-3 px-4 py-2 text-[13px] shadow-2xl ring-1 ring-line">
          {flash}
        </div>
      )}
    </div>
  )
}

/** Right-hand pane: the selected song's slides as the audience will see them, plus its details and actions. */
function SongPreview({
  song,
  lastUsed,
  onAdd,
  onEdit,
  onLive,
  onClose
}: {
  song: Song
  lastUsed?: SongUsage
  onAdd: () => void
  onEdit: () => void
  onLive: () => void
  onClose: () => void
}) {
  const { t, tn } = useT()
  const state = useApp()
  const look = itemLook(state, { templateId: song.templateId })
  const lookName = song.templateId ? (findTemplate(state, song.templateId)?.name ?? t('songs.missingLook')) : t('songs.defaultLook')
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-line bg-panel">
      <div className="flex items-start gap-2 border-b border-line p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold">{song.title}</div>
          <div className="truncate text-[12px] text-muted">{song.author || t('songs.unknownAuthor')}</div>
        </div>
        <button onClick={onClose} title={t('songs.closePreview')} className="rounded p-1 text-dim hover:bg-panel-3 hover:text-fg">
          <X size={14} />
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-line px-3 py-2.5 text-[12px]">
        <dt className="text-dim">{t('songs.key')}</dt>
        <dd className="truncate">{song.key || '—'}</dd>
        <dt className="text-dim">{t('songs.look')}</dt>
        <dd className="truncate">{lookName}</dd>
        <dt className="text-dim">{t('songs.lastUsed')}</dt>
        <dd className="truncate">{lastUsed ? `${usedAgo(lastUsed.last)} · ${lastUsed.count}×` : t('songs.never')}</dd>
      </dl>
      <div className="grid grid-cols-3 gap-1.5 border-b border-line p-3">
        <button
          onClick={onAdd}
          title={t('songs.addHint')}
          className="rounded-md bg-accent-fill px-2 py-1.5 text-[12px] font-semibold text-on-accent hover:brightness-110"
        >
          {t('common.add')}
        </button>
        <button
          onClick={onEdit}
          title={t('songs.editHintKey')}
          className="rounded-md border border-line px-2 py-1.5 text-[12px] text-muted hover:border-accent hover:text-accent-text"
        >
          {t('common.edit')}
        </button>
        <button
          onClick={onLive}
          title={t('songs.showLiveHint')}
          className="rounded-md border border-live/40 px-2 py-1.5 text-[12px] font-medium text-live hover:bg-live/15"
        >
          {t('songs.showLive')}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="label-caps mb-2">
          {tn('songs.slideCount', song.slides.length)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {song.slides.map((sl) => {
            const clean = sl.text.includes('[') ? { ...sl, text: stripChords(sl.text) } : sl
            return (
              <div key={sl.id} className="min-w-0">
                <SlideView
                  slide={clean}
                  background={sl.background ?? look.background}
                  style={look.style}
                  aspect={state.aspect}
                  thumbnail
                  className="aspect-video w-full rounded ring-1 ring-line"
                />
                {sl.label && <div className="mt-0.5 truncate text-[10.5px] text-dim">{sl.label}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-[12px] ${
        active ? 'bg-accent-fill text-on-accent' : 'bg-panel-2 text-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}
