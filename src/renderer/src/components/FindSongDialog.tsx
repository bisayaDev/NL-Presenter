import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, FileUp, Globe, Loader2, Search, X } from 'lucide-react'
import type { Song, SongText, WebSongHit } from '@shared/types'
import { useModal } from '@/lib/modal'
import { setNewSongDraft } from '@/lib/guide'
import { cleanSongTitle, draftToSong, fileToSong, webLyricsDraft } from '@/lib/songImport'
import { useApp } from '@/store/useApp'
import { useT } from '@/i18n'

const SONGSELECT = 'https://songselect.ccli.com/search/results?search='

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const mmss = (sec?: number): string => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '')

/** Open the song editor on a song that isn't saved yet (the user checks it, then saves). */
function openDraft(song: Song, source: string): void {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, updatedAt, ...rest } = song
  setNewSongDraft({ song: rest, source })
  useApp.getState().openSongEditor('new')
}

/**
 * Songs tab → Find a song: lyrics from the web (LRCLIB) when a song isn't in the library, plus song files from
 * SongSelect (lyrics .txt, .usr, ChordPro) and other ChordPro sources. A result opens in the song editor for checking.
 */
export default function FindSongDialog({
  initialQuery,
  onClose,
  onImported
}: {
  initialQuery: string
  onClose: () => void
  /** Several files saved straight to the library: a message for the Songs tab. */
  onImported: (text: string) => void
}) {
  useModal(true, onClose)
  const { t, tn } = useT()
  const songs = useApp((s) => s.songs)
  const [q, setQ] = useState(initialQuery)
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'offline' | 'failed'>('idle')
  const [hits, setHits] = useState<WebSongHit[]>([])
  const [searched, setSearched] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [fileMsg, setFileMsg] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const run = useRef(0)

  const library = useMemo(() => new Set(songs.map((s) => norm(s.title))), [songs])

  const search = async (query = q): Promise<void> => {
    const text = query.trim()
    if (!text) return
    const n = ++run.current
    setState('busy')
    setSearched(text)
    const r = await window.nl.songFiles.webSearch(text)
    if (n !== run.current) return
    if (!r.ok) {
      setHits([])
      setState(r.error)
      return
    }
    setHits(r.hits)
    setSelId(r.hits[0]?.id ?? null)
    setState('done')
  }

  useEffect(() => {
    if (initialQuery.trim()) search(initialQuery)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = hits.find((h) => h.id === selId) ?? null
  const preview = useMemo(() => (selected ? draftToSong(webLyricsDraft(selected)) : null), [selected])

  const openHit = (h: WebSongHit): void => {
    const song = h.id === selected?.id ? preview : draftToSong(webLyricsDraft(h))
    if (!song) return
    onClose()
    openDraft(song, t('songs.find.fromLrclib'))
  }

  /** Song files: one opens in the editor for checking; several are added to the library straight away. */
  const importFiles = async (files: SongText[] | null): Promise<void> => {
    if (!files?.length) return
    setFileMsg(null)
    const parsed = files.map((f) => ({ f, song: fileToSong(f) }))
    const good = parsed.filter((p): p is { f: SongText; song: Song } => !!p.song)
    if (!good.length) {
      setFileMsg(t('songs.find.noLyrics'))
      return
    }
    if (files.length === 1) {
      onClose()
      openDraft(good[0].song, t('songs.find.fromFile', { file: `${good[0].f.name}${good[0].f.ext ?? ''}` }))
      return
    }
    await useApp.getState().addSongs(good.map((g) => g.song))
    const bad = parsed.length - good.length
    onClose()
    onImported(tn('songs.imported', good.length) + (bad ? ` · ${tn('songs.noLyricsFiles', bad)}` : ''))
  }

  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setDragging(false)
    const paths = [...e.dataTransfer.files].map((f) => window.nl.media.pathFor(f)).filter(Boolean)
    if (paths.length) await importFiles(await window.nl.songFiles.import(paths))
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="find-song-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes('Files')) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
        }}
        onDrop={onDrop}
        className="relative flex h-[min(680px,90vh)] w-[min(980px,94vw)] flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <Globe size={17} className="text-accent-text" aria-hidden />
          <h2 id="find-song-title" className="text-[15px] font-semibold">
            {t('songs.find.title')}
          </h2>
          <div className="flex-1" />
          <button onClick={onClose} title={t('common.close')} className="rounded p-1 text-muted hover:bg-panel-3 hover:text-fg">
            <X size={16} />
          </button>
        </div>

        <form
          className="flex items-center gap-2 border-b border-line px-5 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            search()
          }}
        >
          <div className="flex flex-1 items-center gap-2 rounded-md bg-panel-2 px-3 ring-accent/50 focus-within:ring-1">
            <Search size={15} className="text-muted" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('songs.find.placeholder')}
              aria-label={t('songs.find.placeholder')}
              className="h-9 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-dim"
            />
          </div>
          <button
            type="submit"
            disabled={!q.trim() || state === 'busy'}
            className="flex h-9 items-center gap-1.5 rounded-md bg-accent-fill px-4 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
          >
            {state === 'busy' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {t('songs.find.search')}
          </button>
        </form>

        <div className="flex min-h-0 flex-1">
          {/* Results */}
          <div className="flex w-[380px] shrink-0 flex-col border-r border-line">
            <div className="flex items-baseline justify-between px-5 pb-1.5 pt-3">
              <span className="label-caps">{t('songs.find.online')}</span>
              <span className="text-[11px] text-dim">{t('songs.find.viaLrclib')}</span>
            </div>
            <div role="listbox" aria-label={t('songs.find.online')} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {state === 'busy' && (
                <div className="flex items-center gap-2 px-2 py-6 text-[13px] text-muted">
                  <Loader2 size={14} className="animate-spin" /> {t('songs.find.searching')}
                </div>
              )}
              {state === 'offline' && <p className="px-2 py-6 text-[13px] text-amber-300">{t('songs.find.offline')}</p>}
              {state === 'failed' && <p className="px-2 py-6 text-[13px] text-amber-300">{t('songs.find.failed')}</p>}
              {state === 'idle' && <p className="px-2 py-6 text-[13px] text-muted">{t('songs.find.start')}</p>}
              {state === 'done' && !hits.length && (
                <p className="px-2 py-6 text-[13px] text-muted">{t('songs.find.noResults', { q: searched })}</p>
              )}
              {state === 'done' &&
                hits.map((h) => {
                  const active = h.id === selId
                  return (
                    <button
                      key={h.id}
                      role="option"
                      aria-selected={active}
                      onClick={() => setSelId(h.id)}
                      onDoubleClick={() => openHit(h)}
                      className={`mb-0.5 flex w-full flex-col items-start rounded-lg px-3 py-2 text-left ${
                        active ? 'bg-accent-soft ring-1 ring-accent/40' : 'hover:bg-panel-2'
                      }`}
                    >
                      <span className="flex w-full items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium" title={h.title}>
                          {cleanSongTitle(h.title, h.artist)}
                        </span>
                        {library.has(norm(cleanSongTitle(h.title, h.artist))) && (
                          <span className="shrink-0 rounded-full bg-panel-3 px-1.5 py-px text-[10.5px] text-muted">{t('songs.find.inLibrary')}</span>
                        )}
                      </span>
                      <span className="w-full truncate text-[12px] text-muted">
                        {[h.artist, h.album, mmss(h.duration)].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  )
                })}
            </div>
          </div>

          {/* Preview */}
          <div className="flex min-w-0 flex-1 flex-col">
            {preview && selected ? (
              <>
                <div className="flex items-start gap-3 border-b border-line px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{preview.title}</div>
                    <div className="truncate text-[12.5px] text-muted">
                      {selected.artist} · {tn('songs.slideCount', preview.slides.length)} ·{' '}
                      <span className="text-dim">{t('songs.find.lyricsOnly')}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => openHit(selected)}
                    className="shrink-0 rounded-md bg-accent-fill px-3.5 py-2 text-[13px] font-semibold text-on-accent hover:brightness-110"
                  >
                    {t('songs.find.open')}
                  </button>
                </div>
                <p className="border-b border-line px-5 py-2 text-[11.5px] leading-snug text-dim">{t('songs.find.openHint')}</p>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                  {preview.slides.map((sl, i) => (
                    <div key={sl.id} className="mb-3">
                      {sl.label && sl.label !== preview.slides[i - 1]?.label && (
                        <div className="label-caps mb-1 text-accent-text">{sl.label}</div>
                      )}
                      <div className="whitespace-pre-line rounded-md bg-panel-2 px-3 py-2 text-[13px] leading-relaxed">{sl.text}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center px-8 text-center text-[13px] text-muted">
                {state === 'done' && hits.length ? t('songs.find.pick') : null}
              </div>
            )}
          </div>
        </div>

        {/* Files: SongSelect and ChordPro */}
        <div className="flex items-center gap-3 border-t border-line bg-panel-2/60 px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium">{t('songs.find.chordsTitle')}</div>
            <div className="text-[11.5px] leading-snug text-dim">{fileMsg ?? t('songs.find.chordsHint')}</div>
          </div>
          <button
            onClick={() => window.open(SONGSELECT + encodeURIComponent((q || searched).trim()))}
            title={t('songs.find.songselectHint')}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line px-3 text-[12.5px] text-muted hover:border-accent hover:text-accent-text"
          >
            <ExternalLink size={14} /> {t('songs.find.songselect')}
          </button>
          <button
            onClick={async () => importFiles(await window.nl.songFiles.import())}
            title={t('songs.importHint')}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line px-3 text-[12.5px] text-muted hover:border-accent hover:text-accent-text"
          >
            <FileUp size={14} /> {t('songs.find.importFile')}
          </button>
        </div>
        <p className="border-t border-line px-5 py-2 text-[11px] leading-snug text-dim">{t('songs.find.ccli')}</p>

        {dragging && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-accent/10 ring-2 ring-inset ring-accent">
            <div className="rounded-lg bg-panel px-4 py-2.5 text-[13.5px] font-semibold shadow-xl">{t('songs.find.drop')}</div>
          </div>
        )}
      </div>
    </div>
  )
}
