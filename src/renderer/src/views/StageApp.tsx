import { useEffect, useState } from 'react'
import { Guitar } from 'lucide-react'
import type { Snapshot, StageChords, StageLayout } from '@shared/types'
import StageView from '@/components/StageView'
import { useLanConnection } from '@/lib/net'
import { useT } from '@/i18n'
import LangPicker from '@/i18n/LangPicker'

/** Stage screen. Inside Electron (wired monitor) it listens over IPC; in a browser it uses the LAN server. */
export default function StageApp() {
  return window.nl ? <WiredStage /> : <WirelessStage />
}

function WiredStage() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [offset, setOffset] = useState(0)
  const { t } = useT() // follows the operator's language (main.tsx)
  useEffect(() => {
    document.body.style.cursor = 'none'
    const apply = (s: Snapshot | null): void => {
      if (!s) return
      setOffset(s.serverTime - Date.now())
      setSnap(s)
    }
    window.nl.state.get().then(apply)
    return window.nl.state.onSnapshot(apply)
  }, [])
  return snap ? (
    <StageView frame={snap.stage} audience={snap.frame} offset={offset} className="h-screen w-screen" />
  ) : (
    <Waiting text={t('stage.app.waiting')} />
  )
}

const CHORDS_KEY = 'nl-stage-chords'
const LAYOUT_KEY = 'nl-stage-layout'

function WirelessStage() {
  const conn = useLanConnection('stage')
  // This device's language (LangPicker / localStorage), else the operator's from the welcome message.
  const { t } = useT()
  useWakeLock()
  // This tablet's own chord setting ("" = follow the operator).
  const [chords, setChords] = useState<StageChords | ''>(() => (localStorage.getItem(CHORDS_KEY) as StageChords) || '')
  // This tablet's own layout ("" = follow the operator).
  const [layout, setLayout] = useState<StageLayout | ''>(() => (localStorage.getItem(LAYOUT_KEY) as StageLayout) || '')
  const [menu, setMenu] = useState(false)
  // The settings button sits over the "Next" lyrics, so it hides after a few seconds; a tap brings it back.
  const [button, setButton] = useState(true)
  const [poke, setPoke] = useState(0)
  useEffect(() => {
    if (menu || !button) return
    const t = setTimeout(() => setButton(false), 4000)
    return () => clearTimeout(t)
  }, [menu, button, poke])
  if (!conn.snap) return <Waiting text={conn.state === 'offline' ? t('common.reconnecting') : t('common.connecting')} />
  const frame = { ...conn.snap.stage, ...(chords ? { chords } : {}), ...(layout ? { layout } : {}) }
  const pick = (v: StageChords | ''): void => {
    setChords(v)
    if (v) localStorage.setItem(CHORDS_KEY, v)
    else localStorage.removeItem(CHORDS_KEY)
    setMenu(false)
  }
  const pickLayout = (v: StageLayout | ''): void => {
    setLayout(v)
    if (v) localStorage.setItem(LAYOUT_KEY, v)
    else localStorage.removeItem(LAYOUT_KEY)
    setMenu(false)
  }
  return (
    <div
      className="relative h-[100dvh] w-screen"
      onPointerDown={() => {
        setButton(true)
        setPoke((n) => n + 1)
      }}
    >
      <StageView frame={frame} audience={conn.snap.frame} offset={conn.offset} className="h-full w-full" />
      {menu && <div className="absolute inset-0" onClick={() => setMenu(false)} />}
      <button
        onClick={() => setMenu((m) => !m)}
        aria-label={t('stage.app.settings')}
        className={`absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white/70 ring-1 ring-white/15 transition-opacity duration-300 active:bg-white/25 ${
          button || menu ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <Guitar size={18} />
      </button>
      {menu && (
        <div className="absolute bottom-16 left-3 flex max-h-[calc(100dvh-5rem)] w-64 max-w-[calc(100vw-1.5rem)] flex-col overflow-y-auto rounded-xl bg-[#1b1f2a] text-[14px] text-white shadow-2xl ring-1 ring-white/10">
          <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">{t('stage.app.layoutHere')}</div>
          {(
            [
              ['', t('stage.app.sameAsOperator')],
              ['standard', t('stage.layout.standard')],
              ['lyrics', t('stage.app.lyricsLarge')],
              ['chords', t('stage.layout.chords')]
            ] as const
          ).map(([v, label]) => (
            <button key={`l-${v}`} onClick={() => pickLayout(v)} className={`px-4 py-2.5 text-left ${layout === v ? 'text-[#a99dff]' : ''}`}>
              {layout === v ? '✓ ' : ''}
              {label}
            </button>
          ))}
          <div className="mt-1 border-t border-white/10 px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">{t('stage.app.chordsHere')}</div>
          {(
            [
              ['', t('stage.app.sameAsOperator')],
              ['off', t('stage.app.hideChords')],
              ['standard', t('stage.chords.standard')],
              ['nashville', t('stage.chords.nashville')]
            ] as const
          ).map(([v, label]) => (
            <button key={v} onClick={() => pick(v)} className={`px-4 py-3 text-left ${chords === v ? 'text-[#a99dff]' : ''}`}>
              {chords === v ? '✓ ' : ''}
              {label}
            </button>
          ))}
          <div className="mt-1 border-t border-white/10 px-4 py-3">
            <LangPicker />
          </div>
        </div>
      )}
      {conn.state === 'offline' && (
        <div className="absolute right-3 top-3 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">{t('stage.app.offline')}</div>
      )}
    </div>
  )
}

function Waiting({ text }: { text: string }) {
  return <div className="grid h-[100dvh] w-screen place-items-center bg-black text-sm text-white/50">{text}</div>
}

/** Keep phones and tablets from sleeping while showing the stage. */
export function useWakeLock(): void {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const request = (): void => {
      nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    }
    request()
    const onVis = (): void => {
      if (document.visibilityState === 'visible') request()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      lock?.release().catch(() => {})
    }
  }, [])
}
