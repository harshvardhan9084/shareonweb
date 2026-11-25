'use client'

// Fraction studio: two fractions, one operation, the answer three ways
// (unreduced, reduced by the GCD, mixed number) plus the decimal expansion,
// with every intermediate step printed — LCD rewriting for + and −, the
// cross products for ×, keep-change-flip for ÷. A second converter handles
// fraction ↔ decimal in both directions, including a long-division engine
// that detects and annotates repeating cycles (1/7 → 0.(142857)) and a
// bounded denominator search that turns a decimal back into the fraction it
// most plausibly was. All integer math on Numbers — numerators and
// denominators are clamped to ±2^53 so every product stays exact.

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PrivacyStrip } from '@/components/instant/instant-kit'

type Op = '+' | '−' | '×' | '÷'

/** Greatest common divisor by Euclid, on non-negative integers. */
function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y > 0) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

/** Least common multiple, guarded against overflow to stay honest. */
function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  const g = gcd(a, b)
  const prod = a / g
  if (Math.abs(prod) > Number.MAX_SAFE_INTEGER / Math.abs(b)) return NaN
  return Math.abs(prod * b)
}

interface Frac {
  n: number
  d: number
}

function reduce(f: Frac): Frac {
  if (f.d === 0) return f
  const g = gcd(f.n, f.d) || 1
  let n = f.n / g
  let d = f.d / g
  // keep the sign on the numerator, denominator positive
  if (d < 0) {
    n = -n
    d = -d
  }
  return { n, d }
}

function fmtInt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fracStr(f: Frac): string {
  return f.d === 1 ? fmtInt(f.n) : `${fmtInt(f.n)}/${fmtInt(f.d)}`
}

/** Fraction -> mixed-number string like "1 7/12" or "-2 1/3". */
function mixedStr(f: Frac): string | null {
  if (f.d === 0 || Math.abs(f.n) < Math.abs(f.d) || f.d === 1) return null
  const sign = f.n < 0 ? '-' : ''
  const whole = Math.floor(Math.abs(f.n) / f.d)
  const rem = Math.abs(f.n) % f.d
  return rem === 0 ? `${sign}${whole}` : `${sign}${whole} ${rem}/${f.d}`
}

/** Long division with cycle detection: returns the decimal expansion with
 *  the repeating part parenthesised, or null when the denominator is 0. */
function longDivide(n: number, d: number): { text: string; repeating: boolean } | null {
  if (d === 0) return null
  const sign = (n < 0) !== (d < 0) ? '-' : ''
  let an = Math.abs(n)
  const ad = Math.abs(d)
  let whole = Math.floor(an / ad)
  let rem = an % ad
  if (rem === 0) return { text: `${sign}${whole}`, repeating: false }
  const digits: string[] = []
  const seen = new Map<number, number>()
  let repeatAt = -1
  while (rem !== 0) {
    if (seen.has(rem)) {
      repeatAt = seen.get(rem) ?? -1
      break
    }
    seen.set(rem, digits.length)
    an = rem * 10
    digits.push(String(Math.floor(an / ad)))
    rem = an % ad
  }
  if (repeatAt === -1) {
    return { text: `${sign}${whole}.${digits.join('')}`, repeating: false }
  }
  const nonRep = digits.slice(0, repeatAt).join('')
  const rep = digits.slice(repeatAt).join('')
  const shown = rep.length > 16 ? `${rep.slice(0, 16)}…` : rep
  return {
    text: `${sign}${whole}.${nonRep}(${shown})${rep.length > 16 ? ' repeating' : ''}`,
    repeating: true,
  }
}

/** Decimal -> fraction by bounded denominator search, exact when possible. */
function decimalToFrac(raw: string): { frac: Frac | null; exact: boolean; note: string | null } {
  const s = raw.trim()
  if (!/^-?\d*(\.\d+)?$/.test(s) || s === '' || s === '-' || s === '.') {
    return { frac: null, exact: false, note: 'Enter a plain decimal like 0.375 (up to 8 decimal places).' }
  }
  const value = Number.parseFloat(s)
  if (!Number.isFinite(value)) {
    return { frac: null, exact: false, note: 'That decimal is out of range.' }
  }
  const decimals = s.includes('.') ? s.split('.')[1]?.length ?? 0 : 0
  if (decimals <= 8) {
    // exact by place value: 0.375 = 375/1000
    const den = Math.pow(10, decimals)
    const n = Math.round(value * den)
    return { frac: reduce({ n, d: den }), exact: true, note: null }
  }
  // beyond 8 places, search small denominators for the closest fit
  let best: Frac | null = null
  let bestErr = Infinity
  for (let d = 2; d <= 10000; d++) {
    const n = Math.round(value * d)
    if (Math.abs(n) > Number.MAX_SAFE_INTEGER) break
    const err = Math.abs(value - n / d)
    if (err < bestErr - 1e-12) {
      bestErr = err
      best = reduce({ n, d })
    }
    if (err < 1e-12) break
  }
  if (!best) return { frac: null, exact: false, note: 'No close fraction found.' }
  return {
    frac: best,
    exact: bestErr < 1e-9,
    note: `Closest small-denominator fraction (error ${bestErr.toExponential(2)}) — long decimals may not have a short exact fraction.`,
  }
}

const OPS: Op[] = ['+', '−', '×', '÷']

export function FractionTool() {
  const [a1, setA1] = useState('3')
  const [a2, setA2] = useState('4')
  const [op, setOp] = useState<Op>('+')
  const [b1, setB1] = useState('5')
  const [b2, setB2] = useState('6')

  // converter state
  const [convFrac, setConvFrac] = useState('1/7')
  const [convDec, setConvDec] = useState('0.375')

  const n1 = Number.parseInt(a1, 10)
  const d1 = Number.parseInt(a2, 10)
  const n2 = Number.parseInt(b1, 10)
  const d2 = Number.parseInt(b2, 10)
  const validA = Number.isFinite(n1) && Number.isFinite(d1) && d1 !== 0 && Math.abs(n1) < 2 ** 53 && Math.abs(d1) < 2 ** 53
  const validB = Number.isFinite(n2) && Number.isFinite(d2) && d2 !== 0 && Math.abs(n2) < 2 ** 53 && Math.abs(d2) < 2 ** 53

  let raw: Frac | null = null
  let steps: string[] = []
  if (validA && validB) {
    if (op === '+') {
      const l = lcm(d1, d2)
      if (Number.isFinite(l)) {
        const m1 = l / d1
        const m2 = l / d2
        raw = reduce({ n: n1 * m1 + n2 * m2, d: l })
        steps = [
          `LCD of ${d1} and ${d2} is ${l}`,
          `${n1}/${d1} = ${n1 * m1}/${l}  (× ${m1})`,
          `${n2}/${d2} = ${n2 * m2}/${l}  (× ${m2})`,
          `${n1 * m1} + ${n2 * m2} = ${n1 * m1 + n2 * m2} over ${l} → ${n1 * m1 + n2 * m2}/${l}`,
        ]
      } else {
        raw = null
        steps = ['The denominators multiply past exact integer range — use smaller numbers.']
      }
    } else if (op === '−') {
      const l = lcm(d1, d2)
      if (Number.isFinite(l)) {
        const m1 = l / d1
        const m2 = l / d2
        raw = reduce({ n: n1 * m1 - n2 * m2, d: l })
        steps = [
          `LCD of ${d1} and ${d2} is ${l}`,
          `${n1}/${d1} = ${n1 * m1}/${l}  (× ${m1})`,
          `${n2}/${d2} = ${n2 * m2}/${l}  (× ${m2})`,
          `${n1 * m1} − ${n2 * m2} = ${n1 * m1 - n2 * m2} over ${l} → ${n1 * m1 - n2 * m2}/${l}`,
        ]
      } else {
        raw = null
        steps = ['The denominators multiply past exact integer range — use smaller numbers.']
      }
    } else if (op === '×') {
      raw = reduce({ n: n1 * n2, d: d1 * d2 })
      steps = [
        `Numerators: ${n1} × ${n2} = ${n1 * n2}`,
        `Denominators: ${d1} × ${d2} = ${d1 * d2}`,
        `${n1 * n2}/${d1 * d2}`,
      ]
    } else {
      if (n2 === 0) {
        raw = null
        steps = ['Division by the zero fraction 0/' + d2 + ' is undefined — there is no number that multiplied by 0/' + d2 + ' gives ' + n1 + '/' + d1 + '.']
      } else {
        raw = reduce({ n: n1 * d2, d: d1 * n2 })
        steps = [
          `Keep ${n1}/${d1}, change ÷ to ×, flip ${n2}/${d2} to ${d2}/${n2}`,
          `${n1} × ${d2} = ${n1 * d2}  (numerators)`,
          `${d1} × ${n2} = ${d1 * n2}  (denominators)`,
          `${n1 * d2}/${d1 * n2}`,
        ]
      }
    }
    if (raw) {
      const g = gcd(raw.n, raw.d)
      if (g > 1 && raw.d !== 1) {
        steps.push(`GCD(${Math.abs(raw.n)}, ${Math.abs(raw.d)}) = ${g} → divide top and bottom by ${g}`)
      }
    }
  } else {
    steps = []
  }

  const reduced = raw
  const mixed = raw ? mixedStr(raw) : null
  const dec = raw && raw.d !== 0 ? longDivide(raw.n, raw.d) : null

  // converter: fraction -> decimal
  const cf = /^(-?\d+)\s*\/\s*(\d+)$/.exec(convFrac.trim())
  const cNum = cf ? Number.parseInt(cf[1], 10) : NaN
  const cDen = cf ? Number.parseInt(cf[2], 10) : NaN
  const convFracDec = Number.isFinite(cNum) && Number.isFinite(cDen) && cDen !== 0 ? longDivide(cNum, cDen) : null

  // converter: decimal -> fraction
  const decParsed = decimalToFrac(convDec)

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-center gap-3">
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="frac-a1" className="sr-only">First numerator</Label>
              <Input
                id="frac-a1"
                aria-label="First numerator"
                type="text"
                inputMode="numeric"
                value={a1}
                onChange={(e) => setA1(e.target.value)}
                className="w-20 text-center"
              />
              <Input
                id="frac-a2"
                aria-label="First denominator"
                type="text"
                inputMode="numeric"
                value={a2}
                onChange={(e) => setA2(e.target.value)}
                className="w-20 text-center"
              />
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5 pb-1" role="group" aria-label="Operation">
            {OPS.map((o) => (
              <Button
                key={o}
                type="button"
                size="sm"
                variant={op === o ? 'default' : 'outline'}
                className="h-8 w-10 px-0 text-base"
                aria-pressed={op === o}
                aria-label={`Operation ${o}`}
                onClick={() => setOp(o)}
              >
                {o}
              </Button>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="frac-b1" className="sr-only">Second numerator</Label>
              <Input
                id="frac-b1"
                aria-label="Second numerator"
                type="text"
                inputMode="numeric"
                value={b1}
                onChange={(e) => setB1(e.target.value)}
                className="w-20 text-center"
              />
              <Input
                id="frac-b2"
                aria-label="Second denominator"
                type="text"
                inputMode="numeric"
                value={b2}
                onChange={(e) => setB2(e.target.value)}
                className="w-20 text-center"
              />
            </div>
          </div>
        </div>

        {(!validA || !validB || !raw) && steps.length > 0 && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {steps[steps.length - 1]}
          </p>
        )}
        {(!validA || !validB) && steps.length === 0 && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Enter integer numerators and non-zero denominators (|n|, |d| below 9,007,199,254,740,991 so every product stays exact).
          </p>
        )}

        {raw && (
          <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
              <p className="text-xs font-medium text-muted-foreground">Reduced answer</p>
              <p data-testid="frac-result" className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em]">
                {fracStr(raw)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {reduced && reduced.d === 1 ? 'a whole number' : `numerator ${fmtInt(raw.n)} · denominator ${fmtInt(raw.d)}`}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Mixed number</p>
              <p data-testid="frac-mixed" className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em]">
                {mixed ?? '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {mixed ? 'whole part and proper remainder' : 'already a proper fraction'}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">As a decimal</p>
              <p data-testid="frac-decimal" className="mt-1 font-display text-xl font-semibold tracking-[-0.02em]">
                {dec?.text ?? '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dec?.repeating ? 'parenthesised digits repeat forever' : 'terminating decimal'}
              </p>
            </div>
          </div>
        )}

        {steps.length > 0 && raw && (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold">Worked steps</p>
            <ol data-testid="frac-steps" className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-medium text-foreground/70">{i + 1}.</span>
                  <span className="font-mono text-[13px] leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="grid gap-4 border-t pt-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="frac-conv-frac">Fraction → decimal (with repeat detection)</Label>
          <Input
            id="frac-conv-frac"
            type="text"
            value={convFrac}
            onChange={(e) => setConvFrac(e.target.value)}
            placeholder="like 1/7 or 3/8"
            className="font-mono"
          />
          <p data-testid="frac-conv-out" className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
            {convFracDec ? convFracDec.text : 'Enter a fraction as n/d (non-zero denominator).'}
          </p>
          <p className="text-xs text-muted-foreground">
            {convFracDec?.repeating
              ? 'The repeating block is found by long division — the digits in parentheses loop forever.'
              : 'A fraction of integers always terminates or repeats; irrational numbers cannot be written as one.'}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="frac-conv-dec">Decimal → fraction</Label>
          <Input
            id="frac-conv-dec"
            type="text"
            inputMode="decimal"
            value={convDec}
            onChange={(e) => setConvDec(e.target.value)}
            placeholder="like 0.375"
            className="font-mono"
          />
          <p className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
            {decParsed.frac ? fracStr(decParsed.frac) : decParsed.note ?? '—'}
            {decParsed.frac && !decParsed.exact ? ' (approximate)' : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            Up to 8 decimal places the conversion is exact by place value; longer decimals get the closest
            small-denominator fraction, stated honestly as approximate.
          </p>
        </div>
      </div>

      <PrivacyStrip detail="Every step is computed in this tab with exact integer arithmetic — nothing is sent, nothing is stored." />
    </div>
  )
}
