import { useEffect, useRef, useState } from 'react'
import { LayoutList, Plus, TextQuote, Type } from 'lucide-react'
import type { Slide } from '@shared/types'
import SlideView from './SlideView'
import SlideCard, { splitAtCursor } from './SlideCard'
import LookPicker from './LookPicker'
import { uid } from '@/lib/defaults'
import { useSmallSlides } from '@/lib/fitCheck'
import { useModal } from '@/lib/modal'
import { itemLook, useApp } from '@/store/useApp'
import { useT } from '@/i18n'

// Text slides (announcements, sermon points): each slide has an optional title line and a body.
// "All as text": slides are separated by a blank line or a line with "---"; a first line starting with "#" is the
// title. Pasting into a slide splits the same way (there, a block's first line becomes the title when more follow).

type Mode = 'slides' | 'text'

// A blank line, or a line of three or more dashes.
const BLOCKS = /\n\s*\n|(?:^|\n)[ \t]*-{3,}[ \t]*(?=\n|$)/

/** Text → slides. `autoTitle`: a block of two or more lines uses its first line as the title. */
export function parseTextSlides(raw: string, autoTitle = false): Slide[] {
  return raw
    .replace(/\r\n?/g, '\n')
    .split(BLOCKS)
    .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length)
    .map((lines) => {
      let heading = ''
      if (/^#+\s*/.test(lines[0])) heading = lines.shift()!.replace(/^#+\s*/, '')
      else if (autoTitle && lines.length > 1) heading = lines.shift()!
      return { id: uid(), heading, text: lines.join('\n') }
    })
}

export const textSlidesToText = (slides: Slide[]): string =>
  slides.map((s) => [s.heading?.trim() ? `# ${s.heading.trim()}` : '', s.text.trim()].filter(Boolean).join('\n')).join('\n\n')

export default function TextSlidesEditor() {
  useModal()
  const itemId = useApp((s) => s.editingTextId)
  const item = useApp((s) => s.service.items.find((i) => i.id === itemId))
  const state = useApp()
  const close = (): void => useApp.getState().openTextEditor(null)
  const { t, tn } = useT()

  const [title, setTitle] = useState(item?.title ?? t('presentation.announcements'))
  const [slides, setSlides] = useState<Slide[]>(() =>
    item?.slides.length ? item.slides.map((s) => ({ ...s, heading: s.heading ?? '' })) : [{ id: uid(), heading: '', text: '' }]
  )
  const [mode, setMode] = useState<Mode>('slides')
  const [text, setText] = useState('')
  const [focus, setFocus] = useState(0)
  const [dirty, setDirty] = useState(false)

  const { style, background } = itemLook(state, item)
  const current = mode === 'text' ? parseTextSlides(text) : slides
  const preview = current[Math.min(focus, current.length - 1)] ?? null
  const small = useSmallSlides(mode === 'slides' ? slides : undefined, style, state.aspect)

  const change = (f: (s: Slide[]) => Slide[]): void => {
    setSlides(f)
    setDirty(true)
  }
  const update = (i: number, patch: Partial<Slide>): void => change((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const move = (i: number, d: -1 | 1): void => {
    change((s) => {
      const j = i + d
      if (j < 0 || j >= s.length) return s
      const c = [...s]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })
    setFocus(Math.max(0, Math.min(slides.length - 1, i + d)))
  }
  const insertAfter = (i: number, ...add: Slide[]): void => {
    change((s) => [...s.slice(0, i + 1), ...add, ...s.slice(i + 1)])
    setFocus(i + add.length)
  }
  const remove = (i: number): void => {
    change((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : [{ id: uid(), heading: '', text: '' }]))
    setFocus(Math.max(0, i - 1))
  }
  const focusBody = (id: string): void => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLTextAreaElement>(`[data-text-body="${id}"]`)
      el?.focus()
      el?.setSelectionRange(0, 0)
    })
  }

  const switchMode = (m: Mode): void => {
    if (m === mode) return
    if (m === 'text') setText(textSlidesToText(slides))
    else {
      const parsed = parseTextSlides(text)
      setSlides(parsed.length ? parsed : [{ id: uid(), heading: '', text: '' }])
      setFocus(0)
    }
    setMode(m)
  }

  const save = (): void => {
    if (!item) return close()
    const final = current.filter((s) => s.text.trim() || s.heading?.trim()).map((s) => ({ ...s, heading: s.heading?.trim() || undefined }))
    useApp.getState().setItemSlides(item.id, title, final.length ? final : [{ id: uid(), text: '' }])
    close()
  }
  const cancel = (): void => {
    if (dirty && !window.confirm(t('presentation.confirmDiscard'))) return
    close()
  }

  // Ctrl/Cmd+S saves, Escape cancels (outside the text fields).
  const keys = useRef({ save, cancel })
  keys.current = { save, cancel }
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        keys.current.save()
      } else if (e.key === 'Escape' && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
        keys.current.cancel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // The item was removed while editing.
  useEffect(() => {
    if (!item) close()
  }, [item])

  if (!item) return null

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg" onKeyDown={(e) => e.stopPropagation()}>
      <header className="drag flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4 pl-20">
        <TextQuote size={16} className="text-accent-text" />
        <span className="label-caps truncate">{t('presentation.textSlides')}</span>
        <div className="flex-1" />
        <div className="no-drag flex shrink-0 items-center whitespace-nowrap rounded-md bg-panel-2 p-0.5 text-[12.5px]">
          <ModeBtn active={mode === 'slides'} onClick={() => switchMode('slides')}>
            <LayoutList size={14} /> {t('presentation.modeSlides')}
          </ModeBtn>
          <ModeBtn active={mode === 'text'} onClick={() => switchMode('text')}>
            <Type size={14} /> {t('presentation.modeText')}
          </ModeBtn>
        </div>
        <button onClick={cancel} className="no-drag shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] text-muted hover:text-fg">
          {t('common.cancel')}
        </button>
        <button
          onClick={save}
          className="no-drag shrink-0 whitespace-nowrap rounded-md bg-accent-fill px-4 py-1.5 text-[13px] font-semibold text-on-accent hover:brightness-110"
          title={t('presentation.saveShortcutHint')}
        >
          {t('presentation.saveSlides')}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-end gap-4 border-b border-line p-4">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="label-caps">{t('presentation.nameInOrder')}</span>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setDirty(true)
                }}
                placeholder={t('presentation.announcements')}
                className="input text-[15px] font-semibold"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="label-caps">{t('presentation.look')}</span>
              <LookPicker value={item.templateId} onChange={(id) => useApp.getState().setItemTemplate(item.id, id)} />
            </div>
          </div>

          {mode === 'text' ? (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <textarea
                autoFocus
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setDirty(true)
                }}
                onSelect={(e) => {
                  const before = e.currentTarget.value.slice(0, e.currentTarget.selectionStart)
                  setFocus(Math.max(0, parseTextSlides(before + 'x').length - 1))
                }}
                placeholder={t('presentation.textPlaceholder')}
                className="min-h-0 flex-1 resize-none rounded-lg bg-panel p-4 font-mono text-[14px] leading-relaxed outline-none ring-1 ring-line select-text focus:ring-accent/50"
              />
              <p className="mt-2 text-[12px] text-dim">
                {t('presentation.textHelp')
                  .split(/(\{dashes\}|\{hash\})/)
                  .map((part, i) =>
                    part === '{dashes}' ? (
                      <code key={i} className="text-muted">---</code>
                    ) : part === '{hash}' ? (
                      <code key={i} className="text-muted">#</code>
                    ) : (
                      part
                    )
                  )}{' '}
                {tn('presentation.slideCount', current.length)}
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
                  >
                    <input
                      value={sl.heading ?? ''}
                      onChange={(e) => update(i, { heading: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          focusBody(sl.id)
                        }
                      }}
                      placeholder={t('presentation.titlePlaceholder')}
                      className="mb-1.5 h-9 w-full rounded-md bg-panel-2 px-3 text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-dim focus:ring-1 focus:ring-accent/50"
                    />
                    <textarea
                      data-text-body={sl.id}
                      value={sl.text}
                      onChange={(e) => update(i, { text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.altKey) {
                          e.preventDefault()
                          const parts = splitAtCursor(e.currentTarget)
                          if (!parts) return
                          const add = { id: uid(), heading: '', text: parts[1] }
                          change((s) => s.flatMap((x, j) => (j === i ? [{ ...x, text: parts[0] }, add] : [x])))
                          setFocus(i + 1)
                          focusBody(add.id)
                        }
                      }}
                      onPaste={(e) => {
                        // Several blocks pasted: the first goes here, the others become new slides after this one.
                        const raw = e.clipboardData.getData('text/plain')
                        if (!BLOCKS.test(raw.replace(/\r\n?/g, '\n').trim())) return
                        const parts = parseTextSlides(raw, true)
                        if (parts.length < 2) return
                        e.preventDefault()
                        const [first, ...rest] = parts
                        const el = e.currentTarget
                        const body = [first.heading, first.text].filter(Boolean).join('\n')
                        const value = el.value.slice(0, el.selectionStart) + body + el.value.slice(el.selectionEnd)
                        update(i, { text: value })
                        insertAfter(i, ...rest)
                      }}
                      rows={Math.max(3, sl.text.split('\n').length)}
                      title={t('presentation.bodyHint')}
                      placeholder={t('presentation.slideTextPlaceholder')}
                      className="w-full resize-none rounded-md bg-panel-2 px-3 py-2 text-[14px] leading-relaxed outline-none select-text focus:ring-1 focus:ring-accent/50"
                    />
                  </SlideCard>
                ))}
                <button
                  onClick={() => insertAfter(slides.length - 1, { id: uid(), heading: '', text: '' })}
                  className="col-span-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-3 text-[13px] text-muted hover:border-accent/50 hover:text-accent-text"
                >
                  <Plus size={15} className="shrink-0" /> {t('presentation.addSlide')}{' '}
                  <span className="truncate text-dim">{t('presentation.addSlideTip')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="flex w-[420px] shrink-0 flex-col gap-3 border-l border-line bg-panel p-4">
          <div className="flex items-center justify-between">
            <span className="label-caps">{t('presentation.preview')}</span>
            <span className="text-[12px] text-muted">
              {preview ? t('presentation.slideOf', { n: Math.min(focus, current.length - 1) + 1, total: current.length }) : ''}
            </span>
          </div>
          <SlideView
            slide={preview}
            style={style}
            aspect={state.aspect}
            background={item.background ?? background}
            thumbnail
            className={`${state.aspect === '16:9' ? 'aspect-video' : 'aspect-[4/3]'} w-full rounded-lg ring-1 ring-line`}
          />
          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {current.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setFocus(i)}
                className={`flex gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${i === focus ? 'bg-accent-soft text-fg' : 'text-muted hover:bg-panel-2'}`}
              >
                <span className="w-5 shrink-0 text-dim">{i + 1}</span>
                <span className="truncate">
                  {s.heading?.trim() ? <b className="font-semibold text-fg/90">{s.heading} </b> : null}
                  {s.text.split('\n').find((l) => l.trim()) ?? (s.heading?.trim() ? '' : '—')}
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded px-2.5 py-1 ${active ? 'bg-panel-3 text-fg' : 'text-muted hover:text-fg'}`}>
      {children}
    </button>
  )
}
