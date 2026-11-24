'use client'

// Time Zone Studio — convert, world clock, meeting planner. All zone data
// comes from the browser's own Intl (IANA) database; every conversion is
// computed locally from the OS zone tables. Nothing is fetched or stored.

import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Mode = 'convert' | 'clock' | 'planner'

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'convert', label: 'Convert' },
  { id: 'clock', label: 'World clock' },
  { id: 'planner', label: 'Meeting planner' },
]

const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

function zoneList(): string[] {
  const anyIntl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  try {
    const list = anyIntl.supportedValuesOf?.('timeZone')
    if (list?.length) return list
  } catch {
    /* older engine — fall through */
  }
  return ['UTC', localZone()]
}

/** Offset of `zone` at instant `date`, in minutes east of UTC. */
function zoneOffsetMinutes(zone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
  let hour = get('hour')
  if (hour === 24) hour = 0 // some engines emit 24 at midnight
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'))
  return Math.round((asUTC - date.getTime()) / 60000)
}

function offsetLabel(mins: number): string {
  const sign = mins < 0 ? '−' : '+'
  const abs = Math.abs(mins)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}

/** Wall-clock fields of an instant in a zone. */
function wallClock(zone: string, date: Date) {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
  const parts = dtf.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return {
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
    weekday: get('weekday'),
    day: get('day'),
    month: get('month'),
    year: get('year'),
  }
}

/** Build the instant whose wall clock in `zone` is y/m/d at hour:00. */
function instantAtZoneHour(zone: string, y: number, mo: number, d: number, hour: number): Date {
  const guess = Date.UTC(y, mo - 1, d, hour)
  let off = zoneOffsetMinutes(zone, new Date(guess))
  let instant = new Date(guess - off * 60000)
  off = zoneOffsetMinutes(zone, instant)
  instant = new Date(guess - off * 60000)
  return instant
}

/** Short city label from an IANA zone ("Asia/Kolkata" → "Kolkata"). */
function city(zone: string): string {
  return zone.split('/').pop()!.replace(/_/g, ' ')
}

const DEFAULT_TARGETS = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo']

export function TimeZoneTool() {
  const [mode, setMode] = useState<Mode>('convert')
  const zones = useMemo(zoneList, [])
  const [sourceZone, setSourceZone] = useState(localZone)
  const [when, setWhen] = useState(() => {
    const now = new Date()
    now.setSeconds(0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
  })
  const [targets, setTargets] = useState<string[]>(() =>
    DEFAULT_TARGETS.filter((z) => z !== localZone()),
  )
  const [addZone, setAddZone] = useState('')
  const [clockZones, setClockZones] = useState<string[]>(() => [localZone(), 'America/New_York', 'Europe/London', 'Asia/Tokyo'])
  const [tick, setTick] = useState(() => new Date())
  const [plannerZones, setPlannerZones] = useState<string[]>(() => {
    const local = localZone()
    return [local, 'America/New_York', 'Asia/Kolkata'].filter((z, i, a) => a.indexOf(z) === i)
  })
  const [workStart, setWorkStart] = useState(9)
  const [workEnd, setWorkEnd] = useState(18)

  // live tick for the world clock
  useEffect(() => {
    if (mode !== 'clock') return
    const t = setInterval(() => setTick(new Date()), 1000)
    return () => clearInterval(t)
  }, [mode])

  const parseWhen = () => {
    const m = when.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
    if (!m) return null
    const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[]
    return { y: m[1] ? Number(m[1]) : 1970, mo: m[2] ? Number(m[2]) : 1, d: m[3] ? Number(m[3]) : 1, h: m[4] ? Number(m[4]) : 0, mi: m[5] ? Number(m[5]) : 0 }
  }

  /** Convert rows: interpret `when` as wall time in sourceZone. */
  const convertRows = useMemo(() => {
    const p = parseWhen()
    if (!p) return []
    const guessUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi)
    const srcOff = zoneOffsetMinutes(sourceZone, new Date(guessUTC))
    const instant = new Date(guessUTC - srcOff * 60000)
    const srcWall = wallClock(sourceZone, instant)
    return targets.map((zone) => {
      const off = zoneOffsetMinutes(zone, instant)
      const w = wallClock(zone, instant)
      // day shift between source and target wall dates
      const srcKey = `${srcWall.year}-${srcWall.month}-${srcWall.day}`
      const dstKey = `${w.year}-${w.month}-${w.day}`
      let shift: 'same day' | 'next day' | 'previous day' = 'same day'
      if (srcKey !== dstKey) {
        const srcTime = Date.UTC(Number(srcWall.year), ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(srcWall.month), Number(srcWall.day))
        const dstTime = Date.UTC(Number(w.year), ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(w.month), Number(w.day))
        shift = dstTime > srcTime ? 'next day' : 'previous day'
      }
      return { zone, wall: w, off, shift, diffMins: off - srcOff }
    })
  }, [when, sourceZone, targets])

  const addToList = (list: string[], setter: (v: string[]) => void, cap: number) => {
    if (!addZone || list.includes(addZone) || list.length >= cap) return
    setter([...list, addZone])
    setAddZone('')
  }
  const removeAt = (list: string[], setter: (v: string[]) => void, idx: number) =>
    setter(list.filter((_, i) => i !== idx))

  const zoneSelect = (id: string, value: string, onChange: (v: string) => void) => (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
    >
      {zones.map((z) => (
        <option key={z} value={z}>{z}</option>
      ))}
    </select>
  )

  /** Meeting planner cells: for each source-zone hour of today, the hour in each planner zone. */
  const planner = useMemo(() => {
    const now = tick
    const src = wallClock(sourceZone, now)
    const y = Number(src.year)
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(src.month) + 1
    const d = Number(src.day)
    const rows = plannerZones.map((zone) => {
      const off = zoneOffsetMinutes(zone, now)
      const cells = Array.from({ length: 24 }, (_, h) => {
        const instant = instantAtZoneHour(sourceZone, y, mo, d, h)
        const w = wallClock(zone, instant)
        const hourInZone = Number(w.time.slice(0, 2))
        const isWork = hourInZone >= workStart && hourInZone < workEnd
        const isAwake = hourInZone >= 7 && hourInZone < 23
        return { hourInZone, cls: isWork ? 'work' : isAwake ? 'awake' : 'sleep', dateKey: `${w.year}-${w.month}-${w.day}` }
      })
      return { zone, off, cells }
    })
    // best windows: hours where every zone is within working hours
    const good: number[] = []
    for (let h = 0; h < 24; h++) {
      if (rows.every((r) => r.cells[h].cls === 'work')) good.push(h)
    }
    // contiguous runs of good hours → "14:00–17:00"
    const windows: string[] = []
    let start: number | null = null
    for (let h = 0; h <= 24; h++) {
      if (h < 24 && good.includes(h)) {
        if (start === null) start = h
      } else if (start !== null) {
        windows.push(`${String(start).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:00`)
        start = null
      }
    }
    const nowHour = Number(wallClock(sourceZone, now).time.slice(0, 2))
    return { rows, windows, nowHour, sourceDayKey: `${y}-${mo}-${d}` }
  }, [plannerZones, sourceZone, workStart, workEnd, mode])

  const cellColor = (cls: string) =>
    cls === 'work' ? 'bg-emerald-600/80 text-white' : cls === 'awake' ? 'bg-amber-500/50 text-foreground' : 'bg-muted text-muted-foreground/60'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Time zone mode">
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

        {/* ------------------------------------------------------ convert */}
        {mode === 'convert' && (
          <div className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tz-source">From zone</Label>
                {zoneSelect('tz-source', sourceZone, setSourceZone)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tz-when">Date &amp; time (in that zone)</Label>
                <input
                  id="tz-when"
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm font-mono"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Label htmlFor="tz-add" className="sr-only">Add target zone</Label>
              <select
                id="tz-add"
                value={addZone}
                onChange={(e) => setAddZone(e.target.value)}
                className="h-9 max-w-64 flex-1 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Add a city or zone…</option>
                {zones.filter((z) => !targets.includes(z)).map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={() => addToList(targets, setTargets, 12)} disabled={!addZone}>
                <Plus className="size-4" aria-hidden="true" /> Add
              </Button>
              {targets.map((z, i) => (
                <span key={z} className="flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                  {city(z)}
                  <button type="button" aria-label={`Remove ${z}`} onClick={() => removeAt(targets, setTargets, i)}>
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>

            {convertRows.length > 0 && parseWhen() && (
              <div className="mt-4 overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Zone</th>
                      <th className="px-3 py-2 font-medium">Time there</th>
                      <th className="px-3 py-2 font-medium">Offset</th>
                      <th className="px-3 py-2 font-medium">Difference</th>
                      <th className="px-3 py-2 font-medium">Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convertRows.map((r) => (
                      <tr key={r.zone} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <span className="font-medium">{city(r.zone)}</span>
                          <span className="ml-1.5 text-xs text-muted-foreground">{r.zone}</span>
                        </td>
                        <td className="px-3 py-2 font-mono">{r.wall.time}</td>
                        <td className="px-3 py-2 font-mono text-xs">{offsetLabel(r.off)}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.diffMins === 0 ? 'same' : `${r.diffMins > 0 ? '+' : '−'}${Math.floor(Math.abs(r.diffMins) / 60)}h${Math.abs(r.diffMins) % 60 ? `${Math.abs(r.diffMins) % 60}m` : ''}`}
                        </td>
                        <td className="px-3 py-2">
                          {r.shift !== 'same day' ? (
                            <span className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              r.shift === 'next day' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground',
                            )}>
                              {r.shift}, {r.wall.weekday} {r.wall.day} {r.wall.month}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">same day</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------- world clock */}
        {mode === 'clock' && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="tz-clock-add" className="sr-only">Add clock zone</Label>
              <select
                id="tz-clock-add"
                value={addZone}
                onChange={(e) => setAddZone(e.target.value)}
                className="h-9 max-w-64 flex-1 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Add a city or zone…</option>
                {zones.filter((z) => !clockZones.includes(z)).map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={() => addToList(clockZones, setClockZones, 12)} disabled={!addZone}>
                <Plus className="size-4" aria-hidden="true" /> Add
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clockZones.map((z, i) => {
                const w = wallClock(z, tick)
                const off = zoneOffsetMinutes(z, tick)
                const localOff = zoneOffsetMinutes(localZone(), tick)
                const diff = off - localOff
                return (
                  <div key={z} className="relative rounded-lg border bg-background p-4">
                    <button
                      type="button"
                      aria-label={`Remove ${z}`}
                      onClick={() => removeAt(clockZones, setClockZones, i)}
                      className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                    <p className="text-sm font-medium">{city(z)}</p>
                    <p className="text-xs text-muted-foreground">{z}</p>
                    <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{w.time}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {w.weekday} {w.day} {w.month} · {offsetLabel(off)}
                      {diff !== 0 && ` · ${diff > 0 ? '+' : '−'}${Math.abs(diff) / 60 % 1 === 0 ? Math.abs(diff) / 60 : Math.abs(diff) / 60}h vs you`}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ----------------------------------------------- meeting planner */}
        {mode === 'planner' && (
          <div className="mt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {plannerZones.map((z, i) => (
                <div key={z} className="relative">
                  <Label htmlFor={`tz-pz-${i}`} className="text-xs text-muted-foreground">Zone {i + 1}</Label>
                  <div className="mt-1.5" id={`tz-pz-${i}`}>
                    {zoneSelect(`tz-pz-${i}`, z, (v) => setPlannerZones((zs) => zs.map((zz, zi) => (zi === i ? v : zz))))}
                  </div>
                  {plannerZones.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove zone ${i + 1}`}
                      onClick={() => removeAt(plannerZones, setPlannerZones, i)}
                      className="absolute right-2 top-8 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="w-28 space-y-1.5">
                <Label htmlFor="tz-ws" className="text-xs text-muted-foreground">Work starts</Label>
                <input
                  id="tz-ws" type="number" min={0} max={23} value={workStart}
                  onChange={(e) => setWorkStart(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
                  className="h-9 w-full rounded-md border bg-background px-3 font-mono text-sm"
                />
              </div>
              <div className="w-28 space-y-1.5">
                <Label htmlFor="tz-we" className="text-xs text-muted-foreground">Work ends</Label>
                <input
                  id="tz-we" type="number" min={0} max={24} value={workEnd}
                  onChange={(e) => setWorkEnd(Math.min(24, Math.max(0, Number(e.target.value) || 0)))}
                  className="h-9 w-full rounded-md border bg-background px-3 font-mono text-sm"
                />
              </div>
              <p className="pb-2 text-xs text-muted-foreground">
                Hours read left to right in <span className="font-medium">{city(sourceZone)}</span> time (today). Green = inside working hours, amber = awake, grey = asleep.
              </p>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[720px] border-collapse text-xs">
                <tbody>
                  {planner.rows.map((row) => (
                    <tr key={row.zone}>
                      <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-card px-2.5 py-1.5 text-left font-medium">
                        {city(row.zone)}
                        <span className="ml-1.5 font-mono text-[10px] font-normal text-muted-foreground">{offsetLabel(row.off)}</span>
                      </th>
                      {row.cells.map((c, h) => (
                        <td key={h} className="p-0">
                          <div
                            className={cn('flex h-8 min-w-[26px] items-center justify-center text-[10px] font-mono', cellColor(c.cls))}
                            title={`${city(row.zone)} ${String(c.hourInZone).padStart(2, '0')}:00`}
                          >
                            {c.hourInZone}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="sticky left-0 z-10 bg-card px-2.5 py-1 text-left text-[10px] font-normal text-muted-foreground">Hour in {city(sourceZone)}</th>
                    {Array.from({ length: 24 }, (_, h) => (
                      <td key={h} className="p-0 text-center text-[10px] font-mono text-muted-foreground">
                        <span className={cn('inline-block h-5 w-full leading-5', h === planner.nowHour && 'rounded-full bg-primary font-semibold text-primary-foreground')}>{h}</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
              {planner.windows.length > 0 ? (
                <p>
                  <span className="font-medium">Everyone is at work during</span>{' '}
                  <span className="font-mono">{planner.windows.join(',  ')}</span>{' '}
                  <span className="text-muted-foreground">({city(sourceZone)} time) — schedule the call there.</span>
                </p>
              ) : (
                <p>
                  <span className="font-medium">No hour sits inside working hours for all zones.</span>{' '}
                  <span className="text-muted-foreground">Widen the working hours, accept some amber, or rotate the pain — the strip shows who pays for it.</span>
                </p>
              )}
            </div>
          </div>
        )}

        <PrivacyStrip detail="Zone data comes from the browser's own Intl database — the same IANA tables your operating system ships — and every conversion is computed on this device. Nothing is fetched from a server and nothing is stored." />
      </div>
    </div>
  )
}
