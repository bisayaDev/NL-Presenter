import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Caption } from '@shared/types'

/**
 * Lower-third name caption ("Ptr. Juan Dela Cruz · Senior Pastor"): slides in at the lower left with an accent bar,
 * and slides out when hidden. `u(n)` turns "n % of the screen height" into a CSS length, so the same card works in
 * container units (OBS overlay) and in pixels on the 1920×1080 virtual stage (audience screen).
 */
export function CaptionCard({
  caption,
  u,
  left,
  bottom,
  fontFamily
}: {
  caption: Caption | null | undefined
  u: (n: number) => string
  left: string
  bottom: number // % of the screen height
  fontFamily?: string
}) {
  const [shown, setShown] = useState<Caption | null>(caption ?? null)
  const el = useRef<HTMLDivElement>(null)
  const key = caption ? `${caption.name}\n${caption.title}` : ''

  // A new caption replaces the old one at once; hiding plays the slide-out first.
  useEffect(() => {
    if (caption) return setShown(caption)
    const node = el.current
    if (!node || !shown) return
    const a = node.animate(
      [
        { transform: 'translateX(0)', opacity: 1 },
        { transform: 'translateX(-30%)', opacity: 0 }
      ],
      { duration: 350, easing: 'ease-in', fill: 'forwards' }
    )
    a.onfinish = () => setShown(null)
    return () => a.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useLayoutEffect(() => {
    el.current?.animate(
      [
        { transform: 'translateX(-30%)', opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 }
      ],
      { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' }
    )
  }, [shown?.name, shown?.title])

  if (!shown) return null
  return (
    <div
      ref={el}
      className="absolute flex items-stretch"
      style={{ left, bottom: u(bottom), transition: 'bottom 300ms ease', maxWidth: '70%', fontFamily: fontFamily ?? 'Inter, system-ui, sans-serif' }}
    >
      <div style={{ width: u(0.8), background: 'var(--color-accent, #7c6cff)', borderRadius: `${u(0.3)} 0 0 ${u(0.3)}` }} />
      <div
        style={{
          background: 'linear-gradient(90deg, rgba(10,12,18,.88), rgba(10,12,18,.72))',
          padding: `${u(1.3)} ${u(3)} ${u(1.4)} ${u(2)}`,
          borderRadius: `0 ${u(0.6)} ${u(0.6)} 0`,
          color: '#fff',
          minWidth: 0
        }}
      >
        {shown.name && (
          <div style={{ fontSize: u(4.2), fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {shown.name}
          </div>
        )}
        {shown.title && (
          <div
            style={{
              fontSize: u(2.6),
              fontWeight: 500,
              lineHeight: 1.25,
              opacity: 0.8,
              marginTop: shown.name ? u(0.3) : 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {shown.title}
          </div>
        )}
      </div>
    </div>
  )
}

/** The caption on the audience screen (inside SlideView's virtual stage, so sizes are in px). */
export default function CaptionLayer({ caption, w, h }: { caption: Caption | null | undefined; w: number; h: number }) {
  return <CaptionCard caption={caption} u={(n) => `${(n * h) / 100}px`} left={`${w * 0.05}px`} bottom={8} />
}
