import { useEffect, useRef } from 'react'
import { DEFAULT_LABEL_COLORS, LABEL_PALETTE, labelColor, labelKey } from '@shared/labels'
import { useApp } from '@/store/useApp'
import { useModal } from '@/lib/modal'
import { useT } from '@/i18n'

/** The color of a slide label, from the store (undefined: draw in the accent color). */
export function useLabelColor(label: string | undefined): string | undefined {
  const custom = useApp((s) => s.labelColors)
  return labelColor(label, custom)
}

/**
 * A small floating palette for one label name. Picking a color colors every slide with that label
 * ("Verse 1" and "Verse 2" share the "Verse" color).
 */
export default function LabelColorPicker({ label, at, onClose }: { label: string; at: { x: number; y: number }; onClose: () => void }) {
  const custom = useApp((s) => s.labelColors)
  const setLabelColor = useApp((s) => s.setLabelColor)
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useT()
  useModal()
  const key = labelKey(label)
  const current = labelColor(label, custom)
  useEffect(() => {
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc, true)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc, true)
    }
  }, [onClose])
  const name = key.replace(/(^|[\s-])\w/g, (c) => c.toUpperCase())
  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{ left: Math.min(at.x, window.innerWidth - 232), top: at.y }}
      className="fixed z-50 w-56 rounded-lg border border-line bg-panel-2 p-3 shadow-2xl"
    >
      <div className="label-caps mb-2">{t('presentation.colorFor', { name })}</div>
      <div className="grid grid-cols-5 gap-1.5">
        {LABEL_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => {
              setLabelColor(label, c)
              onClose()
            }}
            className={`h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-panel-2 ${current === c ? 'ring-fg/70' : 'ring-transparent'}`}
            style={{ background: c }}
            title={c}
          />
        ))}
        <input
          type="color"
          value={current ?? '#7c6cff'}
          onChange={(e) => setLabelColor(label, e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
          title={t('presentation.customColor')}
        />
      </div>
      {custom[key] && (
        <button onClick={() => setLabelColor(label, null)} className="mt-2 text-[11.5px] text-muted hover:text-fg">
          {DEFAULT_LABEL_COLORS[key] ? t('presentation.backToDefaultColor') : t('presentation.removeColor')}
        </button>
      )}
    </div>
  )
}
