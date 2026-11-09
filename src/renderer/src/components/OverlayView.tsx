import type { OverlayFrame, TextStyle } from '@shared/types'
import { countdownText, countdownTitle, useNow } from '@/lib/time'
import { useT } from '@/i18n'
import FitText from './FitText'
import { CaptionCard } from './CaptionLayer'
import { textEffects } from '@/lib/textEffects'
import { parallelOf } from '@shared/bible'
import { splitLanguages } from '@shared/bilingual'

/**
 * Transparent lyrics/scripture overlay for OBS, vMix and other browser sources.
 * Sized in container units, so the in-app preview and a 1920×1080 browser source look the same.
 */
export default function OverlayView({
  frame,
  style,
  offset = 0,
  className
}: {
  frame: OverlayFrame
  style: TextStyle
  offset?: number
  className?: string
}) {
  const { settings: o, slide } = frame
  const show = !!slide?.text && !frame.hidden
  const isScripture = !!slide?.reference
  const cols = parallelOf(slide)
  const stacked = slide?.parallelLayout === 'stacked'
  const words = splitLanguages(slide?.text ?? '')
  const box: React.CSSProperties = {
    position: 'absolute',
    left: '5cqw',
    right: '5cqw',
    height: `${o.size}cqh`,
    ...(o.position === 'lower' ? { bottom: '6cqh' } : o.position === 'top' ? { top: '6cqh' } : { top: `${(100 - o.size) / 2}cqh` })
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`} style={{ containerType: 'size' }}>
      {show && (
        <div
          key={slide!.text}
          className={`${!frame.transition ? 'overlay-fade' : frame.transition.kind === 'cut' ? '' : `nl-in-${frame.transition.kind}`} flex flex-col`}
          style={{
            ...box,
            ...(frame.transition && frame.transition.kind !== 'cut' ? { animationDuration: `${frame.transition.ms}ms` } : {}),
            background: o.band ? 'rgba(0,0,0,.62)' : 'transparent',
            borderRadius: o.band ? '1.2cqh' : 0,
            padding: o.band ? '1.4cqh 2.4cqw' : 0
          }}
        >
          <FitText
            deps={[slide!.text, slide!.parallel, slide!.parallelLayout, o.size, o.position, o.band, o.showReference, isScripture]}
            max={400}
            min={6}
            className="flex flex-1 items-center justify-center"
            style={{
              fontFamily: style.fontFamily,
              fontWeight: isScripture ? Math.min(style.fontWeight, 600) : style.fontWeight,
              color: style.color,
              textAlign: 'center',
              whiteSpace: 'pre-line',
              textTransform: style.uppercase && !isScripture ? 'uppercase' : 'none',
              ...overlayEffects(style, o.band),
              ...(slide!.parallel ? { width: '100%' } : {})
            }}
          >
            {cols.length ? (
              // Two or three translations, side by side or stacked, each with its reference underneath.
              <div className={`flex ${stacked ? 'flex-col' : 'items-center'}`} style={{ gap: stacked ? '0.4em' : '1em' }}>
                {[{ text: slide!.text, reference: slide!.reference ?? '' }, ...cols].map((col, i) => (
                  <div
                    key={i}
                    className="min-w-0 flex-1"
                    style={
                      i
                        ? stacked
                          ? { borderTop: `0.06em solid ${style.color}40`, paddingTop: '0.4em' }
                          : { borderLeft: `0.06em solid ${style.color}40`, paddingLeft: '1em' }
                        : undefined
                    }
                  >
                    {col.text}
                    {o.showReference && <div style={{ fontSize: '0.55em', fontWeight: 600, opacity: 0.85, marginTop: '0.3em' }}>{col.reference}</div>}
                  </div>
                ))}
              </div>
            ) : words.secondary !== null ? (
              // Bilingual song: the second language smaller, italic and softer under the first.
              <div>
                {words.primary}
                <div style={{ fontSize: '0.7em', fontStyle: 'italic', opacity: 0.8, marginTop: words.primary ? '0.3em' : 0 }}>{words.secondary}</div>
              </div>
            ) : (
              slide!.text
            )}
          </FitText>
          {isScripture && o.showReference && !slide!.parallel && (
            <div
              className="shrink-0 text-center font-semibold"
              style={{ fontFamily: style.fontFamily, color: style.color, opacity: 0.85, fontSize: `${Math.max(2, o.size * 0.12)}cqh` }}
            >
              {slide!.reference}
            </div>
          )}
        </div>
      )}
      {/* Name caption: lower left, above the lyrics band when that sits at the bottom. */}
      <CaptionCard
        caption={frame.caption}
        u={(n) => `${n}cqh`}
        left="5cqw"
        bottom={show && o.position === 'lower' ? 6 + o.size + 2 : 8}
        fontFamily={style.fontFamily}
      />
      {frame.countdown && <OverlayCountdown frame={frame} style={style} offset={offset} />}
      {frame.footer && show && (
        <div
          className="absolute"
          style={{
            left: '5cqw',
            bottom: '1.8cqh', // under the lyrics band when it sits low
            right: '5cqw',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: style.fontFamily,
            fontSize: '1.8cqh',
            color: 'rgba(255,255,255,.85)',
            textShadow: '0 0.1cqh 0.4cqh rgba(0,0,0,.9)'
          }}
        >
          {frame.footer}
        </div>
      )}
    </div>
  )
}

/** Style effects for the overlay; without the dark band it always keeps a strong shadow for readability. */
function overlayEffects(style: TextStyle, band: boolean): React.CSSProperties {
  const fx = textEffects(style, { shadow: false })
  const shadows = [fx.textShadow, band ? '' : '0 0.08em 0.25em rgba(0,0,0,.85), 0 0 0.08em rgba(0,0,0,.9)'].filter((x) => x && x !== 'none')
  return { ...fx, textShadow: shadows.length ? shadows.join(', ') : 'none' }
}

function OverlayCountdown({ frame, style, offset }: { frame: OverlayFrame; style: TextStyle; offset: number }) {
  const now = useNow(offset)
  useT() // the default title follows the language
  const c = frame.countdown!
  const { text, over } = countdownText(c, now)
  return (
    <div
      className="absolute right-[3cqw] top-[4cqh] rounded-[1.2cqh] text-center"
      style={{ background: 'rgba(0,0,0,.62)', padding: '1.2cqh 2cqw', fontFamily: style.fontFamily }}
    >
      {c.title && (
        <div className="font-semibold text-white/75" style={{ fontSize: '2.2cqh' }}>
          {countdownTitle(c.title)}
        </div>
      )}
      <div className="font-bold tabular-nums leading-none" style={{ fontSize: '7cqh', color: over ? '#f87171' : '#fff' }}>
        {text}
      </div>
    </div>
  )
}
