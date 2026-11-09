// The NLPresenter mark (traced from logo.jpeg). Drawn in currentColor so it works on dark and light.
export const MARK_VIEWBOX = '548 537 855 499'
export const MARK_PATHS = [
  // N: rounded top-left, diagonal into the cut right stem.
  'M548 1036V640Q548 537 655 537Q703 537 735 578L942 812V970L662 648Q650 637 650 660V1036Z',
  // L: rounded bottom-left, slanted foot.
  'M963 537H1065V915Q1065 935 1085 935H1316L1403 1036H1030Q963 1036 963 970Z'
]

export function BrandMark({ className, style, title }: { className?: string; style?: React.CSSProperties; title?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} style={style} fill="currentColor" role="img" aria-label={title ?? 'NL'}>
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/** Mark with the PRESENTER wordmark underneath, like the printed logo. */
export function BrandLockup({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <div className={`flex flex-col items-center ${className ?? ''}`} style={{ gap: size * 0.14 }}>
      <BrandMark style={{ height: size }} className="block" />
      <span className="font-semibold leading-none" style={{ fontSize: size * 0.42, letterSpacing: '0.16em', marginRight: '-0.16em' }}>
        PRESENTER
      </span>
    </div>
  )
}
