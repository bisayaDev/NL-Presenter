import { BadgeInfo, Eye, EyeOff, Save, Trash2 } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { useT } from '@/i18n'

const AUTO_HIDE = [0, 8, 15]

/** Stage & OBS tab: lower-third name captions for the livestream ("Ptr. Juan Dela Cruz · Senior Pastor"). */
export default function CaptionPanel() {
  const c = useApp((s) => s.caption)
  const presets = useApp((s) => s.captionPresets)
  const { t } = useT()
  const { setCaption, showCaption, hideCaption, saveCaptionPreset, deleteCaptionPreset } = useApp.getState()
  const empty = !c.name.trim() && !c.title.trim()
  const saved = presets.some((p) => p.name === c.name.trim() && p.title === c.title.trim())

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center gap-2">
        <BadgeInfo size={15} className="text-accent-text" />
        <span className="label-caps">{t('stage.caption.title')}</span>
        {c.visible && <span className="ml-auto whitespace-nowrap rounded bg-live px-1.5 py-px text-[10px] font-bold uppercase text-white">{t('stage.caption.onAir')}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <input
          value={c.name}
          maxLength={60}
          onChange={(e) => setCaption({ name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && showCaption()}
          placeholder={t('stage.caption.namePlaceholder')}
          className="h-9 rounded-md bg-panel-2 px-3 text-[13px] outline-none placeholder:text-dim focus:ring-1 focus:ring-accent/50"
        />
        <input
          value={c.title}
          maxLength={80}
          onChange={(e) => setCaption({ title: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && showCaption()}
          placeholder={t('stage.caption.titlePlaceholder')}
          className="h-9 rounded-md bg-panel-2 px-3 text-[13px] outline-none placeholder:text-dim focus:ring-1 focus:ring-accent/50"
        />
      </div>

      <div className="flex gap-2">
        {c.visible ? (
          <button
            onClick={hideCaption}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-live/15 py-2 text-[13px] font-semibold text-live hover:bg-live/25"
          >
            <EyeOff size={14} /> {t('stage.caption.hide')}
          </button>
        ) : (
          <button
            onClick={() => showCaption()}
            disabled={empty}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-fill py-2 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
          >
            <Eye size={14} /> {t('stage.caption.show')}
          </button>
        )}
        <button
          onClick={saveCaptionPreset}
          disabled={empty || saved}
          title={t('stage.caption.saveHint')}
          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] text-muted hover:text-fg disabled:opacity-40"
        >
          <Save size={14} /> {t('common.save')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="label-caps mb-1 truncate">{t('stage.caption.hideAfter')}</div>
          <div className="flex rounded-md bg-panel-2 p-0.5 text-[12px]">
            {AUTO_HIDE.map((n) => (
              <button
                key={n}
                onClick={() => setCaption({ autoHide: n })}
                className={`flex-1 rounded py-1 ${c.autoHide === n ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'}`}
              >
                {n ? t('stage.caption.seconds', { n }) : t('common.off')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label-caps mb-1 truncate">{t('stage.caption.showOn')}</div>
          <div className="flex rounded-md bg-panel-2 p-0.5 text-[12px]">
            {(
              [
                ['overlay', t('stage.caption.overlay')],
                ['both', t('stage.caption.plusAudience')]
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setCaption({ target: id })}
                title={id === 'overlay' ? t('stage.caption.overlayHint') : t('stage.caption.bothHint')}
                className={`min-w-0 flex-1 truncate rounded px-1 py-1 ${c.target === id ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {presets.length > 0 && (
        <div>
          <div className="label-caps mb-1">{t('stage.caption.saved')}</div>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {presets.map((p, i) => {
              const on = c.visible && c.name.trim() === p.name && c.title.trim() === p.title
              return (
                <div key={`${p.name}|${p.title}`} className={`group flex items-center rounded-md ${on ? 'bg-accent-soft' : 'bg-panel-2 hover:bg-panel-3'}`}>
                  <button
                    onClick={() => showCaption(p)}
                    title={t('stage.caption.showThis')}
                    className="min-w-0 flex-1 px-3 py-1.5 text-left"
                  >
                    <span className="block truncate text-[12.5px] font-medium">{p.name || p.title}</span>
                    {p.name && p.title && <span className="block truncate text-[11px] text-muted">{p.title}</span>}
                  </button>
                  <button
                    onClick={() => deleteCaptionPreset(i)}
                    title={t('common.delete')}
                    className="mr-1 rounded p-1.5 text-dim opacity-0 hover:text-live group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
