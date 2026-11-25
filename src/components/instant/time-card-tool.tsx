'use client'

// Time Card Calculator — a week of in/out times into hours and pay, the way
// a punched card works: up to two in/out pairs per day plus a break in
// minutes, overnight shifts handled (an out before its in means the shift
// crossed midnight), weekly total, overtime over the configured threshold,
// and pay at your hourly rate with the overtime multiplier. Times are typed
// or stepped in plain HH:MM; every number recomputes as you edit.

import { useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PrivacyStrip } from '@/components/instant/instant-kit'

interface DayRow {
  in1: string
  out1: string
  in2: string
  out2: string
  breakMin: number
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const EMPTY_DAY: DayRow = { in1: '', out1: '', in2: '', out2: '', breakMin: 0 }

/** 'HH:MM' → minutes since 00:00. Empty string = not punched. */
function toMinutes(hhmm: string): number | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** One pair of punches → worked minutes. Out before in = crossed midnight. */
function pairMinutes(inM: number | null, outM: number | null): number {
  if (inM === null || outM === null) return 0
  let span = outM - inM
  if (span < 0) span += 24 * 60 // overnight shift
  return span
}

/** Format minutes as h:mm with an honest zero. */
function fmtHM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function fmtMoney(v: number): string {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function TimeCardTool() {
  const [rows, setRows] = useState<DayRow[]>(() => DAYS.map(() => ({ ...EMPTY_DAY })))
  const [otThreshold, setOtThreshold] = useState(40)
  const [otMultiplier, setOtMultiplier] = useState(1.5)
  const [rate, setRate] = useState('')

  const update = (i: number, patch: Partial<DayRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const clearAll = () => setRows(DAYS.map(() => ({ ...EMPTY_DAY })))

  const computed = useMemo(() => {
    const perDay = rows.map((r) => {
      const invalid = [r.in1, r.out1, r.in2, r.out2].some((t) => t !== '' && toMinutes(t) === null)
      const work =
        pairMinutes(toMinutes(r.in1), toMinutes(r.out1)) +
        pairMinutes(toMinutes(r.in2), toMinutes(r.out2))
      const net = Math.max(0, work - r.breakMin)
      return { net, invalid }
    })
    const totalMin = perDay.reduce((a, d) => a + d.net, 0)
    const hours = totalMin / 60
    const regular = Math.min(hours, otThreshold)
    const overtime = Math.max(0, hours - otThreshold)
    const rateNum = Number(rate)
    const hasRate = rate.trim() !== '' && Number.isFinite(rateNum) && rateNum >= 0
    const pay = hasRate ? regular * rateNum + overtime * rateNum * otMultiplier : null
    return { perDay, totalMin, hours, regular, overtime, pay, hasRate }
  }, [rows, otThreshold, otMultiplier, rate])

  const timeCell = (i: number, field: keyof Pick<DayRow, 'in1' | 'out1' | 'in2' | 'out2'>, ariaLabel: string) => (
    <input
      type="time"
      value={rows[i][field]}
      onChange={(e) => update(i, { [field]: e.target.value })}
      aria-label={`${DAYS[i]} ${ariaLabel}`}
      className="h-9 w-full rounded-md border bg-background px-1.5 text-sm"
    />
  )

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="size-4 text-primary" aria-hidden="true" /> The week
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={clearAll}>
            Clear the week
          </Button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-2 font-medium">Day</th>
                <th className="pb-2 pr-2 font-medium">In</th>
                <th className="pb-2 pr-2 font-medium">Out</th>
                <th className="pb-2 pr-2 font-medium">In</th>
                <th className="pb-2 pr-2 font-medium">Out</th>
                <th className="pb-2 pr-2 font-medium">Break (min)</th>
                <th className="pb-2 font-medium">Worked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={DAYS[i]} className="border-t">
                  <td className="py-2 pr-3 font-medium">{DAYS[i]}</td>
                  <td className="py-2 pr-2">{timeCell(i, 'in1', 'in (first pair)')}</td>
                  <td className="py-2 pr-2">{timeCell(i, 'out1', 'out (first pair)')}</td>
                  <td className="py-2 pr-2">{timeCell(i, 'in2', 'in (second pair)')}</td>
                  <td className="py-2 pr-2">{timeCell(i, 'out2', 'out (second pair)')}</td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      value={r.breakMin === 0 ? '' : r.breakMin}
                      onChange={(e) => update(i, { breakMin: Math.max(0, Number(e.target.value) || 0) })}
                      aria-label={`${DAYS[i]} break minutes`}
                      placeholder="0"
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    />
                  </td>
                  <td className={`py-2 font-mono font-semibold tabular-nums ${computed.perDay[i].invalid ? 'text-destructive' : ''}`}>
                    {computed.perDay[i].invalid
                      ? 'check times'
                      : r.in1 === '' && r.in2 === ''
                        ? '—'
                        : fmtHM(computed.perDay[i].net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Two pairs per day cover a lunch split; one pair is all you need otherwise. An out earlier than its in is read as an overnight shift (past midnight), and the break comes off the day&apos;s total.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Pay settings</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="tc-rate" className="text-xs text-muted-foreground">Hourly rate</Label>
            <input
              id="tc-rate"
              type="number"
              min={0}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 22.50"
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="tc-ot" className="text-xs text-muted-foreground">Overtime after (hours/week)</Label>
            <input
              id="tc-ot"
              type="number"
              min={0}
              step="0.5"
              value={otThreshold === 0 ? '' : otThreshold}
              onChange={(e) => setOtThreshold(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="tc-mult" className="text-xs text-muted-foreground">Overtime multiplier</Label>
            <input
              id="tc-mult"
              type="number"
              min={1}
              step="0.1"
              value={otMultiplier}
              onChange={(e) => setOtMultiplier(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-5" aria-live="polite">
        <h2 className="text-sm font-semibold">The week&apos;s math</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Total hours</p>
            <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{fmtHM(computed.totalMin)}</p>
            <p className="text-[11px] text-muted-foreground">{computed.hours.toFixed(2)} decimal</p>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Regular</p>
            <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{computed.regular.toFixed(2)}</p>
            <p className="text-[11px] text-muted-foreground">first {otThreshold} h/week</p>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Overtime</p>
            <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{computed.overtime.toFixed(2)}</p>
            <p className="text-[11px] text-muted-foreground">×{otMultiplier} multiplier</p>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Pay</p>
            <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
              {computed.pay !== null ? fmtMoney(computed.pay) : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {computed.hasRate ? 'regular + overtime' : 'enter a rate above'}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {computed.hasRate
            ? `Pay = ${computed.regular.toFixed(2)} h × ${fmtMoney(Number(rate))} + ${computed.overtime.toFixed(2)} h × ${fmtMoney(Number(rate))} × ${otMultiplier} = ${fmtMoney(computed.pay ?? 0)}. Gross before taxes and deductions — the page does not guess your tax situation.`
            : 'Hours are computed live; add a rate for the pay row. Formulas stay on the page.'}
        </p>
      </div>

      <PrivacyStrip detail="The whole week lives in this tab: the times you type are page state, the totals are computed here, and nothing is sent, saved or synced anywhere." />
    </div>
  )
}
