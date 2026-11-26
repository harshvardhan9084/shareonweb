'use client'

// Spreadsheet Studio — an editable grid that is useful before you touch
// anything: a live monthly-budget demo (with real =Qty*Price formulas) is
// loaded on first paint, so the grid, the formula bar and the column stats
// are already doing their job. Opening a file is a local operation: .xlsx,
// .xls and .csv are parsed with SheetJS inside this tab and never upload —
// there is no upload step to trust. The formula engine is hand-written and
// deliberately lite: SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, ROUND, ABS, cell
// refs, ranges and arithmetic. That scope is stated in the UI instead of
// pretending to be Excel. Sort moves values but does not rewrite formula
// refs (stated too); errors surface in-cell as #REF! / #CIRC! / #ERR! /
// #VALUE! / #DIV/0!. Cell testids are 0-based: r0c0 is cell A1.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  Replace,
  RotateCcw,
  Table2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { downloadBlob, PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

// ------------------------------------------------------------------ types

/** A computed cell value: number, text ('' is a blank cell) or an error. */
interface ErrVal {
  err: string
}
type Val = number | string | ErrVal
/** A range (A1:B5) is only meaningful as a direct function argument. */
interface RangeVal {
  range: Val[]
}
type EvalVal = Val | RangeVal

interface Sheet {
  name: string
  /** Raw stored text per cell — formulas start with '='. Row 0 / col 0 first. */
  cells: string[][]
  /** True when the source file had to be trimmed to 26 cols × 2000 rows. */
  trimmed?: boolean
}

interface ComputedSheet {
  vals: Val[][]
  usedRows: number
  usedCols: number
}

// ------------------------------------------------------------- constants

const MAX_ROWS = 2000
const MAX_COLS = 26
const ROW_CHUNK = 60

const COLS = Array.from({ length: MAX_COLS }, (_, i) => String.fromCharCode(65 + i))

function colLabel(c: number): string {
  return COLS[c] ?? '?'
}

type PvAgg = 'sum' | 'avg' | 'count' | 'min' | 'max'

const AGG_LABEL: Record<PvAgg, string> = {
  sum: 'Sum',
  avg: 'Average',
  count: 'Count',
  min: 'Min',
  max: 'Max',
}

function makeDemoSheets(): Sheet[] {
  const budget: string[][] = [
    ['Item', 'Category', 'Qty', 'Unit price', 'Amount'],
    ['Rent', 'Housing', '1', '1450', '=C2*D2'],
    ['Groceries', 'Food', '4', '220', '=C3*D3'],
    ['Transport', 'Transit', '2', '65', '=C4*D4'],
    ['Utilities', 'Housing', '1', '180', '=C5*D5'],
    ['Internet', 'Housing', '1', '40', '=C6*D6'],
    ['Gym', 'Health', '1', '35', '=C7*D7'],
    ['Streaming', 'Fun', '3', '12.5', '=C8*D8'],
    ['Dining out', 'Fun', '5', '30', '=C9*D9'],
    ['Savings', 'Future', '1', '600', '=C10*D10'],
    ['Total', '', '', '', '=SUM(E2:E10)'],
    ['Average line', '', '', '', '=AVERAGE(E2:E10)'],
    ['Cheapest line', '', '', '', '=MIN(E2:E10)'],
    ['Priciest line', '', '', '', '=MAX(E2:E10)'],
  ]
  const notes: string[][] = [
    ['Welcome to Spreadsheet Studio'],
    ['This demo is live: the Amount column is =Qty*Price formulas.'],
    ['Open your own .xlsx, .xls or .csv above — it never leaves this tab.'],
    ['Click a column letter to sort; try the pivot and find-and-replace below.'],
  ]
  return [
    { name: 'Budget', cells: budget, trimmed: false },
    { name: 'Notes', cells: notes, trimmed: false },
  ]
}

// --------------------------------------------------------- number helpers

const NUM_RE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/

/** Strict numeric-cell parse — "12", "3.5", "1e3" are numbers; "12abc" is text. */
function parseCellNumber(s: string): number | null {
  const t = s.trim()
  if (!NUM_RE.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function literalValue(raw: string): Val {
  const t = raw.trim()
  if (t === '') return ''
  const n = parseCellNumber(t)
  return n !== null ? n : raw
}

/** Plain, unambiguous number text — safe to re-import through CSV. */
function fmtPlain(n: number): string {
  if (!Number.isFinite(n)) return '#NUM!'
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n)
  return String(Number.parseFloat(n.toPrecision(12)))
}

function displayOf(v: Val | undefined): string {
  if (v === undefined) return ''
  if (typeof v === 'number') return fmtPlain(v)
  if (typeof v === 'string') return v
  return v.err
}

function isErrDisplay(v: Val | undefined): boolean {
  return v !== undefined && typeof v === 'object' && 'err' in v
}

// -------------------------------------------------------- formula engine

class FormulaError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

// Declared as a function so every `fail(...)` call cuts control flow for the
// type checker (arrow consts returning never do not narrow in TS).
function fail(code: string): never {
  throw new FormulaError(code)
}

type OpChar = '+' | '-' | '*' | '/' | '^'
type NumTok = { k: 'num'; v: number }
type RefTok = { k: 'ref'; r: number; c: number }
type RngTok = { k: 'rng'; r1: number; r2: number; c1: number; c2: number }
type FnTok = { k: 'fn'; name: string }
type OpTok = { k: 'op'; v: OpChar }
type LpTok = { k: 'lp' }
type RpTok = { k: 'rp' }
type CommaTok = { k: 'comma' }
type Tok = NumTok | RefTok | RngTok | FnTok | OpTok | LpTok | RpTok | CommaTok

const RE_RANGE = /^\$?([A-Za-z]{1,2})\$?(\d{1,4})\s*:\s*\$?([A-Za-z]{1,2})\$?(\d{1,4})/
const RE_REF = /^\$?([A-Za-z]{1,2})\$?(\d{1,4})/
const RE_FN = /^([A-Za-z][A-Za-z0-9_.]*)(?=\s*\()/
const RE_NUM = /^(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/

function colFromLetters(letters: string): number {
  let col = 0
  for (const ch of letters.toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64)
  return col - 1 // A → 0
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1
      continue
    }
    if (ch === '(') {
      toks.push({ k: 'lp' })
      i += 1
      continue
    }
    if (ch === ')') {
      toks.push({ k: 'rp' })
      i += 1
      continue
    }
    if (ch === ',') {
      toks.push({ k: 'comma' })
      i += 1
      continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      toks.push({ k: 'op', v: ch })
      i += 1
      continue
    }
    if (/[0-9.]/.test(ch)) {
      const m = RE_NUM.exec(src.slice(i))
      if (!m) throw new FormulaError('#ERR!')
      toks.push({ k: 'num', v: Number(m[0]) })
      i += m[0].length
      continue
    }
    if (/[A-Za-z$]/.test(ch)) {
      const rest = src.slice(i)
      const rng = RE_RANGE.exec(rest)
      if (rng) {
        const c1 = colFromLetters(rng[1])
        const c2 = colFromLetters(rng[3])
        const r1 = Number(rng[2])
        const r2 = Number(rng[4])
        toks.push({
          k: 'rng',
          r1: Math.min(r1, r2),
          r2: Math.max(r1, r2),
          c1: Math.min(c1, c2),
          c2: Math.max(c1, c2),
        })
        i += rng[0].length
        continue
      }
      const ref = RE_REF.exec(rest)
      if (ref) {
        toks.push({ k: 'ref', r: Number(ref[2]), c: colFromLetters(ref[1]) })
        i += ref[0].length
        continue
      }
      const fn = RE_FN.exec(rest)
      if (fn) {
        toks.push({ k: 'fn', name: fn[1].toUpperCase() })
        i += fn[1].length
        continue
      }
      throw new FormulaError('#ERR!')
    }
    throw new FormulaError('#ERR!')
  }
  return toks
}

/**
 * Parse-and-evaluate a formula body (without the leading '='). Refs resolve
 * through `valAt` (0-based), which is where cycle detection lives. Structural
 * problems throw FormulaError; the caller maps them to in-cell error text.
 */
function runFormula(src: string, valAt: (r: number, c: number) => Val): Val {
  let toks: Tok[]
  try {
    toks = tokenize(src)
  } catch {
    return { err: '#ERR!' }
  }

  let p = 0
  const isRange = (v: EvalVal): v is RangeVal => typeof v === 'object' && v !== null && 'range' in v
  const isErr = (v: EvalVal): v is ErrVal => typeof v === 'object' && v !== null && 'err' in v
  const asVal = (v: EvalVal): Val => (isRange(v) ? fail('#VALUE!') : v)
  const asNum = (v: EvalVal): number => {
    if (isRange(v)) fail('#VALUE!')
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      // Numeric-looking text coerces (Excel-ish); real text is #VALUE!.
      const n = parseCellNumber(v)
      if (n === null) fail('#VALUE!')
      return n
    }
    return fail(v.err)
  }
  const flatten = (args: EvalVal[]): Val[] => args.flatMap((a) => (isRange(a) ? a.range : [a]))
  const needArgs = (args: EvalVal[], min: number, max: number) => {
    if (args.length < min || args.length > max) fail('#ERR!')
  }

  const callFn = (name: string, args: EvalVal[]): Val => {
    switch (name) {
      case 'SUM': {
        needArgs(args, 1, 64)
        const vals = flatten(args)
        for (const v of vals) if (isErr(v)) return v
        return vals.reduce<number>((acc, v) => (typeof v === 'number' ? acc + v : acc), 0)
      }
      case 'AVERAGE': {
        needArgs(args, 1, 64)
        const vals = flatten(args)
        for (const v of vals) if (isErr(v)) return v
        const nums = vals.filter((v): v is number => typeof v === 'number')
        if (!nums.length) return { err: '#DIV/0!' }
        return nums.reduce((a, b) => a + b, 0) / nums.length
      }
      case 'MIN':
      case 'MAX': {
        needArgs(args, 1, 64)
        const vals = flatten(args)
        for (const v of vals) if (isErr(v)) return v
        const nums = vals.filter((v): v is number => typeof v === 'number')
        if (!nums.length) return 0
        return name === 'MIN' ? nums.reduce((a, b) => Math.min(a, b)) : nums.reduce((a, b) => Math.max(a, b))
      }
      case 'COUNT': {
        needArgs(args, 1, 64)
        return flatten(args).filter((v) => typeof v === 'number').length
      }
      case 'COUNTA': {
        needArgs(args, 1, 64)
        return flatten(args).filter((v) => !(typeof v === 'string' && v === '')).length
      }
      case 'ROUND': {
        needArgs(args, 1, 2)
        const n = asNum(asVal(args[0]))
        const d = args.length === 2 ? Math.trunc(asNum(asVal(args[1]))) : 0
        const f = Math.pow(10, d)
        const x = n * f
        // Excel-style: half away from zero.
        const r = (Math.sign(x) * Math.round(Math.abs(x))) / f
        return Number.isFinite(r) ? r : { err: '#NUM!' }
      }
      case 'ABS': {
        needArgs(args, 1, 1)
        return Math.abs(asNum(asVal(args[0])))
      }
      default:
        return fail('#ERR!')
    }
  }

  const expr = (): EvalVal => {
    let acc = term()
    for (;;) {
      const t = toks[p]
      if (t && t.k === 'op' && (t.v === '+' || t.v === '-')) {
        p += 1
        const b = asNum(term())
        const a = asNum(acc)
        acc = t.v === '+' ? a + b : a - b
      } else break
    }
    return acc
  }

  const term = (): EvalVal => {
    let acc = unary()
    for (;;) {
      const t = toks[p]
      if (t && t.k === 'op' && (t.v === '*' || t.v === '/')) {
        p += 1
        const b = asNum(unary())
        const a = asNum(acc)
        if (t.v === '*') acc = a * b
        else {
          if (b === 0) fail('#DIV/0!')
          acc = a / b
        }
      } else break
    }
    return acc
  }

  const unary = (): EvalVal => {
    const t = toks[p]
    if (t && t.k === 'op' && (t.v === '-' || t.v === '+')) {
      p += 1
      const n = asNum(unary())
      return t.v === '-' ? -n : n
    }
    return power()
  }

  const power = (): EvalVal => {
    const base = primary()
    const t = toks[p]
    if (t && t.k === 'op' && t.v === '^') {
      p += 1
      const ex = asNum(unary())
      const b = asNum(base)
      const r = Math.pow(b, ex)
      if (Number.isNaN(r) || !Number.isFinite(r)) fail('#NUM!')
      return r
    }
    return base
  }

  const primary = (): EvalVal => {
    const t = toks[p]
    if (!t) fail('#ERR!')
    p += 1
    switch (t.k) {
      case 'num':
        return t.v
      case 'ref':
        if (t.r < 1 || t.r > MAX_ROWS || t.c < 0 || t.c >= MAX_COLS) fail('#REF!')
        return valAt(t.r - 1, t.c)
      case 'rng': {
        if (t.r1 < 1 || t.r2 > MAX_ROWS || t.c1 < 0 || t.c2 >= MAX_COLS) fail('#REF!')
        const out: Val[] = []
        for (let r = t.r1 - 1; r < t.r2; r++) {
          for (let c = t.c1; c <= t.c2; c++) out.push(valAt(r, c))
        }
        return { range: out }
      }
      case 'fn': {
        const nxt = toks[p]
        if (!nxt || nxt.k !== 'lp') fail('#ERR!')
        p += 1
        const args: EvalVal[] = []
        const afterLp = toks[p]
        if (afterLp && afterLp.k !== 'rp') {
          for (;;) {
            args.push(expr())
            const sep = toks[p]
            if (sep && sep.k === 'comma') {
              p += 1
              continue
            }
            break
          }
        }
        const close = toks[p]
        if (!close || close.k !== 'rp') fail('#ERR!')
        p += 1
        return callFn(t.name, args)
      }
      case 'lp': {
        const v = expr()
        const close = toks[p]
        if (!close || close.k !== 'rp') fail('#ERR!')
        p += 1
        return v
      }
      default:
        // A stray ')' ',' or operator with no left operand.
        return fail('#ERR!')
    }
  }

  try {
    const result = expr()
    if (p !== toks.length) fail('#ERR!')
    return asVal(result) // a bare range outside a function is #VALUE!
  } catch (e) {
    return { err: e instanceof FormulaError ? e.code : '#ERR!' }
  }
}

// ------------------------------------------------------- sheet recompute

/** Whole-sheet recompute with memoization and cycle detection (#CIRC!). */
function computeSheetValues(cells: string[][]): ComputedSheet {
  const memo = new Map<number, Val>()
  const visiting = new Set<number>()
  const valAt = (r: number, c: number): Val => {
    const key = r * (MAX_COLS + 1) + c
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    if (visiting.has(key)) return { err: '#CIRC!' }
    const raw = cells[r]?.[c] ?? ''
    let v: Val
    if (raw.startsWith('=')) {
      visiting.add(key)
      let out: Val
      try {
        out = runFormula(raw.slice(1), valAt)
      } catch {
        out = { err: '#ERR!' }
      }
      visiting.delete(key)
      v = out
    } else {
      v = literalValue(raw)
    }
    memo.set(key, v)
    return v
  }

  const vals: Val[][] = []
  let usedRows = 0
  let usedCols = 0
  for (let r = 0; r < cells.length && r < MAX_ROWS; r++) {
    const row = cells[r]
    const vrow: Val[] = []
    let any = false
    const width = Math.min(row.length, MAX_COLS)
    for (let c = 0; c < width; c++) {
      const raw = row[c]
      if (raw === undefined || raw === '') {
        vrow.push('')
        continue
      }
      any = true
      vrow.push(valAt(r, c))
      if (c + 1 > usedCols) usedCols = c + 1
    }
    vals.push(vrow)
    if (any) usedRows = r + 1
  }
  return { vals, usedRows, usedCols }
}

// ---------------------------------------------------------- sheet I/O

type XlsxModule = typeof import('xlsx')
type XlsxCell = import('xlsx').CellObject
type XlsxWorkSheet = import('xlsx').WorkSheet

// Cached engine namespace — warmed on mount, then file open and export stay
// synchronous-fast (beautify-tool pattern).
let xlsxMod: XlsxModule | null = null

async function loadXlsx(): Promise<XlsxModule> {
  if (!xlsxMod) xlsxMod = await import('xlsx')
  return xlsxMod
}

// Warm the chunk as early as possible (module scope, client only).
if (typeof window !== 'undefined') {
  void loadXlsx().catch(() => {
    /* the ready flag still flips; file open retries the import */
  })
}

function withCell(sheet: Sheet, r: number, c: number, text: string): Sheet {
  const rows = sheet.cells.slice()
  while (rows.length <= r) rows.push([])
  const row = (rows[r] ?? []).slice()
  while (row.length <= c) row.push('')
  row[c] = text
  rows[r] = row
  return { ...sheet, cells: rows }
}

/** Workbook sheet → Sheet. Formulas keep their text; everything else keeps
 *  the stored/formatted value. Files are trimmed to 26 cols × 2000 rows. */
function sheetFromWs(mod: XlsxModule, ws: XlsxWorkSheet, name: string): Sheet {
  const ref = ws['!ref']
  if (!ref) return { name, cells: [['']], trimmed: false }
  const range = mod.utils.decode_range(String(ref))
  const rows = Math.min(range.e.r + 1, MAX_ROWS)
  const cols = Math.min(range.e.c + 1, MAX_COLS)
  const trimmed = range.e.r + 1 > MAX_ROWS || range.e.c + 1 > MAX_COLS
  const cells: string[][] = []
  for (let r = 0; r < rows; r++) {
    const row: string[] = []
    for (let c = 0; c < cols; c++) {
      const cell = ws[mod.utils.encode_cell({ r, c })] as XlsxCell | undefined
      if (!cell || cell.t === 'z') {
        row.push('')
        continue
      }
      if (typeof cell.f === 'string' && cell.f.length > 0) row.push('=' + cell.f)
      else if (typeof cell.w === 'string' && cell.w.length > 0) row.push(cell.w)
      else if (cell.v !== undefined && cell.v !== null && typeof cell.v !== 'object') row.push(String(cell.v))
      else row.push('')
    }
    cells.push(row)
  }
  return { name, cells, trimmed }
}

/** Sheet → workbook sheet. Formula cells carry both the formula and the
 *  locally computed value so other tools show a result immediately. */
function buildExportSheet(mod: XlsxModule, cells: string[][], vals: Val[][]): XlsxWorkSheet {
  const ws: XlsxWorkSheet = {}
  let maxR = -1
  let maxC = -1
  for (let r = 0; r < cells.length; r++) {
    const row = cells[r]
    for (let c = 0; c < row.length; c++) {
      const raw = row[c]
      if (raw === undefined || raw === '') continue
      const addr = mod.utils.encode_cell({ r, c })
      if (raw.startsWith('=')) {
        ws[addr] = { t: 's', v: displayOf(vals[r]?.[c]), f: raw.slice(1) }
      } else {
        const n = parseCellNumber(raw)
        ws[addr] = n !== null ? { t: 'n', v: n } : { t: 's', v: raw }
      }
      if (r > maxR) maxR = r
      if (c > maxC) maxC = c
    }
  }
  if (maxR < 0) ws.A1 = { t: 's', v: '' }
  ws['!ref'] = mod.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(maxR, 0), c: Math.max(maxC, 0) } })
  return ws
}

function cleanSheetName(name: string, i: number): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31)
  return cleaned || `Sheet${i + 1}`
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function csvEscape(s: string): string {
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function aggregateOf(nums: number[], count: number, agg: PvAgg): number | null {
  switch (agg) {
    case 'count':
      return count
    case 'sum':
      return nums.length ? nums.reduce((a, b) => a + b, 0) : null
    case 'avg':
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
    case 'min':
      return nums.length ? nums.reduce((a, b) => Math.min(a, b)) : null
    case 'max':
      return nums.length ? nums.reduce((a, b) => Math.max(a, b)) : null
  }
}

// ------------------------------------------------------------ component

function StatChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs tabular-nums text-foreground/80">
      {children}
    </span>
  )
}

export function SpreadsheetTool() {
  const [sheets, setSheets] = useState<Sheet[]>(makeDemoSheets)
  const [active, setActive] = useState(0)
  const [sel, setSel] = useState({ r: 3, c: 4 }) // E4 — a formula cell, so the bar demos itself
  const [edit, setEdit] = useState<{ r: number; c: number } | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [visibleRows, setVisibleRows] = useState(ROW_CHUNK)
  const [sort, setSort] = useState<{ c: number; dir: 'asc' | 'desc' } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [enginesReady, setEnginesReady] = useState(false)
  const [fileErr, setFileErr] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [pivotOpen, setPivotOpen] = useState(false)
  const [pvGroup, setPvGroup] = useState(0)
  const [pvValue, setPvValue] = useState(4)
  const [pvAgg, setPvAgg] = useState<PvAgg>('sum')
  const [findOpen, setFindOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [replaceNote, setReplaceNote] = useState<string | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const flashTimer = useRef<number | null>(null)

  // Lazy engine: flip the ready flag once the xlsx chunk settles (allSettled
  // so a failed chunk still re-renders instead of leaving "warming…" forever).
  useEffect(() => {
    let alive = true
    void Promise.allSettled([loadXlsx()]).then(() => {
      if (alive) setEnginesReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  // Any memo that could read the warmed engine module keeps enginesReady in
  // its deps, so it can never serve a stale pre-engine answer (beautify-tool
  // pattern). ioReady drives the export/open controls' disabled state.
  const ioReady = useMemo(
    () => enginesReady && xlsxMod !== null && sheets.length > 0,
    [enginesReady, sheets.length],
  )

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
    }
  }, [])

  // Keep the selected cell in view when the selection moves by keyboard.
  useEffect(() => {
    const el = gridRef.current?.querySelector(`[data-testid="spreadsheet-cell-r${sel.r}c${sel.c}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [sel])

  const showFlash = (msg: string) => {
    setFlash(msg)
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 3200)
  }

  const activeIdx = Math.max(0, Math.min(active, sheets.length - 1))
  const sheet = sheets[activeIdx]
  const computed = useMemo(() => sheets.map((s) => computeSheetValues(s.cells)), [sheets])
  const comp = computed[activeIdx]

  const displayCols = Math.min(MAX_COLS, Math.max(8, comp.usedCols + 2))
  const rowCount = Math.min(MAX_ROWS, Math.max(comp.usedRows + 4, 24))
  const cols = Array.from({ length: displayCols }, (_, i) => i)
  const rowsToRender = Array.from({ length: Math.min(visibleRows, rowCount) }, (_, i) => i)

  const rawOfSel = sheet.cells[sel.r]?.[sel.c] ?? ''

  // ---- column stats for the selected column over the used range
  const colStats = useMemo(() => {
    const c = Math.max(0, Math.min(sel.c, MAX_COLS - 1))
    let count = 0
    let sum = 0
    let min = Infinity
    let max = -Infinity
    for (let r = 0; r < comp.usedRows; r++) {
      const v = comp.vals[r]?.[c]
      if (typeof v === 'number') {
        count += 1
        sum += v
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    return count > 0 ? { count, sum, avg: sum / count, min, max } : null
  }, [comp, sel.c])

  // ---- pivot-lite over the used range
  const pvGroupE = Math.max(0, Math.min(pvGroup, Math.max(comp.usedCols - 1, 0)))
  const pvValueE = Math.max(0, Math.min(pvValue, Math.max(comp.usedCols - 1, 0)))
  const pivot = useMemo(() => {
    const groups = new Map<string, { count: number; nums: number[] }>()
    for (let r = 0; r < comp.usedRows; r++) {
      const gv = comp.vals[r]?.[pvGroupE]
      const key = displayOf(gv) || '(blank)'
      const vv = comp.vals[r]?.[pvValueE]
      const bucket = groups.get(key) ?? { count: 0, nums: [] }
      if (!(typeof vv === 'string' && vv === '')) bucket.count += 1
      if (typeof vv === 'number') bucket.nums.push(vv)
      groups.set(key, bucket)
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([key, b]) => ({ key, value: aggregateOf(b.nums, b.count, pvAgg) }))
  }, [comp, pvGroupE, pvValueE, pvAgg])

  const colOptions = useMemo(() => {
    const n = Math.max(comp.usedCols, 1)
    return Array.from({ length: n }, (_, c) => {
      const v0 = comp.vals[0]?.[c]
      const hint = typeof v0 === 'string' && v0 !== '' ? ` — ${v0.slice(0, 18)}` : ''
      return { value: String(c), label: `${colLabel(c)}${hint}` }
    })
  }, [comp])

  // ---- find & replace over the raw stored text of the active sheet
  const findState = useMemo(() => {
    if (!findText) return { cellCount: 0, hits: 0, error: null as string | null }
    let re: RegExp
    if (useRegex) {
      try {
        re = new RegExp(findText, 'g')
      } catch (e) {
        return { cellCount: 0, hits: 0, error: e instanceof Error ? e.message : 'Invalid pattern' }
      }
    } else {
      re = new RegExp(escapeRegExp(findText), 'gi')
    }
    let cellCount = 0
    let hits = 0
    for (let r = 0; r < comp.usedRows; r++) {
      const row = sheet.cells[r]
      if (!row) continue
      const width = Math.min(row.length, comp.usedCols)
      for (let c = 0; c < width; c++) {
        const raw = row[c]
        if (!raw) continue
        const m = raw.match(re)
        if (m && m.length > 0) {
          cellCount += 1
          hits += m.length
        }
      }
    }
    return { cellCount, hits, error: null }
  }, [sheet, comp, findText, useRegex])

  // ------------------------------------------------------------ handlers

  const selectCell = (r: number, c: number) => {
    setSel({ r, c })
    setDraft(null)
  }

  const startEdit = (r: number, c: number) => {
    setSel({ r, c })
    setEdit({ r, c })
    setDraft(sheet.cells[r]?.[c] ?? '')
  }

  const commitEdit = () => {
    if (!edit) return
    const { r, c } = edit
    const text = draft ?? ''
    setEdit(null)
    setDraft(null)
    setSheets((prev) => prev.map((s, i) => (i === activeIdx ? withCell(s, r, c, text) : s)))
  }

  const cancelEdit = () => {
    setEdit(null)
    setDraft(null)
  }

  const gridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (edit) return
    const clampR = (r: number) => Math.max(0, Math.min(rowCount - 1, r))
    const clampC = (c: number) => Math.max(0, Math.min(displayCols - 1, c))
    const move = (dr: number, dc: number) => {
      e.preventDefault()
      setSel((s) => ({ r: clampR(s.r + dr), c: clampC(s.c + dc) }))
    }
    switch (e.key) {
      case 'ArrowUp':
        return move(-1, 0)
      case 'ArrowDown':
        return move(1, 0)
      case 'ArrowLeft':
        return move(0, -1)
      case 'ArrowRight':
        return move(0, 1)
      case 'Tab':
        return move(0, e.shiftKey ? -1 : 1)
      case 'Enter':
      case 'F2':
        e.preventDefault()
        startEdit(sel.r, sel.c)
        return
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        setSheets((prev) => prev.map((s, i) => (i === activeIdx ? withCell(s, sel.r, sel.c, '') : s)))
        return
      default:
        return
    }
  }

  const sortColumn = (c: number) => {
    const dir = sort && sort.c === c && sort.dir === 'asc' ? 'desc' : 'asc'
    const n = comp.usedRows
    if (n < 2) {
      setSort({ c, dir })
      return
    }
    const rankOf = (v: Val | undefined): number => {
      if (v === undefined || (typeof v === 'string' && v === '')) return 3 // blanks last
      if (typeof v === 'number') return 0
      if (typeof v === 'string') return 1
      return 2 // error cells after text
    }
    const idx = Array.from({ length: n }, (_, i) => i)
    idx.sort((a, b) => {
      const va = comp.vals[a]?.[c]
      const vb = comp.vals[b]?.[c]
      const ra = rankOf(va)
      const rb = rankOf(vb)
      if (ra !== rb) return ra - rb
      if (ra === 0 && rb === 0) return (va as number) - (vb as number)
      if (ra === 1 && rb === 1) return String(va).localeCompare(String(vb), undefined, { numeric: true })
      return a - b
    })
    if (dir === 'desc') {
      const nonBlank = idx.filter((i) => rankOf(comp.vals[i]?.[c]) !== 3)
      const blanks = idx.filter((i) => rankOf(comp.vals[i]?.[c]) === 3)
      nonBlank.reverse()
      idx.length = 0
      idx.push(...nonBlank, ...blanks)
    }
    const rows = sheet.cells.map((row) => row.slice())
    const nextCells = idx.map((i) => rows[i] ?? []).concat(rows.slice(n))
    setSheets((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, cells: nextCells } : s)))
    setSort({ c, dir })
  }

  const switchSheet = (i: number) => {
    if (i === activeIdx) return
    commitEdit()
    setActive(i)
    setSel({ r: 0, c: 0 })
    setEdit(null)
    setDraft(null)
    setSort(null)
    setVisibleRows(ROW_CHUNK)
    setReplaceNote(null)
  }

  const resetDemo = () => {
    setSheets(makeDemoSheets())
    setActive(0)
    setSel({ r: 3, c: 4 })
    setEdit(null)
    setDraft(null)
    setSort(null)
    setVisibleRows(ROW_CHUNK)
    setPvGroup(0)
    setPvValue(4)
    setPvAgg('sum')
    setFindText('')
    setReplaceText('')
    setUseRegex(false)
    setReplaceNote(null)
    setFileErr(null)
    showFlash('Demo budget restored — every formula recalculated in this tab.')
  }

  const openFiles = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setFileErr(null)
    try {
      const mod = await loadXlsx()
      const isCsv = /\.csv$/i.test(file.name)
      const wb = isCsv
        ? mod.read(await file.text(), { type: 'string' })
        : mod.read(await file.arrayBuffer(), { type: 'array' })
      const names = wb.SheetNames.length > 0 ? wb.SheetNames : [file.name]
      const next: Sheet[] = names.slice(0, 24).map((n, i) =>
        sheetFromWs(mod, wb.Sheets[n] ?? mod.utils.aoa_to_sheet([['']]), n || `Sheet${i + 1}`),
      )
      setSheets(next)
      setActive(0)
      setSel({ r: 0, c: 0 })
      setEdit(null)
      setDraft(null)
      setSort(null)
      setPvGroup(0)
      setPvValue(4)
      setVisibleRows(ROW_CHUNK)
      setReplaceNote(null)
      const first = computeSheetValues(next[0].cells)
      const trimNote = next.some((s) => s.trimmed)
        ? ' — trimmed to the first 26 columns × 2000 rows'
        : ''
      showFlash(
        `Opened ${file.name}: ${next.length} sheet(s), first sheet ${first.usedRows} rows × ${first.usedCols} cols${trimNote}`,
      )
    } catch (e) {
      setFileErr(
        `Could not read ${file.name} — ${e instanceof Error ? e.message : 'unknown format'}. This tool opens .xlsx, .xls and .csv files.`,
      )
    }
  }

  const exportXlsx = async () => {
    if (!enginesReady) return
    try {
      const mod = await loadXlsx()
      const wb = mod.utils.book_new()
      sheets.forEach((s, i) => {
        const cs = computed[i]
        if (!cs) return
        mod.utils.book_append_sheet(wb, buildExportSheet(mod, s.cells, cs.vals), cleanSheetName(s.name, i), true)
      })
      const out = mod.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
      downloadBlob(
        new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        'spreadsheet-studio.xlsx',
      )
      showFlash('Exported spreadsheet-studio.xlsx — formulas carry over as formulas.')
    } catch (e) {
      setFileErr(`Export failed — ${e instanceof Error ? e.message : 'unknown error'}`)
    }
  }

  const exportCsv = () => {
    const R = Math.max(comp.usedRows, 1)
    const C = Math.max(comp.usedCols, 1)
    const lines: string[] = []
    for (let r = 0; r < R; r++) {
      const parts: string[] = []
      for (let c = 0; c < C; c++) parts.push(csvEscape(displayOf(comp.vals[r]?.[c])))
      lines.push(parts.join(','))
    }
    const text = lines.join('\r\n') + '\r\n'
    downloadBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), `${cleanSheetName(sheet.name, activeIdx)}.csv`)
    showFlash(`Exported ${sheet.name} as CSV — formulas were written as their computed values.`)
  }

  const replaceAll = () => {
    if (!findText || findState.error) return
    let re: RegExp | null = null
    try {
      re = useRegex ? new RegExp(findText, 'g') : new RegExp(escapeRegExp(findText), 'gi')
    } catch {
      return
    }
    if (!re) return
    // In plain mode the replacement is literal; in regex mode $1 groups work.
    const literal = useRegex ? replaceText : replaceText.replace(/\$/g, '$$$$')
    const rows = sheet.cells.map((row) => row.slice())
    let hits = 0
    let cellsChanged = 0
    for (let r = 0; r < comp.usedRows; r++) {
      const row = rows[r]
      if (!row) continue
      const width = Math.min(row.length, comp.usedCols)
      for (let c = 0; c < width; c++) {
        const raw = row[c]
        if (!raw) continue
        const m = raw.match(re)
        if (!m || m.length === 0) continue
        hits += m.length
        cellsChanged += 1
        row[c] = raw.replace(re, literal)
      }
    }
    if (hits === 0) {
      setReplaceNote('No matches to replace.')
      return
    }
    setSheets((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, cells: rows } : s)))
    setReplaceNote(`Replaced ${hits} occurrence(s) across ${cellsChanged} cell(s).`)
  }

  // ------------------------------------------------------------- render

  return (
    <div className="space-y-4">
      <style>{`
.ss-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.ss-scroll::-webkit-scrollbar-track { background: transparent; }
.ss-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 8px; }
.ss-scroll::-webkit-scrollbar-thumb:hover { background: var(--muted-foreground); }
.ss-scroll { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
`}</style>

      {/* ---------------------------------------------- DO IT FIRST: drop zone */}
      <div
        data-testid="spreadsheet-dropzone"
        role="button"
        tabIndex={0}
        aria-label="Drop a spreadsheet file or choose one — files open in this tab and never upload"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          dragDepth.current -= 1
          if (dragDepth.current <= 0) {
            dragDepth.current = 0
            setDragging(false)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          dragDepth.current = 0
          setDragging(false)
          void openFiles(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          'flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
          dragging
            ? 'border-emerald-600 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/40'
            : 'border-border bg-muted/30 hover:border-emerald-500/60 hover:bg-muted/50',
        )}
      >
        <Upload className="size-5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
        <p className="text-sm font-medium">Drop a spreadsheet, or pick one — it opens in this tab and never uploads</p>
        <p className="max-w-[62ch] text-xs leading-relaxed text-muted-foreground">
          .xlsx · .xls · .csv, parsed here with SheetJS. Every sheet becomes a tab; files are trimmed to 26 columns ×
          2000 rows. Formulas come in as text and are recalculated locally.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-1"
          onClick={(e) => {
            e.stopPropagation()
            fileInputRef.current?.click()
          }}
        >
          Choose file
        </Button>
        <input
          ref={fileInputRef}
          data-testid="spreadsheet-file-input"
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length > 0) void openFiles(files)
            e.target.value = ''
          }}
        />
      </div>

      {/* ------------------------------------------------- tabs + dims + status */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Workbook sheets">
          {sheets.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === activeIdx}
              data-testid={`spreadsheet-sheet-tab-${i}`}
              title={s.name}
              onClick={() => switchSheet(i)}
              className={cn(
                'min-h-10 rounded-full border px-3.5 text-xs font-medium transition-colors',
                i === activeIdx
                  ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {s.name.length > 24 ? `${s.name.slice(0, 23)}…` : s.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {sheet.name} · {comp.usedRows} rows × {comp.usedCols} cols
          {sheet.trimmed ? ' — trimmed to fit' : ''} · engine{' '}
          {enginesReady ? 'ready, everything runs in this tab' : 'warming…'}
        </p>
      </div>

      {/* --------------------------------------------------------- toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className="flex min-h-11 min-w-14 items-center justify-center rounded-md border bg-muted/50 px-2.5 font-mono text-xs font-semibold text-foreground/80"
        >
          {colLabel(Math.min(sel.c, MAX_COLS - 1))}
          {Math.min(sel.r, MAX_ROWS - 1) + 1}
        </span>
        <Input
          data-testid="spreadsheet-formula-bar"
          aria-label="Formula bar — raw stored content of the selected cell"
          value={edit ? (draft ?? '') : rawOfSel}
          placeholder="Type a value or =SUM(A1:A5) — Enter commits, Escape cancels"
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value
            if (edit) setDraft(v)
            else {
              setEdit({ r: sel.r, c: sel.c })
              setDraft(v)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitEdit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancelEdit()
            }
          }}
          onBlur={commitEdit}
          className="min-h-11 min-w-48 flex-1 font-mono text-[13px]"
        />
        <Button
          type="button"
          variant="outline"
          data-testid="spreadsheet-reset"
          onClick={resetDemo}
          className="min-h-11"
          aria-label="Reset to the demo budget sheet"
        >
          <RotateCcw className="size-4" aria-hidden="true" /> Reset
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid="spreadsheet-export-csv"
          onClick={exportCsv}
          disabled={!ioReady}
          title="Serialize the active sheet to CSV (computed values, formulas become results)"
          className="min-h-11"
        >
          <FileDown className="size-4" aria-hidden="true" /> .csv
        </Button>
        <Button
          type="button"
          data-testid="spreadsheet-export-xlsx"
          onClick={() => void exportXlsx()}
          disabled={!ioReady}
          title="Write every sheet to a real .xlsx (formulas preserved)"
          className="min-h-11"
        >
          <FileSpreadsheet className="size-4" aria-hidden="true" /> .xlsx
        </Button>
      </div>

      {/* ------------------------------------------------ flash / errors */}
      <div aria-live="polite" className="min-h-7 space-y-2">
        {flash && (
          <p
            role="status"
            className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            {flash}
          </p>
        )}
        {fileErr && (
          <p
            role="alert"
            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
          >
            {fileErr}
          </p>
        )}
      </div>

      {/* ---------------------------------------------------- column stats */}
      <div data-testid="spreadsheet-col-stats" aria-label="Column statistics" className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Column {colLabel(Math.min(sel.c, MAX_COLS - 1))}:</span>
        {colStats ? (
          <>
            <StatChip>{colStats.count} numeric</StatChip>
            <StatChip>sum {fmtPlain(colStats.sum)}</StatChip>
            <StatChip>avg {fmtPlain(colStats.avg)}</StatChip>
            <StatChip>min {fmtPlain(colStats.min)}</StatChip>
            <StatChip>max {fmtPlain(colStats.max)}</StatChip>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">no numeric cells in the used range of this column</span>
        )}
      </div>

      {/* ------------------------------------------------------------ grid */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Grid — {sheet.name}</h2>
          <p className="text-xs text-muted-foreground">
            click selects · double-click or Enter edits · arrows move · Delete clears
          </p>
        </div>
        <div
          ref={gridRef}
          data-testid="spreadsheet-grid"
          aria-label={`Sheet ${sheet.name} — ${rowCount} rows by ${displayCols} columns, ${Math.min(visibleRows, rowCount)} rendered`}
          tabIndex={0}
          onKeyDown={gridKeyDown}
          className="ss-scroll max-h-[26rem] overflow-auto rounded-lg border focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-600"
        >
          <table className="w-max border-collapse">
            <thead>
              <tr>
                <th
                  scope="col"
                  aria-label="Row numbers"
                  className="sticky left-0 top-0 z-30 w-10 min-w-10 border-b border-r border-border/60 bg-muted p-0 text-xs font-medium text-muted-foreground"
                >
                  #
                </th>
                {cols.map((c) => {
                  const sortState = sort?.c === c ? sort.dir : null
                  return (
                    <th
                      key={c}
                      scope="col"
                      aria-sort={sortState === 'asc' ? 'ascending' : sortState === 'desc' ? 'descending' : undefined}
                      className="sticky top-0 z-20 border-b border-r border-border/60 bg-muted p-0"
                    >
                      <button
                        type="button"
                        data-testid="spreadsheet-sort-trigger"
                        onClick={() => sortColumn(c)}
                        title={`Sort by column ${colLabel(c)} — ascending first, descending on second click. Sort moves values; formula refs are not rewritten.`}
                        aria-label={`Sort column ${colLabel(c)}, currently ${
                          sortState === 'asc' ? 'ascending' : sortState === 'desc' ? 'descending' : 'unsorted'
                        }. Sort moves values; formula refs are not rewritten.`}
                        className={cn(
                          'flex h-10 w-full min-w-28 items-center justify-between gap-1 px-2.5 text-xs font-semibold tracking-wide transition-colors hover:bg-muted-foreground/10',
                          sortState ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground/80',
                        )}
                      >
                        {colLabel(c)}
                        {sortState === 'asc' && <ArrowUp className="size-3" aria-hidden="true" />}
                        {sortState === 'desc' && <ArrowDown className="size-3" aria-hidden="true" />}
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rowsToRender.map((r) => (
                <tr key={r} className="hover:bg-muted/30">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 w-10 border-b border-r border-border/60 bg-muted px-1 text-right text-[11px] font-medium text-muted-foreground"
                  >
                    {r + 1}
                  </th>
                  {cols.map((c) => {
                    const raw = sheet.cells[r]?.[c] ?? ''
                    const v = comp.vals[r]?.[c]
                    const isErr = isErrDisplay(v)
                    const isNum = typeof v === 'number'
                    const isFormula = raw.startsWith('=')
                    const isSelected = sel.r === r && sel.c === c
                    const isEditingHere = edit !== null && edit.r === r && edit.c === c
                    return (
                      <td
                        key={c}
                        data-testid={`spreadsheet-cell-r${r}c${c}`}
                        data-row={r}
                        data-col={c}
                        onClick={() => selectCell(r, c)}
                        onDoubleClick={() => startEdit(r, c)}
                        className={cn(
                          'relative h-9 min-w-28 max-w-44 cursor-cell border-b border-r border-border/40 px-2 align-middle text-[13px]',
                          isErr
                            ? 'bg-amber-50/80 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : isNum
                              ? 'text-right tabular-nums text-foreground/90'
                              : isFormula
                                ? 'text-violet-700 dark:text-violet-300'
                                : 'text-foreground/90',
                          isSelected &&
                            'z-[5] bg-emerald-50/60 font-medium outline-2 -outline-offset-2 outline-emerald-600 dark:bg-emerald-950/30 dark:outline-emerald-400',
                        )}
                      >
                        {isEditingHere ? (
                          <input
                            autoFocus
                            value={draft ?? ''}
                            aria-label={`Edit ${colLabel(c)}${r + 1}`}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const here = edit
                                commitEdit()
                                if (here) setSel({ r: Math.min(here.r + 1, rowCount - 1), c: here.c })
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                cancelEdit()
                              }
                            }}
                            onBlur={commitEdit}
                            className="absolute inset-0 h-full w-full rounded-none border-0 bg-background px-2 py-0 text-[13px] outline-2 -outline-offset-2 outline-emerald-600 dark:outline-emerald-400"
                          />
                        ) : (
                          <span className="block truncate">{displayOf(v)}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleRows < rowCount && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {Math.min(visibleRows, rowCount)} of {rowCount} rows — rendered in chunks so a 2000-row sheet
              stays smooth.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="spreadsheet-show-more"
              onClick={() => setVisibleRows((v) => Math.min(rowCount, v + ROW_CHUNK))}
            >
              Show {Math.min(ROW_CHUNK, rowCount - visibleRows)} more
            </Button>
          </div>
        )}
        <div className="mt-3 space-y-1 text-xs leading-relaxed text-muted-foreground">
          <p>
            Lite formula engine — supports SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, ROUND, ABS, cell refs like A1,
            ranges like A1:B5 inside functions, unary minus, parentheses and arithmetic with + - * / ^. Not a full
            Excel engine: no IF, no text or date functions, no cross-sheet references.
          </p>
          <p>
            Sort moves values; formula refs are not rewritten. Errors read #REF! (unknown ref), #CIRC!
            (self-reference), #ERR! (unparseable), #VALUE! (text in arithmetic), #DIV/0! (division by zero).
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------ side panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* pivot-lite */}
        <Collapsible open={pivotOpen} onOpenChange={setPivotOpen} data-testid="spreadsheet-pivot">
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-1.5">
                <Table2 className="size-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                Pivot summary
                <ChevronDown
                  className={cn('size-4 transition-transform', pivotOpen && 'rotate-180')}
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ss-pivot-group">Group by</Label>
                  <Select value={String(pvGroupE)} onValueChange={(v) => setPvGroup(Number(v))}>
                    <SelectTrigger id="ss-pivot-group" data-testid="spreadsheet-pivot-group" aria-label="Column to group by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ss-pivot-value">Value column</Label>
                  <Select value={String(pvValueE)} onValueChange={(v) => setPvValue(Number(v))}>
                    <SelectTrigger id="ss-pivot-value" data-testid="spreadsheet-pivot-value" aria-label="Column to aggregate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ss-pivot-agg">Aggregate</Label>
                  <Select value={pvAgg} onValueChange={(v) => setPvAgg(v as PvAgg)}>
                    <SelectTrigger id="ss-pivot-agg" data-testid="spreadsheet-pivot-agg" aria-label="Aggregation function">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sum">Sum</SelectItem>
                      <SelectItem value="avg">Average</SelectItem>
                      <SelectItem value="count">Count</SelectItem>
                      <SelectItem value="min">Min</SelectItem>
                      <SelectItem value="max">Max</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {pivot.length > 0 ? (
                <div className="ss-scroll max-h-56 overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/60">
                        <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                          {colLabel(pvGroupE)} — group
                        </th>
                        <th scope="col" className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                          {AGG_LABEL[pvAgg]} of {colLabel(pvValueE)}
                        </th>
                      </tr>
                    </thead>
                    <tbody data-testid="spreadsheet-pivot-result">
                      {pivot.slice(0, 200).map((row) => (
                        <tr key={row.key} className="border-t border-border/50">
                          <td className="max-w-56 truncate px-3 py-1.5">{row.key}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {row.value === null ? '—' : fmtPlain(row.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nothing to group yet — the used range is empty.</p>
              )}
              {pivot.length > 200 && (
                <p className="text-xs text-muted-foreground">
                  Showing the first 200 of {pivot.length} groups, sorted A→Z.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Groups cover the used range of the active sheet. Sum, average, min and max use only numeric cells;
                count is non-blank cells, so text columns work with count too.
              </p>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* find & replace */}
        <Collapsible open={findOpen} onOpenChange={setFindOpen}>
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-1.5">
                <Replace className="size-4 text-violet-700 dark:text-violet-300" aria-hidden="true" />
                Find &amp; replace
                <ChevronDown
                  className={cn('size-4 transition-transform', findOpen && 'rotate-180')}
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ss-find">Find</Label>
                  <Input
                    id="ss-find"
                    data-testid="spreadsheet-find-input"
                    value={findText}
                    onChange={(e) => {
                      setFindText(e.target.value)
                      setReplaceNote(null)
                    }}
                    placeholder="plain text is case-insensitive"
                    className="min-h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ss-replace">Replace with</Label>
                  <Input
                    id="ss-replace"
                    data-testid="spreadsheet-replace-input"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="in regex mode $1, $2… insert groups"
                    className="min-h-10"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={useRegex}
                    onCheckedChange={setUseRegex}
                    aria-label="Treat the search text as a regular expression"
                  />
                  regular expression
                </label>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="spreadsheet-replace-all"
                  onClick={replaceAll}
                  disabled={!findText || !!findState.error}
                  className="min-h-10"
                >
                  Replace all
                </Button>
              </div>
              <p
                data-testid="spreadsheet-find-status"
                role="status"
                aria-live="polite"
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs leading-relaxed',
                  findState.error
                    ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                    : 'border-border bg-muted/40 text-muted-foreground',
                )}
              >
                {findState.error
                  ? `Invalid pattern — ${findState.error}`
                  : (replaceNote ??
                    (findText
                      ? `${findState.cellCount} cell(s) match · ${findState.hits} occurrence(s) in the active sheet`
                      : 'Type to search the active sheet. Matching runs against stored text — a formula cell matches its formula, not its result.'))}
              </p>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>

      {/* ----------------------------------------------------------- footer */}
      <div className="border-t pt-2">
        <PrivacyStrip detail="Everything runs in this tab — parsing, formulas and export included. Nothing uploads." />
      </div>
    </div>
  )
}

export default SpreadsheetTool
