import { useEffect, useMemo, useState } from 'react'
import { Check, Download, Globe, Library, Loader2, RefreshCw, Search, Trash2, WifiOff, X } from 'lucide-react'
import type { BibleCatalog, BibleInfo, BibleInstallProgress, LibraryBible } from '@shared/types'
import { useModal } from '@/lib/modal'
import { formatDate, formatNumber, useT } from '@/i18n'

const COVERAGE = {
  full: 'scripture.lib.full',
  nt: 'scripture.lib.nt',
  ot: 'scripture.lib.ot',
  portions: 'scripture.lib.portions'
} as const satisfies Record<LibraryBible['coverage'], string>
const SHOWN = 250

const cleanError = (e: unknown): string =>
  String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** Browse the free translation catalogue and install translations with one click. */
export default function BibleLibrary({
  bibles,
  onUse,
  onClose
}: {
  bibles: BibleInfo[]
  onUse: (id: string) => void
  onClose: () => void
}) {
  useModal(true, onClose)
  const { t, tn } = useT()
  const [catalog, setCatalog] = useState<BibleCatalog | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState('')
  const [fullOnly, setFullOnly] = useState(false)
  const [progress, setProgress] = useState<Record<string, BibleInstallProgress>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = async (refresh = false): Promise<void> => {
    setRefreshing(true)
    setLoadError(null)
    try {
      setCatalog(await window.nl.bible.catalog(refresh))
    } catch (e) {
      setLoadError(cleanError(e))
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    return window.nl.bible.onInstallProgress((p) => setProgress((s) => (s[p.id] ? { ...s, [p.id]: p } : s)))
  }, [])

  // Installed / removed elsewhere: keep the "Installed" marks right.
  const installedIds = new Set(bibles.map((b) => b.id))
  const builtin = new Set(bibles.filter((b) => b.builtin).map((b) => b.id))

  const languages = useMemo(() => {
    const count = new Map<string, number>()
    for (const b of catalog?.bibles ?? []) count.set(b.language, (count.get(b.language) ?? 0) + 1)
    return [...count].sort((a, b) => a[0].localeCompare(b[0]))
  }, [catalog])

  const list = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return (catalog?.bibles ?? []).filter((b) => {
      if (language && b.language !== language) return false
      if (fullOnly && b.coverage !== 'full') return false
      if (!words.length) return true
      const hay = `${b.name} ${b.title} ${b.language} ${b.languageLocal} ${b.id}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [catalog, query, language, fullOnly])

  const install = async (b: LibraryBible): Promise<void> => {
    setErrors(({ [b.id]: _, ...rest }) => rest)
    setProgress((s) => ({ ...s, [b.id]: { id: b.id, step: 'download', received: 0, total: 0 } }))
    try {
      const info = await window.nl.bible.install(b.id)
      setCatalog((c) => c && { ...c, bibles: c.bibles.map((x) => (x.id === b.id ? { ...x, installedId: info.id } : x)) })
    } catch (e) {
      setErrors((s) => ({ ...s, [b.id]: cleanError(e) }))
    } finally {
      setProgress(({ [b.id]: _, ...rest }) => rest)
    }
  }

  const remove = async (b: LibraryBible): Promise<void> => {
    if (!b.installedId || !window.confirm(t('scripture.confirmRemove', { name: b.name }))) return
    await window.nl.bible.remove(b.installedId)
    setCatalog((c) => c && { ...c, bibles: c.bibles.map((x) => (x.id === b.id ? { ...x, installedId: null } : x)) })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-[min(760px,88vh)] w-[min(820px,94vw)] flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl">
        {/* header */}
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-text">
            <Library size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">{t('scripture.lib.title')}</div>
            <div className="text-[12px] text-muted">
              {catalog
                ? tn('scripture.lib.count', catalog.bibles.length, { langs: formatNumber(languages.length) })
                : t('scripture.lib.subtitle')}
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            title={t('scripture.lib.refreshHint')}
            className="rounded p-1.5 text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-40"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={onClose} className="rounded p-1.5 text-muted hover:bg-panel-2 hover:text-fg">
            <X size={16} />
          </button>
        </div>

        {/* filters */}
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <div className="flex h-9 flex-1 items-center gap-2 rounded-md bg-panel-2 px-3 ring-accent/50 focus-within:ring-1">
            <Search size={15} className="text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('scripture.lib.searchPlaceholder')}
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-dim"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-muted hover:text-fg">
                <X size={13} />
              </button>
            )}
          </div>
          <label className="flex h-9 items-center gap-1.5 rounded-md bg-panel-2 px-2.5 text-[12.5px] text-muted">
            <Globe size={14} />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="max-w-44 cursor-pointer bg-transparent text-fg outline-none [&>option]:bg-panel-2"
            >
              <option value="">{t('scripture.lib.allLanguages')}</option>
              {languages.map(([l, n]) => (
                <option key={l} value={l}>
                  {l} ({n})
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-panel-2 px-2.5 text-[12.5px] text-muted">
            <input type="checkbox" checked={fullOnly} onChange={(e) => setFullOnly(e.target.checked)} className="accent-[var(--color-accent)]" />
            {t('scripture.lib.fullOnly')}
          </label>
        </div>

        {catalog?.offline && (
          <div className="flex items-center gap-2 border-b border-line bg-amber-500/10 px-5 py-2 text-[12px] text-amber-300">
            <WifiOff size={13} /> {t('scripture.lib.offline', { date: formatDate(catalog.updated) })}
          </div>
        )}

        {/* list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {!catalog && !loadError && (
            <div className="flex h-full items-center justify-center gap-2 text-[13px] text-muted">
              <Loader2 size={16} className="animate-spin" /> {t('scripture.lib.loading')}
            </div>
          )}
          {loadError && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[13px] text-muted">
              <WifiOff size={22} />
              {loadError}
              <button onClick={() => load(true)} className="rounded-md bg-panel-3 px-3 py-1.5 text-fg hover:text-accent-text">
                {t('scripture.lib.tryAgain')}
              </button>
            </div>
          )}
          {catalog && list.length === 0 && <div className="p-8 text-center text-[13px] text-muted">{t('scripture.lib.noMatch')}</div>}
          {list.slice(0, SHOWN).map((b) => {
            const installedId = b.installedId && installedIds.has(b.installedId) ? b.installedId : null
            const p = progress[b.id]
            const err = errors[b.id]
            const pct = p?.step === 'download' && p.total ? Math.round((p.received / p.total) * 100) : null
            return (
              <div key={b.id} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${installedId ? 'bg-accent-soft/50' : 'hover:bg-panel-2'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[13.5px] font-medium">{b.name}</span>
                    {b.title && b.title !== b.name && (
                      <span className="truncate text-[12px] text-muted" dir={b.rtl ? 'rtl' : undefined}>
                        {b.title}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-dim">
                    <span className="text-muted">{b.language}</span>
                    <span>·</span>
                    <span className={b.coverage === 'full' ? 'text-emerald-400/80' : ''}>{t(COVERAGE[b.coverage])}</span>
                    <span>·</span>
                    <span className="truncate" title={b.copyright}>
                      {/^public domain$/i.test(b.copyright) ? t('scripture.lib.publicDomain') : b.copyright}
                    </span>
                  </div>
                  {err && <div className="mt-1 text-[11.5px] text-live">{err}</div>}
                </div>

                {p ? (
                  <div className="w-36 shrink-0">
                    <div className="mb-1 flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-muted">
                      <Loader2 size={12} className="shrink-0 animate-spin" />
                      <span className="truncate">
                        {p.step === 'download'
                          ? pct !== null
                            ? t('scripture.lib.downloadingPct', { pct })
                            : t('scripture.lib.downloading')
                          : p.step === 'names'
                            ? t('scripture.lib.bookNames')
                            : t('scripture.lib.installing')}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-panel-3">
                      <div
                        className="h-full bg-accent transition-[width]"
                        style={{ width: `${p.step === 'download' ? (pct ?? 5) * 0.8 : p.step === 'names' ? 88 : 96}%` }}
                      />
                    </div>
                  </div>
                ) : installedId ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="flex items-center gap-1 whitespace-nowrap px-1.5 text-[12px] text-accent-text">
                      <Check size={14} /> {builtin.has(installedId) ? t('scripture.lib.builtIn') : t('scripture.lib.installed')}
                    </span>
                    <button
                      onClick={() => {
                        onUse(installedId)
                        onClose()
                      }}
                      className="whitespace-nowrap rounded-md border border-line px-2.5 py-1 text-[12px] hover:border-accent hover:text-accent-text"
                    >
                      {t('scripture.lib.use')}
                    </button>
                    {!builtin.has(installedId) && (
                      <button onClick={() => remove(b)} title={t('common.remove')} className="rounded p-1.5 text-dim hover:text-live">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => install(b)}
                    disabled={!!catalog?.offline && !navigator.onLine}
                    className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-fill px-3 py-1.5 text-[12px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
                  >
                    <Download size={13} /> {t('scripture.lib.install')}
                  </button>
                )}
              </div>
            )
          })}
          {list.length > SHOWN && (
            <div className="p-4 text-center text-[12px] text-dim">
              {t('scripture.lib.showing', { shown: formatNumber(SHOWN), total: formatNumber(list.length) })}
            </div>
          )}
        </div>

        <div className="border-t border-line px-5 py-2.5 text-[11.5px] leading-relaxed text-dim">
          {t('scripture.lib.footer')}
        </div>
      </div>
    </div>
  )
}
