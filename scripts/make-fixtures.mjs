// Builds the browser-QA fixtures used by scripts/final-qa.sh. Every fixture
// is a REAL file with real structure — generated locally so the QA pass can
// drop them into the instant tools and verify actual parsing/rendering.
//
//   /tmp/qa-fixtures/test-3pages.pdf    3 pages, numbered, readable text
//   /tmp/qa-fixtures/test-2pages.pdf    2 pages, different text
//   /tmp/qa-fixtures/photo.png          480x360 PNG (sharp-rendered SVG)
//   /tmp/qa-fixtures/data.csv           tiny CSV
//   /tmp/qa-fixtures/letter.docx        minimal valid DOCX (headings + paras)
//   /tmp/qa-fixtures/sample.epub        minimal valid EPUB3 (2 chapters)
//
// Run: bun scripts/make-fixtures.mjs
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import sharp from 'sharp'
import JSZip from 'jszip'

const OUT = '/tmp/qa-fixtures'
mkdirSync(OUT, { recursive: true })

// ---------------------------------------------------------------- PDFs
async function makePdf(name, pages, label) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595.28, 841.89])
    page.drawText(`${label} — page ${i} of ${pages}`, {
      x: 60, y: 760, size: 24, font, color: rgb(0.1, 0.25, 0.3),
    })
    page.drawText(`Fixture generated for Kontivo browser QA.`, {
      x: 60, y: 720, size: 11, font, color: rgb(0.3, 0.3, 0.3),
    })
    page.drawRectangle({ x: 60, y: 500, width: 200, height: 120, color: rgb(0.9, 0.96, 0.98) })
  }
  const bytes = await doc.save()
  const fs = await import('node:fs')
  fs.writeFileSync(join(OUT, name), bytes)
  console.log(`wrote ${name} (${pages} pages, ${bytes.length} B)`)
}

await makePdf('test-3pages.pdf', 3, 'Kontivo fixture')
await makePdf('test-2pages.pdf', 2, 'Second document')

// ---------------------------------------------------------------- PNG
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360">
  <rect width="480" height="360" fill="#f2f9fb"/>
  <circle cx="240" cy="180" r="110" fill="#079fc2"/>
  <rect x="60" y="240" width="150" height="70" rx="12" fill="#00866d"/>
</svg>`
await sharp(Buffer.from(svg)).png().toFile(join(OUT, 'photo.png'))
console.log('wrote photo.png')

// ---------------------------------------------------------------- CSV
const fs = await import('node:fs')
fs.writeFileSync(join(OUT, 'data.csv'), 'name,quantity,price\napples,4,1.20\npears,2,1.50\nplums,9,0.80\n')
console.log('wrote data.csv')

// ---------------------------------------------------------------- DOCX
const zip = new JSZip()
zip.file(
  '[Content_Types].xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
)
zip.file(
  '_rels/.rels',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
)
zip.file(
  'word/document.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Kontivo QA Letter</w:t></w:r></w:p>
    <w:p><w:r><w:t>This is the first paragraph of the fixture document. It should render as clean HTML in the sandboxed viewer.</w:t></w:r></w:p>
    <w:p><w:r><w:t>A second paragraph, so text extraction has more than one block to show.</w:t></w:r></w:p>
  </w:body>
</w:document>`,
)
await zip.generateAsync({ type: 'nodebuffer' }).then((b) => fs.writeFileSync(join(OUT, 'letter.docx'), b))
console.log('wrote letter.docx')

// ---------------------------------------------------------------- EPUB
const epub = new JSZip()
epub.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
epub.file(
  'META-INF/container.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
)
epub.file(
  'OEBPS/content.opf',
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:toolhive-qa-0001</dc:identifier>
    <dc:title>Kontivo QA Book</dc:title>
    <dc:creator>Kontivo Fixtures</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2026-11-23T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/></spine>
</package>`,
)
const chapter = (title, paras) => `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${title}</title></head>
<body><h1>${title}</h1>${paras.map((p) => `<p>${p}</p>`).join('\n')}</body></html>`
epub.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title></head>
<body><nav epub:type="toc" id="toc"><h1>Contents</h1>
<ol><li><a href="chapter1.xhtml">Chapter One</a></li><li><a href="chapter2.xhtml">Chapter Two</a></li></ol>
</nav></body></html>`)
epub.file('OEBPS/chapter1.xhtml', chapter('Chapter One', [
  'This is the opening chapter of the QA fixture book. It exists to prove the reader can paginate.',
  'The second paragraph gives the page renderer something more to lay out.',
]))
epub.file('OEBPS/chapter2.xhtml', chapter('Chapter Two', [
  'The closing chapter. Jumping here from the table of contents must work.',
]))
await epub.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }).then((b) => fs.writeFileSync(join(OUT, 'sample.epub'), b))
console.log('wrote sample.epub')

// ---------------------------------------------------------------- media
// tone.wav — 3 s of 440 Hz sine, 16-bit PCM 44.1 kHz mono, written by hand.
{
  const rate = 44100
  const seconds = 3
  const n = rate * seconds
  const data = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) {
    // fade the sine in/out so normalization has a quiet edge to lift
    const t = i / rate
    const env = Math.min(1, t * 4, (seconds - t) * 4)
    const v = Math.sin(2 * Math.PI * 440 * t) * 0.35 * env
    data.writeInt16LE(Math.round(v * 32767), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  fs.writeFileSync(join(OUT, 'tone.wav'), Buffer.concat([header, data]))
  console.log('wrote tone.wav (3 s, 440 Hz sine)')
}

// clip.webm + anim.gif — real ffmpeg outputs (VP9 video; palettized GIF).
{
  const { execFileSync } = await import('node:child_process')
  const mk = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'pipe' })
  // 2 s animated test pattern with a moving element (frames must differ)
  mk([
    '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=15:duration=2',
    '-c:v', 'libvpx-vp9', '-b:v', '200k',
    join(OUT, 'clip.webm'),
  ])
  console.log('wrote clip.webm (2 s VP9)')
  mk([
    '-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=10:duration=1.6',
    '-vf', 'split[a][b];[a]palettegen[p];[b][p]paletteuse',
    join(OUT, 'anim.gif'),
  ])
  console.log('wrote anim.gif (16 frames)')
}

// sample.tar.gz — real tarball with two files and a folder, for Archive Explorer.
{
  const { execFileSync } = await import('node:child_process')
  const rmSync = (p) => fs.rmSync(p, { recursive: true, force: true })
  rmSync(join(OUT, 'tardir'))
  fs.mkdirSync(join(OUT, 'tardir', 'docs'), { recursive: true })
  fs.writeFileSync(join(OUT, 'tardir', 'readme.txt'), 'Kontivo archive fixture — top-level file.\n')
  fs.writeFileSync(join(OUT, 'tardir', 'docs', 'notes.md'), '# Notes\n\nNested inside the docs folder for structure checks.\n')
  execFileSync('tar', ['-czf', join(OUT, 'sample.tar.gz'), '-C', join(OUT, 'tardir'), 'readme.txt', 'docs'])
  rmSync(join(OUT, 'tardir'))
  console.log('wrote sample.tar.gz (2 files + 1 folder)')
}

// photo-text.png — photo.png with two tEXt chunks inserted before IEND,
// so Metadata Cleaner has real PNG text records to show and scrub.
{
  const img = fs.readFileSync(join(OUT, 'photo.png'))
  // CRC32 (PNG polynomial), bit-by-bit — fine for three chunks
  const crcTable = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crcTable[n] = c
  }
  const crc32 = (buf) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const head = Buffer.alloc(4)
    head.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([head, body, crc])
  }
  const text = (kw, value) => chunk('tEXt', Buffer.concat([Buffer.from(kw, 'ascii'), Buffer.alloc(1, 0), Buffer.from(value, 'latin1')]))
  // split at IEND: everything before it, then our chunks, then IEND
  const iend = img.indexOf(Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44])) // length 0 + "IEND"
  const out = Buffer.concat([
    img.subarray(0, iend),
    text('Software', 'Kontivo QA'),
    text('Comment', 'metadata fixture for the scrubber'),
    img.subarray(iend),
  ])
  fs.writeFileSync(join(OUT, 'photo-text.png'), out)
  console.log('wrote photo-text.png (photo.png + 2 tEXt chunks)')
}

// jwt-sample.txt — a real HS256 JWT signed here, with iat/exp relative to now,
// so the inspector shows live expiry distances when the QA runs.
{
  const { createHmac } = await import('node:crypto')
  const b64url = (buf) => Buffer.from(buf).toString('base64url')
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = b64url(
    JSON.stringify({
      sub: 'kontivo-qa',
      name: 'Kontivo QA Token',
      role: 'fixture',
      iat: now,
      exp: now + 3600,
      iss: 'kontivo-fixtures',
    }),
  )
  const sig = b64url(createHmac('sha256', 'kontivo-qa-signing-secret').update(`${header}.${payload}`).digest())
  fs.writeFileSync(join(OUT, 'jwt-sample.txt'), `${header}.${payload}.${sig}\n`)
  console.log('wrote jwt-sample.txt (HS256, 1 h expiry)')
}

console.log('fixtures ready in ' + OUT)
