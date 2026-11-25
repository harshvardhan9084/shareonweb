'use client'

// Quadratic solver: ax² + bx + c = 0 answered completely — discriminant,
// both roots (real, repeated, or complex conjugates stated as such), the
// vertex, the axis of symmetry, the opening direction, and the factored
// form when the roots are rational enough to print cleanly. Every number
// comes with the worked steps that produced it (D = b² − 4ac, then the
// quadratic formula with the real values substituted). The SVG plot draws
// the actual parabola from this tab's own math — axis-crossing range chosen
// around the vertex, roots marked where they land — so the shape and the
// algebra always agree.

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PrivacyStrip } from '@/components/instant/instant-kit'

function num(v: string): number {
  const n = Number.parseFloat(v.replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/** Trim a float for display: up to 6 significant decimals, no trailing zeros. */
function fx(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const r = Math.round(n * 1e6) / 1e6
  if (Number.isInteger(r)) return r.toString()
  return r.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

/** Signed term like "+ 5" / "− 3" for use inside an expression line. */
function term(n: number): string {
  const s = fx(Math.abs(n))
  return n < 0 ? `− ${s}` : `+ ${s}`
}

interface RootSet {
  kind: 'two' | 'one' | 'complex'
  x1: number
  x2: number // real part when complex
  imag: number
}

export function QuadraticTool() {
  const [a, setA] = useState('1')
  const [b, setB] = useState('-3')
  const [c, setC] = useState('2')

  const av = num(a)
  const bv = num(b)
  const cv = num(c)
  const valid = Number.isFinite(av) && Number.isFinite(bv) && Number.isFinite(cv) && av !== 0

  const D = valid ? bv * bv - 4 * av * cv : NaN
  const sqrtD = D >= 0 ? Math.sqrt(D) : NaN

  const roots: RootSet | null = !valid
    ? null
    : D > 0
      ? (() => {
          const ra = (-bv - sqrtD) / (2 * av)
          const rb = (-bv + sqrtD) / (2 * av)
          // label x₁ as the smaller root regardless of the sign of a
          return { kind: 'two' as const, x1: Math.min(ra, rb), x2: Math.max(ra, rb), imag: 0 }
        })()
      : D === 0
        ? { kind: 'one', x1: -bv / (2 * av), x2: -bv / (2 * av), imag: 0 }
        : { kind: 'complex', x1: -bv / (2 * av), x2: -bv / (2 * av), imag: Math.sqrt(-D) / (2 * Math.abs(av)) }

  const vertexX = valid ? -bv / (2 * av) : NaN
  const vertexY = valid ? cv - (bv * bv) / (4 * av) : NaN
  const opensUp = av > 0

  // Factored form only when the roots print cleanly at 3 decimals.
  const r1 = roots?.x1 ?? NaN
  const r2 = roots?.x2 ?? NaN
  const canFactor =
    valid && D >= 0
      ? Math.abs(Math.round(r1 * 1000) - r1 * 1000) < 1e-9 && Math.abs(Math.round(r2 * 1000) - r2 * 1000) < 1e-9
      : false

  const factorStr =
    canFactor && roots
      ? `y = ${av === 1 ? '' : fx(av)}(${fx(-r1) === '0' ? 'x' : `(x ${term(-r1)})`})(${fx(-r2) === '0' ? 'x' : `(x ${term(-r2)})`})`.replace('(x)', 'x')
      : null

  // SVG plot: x range spans the interesting region around the vertex, y range
  // from real samples; everything below is precomputed pixel-space geometry
  // so the JSX stays a pure render.
  const W = 560
  const H = 300
  let plotPath: string | null = null
  let axisY = 0
  let axisX = -1 // pixel x of the y-axis when x=0 is in view, else -1
  let rootDots: Array<{ px: number; py: number; label: string; anchor: 'start' | 'end' }> = []
  let vertexDot: { px: number; py: number } | null = null
  if (valid && roots) {
    const span = Math.max(4, Math.min(20, Math.abs(vertexX) * 2 + Math.sqrt(Math.abs(D) + 1) * 3))
    const xMin = vertexX - span / 2
    const xMax = vertexX + span / 2
    const samples: Array<{ x: number; y: number }> = []
    for (let i = 0; i <= 200; i++) {
      const x = xMin + ((xMax - xMin) * i) / 200
      samples.push({ x, y: av * x * x + bv * x + cv })
    }
    const yVals = samples.map((s) => s.y)
    let yMin = Math.min(...yVals)
    let yMax = Math.max(...yVals)
    yMin = Math.min(yMin, -0.5)
    yMax = Math.max(yMax, 0.5)
    const pad = (yMax - yMin) * 0.08
    yMin -= pad
    yMax += pad
    const sx = (x: number) => ((x - xMin) / (xMax - xMin)) * W
    const sy = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H
    plotPath = samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${sx(s.x).toFixed(2)},${sy(s.y).toFixed(2)}`).join(' ')
    axisY = sy(0)
    axisX = xMin <= 0 && xMax >= 0 ? sx(0) : -1
    if (D >= 0) {
      rootDots = [
        { x: roots.x1, label: `x₁ = ${fx(roots.x1)}` },
        { x: roots.x2, label: `x₂ = ${fx(roots.x2)}` },
      ]
        .filter((m) => m.x >= xMin && m.x <= xMax)
        .map((m) => ({
          px: sx(m.x),
          py: sy(0),
          label: m.label,
          anchor: m.x > (xMin + xMax) / 2 ? 'end' : 'start',
        }))
    }
    vertexDot = { px: sx(vertexX), py: sy(vertexY) }
  }

  const steps: string[] = !valid
    ? ['a must be non-zero — with a = 0 the equation is linear, not quadratic.']
    : [
        `D = b² − 4ac = (${fx(bv)})² − 4 × ${fx(av)} × ${fx(cv)} = ${fx(bv * bv)} − ${fx(4 * av * cv)} = ${fx(D)}`,
        D > 0
          ? `D > 0 → two distinct real roots, √D = ${fx(sqrtD)}`
          : D === 0
            ? 'D = 0 → one repeated real root (the parabola touches the x-axis at its vertex)'
            : `D < 0 → no real roots; √${fx(D)} is imaginary, so the roots are complex conjugates`,
        D >= 0 && roots
          ? `x = (−b ± √D) / 2a = (${fx(-bv)} ± ${fx(sqrtD)}) / ${fx(2 * av)} → x₁ = ${fx(roots.x1)}, x₂ = ${fx(roots.x2)}`
          : roots
            ? `x = (−b ± i√|D|) / 2a = ${fx(roots.x1)} ± ${fx(roots.imag)}i`
            : '',
        `Vertex: x = −b/2a = ${fx(vertexX)}, y = c − b²/4a = ${fx(vertexY)} → (${fx(vertexX)}, ${fx(vertexY)})`,
        `${opensUp ? 'a > 0 → the parabola opens upward and the vertex is the minimum' : 'a < 0 → the parabola opens downward and the vertex is the maximum'}`,
      ].filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="quad-a">a (x²)</Label>
          <Input id="quad-a" type="text" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} className="w-24 text-center" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quad-b">b (x)</Label>
          <Input id="quad-b" type="text" inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} className="w-24 text-center" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quad-c">c (constant)</Label>
          <Input id="quad-c" type="text" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} className="w-24 text-center" />
        </div>
        <p className="flex-1 text-xs text-muted-foreground">
          {valid ? (
            <span className="font-mono text-sm text-foreground/80">
              {av === 1 ? '' : av === -1 ? '−' : fx(av)}x² {term(bv)} x {term(cv)} = 0
            </span>
          ) : (
            'Enter real numbers for a, b and c — a cannot be 0.'
          )}
        </p>
      </div>

      {!valid && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {steps[0]}
        </p>
      )}

      {valid && roots && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {roots.kind === 'complex' ? 'Complex roots' : roots.kind === 'one' ? 'Repeated root' : 'Roots'}
            </p>
            <p data-testid="quad-roots" className="mt-1 font-display text-xl font-semibold tracking-[-0.02em]">
              {roots.kind === 'complex'
                ? `${fx(roots.x1)} ± ${fx(roots.imag)}i`
                : roots.kind === 'one'
                  ? `x = ${fx(roots.x1)}`
                  : `x₁ = ${fx(roots.x1)}, x₂ = ${fx(roots.x2)}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {roots.kind === 'complex' ? 'the parabola never crosses the x-axis' : 'where the parabola crosses the x-axis'}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Discriminant</p>
            <p data-testid="quad-discriminant" className="mt-1 font-display text-xl font-semibold tabular-nums tracking-[-0.02em]">
              D = {fx(D)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {D > 0 ? '> 0 → two real roots' : D === 0 ? '= 0 → one repeated root' : '< 0 → complex roots'}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Vertex ({opensUp ? 'minimum' : 'maximum'})</p>
            <p data-testid="quad-vertex" className="mt-1 font-display text-xl font-semibold tracking-[-0.02em]">
              ({fx(vertexX)}, {fx(vertexY)})
            </p>
            <p className="mt-1 text-xs text-muted-foreground">axis of symmetry x = {fx(vertexX)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Factored form</p>
            <p data-testid="quad-factored" className="mt-1 font-mono text-sm font-semibold leading-relaxed">
              {canFactor ? factorStr : roots.kind === 'complex' ? 'not factorable over the reals' : 'roots are irrational — D is not a perfect square'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{opensUp ? 'opens upward' : 'opens downward'}, y-intercept (0, {fx(cv)})</p>
          </div>
        </div>
      )}

      {valid && plotPath && (
        <figure className="rounded-xl border bg-card p-4">
          <figcaption className="text-sm font-semibold">The parabola, drawn from these coefficients</figcaption>
          <svg
            data-testid="quad-plot"
            viewBox={`0 0 ${W} ${H}`}
            className="mt-2 w-full"
            role="img"
            aria-label={`Parabola of ${fx(av)}x² ${term(bv)} x ${term(cv)} with vertex (${fx(vertexX)}, ${fx(vertexY)})`}
          >
            {/* the y = 0 axis */}
            <line x1="0" x2={W} y1={axisY} y2={axisY} className="stroke-border" strokeWidth="1.5" />
            {axisX >= 0 && <line x1={axisX} x2={axisX} y1="0" y2={H} className="stroke-border" strokeWidth="1" />}
            {/* the curve itself */}
            <path d={plotPath} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" />
            {/* vertex */}
            {vertexDot && <circle cx={vertexDot.px} cy={vertexDot.py} r="4" className="fill-primary" />}
            {/* roots on the axis */}
            {rootDots.map((dot) => (
              <g key={dot.label}>
                <circle cx={dot.px} cy={dot.py} r="4.5" className="fill-primary stroke-background" strokeWidth="1.5" />
                <text
                  x={dot.anchor === 'end' ? dot.px - 8 : dot.px + 8}
                  y={dot.py - 8}
                  textAnchor={dot.anchor}
                  className="fill-foreground text-[11px] font-medium"
                >
                  {dot.label}
                </text>
              </g>
            ))}
          </svg>
          <p className="mt-2 text-xs text-muted-foreground">
            Line: the function. Dots on the axis: the roots. The plot rescales around the vertex so the
            interesting region always fills the frame.
          </p>
        </figure>
      )}

      {valid && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">Worked steps</p>
          <ol data-testid="quad-steps" className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-medium text-foreground/70">{i + 1}.</span>
                <span className="font-mono text-[13px] leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <PrivacyStrip detail="The solve, the steps and the plot are computed and drawn in this tab per keystroke — the coefficients never leave the page." />
    </div>
  )
}
