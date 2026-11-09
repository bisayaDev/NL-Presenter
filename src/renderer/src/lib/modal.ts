import { useEffect, useRef } from 'react'

/**
 * Tiny registry of open dialogs, menus and popovers. While any is open, the live shortcuts
 * (arrows, Space, Esc, B, H, quick keys) do nothing, so Esc closes the dialog without clearing the screen.
 *
 * Why a per-event snapshot: a dialog's own Esc handler closes it, and React may unmount it (and unregister)
 * in a microtask before the bubble-phase shortcut handler runs. So we decide "a modal was open" once, at the
 * very start of each key event, in a capture listener registered when this module loads (before any other).
 */
let open = 0
const blocked = new WeakSet<Event>()

const anyOpen = (): boolean => open > 0 || !!document.querySelector('[aria-modal="true"]')

if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (e) => {
      if (anyOpen()) blocked.add(e)
    },
    true
  )
}

/**
 * Mark a dialog/popover as open while mounted (or while `active` is true).
 * `onEscape` (optional): close it on Esc, for popovers that had no Esc key of their own.
 */
export function useModal(active = true, onEscape?: () => void): void {
  const esc = useRef(onEscape)
  esc.current = onEscape
  useEffect(() => {
    if (!active) return
    open++
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && esc.current) esc.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      open--
      window.removeEventListener('keydown', onKey, true)
    }
  }, [active])
}

/** True if this key event started while a dialog or popover was open: global shortcuts must ignore it. */
export function modalBlocks(e?: Event): boolean {
  return (e ? blocked.has(e) : false) || anyOpen()
}
