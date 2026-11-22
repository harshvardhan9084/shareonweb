// Builds the social/GEO sharing cards (1200x630):
//   public/og.png          — the site card
//   public/og/<appId>.png  — one branded card per live tool
// Run: bun brand/build-og.mjs   (requires the Bricolage Grotesque variable
// font in ~/.fonts — see brand/README.md)
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'
import { APPS } from '../src/lib/registry.ts'

const NODE = '#079fc2'
const EDGE = '#00866d'
const TINT = '#f2f9fb'
const INK = '#0e3a30'
const MUTED = '#55746a'

// The v3 glyph drawn inline so every card matches the favicon exactly.
function glyph(x, y, scale) {
  return `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <g fill="none" stroke="${EDGE}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">
      <path d="M256 134 L256 172"/>
      <path d="M256 172 L136 234"/>
      <path d="M256 172 L376 234"/>
      <path d="M136 234 L256 414"/>
      <path d="M376 234 L256 414"/>
    </g>
    <rect x="220" y="62" width="72" height="72" rx="8" fill="${NODE}"/>
    <rect x="60" y="248" width="72" height="72" rx="8" fill="${NODE}"/>
    <rect x="380" y="248" width="72" height="72" rx="8" fill="${NODE}"/>
    <rect x="220" y="378" width="72" height="72" rx="8" fill="${NODE}"/>
    <rect x="243" y="159" width="26" height="26" rx="6" fill="${EDGE}"/>
    <rect x="123" y="221" width="26" height="26" rx="6" fill="${EDGE}"/>
    <rect x="363" y="221" width="26" height="26" rx="6" fill="${EDGE}"/>
    <circle cx="256" cy="274" r="46" fill="${NODE}"/>
  </g>`
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Greedy word-wrap tuned for Bricolage Grotesque 500 (~0.54em average advance).
function wrap(text, size, maxWidth) {
  const charW = size * 0.54
  const maxChars = Math.floor(maxWidth / charW)
  const words = text.split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (next.length <= maxChars) line = next
    else {
      if (line) lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

const svgFor = ({ name, tagline }) => {
  const nameSize = name.length <= 14 ? 108 : name.length <= 22 ? 88 : 72
  const nameW = 1200 - 160
  const tagLines = wrap(tagline, 34, nameW)
  const nameY = 300
  const tagStartY = nameY + 66
  const tagSvg = tagLines
    .map((l, i) => {
      const isLast = i === tagLines.length - 1
      const suffix = isLast ? '' : ''
      return `<text x="80" y="${tagStartY + i * 46}" font-family="Bricolage Grotesque" font-weight="500"
        font-size="34" fill="${INK}">${esc(l)}${suffix}</text>`
    })
    .join('\n')
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${TINT}"/>
  ${glyph(76, 62, 0.17)}
  <text x="172" y="136" font-family="Bricolage Grotesque" font-weight="800" font-size="34"
        letter-spacing="-0.8" fill="${EDGE}">ShareOnWeb</text>
  <text x="80" y="${nameY}" font-family="Bricolage Grotesque" font-weight="800" font-size="${nameSize}"
        letter-spacing="-2" fill="${EDGE}">${esc(name)}</text>
  ${tagSvg}
  <line x1="80" y1="556" x2="1120" y2="556" stroke="${EDGE}" stroke-opacity="0.25" stroke-width="2"/>
  <text x="80" y="596" font-family="Bricolage Grotesque" font-weight="500" font-size="24"
        fill="${MUTED}">Free · No accounts · Nothing stored · Runs straight between browsers</text>
</svg>`
}

await mkdir('public/og', { recursive: true })

// Site card (unchanged design).
const siteSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${TINT}"/>
  ${glyph(229.6, 153, 0.34)}
  <text x="415" y="276" font-family="Bricolage Grotesque" font-weight="800" font-size="96"
        letter-spacing="-2.5" fill="${EDGE}">ShareOnWeb</text>
  <text x="600" y="430" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="500"
        font-size="34" fill="${INK}">Practical tools that run straight between browsers.</text>
  <text x="600" y="492" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="500"
        font-size="24" fill="${MUTED}">31 tools · No accounts · Nothing stored · Sessions expire</text>
</svg>`
await sharp(Buffer.from(siteSvg), { density: 96 }).resize(1200, 630).png().toFile('public/og.png')
console.log('wrote public/og.png')

// One branded card per live tool.
let n = 0
for (const app of APPS) {
  if (app.status !== 'live') continue
  await sharp(Buffer.from(svgFor(app)), { density: 96 })
    .resize(1200, 630)
    .png()
    .toFile(`public/og/${app.id}.png`)
  n++
}
console.log(`wrote public/og/*.png for ${n} live tools`)
