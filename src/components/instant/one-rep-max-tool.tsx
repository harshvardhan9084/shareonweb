'use client'

// One-rep-max estimator: a weight you can lift for r reps becomes a 1RM
// estimate under four published formulas — Epley, Brzycki, Lander and
// Lombardi — plus a consensus that averages the three the checklist names
// (Epley/Brzycki/Lander). Below the estimates sits the training-percentage
// table (%1RM -> load and the rep count it typically allows). The formulas
// diverge as reps climb, so the page names the honest window: estimates are
// most trustworthy at 1–6 reps, and nothing here replaces a properly
// supervised true 1RM test.

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { PrivacyStrip } from '@/components/instant/instant-kit'

function num(v: string): number {
  const n = Number.parseFloat(v.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : NaN
}

function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** The four published formulas, weight × reps -> estimated 1RM. */
function epley(w: number, r: number): number {
  return w * (1 + r / 30)
}
function brzycki(w: number, r: number): number {
  return w * (36 / (37 - r))
}
function lander(w: number, r: number): number {
  return (100 * w) / (101.3 - 2.67123 * r)
}
function lombardi(w: number, r: number): number {
  return w * Math.pow(r, 0.1)
}

/** Epley-derived rep counts for each training percentage — the widely
 *  published chart, rounded to whole reps. */
const TRAINING: Array<{ pct: number; reps: string; zone: string }> = [
  { pct: 95, reps: '2', zone: 'strength — heavy singles and doubles' },
  { pct: 90, reps: '4', zone: 'strength' },
  { pct: 85, reps: '6', zone: 'strength–hypertrophy' },
  { pct: 80, reps: '8', zone: 'hypertrophy — the classic 8s' },
  { pct: 75, reps: '10', zone: 'hypertrophy' },
  { pct: 70, reps: '12', zone: 'hypertrophy–endurance' },
  { pct: 60, reps: '16+', zone: 'endurance and technique work' },
]

export function OneRepMaxTool() {
  const [weight, setWeight] = useState('100')
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg')
  const [reps, setReps] = useState('5')

  const w = num(weight)
  const r = num(reps)
  const valid = Number.isFinite(w) && w > 0 && Number.isFinite(r) && r >= 1 && r <= 20

  const e = valid ? epley(w, r) : NaN
  const b = valid ? brzycki(w, r) : NaN
  const l = valid ? lander(w, r) : NaN
  const lo = valid ? lombardi(w, r) : NaN
  const consensus = valid ? (e + b + l) / 3 : NaN

  const cards: Array<{ name: string; value: number; note: string }> = [
    { name: 'Epley', value: e, note: 'w × (1 + reps/30) — the classic 1985 formula' },
    { name: 'Brzycki', value: b, note: 'w × 36 / (37 − reps) — flatter at high reps' },
    { name: 'Lander', value: l, note: '100w / (101.3 − 2.67123r) — close to Brzycki' },
    { name: 'Lombardi', value: lo, note: 'w × reps^0.10 — the power-law outlier' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid items-end gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="orm-weight">Weight lifted</Label>
          <div className="flex gap-2">
            <Input
              id="orm-weight"
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="flex-1"
            />
            <Select value={unit} onValueChange={(v) => setUnit(v as 'kg' | 'lb')}>
              <SelectTrigger className="w-20" aria-label="Weight unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="lb">lb</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="orm-reps">Reps completed (1–20)</Label>
          <Input
            id="orm-reps"
            type="number"
            min={1}
            max={20}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Enter a set you actually finished (or could have finished) — the formulas assume a true maximal set.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-live="polite">
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 sm:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">Consensus 1RM (Epley · Brzycki · Lander averaged)</p>
          <p data-testid="orm-consensus" className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em]">
            {valid ? `${fmt(consensus)} ${unit}` : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">the number we would program around</p>
        </div>
        {cards.map((c) => (
          <div key={c.name} className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{c.name}</p>
            <p data-testid={`orm-${c.name.toLowerCase()}`} className="mt-1 font-display text-xl font-semibold tracking-[-0.02em]">
              {valid ? `${fmt(c.value)} ${unit}` : '—'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.note}</p>
          </div>
        ))}
      </div>

      {valid && (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">Training loads as percentages of the consensus one-rep max</caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">% of 1RM</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">Load</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">Reps it typically allows</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium text-muted-foreground sm:table-cell">Zone</th>
              </tr>
            </thead>
            <tbody data-testid="orm-table">
              {TRAINING.map((t) => (
                <tr key={t.pct} className="border-t">
                  <td className="px-4 py-2 font-medium tabular-nums">{t.pct}%</td>
                  <td className="px-4 py-2 text-right font-display font-semibold tabular-nums">
                    {fmt((consensus * t.pct) / 100)} {unit}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">~{t.reps}</td>
                  <td className="hidden px-4 py-2 text-xs text-muted-foreground sm:table-cell">{t.zone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        All four formulas agree tightly at 1–6 reps and drift apart as reps climb — by 12+ reps the spread can
        exceed 10%, which is why the consensus matters most on short sets. An estimate is not a measured 1RM:
        testing a true max is a skill that needs warm-up planning and a spotter (or safety pins), and fatigue,
        sleep and bar speed all move the number day to day.
      </p>

      <PrivacyStrip detail="The math runs in this tab per keystroke — your lifts are not stored and not sent anywhere." />
    </div>
  )
}
