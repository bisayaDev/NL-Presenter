import { useState } from 'react'
import { FileDown, Loader2, Printer, X } from 'lucide-react'
import type { ChordNotation } from '@shared/chords'
import { bootSettings, useApp } from '@/store/useApp'
import { useModal } from '@/lib/modal'
import { buildPrintHtml, KIND_TITLE, printFileName, type PrintKind } from '@/lib/printSheet'
import { useT } from '@/i18n'

const KINDS: { id: PrintKind; hint: 'service.pd.runsheetHint' | 'service.pd.lyricsHint' | 'service.pd.chordsHint' }[] = [
  { id: 'runsheet', hint: 'service.pd.runsheetHint' },
  { id: 'lyrics', hint: 'service.pd.lyricsHint' },
  { id: 'chords', hint: 'service.pd.chordsHint' }
]

/** Print or save as PDF: run sheet, lyrics or chord charts for the open service. */
export default function PrintDialog({ onClose }: { onClose: () => void }) {
  useModal(true, onClose)
  const { t } = useT()
  const [kind, setKind] = useState<PrintKind>('runsheet')
  const [notation, setNotation] = useState<ChordNotation>(() => {
    const c = useApp.getState().stage.chords
    return c === 'nashville' ? 'nashville' : 'standard'
  })
  const [busy, setBusy] = useState<'pdf' | 'print' | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const html = (): string => {
    const s = useApp.getState()
    const churchName = typeof bootSettings.churchName === 'string' ? bootSettings.churchName : undefined
    return buildPrintHtml(s.service, s.songs, { kind, notation, churchName })
  }

  const run = async (what: 'pdf' | 'print'): Promise<void> => {
    setBusy(what)
    setDone(null)
    setError(null)
    try {
      if (what === 'pdf') {
        const path = await window.nl.print.pdf(html(), printFileName(useApp.getState().service, kind))
        if (path) setDone(t('service.pd.saved', { path }))
      } else {
        await window.nl.print.print(html())
      }
    } catch (e) {
      setError(String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[min(460px,94vw)] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl">
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-text">
            <Printer size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">{t('service.pd.title')}</div>
            <div className="truncate text-[12px] text-muted">{useApp.getState().service.name}</div>
          </div>
          <button onClick={onClose} title={t('common.close')} className="rounded p-1.5 text-muted hover:bg-panel-2 hover:text-fg">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 px-5 py-4">
          <div className="label-caps">{t('service.pd.what')}</div>
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={`block w-full rounded-lg border px-3 py-2 text-left ${
                kind === k.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-panel-2'
              }`}
            >
              <div className={`text-[13.5px] font-medium ${kind === k.id ? 'text-accent-text' : ''}`}>{t(KIND_TITLE[k.id])}</div>
              <div className="text-[12px] text-muted">{t(k.hint)}</div>
            </button>
          ))}

          {kind === 'chords' && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-[12.5px] text-muted">{t('service.pd.chordsAs')}</span>
              <div className="flex rounded-md bg-panel-2 p-0.5 text-[12px]">
                {(['standard', 'nashville'] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setNotation(n)}
                    className={`rounded px-2.5 py-1 ${notation === n ? 'bg-panel-3 text-fg' : 'text-muted hover:text-fg'}`}
                  >
                    {n === 'standard' ? t('service.pd.standard') : t('service.pd.nashville')}
                  </button>
                ))}
              </div>
            </div>
          )}
          {done && <p className="break-all pt-1 text-[12px] text-emerald-400">{done}</p>}
          {error && <p className="pt-1 text-[12px] text-live">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            onClick={() => run('print')}
            disabled={!!busy}
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] text-muted hover:border-accent hover:text-accent-text disabled:opacity-50"
          >
            {busy === 'print' ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />} {t('service.pd.print')}
          </button>
          <button
            onClick={() => run('pdf')}
            disabled={!!busy}
            className="flex items-center gap-1.5 rounded-md bg-accent-fill px-3 py-1.5 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-50"
          >
            {busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} {t('service.pd.savePdf')}
          </button>
        </div>
      </div>
    </div>
  )
}
