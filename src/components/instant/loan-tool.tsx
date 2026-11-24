'use client'

// Loan & Interest Studio — three money calculators sharing exact math:
//  · Loan: EMI via the standard annuity formula + a full amortization
//    schedule built month by month, with an optional extra payment whose
//    savings are computed by simulating the real schedule, not guessed.
//  · Compound: principal + monthly contributions at annual/monthly/daily
//    compounding, year-by-year table.
//  · Goal: required monthly contribution solved backwards from a target.
// CSV exports come straight from the same arrays the tables render.

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PrivacyStrip, downloadBlob } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Mode = 'loan' | 'compound' | 'goal'

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'loan', label: 'Loan / EMI' },
  { id: 'compound', label: 'Compound interest' },
  { id: 'goal', label: 'Savings goal' },
]

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function nf(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function Field({ id, label, value, onChange, unit, step }: { id: string; label: string; value: string; onChange: (v: string) => void; unit?: string; step?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type="number" inputMode="decimal" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
        {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  )
}

function Big({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-3">
      <p className="text-xs font-medium text-primary">{label}</p>
      <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-primary">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3.5 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ----------------------------------------------------------- loan schedule ---

interface SchedRow { month: number; payment: number; interest: number; principal: number; balance: number }

function amortize(amount: number, annualRate: number, months: number, extra: number): { rows: SchedRow[]; months: number; totalInterest: number; totalPaid: number } {
  const r = annualRate / 100 / 12
  // EMI with a floor guard: at 0% the payment is simply amount / months
  const emi = r === 0 ? amount / months : (amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
  const rows: SchedRow[] = []
  let balance = amount
  let totalInterest = 0
  let month = 0
  // hard cap at 1200 months (100 years) so bad inputs cannot loop forever
  while (balance > 0.005 && month < 1200) {
    month++
    const interest = balance * r
    let principal = emi + extra - interest
    if (principal <= 0) {
      throw new Error('The payment is smaller than the monthly interest — this loan never pays off.')
    }
    if (principal > balance) principal = balance
    balance -= principal
    totalInterest += interest
    rows.push({ month, payment: interest + principal, interest, principal, balance: Math.max(0, balance) })
  }
  const totalPaid = amount + totalInterest
  return { rows, months: month, totalInterest, totalPaid }
}

// --------------------------------------------------------------------- ui ----

export function LoanTool() {
  const [mode, setMode] = useState<Mode>('loan')
  const [amount, setAmount] = useState('250000')
  const [rate, setRate] = useState('6.5')
  const [years, setYears] = useState('25')
  const [extra, setExtra] = useState('0')
  const [monthly, setMonthly] = useState('500')
  const [freq, setFreq] = useState<'annual' | 'monthly' | 'daily'>('monthly')
  const [goalAmount, setGoalAmount] = useState('50000')
  const [goalCurrent, setGoalCurrent] = useState('5000')
  const [showAll, setShowAll] = useState(false)

  const loan = useMemo(() => {
    if (mode !== 'loan') return null
    const P = Number(amount)
    const rateN = Number(rate)
    const months = Math.round(Number(years) * 12)
    if (!(P > 0) || !(rateN >= 0 && rateN <= 100) || !(months >= 1 && months <= 1200)) {
      return { ok: false as const, msg: 'Enter a positive amount, a rate between 0 and 100, and a term between 1 month and 100 years.' }
    }
    try {
      const base = amortize(P, rateN, months, 0)
      const extraN = Number(extra) || 0
      const withExtra = extraN > 0 ? amortize(P, rateN, months, extraN) : null
      return { ok: true as const, P, months, base, withExtra, extraN, emi: base.rows[0].payment }
    } catch (e) {
      return { ok: false as const, msg: e instanceof Error ? e.message : 'Those numbers do not work.' }
    }
  }, [mode, amount, rate, years, extra])

  const compound = useMemo(() => {
    if (mode !== 'compound') return null
    const P = Number(amount) || 0
    const monthlyN = Number(monthly) || 0
    const rateN = Number(rate)
    const yearsN = Number(years)
    if (!(rateN >= 0 && rateN <= 100) || !(yearsN > 0 && yearsN <= 100)) {
      return { ok: false as const, msg: 'Enter a rate between 0 and 100 and a horizon between 1 and 100 years.' }
    }
    const nPerYear = freq === 'annual' ? 1 : freq === 'monthly' ? 12 : 365
    // simulate month by month: contributions arrive at month end; interest
    // accrues at the chosen frequency. This keeps every frequency honest
    // without closed-form assumptions about contribution timing.
    const monthsTotal = Math.round(yearsN * 12)
    const perPeriodRate = rateN / 100 / nPerYear
    let balance = P
    let contributed = P
    const yearsOut: Array<{ year: number; balance: number; contributed: number }> = []
    for (let m = 1; m <= monthsTotal; m++) {
      // accrue one month of interest in nPerYear-sized slices
      const slices = nPerYear / 12
      balance *= Math.pow(1 + perPeriodRate, slices)
      balance += monthlyN
      contributed += monthlyN
      if (m % 12 === 0 || m === monthsTotal) {
        yearsOut.push({ year: Math.ceil(m / 12), balance, contributed })
      }
    }
    return { ok: true as const, yearsOut, finalBalance: balance, contributed, interest: balance - contributed }
  }, [mode, amount, monthly, rate, years, freq])

  const goal = useMemo(() => {
    if (mode !== 'goal') return null
    const target = Number(goalAmount)
    const current = Number(goalCurrent) || 0
    const rateN = Number(rate)
    const yearsN = Number(years)
    if (!(target > 0) || current < 0 || !(rateN >= 0 && rateN <= 100) || !(yearsN > 0 && yearsN <= 100)) {
      return { ok: false as const, msg: 'Enter a positive target, a rate between 0 and 100 and a horizon between 1 and 100 years.' }
    }
    if (current >= target) return { ok: false as const, msg: 'The starting amount already meets or beats the target — nothing to save.' }
    const months = Math.round(yearsN * 12)
    const monthlyRate = rateN / 100 / 12
    // FV of current + annuity of monthly contributions solving to target:
    // required contribution = (target − current·(1+r)^n) · r / ((1+r)^n − 1)
    if (monthlyRate === 0) {
      const need = (target - current) / months
      return { ok: true as const, need, months, note: 'At 0% this is simply the shortfall divided by the months.' }
    }
    const growth = Math.pow(1 + monthlyRate, months)
    const numerator = target - current * growth
    if (numerator <= 0) {
      return { ok: true as const, need: 0, months, note: 'Your starting amount alone grows past the target at this rate and horizon — no monthly contribution is required.' }
    }
    const need = (numerator * monthlyRate) / (growth - 1)
    return { ok: true as const, need, months, note: null as string | null }
  }, [mode, goalAmount, goalCurrent, rate, years])

  const exportSchedule = () => {
    if (!loan?.ok) return
    const rows = loan.withExtra?.rows ?? loan.base.rows
    const header = 'month,payment,interest,principal,balance'
    const body = rows.map((r) => `${r.month},${r.payment.toFixed(2)},${r.interest.toFixed(2)},${r.principal.toFixed(2)},${r.balance.toFixed(2)}`).join('\n')
    downloadBlob(new Blob([`${header}\n${body}\n`], { type: 'text/csv' }), 'amortization-schedule.csv')
  }

  const exportProjection = () => {
    if (!compound?.ok) return
    const header = 'year,balance,contributed_so_far,interest_so_far'
    const body = compound.yearsOut.map((y) => `${y.year},${y.balance.toFixed(2)},${y.contributed.toFixed(2)},${(y.balance - y.contributed).toFixed(2)}`).join('\n')
    downloadBlob(new Blob([`${header}\n${body}\n`], { type: 'text/csv' }), 'compound-projection.csv')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Calculator mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                mode === m.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {mode === 'loan' && (
            <>
              <Field id="loan-amt" label="Loan amount" unit="/" value={amount} onChange={setAmount} />
              <Field id="loan-rate" label="Annual interest rate" unit="%" value={rate} onChange={setRate} step="0.01" />
              <Field id="loan-years" label="Term" unit="years" value={years} onChange={setYears} step="0.5" />
              <Field id="loan-extra" label="Extra payment per month (optional)" value={extra} onChange={setExtra} />
            </>
          )}
          {mode === 'compound' && (
            <>
              <Field id="comp-amt" label="Starting amount" value={amount} onChange={setAmount} />
              <Field id="comp-monthly" label="Monthly contribution" value={monthly} onChange={setMonthly} />
              <Field id="comp-rate" label="Annual rate" unit="%" value={rate} onChange={setRate} step="0.01" />
              <div className="space-y-1.5">
                <Label htmlFor="comp-freq">Compounding</Label>
                <select id="comp-freq" value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)} className="h-9 w-full rounded-lg border bg-background px-3 text-sm">
                  <option value="annual">Annual</option>
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <Field id="comp-years" label="Horizon" unit="years" value={years} onChange={setYears} />
            </>
          )}
          {mode === 'goal' && (
            <>
              <Field id="goal-target" label="Target amount" value={goalAmount} onChange={setGoalAmount} />
              <Field id="goal-current" label="Already saved" value={goalCurrent} onChange={setGoalCurrent} />
              <Field id="goal-rate" label="Expected annual return" unit="%" value={rate} onChange={setRate} step="0.01" />
              <Field id="goal-years" label="Horizon" unit="years" value={years} onChange={setYears} />
            </>
          )}
        </div>
        <PrivacyStrip detail="Computed in this tab with the standard annuity and compound formulas — no lender quotes, no data collection, nothing stored." />
      </div>

      {/* ---------------------------------------------------------- loan */}
      {mode === 'loan' && (
        !loan?.ok ? (
          <div className="rounded-xl border bg-card p-4 sm:p-5"><p className="text-sm text-destructive" role="alert">{loan?.msg}</p></div>
        ) : (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <Big label="Monthly payment" value={money(loan.emi)} sub={`${money(loan.emi + (loan.extraN || 0))} with your extra payment`} />
              <Stat label="Total interest" value={money(loan.base.totalInterest)} sub={`${((loan.base.totalInterest / loan.P) * 100).toFixed(0)}% of the amount borrowed`} />
              <Stat label="Total repaid" value={money(loan.base.totalPaid)} sub={`${loan.base.months} months`} />
              <Stat
                label={loan.withExtra ? `Extra ${money(loan.extraN)}/month saves` : 'Add an extra payment to see savings'}
                value={loan.withExtra ? money(loan.base.totalInterest - loan.withExtra.totalInterest) : '—'}
                sub={loan.withExtra ? `paid off ${loan.base.months - loan.withExtra.months} months earlier` : undefined}
              />
            </div>
            <div className="rounded-xl border bg-card">
              <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
                <h2 className="text-sm font-semibold">Amortization schedule — every month</h2>
                <div className="ml-auto flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={exportSchedule}>
                    <Download className="size-3.5" aria-hidden="true" /> CSV
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAll((s) => !s)}>
                    {showAll ? 'Show first 12' : `Show all ${loan.withExtra?.rows.length ?? loan.base.months}`}
                  </Button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">#</th>
                      <th className="px-4 py-2 font-medium">Payment</th>
                      <th className="px-4 py-2 font-medium">Interest</th>
                      <th className="px-4 py-2 font-medium">Principal</th>
                      <th className="px-4 py-2 font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {(showAll ? loan.withExtra?.rows ?? loan.base.rows : (loan.withExtra?.rows ?? loan.base.rows).slice(0, 12)).map((r) => (
                      <tr key={r.month} className="border-b last:border-0">
                        <td className="px-4 py-1.5 text-muted-foreground">{r.month}</td>
                        <td className="px-4 py-1.5">{money(r.payment)}</td>
                        <td className="px-4 py-1.5">{money(r.interest)}</td>
                        <td className="px-4 py-1.5">{money(r.principal)}</td>
                        <td className="px-4 py-1.5">{money(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* ------------------------------------------------------ compound */}
      {mode === 'compound' && (
        !compound?.ok ? (
          <div className="rounded-xl border bg-card p-4 sm:p-5"><p className="text-sm text-destructive" role="alert">{compound?.msg}</p></div>
        ) : (
          <>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <Big label="Final balance" value={money(compound.finalBalance)} sub={`${freq} compounding at ${rate}%`} />
              <Stat label="You contributed" value={money(compound.contributed)} sub="starting amount + monthly contributions" />
              <Stat label="Interest earned" value={money(compound.interest)} sub={`${((compound.interest / Math.max(compound.contributed, 1)) * 100).toFixed(0)}% on top of contributions`} />
            </div>
            <div className="rounded-xl border bg-card">
              <div className="flex items-center gap-3 border-b px-4 py-2.5">
                <h2 className="text-sm font-semibold">Year-by-year projection</h2>
                <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={exportProjection}>
                  <Download className="size-3.5" aria-hidden="true" /> CSV
                </Button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Year</th>
                      <th className="px-4 py-2 font-medium">Balance</th>
                      <th className="px-4 py-2 font-medium">Contributed</th>
                      <th className="px-4 py-2 font-medium">Interest so far</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {compound.yearsOut.map((y) => (
                      <tr key={y.year} className="border-b last:border-0">
                        <td className="px-4 py-1.5 text-muted-foreground">{y.year}</td>
                        <td className="px-4 py-1.5">{money(y.balance)}</td>
                        <td className="px-4 py-1.5">{money(y.contributed)}</td>
                        <td className="px-4 py-1.5">{money(y.balance - y.contributed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* ---------------------------------------------------------- goal */}
      {mode === 'goal' && (
        !goal?.ok ? (
          <div className="rounded-xl border bg-card p-4 sm:p-5"><p className="text-sm text-destructive" role="alert">{goal?.msg}</p></div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Big label="Monthly contribution needed" value={money(goal.need)} sub={`${goal.months} months to reach ${money(Number(goalAmount))}`} />
            <Stat label="Total you will put in" value={money(Number(goalCurrent) + goal.need * goal.months)} sub="starting amount + contributions" />
            <Stat label="Growth does the rest" value={money(Math.max(0, Number(goalAmount) - (Number(goalCurrent) + goal.need * goal.months)))} sub="covered by interest at the assumed rate" />
            {goal.note && <p className="sm:col-span-3 text-xs text-muted-foreground">{goal.note}</p>}
          </div>
        )
      )}

      <p className="rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
        These are exact calculations of the numbers you entered — the standard annuity (EMI) formula for the loan, and month-by-month simulation for
        everything else. What they cannot know: lender fees, insurance, rate changes, taxes. A real offer always wins over a calculator.
      </p>
    </div>
  )
}
