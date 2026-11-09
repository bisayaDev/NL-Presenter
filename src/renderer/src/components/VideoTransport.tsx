import { useEffect, useState } from 'react'
import { Pause, Play, Repeat, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { formatTime, videoPosition } from '@/lib/video'
import { useT } from '@/i18n'

/** Controls for the live video background: play/pause, restart, scrub, mute, loop. Every screen follows. */
export default function VideoTransport() {
  const video = useApp((s) => s.video)
  const videoCtl = useApp((s) => s.videoCtl)
  const { t } = useT()
  const [now, setNow] = useState(Date.now())
  const [drag, setDrag] = useState<number | null>(null)
  useEffect(() => {
    if (!video?.playing) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [video?.playing])
  if (!video) return null
  const d = video.duration
  const pos = drag ?? videoPosition(video, video.playing ? now : Date.now(), d)
  const btn = 'grid h-7 w-7 shrink-0 place-items-center rounded-md text-fg/85 hover:bg-panel-3 hover:text-fg'
  return (
    <div className="mt-2 rounded-lg border border-line bg-panel-2 px-2 py-1.5">
      <div className="flex items-center gap-1">
        <button className={btn} onClick={() => videoCtl({ type: 'toggle' })} title={video.playing ? t('live.video.pause') : t('live.video.play')}>
          {video.playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <button className={btn} onClick={() => videoCtl({ type: 'restart' })} title={t('live.video.restart')}>
          <RotateCcw size={14} />
        </button>
        <input
          type="range"
          min={0}
          max={d ?? 1}
          step={0.1}
          value={Math.min(pos, d ?? 1)}
          disabled={!d}
          onChange={(e) => setDrag(Number(e.target.value))}
          onPointerUp={() => {
            if (drag !== null) videoCtl({ type: 'seek', t: drag })
            setDrag(null)
          }}
          onKeyUp={() => {
            if (drag !== null) videoCtl({ type: 'seek', t: drag })
            setDrag(null)
          }}
          className="min-w-0 flex-1 accent-[var(--color-accent)]"
          title={t('live.video.seek')}
        />
        <span className="w-11 shrink-0 text-right text-[11px] tabular-nums text-muted" title={t('live.video.timeLeft')}>
          {d ? `-${formatTime(Math.ceil(Math.max(0, d - pos) - 0.05))}` : '–:––'}
        </span>
        <button
          className={`${btn} ${video.muted ? 'text-amber-300' : ''}`}
          onClick={() => videoCtl({ type: 'mute' })}
          title={video.muted ? t('live.video.soundOff') : t('live.video.soundOn')}
        >
          {video.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <button
          className={`${btn} ${video.loop ? 'bg-accent-soft text-accent-text' : ''}`}
          onClick={() => videoCtl({ type: 'loop' })}
          title={video.loop ? t('live.video.loops') : t('live.video.playsOnce')}
        >
          <Repeat size={14} />
        </button>
      </div>
    </div>
  )
}
