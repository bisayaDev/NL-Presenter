import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Columns2, Library, Loader2, Pencil, Plus, Rows2, Search, Star, Trash2, Type, Upload, X } from 'lucide-react'
import BibleLibrary from '@/components/BibleLibrary'
import PassageList from '@/components/PassageList'
import StylePanel from '@/components/StylePanel'
import { compareIds, passageId } from '@/lib/passages'
import type { BibleBook, BibleInfo, ParallelLayout, ScripturePassage, Slide, Verse, VerseHit } from '@shared/types'
import { formatRef, isNT, parseReference, scriptureSlides } from '@shared/bible'
import { uid } from '@/lib/defaults'
import { modalBlocks, useModal } from '@/lib/modal'
import { useApp } from '@/store/useApp'
import { useT } from '@/i18n'

type Testament = 'all' | 'ot' | 'nt'

export default function ScriptureTab() {
  const { t, tn } = useT()
  const bibleId = useApp((s) => s.bibleId)
  const setBibleId = useApp((s) => s.setBibleId)
  const opts = useApp((s) => s.scripture)
  const setOpts = useApp((s) => s.setScripture)
  const pins = useApp((s) => s.scripturePins)
  const [bibles, setBibles] = useState<BibleInfo[]>([])
  const [books, setBooks] = useState<BibleBook[]>([])
  const [book, setBook] = useState(43) // John
  const [chapter, setChapter] = useState(1)
  const [verses, setVerses] = useState<Verse[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [anchor, setAnchor] = useState<number | null>(null)
  const [testament, setTestament] = useState<Testament>('all')
  const [bookFilter, setBookFilter] = useState('')
  const [styleOpen, setStyleOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<VerseHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  // Compare translations: this chapter in each (book name in that translation, verses).
  const [pData, setPData] = useState<{ id: string; bookName?: string; verses: Verse[] }[]>([])
  const verseList = useRef<HTMLDivElement>(null)

  const bible = bibles.find((b) => b.id === bibleId) ?? bibles[0]
  const bookInfo = books.find((b) => b.book === book)
  // Up to two more translations shown with the main one (never the main one itself).
  const parallels = compareIds(opts)
    .filter((id) => id !== bible?.id)
    .map((id) => bibles.find((b) => b.id === id))
    .filter((b): b is BibleInfo => !!b)
  const parallelKey = parallels.map((p) => p.id).join(',')

  // Load the Bible list and follow changes (first-run install, imports, deletes).
  useEffect(() => {
    window.nl.bible.list().then(setBibles)
    return window.nl.bible.onChange(setBibles)
  }, [])

  useEffect(() => {
    if (bible && bible.id !== bibleId) setBibleId(bible.id)
  }, [bible, bibleId, setBibleId])

  useEffect(() => {
    if (!bible) return
    window.nl.bible.books(bible.id).then(setBooks)
  }, [bible?.id])

  useEffect(() => {
    if (!bible) return
    window.nl.bible.chapter(bible.id, book, chapter).then((v) => {
      setVerses(v)
      verseList.current?.scrollTo({ top: 0 })
    })
  }, [bible?.id, book, chapter])

  useEffect(() => {
    let dead = false
    const ids = parallelKey ? parallelKey.split(',') : []
    Promise.all(
      ids.map(async (id) => {
        const [pb, pv] = await Promise.all([window.nl.bible.books(id), window.nl.bible.chapter(id, book, chapter)])
        return { id, bookName: pb.find((b) => b.book === book)?.name, verses: pv }
      })
    ).then((d) => !dead && setPData(d))
    return () => {
      dead = true
    }
  }, [parallelKey, book, chapter])

  const pTexts = useMemo(
    () =>
      parallels.map((p) => ({
        abbrev: p.abbrev,
        text: new Map((pData.find((d) => d.id === p.id)?.verses ?? []).map((v) => [v.verse, v.text]))
      })),
    [pData, parallelKey] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const visibleBooks = useMemo(() => {
    const f = bookFilter.trim().toLowerCase()
    return books.filter(
      (b) =>
        (testament === 'all' || (testament === 'nt') === isNT(b.book)) && (!f || b.name.toLowerCase().includes(f))
    )
  }, [books, testament, bookFilter])

  const goTo = (b: number, c: number, sel: number[] = []): void => {
    setBook(b)
    setChapter(c)
    setSelected(sel)
    setAnchor(sel[0] ?? null)
    if (sel.length) {
      setTimeout(() => document.getElementById(`v-${sel[0]}`)?.scrollIntoView({ block: 'center' }), 60)
    }
  }

  const runSearch = async (): Promise<void> => {
    if (!bible || !query.trim()) return setHits(null)
    const local = new Map(books.map((b) => [b.book, b.name]))
    const ref = parseReference(query, local)
    if (ref) {
      setHits(null)
      const range =
        ref.verseStart !== undefined
          ? Array.from({ length: (ref.verseEnd ?? ref.verseStart) - ref.verseStart + 1 }, (_, i) => ref.verseStart! + i)
          : []
      goTo(ref.book, ref.chapter, range)
      return
    }
    setSearching(true)
    const r = await window.nl.bible.search(bible.id, query)
    setSearching(false)
    setHits(r.hits)
  }

  const clickVerse = (v: number, e: React.MouseEvent): void => {
    if (e.shiftKey && anchor !== null) {
      const [a, b] = [Math.min(anchor, v), Math.max(anchor, v)]
      setSelected(Array.from({ length: b - a + 1 }, (_, i) => a + i))
    } else if (e.metaKey || e.ctrlKey) {
      setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v].sort((x, y) => x - y)))
      setAnchor(v)
    } else {
      setSelected([v])
      setAnchor(v)
    }
  }

  const toSlides = (nums: number[]): Slide[] =>
    scriptureSlides(
      chapter,
      nums,
      { bookName: bookInfo?.name ?? '', abbrev: bible?.abbrev ?? '', verses },
      opts,
      parallels.flatMap((p) => {
        const d = pData.find((x) => x.id === p.id)
        return d?.bookName && d.verses.length ? [{ bookName: d.bookName, abbrev: p.abbrev, verses: d.verses }] : []
      })
    ).map((sl) => ({ id: uid(), ...sl }))

  const abbrevs = [bible?.abbrev, ...parallels.map((p) => p.abbrev)].join(' + ')
  const selectionTitle = bookInfo ? formatRef(bookInfo.name, chapter, selected) : ''
  const slideCount = opts.perSlide > 0 ? Math.ceil(selected.length / opts.perSlide) : selected.length ? 1 : 0

  /** `verse`: start on the slide that holds this verse. */
  const showLive = (nums = selected, verse?: number): void => {
    const slides = toSlides(nums)
    if (!slides.length) return
    const sorted = [...nums].sort((a, b) => a - b)
    const at = verse === undefined ? 0 : Math.max(0, sorted.indexOf(verse))
    const start = opts.perSlide > 0 ? Math.floor(at / opts.perSlide) : 0
    useApp.getState().showScratch(`${formatRef(bookInfo!.name, chapter, nums)} (${abbrevs})`, slides, Math.min(start, slides.length - 1))
    const p = passageOf(nums)
    if (p) useApp.getState().recordScripture(p)
  }

  const addToService = (): void => {
    const slides = toSlides(selected)
    if (!slides.length) return
    useApp.getState().addScripture(`${selectionTitle} (${abbrevs})`, slides)
    const p = passageOf(selected)
    if (p) useApp.getState().recordScripture(p)
  }

  /** The selection as a Recent / pinned passage (in the main translation). */
  const passageOf = (nums: number[]): ScripturePassage | null => {
    if (!bible || !bookInfo || !nums.length) return null
    const p = { bibleId: bible.id, abbrev: bible.abbrev, book, bookName: bookInfo.name, chapter, verses: [...nums].sort((a, b) => a - b), at: Date.now() }
    return { ...p, id: passageId(p) }
  }
  const selPassage = passageOf(selected)
  const selPinned = !!selPassage && pins.some((p) => p.id === selPassage.id)

  // Enter shows the selection live (when not typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement
      if (modalBlocks(e)) return
      if (e.key === 'Enter' && !['INPUT', 'TEXTAREA'].includes(el.tagName) && selected.length) {
        e.preventDefault()
        showLive()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!bible) {
    return (
      <div className="grid flex-1 place-items-center text-muted">
        <div className="flex items-center gap-2 text-[13px]">
          <Loader2 size={16} className="animate-spin" /> {t('scripture.installing')}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b border-line p-3">
        <BiblePicker bibles={bibles} current={bible} onPick={setBibleId} />
        <ComparePicker
          bibles={bibles.filter((b) => b.id !== bible.id)}
          current={parallels}
          layout={opts.parallelLayout ?? 'side'}
          onPick={(ids) => setOpts({ parallelIds: ids, parallelId: undefined })}
          onLayout={(parallelLayout) => setOpts({ parallelLayout })}
        />
        <div className="flex flex-1 items-center gap-2 rounded-md bg-panel-2 px-3 ring-accent/50 focus-within:ring-1">
          <Search size={15} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch()
              if (e.key === 'Escape') {
                setQuery('')
                setHits(null)
              }
            }}
            data-tab-search="scripture"
            placeholder={t('scripture.searchPlaceholder')}
            className="h-9 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-dim"
          />
          {searching && <Loader2 size={14} className="animate-spin text-muted" />}
          {(query || hits) && (
            <button
              onClick={() => {
                setQuery('')
                setHits(null)
              }}
              className="text-muted hover:text-fg"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setStyleOpen((o) => !o)}
          title={t('scripture.textStyleHint')}
          aria-pressed={styleOpen}
          className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] ${
            styleOpen ? 'bg-accent-fill text-on-accent' : 'bg-panel-2 text-muted hover:text-fg'
          }`}
        >
          <Type size={15} /> {t('presentation.textStyle')}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* books */}
        <div className="flex w-56 shrink-0 flex-col border-r border-line">
          <div className="p-2">
            <input
              value={bookFilter}
              onChange={(e) => setBookFilter(e.target.value)}
              placeholder={t('scripture.filterBooks')}
              className="h-8 w-full rounded-md bg-panel-2 px-2.5 text-[12.5px] outline-none placeholder:text-dim focus:ring-1 focus:ring-accent/50"
            />
            <div className="mt-2 flex gap-1 text-[11.5px]">
              {(['all', 'ot', 'nt'] as const).map((tm) => (
                <button
                  key={tm}
                  onClick={() => setTestament(tm)}
                  className={`min-w-0 flex-1 truncate rounded py-1 ${testament === tm ? 'bg-accent-fill text-on-accent' : 'bg-panel-2 text-muted hover:text-fg'}`}
                >
                  {tm === 'all' ? t('scripture.all') : tm === 'ot' ? t('scripture.old') : t('scripture.new')}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            {visibleBooks.map((b) => (
              <button
                key={b.book}
                onClick={() => goTo(b.book, 1)}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] ${
                  b.book === book ? 'bg-accent-fill text-on-accent' : 'text-fg/85 hover:bg-panel-2'
                }`}
              >
                <span className="truncate">{b.name}</span>
                <span className={`text-[10.5px] ${b.book === book ? 'text-on-accent' : 'text-dim'}`}>{b.chapters}</span>
              </button>
            ))}
          </div>
          <PassageList />
        </div>

        {/* chapters */}
        <div className="w-[196px] shrink-0 overflow-y-auto border-r border-line p-2">
          <div className="label-caps px-1 pb-2">{bookInfo?.name}</div>
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: bookInfo?.chapters ?? 0 }, (_, i) => i + 1).map((c) => (
              <button
                key={c}
                onClick={() => goTo(book, c)}
                className={`h-9 rounded-md text-[13px] tabular-nums ${
                  c === chapter ? 'bg-accent-fill font-semibold text-on-accent' : 'bg-panel-2 text-fg/80 hover:bg-panel-3'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* verses / results */}
        <div className="flex min-w-0 flex-1 flex-col">
          {hits ? (
            <SearchResults
              hits={hits}
              query={query}
              onPick={(h) => {
                setHits(null)
                goTo(h.book, h.chapter, [h.verse])
              }}
            />
          ) : (
            <>
              <div className="@container flex h-10 shrink-0 items-center gap-2 overflow-hidden border-b border-line px-3">
                <button
                  onClick={() => chapter > 1 && goTo(book, chapter - 1)}
                  className="rounded p-1 text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-30"
                  disabled={chapter <= 1}
                >
                  <ChevronLeft size={17} />
                </button>
                <span className="whitespace-nowrap text-[14px] font-semibold text-accent-text">
                  {bookInfo?.name} {chapter}
                </span>
                <button
                  onClick={() => bookInfo && chapter < bookInfo.chapters && goTo(book, chapter + 1)}
                  className="rounded p-1 text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-30"
                  disabled={!bookInfo || chapter >= bookInfo.chapters}
                >
                  <ChevronRight size={17} />
                </button>
                <span className="text-[11.5px] font-semibold text-dim" title={bible.name}>
                  {abbrevs}
                </span>
                <SlideOptions />
                <span
                  className="ml-auto hidden shrink-0 text-[11.5px] text-dim 2xl:inline"
                  title={t('scripture.selectHint', { mod: window.nl.platform === 'darwin' ? '⌘' : 'Ctrl' })}
                >
                  {t('scripture.selectShort')}
                </span>
              </div>
              <div ref={verseList} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                {verses.map((v) => {
                  const sel = selected.includes(v.verse)
                  return (
                    <div
                      id={`v-${v.verse}`}
                      key={v.verse}
                      onClick={(e) => clickVerse(v.verse, e)}
                      onDoubleClick={() => {
                        const nums = selected.includes(v.verse) && selected.length > 1 ? selected : [v.verse]
                        if (nums.length === 1) setSelected(nums)
                        showLive(nums, v.verse)
                      }}
                      className={`flex cursor-pointer gap-3 rounded-md px-2 py-2 text-[14px] leading-relaxed ${
                        sel ? 'bg-accent-soft ring-1 ring-accent/40' : 'hover:bg-panel-2'
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-6 w-7 shrink-0 place-items-center rounded text-[11px] font-semibold tabular-nums ${
                          sel ? 'bg-accent-fill text-on-accent' : 'bg-panel-2 text-muted'
                        }`}
                      >
                        {v.verse}
                      </span>
                      <span className="min-w-0 select-text">
                        {v.text}
                        {pTexts.map(
                          (p) =>
                            p.text.has(v.verse) && (
                              <span key={p.abbrev} className="mt-1 block border-l-2 border-accent/30 pl-2 text-[13px] text-muted">
                                <span className="mr-1.5 text-[10.5px] font-bold text-accent-text/70">{p.abbrev}</span>
                                {p.text.get(v.verse)}
                              </span>
                            )
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {selected.length > 0 && !hits && (
            <div className="flex h-14 shrink-0 items-center gap-3 border-t border-line bg-panel px-4">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{selectionTitle}</div>
                <div className="truncate text-[11.5px] text-muted">
                  {tn('scripture.verseCount', selected.length)} · {tn('scripture.slideCount', slideCount)} · {abbrevs}
                </div>
              </div>
              <button
                onClick={() => setSelected([])}
                className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] text-muted hover:text-fg"
              >
                {t('scripture.clear')}
              </button>
              <button
                onClick={() => selPassage && useApp.getState().togglePin(selPassage)}
                title={selPinned ? t('scripture.unpin') : t('scripture.pinHint')}
                className={`rounded-md p-1.5 ${selPinned ? 'text-amber-400' : 'text-muted hover:text-amber-400'}`}
              >
                <Star size={16} className={selPinned ? 'fill-current' : ''} />
              </button>
              <button
                onClick={addToService}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-[12.5px] hover:border-accent hover:text-accent-text"
              >
                <Plus size={14} /> {t('scripture.addToService')}
              </button>
              <button
                onClick={() => showLive()}
                className="whitespace-nowrap rounded-md bg-accent-fill px-3.5 py-1.5 text-[12.5px] font-semibold text-on-accent hover:brightness-110"
              >
                {t('scripture.showLive')} ⏎
              </button>
            </div>
          )}
        </div>
        {styleOpen && <StylePanel initialTarget="scripture" onClose={() => setStyleOpen(false)} />}
      </div>
    </div>
  )
}

function SearchResults({ hits, query, onPick }: { hits: VerseHit[]; query: string; onPick: (h: VerseHit) => void }) {
  const { t, tn } = useT()
  const words = query
    .toLowerCase()
    .match(/[\p{L}\p{N}']+/gu)
    ?.filter((w) => w.length > 1)
  const re = words?.length ? new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi') : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-line px-4 text-[12.5px] text-muted">
        <span className="truncate">{hits.length === 200 ? t('scripture.first200', { query }) : tn('scripture.resultsFor', hits.length, { query })}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {hits.length === 0 && <div className="p-6 text-center text-[13px] text-muted">{t('scripture.noVerses')}</div>}
        {hits.map((h) => (
          <button
            key={`${h.book}-${h.chapter}-${h.verse}`}
            onClick={() => onPick(h)}
            className="block w-full rounded-md px-3 py-2 text-left hover:bg-panel-2"
          >
            <div className="text-[12px] font-semibold text-accent-text">{h.label}</div>
            <div className="text-[13.5px] leading-relaxed text-fg/90">
              {re
                ? h.text.split(re).map((part, i) =>
                    i % 2 ? (
                      <mark key={i} className="rounded bg-accent/30 px-0.5 text-fg">
                        {part}
                      </mark>
                    ) : (
                      part
                    )
                  )
                : h.text}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function BiblePicker({ bibles, current, onPick }: { bibles: BibleInfo[]; current: BibleInfo; onPick: (id: string) => void }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  useModal(open, () => setOpen(false))
  const [library, setLibrary] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  /** Save a new short code; Recent and pinned passages show the new code too. */
  const saveAbbrev = async (): Promise<void> => {
    if (!editing) return
    const { id, value } = editing
    setEditing(null)
    const code = value.trim().replace(/\s+/g, ' ').slice(0, 12)
    if (!code || code === bibles.find((b) => b.id === id)?.abbrev) return
    await window.nl.bible.rename(id, code)
    const fix = (list: ScripturePassage[]): ScripturePassage[] => list.map((p) => (p.bibleId === id ? { ...p, abbrev: code } : p))
    useApp.setState((s) => ({ scriptureHistory: fix(s.scriptureHistory), scripturePins: fix(s.scripturePins) }))
  }

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const doImport = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const info = await window.nl.bible.import()
      if (info) onPick(info.id)
    } catch (e) {
      setError(String((e as Error).message).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-60 items-center gap-2 rounded-md bg-panel-2 px-3 text-left text-[13px] hover:bg-panel-3"
      >
        <span className="rounded bg-accent-soft px-1.5 text-[11px] font-bold text-accent-text">{current.abbrev}</span>
        <span className="flex-1 truncate">{current.name}</span>
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-96 overflow-hidden rounded-lg border border-line bg-panel-2 shadow-2xl">
          <div className="label-caps px-3 pb-1 pt-2.5">{t('scripture.translations')}</div>
          <div className="max-h-[50vh] overflow-y-auto">
          {bibles.map((b) => (
            <div
              key={b.id}
              className={`group flex items-center gap-2 px-3 py-2 ${b.id === current.id ? 'bg-panel-3' : 'hover:bg-panel-3'}`}
            >
              {editing?.id === b.id && (
                <input
                  autoFocus
                  value={editing.value}
                  maxLength={12}
                  onChange={(e) => setEditing({ id: b.id, value: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  onBlur={saveAbbrev}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                  aria-label={t('scripture.abbrevEdit')}
                  className="w-14 shrink-0 rounded bg-panel px-1 text-center text-[11px] font-bold text-accent-text outline-none ring-1 ring-accent"
                />
              )}
              <button
                onClick={() => {
                  onPick(b.id)
                  setOpen(false)
                }}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                title={b.license}
              >
                {editing?.id !== b.id && (
                  <span className="w-14 shrink-0 truncate rounded bg-accent-soft px-1.5 text-center text-[11px] font-bold text-accent-text">
                    {b.abbrev}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[13px]">{b.name}</span>
                  <span className="block truncate text-[11px] text-dim">{b.license}</span>
                </span>
              </button>
              <button
                onClick={() => setEditing({ id: b.id, value: b.abbrev })}
                className="rounded p-1 text-dim opacity-0 hover:text-accent-text focus-visible:opacity-100 group-hover:opacity-100"
                title={t('scripture.abbrevEdit')}
              >
                <Pencil size={13} />
              </button>
              {!b.builtin && (
                <button
                  onClick={async () => {
                    if (!window.confirm(t('scripture.confirmRemove', { name: b.name }))) return
                    await window.nl.bible.remove(b.id)
                    if (b.id === current.id) onPick(bibles.find((x) => x.id !== b.id)!.id)
                  }}
                  className="rounded p-1 text-dim opacity-0 hover:text-live group-hover:opacity-100"
                  title={t('common.remove')}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          </div>
          <div className="flex flex-col gap-1.5 border-t border-line p-2">
            <button
              onClick={() => {
                setOpen(false)
                setLibrary(true)
              }}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-accent-fill py-2 text-[12.5px] font-semibold text-on-accent hover:brightness-110"
            >
              <Library size={14} />
              {t('scripture.browseLibrary')}
            </button>
            <button
              onClick={doImport}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-panel-3 py-2 text-[12.5px] hover:text-accent-text disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {t('scripture.importXml')}
            </button>
            <p className="px-1 text-[10.5px] leading-snug text-dim">{t('scripture.importRights')}</p>
            {error && <p className="mt-2 px-1 text-[11.5px] text-live">{error}</p>}
          </div>
        </div>
      )}
      {library && <BibleLibrary bibles={bibles} onUse={onPick} onClose={() => setLibrary(false)} />}
    </div>
  )
}

const PER_SLIDE = [1, 2, 3, 4, 0]

/** Verses per slide and verse numbers (saved; used by Show live and Add to service). */
function SlideOptions() {
  const opts = useApp((s) => s.scripture)
  const setOpts = useApp((s) => s.setScripture)
  const { t } = useT()
  return (
    <div className="ml-2 flex shrink-0 items-center gap-2 text-[11.5px]" title={t('scripture.perSlideHint')}>
      <span className="hidden whitespace-nowrap text-dim @xl:inline">{t('scripture.perSlide')}</span>
      <div className="flex overflow-hidden rounded-md bg-panel-2">
        {PER_SLIDE.map((n) => (
          <button
            key={n}
            onClick={() => setOpts({ perSlide: n })}
            className={`px-2 py-0.5 tabular-nums ${opts.perSlide === n ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'}`}
          >
            {n || t('scripture.all')}
          </button>
        ))}
      </div>
      <label className={`ml-1 flex items-center gap-1.5 ${opts.perSlide === 1 ? 'text-dim' : 'text-muted'}`} title={t('scripture.numbersHint')}>
        <input
          type="checkbox"
          checked={opts.numbers}
          onChange={(e) => setOpts({ numbers: e.target.checked })}
          disabled={opts.perSlide === 1}
          className="accent-[var(--color-accent)]"
        />
        <span className="hidden whitespace-nowrap @lg:inline">{t('scripture.numbers')}</span>
        <span className="whitespace-nowrap @lg:hidden">{t('scripture.numbersShort')}</span>
      </label>
    </div>
  )
}

/** Up to two more translations on the slides ("Compare"), side by side or stacked. */
function ComparePicker({
  bibles,
  current,
  layout,
  onPick,
  onLayout
}: {
  bibles: BibleInfo[]
  current: BibleInfo[]
  layout: ParallelLayout
  onPick: (ids: string[]) => void
  onLayout: (l: ParallelLayout) => void
}) {
  const { t } = useT()
  const ids = current.map((b) => b.id)
  const pick = (slot: number, id: string): void => {
    const next = [...ids]
    if (id) next[slot] = id
    else next.splice(slot, 1)
    onPick([...new Set(next.filter(Boolean))].slice(0, 2))
  }
  const select = (slot: number): React.ReactNode => (
    <select
      value={ids[slot] ?? ''}
      onChange={(e) => pick(slot, e.target.value)}
      title={slot ? t('scripture.thirdHint') : t('scripture.compareHint')}
      className="max-w-36 cursor-pointer bg-transparent outline-none [&>option]:bg-panel-2 [&>option]:text-fg"
    >
      <option value="">{slot ? t('scripture.another') : t('scripture.compareOff')}</option>
      {bibles
        .filter((b) => b.id === ids[slot] || !ids.includes(b.id))
        .map((b) => (
          <option key={b.id} value={b.id}>
            {b.abbrev} · {b.name}
          </option>
        ))}
    </select>
  )
  return (
    <div className={`flex h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-[12.5px] ${ids.length ? 'bg-accent-soft text-accent-text' : 'bg-panel-2 text-muted'}`}>
      {layout === 'stacked' && ids.length ? <Rows2 size={14} /> : <Columns2 size={14} />}
      {select(0)}
      {ids.length > 0 && (
        <>
          <span className="h-4 w-px bg-accent/30" />
          {select(1)}
          <div className="flex overflow-hidden rounded bg-panel-2 text-[11.5px]" title={t('scripture.layoutHint')}>
            {(['side', 'stacked'] as const).map((l) => (
              <button
                key={l}
                onClick={() => onLayout(l)}
                className={`whitespace-nowrap px-1.5 py-0.5 ${layout === l ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'}`}
              >
                {l === 'side' ? t('scripture.sideBySide') : t('scripture.stacked')}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
