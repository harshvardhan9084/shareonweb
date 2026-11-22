// Rasterizes the brand SVG sources into public/icons/ using sharp.
// Run: bun brand/build-icons.mjs
import { readFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const jobs = [
  { src: 'brand/logo.svg', out: 'public/icons/icon-512.png', size: 512 },
  { src: 'brand/logo.svg', out: 'public/icons/icon-192.png', size: 192 },
  { src: 'brand/maskable.svg', out: 'public/icons/icon-maskable-512.png', size: 512 },
  { src: 'brand/apple-touch.svg', out: 'public/icons/apple-touch-icon.png', size: 180 },
  // legibility previews (not shipped)
  { src: 'brand/logo.svg', out: 'brand/preview/mark-16.png', size: 16 },
  { src: 'brand/logo.svg', out: 'brand/preview/mark-32.png', size: 32 },
  { src: 'brand/logo.svg', out: 'brand/preview/mark-64.png', size: 64 },
]

await mkdir('brand/preview', { recursive: true })
for (const j of jobs) {
  const svg = await readFile(j.src)
  await sharp(svg, { density: 512 })
    .resize(j.size, j.size)
    .png()
    .toFile(j.out)
  console.log('wrote', j.out)
}
