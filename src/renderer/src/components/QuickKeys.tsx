import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { CornerDownLeft, Undo2, X } from 'lucide-react'
import CommandPalette, { isMac } from './CommandPalette'
import { SCRATCH_ID, useApp } from '@/store/useApp'
import { dismissToast, redo, startHistory, undo, useHistory } from '@/store/history'
import { findNextSection, findVerse, type SectionKind } from '@/lib/sections'
import type { ServiceItem } from '@shared/types'
import { modalBlocks, useModal } from '@/lib/modal'
import { t, tn, useT, type StringKey } from '@/i18n'

/** Open state of the palette and the shortcut sheet (the "?" button in the slide grid opens the sheet too). */
export const useQuick = create<{ palette: boolean; help: boolean }>()(() => ({ palette: false, help: false }))
export const openHelp = (): void => useQuick.setState({ help: true, palette: false })

const SECTION_KEYS: Record<string, SectionKind> = { c: 'chorus', b: 'bridge', r: 'bridge', p: 'pre-chorus', e: 'ending' }
const NO_SECTION: Partial<Record<SectionKind, StringKey>> = {
  chorus: 'service.qk.noChorus',
  bridge: 'service.qk.noBridge',
  'pre-chorus': 'service.qk.noPreChorus',
  ending: 'service.qk.noEnding'
}

/** The hint bubble while typing a jump; `enter` shows the ⏎ icon (a slide number waits for Enter). */
type Hint = { text: string; enter?: boolean }

const isTyping = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/** The item quick keys act on: the live one, else the selected one. */
function targetItem(): ServiceItem | undefined {
  const s = useApp.getState()
  if (s.live) return s.live.itemId === SCRATCH_ID ? s.scratch ?? undefined : s.service.items.find((i) => i.id === s.live!.itemId)
  return s.service.items.find((i) => i.id === s.selectedItemId) ?? s.service.items.find((i) => i.slides.length)
}

/** Where on the item we are now: the cued slide in Preview mode, else the live one. */
function currentIndex(item: ServiceItem): number {
  const s = useApp.getState()
  if (s.clickMode === 'preview' && s.cue?.itemId === item.id) return s.cue.index
  return s.live?.itemId === item.id ? s.live.index : -1
}

/** Jumps follow the click mode: straight to Live, or into Preview. */
function jump(item: ServiceItem, index: number): void {
  const s = useApp.getState()
  if (s.clickMode === 'preview' && item.id !== SCRATCH_ID) s.setCue(item.id, index)
  else if (item.id === SCRATCH_ID) useApp.setState({ live: { itemId: SCRATCH_ID, index }, black: false })
  else s.goLive(item.id, index)
}

/**
 * Speed keys on top of the basic shortcuts in OperatorApp: section jumps, slide numbers, Cmd/Ctrl+K, undo/redo.
 * Runs in the capture phase so a pending number can take Enter/Esc before Esc clears the screen.
 */
export default function QuickKeys() {
  const palette = useQuick((s) => s.palette)
  const help = useQuick((s) => s.help)
  const toast = useHistory((s) => s.toast)
  const [hint, setHint] = useState<Hint | null>(null)
  const buf = useRef('')
  const verseWait = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useT()

  useEffect(() => startHistory(), [])

  useEffect(() => {
    const flash = (text: string | null, ms = 1500, enter = false): void => {
      clearTimeout(timer.current)
      setHint(text ? { text, enter } : null)
      if (text)
        timer.current = setTimeout(() => {
          buf.current = ''
          verseWait.current = false
          setHint(null)
        }, ms)
    }
    const reset = (): void => {
      buf.current = ''
      verseWait.current = false
      flash(null)
    }

    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (mod && !e.altKey && key === 'k') {
        e.preventDefault()
        e.stopPropagation()
        useQuick.setState((q) => ({ palette: !q.palette, help: false }))
        return
      }
      const q = useQuick.getState()
      if (q.palette) return // the palette handles its own keys
      if (q.help) {
        if (key === 'Escape' || key === '?') {
          e.preventDefault()
          e.stopPropagation()
          useQuick.setState({ help: false })
        }
        return
      }
      // Any other dialog, menu or popover (Settings, Sunday check, song editor…): quick keys and undo stay off.
      if (modalBlocks(e)) return
      const typing = isTyping(e.target)
      if (mod && !e.altKey && (key === 'z' || (key === 'y' && e.ctrlKey && !e.metaKey))) {
        if (typing) return // the field's own text undo
        e.preventDefault()
        e.stopPropagation()
        if (key === 'y' || e.shiftKey) redo()
        else undo()
        return
      }
      if (typing || mod || e.altKey) return
      // Lists with their own keys (the Songs list: Enter adds, E edits) keep them.
      if (e.target instanceof Element && e.target.closest('[data-own-keys]')) return

      const item = targetItem()
      const stop = (): void => {
        e.preventDefault()
        e.stopPropagation()
      }

      if (verseWait.current) {
        verseWait.current = false
        if (/^[1-9]$/.test(key)) {
          stop()
          const at = item ? findVerse(item.slides, Number(key)) : null
          if (item && at !== null) {
            jump(item, at)
            flash(null)
          } else flash(t('service.qk.noVerse', { n: key }))
          return
        }
        flash(null)
        if (key === 'Escape') return stop()
      }

      if (/^[0-9]$/.test(key)) {
        stop()
        if (buf.current.length >= 3 || (!buf.current && key === '0')) return
        buf.current += key
        flash(t('service.qk.goTo', { n: buf.current }), 4000, true)
        return
      }
      if (buf.current) {
        if (key === 'Backspace') {
          stop()
          buf.current = buf.current.slice(0, -1)
          return buf.current ? flash(t('service.qk.goTo', { n: buf.current }), 4000, true) : reset()
        }
        if (key === 'Escape') {
          stop()
          return reset()
        }
        if (key === 'Enter') {
          stop()
          const n = Number(buf.current)
          buf.current = ''
          if (item && n >= 1 && n <= item.slides.length) {
            jump(item, n - 1)
            flash(null)
          } else flash(item ? tn('service.qk.itemHas', item.slides.length) : t('service.qk.nothing'))
          return
        }
      }

      if (key === 'Enter' && useApp.getState().clickMode === 'preview' && useApp.getState().cue) {
        stop()
        useApp.getState().takeCue()
        return
      }
      if (key === '?') {
        stop()
        useQuick.setState({ help: true })
        return
      }
      if (key === 'v') {
        stop()
        verseWait.current = true
        flash(t('service.qk.verseWait'), 2500)
        return
      }
      const kind = SECTION_KEYS[key]
      if (kind) {
        stop()
        if (!item) return
        const at = findNextSection(item.slides, kind, currentIndex(item))
        if (at !== null) jump(item, at)
        else flash(t(NO_SECTION[kind] ?? 'service.qk.noChorus'))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <>
      {hint && (
        <div className="pointer-events-none fixed bottom-36 left-1/2 z-[70] -translate-x-1/2 rounded-lg border border-line bg-panel-2 px-3.5 py-2 text-[13px] font-medium shadow-2xl">
          <span className="flex items-center gap-2">
            {hint.text}
            {hint.enter && <CornerDownLeft size={14} className="text-accent-text" />}
          </span>
        </div>
      )}
      {toast && (
        <div key={toast.id} className="fixed bottom-20 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-panel-2 py-1.5 pl-3.5 pr-1.5 text-[13px] shadow-2xl">
          <span className="max-w-[360px] truncate">{toast.text}</span>
          <button
            onClick={() => undo()}
            className="flex items-center gap-1 rounded-md bg-accent-soft px-2 py-1 text-[12px] font-semibold text-accent-text hover:bg-accent/25"
          >
            <Undo2 size={13} /> {t('common.undo')}
          </button>
          <button onClick={dismissToast} className="rounded p-1 text-dim hover:text-fg" title={t('service.dismiss')}>
            <X size={13} />
          </button>
        </div>
      )}
      {palette && <CommandPalette onClose={() => useQuick.setState({ palette: false })} onHelp={openHelp} />}
      {help && <ShortcutSheet onClose={() => useQuick.setState({ help: false })} />}
    </>
  )
}

const M = isMac ? '⌘' : 'Ctrl+'

/** The cheat sheet, built at render: key names stay as they are, the descriptions are translated. */
function shortcuts(): [string, [string, string][]][] {
  return [
    [
      t('live.live'),
      [
        ['→  Space  PageDown', t('service.keys.nextSlide')],
        ['←  PageUp', t('service.keys.prevSlide')],
        [t('service.keys.or', { a: '`', b: '.' }), t('service.keys.black')],
        ['H', t('service.keys.hideText')],
        ['Esc', t('service.keys.clear')],
        ['⏎', t('service.keys.takePreview')]
      ]
    ],
    [
      t('service.keys.groupJump'),
      [
        ['C', t('service.keys.nextChorus')],
        [t('service.keys.then', { a: 'V', b: '1–9' }), t('service.keys.thatVerse')],
        ['P', t('service.keys.preChorus')],
        [t('service.keys.or', { a: 'B', b: 'R' }), t('service.keys.bridge')],
        ['E', t('service.keys.ending')],
        ['12 ⏎', t('service.keys.slideN', { n: 12 })]
      ]
    ],
    [
      t('service.keys.groupAnywhere'),
      [
        [`${M}K`, t('service.keys.find')],
        [`${M}Z`, t('service.keys.undo')],
        [isMac ? '⇧⌘Z' : 'Ctrl+Y', t('common.redo')],
        [`${M}1–6  ·  F1–F6`, t('service.keys.tabs')],
        ['?', t('service.keys.thisSheet')]
      ]
    ]
  ]
}

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  useModal()
  useT()
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-[640px] rounded-xl border border-line bg-panel-2 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[15px] font-semibold">{t('service.keys.title')}</span>
          <button onClick={onClose} title={t('common.close')} className="rounded p-1 text-muted hover:bg-panel-3 hover:text-fg">
            <X size={15} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {shortcuts().map(([group, rows]) => (
            <div key={group}>
              <div className="label-caps mb-2">{group}</div>
              {rows.map(([k, what]) => (
                <div key={k} className="mb-1.5 text-[12.5px]">
                  <kbd className="rounded bg-panel-3 px-1.5 py-0.5 font-sans text-[11.5px] font-semibold text-fg">{k}</kbd>
                  <div className="mt-0.5 text-muted">{what}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11.5px] leading-snug text-dim">{t('service.keys.footer')}</p>
      </div>
    </div>
  )
}
