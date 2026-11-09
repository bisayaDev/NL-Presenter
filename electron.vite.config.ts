import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, normalize, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig as defineElectron } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = { '@shared': resolve('src/shared') }

/** pdf.js data files (fonts, character maps, image decoders) served at /pdfjs/… in dev and copied into the build. */
function pdfjsAssets(): Plugin {
  const root = resolve('node_modules/pdfjs-dist')
  const dirs = ['cmaps', 'standard_fonts', 'wasm', 'iccs']
  return {
    name: 'nl-pdfjs-assets',
    configureServer(server) {
      server.middlewares.use('/pdfjs', (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? '').split('?')[0])).replace(/^[/\\]+/, '')
        const file = join(root, rel)
        if (!dirs.includes(rel.split(/[/\\]/)[0]) || !file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next()
        if (file.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm')
        createReadStream(file).pipe(res)
      })
    },
    generateBundle() {
      for (const d of dirs)
        for (const f of readdirSync(join(root, d)))
          this.emitFile({ type: 'asset', fileName: `pdfjs/${d}/${f}`, source: readFileSync(join(root, d, f)) })
    }
  }
}

export default defineElectron({
  main: {
    resolve: { alias: shared }
  },
  preload: {
    resolve: { alias: shared }
  },
  renderer: {
    resolve: {
      alias: { ...shared, '@': resolve('src/renderer/src') }
    },
    plugins: [react(), tailwindcss(), pdfjsAssets()]
  }
})
