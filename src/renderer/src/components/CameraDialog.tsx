import { useEffect } from 'react'
import { Loader2, RefreshCw, RotateCcw, Video, VideoOff, X } from 'lucide-react'
import type { CameraLayout, CameraLook, Corner } from '@shared/types'
import { cleanLook } from '@shared/camera'
import SlideView from './SlideView'
import { useCameras } from './SourceDialog'
import { buildFrame, cameraFrame, useApp } from '@/store/useApp'
import { useModal } from '@/lib/modal'
import { useT } from '@/i18n'

// Camera settings: the overlay over whatever is live (which camera, where, how big) and the camera's picture (zoom,
// pan, mirror, colour). The picture is saved per camera, so a camera item or background of that camera matches.

export default function CameraDialog({ onClose, deviceOnly }: { onClose: () => void; deviceOnly?: { deviceId: string; label?: string } }) {
  const state = useApp()
  const { t } = useT()
  useModal(true, onClose)
  const ov = state.cameraOverlay
  const set = state.setCameraOverlay
  const cams = useCameras(!deviceOnly)

  // No camera picked yet: take the first one found.
  useEffect(() => {
    if (deviceOnly || ov.deviceId || cams.state !== 'ready' || !cams.list.length) return
    const c = cams.list[0]
    set({ deviceId: c.deviceId, label: c.label || t('presentation.kindCamera') })
  }, [cams.state, cams.list, ov.deviceId, deviceOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  const deviceId = deviceOnly?.deviceId ?? ov.deviceId
  const label = deviceOnly?.label ?? ov.label ?? t('presentation.kindCamera')
  const look = cleanLook(state.cameraLooks[deviceId])
  const setLook = (patch: Partial<CameraLook> | null): void => {
    if (deviceId) state.setCameraLook(deviceId, patch)
  }

  // Preview: the audience screen as it is now, with the overlay drawn whether or not it is on (or just the camera).
  const frame = buildFrame(state)
  const preview = deviceOnly
    ? { ...frame, slide: null, countdown: null, black: false, background: { kind: 'camera' as const, deviceId, label, look }, camera: null }
    : { ...frame, black: false, camera: deviceId ? cameraFrame(ov, state.cameraLooks) : null }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        aria-modal="true"
        role="dialog"
        onKeyDown={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-5">
          <Video size={16} className="text-accent-text" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{deviceOnly ? t('live.camera.adjust') : t('live.camera.title')}</span>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-panel-2 hover:text-fg">
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 gap-5 overflow-hidden p-5 max-md:flex-col max-md:overflow-y-auto">
          <div className="flex min-w-0 flex-[3] flex-col gap-2">
            <SlideView {...preview} audio={false} className="aspect-video w-full rounded-lg ring-1 ring-line" />
            {!deviceOnly && <p className="text-[11.5px] text-dim">{t('live.camera.wiredNote')}</p>}
          </div>

          <div className="flex min-w-0 flex-[2] flex-col gap-4 overflow-y-auto pr-1">
            {!deviceOnly && (
              <>
                <Field label={t('presentation.cameraDevice')} extra={
                  <button onClick={cams.refresh} className="flex items-center gap-1 text-[11.5px] text-muted hover:text-fg">
                    <RefreshCw size={12} /> {t('presentation.refresh')}
                  </button>
                }>
                  {cams.state === 'loading' ? (
                    <span className="flex items-center gap-2 text-[12.5px] text-muted">
                      <Loader2 size={14} className="animate-spin" /> {t('presentation.lookingCameras')}
                    </span>
                  ) : cams.state === 'denied' ? (
                    <p className="text-[12.5px] text-live">{window.nl.platform === 'darwin' ? t('presentation.cameraOffMac') : t('presentation.cameraOffWin')}</p>
                  ) : !cams.list.length ? (
                    <p className="text-[12.5px] text-muted">{t('presentation.noCamera')}</p>
                  ) : (
                    <select
                      value={ov.deviceId}
                      onChange={(e) => {
                        const c = cams.list.find((d) => d.deviceId === e.target.value)
                        set({ deviceId: e.target.value, label: c?.label || t('presentation.kindCamera') })
                      }}
                      className="h-9 w-full rounded-md bg-panel-2 px-2 text-[13px] outline-none"
                    >
                      {/* The saved camera isn't plugged in: keep it selected, marked, rather than showing another one. */}
                      {ov.deviceId && !cams.list.some((d) => d.deviceId === ov.deviceId) && (
                        <option value={ov.deviceId}>
                          {ov.label || t('presentation.kindCamera')} · {t('stage.source.notConnected')}
                        </option>
                      )}
                      {cams.list.map((d, i) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || t('presentation.cameraN', { n: i + 1 })}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>

                <Field label={t('live.camera.layout')}>
                  <Segmented<CameraLayout>
                    value={ov.layout}
                    onChange={(layout) => set({ layout })}
                    options={[
                      ['pip', t('live.camera.pip')],
                      ['side', t('live.camera.side')],
                      ['behind', t('live.camera.behind')]
                    ]}
                  />
                </Field>

                {ov.layout === 'pip' && (
                  <>
                    <Field label={t('live.camera.corner')}>
                      <CornerPicker value={ov.corner} onChange={(corner) => set({ corner })} />
                    </Field>
                    <Slider label={t('live.camera.size')} value={ov.size} min={15} max={60} unit="%" onChange={(size) => set({ size })} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      <Check checked={ov.rounded} onChange={(rounded) => set({ rounded })} label={t('live.camera.rounded')} />
                      <Check checked={ov.border} onChange={(border) => set({ border })} label={t('live.camera.border')} />
                    </div>
                  </>
                )}
                {ov.layout === 'side' && (
                  <Segmented<'left' | 'right'>
                    value={ov.side}
                    onChange={(side) => set({ side })}
                    options={[
                      ['left', t('live.camera.sideLeft')],
                      ['right', t('live.camera.sideRight')]
                    ]}
                  />
                )}
                <Check checked={ov.sound} onChange={(sound) => set({ sound })} label={t('live.camera.sound')} />
              </>
            )}

            {deviceId && (
              <div className={`flex flex-col gap-3 ${deviceOnly ? '' : 'border-t border-line pt-4'}`}>
                <div>
                  <div className="label-caps truncate">{t('live.camera.picture', { name: label })}</div>
                  <p className="mt-0.5 text-[11.5px] text-dim">{t('live.camera.pictureNote')}</p>
                </div>
                <Slider label={t('live.camera.zoom')} value={Math.round(look.zoom * 100)} min={100} max={400} unit="%" onChange={(v) => setLook({ zoom: v / 100 })} />
                {look.zoom > 1 && (
                  <>
                    <Slider label={t('live.camera.panX')} value={Math.round(look.x * 100)} min={0} max={100} onChange={(v) => setLook({ x: v / 100 })} />
                    <Slider label={t('live.camera.panY')} value={Math.round(look.y * 100)} min={0} max={100} onChange={(v) => setLook({ y: v / 100 })} />
                  </>
                )}
                <Segmented<'cover' | 'contain'>
                  value={look.fit}
                  onChange={(fit) => setLook({ fit })}
                  options={[
                    ['cover', t('live.camera.fill')],
                    ['contain', t('live.camera.fit')]
                  ]}
                />
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  <Check checked={look.mirror} onChange={(mirror) => setLook({ mirror })} label={t('live.camera.mirror')} />
                  <Check checked={look.flip} onChange={(flip) => setLook({ flip })} label={t('live.camera.flip')} />
                  <Check checked={look.grayscale} onChange={(grayscale) => setLook({ grayscale })} label={t('live.camera.grayscale')} />
                </div>
                <Slider label={t('live.camera.brightness')} value={look.brightness} min={30} max={200} unit="%" onChange={(brightness) => setLook({ brightness })} />
                <Slider label={t('live.camera.contrast')} value={look.contrast} min={30} max={200} unit="%" onChange={(contrast) => setLook({ contrast })} />
                <Slider label={t('live.camera.saturation')} value={look.saturation} min={0} max={200} unit="%" onChange={(saturation) => setLook({ saturation })} />
                <Slider label={t('live.camera.warmth')} value={look.warmth} min={-100} max={100} onChange={(warmth) => setLook({ warmth })} />
                <Slider label={t('live.camera.blur')} value={look.blur} min={0} max={40} onChange={(blur) => setLook({ blur })} />
                <button
                  onClick={() => setLook(null)}
                  className="flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-[12.5px] text-muted hover:bg-panel-2 hover:text-fg"
                >
                  <RotateCcw size={13} /> {t('live.camera.resetPicture')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-line px-5 py-3">
          {!deviceOnly && (
            <button
              onClick={() => set({ on: !ov.on })}
              disabled={!ov.deviceId}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold disabled:opacity-40 ${
                ov.on ? 'bg-live text-white hover:brightness-110' : 'bg-accent-fill text-on-accent hover:brightness-110'
              }`}
            >
              {ov.on ? <VideoOff size={15} /> : <Video size={15} />} {ov.on ? t('live.camera.takeOff') : t('live.camera.show')}
            </button>
          )}
          <span className="flex-1" />
          <button onClick={onClose} className="rounded-md px-4 py-2 text-[13px] text-muted hover:bg-panel-2 hover:text-fg">
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, extra, children }: { label: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps">{label}</span>
        {extra}
      </div>
      {children}
    </div>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-lg bg-panel-2 p-0.5 text-[12.5px]">
      {options.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`min-w-0 flex-1 truncate rounded-md px-1.5 py-1.5 ${value === id ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Four corners of a little screen. */
function CornerPicker({ value, onChange }: { value: Corner; onChange: (c: Corner) => void }) {
  return (
    <div className="relative aspect-video w-36 rounded-md bg-panel-2 ring-1 ring-line">
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-pressed={value === c}
          className={`absolute h-6 w-9 rounded ${value === c ? 'bg-accent-fill' : 'bg-panel-3 hover:bg-accent/40'}`}
          style={{ [c[0] === 't' ? 'top' : 'bottom']: 6, [c[1] === 'l' ? 'left' : 'right']: 6 }}
        />
      ))}
    </div>
  )
}

function Slider({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-[12.5px]">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-dim">
          {value}
          {unit ?? ''}
        </span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
    </label>
  )
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--color-accent)]" />
      {label}
    </label>
  )
}
