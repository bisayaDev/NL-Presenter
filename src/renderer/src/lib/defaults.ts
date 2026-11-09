import { chordSheetToInline, isChordOnlyLine } from '@shared/chords'
import type { Background, Slide, Song, TextStyle } from '@shared/types'

export const uid = (): string => Math.random().toString(36).slice(2, 10)

/** Section header colors in the service order. */
export const SECTION_COLORS = ['#7c6cff', '#38bdf8', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#a3a3a3']

export const DEFAULT_STYLE: TextStyle = {
  fontFamily: "'Inter', system-ui, 'Segoe UI', Helvetica, Arial, sans-serif",
  fontSize: 84,
  fontWeight: 800,
  color: '#ffffff',
  uppercase: true,
  align: 'center',
  valign: 'center',
  marginX: 110,
  marginY: 110,
  lineHeight: 1.2,
  shadow: true,
  shadowStrength: 'medium',
  italic: false,
  letterSpacing: 0,
  outline: 0,
  outlineColor: '#000000',
  glow: 0,
  glowColor: '#ffffff',
  textBg: 'off',
  textBgColor: '#000000',
  textBgOpacity: 0.55
}

export const BACKGROUNDS: Background[] = [
  { kind: 'gradient', value: 'radial-gradient(120% 90% at 50% 10%, #2a2457 0%, #0d0f1d 60%, #05060b 100%)' },
  { kind: 'gradient', value: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { kind: 'gradient', value: 'radial-gradient(100% 100% at 20% 80%, #3b1d2e 0%, #120a12 70%)' },
  { kind: 'gradient', value: 'linear-gradient(160deg, #1d2b1f 0%, #0b120c 100%)' },
  { kind: 'color', value: '#000000' },
  { kind: 'color', value: '#101828' }
]

/** Translation keys naming BACKGROUNDS, same order (tooltips and screen-reader names). */
export const BACKGROUND_NAMES = [
  'presentation.bg.indigo',
  'presentation.bg.teal',
  'presentation.bg.plum',
  'presentation.bg.forest',
  'presentation.bg.black',
  'presentation.bg.navy'
] as const

export const DEFAULT_BG = BACKGROUNDS[0]

/** Split pasted lyrics into slides: blank lines separate slides, "[Chorus]" or "Chorus:" lines set labels. */
export function lyricsToSlides(raw: string): Slide[] {
  const slides: Slide[] = []
  let label: string | undefined
  // Chord sheets (chords on the line above the words) become inline chords before lines are trimmed.
  for (const block of chordSheetToInline(raw).split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) continue
    const head = lines[0].match(/^\[([^\]]+)\]$|^((?:verse|chorus|bridge|pre-chorus|tag|intro|outro|ending|instrumental|interlude)\b.*?):?$/i)
    // "[G]" alone is an instrumental line, not a section heading.
    if (head && !(head[1] && isChordOnlyLine(lines[0]))) {
      label = (head[1] ?? head[2]).trim()
      lines.shift()
    }
    if (lines.length) slides.push({ id: uid(), label, text: lines.join('\n') })
  }
  return slides
}

/** Inverse of lyricsToSlides: a label header is written only when it changes. */
export function slidesToLyrics(slides: Slide[]): string {
  let prev: string | undefined
  return slides
    .map((s) => {
      const head = s.label && s.label !== prev ? `[${s.label}]\n` : ''
      prev = s.label
      return head + s.text
    })
    .join('\n\n')
}

export const SECTION_LABELS = ['Verse 1', 'Verse 2', 'Verse 3', 'Verse 4', 'Pre-Chorus', 'Chorus', 'Bridge', 'Tag', 'Intro', 'Outro', 'Ending']

const song = (title: string, author: string, tags: string[], lyrics: string): Song => ({
  id: uid(),
  title,
  author,
  tags,
  slides: lyricsToSlides(lyrics),
  updatedAt: Date.now()
})

// Public-domain hymns used as starter content.
export const SEED_SONGS: Song[] = [
  song('Amazing Grace', 'John Newton', ['hymn', 'classic'], `[Verse 1]
Amazing grace! How sweet the sound
That saved a wretch like me

I once was lost, but now am found
Was blind, but now I see

[Verse 2]
'Twas grace that taught my heart to fear
And grace my fears relieved

How precious did that grace appear
The hour I first believed

[Verse 3]
Through many dangers, toils and snares
I have already come

'Tis grace hath brought me safe thus far
And grace will lead me home`),
  song('Holy, Holy, Holy', 'Reginald Heber', ['hymn', 'solemn'], `[Verse 1]
Holy, holy, holy! Lord God Almighty!
Early in the morning our song shall rise to Thee

Holy, holy, holy! Merciful and mighty!
God in three Persons, blessed Trinity!

[Verse 2]
Holy, holy, holy! All the saints adore Thee
Casting down their golden crowns around the glassy sea

Cherubim and seraphim falling down before Thee
Which wert, and art, and evermore shalt be`),
  song('Be Thou My Vision', 'Irish hymn, tr. Mary Byrne', ['hymn', 'solemn'], `[Verse 1]
Be Thou my vision, O Lord of my heart
Naught be all else to me, save that Thou art

Thou my best thought, by day or by night
Waking or sleeping, Thy presence my light

[Verse 2]
Be Thou my wisdom, and Thou my true word
I ever with Thee and Thou with me, Lord

Thou my great Father, I Thy true son
Thou in me dwelling, and I with Thee one`),
  song('Come Thou Fount', 'Robert Robinson', ['hymn', 'joyful'], `[Verse 1]
Come, Thou Fount of every blessing
Tune my heart to sing Thy grace

Streams of mercy, never ceasing
Call for songs of loudest praise

[Verse 2]
Here I raise my Ebenezer
Hither by Thy help I've come

And I hope, by Thy good pleasure
Safely to arrive at home`)
]

export const SEED_SCRIPTURE: Slide[] = [
  {
    id: uid(),
    label: 'John 3:16',
    reference: 'John 3:16 (KJV)',
    text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'
  },
  {
    id: uid(),
    label: 'John 3:17',
    reference: 'John 3:17 (KJV)',
    text: 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.'
  }
]
