import { useEffect, useRef, useState } from 'react'
import { Music } from 'lucide-react'
import type { MediaItem } from '@shared/types'
import { mediaUrl } from '@/lib/media'
import { DEFAULT_STYLE } from '@/lib/defaults'
import { backgroundFor } from '@/store/useApp'
import SlideView from './SlideView'

/** Preview of a library entry. `large` plays videos and animates loops. */
export default function MediaThumb({ m, large }: { m: MediaItem; large?: boolean }) {
  if (m.kind === 'deck')
    return <img src={mediaUrl(m.ref)} loading="lazy" className="h-full w-full bg-black object-contain" draggable={false} />
  if (m.kind === 'image') return <img src={mediaUrl(m.ref)} loading="lazy" className="h-full w-full object-cover" draggable={false} />
  if (m.kind === 'video')
    return large ? (
      <video src={mediaUrl(m.ref)} className="h-full w-full object-cover" autoPlay loop muted playsInline />
    ) : (
      <LazyVideo src={`${mediaUrl(m.ref)}#t=0.5`} />
    )
  if (m.kind === 'loop') {
    const bg = backgroundFor(m)!
    // Loops are drawn for a 1920-wide screen, so preview them on a scaled stage.
    return <SlideView slide={null} background={bg} style={DEFAULT_STYLE} aspect="16:9" thumbnail={!large} className="h-full w-full" />
  }
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#241f45] to-[#0d0f16]">
      <Music size={large ? 40 : 26} className="text-[#a99dff]" />
    </div>
  )
}

/** A still frame of a video, loaded only once it scrolls into view (linked folders can hold hundreds). */
function LazyVideo({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setSeen(true), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return (
    <div ref={ref} className="h-full w-full">
      {seen && <video src={src} preload="metadata" className="h-full w-full object-cover" muted playsInline />}
    </div>
  )
}
