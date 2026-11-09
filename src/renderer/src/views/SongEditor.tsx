import { useEffect, useMemo, useRef, useState } from 'react'
import { Guitar, Languages, LayoutList, Minus, Plus, StickyNote, Type } from 'lucide-react'
import type { LanguageMode, Slide, Song } from '@shared/types'
import SlideView from '@/components/SlideView'
import ChordText from '@/components/ChordText'
import SlideCard, { splitAtCursor } from '@/components/SlideCard'
import {
  KEYS,
  NASHVILLE_PALETTE,
  chordSheetToInline,
  diatonicChords,
  extractKey,
  guessKey,
  hasChords,
  stripChords,
  transposeKey,
  transposeText
} from '@shared/chords'
import { hasSecondLanguage, languageText, splitLanguages } from '@shared/bilingual'
import { useSmallSlides } from '@/lib/fitCheck'
import { SECTION_LABELS, lyricsToSlides, slidesToLyrics, uid } from '@/lib/defaults'
import { itemLook, useApp } from '@/store/useApp'
import LookPicker from '@/components/LookPicker'
import { takeNewSongDraft, takeNewSongTitle } from '@/lib/guide'
import { useModal } from '@/lib/modal'
import { labelColor } from '@shared/labels'
import { t, useT } from '@/i18n'

type Mode = 'slides' | 'text'

/** A translated sentence with JSX (e.g. <code>) in place of its {placeholders}. */
function fill(text: string, parts: Record<string, React.ReactNode>): React.ReactNode {
  return text.split(/\{(\w+)\}/).map((s, i) => (i % 2 ? <span key={i}>{parts[s] ?? `{${s}}`}</span> : s))
}

/** "Edit all as text" has no place for notes: carry them over to the matching slides (same lyrics, else same position). */
function keepNotes(next: Slide[], prev: Slide[]): Slide[] {
  if (!prev.some((p) => p.notes)) return next
  const used = new Set<number>()
  return next.map((sl, i) => {
    let j = prev.findIndex((p, k) => !used.has(k) && p.notes && p.text.trim() === sl.text.trim())
    if (j < 0 && prev.length === next.length && prev[i]?.notes && !used.has(i)) j = i
    if (j < 0) return sl
    used.add(j)
    return { ...sl, notes: prev[j].notes }
  })
}

export default function SongEditor() {
  useModal()
  const { tn } = useT()
  const editingId = useApp((s) => s.editingSongId)
  const songs = useApp((s) => s.songs)
  const close = (): void => useApp.getState().openSongEditor(null)
  const original = useMemo(() => songs.find((s) => s.id === editingId), [songs, editingId])
  // A song from Find a song / an imported file: opens filled in, saved as a new song.
  const [draft] = useState(() => (editingId === 'new' ? takeNewSongDraft() : null))
  const base = original ?? draft?.song

  const [title, setTitle] = useState(() => base?.title ?? (editingId === 'new' ? takeNewSongTitle() : ''))
  const [author, setAuthor] = useState(base?.author ?? '')
  const [tags, setTags] = useState(base?.tags.join(', ') ?? '')
  const [copyright, setCopyright] = useState(base?.copyright ?? '')
  const [ccli, setCcli] = useState(base?.ccli ?? '')
  const [languageMode, setLanguageMode] = useState<LanguageMode>(base?.languageMode ?? 'both')
  const [slides, setSlides] = useState<Slide[]>(
    base?.slides.map((s) => ({ ...s })) ?? [{ id: uid(), label: 'Verse 1', text: '' }]
  )
  const [mode, setMode] = useState<Mode>(original ? 'slides' : 'text')
  const [text, setText] = useState(() => slidesToLyrics(slides))
  const [focus, setFocus] = useState(0)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(!!draft)
  const [key, setKey] = useState(base?.key ?? '')
  const [palette, setPalette] = useState<'standard' | 'nashville'>('standard')
  const [bracket, setBracket] = useState(false) // the cursor follows a "[" that isn't closed yet
  // The lyrics field that had focus last, so palette chips insert where the cursor is.
  const field = useRef<{ el: HTMLTextAreaElement; set: (v: string) => void } | null>(null)

  const [templateId, setTemplateId] = useState<string | undefined>(base?.templateId)
  const state = useApp()
  const { aspect, labelColors } = state
  const { style, background } = itemLook(state, { templateId })

  const [notesOpen, setNotesOpen] = useState<Set<string>>(() => new Set())
  const toggleNotes = (id: string): void =>
    setNotesOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const currentSlides = mode === 'text' ? keepNotes(lyricsToSlides(text), slides) : slides
  const preview = currentSlides[Math.min(focus, currentSlides.length - 1)] ?? null

  const switchMode = (m: Mode): void => {
    if (m === mode) return
    if (m === 'text') setText(slidesToLyrics(slides))
    else setSlides(keepNotes(lyricsToSlides(text), slides))
    setMode(m)
  }

  const update = (i: number, patch: Partial<Slide>): void => {
    setSlides((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)))
    setDirty(true)
  }
  const move = (i: number, d: -1 | 1): void => {
    setSlides((s) => {
      const j = i + d
      if (j < 0 || j >= s.length) return s
      const c = [...s]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })
    setFocus(i + d)
    setDirty(true)
  }
  const insertAfter = (i: number, slide: Slide): void => {
    setSlides((s) => [...s.slice(0, i + 1), slide, ...s.slice(i + 1)])
    setFocus(i + 1)
    setDirty(true)
  }
  const remove = (i: number): void => {
    setSlides((s) => s.filter((_, j) => j !== i))
    setFocus(Math.max(0, i - 1))
    setDirty(true)
  }
  /** Alt+Enter: split slide i at the cursor; the new slide keeps the label and gets the focus. */
  const splitAt = (i: number, el: HTMLTextAreaElement): void => {
    const parts = splitAtCursor(el)
    if (!parts) return
    const id = uid()
    setSlides((s) => s.flatMap((x, j) => (j === i ? [{ ...x, text: parts[0] }, { id, label: x.label, text: parts[1] }] : [x])))
    setFocus(i + 1)
    setDirty(true)
    requestAnimationFrame(() => {
      const next = document.querySelector<HTMLTextAreaElement>(`[data-slide-text="${id}"]`)
      next?.focus()
      next?.setSelectionRange(0, 0)
    })
  }

  const save = async (): Promise<void> => {
    const finalSlides = currentSlides.filter((s) => s.text.trim())
    if (!finalSlides.length) return
    setSaving(true)
    const song: Song = {
      id: original?.id ?? uid(),
      title: title.trim() || t('songs.editor.untitled'),
      author: author.trim() || undefined,
      tags: tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      slides: finalSlides,
      key: key || undefined,
      templateId,
      copyright: copyright.trim() || undefined,
      ccli: ccli.trim() || undefined,
      languageMode: languageMode !== 'both' ? languageMode : undefined,
      updatedAt: Date.now()
    }
    await useApp.getState().saveSong(song)
    setSaving(false)
    close()
  }

  const cancel = (): void => {
    if (dirty && !window.confirm(t('songs.editor.confirmDiscard'))) return
    close()
  }

  // Ctrl/Cmd+S saves, Escape cancels.
  const saveRef = useRef(save)
  saveRef.current = save
  const cancelRef = useRef(cancel)
  cancelRef.current = cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      } else if (e.key === 'Escape' && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
        cancelRef.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const canSave = currentSlides.some((s) => s.text.trim())
  const withChords = currentSlides.some((s) => hasChords(s.text))
  const bilingual = currentSlides.some((s) => hasSecondLanguage(s.text))
  // No key picked: read it from the chords, so the palette offers the right ones.
  const guessed = useMemo(() => (key ? undefined : guessKey(currentSlides.map((s) => s.text).join('\n'))), [key, currentSlides])
  const paletteKey = key || guessed
  // Slides the projector would shrink a lot (cards only: in text mode the slides are rebuilt on every key).
  const small = useSmallSlides(mode === 'slides' ? slides : undefined, style, aspect, bilingual ? languageMode : undefined)
  const previewSlide = preview ? { ...preview, text: languageText(stripChords(preview.text), languageMode) } : null

  /** Transpose the whole song permanently (chords and key). */
  const transposeSong = (n: number): void => {
    const from = key || undefined
    if (mode === 'text') setText((t) => transposeText(t, n, from))
    else setSlides((list) => list.map((s) => ({ ...s, text: transposeText(s.text, n, from) })))
    if (key) setKey(transposeKey(key, n) ?? key)
    setDirty(true)
  }

  const insertChord = (chord: string): void => {
    const f = field.current
    if (!f) return
    const { el } = f
    const start = el.selectionStart
    const end = el.selectionEnd
    const open = el.value[start - 1] === '[' && start === end
    const ins = open ? `${chord}]` : `[${chord}]`
    const value = el.value.slice(0, start) + ins + el.value.slice(end)
    f.set(value)
    setBracket(false)
    setDirty(true)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + ins.length, start + ins.length)
    })
  }

  /** Track the focused field and whether a "[" was just typed. */
  const fieldProps = (set: (v: string) => void) => ({
    onFocus: (e: React.FocusEvent<HTMLTextAreaElement>) => (field.current = { el: e.currentTarget, set }),
    onKeyUp: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget
      setBracket(el.selectionStart === el.selectionEnd && el.value[el.selectionStart - 1] === '[')
    },
    // Pasted chord sheets (chords above the words) become inline chords; a "Key:" line sets the key.
    onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const raw = e.clipboardData.getData('text/plain')
      if (!raw) return
      const { key: k, text: body } = extractKey(raw)
      const conv = chordSheetToInline(body)
      if (conv === raw && !k) return
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const value = el.value.slice(0, start) + conv + el.value.slice(el.selectionEnd)
      set(value)
      if (k && !key) setKey(k)
      setDirty(true)
      requestAnimationFrame(() => el.setSelectionRange(start + conv.length, start + conv.length))
    }
  })

  return (
    // Stops operator shortcuts (arrows/space) from changing the live slide while editing.
    <div className="fixed inset-0 z-40 flex flex-col bg-bg" onKeyDown={(e) => e.stopPropagation()}>
      <header className="drag flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4 pl-20">
        <span className="label-caps whitespace-nowrap">{original ? t('songs.editSong') : t('songs.newSong')}</span>
        <div className="flex-1" />
        <div className="no-drag flex items-center whitespace-nowrap rounded-md bg-panel-2 p-0.5 text-[12.5px]">
          <ModeBtn active={mode === 'slides'} onClick={() => switchMode('slides')}>
            <LayoutList size={14} /> {t('songs.editor.modeSlides')}
          </ModeBtn>
          <ModeBtn active={mode === 'text'} onClick={() => switchMode('text')}>
            <Type size={14} /> {t('songs.editor.modeText')}
          </ModeBtn>
        </div>
        <button onClick={cancel} className="no-drag whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] text-muted hover:text-fg">
          {t('common.cancel')}
        </button>
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="no-drag whitespace-nowrap rounded-md bg-accent-fill px-4 py-1.5 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
          title={t('songs.editor.saveHint')}
        >
          {saving ? t('songs.editor.saving') : t('songs.editor.saveSong')}
        </button>
      </header>
      {draft && (
        <div className="flex items-center gap-2 border-b border-amber-400/25 bg-amber-400/10 px-4 py-2 text-[12.5px] text-amber-200">
          <span className="font-semibold">{draft.source}</span>
          <span className="text-amber-200/80">{t('songs.find.checkInEditor')}</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="grid grid-cols-[2fr_1.3fr_1.6fr_0.8fr] gap-x-3 gap-y-2.5 border-b border-line p-4">
            <Field label={t('songs.editor.title')}>
              <input
                autoFocus={!original}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setDirty(true)
                }}
                placeholder={t('songs.editor.titlePlaceholder')}
                className="input text-[15px] font-semibold"
              />
            </Field>
            <Field label={t('songs.editor.author')}>
              <input
                value={author}
                onChange={(e) => {
                  setAuthor(e.target.value)
                  setDirty(true)
                }}
                placeholder={t('songs.editor.optional')}
                className="input"
              />
            </Field>
            <Field label={t('songs.editor.copyright')}>
              <input
                value={copyright}
                onChange={(e) => {
                  setCopyright(e.target.value)
                  setDirty(true)
                }}
                placeholder={t('songs.editor.copyrightPlaceholder')}
                className="input"
              />
            </Field>
            <Field label={t('songs.editor.ccli')}>
              <input
                value={ccli}
                inputMode="numeric"
                onChange={(e) => {
                  setCcli(e.target.value.replace(/[^\d]/g, ''))
                  setDirty(true)
                }}
                placeholder={t('songs.editor.optional')}
                className="input tabular-nums"
              />
            </Field>
            <Field label={t('songs.editor.tags')}>
              <input
                value={tags}
                onChange={(e) => {
                  setTags(e.target.value)
                  setDirty(true)
                }}
                placeholder={t('songs.editor.tagsPlaceholder')}
                className="input"
              />
            </Field>
            <div className="col-span-3 flex items-end gap-2 pb-1">
              <Languages size={15} className={bilingual ? 'mb-1.5 text-accent-text' : 'mb-1.5 text-dim'} />
              <label className="flex flex-col gap-1">
                <span className="label-caps whitespace-nowrap">{t('songs.editor.languages')}</span>
                <select
                  value={languageMode}
                  disabled={!bilingual}
                  onChange={(e) => {
                    setLanguageMode(e.target.value as LanguageMode)
                    setDirty(true)
                  }}
                  className="h-8 rounded-md bg-panel-2 px-2 text-[12.5px] outline-none disabled:opacity-50"
                >
                  <option value="both">{t('songs.editor.langBoth')}</option>
                  <option value="primary">{t('songs.editor.langPrimary')}</option>
                  <option value="secondary">{t('songs.editor.langSecondary')}</option>
                </select>
              </label>
              <span className="mb-1.5 text-[11.5px] text-dim">
                {bilingual
                  ? t('songs.editor.bilingualHint')
                  : fill(t('songs.editor.bilingualHowTo'), { dash: <code className="text-muted">--</code> })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
            <Guitar size={15} className="text-amber-300" />
            <span className="label-caps">{t('songs.key')}</span>
            <select
              value={key}
              onChange={(e) => {
                setKey(e.target.value)
                setDirty(true)
              }}
              className="h-7 rounded bg-panel-2 px-1.5 text-[12.5px] outline-none"
            >
              <option value="">{guessed ? t('songs.editor.soundsLike', { key: guessed }) : '—'}</option>
              {KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <div className="flex items-center rounded bg-panel-2 text-[12px]" title={t('songs.editor.transposeHint')}>
              <button onClick={() => transposeSong(-1)} disabled={!withChords} className="rounded p-1.5 text-muted hover:text-fg disabled:opacity-30">
                <Minus size={12} />
              </button>
              <span className="whitespace-nowrap px-1 text-muted">{t('songs.editor.transpose')}</span>
              <button onClick={() => transposeSong(1)} disabled={!withChords} className="rounded p-1.5 text-muted hover:text-fg disabled:opacity-30">
                <Plus size={12} />
              </button>
            </div>
            <div className="mx-1 h-5 w-px bg-line" />
            <div className="flex rounded bg-panel-2 p-0.5 text-[11.5px]">
              {(['standard', 'nashville'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPalette(p)}
                  className={`rounded px-2 py-0.5 ${palette === p ? 'bg-panel-3 text-fg' : 'text-muted hover:text-fg'}`}
                >
                  {p === 'standard' ? 'ABC' : '123'}
                </button>
              ))}
            </div>
            {guessed && (
              <button
                onClick={() => {
                  setKey(guessed)
                  setDirty(true)
                }}
                title={t('songs.editor.useKeyHint')}
                className="whitespace-nowrap rounded bg-amber-400/10 px-2 py-0.5 text-[11.5px] text-amber-300 hover:bg-amber-400/25"
              >
                {t('songs.editor.useKey', { key: guessed })}
              </button>
            )}
            <div className={`flex flex-wrap gap-1 rounded-md p-0.5 ${bracket ? 'ring-1 ring-amber-300/60' : ''}`}>
              {palette === 'standard' && !paletteKey && (
                <span className="px-1 py-0.5 text-[12px] text-amber-300/80">{t('songs.editor.pickKey')}</span>
              )}
              {(palette === 'standard' ? (paletteKey ? diatonicChords(paletteKey) : []) : NASHVILLE_PALETTE).map((c) => (
                <button
                  key={c}
                  onMouseDown={(e) => e.preventDefault()} // keep the cursor in the lyrics
                  onClick={() => insertChord(c)}
                  className="rounded bg-amber-400/10 px-2 py-0.5 font-mono text-[12px] font-semibold text-amber-300 hover:bg-amber-400/25"
                >
                  {c}
                </button>
              ))}
            </div>
            <span className="text-[11.5px] text-dim">
              {bracket ? t('songs.editor.chordHintBracket') : t('songs.editor.chordHint')}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="label-caps whitespace-nowrap">{t('songs.editor.template')}</span>
              <LookPicker
                value={templateId}
                onChange={(id) => {
                  setTemplateId(id)
                  setDirty(true)
                }}
              />
            </div>
          </div>

          {mode === 'text' ? (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setDirty(true)
                }}
                {...fieldProps(setText)}
                onSelect={(e) => {
                  // Preview the slide the cursor is in.
                  const before = e.currentTarget.value.slice(0, e.currentTarget.selectionStart)
                  setFocus(Math.max(0, lyricsToSlides(before + 'x').length - 1))
                }}
                spellCheck={false}
                placeholder={t('songs.editor.textPlaceholder')}
                className="min-h-0 flex-1 resize-none rounded-lg bg-panel p-4 font-mono text-[14px] leading-relaxed outline-none ring-1 ring-line select-text focus:ring-accent/50"
              />
              <p className="mt-2 text-[12px] text-dim">
                {fill(t('songs.editor.textHelp'), {
                  label: <code className="text-muted">[Chorus]</code>,
                  chords: <code className="text-muted">[G]Amazing [C]grace</code>,
                  dash: <code className="text-muted">--</code>
                })}{' '}
                {tn('songs.slideCount', currentSlides.length)}.
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <datalist id="section-labels">
                {SECTION_LABELS.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
              {/* Cards fill the width: one column on narrow windows, two or more when there is room. */}
              <div className="grid items-start gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr))]">
                {slides.map((sl, i) => (
                  <SlideCard
                    key={sl.id}
                    index={i}
                    focused={focus === i}
                    small={small.has(sl.id)}
                    onFocus={() => setFocus(i)}
                    onMove={(d) => move(i, d)}
                    onDuplicate={() => insertAfter(i, { ...sl, id: uid() })}
                    onDelete={() => remove(i)}
                    head={
                      <input
                        list="section-labels"
                        value={sl.label ?? ''}
                        onChange={(e) => update(i, { label: e.target.value || undefined })}
                        placeholder={t('songs.editor.labelPlaceholder')}
                        className="h-7 w-40 rounded bg-panel-2 px-2 text-[12px] font-semibold uppercase tracking-wide text-accent-text outline-none placeholder:normal-case placeholder:font-normal placeholder:text-dim"
                        style={{ color: labelColor(sl.label, labelColors), boxShadow: labelColor(sl.label, labelColors) ? `inset 3px 0 0 ${labelColor(sl.label, labelColors)}` : undefined }}
                      />
                    }
                    tools={
                      <button
                        onClick={() => toggleNotes(sl.id)}
                        title={sl.notes ? t('songs.editor.notesHint', { notes: sl.notes }) : t('songs.editor.addNotesHint')}
                        className={`flex items-center gap-1 rounded p-1.5 text-[11.5px] ${
                          sl.notes || notesOpen.has(sl.id) ? 'text-accent-text hover:bg-panel-3' : 'text-muted opacity-50 hover:bg-panel-3 hover:text-fg group-hover:opacity-100'
                        }`}
                      >
                        <StickyNote size={13} />
                        {sl.notes && !notesOpen.has(sl.id) ? t('songs.editor.note') : null}
                      </button>
                    }
                  >
                    <textarea
                      data-slide-text={sl.id}
                      value={sl.text}
                      onChange={(e) => update(i, { text: e.target.value })}
                      {...fieldProps((v) => update(i, { text: v }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.altKey) {
                          e.preventDefault()
                          splitAt(i, e.currentTarget)
                        }
                      }}
                      rows={Math.max(2, sl.text.split('\n').length)}
                      spellCheck={false}
                      title={t('songs.editor.splitHint')}
                      placeholder={t('songs.editor.lyricsPlaceholder')}
                      className="w-full resize-none rounded-md bg-panel-2 px-3 py-2 text-[14px] leading-relaxed outline-none select-text focus:ring-1 focus:ring-accent/50"
                    />
                    {notesOpen.has(sl.id) && (
                      <label className="mt-2 flex flex-col gap-1">
                        <span className="label-caps flex items-center gap-1">
                          <StickyNote size={11} /> {t('songs.editor.notesForStage')}
                        </span>
                        <textarea
                          autoFocus={!sl.notes}
                          value={sl.notes ?? ''}
                          onChange={(e) => update(i, { notes: e.target.value || undefined })}
                          rows={Math.max(1, (sl.notes ?? '').split('\n').length)}
                          placeholder={t('songs.editor.notesPlaceholder')}
                          className="w-full resize-none rounded-md bg-panel-2 px-3 py-1.5 text-[13px] leading-snug text-fg/90 outline-none select-text focus:ring-1 focus:ring-accent/50"
                        />
                      </label>
                    )}
                  </SlideCard>
                ))}
                <button
                  onClick={() => insertAfter(slides.length - 1, { id: uid(), label: slides.at(-1)?.label, text: '' })}
                  className="col-span-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-3 text-[13px] text-muted hover:border-accent/50 hover:text-accent-text"
                >
                  <Plus size={15} /> {t('songs.editor.addSlide')} <span className="text-dim">· {t('songs.editor.addSlideHint')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="flex w-[420px] shrink-0 flex-col gap-3 border-l border-line bg-panel p-4">
          <div className="flex items-center justify-between">
            <span className="label-caps">{t('songs.editor.preview')}</span>
            <span className="text-[12px] text-muted">
              {preview ? t('songs.editor.slideOf', { n: Math.min(focus, currentSlides.length - 1) + 1, total: currentSlides.length }) : ''}
              {preview?.label && (
                <span className="ml-2 text-accent-text" style={{ color: labelColor(preview.label, labelColors) }}>
                  {preview.label}
                </span>
              )}
            </span>
          </div>
          <SlideView
            slide={previewSlide}
            style={style}
            aspect={aspect}
            background={background}
            thumbnail
            className={`${aspect === '16:9' ? 'aspect-video' : 'aspect-[4/3]'} w-full rounded-lg ring-1 ring-line`}
          />
          {withChords && (
            <>
              <span className="label-caps mt-1">{t('songs.editor.stageMusicians')}</span>
              <div className="max-h-44 overflow-y-auto rounded-lg bg-black px-4 py-3 text-center text-[17px] font-bold leading-snug text-white ring-1 ring-line">
                {preview ? <ChordText text={splitLanguages(preview.text).primary} mode="standard" songKey={paletteKey} /> : null}
              </div>
            </>
          )}
          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {currentSlides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setFocus(i)}
                className={`flex gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${
                  i === focus ? 'bg-accent-soft text-fg' : 'text-muted hover:bg-panel-2'
                }`}
              >
                <span className="w-5 shrink-0 text-dim">{i + 1}</span>
                <span className="w-20 shrink-0 truncate font-semibold uppercase text-accent-text/80" style={{ color: labelColor(s.label, labelColors) }}>
                  {s.label ?? ''}
                </span>
                <span className="truncate">{stripChords(s.text).split('\n').find((l) => l.trim()) || (hasChords(s.text) ? `♪ ${t('songs.editor.instrumental')}` : '—')}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-caps">{label}</span>
      {children}
    </label>
  )
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded px-2.5 py-1 ${active ? 'bg-panel-3 text-fg' : 'text-muted hover:text-fg'}`}
    >
      {children}
    </button>
  )
}
