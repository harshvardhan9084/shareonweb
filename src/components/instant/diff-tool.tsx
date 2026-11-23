'use client'

// Text Diff — a real line diff between two texts, computed with the patience
// diff strategy (the same approach as `git diff --patience`): unique common
// lines act as anchors, the longest increasing subsequence of those anchors
// forms the diff spine, and everything between anchors is diffed recursively,
// falling back to prefix/suffix trimming and block replacement when no unique
// anchors remain. Paired replaced lines get a second word-level pass so the
// exact changed words are highlighted inside the row. The tool also writes a
// standard unified diff (--- / +++ / @@ hunks) that applies with `git apply`
// or `patch`. No upload code on this page: both texts are diffed in this tab
// and never sent anywhere.

import { useMemo, useState } from 'react'
import { ArrowLeftRight, Check, Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip } from '@/components/instant/instant-kit'

// ------------------------------------------------------------------ limits ---

/** Refuse to diff more than this many characters per side — honest, not silent. */
const MAX_CHARS = 1_000_000
/** Patience recursion guard: segments deeper than this fall back to blocks. */
const MAX_DEPTH = 64

// ------------------------------------------------------------------- types ---

type LineOp =
  | { type: 'eq'; a: number; b: number }
  | { type: 'del'; a: number }
  | { type: 'ins'; b: number }

/** One word token; `changed` marks the highlighted (removed/added) words. */
interface Token {
  t: string
  changed: boolean
}

interface Row {
  kind: 'eq' | 'del' | 'ins' | 'mod'
  a: number | null
  b: number | null
  /** word-level marked tokens for mod rows: [old line tokens, new line tokens] */
  hl?: { left: Token[]; right: Token[] }
}

interface Stats {
  added: number
  removed: number
  unchanged: number
  changedPairs: number
  similarity: number
}

interface Options {
  ignoreCase: boolean
  ignoreTrail: boolean
  ignoreBlank: boolean
}

// ------------------------------------------------------------- normalization --

function normalizeLine(line: string, o: Options): string {
  let s = line
  if (o.ignoreTrail) s = s.replace(/\s+/g, ' ').trim()
  if (o.ignoreCase) s = s.toLowerCase()
  return s
}

/**
 * Text → lines with trailing-newline semantics a patch reader expects:
 * "a\nb\n" is two lines ending in a newline; "a\nb" is two lines without;
 * "" is zero lines. split("\n") alone would add a phantom tail line that
 * corrupts unified-diff hunk math.
 */
export function toLines(text: string): { lines: string[]; nl: boolean } {
  if (text === '') return { lines: [], nl: false }
  if (text.endsWith('\n')) return { lines: text.slice(0, -1).split('\n'), nl: true }
  return { lines: text.split('\n'), nl: false }
}

// ------------------------------------------------------------ patience diff --

/**
 * Longest increasing subsequence over anchor pairs (patience sorting).
 * pairs must be sorted by first element; returns the chosen subsequence.
 */
function longestIncreasingSubsequence(pairs: Array<[number, number]>): Array<[number, number]> {
  const piles: number[] = [] // top of each pile -> index into `pairs`
  const prev: number[] = new Array(pairs.length).fill(-1)
  for (let i = 0; i < pairs.length; i++) {
    const b = pairs[i][1]
    let lo = 0
    let hi = piles.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (pairs[piles[mid]][1] < b) lo = mid + 1
      else hi = mid
    }
    if (lo === piles.length) piles.push(i)
    else piles[lo] = i
    prev[i] = lo > 0 ? piles[lo - 1] : -1
  }
  const out: Array<[number, number]> = []
  let k = piles.length ? piles[piles.length - 1] : -1
  while (k !== -1) {
    out.push(pairs[k])
    k = prev[k]
  }
  out.reverse()
  return out
}

function lineCounts(lines: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of lines) m.set(l, (m.get(l) ?? 0) + 1)
  return m
}

/**
 * Patience diff on a pair of line arrays (already normalized). Pushes ops
 * into `out` covering the whole pair. Depth-bounded; non-anchorable segments
 * become del+ins blocks, so the result is always a correct diff.
 */
export function patienceDiff(a: string[], b: string[], ai: number, bi: number, depth: number, out: LineOp[]): void {
  let lo = 0
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo++
  let hiA = a.length
  let hiB = b.length
  while (hiA > lo && hiB > lo && a[hiA - 1] === b[hiB - 1]) {
    hiA--
    hiB--
  }
  for (let i = 0; i < lo; i++) out.push({ type: 'eq', a: ai + i, b: bi + i })
  const midA = a.slice(lo, hiA)
  const midB = b.slice(lo, hiB)

  if (midA.length === 0 && midB.length === 0) {
    // already equal
  } else if (midA.length === 0) {
    for (let i = 0; i < midB.length; i++) out.push({ type: 'ins', b: bi + lo + i })
  } else if (midB.length === 0) {
    for (let i = 0; i < midA.length; i++) out.push({ type: 'del', a: ai + lo + i })
  } else if (depth >= MAX_DEPTH) {
    for (let i = 0; i < midA.length; i++) out.push({ type: 'del', a: ai + lo + i })
    for (let i = 0; i < midB.length; i++) out.push({ type: 'ins', b: bi + lo + i })
  } else {
    const ca = lineCounts(midA)
    const cb = lineCounts(midB)
    const posB = new Map<string, number>()
    for (let j = 0; j < midB.length; j++) {
      const l = midB[j]
      if ((ca.get(l) ?? 0) === 1 && (cb.get(l) ?? 0) === 1) posB.set(l, j)
    }
    const pairs: Array<[number, number]> = []
    for (let i = 0; i < midA.length; i++) {
      const j = posB.get(midA[i])
      if (j !== undefined) pairs.push([i, j])
    }
    if (pairs.length > 0) {
      const anchors = longestIncreasingSubsequence(pairs)
      let pa = 0
      let pb = 0
      for (const [x, y] of anchors) {
        patienceDiff(midA.slice(pa, x), midB.slice(pb, y), ai + lo + pa, bi + lo + pb, depth + 1, out)
        out.push({ type: 'eq', a: ai + lo + x, b: bi + lo + y })
        pa = x + 1
        pb = y + 1
      }
      patienceDiff(midA.slice(pa), midB.slice(pb), ai + lo + pa, bi + lo + pb, depth + 1, out)
    } else {
      for (let i = 0; i < midA.length; i++) out.push({ type: 'del', a: ai + lo + i })
      for (let i = 0; i < midB.length; i++) out.push({ type: 'ins', b: bi + lo + i })
    }
  }
  for (let i = 0; i < a.length - hiA; i++) out.push({ type: 'eq', a: ai + hiA + i, b: bi + hiB + i })
}

// -------------------------------------------------------------- word tokens --

function tokenizeWords(line: string): string[] {
  return line.match(/\w+|[^\w\s]|\s+/g) ?? [line]
}

/**
 * Word-level marked tokens for one replaced line pair: every token of the
 * old and the new line, with the removed/added words flagged.
 */
function wordDiff(oldLine: string, newLine: string): { left: Token[]; right: Token[] } {
  const a = tokenizeWords(oldLine)
  const b = tokenizeWords(newLine)
  const ops: LineOp[] = []
  patienceDiff(a, b, 0, 0, 0, ops)
  const left: Token[] = []
  const right: Token[] = []
  for (const op of ops) {
    if (op.type === 'eq') {
      left.push({ t: a[op.a], changed: false })
      right.push({ t: b[op.b], changed: false })
    } else if (op.type === 'del') {
      left.push({ t: a[op.a], changed: true })
    } else {
      right.push({ t: b[op.b], changed: true })
    }
  }
  return { left, right }
}

// --------------------------------------------------------------- row builder --

interface DiffResult {
  rows: Row[]
  ops: LineOp[]
  stats: Stats
}

function buildRows(ops: LineOp[], A: string[], B: string[]): Row[] {
  const rows: Row[] = []
  let i = 0
  while (i < ops.length) {
    const op = ops[i]
    if (op.type === 'eq') {
      rows.push({ kind: 'eq', a: op.a, b: op.b })
      i++
      continue
    }
    const dels: number[] = []
    const ins: number[] = []
    while (i < ops.length && ops[i].type === 'del') {
      dels.push((ops[i] as Extract<LineOp, { type: 'del' }>).a)
      i++
    }
    while (i < ops.length && ops[i].type === 'ins') {
      ins.push((ops[i] as Extract<LineOp, { type: 'ins' }>).b)
      i++
    }
    const pairCount = Math.min(dels.length, ins.length)
    for (let k = 0; k < pairCount; k++) {
      rows.push({ kind: 'mod', a: dels[k], b: ins[k], hl: wordDiff(A[dels[k]], B[ins[k]]) })
    }
    for (let k = pairCount; k < dels.length; k++) rows.push({ kind: 'del', a: dels[k], b: null })
    for (let k = pairCount; k < ins.length; k++) rows.push({ kind: 'ins', a: null, b: ins[k] })
  }
  return rows
}

export function computeDiff(aText: string, bText: string, o: Options): DiffResult {
  const LA = toLines(aText)
  const LB = toLines(bText)
  const A = LA.lines
  const B = LB.lines
  const na = A.map((l) => normalizeLine(l, o))
  const nb = B.map((l) => normalizeLine(l, o))
  const ops: LineOp[] = []
  if (o.ignoreBlank) {
    // diff the non-blank projections, then map back to real line numbers
    const projA: Array<{ n: string; src: number }> = []
    const projB: Array<{ n: string; src: number }> = []
    na.forEach((l, i) => {
      if (l.trim() !== '') projA.push({ n: l, src: i })
    })
    nb.forEach((l, j) => {
      if (l.trim() !== '') projB.push({ n: l, src: j })
    })
    const proj: LineOp[] = []
    patienceDiff(
      projA.map((p) => p.n),
      projB.map((p) => p.n),
      0,
      0,
      0,
      proj,
    )
    for (const op of proj) {
      if (op.type === 'eq') ops.push({ type: 'eq', a: projA[op.a].src, b: projB[op.b].src })
      else if (op.type === 'del') ops.push({ type: 'del', a: projA[op.a].src })
      else ops.push({ type: 'ins', b: projB[op.b].src })
    }
  } else {
    patienceDiff(na, nb, 0, 0, 0, ops)
  }
  const rows = buildRows(ops, A, B)
  let added = 0
  let removed = 0
  let unchanged = 0
  let changedPairs = 0
  for (const r of rows) {
    if (r.kind === 'ins') added++
    else if (r.kind === 'del') removed++
    else if (r.kind === 'mod') {
      added++
      removed++
      changedPairs++
    } else unchanged++
  }
  const total = Math.max(A.length, B.length)
  const similarity = total === 0 ? 100 : Math.round((unchanged / total) * 1000) / 10
  return { rows, ops, stats: { added, removed, unchanged, changedPairs, similarity } }
}

// ------------------------------------------------------------- unified diff --

const NO_NL = '\\ No newline at end of file'

// Exported for the QA harness (scripts/diff-check.ts) — pure functions, no React.
export function unifiedDiff(
  ops: LineOp[],
  A: string[],
  B: string[],
  nlA = true,
  nlB = true,
  context = 3,
): string {
  if (ops.length === 0) return '' // both sides empty
  const changedOp = ops.some((op) => op.type !== 'eq')
  if (!changedOp && nlA === nlB) return ''
  if (!changedOp) {
    // Line contents match but the trailing newline differs — emit the minimal
    // hunk GNU diff would produce, so `git apply` reproduces the file exactly.
    const last = A.length - 1
    const out: string[] = ['--- a/original', '+++ b/original', `@@ -${A.length},1 +${B.length},1 @@`]
    out.push('-' + A[last])
    if (!nlA) out.push(NO_NL)
    out.push('+' + B[last])
    if (!nlB) out.push(NO_NL)
    return out.join('\n')
  }
  const marks: Array<' ' | '-' | '+'> = ops.map((op) =>
    op.type === 'eq' ? ' ' : op.type === 'del' ? '-' : '+',
  )
  const keep = new Set<number>()
  for (let i = 0; i < ops.length; i++) {
    if (marks[i] !== ' ') {
      for (let j = Math.max(0, i - context); j <= Math.min(ops.length - 1, i + context); j++) {
        keep.add(j)
      }
    }
  }
  // When the two sides disagree about the trailing newline, the final line
  // must appear in the diff even if it sits beyond the context window —
  // otherwise the patch silently reproduces the old file's EOF state.
  if (nlA !== nlB) keep.add(ops.length - 1)
  const idx = [...keep].sort((x, y) => x - y)
  const out: string[] = ['--- a/original', '+++ b/original']
  let hunk: string[] = []
  let hunkA = 1
  let hunkB = 1
  let aCount = 0
  let bCount = 0
  const flush = () => {
    if (hunk.length) {
      out.push(`@@ -${hunkA},${aCount} +${hunkB},${bCount} @@`, ...hunk)
      hunk = []
    }
  }
  let prev = -2
  for (const i of idx) {
    if (i !== prev + 1) {
      flush()
      aCount = 0
      bCount = 0
    }
    if (hunk.length === 0) {
      hunkA = hunkStartA(ops, i)
      hunkB = hunkStartB(ops, i)
    }
    const op = ops[i]
    if (op.type === 'eq') {
      // A shared final line whose two sides disagree about the trailing
      // newline cannot be a context line (a marker after ' ' applies to both
      // sides) — split it into -/+ so each side carries its own state.
      const aNoNl = op.a === A.length - 1 && !nlA
      const bNoNl = op.b === B.length - 1 && !nlB
      if (aNoNl !== bNoNl) {
        hunk.push('-' + A[op.a])
        aCount++
        if (aNoNl) hunk.push(NO_NL)
        hunk.push('+' + B[op.b])
        bCount++
        if (bNoNl) hunk.push(NO_NL)
      } else {
        hunk.push(' ' + A[op.a])
        aCount++
        bCount++
        if (aNoNl && bNoNl) hunk.push(NO_NL)
      }
    } else if (op.type === 'del') {
      hunk.push('-' + A[op.a])
      aCount++
      if (op.a === A.length - 1 && !nlA) hunk.push(NO_NL)
    } else {
      hunk.push('+' + B[op.b])
      bCount++
      if (op.b === B.length - 1 && !nlB) hunk.push(NO_NL)
    }
    prev = i
  }
  flush()
  return out.join('\n')
}

/** The a-side 1-based line number at which a hunk starting at ops[i] begins. */
function hunkStartA(ops: LineOp[], i: number): number {
  const op = ops[i]
  if (op.type === 'ins') {
    // insertion between a-lines: first preceding del/eq gives the a position
    for (let j = i - 1; j >= 0; j--) {
      const o = ops[j]
      if (o.type === 'eq') return o.a + 2
      if (o.type === 'del') return o.a + 2
    }
    return 1
  }
  return op.a + 1
}

function hunkStartB(ops: LineOp[], i: number): number {
  const op = ops[i]
  if (op.type === 'del') {
    for (let j = i - 1; j >= 0; j--) {
      const o = ops[j]
      if (o.type === 'eq') return o.b + 2
      if (o.type === 'ins') return o.b + 2
    }
    return 1
  }
  return op.b + 1
}

// ---------------------------------------------------------------- component --

export function DiffTool() {
  const [aText, setAText] = useState('')
  const [bText, setBText] = useState('')
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [ignoreTrail, setIgnoreTrail] = useState(false)
  const [ignoreBlank, setIgnoreBlank] = useState(false)
  const [view, setView] = useState('side')
  const [copied, setCopied] = useState(false)

  const result = useMemo(
    () => computeDiff(aText, bText, { ignoreCase, ignoreTrail, ignoreBlank }),
    [aText, bText, ignoreCase, ignoreTrail, ignoreBlank],
  )
  const aLines = useMemo(() => toLines(aText).lines, [aText])
  const bLines = useMemo(() => toLines(bText).lines, [bText])
  const patch = useMemo(() => {
    if (aText.length > MAX_CHARS || bText.length > MAX_CHARS) return ''
    const LA = toLines(aText)
    const LB = toLines(bText)
    return unifiedDiff(result.ops, LA.lines, LB.lines, LA.nl, LB.nl)
  }, [result.ops, aText, bText])

  const over = aText.length > MAX_CHARS || bText.length > MAX_CHARS
  const hasDiff = !over && (aText !== '' || bText !== '')
  const { added, removed, unchanged, similarity, changedPairs } = result.stats

  const copyPatch = async () => {
    if (!patch) return
    try {
      await navigator.clipboard.writeText(patch)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard refused — the download button is the fallback */
    }
  }

  const downloadPatch = () => {
    if (!patch) return
    const blob = new Blob([patch + (patch.endsWith('\n') ? '' : '\n')], {
      type: 'text/x-diff;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'changes.patch'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const swap = () => {
    setAText(bText)
    setBText(aText)
  }

  return (
    <div>
      {/* ------------------------------------------------------ the two inputs */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <Label htmlFor="diff-original">Original</Label>
            <span className="text-xs text-muted-foreground">
              {aLines.length.toLocaleString()} lines · {aText.length.toLocaleString()} chars
            </span>
          </div>
          <Textarea
            id="diff-original"
            value={aText}
            onChange={(e) => setAText(e.target.value)}
            placeholder="Paste the original text…"
            className="min-h-40 resize-y font-mono text-xs leading-relaxed sm:min-h-52"
            spellCheck={false}
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <Label htmlFor="diff-changed">Changed</Label>
            <span className="text-xs text-muted-foreground">
              {bLines.length.toLocaleString()} lines · {bText.length.toLocaleString()} chars
            </span>
          </div>
          <Textarea
            id="diff-changed"
            value={bText}
            onChange={(e) => setBText(e.target.value)}
            placeholder="Paste the changed text…"
            className="min-h-40 resize-y font-mono text-xs leading-relaxed sm:min-h-52"
            spellCheck={false}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------ options */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Switch id="diff-case" checked={ignoreCase} onCheckedChange={setIgnoreCase} />
          <Label htmlFor="diff-case" className="text-xs font-normal">
            Ignore case
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="diff-trail" checked={ignoreTrail} onCheckedChange={setIgnoreTrail} />
          <Label htmlFor="diff-trail" className="text-xs font-normal">
            Ignore whitespace
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="diff-blank" checked={ignoreBlank} onCheckedChange={setIgnoreBlank} />
          <Label htmlFor="diff-blank" className="text-xs font-normal">
            Ignore blank lines
          </Label>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={swap} disabled={!aText && !bText}>
          <ArrowLeftRight className="size-3.5" aria-hidden="true" /> Swap sides
        </Button>
      </div>

      {/* --------------------------------------------------------- live stats */}
      {hasDiff && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            +{added.toLocaleString()} added
          </span>
          <span className="font-medium text-rose-600 dark:text-rose-400">
            −{removed.toLocaleString()} removed
          </span>
          <span className="text-muted-foreground">{unchanged.toLocaleString()} unchanged</span>
          <span className="text-muted-foreground">
            {similarity}% identical
            {changedPairs ? ` · ${changedPairs.toLocaleString()} edited line${changedPairs === 1 ? '' : 's'}` : ''}
          </span>
        </div>
      )}

      {/* ------------------------------------------------------------- result */}
      {over ? (
        <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          Either text is over the {MAX_CHARS.toLocaleString()} character cap for an in-browser diff.
          Trim the input, or run <code className="font-mono">git diff --no-index</code> on the files.
        </p>
      ) : hasDiff ? (
        <div className="mt-4">
          <Tabs value={view} onValueChange={setView}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="side">Side by side</TabsTrigger>
                <TabsTrigger value="inline">Inline</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyPatch} disabled={!patch}>
                  {copied ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                  {copied ? 'Copied' : 'Copy patch'}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadPatch} disabled={!patch}>
                  <Download className="size-3.5" aria-hidden="true" /> Download .patch
                </Button>
              </div>
            </div>
            <TabsContent value="side" className="mt-3">
              <SideBySide rows={result.rows} aLines={aLines} bLines={bLines} />
            </TabsContent>
            <TabsContent value="inline" className="mt-3">
              <Inline rows={result.rows} aLines={aLines} bLines={bLines} />
            </TabsContent>
          </Tabs>
          {patch && (
            <p className="mt-2 text-xs text-muted-foreground">
              The unified diff pairs lines exactly as shown above, with 3 context lines per hunk — it
              applies with <code className="font-mono">git apply</code> or{' '}
              <code className="font-mono">patch -p1</code>.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Paste text on both sides — the diff appears as you type, computed in this tab.
        </p>
      )}

      <PrivacyStrip detail="Both texts are diffed in this tab with a patience diff — nothing is uploaded, and there is no upload code on this page at all." />
    </div>
  )
}

// ------------------------------------------------------------ diff rendering --

function MarkedTokens({ tokens, tone }: { tokens: Token[]; tone: 'del' | 'ins' }) {
  return (
    <>
      {tokens.map((tk, i) =>
        tk.changed ? (
          <mark
            key={i}
            className={
              tone === 'del'
                ? 'rounded-sm bg-rose-500/30 px-0.5 font-semibold'
                : 'rounded-sm bg-emerald-500/30 px-0.5 font-semibold'
            }
          >
            {tk.t}
          </mark>
        ) : (
          <span key={i}>{tk.t}</span>
        ),
      )}
    </>
  )
}

function SideBySide({ rows, aLines, bLines }: { rows: Row[]; aLines: string[]; bLines: string[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full table-fixed border-collapse font-mono text-xs leading-relaxed">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="w-10 shrink-0 select-none border-r px-2 text-right align-top text-muted-foreground/60">
                  {r.a !== null ? r.a + 1 : ''}
                </td>
                <td
                  className={
                    'w-1/2 truncate px-2 align-top ' +
                    (r.kind === 'del' || r.kind === 'mod'
                      ? 'bg-rose-500/10 text-rose-900 dark:text-rose-100'
                      : '')
                  }
                  title={r.a !== null ? aLines[r.a] : undefined}
                >
                  {r.a !== null &&
                    (r.kind === 'mod' && r.hl ? <MarkedTokens tokens={r.hl.left} tone="del" /> : aLines[r.a])}
                  {r.a === null && '\u00A0'}
                </td>
                <td className="w-10 shrink-0 select-none border-x px-2 text-right align-top text-muted-foreground/60">
                  {r.b !== null ? r.b + 1 : ''}
                </td>
                <td
                  className={
                    'w-1/2 truncate px-2 align-top ' +
                    (r.kind === 'ins' || r.kind === 'mod'
                      ? 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                      : '')
                  }
                  title={r.b !== null ? bLines[r.b] : undefined}
                >
                  {r.b !== null &&
                    (r.kind === 'mod' && r.hl ? <MarkedTokens tokens={r.hl.right} tone="ins" /> : bLines[r.b])}
                  {r.b === null && '\u00A0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Inline({ rows, aLines, bLines }: { rows: Row[]; aLines: string[]; bLines: string[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full table-fixed border-collapse font-mono text-xs leading-relaxed">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="w-10 shrink-0 select-none border-r px-2 text-right align-top text-muted-foreground/60">
                  {r.a !== null ? r.a + 1 : ''}
                </td>
                <td className="w-10 shrink-0 select-none border-r px-2 text-right align-top text-muted-foreground/60">
                  {r.b !== null ? r.b + 1 : ''}
                </td>
                <td className="min-w-0 px-2 align-top">
                  {r.kind === 'eq' && (r.a !== null ? aLines[r.a] : '\u00A0')}
                  {r.kind === 'del' && (
                    <span className="block bg-rose-500/10 text-rose-900 dark:text-rose-100">
                      {r.a !== null ? aLines[r.a] : ''}
                    </span>
                  )}
                  {r.kind === 'ins' && (
                    <span className="block bg-emerald-500/10 text-emerald-900 dark:text-emerald-100">
                      {r.b !== null ? bLines[r.b] : ''}
                    </span>
                  )}
                  {r.kind === 'mod' && r.hl && (
                    <>
                      <span className="block bg-rose-500/10 text-rose-900 line-through decoration-rose-500/40 dark:text-rose-100">
                        <MarkedTokens tokens={r.hl.left} tone="del" />
                      </span>
                      <span className="block bg-emerald-500/10 text-emerald-900 dark:text-emerald-100">
                        <MarkedTokens tokens={r.hl.right} tone="ins" />
                      </span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
