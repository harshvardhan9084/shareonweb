'use client'

// Document Viewer — open DOCX, XLSX, XLS or CSV right in the browser and read
// them: Word documents render as formatted HTML (sandboxed), spreadsheets show
// as a grid with sheet tabs, and every format can be converted (DOCX → HTML /
// text, XLSX → CSV, CSV → XLSX). Everything is parsed on this device — the
// file is never uploaded.

import { useMemo, useRef, useState } from 'react'
import {
  Braces, Copy, Check, FileDown, FileSpreadsheet, FileType2, Loader2, Table2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropZone, downloadBlob, formatBytes, PrivacyStrip } from '@/components/instant/instant-kit'
import type { WorkBook, WorkSheet } from 'xlsx'

type Kind = 'docx' | 'sheet' | 'csv'

interface Grid {
  rows: string[][]
  totalRows: number
  totalCols: number
}

const DOCX_IFRAME_CSS = `
  body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.65; color: #1a1a1a;
         max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.5rem; }
  h1, h2, h3, h4 { line-height: 1.25; margin: 1.6em 0 0.5em; }
  table { border-collapse: collapse; width: 100%; margin: 1.2em 0; }
  td, th { border: 1px solid #d4d4d4; padding: 6px 10px; text-align: left; }
  img { max-width: 100%; height: auto; }
  ul, ol { padding-left: 1.6em; }
  blockquote { border-left: 3px solid #d4d4d4; margin: 1.2em 0; padding: 0.2em 1em; color: #555; }
  a { color: #0e7490; }
`

export function OfficeViewTool() {
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<Kind | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  /** The parsed SheetJS workbook, kept so tabs/exports don't re-read the file. */
  const wbRef = useRef<WorkBook | null>(null)
  const rowsShownRef = useRef(150)

  // docx state
  const [html, setHtml] = useState<string | null>(null)
  const [plainText, setPlainText] = useState('')
  const [warnings, setWarnings] = useState(0)

  // sheet state
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState('')
  const [grid, setGrid] = useState<Grid | null>(null)
  const [showAllRows, setShowAllRows] = useState(false)
  const [rowsShown, setRowsShown] = useState(150)

  function reset() {
    setFile(null)
    setKind(null)
    setHtml(null)
    setPlainText('')
    setWarnings(0)
    setSheetNames([])
    setActiveSheet('')
    setGrid(null)
    setShowAllRows(false)
    setError(null)
    setCopied(false)
    wbRef.current = null
  }

  async function loadDocx(file: File) {
    setLoading(true)
    setError(null)
    setKind('docx')
    try {
      const mammoth = (await import('mammoth/mammoth.browser.min.js')).default
      const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
      setHtml(result.value)
      setWarnings(result.messages.length)
      const raw = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
      setPlainText(raw.value)
      if (!result.value || result.value.replace(/<[^>]+>/g, '').trim() === '') {
        setError('This document opened, but it contains no visible text — it may be empty or made of embedded objects.')
      }
    } catch {
      setError('Could not read this .docx — the file may be corrupted, or it is an old .doc (Word 97) which this viewer does not support.')
      setKind(null)
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadSheet(file: File, asCsv: boolean) {
    setLoading(true)
    setError(null)
    setKind(asCsv ? 'csv' : 'sheet')
    setRowsShown(150)
    setShowAllRows(false)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      wbRef.current = wb
      const names = wb.SheetNames
      if (names.length === 0) {
        setError('The file opened but contains no sheets — nothing to show.')
        setLoading(false)
        return
      }
      setSheetNames(names)
      setActiveSheet(names[0])
      rowsShownRef.current = 150
      await renderSheet(wb, names[0], 150)
    } catch {
      setError(asCsv
        ? 'Could not parse this CSV — check the encoding and delimiter (comma or semicolon are auto-detected).'
        : 'Could not read this spreadsheet — it may be corrupted, or password-protected.')
      setKind(null)
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  async function renderSheet(wb: WorkBook, name: string, limit?: number) {
    const { utils } = await import('xlsx')
    const sheet: WorkSheet | undefined = wb.Sheets[name]
    if (!sheet) return
    const matrix = utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    })
    const cols = matrix.reduce((m, r) => Math.max(m, r.length), 0)
    const cap = limit ?? rowsShown
    setGrid({
      rows: matrix.slice(0, cap).map((r) => (Array.from({ length: cols }, (_, c) => String(r[c] ?? '')))),
      totalRows: matrix.length,
      totalCols: cols,
    })
  }

  async function switchSheet(name: string) {
    setActiveSheet(name)
    setShowAllRows(false)
    const wb = wbRef.current
    if (wb) await renderSheet(wb, name, rowsShownRef.current)
  }

  async function expandRows() {
    const wb = wbRef.current
    if (!wb) return
    const next = showAllRows ? 150 : 3000
    rowsShownRef.current = next
    setRowsShown(next)
    setShowAllRows(next > 150)
    await renderSheet(wb, activeSheet, next)
  }

  async function handleFiles(files: File[]) {
    const f = files[0]
    if (!f) return
    reset()
    setFile(f)
    const name = f.name.toLowerCase()
    if (name.endsWith('.docx')) void loadDocx(f)
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) void loadSheet(f, false)
    else if (name.endsWith('.csv') || name.endsWith('.tsv')) void loadSheet(f, true)
    else {
      setError('Drop a .docx, .xlsx, .xls, .csv or .tsv file. Old binary .doc and PowerPoint (.pptx) are not supported by this viewer.')
      setFile(null)
    }
  }

  async function copyText() {
    const text = kind === 'docx' ? plainText : grid?.rows.map((r) => r.join('\t')).join('\n') ?? ''
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('The browser blocked clipboard access — select the text and copy it manually.')
    }
  }

  async function downloadConversion(target: 'html' | 'txt' | 'csv' | 'xlsx') {
    if (!file) return
    const base = file.name.replace(/\.[^.]+$/, '')
    if (kind === 'docx') {
      if (target === 'html' && html) downloadBlob(new Blob([`<!doctype html><meta charset="utf-8">${html}`], { type: 'text/html;charset=utf-8' }), `${base}.html`)
      if (target === 'txt') downloadBlob(new Blob([plainText], { type: 'text/plain;charset=utf-8' }), `${base}.txt`)
      return
    }
    const wb = wbRef.current
    if (!wb) return
    const XLSX = await import('xlsx')
    if (target === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[activeSheet])
      downloadBlob(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }), `${base}-${activeSheet}.csv`)
    }
    if (target === 'xlsx') {
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array
      downloadBlob(new Blob([new Uint8Array(out)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`)
    }
  }

  const docIcon = kind === 'docx' ? FileType2 : kind === 'csv' ? Braces : FileSpreadsheet

  if (!file) {
    return (
      <div>
        <DropZone
          onFiles={handleFiles}
          accept=".docx,.xlsx,.xls,.csv,.tsv"
          title="Drop a Word, Excel or CSV file to read it here"
          hint="DOCX renders as formatted text; spreadsheets show as a grid. Convert and download any of them. Nothing is uploaded."
        />
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <PrivacyStrip detail="DOCX is parsed with mammoth and spreadsheets with SheetJS inside this tab — the file never leaves your browser." />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            {loading ? <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" /> : (() => { const I = docIcon; return <I className="size-5 text-primary" aria-hidden="true" /> })()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {kind === 'docx' && `${formatBytes(file.size)} · Word document${warnings ? ` · ${warnings} parsing note${warnings === 1 ? '' : 's'}` : ''}`}
              {kind === 'sheet' && `${formatBytes(file.size)} · ${sheetNames.length} sheet${sheetNames.length === 1 ? '' : 's'}`}
              {kind === 'csv' && `${formatBytes(file.size)} · CSV${grid ? ` · ${grid.totalRows.toLocaleString()} rows` : ''}`}
              {!kind && formatBytes(file.size)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {kind === 'docx' && (
            <>
              <Button size="sm" variant="outline" onClick={copyText} disabled={!plainText}>
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy text'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void downloadConversion('html')} disabled={!html}>
                <FileDown className="size-4" aria-hidden="true" /> .html
              </Button>
              <Button size="sm" variant="outline" onClick={() => void downloadConversion('txt')} disabled={!plainText}>
                <FileDown className="size-4" aria-hidden="true" /> .txt
              </Button>
            </>
          )}
          {(kind === 'sheet' || kind === 'csv') && grid && (
            <>
              <Button size="sm" variant="outline" onClick={copyText}>
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy shown'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void downloadConversion('csv')}>
                <FileDown className="size-4" aria-hidden="true" /> {kind === 'csv' ? `${sheetNames[0]}.csv` : `${activeSheet}.csv`}
              </Button>
              {kind === 'csv' && (
                <Button size="sm" onClick={() => void downloadConversion('xlsx')}>
                  <Table2 className="size-4" aria-hidden="true" /> Convert to .xlsx
                </Button>
              )}
            </>
          )}
          <Button size="sm" variant="outline" onClick={reset}>Close</Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {kind === 'docx' && html && (
        <iframe
          title={`Preview of ${file.name}`}
          sandbox=""
          className="mt-3 h-[36rem] w-full rounded-xl border bg-white"
          srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>${DOCX_IFRAME_CSS}</style></head><body>${html}</body></html>`}
          data-testid="docx-frame"
        />
      )}

      {(kind === 'sheet' || kind === 'csv') && (
        <div className="mt-3">
          {sheetNames.length > 1 && (
            <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Sheets">
              {sheetNames.map((n) => (
                <button
                  key={n}
                  role="tab"
                  aria-selected={n === activeSheet}
                  onClick={() => void switchSheet(n)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    n === activeSheet ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {grid && (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                Showing {grid.rows.length.toLocaleString()} of {grid.totalRows.toLocaleString()} rows × {grid.totalCols.toLocaleString()} columns
                {grid.rows.length < grid.totalRows && ' — expand below for more.'}
              </p>
              <div className="max-h-[32rem] overflow-auto rounded-xl border" data-testid="sheet-grid">
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {grid.rows.map((row, r) => (
                      <tr key={r} className={r === 0 ? 'bg-muted/60 font-medium' : 'even:bg-muted/30'}>
                        <td className="sticky left-0 z-10 border-r bg-muted/80 px-2 py-1.5 text-right text-xs text-muted-foreground" aria-label={`Row ${r + 1}`}>
                          {r + 1}
                        </td>
                        {row.map((cell, c) => (
                          <td key={c} className="max-w-72 truncate border-b px-3 py-1.5" title={cell}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {grid.rows.length < grid.totalRows && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => void expandRows()}>
                  {showAllRows ? 'Back to first 150 rows' : `Load up to 3,000 rows`}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {loading && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Parsing {file.name}…
        </p>
      )}

      <PrivacyStrip detail="Parsing happens entirely in this tab (mammoth for DOCX, SheetJS for spreadsheets). The file is never uploaded." />
    </div>
  )
}
