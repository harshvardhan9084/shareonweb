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
    page.drawText(`Fixture generated for Toolhive browser QA.`, {
      x: 60, y: 720, size: 11, font, color: rgb(0.3, 0.3, 0.3),
    })
    page.drawRectangle({ x: 60, y: 500, width: 200, height: 120, color: rgb(0.9, 0.96, 0.98) })
  }
  const bytes = await doc.save()
  const fs = await import('node:fs')
  fs.writeFileSync(join(OUT, name), bytes)
  console.log(`wrote ${name} (${pages} pages, ${bytes.length} B)`)
}

await makePdf('test-3pages.pdf', 3, 'Toolhive fixture')
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
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Toolhive QA Letter</w:t></w:r></w:p>
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
    <dc:title>Toolhive QA Book</dc:title>
    <dc:creator>Toolhive Fixtures</dc:creator>
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
console.log('fixtures ready in ' + OUT)
