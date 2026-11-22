/**
 * Generate ShareOnWeb PWA icons from the brand motif (Waypoints mark on the
 * brand-green tile). Run: bun run scripts/gen-icons.ts
 *
 * Outputs:
 *   public/icons/icon-192.png
 *   public/icons/icon-512.png
 *   public/icons/icon-maskable-512.png  (extra safe-zone padding)
 *   public/icons/apple-touch-icon.png   (180, opaque tile)
 *   public/favicon.svg                  (vector favicon)
 *   public/icon.svg                     (vector master icon)
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

// oklch(0.596 0.145 163.225) -> sRGB hex (the light-mode --primary).
function oklchToHex(L: number, C: number, Hdeg: number): string {
  const h = (Hdeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l_ = (L + 0.3963377774 * a + 0.2158037575 * b) ** 3
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  let r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
  let g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
  let bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
  const g1 = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)
  r = g1(r); g = g1(g); bl = g1(bl)
  const to255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)))
  return '#' + [r, g, bl].map((v) => to255(v).toString(16).padStart(2, '0')).join('')
}

const PRIMARY = oklchToHex(0.596, 0.145, 163.225) // brand green
const DEEPER = oklchToHex(0.50, 0.135, 163) // gradient stop

/** Waypoints motif centered in a size×size viewBox, stroke scaled by factor. */
function motif(size: number, scale = 1, pad = 0): string {
  // Baseline geometry on a 512 tile, proportionally scaled.
  const s = scale
  const cx = size / 2
  const nodes = [
    { x: cx, y: 128 * s }, // top
    { x: 132 * s, y: 356 * s }, // bottom-left
    { x: 380 * s, y: 356 * s }, // bottom-right
  ]
  const r = 34 * s
  const sw = 26 * s
  const p = pad
  const lines = [
    `M ${nodes[0].x} ${nodes[0].y} L ${nodes[1].x} ${nodes[1].y}`,
    `M ${nodes[0].x} ${nodes[0].y} L ${nodes[2].x} ${nodes[2].y}`,
    `M ${nodes[1].x} ${nodes[1].y} L ${nodes[2].x} ${nodes[2].y}`,
  ]
    .map((d) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round"/>`)
    .join('\n  ')
  const circles = nodes
    .map(
      (n) =>
        `<circle cx="${n.x + p / 2}" cy="${n.y + p}" r="${r}" fill="#fff"/>`,
    )
    .join('\n  ')
  return `${lines}\n  ${circles}`
}

function tileSvg(size: number, radius: number, pad = 0): string {
  const scale = size / 512
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PRIMARY}"/>
      <stop offset="1" stop-color="${DEEPER}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  ${motif(size, scale, pad)}
</svg>`
}

async function main() {
  mkdirSync(join(ROOT, 'public/icons'), { recursive: true })

  // Regular icons — motif fills the tile.
  await sharp(Buffer.from(tileSvg(512, 112))).png().toFile(join(ROOT, 'public/icons/icon-512.png'))
  await sharp(Buffer.from(tileSvg(192, 42))).png().toFile(join(ROOT, 'public/icons/icon-192.png'))

  // Maskable — content pulled into the 80% safe zone on an opaque tile.
  const mScale = 0.72
  const mPad = (512 - 512 * mScale) / 2
  const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PRIMARY}"/>
      <stop offset="1" stop-color="${DEEPER}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(${mPad} ${mPad}) scale(${mScale})">
    ${motif(512, 1)}
  </g>
</svg>`
  await sharp(Buffer.from(maskSvg)).png().toFile(join(ROOT, 'public/icons/icon-maskable-512.png'))

  // Apple touch icon — opaque, 180px (iOS fills its own rounded corners).
  await sharp(Buffer.from(tileSvg(180, 0))).png().toFile(join(ROOT, 'public/icons/apple-touch-icon.png'))

  // Vector favicon (transparent-friendly: white tile ring + green tile).
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${tileSvg(512, 112).replace(/<svg[^>]*>|<\/svg>/g, '')}
</svg>`
  await sharp(Buffer.from(tileSvg(512, 112))).toFile(join(ROOT, 'public/icon.svg'))
  await Bun.write(join(ROOT, 'public/favicon.svg'), favicon)

  console.log('icons written. primary =', PRIMARY)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
