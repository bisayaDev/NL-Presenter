import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  ListPlus,
  Music,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'
import { useApp } from '@/store/useApp'
import { formatTime, selectTracks, usePlayer } from '@/store/usePlayer'
import { useT } from '@/i18n'

const REPEAT_KEY = { off: 'topbar.player.repeatOff', all: 'topbar.player.repeatAll', one: 'topbar.player.repeatOne' } as const

const W = 340

/** Floating, draggable, collapsible music player. */
export default function AudioPlayer() {
  const p = usePlayer()
  const { t } = useT()
  const tracks = selectTracks(p)
  const media = useApp((s) => s.media)
  const importMedia = useApp((s) => s.importMedia)
  const [adding, setAdding] = useState(false)
  const [muted, setMuted] = useState<number | null>(null) // volume before mute
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const current = tracks.find((t) => t.id === p.current) ?? null
  const available = media.filter((m) => m.kind === 'audio' && !p.playlist.includes(m.id))

  // Keep the player inside the window when it is resized.
  const clamp = (x: number, y: number): { x: number; y: number } => {
    const h = box.current?.offsetHeight ?? 120
    return { x: Math.min(Math.max(8, x), window.innerWidth - W - 8), y: Math.min(Math.max(8, y), window.innerHeight - h - 8) }
  }
  useEffect(() => {
    const onResize = (): void => {
      const pos = usePlayer.getState().pos
      if (pos) usePlayer.getState().setPos(clamp(pos.x, pos.y))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onPointerDown = (e: React.PointerEvent): void => {
    if ((e.target as HTMLElement).closest('button')) return
    const r = box.current!.getBoundingClientRect()
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    if (drag.current) p.setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy))
  }

  const pos = p.pos ?? { x: window.innerWidth - W - 360, y: window.innerHeight - (p.collapsed ? 120 : 470) }
  const RepeatIcon = p.repeat === 'one' ? Repeat1 : Repeat
  const removeLabel = t('common.remove') // `t` is a track inside the playlist map below

  return (
    <div
      ref={box}
      className="fixed z-40 flex flex-col overflow-hidden rounded-xl border border-line bg-panel-2/95 shadow-2xl backdrop-blur"
      style={{ left: pos.x, top: pos.y, width: W }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex h-9 shrink-0 cursor-grab items-center gap-2 border-b border-line px-3 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
      >
        <Music size={14} className="text-accent-text" />
        <span className="flex-1 truncate text-[12px] font-semibold">{t('topbar.player.music')}</span>
        <GripHorizontal size={14} className="text-dim" />
        <button
          onClick={() => p.setCollapsed(!p.collapsed)}
          title={p.collapsed ? t('topbar.player.showPlaylist') : t('topbar.player.hidePlaylist')}
          className="rounded p-0.5 text-muted hover:text-fg"
        >
          {p.collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        <button onClick={() => p.setOpen(false)} title={t('topbar.player.closeHint')} className="rounded p-0.5 text-muted hover:text-fg">
          <X size={15} />
        </button>
      </div>

      <div className="flex flex-col gap-2 px-3 py-2.5">
        <div className="truncate text-[13px] font-medium">{current?.name ?? (tracks.length ? t('topbar.player.ready') : t('topbar.player.noSongs'))}</div>
        <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted">
          <span className="w-9">{formatTime(p.time)}</span>
          <input
            type="range"
            min={0}
            max={p.duration || 0}
            step={0.1}
            value={Math.min(p.time, p.duration || 0)}
            onChange={(e) => p.seek(Number(e.target.value))}
            disabled={!current}
            className="h-1 flex-1 accent-[var(--color-accent)]"
            aria-label={t('topbar.player.seek')}
          />
          <span className="w-9 text-right">{formatTime(p.duration)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Btn onClick={p.toggleShuffle} active={p.shuffle} title={t('topbar.player.shuffle')}>
            <Shuffle size={15} />
          </Btn>
          <Btn onClick={p.prev} title={t('common.previous')}>
            <SkipBack size={16} />
          </Btn>
          <button
            onClick={p.toggle}
            disabled={!tracks.length}
            title={p.playing ? t('topbar.player.pause') : t('topbar.player.play')}
            className="grid h-9 w-9 place-items-center rounded-full bg-accent-fill text-on-accent hover:brightness-110 disabled:opacity-40"
          >
            {p.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
          </button>
          <Btn onClick={() => p.next()} title={t('common.next')}>
            <SkipForward size={16} />
          </Btn>
          <Btn onClick={p.stop} title={t('topbar.player.stop')}>
            <Square size={13} fill="currentColor" />
          </Btn>
          <Btn onClick={p.cycleRepeat} active={p.repeat !== 'off'} title={t(REPEAT_KEY[p.repeat])}>
            <RepeatIcon size={15} />
          </Btn>
          <div className="flex flex-1 items-center gap-1 pl-1">
            <button
              onClick={() => {
                if (muted !== null) {
                  p.setVolume(muted)
                  setMuted(null)
                } else {
                  setMuted(p.volume)
                  p.setVolume(0)
                }
              }}
              title={muted !== null ? t('topbar.player.unmute') : t('topbar.player.mute')}
              className="text-muted hover:text-fg"
            >
              {p.volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={p.volume}
              onChange={(e) => {
                setMuted(null)
                p.setVolume(Number(e.target.value))
              }}
              className="h-1 min-w-0 flex-1 accent-[var(--color-accent)]"
              aria-label={t('topbar.player.volume')}
            />
          </div>
        </div>
      </div>

      {!p.collapsed && (
        <div className="flex max-h-60 flex-col border-t border-line">
          <div className="flex h-8 shrink-0 items-center justify-between px-3">
            <span className="label-caps truncate">{t('topbar.player.playlist', { count: tracks.length })}</span>
            <div className="flex gap-0.5">
              <Btn onClick={() => setAdding((a) => !a)} active={adding} title={t('topbar.player.addFromLibrary')}>
                <ListPlus size={14} />
              </Btn>
              <Btn
                onClick={async () => {
                  const r = await importMedia(undefined, 'audio')
                  const ids = r.added.filter((m) => m.kind === 'audio').map((m) => m.id)
                  if (ids.length) p.add(ids)
                }}
                title={t('topbar.player.importFiles')}
              >
                <Upload size={14} />
              </Btn>
              {tracks.length > 0 && (
                <Btn onClick={() => window.confirm(t('topbar.player.confirmClear')) && p.clear()} title={t('topbar.player.clear')}>
                  <Trash2 size={14} />
                </Btn>
              )}
            </div>
          </div>
          {adding && (
            <div className="max-h-28 shrink-0 overflow-y-auto border-y border-line bg-panel px-1 py-1">
              {available.length === 0 ? (
                <div className="px-2 py-1.5 text-[11.5px] text-dim">{t('topbar.player.noOther')}</div>
              ) : (
                available.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => p.add([m.id])}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] text-fg/85 hover:bg-panel-3"
                  >
                    <Plus size={12} className="text-accent-text" />
                    <span className="truncate">{m.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
            {tracks.length === 0 && !adding && (
              <div className="px-2 py-3 text-center text-[11.5px] text-dim">{t('topbar.player.emptyHint')}</div>
            )}
            {tracks.map((t, i) => {
              const active = t.id === p.current
              return (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/nl-track', String(i))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const from = Number(e.dataTransfer.getData('text/nl-track'))
                    if (Number.isFinite(from) && from !== i) p.move(p.playlist.indexOf(tracks[from].id), p.playlist.indexOf(t.id))
                  }}
                  onDoubleClick={() => p.playMedia(t.id)}
                  className={`group flex items-center gap-2 rounded px-2 py-1 text-[12px] ${active ? 'bg-accent-soft text-fg' : 'text-fg/80 hover:bg-panel-3'}`}
                >
                  <span className="w-4 text-right text-[10.5px] text-dim">{active && p.playing ? '♪' : i + 1}</span>
                  <button onClick={() => p.playMedia(t.id)} className="min-w-0 flex-1 truncate text-left">
                    {t.name}
                  </button>
                  <button onClick={() => p.remove(t.id)} title={removeLabel} className="text-dim opacity-0 hover:text-live group-hover:opacity-100">
                    <X size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Btn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`grid h-7 w-7 place-items-center rounded-md ${active ? 'text-accent-text' : 'text-muted hover:bg-panel-3 hover:text-fg'}`}
    >
      {children}
    </button>
  )
}
