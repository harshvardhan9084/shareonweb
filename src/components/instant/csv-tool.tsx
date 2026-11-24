'use client'

// CSV & JSON Studio — a real RFC 4180 parser (quoted fields, escaped quotes,
// embedded commas/newlines, CRLF, custom delimiters) instead of split(",").
// CSV→JSON and JSON→CSV both directions, a grid viewer, honest warnings for
// unclosed quotes, and downloads built from the same parsed arrays the
// table renders. Everything runs in this tab.

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Dir = 'csv2json' | 'json2csv'
type Delim = ',' | ';' | '\t' | '|'

const DELIMS: Array<{ id: Delim; label: string }> = [
  { id: ',', label: 'Comma ,' },
  { id: ';', label: 'Semicolon ;' },
  { id: '\t', label: 'Tab' },
  { id: '|', label: 'Pipe |' },
]

interface ParseResult {
  rows: string[][]
  warnings: string[]
}

/** RFC 4180 parser with a custom delimiter. Returns rows plus honest warnings. */
function parseCsv(src: string, delim: Delim): ParseResult {
  const rows: string[][] = []
  const warnings: string[] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let i = 0
  let fieldStartLine = 1
  let line = 1
  const pushField = () => { row.push(field); field = '' }
  const pushRow = () => {
    pushField()
    // a row whose only cell is empty is a blank line — skip it (Excel does too)
    if (row.length === 1 && row[0] === '') { row = []; return }
    rows.push(row)
    row = []
  }
  while (i < src.length) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false
        i++
        continue
      }
      if (c === '\n') line++
      field += c
      i++
      continue
    }
    if (c === '"') {
      if (field === '') {
        inQuotes = true
        fieldStartLine = line
        i++
        continue
      }
      // quote in the middle of an unquoted field — keep it, warn
      warnings.push(`Line ${line}: a quote appears inside an unquoted field; kept as literal text.`)
      field += '"'
      i++
      continue
    }
    if (c === delim) { pushField(); i++; continue }
    if (c === '\r') {
      if (src[i + 1] === '\n') { line++; pushRow(); i += 2; continue }
      pushRow(); i++; continue // bare CR
    }
    if (c === '\n') { line++; pushRow(); i++; continue }
    field += c
    i++
  }
  // end of input
  if (inQuotes) {
    warnings.push(`Unclosed quote: the field starting on line ${fieldStartLine} never ends. The rest of the input was treated as that field.`)
  }
  pushRow()
  return { rows, warnings }
}

/** CSV-escape a field when the target delimiter or structure demands it. */
function csvEscape(v: string, delim: Delim): string {
  const s = String(v)
  if (s.includes('"') || s.includes(delim) || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function infer(v: string): unknown {
  const t = v.trim()
  if (t === '') return ''
  const low = t.toLowerCase()
  if (low === 'true') return true
  if (low === 'false') return false
  if (low === 'null' || low === 'na' || low === 'n/a' || low === '-') return null
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(t)) {
    const n = Number(t)
    if (Number.isFinite(n)) return n
  }
  return v
}

interface GridResult {
  headers: string[]
  rows: Array<Array<string>>
  warnings: string[]
}

export function CsvTool() {
  const [dir, setDir] = useState<Dir>('csv2json')
  const [delim, setDelim] = useState<Delim>(',')
  const [hasHeader, setHasHeader] = useState(true)
  const [inferTypes, setInferTypes] = useState(true)
  const [input, setInput] = useState('name,role,tags\n"Asha, senior",lead,"on-call,\n rotations"\nBen,reviewer,\nChen,reviewer,')
  const [copied, setCopied] = useState(false)

  // ----------------------------------------------------------- csv → json --
  const grid = useMemo<GridResult | null>(() => {
    if (dir !== 'csv2json' || input.trim() === '') return null
    const { rows, warnings } = parseCsv(input, delim)
    if (rows.length === 0) return { headers: [], rows: [], warnings }
    const width = Math.max(...rows.map((r) => r.length))
    const headers = hasHeader
      ? Array.from({ length: width }, (_, i) => rows[0][i] ?? `column_${i + 1}`)
      : Array.from({ length: width }, (_, i) => `column_${i + 1}`)
    const body = hasHeader ? rows.slice(1) : rows
    return { headers, rows: body, warnings }
  }, [dir, input, delim, hasHeader])

  const jsonOut = useMemo(() => {
    if (!grid || grid.rows.length === 0) return ''
    const objects = grid.rows.map((r) => {
      const obj: Record<string, unknown> = {}
      grid.headers.forEach((h, i) => {
        const raw = r[i] ?? ''
        obj[h] = inferTypes ? infer(raw) : raw
      })
      return obj
    })
    return JSON.stringify(objects, null, 2)
  }, [grid, inferTypes])

  // ----------------------------------------------------------- json → csv --
  const jsonParsed = useMemo(() => {
    if (dir !== 'json2csv' || input.trim() === '') return { ok: false as const, msg: '' }
    try {
      const parsed: unknown = JSON.parse(input)
      let arr: unknown[]
      if (Array.isArray(parsed)) arr = parsed
      else if (parsed !== null && typeof parsed === 'object') {
        // a single object is treated as a one-row table
        arr = [parsed]
      } else {
        return { ok: false as const, msg: 'JSON must be an array of objects (or one object) to become a table.' }
      }
      if (arr.some((v) => v === null || typeof v !== 'object' || Array.isArray(v))) {
        return { ok: false as const, msg: 'Every element of the array must be an object — primitives and arrays cannot be rows.' }
      }
      return { ok: true as const, arr: arr as Array<Record<string, unknown>> }
    } catch (e) {
      return { ok: false as const, msg: e instanceof Error ? `Invalid JSON — ${e.message}` : 'Invalid JSON' }
    }
  }, [dir, input])

  const csvHeaders = useMemo(() => {
    if (!jsonParsed.ok) return []
    const keys = new Set<string>()
    for (const obj of jsonParsed.arr) {
      for (const k of Object.keys(obj)) keys.add(k)
    }
    return [...keys]
  }, [jsonParsed])

  const csvRows = useMemo(() => {
    if (!jsonParsed.ok) return []
    return jsonParsed.arr.map((obj) =>
      csvHeaders.map((h) => {
        const v = obj[h]
        if (v === undefined) return ''
        if (v === null) return ''
        if (typeof v === 'object') return JSON.stringify(v)
        return String(v)
      }),
    )
  }, [jsonParsed, csvHeaders])

  const csvOut = useMemo(() => {
    if (!jsonParsed.ok || csvHeaders.length === 0) return ''
    const head = csvHeaders.map((h) => csvEscape(h, delim)).join(delim)
    const body = csvRows.map((r) => r.map((cell) => csvEscape(cell, delim)).join(delim)).join('\n')
    return body ? `${head}\n${body}` : head
  }, [jsonParsed, csvHeaders, csvRows, delim])

  // -------------------------------------------------------------- exports --

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* manual selection still works */ }
  }

  const download = (text: string, name: string, type: string) => {
    const blob = new Blob([text], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const previewRows = dir === 'csv2json' ? (grid?.rows ?? []).slice(0, 50) : csvRows.slice(0, 50)
  const previewHeaders = dir === 'csv2json' ? (grid?.headers ?? []) : csvHeaders
  const outputText = dir === 'csv2json' ? jsonOut : csvOut
  const outputValid = dir === 'csv2json' ? grid !== null && grid.rows.length > 0 : jsonParsed.ok && csvHeaders.length > 0
  const warnings = dir === 'csv2json' ? grid?.warnings ?? [] : []

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Conversion direction">
          {([
            { id: 'csv2json', label: 'CSV → JSON' },
            { id: 'json2csv', label: 'JSON → CSV' },
          ] as const).map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={dir === m.id}
              onClick={() => setDir(m.id)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                dir === m.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {m.label}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="csv-delim" className="text-xs text-muted-foreground">Delimiter</Label>
              <select
                id="csv-delim"
                value={delim}
                onChange={(e) => setDelim(e.target.value as Delim)}
                className="h-8 rounded-lg border bg-background px-2 text-xs"
              >
                {DELIMS.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
            {dir === 'csv2json' && (
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={hasHeader} onCheckedChange={setHasHeader} aria-label="First row is headers" />
                <span>First row = headers</span>
              </label>
            )}
            {dir === 'csv2json' && (
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={inferTypes} onCheckedChange={setInferTypes} aria-label="Infer types" />
                <span>Infer types</span>
              </label>
            )}
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="csv-input">{dir === 'csv2json' ? 'Paste or drop your CSV' : 'Paste your JSON'}</Label>
          <Textarea
            id="csv-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={7}
            className="mt-1.5 font-mono text-sm"
            spellCheck={false}
          />
        </div>

        {dir === 'json2csv' && !jsonParsed.ok && jsonParsed.msg && (
          <p className="mt-2 text-sm text-destructive" role="alert">{jsonParsed.msg}</p>
        )}
        {warnings.length > 0 && (
          <ul className="mt-2 space-y-1" role="alert">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-destructive">{w}</li>
            ))}
          </ul>
        )}

        <PrivacyStrip detail="The parser runs in this tab — RFC 4180 quoted fields, escaped quotes, embedded newlines, your chosen delimiter. Nothing is uploaded, nothing is stored." />
      </div>

      {/* grid preview */}
      {previewHeaders.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b px-4 py-2.5">
            <h2 className="text-sm font-semibold">Parsed table</h2>
            <span className="text-xs text-muted-foreground">
              {dir === 'csv2json'
                ? `${(grid?.rows.length ?? 0).toLocaleString('en-US')} rows × ${grid?.headers.length ?? 0} columns`
                : `${csvRows.length.toLocaleString('en-US')} rows × ${csvHeaders.length} columns (union of all keys)`}
              {previewRows.length < (dir === 'csv2json' ? grid?.rows.length ?? 0 : csvRows.length) ? ' — first 50 shown' : ''}
            </span>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr>
                  <th className="border-b px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                  {previewHeaders.map((h, i) => (
                    <th key={i} className="whitespace-nowrap border-b px-3 py-2 text-left text-xs font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, ri) => (
                  <tr key={ri} className="hover:bg-muted/40">
                    <td className="border-b px-3 py-1.5 text-xs text-muted-foreground tabular-nums">{ri + 1}</td>
                    {previewHeaders.map((_, ci) => (
                      <td key={ci} className="max-w-[280px] truncate border-b px-3 py-1.5 font-mono text-xs">
                        {r[ci] ?? <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* output */}
      {outputValid && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <h2 className="text-sm font-semibold">Output</h2>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => copy(outputText)}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  dir === 'csv2json'
                    ? download(jsonOut, 'converted.json', 'application/json')
                    : download(csvOut, 'converted.csv', 'text/csv')
                }
              >
                <Download className="size-3.5" aria-hidden="true" />
                {dir === 'csv2json' ? 'Download .json' : 'Download .csv'}
              </Button>
            </div>
          </div>
          <pre className="max-h-80 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed">{outputText}</pre>
        </div>
      )}
    </div>
  )
}
