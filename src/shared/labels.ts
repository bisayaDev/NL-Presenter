// Colors for slide section labels (Verse, Chorus, Bridge…), shared by the operator window and phone remotes.

/** Colors the user can pick for a label. */
export const LABEL_PALETTE = ['#8b5cf6', '#3b82f6', '#14b8a6', '#22c55e', '#f59e0b', '#f97316', '#f43f5e', '#ec4899', '#6b7280']

/** Default color per label name (see labelKey). */
export const DEFAULT_LABEL_COLORS: Record<string, string> = {
  verse: '#8b5cf6',
  chorus: '#3b82f6',
  'pre-chorus': '#14b8a6',
  bridge: '#f59e0b',
  tag: '#f43f5e',
  ending: '#f43f5e',
  intro: '#6b7280',
  outro: '#6b7280'
}

/** The name a label's color is stored under: "Verse 2" → "verse", "Pre Chorus" → "pre-chorus". */
export function labelKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\d+[a-z]?$/, '') // trailing number: "Verse 1", "Verse 2b"
    .replace(/^pre[\s-]?chorus/, 'pre-chorus')
}

/** The label's color: the user's choice, else the default, else undefined (draw it in the accent color). */
export function labelColor(label: string | undefined, custom?: Record<string, string> | null): string | undefined {
  if (!label) return undefined
  const k = labelKey(label)
  if (!k) return undefined
  return custom?.[k] ?? DEFAULT_LABEL_COLORS[k]
}
