import type { Template } from '@shared/types'
import { DEFAULT_STYLE } from './defaults'
import { t } from '@/i18n'

/**
 * Starter looks that ship with the app. They can be applied but not renamed or deleted. They are never saved
 * (items and songs store only the id), so `name` is a getter that reads the current UI language wherever it's shown.
 */
export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'builtin:classic',
    get name() {
      return t('style.builtin.classic')
    },
    builtin: true,
    style: { ...DEFAULT_STYLE }
  },
  {
    id: 'builtin:lower-third',
    get name() {
      return t('style.builtin.lowerThird')
    },
    builtin: true,
    style: {
      ...DEFAULT_STYLE,
      fontSize: 60,
      fontWeight: 700,
      uppercase: false,
      valign: 'bottom',
      marginY: 50,
      lineHeight: 1.15,
      shadow: false,
      textBg: 'full',
      textBgColor: '#000000',
      textBgOpacity: 0.6
    }
  },
  {
    id: 'builtin:clean',
    get name() {
      return t('style.builtin.clean')
    },
    builtin: true,
    style: {
      ...DEFAULT_STYLE,
      fontWeight: 600,
      uppercase: false,
      shadow: false,
      outline: 2,
      outlineColor: '#1a1a1a'
    }
  },
  {
    id: 'builtin:bold',
    get name() {
      return t('style.builtin.bold')
    },
    builtin: true,
    style: {
      ...DEFAULT_STYLE,
      fontSize: 112,
      fontWeight: 900,
      uppercase: true,
      letterSpacing: 0.02,
      lineHeight: 1.1,
      shadow: true,
      shadowStrength: 'strong'
    }
  }
]
