import type { CSSProperties } from 'react'
import type { StageChords } from '@shared/types'
import { isChordOnlyLine, lineHasChords, renderChord, splitLine, stripChords } from '@shared/chords'

// Lyrics with chords drawn above the syllable they fall on. Sizes are in em, so it scales with whatever
// font size the parent picks (the stage display shrinks text to fit its box).

export const CHORD_COLOR = '#fcd34d'

interface Props {
  text: string
  mode: StageChords
  songKey?: string
  transpose?: number
  /** Chord colour (stage: amber). */
  color?: string
}

export default function ChordText({ text, mode, songKey, transpose = 0, color = CHORD_COLOR }: Props) {
  if (mode === 'off' || !text.includes('[')) return <>{stripChords(text)}</>
  const show = (c: string): string => renderChord(c, { key: songKey, semis: transpose, notation: mode })
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        if (isChordOnlyLine(line)) return <ChordRow key={i} line={line} show={show} color={color} />
        if (!lineHasChords(line)) return <div key={i}>{line || ' '}</div>
        const segs = splitLine(line)
        return (
          // Taller lines leave room for the chords above every wrapped row.
          <div key={i} style={{ lineHeight: 2.2, whiteSpace: 'pre-wrap' }}>
            {segs.map((s, j) => {
              const label = s.chord ? show(s.chord) : ''
              // Keep chords that sit close together from overlapping: pad short syllables.
              const nextHasChord = !!segs[j + 1]?.chord
              const pad = s.chord && nextHasChord ? Math.max(0, label.length * 0.4 + 0.35 - s.text.length * 0.5) : 0
              const padStyle = pad ? { paddingRight: `${pad}em` } : undefined
              if (!s.chord) return <span key={j}>{s.text}</span>
              // The chord and the first word wrap together, so a chord never ends up at the end of the row above.
              const [, head, tail] = /^(\S*\s?)([\s\S]*)$/.exec(s.text)!
              return (
                <span key={j}>
                  <span style={{ whiteSpace: 'nowrap', ...(tail ? {} : padStyle) }}>
                    <ChordMark label={label} color={color} />
                    {head}
                  </span>
                  {tail && <span style={padStyle}>{tail}</span>}
                </span>
              )
            })}
          </div>
        )
      })}
    </>
  )
}

function ChordMark({ label, color }: { label: string; color: string }) {
  const wrap: CSSProperties = { position: 'relative', display: 'inline-block', width: 0 }
  const above: CSSProperties = { position: 'absolute', left: 0, bottom: '0.95em', whiteSpace: 'nowrap', lineHeight: 1 }
  return (
    <span style={wrap}>
      <span style={above}>
        <span style={{ fontSize: '0.62em', fontWeight: 800, color, letterSpacing: '0.01em' }}>{label}</span>
      </span>
    </span>
  )
}

/** Instrumental line: chords with their bar lines and repeat marks. */
function ChordRow({ line, show, color }: { line: string; show: (c: string) => string; color: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'inherit', gap: '0.2em 0.55em', fontSize: '0.8em', lineHeight: 1.4 }}>
      {splitLine(line).flatMap((s, j) => [
        s.chord ? (
          <span key={`c${j}`} style={{ color, fontWeight: 800 }}>
            {show(s.chord)}
          </span>
        ) : null,
        ...s.text
          .split(/\s+/)
          .filter(Boolean)
          .map((t, k) => (
            <span key={`t${j}-${k}`} style={{ opacity: 0.55 }}>
              {t}
            </span>
          ))
      ])}
    </div>
  )
}
