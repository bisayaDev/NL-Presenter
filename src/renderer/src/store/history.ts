// Undo / redo for the service order. Every change to `service` is a step; quick bursts (typing a name) count as one.
import { create } from 'zustand'
import type { Service } from '@shared/types'
import { SCRATCH_ID, useApp } from './useApp'
import { t, tn } from '@/i18n'

const MAX = 50
const QUIET_MS = 500

interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  /** "Removed 'Amazing Grace'" with an Undo button, for a few seconds. */
  toast: { id: number; text: string } | null
}

export const useHistory = create<HistoryState>()(() => ({ canUndo: false, canRedo: false, toast: null }))

let past: Service[] = []
let future: Service[] = []
let committed: Service | null = null // the service as of the last step
let burst: ReturnType<typeof setTimeout> | undefined
let applying = false
let started = false
let toastTimer: ReturnType<typeof setTimeout> | undefined
let toastId = 0

const sync = (): void => useHistory.setState({ canUndo: past.length > 0, canRedo: future.length > 0 })

function showToast(text: string): void {
  clearTimeout(toastTimer)
  useHistory.setState({ toast: { id: ++toastId, text } })
  toastTimer = setTimeout(() => useHistory.setState({ toast: null }), 6000)
}

export const dismissToast = (): void => {
  clearTimeout(toastTimer)
  useHistory.setState({ toast: null })
}

/** Close the current burst so the next change is a new step. */
function settle(): void {
  if (burst) clearTimeout(burst)
  burst = undefined
  committed = useApp.getState().service
}

/** Start recording (after hydrate). Safe to call more than once. */
export function startHistory(): void {
  if (started) return
  started = true
  committed = useApp.getState().service
  useApp.subscribe((s, prev) => {
    if (s.service === prev.service || applying) return
    // Another service was opened: its own history starts fresh.
    if (s.service.id !== prev.service.id) {
      past = []
      future = []
      if (burst) clearTimeout(burst)
      burst = undefined
      committed = s.service
      dismissToast()
      sync()
      return
    }
    if (!burst && committed) {
      past.push(committed)
      if (past.length > MAX) past.shift()
      future = []
      sync()
    } else if (burst) clearTimeout(burst)
    burst = setTimeout(settle, QUIET_MS)

    const removed = prev.service.items.filter((it) => !s.service.items.some((x) => x.id === it.id))
    if (removed.length === 1) showToast(t('service.undo.removedOne', { title: removed[0].title }))
    else if (removed.length > 1) showToast(tn('service.undo.removedMany', removed.length))
  })
}

function apply(service: Service): void {
  applying = true
  try {
    useApp.setState((s) => {
      const has = (id: string | undefined): boolean => !!id && service.items.some((it) => it.id === id)
      return {
        service,
        // An item that comes back does not go live again; a live item that goes away leaves the screen.
        live: s.live && (s.live.itemId === SCRATCH_ID || has(s.live.itemId)) ? s.live : null,
        cue: s.cue && has(s.cue.itemId) ? s.cue : null,
        selectedItemId: has(s.selectedItemId ?? undefined) ? s.selectedItemId : null
      }
    })
  } finally {
    applying = false
  }
  committed = service
  sync()
}

export function undo(): boolean {
  settle()
  const cur = useApp.getState().service
  // The service might have been switched without our subscriber seeing it.
  const prev = past.pop()
  if (!prev || prev.id !== cur.id) {
    past = []
    sync()
    return false
  }
  future.push(cur)
  dismissToast()
  apply(prev)
  return true
}

export function redo(): boolean {
  settle()
  const cur = useApp.getState().service
  const nxt = future.pop()
  if (!nxt || nxt.id !== cur.id) {
    future = []
    sync()
    return false
  }
  past.push(cur)
  apply(nxt)
  return true
}
