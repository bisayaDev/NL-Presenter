import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Command, EyeOff, Keyboard, Monitor, MousePointerClick, Music, Search, Square, X, Drama, type LucideIcon } from 'lucide-react'
import type { BibleInfo, ScripturePassage, VerseHit } from '@shared/types'
import { parseReference } from '@shared/bible'
import { passageId, passageSlides } from '@/lib/passages'
import { useModal } from '@/lib/modal'
import { useApp } from '@/store/useApp'
import { useT } from '@/i18n'

type Group = 'bible' | 'service' | 'songs' | 'commands'
const GROUP_KEY = { bible: 'service.cp.bible', service: 'service.cp.service', songs: 'service.cp.songs', commands: 'service.cp.commands' } as const

interface Entry {
  key: string
  group: Group
  icon: LucideIcon
  label: string
  sub?: string
  score: number
  run: () => void | Promise<void>
  /** Alt+Enter */
  add?: () => void | Promise<void>
}

/** Higher is better; -1 = no match. Whole text, then every word, then letters in order. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const t = text.toLowerCase()
  const at = t.indexOf(q)
  if (at === 0) return 100
  if (at > 0) return (/[\s(\-–'"]/.test(t[at - 1]) ? 85 : 65) - at * 0.1
  const words = q.split(/\s+/)
  if (words.length > 1 && words.every((w) => t.includes(w))) return 50
  let i = 0
  let gaps = 0
  let last = -1
  for (const ch of q.replace(/\s+/g, '')) {
    const j = t.indexOf(ch, i)
    if (j < 0) return -1
    if (last >= 0 && j > last + 1) gaps++
    last = j
    i = j + 1
  }
  return Math.max(1, 30 - gaps * 3)
}

const LIMIT = 8
export const isMac = navigator.platform.startsWith('Mac')

/** Cmd/Ctrl+K: find a service item, a song or a Bible verse, or run a command. */
export default function CommandPalette({ onClose, onHelp }: { onClose: () => void; onHelp: () => void }) {
  useModal()
  const { t, tn, lang } = useT()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [bibles, setBibles] = useState<BibleInfo[]>([])
  const [verses, setVerses] = useState<{ q: string; hits: VerseHit[] } | null>(null)
  const service = useApp((s) => s.service)
  const songs = useApp((s) => s.songs)
  const bibleId = useApp((s) => s.bibleId)
  const rehearsing = useApp((s) => !!s.rehearsal)
  const clickMode = useApp((s) => s.clickMode)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.nl.bible.list().then(setBibles)
  }, [])
  const bible = bibles.find((b) => b.id === bibleId) ?? bibles[0]

  // Bible references ("jn 3:16") are looked up as you type.
  useEffect(() => {
    const query = q.trim()
    // The main process also knows the Bible's own book names ("Juan 3:16"), so any text with a number is worth asking.
    if (!bible || !/\d/.test(query)) return setVerses(null)
    let gone = false
    const timer = setTimeout(async () => {
      const r = await window.nl.bible.search(bible.id, query)
      if (!gone) setVerses(r.ref && r.hits.length ? { q: query, hits: r.hits } : null)
    }, 120)
    return () => {
      gone = true
      clearTimeout(timer)
    }
  }, [q, bible])

  const entries = useMemo(() => {
    const s = useApp.getState
    const out: Entry[] = []
    const query = q.trim()

    if (verses && bible && verses.q === query) {
      const h = verses.hits
      const first = h[0]
      const bookName = first.label.replace(/\s+\d+:\d+$/, '')
      const p: ScripturePassage = {
        id: '',
        bibleId: bible.id,
        abbrev: bible.abbrev,
        book: first.book,
        bookName,
        chapter: first.chapter,
        verses: h.map((v) => v.verse),
        at: 0
      }
      p.id = passageId(p)
      const build = async (): Promise<Awaited<ReturnType<typeof passageSlides>>> => passageSlides({ ...p, at: Date.now() }, s().scripture)
      const range = h.length > 1 ? `${first.label}–${h[h.length - 1].verse}` : first.label
      out.push({
        key: `bible:${p.id}`,
        group: 'bible',
        icon: BookOpen,
        label: `${range} (${bible.abbrev})`,
        sub: h.map((v) => v.text).join(' ').slice(0, 140),
        score: 200,
        run: async () => {
          const r = await build()
          if (!r) return
          s().showScratch(r.title, r.slides)
          s().recordScripture?.({ ...p, at: Date.now() })
        },
        add: async () => {
          const r = await build()
          if (r) s().addScripture(r.title, r.slides)
        }
      })
    }

    const scored = <T,>(list: T[], text: (x: T) => string): { x: T; score: number }[] =>
      list
        .map((x) => ({ x, score: query ? fuzzyScore(query, text(x)) : 0 }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => b.score - a.score)

    for (const { x: it, score } of scored(
      service.items.filter((it) => it.kind !== 'section' && it.slides.length),
      (it) => it.title
    ).slice(0, query ? LIMIT : 20))
      out.push({
        key: `item:${it.id}`,
        group: 'service',
        icon: it.kind === 'scripture' ? BookOpen : it.kind === 'song' ? Music : Square,
        label: it.title,
        sub: tn('service.sheet.slideCount', it.slides.length),
        score,
        run: () => s().goLive(it.id, 0)
      })

    if (query)
      for (const { x: song, score } of scored(songs, (x) => `${x.title} ${x.author ?? ''}`).slice(0, LIMIT)) {
        const inService = (): string | undefined => s().service.items.find((it) => it.kind === 'song' && it.sourceId === song.id)?.id
        out.push({
          key: `song:${song.id}`,
          group: 'songs',
          icon: Music,
          label: song.title,
          sub: [song.author, inService() ? t('service.cp.inService') : t('service.cp.library')].filter(Boolean).join(' · '),
          score,
          run: () => {
            let id = inService()
            if (!id) {
              s().addSongToService(song.id)
              id = inService()
            }
            if (id) s().goLive(id, 0)
          },
          add: () => s().addSongToService(song.id)
        })
      }

    // Built here (not at module level) so the labels follow the language; `id` keeps React keys stable.
    const commands: (Omit<Entry, 'group' | 'score' | 'key'> & { id: string })[] = [
      { id: 'black', icon: Square, label: t('service.keys.black'), sub: '`', run: () => s().toggleBlack() },
      { id: 'clear', icon: X, label: t('service.cp.clearScreen'), sub: 'Esc', run: () => s().clearLive() },
      { id: 'hide', icon: EyeOff, label: t('service.keys.hideText'), sub: 'H', run: () => s().toggleHideText() },
      { id: 'output', icon: Monitor, label: t('service.cp.openOutput'), sub: t('service.cp.audience'), run: () => void window.nl.screens.open('audience', null) },
      {
        id: 'rehearse',
        icon: Drama,
        label: rehearsing ? t('service.cp.stopRehearsing') : t('topbar.rehearse'),
        sub: t('service.cp.rehearseSub'),
        run: () => (s().rehearsal ? s().endRehearsal() : s().startRehearsal())
      },
      {
        id: 'click',
        icon: MousePointerClick,
        label: clickMode === 'preview' ? t('service.cp.clickLive') : t('service.cp.clickPreview'),
        sub: t('service.cp.clickSub'),
        run: () => s().setClickMode(s().clickMode === 'preview' ? 'live' : 'preview')
      },
      { id: 'keys', icon: Keyboard, label: t('service.keys.title'), sub: '?', run: onHelp }
    ]
    for (const c of scored(commands, (c) => c.label)) out.push({ ...c.x, key: `cmd:${c.x.id}`, group: 'commands', score: c.score })

    if (query) out.sort((a, b) => b.score - a.score) // best match first, whatever its kind
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lang` re-builds the translated labels
  }, [q, verses, bible, service, songs, rehearsing, clickMode, onHelp, lang])

  useEffect(() => setSel(0), [q])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const choose = (e: Entry | undefined, add: boolean): void => {
    if (!e) return
    const f = add ? e.add : e.run
    if (!f) return
    onClose()
    void f()
  }

  const onKey = (e: React.KeyboardEvent): void => {
    // Keep these keys away from the operator shortcuts (Esc would clear the screen).
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((i) => Math.min(entries.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(entries[sel], e.altKey)
    }
  }

  const current = entries[sel]
  return (
    <div className="fixed inset-0 z-[60] bg-black/50" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="mx-auto mt-[12vh] flex max-h-[70vh] w-[600px] flex-col overflow-hidden rounded-xl border border-line bg-panel-2 shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={t('service.cp.placeholder')}
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-dim"
          />
          <kbd className="rounded bg-panel-3 px-1.5 py-0.5 text-[10.5px] text-muted">Esc</kbd>
        </div>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1">
          {entries.length === 0 && (
            <div className="px-4 py-6 text-center text-[12.5px] text-muted">
              {t('service.cp.nothingFound')}
              {!bible && parseReference(q.trim()) ? ` ${t('service.cp.installBible')}` : ''}
            </div>
          )}
          {entries.map((e, i) => {
            const Icon = e.icon
            const showGroup = !q.trim() && (i === 0 || entries[i - 1].group !== e.group)
            return (
              <div key={e.key}>
                {showGroup && <div className="label-caps px-4 pb-1 pt-2">{t(GROUP_KEY[e.group])}</div>}
                <button
                  data-i={i}
                  onMouseMove={() => sel !== i && setSel(i)}
                  onClick={(ev) => choose(e, ev.altKey)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === sel ? 'bg-accent-soft' : ''}`}
                >
                  <Icon size={15} className={`shrink-0 ${i === sel ? 'text-accent-text' : 'text-muted'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{e.label}</div>
                    {e.sub && <div className="truncate text-[11.5px] text-dim">{e.sub}</div>}
                  </div>
                  {q.trim() && <span className="shrink-0 text-[10.5px] uppercase tracking-wider text-dim">{t(GROUP_KEY[e.group])}</span>}
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-dim">
          <span className="whitespace-nowrap">↑↓ {t('service.cp.choose')}</span>
          <span className="whitespace-nowrap">⏎ {current?.group === 'commands' ? t('service.cp.run') : t('service.cp.goLive')}</span>
          {current?.add && (
            <span className="whitespace-nowrap">
              {isMac ? '⌥⏎' : 'Alt+⏎'} {t('service.cp.addToService')}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1">
            {isMac ? <Command size={11} /> : 'Ctrl+'}K
          </span>
        </div>
      </div>
    </div>
  )
}
