'use client'

// Running pace calculator: one recent run (distance + time) becomes pace per
// km and per mile, speed in both units, a splits table over the race
// distance, and race-time predictions by Riegel's formula — T2 = T1 ×
// (D2/D1)^1.06, the standard exponent from Peter Riegel's 1977 Runner's
// World article. The predictions assume comparable training between the two
// distances, which the page says honestly: a 25-minute 5K does not
// automatically make a 4-hour marathoner.

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { PrivacyStrip } from '@/components/instant/instant-kit'

const MI_IN_KM = 1.609344
const MARATHON_KM = 42.195

function num(v: string): number {
  const n = Number.parseFloat(v.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : NaN
}

/** Seconds -> "h:mm:ss" above an hour, "mm:ss" below. */
function fmtClock(secs: number): string {
  const s = Math.round(secs)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${m}:${String(ss).padStart(2, '0')}`
}

/** Seconds-per-interval -> "m:ss" pace string. */
function fmtPace(secs: number): string {
  const s = Math.round(secs)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface Race {
  label: string
  km: number
}

const RACES: Race[] = [
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
  { label: 'Half marathon', km: 21.0975 },
  { label: 'Marathon', km: MARATHON_KM },
]

export function PaceTool() {
  const [distance, setDistance] = useState('5')
  const [unit, setUnit] = useState<'km' | 'mi'>('km')
  const [hh, setHh] = useState('0')
  const [mm, setMm] = useState('25')
  const [ss, setSs] = useState('0')

  const d = num(distance)
  const h = num(hh) || 0
  const m = num(mm) || 0
  const s = num(ss) || 0
  const totalSecs = h * 3600 + m * 60 + s

  const km = d * (unit === 'mi' ? MI_IN_KM : 1)
  const valid = Number.isFinite(d) && d > 0 && Number.isFinite(totalSecs) && totalSecs > 0

  const secPerKm = valid ? totalSecs / km : 0
  const secPerMi = secPerKm * MI_IN_KM
  const kmh = valid ? 3600 / secPerKm : 0
  const mph = kmh / MI_IN_KM

  // Splits over the run's own distance: full units plus the remainder.
  const splits: Array<{ label: string; at: number }> = []
  if (valid) {
    const stepKm = unit === 'km' ? 1 : MI_IN_KM
    const count = Math.floor(km / stepKm + 1e-9)
    for (let i = 1; i <= count; i++) {
      splits.push({ label: `${unit === 'km' ? i : i} ${unit === 'km' ? 'km' : 'mi'}`, at: secPerKm * i * stepKm })
    }
    const rem = km - count * stepKm
    if (rem > 1e-6 && rem > stepKm / 20) {
      const remLabel = unit === 'km' ? `${rem.toFixed(rem < 1 ? 2 : 1)} km` : `${(rem / MI_IN_KM).toFixed(2)} mi`
      splits.push({ label: remLabel, at: totalSecs })
    }
  }

  // Riegel: T2 = T1 × (D2/D1)^1.06 — the exponent assumes race-effort
  // performances over comparable training; it is a projection, not a promise.
  const predictions = RACES.map((r) => ({
    ...r,
    secs: valid ? totalSecs * Math.pow(r.km / km, 1.06) : NaN,
  }))

  return (
    <div className="space-y-4">
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_120px_auto_auto_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="pace-dist">Distance</Label>
          <div className="flex gap-2">
            <Input
              id="pace-dist"
              type="text"
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="flex-1"
            />
            <Select value={unit} onValueChange={(v) => setUnit(v as 'km' | 'mi')}>
              <SelectTrigger className="w-24" aria-label="Distance unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="km">km</SelectItem>
                <SelectItem value="mi">miles</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pace-h">Hours</Label>
          <Input id="pace-h" type="text" inputMode="numeric" value={hh} onChange={(e) => setHh(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pace-m">Minutes</Label>
          <Input id="pace-m" type="text" inputMode="numeric" value={mm} onChange={(e) => setMm(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pace-s">Seconds</Label>
          <Input id="pace-s" type="text" inputMode="numeric" value={ss} onChange={(e) => setSs(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4" aria-live="polite">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Pace</p>
          <p data-testid="pace-out" className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]">
            {valid ? `${fmtPace(secPerKm)} /km` : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{valid ? `${fmtPace(secPerMi)} per mile` : '—'}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Speed</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]">
            {valid ? `${kmh.toFixed(2)} km/h` : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{valid ? `${mph.toFixed(2)} mph` : '—'}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total time</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]">
            {valid ? fmtClock(totalSecs) : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {valid ? `over ${valid ? km.toFixed(2) : '—'} km` : '—'}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Distance, both units</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]">
            {valid ? `${km.toFixed(2)} km` : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {valid ? `${(km / MI_IN_KM).toFixed(2)} miles` : '—'}
          </p>
        </div>
      </div>

      {valid && splits.length > 1 && (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">Splits at an even pace</caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">Split</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">Elapsed</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground sm:table-cell">Split time</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((sp, i) => (
                <tr key={sp.label} className="border-t">
                  <td className="px-4 py-2">{sp.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtClock(sp.at)}</td>
                  <td className="hidden px-4 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {fmtClock(sp.at - (i > 0 ? splits[i - 1].at : 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <caption className="sr-only">Riegel race-time predictions</caption>
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">Race</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">Predicted time</th>
              <th scope="col" className="hidden px-4 py-2.5 text-right font-medium text-muted-foreground sm:table-cell">Pace /km</th>
            </tr>
          </thead>
          <tbody data-testid="pace-predict">
            {predictions.map((p) => (
              <tr key={p.label} className="border-t">
                <td className="px-4 py-2 font-medium">{p.label}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {valid ? fmtClock(p.secs) : '—'}
                </td>
                <td className="hidden px-4 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">
                  {valid ? fmtPace(p.secs / p.km) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Predictions use Riegel’s formula T₂ = T₁ × (D₂/D₁)^1.06, fitted from real performances — it assumes
        your training scales with the target distance. A 25-minute 5K projects about 3:59 for a marathon, but
        only for a runner who has actually put in the long runs; no formula turns a 5K into a marathon
        training block. Splits assume an even pace; real races pacing negative or positive split differently.
      </p>

      <PrivacyStrip detail="Pace, splits and predictions are computed in this tab per keystroke — your runs are not stored and not sent anywhere." />
    </div>
  )
}
