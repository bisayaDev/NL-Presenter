import { BookOpen, Image, LayoutGrid, Music, Timer, Tv } from 'lucide-react'
import type { ComponentType } from 'react'
import { useApp, type Tab } from '@/store/useApp'
import { useT } from '@/i18n'
import { isMac } from './CommandPalette'

/** Labels are the keys `tabs.<id>` (translate at render time: `t(`tabs.${id}`)`). */
export const TABS: { id: Tab; icon: ComponentType<{ size?: number }> }[] = [
  { id: 'presentation', icon: LayoutGrid },
  { id: 'songs', icon: Music },
  { id: 'scripture', icon: BookOpen },
  { id: 'media', icon: Image },
  { id: 'countdown', icon: Timer },
  { id: 'stage', icon: Tv }
]

export default function TabBar() {
  const tab = useApp((s) => s.tab)
  const setTab = useApp((s) => s.setTab)
  const { t: tr } = useT()
  return (
    <nav className="flex h-10 shrink-0 items-stretch gap-1 border-b border-line bg-panel px-3">
      {TABS.map((t, i) => {
        const active = t.id === tab
        const Icon = t.icon
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            title={`${isMac ? '⌘' : 'Ctrl+'}${i + 1}  ·  F${i + 1}`}
            className={`relative flex items-center gap-2 px-3 text-[13px] transition-colors ${
              active ? 'text-fg' : 'text-muted hover:text-fg'
            }`}
          >
            <span className={active ? 'text-accent-text' : ''}>
              <Icon size={15} />
            </span>
            <span className="whitespace-nowrap">{tr(`tabs.${t.id}`)}</span>
            {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        )
      })}
    </nav>
  )
}
