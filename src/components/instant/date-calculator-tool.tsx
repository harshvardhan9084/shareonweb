'use client'

// Date Math Studio — age, difference, add/subtract, business days and a live
// countdown. All dates are handled as local-time Y/M/D triples built through
// new Date(y, m, d), never parsed from strings, so there is no UTC off-by-one.
// Month arithmetic clamps at the real end of the target month.

import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Mode = 'age' | 'diff' | 'addsub' | 'business' | 'countdown'

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'age', label: 'Age' },
  { id: 'diff', label: 'Difference' },
  { id: 'addsub', label: 'Add / Subtract' },
  { id: 'business', label: 'Business days' },
  { id: 'countdown', label: 'Countdown' },
]

const DAY = 86_400_000

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function todayYMD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Build a local Date from a yyyy-mm-dd string; null when invalid. */
function parseYMD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1) return null
  const date = new Date(y, mo - 1, d)
  // reject Feb 30 etc.: the constructed day must round-trip
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

/** Calendar-exact Y/M/D breakdown between two local dates (a <= b). */
function ymdBetween(a: Date, b: Date): { years: number; months: number; days: number } {
  let y = b.getFullYear() - a.getFullYear()
  let mo = b.getMonth() - a.getMonth()
  let d = b.getDate() - a.getDate()
  if (d < 0) {
    mo--
    // days in the month before b's month
    const prevMonth = new Date(b.getFullYear(), b.getMonth(), 0).getDate()
    d += prevMonth
  }
  if (mo < 0) { y--; mo += 12 }
  return { years: y, months: mo, days: d }
}

/** Add months with end-of-month clamping (Jan 31 + 1 mo → Feb 28/29). */
function addMonthsClamped(date: Date, months: number): Date {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  const targetMonthIndex = m + months
  const ty = y + Math.floor(targetMonthIndex / 12)
  const tm = ((targetMonthIndex % 12) + 12) % 12
  const daysInTarget = new Date(ty, tm + 1, 0).getDate()
  return new Date(ty, tm, Math.min(d, daysInTarget))
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function nf(n: number): string {
  return n.toLocaleString('en-US')
}

// --------------------------------------------------------------------- ui ----

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3.5 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function DateMathTool() {
  const [mode, setMode] = useState<Mode>('age')
  const [d1, setD1] = useState('1990-01-01')
  const [d2, setD2] = useState(todayYMD())
  const [excludeEnd, setExcludeEnd] = useState(true)
  const [yrs, setYrs] = useState('0')
  const [mos, setMos] = useState('0')
  const [wks, setWks] = useState('0')
  const [ds, setDs] = useState('0')
  const [subtract, setSubtract] = useState(false)
  const [bizDays, setBizDays] = useState('10')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (mode !== 'countdown' && mode !== 'age') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [mode])

  const result = useMemo(() => {
    const a = parseYMD(d1)
    if (mode !== 'addsub' && !a) return { ok: false as const, msg: d1.trim() === '' ? 'Enter the first date.' : `"${d1}" is not a real calendar date.` }

    if (mode === 'age') {
      const today = new Date(now)
      const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      if (a! > today0) return { ok: false as const, msg: 'That birth date is in the future.' }
      const ymd = ymdBetween(a!, today0)
      const totalDays = Math.round((today0.getTime() - a!.getTime()) / DAY)
      const totalMonths = ymd.years * 12 + ymd.months
      // next birthday
      let next = new Date(today0.getFullYear(), a!.getMonth(), a!.getDate())
      if (next < today0) next = new Date(today0.getFullYear() + 1, a!.getMonth(), a!.getDate())
      // Feb 29 birthdays on non-leap years: Date rolls to Mar 1 — clamp honestly
      if (next.getMonth() !== a!.getMonth()) next = new Date(next.getFullYear(), next.getMonth() + 1, 0)
      const daysToBirthday = Math.round((next.getTime() - today0.getTime()) / DAY)
      const minutes = Math.floor((now - a!.getTime()) / 60000)
      const hours = Math.floor(minutes / 60)
      return {
        ok: true as const,
        stats: [
          { label: 'Exact age', value: `${ymd.years}y ${ymd.months}m ${ymd.days}d` },
          { label: 'Total months', value: nf(totalMonths) },
          { label: 'Total weeks', value: nf(Math.floor(totalDays / 7)), sub: `+ ${totalDays % 7} day${totalDays % 7 === 1 ? '' : 's'}` },
          { label: 'Total days', value: nf(totalDays) },
          { label: 'Total hours', value: nf(hours), sub: `${nf(minutes - hours * 60)} minutes more` },
          { label: 'Next birthday', value: fmtDate(next), sub: daysToBirthday === 0 ? 'Today — happy birthday!' : `in ${nf(daysToBirthday)} day${daysToBirthday === 1 ? '' : 's'}` },
        ] as Array<{ label: string; value: string; sub?: string }>,
      }
    }

    if (mode === 'diff') {
      const b = parseYMD(d2)
      if (!b) return { ok: false as const, msg: d2.trim() === '' ? 'Enter the second date.' : `"${d2}" is not a real calendar date.` }
      const [start, end] = a! <= b ? [a!, b] : [b!, a]
      const ymd = ymdBetween(start, end)
      let totalDays = Math.round((end.getTime() - start.getTime()) / DAY)
      if (excludeEnd) totalDays -= 1
      if (totalDays < 0) totalDays = 0
      return {
        ok: true as const,
        stats: [
          { label: 'Span (calendar-exact)', value: `${ymd.years}y ${ymd.months}m ${ymd.days}d` },
          { label: excludeEnd ? 'Total days (end excluded)' : 'Total days (both days counted)', value: nf(totalDays) },
          { label: 'Total weeks', value: nf(Math.floor(totalDays / 7)), sub: `+ ${totalDays % 7} day${totalDays % 7 === 1 ? '' : 's'}` },
          { label: 'Weekday of the earlier date', value: WEEKDAYS[start.getDay()] },
          { label: 'Weekday of the later date', value: WEEKDAYS[end.getDay()] },
          { label: 'Direction', value: start === a! ? 'First date → second date' : 'Second date → first date (inputs were swapped)' },
        ] as Array<{ label: string; value: string; sub?: string }>,
      }
    }

    if (mode === 'addsub') {
      const sign = subtract ? -1 : 1
      const y = Math.abs(Number(yrs)) || 0
      const m = Math.abs(Number(mos)) || 0
      const w = Math.abs(Number(wks)) || 0
      const d = Math.abs(Number(ds)) || 0
      if (!y && !m && !w && !d) return { ok: false as const, msg: 'Enter at least one amount to add or subtract.' }
      let out = addMonthsClamped(a!, sign * (y * 12 + m))
      out = new Date(out.getTime() + sign * (w * 7 + d) * DAY)
      return {
        ok: true as const,
        stats: [
          { label: `Result (${subtract ? 'minus' : 'plus'} ${y}y ${m}m ${w}w ${d}d)`, value: fmtDate(out) },
          { label: 'ISO date', value: `${out.getFullYear()}-${String(out.getMonth() + 1).padStart(2, '0')}-${String(out.getDate()).padStart(2, '0')}` },
          { label: 'Month-end clamp applied', value: `Day-of-month kept ≤ ${new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate()} (the real end of that month)` },
        ] as Array<{ label: string; value: string; sub?: string }>,
      }
    }

    if (mode === 'business') {
      const addMode = d2 === '' // second date empty → add/subtract N business days from d1
      if (addMode) {
        const n = Number(bizDays)
        if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return { ok: false as const, msg: 'Enter a whole number of business days.' }
        let cur = new Date(a!.getTime())
        let remaining = Math.abs(n)
        const step = n > 0 ? 1 : -1
        while (remaining > 0) {
          cur = new Date(cur.getTime() + step * DAY)
          const dow = cur.getDay()
          if (dow !== 0 && dow !== 6) remaining--
        }
        return {
          ok: true as const,
          stats: [
            { label: `${n > 0 ? 'After' : 'Before'} ${nf(Math.abs(n))} business days`, value: fmtDate(cur) },
            { label: 'ISO date', value: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}` },
            { label: 'Counted honestly', value: 'Weekends are skipped one day at a time — no approximation' },
          ] as Array<{ label: string; value: string; sub?: string }>,
        }
      }
      const b = parseYMD(d2)
      if (!b) return { ok: false as const, msg: 'Enter a second date to count between, or clear it to add/subtract business days instead.' }
      const [start, end] = a! <= b ? [a!, b] : [b!, a]
      let count = 0
      const cursor = new Date(start.getTime())
      while (cursor < end) {
        cursor.setDate(cursor.getDate() + 1)
        const dow = cursor.getDay()
        if (dow !== 0 && dow !== 6) count++
      }
      const totalDays = Math.round((end.getTime() - start.getTime()) / DAY)
      if (excludeEnd) {
        // nothing extra — end day already excluded by the strict <
      }
      return {
        ok: true as const,
        stats: [
          { label: 'Business days between (end day excluded)', value: nf(count) },
          { label: 'Total calendar days', value: nf(totalDays - (excludeEnd ? 1 : 0)), sub: excludeEnd ? 'end day excluded' : 'both days counted' },
          { label: 'Weekend days in the span', value: nf(totalDays - count) },
        ] as Array<{ label: string; value: string; sub?: string }>,
      }
    }

    // countdown
    const b = parseYMD(d2)
    if (!b) return { ok: false as const, msg: 'Enter the target date.' }
    const target = b!.getTime() // midnight local on the target day
    const diffMs = target - now
    if (diffMs <= 0) return { ok: false as const, msg: 'That date has already passed — pick a future date.' }
    const totalSec = Math.floor(diffMs / 1000)
    const days = Math.floor(totalSec / 86400)
    const hours = Math.floor((totalSec % 86400) / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    return {
      ok: true as const,
      stats: [
        { label: 'Time remaining', value: `${nf(days)}d ${hours}h ${mins}m ${secs}s` },
        { label: 'Total days', value: nf(days), sub: `${nf(hours)} hours and counting` },
        { label: 'Target moment', value: fmtDate(b!) },
      ] as Array<{ label: string; value: string; sub?: string }>,
    }
  }, [mode, d1, d2, excludeEnd, yrs, mos, wks, ds, subtract, bizDays, now])

  const r = 'stats' in result ? result.stats : null

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Date mode">
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="date-d1">
              {mode === 'age' ? 'Date of birth' : mode === 'addsub' ? 'Start date' : mode === 'countdown' ? 'Start date (age/diff)' : 'First date'}
            </Label>
            <Input id="date-d1" type="date" value={d1} onChange={(e) => setD1(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-d2">
              {mode === 'diff' ? 'Second date' : mode === 'business' ? 'Second date (empty = shift N business days)' : mode === 'countdown' ? 'Target date' : 'Second date (unused here)'}
            </Label>
            <Input
              id="date-d2"
              type="date"
              value={d2}
              onChange={(e) => setD2(e.target.value)}
              className="font-mono"
              disabled={mode === 'age' || mode === 'addsub'}
            />
          </div>
        </div>

        {mode === 'diff' && (
          <label className="mt-3 flex items-center gap-2.5 text-sm">
            <Switch checked={excludeEnd} onCheckedChange={setExcludeEnd} aria-label="Exclude the end day" />
            <span>Exclude the end day (count like a booking: Jan 1 → Jan 2 is 1 day)</span>
          </label>
        )}

        {mode === 'addsub' && (
          <>
            <div className="mt-3 grid grid-cols-4 gap-3">
              {[
                { label: 'Years', v: yrs, set: setYrs, id: 'add-y' },
                { label: 'Months', v: mos, set: setMos, id: 'add-m' },
                { label: 'Weeks', v: wks, set: setWks, id: 'add-w' },
                { label: 'Days', v: ds, set: setDs, id: 'add-d' },
              ].map((f) => (
                <div key={f.id} className="space-y-1.5">
                  <Label htmlFor={f.id}>{f.label}</Label>
                  <Input id={f.id} type="number" min={0} value={f.v} onChange={(e) => f.set(e.target.value)} className="font-mono" />
                </div>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2.5 text-sm">
              <Switch checked={subtract} onCheckedChange={setSubtract} aria-label="Subtract instead of add" />
              <span>Subtract instead of add</span>
            </label>
          </>
        )}

        {mode === 'business' && (
          <div className="mt-3 max-w-xs space-y-1.5">
            <Label htmlFor="biz-n">Business days to shift (leave second date empty)</Label>
            <Input id="biz-n" type="number" value={bizDays} onChange={(e) => setBizDays(e.target.value)} className="font-mono" />
          </div>
        )}

        <PrivacyStrip detail="Dates are computed in this tab using your device's local calendar — no server, no storage, no UTC surprises." />
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Result</h2>
        {!result.ok ? (
          <p className="mt-2 text-sm text-destructive" role="alert">{result.msg}</p>
        ) : (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {r!.map((s) => (
              <Stat key={s.label} label={s.label} value={s.value} sub={s.sub} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
