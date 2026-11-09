import { create } from 'zustand'
import { Check, PartyPopper, X } from 'lucide-react'
import { DEFAULT_BG } from '@/lib/defaults'
import { spotlight } from '@/lib/guide'
import { bootSettings, useApp } from '@/store/useApp'
import { useT } from '@/i18n'

/**
 * First-run checklist on the Presentation tab. Five steps that tick themselves as the operator does them.
 * Saved as setting `onboarding` ({ done, dismissed }).
 */

type StepId = 'projector' | 'song' | 'background' | 'remote' | 'rehearse'

// Label = `service.ob.<id>`, hint = `service.ob.<id>Hint` (translated at render). "Show me" finds its target by
// data-guide / data-tab-search attributes, never by visible text.
const STEPS: { id: StepId; show: () => void }[] = [
  { id: 'projector', show: () => spotlight('[data-guide="output-menu"]', { click: true }) },
  {
    id: 'song',
    show: () => {
      useApp.getState().setTab('songs')
      spotlight('[data-tab-search="songs"]')
    }
  },
  {
    id: 'background',
    show: () => {
      useApp.getState().setTab('presentation')
      spotlight('heading:background')
    }
  },
  { id: 'remote', show: () => spotlight('[data-guide="remote"]', { click: true }) },
  { id: 'rehearse', show: () => spotlight('[data-guide="rehearse"]') }
]

interface Saved {
  done: string[]
  dismissed: boolean
}

const useOnboarding = create<Saved & { loaded: boolean }>(() => ({ done: [], dismissed: false, loaded: false }))

function save(): void {
  const { done, dismissed } = useOnboarding.getState()
  const v: Saved = { done, dismissed }
  bootSettings.onboarding = v
  window.nl.data.setSetting('onboarding', v)
}

function mark(id: StepId): void {
  const s = useOnboarding.getState()
  if (!s.loaded || s.done.includes(id)) return
  useOnboarding.setState({ done: [...s.done, id] })
  save()
}

export function dismissOnboarding(): void {
  useOnboarding.setState({ dismissed: true })
  save()
}

// Tracking runs in the operator window from startup (not only while the card is on screen).
let started = false
function start(): void {
  if (started) return
  started = true
  const saved = bootSettings.onboarding as Partial<Saved> | undefined
  useOnboarding.setState({
    done: Array.isArray(saved?.done) ? saved!.done.filter((x) => typeof x === 'string') : [],
    dismissed: saved?.dismissed === true,
    loaded: true
  })
  if (useOnboarding.getState().dismissed) return
  const app = useApp.getState()
  if (JSON.stringify(app.background) !== JSON.stringify(DEFAULT_BG)) mark('background')
  const songCount = (s: typeof app): number => s.service.items.filter((i) => i.kind === 'song').length
  useApp.subscribe((s, prev) => {
    if (s.background !== prev.background) mark('background')
    if (s.service.id === prev.service.id && songCount(s) > songCount(prev)) mark('song')
    if (s.rehearsal && !prev.rehearsal) mark('rehearse')
  })
  window.nl.screens.status().then((st) => st.audience.open && mark('projector'))
  window.nl.screens.onStatus((st) => st.audience.open && mark('projector'))
  window.nl.net.status().then((n) => n.clients.remote > 0 && mark('remote'))
  window.nl.net.onStatus((n) => n.clients.remote > 0 && mark('remote'))
}
if (typeof window !== 'undefined' && window.nl) {
  if (useApp.getState().ready) start()
  else {
    const off = useApp.subscribe((s) => {
      if (!s.ready) return
      off()
      start()
    })
  }
}

export default function Onboarding() {
  const { done, dismissed, loaded } = useOnboarding()
  const { t } = useT()
  if (!loaded || dismissed) return null
  const count = STEPS.filter((s) => done.includes(s.id)).length
  const all = count === STEPS.length

  return (
    <div className="mb-4 rounded-lg border border-line bg-panel-2 p-3">
      <div className="mb-2.5 flex items-center gap-3">
        {all && <PartyPopper size={15} className="shrink-0 text-accent-text" />}
        <span className="min-w-0 truncate text-[13px] font-semibold">{all ? t('service.ob.ready') : t('service.ob.getReady')}</span>
        <span className="shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-dim">
          {t('service.ob.progress', { done: count, total: STEPS.length })}
        </span>
        <div className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-panel-3">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(count / STEPS.length) * 100}%` }} />
        </div>
        <span className="flex-1" />
        <button
          onClick={dismissOnboarding}
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] text-muted hover:bg-panel-3 hover:text-fg"
          title={t('service.ob.hideHint')}
        >
          {all ? t('common.close') : t('service.ob.hide')} <X size={13} />
        </button>
      </div>
      {!all && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-1.5">
          {STEPS.map((s) => {
            const ok = done.includes(s.id)
            return (
              <div key={s.id} className={`flex flex-col gap-1 rounded-md p-2 ${ok ? 'bg-panel' : 'bg-panel-3'}`} title={t(`service.ob.${s.id}Hint`)}>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${ok ? 'bg-accent-fill text-on-accent' : 'border border-line'}`}
                  >
                    {ok && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className={`text-[12px] leading-tight ${ok ? 'text-muted line-through decoration-dim' : ''}`}>{t(`service.ob.${s.id}`)}</span>
                </div>
                {!ok && (
                  <button onClick={s.show} className="ml-5.5 self-start text-[11.5px] font-medium text-accent-text hover:underline">
                    {t('service.ob.showMe')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
