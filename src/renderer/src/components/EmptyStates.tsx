import { BookOpen, Globe, ListPlus, Loader2, Music, Plus, Rows3, Upload } from 'lucide-react'
import { setNewSongTitle } from '@/lib/guide'
import { useApp } from '@/store/useApp'
import { t as tr, useT, type StringKey } from '@/i18n'

/** A translated sentence with `{title}` replaced by a styled node (the words around it can move per language). */
function withTitle(key: StringKey, title: React.ReactNode): React.ReactNode {
  const [before, after = ''] = tr(key, { title: '\u0000' }).split('\u0000')
  return (
    <>
      {before}
      {title}
      {after}
    </>
  )
}

/** Service order with nothing in it. */
export function EmptyService({ onSection }: { onSection: () => void }) {
  const setTab = useApp((s) => s.setTab)
  const { t } = useT()
  return (
    <div className="mt-6 flex flex-col items-center gap-3 px-3 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent-text">
        <ListPlus size={18} />
      </div>
      <div className="text-[13px] font-medium">{t('service.empty.title')}</div>
      <div className="flex w-full flex-col gap-1.5">
        <button
          onClick={() => setTab('songs')}
          className="flex items-center justify-center gap-1.5 rounded-md bg-accent-fill py-1.5 text-[12.5px] font-semibold text-on-accent hover:brightness-110"
        >
          <Music size={13} /> {t('service.empty.addSong')}
        </button>
        <button
          onClick={() => setTab('scripture')}
          className="flex items-center justify-center gap-1.5 rounded-md border border-line py-1.5 text-[12.5px] text-muted hover:border-accent hover:text-accent-text"
        >
          <BookOpen size={13} /> {t('service.empty.addScripture')}
        </button>
        <button
          onClick={onSection}
          className="flex items-center justify-center gap-1.5 rounded-md border border-line py-1.5 text-[12.5px] text-muted hover:border-accent hover:text-accent-text"
        >
          <Rows3 size={13} /> {t('service.empty.addSection')}
        </button>
      </div>
    </div>
  )
}

/** Media library with nothing in it. */
export function EmptyMedia({ onImport, busy }: { onImport: () => void; busy: boolean }) {
  const { t } = useT()
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-line px-10 py-8 text-center text-muted">
        <Upload size={28} />
        <div className="text-[14px] font-medium text-fg">{t('service.empty.dropMedia')}</div>
        <button
          onClick={onImport}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md bg-accent-fill px-4 py-1.5 text-[13px] font-semibold text-on-accent hover:brightness-110 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {t('service.empty.import')}
        </button>
        <div className="text-[11.5px] leading-relaxed text-dim">{t('service.empty.formats')}</div>
      </div>
    </div>
  )
}

/** Songs search with no results: offer to create the song. */
export function NoSongMatch({ query, onSearchOnline }: { query: string; onSearchOnline?: () => void }) {
  const { t } = useT()
  const title = query.trim()
  if (!title) return <div className="py-10 text-center text-[13px] text-muted">{t('service.empty.noSongsYet')}</div>
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="text-[13px] text-muted">{withTitle('service.empty.noMatch', <span className="text-fg">“{title}”</span>)}</div>
      {onSearchOnline && (
        <button
          onClick={onSearchOnline}
          className="flex items-center gap-1.5 rounded-md bg-accent-fill px-3 py-1.5 text-[13px] font-semibold text-on-accent hover:brightness-110"
        >
          <Globe size={14} /> {t('songs.find.searchOnline', { title })}
        </button>
      )}
      <button
        onClick={() => {
          setNewSongTitle(title)
          useApp.getState().openSongEditor('new')
        }}
        className={
          onSearchOnline
            ? 'flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] text-muted hover:border-accent hover:text-accent-text'
            : 'flex items-center gap-1.5 rounded-md bg-accent-fill px-3 py-1.5 text-[13px] font-semibold text-on-accent hover:brightness-110'
        }
      >
        <Plus size={14} /> {t('service.empty.createSong', { title })}
      </button>
    </div>
  )
}
