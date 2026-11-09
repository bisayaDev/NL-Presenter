import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Expand,
  Film,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Link2,
  ListPlus,
  MoveHorizontal,
  Loader2,
  RefreshCw,
  X,
  Music,
  Presentation,
  Search,
  Shrink,
  Sparkles,
  Square,
  Stamp,
  StickyNote,
  Trash2,
  Upload,
  Wallpaper
} from 'lucide-react'
import type { MediaFit, MediaItem } from '@shared/types'
import { formatBytes, mediaUrl } from '@/lib/media'
import MediaThumb from '@/components/MediaThumb'
import SlideView from '@/components/SlideView'
import { DEFAULT_STYLE } from '@/lib/defaults'
import { EmptyMedia } from '@/components/EmptyStates'
import { backgroundFor, fitted, useApp, usesMedia as isUsing } from '@/store/useApp'
import { usePlayer } from '@/store/usePlayer'
import { t, tn, useT } from '@/i18n'

type Filter = 'all' | 'image' | 'video' | 'loop' | 'audio' | 'deck'
const FILTERS: Filter[] = ['all', 'image', 'video', 'loop', 'audio', 'deck']
const pagesLabel = (m: MediaItem): string => tn('media.pages', m.deck?.pages.length ?? 0)
const FILE_MANAGER = /Mac/i.test(navigator.platform) ? 'Finder' : 'Explorer'

type LinkedFolder = { path: string; missing: boolean; count: number }
const reloadMedia = async (): Promise<void> => {
  const list = await window.nl.media.list()
  const known = new Set(useApp.getState().media.map((m) => m.id))
  useApp.setState({ media: list })
  // Files that just showed up (e.g. new in a linked folder) start on the default fit.
  useApp.getState().fitNewMedia(list.filter((m) => !known.has(m.id)))
}

/** Linked folders: list pictures and videos from a folder without copying them. */
function useLinkedFolders() {
  const [folders, setFolders] = useState<LinkedFolder[]>([])
  const [busy, setBusy] = useState(false)
  const load = async (): Promise<void> => setFolders(await window.nl.media.linkedFolders())
  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    try {
      await fn()
      await Promise.all([load(), reloadMedia()])
    } finally {
      setBusy(false)
    }
  }
  // Pick up files added to linked folders since the last visit.
  useEffect(() => {
    window.nl.media.linkedFolders().then((f) => {
      setFolders(f)
      if (f.length) run(() => window.nl.media.refreshLinked())
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return {
    folders,
    busy,
    link: (): Promise<void> => run(() => window.nl.media.linkFolder()),
    unlink: (path: string): Promise<void> => run(() => window.nl.media.unlinkFolder(path)),
    refresh: (): Promise<void> => run(() => window.nl.media.refreshLinked())
  }
}

export default function MediaTab() {
  useT()
  const { media, background, logo, importMedia } = useApp()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Multi-select (⌘/Ctrl-click, Shift-click) for "Add to service".
  const [picked, setPicked] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const linked = useLinkedFolders()

  const shown = useMemo(
    () =>
      media.filter(
        (m) =>
          (filter === 'all' || m.kind === filter) &&
          (!q.trim() ||
            [m.name, m.loop?.category ?? '', ...(m.loop?.tags ?? [])].some((t) => t.toLowerCase().includes(q.trim().toLowerCase())))
      ),
    [media, filter, q]
  )
  const selected = media.find((m) => m.id === selectedId) ?? null
  const pickedMedia = shown.filter((m) => picked.includes(m.id) && (m.kind === 'image' || m.kind === 'video'))
  const pick = (m: MediaItem, e: React.MouseEvent): void => {
    setSelectedId(m.id)
    if (e.metaKey || e.ctrlKey) setPicked((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]))
    else if (e.shiftKey && selectedId) {
      const a = shown.findIndex((x) => x.id === selectedId)
      const b = shown.findIndex((x) => x.id === m.id)
      const range = shown.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.id)
      setPicked((p) => [...new Set([...p, ...range])])
    } else setPicked([m.id])
  }
  const addPicked = (): void => {
    useApp.getState().addMediaToService(pickedMedia)
    const pics = pickedMedia.filter((m) => m.kind === 'image').length
    const vids = pickedMedia.length - pics
    const what = [pics > 1 ? tn('media.slideshowOf', pics) : pics ? tn('media.pictureCount', pics) : '', vids ? tn('media.videoCount', vids) : '']
      .filter(Boolean)
      .join(', ')
    setNotice(t('media.addedToService', { what }))
    setTimeout(() => setNotice(null), 5000)
    setPicked([])
  }
  const counts: Record<Filter, number> = { all: media.length, image: 0, video: 0, loop: 0, audio: 0, deck: 0 }
  for (const m of media) counts[m.kind]++

  const doImport = async (paths?: string[]): Promise<void> => {
    setBusy(true)
    const r = await importMedia(paths)
    setBusy(false)
    if (r.added.length) setSelectedId(r.added[0].id)
    const loops = r.added.filter((m) => m.kind === 'loop').length
    const decks = r.added.filter((m) => m.kind === 'deck').length
    const files = r.added.length - loops - decks
    const what = [
      files ? tn('media.fileCount', files) : '',
      loops ? tn('media.loopCount', loops) : '',
      decks ? tn('media.deckCount', decks) : ''
    ].filter(Boolean)
    const parts = what.length ? [t('media.imported', { what: what.join(', ') })] : []
    if (r.skipped.length) parts.push(t('media.skipped', { names: r.skipped.join(', ') }))
    if (loops && !files && !decks && filter !== 'all') setFilter('loop')
    if (decks && !files && !loops && filter !== 'all') setFilter('deck')
    if (parts.length) {
      setNotice(parts.join(' · '))
      setTimeout(() => setNotice(null), 6000)
    }
  }

  return (
    <div
      className="relative flex min-h-0 flex-1"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const paths = [...e.dataTransfer.files].map((f) => window.nl.media.pathFor(f)).filter(Boolean)
        if (paths.length) doImport(paths)
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="flex min-w-[160px] flex-1 items-center gap-2 rounded-md bg-panel-2 px-3 ring-accent/50 focus-within:ring-1">
            <Search size={15} className="text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-tab-search="media"
              placeholder={t('media.searchPlaceholder')}
              className="h-9 min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-dim"
            />
          </div>
          <div className="flex shrink-0 rounded-md bg-panel-2 p-0.5 text-[12.5px]">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap rounded px-2.5 py-1 ${filter === f ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'}`}
              >
                {t(`media.filter.${f}`)} <span className="opacity-60">{counts[f]}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => doImport()}
            disabled={busy}
            className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-fill px-3 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {t('media.import')}
          </button>
          <button
            onClick={linked.link}
            disabled={linked.busy}
            title={t('media.linkHint')}
            className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line px-3 text-[13px] text-fg hover:bg-panel-2 disabled:opacity-50"
          >
            <FolderPlus size={15} /> {t('media.linkFolder')}
          </button>
        </div>

        {linked.folders.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2 text-[12px]">
            <span className="label-caps mr-1">{t('media.linked')}</span>
            {linked.folders.map((f) => (
              <span
                key={f.path}
                title={f.missing ? t('media.folderMissingHint', { path: f.path }) : f.path}
                className={`flex max-w-[280px] items-center gap-1 rounded-md py-0.5 pl-2 pr-1 ${f.missing ? 'bg-live/10 text-live' : 'bg-panel-2 text-muted'}`}
              >
                {f.missing ? <AlertTriangle size={12} className="shrink-0" /> : <Link2 size={12} className="shrink-0" />}
                <span className="truncate">{f.path.split(/[\\/]/).filter(Boolean).pop()}</span>
                <span className="shrink-0 text-dim">{f.count}</span>
                <button
                  onClick={() => {
                    if (window.confirm(t('media.confirmUnlink', { path: f.path }))) linked.unlink(f.path)
                  }}
                  title={t('media.unlinkHint')}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded hover:bg-panel-3 hover:text-fg"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              onClick={linked.refresh}
              disabled={linked.busy}
              title={t('media.refreshHint')}
              className="flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-50"
            >
              <RefreshCw size={12} className={linked.busy ? 'animate-spin' : ''} /> {t('media.refresh')}
            </button>
          </div>
        )}

        {pickedMedia.length > 1 && (
          <div className="flex items-center gap-3 border-b border-line bg-accent-soft px-4 py-2 text-[12.5px]">
            <span className="whitespace-nowrap font-semibold text-accent-text">{tn('media.selected', pickedMedia.length)}</span>
            <span className="min-w-0 truncate text-muted">
              {[
                pickedMedia.filter((m) => m.kind === 'image').length > 1 ? t('media.slideshowHint') : '',
                pickedMedia.some((m) => m.kind === 'video') ? t('media.eachVideoHint') : ''
              ]
                .filter(Boolean)
                .join(' ')}
            </span>
            <div className="flex-1" />
            <button onClick={() => setPicked([])} className="whitespace-nowrap text-muted hover:text-fg">
              {t('media.clear')}
            </button>
            <button
              onClick={addPicked}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-fill px-3 py-1.5 font-semibold text-on-accent hover:brightness-110"
            >
              <ListPlus size={14} /> {t('media.addToService')}
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {media.length === 0 ? (
            <EmptyMedia onImport={() => doImport()} busy={busy} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
              {shown.map((m) => (
                <button
                  key={m.id}
                  onClick={(e) => pick(m, e)}
                  onDoubleClick={() => {
                    if (m.kind === 'deck') {
                      useApp.getState().addDeckToService(m)
                      useApp.getState().setTab('presentation')
                      return
                    }
                    const bg = backgroundFor(m)
                    if (bg) useApp.getState().setBackground(bg)
                    else usePlayer.getState().playMedia(m.id)
                  }}
                  className={`group overflow-hidden rounded-lg bg-panel text-left ring-2 ${
                    m.id === selectedId || (picked.length > 1 && picked.includes(m.id)) ? 'ring-accent' : 'ring-transparent hover:ring-line'
                  }`}
                >
                  <div className="relative aspect-video bg-black">
                    {m.missing ? <MissingThumb /> : <MediaThumb m={m} />}
                    <div className="absolute left-1.5 top-1.5 flex gap-1">
                      {isUsing(background, m) && <Badge>{t('common.default')}</Badge>}
                      {logo?.src === m.ref && <Badge>{t('media.badgeLogo')}</Badge>}
                      {m.missing && <span className="whitespace-nowrap rounded bg-live px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">{t('media.badgeMissing')}</span>}
                    </div>
                    {m.linked && (
                      <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white/90" title={m.path}>
                        <Link2 size={11} /> {t('media.badgeLinked')}
                      </span>
                    )}
                    {m.kind !== 'image' && (
                      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 p-1 text-white/90">
                        <KindIcon kind={m.kind} size={12} />
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="truncate text-[12.5px]">{m.name}</div>
                    <div className="truncate text-[11px] text-dim">
                      {m.kind === 'loop' ? m.loop?.category : m.kind === 'deck' ? `${pagesLabel(m)} · ${m.deck?.source.toUpperCase()}` : formatBytes(m.size)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <DetailPanel key={selected?.id ?? 'none'} media={selected} onDeleted={() => setSelectedId(null)} />

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-xl border-2 border-dashed border-accent bg-accent/10">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-accent-text">
            <Upload size={18} /> {t('media.dropToImport')}
          </div>
        </div>
      )}
      {notice && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-panel-3 px-4 py-2 text-[13px] shadow-2xl ring-1 ring-line">
          {notice}
        </div>
      )}
    </div>
  )
}

function KindIcon({ kind, size }: { kind: MediaItem['kind']; size: number }) {
  const Icon = kind === 'video' ? Film : kind === 'loop' ? Sparkles : kind === 'audio' ? Music : kind === 'deck' ? Presentation : ImageIcon
  return <Icon size={size} />
}

function MissingThumb() {
  return (
    <div className="grid h-full w-full place-items-center bg-panel-2 text-live/80">
      <AlertTriangle size={22} />
    </div>
  )
}

/** Linked files: where the file is (or that it is gone), and "Show in Finder/Explorer" for any file. */
function FileInfo({ m }: { m: MediaItem }) {
  useT()
  const [gone, setGone] = useState(false)
  if (m.kind === 'loop') return null
  return (
    <div className="flex flex-col gap-1.5">
      {m.linked && (
        <div className={`flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] ${m.missing ? 'bg-live/10 text-live' : 'bg-panel-2 text-muted'}`}>
          {m.missing ? <AlertTriangle size={13} className="mt-px shrink-0" /> : <Link2 size={13} className="mt-px shrink-0" />}
          <span className="min-w-0 break-all">
            {m.missing ? t('media.fileNotFound', { path: m.path ?? '' }) : t('media.linkedNotCopied', { path: m.path ?? '' })}
          </span>
        </div>
      )}
      {!m.missing && (
        <button
          onClick={async () => setGone(!(await window.nl.media.showInFolder(m.ref)))}
          className="flex items-center justify-center gap-2 rounded-md border border-line py-1.5 text-[12.5px] text-muted hover:border-accent hover:text-accent-text"
        >
          <FolderOpen size={14} /> {t('media.showIn', { app: FILE_MANAGER })}
        </button>
      )}
      {gone && <p className="text-[11px] text-live">{t('media.fileGone')}</p>}
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-accent-fill px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-on-accent">{children}</span>
}

function DetailPanel({ media: m, onDeleted }: { media: MediaItem | null; onDeleted: () => void }) {
  useT()
  const { service, selectedItemId, background, logo, setBackground, setItemBackground, setLogo, renameMedia, mediaFit, setMediaFit, aspect } = useApp()
  // Start from the current default background's settings when it is this video.
  const current = m && background.kind === 'video' && background.src === m.ref ? background : null
  const [loop, setLoop] = useState(current?.loop ?? true)
  const [muted, setMuted] = useState(current?.muted ?? true)
  const [itemId, setItemId] = useState<string>('')
  const targetId = itemId || selectedItemId || service.items[0]?.id || ''
  const target = service.items.find((i) => i.id === targetId)

  if (!m) {
    return (
      <aside className="grid w-80 shrink-0 place-items-center border-l border-line bg-panel p-6 text-center text-[12.5px] text-muted">
        {t('media.detailEmpty')}
      </aside>
    )
  }

  if (m.kind === 'audio') return <AudioDetail m={m} onDeleted={onDeleted} />
  if (m.kind === 'deck') return <DeckDetail m={m} onDeleted={onDeleted} />
  const bg = backgroundFor(m, { loop, muted })!
  const placed = m.kind === 'image' || m.kind === 'video'
  return (
    <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-line bg-panel p-4">
      {placed ? (
        // Drawn like the output screen (its shape, its 1920-wide stage), so the fit looks as it will live.
        <SlideView
          key={m.id}
          slide={null}
          background={fitted(bg, mediaFit)}
          style={DEFAULT_STYLE}
          aspect={aspect}
          className={`${aspect === '16:9' ? 'aspect-video' : 'aspect-[4/3]'} w-full overflow-hidden rounded-lg ring-1 ring-line`}
        />
      ) : (
        <div className="aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-line">
          <MediaThumb key={m.id} m={m} large />
        </div>
      )}
      <div>
        <input
          key={m.id}
          defaultValue={m.name}
          onBlur={(e) => e.target.value !== m.name && renameMedia(m.id, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full rounded bg-transparent px-1 py-0.5 text-[14px] font-semibold outline-none hover:bg-panel-2 focus:bg-panel-2"
        />
        <div className="flex items-center gap-1.5 px-1 text-[11.5px] text-muted">
          <KindIcon kind={m.kind} size={12} />
          {t(`media.kind.${m.kind}`)} · {m.kind === 'loop' ? m.loop?.category : formatBytes(m.size)}
        </div>
        {m.kind === 'loop' && !!m.loop?.tags.length && (
          <div className="mt-2 flex flex-wrap gap-1 px-1">
            {m.loop.tags.map((t) => (
              <span key={t} className="rounded bg-panel-2 px-1.5 py-px text-[10.5px] text-muted">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {m.kind === 'video' && (
        <div className="flex flex-col gap-1.5">
          <Check checked={loop} onChange={setLoop} label={t('media.loop')} />
          <Check checked={!muted} onChange={(v) => setMuted(!v)} label={t('media.playSound')} />
        </div>
      )}

      {placed && <FitPicker value={mediaFit[m.ref] ?? 'cover'} onChange={(f) => setMediaFit(m.ref, f)} />}

      <div className="flex flex-col gap-2">
        <div className="label-caps">{t('media.useAsBackground')}</div>
        <button
          onClick={() => setBackground(bg)}
          className={`flex items-center justify-center gap-2 rounded-md py-2 text-[13px] font-semibold ${
            isUsing(background, m) ? 'bg-accent-soft text-accent-text' : 'bg-accent-fill text-on-accent hover:brightness-110'
          }`}
        >
          <Wallpaper size={15} /> {isUsing(background, m) ? `${t('media.isDefaultBg')} ✓` : t('media.setDefaultBg')}
        </button>
        {service.items.length > 0 && (
          <div className="flex gap-1.5">
            <select
              value={targetId}
              onChange={(e) => setItemId(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md bg-panel-2 px-2 text-[12.5px] outline-none"
            >
              {service.items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.title}
                  {isUsing(it.background, m) ? ' ✓' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => target && setItemBackground(target.id, isUsing(target.background, m) ? undefined : bg)}
              className="shrink-0 whitespace-nowrap rounded-md border border-line px-3 text-[12.5px] hover:border-accent hover:text-accent-text"
            >
              {target && isUsing(target.background, m) ? t('common.remove') : t('media.useForItem')}
            </button>
          </div>
        )}
      </div>

      {(m.kind === 'image' || m.kind === 'video') && (
        <div className="flex flex-col gap-2">
          <div className="label-caps">{t('media.service')}</div>
          <button
            onClick={() => useApp.getState().addMediaToService([m])}
            className="flex items-center justify-center gap-2 rounded-md border border-line py-2 text-[13px] hover:border-accent hover:text-accent-text"
          >
            <ListPlus size={15} /> {t('media.addToService')}
          </button>
          <p className="text-[11px] text-dim">
            {m.kind === 'video' ? t('media.videoItemHint') : t('media.slideshowAddHint')}
          </p>
        </div>
      )}

      {m.kind === 'image' && (
        <div className="flex flex-col gap-2">
          <div className="label-caps">{t('media.logoWatermark')}</div>
          {logo?.src === m.ref ? (
            <button onClick={() => setLogo(null)} className="rounded-md bg-accent-soft py-2 text-[13px] font-semibold text-accent-text">
              {t('media.removeLogo')}
            </button>
          ) : (
            <button
              onClick={() => setLogo({ src: m.ref, corner: logo?.corner ?? 'br', size: logo?.size ?? 10, opacity: logo?.opacity ?? 0.85 })}
              className="flex items-center justify-center gap-2 rounded-md border border-line py-2 text-[13px] hover:border-accent hover:text-accent-text"
            >
              <Stamp size={15} /> {t('media.useAsLogo')}
            </button>
          )}
          <p className="text-[11px] text-dim">{t('media.logoHint')}</p>
        </div>
      )}

      <div className="flex-1" />
      <FileInfo m={m} />
      <DeleteButton m={m} onDeleted={onDeleted} />
    </aside>
  )
}

const FITS: { fit: MediaFit; Icon: typeof Expand }[] = [
  { fit: 'cover', Icon: Expand },
  { fit: 'contain', Icon: Shrink },
  { fit: 'fill', Icon: MoveHorizontal },
  { fit: 'none', Icon: Square }
]

/** How this picture or video sits on the output screen. One choice per file, wherever it is used. */
function FitPicker({ value, onChange }: { value: MediaFit; onChange: (f: MediaFit) => void }) {
  useT()
  return (
    <div className="flex flex-col gap-2">
      <div className="label-caps" id="media-fit-label">
        {t('media.fit.title')}
      </div>
      <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-labelledby="media-fit-label">
        {FITS.map(({ fit, Icon }) => (
          <button
            key={fit}
            role="radio"
            aria-checked={value === fit}
            onClick={() => onChange(fit)}
            className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] ${
              value === fit ? 'bg-accent-fill font-semibold text-on-accent' : 'bg-panel-2 text-muted hover:bg-panel-3 hover:text-fg'
            }`}
          >
            <Icon size={14} className="shrink-0" aria-hidden />
            <span className="truncate">{t(`media.fit.${fit}`)}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-snug text-dim">
        {t(`media.fit.${value}Hint`)} {t('media.fit.everywhere')}
      </p>
    </div>
  )
}

function DeleteButton({ m, onDeleted }: { m: MediaItem; onDeleted: () => void }) {
  const deleteMedia = useApp((s) => s.deleteMedia)
  useT()
  return (
    <button
      onClick={async () => {
        const what = m.kind === 'audio' ? t('media.whatAudio') : m.kind === 'deck' ? t('media.whatDeck') : t('media.whatSlides')
        const ask = m.linked ? t('media.confirmRemoveLinked', { name: m.name, what }) : t('media.confirmDelete', { name: m.name, what })
        if (!window.confirm(ask)) return
        await deleteMedia(m.id)
        onDeleted()
      }}
      className="flex items-center justify-center gap-2 rounded-md py-2 text-[12.5px] text-muted hover:bg-live/10 hover:text-live"
    >
      <Trash2 size={14} /> {m.linked ? t('media.removeFromLibrary') : t('media.deleteFromLibrary')}
    </button>
  )
}

function AudioDetail({ m, onDeleted }: { m: MediaItem; onDeleted: () => void }) {
  const renameMedia = useApp((s) => s.renameMedia)
  useT()
  const { playlist, add, playMedia } = usePlayer()
  const inList = playlist.includes(m.id)
  return (
    <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-line bg-panel p-4">
      <div className="aspect-video overflow-hidden rounded-lg ring-1 ring-line">
        <MediaThumb m={m} large />
      </div>
      <div>
        <input
          key={m.id}
          defaultValue={m.name}
          onBlur={(e) => e.target.value !== m.name && renameMedia(m.id, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full rounded bg-transparent px-1 py-0.5 text-[14px] font-semibold outline-none hover:bg-panel-2 focus:bg-panel-2"
        />
        <div className="flex items-center gap-1.5 px-1 text-[11.5px] text-muted">
          <Music size={12} /> {t('media.kind.audio')} · {formatBytes(m.size)}
        </div>
      </div>
      <audio src={mediaUrl(m.ref)} controls className="w-full" />
      <div className="flex flex-col gap-2">
        <div className="label-caps">{t('media.musicPlayer')}</div>
        <button
          onClick={() => playMedia(m.id)}
          className="flex items-center justify-center gap-2 rounded-md bg-accent-fill py-2 text-[13px] font-semibold text-on-accent hover:brightness-110"
        >
          <Music size={15} /> {t('media.playInPlayer')}
        </button>
        <button
          onClick={() => add([m.id])}
          disabled={inList}
          className="flex items-center justify-center gap-2 rounded-md border border-line py-2 text-[13px] hover:border-accent hover:text-accent-text disabled:opacity-50"
        >
          <ListPlus size={15} /> {inList ? t('media.inPlaylist') : t('media.addToPlaylist')}
        </button>
        <p className="text-[11px] text-dim">{t('media.musicHint')}</p>
      </div>
      <div className="flex-1" />
      <FileInfo m={m} />
      <DeleteButton m={m} onDeleted={onDeleted} />
    </aside>
  )
}

function DeckDetail({ m, onDeleted }: { m: MediaItem; onDeleted: () => void }) {
  useT()
  const { renameMedia, addDeckToService, setTab } = useApp()
  const inService = useApp((s) => s.service.items.filter((it) => it.kind === 'deck' && it.sourceId === m.id).length)
  const pages = m.deck?.pages ?? []
  const withNotes = pages.filter((p) => p.notes).length
  return (
    <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-line bg-panel p-4">
      <div className="aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-line">
        <MediaThumb m={m} large />
      </div>
      <div>
        <input
          key={m.id}
          defaultValue={m.name}
          onBlur={(e) => e.target.value !== m.name && renameMedia(m.id, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full rounded bg-transparent px-1 py-0.5 text-[14px] font-semibold outline-none hover:bg-panel-2 focus:bg-panel-2"
        />
        <div className="flex items-center gap-1.5 px-1 text-[11.5px] text-muted">
          <Presentation size={12} /> {m.deck?.source.toUpperCase()} · {pagesLabel(m)} · {formatBytes(m.size)}
        </div>
        {withNotes > 0 && (
          <div className="mt-1 flex items-center gap-1.5 px-1 text-[11.5px] text-muted">
            <StickyNote size={12} /> {tn('media.speakerNotes', withNotes)}
          </div>
        )}
      </div>
      <button
        onClick={() => {
          addDeckToService(m)
          setTab('presentation')
        }}
        className="flex items-center justify-center gap-2 rounded-md bg-accent-fill py-2 text-[13px] font-semibold text-on-accent hover:brightness-110"
      >
        <ListPlus size={15} /> {t('media.addToService')}
      </button>
      {inService > 0 && (
        <p className="-mt-2 text-center text-[11px] text-dim">
          {t('media.inServiceOrder')}
          {inService > 1 ? ` ${inService}×` : ''}
        </p>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        {pages.slice(0, 60).map((p, i) => (
          <div key={p.ref} className="relative aspect-video overflow-hidden rounded bg-black ring-1 ring-line" title={p.notes}>
            <img src={mediaUrl(p.ref)} loading="lazy" className="h-full w-full object-contain" draggable={false} />
            <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 text-[9.5px] text-white/85">{i + 1}</span>
          </div>
        ))}
      </div>
      {pages.length > 60 && <p className="-mt-2 text-[11px] text-dim">{t('media.andMore', { count: pages.length - 60 })}</p>}
      <div className="flex-1" />
      <FileInfo m={m} />
      <DeleteButton m={m} onDeleted={onDeleted} />
    </aside>
  )
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md bg-panel-2 px-3 py-1.5 text-[12.5px]">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--color-accent)]" />
    </label>
  )
}

