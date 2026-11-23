'use client'

// PDF Toolkit — merge, organize (reorder / rotate / delete) and split PDFs
// entirely on this device. pdf-lib does the page surgery, pdf.js draws the
// page thumbnails so you can see what you are rearranging. No uploads.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ChevronsUpDown, FileDown, Files,
  Loader2, RefreshCw, RotateCw, Scissors, Trash2, X,
} from 'lucide-react'
import { degrees, PDFDocument } from 'pdf-lib'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DownloadAllButton, DropZone, downloadBlob, formatBytes, PrivacyStrip,
} from '@/components/instant/instant-kit'
import { fileToPdfData, getPdfjs, pdfToBlob } from '@/lib/pdf-loader'

interface MergeItem {
  name: string
  size: number
  pages: number
  encrypted: boolean
  bytes: Uint8Array
}

interface PageEdit {
  /** Original 1-based page index (stable key). */
  source: number
  /** The page's own /Rotate value from the source document. */
  originalRotate: number
  /** Extra rotation applied by the user, degrees clockwise. */
  rotate: number
  deleted: boolean
}

interface SplitResult {
  name: string
  blob: Blob
}

const MAX_THUMBS = 60
const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

/** Parse "1-3, 5, 9-" (1-based, inclusive, open end allowed) into indices. */
export function parseRanges(input: string, pageCount: number): number[] {
  const out = new Set<number>()
  for (const raw of input.split(/[,\s;]+/)) {
    const part = raw.trim()
    if (!part) continue
    const m = /^(\d+)?\s*-\s*(\d+)?$/.exec(part)
    if (!m || (!m[1] && !m[2])) throw new Error(`"${part}" is not a page or range like 3-7.`)
    const from = m[1] ? parseInt(m[1], 10) : 1
    const to = m[2] ? parseInt(m[2], 10) : pageCount
    if (from < 1 || to < 1) throw new Error(`"${part}": page numbers start at 1.`)
    if (from > to) throw new Error(`"${part}": the range ends before it starts.`)
    if (from > pageCount) throw new Error(`"${part}": this document has ${pageCount} pages.`)
    for (let p = Math.min(from, pageCount); p <= Math.min(to, pageCount); p++) out.add(p)
  }
  if (out.size === 0) throw new Error('Enter at least one page or range, e.g. 1-3, 5.')
  return [...out].sort((a, b) => a - b)
}

export function PdfTool() {
  const [mode, setMode] = useState<'idle' | 'merge' | 'workspace'>('idle')
  const [tab, setTab] = useState<'organize' | 'split'>('organize')

  // merge state
  const [items, setItems] = useState<MergeItem[]>([])
  const [mergeName, setMergeName] = useState('merged.pdf')
  const [merging, setMerging] = useState(false)

  // single-document workspace state
  const [doc, setDoc] = useState<File | null>(null)
  const [docBytes, setDocBytes] = useState<Uint8Array | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pages, setPages] = useState<PageEdit[]>([])
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const [thumbTotal, setThumbTotal] = useState(0)
  const [rendering, setRendering] = useState(false)
  const [building, setBuilding] = useState(false)

  // split state
  const [ranges, setRanges] = useState('')
  const [splitEvery, setSplitEvery] = useState('1')
  const [splitResults, setSplitResults] = useState<SplitResult[] | null>(null)
  const [splitsBusy, setSplitsBusy] = useState(false)

  const [busyText, setBusyText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const renderSeq = useRef(0)

  const reset = useCallback(() => {
    renderSeq.current += 1
    setMode('idle')
    setItems([])
    setDoc(null)
    setDocBytes(null)
    setPages([])
    setThumbs({})
    setThumbTotal(0)
    setRanges('')
    setSplitResults(null)
    setBusyText(null)
    setError(null)
  }, [])

  async function inspect(file: File): Promise<MergeItem> {
    const bytes = await fileToPdfData(file)
    try {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
      return {
        name: file.name, size: file.size, pages: src.getPageCount(),
        encrypted: src.isEncrypted, bytes: new Uint8Array(bytes),
      }
    } catch {
      throw new Error(`"${file.name}" is not a readable PDF (it may be corrupted).`)
    }
  }

  async function handleFiles(files: File[]) {
    setError(null)
    setSplitResults(null)
    const pdfs = files.filter(isPdf)
    if (pdfs.length === 0) {
      setError('Drop PDF files — this tool works on .pdf documents only.')
      return
    }
    const rejected = files.length - pdfs.length
    if (rejected > 0) {
      setError(`${rejected} non-PDF file${rejected === 1 ? ' was' : 's were'} skipped — only .pdf is supported here.`)
    }
    setBusyText(`Reading ${pdfs.length} document${pdfs.length === 1 ? '' : 's'}…`)
    try {
      const inspected = await Promise.all(pdfs.map(inspect))
      if (inspected.length === 1) {
        await openWorkspace(inspected[0])
      } else {
        setItems(inspected)
        setMode('merge')
        setBusyText(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read those files.')
      setBusyText(null)
    }
  }

  /** Load the single-PDF workspace: pdf-lib for surgery, pdf.js for thumbs. */
  async function openWorkspace(item: MergeItem) {
    const doc0 = new File([new Uint8Array(item.bytes)], item.name, { type: 'application/pdf' })
    if (item.encrypted) {
      setError(`"${item.name}" is password-protected. Unlock it first, then organize or split it here.`)
      setBusyText(null)
      return
    }
    setDoc(doc0)
    setDocBytes(item.bytes)
    setPageCount(item.pages)
    setPages(Array.from({ length: item.pages }, (_, i) => ({
      source: i + 1, originalRotate: 0, rotate: 0, deleted: false,
    })))
    setMode('workspace')
    setBusyText(null)
    void renderThumbs(item.bytes, item.pages, item.name)
  }

  async function renderThumbs(bytes: Uint8Array, total: number, name: string) {
    const seq = ++renderSeq.current
    setRendering(true)
    setThumbTotal(Math.min(total, MAX_THUMBS))
    try {
      const pdfjs = await getPdfjs()
      const pdf = await pdfjs.getDocument({
        data: bytes.slice(),
        isEvalSupported: false,
      }).promise
      const limit = Math.min(total, MAX_THUMBS)
      const next: Record<number, string> = {}
      for (let n = 1; n <= limit; n++) {
        if (renderSeq.current !== seq) { pdf.destroy(); return }
        const page = await pdf.getPage(n)
        // Keep the page's own rotation so previews match the real page.
        const viewport = page.getViewport({ scale: 110 / page.getViewport({ scale: 1 }).width })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport }).promise
        next[n] = canvas.toDataURL('image/jpeg', 0.75)
        page.cleanup()
        if (renderSeq.current !== seq) { pdf.destroy(); return }
        setThumbs({ ...next })
        setBusyText(n === limit && total > limit ? `Rendered ${limit} of ${total} pages — “Load all pages” for the rest.` : null)
      }
      pdf.destroy()
    } catch {
      setError(`Could not render "${name}" — the file may be corrupted. Split and merge still work on readable PDFs.`)
    } finally {
      if (renderSeq.current === seq) setRendering(false)
    }
  }

  async function renderAllThumbs() {
    if (!docBytes || !doc) return
    const seq = ++renderSeq.current
    setRendering(true)
    setThumbTotal(pageCount)
    try {
      const pdfjs = await getPdfjs()
      const pdf = await pdfjs.getDocument({ data: docBytes.slice(), isEvalSupported: false }).promise
      for (let n = 1; n <= pageCount; n++) {
        if (renderSeq.current !== seq) { pdf.destroy(); return }
        if (thumbs[n]) continue
        const page = await pdf.getPage(n)
        const viewport = page.getViewport({ scale: 110 / page.getViewport({ scale: 1 }).width })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport }).promise
        const url = canvas.toDataURL('image/jpeg', 0.75)
        page.cleanup()
        if (renderSeq.current !== seq) { pdf.destroy(); return }
        setThumbs((prev) => ({ ...prev, [n]: url }))
      }
      pdf.destroy()
    } finally {
      if (renderSeq.current === seq) setRendering(false)
    }
  }

  function editPage(source: number, patch: Partial<PageEdit>) {
    setPages((prev) => prev.map((p) => (p.source === source ? { ...p, ...patch } : p)))
  }

  function movePage(source: number, dir: -1 | 1) {
    setPages((prev) => {
      const live = prev.filter((p) => !p.deleted)
      const at = live.findIndex((p) => p.source === source)
      const to = at + dir
      if (at < 0 || to < 0 || to >= live.length) return prev
      const reordered = [...live]
      const [moved] = reordered.splice(at, 1)
      reordered.splice(to, 0, moved)
      // Keep deleted pages in place at the tail so they can be restored.
      return [...reordered, ...prev.filter((p) => p.deleted)]
    })
  }

  /** Rebuild the PDF with the current page order, rotation and deletions. */
  async function rebuild() {
    if (!docBytes || !doc) return
    const live = pages.filter((p) => !p.deleted)
    if (live.length === 0) {
      setError('Every page is marked for deletion — nothing would remain. Restore a page or split instead.')
      return
    }
    setBuilding(true)
    setError(null)
    try {
      const src = await PDFDocument.load(docBytes, { ignoreEncryption: true })
      const out = await PDFDocument.create()
      const copied = await out.copyPages(src, live.map((p) => p.source - 1))
      for (let i = 0; i < copied.length; i++) {
        const edit = live[i]
        const total = (copied[i].getRotation().angle + edit.rotate) % 360
        copied[i].setRotation(degrees(total))
        out.addPage(copied[i])
      }
      const blob = pdfToBlob(await out.save())
      const base = doc.name.replace(/\.pdf$/i, '')
      downloadBlob(blob, `${base}-organized.pdf`)
    } catch {
      setError('Rebuilding failed — if this PDF is encrypted or unusual, try the Split tab with a page range.')
    } finally {
      setBuilding(false)
    }
  }

  async function merge() {
    setMerging(true)
    setError(null)
    try {
      const out = await PDFDocument.create()
      for (const item of items) {
        const src = await PDFDocument.load(item.bytes, { ignoreEncryption: true })
        const copied = await out.copyPages(src, src.getPageIndices())
        for (const page of copied) out.addPage(page)
      }
      const blob = pdfToBlob(await out.save())
      const name = mergeName.endsWith('.pdf') ? mergeName : `${mergeName || 'merged'}.pdf`
      downloadBlob(blob, name)
    } catch {
      setError('Merging failed — one of these PDFs may be encrypted or corrupted.')
    } finally {
      setMerging(false)
    }
  }

  async function runExtract() {
    if (!docBytes || !doc) return
    setError(null)
    setSplitsBusy(true)
    try {
      const indices = parseRanges(ranges, pageCount)
      const src = await PDFDocument.load(docBytes, { ignoreEncryption: true })
      const out = await PDFDocument.create()
      const copied = await out.copyPages(src, indices.map((i) => i - 1))
      for (const page of copied) out.addPage(page)
      const blob = pdfToBlob(await out.save())
      const base = doc.name.replace(/\.pdf$/i, '')
      setSplitResults([{ name: `${base}-extract.pdf`, blob }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not extract that range.')
    } finally {
      setSplitsBusy(false)
    }
  }

  /** Split every N pages, or into single pages (N = 1). */
  async function runSplitEvery() {
    if (!docBytes || !doc) return
    const n = Math.max(1, Math.floor(Number(splitEvery) || 0))
    if (!Number.isFinite(n) || n < 1) {
      setError('Pages per file must be 1 or more.')
      return
    }
    setError(null)
    setSplitsBusy(true)
    try {
      const src = await PDFDocument.load(docBytes, { ignoreEncryption: true })
      const base = doc.name.replace(/\.pdf$/i, '')
      const out: SplitResult[] = []
      const width = String(pageCount).length
      for (let start = 0; start < pageCount; start += n) {
        const end = Math.min(start + n, pageCount)
        const part = await PDFDocument.create()
        const copied = await part.copyPages(src, Array.from({ length: end - start }, (_, i) => start + i))
        for (const page of copied) part.addPage(page)
        const from = String(start + 1).padStart(width, '0')
        const to = String(end).padStart(width, '0')
        out.push({ name: `${base}-p${from}${end - start > 1 ? `-${to}` : ''}.pdf`, blob: pdfToBlob(await part.save()) })
      }
      setSplitResults(out)
    } catch {
      setError('Splitting failed — this PDF may be encrypted or corrupted.')
    } finally {
      setSplitsBusy(false)
    }
  }

  // ------------------------------------------------------------------ idle
  if (mode === 'idle') {
    return (
      <div>
        <DropZone
          onFiles={handleFiles}
          accept=".pdf,application/pdf"
          title="Drop one PDF to organize or split — or several to merge"
          hint="One PDF opens the page workspace; two or more queue up for merging. Nothing is uploaded."
        />
        {busyText && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {busyText}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <PrivacyStrip detail="Pages are cut, turned and glued back together with pdf-lib on this device. Your documents never touch a server." />
      </div>
    )
  }

  // ----------------------------------------------------------------- merge
  if (mode === 'merge') {
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Files className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {items.length} documents · {items.reduce((s, i) => s + i.pages, 0)} pages total
              </p>
              <p className="text-xs text-muted-foreground">Pages are appended in this order; drag is not needed — use the arrows.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={mergeName}
              onChange={(e) => setMergeName(e.target.value)}
              aria-label="Merged file name"
              className="h-9 w-44"
            />
            <Button size="sm" onClick={merge} disabled={merging || items.length < 2}>
              {merging ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
              {merging ? 'Merging…' : 'Merge & download'}
            </Button>
            <Button size="sm" variant="outline" onClick={reset}>
              Start over
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {items.some((i) => i.encrypted) && (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            {items.filter((i) => i.encrypted).map((i) => i.name).join(', ')} {items.filter((i) => i.encrypted).length === 1 ? 'is' : 'are'} password-protected — merging may produce unreadable pages. Unlock the file(s) first.
          </p>
        )}

        <div className="mt-4 rounded-xl border" data-testid="pdf-merge-list">
          <ul className="divide-y text-sm">
            {items.map((it, idx) => (
              <li key={`${it.name}-${idx}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {idx + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs">{it.name}</span>
                    <span className="text-xs text-muted-foreground">{it.pages} pages · {formatBytes(it.size)}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="ghost" aria-label={`Move ${it.name} up`} disabled={idx === 0}
                    onClick={() => setItems((prev) => {
                      const next = [...prev]; const [m] = next.splice(idx, 1); next.splice(idx - 1, 0, m); return next
                    })}>
                    <ChevronsUpDown className="size-3.5 rotate-180" aria-hidden="true" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Move ${it.name} down`} disabled={idx === items.length - 1}
                    onClick={() => setItems((prev) => {
                      const next = [...prev]; const [m] = next.splice(idx, 1); next.splice(idx + 1, 0, m); return next
                    })}>
                    <ChevronsUpDown className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Remove ${it.name}`}
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
                    <X className="size-3.5" aria-hidden="true" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <DropZone
          onFiles={handleFiles}
          accept=".pdf,application/pdf"
          compact
          title="Add more PDFs"
          hint="They are appended to the end of the list."
        />

        <PrivacyStrip detail="Merging happens with pdf-lib inside this tab — the documents are never uploaded." />
      </div>
    )
  }

  // ------------------------------------------------------------- workspace
  const liveCount = pages.filter((p) => !p.deleted).length
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Files className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{doc?.name}</p>
            <p className="text-xs text-muted-foreground">
              {pageCount} pages · {formatBytes(doc?.size ?? 0)} · {liveCount} kept{pages.some((p) => p.rotate) ? ' · rotations pending' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={rebuild} disabled={building}>
            {building ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
            {building ? 'Rebuilding…' : 'Rebuild & download'}
          </Button>
          <Button size="sm" variant="outline" onClick={reset}>Start over</Button>
        </div>
      </div>

      <div className="mt-4 flex gap-1 rounded-xl border bg-card p-1" role="tablist" aria-label="Single-document tools">
        {(['organize', 'split'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            {t === 'organize' ? 'Organize pages' : 'Split & extract'}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {tab === 'organize' && (
        <div className="mt-4">
          {busyText && (
            <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> {busyText}
            </p>
          )}
          {thumbTotal < pageCount && !rendering && (
            <Button size="sm" variant="outline" onClick={renderAllThumbs} className="mb-3">
              <RefreshCw className="size-3.5" aria-hidden="true" /> Load all {pageCount} pages
            </Button>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5" data-testid="pdf-pages">
            {pages.map((p, order) => {
              const liveOrder = pages.slice(0, order).filter((q) => !q.deleted).length + 1
              return (
                <figure
                  key={p.source}
                  className={`rounded-xl border bg-card p-2 transition-opacity ${p.deleted ? 'opacity-40' : ''}`}
                >
                  <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                    {thumbs[p.source] ? (
                      <img
                        src={thumbs[p.source]}
                        alt={`Page ${p.source} thumbnail`}
                        className={`max-h-full max-w-full ${p.rotate ? '' : ''}`}
                        style={{ transform: `rotate(${p.rotate}deg)` }}
                      />
                    ) : (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  <figcaption className="mt-1.5 flex items-center justify-between gap-1 text-xs text-muted-foreground">
                    <span className="font-mono">p{p.source}</span>
                    <span>{p.deleted ? 'deleted' : `#${liveOrder}`}{p.rotate ? ` · ${p.rotate}°` : ''}</span>
                  </figcaption>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    <Button size="sm" variant="ghost" className="h-7 px-1.5" aria-label={`Rotate page ${p.source}`}
                      onClick={() => editPage(p.source, { rotate: (p.rotate + 90) % 360 })}>
                      <RotateCw className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-1.5" aria-label={`Move page ${p.source} earlier`}
                      disabled={p.deleted || liveOrder === 1} onClick={() => movePage(p.source, -1)}>
                      <ArrowLeft className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-1.5" aria-label={`Move page ${p.source} later`}
                      disabled={p.deleted || liveOrder === liveCount} onClick={() => movePage(p.source, 1)}>
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto h-7 px-1.5"
                      aria-label={p.deleted ? `Restore page ${p.source}` : `Delete page ${p.source}`}
                      onClick={() => editPage(p.source, { deleted: !p.deleted })}>
                      {p.deleted ? <RefreshCw className="size-3.5" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
                    </Button>
                  </div>
                </figure>
              )
            })}
          </div>
          <PrivacyStrip detail="Thumbnails are rendered locally with pdf.js; the rebuilt file is produced with pdf-lib. Nothing leaves this tab." />
        </div>
      )}

      {tab === 'split' && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border bg-card p-4" aria-label="Extract a page range">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Scissors className="size-4 text-primary" aria-hidden="true" /> Extract pages
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Ranges like <code className="rounded bg-muted px-1">1-3, 7, 12-</code> — open ends run to page {pageCount}.
            </p>
            <Input
              value={ranges}
              onChange={(e) => setRanges(e.target.value)}
              placeholder={`1-${pageCount}`}
              aria-label="Pages to extract"
              className="mt-3"
            />
            <Button size="sm" className="mt-3" onClick={runExtract} disabled={splitsBusy}>
              {splitsBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArrowDownToLine className="size-4" aria-hidden="true" />}
              Extract & download
            </Button>
          </section>
          <section className="rounded-xl border bg-card p-4" aria-label="Split into parts">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Files className="size-4 text-primary" aria-hidden="true" /> Split every N pages
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Cut the document into parts of N pages (1 = every page becomes its own PDF).
            </p>
            <Input
              value={splitEvery}
              onChange={(e) => setSplitEvery(e.target.value)}
              inputMode="numeric"
              aria-label="Pages per file"
              className="mt-3"
            />
            <Button size="sm" className="mt-3" onClick={runSplitEvery} disabled={splitsBusy}>
              {splitsBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArrowDownToLine className="size-4" aria-hidden="true" />}
              Split & download
            </Button>
          </section>

          {splitResults && (
            <section className="rounded-xl border bg-card p-4 md:col-span-2" data-testid="pdf-split-results">
              <p className="text-sm font-medium">
                {splitResults.length === 1
                  ? 'Your extracted PDF is ready.'
                  : `Split into ${splitResults.length} files — download them one by one or all as a ZIP.`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DownloadAllButton files={splitResults} archiveName={`${doc?.name.replace(/\.pdf$/i, '') ?? 'split'}-parts.zip`} />
                {splitResults.map((r) => (
                  <Button key={r.name} size="sm" variant="outline" onClick={() => downloadBlob(r.blob, r.name)}>
                    <FileDown className="size-3.5" aria-hidden="true" /> {r.name}
                  </Button>
                ))}
              </div>
            </section>
          )}
          <PrivacyStrip detail="Every part is assembled locally with pdf-lib and zipped in the browser with JSZip." />
        </div>
      )}
    </div>
  )
}
