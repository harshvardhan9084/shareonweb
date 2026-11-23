'use client'

// EPUB Reader — read .epub books right in the browser: paginated chapters,
// a table of contents, adjustable text size and reading progress. epub.js
// renders the book locally; the file never leaves this device.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BookOpen, ChevronLeft, ChevronRight, Loader2, List, Minus, Plus, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropZone, formatBytes, PrivacyStrip } from '@/components/instant/instant-kit'
import ePub, { type Book, type Rendition, type NavItem } from 'epubjs'

interface TocEntry {
  label: string
  href: string
  depth: number
}

export function EpubViewTool() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toc, setToc] = useState<TocEntry[]>([])
  const [showToc, setShowToc] = useState(false)
  const [fontSize, setFontSize] = useState(16)
  const [progress, setProgress] = useState(0)
  const [section, setSection] = useState('')
  const [meta, setMeta] = useState<{ title?: string; creator?: string }>({})

  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const pendingFileRef = useRef<File | null>(null)
  /** Mirror of the TOC state so the relocated listener never reads stale state. */
  const tocRef = useRef<TocEntry[]>([])

  const destroyBook = useCallback(() => {
    try { renditionRef.current?.destroy() } catch { /* already gone */ }
    try { void bookRef.current?.destroy() } catch { /* already gone */ }
    renditionRef.current = null
    bookRef.current = null
  }, [])

  useEffect(() => () => destroyBook(), [destroyBook])

  function flattenToc(items: NavItem[], depth = 1): TocEntry[] {
    const out: TocEntry[] = []
    for (const item of items) {
      out.push({ label: item.label.trim(), href: item.href, depth })
      if (item.subitems?.length) out.push(...flattenToc(item.subitems as NavItem[], depth + 1))
    }
    return out
  }

  const openBook = useCallback(async (target: File) => {
    const seq = pendingFileRef.current = target
    setLoading(true)
    setError(null)
    setToc([])
    setShowToc(false)
    setProgress(0)
    setSection('')
    destroyBook()
    tocRef.current = []
    try {
      const book = ePub(await target.arrayBuffer())
      if (pendingFileRef.current !== seq) { void book.destroy(); return }
      bookRef.current = book
      try {
        const metadata = await book.loaded.metadata
        setMeta({ title: metadata.title, creator: metadata.creator })
      } catch { setMeta({}) }
      try {
        const nav = await book.loaded.navigation
        const flat = flattenToc(nav.toc as NavItem[])
        tocRef.current = flat
        setToc(flat)
      } catch { setToc([]) }

      // Generate CFI locations in the background so the progress bar reports
      // real percentages; until it finishes the bar simply stays honest at 0.
      void book.locations.generate(1200).catch(() => { /* no locations — fine */ })

      // Wait a frame so the stage div is mounted, then render into it.
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const stage = stageRef.current
      if (!stage || pendingFileRef.current !== seq) return
      const rendition = book.renderTo(stage, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
      })
      renditionRef.current = rendition
      rendition.themes.fontSize(`${fontSize}px`)
      rendition.themes.override('font-family', 'Georgia, serif', true)
      rendition.on('relocated', (location: { start: { percentage: number; href: string } }) => {
        const pct = location.start.percentage ?? 0
        setProgress(Math.round(pct * 100))
        const file = location.start.href.split('#')[0].split('/').pop() ?? ''
        const match = tocRef.current.find((t) => t.href.split('#')[0].endsWith(file))
        setSection(match ? match.label : '')
      })
      await rendition.display()
    } catch {
      setError('Could not open this .epub — the file may be corrupted or DRM-protected (library books with DRM cannot be opened).')
      destroyBook()
      setFile(null)
    } finally {
      setLoading(false)
    }
  }, [destroyBook, fontSize])

  // Re-apply font size without reloading the book.
  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontSize}px`)
  }, [fontSize])

  // Arrow keys turn pages while a book is open.
  useEffect(() => {
    if (!file) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); void go(1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); void go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function handleFiles(files: File[]) {
    const epub = files.find((f) => f.type === 'application/epub+zip' || /\.epub$/i.test(f.name))
    if (!epub) {
      setError('Drop a .epub file — this reader opens EPUB books only.')
      return
    }
    setFile(epub)
    void openBook(epub)
  }

  function reset() {
    pendingFileRef.current = null
    destroyBook()
    setFile(null)
    setToc([])
    setMeta({})
    setError(null)
    setFontSize(16)
  }

  async function go(dir: -1 | 1) {
    const r = renditionRef.current
    if (!r) return
    if (dir === 1) await r.next()
    else await r.prev()
  }

  function jumpTo(href: string) {
    void renditionRef.current?.display(href).catch(() => {
      setError('Could not jump to that chapter — the book\u2019s internal links may be unusual.')
    })
    setShowToc(false)
  }

  if (!file) {
    return (
      <div>
        <DropZone
          onFiles={handleFiles}
          accept=".epub,application/epub+zip"
          title="Drop an .epub book to start reading"
          hint="Paginated chapters, a table of contents and text-size control — the book never leaves this device."
        />
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <PrivacyStrip detail="The book is parsed and rendered locally with epub.js. Nothing is uploaded — reading stays private." />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex min-w-0 items-center gap-3">
          <BookOpen className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{meta.title || file.name.replace(/\.epub$/i, '')}</p>
            <p className="text-xs text-muted-foreground">
              {meta.creator ? `${meta.creator} · ` : ''}{formatBytes(file.size)} · {progress}% read{section ? ` · ${section}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toc.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setShowToc((v) => !v)} aria-expanded={showToc}>
              <List className="size-4" aria-hidden="true" /> Contents
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={reset}>
            <X className="size-4" aria-hidden="true" /> Close
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border bg-card p-2" role="toolbar" aria-label="Reader controls">
        <Button size="sm" variant="ghost" aria-label="Previous page" onClick={() => void go(-1)}>
          <ChevronLeft className="size-4" aria-hidden="true" /> Prev
        </Button>
        <Button size="sm" variant="ghost" aria-label="Next page" onClick={() => void go(1)}>
          Next <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button size="sm" variant="ghost" aria-label="Smaller text" disabled={fontSize <= 12} onClick={() => setFontSize((s) => Math.max(12, s - 1))}>
          <Minus className="size-4" aria-hidden="true" />
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">{fontSize}px</span>
        <Button size="sm" variant="ghost" aria-label="Larger text" disabled={fontSize >= 28} onClick={() => setFontSize((s) => Math.min(28, s + 1))}>
          <Plus className="size-4" aria-hidden="true" />
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">Progress {progress}%</span>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {showToc && toc.length > 0 && (
        <nav className="mt-3 max-h-64 overflow-y-auto rounded-xl border bg-card" aria-label="Table of contents" data-testid="epub-toc">
          <ul className="divide-y text-sm">
            {toc.map((t) => (
              <li key={`${t.href}-${t.label}`}>
                <button
                  type="button"
                  onClick={() => jumpTo(t.href)}
                  className="block w-full px-4 py-2.5 text-left hover:bg-muted/60"
                  style={{ paddingLeft: `${0.75 + (t.depth - 1) * 1}rem` }}
                >
                  <span className="block truncate">{t.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div
        ref={stageRef}
        className="mt-3 h-[34rem] w-full overflow-hidden rounded-xl border bg-white"
        data-testid="epub-stage"
      />

      {loading && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Opening {file.name}…
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Tip: the left and right arrow keys also turn pages.
      </p>
      <PrivacyStrip detail="Your book is rendered in this tab with epub.js — no account, no upload, no tracking." />
    </div>
  )
}
