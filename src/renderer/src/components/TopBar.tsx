import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Drama, Monitor, MonitorOff, Music, Settings, Smartphone, Wifi } from 'lucide-react'
import type { DisplayInfo, ScreensStatus } from '@shared/types'
import NetworkPanel, { useNetStatus } from './NetworkPanel'
import SettingsDialog from './SettingsDialog'
import ChatButton from './ChatButton'
import ServiceMenu from './ServiceMenu'
import { useApp } from '@/store/useApp'
import { usePlayer } from '@/store/usePlayer'
import { useModal } from '@/lib/modal'
import { BrandMark } from './BrandMark'
import { useT } from '@/i18n'

export function Logo() {
  return (
    <div className="flex items-center gap-2.5" title="NLPresenter"> {/* i18n-ignore: brand */}
      <BrandMark className="h-[18px] text-fg" />
      <span className="text-[11.5px] font-semibold tracking-[0.18em] text-fg/90">PRESENTER</span>
    </div>
  )
}

export default function TopBar() {
  const isMac = window.nl.platform === 'darwin'
  const serviceName = useApp((s) => s.service.name)
  const aspect = useApp((s) => s.aspect)
  const setAspect = useApp((s) => s.setAspect)
  const [screens, setScreens] = useState<ScreensStatus | null>(null)
  const status = screens?.audience ?? { open: false, displayId: null }
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [menu, setMenu] = useState(false)
  const [wireless, setWireless] = useState(false)
  const net = useNetStatus()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { t } = useT()
  useModal(menu, () => setMenu(false))

  useEffect(() => {
    window.nl.screens.status().then(setScreens)
    window.nl.displays.list().then(setDisplays)
    const offS = window.nl.screens.onStatus(setScreens)
    const offD = window.nl.displays.onChange(setDisplays)
    return () => {
      offS()
      offD()
    }
  }, [])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  const open = async (id: number | null): Promise<void> => {
    setMenu(false)
    setScreens(await window.nl.screens.open('audience', id))
  }

  const current = displays.find((d) => d.id === status.displayId)

  return (
    <>
      <header className={`drag flex h-12 shrink-0 items-center gap-4 border-b border-line bg-panel px-4 ${isMac ? 'pl-20' : ''}`}>
      <Logo />
      <ServiceMenu />

      <div className="flex-1" />

      <RehearseButton />

      <div className="no-drag flex items-center rounded-md bg-panel-2 p-0.5 text-[12px]">
        {(['16:9', '4:3'] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAspect(a)}
            className={`rounded px-2 py-1 ${aspect === a ? 'bg-panel-3 text-fg' : 'text-muted hover:text-fg'}`}
          >
            {a}
          </button>
        ))}
      </div>

      <div ref={menuRef} className="no-drag relative flex">
        {status.open ? (
          <button
            onClick={() => window.nl.screens.close('audience')}
            className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent-soft px-3 py-1.5 text-[13px] font-medium text-accent-text hover:bg-accent/25"
            title={t('topbar.closeOutput')}
          >
            <MonitorOff size={15} />
            <span className="whitespace-nowrap">{t('topbar.outputOn', { name: current?.label ?? t('topbar.window') })}</span>
          </button>
        ) : (
          <button
            onClick={() => open(null)}
            className="relative flex items-center gap-2 rounded-l-md bg-accent-fill px-3 py-1.5 text-[13px] font-semibold text-on-accent hover:brightness-110"
            title={screens?.audience.lost ? t('topbar.outputLostHint') : undefined}
          >
            <Monitor size={15} />
            <span className="whitespace-nowrap">{screens?.audience.lost ? t('topbar.outputLost') : t('topbar.openOutput')}</span>
            {(screens?.audience.lost || screens?.stage.lost) && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-live ring-2 ring-panel" />
            )}
          </button>
        )}
        <button
          onClick={() => setMenu((m) => !m)}
          className={`relative border-l px-1.5 ${
            status.open
              ? 'ml-1 rounded-md border-accent/40 bg-accent-soft text-accent-text hover:bg-accent/25'
              : 'rounded-r-md border-white/20 bg-accent-fill text-on-accent hover:brightness-110'
          }`}
          title={t('topbar.chooseDisplay')}
          data-guide="output-menu"
        >
          <ChevronDown size={15} />
          {(net?.clients.display ?? 0) > 0 && (
            <span className="absolute -right-1.5 -top-1.5 rounded-full bg-emerald-500 px-1 text-[9.5px] font-bold text-white">
              {net!.clients.display}
            </span>
          )}
        </button>
        {menu && (
          <div className={`absolute right-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border border-line bg-panel-2 py-1 shadow-2xl ${wireless ? 'w-[420px]' : 'w-72'}`}>
            <div className="label-caps px-3 py-1.5">{t('topbar.sendOutputTo')}</div>
            {displays.map((d) => (
              <button
                key={d.id}
                disabled={status.open}
                onClick={() => open(d.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-panel-3 disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <span>
                  {d.label}
                  {d.id === status.displayId ? ' ✓' : ''}
                </span>
                <span className="text-[11px] text-muted">
                  {d.width}×{d.height}
                  {d.primary ? ` · ${t('topbar.mainDisplay')}` : ''}
                </span>
              </button>
            ))}
            {displays.length < 2 && (
              <p className="border-t border-line px-3 py-2 text-[11.5px] leading-snug text-muted">
                {t('topbar.oneDisplay')}
              </p>
            )}
            <div className="mt-1 border-t border-line">
              <button
                onClick={() => setWireless((w) => !w)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-panel-3"
              >
                <Wifi size={14} className="text-accent-text" />
                <span className="flex-1">{t('topbar.wirelessScreens')}</span>
                <span className="text-[11px] text-muted">{t('topbar.connected', { n: net?.clients.display ?? 0 })}</span>
              </button>
              {wireless && <NetworkPanel target="display" />}
            </div>
          </div>
        )}
      </div>

      <MusicButton />
      <ChatButton />
      <RemoteButton />

      <button
        onClick={() => setSettingsOpen(true)}
        className="no-drag rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-fg"
        title={t('topbar.settingsHint')}
      >
        <Settings size={17} />
      </button>
      </header>
      {/* Outside the header: its drag area is inherited and would turn every click in the dialog into a window drag. */}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

function MusicButton() {
  const open = usePlayer((s) => s.open)
  const playing = usePlayer((s) => s.playing)
  const { t } = useT()
  return (
    <button
      onClick={() => usePlayer.getState().setOpen(!open)}
      className={`no-drag relative rounded-md p-1.5 ${open || playing ? 'text-accent-text' : 'text-muted hover:bg-panel-2 hover:text-fg'}`}
      title={t('topbar.musicPlayer')}
    >
      <Music size={17} />
      {playing && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
    </button>
  )
}

function RemoteButton() {
  const net = useNetStatus()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useT()
  useModal(open, () => setOpen(false))
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  const n = net?.clients.remote ?? 0
  return (
    <div ref={ref} className="no-drag relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] ${
          net?.running ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-panel-2 hover:text-fg'
        }`}
        title={t('topbar.phoneRemote')}
        data-guide="remote"
      >
        <Smartphone size={16} />
        <span className="whitespace-nowrap">{t('topbar.remote')}</span>
        {n > 0 && <span className="rounded-full bg-accent-fill px-1.5 text-[10.5px] font-bold text-on-accent">{n}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[420px] rounded-lg border border-line bg-panel-2 shadow-2xl">
          <div className="label-caps px-4 pt-3">{t('topbar.remoteTitle')}</div>
          <NetworkPanel target="remote" />
        </div>
      )}
    </div>
  )
}

/** Rehearsal: click through the service without the screens following. */
function RehearseButton() {
  const on = useApp((s) => !!s.rehearsal)
  const start = useApp((s) => s.startRehearsal)
  const end = useApp((s) => s.endRehearsal)
  const { t } = useT()
  return (
    <button
      onClick={on ? end : start}
      title={on ? t('topbar.endRehearsal') : t('topbar.rehearseHint')}
      data-guide="rehearse"
      className={`no-drag flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium ${
        on ? 'bg-amber-400 text-black hover:brightness-110' : 'bg-panel-2 text-muted hover:text-fg'
      }`}
    >
      <Drama size={14} /> <span className="whitespace-nowrap">{on ? t('topbar.rehearsing') : t('topbar.rehearse')}</span>
    </button>
  )
}
