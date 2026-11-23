'use client'

// Images → PDF — turn a set of photos or scans into one PDF on this device.
// Page size (fit-to-image, A4, Letter), orientation, margins and ordering
// are all under your control; pdf-lib does the assembly, the browser's own
// canvas normalizes anything that is not already a PNG or JPEG.

import { useMemo, useState } from 'react'
import {
  ArrowDown, ArrowUp, FileDown, FileImage, Loader2, Trash2,
} from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { pdfToBlob } from '@/lib/pdf-loader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropZone, downloadBlob, formatBytes, PrivacyStrip,
} from '@/components/instant/instant-kit'

type PageSize = 'fit' | 'a4' | 'letter'
type Orientation = 'auto' | 'portrait' | 'landscape'
type Margin = 0 | 18 | 36

interface Item {
  file: File
  id: string
}

const A4: [number, number] = [595.28, 841.89]
const LETTER: [number, number] = [612, 792]
const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|bmp|avif)$/

function isImage(f: File): boolean {
  return IMAGE_TYPES.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name)
}

/** Decode an image and normalize it to JPEG bytes (EXIF orientation applied). */
async function toJpeg(file: File, quality: number): Promise<Uint8Array> {
  const bitmap = await (async () => {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      return await createImageBitmap(file)
    }
  })()
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff' // flatten transparency for JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality),
  )
  return new Uint8Array(await blob.arrayBuffer())
}

export function ImagesToPdfTool() {
  const [items, setItems] = useState<Item[]>([])
  const [outName, setOutName] = useState('images.pdf')
  const [pageSize, setPageSize] = useState<PageSize>('a4')
  const [orientation, setOrientation] = useState<Orientation>('auto')
  const [margin, setMargin] = useState<Margin>(18)
  const [quality, setQuality] = useState(0.92)
  const [building, setBuilding] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resultSize, setResultSize] = useState<number | null>(null)

  const totalSize = useMemo(() => items.reduce((s, i) => s + i.file.size, 0), [items])

  function addFiles(files: File[]) {
    setError(null)
    setResultSize(null)
    const imgs = files.filter(isImage)
    if (imgs.length === 0) {
      setError('Drop image files — JPEG, PNG, WebP, GIF, BMP or AVIF.')
      return
    }
    const skipped = files.length - imgs.length
    if (skipped > 0) setError(`${skipped} non-image file${skipped === 1 ? ' was' : 's were'} skipped.`)
    setItems((prev) => [
      ...prev,
      ...imgs.map((f, i) => ({ file: f, id: `${Date.now()}-${prev.length}-${i}-${f.name}` })),
    ])
  }

  function move(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const to = idx + dir
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [m] = next.splice(idx, 1)
      next.splice(to, 0, m)
      return next
    })
  }

  async function build() {
    if (items.length === 0) return
    setBuilding(true)
    setError(null)
    setResultSize(null)
    try {
      const out = await PDFDocument.create()
      for (let i = 0; i < items.length; i++) {
        setProgress(`Embedding image ${i + 1} of ${items.length}…`)
        const { file } = items[i]
        const bytes = new Uint8Array(await file.arrayBuffer())
        let embed: Awaited<ReturnType<typeof out.embedJpg>>
        let iw: number
        let ih: number
        if (file.type === 'image/png' || /\.png$/i.test(file.name)) {
          try {
            embed = await out.embedPng(bytes)
            iw = embed.width
            ih = embed.height
          } catch {
            // Some "PNGs" are actually re-labeled JPEGs — fall through to decode.
            const jpg = await toJpeg(file, quality)
            embed = await out.embedJpg(jpg)
            iw = embed.width
            ih = embed.height
          }
        } else if (file.type === 'image/jpeg' || /\.(jpe?g)$/i.test(file.name)) {
          // Canvas-normalize so EXIF rotation is baked in honestly.
          const jpg = await toJpeg(file, quality)
          embed = await out.embedJpg(jpg)
          iw = embed.width
          ih = embed.height
        } else {
          const jpg = await toJpeg(file, quality)
          embed = await out.embedJpg(jpg)
          iw = embed.width
          ih = embed.height
        }

        let pw: number
        let ph: number
        if (pageSize === 'fit') {
          pw = iw
          ph = ih
        } else {
          const [short, long] = pageSize === 'a4' ? A4 : LETTER
          const landscape =
            orientation === 'landscape' || (orientation === 'auto' && iw > ih)
          ;[pw, ph] = landscape ? [long, short] : [short, long]
        }
        const page = out.addPage([pw, ph])
        const m = pageSize === 'fit' ? 0 : margin
        const scale = Math.min((pw - 2 * m) / iw, (ph - 2 * m) / ih)
        const w = iw * scale
        const h = ih * scale
        page.drawImage(embed, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
      }
      const blob = pdfToBlob(await out.save())
      setResultSize(blob.size)
      const name = outName.endsWith('.pdf') ? outName : `${outName || 'images'}.pdf`
      downloadBlob(blob, name)
    } catch {
      setError('Building the PDF failed — one of the images may be too large for this device\u2019s memory. Try fewer images at once.')
    } finally {
      setBuilding(false)
      setProgress('')
    }
  }

  return (
    <div>
      {items.length === 0 ? (
        <DropZone
          onFiles={addFiles}
          accept="image/*"
          title="Drop images — they become one PDF, in order"
          hint="JPEG, PNG, WebP, GIF, BMP, AVIF. Reorder before building; nothing is uploaded."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div className="flex min-w-0 items-center gap-3">
              <FileImage className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {items.length} image{items.length === 1 ? '' : 's'} · {formatBytes(totalSize)}
                </p>
                <p className="text-xs text-muted-foreground">Each image lands on its own page, in this order.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={outName}
                onChange={(e) => setOutName(e.target.value)}
                aria-label="PDF file name"
                className="h-9 w-40"
              />
              <Button size="sm" onClick={build} disabled={building}>
                {building ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
                {building ? progress || 'Building…' : 'Build & download PDF'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setItems([]); setResultSize(null) }}>
                Clear
              </Button>
            </div>
          </div>

          {resultSize !== null && (
            <p className="mt-3 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground" data-testid="images-pdf-result">
              PDF built ({formatBytes(resultSize)}) — check your downloads.
            </p>
          )}

          <section className="mt-3 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Page options">
            <label className="text-xs font-medium text-muted-foreground">
              Page size
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(e.target.value as PageSize); setResultSize(null) }}
                className="mt-1 block h-9 w-full rounded-lg border bg-background px-2 text-sm text-foreground"
              >
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
                <option value="fit">Fit to image</option>
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Orientation
              <select
                value={orientation}
                onChange={(e) => { setOrientation(e.target.value as Orientation); setResultSize(null) }}
                disabled={pageSize === 'fit'}
                className="mt-1 block h-9 w-full rounded-lg border bg-background px-2 text-sm text-foreground disabled:opacity-40"
              >
                <option value="auto">Auto (per image)</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Margin
              <select
                value={margin}
                onChange={(e) => { setMargin(Number(e.target.value) as Margin); setResultSize(null) }}
                disabled={pageSize === 'fit'}
                className="mt-1 block h-9 w-full rounded-lg border bg-background px-2 text-sm text-foreground disabled:opacity-40"
              >
                <option value={0}>None</option>
                <option value={18}>Small (¼″)</option>
                <option value={36}>Large (½″)</option>
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              JPEG quality ({Math.round(quality * 100)}%)
              <input
                type="range"
                min={50}
                max={100}
                value={Math.round(quality * 100)}
                onChange={(e) => { setQuality(Number(e.target.value) / 100); setResultSize(null) }}
                aria-label="JPEG quality"
                className="mt-3 block w-full accent-[--primary]"
              />
            </label>
          </section>

          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-4 rounded-xl border" data-testid="images-pdf-list">
            <ul className="divide-y text-sm">
              {items.map((it, idx) => (
                <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {idx + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-xs">{it.file.name}</span>
                      <span className="text-xs text-muted-foreground">{formatBytes(it.file.size)}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="ghost" aria-label={`Move ${it.file.name} up`} disabled={idx === 0} onClick={() => move(idx, -1)}>
                      <ArrowUp className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Move ${it.file.name} down`} disabled={idx === items.length - 1} onClick={() => move(idx, 1)}>
                      <ArrowDown className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Remove ${it.file.name}`}
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <DropZone
            onFiles={addFiles}
            accept={acceptAll}
            compact
            title="Add more images"
            hint="They join the end of the list."
          />
        </>
      )}
      <PrivacyStrip detail="The PDF is assembled on this device with pdf-lib; images are re-encoded locally by the browser's own canvas. Nothing is uploaded." />
    </div>
  )
}

const acceptAll = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif'
