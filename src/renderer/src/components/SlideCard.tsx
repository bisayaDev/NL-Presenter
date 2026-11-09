import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react'
import { useT } from '@/i18n'

/**
 * One slide in a slide editor (song editor, text slides editor): number, a label / title slot, move, duplicate and
 * delete, and the slide's fields below. An amber dot marks a slide whose text the projector shrinks a lot.
 */
export default function SlideCard({
  index,
  focused,
  small,
  onFocus,
  head,
  tools,
  onMove,
  onDuplicate,
  onDelete,
  children
}: {
  index: number
  focused: boolean
  small?: boolean
  onFocus: () => void
  /** Left of the header, after the number (label input…). */
  head?: React.ReactNode
  /** Right of the header, before move / duplicate / delete (notes button…). */
  tools?: React.ReactNode
  onMove: (d: -1 | 1) => void
  onDuplicate: () => void
  onDelete: () => void
  children: React.ReactNode
}) {
  const { t } = useT()
  return (
    <div onFocus={onFocus} className={`group rounded-lg border bg-panel p-3 ${focused ? 'border-accent/50' : 'border-line'}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex w-6 items-center gap-1 text-[12px] text-dim">
          {index + 1}
          {small && (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
              title={t('presentation.smallTextSplitHint')}
            />
          )}
        </span>
        {head}
        <div className="flex-1" />
        {tools}
        <div className="flex gap-0.5 opacity-50 group-hover:opacity-100">
          <CardBtn title={t('presentation.moveUp')} onClick={() => onMove(-1)}>
            <ArrowUp size={13} />
          </CardBtn>
          <CardBtn title={t('presentation.moveDown')} onClick={() => onMove(1)}>
            <ArrowDown size={13} />
          </CardBtn>
          <CardBtn title={t('presentation.duplicate')} onClick={onDuplicate}>
            <Copy size={13} />
          </CardBtn>
          <CardBtn title={t('presentation.deleteSlide')} onClick={onDelete} danger>
            <Trash2 size={13} />
          </CardBtn>
        </div>
      </div>
      {children}
    </div>
  )
}

function CardBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded p-1.5 text-muted ${danger ? 'hover:bg-live/15 hover:text-live' : 'hover:bg-panel-3 hover:text-fg'}`}
    >
      {children}
    </button>
  )
}

/**
 * Alt+Enter in a slide's text box: split the slide at the cursor. Returns the text before and after (trimmed of
 * the blank lines around the cut), or null when the cursor is at the very start or end.
 */
export function splitAtCursor(el: HTMLTextAreaElement): [string, string] | null {
  const a = el.value.slice(0, el.selectionStart).replace(/\s+$/, '')
  const b = el.value.slice(el.selectionEnd).replace(/^\s+/, '')
  return a && b ? [a, b] : null
}
