import { useEffect, useState } from 'react'
import { Maximize } from 'lucide-react'
import SlideView from '@/components/SlideView'
import { DEFAULT_BG, DEFAULT_STYLE } from '@/lib/defaults'
import { useLanConnection } from '@/lib/net'
import { useWakeLock } from './StageApp'
import { useT } from '@/i18n'

/**
 * Wireless audience screen: any browser on the network (a TV, a laptop in the lobby, a tablet) mirrors the
 * projector. Read-only, no PIN. The first tap goes full screen and lets the browser play sound.
 */
export default function DisplayApp() {
  const conn = useLanConnection('display')
  const [hint, setHint] = useState(true)
  const [tapped, setTapped] = useState(false)
  const { t } = useT() // this browser's choice, else the operator's language
  useWakeLock()

  useEffect(() => {
    document.body.style.background = '#000'
    // Hide the cursor when the mouse stops (TVs and laptops).
    let t: ReturnType<typeof setTimeout>
    const move = (): void => {
      document.body.style.cursor = ''
      clearTimeout(t)
      t = setTimeout(() => (document.body.style.cursor = 'none'), 2500)
    }
    move()
    window.addEventListener('mousemove', move)
    const h = setTimeout(() => setHint(false), 6000)
    return () => {
      window.removeEventListener('mousemove', move)
      clearTimeout(t)
      clearTimeout(h)
    }
  }, [])

  const goFull = (): void => {
    setTapped(true)
    setHint(false)
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
    if (document.fullscreenElement) return
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
    else el.webkitRequestFullscreen?.()
  }

  const f = conn.snap?.frame
  return (
    <div className="relative h-[100dvh] w-screen bg-black" onClick={goFull}>
      <SlideView
        key={tapped ? 'sound' : 'quiet'} // remount after the first tap so videos retry with sound
        slide={f?.slide ?? null}
        background={f?.background ?? DEFAULT_BG}
        style={f?.style ?? DEFAULT_STYLE}
        aspect={f?.aspect ?? '16:9'}
        hideText={f?.hideText}
        black={f?.black}
        countdown={f?.countdown}
        logo={f?.logo}
        caption={f?.caption ?? null}
        motion={f?.transition}
        video={f?.video}
        footer={f?.footer}
        ticker={f?.ticker}
        clockOffset={conn.offset}
        audio
        liveSources
        className="h-full w-full"
      />
      {!conn.snap && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/50">
          {conn.state === 'offline' ? t('common.reconnecting') : t('common.connecting')}
        </div>
      )}
      {conn.snap && conn.state === 'offline' && (
        <div className="absolute right-3 top-3 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">{t('stage.app.offline')}</div>
      )}
      {hint && conn.snap && (
        <div className="absolute bottom-6 left-1/2 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-black/70 px-4 py-2 text-[13px] text-white/85 ring-1 ring-white/15">
          <Maximize size={14} className="shrink-0" /> <span className="truncate">{t('stage.display.fullScreen')}</span>
        </div>
      )}
    </div>
  )
}
