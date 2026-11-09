import { useEffect, useRef, useState } from 'react'
import { Globe, Loader2, RefreshCw, Video, X } from 'lucide-react'
import type { Background, ServiceItem } from '@shared/types'
import { useApp } from '@/store/useApp'
import { useModal } from '@/lib/modal'
import { hostOf } from './SlideView'
import { useT } from '@/i18n'

export type SourceKind = 'web' | 'camera'
type Target = 'item' | 'behind' | 'default'

/** Normalise what people type: "vdo.ninja/?view=abc" → "https://vdo.ninja/?view=abc". */
export function normalizeUrl(input: string): string | null {
  let s = input.trim()
  if (!s) return null
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null
    return u.toString()
  } catch {
    return null
  }
}

/** Add (or edit) a website / vdo.ninja feed or a camera, as a service item or as a background. */
export default function SourceDialog({ kind, edit, onClose }: { kind: SourceKind; edit?: ServiceItem; onClose: () => void }) {
  useModal()
  const { service, selectedItemId, addSourceItem, setBackground, setItemBackground } = useApp()
  const existing = edit?.background
  const [title, setTitle] = useState(edit?.title ?? '')
  const [url, setUrl] = useState(existing?.kind === 'web' ? existing.url : '')
  const [sound, setSound] = useState(existing && (existing.kind === 'web' || existing.kind === 'camera') ? existing.muted === false : false)
  const [target, setTarget] = useState<Target>('item')
  const [deviceId, setDeviceId] = useState(existing?.kind === 'camera' ? existing.deviceId : '')
  const selected = service.items.find((i) => i.id === selectedItemId && i.kind !== 'web' && i.kind !== 'camera')
  const { t } = useT()
  const cameraWord = t('presentation.kindCamera')

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const cams = useCameras(kind === 'camera')
  const cam = cams.list.find((d) => d.deviceId === deviceId) ?? (deviceId ? null : cams.list[0] ?? null)
  const normalized = kind === 'web' ? normalizeUrl(url) : null

  const bg: Extract<Background, { kind: 'web' | 'camera' }> | null =
    kind === 'web'
      ? normalized
        ? { kind: 'web', url: normalized, muted: !sound }
        : null
      : cam
        ? { kind: 'camera', deviceId: cam.deviceId, label: cam.label || cameraWord, muted: !sound }
        : null

  const save = (): void => {
    if (!bg) return
    const name = title.trim() || (bg.kind === 'web' ? hostOf(bg.url) : bg.label || cameraWord)
    if (edit) {
      useApp.setState((s) => ({
        service: { ...s.service, items: s.service.items.map((it) => (it.id === edit.id ? { ...it, title: name, background: bg } : it)) }
      }))
    } else if (target === 'item') addSourceItem(name, bg)
    else if (target === 'behind' && selected) setItemBackground(selected.id, bg)
    else setBackground(bg)
    onClose()
  }

  const Icon = kind === 'web' ? Globe : Video
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        className="flex w-[520px] flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
      >
        <div className="flex h-12 items-center gap-2 border-b border-line px-5">
          <Icon size={16} className="text-accent-text" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
            {kind === 'web'
              ? t(edit ? 'presentation.editWeb' : 'presentation.addWeb')
              : t(edit ? 'presentation.editCamera' : 'presentation.addCamera')}
          </span>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:bg-panel-2 hover:text-fg">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {kind === 'web' ? (
            <label className="flex flex-col gap-1.5">
              <span className="label-caps">{t('presentation.address')}</span>
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('presentation.urlPlaceholder')}
                className="input h-10 rounded-md bg-panel-2 px-3 text-[13.5px] outline-none focus:ring-1 focus:ring-accent/50"
              />
              <span className={`text-[11.5px] ${url && !normalized ? 'text-live' : 'text-dim'}`}>
                {url && !normalized
                  ? t('presentation.urlInvalid')
                  : t('presentation.urlHelp')}
              </span>
            </label>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="label-caps">{t('presentation.cameraDevice')}</span>
                <button type="button" onClick={cams.refresh} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11.5px] text-muted hover:text-fg">
                  <RefreshCw size={12} /> {t('presentation.refresh')}
                </button>
              </div>
              {cams.state === 'loading' ? (
                <div className="flex items-center gap-2 py-2 text-[12.5px] text-muted">
                  <Loader2 size={14} className="animate-spin" /> {t('presentation.lookingCameras')}
                </div>
              ) : cams.state === 'denied' ? (
                <p className="text-[12.5px] text-live">
                  {window.nl.platform === 'darwin' ? t('presentation.cameraOffMac') : t('presentation.cameraOffWin')}
                </p>
              ) : cams.list.length === 0 ? (
                <p className="text-[12.5px] text-muted">{t('presentation.noCamera')}</p>
              ) : (
                <select
                  value={cam?.deviceId ?? ''}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="h-10 rounded-md bg-panel-2 px-2 text-[13px] outline-none"
                >
                  {cams.list.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || t('presentation.cameraN', { n: i + 1 })}
                    </option>
                  ))}
                </select>
              )}
              {cam && <CameraPreview deviceId={cam.deviceId} />}
              {existing?.kind === 'camera' && !cam && cams.state === 'ready' && (
                <p className="text-[12px] text-amber-300">{t('presentation.notConnected', { name: existing.label ?? cameraWord })}</p>
              )}
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="label-caps">{t('presentation.nameInOrder')}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === 'web' ? (normalized ? hostOf(normalized) : t('presentation.kindWebsite')) : cam?.label || cameraWord}
              className="h-9 rounded-md bg-panel-2 px-3 text-[13px] outline-none focus:ring-1 focus:ring-accent/50"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between rounded-md bg-panel-2 px-3 py-2 text-[13px]">
            <span>
              {t('presentation.playSound')} <span className="text-[11.5px] text-dim">{t('presentation.audienceOnly')}</span>
            </span>
            <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="accent-[var(--color-accent)]" />
          </label>

          {!edit && (
            <div className="flex flex-col gap-1.5">
              <span className="label-caps">{t('presentation.useAs')}</span>
              <div className="grid grid-cols-3 gap-1.5 text-[12.5px]">
                {(
                  [
                    ['item', t('presentation.useItem'), t('presentation.useItemSub')],
                    ['behind', t('presentation.useBehind'), selected ? t('presentation.useBehindSub', { title: selected.title }) : t('presentation.selectFirst')],
                    ['default', t('presentation.useDefault'), t('presentation.useDefaultSub')]
                  ] as const
                ).map(([id, label, sub]) => (
                  <button
                    type="button"
                    key={id}
                    disabled={id === 'behind' && !selected}
                    onClick={() => setTarget(id)}
                    className={`flex flex-col items-start rounded-md border px-2.5 py-2 text-left disabled:opacity-40 ${
                      target === id ? 'border-accent bg-accent-soft' : 'border-line hover:border-fg/20'
                    }`}
                  >
                    <span className="max-w-full truncate font-medium" title={label}>{label}</span>
                    <span className="truncate text-[11px] text-muted" style={{ maxWidth: '100%' }} title={sub}>
                      {sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-[13px] text-muted hover:text-fg">
            {t('common.cancel')}
          </button>
          <button
            disabled={!bg}
            className="rounded-md bg-accent-fill px-4 py-2 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
          >
            {edit ? t('common.save') : t('common.add')}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Ask for camera access once, then list video inputs (labels are only visible after access). */
function useCameras(enabled: boolean): { state: 'loading' | 'ready' | 'denied'; list: MediaDeviceInfo[]; refresh: () => void } {
  const [state, setState] = useState<'loading' | 'ready' | 'denied'>('loading')
  const [list, setList] = useState<MediaDeviceInfo[]>([])
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let dead = false
    setState('loading')
    ;(async () => {
      const ok = await window.nl.cameraAccess()
      if (!ok) return !dead && setState('denied')
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true })
        s.getTracks().forEach((t) => t.stop())
      } catch (e) {
        if ((e as Error).name === 'NotAllowedError') return !dead && setState('denied')
        // NotFoundError: no camera at all; fall through to an empty list.
      }
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
      if (!dead) {
        setList(devices)
        setState('ready')
      }
    })()
    const onChange = (): void => setN((x) => x + 1)
    navigator.mediaDevices.addEventListener('devicechange', onChange)
    return () => {
      dead = true
      navigator.mediaDevices.removeEventListener('devicechange', onChange)
    }
  }, [enabled, n])
  return { state, list, refresh: () => setN((x) => x + 1) }
}

function CameraPreview({ deviceId }: { deviceId: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const { t } = useT()
  useEffect(() => {
    let stream: MediaStream | null = null
    let dead = false
    setErr(null)
    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: { exact: deviceId } } })
      .then((s) => {
        if (dead) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (ref.current) ref.current.srcObject = s
      })
      .catch((e: Error) => !dead && setErr(e.message || t('presentation.unavailable')))
    return () => {
      dead = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [deviceId])
  return (
    <div className="mt-1 aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-line">
      {err ? (
        <div className="grid h-full place-items-center text-[12px] text-live">{err}</div>
      ) : (
        <video ref={ref} autoPlay muted playsInline className="h-full w-full object-cover" />
      )}
    </div>
  )
}
