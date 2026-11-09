import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, Wifi, WifiOff } from 'lucide-react'
import type { NetStatus } from '@shared/types'
import { bootSettings } from '@/store/useApp'
import { useT } from '@/i18n'

/**
 * "Allow control API": HTTP commands for Stream Deck, Bitfocus Companion and clickers (setting `controlApi`).
 * While on, the PIN is kept between sessions (`controlApiPin`) so saved buttons keep working.
 */
function ControlApi({ base, pin }: { base: string; pin: string }) {
  const [on, setOn] = useState(bootSettings.controlApi === true)
  const [copied, setCopied] = useState<string | null>(null)
  const { t } = useT()
  const toggle = (v: boolean): void => {
    setOn(v)
    bootSettings.controlApi = v
    window.nl.data.setSetting('controlApi', v)
    if (v) {
      bootSettings.controlApiPin = pin
      window.nl.data.setSetting('controlApiPin', pin)
    }
  }
  const rows: [string, string][] = [
    [t('network.api.next'), `POST ${base}/api/next?pin=${pin}`],
    [t('common.previous'), `POST ${base}/api/prev?pin=${pin}`],
    [t('network.api.blackHide'), `POST ${base}/api/black?pin=${pin}   ·   /api/hideText`],
    [t('network.api.clear'), `POST ${base}/api/clear?pin=${pin}`],
    [t('network.api.goto'), `POST ${base}/api/goto?pin=${pin}&item=3&slide=2`],
    [t('network.api.status'), `GET ${base}/api/status`]
  ]
  const copy = (key: string, text: string): void => {
    navigator.clipboard.writeText(text.replace(/^(POST|GET) /, '').replace(/ {3}·.*$/, ''))
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }
  return (
    <div className="border-t border-line pt-3">
      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} className="accent-[var(--color-accent)]" />
        {t('network.api.allow')}
        <span className="min-w-0 truncate text-[11.5px] text-dim">{t('network.api.allowSub')}</span>
      </label>
      {on && (
        <div className="mt-2 flex flex-col gap-1">
          {rows.map(([what, url]) => (
            <div key={what} className="flex items-center gap-2 text-[11.5px]">
              <span className="w-32 shrink-0 truncate text-muted" title={what}>
                {what}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-dim select-text" title={url}>
                {url}
              </span>
              <button onClick={() => copy(what, url)} title={t('network.api.copyUrl')} className="rounded p-1 text-dim hover:bg-panel-3 hover:text-fg">
                {copied === what ? <Check size={12} className="text-accent-text" /> : <Copy size={12} />}
              </button>
            </div>
          ))}
          <p className="mt-1 text-[11px] leading-snug text-dim">{t('network.api.note')}</p>
        </div>
      )}
    </div>
  )
}

export function useNetStatus(): NetStatus | null {
  const [st, setSt] = useState<NetStatus | null>(null)
  useEffect(() => {
    window.nl.net.status().then(setSt)
    return window.nl.net.onStatus(setSt)
  }, [])
  return st
}

/** Start/stop the LAN server and show the QR code, address and PIN for phones. */
export default function NetworkPanel({ target }: { target: 'remote' | 'stage' | 'display' }) {
  const st = useNetStatus()
  const { t, tn } = useT()
  const [busy, setBusy] = useState(false)
  const [urlIndex, setUrlIndex] = useState(0)
  const [qr, setQr] = useState<string | null>(null)

  const base = st?.urls[Math.min(urlIndex, (st?.urls.length ?? 1) - 1)]
  const url = base ? `${base}/#/${target}` : null

  useEffect(() => {
    if (!url) return setQr(null)
    window.nl.net.qr(url).then(setQr)
  }, [url])

  const toggle = async (): Promise<void> => {
    setBusy(true)
    if (st?.running) await window.nl.net.stop()
    else await window.nl.net.start()
    setBusy(false)
  }

  if (!st) return null

  if (!st.running) {
    return (
      <div className="flex flex-col items-center gap-3 p-4 text-center">
        <WifiOff size={22} className="text-muted" />
        <p className="text-[12.5px] leading-relaxed text-muted">
          {t(`network.intro.${target}`)}
        </p>
        {st.error && <p className="text-[12px] text-live">{st.error}</p>}
        <button
          onClick={toggle}
          disabled={busy}
          className="flex items-center gap-2 rounded-md bg-accent-fill px-4 py-2 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Wifi size={15} />} {t('network.start')}
        </button>
        <p className="text-[11px] text-dim">{t('network.allowPrompt')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {st.urls.length === 0 ? (
        <p className="text-[12.5px] text-live">{t('network.noNetwork')}</p>
      ) : (
        <div className="flex gap-4">
          <div className="grid h-40 w-40 shrink-0 place-items-center rounded-lg bg-white">
            {qr ? <img src={qr} className="h-full w-full rounded-lg" /> : <Loader2 className="animate-spin text-black/30" />}
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <div className="label-caps">{t('network.scan')}</div>
            <div className="break-all font-mono text-[12.5px] text-fg select-text">{url}</div>
            {target === 'remote' && (
              <>
                <div className="label-caps mt-1">PIN</div>
                <div className="font-mono text-[26px] font-bold tracking-[0.3em] text-accent-text select-text">{st.pin}</div>
              </>
            )}
          </div>
        </div>
      )}

      {st.urls.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {st.urls.map((u, i) => (
            <button
              key={u}
              onClick={() => setUrlIndex(i)}
              className={`rounded px-2 py-0.5 font-mono text-[11px] ${
                i === urlIndex ? 'bg-accent-fill text-on-accent' : 'bg-panel-3 text-muted hover:text-fg'
              }`}
            >
              {u.replace(/^http:\/\//, '')}
            </button>
          ))}
        </div>
      )}

      {target === 'remote' && base && <ControlApi base={base} pin={st.pin} />}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-[12px] text-muted">
        <span className="min-w-0">
          {[tn('network.remotes', st.clients.remote), tn('network.stages', st.clients.stage), tn('network.screens', st.clients.display)].join(' · ')}
        </span>
        <button onClick={toggle} disabled={busy} className="shrink-0 whitespace-nowrap text-live hover:underline disabled:opacity-50">
          {t('network.stop')}
        </button>
      </div>
    </div>
  )
}
