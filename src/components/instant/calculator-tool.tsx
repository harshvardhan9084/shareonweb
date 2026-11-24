'use client'

// Calculator Studio — a real expression calculator built on a shunting-yard
// parser. No eval, no Function constructor: the expression is tokenized,
// compiled to RPN and evaluated by an explicit stack machine, so malformed
// input gets a named error instead of a security surprise or a NaN shrug.
// Everything runs in this tab; the tape lives in React state and dies with
// the page.

import { useMemo, useState } from 'react'
import { Check, Copy, Delete } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

// ------------------------------------------------------------------ tokens ---

type Tok =
  | { t: 'num'; v: number; raw: string }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' }
  | { t: 'uminus' }
  | { t: 'post'; v: '!' | '%' }
  | { t: 'fn'; v: string }
  | { t: 'const'; v: number; raw: string }
  | { t: '(' }
  | { t: ')' }

const FUNCS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', 'sqrt', 'abs', 'exp',
])

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue }
    // numbers: 12, 3.5, .5, 1e3 — sticky /y pins the start at lastIndex,
    // so there must be NO ^ anchor here (an anchored sticky regex would
    // only ever match at position 0 and reject every number after it).
    const numRe = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y
    numRe.lastIndex = i
    const m = numRe.exec(src)
    if (m) {
      const raw = m[0]
      const v = Number(raw)
      if (Number.isNaN(v)) throw new Error(`"${raw}" is not a valid number`)
      out.push({ t: 'num', v, raw })
      i += raw.length
      continue
    }
    if (c === 'π' || c === 'e') {
      // 'e' is the constant only when not part of an identifier like "exp"
      if (c === 'e' && /[a-z]/i.test(src[i + 1] ?? '')) {
        // fall through to identifier handling below
      } else {
        out.push({ t: 'const', v: c === 'π' ? Math.PI : Math.E, raw: c })
        i++
        continue
      }
    }
    if (/[a-z]/i.test(c)) {
      // sticky, not ^-anchored (same reason as the number regex)
      const idRe = /[a-z]+/iy
      idRe.lastIndex = i
      const id = idRe.exec(src)![0]
      const lower = id.toLowerCase()
      if (!FUNCS.has(lower)) throw new Error(`Unknown name "${id}" — functions: sin, cos, tan, asin, acos, atan, ln, log, sqrt, abs, exp`)
      out.push({ t: 'fn', v: lower })
      i += id.length
      continue
    }
    if (c === '(') { out.push({ t: '(' }); i++; continue }
    if (c === ')') { out.push({ t: ')' }); i++; continue }
    if (c === '+') { out.push({ t: 'op', v: '+' }); i++; continue }
    if (c === '-') {
      const prev = out[out.length - 1]
      const unary = !prev || prev.t === 'op' || prev.t === '(' || prev.t === 'fn' || prev.t === 'uminus'
      out.push(unary ? { t: 'uminus' } : { t: 'op', v: '-' })
      i++
      continue
    }
    if (c === '*' || c === '×') { out.push({ t: 'op', v: '*' }); i++; continue }
    if (c === '/' || c === '÷') { out.push({ t: 'op', v: '/' }); i++; continue }
    if (c === '^') { out.push({ t: 'op', v: '^' }); i++; continue }
    if (c === '!') { out.push({ t: 'post', v: '!' }); i++; continue }
    if (c === '%') { out.push({ t: 'post', v: '%' }); i++; continue }
    throw new Error(`Unexpected character "${c}" at position ${i + 1}`)
  }
  return out
}

// ---------------------------------------------------- shunting-yard to RPN ---

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 }
const RIGHT = new Set(['^'])

function toRpn(toks: Tok[]): Tok[] {
  const out: Tok[] = []
  const stack: Tok[] = []
  let prev: Tok | null = null
  for (const tok of toks) {
    if (tok.t === 'num' || tok.t === 'const') {
      out.push(tok)
    } else if (tok.t === 'fn') {
      stack.push(tok)
    } else if (tok.t === 'uminus') {
      stack.push(tok)
    } else if (tok.t === 'post') {
      out.push(tok) // postfix applies immediately to the value before it
    } else if (tok.t === 'op') {
      // implicit multiplication like 2(3+4) is not supported — say so
      if (prev && (prev.t === 'num' || prev.t === 'const' || prev.t === ')')) {
        // fine: binary operator after a value is normal
      }
      while (stack.length) {
        const top = stack[stack.length - 1]
        if (top.t === 'fn' || top.t === 'uminus' || (top.t === 'op' && (PREC[top.v] > PREC[tok.v] || (PREC[top.v] === PREC[tok.v] && !RIGHT.has(tok.v))))) {
          out.push(stack.pop()!)
        } else break
      }
      stack.push(tok)
    } else if (tok.t === '(') {
      // reject implicit multiplication: 2(3), (1+2)(3)
      if (prev && (prev.t === 'num' || prev.t === 'const' || prev.t === ')')) {
        throw new Error('Insert × for implicit multiplication — "2(3+4)" must be "2 × (3+4)"')
      }
      stack.push(tok)
    } else {
      // ')'
      let found = false
      while (stack.length) {
        const top = stack.pop()!
        if (top.t === '(') { found = true; break }
        out.push(top)
      }
      if (!found) throw new Error('Unbalanced ")" — every opening parenthesis needs a closing one')
      if (stack.length && stack[stack.length - 1].t === 'fn') out.push(stack.pop()!)
    }
    prev = tok
  }
  while (stack.length) {
    const top = stack.pop()!
    if (top.t === '(') throw new Error('Unbalanced "(" — a parenthesis was opened but never closed')
    out.push(top)
  }
  return out
}

// ----------------------------------------------------------------- evaluation

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new Error('Factorial needs a non-negative whole number')
  if (n > 170) throw new Error('Factorial overflows above 170!')
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

function evalRpn(rpn: Tok[], deg: boolean): number {
  const st: number[] = []
  const toRad = (x: number) => (deg ? (x * Math.PI) / 180 : x)
  const fromRad = (x: number) => (deg ? (x * 180) / Math.PI : x)
  for (const tok of rpn) {
    if (tok.t === 'num' || tok.t === 'const') { st.push(tok.v); continue }
    if (tok.t === 'post') {
      const a = st.pop()
      if (a === undefined) throw new Error('Missing a number before "' + tok.v + '"')
      st.push(tok.v === '!' ? factorial(a) : a / 100)
      continue
    }
    if (tok.t === 'uminus') {
      const a = st.pop()
      if (a === undefined) throw new Error('Missing a number after "−"')
      st.push(-a)
      continue
    }
    if (tok.t === 'fn') {
      const a = st.pop()
      if (a === undefined) throw new Error(`"${tok.v}" is missing its argument`)
      let r: number
      switch (tok.v) {
        case 'sin': r = Math.sin(toRad(a)); break
        case 'cos': r = Math.cos(toRad(a)); break
        case 'tan': r = Math.tan(toRad(a)); break
        case 'asin': r = fromRad(Math.asin(a)); break
        case 'acos': r = fromRad(Math.acos(a)); break
        case 'atan': r = fromRad(Math.atan(a)); break
        case 'ln': r = Math.log(a); break
        case 'log': r = Math.log10(a); break
        case 'sqrt':
          if (a < 0) throw new Error('Square root of a negative number is not a real number')
          r = Math.sqrt(a); break
        case 'abs': r = Math.abs(a); break
        case 'exp': r = Math.exp(a); break
        default: throw new Error(`Unknown function "${tok.v}"`)
      }
      if (Number.isNaN(r)) throw new Error(`${tok.v}(${a}) is outside the function's domain`)
      st.push(r)
      continue
    }
    // binary op
    const b = st.pop()
    const a = st.pop()
    if (a === undefined || b === undefined) throw new Error('The expression is missing a number around an operator')
    switch (tok.v) {
      case '+': st.push(a + b); break
      case '-': st.push(a - b); break
      case '*': st.push(a * b); break
      case '/':
        if (b === 0) throw new Error('Division by zero has no answer')
        st.push(a / b); break
      case '^': st.push(Math.pow(a, b)); break
    }
  }
  if (st.length !== 1) throw new Error('Two numbers sit next to each other without an operator')
  const result = st[0]
  if (!Number.isFinite(result)) throw new Error('The result is too large to represent')
  return result
}

export function evaluateExpression(src: string, deg: boolean): number {
  const rpn = toRpn(tokenize(src))
  return evalRpn(rpn, deg)
}

function fmt(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toLocaleString('en-US')
  const abs = Math.abs(n)
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) return n.toExponential(8).replace(/\.?0+e/, 'e')
  return String(Number(n.toPrecision(12)))
}

// ------------------------------------------------------------------- tape ----

interface TapeRow { expr: string; result: string }

// --------------------------------------------------------------------- ui ----

interface Key {
  label: string
  ins?: string
  act?: 'eq' | 'del' | 'clear' | 'ans' | 'ms' | 'mr' | 'mplus' | 'mminus' | 'mc'
  kind?: 'num' | 'op' | 'fn' | 'eq' | 'mem'
  wide?: boolean
}

const BASIC_ROWS: Key[][] = [
  [{ label: 'C', act: 'clear', kind: 'op' }, { label: '( )', ins: '(', kind: 'op' }, { label: '%', ins: '%', kind: 'op' }, { label: '÷', ins: '÷', kind: 'op' }],
  [{ label: '7', ins: '7', kind: 'num' }, { label: '8', ins: '8', kind: 'num' }, { label: '9', ins: '9', kind: 'num' }, { label: '×', ins: '×', kind: 'op' }],
  [{ label: '4', ins: '4', kind: 'num' }, { label: '5', ins: '5', kind: 'num' }, { label: '6', ins: '6', kind: 'num' }, { label: '−', ins: '-', kind: 'op' }],
  [{ label: '1', ins: '1', kind: 'num' }, { label: '2', ins: '2', kind: 'num' }, { label: '3', ins: '3', kind: 'num' }, { label: '+', ins: '+', kind: 'op' }],
  [{ label: '0', ins: '0', kind: 'num', wide: true }, { label: '.', ins: '.', kind: 'num' }, { label: '=', act: 'eq', kind: 'eq' }],
]

const SCI_ROWS: Key[][] = [
  [{ label: 'sin(', ins: 'sin(', kind: 'fn' }, { label: 'cos(', ins: 'cos(', kind: 'fn' }, { label: 'tan(', ins: 'tan(', kind: 'fn' }, { label: 'x^y', ins: '^', kind: 'fn' }, { label: 'n!', ins: '!', kind: 'fn' }],
  [{ label: 'asin(', ins: 'asin(', kind: 'fn' }, { label: 'acos(', ins: 'acos(', kind: 'fn' }, { label: 'atan(', ins: 'atan(', kind: 'fn' }, { label: '√(', ins: 'sqrt(', kind: 'fn' }, { label: 'ln(', ins: 'ln(', kind: 'fn' }],
  [{ label: 'log(', ins: 'log(', kind: 'fn' }, { label: 'abs(', ins: 'abs(', kind: 'fn' }, { label: 'e^(', ins: 'exp(', kind: 'fn' }, { label: 'π', ins: 'π', kind: 'fn' }, { label: 'e', ins: 'e', kind: 'fn' }],
]

const MEM_ROWS: Key[] = [
  { label: 'MS', act: 'ms', kind: 'mem' },
  { label: 'MR', act: 'mr', kind: 'mem' },
  { label: 'M+', act: 'mplus', kind: 'mem' },
  { label: 'M−', act: 'mminus', kind: 'mem' },
  { label: 'MC', act: 'mc', kind: 'mem' },
  { label: 'ANS', act: 'ans', kind: 'mem' },
  { label: '⌫', act: 'del', kind: 'mem' },
]

export function CalculatorTool() {
  const [expr, setExpr] = useState('')
  const [scientific, setScientific] = useState(false)
  const [deg, setDeg] = useState(true)
  const [memory, setMemory] = useState<number | null>(null)
  const [ans, setAns] = useState<number | null>(null)
  const [tape, setTape] = useState<TapeRow[]>([])
  const [copied, setCopied] = useState(false)

  const live = useMemo(() => {
    const src = expr.trim()
    if (!src) return { ok: true as const, value: null, error: '' }
    try {
      const v = evaluateExpression(src, deg)
      return { ok: true as const, value: v, error: '' }
    } catch (e) {
      return { ok: false as const, value: null, error: e instanceof Error ? e.message : 'Invalid expression' }
    }
  }, [expr, deg])

  const commit = () => {
    if (!live.ok || live.value === null) return
    const resultStr = fmt(live.value)
    setAns(live.value)
    setTape((t) => [{ expr: expr.trim(), result: resultStr }, ...t].slice(0, 60))
    setExpr(resultStr.replace(/,/g, ''))
  }

  const insert = (s: string) => setExpr((e) => e + s)

  const act = (k: Key) => {
    if (k.ins !== undefined) return insert(k.ins)
    switch (k.act) {
      case 'eq': return commit()
      case 'del': return setExpr((e) => e.slice(0, -1))
      case 'clear': return setExpr('')
      case 'ans': return insert(ans === null ? '' : fmt(ans).replace(/,/g, ''))
      case 'ms': return live.ok && live.value !== null ? setMemory(live.value) : undefined
      case 'mr': return memory !== null ? insert(fmt(memory).replace(/,/g, '')) : undefined
      case 'mplus': return live.ok && live.value !== null && memory !== null ? setMemory(memory + live.value) : undefined
      case 'mminus': return live.ok && live.value !== null && memory !== null ? setMemory(memory - live.value) : undefined
      case 'mc': return setMemory(null)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
  }

  const copyResult = async () => {
    if (live.value === null) return
    try {
      await navigator.clipboard.writeText(fmt(live.value))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* the display input below remains selectable by hand */
    }
  }

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------- display */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2.5 text-sm">
            <Switch checked={scientific} onCheckedChange={setScientific} aria-label="Scientific keypad" />
            <span>Scientific pad</span>
          </label>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Angles:</span>
            <div className="flex overflow-hidden rounded-lg border" role="group" aria-label="Angle unit">
              {(['DEG', 'RAD'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setDeg(u === 'DEG')}
                  aria-pressed={deg === (u === 'DEG')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium transition-colors',
                    deg === (u === 'DEG') ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          {memory !== null && (
            <span className="rounded-full border bg-muted px-2.5 py-0.5 font-mono text-xs">
              M = {fmt(memory)}
            </span>
          )}
          {ans !== null && (
            <span className="hidden rounded-full border bg-muted px-2.5 py-0.5 font-mono text-xs sm:inline">
              ANS = {fmt(ans)}
            </span>
          )}
        </div>

        <div className="mt-4">
          <Label htmlFor="calc-expr" className="sr-only">Expression</Label>
          <Input
            id="calc-expr"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type an expression, e.g. 12 × (3 + 4) ÷ 5"
            className="h-14 border-0 bg-muted/50 text-right font-mono text-xl focus-visible:ring-1"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
          />
          <div className="flex min-h-9 items-center justify-between gap-3 px-1 pt-2">
            {live.ok ? (
              <button
                type="button"
                onClick={copyResult}
                className="group flex items-baseline gap-2 text-left"
                aria-label={live.value !== null ? `Copy result ${fmt(live.value)}` : undefined}
              >
                <span className="text-xs text-muted-foreground">=</span>
                <span className="font-mono text-lg font-medium tabular-nums">
                  {live.value !== null ? fmt(live.value) : '—'}
                </span>
                {live.value !== null && (
                  copied
                    ? <Check className="size-3.5 self-center text-primary" aria-hidden="true" />
                    : <Copy className="size-3.5 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                )}
              </button>
            ) : (
              <p className="text-sm text-destructive" role="alert">{live.error}</p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setExpr('')} aria-label="Clear expression">
                Clear
              </Button>
              <Button type="button" size="sm" onClick={commit} disabled={!live.ok || live.value === null}>
                Commit to tape
              </Button>
            </div>
          </div>
        </div>
        <PrivacyStrip detail="Everything is evaluated in this tab by a hand-written parser — no eval(), no server round-trip. The tape below lives in page memory and vanishes when you close the tab." />
      </div>

      {/* ----------------------------------------------------------- pads */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        {scientific && (
          <div className="mb-4 grid gap-1.5 sm:grid-cols-5">
            {SCI_ROWS.flat().map((k) => (
              <button
                key={k.label}
                type="button"
                onClick={() => act(k)}
                className="rounded-lg border bg-muted/40 px-2 py-2 font-mono text-xs hover:bg-muted"
              >
                {k.label}
              </button>
            ))}
          </div>
        )}
        <div className="mb-3 grid grid-cols-7 gap-1.5">
          {MEM_ROWS.map((k) => (
            <button
              key={k.label}
              type="button"
              onClick={() => act(k)}
              className="rounded-lg border bg-background px-1 py-2 text-xs font-medium hover:bg-muted"
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="mx-auto grid max-w-md gap-1.5">
          {BASIC_ROWS.map((row, i) => (
            <div key={i} className="grid grid-cols-4 gap-1.5">
              {row.map((k) => (
                <button
                  key={k.label}
                  type="button"
                  onClick={() => act(k)}
                  aria-label={k.ins === undefined ? k.label : `Insert ${k.label}`}
                  className={cn(
                    'rounded-lg px-2 py-3 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    k.wide && 'col-span-2',
                    k.kind === 'eq' && 'bg-primary text-primary-foreground hover:bg-primary/90',
                    k.kind === 'op' && 'bg-muted hover:bg-muted/70',
                    k.kind === 'num' && 'bg-background hover:bg-muted',
                    k.kind === 'fn' && 'bg-muted/40 hover:bg-muted',
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Keyboard works too: digits, operators, Enter to commit, Backspace, Escape to clear. Postfix % divides by 100; postfix ! is factorial.
        </p>
      </div>

      {/* ----------------------------------------------------------- tape */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Tape — this session’s calculations</h2>
          {tape.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setTape([])}>
              Clear tape
            </Button>
          )}
        </div>
        {tape.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Committed calculations collect here. Tap any row to reuse its result.
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto" aria-label="Calculation tape">
            {tape.map((row, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setExpr(row.result.replace(/,/g, ''))}
                  className="flex w-full items-baseline justify-between gap-4 border-b px-4 py-2 text-left last:border-0 hover:bg-muted/40"
                  aria-label={`Reuse result ${row.result} from ${row.expr}`}
                >
                  <span className="font-mono text-xs text-muted-foreground">{row.expr}</span>
                  <span className="font-mono text-sm font-medium tabular-nums">= {row.result}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
