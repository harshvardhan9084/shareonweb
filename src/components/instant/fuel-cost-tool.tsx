'use client'

// Trip fuel cost: distance × efficiency × price, split across passengers,
// with round-trip doubling and an honest unit story. All consumption units
// normalize to liters per kilometer internally, and price units normalize to
// currency per liter, so every combination (L/100km, km/L, MPG US/UK, price
// per liter or per gallon) is interchangeable without hidden wrong answers.
// The equivalence line shows both directional conversions so a driver coming
// from a MPG background can see what L/100km really means. Everything is
// computed in this tab on every keystroke — no storage, no network.

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { PrivacyStrip } from '@/components/instant/instant-kit'

type DistUnit = 'km' | 'mi'
type ConsUnit = 'l100' | 'kmpl' | 'mpgus' | 'mpguk'
type PriceUnit = 'perL' | 'perGalUS' | 'perGalUK'
type Currency = '$' | '€' | '£' | '₹' | 'none'

/** Prefix for display — 'none' means the user wants bare numbers. */
function cur(c: Currency): string {
  return c === 'none' ? '' : c
}

const MI_IN_KM = 1.609344
const GAL_US_IN_L = 3.785411784
const GAL_UK_IN_L = 4.54609

const CONS_LABEL: Record<ConsUnit, string> = {
  l100: 'L / 100 km',
  kmpl: 'km / L',
  mpgus: 'MPG (US)',
  mpguk: 'MPG (UK)',
}

const PRICE_LABEL: Record<PriceUnit, string> = {
  perL: 'per liter',
  perGalUS: 'per US gallon',
  perGalUK: 'per UK gallon',
}

/** Normalize any consumption figure into L per km (the internal currency). */
function toLPerKm(value: number, unit: ConsUnit, dist: DistUnit): number {
  // Consumption units are defined over km; for mile distances the vehicle
  // efficiency itself does not change, only the trip length does.
  void dist
  switch (unit) {
    case 'l100':
      return value / 100
    case 'kmpl':
      return 1 / value
    case 'mpgus':
      return GAL_US_IN_L / (value * MI_IN_KM)
    case 'mpguk':
      return GAL_UK_IN_L / (value * MI_IN_KM)
  }
}

/** Normalize any price into currency per liter. */
function toPricePerL(value: number, unit: PriceUnit): number {
  switch (unit) {
    case 'perL':
      return value
    case 'perGalUS':
      return value / GAL_US_IN_L
    case 'perGalUK':
      return value / GAL_UK_IN_L
  }
}

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function num(v: string): number {
  const n = Number.parseFloat(v.replace(/,/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

export function FuelCostTool() {
  const [distance, setDistance] = useState('500')
  const [distUnit, setDistUnit] = useState<DistUnit>('km')
  const [cons, setCons] = useState('8')
  const [consUnit, setConsUnit] = useState<ConsUnit>('l100')
  const [price, setPrice] = useState('1.50')
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('perL')
  const [currency, setCurrency] = useState<Currency>('$')
  const [passengers, setPassengers] = useState('1')
  const [roundTrip, setRoundTrip] = useState(false)

  const d = num(distance)
  const c = num(cons)
  const p = num(price)
  const pax = Math.max(1, Math.floor(num(passengers) || 1))
  const valid = Number.isFinite(d) && d > 0 && Number.isFinite(c) && c > 0 && Number.isFinite(p) && p > 0

  const km = valid ? d * (distUnit === 'mi' ? MI_IN_KM : 1) : 0
  const lPerKm = valid ? toLPerKm(c, consUnit, distUnit) : 0
  const liters = km * lPerKm * (roundTrip ? 2 : 1)
  const total = liters * toPricePerL(p, priceUnit)
  const perKm = km > 0 ? total / km : 0
  const perPassenger = total / pax

  // Equivalences of the chosen consumption figure, shown both ways.
  const equivL100 = lPerKm * 100
  const equivMpgUS = lPerKm > 0 ? GAL_US_IN_L / (lPerKm * MI_IN_KM) : 0
  const equivMpgUK = lPerKm > 0 ? GAL_UK_IN_L / (lPerKm * MI_IN_KM) : 0

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fuel-distance">Trip distance</Label>
          <div className="flex gap-2">
            <Input
              id="fuel-distance"
              type="text"
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="flex-1"
            />
            <Select value={distUnit} onValueChange={(v) => setDistUnit(v as DistUnit)}>
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
          <Label htmlFor="fuel-cons">Fuel efficiency</Label>
          <div className="flex gap-2">
            <Input
              id="fuel-cons"
              type="text"
              inputMode="decimal"
              value={cons}
              onChange={(e) => setCons(e.target.value)}
              className="flex-1"
            />
            <Select value={consUnit} onValueChange={(v) => setConsUnit(v as ConsUnit)}>
              <SelectTrigger id="fuel-cons-unit" className="w-36" aria-label="Efficiency unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CONS_LABEL) as ConsUnit[]).map((u) => (
                  <SelectItem key={u} value={u}>
                    {CONS_LABEL[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fuel-price">Fuel price</Label>
          <div className="flex gap-2">
            <Input
              id="fuel-price"
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="flex-1"
            />
            <Select value={priceUnit} onValueChange={(v) => setPriceUnit(v as PriceUnit)}>
              <SelectTrigger id="fuel-price-unit" className="w-40" aria-label="Price unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRICE_LABEL) as PriceUnit[]).map((u) => (
                  <SelectItem key={u} value={u}>
                    {PRICE_LABEL[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fuel-pax">Passengers (incl. driver)</Label>
            <Input
              id="fuel-pax"
              type="text"
              inputMode="numeric"
              value={passengers}
              onChange={(e) => setPassengers(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fuel-currency">Currency</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
              <SelectTrigger id="fuel-currency" aria-label="Currency symbol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="$">$ dollar</SelectItem>
                <SelectItem value="€">€ euro</SelectItem>
                <SelectItem value="£">£ pound</SelectItem>
                <SelectItem value="₹">₹ rupee</SelectItem>
                <SelectItem value="none">no symbol</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <Switch checked={roundTrip} onCheckedChange={setRoundTrip} aria-label="Count the return trip too" />
        <span className="text-foreground/90">Round trip — double the distance and the cost</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Fuel needed</p>
          <p data-testid="fuel-volume" className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]">
            {valid ? `${fmt(liters, 2)} L` : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {valid ? `${fmt(km, 1)} ${distUnit === 'km' ? 'km' : 'miles'} at ${fmt(equivL100, 2)} L/100km` : 'Enter a distance, an efficiency and a price'}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total cost</p>
          <p data-testid="fuel-total" className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]">
            {valid ? `${cur(currency)}${fmt(total)}` : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {valid ? `${cur(currency)}${fmt(perKm, 3)} per ${distUnit === 'km' ? 'km' : 'mile'}` : '—'}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Per passenger ({pax})</p>
          <p data-testid="fuel-per-pax" className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]">
            {valid ? `${cur(currency)}${fmt(perPassenger)}` : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {valid ? 'total split evenly, everyone pays the same' : '—'}
          </p>
        </div>
      </div>

      {valid && (
        <p data-testid="fuel-equiv" className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {CONS_LABEL[consUnit]} {fmt(c, 2)} is the same car spoken three ways: {fmt(equivL100, 2)} L/100km ·{' '}
          {fmt(equivMpgUS, 1)} MPG (US) · {fmt(equivMpgUK, 1)} MPG (UK). US and UK gallons differ (
          {GAL_US_IN_L.toFixed(2)} L vs {GAL_UK_IN_L.toFixed(2)} L), which is why the same “MPG” number
          means two things.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        The math is straight multiplication once the units agree: liters = distance × consumption, cost = liters
        × price. Real-world consumption climbs with highway speed, roof racks, cold starts and A/C — treat the
        result as a planning number, not a receipt.
      </p>

      <PrivacyStrip detail="Every keystroke is computed in this tab — the trip details never leave the page, and there is no history saved anywhere." />
    </div>
  )
}
