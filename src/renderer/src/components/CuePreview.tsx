import { CornerDownLeft, Eye } from 'lucide-react'
import SlideView from './SlideView'
import { itemLook, slideBackground, useApp } from '@/store/useApp'
import { labelColor } from '@shared/labels'
import { useT } from '@/i18n'

/** "Preview first" mode: the cued slide, for the operator only. Go live with the button, Enter or a double-click. */
export default function CuePreview() {
  const state = useApp()
  const { t } = useT()
  if (state.clickMode !== 'preview') return null
  const item = state.cue ? state.service.items.find((i) => i.id === state.cue!.itemId) : undefined
  const slide = item?.slides[state.cue!.index] ?? null
  const look = itemLook(state, item) // drawn as the audience will see it
  const isLive = !!slide && state.live?.itemId === item?.id && state.live?.index === state.cue?.index

  // Nothing cued: one slim line, so the live picture and Service flow keep their room.
  if (!slide)
    return (
      <div
        className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-4 text-[11.5px] text-muted"
        title={t('live.cue.idleHint')}
      >
        <Eye size={13} className="shrink-0 text-amber-300" />
        <span className="truncate">{t('live.cue.idle')}</span>
      </div>
    )

  // Cued: a compact row, small picture on the left, details and Go live on the right.
  return (
    <div className="flex shrink-0 gap-3 border-b border-line px-4 py-2.5">
      <SlideView
        slide={slide}
        background={slideBackground(slide, item, look.background, state.mediaFit)}
        style={look.style}
        aspect={state.aspect}
        logo={state.logo}
        thumbnail
        className="aspect-video w-[148px] shrink-0 rounded-md ring-2 ring-amber-400/70"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-amber-300">
            <Eye size={12} /> {t('live.cue.preview')}
          </span>
          <div className="mt-0.5 truncate text-[11.5px] text-muted">{item!.title}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-dim">
            <span>
              {state.cue!.index + 1}/{item!.slides.length}
            </span>
            {slide.label && (
              <span className="truncate font-medium" style={{ color: labelColor(slide.label, state.labelColors) }}>
                {slide.label}
              </span>
            )}
            {isLive && <span className="text-live">{t('live.cue.isLive')}</span>}
          </div>
        </div>
        <button
          onClick={state.takeCue}
          title={t('live.cue.goLiveHint')}
          className="flex items-center justify-center gap-1.5 self-start rounded-md bg-amber-400/15 px-2.5 py-1 text-[12px] font-semibold text-amber-300 hover:bg-amber-400/25"
        >
          <span className="whitespace-nowrap">{t('live.cue.goLive')}</span> <CornerDownLeft size={13} />
        </button>
      </div>
    </div>
  )
}
