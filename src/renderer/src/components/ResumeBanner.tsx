import { useEffect, useMemo, useState } from 'react'
import { History, MonitorCheck, MonitorX, X } from 'lucide-react'
import type { ScreenKind, ScreensStatus, Service } from '@shared/types'
import { matchDisplay, resumeOffer, type SavedSession, type WantedOutputs } from '@shared/outputs'
import { bootSettings, useApp } from '@/store/useApp'
import { t as tr, useT } from '@/i18n'

/**
 * After a crash: "Resume where you left off". Also shows output notices from main
 * (projector lost / reconnected / output restarted).
 */
export default function ResumeBanner() {
  return (
    <>
      <Resume />
      <OutputNotices />
    </>
  )
}

function Resume() {
  const service = useApp((s) => s.service)
  const live = useApp((s) => s.live)
  const { t } = useT()
  const [closed, setClosed] = useState(false)
  const [busy, setBusy] = useState(false)
  // Read once: what the last run left behind.
  const saved = useMemo(
    () => ({
      unclean: bootSettings.lastExitUnclean === true,
      session: bootSettings.session as SavedSession | undefined,
      outputs: (bootSettings.sessionOutputs as WantedOutputs | undefined) ?? { audience: null, stage: null }
    }),
    []
  )
  // The crashed service may not be the one open now (several services): load it to offer it too.
  const [other, setOther] = useState<Service | null>(null)
  useEffect(() => {
    const id = saved.session?.serviceId
    if (!saved.unclean || !saved.session?.live || !id || id === useApp.getState().service.id) return
    window.nl.data.getService(id).then((svc) => svc && setOther(svc))
  }, [saved])
  const elsewhere = !!other && service.id !== other.id
  const offer = resumeOffer(saved.unclean, saved.session, service) ?? (elsewhere ? resumeOffer(saved.unclean, saved.session, other!) : null)

  const close = (): void => {
    setClosed(true)
    window.nl.data.setSetting('lastExitUnclean', false)
  }
  // Going live with anything else answers the question.
  useEffect(() => {
    if (live && !busy && offer) close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live])

  if (closed || !offer) return null

  const where = (['audience', 'stage'] as const)
    .filter((k) => saved.outputs[k])
    .map((k) => t(k === 'audience' ? 'service.resume.outputOn' : 'service.resume.stageOn', { name: saved.outputs[k]!.label }))

  const resume = async (): Promise<void> => {
    setBusy(true)
    // Another service was live: open it first (refused during rehearsal).
    if (elsewhere && !(await useApp.getState().openService(other!.id))) {
      setBusy(false)
      window.alert(tr('service.resume.endRehearsal'))
      return
    }
    // Live first, so the outputs show the right slide as soon as they load.
    useApp.getState().goLive(offer.item.id, offer.index)
    const [displays, status] = await Promise.all([window.nl.displays.list(), window.nl.screens.status()])
    const used: number[] = []
    for (const kind of ['audience', 'stage'] as ScreenKind[]) {
      const want = saved.outputs[kind]
      if (!want) continue
      if (status[kind].open) {
        if (status[kind].displayId !== null) used.push(status[kind].displayId!)
        continue
      }
      const d = matchDisplay(want, displays, used)
      // The display isn't there: use another external one if any, never cover the operator screen.
      const fallback = displays.find((x) => !x.primary && !used.includes(x.id))
      const target = d ?? fallback
      if (!target) continue
      used.push(target.id)
      await window.nl.screens.open(kind, target.id)
    }
    close()
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-accent/30 bg-accent-soft px-4 text-[12.5px] text-fg">
      <History size={15} className="shrink-0 text-accent-text" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold">{t('service.resume.title')}</span> {elsewhere ? `${other!.name} · ` : ''}
        {t('service.resume.where', { title: offer.item.title, n: offer.index + 1 })}
        {where.length > 0 && <span className="text-muted"> · {where.join(' · ')}</span>}
      </span>
      <button
        disabled={busy}
        onClick={resume}
        className="shrink-0 whitespace-nowrap rounded-md bg-accent-fill px-3 py-1 text-[12px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-60"
      >
        {t('service.resume.resume')}
      </button>
      <button onClick={close} className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] text-muted hover:bg-panel-2 hover:text-fg">
        {t('service.dismiss')}
      </button>
    </div>
  )
}

interface Notice {
  id: number
  text: string
  tone: 'ok' | 'warn'
}

/** Toasts for output problems. "Stop waiting" forgets an output whose display is gone. */
function OutputNotices() {
  const [notes, setNotes] = useState<Notice[]>([])
  const [screens, setScreens] = useState<ScreensStatus | null>(null)
  const { t } = useT()
  useEffect(() => {
    let n = 0
    window.nl.screens.status().then(setScreens)
    const offS = window.nl.screens.onStatus(setScreens)
    const offN = window.nl.screens.onNotice(({ text, tone }) => {
      const id = ++n
      setNotes((l) => [...l.slice(-2), { id, text, tone }])
      setTimeout(() => setNotes((l) => l.filter((x) => x.id !== id)), tone === 'ok' ? 5000 : 12000)
    })
    return () => {
      offS()
      offN()
    }
  }, [])
  const lost = (['audience', 'stage'] as const).filter((k) => screens?.[k].lost)
  if (!notes.length) return null
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-[360px] flex-col gap-2">
      {notes.map((m) => (
        <div
          key={m.id}
          className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-panel-2 px-3 py-2.5 text-[12.5px] shadow-2xl ${
            m.tone === 'ok' ? 'border-emerald-500/40' : 'border-amber-400/40'
          }`}
        >
          {m.tone === 'ok' ? (
            <MonitorCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          ) : (
            <MonitorX size={16} className="mt-0.5 shrink-0 text-amber-300" />
          )}
          <div className="min-w-0 flex-1">
            <div className="leading-snug">{m.text}</div>
            {m.tone === 'warn' && lost.length > 0 && (
              <button
                onClick={() => {
                  lost.forEach((k) => window.nl.screens.forget(k))
                  setNotes((l) => l.filter((x) => x.id !== m.id))
                }}
                className="mt-1 text-[11.5px] text-muted underline hover:text-fg"
              >
                {t('service.resume.stopWaiting')}
              </button>
            )}
          </div>
          <button onClick={() => setNotes((l) => l.filter((x) => x.id !== m.id))} className="text-muted hover:text-fg" title={t('common.close')}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
