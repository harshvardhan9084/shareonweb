'use client'

// PDF Viewer — open a PDF and read it right here: page navigation, zoom,
// rotation, and a whole-document search that tells you which pages contain
// what. Rendering happens with pdf.js on this device; the file is never sent
// anywhere.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, FileDown, Loader2, RotateCw, Search, ZoomIn, ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropZone, downloadBlob, formatBytes, PrivacyStrip } from '@/components/instant/instant-kit'
import { fileToPdfData, getPdfjs } from '@/lib/pdf-loader'
import type { PDFDocumentProxy } from 'pdfjs-dist'

interface Hit { page: number; count: number }

const SCALE_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

export function PdfViewTool() {
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState(0)
  const [current, setCurrent] = useState(1)
  const [scaleIdx, setScaleIdx] = useState(2) // 1.0
  const [viewRotate, setViewRotate] = useState(0)
  const [fitWidth, setFitWidth] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jump, setJump] = useState('')

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [searching, setSearching] = useState(false)

  const docRef = useRef<PDFDocumentProxy | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const seqRef = useRef(0)

  useEffect(() => () => { void docRef.current?.destroy() }, [])

  async function handleFiles(files: File[]) {
    const pdf = files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
    if (!pdf) {
      setError('Drop a .pdf file — this viewer opens PDF documents only.')
      return
    }
    setError(null)
    setHits(null)
    setQuery('')
    setCurrent(1)
    setViewRotate(0)
    setScaleIdx(2)
    setFitWidth(true)
    setFile(pdf)
    try {
      const pdfjs = await getPdfjs()
      const doc = await pdfjs.getDocument({ data: await fileToPdfData(pdf), isEvalSupported: false }).promise
      void docRef.current?.destroy()
      docRef.current = doc
      setPages(doc.numPages)
    } catch {
      setError('Could not open that PDF — it may be encrypted (password-protected) or corrupted.')
      setFile(null)
    }
  }

  /** Render the current page into the canvas at the current zoom. */
  const renderPage = useCallback(async (doc: PDFDocumentProxy, pageIdx: number, scale: number, rotation: number) => {
    const seq = ++seqRef.current
    setRendering(true)
    try {
      const page = await doc.getPage(pageIdx)
      const base = page.getViewport({ scale: 1, rotation })
      // fit-width mode computes the scale from the visible stage width
      const stageW = stageRef.current ? stageRef.current.clientWidth - 24 : 800
      const effScale = fitWidth
        ? Math.min(4, Math.max(0.3, (stageW / base.width)))
        : scale
      const viewport = page.getViewport({ scale: effScale, rotation })
      const canvas = canvasRef.current
      if (!canvas || seqRef.current !== seq) return
      const ctx = canvas.getContext('2d')!
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      await page.render({ canvasContext: ctx, viewport }).promise
      page.cleanup()
    } finally {
      if (seqRef.current === seq) setRendering(false)
    }
  }, [fitWidth])

  useEffect(() => {
    const doc = docRef.current
    if (!doc) return
    void renderPage(doc, current, SCALE_STEPS[scaleIdx], viewRotate)
  }, [current, scaleIdx, viewRotate, fitWidth, renderPage, file])

  // Re-fit on window resize while in fit-width mode.
  useEffect(() => {
    if (!fitWidth) return
    const onResize = () => {
      const doc = docRef.current
      if (doc) void renderPage(doc, current, SCALE_STEPS[scaleIdx], viewRotate)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fitWidth, current, scaleIdx, viewRotate, renderPage])

  /** Scan every page's text content for the query. */
  async function runSearch() {
    const doc = docRef.current
    const q = query.trim().toLowerCase()
    if (!doc || !q) return
    setSearching(true)
    setError(null)
    try {
      const found: Hit[] = []
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n)
        const text = (await page.getTextContent()).items
          .map((it) => ('str' in it ? it.str : '')).join(' ')
          .toLowerCase()
        page.cleanup()
        let count = 0
        let at = text.indexOf(q)
        while (at !== -1) { count += 1; at = text.indexOf(q, at + q.length) }
        if (count > 0) found.push({ page: n, count })
        if (found.length >= 200) break
      }
      setHits(found)
      if (found.length > 0) setCurrent(found[0].page)
    } catch {
      setError('Search failed on this document — its text layer may be unusual.')
    } finally {
      setSearching(false)
    }
  }

  function go(target: string) {
    const n = parseInt(target, 10)
    if (!Number.isFinite(n) || n < 1 || n > pages) {
      setError(`Enter a page between 1 and ${pages}.`)
      return
    }
    setError(null)
    setCurrent(n)
  }

  if (!file) {
    return (
      <div>
        <DropZone
          onFiles={handleFiles}
          accept=".pdf,application/pdf"
          title="Drop a PDF to read it right here"
          hint="Page navigation, zoom, rotation and full-document search — the file never leaves this device."
        />
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <PrivacyStrip detail="Rendering happens in this tab with pdf.js. The document is never uploaded — it cannot leave your browser." />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{pages} pages · {formatBytes(file.size)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadBlob(file, file.name)}>
            <FileDown className="size-4" aria-hidden="true" /> Save a copy
          </Button>
          <Button size="sm" variant="outline" onClick={() => { void docRef.current?.destroy(); docRef.current = null; setFile(null); setHits(null); setQuery('') }}>
            Close
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2" role="toolbar" aria-label="Viewer controls">
        <Button size="sm" variant="ghost" aria-label="Previous page" disabled={current <= 1}
          onClick={() => setCurrent((c) => Math.max(1, c - 1))}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <span className="flex items-center gap-1 text-sm">
          <Input
            value={jump || String(current)}
            onChange={(e) => setJump(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') { go(jump || String(current)); setJump('') } }}
            onFocus={(e) => e.target.select()}
            onBlur={() => setJump('')}
            aria-label="Page number"
            className="h-8 w-16 text-center"
          />
          <span className="text-muted-foreground">/ {pages}</span>
        </span>
        <Button size="sm" variant="ghost" aria-label="Next page" disabled={current >= pages}
          onClick={() => setCurrent((c) => Math.min(pages, c + 1))}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button size="sm" variant="ghost" aria-label="Zoom out" disabled={fitWidth || scaleIdx === 0}
          onClick={() => setScaleIdx((i) => Math.max(0, i - 1))}>
          <ZoomOut className="size-4" aria-hidden="true" />
        </Button>
        <button
          type="button"
          onClick={() => setFitWidth((v) => !v)}
          className={`rounded-md px-2 py-1 text-xs font-medium ${fitWidth ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
          aria-pressed={fitWidth}
        >
          {fitWidth ? 'Fit width' : `${Math.round(SCALE_STEPS[scaleIdx] * 100)}%`}
        </button>
        <Button size="sm" variant="ghost" aria-label="Zoom in" disabled={fitWidth || scaleIdx === SCALE_STEPS.length - 1}
          onClick={() => setScaleIdx((i) => Math.min(SCALE_STEPS.length - 1, i + 1))}>
          <ZoomIn className="size-4" aria-hidden="true" />
        </Button>
        <Button size="sm" variant="ghost" aria-label="Rotate view"
          onClick={() => setViewRotate((r) => (r + 90) % 360)}>
          <RotateCw className="size-4" aria-hidden="true" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runSearch() }}
            placeholder="Find in document…"
            aria-label="Search the document"
            className="h-8 min-w-0 flex-1 sm:max-w-64"
          />
          <Button size="sm" variant="outline" onClick={() => void runSearch()} disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Search className="size-3.5" aria-hidden="true" />}
            Find
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {hits && (
        <div className="mt-3 rounded-xl border bg-card p-3" data-testid="pdf-search-hits">
          {hits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No page contains “{query}”.</p>
          ) : (
            <>
              <p className="text-sm font-medium">
                {hits.length} page{hits.length === 1 ? '' : 's'} contain “{query}” — click a page to jump.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hits.map((h) => (
                  <button
                    key={h.page}
                    type="button"
                    onClick={() => setCurrent(h.page)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      h.page === current ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    p{h.page} · {h.count}×
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div ref={stageRef} className="mt-3 flex min-h-64 justify-center overflow-auto rounded-xl border bg-muted/30 p-3">
        <div className="relative">
          <canvas ref={canvasRef} className="rounded-lg bg-white shadow-sm" aria-label={`Page ${current} of the PDF`} />
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      <PrivacyStrip detail="This viewer runs on pdf.js inside your browser tab. The document is never uploaded anywhere." />
    </div>
  )
}
