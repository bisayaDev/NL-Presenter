import { useEffect, useState } from 'react'
import { AlignCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, Check, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type { Logo, Template, TextStyle, TransitionKind } from '@shared/types'
import { DEFAULT_STYLE } from '@/lib/defaults'
import { allTemplates, findTemplate, useApp } from '@/store/useApp'
import { useT } from '@/i18n'

// Fonts that exist on (nearly) every Mac and Windows machine; installed fonts are added when available.
const COMMON_FONTS = ['System UI', 'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Impact']

const toFamily = (name: string): string =>
  name === 'System UI' ? DEFAULT_STYLE.fontFamily : `'${name.replace(/'/g, '')}', system-ui, sans-serif`

const fromFamily = (family: string): string =>
  family === DEFAULT_STYLE.fontFamily ? 'System UI' : (family.match(/^'([^']+)'/)?.[1] ?? family.split(',')[0].trim())

/** Installed font families via the Local Font Access API (Chromium); falls back to the common list. */
function useInstalledFonts(): string[] {
  const [fonts, setFonts] = useState<string[]>(COMMON_FONTS)
  useEffect(() => {
    const q = (window as Window & { queryLocalFonts?: () => Promise<{ family: string }[]> }).queryLocalFonts
    q?.()
      .then((list) => {
        const families = [...new Set(list.map((f) => f.family))].sort((a, b) => a.localeCompare(b))
        if (families.length) setFonts(['System UI', ...families])
      })
      .catch(() => {})
  }, [])
  return fonts
}

const COLORS = ['#ffffff', '#fef3c7', '#fde68a', '#bae6fd', '#c7d2fe', '#000000']

/** Which style the panel edits: the global one (songs, text slides…) or Scripture's own. */
export type StyleTarget = 'main' | 'scripture'

export default function StylePanel({ onClose, initialTarget }: { onClose: () => void; initialTarget?: StyleTarget }) {
  const { setStyle, setScriptureStyle, logo, setLogo } = useApp()
  const mainStyle = useApp((s) => s.style)
  const scriptureStyle = useApp((s) => s.scriptureStyle)
  // Opened with a Scripture item selected: start on Scripture.
  const [target, setTarget] = useState<StyleTarget>(
    () => initialTarget ?? (useApp.getState().service.items.find((i) => i.id === useApp.getState().selectedItemId)?.kind === 'scripture' ? 'scripture' : 'main')
  )
  const scripture = target === 'scripture'
  const style = scripture ? (scriptureStyle ?? mainStyle) : mainStyle
  const fonts = useInstalledFonts()
  const current = fromFamily(style.fontFamily)
  const set = (patch: Partial<TextStyle>): void => (scripture ? setScriptureStyle(patch) : setStyle(patch))
  const { t } = useT()

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-line bg-panel">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 px-4">
        <span className="label-caps min-w-0 truncate">{t('style.title')}</span>
        <div className="flex shrink-0 gap-0.5">
          <button
            onClick={() => set(DEFAULT_STYLE)}
            title={t('style.resetHint')}
            className="rounded p-1.5 text-muted hover:bg-panel-2 hover:text-fg"
          >
            <RotateCcw size={14} />
          </button>
          <button onClick={onClose} title={t('common.close')} className="rounded p-1.5 text-muted hover:bg-panel-2 hover:text-fg">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-1 rounded-md bg-panel-2 p-0.5" role="tablist" aria-label={t('style.target.label')}>
            {(['main', 'scripture'] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={target === k}
                onClick={() => setTarget(k)}
                className={`truncate rounded py-1 text-[12px] ${target === k ? 'bg-accent-fill font-semibold text-on-accent' : 'text-muted hover:text-fg'}`}
              >
                {t(k === 'main' ? 'style.target.main' : 'style.target.scripture')}
              </button>
            ))}
          </div>
          {scripture && (
            <p className="flex items-start gap-2 text-[11.5px] leading-snug text-dim">
              <span className="min-w-0 flex-1">{scriptureStyle ? t('style.scripture.own') : t('style.scripture.follows')}</span>
              {scriptureStyle && (
                <button onClick={() => setScriptureStyle(null)} className="shrink-0 text-muted underline-offset-2 hover:text-fg hover:underline">
                  {t('style.scripture.useSongs')}
                </button>
              )}
            </p>
          )}
        </div>

        <TemplateControls target={target} style={style} />

        <Field label={t('style.font')}>
          <select
            value={fonts.includes(current) ? current : '__custom'}
            onChange={(e) => set({ fontFamily: toFamily(e.target.value) })}
            className="h-9 w-full rounded-md bg-panel-2 px-2 text-[13px] outline-none"
            style={{ fontFamily: style.fontFamily }}
          >
            {!fonts.includes(current) && <option value="__custom">{current}</option>}
            {fonts.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>

        <Slider label={t('style.size')} value={style.fontSize} min={36} max={180} step={2} unit="px" onChange={(v) => set({ fontSize: v })} />

        <Field label={t('style.weight')}>
          <div className="grid grid-cols-6 gap-1">
            {[400, 500, 600, 700, 800, 900].map((w) => (
              <button
                key={w}
                onClick={() => set({ fontWeight: w })}
                style={{ fontWeight: w }}
                className={`rounded py-1 text-[12px] ${style.fontWeight === w ? 'bg-accent-fill text-on-accent' : 'bg-panel-2 text-muted hover:text-fg'}`}
              >
                {w / 100}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('style.color')}>
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => set({ color: c })}
                className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-panel ${
                  style.color.toLowerCase() === c ? 'ring-accent' : 'ring-transparent'
                }`}
                style={{ background: c, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.15)' }}
              />
            ))}
            <input
              type="color"
              value={style.color}
              onChange={(e) => set({ color: e.target.value })}
              className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent"
              title={t('style.customColor')}
            />
          </div>
        </Field>

        <Field label={t('style.horizontal')}>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                ['left', AlignLeft, t('style.alignLeft')],
                ['center', AlignCenter, t('style.alignCenter')],
                ['right', AlignRight, t('style.alignRight')]
              ] as const
            ).map(([a, Icon, title]) => (
              <button
                key={a}
                onClick={() => set({ align: a })}
                title={title}
                className={`grid place-items-center rounded py-1.5 ${style.align === a ? 'bg-accent-fill text-on-accent' : 'bg-panel-2 text-muted hover:text-fg'}`}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('style.vertical')}>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                ['top', AlignVerticalJustifyStart, t('style.top')],
                ['center', AlignVerticalJustifyCenter, t('style.middle')],
                ['bottom', AlignVerticalJustifyEnd, t('style.bottom')]
              ] as const
            ).map(([a, Icon, title]) => (
              <button
                key={a}
                onClick={() => set({ valign: a })}
                title={title}
                className={`grid place-items-center rounded py-1.5 ${(style.valign ?? 'center') === a ? 'bg-accent-fill text-on-accent' : 'bg-panel-2 text-muted hover:text-fg'}`}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </Field>

        <Slider label={t('style.sideMargin')} value={style.marginX ?? 110} min={0} max={600} step={10} unit="px" onChange={(v) => set({ marginX: v })} />
        <Slider label={t('style.verticalMargin')} value={style.marginY ?? 110} min={0} max={400} step={10} unit="px" onChange={(v) => set({ marginY: v })} />

        <Slider
          label={t('style.lineHeight')}
          value={style.lineHeight}
          min={0.9}
          max={1.8}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => set({ lineHeight: v })}
        />

        <Slider
          label={t('style.letterSpacing')}
          value={style.letterSpacing ?? 0}
          min={-0.05}
          max={0.3}
          step={0.01}
          format={(v) => (v ? `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` : t('style.normal'))}
          onChange={(v) => set({ letterSpacing: Math.round(v * 100) / 100 })}
        />

        <div className="flex flex-col gap-1.5">
          <Toggle checked={style.uppercase} onChange={(v) => set({ uppercase: v })} label={t('style.uppercase')} />
          <Toggle checked={!!style.italic} onChange={(v) => set({ italic: v })} label={t('style.italic')} />
        </div>

        <div className="label-caps -mb-2 mt-1 border-t border-line pt-4">{t('style.effects')}</div>

        <Field label={t('style.shadow')}>
          <Segmented
            value={style.shadow ? (style.shadowStrength ?? 'medium') : 'off'}
            options={[
              ['off', t('common.off')],
              ['soft', t('style.soft')],
              ['medium', t('style.medium')],
              ['strong', t('style.strong')]
            ]}
            onChange={(v) => set(v === 'off' ? { shadow: false } : { shadow: true, shadowStrength: v as TextStyle['shadowStrength'] })}
          />
        </Field>

        <EffectSlider
          label={t('style.outline')}
          colorTitle={t('style.outlineColor')}
          value={style.outline ?? 0}
          color={style.outlineColor ?? '#000000'}
          onValue={(v) => set({ outline: v })}
          onColor={(c) => set({ outlineColor: c })}
        />
        <EffectSlider
          label={t('style.glow')}
          colorTitle={t('style.glowColor')}
          value={style.glow ?? 0}
          color={style.glowColor ?? '#ffffff'}
          onValue={(v) => set({ glow: v })}
          onColor={(c) => set({ glowColor: c })}
        />

        <Field label={t('style.textBackground')}>
          <Segmented
            value={style.textBg ?? 'off'}
            options={[
              ['off', t('common.off')],
              ['line', t('style.bgLines')],
              ['block', t('style.bgBlock')],
              ['full', t('style.bgFull')]
            ]}
            onChange={(v) => set({ textBg: v as TextStyle['textBg'] })}
          />
          {(style.textBg ?? 'off') !== 'off' && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={style.textBgColor ?? '#000000'}
                onChange={(e) => set({ textBgColor: e.target.value })}
                className="h-7 w-9 shrink-0 cursor-pointer rounded border-0 bg-transparent"
                title={t('style.bgColor')}
              />
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={style.textBgOpacity ?? 0.55}
                onChange={(e) => set({ textBgOpacity: Number(e.target.value) })}
                className="min-w-0 flex-1 accent-[var(--color-accent)]"
                title={t('style.opacity')}
              />
              <span className="w-9 text-right text-[11.5px] tabular-nums text-muted">{Math.round((style.textBgOpacity ?? 0.55) * 100)}%</span>
            </div>
          )}
        </Field>

        {/* One setting for every slide, so only under Songs & slides. */}
        {!scripture && <TransitionControls />}
        {!scripture && <LogoControls logo={logo} setLogo={setLogo} />}
      </div>
    </aside>
  )
}

/** Saved looks: apply one to the style being edited, save that style as a new one, rename, delete. */
function TemplateControls({ target, style }: { target: StyleTarget; style: TextStyle }) {
  const templates = useApp((s) => s.templates)
  const { saveTemplate, renameTemplate, deleteTemplate, applyTemplate } = useApp.getState()
  const selected = useApp((s) => s.service.items.find((i) => i.id === s.selectedItemId))
  const selectedLook = useApp((s) => findTemplate(s, selected?.templateId))
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [withBg, setWithBg] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const { t: tr } = useT()
  const sameAsCurrent = (t: Template): boolean => JSON.stringify({ ...DEFAULT_STYLE, ...t.style }) === JSON.stringify({ ...DEFAULT_STYLE, ...style })

  const save = (): void => {
    saveTemplate(name || tr('style.lookN', { n: templates.length + 1 }), withBg, style)
    setSaving(false)
    setName('')
    setWithBg(false)
  }
  const commitRename = (): void => {
    if (renaming) renameTemplate(renaming, draft)
    setRenaming(null)
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line p-3">
      <div className="label-caps">{tr('style.templates')}</div>
      {selectedLook && (
        <p className="rounded-md bg-amber-400/10 px-2 py-1.5 text-[11.5px] leading-snug text-amber-300">
          {tr('style.usesLook', { title: selected!.title, look: selectedLook.name })}
        </p>
      )}
      <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
        {allTemplates({ templates }).map((t) =>
          renaming === t.id ? (
            <input
              key={t.id}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setRenaming(null)
              }}
              className="h-7 rounded-md bg-panel-3 px-2 text-[12.5px] outline-none ring-1 ring-accent/50"
            />
          ) : (
            <div key={t.id} className="group flex items-center gap-1 rounded-md hover:bg-panel-2">
              <button
                onClick={() => applyTemplate(t.id, target)}
                title={t.background && target === 'main' ? tr('style.useStyleBg') : tr('style.useStyle')}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left text-[12.5px]"
              >
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {sameAsCurrent(t) && <Check size={13} className="shrink-0 text-accent-text" />}
                {t.background && target === 'main' && <span className="shrink-0 whitespace-nowrap text-[10px] text-dim">{tr('style.plusBg')}</span>}
                {t.builtin && <span className="max-w-[45%] shrink-0 truncate text-[10px] text-dim">{tr('style.builtIn')}</span>}
              </button>
              {!t.builtin && (
                <span className="flex shrink-0 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setRenaming(t.id)
                      setDraft(t.name)
                    }}
                    title={tr('common.rename')}
                    className="rounded p-1 text-dim hover:text-fg"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => window.confirm(tr('style.confirmDelete', { name: t.name })) && deleteTemplate(t.id)}
                    title={tr('common.delete')}
                    className="rounded p-1 text-dim hover:text-live"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              )}
            </div>
          )
        )}
      </div>
      {saving ? (
        <div className="mt-1 flex flex-col gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setSaving(false)
            }}
            placeholder={tr('style.namePlaceholder')}
            className="h-8 rounded-md bg-panel-2 px-2 text-[12.5px] outline-none focus:ring-1 focus:ring-accent/50"
          />
          <label className="flex items-center gap-2 text-[12px] text-muted">
            <input type="checkbox" checked={withBg} onChange={(e) => setWithBg(e.target.checked)} className="accent-[#7c6cff]" />
            {tr('style.includeBg')}
          </label>
          <div className="flex gap-1.5">
            <button onClick={save} className="flex-1 truncate rounded-md bg-accent-fill py-1.5 text-[12px] font-semibold text-on-accent hover:brightness-110">
              {tr('common.save')}
            </button>
            <button onClick={() => setSaving(false)} className="whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] text-muted hover:text-fg">
              {tr('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setSaving(true)}
          className="mt-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-line py-1.5 text-[12px] text-muted hover:border-accent/50 hover:text-accent-text"
        >
          <Plus size={13} className="shrink-0" /> <span className="truncate">{tr('style.saveAsTemplate')}</span>
        </button>
      )}
    </div>
  )
}

/** How slides change on the audience screen, wireless screens and the stream overlay (one setting for all songs). */
function TransitionControls() {
  const tr = useApp((s) => s.transition)
  const setTransition = useApp((s) => s.setTransition)
  const { t, locale } = useT()
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <Field label={t('style.transition')}>
        <Segmented
          value={tr.kind}
          options={[
            ['cut', t('style.cut')],
            ['fade', t('style.fade')],
            ['rise', t('style.rise')],
            ['zoom', t('style.zoom')]
          ]}
          onChange={(v) => setTransition({ kind: v as TransitionKind })}
        />
        <p className="mt-1.5 text-[11px] leading-snug text-dim">
          {t(`style.${tr.kind}Desc`)} {t('style.crossfadeNote')}
        </p>
      </Field>
      {tr.kind !== 'cut' && (
        <Slider
          label={t('style.duration')}
          value={tr.ms / 1000}
          min={0.1}
          max={1.5}
          step={0.1}
          format={(v) => t('style.seconds', { n: v.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
          onChange={(v) => setTransition({ ms: Math.round(v * 10) * 100 })}
        />
      )}
    </div>
  )
}

function LogoControls({ logo, setLogo }: { logo: Logo | null; setLogo: (l: Logo | null) => void }) {
  const { t } = useT()
  if (!logo)
    return (
      <div className="rounded-lg border border-dashed border-line p-3 text-[12px] text-muted">
        <div className="label-caps mb-1">{t('style.logo')}</div>
        {t('style.logoHint')}
      </div>
    )
  const set = (patch: Partial<Logo>): void => setLogo({ ...logo, ...patch })
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
      <div className="flex items-center justify-between">
        <span className="label-caps">{t('style.logo')}</span>
        <button onClick={() => setLogo(null)} className="text-[11.5px] text-muted hover:text-live">
          {t('common.remove')}
        </button>
      </div>
      <div className="grid w-24 grid-cols-2 gap-1">
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <button
            key={c}
            onClick={() => set({ corner: c })}
            title={{ tl: t('style.topLeft'), tr: t('style.topRight'), bl: t('style.bottomLeft'), br: t('style.bottomRight') }[c]}
            className={`h-7 rounded ${logo.corner === c ? 'bg-accent' : 'bg-panel-2 hover:bg-panel-3'}`}
          />
        ))}
      </div>
      <Slider label={t('style.size')} value={logo.size} min={3} max={30} step={1} unit="%" onChange={(v) => set({ size: v })} />
      <Slider
        label={t('style.opacity')}
        value={logo.opacity}
        min={0.1}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => set({ opacity: v })}
      />
      <label className="flex cursor-pointer items-center justify-between gap-2 text-[12.5px] text-muted">
        {t('style.logoOnStage')}
        <input type="checkbox" checked={!!logo.stage} onChange={(e) => set({ stage: e.target.checked || undefined })} className="accent-[var(--color-accent)]" />
      </label>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-caps mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  format,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="label-caps min-w-0 truncate">{label}</span>
        <span className="shrink-0 text-[11.5px] tabular-nums text-muted">{format ? format(value) : `${value}${unit}`}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-accent)]"
      />
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md bg-panel-2 px-3 py-1.5 text-[12.5px]">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--color-accent)]" />
    </label>
  )
}

function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          title={label}
          className={`truncate rounded py-1.5 text-[11.5px] ${value === v ? 'bg-accent-fill text-on-accent' : 'bg-panel-2 text-muted hover:text-fg'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** 0 = off, 1–10 strength, with a color swatch. */
function EffectSlider({
  label,
  colorTitle,
  value,
  color,
  onValue,
  onColor
}: {
  label: string
  colorTitle: string
  value: number
  color: string
  onValue: (v: number) => void
  onColor: (c: string) => void
}) {
  const { t } = useT()
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="label-caps min-w-0 truncate">{label}</span>
        <span className="shrink-0 text-[11.5px] tabular-nums text-muted">{value ? value : t('common.off')}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onValue(Number(e.target.value))}
          className="min-w-0 flex-1 accent-[var(--color-accent)]"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => onColor(e.target.value)}
          className="h-7 w-9 shrink-0 cursor-pointer rounded border-0 bg-transparent"
          title={colorTitle}
        />
      </div>
    </div>
  )
}
