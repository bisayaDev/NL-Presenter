# NLPresenter

Worship presentation app for macOS and Windows (Electron + React + TypeScript). It runs offline, costs nothing,
and needs no account or license key.

> **For internal / personal use only. Not for public distribution.** Bible translations you import yourself are your
> responsibility: only import texts you have the right to use. The built-in Bibles and the translation library contain
> public-domain and openly licensed texts only.

## Run

```bash
npm install
npm run dev          # operator window; "Open Output" sends slides to a second display
npm run typecheck
npm run dist:mac     # .dmg (arm64 + x64)
npm run dist:win     # .exe (NSIS)
```

## Structure

```
src/main/       Electron main process: windows, displays, output window, IPC
src/preload/    Safe bridge exposed to the UI as window.nl
src/shared/     Types and IPC channel names shared by every process
src/renderer/   React UI (one bundle; routes #/operator, #/output, #/stage, #/remote, #/overlay, #/display)
  components/SlideView.tsx   The renderer for slides. Preview, thumbnails and projector all use it
  store/useApp.ts            App state (zustand); loads from and saves to SQLite through IPC
  views/ScriptureTab.tsx     Bible browser and search
  views/SongEditor.tsx       Song editor (slide cards or "edit all as text")
src/main/db.ts    SQLite schema and queries        src/main/zefania.ts   Bible XML parsers
src/shared/bible.ts  Book list, reference parser
scripts/build-bibles.cjs  Rebuilds the bundled Bibles from eBible.org files
```

## Data

- The app keeps its data on this computer in SQLite (Node's built-in `node:sqlite`, so you compile no native modules per platform):
  `<userData>/nlpresenter.db`. Set `NL_DB_FILE=/path/to.db` to use another file.
- The app saves songs, the service and settings (aspect, style, background, translation) as you edit.
- Bibles: the app ships KJV, ASV and Tagalog ULB (`resources/bibles/`, see [SOURCES.md](resources/bibles/SOURCES.md))
  and installs them on first run. You can import more from XML files (**Zefania**, or the simple
  `<bible><book number><chapter number><verse number>` format; several files at once) from the translation picker.
  Verse search uses SQLite FTS5.

## Scripture tab

Search by reference (`jn 3:16-18`, `1 cor 13`, `ps 23 1-3`, `Jude 3`, or a local book name such as `Juan 3:16` for imported
Bibles) or by words (`loved the world`). Click a verse to select it, Shift+click for a range, Ctrl/⌘+click for several.
Double-click or Enter shows the verses live; "Add to service" adds them to the service order.

- **Verses per slide** (1–4 or All) groups the selection; multi-verse slides get small superscript verse numbers
  (switch off with "Verse numbers").
- **Compare** picks up to two more translations (the "+ another" select adds a third column): the verse list shows
  them under each verse, and slides show all of them, each with its own reference, **side by side or stacked**
  (toolbar toggle) on the projector, stage screens (always side by side) and the OBS overlay. Setting `scripture`:
  `parallelIds`, `parallelLayout` (older `parallelId` is read once). `Slide.parallel` is now a list; older saved
  services with the single-object shape are read through `parallelOf()` (`shared/bible.ts`).
- **Recent and pinned** (under the book list): the last 30 passages shown live or added (newest first, with
  translation), and ☆ pins that stay. Click shows live (the app fetches the verses again with the current Verses per slide,
  numbers and Compare options); + adds to the service. Pin the selection with ☆ in the bottom bar. The phone remote's
  Bible view lists pins; tapping one sends command `{ type: 'pin', id }`. Settings `scriptureHistory`, `scripturePins`;
  code `lib/passages.ts`, `components/PassageList.tsx`.

**Translation library** (translation picker → "Browse translation library…") lists the free, redistributable translations
from eBible.org's catalogue (about 1,300 in 1,000+ languages), searchable by name or language. Install downloads the
text (`<id>_vpl.zip`) and the book names in that language (`BookNames.xml` from `<id>_usfx.zip`), so "Juan 3:16" works.
The list is cached next to the database (`bible-catalog.csv`, refreshed weekly) so it opens offline. Code:
`src/main/bibleLibrary.ts`, `src/renderer/src/components/BibleLibrary.tsx`.

## Media, text style and logo

- **Media tab:** import images (JPG, PNG, GIF, WebP, AVIF, BMP) and videos (MP4, WebM, MOV) with Import or drag and drop.
  Import copies files into `<userData>/media/` and lists them in SQLite, so you can move the originals.
  Use one as the **default background**, as the background of **one service item**, or (images) as the **logo**.
  Videos can loop and play sound. Deleting a file resets anything that used it.
- **Linked folders** (Media tab → *Link folder…*): pictures and videos in a folder (and up to 3 subfolder levels) are
  listed without copying, marked "linked"; *Refresh* (also run when the Media tab opens) picks up new files and flags
  missing ones (moved file, unplugged drive). Ref `media/linked-<id>.<ext>`: `mediaPath()` resolves it only to a listed
  file inside a still-linked folder, so `nlmedia://`, the LAN `/media/` route and the Sunday check all work and nothing
  else on disk can be reached (`src/main/linkedMedia.ts`). Stored in the `linkedMedia` setting, so backups keep only
  the paths. Removing a linked file from the library never deletes it. Every file has *Show in Finder/Explorer*.
- **Text style** (Presentation tab → *Text style*): font (installed fonts when the OS allows, otherwise a common
  list), size, weight, color, horizontal and vertical alignment, side and top/bottom margins, line height, letter
  spacing, uppercase, italic. **Effects:** shadow (soft/medium/strong), outline and glow (strength + color), and a text
  background behind each line, as one block, or as a full-width band (color + opacity). Effects also apply to the OBS
  overlay. Changes show live on all screens (`src/renderer/src/lib/textEffects.ts`).
- **Templates (looks):** a named text style plus an optional background. Text style panel → *Templates*: apply one
  to the global style, *Save as template…* (with or without the current background), rename, delete. Built-ins
  (Classic, Lower third, Clean, Bold; `src/renderer/src/lib/templates.ts`) can't be deleted. Pick a look per song
  (Song editor → *Template*; copied onto the service item when the song is added) or per service item (slide grid
  header → *Look*). Drawing order: item look > song look > global style; background: slide's own > item's own >
  look's > default. Thumbnails, Up Next and the live preview use the same look. Saved in setting `templates`
  (included in backups with the other settings).
- **Label colors:** slide labels are colored by name (Verse violet, Chorus blue, Pre-Chorus teal, Bridge amber,
  Tag/Ending rose, Intro/Outro gray; "Verse 1" and "Verse 2" share "Verse"). Click a label badge in the slide grid to
  change it. Used in the slide grid, song editor, live sidebar and phone remote (`src/shared/labels.ts`, setting
  `labelColors`).
- **Auto-advance** (slide grid header → *Auto-advance*): per service item, next slide every 5–60 s or a custom time,
  with or without looping. Runs only while that item is live; Next/Back restarts the timer; a blacked-out or hidden screen
  stays that way. The live panel shows the time to the next slide.
- **Logo:** corner, size and opacity in the same panel. It's drawn on the audience screen and its previews.
  *Also show on stage screens* puts it small in the stage's top-left corner. Code: `components/BrandMark.tsx`
  (vector mark); `build/icon.png` is the app icon, made from the same shape.
- **Transitions** (Text style panel → *Transition*): Cut, Fade (default, 0.4 s), Rise (fade + text rises in) or Zoom,
  0.1–1.5 s. One global setting (`transition`), sent in `LiveFrame.transition` / `OverlayFrame.transition`. Used by the
  audience screen, wireless screens and the OBS overlay (fade-in only there); thumbnails and operator previews cut.
  `SlideView` keeps the old and new text layers while they animate. Backgrounds crossfade only when the background
  itself changes (compared by src/url/id/value), so a video or loop keeps playing across slides. Reduced-motion
  systems get plain fades.
- **Pictures and videos as service items:** in the Media tab, ⌘/Ctrl-click (or Shift-click) several pictures or videos →
  *Add to service*, or drop the files on the service order. Several pictures become one *Slideshow* item (kind
  `media`, one letterboxed slide per picture, every 8 s, looping). Each video becomes a *Video* item that plays once
  with sound and holds its last frame; set *At the end: next item* in the slide grid header to move on by itself.
- **Video controls:** when the live background is a video, the live panel shows play/pause, start over, a scrub bar
  with time left, sound and loop. Playback is `LiveFrame.video` (`startedAt` + `offset`); every screen seeks when it
  drifts more than 0.5 s (wireless screens use the server clock). The phone remote shows thumbnails for these slides.
- Electron windows load media through the `nlmedia://` protocol; phones load `/media/<file>` from the LAN server,
  with HTTP Range support for video.

## Appearance

- **Settings → Appearance:** interface size (80–125%) for small laptop screens, and an accent color (presets or a
  custom color). Both are saved and apply to the operator window only; output, stage and phone pages don't change.
- Ctrl/⌘ + `=` / `-` / `0` steps the interface size (bigger, smaller, back to 100%).

## Languages

- The interface comes in English, Tagalog, Spanish, Portuguese (Brazil), French, Italian, Korean, Chinese (Simplified),
  Indonesian, Hindi, Tamil, Russian and Ukrainian. **Settings → Appearance → Language** (setting `language`) applies
  at once; the default is the computer's language when supported, else English. Native dialogs follow it too.
- Output and stage windows follow the operator. Phones, tablets and OBS pages pick a language on the landing page or
  PIN screen (saved in that browser); otherwise they follow the operator's language, else the browser's.
- Only the app's own labels are translated: songs, Bible text, service and item names stay as entered.
- Developers: see `src/renderer/src/i18n/README.md`; `npm run i18n:check` lists missing translations.

## Services, printing and song usage

- **Service library**: the service name in the top bar opens a menu of every saved service (newest date first, then
  last changed). *New service* makes an empty "Sunday Service – <next Sunday>"; *Copy for next week* copies the
  order with fresh ids, songs re-read from the library and live transpose reset. Rename, set the date, or delete
  (deleting the open one opens the next, or a new empty one). Switching while something is live asks
  "Clear the screen and switch?"; switching is blocked during rehearsal. The app reopens the last service you had
  open (setting `currentServiceId`). Services have a `date` column (`YYYY-MM-DD`), included in backups.
- **Print / PDF…** (same menu): *Run sheet* (numbered items, section headers, key after live transpose, slide count,
  item notes), *Lyrics* (run sheet + all words), *Chord charts* (run sheet, then one song per page with chords above
  the words in tonight's key, Standard or Nashville). The page is built in `lib/printSheet.ts`; `main/print.ts` loads it
  in a hidden window and uses `printToPDF` (save dialog) or the system print dialog. The header shows the
  *Church name* from Settings (setting `churchName`). Item notes are typed in the slide-grid toolbar's **⋯** menu
  (`components/ItemNotes.tsx` `setItemNotes`; team only, never on screens). The slide-grid header keeps the title on
  its own row; item tools sit on a compact row below and fold to icons when narrow (Tailwind container queries); notes,
  slides per row and "use the default background" are in ⋯.
- **Sunday check…** (same menu; also opens by itself on the first Rehearse of each day, setting `preflightDay`):
  missing media files (`media:check` IPC, also returns free disk space), items with no slides, projector found /
  output open, phone sharing off when remotes or stage tablets were used before (setting `netUsedBefore`), free disk
  under 1 GB, planned time over 90 min. Fix-it buttons where possible (`components/PreflightDialog.tsx`).
- **First-run checklist** on the Presentation tab (`components/Onboarding.tsx`, setting `onboarding`
  `{done, dismissed}`): projector, add a song, background, phone remote, rehearse. Steps tick themselves; "Show me"
  switches tab and highlights / opens the control (`lib/guide.ts`). Empty states for an empty service, an empty media
  library and a song search with no results ("Create 'xyz' as a new song" prefills the editor title).
- **Song usage**: the first time a library song goes live in a service on a day, the app logs it in `song_usage`
  (never during rehearsal). The Songs tab shows "Last used 3 weeks ago", sorts by Last used / Most used, and has a
  *Usage report* (3/6/12 months or custom dates; Export CSV).

## Service order sections

Presentation tab → **+** → *Section header* (or "Add a section header" under the list) adds a header such as
"Opening" or "Praise & Worship" after the selected item. Items below a header belong to it until the next header.
Click a header to fold it (a red dot shows when the live item is inside), double-click to rename, pick one of seven
colors, or remove it (the items stay). Dragging a header moves its whole group. Sections are `kind: 'section'` service
items with no slides, so Next/Back and Up Next skip them; the live panel's Service flow and the phone remote show them.

## Timers, song arrangement and slide notes

- **Planned length:** hover a service order row → clock icon → minutes (`ServiceItem.minutes`). Shown as "~5 min" under
  the title; the header shows the service total and each section header its subtotal.
- **Timers** (live panel footer): clock · *Service* (starts at the first go-live of the day; click to restart from now;
  survives a restart the same day via the `serviceStartedAt` setting) · *Item* (time on the live item; amber past its
  planned length). Rehearsal doesn't touch either timer: they follow what the screens show. Stage & OBS → *Show service
  timer* puts the service time beside the stage clock (`StageFrame.serviceStartedAt`).
- **Arrange** (slide grid header, songs from the library): section chips built from the slide labels (consecutive
  slides with the same label). Drag to reorder, + repeats a section, × removes it, *Add* appends one, *Reset to song
  order*. This service only (`ServiceItem.arrangement`, labels in order; src/renderer/src/lib/arrangement.ts). The app
  rebuilds the slides from the library song when you add, edit or copy it for next week; repeats get ids like `<id>~2`.
  It drops labels the song no longer has and marks the button with an amber dot.
- **Notes for stage** on song slides: Song editor → note icon on a slide. Saved with the song (slides are JSON in the
  database), copied to service items, and shown on stage screens in a small band under the lyrics. *Edit all as text*
  keeps notes on slides whose lyrics match.

## Presentations (PDF, PowerPoint, Keynote)

Presentation tab → **+** → *Presentation*, or drop the file on the Media tab. Every page becomes a picture at
projector size (1920 × 1080 box, letterboxed in black), so it looks the same on every screen and phone.

- **PDF** needs no conversion (pdf.js draws it, with fonts and Asian character maps included).
- **PowerPoint / Keynote / OpenDocument**: the app first converts the file to PDF with a program on the computer.
  Windows tries PowerPoint, then LibreOffice; macOS tries LibreOffice, then Keynote (Keynote files go to Keynote
  first). If none is installed, the app tells you; save the file as PDF yourself and import that.
- **Speaker notes** from .pptx files show on stage screens next to the page (hidden slides are skipped, as the
  export skips them).
- The media library keeps presentations (*Presentations* filter); add one to the service as often as you need.
  Deleting it removes it from the service order too. Backups include them.
- Test hook: `NL_TEST_CONVERT_PDF=/file.pdf` stands in for the office program.

## Crash-safe resume and projector reconnect

- The live position (setting `session`) and where the outputs are (`sessionOutputs`, written by main) are saved as they change. A normal quit sets `cleanExit`; at startup main turns a missing one into `lastExitUnclean`.
- After a crash (or force quit, power loss, or the dev snapshot's `app.exit`), a banner offers "Resume where you left off: <item>, slide N · Output on <display>". Resume goes live there and reopens the outputs on the same display (by id, then name and size). No offer if the item is gone. If another service is loaded, the banner names the crashed service and Resume opens it first (refused during rehearsal).
- Display unplugged: the output closes but stays wanted ("Output lost", red dot on the output button, toast with "Stop waiting for it"). When that display (or one with the same name and size) comes back, the output reopens there by itself ("Projector reconnected") without taking focus. Outputs the operator closed never reopen.
- An output page that crashes, or freezes for 3 s, is reloaded and reads the current picture again (`state:get`); after 3 restarts in a minute it stops and tells the operator. A crashed operator page is reloaded and offers to resume.
- Code: `src/shared/outputs.ts` holds the reconnect and resume rules as pure functions.

## Rehearsal mode

**Rehearse** in the top bar: click through the whole service while every screen, the OBS overlay and phones
keep what they showed when rehearsal began. Phone remote commands pause. *Stage screens follow* lets the band
practise with lyrics and chords on stage while the projector stays put. **End rehearsal** returns you to what
the screens show. The app keeps song and service edits you make while rehearsing.

## Chords for musicians

- **Writing chords:** inline in the lyrics, before the syllable they fall on: `[G]Amazing [C]grace`.
  - Complex and slash chords work (`Bbmaj9`, `F#m7b5`, `C6/9`, `D/F#`), and so do Nashville numbers (`[1] [4] [6m] [b7] [5/7]`).
  - A line with only chords (`[G] [C] | [D] x2`) is an instrumental line.
  - The parser reads `[Chorus]` and other section names as headings.
- **Song editor:**
  - Key picker, and Transpose −/+ (rewrites the chords and the key, spelled for the new key).
  - A chord palette with the key's chords (ABC or 123). It inserts at the cursor, and typing `[` highlights it.
  - Pasting a chord sheet (chords on the line above the words) converts it to inline chords. A `Key: B` line sets the key.
  - `.txt` import and export read and write `Key:` too.
  - **Tempo:** BPM (30–300, with *Tap* to tap it in) and time signature (4/4, 3/4, 6/8, 2/4, 12/8) next to the key
    (`Song.bpm` / `Song.timeSignature`, columns `bpm` / `time_signature`; copied to service items like the key). Used
    by the stage beat pulse and the metronome (see Stage display).
- **Live transpose:** Presentation tab → the guitar control on a song with chords. It applies to this service only and
  changes the stage chords; the library song is untouched.
- **Where chords show:** stage screens only. Stage & OBS tab → *Chords*: Off / Standard / Nashville. Each wireless stage
  tablet can choose its own setting (guitar button in the corner).
  - Chords are stripped from the audience screen, OBS overlay, wireless audience screens, the phone remote and the
    operator previews; instrumental slides show no text there.
- **Code:** `src/shared/chords.ts` (parser, transposer, Nashville, chord-sheet converter), `components/ChordText.tsx`.

## Background loops

Animated, lyric-safe backgrounds drawn with CSS: no video file, little CPU. **Media tab → Import** (or
drag and drop) a `.json` loop pack; they appear under the **Loops** filter with their category and tags, and work like
any background: default, per item, behind the countdown. Reads G-Presenter loop packs
(`format: "g-presenter-background-loop-pack"`: the `loops` array, or the `custom-gradient-loop://` URLs in `media`),
a bare array of loops, or a single loop. Import sanitises colours and numbers and skips duplicates (same id); full
backups include the loops. Code: `src/shared/loops.ts` (format + sanitiser), `components/LoopView.tsx`.

## Websites, vdo.ninja and cameras

Presentation tab → **+** → *Website / vdo.ninja* or *Camera / capture device*. Use one as its own service item, behind
the lyrics of the selected item, or as the default background (also behind the countdown).
- Websites render at the projector resolution in a locked-down `<webview>` (own session, every permission denied, no
  popups, http(s) only), so sites that refuse to be framed still show. Wireless screens use an iframe.
- Cameras use the webcam, USB camera or capture card on this computer (macOS asks for camera access once). Phones
  and wireless screens show a placeholder instead.
- Sound (off by default) plays on the audience screen and stays muted in the operator previews. Video backgrounds
  with sound follow the same rule.

## Music player

Top bar → ♫. Floating, draggable, collapsible player with playlist (drag to reorder), previous/next, seek, repeat
(all / one), shuffle and volume. Songs come from the media library (MP3, M4A, AAC, WAV, OGG, Opus, FLAC; import from
the player or the Media tab). Plays through this computer's sound output; the playlist is remembered.

## Wireless audience screens

Open Output's ▾ menu → *Wireless audience screens*: any TV, laptop or tablet browser on the network can open
`http://<computer-ip>:4777/#/display` and mirror the projector (read-only, no PIN, no limit). The first tap goes full
screen and lets the browser play sound.

## Chat with remotes

Phone remotes have a **Chat** tab (with an optional name, e.g. "Pastor"). Messages pop up next to the chat icon in the
top bar; the operator can reply. History lasts for the current sharing session.

## Backup, restore and song files

- **Settings (gear) → Full backup / Restore.** One `.nlbackup` file holds songs, services, settings, imported Bibles,
  background loops and the media library (gzip: header line + JSON + media bytes, streamed both ways). Restore adds what's missing and
  skips duplicates: songs by id or identical title + lyrics, Bibles by id or name, media by id, services by id.
- **Automatic backups** (on by default; Settings → Backup & restore): once a day while open and on quit, into
  `<userData>/autobackups/` (or a chosen folder) as `NLPresenter-auto-<date>_<time>.nlbackup`; keeps the newest 10.
  Skipped when nothing changed (`backupFingerprint()` in `src/main/backup.ts`), while one is running, or under 1 GB free
  (warning shown). Quit waits for it (max 2 min). Sunday check warns when the last one is over 7 days old.
  Code: `src/main/autoBackup.ts`; settings `autoBackup*` (restore leaves them alone).
- **Songs tab → Import / Export.** Export writes the songs in the current list (search and tag filters apply), one
  `.txt` each. Format: optional `Title:`, `Author:`, `Tags:`, `Key:`, `Copyright:`, `CCLI:`, `Tempo:` (or `BPM:`), `Time:` lines, a blank line, then
  lyrics with `[Section]` headings. Import also reads ChordPro (`.cho`, `.chordpro`, `.chopro`, `.crd`, `.pro`, with
  chords, `{tempo: 72}`, `{time: 3/4}`) and SongSelect downloads (lyrics `.txt`, `.usr`). Code: `src/renderer/src/lib/songImport.ts`.
- **Songs tab → Find a song** (also offered when a search finds nothing): searches [LRCLIB](https://lrclib.net), a free
  lyrics database (no key; lyrics only, no chords), from the main process (`src/main/songSearch.ts`, results ranked by
  title match, remixes/covers pushed down). The lyrics are typed out from recordings, so `tidyWebLyrics` guesses the
  sections from the repeats (most-repeated block = Chorus, etc.), keeps each section once and cleans the title. A result
  opens in the song editor unsaved, with a banner, for checking. The window also opens SongSelect's search in the browser
  and imports or takes dropped song files (one file opens in the editor; several are added straight away).

## Text slides, bilingual lyrics, copyright

- **Text slides** (Presentation "+" → Text slides; item kind `text`): announcements and sermon points. *Edit slides*
  in the slide-grid toolbar opens `components/TextSlidesEditor.tsx`: each slide has an optional title line
  (`Slide.heading`, drawn larger above the body) and a body; Alt+Enter splits at the cursor; pasting several
  paragraphs (blank line or `---` between them) makes several slides. *Edit all as text*: `# Title` lines, blocks
  separated by a blank line or `---`. Uses the item's look; kept by Copy for next week; printed on the run sheet;
  never counted in song usage.
- **Bilingual lyrics**: in a song slide, a line with only `--` splits the first language (above) from the second
  (below, 70% size, italic, 80% opacity). Song setting *Languages on screen*: both / first only / second only
  (`Song.languageMode`, column `language_mode`, copied to service items). Stage screens show the first language
  (with chords); Stage tab → "Show second language on stage" (setting `stageSecondLanguage`) adds the second as plain
  lines. The `--` line itself never reaches a screen (`shared/bilingual.ts`; applied in `audienceSlide()` /
  `buildStage()` in `store/useApp.ts`).
- **Copyright & CCLI**: song fields *Copyright* and *CCLI song #* (columns `copyright`, `ccli`). Settings → Church:
  *CCLI licence number* and *Copyright footer*: first & last slide (default) / every slide / off, plus "Also on the
  livestream overlay" (setting `copyright`). The footer ("© … · CCLI Song #… · CCLI Licence #…") is small, lower
  left on the audience and wireless screens (`LiveFrame.footer`), never on stage. The usage report CSV has CCLI # and
  copyright columns.
- **Text too small**: `lib/fitCheck.ts` draws the real `SlideText` offscreen at projector size (same shrink-to-fit
  as the audience screen, `fitFontSize()` in SlideView) and flags slides below 60% of the look's font size (or still
  overflowing): amber dot in the slide grid and the song / text editors, and a Sunday check entry with a *Split* fix
  (text items in the service; songs in the library).

## Broadcast overlay (OBS / vMix)

Stage & OBS tab → *Broadcast overlay*. Start sharing, copy the link (`http://127.0.0.1:4777/#/overlay` on the same
computer), add it in OBS as a Browser source at 1920×1080. Transparent background; lower third, center or top; optional
dark band, Scripture reference and countdown (follows the audience screen). Read-only, no PIN.

**Captions** (same tab): name + title lower third ("Ptr. Juan Dela Cruz · Senior Pastor") that slides in at the lower
left with an accent bar, above the lyrics band. Save presets (click to show, trash to delete), auto-hide after Off/8/15 s,
show on the overlay only or on the audience screen too. Data: `OverlayFrame.caption` / `LiveFrame.caption`; settings
`caption`, `captionPresets`. Code: `components/CaptionPanel.tsx`, `components/CaptionLayer.tsx`.

**Announcements** (same tab): short messages over the audience screen without leaving the song ("Parent of child #12,
please come to the nursery"). *Scroll*: a band along the bottom, text moves right to left 1/2/3 (default)/5 times, then
goes away. *Band*: still text for 10/15/30/60 s. Reduced-motion systems get the still band. Shown on the audience
screen, wireless screens and the live preview; *Also on OBS overlay* optional; never on stage screens. Messages sent
while one plays wait in a queue (*Stop* ends the current one, *Clear queue*). Saved messages: click to send, trash to
delete. Black covers it (the overlay drops it too); Clear (Esc) ends it and empties the queue. During rehearsal the
screens keep what they had and new messages wait until it ends. The caption and copyright line move up while it plays.
Timing is absolute (`startedAt`/`endsAt`/`passMs`, epoch ms), so late-joining and wireless screens show the same moment.
Data: `LiveFrame.ticker` / `OverlayFrame.ticker` (`TickerMessage`); settings `tickerOptions`, `tickerPresets`. Code:
`lib/ticker.ts`, `components/TickerPanel.tsx`, `components/TickerLayer.tsx`, `startTickerQueue()` in the store.

## Countdown

Countdown tab: duration, until a time of day, or a live clock; optional overtime (counts up in red); show on audience,
stage, or both. When a slide goes live the countdown steps off the audience screen but stays on stage. "Back on
audience" brings it back. Timers are based on an end time, so every screen and device stays in sync.
Own background (Normal = the usual one; color, gradient, or a picture/video/loop from Media; drawn in `CountdownLayer`,
so a mirroring stage shows it too) and title/time/subtext size sliders (% of the standard sizes). *At 0:00: go live with
the first item* (off by default): the first item that isn't a section or blank goes live and the countdown goes away
(wins over overtime; never during rehearsal; `startCountdownAutoLive` in the store).

## Stage display

Stage tab: messages to performers (free text or quick messages), next slide and clock toggles, and a live preview.
- **Wired:** opens fullscreen on a chosen monitor. If no free external monitor exists it opens as a window rather
  than covering the audience screen. **Top bar → Stage** (next to Open Output) does the same without visiting the Stage
  tab: click opens it on a free display ("Stage: <display>", click again to close; "Stage lost" when its display is
  unplugged); ▾ picks a display (the output's one is marked) or shows the wireless stage link and QR with the tablet
  count (`StageButton` in `components/TopBar.tsx`).
- **Wireless:** any phone or tablet browser on the same network: `http://<computer-ip>:4777/#/stage` (QR in the
  Stage tab). Read-only, no PIN. Adapts to portrait and landscape and keeps the screen awake.
- **Layouts:** Standard, Lyrics only (large, no chords, no next slide; for singers), Chords focus (big chords and a
  one-line next strip). Text size 70–150% (sets the largest text size; 100% = short lines fill the screen; long slides
  still shrink to fit). Toggles for song title & next song, and "Mirror audience screen" (small live picture placed in
  space kept for it: the side panel, the end of the next strip, or a row under the lyrics; it never covers words).
  Saved with the `stage` setting. Each wireless tablet can pick its own layout from its corner menu
  (`nl-stage-layout` in localStorage); the menu button hides after 4 s and comes back on a tap.
- Nothing live or a blank slide: a quiet "Standing by" (or nothing) and no LIVE badge. The service and item timers keep
  the top bar in Lyrics only.
- **Item time left** (toggle, on by default): when the live item has planned minutes, "12:34 left", amber in the last
  2 minutes, red "+0:42" when over (`StageFrame.itemStartedAt` / `itemMinutes`).
- **Messages:** a new message flashes 3 times, or keeps flashing with *Flash until cleared*; left/center/right alignment.
- **Tempo and beat pulse:** a live song with a BPM shows "72 BPM · 4/4" in the stage top bar. Stage tab → *Beat pulse*
  (setting `stage.beatPulse`: `off` (default) / `dot` / `edge`): one pip per beat in the top bar, beat 1 amber; `edge`
  adds a thin flashing frame round the screen for drummers. Reduced-motion systems get a steady beat number and no
  frame. Never on the audience screen or overlay. Beats are counted from `StageFrame.tempo` `{ bpm, time, beatsPerBar,
  startedAt }` (`liveTempo()` in the store; `startedAt` = store `beatStartedAt`, set when a song with a BPM goes live
  or its tempo changes), so every screen pulses in step (wireless screens add the server clock offset) and draws with
  requestAnimationFrame. *Beat 1 now* (`restartBeat`) re-syncs all screens and the click. 6/8, 9/8, 12/8 count
  dotted-quarter beats (2/3/4 a bar). Code: `src/shared/tempo.ts`, `components/StageBeat.tsx`.
- **Metronome** (live panel; metronome icon in its header, opens by itself while a song with a BPM is live): *Click*
  plays through this computer's sound output only, at the live song's tempo (*Song*) or a typed BPM; *Beat 1*, volume,
  *Accent 1* (higher click on beat 1). Web Audio with lookahead scheduling on the same beat clock as the stage pulse,
  booked early by the output latency. Remembered per computer (`nl-metronome` in localStorage). Code: `lib/metronome.ts`,
  `components/MetronomeControl.tsx`.

## Phone remote

Top bar → **Remote** → *Start network sharing*. Scan the QR or open `http://<computer-ip>:4777/#/remote` and enter
the 4-digit PIN (new PIN every session; 8 wrong tries locks that address out for a minute). Views: service flow,
slides of the live item, Bible search (shows verses live), chat. Controls: previous, hide text, black, next.

**Transpose from the phone:** on a song with chords, the Slides view shows the key it's played in (and the written key
when moved) with − / + (one semitone) and ↺ (back to the written key). Same live transpose as the operator's guitar
control: this service only, stage chords change, the library song doesn't. Command `{ type: 'transpose', itemId, by }`
(`by` ±1…11, 0 resets); `ItemSummary.chords` `{ key, transpose }` is sent only for songs with chords. It still works
while rehearsing (other phone commands pause), so a band can try a new key in practice.

The operator window publishes one `Snapshot` (src/shared/types.ts) on every change. The main
process relays it to the projector and stage windows over IPC and to browsers over WebSocket (src/main/server.ts).
Phone commands travel back the same way and run in the operator window.

**Control API** (Stream Deck, Bitfocus Companion, clickers): Remote panel → *Allow control API* (setting `controlApi`;
off by default). `POST /api/next|prev|black|hideText|clear?pin=1234`, `POST /api/goto?pin=1234&item=3&slide=2`
(items numbered from 1 without section headers, or an item id; PIN also as `X-PIN` header),
`POST /api/transpose?pin=1234&by=1` (live song by semitones, `by=0` back to the written key; `&item=` as goto),
`GET /api/status` (JSON, no PIN). Same PIN lockout as phones. While on, the PIN stays the same between sessions (`controlApiPin`).

## Update notice

The app asks GitHub for the latest published release (`api.github.com/repos/bisayaDev/NL-Presenter/releases/latest`)
20 s after start-up and every 6 hours. When it's newer than this version, a green **Update** pill appears in the top
bar: the version, the start of the release notes, *Download* (opens the release page), *Later* (until next start) and
*Skip this version* (setting `updateSkip`). Nothing is downloaded or installed by itself: the Mac builds aren't signed,
so they can't replace themselves. Settings → About: *Tell me when a new version is out* (setting `updateCheck`, on by
default) and *Check now*. Drafts and pre-releases are ignored. Code: `src/main/updates.ts`; snapshot runs don't check,
and `NL_UPDATE_TEST=9.9.9` fakes a release for testing.

## Shortcuts

→ / Space / PageDown: next · ← / PageUp: previous · ` or .: black screen · H: hide text · Esc: clear · F1–F6 or Cmd/Ctrl+1–6: tabs
(F2–F4 also focus the Songs / Scripture / Media search). ↑/↓ also step slides, except on the Songs, Scripture and
Media tabs and inside lists. All live keys are off while a dialog, menu or popover is open (`useModal()` in
`src/renderer/src/lib/modal.ts`; new dialogs must call it), so Esc closes the dialog without clearing the screen.
Songs tab: click a song for its preview pane; ↑/↓ select, Enter adds, E edits, Del deletes (↓ from the search enters the list).

Settings → Display → *Video decoding: CPU only* turns off GPU acceleration at the next start (`<userData>/boot.json`,
`src/main/bootPrefs.ts`), for machines where videos flicker.

Quick jumps on the live item (or the selected one): C next chorus · V then 1–9 that verse · P pre-chorus · B or R bridge ·
E ending/tag/outro (Spanish and Tagalog labels count too: Coro, Verso, Puente, Talata, Tulay…) · type `12` then Enter:
slide 12. Cmd/Ctrl+K: palette to find a service item, a library song, a verse (`jn 3:16`) or a command; Enter goes
live / runs, Alt+Enter adds to the service. Cmd/Ctrl+Z undo, Shift+Cmd/Ctrl+Z or Ctrl+Y redo for the service order
(50 steps, per service; not while typing in a field). Removing an item shows an Undo toast. `?` or the keyboard button
under the slide grid shows all shortcuts.

**Preview first** (slide grid header): a click cues the slide in a Preview box above Live (operator only, never sent
to screens); double-click, Enter or *Go live* takes it live. Next/Back still drive Live; jumps go to Preview. Saved.

## Dev snapshot

`NL_SNAPSHOT_DIR=/some/dir npm run dev` opens the output, advances two slides, saves `operator.png` and `output.png`, then quits.
Add `NL_SNAPSHOT_JS=/file.js` to run a script in the operator window instead (its return value is printed as `SNAPSHOT_RESULT`).
Use it with `NL_DB_FILE` so tests don't touch your real library. `NL_SNAPSHOT_WEB=remote,stage` also captures those
pages as a phone would see them (needs network sharing started by the script; also `display`). `NL_FAKE_CAMERA=1`
adds a synthetic camera and skips the permission prompt. In dev, the main process logs the LAN
port and PIN, and the store is available to scripts as `window.__app` (dev builds only).

Feature reference: [GPRESENTER_FEATURES.md](GPRESENTER_FEATURES.md)
