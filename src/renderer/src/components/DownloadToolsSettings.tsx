import { useEffect, useState } from 'react'
import { Download, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import type { ToolName } from '@shared/types'
import { useDownloads } from '@/store/useDownloads'
import { t, useT } from '@/i18n'

const TOOLS: { id: ToolName; name: string; url: string }[] = [
  { id: 'ytdlp', name: 'yt-dlp', url: 'https://github.com/yt-dlp/yt-dlp' },
  { id: 'ffmpeg', name: 'ffmpeg', url: 'https://github.com/eugeneware/ffmpeg-static' }
]

/** Settings → YouTube downloads (optional): on/off, the downloaded tools' versions, update and remove. */
export default function DownloadToolsSettings() {
  useT()
  const st = useDownloads((s) => s.tools)
  const [checking, setChecking] = useState(false)
  const api = window.nl.youtube.tools
  const apply = (p: Promise<unknown>): void => void p.then(() => api.status()).then((tools) => useDownloads.setState({ tools }))

  // Opening Settings with the feature on: look for newer versions.
  useEffect(() => {
    if (!st?.enabled || st.busy) return
    setChecking(true)
    api.check().finally(() => setChecking(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.enabled])

  if (!st) return null
  const anyInstalled = !!(st.tools.ytdlp.installed || st.tools.ffmpeg.installed)
  const missing = !st.tools.ytdlp.installed || !st.tools.ffmpeg.installed
  const newer = TOOLS.some(({ id }) => st.tools[id].installed && st.tools[id].latest && st.tools[id].latest !== st.tools[id].installed)

  const turn = (on: boolean): void => {
    if (on === st.enabled) return
    if (on && !window.confirm(t('settings.ytdl.confirm'))) return
    apply(api.setEnabled(on))
  }

  return (
    <section>
      <div className="label-caps mb-2">{t('settings.ytdl.title')}</div>
      <div className="rounded-lg bg-panel-2 p-3.5 text-[12.5px]">
        <div className="flex items-start justify-between gap-3">
          <p className="leading-relaxed text-muted">{t('settings.ytdl.intro')}</p>
          <div className="flex shrink-0 gap-1 rounded-md bg-panel p-1">
            {[true, false].map((on) => (
              <button
                key={String(on)}
                onClick={() => turn(on)}
                disabled={!st.supported && on}
                className={`rounded px-3 py-1 disabled:opacity-40 ${st.enabled === on ? 'bg-accent-fill font-semibold text-on-accent' : 'text-muted hover:bg-panel-3 hover:text-fg'}`}
              >
                {on ? t('common.on') : t('common.off')}
              </button>
            ))}
          </div>
        </div>

        {!st.supported && <p className="mt-2 text-amber-300">{t('settings.ytdl.unsupported')}</p>}

        {(st.enabled || anyInstalled) && (
          <>
            <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
              {TOOLS.map(({ id, name, url }) => {
                const tool = st.tools[id]
                const busy = st.busy?.tool === id ? st.busy : null
                const update = tool.installed && tool.latest && tool.latest !== tool.installed
                return (
                  <div key={id} className="flex items-center gap-2">
                    <a href={url} target="_blank" rel="noreferrer" className="w-16 shrink-0 font-mono text-[12px] hover:text-accent-text hover:underline">
                      {name}
                    </a>
                    <span className="min-w-0 flex-1 truncate text-muted">
                      {busy
                        ? busy.pct >= 100
                          ? t('settings.ytdl.checkingTool')
                          : t('settings.ytdl.downloading', { pct: busy.pct })
                        : tool.installed
                          ? t('settings.ytdl.version', { v: tool.installed })
                          : t('settings.ytdl.notInstalled')}
                    </span>
                    {!busy && tool.installed && (
                      <span className={`shrink-0 text-[11.5px] ${update ? 'text-amber-300' : 'text-dim'}`}>
                        {update ? t('settings.ytdl.updateTo', { v: tool.latest! }) : tool.latest ? t('settings.ytdl.upToDate') : ''}
                      </span>
                    )}
                    {busy && <Loader2 size={13} className="shrink-0 animate-spin text-accent-text" />}
                  </div>
                )
              })}
            </div>

            {st.error && <p className="mt-2 text-[12px] text-live">{st.error === 'offline' ? t('settings.ytdl.offline') : st.error}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {st.enabled && (missing || newer) && (
                <button
                  onClick={() => apply(api.install())}
                  disabled={!!st.busy}
                  className="flex items-center gap-1.5 rounded-md bg-accent-fill px-3 py-1.5 font-semibold text-on-accent hover:brightness-110 disabled:opacity-50"
                >
                  <Download size={13} /> {missing ? t('settings.ytdl.install') : t('settings.ytdl.update')}
                </button>
              )}
              {st.enabled && !missing && (
                <button
                  onClick={() => {
                    setChecking(true)
                    api.check().finally(() => setChecking(false))
                  }}
                  disabled={!!st.busy || checking}
                  className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 hover:border-accent hover:text-accent-text disabled:opacity-50"
                >
                  <RefreshCw size={13} className={checking ? 'animate-spin' : ''} /> {t('settings.ytdl.check')}
                </button>
              )}
              {anyInstalled && (
                <button
                  onClick={() => window.confirm(t('settings.ytdl.removeConfirm')) && apply(api.remove())}
                  disabled={!!st.busy}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted hover:bg-live/15 hover:text-live disabled:opacity-50"
                >
                  <Trash2 size={13} /> {t('settings.ytdl.remove')}
                </button>
              )}
              <span className="flex-1" />
              {st.checkedAt && (
                <span className="text-[11px] text-dim">{t('settings.ytdl.lastChecked', { when: new Date(st.checkedAt).toLocaleString() })}</span>
              )}
            </div>
            <p className="mt-2 text-[11.5px] text-dim">{t('settings.ytdl.rights')}</p>
          </>
        )}
      </div>
    </section>
  )
}
