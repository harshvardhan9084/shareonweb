'use client'

// Sleep-cycle planner. The model is the common 90-minute-cycle heuristic,
// stated as a heuristic: you fall asleep in ~15 minutes (adjustable), then
// complete ~90-minute cycles, and waking at the end of a cycle feels easier
// than waking mid-cycle. Two directions: "wake up at" lists bedtimes that
// land whole cycles before the alarm, and "sleep now" lists alarm times a
// whole number of cycles from the moment you lie down. The page says plainly
// that cycle length varies between people and this is not medical advice.

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

const CYCLE_MIN = 90

/** HH:MM local time -> minutes since midnight. */
function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return NaN
  const h = Number.parseInt(m[1], 10)
  const min = Number.parseInt(m[2], 10)
  if (h > 23 || min > 59) return NaN
  return h * 60 + min
}

/** Minutes since midnight -> HH:MM (wraps past midnight honestly). */
function fmtTime(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "9 h 0 min" style duration. */
function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** "now" as a time input value, captured only on user action (never render). */
function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface Row {
  cycles: number
  time: string
  sleep: number // total sleep minutes (cycles × 90)
  note: string
}

function rowsFor(baseMinutes: number, latency: number, direction: 'bed' | 'wake'): Row[] {
  const rows: Row[] = []
  for (let cycles = 6; cycles >= 3; cycles--) {
    const span = cycles * CYCLE_MIN + latency
    const time = direction === 'bed' ? baseMinutes - span : baseMinutes + span
    const note =
      cycles === 6
        ? 'most rested — a full night’s worth of cycles'
        : cycles === 5
          ? 'solid night'
          : cycles === 4
            ? 'a decent short night'
            : 'the shortest we would suggest'
    rows.push({ cycles, time: fmtTime(time), sleep: cycles * CYCLE_MIN, note })
  }
  return rows
}

export function SleepTool() {
  const [mode, setMode] = useState<'bed' | 'wake'>('bed')
  const [wakeAt, setWakeAt] = useState('07:00')
  const [bedAt, setBedAt] = useState('23:00')
  const [latency, setLatency] = useState('15')

  const lat = Number.parseInt(latency, 10)
  const latValid = Number.isFinite(lat) && lat >= 0 && lat <= 120

  const wakeValid = latValid && Number.isFinite(toMinutes(wakeAt))
  const bedValid = latValid && Number.isFinite(toMinutes(bedAt))

  const bedRows = mode === 'bed' && wakeValid ? rowsFor(toMinutes(wakeAt), lat || 0, 'bed') : null
  const wakeRows = mode === 'wake' && bedValid ? rowsFor(toMinutes(bedAt), lat || 0, 'wake') : null
  const rows = mode === 'bed' ? bedRows : wakeRows
  const anchorInvalid = mode === 'bed' ? !wakeValid : !bedValid

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Planner direction">
        <Button
          type="button"
          size="sm"
          variant={mode === 'bed' ? 'default' : 'outline'}
          aria-pressed={mode === 'bed'}
          onClick={() => setMode('bed')}
        >
          I want to wake up at…
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'wake' ? 'default' : 'outline'}
          aria-pressed={mode === 'wake'}
          onClick={() => setMode('wake')}
        >
          I am going to bed now…
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {mode === 'bed' ? (
          <div className="space-y-1.5">
            <Label htmlFor="sleep-wake">Alarm time (wake up at)</Label>
            <Input
              id="sleep-wake"
              type="time"
              value={wakeAt}
              onChange={(e) => setWakeAt(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="sleep-bed">Lights-out time</Label>
            <div className="flex gap-2">
              <Input id="sleep-bed" type="time" value={bedAt} onChange={(e) => setBedAt(e.target.value)} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setBedAt(nowHHMM())}
              >
                Use current time
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="sleep-latency">Fall-asleep time (min)</Label>
          <Input
            id="sleep-latency"
            type="text"
            inputMode="numeric"
            value={latency}
            onChange={(e) => setLatency(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <p className="text-xs text-muted-foreground">
            {mode === 'bed'
              ? 'Bedtimes are alarm minus (cycles × 90 min) minus the minutes it takes you to fall asleep.'
              : 'Alarm times are lights-out plus the fall-asleep minutes plus whole 90-minute cycles.'}
          </p>
        </div>
      </div>

      {anchorInvalid && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Enter a valid time (HH:MM) and a fall-asleep value between 0 and 120 minutes.
        </p>
      )}

      {rows && (
        <ul data-testid="sleep-list" className="grid gap-2 sm:grid-cols-2" aria-live="polite">
          {rows.map((r) => (
            <li
              key={r.cycles}
              className={cn(
                'flex items-center gap-3 rounded-xl border bg-card p-3.5',
                r.cycles === 6 && 'border-primary/40 bg-primary/5',
              )}
            >
              <span className="font-display text-xl font-semibold tabular-nums tracking-[-0.02em]">
                {r.time}
              </span>
              <span className="min-w-0 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  {r.cycles} cycles · {fmtDuration(r.sleep)} sleep
                </span>
                <br />
                {r.note}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The 90-minute figure is a population average, not a law: individual cycles run roughly 80–110 minutes
        and vary night to night. The times here are a planning aid built on the standard heuristic — they are
        not medical advice, and persistent sleep problems belong with a doctor, not a calculator.
      </p>

      <PrivacyStrip detail="Times are computed in this tab from what you type — the “use current time” button reads the clock on your device and nothing is stored or sent." />
    </div>
  )
}
