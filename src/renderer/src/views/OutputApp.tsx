import { useEffect, useState } from 'react'
import type { Snapshot } from '@shared/types'
import SlideView from '@/components/SlideView'
import { DEFAULT_BG, DEFAULT_STYLE } from '@/lib/defaults'

/** The audience screen: draws whatever the operator window publishes. */
export default function OutputApp() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    document.body.style.cursor = 'none'
    const apply = (s: Snapshot | null): void => {
      if (!s) return
      setOffset(s.serverTime - Date.now())
      setSnap(s)
    }
    window.nl.state.get().then(apply)
    return window.nl.state.onSnapshot(apply)
  }, [])

  const frame = snap?.frame
  return (
    <SlideView
      slide={frame?.slide ?? null}
      background={frame?.background ?? DEFAULT_BG}
      style={frame?.style ?? DEFAULT_STYLE}
      aspect={frame?.aspect ?? '16:9'}
      hideText={frame?.hideText}
      black={frame?.black}
      countdown={frame?.countdown}
      logo={frame?.logo}
      caption={frame?.caption ?? null}
      motion={frame?.transition}
      video={frame?.video}
      footer={frame?.footer}
      ticker={frame?.ticker}
      clockOffset={offset}
      audio
      className="h-screen w-screen bg-black"
    />
  )
}
