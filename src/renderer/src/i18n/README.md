# Translations (i18n)

13 languages: `en` (source), `tl` Tagalog, `es` Spanish, `pt` Portuguese (Brazil), `fr` French, `it` Italian, `ko` Korean,
`zh` Chinese (Simplified), `id` Indonesian, `hi` Hindi, `ta` Tamil, `ru` Russian, `uk` Ukrainian. No right-to-left yet.

| File | What |
| --- | --- |
| `src/shared/i18n-core.ts` | `LANGS`, `type Lang`, lookup/fallback, `{name}` interpolation, plurals (shared with main) |
| `src/renderer/src/i18n/index.ts` | `t`, `tn`, `useT`, language store, `formatTime`/`formatDate`/`formatDay`/`formatNumber`/`formatAgo` |
| `src/renderer/src/i18n/strings/<area>.ts` | One file per area: every key with all languages side by side |
| `src/renderer/src/i18n/strings/index.ts` | Registry. Already imports every area: **don't edit it** |
| `src/renderer/src/i18n/LangPicker.tsx` | Language select for phones/browsers (landing page, PIN screen) |
| `src/shared/i18n-main.ts` + `src/main/i18n.ts` | Main-process strings (`tm`, `tmn`): dialogs, notices, errors |
| `scripts/i18n-check.mjs` | `npm run i18n:check [-- <area> …] [--quiet]` |

## Using it

```tsx
import { useT, formatTime } from '@/i18n'

function Example({ n, name }: { n: number; name: string }) {
  const { t, tn } = useT()                       // re-renders on language change
  return <button title={t('service.menuHint')}>{tn('service.itemCount', n)} · {t('topbar.outputOn', { name })} · {formatTime(Date.now())}</button>
}
```

- Outside React (event handlers, `window.confirm`, lib code): `import { t, tn } from '@/i18n'`. Call it **when the text is
  needed**, never at module level: `const LABELS = [t('x')]` at the top of a file is frozen in the start-up language.
  Keep keys in constants instead (`{ id: 'every', key: 'settings.ccli.every' }`) and call `t(key)` at render.
- Keys are typed (`StringKey`): a typo is a type error. Keys built at runtime work when TypeScript can see the union
  (`` t(`tabs.${id}`) ``); otherwise cast to one real key (`` t(`settings.accent.${name}` as 'settings.accent.Blue') ``).
- Any component that renders text calls `useT()` (even just `useT()` with no destructuring) so it re-renders.
- Missing translation → English. Missing everywhere → the key itself, plus a console warning in dev.

## Adding strings

1. Open **your** area file (see the map below) and add keys starting with the area name:
   `'presentation.addSection': { en: 'Add section', tl: '…', es: '…', … }`. All 13 languages, one line per key or a few
   lines; keep keys grouped by component with a comment.
2. Key names: `area.thing` or `area.component.thing`, camelCase, describing the meaning (`songs.editor.deleteSlide`),
   not the English text. Tooltip = `…Hint`, placeholder = `…Placeholder`, confirm box = `confirm…`.
3. Reuse `common.*` (Cancel, Save, Delete, Close, Undo, On/Off, Default, Change…, Loading…). Only `common` and the
   area's owner edit an area file; if you need a new common word, add it to your own area instead (no shared edits).
4. Run `npm run i18n:check -- <area>`; it lists missing translations, placeholder mismatches and leftover English in
   files that import `@/i18n`. Put `// i18n-ignore` on a line that must stay English (or `{/* i18n-ignore */}` in JSX).

## Interpolation and plurals

- `{name}` placeholders: `t('topbar.outputOn', { name })`. Every translation must use the same placeholders as English
  (the check enforces it). Let the sentence order change around them; never build sentences by concatenating pieces.
- Plurals: give an object instead of a string and call `tn(key, count)`; `{count}` is filled in (locale-formatted).
  `{ one: '{count} song', other: '{count} songs' }`. Forms follow `Intl.PluralRules`: `ru`/`uk` need
  `one`, `few`, `many` (+ `other`); `ko`, `zh`, `id` only `other`; `tl` and `hi` usually the same word, so just `other`.
  A missing form falls back to `other`.
- Dates/times/numbers: `formatTime`, `formatDate`, `formatDay('2026-11-15')`, `formatNumber`, `formatAgo(ms)`; never
  `toLocaleTimeString([])` or `'en-GB'`. Note `lib/serviceDates.ts` `shortDate`/`datedName`/`baseName` build service
  **names** (content, parsed back by a regex): leave those English; use `formatDay` for display.

## What not to translate

- User content: song titles and lyrics, Bible text and book names from the Bible files, service and item names,
  section titles, media file names, chat messages, church name.
- Words people say as-is: Live (in Tagalog/Indonesian), OBS, PDF, CCLI, Stream Deck, PowerPoint, Keynote, LibreOffice,
  NLPresenter, key names (Enter, Space, ⌘), file extensions, "16:9".
- **Do** translate fixed labels shown on screens that aren't content: stage "Standing by", "NEXT", "left",
  overlay hints, "Waiting for operator…", countdown captions that the app writes.
- The HTTP control API (`/api/...`) error JSON stays English (for developers).

## Keep it short

UI space is tight: tab labels, segmented controls, the 4 live buttons (Prev/Hide/Black/Next, 10 px, ~70 px wide), menu
items and badges must not overflow. Prefer the shortest natural word a church volunteer would use (`Ant.`/`Sig.` is
fine for a tiny button; a tooltip can say it in full). Russian, Tamil, Hindi and French run 30–60 % longer than English;
Tamil is usually the longest — check it. Add `whitespace-nowrap`/`truncate`/`min-w-0` where a label could wrap, and
never use fixed widths sized for English text (`w-14` around "next 5s"). Uppercase via CSS (`uppercase`), not by
writing "LIVE" in the string.

## Selectors that used to rely on English

`lib/guide.ts` spotlights find controls for Onboarding/Sunday check. Use `data-guide="…"` or `data-tab-search="…"`
attributes, never `[title="…"]` or heading text. Existing: `data-guide="output-menu" | "remote" | "rehearse"`
(TopBar), `data-tab-search="songs"` (SongsTab), `.label-caps[data-guide="background"]` (PresentationTab, used as
`heading:background`). Keep these attributes when converting.

## Languages on other screens

- Operator window: setting `language` (Settings → Appearance → Language); default = OS language if supported, else
  English. Saved setting is applied in `useApp.hydrate` (`applySavedLang`).
- Electron output/stage windows follow the operator via `Snapshot.lang` (wired in main.tsx; published by OperatorApp).
- Phones/tablets/OBS (no preload): `localStorage['nl-lang']` (LangPicker on the landing page and PIN screen), else the
  operator's language from the WebSocket `welcome.lang` / `snap.lang`, else the browser language. PIN errors come with
  `denied.code` (`remote.pin.<code>`).
- Main process: `tm('main.…')` reads the `language` setting on every call, so dialogs switch at once.

## File → area ownership

Each UI file belongs to exactly one area; only that area's converter edits it and `strings/<area>.ts`.
Status: ✅ converted, ⬜ to do.

- **common** — `strings/common.ts` only (shared words). ✅
- **topbar** — `TopBar.tsx` ✅, `OperatorApp.tsx` ✅, `RehearsalBar.tsx` ⬜, `AudioPlayer.tsx` ⬜, `BrandMark.tsx` (no text)
- **tabs** — `TabBar.tsx` ✅
- **live** — `LiveSidebar.tsx` ✅, `CuePreview.tsx` ✅, `ServiceTimers.tsx` ✅, `VideoTransport.tsx` ⬜
- **presentation** — `PresentationTab.tsx`, `ArrangeBar.tsx`, `LookPicker.tsx`, `ItemNotes.tsx`, `TextSlidesEditor.tsx`, `SlideCard.tsx`, `SourceDialog.tsx`, `SpeedControls.tsx`, `MinutesControl.tsx`, `LabelColorPicker.tsx` ✅; also default titles in `store/useApp.ts` ("New section", "Untitled look") — the only area allowed to touch `useApp.ts` strings
- **songs** — `SongsTab.tsx`, `SongEditor.tsx`, `UsageReport.tsx`, `ChordText.tsx` ⬜
- **scripture** — `ScriptureTab.tsx`, `BibleLibrary.tsx`, `PassageList.tsx` ⬜
- **media** — `MediaTab.tsx`, `MediaThumb.tsx`, `DeckProgress.tsx`, `LoopView.tsx` ⬜; `lib/deck.ts` (progress/error text)
- **countdown** — `CountdownTab.tsx` ⬜; `lib/time.ts` (clock text); the default title in `DEFAULT_COUNTDOWN` (`store/useApp.ts`, that one line)
- **stage** — `StageTab.tsx`, `StageView.tsx`, `StageApp.tsx`, `StageExtras.tsx`, `CaptionPanel.tsx`, `CaptionLayer.tsx`, `TickerPanel.tsx`, `TickerLayer.tsx`, `BroadcastPanel.tsx`, `OverlayView.tsx`, `OverlayApp.tsx`, `DisplayApp.tsx`, `OutputApp.tsx`, `SlideView.tsx`, `FitText.tsx` ⬜
- **settings** — `SettingsDialog.tsx` ✅, `SettingsExtras.tsx` ✅
- **service** — `ServiceMenu.tsx` ✅, `PrintDialog.tsx`, `PreflightDialog.tsx`, `Onboarding.tsx`, `EmptyStates.tsx`, `ResumeBanner.tsx`, `QuickKeys.tsx`, `CommandPalette.tsx` ⬜; `lib/printSheet.ts`, `lib/serviceDates.ts` (`agoText` only), `lib/guide.ts`
- **remote** — `RemoteApp.tsx` (PIN screen ✅, rest ⬜: the check already flags its leftover labels), `main.tsx` (phone landing) ✅, `i18n/LangPicker.tsx` ✅
- **network** — `NetworkPanel.tsx`, `ChatButton.tsx` ⬜
- **style** — `StylePanel.tsx` ✅; `lib/templates.ts` ✅ (built-in look names are getters)
- **main** (main process) — `src/shared/i18n-main.ts`, all `src/main/*.ts` ✅
