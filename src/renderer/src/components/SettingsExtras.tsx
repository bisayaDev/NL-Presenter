import { useEffect, useState } from 'react'
import { FolderOpen, GripVertical, Loader2, Plus, X } from 'lucide-react'
import type { AutoBackupStatus, BootPrefs, MediaFit } from '@shared/types'
import { formatBytes } from '@/lib/media'
import { formatAgo, t, useT } from '@/i18n'
import { defaultQuickChat, QUICK_CHAT_LEN, QUICK_CHAT_MAX, useApp } from '@/store/useApp'

/** "just now", "5 min ago", "2 hr. ago", "3 days ago" in the UI language. */
export const agoMs = formatAgo

const KEEP = [5, 10, 20, 50]

/** Settings → Backup & restore: automatic backups (daily while open, and on quit). */
export function AutoBackupSettings() {
  const [st, setSt] = useState<AutoBackupStatus | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  useT()
  useEffect(() => {
    window.nl.backup.auto.status().then(setSt)
    return window.nl.backup.auto.onChange(setSt)
  }, [])
  if (!st) return null
  const set = (patch: Parameters<typeof window.nl.backup.auto.set>[0]): void => {
    window.nl.backup.auto.set(patch).then(setSt)
  }
  const now = async (): Promise<void> => {
    setMsg(null)
    const r = await window.nl.backup.auto.run()
    setMsg(r.done ? t('settings.auto.saved') : r.reason === 'busy' ? t('settings.auto.busy') : (r.message ?? t('settings.auto.skipped')))
    setSt(await window.nl.backup.auto.status())
  }
  const custom = st.dir !== st.defaultDir

  return (
    <div className="mt-4 rounded-lg bg-panel-2 p-3.5 text-[12.5px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div>{t('settings.auto.title')}</div>
          <div className="text-[11.5px] text-dim">{t('settings.auto.hint')}</div>
        </div>
        <div className="flex shrink-0 gap-1 rounded-md bg-panel p-1">
          {[true, false].map((on) => (
            <button
              key={String(on)}
              onClick={() => set({ enabled: on })}
              className={`rounded px-3 py-1 ${st.enabled === on ? 'bg-accent-fill font-semibold text-on-accent' : 'text-muted hover:bg-panel-3 hover:text-fg'}`}
            >
              {on ? t('common.on') : t('common.off')}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="shrink-0 text-muted">{t('settings.auto.folder')}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-dim select-text" title={st.dir}>
          {st.dir}
        </span>
        <button
          onClick={() => window.nl.backup.auto.pickDir().then((s) => s && setSt(s))}
          className="shrink-0 whitespace-nowrap rounded-md border border-line px-2 py-1 text-[12px] text-muted hover:border-accent hover:text-accent-text"
        >
          {t('common.change')}
        </button>
        {custom && (
          <button onClick={() => set({ dir: null })} className="shrink-0 text-[12px] text-dim hover:text-fg" title={st.defaultDir}>
            {t('common.default')}
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-muted">{t('settings.auto.keep')}</span>
        <select
          value={st.keep}
          onChange={(e) => set({ keep: Number(e.target.value) })}
          className="h-7 rounded-md bg-panel px-1.5 text-[12px] outline-none"
        >
          {[...new Set([...KEEP, st.keep])].sort((a, b) => a - b).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <span className="min-w-0 flex-1 text-muted">
          {st.running ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" /> {t('settings.auto.running')}
            </span>
          ) : st.lastAt ? (
            <>
              {t('settings.auto.last', { ago: agoMs(st.lastAt) })}
              {st.lastBytes ? <span className="text-dim"> · {formatBytes(st.lastBytes)}</span> : null}
              {st.current && <span className="text-dim"> · {t('settings.auto.upToDate')}</span>}
            </>
          ) : (
            t('settings.auto.none')
          )}
        </span>
        <button
          onClick={now}
          disabled={st.running}
          className="shrink-0 whitespace-nowrap rounded-md border border-line px-2 py-1 text-[12px] text-muted hover:border-accent hover:text-accent-text disabled:opacity-40"
        >
          {t('settings.auto.now')}
        </button>
        <button
          onClick={() => window.nl.backup.auto.openDir()}
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-line px-2 py-1 text-[12px] text-muted hover:border-accent hover:text-accent-text"
        >
          <FolderOpen size={13} /> {t('settings.auto.openFolder')}
        </button>
      </div>
      {st.error && <p className="mt-2 text-[11.5px] text-amber-300">{st.error}</p>}
      {msg && <p className="mt-2 text-[11.5px] text-dim">{msg}</p>}
    </div>
  )
}

/**
 * Settings → Phone remote: the one-tap messages on the remote's Chat tab ("Intro", "Chorus", …).
 * Saved as setting `quickChat`; until edited, the built-in list follows the UI language.
 */
export function QuickChatSection() {
  const saved = useApp((s) => s.quickChat)
  const setQuickChat = useApp((s) => s.setQuickChat)
  useT()
  const list = saved ?? defaultQuickChat()
  const [draft, setDraft] = useState('')
  const [dragFrom, setDragFrom] = useState<number | null>(null)

  const clean = draft.trim()
  const dup = list.some((q) => q.toLowerCase() === clean.toLowerCase())
  const full = list.length >= QUICK_CHAT_MAX
  const add = (): void => {
    if (!clean || dup || full) return
    setQuickChat([...list, clean])
    setDraft('')
  }
  const remove = (i: number): void => setQuickChat(list.filter((_, j) => j !== i))
  const move = (from: number, to: number): void => {
    if (from === to) return
    const next = [...list]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    setQuickChat(next)
  }

  return (
    <section>
      <div className="label-caps mb-2">{t('settings.quickChat.title')}</div>
      <div className="rounded-lg bg-panel-2 p-3.5">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[12.5px]">{t('settings.quickChat.label')}</span>
          {saved && (
            <button onClick={() => setQuickChat(null)} className="text-[11.5px] text-muted hover:text-fg">
              {t('settings.quickChat.reset')}
            </button>
          )}
        </div>
        {list.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {list.map((q, i) => (
              <li
                key={`${i}-${q}`}
                draggable
                onDragStart={(e) => {
                  setDragFrom(i)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => dragFrom !== null && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragFrom !== null) move(dragFrom, i)
                  setDragFrom(null)
                }}
                onDragEnd={() => setDragFrom(null)}
                className={`flex h-8 cursor-grab items-center gap-1 rounded-md border border-line bg-panel pl-1 pr-1 text-[12.5px] ${
                  dragFrom === i ? 'opacity-40' : ''
                }`}
              >
                <GripVertical size={12} className="text-dim" aria-hidden />
                <span className="px-0.5">{q}</span>
                <button
                  onClick={() => remove(i)}
                  aria-label={t('settings.quickChat.remove', { name: q })}
                  title={t('settings.quickChat.remove', { name: q })}
                  className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-panel-3 hover:text-fg"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-muted">{t('settings.quickChat.empty')}</p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          className="mt-2.5 flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, QUICK_CHAT_LEN))}
            disabled={full}
            placeholder={full ? t('settings.quickChat.full', { n: QUICK_CHAT_MAX }) : t('settings.quickChat.placeholder')}
            aria-label={t('settings.quickChat.placeholder')}
            className="h-8 min-w-0 flex-1 rounded-md bg-panel px-2.5 text-[13px] outline-none placeholder:text-dim focus:ring-1 focus:ring-accent/50 disabled:opacity-50"
          />
          <button
            disabled={!clean || dup || full}
            className="flex h-8 items-center gap-1 rounded-md border border-line px-3 text-[12.5px] hover:border-accent hover:text-accent-text disabled:opacity-40 disabled:hover:border-line disabled:hover:text-fg"
          >
            <Plus size={13} /> {t('settings.quickChat.add')}
          </button>
        </form>
        <p className="mt-1.5 text-[11.5px] text-dim">{dup && clean ? t('settings.quickChat.dup') : t('settings.quickChat.hint')}</p>
      </div>
    </section>
  )
}

/** Settings → Display: how videos are decoded (needs a restart). */
export function DisplaySection() {
  const [p, setP] = useState<BootPrefs | null>(null)
  useT()
  useEffect(() => {
    window.nl.bootPrefs.get().then(setP)
  }, [])
  if (!p) return null
  const restart = p.active && p.active.cpuVideo !== p.cpuVideo
  const OPTIONS: { cpu: boolean; label: string }[] = [
    { cpu: false, label: t('settings.display.gpu') },
    { cpu: true, label: t('settings.display.cpu') }
  ]
  return (
    <section>
      <div className="label-caps mb-2">{t('settings.display.title')}</div>
      <div className="rounded-lg bg-panel-2 p-3.5">
        <div className="mb-1.5 text-[12.5px]">{t('settings.display.decoding')}</div>
        <div className="flex gap-1 rounded-md bg-panel p-1">
          {OPTIONS.map((o) => (
            <button
              key={String(o.cpu)}
              onClick={() => window.nl.bootPrefs.set({ cpuVideo: o.cpu }).then(setP)}
              className={`flex-1 rounded py-1.5 text-[12.5px] ${
                p.cpuVideo === o.cpu ? 'bg-accent-fill font-semibold text-on-accent' : 'text-muted hover:bg-panel-3 hover:text-fg'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className={`mt-1.5 text-[11.5px] ${restart ? 'text-amber-300' : 'text-dim'}`}>
          {restart ? t('settings.display.restart') : t('settings.display.hint')}
        </p>
      </div>
    </section>
  )
}

const FIT_OPTIONS: MediaFit[] = ['cover', 'contain', 'fill', 'none']

/** Settings → New pictures & videos: the fit newly imported files start with (each file can still be changed in Media). */
export function MediaFitDefaultSection() {
  const value = useApp((s) => s.mediaFitDefault)
  const setValue = useApp((s) => s.setMediaFitDefault)
  useT()
  return (
    <section>
      <div className="label-caps mb-2">{t('settings.mediaFit.title')}</div>
      <div className="rounded-lg bg-panel-2 p-3.5">
        <div className="mb-1.5 text-[12.5px]" id="media-fit-default-label">
          {t('settings.mediaFit.label')}
        </div>
        <div className="flex gap-1 rounded-md bg-panel p-1" role="radiogroup" aria-labelledby="media-fit-default-label">
          {FIT_OPTIONS.map((f) => (
            <button
              key={f}
              role="radio"
              aria-checked={value === f}
              onClick={() => setValue(f)}
              className={`flex-1 rounded py-1.5 text-[12.5px] ${
                value === f ? 'bg-accent-fill font-semibold text-on-accent' : 'text-muted hover:bg-panel-3 hover:text-fg'
              }`}
            >
              {t(`media.fit.${f}`)}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11.5px] text-dim">
          {t(`media.fit.${value}Hint`)} {t('settings.mediaFit.hint')}
        </p>
      </div>
    </section>
  )
}
