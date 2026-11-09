import { useEffect } from 'react'
import TopBar from '@/components/TopBar'
import TabBar, { TABS } from '@/components/TabBar'
import LiveSidebar from '@/components/LiveSidebar'
import PresentationTab from './PresentationTab'
import SongsTab from './SongsTab'
import ScriptureTab from './ScriptureTab'
import SongEditor from './SongEditor'
import CountdownTab from './CountdownTab'
import StageTab from './StageTab'
import MediaTab from './MediaTab'
import AudioPlayer from '@/components/AudioPlayer'
import { bootSettings, publishedSnapshot, useApp } from '@/store/useApp'
import DeckProgress from '@/components/DeckProgress'
import QuickKeys from '@/components/QuickKeys'
import RehearsalBar from '@/components/RehearsalBar'
import ResumeBanner from '@/components/ResumeBanner'
import { usePlayer } from '@/store/usePlayer'
import { applyAccent } from '@/lib/appearance'
import { modalBlocks } from '@/lib/modal'
import { onLangChange, getLang, t, useT } from '@/i18n'

/** Publish the live picture on every change, and run commands coming from phones. */
function useLiveSync(): void {
  useEffect(() => {
    let last = ''
    const push = (): void => {
      const snap = { ...publishedSnapshot(useApp.getState()), lang: getLang() }
      const key = JSON.stringify({ ...snap, serverTime: 0 })
      if (key !== last) {
        last = key
        window.nl.state.set(snap)
      }
    }
    push()
    const unsub = useApp.subscribe(push)
    const offLang = onLangChange(push)
    // Phone remotes pause while rehearsing: their screens stay frozen too, so commands would act unseen.
    const offCmd = window.nl.state.onCommand((cmd) => {
      if (!useApp.getState().rehearsal) useApp.getState().runCommand(cmd)
    })
    return () => {
      unsub()
      offLang()
      offCmd()
    }
  }, [])
}

/** Tabs whose own lists use ↑/↓: there the arrows never drive the projector. */
const LIST_TABS = ['songs', 'scripture', 'media']
/** Focus inside one of these keeps its own arrow/Space keys (lists, menus, selects). */
const LIST_FOCUS = 'select, [role="listbox"], [role="list"], [role="grid"], [role="menu"], [role="radiogroup"], [data-own-keys]'

/** After switching tab, focus that tab's search box (marked with data-tab-search) once it has mounted. */
function focusTabSearch(tab: string, tries = 20): void {
  const el = document.querySelector<HTMLInputElement>(`[data-tab-search="${tab}"]`)
  if (el) {
    el.focus()
    el.select()
  } else if (tries > 0) requestAnimationFrame(() => focusTabSearch(tab, tries - 1))
}

/** Operator shortcuts. Ignored while typing in a field, and while any dialog or popover is open. */
function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (modalBlocks(e)) return
      // F1–F6, or Cmd/Ctrl+1–6. The digit is read from the physical key so it also works on layouts like AZERTY.
      const fKey = /^F([1-6])$/.exec(e.key)
      const numKey = (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey ? /^(?:Digit|Numpad)([1-6])$/.exec(e.code) : null
      const n = fKey?.[1] ?? numKey?.[1]
      if (n) {
        e.preventDefault()
        const id = TABS[Number(n) - 1].id
        useApp.getState().setTab(id)
        if (LIST_TABS.includes(id)) focusTabSearch(id)
        return
      }
      const t = e.target as HTMLElement
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) {
        if (e.key === 'Escape') t.blur()
        return
      }
      const s = useApp.getState()
      const slideKey = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'PageDown', 'PageUp', ' '].includes(e.key)
      if (slideKey && t instanceof Element && t.closest(LIST_FOCUS)) return
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && LIST_TABS.includes(s.tab)) return
      // Black screen: ` (the key left of 1, read physically so it works on any layout) or "." (clickers).
      if ((e.key === '`' || e.code === 'Backquote') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        s.toggleBlack()
        return
      }
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          s.next()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          s.prev()
          break
        case '.':
          s.toggleBlack()
          break
        case 'h':
        case 'H':
          s.toggleHideText()
          break
        case 'Escape':
          s.clearLive()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function OperatorApp() {
  const tab = useApp((s) => s.tab)
  const ready = useApp((s) => s.ready)
  const editing = useApp((s) => s.editingSongId)
  const playerOpen = usePlayer((s) => s.open)
  useT() // re-render everything below when the language changes
  useEffect(() => {
    useApp.getState().hydrate().then(() => {
      applyAccent(bootSettings.accent)
      usePlayer.getState().hydrate(bootSettings.player)
    })
  }, [])
  useLiveSync()
  useShortcuts()

  if (!ready) return <div className="grid h-full place-items-center text-[13px] text-muted">{t('topbar.loadingLibrary')}</div>

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <RehearsalBar />
      <ResumeBanner />
      <TabBar />
      <main className="relative flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
          {tab === 'presentation' && <PresentationTab />}
          {tab === 'songs' && <SongsTab />}
          {tab === 'scripture' && <ScriptureTab />}
          {tab === 'media' && <MediaTab />}
          {tab === 'countdown' && <CountdownTab />}
          {tab === 'stage' && <StageTab />}
          {!['presentation', 'songs', 'scripture', 'media', 'countdown', 'stage'].includes(tab) && (
            <ComingSoon name={t(`tabs.${tab}` as 'tabs.presentation')} />
          )}
        </div>
        <LiveSidebar />
      </main>
      {editing && <SongEditor key={editing} />}
      {playerOpen && <AudioPlayer />}
      <DeckProgress />
      <QuickKeys />
    </div>
  )
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="grid flex-1 place-items-center">
      <div className="text-center">
        <div className="text-[15px] font-semibold">{name}</div>
        <div className="mt-1 text-[13px] text-muted">{t('topbar.comingSoon')}</div>
      </div>
    </div>
  )
}
