'use client'

// Due-date estimator — Naegele's rule on pure UTC date arithmetic (no
// month-length hand-waving), plus the conception variant (+266 days).
// Week-based milestones anchor to the last period — real, or notional in
// conception mode, where gestational age counts from ~14 days before
// conception. "Today" is read only inside a guarded lazy initializer, so no
// browser-dependent value is touched during render (React 19 purity).

import { useMemo, useState } from 'react'
import { Baby, CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PrivacyStrip } from '@/components/instant/instant-kit'

const MS_PER_DAY = 86_400_000
const GESTATION_DAYS = 280
const CONCEPTION_DAYS = 266
const CYCLE_DEFAULT = 28
const CYCLE_MIN = 21
const CYCLE_MAX = 35
// 42w0d — the end of the typical 37–42 week birth window.
const WEEK_42_DAYS = 294

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const
const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** Parse "YYYY-MM-DD" into a UTC-midnight Date, rejecting impossible dates
 *  (Date.UTC would happily roll 2026-02-30 over into March). */
function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const date = new Date(Date.UTC(y, mo, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo || date.getUTCDate() !== d) {
    return null
  }
  return date
}

/** Add whole days to a UTC-midnight date. Working on the UTC timestamp keeps
 *  this exact across time zones — there is no DST at UTC midnight. */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

/** Whole days from UTC-midnight a to UTC-midnight b. */
function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY)
}

/** ISO-like "YYYY-MM-DD" — the canonical form shown on the due-date card. */
const isoDay = (date: Date) => date.toISOString().slice(0, 10)

function formatLong(date: Date): string {
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

function formatShort(date: Date): string {
  return `${WEEKDAYS_SHORT[date.getUTCDay()]}, ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

function plural(n: number): string {
  return Math.abs(n) === 1 ? '' : 's'
}

interface Estimate {
  /** Gestational anchor: the real — or notional — first day of the last period. */
  anchor: Date
  anchorNote: string
  due: Date
  basis: string
  /** Days added on top of the standard 280 because of the cycle length. */
  cycleShift: number
}

interface Gestational {
  elapsed: number
  remaining: number
  pct: number
  phase: 'before' | 'active' | 'late'
  trimester: 1 | 2 | 3
}

type Mode = 'lmp' | 'conc'

export function DueDateTool() {
  const [mode, setMode] = useState<Mode>('lmp')
  const [lmp, setLmp] = useState('')
  const [cycleRaw, setCycleRaw] = useState(String(CYCLE_DEFAULT))
  const [conc, setConc] = useState('')

  // "Today" is only read inside this lazy initializer, guarded for SSR: the
  // server renders the empty state (no date picked yet), and by the time a
  // date is picked we are on the client where the guard passes. No browser
  // global is touched unconditionally during render.
  const [today] = useState<Date | null>(() => {
    if (typeof window === 'undefined') return null
    const now = new Date()
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  })

  // The cycle field is clamped to the clinically common 21–35 day range and
  // the clamp is surfaced, not silent.
  const cycleNum = Number(cycleRaw)
  const cycleEntered = cycleRaw.trim() !== '' && Number.isFinite(cycleNum)
  const cycle = cycleEntered ? Math.round(cycleNum) : CYCLE_DEFAULT
  const cycleClamped = cycleEntered && (cycle < CYCLE_MIN || cycle > CYCLE_MAX)
  const cycleEffective = Math.min(CYCLE_MAX, Math.max(CYCLE_MIN, cycle))

  const estimate = useMemo<Estimate | null>(() => {
    if (mode === 'lmp') {
      const lmpDate = parseIsoDate(lmp)
      if (!lmpDate) return null
      const shift = cycleEffective - CYCLE_DEFAULT
      return {
        anchor: lmpDate,
        anchorNote: 'from the first day of the last period',
        // Naegele's rule: LMP + 280 days, then adjust by (cycle − 28) days.
        due: addDays(lmpDate, GESTATION_DAYS + shift),
        basis:
          shift === 0
            ? `Counted ${GESTATION_DAYS} days from the first day of the last period — Naegele's rule on a 28-day cycle.`
            : `Counted ${GESTATION_DAYS} days from the first day of the last period, ${shift > 0 ? '+' : '−'}${Math.abs(shift)} day${plural(shift)} for your ${cycleEffective}-day cycle.`,
        cycleShift: shift,
      }
    }
    const concDate = parseIsoDate(conc)
    if (!concDate) return null
    return {
      // Gestational age counts from a notional period about 14 days before
      // conception — which is why conception + 266 equals the standard 280.
      anchor: addDays(concDate, -14),
      anchorNote: 'from a notional last period, 14 days before conception',
      due: addDays(concDate, CONCEPTION_DAYS),
      basis: `Counted ${CONCEPTION_DAYS} days from the conception date — the standard 280, minus the roughly two weeks before conception.`,
      cycleShift: 0,
    }
  }, [mode, lmp, conc, cycleEffective])

  const gestational = useMemo<Gestational | null>(() => {
    if (!estimate || !today) return null
    const elapsed = daysBetween(estimate.anchor, today)
    const remaining = daysBetween(today, estimate.due)
    const pct = Math.min(100, Math.max(0, (elapsed / GESTATION_DAYS) * 100))
    return {
      elapsed,
      remaining,
      pct,
      phase: elapsed < 0 ? 'before' : elapsed > WEEK_42_DAYS ? 'late' : 'active',
      trimester: elapsed < 13 * 7 ? 1 : elapsed < 28 * 7 ? 2 : 3,
    }
  }, [estimate, today])

  const milestones = useMemo(() => {
    if (!estimate) return []
    const shift = estimate.cycleShift
    return [
      { label: 'First trimester ends (week 12)', date: addDays(estimate.anchor, 12 * 7), note: undefined as string | undefined },
      { label: 'Halfway point (week 20)', date: addDays(estimate.anchor, 20 * 7), note: undefined },
      { label: 'Viability milestone (week 24)', date: addDays(estimate.anchor, 24 * 7), note: undefined },
      { label: 'Early term begins (week 37)', date: addDays(estimate.anchor, 37 * 7), note: undefined },
      {
        label: 'Estimated due date (week 40)',
        date: estimate.due,
        note:
          shift !== 0
            ? `moved ${shift > 0 ? 'later' : 'earlier'} by ${Math.abs(shift)} day${plural(shift)} for your cycle length`
            : undefined,
      },
    ]
  }, [estimate])

  const trimesterLabel = gestational ? `${gestational.trimester === 1 ? '1st' : gestational.trimester === 2 ? '2nd' : '3rd'} trimester` : null

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList aria-label="Estimation method">
            <TabsTrigger value="lmp">Last period</TabsTrigger>
            <TabsTrigger value="conc">Conception</TabsTrigger>
          </TabsList>

          {/* forceMount keeps both inputs in the DOM (Radix hides the inactive
              one) so results compute live no matter which mode is shown. */}
          <TabsContent value="lmp" forceMount className="pt-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <Label htmlFor="dd-lmp">First day of the last menstrual period</Label>
                <Input
                  id="dd-lmp"
                  type="date"
                  value={lmp}
                  onChange={(e) => setLmp(e.target.value)}
                  className="mt-1.5 sm:max-w-64"
                />
              </div>
              <div>
                <Label htmlFor="dd-cycle">Cycle length (days)</Label>
                <Input
                  id="dd-cycle"
                  type="number"
                  min={CYCLE_MIN}
                  max={CYCLE_MAX}
                  step={1}
                  value={cycleRaw}
                  onChange={(e) => setCycleRaw(e.target.value)}
                  className="mt-1.5 w-32"
                />
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Longer cycles shift the estimate later: the tool adds (cycle − 28) days to the standard count, so a
              30-day cycle moves the due date 2 days past it. Range accepted: {CYCLE_MIN}–{CYCLE_MAX} days.
            </p>
            {cycleClamped && (
              <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-500">
                Cycles outside {CYCLE_MIN}–{CYCLE_MAX} days are unusual — the estimate clamps to the nearest end of
                the range rather than pretending precision.
              </p>
            )}
          </TabsContent>

          <TabsContent value="conc" forceMount className="pt-4">
            <div>
              <Label htmlFor="dd-conc">Conception date (or your best guess)</Label>
              <Input
                id="dd-conc"
                type="date"
                value={conc}
                onChange={(e) => setConc(e.target.value)}
                className="mt-1.5 sm:max-w-64"
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Counts {CONCEPTION_DAYS} days from conception. Gestational age is still reported the usual way — from a
              notional last period about 14 days earlier.
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {!estimate && (
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
          <CalendarDays className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Pick a date to see the estimate</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Everything below computes the moment you choose a date — nothing is stored or sent anywhere.
          </p>
        </div>
      )}

      {estimate && (
        <div className="space-y-4" aria-live="polite">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Due date — the QA hook asserts the ISO string appears here. */}
            <div data-testid="dd-due" className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">Estimated due date</p>
              <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">{isoDay(estimate.due)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatLong(estimate.due)}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{estimate.basis}</p>
            </div>

            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs text-muted-foreground">Gestational age today</p>
                {trimesterLabel && <Badge variant="secondary">{trimesterLabel}</Badge>}
              </div>
              <p className="mt-1 flex items-center gap-2 font-mono text-3xl font-semibold tabular-nums">
                <Baby className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
                {gestational && gestational.elapsed >= 0
                  ? `${Math.floor(gestational.elapsed / 7)}w ${gestational.elapsed % 7}d`
                  : '—'}
              </p>
              {gestational && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Counted {estimate.anchorNote}.
                </p>
              )}
              {gestational?.phase === 'before' && (
                <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-500">
                  The date you picked is {Math.abs(gestational.elapsed)} day{plural(gestational.elapsed)} in the
                  future — these numbers start once the pregnancy is under way.
                </p>
              )}
              {gestational?.phase === 'late' && (
                <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                  Past the typical 37–42 week window. If the date is right, talk to your clinician; if not,
                  double-check the year you entered.
                </p>
              )}
            </div>
          </div>

          {gestational && (
            <div className="rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">Pregnancy progress</p>
                <p className="text-sm text-muted-foreground">
                  {gestational.remaining === 0
                    ? 'Due today'
                    : gestational.remaining > 0
                      ? `${gestational.remaining} day${plural(gestational.remaining)} to go`
                      : `Overdue by ${Math.abs(gestational.remaining)} day${plural(gestational.remaining)}`}
                </p>
              </div>
              <Progress value={gestational.pct} className="mt-3" aria-label="Progress through the 280-day span" />
              <p className="mt-2 text-xs text-muted-foreground">
                {Math.round(gestational.pct)}% of the {GESTATION_DAYS}-day span from the last period to the due date.
              </p>
            </div>
          )}

          <div className="rounded-lg border bg-background p-4">
            <p className="text-sm font-medium">Milestones</p>
            <ul className="mt-3 space-y-2">
              {milestones.map((m) => {
                const passed = today !== null && m.date.getTime() < today.getTime()
                return (
                  <li key={m.label} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className={passed ? 'text-sm text-muted-foreground' : 'text-sm'}>
                      {m.label}
                      {m.note && <span className="ml-1.5 text-xs text-muted-foreground">({m.note})</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      {passed && (
                        <Badge variant="outline" className="text-muted-foreground">
                          passed
                        </Badge>
                      )}
                      <span
                        className={
                          passed
                            ? 'font-mono text-xs tabular-nums text-muted-foreground line-through'
                            : 'font-mono text-xs tabular-nums'
                        }
                      >
                        {formatShort(m.date)}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              About 80% of births happen between week 37 and week 42 — the due date is a midpoint, not a deadline.
            </p>
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
            <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            An estimate, not medical advice — cycles vary and ultrasound dating is more accurate; confirm with your
            clinician.
          </p>
        </div>
      )}

      <PrivacyStrip detail="The dates you enter stay in this tab: the estimate is plain date arithmetic in page memory, nothing is stored between visits, and nothing is sent anywhere." />
    </div>
  )
}
