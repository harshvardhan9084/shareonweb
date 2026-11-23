'use client'

// PDF Text Extractor — pull the text out of any PDF, per page or as one
// continuous document, then copy it or download it as a .txt. The extraction
// runs on pdf.js on this device; the PDF is never uploaded.

import { useCallback, useRef, useState } from 'react'
import { Copy, Check, FileDown, FileText, Loader2, ScanText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropZone, downloadBlob, formatBytes, PrivacyStrip } from '@/components/instant/instant-kit'
import { fileToPdfData, getPdfjs } from '@/lib/pdf-loader'

interface PageText {
  page: number
  text: string
}

export function PdfTextTool() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pages, setPages] = useState<PageText[]>([])
  const [done, setDone] = useState(0)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const seqRef = useRef(0)

  const extract = useCallback(async (target: File) => {
    const seq = ++seqRef.current
    setExtracting(true)
    setError(null)
    setCopied(false)
    setPages([])
    try {
      const pdfjs = await getPdfjs()
      const doc = await pdfjs.getDocument({ data: await fileToPdfData(target), isEvalSupported: false }).promise
      setPageCount(doc.numPages)
      const out: PageText[] = []
      for (let n = 1; n <= doc.numPages; n++) {
        if (seqRef.current !== seq) { void doc.destroy(); return }
        const page = await doc.getPage(n)
        const items = await page.getTextContent()
        // Rebuild reading order: pdf.js emits items in layout order with
        // hasEOL markers — join and honor them so paragraphs survive.
        let text = ''
        for (const item of items.items) {
          if ('str' in item) {
            text += item.str
            if (item.hasEOL) text += '\n'
          }
        }
        page.cleanup()
        if (seqRef.current !== seq) { void doc.destroy(); return }
        out.push({ page: n, text: text.replace(/[ \t]+\n/g, '\n').trim() })
        setPages([...out])
        setDone(n)
      }
      void doc.destroy()
    } catch {
      setError('Could not extract text — the PDF may be encrypted, scanned (image-only), or corrupted.')
    } finally {
      if (seqRef.current === seq) setExtracting(false)
    }
  }, [])

  function reset() {
    seqRef.current += 1
    setFile(null)
    setPages([])
    setDone(0)
    setPageCount(0)
    setError(null)
    setCopied(false)
  }

  const allText = pages.map((p) => p.text).join('\n\n')
  const totalChars = pages.reduce((s, p) => s + p.text.length, 0)
  const isScanned = done === pageCount && pageCount > 0 && totalChars === 0

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(allText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('The browser blocked clipboard access — select the text below and copy it manually.')
    }
  }

  function downloadTxt(perPage: boolean) {
    const base = file?.name.replace(/\.pdf$/i, '') ?? 'pdf'
    if (perPage) {
      const blob = new Blob([pages.map((p) => `--- Page ${p.page} ---\n\n${p.text}`).join('\n\n\n')], { type: 'text/plain;charset=utf-8' })
      downloadBlob(blob, `${base}-text.txt`)
    } else {
      const blob = new Blob([allText], { type: 'text/plain;charset=utf-8' })
      downloadBlob(blob, `${base}-text.txt`)
    }
  }

  if (!file) {
    return (
      <div>
        <DropZone
          onFiles={(files) => {
            const pdf = files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
            if (!pdf) {
              setError('Drop a .pdf file — this tool extracts text from PDF documents only.')
              return
            }
            setFile(pdf)
            void extract(pdf)
          }}
          accept=".pdf,application/pdf"
          title="Drop a PDF to pull out its text"
          hint="Every page is read on this device with pdf.js — copy the result or save it as .txt."
        />
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <PrivacyStrip detail="Text extraction happens locally with pdf.js. The PDF never leaves this browser tab." />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex min-w-0 items-center gap-3">
          <ScanText className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {extracting
                ? `Extracting — page ${done} of ${pageCount}…`
                : `${pageCount} pages · ${totalChars.toLocaleString()} characters · ${formatBytes(file.size)}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={copyAll} disabled={extracting || totalChars === 0}>
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy all'}
          </Button>
          <Button size="sm" onClick={() => downloadTxt(false)} disabled={extracting || totalChars === 0}>
            <FileDown className="size-4" aria-hidden="true" /> Continuous .txt
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadTxt(true)} disabled={extracting || totalChars === 0}>
            <FileDown className="size-4" aria-hidden="true" /> Page-marked .txt
          </Button>
          <Button size="sm" variant="outline" onClick={reset}>Start over</Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {isScanned && (
        <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          No text found — this PDF looks scanned (image-only pages). Text extraction needs a text layer; OCR is not part of this tool.
        </p>
      )}

      {pages.length > 0 && (
        <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto rounded-xl border p-4" data-testid="pdf-text-output">
          {pages.map((p) => (
            <article key={p.page} className="rounded-lg border bg-card">
              <header className="flex items-center justify-between border-b px-3 py-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <FileText className="size-3.5" aria-hidden="true" /> Page {p.page}
                </span>
                <span className="text-xs text-muted-foreground">{p.text.length.toLocaleString()} chars</span>
              </header>
              {p.text ? (
                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap px-3 py-2 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
              ) : (
                <p className="px-3 py-2 text-xs italic text-muted-foreground">No text on this page (likely an image or a blank page).</p>
              )}
            </article>
          ))}
        </div>
      )}

      <PrivacyStrip detail="Your PDF is parsed in this tab by pdf.js. Nothing is uploaded, nothing is stored." />
    </div>
  )
}
