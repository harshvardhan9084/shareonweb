'use client'

// PDF Compressor — the rasterization route, stated plainly: each page is
// rendered by pdf.js at a chosen scale, encoded as JPEG at a chosen quality,
// and the JPEGs are rebuilt into a fresh PDF with pdf-lib at the original
// page size. That genuinely shrinks scan-heavy and image-heavy PDFs, and it
// equally honestly costs text selectability — the page says so before you
// run it. Vector-heavy files can come out LARGER; the result panel names the
// outcome either way. Everything runs in this tab.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DropZone, PrivacyStrip, downloadBlob, formatBytes } from '@/components/instant/instant-kit'
import { fileToPdfData, getPdfjs, pdfToBlob } from '@/lib/pdf-loader'
import { cn } from '@/lib/utils'

const PAGE_CAP = 100

interface CompressionResult {
  url: string
  beforeBytes: number
  afterBytes: number
  pages: number
  widthPt: number
  heightPt: number
}

export function PdfCompressTool() {
  const [fileName, setFileName] = useState('')
  const [originalBytes, setOriginalBytes] = useState(0)
  const [scale, setScale] = useState(1)
  const [quality, setQuality] = useState(0.6)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<CompressionResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<File | null>(null)
  const runId = useRef(0)

  const compress = useCallback(async (file: File, scale: number, quality: number) => {
    const id = ++runId.current
    setBusy(true)
    setError('')
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
    setOriginalBytes(file.size)
    try {
      const pdfjs = await getPdfjs()
      const data = await fileToPdfData(file)
      const doc = await pdfjs.getDocument({ data }).promise
      const total = Math.min(doc.numPages, PAGE_CAP)

      // pdf-lib is imported lazily too: it only reaches the browser when a
      // compression actually runs.
      const { PDFDocument } = await import('pdf-lib')
      const out = await PDFDocument.create()

      setProgress({ done: 0, total })
      for (let i = 1; i <= total; i++) {
        if (runId.current !== id) return // superseded by a newer run
        const page = await doc.getPage(i)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas is unavailable in this browser')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport, canvas }).promise
        const jpgBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', quality),
        )
        if (!jpgBlob) throw new Error('The browser refused to encode the page')
        const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer())
        const img = await out.embedJpg(jpgBytes)
        // The new page keeps the ORIGINAL point size (scale-1 viewport), so
        // print dimensions never change — only the pixel density does.
        const newPage = out.addPage([base.width, base.height])
        newPage.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height })
        setProgress({ done: i, total })
        page.cleanup()
      }
      if (doc.numPages > PAGE_CAP) {
        setError(`Only the first ${PAGE_CAP} of ${doc.numPages} pages were compressed — tab memory is the honest limit. Split the file for the rest.`)
      }
      const bytes = await out.save()
      doc.destroy()
      if (runId.current !== id) return
      const blob = pdfToBlob(bytes)
      setResult({
        url: URL.createObjectURL(blob),
        beforeBytes: file.size,
        afterBytes: blob.size,
        pages: total,
        widthPt: Math.round((await out.getPage(0)).getWidth()),
        heightPt: Math.round((await out.getPage(0)).getHeight()),
      })
    } catch (e) {
      if (runId.current === id) {
        setError(e instanceof Error ? e.message : 'This PDF could not be read. Encrypted or malformed files are named honestly.')
      }
    } finally {
      if (runId.current === id) setBusy(false)
    }
  }, [])

  // Re-run with explicit values — setState is async, so the handlers pass
  // the new settings directly instead of reading state that may not be
  // applied yet.

  useEffect(() => {
    return () => {
      runId.current++
    }
  }, [])

  const onFiles = (files: File[]) => {
    const file = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (!file) {
      setError('That is not a PDF. Drop a .pdf file.')
      return
    }
    fileRef.current = file
    setFileName(file.name)
    void compress(file, scale, quality)
  }

  const delta = result ? result.afterBytes - result.beforeBytes : 0
  const pct = result && result.beforeBytes > 0 ? Math.round((delta / result.beforeBytes) * 100) : 0

  return (
    <div className="space-y-4">
      <DropZone
        onFiles={onFiles}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Drop a PDF to compress"
        hint="Rasterized and rebuilt inside this tab — nothing uploads"
      />

      {fileName && (
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex-1 min-w-48">
              <Label htmlFor="cp-scale" className="text-xs text-muted-foreground">
                Render scale — {scale}× ({scale === 0.75 ? 'smallest' : scale === 1 ? 'screen' : scale === 1.5 ? 'sharp' : 'retina'})
              </Label>
              <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Render scale">
                {[0.75, 1, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setScale(s); if (fileRef.current && !busy) void compress(fileRef.current, s, quality) }}
                    aria-pressed={scale === s}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      scale === s ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                    )}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-48">
              <Label htmlFor="cp-quality" className="text-xs text-muted-foreground">
                JPEG quality — {Math.round(quality * 100)}%
              </Label>
              <input
                id="cp-quality"
                type="range"
                min={0.3}
                max={0.95}
                step={0.05}
                value={quality}
                onChange={(e) => {
                  const q = Number(e.target.value)
                  setQuality(q)
                  if (fileRef.current && !busy) void compress(fileRef.current, scale, q)
                }}
                className="mt-2 w-full accent-primary"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current && !busy && void compress(fileRef.current, scale, quality)} disabled={busy}>
              Re-compress
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Changing the settings re-runs the compression on {fileName}. Lower scale and quality mean a smaller file; page dimensions stay at the original print size either way.
          </p>
        </div>
      )}

      {busy && progress && (
        <div className="rounded-xl border bg-card p-4" role="status" aria-live="polite">
          <p className="text-sm font-medium">Compressing… rendered {progress.done}/{progress.total}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-xl border bg-card p-4 sm:p-5" aria-live="polite">
          <h2 className="text-sm font-semibold">Result</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">Before</p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{formatBytes(result.beforeBytes)}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">After</p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{formatBytes(result.afterBytes)}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">Change</p>
              <p className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${delta < 0 ? 'text-primary' : 'text-destructive'}`}>
                {delta < 0 ? '−' : '+'}{formatBytes(Math.abs(delta))} ({delta < 0 ? '' : '+'}{pct}%)
              </p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">Pages</p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{result.pages}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {delta < 0
              ? `Smaller by ${Math.abs(pct)}% — the JPEG re-encode won. Page size stays ${result.widthPt}×${result.heightPt} pt (the original print dimensions).`
              : `This file came out ${pct}% LARGER: it is vector-heavy (text, line art), and rasterization can only lose that compression. Use the original; no pretending.`}
            {' '}The pages are now images — text is no longer selectable or searchable.
          </p>
          <Button
            type="button"
            className="mt-3"
            onClick={() => {
              const base = fileName.replace(/\.pdf$/i, '')
              downloadBlob(result.url, `${base}.compressed.pdf`)
            }}
          >
            <Download className="size-4" aria-hidden="true" /> Download compressed PDF
          </Button>
        </div>
      )}

      <PrivacyStrip detail="Compression happens entirely in this tab: pdf.js renders the pages to canvases, pdf-lib rebuilds the file in memory, and the download comes straight from your browser. There is no upload code on this page." />
    </div>
  )
}
