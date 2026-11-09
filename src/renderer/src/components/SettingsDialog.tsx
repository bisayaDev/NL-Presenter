import { useEffect, useState } from 'react'
import { Archive, Check, CheckCircle2, Loader2, Pipette, RotateCcw, X } from 'lucide-react'
import type { BackupSummary, BibleInfo } from '@shared/types'
import { formatBytes } from '@/lib/media'
import { ACCENT_PRESETS, applyAccent, DEFAULT_ACCENT, saveAccent, ZOOM_STEPS } from '@/lib/appearance'
import { bootSettings, useApp } from '@/store/useApp'
import { useModal } from '@/lib/modal'
import { AutoBackupSettings, DisplaySection, MediaFitDefaultSection, QuickChatSection } from './SettingsExtras'
import { LANG_OPTIONS, setLang, t, tn, useT, type Lang } from '@/i18n'

type Info = { version: string; dataDir: string; platform: string; bibles: BibleInfo[] }

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  useModal()
  const [info, setInfo] = useState<Info | null>(null)
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)
  const [result, setResult] = useState<{ kind: 'backup' | 'restore'; path: string; summary: BackupSummary } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useT()

  useEffect(() => {
    window.nl.appInfo().then(setInfo)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const run = async (kind: 'backup' | 'restore'): Promise<void> => {
    setBusy(kind)
    setError(null)
    setResult(null)
    try {
      const r = kind === 'backup' ? await window.nl.backup.create() : await window.nl.backup.restore()
      if (r) {
        setResult({ kind, ...r })
        // Pick up restored songs, services, media and settings without restarting.
        if (kind === 'restore') {
          await useApp.getState().hydrate()
          applyAccent(bootSettings.accent)
        }
      }
    } catch (e) {
      setError(String((e as Error).message).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-[600px] flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-5">
          <span className="text-[15px] font-semibold">{t('settings.title')}</span>
          <button onClick={onClose} title={t('common.close')} className="rounded p-1 text-muted hover:bg-panel-2 hover:text-fg">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto p-5">
          <AppearanceSection />
          <DisplaySection />
          <MediaFitDefaultSection />
          <ChurchSection />
          <QuickChatSection />

          <section>
            <div className="label-caps mb-2">{t('settings.backup.title')}</div>
            <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
              {t('settings.backup.intro')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => run('backup')}
                disabled={!!busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-accent-fill py-2.5 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-50"
              >
                {busy === 'backup' ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />} {t('settings.backup.full')}
              </button>
              <button
                onClick={() => run('restore')}
                disabled={!!busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-line py-2.5 text-[13px] hover:border-accent hover:text-accent-text disabled:opacity-50"
              >
                {busy === 'restore' ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} {t('settings.backup.restore')}
              </button>
            </div>
            {error && <p className="mt-3 text-[12.5px] text-live">{error}</p>}
            {result && <ResultCard {...result} />}
            <AutoBackupSettings />
          </section>

          <section>
            <div className="label-caps mb-2">{t('settings.about.title')}</div>
            <div className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
              <span className="text-muted">{t('settings.about.version')}</span>
              <span>{info?.version ?? '…'}</span>
              <span className="text-muted">{t('settings.about.dataFolder')}</span>
              <span className="break-all font-mono text-[11.5px] select-text">{info?.dataDir}</span>
            </div>
          </section>

          <section>
            <div className="label-caps mb-2">{t('settings.bibles.title')}</div>
            <div className="flex flex-col gap-1.5">
              {info?.bibles.map((b) => (
                <div key={b.id} className="text-[12px]">
                  <span className="font-semibold">{b.abbrev}</span> <span className="text-fg/85">{b.name}</span>
                  <div className="text-[11.5px] text-dim">{b.license}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

const currentAccent = (): string =>
  getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim().toLowerCase() || DEFAULT_ACCENT

function AppearanceSection() {
  const [zoom, setZoom] = useState(1)
  const [accent, setAccent] = useState(currentAccent)
  const { lang } = useT()
  const mod = window.nl.platform === 'darwin' ? '⌘' : 'Ctrl'

  useEffect(() => {
    window.nl.uiZoom.get().then(setZoom)
    return window.nl.uiZoom.onChange(setZoom)
  }, [])

  const pickAccent = (c: string): void => {
    setAccent(c.toLowerCase())
    saveAccent(c)
  }
  const isPreset = ACCENT_PRESETS.some((p) => p.color === accent)

  return (
    <section>
      <div className="label-caps mb-2">{t('settings.appearance.title')}</div>
      <div className="flex flex-col gap-4 rounded-lg bg-panel-2 p-3.5">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label className="text-[12.5px]" htmlFor="ui-language">
              {t('common.language')}
            </label>
            <select
              id="ui-language"
              value={lang}
              onChange={(e) => {
                const l = e.target.value as Lang
                setLang(l)
                window.nl.data.setSetting('language', l)
              }}
              className="h-8 min-w-[180px] rounded-md bg-panel px-2 text-[13px] outline-none focus:ring-1 focus:ring-accent/50"
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11.5px] text-dim">{t('settings.appearance.languageHint')}</p>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[12.5px]">{t('settings.appearance.size')}</span>
            <span className="text-[11.5px] text-dim">{t('settings.appearance.zoomKeys', { mod })}</span>
          </div>
          <div className="flex gap-1 rounded-md bg-panel p-1">
            {ZOOM_STEPS.map((z) => (
              <button
                key={z}
                onClick={() => window.nl.uiZoom.set(z).then(setZoom)}
                className={`flex-1 rounded py-1.5 text-[12.5px] ${
                  Math.abs(z - zoom) < 0.01 ? 'bg-accent-fill font-semibold text-on-accent' : 'text-muted hover:bg-panel-3 hover:text-fg'
                }`}
              >
                {Math.round(z * 100)}%
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-dim">{t('settings.appearance.sizeHint')}</p>
        </div>

        <div>
          <div className="mb-1.5 text-[12.5px]">{t('settings.appearance.accent')}</div>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.color}
                title={t(`settings.accent.${p.name}` as 'settings.accent.Blue')}
                aria-label={t(`settings.accent.${p.name}` as 'settings.accent.Blue')}
                onClick={() => pickAccent(p.color)}
                className={`grid h-7 w-7 place-items-center rounded-full ring-offset-2 ring-offset-panel-2 ${
                  accent === p.color ? 'ring-2 ring-fg/80' : 'hover:ring-2 hover:ring-white/20'
                }`}
                style={{ background: p.color }}
              >
                {accent === p.color && <Check size={14} strokeWidth={3} className="text-white" />}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-line" />
            <label
              title={t('settings.appearance.customColor')}
              className={`relative grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-line ring-offset-2 ring-offset-panel-2 ${
                isPreset ? 'bg-panel-3 text-muted hover:text-fg' : 'ring-2 ring-fg/80 text-white'
              }`}
              style={isPreset ? undefined : { background: accent }}
            >
              <Pipette size={13} />
              <input
                type="color"
                value={accent}
                onChange={(e) => pickAccent(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <span className="font-mono text-[11.5px] text-dim select-text">{accent}</span>
          </div>
          <p className="mt-1.5 text-[11.5px] text-dim">{t('settings.appearance.accentHint')}</p>
        </div>
      </div>
    </section>
  )
}

/** Church name: printed at the top of run sheets and song sheets. Saved as setting `churchName`. */
function ChurchSection() {
  const [name, setName] = useState(() => (typeof bootSettings.churchName === 'string' ? bootSettings.churchName : ''))
  const save = (v: string): void => {
    setName(v)
    bootSettings.churchName = v.trim() // Print reads it from here
    window.nl.data.setSetting('churchName', v.trim())
  }
  return (
    <section>
      <div className="label-caps mb-2">{t('settings.church.title')}</div>
      <div className="rounded-lg bg-panel-2 p-3.5">
        <label className="mb-1.5 block text-[12.5px]" htmlFor="church-name">
          {t('settings.church.name')}
        </label>
        <input
          id="church-name"
          value={name}
          onChange={(e) => save(e.target.value)}
          placeholder={t('settings.church.placeholder')}
          className="h-8 w-full rounded-md bg-panel px-2.5 text-[13px] outline-none placeholder:text-dim focus:ring-1 focus:ring-accent/50"
        />
        <p className="mt-1.5 text-[11.5px] text-dim">{t('settings.church.hint')}</p>
        <CopyrightFields />
      </div>
    </section>
  )
}

/** CCLI licence number and where the song copyright line shows (setting `copyright`, see useApp). */
function CopyrightFields() {
  const c = useApp((s) => s.copyright)
  const set = useApp((s) => s.setCopyright)
  useT()
  const FOOTER: { v: typeof c.footer; label: string }[] = [
    { v: 'edges', label: t('settings.ccli.edges') },
    { v: 'every', label: t('settings.ccli.every') },
    { v: 'off', label: t('common.off') }
  ]
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3.5">
      <div>
        <label className="mb-1.5 block text-[12.5px]" htmlFor="ccli-licence">
          {t('settings.ccli.licence')}
        </label>
        <input
          id="ccli-licence"
          value={c.licence}
          onChange={(e) => set({ licence: e.target.value.replace(/[^\w-]/g, '') })}
          placeholder={t('settings.ccli.placeholder')}
          className="h-8 w-48 rounded-md bg-panel px-2.5 text-[13px] tabular-nums outline-none placeholder:text-dim focus:ring-1 focus:ring-accent/50"
        />
      </div>
      <div>
        <div className="mb-1.5 text-[12.5px]">{t('settings.ccli.footer')}</div>
        <div className="flex gap-1 rounded-md bg-panel p-1">
          {FOOTER.map((f) => (
            <button
              key={f.v}
              onClick={() => set({ footer: f.v })}
              className={`flex-1 rounded py-1.5 text-[12.5px] ${c.footer === f.v ? 'bg-accent-fill font-semibold text-on-accent' : 'text-muted hover:bg-panel-3 hover:text-fg'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className={`mt-2 flex items-center gap-2 text-[12.5px] ${c.footer === 'off' ? 'opacity-40' : ''}`}>
          <input
            type="checkbox"
            disabled={c.footer === 'off'}
            checked={c.overlay}
            onChange={(e) => set({ overlay: e.target.checked })}
            className="accent-[var(--color-accent)]"
          />
          {t('settings.ccli.overlay')}
        </label>
        <p className="mt-1.5 text-[11.5px] text-dim">
          {t('settings.ccli.hint')}
        </p>
      </div>
    </div>
  )
}

function ResultCard({ kind, path, summary: s }: { kind: 'backup' | 'restore'; path: string; summary: BackupSummary }) {
  const skipped = s.skipped.songs + s.skipped.bibles + s.skipped.media
  return (
    <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-[12.5px]">
      <div className="mb-1 flex items-center gap-2 font-semibold text-emerald-400">
        <CheckCircle2 size={15} /> {kind === 'backup' ? t('settings.backup.saved') : t('settings.backup.restored')}
      </div>
      <div className="text-fg/85">
        {t(kind === 'backup' ? 'settings.backup.contains' : 'settings.backup.added', {
          list:
            [
              tn('settings.count.songs', s.songs),
              tn('settings.count.services', s.services),
              tn('settings.count.bibles', s.bibles),
              tn('settings.count.media', s.media)
            ].join(', ') + (kind === 'backup' ? ` · ${formatBytes(s.bytes)}` : '')
        })}
      </div>
      {kind === 'restore' && skipped > 0 && (
        <div className="text-muted">
          {t('settings.backup.skipped', {
            list: [
              tn('settings.count.songs', s.skipped.songs),
              tn('settings.count.bibles', s.skipped.bibles),
              tn('settings.count.media', s.skipped.media)
            ].join(', ')
          })}
        </div>
      )}
      <div className="mt-1 break-all font-mono text-[11px] text-dim select-text">{path}</div>
    </div>
  )
}
