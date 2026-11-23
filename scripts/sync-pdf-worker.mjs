// Copies the pdf.js worker out of node_modules into public/ so the viewer,
// the PDF toolkit and the text extractor can load it from a stable, versioned
// URL without bundler gymnastics. The worker version MUST match the
// pdfjs-dist package version — which is guaranteed because the file is copied
// from that same package on every install.
//
// Wired as a package.json "postinstall" script. If you bump pdfjs-dist and
// forget the hook, the page still guards: pdf-loader.ts fetches
// /pdf.worker.min.mjs and fails loudly if it does not exist.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const src = join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const outDir = join(root, 'public')
const out = join(outDir, 'pdf.worker.min.mjs')

if (!existsSync(src)) {
  console.error('[sync-pdf-worker] pdfjs-dist worker not found — is the package installed?')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
copyFileSync(src, out)
const kb = Math.round(statSync(out).size / 1024)
console.log(`[sync-pdf-worker] public/pdf.worker.min.mjs written (${kb} KB)`)
