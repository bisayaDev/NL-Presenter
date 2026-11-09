import { useState } from 'react'
import { Check, Copy, Loader2, Radio } from 'lucide-react'
import type { OverlaySettings } from '@shared/types'
import { useNetStatus } from './NetworkPanel'
import { useApp } from '@/store/useApp'
import { useT } from '@/i18n'

/** Settings and browser-source URLs for the OBS / vMix overlay. */
export default function BroadcastPanel() {
  const overlay = useApp((s) => s.overlay)
  const setOverlay = useApp((s) => s.setOverlay)
  const net = useNetStatus()
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const set =(p: Partial<OverlaySettings>): void => setOverlay(p)

  const local = net?.port ? `http://127.0.0.1:${net.port}/#/overlay` : null
  const lan = net?.urls[0] ? `${net.urls[0]}/#/overlay` : null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center gap-2">
        <Radio size={15} className="text-accent-text" />
        <span className="label-caps">{t('stage.broadcast.title')}</span>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {(
          [
            ['lower', t('stage.broadcast.lower')],
            ['center', t('stage.broadcast.center')],
            ['top', t('stage.broadcast.top')]
          ] as const
        ).map(([p, label]) => (
          <button
            key={p}
            onClick={() => set({ position: p })}
            className={`truncate rounded px-1 py-1.5 text-[12px] ${overlay.position === p ? 'bg-accent-fill text-on-accent' : 'bg-panel-2 text-muted hover:text-fg'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        <div className="mb-1 flex justify-between">
          <span className="label-caps">{t('stage.broadcast.height')}</span>
          <span className="text-[11.5px] text-muted">{overlay.size}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={60}
          value={overlay.size}
          onChange={(e) => set({ size: Number(e.target.value) })}
          className="w-full accent-[var(--color-accent)]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Toggle checked={overlay.band} onChange={(v) => set({ band: v })} label={t('stage.broadcast.band')} />
        <Toggle checked={overlay.showReference} onChange={(v) => set({ showReference: v })} label={t('stage.broadcast.reference')} />
        <Toggle checked={overlay.showCountdown} onChange={(v) => set({ showCountdown: v })} label={t('stage.broadcast.countdown')} />
      </div>

      {!net?.running ? (
        <button
          onClick={async () => {
            setBusy(true)
            await window.nl.net.start()
            setBusy(false)
          }}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-md bg-accent-fill py-2 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-50"
        >
          {busy && <Loader2 size={14} className="animate-spin" />} {t('stage.broadcast.start')}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {local && <UrlRow label={t('stage.broadcast.thisComputer')} url={local} />}
          {lan && <UrlRow label={t('stage.broadcast.otherComputer')} url={lan} />}
          <p className="text-[11px] leading-relaxed text-dim">{t('stage.broadcast.howTo')}</p>
        </div>
      )}
    </div>
  )
}

function UrlRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useT()
  return (
    <div>
      <div className="mb-1 text-[11px] text-muted">{label}</div>
      <div className="flex items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded bg-panel-2 px-2 py-1.5 text-[11.5px] text-fg select-text">{url}</code>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          title={t('common.copy')}
          className="rounded-md bg-panel-2 p-1.5 text-muted hover:text-fg"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md bg-panel-2 px-3 py-1.5 text-[12.5px]">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--color-accent)]" />
    </label>
  )
}
