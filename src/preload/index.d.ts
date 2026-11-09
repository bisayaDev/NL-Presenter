import type { NLApi } from './index'

declare global {
  interface Window {
    nl: NLApi
  }
}

export {}
