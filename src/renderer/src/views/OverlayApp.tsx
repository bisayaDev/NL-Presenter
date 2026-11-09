import { useEffect } from 'react'
import OverlayView from '@/components/OverlayView'
import { useLanConnection } from '@/lib/net'
import { adoptOperatorLang, useT } from '@/i18n'

/** Browser-source page for OBS / vMix: transparent background, text only. */
export default function OverlayApp() {
  const conn = useLanConnection('overlay')
  useT()
  // Always the operator's language (OBS has no language picker; a choice saved in this browser is ignored).
  const lang = conn.snap?.lang
  useEffect(() => adoptOperatorLang(lang, true), [lang])

  useEffect(() => {
    for (const el of [document.documentElement, document.body]) el.style.background = 'transparent'
    document.body.style.overflow = 'hidden'
  }, [])

  // Show nothing while connecting: anything visible would end up in the broadcast.
  if (!conn.snap) return null
  return (
    <OverlayView frame={conn.snap.overlay} style={conn.snap.frame.style} offset={conn.offset} className="h-screen w-screen" />
  )
}
