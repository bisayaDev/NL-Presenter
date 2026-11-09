# G-Presenter — Feature, GUI & Branding Study

> Source: https://gpresenter.com (home, `/background-loops`, `/releases`), the app screenshots on the site, and the public GitHub release notes (`github.com/mel0620/g-presenter-releases`).
> Researched: 2026-11-07. Latest version at that time: **v1.11.3** (released 2026-11-06).

---

## 1. Product overview

| Item | Detail |
|---|---|
| Name | **G-Presenter** |
| Tagline (page title) | "Simple Worship Presentation App" |
| Hero headline | "Run the service. Keep control." |
| Eyebrow label | "Local-first worship software" |
| Category | Desktop worship/church presentation software (lyrics, Scripture, media, multi-screen) |
| Platform | Windows 10+ (64-bit) only, one-click `.exe` installer (Electron-style auto-update via `latest.yml`) |
| Developer | Rommel Cuneta, a solo developer on a church media team (rommelcuneta.com) |
| Target user | Small local churches; volunteer operators who run slides once a week; churches without IT staff or a software budget |
| Core positioning | Local-first and offline by default · no account · no subscription · one-time payment · simple enough for volunteers |
| Meta description | "G-Presenter is a simple worship presentation app that keeps your songs, Bibles, and media on your own computer. Sync to up to 3 extra displays and 2 remote controls over your local network. No account or subscription required." |
| Community | Facebook page `facebook.com/gpresenterapp`, Facebook group `facebook.com/groups/gpresenter` |
| Contact / sales | Email `melapp0620@gmail.com` (manual license purchase) |

### Key selling points (from "Why G-Presenter")
1. **Your data stays with you.** Songs, Bibles, media and settings are stored locally. Nothing is uploaded to the cloud.
2. **Pay once, own it forever.** No monthly or yearly fees. Free updates for all v1.x releases. The free version has no watermarks or branding on slides.
3. **Remote control from any phone (Pro).** Browser-based, no app install, no account, no pairing. Scan a QR code to connect.
4. **Multi-display without extra hardware (Pro).** Up to **3 extra screens + 2 remote controls** over the LAN. No splitters or HDMI extenders.
5. **Bibles in any language.** 3 built-in translations; Pro imports Zefania XML Bibles.
6. **Simple enough for volunteers.** Usable without training.

Three short value tags: **Focused** (made for the person behind the computer), **Private** (local storage is the default, not a premium feature), **Connected** (uses the existing LAN for remote control, stage display and extra screens).

---

## 2. Complete feature catalog

### 2.1 Song Library
- Add, edit and organize worship songs in one place.
- Tags, plus section labels (verse, chorus, bridge, and so on).
- Search by **title, author, tag, or lyric text**.
- Reorder slides per service without changing the original song (a "Custom Slide Order").
- List shows song title, slide count badge, author, and last-updated time. Tag filter chips show counts (e.g. "solemn 23"). Sort by "Updated". Shows a result count ("16 of 1464 songs").
- Keyboard: ↑/↓ to navigate, Enter to edit the song, Del to delete. Double-click or "+" adds the song to the active service.
- **Import songs** from one or more `.txt` files; **export** one or more songs as `.txt` (ChordPro-style, including key and chords). Duplicate titles are imported as copies.
- **Paste Lyrics** recognizes section headings written as words in many languages ("Verse 1", "1 Verse", "Chorus x2", "Куплет 1"). Custom section names can be added in Settings > Song Templates > Section names.
- Views: **Grid**, **List**, and **Group** (sections shown with a colored header per part).
- **Custom section colors.** A color belongs to the label (coloring "Chorus" colors every Chorus slide). Picked colors are saved as presets.

### 2.2 Song Editor / Deck Editor
- Formatting sidebar with three tabs:
  - **Style**: alignment, font, color, size, spacing, effects
  - **Motion**: animations, speed, auto-advance
  - **Notes**: presenter notes (the tab shows a dot when a slide has notes)
- Effects: Shadow (Soft / Medium / Strong), Text Glow, Outline, Text Background. Each toggles with one click and remembers its last strength.
- Text Background **Width** options: Fit each line / Widest line / Full width.
- Compact bar under the canvas: **Background**, **Transition**, **Applies to**, **Template**.
- **Apply Background** workflow: preview on the current slide, then apply to This Slide, Selected, or All Slides.
- Solid background color presets.
- Undo/Redo including typing (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y); Reset formatting.
- Split a slide with **Alt+Enter**; "Edit All Slides" mode.
- Drag and drop with a green insertion line (drop on the top or bottom half of a slide to place before or after). Slides can be dragged into and out of groups.

### 2.3 Song Templates
- Reusable song styles: lyrics font, background, colors, shadows, spacing, layout.
- Start from a blank template or a "church-ready" preset for a consistent look.

### 2.4 Chords for musicians (Pro, added in v1.11.0)
- **Chord Editor** opens from the Song Editor header. Chords go in brackets inline: `[G]Amazing [C]grace`.
- Supports complex chords (Bbmaj9, F#m7b5, Csus4, Cadd9, C6/9) and slash chords (D/F#). Shows ♭ and ♯ symbols.
- **Nashville number system** (`[1]`, `[4]`, `6m`, `b7`, `5/7`) plus a per-song **Key** setting.
- Autocomplete: typing `[` suggests the diatonic chords of the song's key.
- Paste Lyrics and .txt import understand chord sheets (chords on the line above the words) and read a "Key: B" line.
- Intro and instrumental slides hold chord-only charts (`G C D G`, `|`, `x2`).
- **Transpose** (±1 semitone, respelled for the new key) and **Live transpose** for one service only (a guitar control above the slides).
- Stage Display shows chords above the lyrics (Standard or Nashville). Each wireless stage tablet can switch notation or hide chords for itself.
- Chords never appear on the audience output, OBS, or the mirror view.

### 2.5 Presentation Builder (Service Order)
- Mixes songs, custom slide decks, Scripture, images, video, **Browser** items, **Camera** feeds, **PPT/PPTX**, **PDF**, and **Blank** screens.
- Imports `.pptx`, `.ppt`, `.pdf` directly.
- Decks support background and foreground image overlays.
- Drop in multiple images to make a one-image-per-slide photo slideshow.
- Per-slide **auto-advance** after N seconds.
- Clicking a song **previews** it first before it is sent to the projector.
- Service order **groups/sections** (e.g. "STANDBY", "Opening Song", "Praise & Worship"), collapsible, with item counts.
- Multiple named services (presentation dropdown such as "Sunday Service", with + / edit / delete).

### 2.6 Scripture Browser
- Built in: **KJV, ASV, Tagalog**. Pro: import **Zefania XML** translations in any language.
- Book list (All 66 / Old Testament 39 / New Testament 27) with abbreviations, a "Filter books" field, a chapter number grid, and a verse list.
- Breadcrumb navigation: Books › Genesis › Chapter 1. Chapter prev/next arrows.
- Search by **reference or verse text**.
- Click a verse to send it; Ctrl+Click selects multiple, Shift+Click selects a range.
- Compare **two or three versions** side by side or stacked on the projector.
- Add multiple verses as one compact group in the service order while still outputting one verse per slide.
- "Standard" vs "Browser" display modes, a history button, and "Add to presentation" (+).
- Formatting supports system fonts for scripts such as Telugu, Tamil, Devanagari, Bengali, Thai, and Arabic.

### 2.7 Media Library
- Upload images and videos as slide backgrounds, **or browse a local folder directly without uploading** (v1.10).
- Formats: images JPG, PNG, GIF, WebP; videos MP4, WebM, MOV.
- Square images are shown at their original size to avoid cropping.
- Instant switching between media. Filters: All / Image / Video / Loops. "Open in containing folder".
- Pro: Stock image and video access.
- **Loops**: CSS animated background loops, importable (see §5).

### 2.8 Browser Slides (Pro)
- Add any website or a **vdo.ninja** camera feed as a service item.
- Previews and outputs at the projector's aspect ratio. Audio with a mute/unmute toggle.
- Can also be used as a **live background behind lyrics**.

### 2.9 Camera Capture (Pro)
- Webcams, USB cameras, and capture devices as a service item.
- Use as a live slide, behind song lyrics, or behind a countdown.
- Fills the frame without stretching. Audio starts muted.

### 2.10 MP3 / Audio Player (Pro)
- Floating, draggable, collapsible player.
- Playlist with previous/next, seek, loop, and shuffle.

### 2.11 Countdown Timer
- Fields: Title ("The service is about to start"), optional Subtext ("Please take your seats").
- **Timer modes:** Duration · Target Time · Current Time (live clock).
- **Show On:** Both · Main Output · Display Only.
- Duration input (min:sec) and quick presets: 1m, 3m, 5m, 10m, 15m, 30m.
- **Overtime:** keeps counting past 0:00 in red.
- Font size sliders for Title, Time, and Subtext.
- Background: Color swatches · Gradient · Library · Local Media (image or video, with mute toggle).
- Mirrors to the Stage Display. Live preview, "Go Live" button, and reset.

### 2.12 Live Formatting
- Font, size, bold, italic, uppercase, letter spacing, line height, text shadow, outline, and per-line text background, all adjustable live.
- Changes show immediately on the projector, the remote preview, and every connected display.

### 2.13 Live Service Essentials
- **Screen wake lock** stops the projector from sleeping.
- **Lyrics toggle** (the eye-slash icon) hides or shows text with a fade while keeping the background.
- **CC button** (captions/text toggle) next to the prev/next controls.
- **Rehearsal Mode** previews everything without sending anything to the projector or connected screens.

### 2.14 Video Playback Controls
- Play, pause, stop, loop, and mute video backgrounds from the operator panel.
- The preview and the output stay in sync. Service-order video syncs its playback time when going live.
- Settings > Display > **Video Decoding**: CPU (default) or GPU (v1.11.3).

### 2.15 Stage Display (Pro)
- A dedicated performer view: current lyrics, **next slide preview**, grouped Scripture, operator **custom messages**, private **presenter notes**, live **countdown**, clock, the song title and the next song's name, and a LIVE indicator.
- **Stage Display Control** tab:
  - Custom text message (200 characters, left/center/right alignment), "Send to Stage Display", Clear
  - **Quick messages:** Next Song, Prayer Time, Offering, Break, Announcements, Worship Time, Testimony
  - **Layout sliders:** Countdown height, Side panel width, Next lyrics font, Message font, Notes font, then Apply
  - Live **Stage Display Preview**
  - **Stage Display Output** to a wired 2nd or 3rd monitor (pick the monitor, e.g. "Monitor 2"), with options: Hide Lyrics/Bible Background, Show Message & Countdown, Mirror audience output, Override lyrics font (%)
- Wireless delivery to phones and tablets (PIN join), optimized for portrait and landscape.

### 2.16 Responsive Remote Control (Pro)
- Phone or tablet browser over Wi-Fi. Connect by QR code or PIN; no app install.
- Header: service name with a "Connected" status pill.
- Live slide preview with its section label (e.g. "VERSE 1").
- Tabs: **FLOW** (service order with groups) · **SLIDES** (grid that follows the live slide) · **BIBLE** (search by reference or content).
- Bottom control deck: Prev · Hide lyrics · CC · Next (large outlined tiles).
- **Chat** between the person at the front and the operator (v1.11.0).
- Language dropdown on the PIN screen. Works on older iOS Safari.

### 2.17 Multi-Display Sync (Pro)
- Up to **3 extra displays** (any device with a browser on the LAN) plus **2 remotes**.
- HDMI secondary-screen output is available in Free.

### 2.18 Broadcast Overlay (Pro)
- A transparent overlay URL for **OBS, vMix**, and other software with browser inputs.
- Carries lyrics, Scripture, and an optional countdown. Includes a compatibility mode for older embedded browsers.

### 2.19 Logo & Watermark
- Church logo or watermark in any corner of the audience output, with adjustable size and opacity. Optionally shown on the stage display as well.

### 2.20 Dynamic Aspect Ratio
- **16:9** and **4:3**, applied everywhere at once (operator preview, remote, and displays).

### 2.21 Theme Appearance & UI settings
- App accent color, icon color, and interface theme, set in Settings.
- **Interface Scale** for small laptop screens (v1.10).

### 2.22 Multi-language UI
- 14 languages: English, Spanish, Italian, Portuguese, Tagalog, Korean, French, Chinese, Hindi, Arabic, Indonesian, Tamil, Russian, Ukrainian.

### 2.23 Import / Export / Backup
- Per-module export (songs, presentations, media) or **Full Backup** (Settings > Data Management).
- Restoring on another PC detects duplicates. Chords, key, and transpose settings are included.

### 2.24 Keyboard shortcuts (from release notes)
- **F1–F7** switch tabs. **F2–F5** focus the search box of Song Library, Slides, Scripture, or Media.
- **Esc** leaves a search box. **Space** and the **arrow keys** move between slides.
- **Ctrl K** opens a command/search palette on the website.

---

## 3. GUI / layout of the desktop app (from screenshots)

Theme: **dark UI** with near-black backgrounds and an **emerald green** accent for active and primary states.

### 3.1 Global layout (three zones)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ G-Presenter  [Sunday Service ▾] + ✎ 🗑          [Open Output] 📱 🖥  ?  ⚙   │  ← top bar
├──────────────────────────────────────────────────────────────────────────────┤
│ Presentation | Song Library | Slides | Scripture | Media | Countdown | Stage Display │ ← tab bar (F1–F7)
├───────────────────────────────────────────────────────────┬──────────────────┤
│                                                           │ PREVIEW / ● LIVE │
│                 Main workspace (per tab)                  │  [End Live]      │
│                                                           │  ‹  👁̸  CC  ›     │
│                                                           │ UP NEXT          │
│                                                           │ SERVICE FLOW     │
│                                                           │ 🕐 12:18 AM  ⏱2:43│
└───────────────────────────────────────────────────────────┴──────────────────┘
```
- **Top bar:** app name, presentation selector dropdown, new/edit/delete icons. On the right: a green **"Open Output"** button, remote (phone) icon, multi-display (monitor) icon, help, settings.
- **Tab bar:** each tab has a small colored icon (Presentation, Song Library, Slides, Scripture, Media, Countdown, Stage Display). The active tab is highlighted with a green underline and tint.
- **Right sidebar (persistent on every tab):**
  - Header reads "PREVIEW" with a **Rehearse** button when not live, or a red "● LIVE" with a red **End Live** button when live.
  - Current output thumbnail
  - Controls: Previous · Hide lyrics · CC · Next
  - **UP NEXT** thumbnail
  - **SERVICE FLOW** list with item-type icons; the current item is highlighted in green
  - Footer: the current clock and a countdown/elapsed timer

### 3.2 Presentation tab
- Toolbar: Add Song, Add Media, Local Media, PPT, PDF, Browser, Camera, Blank.
- Grid-size selector (3/4/5/6 columns) and Grid/List toggle.
- **Left panel "SERVICE ORDER"** with a count badge: collapsible groups and numbered items, each with a type icon (song, video, PDF), slide count, and a drag handle.
- **Center slide grid:** numbered 16:9 thumbnails with a green section badge in the top-right corner (VERSE 1, CHORUS, BRIDGE…). The live slide has a green border.
- Bottom bar: large green ‹ › buttons, a position counter ("5 / 86"), and a keyboard icon.

### 3.3 Song Library tab
- Full-width search bar with a green "+" button, a sort control, tag filter chips, and an info banner ("Double-click or press + to add to 'Sunday Service'"), then the song list and a keyboard-hint footer.

### 3.4 Scripture tab
- Translation dropdown, search field, side-by-side compare and theme buttons, and a Standard/Browser toggle.
- Three columns: Books list → chapter number grid → verse list. The help hint reads "Click = send, Ctrl+Click = multi, Shift+Click = range".

### 3.5 Countdown and Stage Display tabs
- Two-column layout: settings form on the left, a large live preview on the right with a green full-width action button ("Go Live" / "Send to Stage Display").

### 3.6 Mobile Remote
- Dark, large-touch layout: a header with a "Connected" pill and a kebab menu; a live preview card; a segmented control (FLOW / SLIDES / BIBLE) with the active segment filled green; groups drawn with dashed borders and count circles; the active item outlined in green.
- Bottom bar of four outlined buttons: green Prev/Next and amber Hide/CC.

### 3.7 UI conventions worth noting
- Uppercase, letter-spaced small section labels ("SERVICE ORDER", "UP NEXT", "QUICK MESSAGES", "LAYOUT").
- Pill badges for counts. Green filled chips for the active filter.
- Sliders with green tracks and value labels in px.
- Checkbox cards with green borders when selected.
- Slide lyrics are rendered in a bold, uppercase, centered sans-serif over a dark textured background.
- Status colors: green = active, primary, or live-ready; red = LIVE / End Live / overtime; amber/orange = clock and secondary controls.

---

## 4. Branding

### 4.1 Name and voice
- **G-Presenter**, with a hyphen and a capital G and P.
- The voice is warm, plain-spoken, faith-based and humble ("May God bless you!", "Good to know before Sunday.", "No guilt and no nag screens.").
- Copy themes: Sunday morning, volunteers, calm, control, local, simplicity. It makes a point of being an anti-subscription, anti-cloud product.
- Founder story section: "Built for our church, shared with yours." Pro revenue funds the developer's local church media team.

### 4.2 Logo
- File: `/icon-base.svg` (1024×1024).
- Concept: a **monitor/projector screen** (green rounded rectangle frame, dark gray `#383838` screen), a darker green stand (`#1a6a4d`), and a green base bar. The screen shows the letters **"GP"** in green (`#34d399`).
- The favicon is a 256×256 `.ico` of the same mark.

### 4.3 Color palette (from the site CSS)
| Role | Hex |
|---|---|
| Primary / accent / ring | `#34d399` (emerald-400) |
| Primary hover / deeper accent | `#10b981` (emerald-500) |
| Logo dark green (stand) | `#1a6a4d` |
| Text on primary | `#052e16` (very dark green) |
| Page background | `#0a0a0c` |
| Surface (section and hero) | `#111113`, with green-tinted surfaces `#141a16`, `#111915`, `#07130e` |
| Card / popover / secondary | `#1a1a1d` |
| Muted | `#27272a` |
| Foreground text | `#f0f4f8` |
| Muted text | `#a1a1aa`, `#71717a`, `#52525b` |
| Border / input | `#ffffff12` (white at about 7% opacity) |
| Destructive | `#ef4444` |
| Highlight / warning | `#fbbf24` (amber) |

The in-app UI uses the same scheme: near-black panels, emerald accent, red for LIVE, and amber for timers.

### 4.4 Typography
- Website: **Manrope** (sans-serif) for everything; Geist Mono for monospace accents.
- The app UI appears to use a similar geometric sans (Manrope-like). Slide lyrics use a heavy, bold uppercase sans.

### 4.5 Website structure and style
- Built with Next.js (Turbopack chunks), Tailwind CSS, and shadcn-style design tokens. Uses Google Analytics.
- Dark theme throughout, with an emerald accent and subtle green-tinted gradients.
- Header nav: Overview, Features, Service workflow, Why G-Presenter, Our story, Testimonials, FAQs, Pricing, Install. Also Release notes, Background loops, and a Ctrl K search.
- Page sections in order:
  1. **Hero.** Eyebrow, two-line headline, intro paragraph, CTAs ("Download for Windows" and "Explore features"), and trust chips: *No account · No subscription · 15-day Pro trial*. Includes an "Operator view" screenshot captioned "G-Presenter / service order".
  2. **What you can do.** Four cards: Songs, Bible, Service order, LAN sync.
  3. **Features.** The full catalog of about 22 feature cards.
  4. **Interface.** "Designed for the operator", a screenshot gallery of 8 shots.
  5. **Stats strip:** 3 Bibles · 16:9 / 4:3 · 14 languages · Windows.
  6. **Workflow.** Three steps: **Build → Rehearse → Present**.
  7. **Why G-Presenter.** "Less infrastructure. More attention." plus "Built different, on purpose".
  8. **Our Story.** A founder letter signed by Rommel Cuneta.
  9. **Testimonials.** Embedded Facebook posts.
  10. **Release notes.** The latest release, loaded live from GitHub.
  11. **FAQs** in an accordion.
  12. **Pricing.** Two cards.
  13. **Download.** System requirements.
  14. Final CTA band and footer.

---

## 5. Background Loops Library (`/background-loops`)
- A catalog of "lyric-safe" **CSS-animated background loops**, hosted on GitHub. Pro users download one loop or a whole category pack and import it via Media Library › Loops.
- **40 loops in 11 categories:** Ambient 3, Bokeh 3, Celebration 7, Clouds 3, Galaxy 3, Light 3, Lightning 3, Mesh 3, Patterns 6, Prism 3, Smoke 3.
- Example names: Amber Veil, Azure Veil, Bezier Flow, Breakthrough Pulse, Candle Bokeh, Creation Galaxy, Crimson Smoke, Dawn Cloudbank, Deep Covenant, Distant Thunder, Garden Mesh, Golden Light Curtain, Hallelujah Rush, Joy River, Neon Grid, Pastel Cloud Chapel, Revival Spark, Stained Glass Drift, Storm Ember, Violet Light Curtain, and others. Each has descriptive tags (e.g. "fast gold pulse", "worship warm veil").
- Buttons: "Download All" and "Download Pack" per category.

---

## 6. Pricing & licensing

| | **Free** — $0 | **Pro** — $24.99 one-time |
|---|---|---|
| Song Library & Editor | ✅ | ✅ |
| Presentation Builder | ✅ | ✅ |
| 3 built-in Bibles (KJV, ASV, Tagalog) | ✅ | ✅ |
| Media Library & backgrounds | ✅ | ✅ (+ stock image/video) |
| Countdown Timer | ✅ | ✅ |
| Import & Export | ✅ | ✅ |
| PPT & PDF import | ✅ | ✅ |
| Output on secondary screen (HDMI) | ✅ | ✅ |
| Import additional Bibles (Zefania XML) | ❌ | ✅ |
| Remote control (phone/tablet) | ❌ | ✅ |
| Multi-Display Sync & Stage Display (LAN or HDMI) | ❌ | ✅ |
| Browser & Camera live slides | ❌ | ✅ |
| MP3 / Audio player | ❌ | ✅ |
| Broadcast overlay (OBS / vMix) | ❌ | ✅ |
| Chords on stage display | ❌ | ✅ |
| Background loops downloads | ❌ | ✅ |

- The Pro license is a **lifetime license per device**, tied to a **Hardware ID** (Settings > License). It is not transferable to another device.
- Includes free updates for all v1.x releases and a **15-day Pro trial** on install.
- Purchase is manual: the user emails their Hardware ID to the developer. There is no online checkout.
- No watermark or branding on Free output.

---

## 7. Download & system requirements
- Windows 10 or later (64-bit), one-click installer `G-Presenter-Setup.exe`, delivered through GitHub Releases.
- **Minimum:** 4 GB RAM, 500 MB disk, any dual-core CPU.
- **Recommended:** 8 GB RAM, a dedicated GPU for video backgrounds, and a second display or projector.
- Release channels: stable and **beta** (e.g. v1.11.0-beta). The release notes advise making a Full Backup before updating. Updating the desktop app also updates the wireless stage displays and remotes.

---

## 8. Recent release history (for feature velocity)
| Version | Date | Highlights |
|---|---|---|
| v1.11.3 | 2026-11-06 | Background videos keep playing when the app isn't focused; CPU/GPU video-decoding setting |
| v1.11.2 | 2026-11-06 | F1–F7 tab switching from search boxes; F2–F5 focus search; "Add to presentation" label; smoother Remote/Multi Display windows; QR network highlight |
| v1.11.1 | 2026-11-04 | Mobile-friendly Stage Display (song title, next song); undo for typing; chords stay on words; multilingual section-heading detection; Remote Prev/Next and auto-scroll |
| v1.11.0 | 2026-11-03 | Redesigned Song/Deck editors (Style/Motion/Notes); Group view; section colors; better drag and drop; **Chords + Nashville + transpose (Pro)**; Remote redesigned as a control deck with **chat** |
| v1.11.0-beta | 2026-10-30 | Beta of the above |
| v1.10.0 | 2026-10-28 | .txt song import/export; local-folder media browsing; Interface Scale; media filter improvements |

---

## 9. FAQ summary (from the site)
- **Offline?** Yes, it is fully local-first.
- **Bibles?** KJV, ASV, and Tagalog, plus Zefania XML import.
- **What goes in a presentation?** Songs, Scripture, decks, images, video, browser pages, cameras, PPT, and PDF.
- **Phone control?** Yes, over local Wi-Fi.
- **Stage display content?** Lyrics, next slide, grouped Scripture, messages, notes, and countdown.
- **Broadcast?** Yes, through a transparent overlay for OBS and vMix.
- **Backup or move library?** Yes, with duplicate detection.
- **Projector formats?** 16:9 and 4:3.
- **License on another device?** No, it is tied to the activated device.
