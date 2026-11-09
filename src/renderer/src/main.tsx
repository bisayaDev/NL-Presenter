import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { BrandLockup } from './components/BrandMark'
import { adoptOperatorLang, initPhoneLang, useT } from './i18n'
import LangPicker from './i18n/LangPicker'

// One bundle, several screens. Electron windows get their route from the main process;
// phones and tablets open http://<computer>:<port>/#/remote, #/stage or #/display.
const OperatorApp = lazy(() => import('./views/OperatorApp'))
const OutputApp = lazy(() => import('./views/OutputApp'))
const StageApp = lazy(() => import('./views/StageApp'))
const RemoteApp = lazy(() => import('./views/RemoteApp'))
const OverlayApp = lazy(() => import('./views/OverlayApp'))
const DisplayApp = lazy(() => import('./views/DisplayApp'))

const inElectron = typeof window.nl !== 'undefined'
const route = window.location.hash.replace(/^#\/?/, '') || 'operator'

// UI language. Operator: its saved setting (applied in useApp.hydrate). Output and stage windows: always the
// operator's (from the snapshot). Browsers (phones, tablets, OBS): own choice, else the operator's, else the browser's.
if (!inElectron) {
  initPhoneLang()
  // Landing page: no connection yet, so ask the computer for its language (used unless this device chose one).
  if (!['remote', 'stage', 'display', 'overlay'].includes(route))
    fetch('/lang')
      .then((r) => r.json())
      .then((j: { lang?: string }) => adoptOperatorLang(j.lang))
      .catch(() => {})
}
else if (route !== 'operator') {
  const follow = (s: { lang?: string } | null): void => adoptOperatorLang(s?.lang, true)
  window.nl.state.get().then(follow)
  window.nl.state.onSnapshot(follow)
}

function pick(route: string) {
  if (route === 'stage') return <StageApp />
  if (route === 'remote') return <RemoteApp />
  if (route === 'overlay') return <OverlayApp />
  if (route === 'display') return <DisplayApp />
  if (!inElectron) return <WebLanding />
  return route === 'output' ? <OutputApp /> : <OperatorApp />
}

function WebLanding() {
  const { t } = useT()
  const go = (r: string): void => {
    location.hash = `/${r}`
    location.reload()
  }
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-6 px-8">
      <BrandLockup size={52} />
      <div className="flex w-full max-w-xs flex-col gap-3">
        <button onClick={() => go('remote')} className="h-14 rounded-xl bg-accent-fill text-[15px] font-semibold text-on-accent">
          {t('remote.landing.remote')}
        </button>
        <button onClick={() => go('stage')} className="h-14 rounded-xl border border-line bg-panel text-[15px] font-semibold">
          {t('remote.landing.stage')}
        </button>
        <button onClick={() => go('display')} className="h-14 rounded-xl border border-line bg-panel text-[15px] font-semibold">
          {t('remote.landing.display')}
        </button>
        <LangPicker className="mt-3" />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{pick(route)}</Suspense>
  </StrictMode>
)
