'use client'

// Statistics Calculator — descriptive statistics over pasted numbers, the
// way a stats textbook defines them. Parsing is tolerant (commas, spaces,
// tabs, newlines, and junk around the numbers), quartiles use linear
// interpolation (the same method Excel's PERCENTILE.INC and numpy's default
// use), variance and deviation come in both sample and population flavors,
// and the outlier check is the 1.5×IQR rule. Everything recomputes live on
// every keystroke; nothing leaves the tab.

import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

/** Pull every number out of the text: 12, 3.5 -4e2 … separated by anything. */
function parseNumbers(text: string): { values: number[]; skipped: number } {
  // A token is a signed number with optional decimal and exponent. Anything
  // else (words, stray punctuation, footnotes) is skipped and counted, so the
  // page can honestly say what it ignored instead of silently dropping it.
  const tokenRe = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g
  const values: number[] = []
  let skipped = 0
  // First strip list bullets like "- " used as dashes before numbers? No:
  // "-4" IS a number. The regex handles the sign. Only non-numeric tokens
  // are skipped.
  const matches = text.match(tokenRe) ?? []
  for (const m of matches) {
    const n = Number(m)
    if (Number.isFinite(n)) values.push(n)
    else skipped++
  }
  return { values, skipped }
}

/** Linear-interpolation quantile (PERCENTILE.INC / numpy default). */
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Number.isInteger(n)) return n.toLocaleString()
  // 6 significant digits is enough to verify the math without noise.
  return Number(n.toPrecision(6)).toLocaleString(undefined, { maximumFractionDigits: 6 })
}

interface StatCardProps { label: string; value: string; hint?: string }

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/80">{hint}</p> : null}
    </div>
  )
}

export function StatsTool() {
  const [text, setText] = useState('')
  const [sampleMode, setSampleMode] = useState<'sample' | 'population'>('sample')

  const { values, skipped } = useMemo(() => parseNumbers(text), [text])

  const stats = useMemo(() => {
    const n = values.length
    if (n === 0) return null
    const sorted = [...values].sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)
    const mean = sum / n
    const min = sorted[0]
    const max = sorted[n - 1]
    const range = max - min

    // Median = 50th percentile, same interpolation for odd/even.
    const median = quantile(sorted, 0.5)
    const q1 = quantile(sorted, 0.25)
    const q3 = quantile(sorted, 0.75)
    const iqr = q3 - q1
    const lowFence = q1 - 1.5 * iqr
    const highFence = q3 + 1.5 * iqr
    const outliers = sorted.filter((v) => v < lowFence || v > highFence)

    // Mode: all values tied for the highest frequency. No mode when every
    // value occurs once (the honest answer — many tools print "0" here).
    const freq = new Map<number, number>()
    for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1)
    let topCount = 0
    for (const c of freq.values()) topCount = Math.max(topCount, c)
    const modes: number[] = []
    if (topCount > 1) {
      for (const [v, c] of freq) if (c === topCount) modes.push(v)
      modes.sort((a, b) => a - b)
    }

    // Squared deviations: one loop feeds both flavors.
    let ss = 0
    for (const v of values) ss += (v - mean) ** 2
    const divisor = sampleMode === 'sample' ? n - 1 : n
    const variance = n > 1 || sampleMode === 'population' ? ss / divisor : NaN
    const stdDev = Math.sqrt(variance)

    return { n, sum, mean, median, modes, topCount, min, max, range, q1, q3, iqr, lowFence, highFence, outliers, variance, stdDev, sorted }
  }, [values, sampleMode])

  const histogram = useMemo(() => {
    // Ten-bin frequency table over the observed range — the picture behind
    // the numbers, built from the same data, no library.
    if (!stats || stats.n < 2 || stats.range === 0) return null
    const bins = 10
    const width = stats.range / bins
    const counts = new Array<number>(bins).fill(0)
    for (const v of values) {
      let idx = Math.floor((v - stats.min) / width)
      if (idx >= bins) idx = bins - 1 // the max lands in the last bin
      counts[idx]++
    }
    const maxCount = Math.max(...counts)
    return { counts, width, maxCount }
  }, [stats, values])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="stats-input" className="text-sm font-semibold">
            Paste your numbers
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Variance mode">
            {(
              [
                ['sample', 'Sample (n−1)'],
                ['population', 'Population (n)'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSampleMode(key)}
                aria-pressed={sampleMode === key}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  sampleMode === key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <textarea
          id="stats-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          spellCheck={false}
          placeholder={'Paste numbers in any format — one per line, comma or space separated:\n78 84 91 77 85, 92\n88.5\n64'}
          className="mt-2 w-full rounded-md border bg-background px-3.5 py-2.5 font-mono text-sm leading-relaxed"
        />
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {values.length === 0
            ? 'Results appear as you type — commas, spaces, tabs and newlines all work; stray words are skipped.'
            : `${values.length.toLocaleString()} number${values.length === 1 ? '' : 's'} parsed${skipped > 0 ? ` · ${skipped} non-numeric token${skipped === 1 ? '' : 's'} skipped` : ''}.`}
        </p>
      </div>

      {stats && (
        <>
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="size-4 text-primary" aria-hidden="true" /> Central tendency & spread
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label="Count (n)" value={fmt(stats.n)} />
              <StatCard label="Sum" value={fmt(stats.sum)} />
              <StatCard label="Mean (x̄)" value={fmt(stats.mean)} hint="sum ÷ n" />
              <StatCard label="Median" value={fmt(stats.median)} hint="50th percentile" />
              <StatCard
                label="Mode"
                value={stats.modes.length ? fmt(stats.modes[0]) : 'none'}
                hint={
                  stats.modes.length > 3
                    ? `${stats.modes.length} values tied at ×${stats.topCount}`
                    : stats.modes.length > 1
                      ? `multi-modal: ${stats.modes.map((m) => fmt(m)).join(', ')}`
                      : stats.modes.length === 1
                        ? `occurs ×${stats.topCount}`
                        : 'every value occurs once'
                }
              />
              <StatCard label="Min" value={fmt(stats.min)} />
              <StatCard label="Max" value={fmt(stats.max)} />
              <StatCard label="Range" value={fmt(stats.range)} hint="max − min" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Variability</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard
                label={sampleMode === 'sample' ? 'Variance (s²)' : 'Variance (σ²)'}
                value={fmt(stats.variance)}
                hint={sampleMode === 'sample' ? 'sum of squared deviations ÷ (n−1)' : 'sum of squared deviations ÷ n'}
              />
              <StatCard
                label={sampleMode === 'sample' ? 'Std deviation (s)' : 'Std deviation (σ)'}
                value={fmt(stats.stdDev)}
                hint="√variance"
              />
              <StatCard label="Q1 (25th %ile)" value={fmt(stats.q1)} hint="linear interpolation" />
              <StatCard label="Q3 (75th %ile)" value={fmt(stats.q3)} hint="linear interpolation" />
              <StatCard label="IQR" value={fmt(stats.iqr)} hint="Q3 − Q1" />
              <StatCard label="Low fence" value={fmt(stats.lowFence)} hint="Q1 − 1.5×IQR" />
              <StatCard label="High fence" value={fmt(stats.highFence)} hint="Q3 + 1.5×IQR" />
              <StatCard
                label="Outliers"
                value={stats.outliers.length ? String(stats.outliers.length) : 'none'}
                hint={stats.outliers.length ? stats.outliers.slice(0, 6).map((v) => fmt(v)).join(', ') + (stats.outliers.length > 6 ? ' …' : '') : 'inside the 1.5×IQR fences'}
              />
            </div>
          </div>

          {histogram && (
            <div className="rounded-xl border bg-card p-4 sm:p-5">
              <h2 className="text-sm font-semibold">Distribution</h2>
              <div className="mt-3 space-y-1.5" role="img" aria-label="Ten-bin frequency histogram of the pasted numbers">
                {histogram.counts.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                      {fmt(stats.min + i * histogram.width)}
                    </span>
                    <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm bg-primary/70"
                        style={{ width: `${(c / histogram.maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 font-mono text-xs tabular-nums text-muted-foreground">{c}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Ten equal bins across the observed range {fmt(stats.min)} → {fmt(stats.max)}; bar length is the count in that bin.
              </p>
            </div>
          )}

          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Sorted data</h2>
            <p className="mt-2 max-h-32 overflow-y-auto font-mono text-xs leading-relaxed text-muted-foreground">
              {stats.sorted.map((v) => fmt(v)).join(' · ')}
            </p>
          </div>
        </>
      )}

      <PrivacyStrip detail="The numbers you paste exist only in this tab: parsing, sorting, quartiles, variance and the histogram are computed by this page on your device, and nothing is submitted anywhere." />
    </div>
  )
}
