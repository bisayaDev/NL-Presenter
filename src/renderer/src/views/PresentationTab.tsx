import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Globe,
  GripVertical,
  Guitar,
  Minus,
  Image as ImageIcon,
  MoreHorizontal,
  Music,
  NotebookPen,
  TextQuote,
  Pencil,
  Plus,
  Presentation,
  Rows3,
  StickyNote,
  Timer,
  Square,
  Trash2,
  Type,
  Video,
  Volume2,
  VolumeX
} from 'lucide-react'
import type { Background, ItemKind, ServiceItem } from '@shared/types'
import SlideView from '@/components/SlideView'
import StylePanel from '@/components/StylePanel'
import MediaThumb from '@/components/MediaThumb'
import SourceDialog, { type SourceKind } from '@/components/SourceDialog'
import LookPicker from '@/components/LookPicker'
import LabelColorPicker from '@/components/LabelColorPicker'
import { ClickModeToggle, ShortcutsButton } from '@/components/SpeedControls'
import MinutesControl, { minutesText, plannedTotal } from '@/components/MinutesControl'
import ArrangeBar, { ArrangeButton } from '@/components/ArrangeBar'
import Onboarding from '@/components/Onboarding'
import { setItemNotes } from '@/components/ItemNotes'
import { useSmallSlides } from '@/lib/fitCheck'
import TextSlidesEditor from '@/components/TextSlidesEditor'
import { EmptyService } from '@/components/EmptyStates'
import { labelColor } from '@shared/labels'
import { BACKGROUNDS, BACKGROUND_NAMES, SECTION_COLORS } from '@/lib/defaults'
import { hasChords, transposeKey } from '@shared/chords'
import { audienceSlide, backgroundFor, itemLook, selectLiveSlide, slideBackground, useApp, usesMedia } from '@/store/useApp'
import { importDecks } from '@/lib/deck'
import { useModal } from '@/lib/modal'
import { t, tn, useT } from '@/i18n'

const KIND_ICON: Record<ItemKind, typeof Music> = {
  song: Music,
  scripture: BookOpen,
  blank: Square,
  web: Globe,
  camera: Video,
  deck: Presentation,
  section: Rows3,
  media: ImageIcon,
  text: TextQuote
}


/** "Video" or "Slideshow · 12 pictures · every 8 s". */
const mediaSubtitle = (it: ServiceItem): string =>
  it.slides[0]?.background?.kind === 'video'
    ? t('presentation.kindVideo')
    : [
        it.slides.length > 1 ? t('presentation.slideshow') : '',
        tn('presentation.pictureCount', it.slides.length),
        it.advance ? t('presentation.everySeconds', { n: it.advance.seconds }) : ''
      ]
        .filter(Boolean)
        .join(' · ')

const isSource = (it?: ServiceItem | null): boolean => it?.kind === 'web' || it?.kind === 'camera'

export default function PresentationTab() {
  const [styleOpen, setStyleOpen] = useState(false)
  const editingText = useApp((s) => s.editingTextId)
  return (
    <div className="flex min-h-0 flex-1">
      <ServiceOrder />
      <SlideArea styleOpen={styleOpen} toggleStyle={() => setStyleOpen((o) => !o)} />
      {styleOpen && <StylePanel onClose={() => setStyleOpen(false)} />}
      {editingText && <TextSlidesEditor key={editingText} />}
    </div>
  )
}

function ServiceOrder() {
  const { service, selectedItemId, selectItem, removeItem, moveItem, setTab, addSection } = useApp()
  const liveItemId = useApp((s) => s.live?.itemId)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const { t, tn } = useT()

  // Walk the list once: item numbers (sections are not counted), each item's section, and section sizes.
  const rows: { it: ServiceItem; i: number; n: number; section: ServiceItem | null }[] = []
  const groupSize = new Map<string, number>()
  const groupLive = new Set<string>()
  const groupMinutes = new Map<string, number>() // planned time per section
  const totalMinutes = plannedTotal(service.items)
  let section: ServiceItem | null = null
  let n = 0
  service.items.forEach((it, i) => {
    if (it.kind === 'section') section = it
    else {
      n++
      if (section) {
        groupSize.set(section.id, (groupSize.get(section.id) ?? 0) + 1)
        if (it.minutes) groupMinutes.set(section.id, (groupMinutes.get(section.id) ?? 0) + it.minutes)
        if (it.id === liveItemId) groupLive.add(section.id)
      }
    }
    rows.push({ it, i, n, section: it.kind === 'section' ? null : section })
  })

  const drag = (i: number): React.HTMLAttributes<HTMLDivElement> & { draggable: boolean } => ({
    draggable: true,
    onDragStart: () => setDragFrom(i),
    onDragOver: (e) => {
      e.preventDefault()
      setDragOver(i)
    },
    onDragEnd: () => {
      setDragFrom(null)
      setDragOver(null)
    },
    onDrop: () => {
      if (dragFrom !== null && dragFrom !== i) moveItem(dragFrom, i)
      setDragFrom(null)
      setDragOver(null)
    }
  })

  return (
    <section
      className="flex w-[280px] shrink-0 flex-col border-r border-line bg-panel"
      // Pictures and videos dropped from the computer: imported, then added (several pictures → one slideshow).
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDrop={async (e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        const paths = [...e.dataTransfer.files].map((f) => window.nl.media.pathFor(f)).filter(Boolean)
        const { added } = await useApp.getState().importMedia(paths)
        useApp.getState().addMediaToService(added)
        added.filter((m) => m.kind === 'deck').forEach((m) => useApp.getState().addDeckToService(m))
      }}
    >
      <div className="flex h-11 items-center justify-between pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="label-caps truncate" title={t('presentation.serviceOrder')}>
            {t('presentation.serviceOrder')}
          </span>
          <span className="rounded-full bg-accent-soft px-1.5 text-[10.5px] font-semibold text-accent-text">{n}</span>
          {totalMinutes > 0 && (
            <span className="whitespace-nowrap text-[11px] tabular-nums text-dim" title={t('presentation.plannedTotalHint')}>
              ~{minutesText(totalMinutes)}
            </span>
          )}
        </div>
        <div className="flex gap-0.5">
          <IconBtn title={t('presentation.addSong')} onClick={() => setTab('songs')}>
            <Music size={14} />
          </IconBtn>
          <AddMenu onSection={() => setEditing(addSection())} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {service.items.length === 0 && <EmptyService onSection={() => setEditing(addSection())} />}
        {rows.map(({ it, i, n: num, section: sec }) => {
          if (it.kind === 'section')
            return (
              <SectionRow
                key={it.id}
                item={it}
                count={groupSize.get(it.id) ?? 0}
                minutes={groupMinutes.get(it.id) ?? 0}
                hasLive={groupLive.has(it.id)}
                editing={editing === it.id}
                onEditing={(on) => setEditing(on ? it.id : null)}
                dropTarget={dragOver === i && dragFrom !== i}
                drag={drag(i)}
              />
            )
          if (sec?.collapsed) return null
          const Icon = KIND_ICON[it.kind]
          const selected = it.id === selectedItemId
          const isLive = it.id === liveItemId
          return (
            <div
              key={it.id}
              {...drag(i)}
              onClick={() => selectItem(it.id)}
              className={`group relative mb-0.5 flex cursor-pointer items-center gap-2 rounded-md py-2 pr-2 ${sec ? 'ml-2 pl-2' : 'px-2'} ${
                selected ? 'bg-panel-3' : 'hover:bg-panel-2'
              } ${dragOver === i && dragFrom !== i ? 'ring-1 ring-accent' : ''}`}
            >
              {sec && <span className="absolute -left-1 inset-y-0 w-0.5 rounded-full opacity-50" style={{ background: sec.color ?? SECTION_COLORS[0] }} />}
              {isLive && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-live" />}
              <GripVertical size={13} className="shrink-0 cursor-grab text-dim opacity-0 group-hover:opacity-100" />
              <span className="w-4 shrink-0 text-right text-[11px] text-dim">{num}</span>
              <Icon size={14} className={`shrink-0 ${isLive ? 'text-live' : 'text-accent-text'}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px]">{it.title}</div>
                <div className="truncate text-[11px] text-dim">
                  {it.kind === 'web'
                    ? t('presentation.kindWebsite')
                    : it.kind === 'camera'
                      ? t('presentation.kindCamera')
                      : it.kind === 'media'
                        ? mediaSubtitle(it)
                        : tn('presentation.slideCount', it.slides.length)}
                  {it.minutes ? <span className="tabular-nums"> · ~{minutesText(it.minutes)}</span> : null}
                </div>
              </div>
              {/* Hover tools float over the row's right end, so titles use the full width. */}
              <div
                className={`absolute inset-y-0 right-1 flex items-center gap-0.5 pl-1 ${
                  selected ? 'group-hover:bg-panel-3' : 'group-hover:bg-panel-2'
                }`}
              >
                <MinutesControl item={it} />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeItem(it.id)
                  }}
                  className="rounded p-1 text-dim opacity-0 hover:bg-live/15 hover:text-live group-hover:opacity-100"
                  title={t('common.remove')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}
        {service.items.length > 0 && !service.items.some((it) => it.kind === 'section') && (
          <button
            onClick={() => setEditing(addSection())}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line py-1.5 text-[11.5px] text-dim hover:border-accent/50 hover:text-accent-text"
          >
            <Rows3 size={12} className="shrink-0" /> <span className="truncate">{t('presentation.addSectionHeader')}</span>
          </button>
        )}
      </div>

      <BackgroundPicker />
    </section>
  )
}

/** A section header: fold/unfold, rename (double-click), color, delete. Dragging it moves the whole group. */
function SectionRow({
  item,
  count,
  minutes,
  hasLive,
  editing,
  onEditing,
  dropTarget,
  drag
}: {
  item: ServiceItem
  count: number
  minutes: number
  hasLive: boolean
  editing: boolean
  onEditing: (on: boolean) => void
  dropTarget: boolean
  drag: React.HTMLAttributes<HTMLDivElement> & { draggable: boolean }
}) {
  const { updateItem, removeItem } = useApp()
  const [draft, setDraft] = useState(item.title)
  const [colors, setColors] = useState(false)
  const { t } = useT()
  const color = item.color ?? SECTION_COLORS[0]
  useEffect(() => {
    if (editing) setDraft(item.title)
  }, [editing, item.title])
  const commit = (): void => {
    updateItem(item.id, { title: draft.trim() || item.title })
    onEditing(false)
  }
  return (
    <div
      {...drag}
      onClick={() => !editing && updateItem(item.id, { collapsed: !item.collapsed })}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onEditing(true)
      }}
      className={`group relative mb-0.5 mt-2 flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 first:mt-0 hover:bg-panel-2 ${dropTarget ? 'ring-1 ring-accent' : ''}`}
      title={t('presentation.sectionHint')}
    >
      <ChevronRight size={13} className={`shrink-0 text-muted transition-transform ${item.collapsed ? '' : 'rotate-90'}`} />
      <span className="h-3 w-1 shrink-0 rounded-full" style={{ background: color }} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') onEditing(false)
          }}
          className="h-6 min-w-0 flex-1 rounded bg-panel-3 px-1.5 text-[11.5px] font-semibold uppercase tracking-wider outline-none ring-1 ring-accent/50"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold uppercase tracking-wider" style={{ color }}>
          {item.title}
        </span>
      )}
      {hasLive && item.collapsed && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-live" title={t('presentation.liveInSection')} />}
      {minutes > 0 && (
        <span className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-dim" title={t('presentation.sectionTimeHint')}>
          ~{minutesText(minutes)}
        </span>
      )}
      <span className="shrink-0 rounded-full bg-panel-3 px-1.5 text-[10px] font-semibold text-muted">{count}</span>
      <div className="relative flex shrink-0 opacity-0 group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setColors((c) => !c)
          }}
          className="rounded p-1 hover:bg-panel-3"
          title={t('presentation.color')}
        >
          <span className="block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            removeItem(item.id)
          }}
          className="rounded p-1 text-dim hover:bg-live/15 hover:text-live"
          title={t('presentation.removeHeaderHint')}
        >
          <Trash2 size={12} />
        </button>
        {colors && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-full z-30 mt-1 flex gap-1 rounded-lg border border-line bg-panel-2 p-1.5 shadow-2xl"
          >
            {SECTION_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  updateItem(item.id, { color: c })
                  setColors(false)
                }}
                className={`h-5 w-5 rounded-full ring-2 ring-offset-1 ring-offset-panel-2 ${c === color ? 'ring-fg/60' : 'ring-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BackgroundPicker() {
  const background = useApp((s) => s.background)
  const setBackground = useApp((s) => s.setBackground)
  const media = useApp((s) => s.media)
  const setTab = useApp((s) => s.setTab)
  const { t } = useT()
  return (
    <div className="border-t border-line p-3">
      <div className="label-caps mb-2" data-guide="background">{t('presentation.background')}</div>
      <div className="grid grid-cols-6 gap-1.5">
        {BACKGROUNDS.map((b, i) => {
          const css = b.kind === 'color' || b.kind === 'gradient' ? b.value : '#000'
          const active = JSON.stringify(b) === JSON.stringify(background)
          return (
            <button
              key={i}
              onClick={() => setBackground(b)}
              title={t(BACKGROUND_NAMES[i])}
              aria-label={t(BACKGROUND_NAMES[i])}
              aria-pressed={active}
              className={`aspect-video rounded ring-1 ${active ? 'ring-2 ring-accent' : 'ring-line hover:ring-fg/30'}`}
              style={{ background: css }}
            />
          )
        })}
        {media
          .filter((m) => m.kind !== 'audio' && m.kind !== 'deck')
          .slice(0, 5)
          .map((m) => {
            const active = usesMedia(background, m)
            return (
              <button
                key={m.id}
                title={m.name}
                onClick={() => {
                  const bg = backgroundFor(m)
                  if (bg) setBackground(bg)
                }}
                className={`aspect-video overflow-hidden rounded bg-black ring-1 ${active ? 'ring-2 ring-accent' : 'ring-line hover:ring-fg/30'}`}
              >
                <MediaThumb m={m} />
              </button>
            )
          })}
        <button
          onClick={() => setTab('media')}
          title={t('presentation.mediaLibrary')}
          className="grid aspect-video place-items-center rounded bg-panel-2 text-muted ring-1 ring-line hover:text-fg"
        >
          <ImageIcon size={13} />
        </button>
      </div>
    </div>
  )
}

function SlideArea({ styleOpen, toggleStyle }: { styleOpen: boolean; toggleStyle: () => void }) {
  const state = useApp()
  const { service, selectedItemId, goLive, next, prev, aspect } = state
  const live = selectLiveSlide(state)
  const item = service.items.find((i) => i.id === selectedItemId) ?? live?.item ?? service.items.find((i) => i.kind !== 'section')
  const [cols, setCols] = useState(3)
  // Thumbnails are drawn with the item's look, so they match the audience screen.
  const look = itemLook(state, item)
  const small = useSmallSlides(item?.slides, look.style, aspect, item?.languageMode)
  const [labelPick, setLabelPick] = useState<{ label: string; x: number; y: number } | null>(null)
  const [arrangeOpen, setArrangeOpen] = useState(false)
  const canArrange = item?.kind === 'song' && !!item.sourceId && state.songs.some((x) => x.id === item.sourceId)
  const { t, tn } = useT()

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      {/* Header: the title always shows (row 1); item tools sit on a compact row under it, the rest in ⋯.
          Labels fold into icons as the area gets narrow (container queries: Text style panel open, 125% zoom). */}
      <div className="@container shrink-0 border-b border-line">
        <div className="flex h-10 items-center gap-2 pl-4 pr-3">
          {item && (() => {
            const Icon = KIND_ICON[item.kind]
            return <Icon size={15} className="shrink-0 text-accent-text" />
          })()}
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold" title={item?.title}>
            {item?.title ?? t('presentation.noItem')}
          </span>
          <div className="hidden shrink-0 @lg:block">
            <ClickModeToggle />
          </div>
          <button
            onClick={toggleStyle}
            title={t('presentation.textStyle')}
            className={`flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[12.5px] ${
              styleOpen ? 'bg-accent-fill text-on-accent' : 'bg-panel-2 text-muted hover:text-fg'
            }`}
          >
            <Type size={14} /> <span className="hidden @md:inline">{t('presentation.textStyle')}</span>
          </button>
        </div>
        {item && item.kind !== 'section' && (
          <div className="flex h-9 items-center gap-1 pb-1.5 pl-3 pr-3">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {item.kind === 'song' && item.sourceId && (
                <ToolBtn icon={Pencil} label={t('presentation.editSong')} onClick={() => state.openSongEditor(item.sourceId!)} />
              )}
              {item.kind === 'text' && <ToolBtn icon={Pencil} label={t('presentation.editSlides')} onClick={() => state.openTextEditor(item.id)} />}
              {canArrange && <ArrangeButton item={item} open={arrangeOpen} onToggle={() => setArrangeOpen((o) => !o)} />}
              {!isSource(item) && item.kind !== 'deck' && (
                <LookPicker compact scripture={item.kind === 'scripture'} value={item.templateId} onChange={(id) => state.setItemTemplate(item.id, id)} />
              )}
              {isSource(item) && <SourceControls item={item} />}
              {item.slides.some((sl) => hasChords(sl.text)) && <TransposeControl item={item} />}
              {item.slides.length > 1 && (
                <div className="hidden @sm:block">
                  <AutoAdvanceControl item={item} />
                </div>
              )}
              {item.kind === 'media' && item.slides[0]?.background?.kind === 'video' && <VideoEndControl item={item} />}
              {small.size > 0 && (
                <span
                  className="hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[11.5px] text-amber-300 @xl:flex"
                  title={t('presentation.smallTextHint')}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" /> {tn('presentation.smallTextCount', small.size)}
                </span>
              )}
            </div>
            <MoreMenu item={item} cols={cols} setCols={setCols} />
          </div>
        )}
      </div>
      {item && canArrange && arrangeOpen && <ArrangeBar item={item} />}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Onboarding />
        {item ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {item.slides.map((sl, i) => {
              const isLive = live?.item.id === item.id && live.index === i
              const isCued = state.clickMode === 'preview' && state.cue?.itemId === item.id && state.cue.index === i
              return (
                <button
                  key={sl.id}
                  onClick={() => (state.clickMode === 'preview' ? state.setCue(item.id, i) : goLive(item.id, i))}
                  onDoubleClick={() => state.clickMode === 'preview' && state.takeCue()}
                  className={`group relative overflow-hidden rounded-lg text-left ring-2 transition ${
                    isLive ? 'ring-live' : isCued ? 'ring-amber-400' : 'ring-transparent hover:ring-accent/60'
                  }`}
                >
                  <SlideView
                    slide={audienceSlide(sl, item)}
                    background={slideBackground(sl, item, look.background, state.mediaFit)}
                    style={look.style}
                    aspect={aspect}
                    logo={state.logo}
                    thumbnail
                    className={`${aspect === '16:9' ? 'aspect-video' : 'aspect-[4/3]'} w-full`}
                  />
                  {/* Number and live tag sit in the top row so they never cover the lyrics. */}
                  <span className="absolute left-2 top-2 flex items-center gap-1">
                    <span className="rounded bg-black/60 px-1.5 text-[11px] font-medium text-white/90">{i + 1}</span>
                    {isLive && (
                      <span
                        className={`whitespace-nowrap rounded px-1.5 py-px text-[10px] font-bold uppercase ${
                          state.rehearsal ? 'bg-amber-400 text-black' : 'bg-live text-white'
                        }`}
                      >
                        {state.rehearsal ? t('presentation.badgeRehearsal') : t('presentation.badgeLive')}
                      </span>
                    )}
                    {isCued && (
                      <span className="whitespace-nowrap rounded bg-amber-400 px-1.5 py-px text-[10px] font-bold uppercase text-black">
                        {t('presentation.badgePreview')}
                      </span>
                    )}
                    {small.has(sl.id) && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 ring-2 ring-black/50"
                        title={t('presentation.smallSlideHint')}
                      />
                    )}
                  </span>
                  {sl.label && (
                    <span
                      role="button"
                      title={t('presentation.labelColorHint')}
                      onClick={(e) => {
                        e.stopPropagation()
                        const r = e.currentTarget.getBoundingClientRect()
                        setLabelPick({ label: sl.label!, x: r.right - 224, y: r.bottom + 4 })
                      }}
                      className="absolute right-2 top-2 cursor-pointer rounded bg-accent-fill px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-on-accent hover:brightness-110"
                      style={{ background: labelColor(sl.label, state.labelColors) }}
                    >
                      {sl.label}
                    </span>
                  )}
                  {sl.notes && (
                    <span className="absolute bottom-2 right-2 rounded bg-black/60 p-0.5 text-white/80" title={sl.notes}>
                      <StickyNote size={11} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="grid h-full place-items-center text-muted">{t('presentation.emptyStart')}</div>
        )}
        {labelPick && <LabelColorPicker label={labelPick.label} at={labelPick} onClose={() => setLabelPick(null)} />}
      </div>

      <div className="relative flex h-14 shrink-0 items-center justify-center gap-4 border-t border-line">
        <ShortcutsButton className="absolute right-4" />
        <button
          onClick={prev}
          title={t('live.prevHint')}
          aria-label={t('live.prevHint')}
          className="grid h-9 w-14 place-items-center rounded-md bg-accent-fill text-on-accent hover:brightness-110"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="w-16 text-center text-[13px] tabular-nums text-muted">
          {live ? `${live.index + 1} / ${live.item.slides.length}` : '– / –'}
        </span>
        <button
          onClick={next}
          title={t('live.nextHint')}
          aria-label={t('live.nextHint')}
          className="grid h-9 w-14 place-items-center rounded-md bg-accent-fill text-on-accent hover:brightness-110"
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>
    </section>
  )
}

function AddMenu({ onSection }: { onSection?: () => void }) {
  const addBlank = useApp((s) => s.addBlank)
  const addDeck = useApp((s) => s.addDeckToService)
  const [open, setOpen] = useState(false)
  useModal(open, () => setOpen(false))
  const [dialog, setDialog] = useState<SourceKind | null>(null)
  const { t } = useT()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  const choose = (f: () => void): void => {
    setOpen(false)
    f()
  }
  return (
    <div ref={ref} className="relative">
      <IconBtn title={t('presentation.addToService')} onClick={() => setOpen((o) => !o)}>
        <Plus size={15} />
      </IconBtn>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-lg border border-line bg-panel-2 py-1 shadow-2xl">
          <MenuItem icon={Rows3} label={t('presentation.menuSection')} onClick={() => choose(() => onSection?.())} />
          <MenuItem
            icon={TextQuote}
            label={t('presentation.menuText')}
            onClick={() =>
              choose(() => {
                const s = useApp.getState()
                s.openTextEditor(s.addTextItem())
              })
            }
          />
          <MenuItem icon={Square} label={t('presentation.menuBlank')} onClick={() => choose(addBlank)} />
          <MenuItem
            icon={Presentation}
            label={t('presentation.menuDeck')}
            onClick={() => choose(async () => (await importDecks()).forEach(addDeck))}
          />
          <MenuItem icon={Globe} label={t('presentation.menuWeb')} onClick={() => choose(() => setDialog('web'))} />
          <MenuItem icon={Video} label={t('presentation.menuCamera')} onClick={() => choose(() => setDialog('camera'))} />
        </div>
      )}
      {dialog && <SourceDialog kind={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick }: { icon: typeof Music; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-panel-3">
      <Icon size={14} className="shrink-0 text-accent-text" /> {label}
    </button>
  )
}

const ADVANCE_PRESETS = [5, 8, 10, 15, 20, 30, 60]

/** Auto-advance for this item: seconds per slide, optionally looping back to the first slide. */
/** Video items: at the end, hold the last frame or go on to the next item (stored as auto-advance). */
function VideoEndControl({ item }: { item: ServiceItem }) {
  const setItemAdvance = useApp((s) => s.setItemAdvance)
  const { t } = useT()
  return (
    <select
      value={item.advance ? 'next' : 'hold'}
      onChange={(e) => setItemAdvance(item.id, e.target.value === 'next' ? { seconds: 1, loop: false } : undefined)}
      title={t('presentation.videoEndHint')}
      className="h-7 min-w-0 max-w-[220px] truncate rounded-md bg-panel-2 px-1.5 text-[12px] text-muted outline-none hover:text-fg"
    >
      <option value="hold">{t('presentation.videoEndHold')}</option>
      <option value="next">{t('presentation.videoEndNext')}</option>
    </select>
  )
}

function AutoAdvanceControl({ item }: { item: ServiceItem }) {
  const [open, setOpen] = useState(false)
  useModal(open, () => setOpen(false))
  const ref = useRef<HTMLDivElement>(null)
  const adv = item.advance
  const { t } = useT()
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={
          adv
            ? t(adv.loop ? 'presentation.advanceOnLoopHint' : 'presentation.advanceOnHint', { n: adv.seconds })
            : t('presentation.advanceOffHint')
        }
        className={`flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[12px] ${adv ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-panel-2 hover:text-fg'}`}
      >
        <Timer size={13} />
        {adv ? (
          <span>
            {t('presentation.secondsShort', { n: adv.seconds })}
            <span className="hidden @2xl:inline">{adv.loop ? ` · ${t('presentation.loopShort')}` : ''}</span>
          </span>
        ) : (
          <span className="hidden @3xl:inline">{t('presentation.autoAdvance')}</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-lg border border-line bg-panel-2 p-3 shadow-2xl">
          <AutoAdvancePanel item={item} />
        </div>
      )}
    </div>
  )
}

/** Seconds per slide and looping for one item (the Auto-advance popover, and the ⋯ menu on narrow windows). */
function AutoAdvancePanel({ item }: { item: ServiceItem }) {
  const setItemAdvance = useApp((s) => s.setItemAdvance)
  const adv = item.advance
  const pick = (seconds: number): void => setItemAdvance(item.id, seconds > 0 ? { seconds, loop: adv?.loop ?? item.kind !== 'song' } : undefined)
  const { t } = useT()
  return (
    <>
          <div className="label-caps mb-2">{t('presentation.nextSlideEvery')}</div>
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => pick(0)}
              className={`truncate rounded px-0.5 py-1.5 text-[12px] ${!adv ? 'bg-accent-fill text-on-accent' : 'bg-panel-3 text-muted hover:text-fg'}`}
            >
              {t('common.off')}
            </button>
            {ADVANCE_PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => pick(n)}
                className={`rounded py-1.5 text-[12px] tabular-nums ${adv?.seconds === n ? 'bg-accent-fill text-on-accent' : 'bg-panel-3 text-muted hover:text-fg'}`}
              >
                {t('presentation.secondsShort', { n })}
              </button>
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 text-[12px] text-muted">
            {t('presentation.custom')}
            <input
              type="number"
              min={1}
              max={3600}
              value={adv?.seconds ?? ''}
              placeholder={t('presentation.secPlaceholder')}
              onChange={(e) => pick(Math.max(0, Math.min(3600, Math.round(Number(e.target.value) || 0))))}
              className="h-7 w-20 rounded-md bg-panel-3 px-2 text-fg outline-none focus:ring-1 focus:ring-accent/50"
            />
            {t('presentation.secondsWord')}
          </label>
          <label className={`mt-3 flex items-center gap-2 text-[12.5px] ${adv ? '' : 'opacity-40'}`}>
            <input
              type="checkbox"
              disabled={!adv}
              checked={!!adv?.loop}
              onChange={(e) => adv && setItemAdvance(item.id, { ...adv, loop: e.target.checked })}
              className="accent-[var(--color-accent)]"
            />
            {t('presentation.loopLabel')}
          </label>
          <p className="mt-2 text-[11px] leading-snug text-dim">{t('presentation.advanceNote')}</p>
    </>
  )
}

/** Live transpose for this service only: changes the chords on stage screens, not the library song. */
function TransposeControl({ item }: { item: ServiceItem }) {
  const setItemTranspose = useApp((s) => s.setItemTranspose)
  const { t } = useT()
  const semis = item.transpose ?? 0
  const key = item.key ? transposeKey(item.key, semis) : null
  return (
    <div
      className={`flex shrink-0 items-center gap-0.5 rounded-md px-1 py-0.5 text-[12px] ${semis ? 'bg-amber-400/15 text-amber-300' : 'text-muted'}`}
      title={t('presentation.transposeHint')}
    >
      <Guitar size={13} className="mx-1 shrink-0" />
      <span className="hidden whitespace-nowrap @md:inline">{key ? t('presentation.keyName', { key }) : t('presentation.chords')}</span>
      <button onClick={() => setItemTranspose(item.id, semis - 1)} className="ml-1 rounded p-0.5 hover:bg-panel-2 hover:text-fg" title={t('presentation.semitoneDown')}>
        <Minus size={12} />
      </button>
      <span className="w-6 text-center tabular-nums">{semis > 0 ? `+${semis}` : semis}</span>
      <button onClick={() => setItemTranspose(item.id, semis + 1)} className="rounded p-0.5 hover:bg-panel-2 hover:text-fg" title={t('presentation.semitoneUp')}>
        <Plus size={12} />
      </button>
      {semis !== 0 && (
        <button onClick={() => setItemTranspose(item.id, 0)} className="ml-0.5 whitespace-nowrap rounded px-1 lowercase hover:bg-panel-2 hover:text-fg">
          {t('common.reset')}
        </button>
      )}
    </div>
  )
}

/** Sound toggle and edit for website / camera items. */
function SourceControls({ item }: { item: ServiceItem }) {
  const [editing, setEditing] = useState(false)
  const bg = item.background as Extract<Background, { kind: 'web' | 'camera' }>
  const toggleSound = (): void =>
    useApp.setState((s) => ({
      service: {
        ...s.service,
        items: s.service.items.map((it) => (it.id === item.id ? { ...it, background: { ...bg, muted: !(bg.muted ?? true) } } : it))
      }
    }))
  const soundOn = bg.muted === false
  const { t } = useT()
  return (
    <>
      <button
        onClick={toggleSound}
        title={t('presentation.soundHint')}
        className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] ${soundOn ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-panel-2 hover:text-fg'}`}
      >
        {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}{' '}
        <span className="hidden @md:inline">{soundOn ? t('presentation.soundOn') : t('presentation.muted')}</span>
      </button>
      <button
        onClick={() => setEditing(true)}
        title={t('common.edit')}
        className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] text-muted hover:bg-panel-2 hover:text-fg"
      >
        <Pencil size={12} /> <span className="hidden @md:inline">{t('common.edit')}</span>
      </button>
      {editing && <SourceDialog kind={item.kind as SourceKind} edit={item} onClose={() => setEditing(false)} />}
    </>
  )
}

/** Slide-grid toolbar button: icon, and its label when there is room. */
function ToolBtn({ icon: Icon, label, onClick }: { icon: typeof Music; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[12px] text-muted hover:bg-panel-2 hover:text-fg"
    >
      <Icon size={13} />
      <span className="hidden @lg:inline">{label}</span>
    </button>
  )
}

/** ⋯ menu of the slide-grid toolbar: team notes, slides per row, own background, and what doesn't fit when narrow. */
function MoreMenu({ item, cols, setCols }: { item: ServiceItem; cols: number; setCols: (n: number) => void }) {
  const setItemBackground = useApp((s) => s.setItemBackground)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(item.notes ?? '')
  useModal(open, () => setOpen(false))
  const { t } = useT()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) setDraft(item.notes ?? '')
  }, [item.id, item.notes, open])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  const hasNotes = !!item.notes?.trim()
  const ownBg = !!item.background && !isSource(item) && item.kind !== 'deck'
  const stageNotes = (item.kind === 'deck' || item.kind === 'song') && item.slides.some((sl) => sl.notes)
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        title={hasNotes ? t('presentation.moreNotesHint', { notes: item.notes! }) : t('presentation.moreHint')}
        className={`relative grid h-7 w-8 place-items-center rounded-md ${open ? 'bg-panel-2 text-fg' : 'text-muted hover:bg-panel-2 hover:text-fg'}`}
      >
        <MoreHorizontal size={16} />
        {(hasNotes || ownBg) && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1.5 max-h-[70vh] w-72 overflow-y-auto rounded-lg border border-line bg-panel-2 p-3 shadow-2xl"
          onKeyDown={(e) => {
            e.stopPropagation() // typing here must not trigger slide shortcuts
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          <div className="mb-3 border-b border-line pb-3 @lg:hidden">
            <div className="label-caps mb-1.5">{t('presentation.clickOnSlide')}</div>
            <ClickModeToggle />
          </div>
          {item.slides.length > 1 && (
            <div className="mb-3 border-b border-line pb-3 @sm:hidden">
              <AutoAdvancePanel item={item} />
            </div>
          )}
          <div className="label-caps mb-1.5 flex items-center gap-1.5">
            <NotebookPen size={11} /> {t('presentation.notesForTeam')}
          </div>
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setItemNotes(item.id, e.target.value)
            }}
            rows={3}
            placeholder={t('presentation.notesPlaceholder')}
            className="w-full resize-y rounded-md bg-panel-3 px-2.5 py-2 text-[12.5px] leading-snug outline-none placeholder:text-dim focus:ring-1 focus:ring-accent/50"
          />
          <p className="mt-1 text-[11px] text-dim">{t('presentation.notesPrinted')}</p>
          {stageNotes && (
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted">
              <StickyNote size={12} className="shrink-0" /> {t('presentation.slideNotesStage')}
            </p>
          )}
          {ownBg && (
            <button
              onClick={() => setItemBackground(item.id, undefined)}
              className="mt-3 flex w-full items-center gap-2 rounded-md bg-accent-soft px-2.5 py-1.5 text-left text-[12px] text-accent-text hover:bg-accent/25"
            >
              <ImageIcon size={13} className="shrink-0" /> {t('presentation.ownBackground')}
            </button>
          )}
          <div className="label-caps mb-1.5 mt-3">{t('presentation.slidesPerRow')}</div>
          <div className="flex rounded-md bg-panel-3 p-0.5 text-[12px]">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setCols(n)}
                className={`flex-1 rounded py-1 ${cols === n ? 'bg-accent-fill text-on-accent' : 'text-muted hover:text-fg'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="rounded p-1.5 text-muted hover:bg-panel-2 hover:text-fg">
      {children}
    </button>
  )
}
