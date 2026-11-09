import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'

/**
 * Fills its box with the largest font size (up to `max` px) at which the content still fits.
 * Re-measures when the text or the box size changes.
 */
export default function FitText({
  children,
  max = 400,
  min = 10,
  deps,
  className,
  style
}: {
  children: ReactNode
  max?: number
  min?: number
  deps: unknown[]
  className?: string
  style?: CSSProperties
}) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const b = box.current
    const el = inner.current
    if (!b || !el) return
    const fit = (): void => {
      const W = b.clientWidth
      const H = b.clientHeight
      if (!W || !H) return
      let lo = min
      let hi = max
      // Binary search for the largest size that fits.
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        el.style.fontSize = `${mid}px`
        if (el.scrollWidth <= W && el.scrollHeight <= H) lo = mid
        else hi = mid
      }
      el.style.fontSize = `${lo}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(b)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return (
    <div ref={box} className={`relative min-h-0 min-w-0 overflow-hidden ${className ?? ''}`}>
      <div ref={inner} style={{ lineHeight: 1.2, ...style }}>
        {children}
      </div>
    </div>
  )
}
