#!/usr/bin/env node
// Translation check: `npm run i18n:check [-- area ...] [--quiet]`
//  1. Per language, keys missing a translation (area files + src/shared/i18n-main.ts).
//  2. Keys not starting with their area name, duplicate keys, {placeholders} that differ from English,
//     plural entries without `other`.
//  3. Heuristic: hard-coded English left in converted files (files that import '@/i18n'): JSX text and
//     title/placeholder/aria-label/label attributes. Silence a line with `// i18n-ignore` (or {/* i18n-ignore */}).
// Exit code 1 when anything is reported. Area files must be plain data (only `import type` lines).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..')
const STR_DIR = join(root, 'src/renderer/src/i18n/strings')
const MAIN_FILE = join(root, 'src/shared/i18n-main.ts')
const LANGS = ['en', 'tl', 'es', 'pt', 'fr', 'it', 'ko', 'zh', 'id', 'hi', 'ta', 'ru', 'uk']

const args = process.argv.slice(2)
const quiet = args.includes('--quiet')
const only = args.filter((a) => !a.startsWith('--'))

/** Evaluate a data-only area file: drop type imports and `satisfies`, then run the object literal. */
function loadArea(file) {
  const src = readFileSync(file, 'utf8')
    .replace(/^import type .*$/gm, '')
    .replace(/\}\s*satisfies\s+\w+\s*;?\s*$/, '}')
    .replace(/export default/, 'return')
  try {
    return new Function(src)()
  } catch (e) {
    console.error(`✗ ${relative(root, file)}: not plain data (${e.message})`)
    process.exitCode = 1
    return {}
  }
}

const areas = readdirSync(STR_DIR)
  .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
  .map((f) => ({ area: f.replace(/\.ts$/, ''), file: join(STR_DIR, f) }))
areas.push({ area: 'main', file: MAIN_FILE })

const placeholders = (t) => {
  const texts = typeof t === 'string' ? [t] : Object.values(t ?? {})
  return [...new Set(texts.flatMap((s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].filter((p) => p !== 'count').sort().join(',')
}

let problems = 0
const missing = Object.fromEntries(LANGS.map((l) => [l, []]))
const seen = new Map()
let total = 0
for (const { area, file } of areas) {
  if (only.length && !only.includes(area)) continue
  const table = loadArea(file)
  const keys = Object.keys(table)
  total += keys.length
  for (const key of keys) {
    const e = table[key]
    const where = `${area}: ${key}`
    if (!key.startsWith(`${area}.`)) {
      console.log(`✗ key must start with "${area}.": ${key}`)
      problems++
    }
    if (seen.has(key)) {
      console.log(`✗ duplicate key ${key} (also in ${seen.get(key)})`)
      problems++
    }
    seen.set(key, area)
    if (!e || e.en === undefined || e.en === '') {
      console.log(`✗ no English text: ${where}`)
      problems++
      continue
    }
    const enPh = placeholders(e.en)
    for (const l of LANGS) {
      const v = e[l]
      if (v === undefined || v === '') {
        missing[l].push(where)
        continue
      }
      if (typeof v === 'object' && !v.other) {
        console.log(`✗ plural without "other": ${where} [${l}]`)
        problems++
      }
      if (l !== 'en' && placeholders(v) !== enPh) {
        console.log(`✗ placeholders differ from English: ${where} [${l}] has {${placeholders(v)}} but en has {${enPh}}`)
        problems++
      }
    }
    for (const k of Object.keys(e)) {
      if (!LANGS.includes(k)) {
        console.log(`✗ unknown language "${k}": ${where}`)
        problems++
      }
    }
  }
}

console.log(`\n${total} keys in ${only.length ? only.join(', ') : 'all areas'}`)
for (const l of LANGS) {
  const n = missing[l].length
  console.log(`  ${l}: ${n ? `${n} missing` : 'complete'}`)
  if (n && !quiet) for (const k of missing[l].slice(0, 40)) console.log(`      ${k}`)
  if (n > 40 && !quiet) console.log(`      … and ${n - 40} more`)
  problems += n
}

// ----- hard-coded English in converted files -----
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx$/.test(f)) out.push(p)
  }
  return out
}
const SRC = join(root, 'src/renderer/src')
const README = readFileSync(join(root, 'src/renderer/src/i18n/README.md'), 'utf8')
const areaOf = (rel) => {
  const name = rel.split('/').pop()
  const m = README.split('\n').find((l) => l.includes(`\`${name}\``) || l.includes(`\`${rel}\``))
  return m ? (/\*\*(\w+)\*\*/.exec(m)?.[1] ?? null) : null
}
const files = walk(SRC).filter((f) => !f.includes('/i18n/'))
let flagged = 0
const unconverted = []
for (const f of files) {
  const rel = relative(SRC, f)
  const area = areaOf(rel)
  if (only.length && !only.includes(area ?? '')) continue
  const src = readFileSync(f, 'utf8')
  const converted = /from '(@\/i18n|\.\/i18n|\.\.\/i18n)'/.test(src)
  const lines = src.split('\n')
  const hits = []
  lines.forEach((line, i) => {
    if (/i18n-ignore/.test(line) || /^\s*(\/\/|\*|\/\*)/.test(line)) return
    // JSX text: >Words like this<  or a line of plain words inside JSX
    const jsxText = /(^|>)\s*([A-Z][a-z’']+(?:[ ,.’'&;:!?-]+[A-Za-z’']+)+[.…!?]?)\s*(<|$)/.exec(line)
    const attr = /\b(title|placeholder|aria-label|label)="([A-Za-z][^"]*[a-z][^"]*)"/.exec(line)
    const isCode = jsxText && /[=(){};]|=>|\bconst\b|\breturn\b|\bimport\b/.test(line)
    if (jsxText && !isCode && /[a-z]{2,}/.test(jsxText[2])) hits.push(`${i + 1}: ${jsxText[2].trim()}`)
    else if (attr) hits.push(`${i + 1}: ${attr[1]}="${attr[2]}"`)
  })
  if (!converted) {
    if (hits.length) unconverted.push(`${rel} (${hits.length})${area ? ` [${area}]` : ''}`)
    continue
  }
  if (hits.length) {
    console.log(`\n⚠ ${rel}: possible hard-coded English`)
    for (const h of hits.slice(0, 30)) console.log(`    ${h}`)
    flagged += hits.length
  }
}
if (unconverted.length && !quiet) {
  console.log(`\nNot converted yet (no '@/i18n' import; English-looking lines):`)
  for (const u of unconverted) console.log(`  ${u}`)
}
problems += flagged
console.log(problems ? `\n${problems} problem(s).` : '\nAll good.')
process.exit(problems ? 1 : 0)
