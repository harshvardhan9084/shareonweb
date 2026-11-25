'use client'

// Salary converter: one amount in one frequency, read out in all of them.
// The pipeline is explicit and printed on the page: paid hours per shift
// (shift minus unpaid break), paid hours per week, overtime on top at its
// multiplier, then a single annual gross from which every other figure is
// derived. No tax pretending — the header and the note both say these are
// gross, pre-tax numbers, because every "take-home" estimate that skips
// brackets is a lie with extra steps.

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { PrivacyStrip } from '@/components/instant/instant-kit'

type Freq = 'hour' | 'day' | 'week' | 'biweek' | 'month' | 'year'

const FREQ_LABEL: Record<Freq, string> = {
  hour: 'per hour',
  day: 'per day',
  week: 'per week',
  biweek: 'per two weeks',
  month: 'per month',
  year: 'per year',
}

function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function num(v: string): number {
  const n = Number.parseFloat(v.replace(/,/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

export function SalaryTool() {
  const [amount, setAmount] = useState('25')
  const [freq, setFreq] = useState<Freq>('hour')
  const [shiftHours, setShiftHours] = useState('8')
  const [daysPerWeek, setDaysPerWeek] = useState('5')
  const [breakMinutes, setBreakMinutes] = useState('60')
  const [otHours, setOtHours] = useState('0')
  const [otMultiplier, setOtMultiplier] = useState('1.5')
  const [weeksPerYear, setWeeksPerYear] = useState('52')

  const amt = num(amount)
  const shift = num(shiftHours)
  const days = num(daysPerWeek)
  const brk = num(breakMinutes)
  const ot = num(otHours)
  const otMult = num(otMultiplier)
  const weeks = num(weeksPerYear)

  const paidShift = Number.isFinite(shift) && Number.isFinite(brk) ? Math.max(0, shift - brk / 60) : NaN
  const paidWeek = Number.isFinite(paidShift) && Number.isFinite(days) ? paidShift * days : NaN
  const valid =
    Number.isFinite(amt) &&
    amt > 0 &&
    Number.isFinite(paidWeek) &&
    Number.isFinite(weeks) &&
    weeks > 0 &&
    paidWeek > 0

  // Paid hours per year (excluding overtime) and the base annual gross.
  const paidYear = paidWeek * weeks
  // The hourly rate the given amount implies. When the input IS hourly this
  // is just the amount; otherwise it is derived from the annual figure.
  let baseAnnual = NaN
  switch (freq) {
    case 'hour':
      baseAnnual = amt * paidYear
      break
    case 'day':
      baseAnnual = amt * days * weeks
      break
    case 'week':
      baseAnnual = amt * weeks
      break
    case 'biweek':
      baseAnnual = amt * (weeks / 2)
      break
    case 'month':
      baseAnnual = amt * 12
      break
    case 'year':
      baseAnnual = amt
      break
  }
  const hourly = freq === 'hour' ? amt : paidWeek > 0 ? baseAnnual / paidYear : NaN
  const otAnnual = valid ? hourly * otMult * ot * weeks : 0
  const annual = baseAnnual + otAnnual

  const rows: Array<{ label: string; value: number | null; hint?: string }> = [
    { label: 'Hourly', value: hourly, hint: `${fmt(paidShift, 2)} paid h/shift after the unpaid break` },
    { label: 'Daily', value: hourly * paidShift, hint: `${fmt(days, 0)} paid days a week` },
    { label: 'Weekly', value: (annual / weeks), hint: `${fmt(paidWeek, 2)} paid hours + ${fmt(ot, 2)} OT hours a week` },
    { label: 'Two weeks', value: annual / (weeks / 2) },
    { label: 'Monthly', value: annual / 12, hint: 'annual ÷ 12 — the calendar answer, not the bank’s 4-week one' },
    { label: 'Annual', value: annual, hint: `base ${fmt(baseAnnual)} + OT ${fmt(otAnnual)}` },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="salary-amount">Pay amount</Label>
          <Input
            id="salary-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="salary-freq">Paid</Label>
          <Select value={freq} onValueChange={(v) => setFreq(v as Freq)}>
            <SelectTrigger id="salary-freq" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FREQ_LABEL) as Freq[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FREQ_LABEL[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="salary-weeks">Work weeks per year</Label>
          <Input
            id="salary-weeks"
            type="text"
            inputMode="numeric"
            value={weeksPerYear}
            onChange={(e) => setWeeksPerYear(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="salary-shift">Shift hours</Label>
          <Input
            id="salary-shift"
            type="text"
            inputMode="decimal"
            value={shiftHours}
            onChange={(e) => setShiftHours(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="salary-days">Days per week</Label>
          <Input
            id="salary-days"
            type="text"
            inputMode="decimal"
            value={daysPerWeek}
            onChange={(e) => setDaysPerWeek(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="salary-break">Unpaid break (min)</Label>
          <Input
            id="salary-break"
            type="text"
            inputMode="numeric"
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="salary-ot">Overtime h/week</Label>
          <Input
            id="salary-ot"
            type="text"
            inputMode="decimal"
            value={otHours}
            onChange={(e) => setOtHours(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="salary-otmult">OT multiplier</Label>
          <Input
            id="salary-otmult"
            type="text"
            inputMode="decimal"
            value={otMultiplier}
            onChange={(e) => setOtMultiplier(e.target.value)}
          />
        </div>
      </div>

      {valid ? (
        <div data-testid="salary-table" className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">Salary conversions, gross and pre-tax</caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">Period</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">Gross pay</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium text-muted-foreground sm:table-cell">Basis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.label} className={i === rows.length - 1 ? 'border-t bg-muted/20' : 'border-t'}>
                  <td className="px-4 py-2.5 font-medium">
                    {r.label}
                    {r.label === 'Annual' && <span className="sr-only"> total gross</span>}
                  </td>
                  <td data-testid={i === rows.length - 1 ? 'salary-annual' : `salary-${r.label.toLowerCase().replace(/\s+/g, '-')}`} className="px-4 py-2.5 text-right font-display font-semibold tabular-nums">
                    {Number.isFinite(r.value) ? fmt(r.value ?? 0) : '—'}
                  </td>
                  <td className="hidden px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">{r.hint ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Enter an amount and enough schedule detail (shift hours, days per week, weeks per year) to derive the conversions.
        </p>
      )}

      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The pipeline, printed so you can check it: paid shift = {fmt(paidShift, 2)} h ({fmt(shift, 2)} h −{' '}
        {fmt(brk, 0)} min unpaid) × {fmt(days, 0)} days = {fmt(paidWeek, 2)} paid hours/week; annual base ={' '}
        {FREQ_LABEL[freq]} {fmt(amt)} → {fmt(baseAnnual)}; overtime = {fmt(hourly, 2)} × {fmt(otMult, 2)} ×{' '}
        {fmt(ot, 2)} h × {fmt(weeks, 0)} wk = {fmt(otAnnual)}. These are gross, pre-tax numbers — income tax,
        social contributions, benefits and unpaid leave all sit on top of this, which is why the tool refuses
        to invent a “take-home” figure.
      </p>

      <PrivacyStrip detail="The conversion runs in this tab on every keystroke — your pay details are not sent anywhere and not remembered by the page." />
    </div>
  )
}
