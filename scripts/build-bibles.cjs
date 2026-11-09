// Converts eBible.org "_vpl.xml" files into the compact bundles the app ships with.
// Usage: node scripts/build-bibles.cjs <ebible-dir> [...]  (each dir holds <id>_vpl.xml)
// Output: resources/bibles/<abbrev>.tsv.gz: first line JSON metadata, then "book\tchapter\tverse\ttext".
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const CODES = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ')
const META = {
  'eng-kjv': { id: 'kjv', name: 'King James Version', abbrev: 'KJV', lang: 'en', license: 'Public domain (1769 text). Source: eBible.org' },
  'eng-asv': { id: 'asv', name: 'American Standard Version', abbrev: 'ASV', lang: 'en', license: 'Public domain (1901). Source: eBible.org' },
  tglulb: { id: 'tlulb', name: 'Tagalog Unlocked Literal Bible', abbrev: 'TLULB', lang: 'tl', license: '© 2018 Door43 World Missions Community. CC BY-SA 4.0. Source: eBible.org' }
}
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&')

const outDir = path.join(__dirname, '../resources/bibles')
fs.mkdirSync(outDir, { recursive: true })
for (const dir of process.argv.slice(2)) {
  const key = path.basename(dir)
  const meta = META[key]
  if (!meta) throw new Error(`No metadata for ${key}`)
  const xml = fs.readFileSync(path.join(dir, `${key}_vpl.xml`), 'utf8')
  const rows = []
  for (const m of xml.matchAll(/<v b="(\w+)" c="(\d+)" v="(\d+)">([\s\S]*?)<\/v>/g)) {
    const book = CODES.indexOf(m[1]) + 1
    if (!book) continue // skip apocrypha
    const text = decode(m[4]).replace(/¶/g, '').replace(/\s+/g, ' ').trim()
    if (text) rows.push(`${book}\t${m[2]}\t${m[3]}\t${text}`)
  }
  const out = path.join(outDir, `${meta.id}.tsv.gz`)
  fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(meta) + '\n' + rows.join('\n'), { level: 9 }))
  console.log(meta.abbrev, rows.length, 'verses', Math.round(fs.statSync(out).size / 1024) + 'KB')
}
