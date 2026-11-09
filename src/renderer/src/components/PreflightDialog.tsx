import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, RotateCw, X } from 'lucide-react'
import type { Background, ServiceItem } from '@shared/types'
import { DEFAULT_BG } from '@/lib/defaults'
import { formatBytes } from '@/lib/media'
import { today } from '@/lib/serviceDates'
import { minutesText, plannedTotal } from './MinutesControl'
import { bootSettings, findTemplate, useApp } from '@/store/useApp'
import { useModal } from '@/lib/modal'
import { findSmallText, splitSmallText } from '@/lib/fitCheck'
import { agoMs } from './SettingsExtras'
import { t, tn, useT } from '@/i18n'

/**
 * Sunday check (preflight): a quick look at what could go wrong before the service. Opened from the service menu,
 * and by itself the first time Rehearse is pressed on a given day (setting `preflightDay`).
 */

const OPEN_EVENT = 'nl-sunday-check'
export const openSundayCheck = (): void => {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/** A typical service; longer plans get a gentle warning. */
const TYPICAL_MINUTES = 90
const LOW_DISK = 1024 ** 3 // 1 GB

/** Always mounted in the operator window: opens the dialog on request or on the first rehearsal of the day. */
export function SundayCheckHost() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const show = (): void => setOpen(true)
    window.addEventListener(OPEN_EVENT, show)
    const offApp = useApp.subscribe((s, prev) => {
      if (!s.rehearsal || prev.rehearsal) return
      const day = today()
      if (bootSettings.preflightDay === day) return
      bootSettings.preflightDay = day
      window.nl.data.setSetting('preflightDay', day)
      setOpen(true)
    })
    // Remember that phones / stage tablets were used, so the check can warn when sharing is off later.
    const seen = (n: { clients: Record<string, number> }): void => {
      if (bootSettings.netUsedBefore || !Object.values(n.clients).some((c) => c > 0)) return
      bootSettings.netUsedBefore = true
      window.nl.data.setSetting('netUsedBefore', true)
    }
    window.nl.net.status().then(seen)
    const offNet = window.nl.net.onStatus(seen)
    return () => {
      window.removeEventListener(OPEN_EVENT, show)
      offApp()
      offNet()
    }
  }, [])
  return open ? <PreflightDialog onClose={() => setOpen(false)} /> : null
}

interface Fix {
  label: string
  run: () => void | Promise<unknown>
}
interface Check {
  id: string
  label: string
  ok: boolean
  detail?: string
  fixes?: Fix[]
}

const mediaRef = (b?: Background | null): string | null =>
  b && (b.kind === 'image' || b.kind === 'video') && b.src.startsWith('media/') ? b.src : null
const fileName = (ref: string): string => ref.replace(/^media\//, '')

/** "Song title: file.jpg" lines, at most five, then "and N more". */
const listLines = (lines: string[]): string => lines.slice(0, 5).join('\n') + (lines.length > 5 ? `\n${tn('service.check.andMore', lines.length - 5)}` : '')
const whereLabel = (u: { item?: ServiceItem; where: string }): string =>
  u.item ? u.item.title : u.where === 'logo' ? t('service.check.logo') : t('service.check.defaultBg')

function showItem(id: string): void {
  const s = useApp.getState()
  s.setTab('presentation')
  s.selectItem(id)
}

/** Runs every check; texts are in the current language (the dialog runs it again when the language changes). */
async function runChecks(): Promise<Check[]> {
  const s = useApp.getState()
  const items = s.service.items.filter((it) => it.kind !== 'section')
  const checks: Check[] = []

  // ----- media files -----
  // ref → where it is used
  const uses = new Map<string, { item?: ServiceItem; where: 'item' | 'slide' | 'look' | 'default' | 'logo' }[]>()
  const add = (ref: string | null, u: { item?: ServiceItem; where: 'item' | 'slide' | 'look' | 'default' | 'logo' }): void => {
    if (!ref) return
    uses.set(ref, [...(uses.get(ref) ?? []), u])
  }
  add(mediaRef(s.background), { where: 'default' })
  if (s.logo?.src?.startsWith('media/')) add(s.logo.src, { where: 'logo' })
  for (const it of items) {
    add(mediaRef(it.background), { item: it, where: 'item' })
    add(mediaRef(findTemplate(s, it.templateId)?.background), { item: it, where: 'look' })
    for (const sl of it.slides) add(mediaRef(sl.background), { item: it, where: 'slide' })
  }
  // Files from linked folders get their own check below.
  const isLinked = (ref: string): boolean => ref.startsWith('media/linked-')
  const media = await window.nl.media.check([...uses.keys()].filter((r) => !isLinked(r)))
  const missing = media.missing
  if (!missing.length) {
    checks.push({
      id: 'media',
      label: t('service.check.mediaFiles'),
      ok: true,
      detail: uses.size ? tn('service.check.mediaAllFound', uses.size) : t('service.check.noMedia')
    })
  } else {
    const list = missing.flatMap((ref) => (uses.get(ref) ?? []).map((u) => ({ ref, ...u })))
    const lines = [...new Set(list.map((u) => `${whereLabel(u)}: ${fileName(u.ref)}`))]
    const fixes: Fix[] = []
    if (list.some((u) => u.where === 'default')) fixes.push({ label: t('service.check.usePlain'), run: () => s.setBackground(DEFAULT_BG) })
    if (list.some((u) => u.where === 'logo')) fixes.push({ label: t('service.check.removeLogo'), run: () => s.setLogo(null) })
    const ownBg = list.filter((u) => u.where === 'item' && u.item)
    if (ownBg.length)
      fixes.push({
        label: t('service.check.useDefaultBg'),
        run: () => ownBg.forEach((u) => useApp.getState().setItemBackground(u.item!.id, undefined))
      })
    const other = list.find((u) => (u.where === 'slide' || u.where === 'look') && u.item)
    if (other) fixes.push({ label: t('service.check.show', { name: other.item!.title }), run: () => showItem(other.item!.id) })
    checks.push({
      id: 'media',
      label: tn('service.check.mediaMissing', missing.length),
      ok: false,
      detail: listLines(lines),
      fixes
    })
  }

  // ----- files from linked folders (shown from where they are, so a moved file or unplugged drive breaks them) -----
  const linkedRefs = [...uses.keys()].filter(isLinked)
  if (linkedRefs.length) {
    const gone = (await window.nl.media.check(linkedRefs)).missing
    const byRef = new Map(s.media.map((m) => [m.ref, m]))
    const lines = [
      ...new Set(
        gone.flatMap((ref) =>
          (uses.get(ref) ?? []).map((u) => {
            const m = byRef.get(ref)
            return `${whereLabel(u)}: ${m ? (m.path ?? m.name) : t('service.check.unlinkedFile')}`
          })
        )
      )
    ]
    const first = gone.flatMap((ref) => uses.get(ref) ?? []).find((u) => u.item)
    checks.push(
      gone.length
        ? {
            id: 'linked',
            label: tn('service.check.linkedMissing', gone.length),
            ok: false,
            detail: `${listLines(lines)}\n${t('service.check.plugIn')}`,
            fixes: [
              {
                label: t('service.check.refreshLinked'),
                run: async () => {
                  await window.nl.media.refreshLinked()
                  useApp.setState({ media: await window.nl.media.list() })
                }
              },
              ...(first ? [{ label: t('service.check.show', { name: first.item!.title }), run: () => showItem(first.item!.id) }] : [])
            ]
          }
        : { id: 'linked', label: t('service.check.linkedFiles'), ok: true, detail: tn('service.check.linkedAllFound', linkedRefs.length) }
    )
  }

  // ----- items with no slides -----
  const empty = items.filter((it) => it.slides.length === 0)
  if (!items.length)
    checks.push({ id: 'empty', label: t('service.check.serviceEmpty'), ok: false, detail: t('service.check.serviceEmptyDetail') })
  else if (empty.length)
    checks.push({
      id: 'empty',
      label: tn('service.check.noSlides', empty.length),
      ok: false,
      detail: empty.map((it) => it.title).join(', '),
      fixes: [
        { label: t('service.check.show', { name: empty[0].title }), run: () => showItem(empty[0].id) },
        { label: t('service.check.removeThem'), run: () => empty.forEach((it) => useApp.getState().removeItem(it.id)) }
      ]
    })
  else checks.push({ id: 'empty', label: t('service.check.allHaveSlides'), ok: true })

  // ----- audience display -----
  const [displays, screens] = await Promise.all([window.nl.displays.list(), window.nl.screens.status()])
  const external = displays.filter((d) => !d.primary)
  if (screens.audience.open) {
    const d = displays.find((x) => x.id === screens.audience.displayId)
    checks.push({
      id: 'display',
      label: t('service.check.outputOpen'),
      ok: true,
      detail: d ? t('service.check.onDisplay', { name: d.label }) : t('service.check.inWindow')
    })
  } else if (!external.length) {
    checks.push({ id: 'display', label: t('service.check.noProjector'), ok: false, detail: t('service.check.noProjectorDetail') })
  } else {
    checks.push({
      id: 'display',
      label: t('service.check.outputClosed'),
      ok: false,
      detail: t('service.check.displayConnected', { name: external[0].label }),
      fixes: [{ label: t('service.check.openOutputOn', { name: external[0].label }), run: () => window.nl.screens.open('audience', external[0].id) }]
    })
  }

  // ----- network sharing (only if phones or tablets were used before) -----
  const net = await window.nl.net.status()
  if (net.running) {
    const n = net.clients.remote + net.clients.stage + net.clients.display + net.clients.overlay
    checks.push({ id: 'net', label: t('service.check.netOn'), ok: true, detail: tn('service.check.devices', n) })
  } else if (bootSettings.netUsedBefore) {
    checks.push({
      id: 'net',
      label: t('service.check.netOff'),
      ok: false,
      detail: t('service.check.netOffDetail'),
      fixes: [{ label: t('service.check.turnOn'), run: () => window.nl.net.start() }]
    })
  }

  // ----- disk space -----
  if (media.freeBytes !== null) {
    const low = media.freeBytes < LOW_DISK
    checks.push({
      id: 'disk',
      label: low ? t('service.check.diskLow') : t('service.check.diskOk'),
      ok: !low,
      detail: low
        ? t('service.check.diskLowDetail', { size: formatBytes(media.freeBytes) })
        : t('service.check.diskFree', { size: formatBytes(media.freeBytes) })
    })
  }

  // ----- automatic backup age -----
  {
    const ab = await window.nl.backup.auto.status()
    const age = ab.lastAt ? Date.now() - ab.lastAt : Infinity
    const old = age > 7 * 24 * 3600_000 && !ab.current
    const when = ab.lastAt ? t('service.check.lastBackup', { ago: agoMs(ab.lastAt) }) : t('service.check.noBackupYet')
    checks.push({
      id: 'backup',
      label: old ? (ab.lastAt ? t('service.check.backupOld') : t('service.check.noRecentBackup')) : t('service.check.backupRecent'),
      ok: !old,
      detail: old ? `${when}${ab.enabled ? '' : ` ${t('service.check.autoOff')}`}${ab.error ? ` ${ab.error}` : ''}` : when,
      fixes: old ? [{ label: t('service.check.backUpNow'), run: () => window.nl.backup.auto.run().then(() => undefined) }] : undefined
    })
  }

  // ----- text too small (the projector shrinks it below ~60% of the look's size) -----
  const tiny = await findSmallText()
  if (tiny.length) {
    const first = tiny.find((x) => x.canSplit)
    checks.push({
      id: 'small-text',
      label: tn('service.check.smallText', tiny.length),
      ok: false,
      detail: listLines(tiny.map((x) => t('service.check.slideOf', { title: x.item.title, n: x.index + 1 }))),
      fixes: [
        ...(first ? [{ label: t('service.check.split', { title: first.item.title, n: first.index + 1 }), run: () => splitSmallText(first) }] : []),
        { label: t('service.check.show', { name: tiny[0].item.title }), run: () => showItem(tiny[0].item.id) }
      ]
    })
  } else if (items.some((it) => it.kind === 'song' || it.kind === 'text' || it.kind === 'scripture')) {
    checks.push({ id: 'small-text', label: t('service.check.textOk'), ok: true })
  }

  // ----- planned length -----
  const total = plannedTotal(s.service.items)
  if (total > 0) {
    const long = total > TYPICAL_MINUTES
    checks.push({
      id: 'time',
      label: long ? t('service.check.longService') : t('service.check.plannedTime'),
      ok: !long,
      detail: long
        ? t('service.check.plannedLong', { planned: minutesText(total), typical: minutesText(TYPICAL_MINUTES) })
        : t('service.check.planned', { planned: minutesText(total) })
    })
  }

  return checks
}

export default function PreflightDialog({ onClose }: { onClose: () => void }) {
  useModal()
  const { lang } = useT()
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [busy, setBusy] = useState(false)

  const run = useCallback(async () => {
    setBusy(true)
    try {
      setChecks(await runChecks())
    } finally {
      setBusy(false)
    }
  }, [])

  // Check texts are built in the current language: build them again when it changes.
  useEffect(() => {
    run()
  }, [run, lang])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const warnings = checks?.filter((c) => !c.ok).length ?? 0
  const fix = async (f: Fix): Promise<void> => {
    await f.run()
    await new Promise((r) => setTimeout(r, 300)) // let outputs open / state settle
    run()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-[560px] flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
      >
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-5">
          <ClipboardCheck size={16} className="text-accent-text" />
          <span className="shrink-0 text-[15px] font-semibold">{t('service.check.title')}</span>
          {checks && (
            <span className={`min-w-0 truncate text-[12px] ${warnings ? 'text-amber-300' : 'text-emerald-400'}`}>
              {warnings ? tn('service.check.toLookAt', warnings) : t('service.check.allGood')}
            </span>
          )}
          <span className="flex-1" />
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-panel-2 hover:text-fg" title={t('common.close')}>
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto p-5">
          {!checks ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-muted">
              <Loader2 size={15} className="animate-spin" /> {t('service.check.checking')}
            </div>
          ) : (
            checks.map((c) => (
              <div key={c.id} className={`flex gap-3 rounded-lg p-3 ${c.ok ? 'bg-panel-2' : 'border border-amber-400/30 bg-amber-400/10'}`}>
                {c.ok ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{c.label}</div>
                  {c.detail && <div className="mt-0.5 whitespace-pre-line text-[12px] leading-snug text-muted">{c.detail}</div>}
                  {c.fixes && c.fixes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.fixes.map((f) => (
                        <button
                          key={f.label}
                          disabled={busy}
                          onClick={() => fix(f)}
                          className="rounded-md bg-accent-fill px-2.5 py-1 text-[12px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-50"
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button
            onClick={run}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] text-muted hover:border-accent hover:text-accent-text disabled:opacity-50"
          >
            <RotateCw size={13} className={busy ? 'animate-spin' : ''} /> {t('service.check.again')}
          </button>
          <button onClick={onClose} className="rounded-md bg-accent-fill px-4 py-1.5 text-[12.5px] font-semibold text-on-accent hover:brightness-110">
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  )
}
