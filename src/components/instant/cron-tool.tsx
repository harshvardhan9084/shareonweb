'use client'

// Cron Studio — parse, explain and preview cron expressions entirely in this
// tab. The parser is hand-written (no cron library): 5-field Vixie crontab
// syntax and 6-field seconds-first (Quartz / lockfile) syntax, with names,
// ranges, steps and lists. Every field expands to its exact set of values;
// the classic Vixie dom/dow OR rule is applied and explained when both day
// fields are restricted. Next fire times are computed against the device
// clock with a 366-day cap, and load estimates are labeled as simulations.
// The device clock and timezone arrive through useSyncExternalStore so the
// server render and the first client render agree.

import { useMemo, useState, useSyncExternalStore } from 'react'
import {
  Check,
  Clock,
  Copy,
  Info,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PrivacyStrip } from '@/components/instant/instant-kit'

// ------------------------------------------------------------------ types ---

type FieldKind = 'second' | 'minute' | 'hour' | 'dom' | 'month' | 'dow'
type Mode = 'auto' | 'five' | 'six'

interface Term {
  lo: number
  hi: number
  step: number
}

interface FieldResult {
  kind: FieldKind
  name: string
  spanText: string
  raw: string
  ok: boolean
  /** Exact, sorted, unique set of values this field can take. */
  values: number[]
  /** The whole field was '*' (or '?') — unrestricted. */
  wildcard: boolean
  /** A Quartz '?' appeared in dom/dow. */
  quartzQ: boolean
  /** dow: a 7 was written (both 0 and 7 mean Sunday). */
  hasSeven: boolean
  /** Numeric descriptors after name resolution, for the description. */
  terms: Term[]
  error: string | null
}

interface CronParse {
  ok: boolean
  empty: boolean
  sixField: boolean
  fields: FieldResult[]
  globalErrors: string[]
  notes: string[]
}

interface CronEngine {
  sixField: boolean
  domWildcard: boolean
  dowWildcard: boolean
  domSet: Set<number>
  dowSet: Set<number>
  monthSet: Set<number>
  hourValues: number[]
  minuteValues: number[]
  secondValues: number[]
  bothRestricted: boolean
}

// -------------------------------------------------------------- constants ---

const FIELD_META: Record<FieldKind, { name: string; spanText: string }> = {
  second: { name: 'second', spanText: '0-59' },
  minute: { name: 'minute', spanText: '0-59' },
  hour: { name: 'hour', spanText: '0-23' },
  dom: { name: 'day-of-month', spanText: '1-31' },
  month: { name: 'month', spanText: '1-12, JAN-DEC' },
  dow: { name: 'day-of-week', spanText: '0-7, SUN-SAT' },
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DOWS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const AT_SHORTCUTS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

const PRESETS: Array<{ label: string; expr: string; note?: string }> = [
  { label: 'Every minute', expr: '* * * * *' },
  { label: 'Every 5 minutes', expr: '*/5 * * * *' },
  { label: 'Hourly at :30', expr: '30 * * * *' },
  { label: 'Daily 03:30', expr: '30 3 * * *' },
  { label: 'Weekdays 09:00', expr: '0 9 * * MON-FRI' },
  { label: 'Weekly Sun 04:00', expr: '0 4 * * SUN' },
  { label: 'Monthly on the 1st, 00:00', expr: '0 0 1 * *' },
  { label: 'Yearly Jan 1, 00:00', expr: '0 0 1 1 *' },
  { label: 'Quartz: every 30 seconds', expr: '*/30 * * * * ?', note: '6-field' },
]

// ----------------------------------------------------------------- parser ---

class ParseFail extends Error {}

function spanLo(kind: FieldKind): number {
  return kind === 'dom' || kind === 'month' ? 1 : 0
}

function spanHi(kind: FieldKind): number {
  return kind === 'dom' ? 31 : kind === 'month' ? 12 : kind === 'dow' ? 7 : kind === 'hour' ? 23 : 59
}

function atomNumber(kind: FieldKind, atom: string): number {
  const n = Number(atom)
  const lo = spanLo(kind)
  const hi = spanHi(kind)
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new ParseFail(`${FIELD_META[kind].name} field: '${atom}' is out of range ${lo}-${hi}`)
  }
  return n
}

function atomName(kind: FieldKind, atom: string): number {
  const meta = FIELD_META[kind]
  if (!/^[A-Za-z]{3}$/.test(atom)) {
    throw new ParseFail(
      `${meta.name} field: '${atom}' is not a supported name — use three-letter names (${kind === 'month' ? 'JAN, FEB, MAR…' : 'SUN, MON, TUE…'})`,
    )
  }
  const table = kind === 'month' ? MONTHS : DOWS
  const idx = table.indexOf(atom.toUpperCase())
  if (idx === -1) {
    throw new ParseFail(
      `${meta.name} field: '${atom}' is not a recognized ${kind === 'month' ? 'month name (JAN-DEC)' : 'day name (SUN-SAT)'}`,
    )
  }
  return kind === 'month' ? idx + 1 : idx
}

function isNumeric(atom: string): boolean {
  return /^[0-9]+$/.test(atom)
}

function diagnose(part: string, kind: FieldKind): ParseFail {
  const name = FIELD_META[kind].name
  if (part.includes('#')) {
    return new ParseFail(
      kind === 'dow'
        ? `${name} field: '${part}' — the "#" nth-weekday syntax (like FRI#2) is Quartz-only and is not supported here`
        : `${name} field: '${part}' — "#" is not valid in the ${name} field`,
    )
  }
  // "L" / "W" adjacent to a boundary or digit — Quartz-only. Real names
  // (JUL, WED) parse successfully, so a failure shaped like this is
  // genuinely the Quartz syntax, not a mistyped name.
  if (part.toUpperCase() === 'LW') {
    return new ParseFail(`${name} field: '${part}' — "L" and "W" are Quartz-only syntax and are not supported here`)
  }
  if (/(?:^|\d)L(?![A-Za-z])/i.test(part)) {
    return new ParseFail(
      kind === 'dom' || kind === 'dow'
        ? `${name} field: '${part}' — the "L" last-day syntax is Quartz-only and is not supported here`
        : `${name} field: '${part}' — "L" is not valid in the ${name} field`,
    )
  }
  if (/(?:^|\d)W(?![A-Za-z])/i.test(part)) {
    return new ParseFail(
      kind === 'dom'
        ? `${name} field: '${part}' — the "W" nearest-weekday syntax is Quartz-only and is not supported here`
        : `${name} field: '${part}' — "W" is not valid in the ${name} field`,
    )
  }
  if (part.includes('?')) {
    return new ParseFail(`${name} field: '${part}' — '?' is only valid as the whole field, where it reads the same as *`)
  }
  if (/^[A-Za-z]+$/.test(part)) {
    return new ParseFail(
      `${name} field: '${part}' — names are only valid in the month and day-of-week fields (${FIELD_META[kind].spanText} here)`,
    )
  }
  return new ParseFail(`${name} field: '${part}' is not a valid value (${FIELD_META[kind].spanText})`)
}

function expandValues(terms: Term[], kind: FieldKind): number[] {
  const vals = new Set<number>()
  for (const t of terms) {
    for (let v = t.lo; v <= t.hi; v += t.step) {
      vals.add(kind === 'dow' && v === 7 ? 0 : v)
    }
  }
  return Array.from(vals).sort((a, b) => a - b)
}

function parseField(raw: string, kind: FieldKind): FieldResult {
  const meta = FIELD_META[kind]
  const result: FieldResult = {
    kind,
    name: meta.name,
    spanText: meta.spanText,
    raw,
    ok: false,
    values: [],
    wildcard: false,
    quartzQ: false,
    hasSeven: false,
    terms: [],
    error: null,
  }
  try {
    // The whole field is a wildcard. Quartz '?' is accepted in dom/dow only,
    // and flagged — it reads the same as '*'.
    if (raw === '*' || raw === '?') {
      if (raw === '?') {
        if (kind !== 'dom' && kind !== 'dow') {
          throw new ParseFail(
            `${meta.name} field: '?' is Quartz-only syntax and only valid in day-of-month or day-of-week — it reads the same as *`,
          )
        }
        result.quartzQ = true
      }
      result.wildcard = true
      result.terms = [{ lo: spanLo(kind), hi: kind === 'dow' ? 6 : spanHi(kind), step: 1 }]
      result.values = expandValues(result.terms, kind)
      result.ok = true
      return result
    }

    if (kind === 'dow' && /\b7\b/.test(raw)) result.hasSeven = true

    const terms: Term[] = []
    for (const part of raw.split(',')) {
      if (!part) {
        throw new ParseFail(`${meta.name} field: '${raw}' — there is an empty item in the list`)
      }
      // Quartz-only L / W syntax in the day fields is refused precisely,
      // before generic parsing can mistake it for a name.
      if (kind === 'dom' || kind === 'dow') {
        if (part.toUpperCase() === 'LW') {
          throw new ParseFail(`${meta.name} field: '${part}' — "L" and "W" are Quartz-only syntax and are not supported here`)
        }
        if (/(?:^|\d)L(?![A-Za-z])/i.test(part)) {
          throw new ParseFail(`${meta.name} field: '${part}' — the "L" last-day syntax is Quartz-only and is not supported here`)
        }
        if (/(?:^|\d)W(?![A-Za-z])/i.test(part)) {
          throw new ParseFail(
            kind === 'dom'
              ? `${meta.name} field: '${part}' — the "W" nearest-weekday syntax is Quartz-only and is not supported here`
              : `${meta.name} field: '${part}' — "W" is not valid in the ${meta.name} field`,
          )
        }
      }
      // '?' is only a whole-field placeholder; any other '?' use is refused.
      const m = part.match(/^(\*|[0-9]+|[A-Za-z]+)(?:-([0-9]+|[A-Za-z]+))?(?:\/([0-9]+))?$/)
      if (!m) throw diagnose(part, kind)
      const [, aRaw, bRaw, stepRaw] = m

      let step = 1
      if (stepRaw !== undefined) {
        step = Number(stepRaw)
        if (!step) {
          throw new ParseFail(`${meta.name} field: '${part}' — the step must be a positive number (use /1, /2, /5…)`)
        }
      }

      let lo: number
      let hi: number
      if (aRaw === '*') {
        if (bRaw) throw new ParseFail(`${meta.name} field: '${part}' — '*' cannot be part of a range`)
        lo = spanLo(kind)
        hi = spanHi(kind)
      } else if (kind === 'month' || kind === 'dow') {
        lo = isNumeric(aRaw) ? atomNumber(kind, aRaw) : atomName(kind, aRaw)
        if (bRaw !== undefined) {
          hi = isNumeric(bRaw) ? atomNumber(kind, bRaw) : atomName(kind, bRaw)
        } else {
          hi = lo
        }
      } else {
        if (!isNumeric(aRaw)) {
          throw new ParseFail(`${meta.name} field: '${aRaw}' — names are only valid in the month and day-of-week fields`)
        }
        lo = atomNumber(kind, aRaw)
        if (bRaw !== undefined) {
          if (!isNumeric(bRaw)) {
            throw new ParseFail(`${meta.name} field: '${bRaw}' — names are only valid in the month and day-of-week fields`)
          }
          hi = atomNumber(kind, bRaw)
        } else {
          hi = lo
        }
      }
      if (lo > hi) {
        throw new ParseFail(
          `${meta.name} field: '${part}' runs backwards — ranges must go from low to high; cron does not wrap them`,
        )
      }
      terms.push({ lo, hi, step })
    }

    result.terms = terms
    result.values = expandValues(terms, kind)
    result.ok = true
    return result
  } catch (err) {
    result.error = err instanceof ParseFail ? err.message : String(err)
    return result
  }
}

function parseCron(input: string, mode: Mode): CronParse {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, empty: true, sixField: false, fields: [], globalErrors: [], notes: [] }
  }
  const globalErrors: string[] = []
  const notes: string[] = []

  // Standard @-shortcuts expand to their expressions; @reboot is refused
  // honestly — there is no wall-clock time behind it.
  const lower = trimmed.toLowerCase()
  if (lower === '@reboot') {
    return {
      ok: false,
      empty: false,
      sixField: false,
      fields: [],
      globalErrors: [
        '@reboot cannot be scheduled here — it means "fire when the machine boots", which has no wall-clock time to compute. The other shortcuts expand on this page: @hourly is 0 * * * *, @daily is 0 0 * * *, @weekly is 0 0 * * 0, @monthly is 0 0 1 * * and @yearly is 0 0 1 1 *.',
      ],
      notes: [],
    }
  }
  let expr = trimmed
  if (AT_SHORTCUTS[lower]) {
    expr = AT_SHORTCUTS[lower]
    notes.push(`${lower} expands to ${AT_SHORTCUTS[lower]}.`)
  }

  const tokens = expr.split(/\s+/)
  if (tokens.length === 7) {
    return {
      ok: false,
      empty: false,
      sixField: false,
      fields: [],
      globalErrors: [
        '7 fields found — a year column is not supported here (it is Quartz-only). Remove the year field and keep 5 fields, or 6 with seconds first.',
      ],
      notes,
    }
  }
  if (tokens.length < 5 || tokens.length > 6) {
    return {
      ok: false,
      empty: false,
      sixField: false,
      fields: [],
      globalErrors: [
        `Expected 5 fields (minute hour day-of-month month day-of-week) or 6 with seconds first — found ${tokens.length}.`,
      ],
      notes,
    }
  }

  let sixField: boolean
  if (mode === 'five') {
    if (tokens.length !== 5) {
      return {
        ok: false,
        empty: false,
        sixField: false,
        fields: [],
        globalErrors: [
          `A 5-field (standard crontab) reading was forced, but this expression has ${tokens.length} fields. A 5-field expression has no seconds column.`,
        ],
        notes,
      }
    }
    sixField = false
  } else if (mode === 'six') {
    if (tokens.length !== 6) {
      return {
        ok: false,
        empty: false,
        sixField: false,
        fields: [],
        globalErrors: [
          `A 6-field (seconds first) reading was forced, but this expression has ${tokens.length} fields. Seconds-first syntax needs exactly 6.`,
        ],
        notes,
      }
    }
    sixField = true
  } else {
    sixField = tokens.length === 6
    if (sixField) {
      notes.push('6 fields detected — read seconds-first: second minute hour day-of-month month day-of-week (the Quartz / lockfile convention).')
    }
  }

  const order: FieldKind[] = sixField
    ? ['second', 'minute', 'hour', 'dom', 'month', 'dow']
    : ['minute', 'hour', 'dom', 'month', 'dow']
  const fields = order.map((k, i) => parseField(tokens[i], k))
  return { ok: fields.every((f) => f.ok), empty: false, sixField, fields, globalErrors, notes }
}

// ----------------------------------------------------------------- engine ---

function buildEngine(p: CronParse): CronEngine {
  const get = (k: FieldKind): FieldResult => {
    const f = p.fields.find((x) => x.kind === k)
    if (!f) throw new Error(`missing field ${k}`)
    return f
  }
  const dom = get('dom')
  const dow = get('dow')
  return {
    sixField: p.sixField,
    domWildcard: dom.wildcard,
    dowWildcard: dow.wildcard,
    domSet: new Set(dom.values),
    dowSet: new Set(dow.values),
    monthSet: new Set(get('month').values),
    hourValues: get('hour').values,
    minuteValues: get('minute').values,
    secondValues: p.sixField ? get('second').values : [0],
    bothRestricted: !dom.wildcard && !dow.wildcard,
  }
}

/**
 * The Vixie cron day rule: when both day-of-month and day-of-week are
 * restricted, a day matches when EITHER matches; when one of them is '*',
 * both conditions must hold.
 */
function dayMatches(e: CronEngine, y: number, mo: number, d: number, dow: number): boolean {
  if (!e.monthSet.has(mo)) return false
  if (e.domWildcard && e.dowWildcard) return true
  const domOk = e.domSet.has(d)
  const dowOk = e.dowSet.has(dow)
  if (e.domWildcard) return dowOk
  if (e.dowWildcard) return domOk
  return domOk || dowOk
}

function nextFireTimes(e: CronEngine, from: Date, n: number, maxDays = 366): Date[] {
  const out: Date[] = []
  const fromT = from.getTime()
  for (let i = 0; i <= maxDays && out.length < n; i++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    const y = day.getFullYear()
    const mo = day.getMonth() + 1
    const d = day.getDate()
    if (!dayMatches(e, y, mo, d, day.getDay())) continue
    const times: Date[] = []
    for (const h of e.hourValues) {
      for (const mi of e.minuteValues) {
        for (const s of e.secondValues) {
          const t = new Date(y, mo - 1, d, h, mi, s)
          if (t.getTime() > fromT) times.push(t)
        }
      }
    }
    // DST can shift a nonexistent wall-clock time forward; sort to stay
    // ascending within the day regardless.
    times.sort((a, b) => a.getTime() - b.getTime())
    for (const t of times) {
      out.push(t)
      if (out.length >= n) return out
    }
  }
  return out
}

interface LoadCounts {
  perDay: Array<{ t: Date; n: number }>
  capped: boolean
}

/** Count fires per calendar day, walking day by day with a hard match cap. */
function loadCounts(e: CronEngine, from: Date, maxDays = 366, cap = 1_000_000): LoadCounts {
  const perDay: Array<{ t: Date; n: number }> = []
  let total = 0
  for (let i = 0; i <= maxDays; i++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    const y = day.getFullYear()
    const mo = day.getMonth() + 1
    const d = day.getDate()
    if (!dayMatches(e, y, mo, d, day.getDay())) continue
    let n = 0
    for (const h of e.hourValues) {
      void h
      n += e.minuteValues.length * e.secondValues.length
    }
    perDay.push({ t: day, n })
    total += n
    if (total >= cap) return { perDay, capped: true }
  }
  return { perDay, capped: false }
}

interface LoadEstimate {
  dayCount: number
  dayLabel: string
  weekCount: number
  weekLabel: string
  monthCount: number
  monthLabel: string
  capped: boolean
}

/** Simulate one representative day, week and month from the per-day counts. */
function loadEstimate(e: CronEngine, from: Date): LoadEstimate | null {
  const { perDay, capped } = loadCounts(e, from)
  const tomorrow = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1).getTime()
  // Prefer a full day after today; today counts too if it is all we have.
  const first = perDay.find((x) => x.t.getTime() >= tomorrow) ?? perDay[0]
  if (!first) return null

  const key = (t: Date) => `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`
  const map = new Map(perDay.map((x) => [key(x.t), x.n] as const))

  let weekCount = 0
  for (let i = 0; i < 7; i++) {
    const t = new Date(first.t.getFullYear(), first.t.getMonth(), first.t.getDate() + i)
    weekCount += map.get(key(t)) ?? 0
  }
  let monthCount = 0
  for (const x of perDay) {
    if (x.t.getFullYear() === first.t.getFullYear() && x.t.getMonth() === first.t.getMonth()) {
      monthCount += x.n
    }
  }

  const dayLabel = first.t.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const weekLabel = `7 days from ${first.t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  const monthLabel = first.t.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  return { dayCount: first.n, dayLabel, weekCount, weekLabel, monthCount, monthLabel, capped }
}

// ------------------------------------------------------------ description ---

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

function listJoin(items: string[]): string {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function hhmm(h: number, m: number): string {
  return `${pad2(h)}:${pad2(m)}`
}

function isSingle(t: Term): boolean {
  return t.lo === t.hi && t.step === 1
}

function describeSeconds(sec: FieldResult | undefined): { headline: string | null; tail: string | null } {
  if (!sec || sec.wildcard) return { headline: null, tail: null }
  if (sec.values.length === 1 && sec.values[0] === 0) return { headline: null, tail: null }
  if (sec.values.length === 1) return { headline: null, tail: `at second ${sec.values[0]}` }
  if (sec.terms.length === 1 && sec.terms[0].step > 1 && sec.terms[0].lo === 0 && sec.terms[0].hi === 59) {
    return { headline: `Every ${sec.terms[0].step} seconds`, tail: null }
  }
  return { headline: null, tail: `at seconds ${listJoin(sec.values.map(String))}` }
}

function describeTime(hr: FieldResult, min: FieldResult): string {
  const minFullStep =
    !min.wildcard && min.terms.length === 1 && min.terms[0].step > 1 && min.terms[0].lo === 0 && min.terms[0].hi === 59
  if (hr.wildcard && min.wildcard) return 'Every minute'
  if (hr.wildcard && minFullStep) return `Every ${min.terms[0].step} minutes`
  if (hr.wildcard) {
    if (min.values.length === 1) return `At ${min.values[0]} minutes past the hour`
    if (min.terms.every(isSingle)) {
      return `At minutes ${listJoin(min.values.map(pad2))} past the hour`
    }
    const t = min.terms[0]
    if (min.terms.length === 1 && t.step === 1 && t.lo < t.hi) {
      return `At minutes ${t.lo} through ${t.hi} past the hour`
    }
    if (min.terms.length === 1 && t.step > 1) {
      return `At every ${ordinal(t.step)} minute from ${t.lo}`
    }
    return `At minutes ${min.raw} past the hour`
  }
  // Restricted hours.
  const product = hr.values.length * min.values.length
  if (product <= 8 && !min.wildcard) {
    const times: string[] = []
    for (const h of hr.values) for (const m of min.values) times.push(hhmm(h, m))
    return `At ${listJoin(times)}`
  }
  const mv = min.wildcard ? null : min.values[0]
  const t = hr.terms[0]
  if (hr.terms.length === 1 && t.step > 1 && mv !== null) {
    const through = t.hi < 23 ? ` through ${pad2(t.hi)}` : ''
    return `At minute ${mv} past every ${ordinal(t.step)} hour from ${pad2(t.lo)}${through}`
  }
  if (hr.terms.length === 1 && t.step === 1 && t.lo < t.hi && mv !== null) {
    return `At minute ${mv} past every hour from ${pad2(t.lo)} through ${pad2(t.hi)}`
  }
  if (min.wildcard) {
    return `At every minute past hour${hr.values.length > 1 ? 's' : ''} ${listJoin(hr.values.map(pad2))}`
  }
  return `At minute${min.values.length > 1 ? 's' : ''} ${listJoin(min.values.map(pad2))} past hour${hr.values.length > 1 ? 's' : ''} ${listJoin(hr.values.map(pad2))}`
}

function describeDom(dom: FieldResult): string | null {
  if (dom.wildcard) return null
  const t = dom.terms[0]
  if (dom.values.length === 1) return `on the ${ordinal(dom.values[0])} of the month`
  const allSingles = dom.terms.every(isSingle)
  if (allSingles && dom.values.length <= 4) {
    // Written order, not sorted — the user wrote "1,15", not "15,1".
    return `on the ${listJoin(dom.terms.map((x) => ordinal(x.lo)))} of the month`
  }
  if (dom.terms.length === 1 && t.step === 1 && t.lo < t.hi) {
    return `on days ${t.lo} through ${t.hi} of the month`
  }
  if (dom.terms.length === 1 && t.step > 1) {
    const from = t.lo === 1 ? '' : ` from the ${ordinal(t.lo)}`
    return `on every ${ordinal(t.step)} day of the month${from}`
  }
  const head = dom.values.slice(0, 8)
  const more = dom.values.length > head.length ? ' and more' : ''
  return `on days ${listJoin(head.map(String))}${more} of the month`
}

function describeDow(dow: FieldResult): string | null {
  if (dow.wildcard) return null
  if (dow.values.length === 7) return 'on every day of the week'
  if (dow.values.length === 1) return `on ${DAY_NAMES[dow.values[0]]}`
  const allSingles = dow.terms.every(isSingle)
  if (allSingles && dow.values.length <= 4) {
    // Written order: "6,0" should read Saturday and Sunday, as typed.
    return `on ${listJoin(dow.terms.map((x) => DAY_NAMES[x.lo === 7 ? 0 : x.lo]))}`
  }
  const t = dow.terms[0]
  const endName = DAY_NAMES[t.hi === 7 ? 0 : t.hi]
  if (dow.terms.length === 1 && t.step === 1 && t.lo < t.hi) {
    if (t.lo === 1 && t.hi === 5) return 'on every weekday from Monday through Friday'
    if (t.lo === 6 && t.hi === 7) return 'on every weekend day, Saturday through Sunday'
    return `on ${DAY_NAMES[t.lo]} through ${endName}`
  }
  if (dow.terms.length === 1 && t.step > 1) {
    const from = t.lo === 0 ? '' : ` from ${DAY_NAMES[t.lo]}`
    return `on every ${ordinal(t.step)} day of the week${from}`
  }
  return `on day-of-week ${dow.values.join(', ')}`
}

function describeMonth(mon: FieldResult): string | null {
  if (mon.wildcard) return null
  const t = mon.terms[0]
  if (mon.terms.length === 1 && t.step > 1) {
    const from = t.lo === 1 ? '' : ` from ${MONTH_LONG[t.lo - 1]}`
    return `every ${t.step} months${from}`
  }
  const names = mon.values.map((v) => MONTH_LONG[v - 1])
  if (mon.terms.length === 1 && t.step === 1 && t.lo < t.hi) {
    return `from ${MONTH_LONG[t.lo - 1]} through ${MONTH_LONG[t.hi - 1]}`
  }
  return `in ${listJoin(names)}`
}

function describeCron(p: CronParse): string {
  const get = (k: FieldKind): FieldResult => p.fields.find((f) => f.kind === k) as FieldResult
  const hr = get('hour')
  const min = get('minute')
  const dom = get('dom')
  const dow = get('dow')
  const mon = get('month')
  const sec = p.sixField ? get('second') : undefined

  const { headline: secHead, tail: secTail } = describeSeconds(sec)
  const time = describeTime(hr, min)
  const domD = describeDom(dom)
  const dowD = describeDow(dow)
  const monD = describeMonth(mon)
  const monIsStep = !mon.wildcard && mon.terms.length === 1 && mon.terms[0].step > 1

  const day = domD && dowD ? `${domD}, or ${dowD}` : (domD ?? dowD)

  let sentence: string
  const timeWithSec = secTail ? `${time}, ${secTail}` : time
  if (secHead) {
    sentence = [secHead, day, monD].filter(Boolean).join(' ')
  } else if (monIsStep) {
    sentence = [timeWithSec, monD, day].filter(Boolean).join(', ')
  } else {
    sentence = [timeWithSec, day, monD].filter(Boolean).join(' ')
  }
  return sentence || time
}

// --------------------------------------------------------- device clock ----
// The clock and timezone exist only on the client. useSyncExternalStore
// serves a stable snapshot (0 / '' on the server and during hydration) and
// refreshes on demand — no state-in-effect cascade, no hydration mismatch.

interface DeviceClock {
  now: number
  tz: string
}

const EMPTY_CLOCK: DeviceClock = { now: 0, tz: '' }
let cachedClock: DeviceClock | null = null
let clockListeners: Array<() => void> = []

function clientClock(): DeviceClock {
  if (!cachedClock) {
    let tz = ''
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      tz = ''
    }
    cachedClock = { now: Date.now(), tz }
  }
  return cachedClock
}

function refreshClock(): void {
  const tz = clientClock().tz
  cachedClock = { now: Date.now(), tz }
  for (const l of clockListeners) l()
}

function subscribeClock(cb: () => void): () => void {
  clockListeners.push(cb)
  return () => {
    clockListeners = clockListeners.filter((x) => x !== cb)
  }
}

function useDeviceClock(): DeviceClock {
  return useSyncExternalStore(subscribeClock, clientClock, () => EMPTY_CLOCK)
}

// ------------------------------------------------------------------- view ---

function fmtDateTime(t: Date, withSeconds: boolean): string {
  return t.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' as const } : {}),
  })
}

function relativeFrom(t: Date, nowTs: number): string {
  let s = Math.max(0, Math.round((t.getTime() - nowTs) / 1000))
  if (s < 60) return `in ${s} s`
  const m = Math.floor(s / 60)
  s %= 60
  const h = Math.floor(m / 60)
  const rm = m % 60
  const d = Math.floor(h / 24)
  const rh = h % 24
  const parts: string[] = []
  if (d) parts.push(`${d} d`)
  if (rh) parts.push(`${rh} h`)
  if (!d && rm) parts.push(`${rm} m`)
  if (!parts.length) parts.push(`${s} s`)
  return `in ${parts.slice(0, 2).join(' ')}`
}

export function CronTool() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<Mode>('auto')
  const [count, setCount] = useState<5 | 10 | 20>(10)
  const [copied, setCopied] = useState(false)
  const clock = useDeviceClock()
  const now = clock.now > 0 ? clock.now : null

  const parsed = useMemo(() => parseCron(input, mode), [input, mode])
  const engine = useMemo(() => (parsed.ok ? buildEngine(parsed) : null), [parsed])
  const description = useMemo(() => (parsed.ok ? describeCron(parsed) : null), [parsed])
  const runs = useMemo(
    () => (engine && now !== null ? nextFireTimes(engine, new Date(now), count) : null),
    [engine, now, count],
  )
  const loads = useMemo(
    () => (engine && now !== null ? loadEstimate(engine, new Date(now)) : null),
    [engine, now],
  )

  const fieldErrors = parsed.fields.filter((f) => f.error).map((f) => f.error as string)
  const hasErrors = !parsed.empty && (parsed.globalErrors.length > 0 || fieldErrors.length > 0)
  const bothRestricted =
    parsed.ok &&
    parsed.fields.some((f) => f.kind === 'dom' && !f.wildcard) &&
    parsed.fields.some((f) => f.kind === 'dow' && !f.wildcard)

  function copyExpr() {
    void navigator.clipboard?.writeText(input.trim()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <div>
      {/* ------------------------------------------------ the input, first */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="cron-input">Cron expression</Label>
          {input.trim() && (
            <Button size="sm" variant="ghost" className="min-h-11" onClick={copyExpr}>
              {copied ? (
                <Check className="size-3.5 text-primary" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              Copy
            </Button>
          )}
        </div>
        <Input
          id="cron-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="*/5 * * * *   — or 0 9 * * MON-FRI, 0 0 13 * FRI, */30 * * * * ?"
          className="mt-2 h-11 font-mono text-sm"
          spellCheck={false}
          autoComplete="off"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SelectTrigger
              id="cron-mode"
              aria-label="How to read the fields"
              className="h-11 w-[300px] max-w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect 5 or 6 fields</SelectItem>
              <SelectItem value="five">Force 5-field (standard crontab)</SelectItem>
              <SelectItem value="six">Force 6-field (seconds first)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Parsed as you type. Names, ranges, steps and lists all work.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------- presets */}
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Preset expressions">
        {PRESETS.map((p) => (
          <Button
            key={p.expr}
            variant="outline"
            size="sm"
            className="min-h-11"
            aria-pressed={input.trim() === p.expr}
            onClick={() => setInput(p.expr)}
          >
            {p.label}
            {p.note ? <span className="text-xs text-muted-foreground">· {p.note}</span> : null}
          </Button>
        ))}
      </div>

      {/* ------------------------------------------------- honest errors */}
      {hasErrors && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <p className="font-semibold">This expression cannot be parsed as written</p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed">
            {[...parsed.globalErrors, ...fieldErrors].map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {parsed.empty && (
        <div className="mt-4 rounded-xl border border-dashed px-4 py-8 text-center">
          <Clock className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
            Type a cron expression or tap a preset. The plain-English reading, the field-by-field
            breakdown and the next fire times appear at once — computed entirely on this device.
          </p>
        </div>
      )}

      {/* ---------------------------------------------- the parsed result */}
      {parsed.ok && (
        <>
          {parsed.notes.length > 0 && (
            <p role="note" className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
              {parsed.notes.join(' ')}
            </p>
          )}

          {description && (
            <div className="mt-4 rounded-xl border bg-card p-4">
              <p role="status" className="text-pretty text-base font-medium leading-relaxed">
                {description}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                This sentence is the tool&rsquo;s reading of the pattern — the next-runs grid below is
                the ground truth, computed from the exact expanded value sets.
              </p>
            </div>
          )}

          {bothRestricted && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-200">
                <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                The classic cron gotcha applies here
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800/90 dark:text-amber-200/90">
                Day-of-month and day-of-week are both restricted, so a day fires when EITHER matches —
                not both. 0 0 13 * FRI fires on the 13th of every month and on every Friday; cron
                cannot say &ldquo;both at once&rdquo; in one line. If one day field were *, the other
                would act as the only restriction.
              </p>
            </div>
          )}

          {/* -------------------------------------- field-by-field chips */}
          <section className="mt-5" aria-label="Parsed fields">
            <h3 className="text-sm font-semibold">Field by field</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {parsed.fields.map((f) => (
                <div key={f.kind} className="rounded-lg border bg-card p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">{FIELD_META[f.kind].name}</p>
                    <code className="font-mono text-xs text-muted-foreground">{f.raw}</code>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {f.kind} = {f.spanText}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {f.wildcard ? (
                      <span className="rounded-full border bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                        any value
                      </span>
                    ) : (
                      f.values.slice(0, 10).map((v) => (
                        <span
                          key={v}
                          className="rounded-full border bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary"
                        >
                          {f.kind === 'month' ? MONTHS[v - 1] : f.kind === 'dow' ? DOWS[v] : v}
                        </span>
                      ))
                    )}
                    {!f.wildcard && f.values.length > 10 && (
                      <span className="self-center text-xs text-muted-foreground">
                        +{f.values.length - 10} more
                      </span>
                    )}
                  </div>
                  {f.quartzQ && (
                    <p className="mt-2 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
                      <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                      ? reads as * — Quartz-only syntax; Vixie cron would reject it.
                    </p>
                  )}
                  {f.hasSeven && (
                    <p className="mt-1.5 text-xs text-muted-foreground">0 and 7 both mean Sunday.</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* --------------------------------------------------- next runs */}
          <section className="mt-6" aria-label="Next fire times">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Next fire times</h3>
              <div className="flex items-center gap-2">
                <div role="group" aria-label="How many runs to show" className="flex gap-1">
                  {([5, 10, 20] as const).map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      variant={count === n ? 'default' : 'outline'}
                      className="min-h-11 min-w-11 px-3"
                      aria-pressed={count === n}
                      onClick={() => setCount(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="min-h-11" onClick={refreshClock}>
                  <RefreshCw className="size-3.5" aria-hidden="true" /> From now
                </Button>
              </div>
            </div>
            {clock.tz ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Local time — {clock.tz} · device clock ·{' '}
                <span className="font-mono">{new Date(clock.now).toLocaleTimeString()}</span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Local time · device clock ·{' '}
                <span className="font-mono">{new Date(clock.now).toLocaleTimeString()}</span>
              </p>
            )}

            {runs && runs.length > 0 && (
              <ol className="mt-2 max-h-96 space-y-1 overflow-y-auto pr-1" aria-live="polite">
                {runs.map((t) => (
                  <li
                    key={t.getTime()}
                    className="flex flex-col gap-0.5 rounded-lg border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-mono text-sm">{fmtDateTime(t, engine?.sixField ?? false)}</span>
                    <span className="text-xs text-muted-foreground sm:text-right">
                      {relativeFrom(t, clock.now)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {runs && runs.length === 0 && (
              <p className="mt-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
                No fire time found within the next 366 days. The usual causes: a day-of-month that
                some months lack (31 never meets February), or month and day fields that never
                overlap. The field chips above show the exact sets that would have to line up.
              </p>
            )}
            {runs && runs.length > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                The schedule is in local wall-clock time, so on daylight-saving nights real-world
                intervals shift with the clock: an hour that does not exist resolves to the next real
                instant, and a repeated hour shows its first occurrence. Searched up to 366 days
                ahead from your device clock.
              </p>
            )}
          </section>

          {/* ------------------------------------------------ load estimate */}
          {loads && (
            <section className="mt-6" aria-label="Simulated load">
              <h3 className="text-sm font-semibold">How often it fires — simulation</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Per day — {loads.dayLabel}</p>
                  <p className="mt-1 font-mono text-lg font-semibold">
                    {loads.capped ? '≥' : ''}
                    {loads.dayCount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Per week — {loads.weekLabel}</p>
                  <p className="mt-1 font-mono text-lg font-semibold">
                    {loads.capped ? '≥' : ''}
                    {loads.weekCount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Per month — {loads.monthLabel}</p>
                  <p className="mt-1 font-mono text-lg font-semibold">
                    {loads.capped ? '≥' : ''}
                    {loads.monthCount.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                A simulation, not a promise: counted by walking a representative day, week and month
                ({loads.monthLabel} for the month) on this device. Other months differ when weekdays
                shift or months run short.
              </p>
            </section>
          )}
        </>
      )}

      <PrivacyStrip detail="Parsing, the plain-English reading and every next-run calculation happen in this browser tab with a hand-written parser — no cron library, no session, no network request carries the expression anywhere." />
    </div>
  )
}
