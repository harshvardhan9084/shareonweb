'use client'

// PDF to Image Studio — every page rendered to a canvas by pdf.js (the same
// engine Firefox uses), exported as PNG or JPG at 1×/2×/3×, one page or a
// ZIP of the run. The PDF is parsed and rasterized inside this tab; there is
// no upload code on the page.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DropZone, DownloadAllButton, downloadBlob, formatBytes, PrivacyStrip } from '@/components/instant/instant-kit'
import { fileToPdfData, getPdfjs } from '@/lib/pdf-loader'
import { cn } from '@/lib/utils'

interface RenderedPage {
  page: number
  blob: Blob
  url: string
  width: number
  height: number
}

const PAGE_CAP = 100

export function PdfToImageTool() {
  const [fileName, setFileName] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [pages, setPages] = useState<RenderedPage[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [scale, setScale] = useState(2)
  const [format, setFormat] = useState<'png' | 'jpg'>('png')
  const [quality, setQuality] = useState(0.92)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<File | null>(null)
  const runId = useRef(0)

  const cleanup = () => {
    setPages((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.url)
      return []
    })
  }

  const renderAll = useCallback(async (file: File, scale: number, format: 'png' | 'jpg', quality: number) => {
    const id = ++runId.current
    setBusy(true)
    setError('')
    cleanup()
    try {
      const pdfjs = await getPdfjs()
      const data = await fileToPdfData(file)
      const doc = await pdfjs.getDocument({ data }).promise
      const total = Math.min(doc.numPages, PAGE_CAP)
      setPageCount(doc.numPages)
      setProgress({ done: 0, total })
      const out: RenderedPage[] = []
      for (let i = 1; i <= total; i++) {
        if (runId.current !== id) return // superseded by a newer run
        const page = await doc.getPage(i)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas is unavailable in this browser')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height) // JPG has no alpha
        await page.render({ canvasContext: ctx, viewport, canvas }).promise
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, format === 'png' ? 'image/png' : 'image/jpeg', quality),
        )
        if (!blob) throw new Error('The browser refused to encode the page')
        const entry: RenderedPage = {
          page: i,
          blob,
          url: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
        }
        out.push(entry)
        if (runId.current === id) {
          setPages([...out])
          setProgress({ done: i, total })
        }
        page.cleanup()
      }
      if (doc.numPages > PAGE_CAP) {
        setError(`Rendered the first ${PAGE_CAP} of ${doc.numPages} pages — this browser tab's memory is the honest limit. Split the file and run the rest.`)
      }
      doc.destroy()
    } catch (e) {
      if (runId.current === id) {
        setError(e instanceof Error ? e.message : 'This PDF could not be read. Encrypted or malformed files are named honestly.')
      }
    } finally {
      if (runId.current === id) setBusy(false)
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
    void renderAll(file, scale, format, quality)
  }

  // Re-render on setting changes when a file is loaded.
  const rerender = () => {
    if (fileRef.current) void renderAll(fileRef.current, scale, format, quality)
  }

  useEffect(() => {
    return () => {
      runId.current++
      setPages((prev) => {
        for (const p of prev) URL.revokeObjectURL(p.url)
        return []
      })
    }
  }, [])

  const baseName = fileName.replace(/\.pdf$/i, '')
  const pageFile = (p: RenderedPage) => `${baseName || 'pdf'}-page-${String(p.page).padStart(2, '0')}.${format}`
  const totalSize = pages.reduce((a, p) => a + p.blob.size, 0)

  const downloadOne = (p: RenderedPage) => downloadBlob(p.blob, pageFile(p))

  const downloadZip = async () => {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const p of pages) zip.file(pageFile(p), p.blob)
    const out = await zip.generateAsync({ type: 'blob' })
    downloadBlob(out, `${baseName || 'pdf'}-images.zip`)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        {!fileName && (
          <DropZone
            onFiles={onFiles}
            accept="application/pdf,.pdf"
            multiple={false}
            title="Drop a PDF to turn its pages into images"
            hint="Parsed and rendered by pdf.js inside this tab — nothing uploads"
          />
        )}

        {fileName && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="rounded-md border bg-muted/40 px-2.5 py-1 text-xs font-medium">{fileName}</span>
                {pageCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {pageCount} page{pageCount === 1 ? '' : 's'}
                    {progress && ` · rendered ${progress.done}/${progress.total}`}
                  </span>
                )}
                {pages.length > 0 && <span className="text-xs text-muted-foreground">· {formatBytes(totalSize)} total</span>}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  fileRef.current = null
                  setFileName('')
                  setPageCount(0)
                  setProgress(null)
                  setError('')
                  cleanup()
                }}
              >
                <X className="size-4" aria-hidden="true" /> Choose another PDF
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p2i-scale">Scale</Label>
                <select
                  id="p2i-scale"
                  value={scale}
                  onChange={(e) => { setScale(Number(e.target.value)); rerender() }}
                  disabled={busy}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  <option value={1}>1× (screen)</option>
                  <option value={2}>2× (print)</option>
                  <option value={3}>3× (high-res)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p2i-format">Format</Label>
                <select
                  id="p2i-format"
                  value={format}
                  onChange={(e) => { setFormat(e.target.value as 'png' | 'jpg'); rerender() }}
                  disabled={busy}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="png">PNG (lossless)</option>
                  <option value="jpg">JPG (smaller)</option>
                </select>
              </div>
              {format === 'jpg' && (
                <div className="space-y-1.5">
                  <Label htmlFor="p2i-quality">JPG quality</Label>
                  <input
                    id="p2i-quality"
                    type="range"
                    min={0.4}
                    max={1}
                    step={0.02}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    onMouseUp={rerender}
                    onTouchEnd={rerender}
                    className="w-40"
                  />
                  <span className="ml-1 font-mono text-xs text-muted-foreground">{Math.round(quality * 100)}%</span>
                </div>
              )}
            </div>

            {progress && progress.done < progress.total && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            {pages.length > 0 && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {pages.map((p) => (
                    <figure key={p.page} className="group relative overflow-hidden rounded-lg border bg-muted/30">
                      <img src={p.url} alt={`Page ${p.page} rendered at ${p.width}×${p.height}`} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                      <figcaption className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs">
                        <span className="font-medium">Page {p.page}</span>
                        <span className="text-muted-foreground">{p.width}×{p.height}</span>
                      </figcaption>
                      <button
                        type="button"
                        onClick={() => downloadOne(p)}
                        className="absolute inset-x-2 bottom-9 flex items-center justify-center gap-1.5 rounded-md bg-background/90 px-2 py-1.5 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label={`Download page ${p.page} as ${format.toUpperCase()}`}
                      >
                        <Download className="size-3.5" aria-hidden="true" /> Download
                      </button>
                    </figure>
                  ))}
                </div>
                <div className={cn('mt-4 flex flex-wrap items-center gap-2.5', busy && 'pointer-events-none opacity-60')}>
                  <Button type="button" onClick={downloadZip} disabled={pages.length < 2}>
                    <Download className="size-4" aria-hidden="true" />
                    {busy ? 'Rendering…' : `Download all ${pages.length} as ZIP`}
                  </Button>
                  <span className="text-xs text-muted-foreground">Hover a page for its single download.</span>
                </div>
              </>
            )}
          </>
        )}

        <PrivacyStrip detail="The PDF is read into this tab's memory, each page is rasterized by pdf.js onto a local canvas, and the images are written straight to your downloads. There is no upload step anywhere on this page." />
      </div>
    </div>
  )
}
