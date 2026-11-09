// Registry of every area file. Converters edit only their own area file, never this one.
// Keys are unique across areas because each starts with its area name (checked by `npm run i18n:check`).
import type { Entry } from '@shared/i18n-core'
import common from './common'
import topbar from './topbar'
import tabs from './tabs'
import live from './live'
import presentation from './presentation'
import songs from './songs'
import scripture from './scripture'
import media from './media'
import countdown from './countdown'
import stage from './stage'
import settings from './settings'
import service from './service'
import remote from './remote'
import network from './network'
import style from './style'

const ALL = {
  ...common,
  ...topbar,
  ...tabs,
  ...live,
  ...presentation,
  ...songs,
  ...scripture,
  ...media,
  ...countdown,
  ...stage,
  ...settings,
  ...service,
  ...remote,
  ...network,
  ...style
}

export type StringKey = keyof typeof ALL & string
export const STRINGS: Record<string, Entry> = ALL
