'use client'

// Event → calendar links + .ics, computed live as the form is filled in.
//
// Timezone strategy, chosen deliberately:
//  • Google / Yahoo links carry the exact UTC instant, converted from the
//    wall-clock times typed here using this device's zone (getUTC* on a
//    locally-constructed Date).
//  • Outlook's deeplink gets full ISO-8601 timestamps (which are UTC-based).
//  • The .ics file writes RFC 5545 "floating" local times (no trailing Z, no
//    TZID) so the file always lands at the clock times typed here regardless
//    of where it is imported — the web links above carry the exact instant.
//
// All-day events use DATE values with an EXCLUSIVE end day (+1) everywhere:
// Google's dates=<start>/<end> spec, Outlook's allday=true with YYYY-MM-DD,
// and DTEND;VALUE=DATE in the .ics. Yahoo has no valid dur=allday keyword —
// the reliable shape there is st=<start day>&et=<day after end>&dur= (empty).

import { useMemo, useState } from 'react'
import { CalendarPlus, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { downloadBlob, PrivacyStrip } from '@/components/instant/instant-kit'

const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Parse a datetime-local value ("2026-03-01T10:00" or "…T10:00:30") into a
 *  Date at that wall-clock time in the local zone. Manual parse — safer than
 *  new Date(string) across engines. DST edges (a spring-forward gap) resolve
 *  to the nearest valid instant on the same calendar day. */
function parseLocalDateTime(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const h = Number(m[4])
  const mi = Number(m[5])
  // Seconds are optional — an absent group must mean 0, never NaN.
  const s = m[6] ? Number(m[6]) : 0
  const date = new Date(y, mo - 1, d, h, mi, s)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

/** Parse "YYYY-MM-DD" into a UTC-midnight "floating" date, rejecting dates
 *  that do not exist (Date.UTC would roll 2026-02-30 into March). */
function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const [y, mo, d] = m.slice(1).map((part) => Number(part))
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null
  return date
}

/** UTC instant in basic format, e.g. "20260301T100000Z". */
function formatUtcBasic(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  )
}

/** Local wall-clock time in basic format WITHOUT zone — RFC 5545 floating
 *  time, e.g. "20260301T100000". */
function formatFloatingBasic(date: Date): string {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
  )
}

/** UTC-midnight date in basic format, e.g. "20260301" (all-day values). */
function formatDateBasic(date: Date): string {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`
}

/** UTC-midnight date in extended format, e.g. "2026-03-01" (Outlook all-day). */
function formatIsoDay(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

// Google and Yahoo expect spaces as "+" in query text params, while
// encodeURIComponent emits "%20" — hence the swap for those two targets
// only. Outlook gets plain encodeURIComponent (it expects %20).
const enc = encodeURIComponent
const encPlus = (value: string) => enc(value).replace(/%20/g, '+')

/** RFC 5545 §3.3.11 TEXT escaping: backslash first, then ; , and newlines. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

const encoder = new TextEncoder()

/** RFC 5545 §3.1 line folding: content lines are limited to 75 octets, and
 *  continuation lines start with a single space that counts toward their 75.
 *  Folding is measured in UTF-8 OCTETS, not characters — hence TextEncoder. */
function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let currentBytes = 0
  const limit = () => (parts.length === 0 ? 75 : 74)
  for (const ch of line) {
    const chBytes = encoder.encode(ch).length
    if (currentBytes + chBytes > limit()) {
      parts.push(current)
      current = ''
      currentBytes = 0
    }
    current += ch
    currentBytes += chBytes
  }
  if (current) parts.push(current)
  return parts.join('\r\n ')
}

/** Deterministic FNV-1a hash — the same event fields always produce the same
 *  UID, so re-downloading the file replaces the event instead of duplicating
 *  it. */
function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'event'
}

type Resolved =
  | { ok: true; notes: string[]; start: Date; end: Date; endPlusOne: Date }
  | { ok: false; reason: string }

interface Built {
  google: string
  outlook: string
  yahoo: string
  ics: string
  filename: string
}

export function CalendarLinkTool() {
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [allDay, setAllDay] = useState(false)

  // Swapping input semantics: a datetime-local value is invalid in a
  // type="date" input, so going all-day keeps just the date part; coming
  // back, a bare date gets a 09:00 start so there is a time to edit.
  function toggleAllDay(next: boolean) {
    setAllDay(next)
    if (next) {
      setStart((s) => (s.includes('T') ? s.slice(0, 10) : s))
      setEnd((s) => (s.includes('T') ? s.slice(0, 10) : s))
    } else {
      setStart((s) => (s !== '' && !s.includes('T') ? `${s}T09:00` : s))
      setEnd((s) => (s !== '' && !s.includes('T') ? `${s}T10:00` : s))
    }
  }

  const resolved = useMemo<Resolved | null>(() => {
    if (title.trim() === '' || start.trim() === '') return null
    const notes: string[] = []
    if (allDay) {
      let s = parseDateOnly(start.slice(0, 10))
      if (!s) return { ok: false, reason: 'The start date is not a complete date yet.' }
      let e = end.trim() === '' ? null : parseDateOnly(end.slice(0, 10))
      if (end.trim() !== '' && !e) return { ok: false, reason: 'The end date is not a complete date yet.' }
      if (!e) {
        e = s
        notes.push('No end date given — a single-day event is assumed.')
      } else if (e.getTime() < s.getTime()) {
        const first = s
        s = e
        e = first
        notes.push('The end date was before the start — the two were swapped so the event has positive length.')
      }
      // All-day ends are EXCLUSIVE: the day after the last event day.
      return { ok: true, notes, start: s, end: e, endPlusOne: new Date(e.getTime() + MS_PER_DAY) }
    }
    let s = parseLocalDateTime(start)
    if (!s) return { ok: false, reason: 'The start time is incomplete — pick both date and time.' }
    let e = end.trim() === '' ? null : parseLocalDateTime(end)
    if (end.trim() !== '' && !e) return { ok: false, reason: 'The end time is incomplete — pick both date and time.' }
    if (!e) {
      e = new Date(s.getTime() + MS_PER_HOUR)
      notes.push('No end time given — a one-hour event is assumed.')
    } else if (e.getTime() < s.getTime()) {
      const first = s
      s = e
      e = first
      notes.push('The end time was earlier than the start — the two were swapped so the event has positive length.')
    } else if (e.getTime() === s.getTime()) {
      notes.push('Start and end are identical — this generates a zero-length event.')
    }
    return { ok: true, notes, start: s, end: e, endPlusOne: new Date(e.getTime() + MS_PER_DAY) }
  }, [title, start, end, allDay])

  const valid = resolved?.ok === true

  const built = useMemo<Built | null>(() => {
    if (!resolved || !resolved.ok) return null
    const { start: s, end: e, endPlusOne, notes: _notes } = resolved
    const t = title.trim()
    const loc = location.trim()
    const desc = description.trim()

    // --- Google ------------------------------------------------------------
    // Timed: UTC instants "YYYYMMDDTHHMMSSZ". All-day: plain dates with the
    // END DAY EXCLUSIVE (+1) per Google's TEMPLATE spec. Text params use
    // "+" for spaces (see encPlus).
    const googleDates = allDay
      ? `${formatDateBasic(s)}/${formatDateBasic(endPlusOne)}`
      : `${formatUtcBasic(s)}/${formatUtcBasic(e)}`
    const google =
      `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encPlus(t)}&dates=${enc(googleDates)}` +
      `&details=${encPlus(desc)}&location=${encPlus(loc)}`

    // --- Outlook.com ---------------------------------------------------------
    // Timed: full ISO-8601 timestamps. All-day: allday=true with YYYY-MM-DD
    // dates, end exclusive (+1).
    const outlook = allDay
      ? `https://outlook.live.com/calendar/0/deeplink/compose?subject=${enc(t)}` +
        `&startdt=${formatIsoDay(s)}&enddt=${formatIsoDay(endPlusOne)}&allday=true` +
        `&body=${enc(desc)}&location=${enc(loc)}`
      : `https://outlook.live.com/calendar/0/deeplink/compose?subject=${enc(t)}` +
        `&startdt=${enc(s.toISOString())}&enddt=${enc(e.toISOString())}` +
        `&body=${enc(desc)}&location=${enc(loc)}`

    // --- Yahoo -----------------------------------------------------------------
    // Yahoo does not honor dur=allday; for all-day events the reliable shape
    // is st=<start day>&et=<day AFTER the end, exclusive +1>&dur= (empty).
    // Timed events take UTC instants like Google's.
    const yahoo = allDay
      ? `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${encPlus(t)}` +
        `&st=${formatDateBasic(s)}&et=${formatDateBasic(endPlusOne)}&dur=` +
        `&desc=${encPlus(desc)}&in_loc=${encPlus(loc)}`
      : `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${encPlus(t)}` +
        `&st=${formatUtcBasic(s)}&et=${formatUtcBasic(e)}` +
        `&desc=${encPlus(desc)}&in_loc=${encPlus(loc)}`

    // --- .ics --------------------------------------------------------------------
    // Deterministic UID from title + start + kind, so re-downloads replace.
    const uid = `${fnv1a(`${t}|${start}|${allDay ? 'D' : 'T'}`)}-${allDay ? formatDateBasic(s) : formatFloatingBasic(s)}@kontivo.tools`
    // DTSTAMP is "now" in UTC at the moment this preview is computed; it is
    // recomputed whenever a field changes, which keeps it honest without
    // touching any browser global outside this computation.
    const dtstamp = formatUtcBasic(new Date())
    const dtstart = allDay ? `DTSTART;VALUE=DATE:${formatDateBasic(s)}` : `DTSTART:${formatFloatingBasic(s)}`
    // DTEND is EXCLUSIVE for all-day (day after the last day); timed events
    // get the exact end instant (floating local, like DTSTART).
    const dtend = allDay ? `DTEND;VALUE=DATE:${formatDateBasic(endPlusOne)}` : `DTEND:${formatFloatingBasic(e)}`
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Kontivo//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      dtstart,
      dtend,
      `SUMMARY:${escapeIcsText(t)}`,
      // Empty LOCATION/DESCRIPTION properties are pointless — omit them.
      loc !== '' ? `LOCATION:${escapeIcsText(loc)}` : null,
      desc !== '' ? `DESCRIPTION:${escapeIcsText(desc)}` : null,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter((line): line is string => line !== null)
    const ics = lines.map(foldLine).join('\r\n')

    return { google, outlook, yahoo, ics, filename: `${slugify(t)}.ics` }
  }, [resolved, title, start, location, description, allDay])

  function downloadIcs() {
    if (!built) return
    downloadBlob(new Blob([built.ics], { type: 'text/calendar;charset=utf-8' }), built.filename)
  }

  const inputType = allDay ? 'date' : 'datetime-local'

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="space-y-4">
            <div>
              <Label htmlFor="cl-title">Event title</Label>
              <Input
                id="cl-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Team review"
                className="mt-1.5"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch id="cl-allday" checked={allDay} onCheckedChange={toggleAllDay} aria-label="All-day event" />
              <Label htmlFor="cl-allday" className="text-sm font-normal">
                All-day event
              </Label>
              <span className="text-xs text-muted-foreground">switches the times to plain dates</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="cl-start">Starts</Label>
                <Input
                  id="cl-start"
                  type={inputType}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="cl-end">
                  Ends <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="cl-end"
                  type={inputType}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cl-loc">Location</Label>
              <Input
                id="cl-loc"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Room 4, or a video-call link"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="cl-desc">Description</Label>
              <Textarea
                id="cl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Agenda, notes, dial-in details…"
                className="mt-1.5 min-h-24"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarPlus className="size-4 text-muted-foreground" aria-hidden="true" />
            Add to your calendar
          </p>

          {!valid && (
            <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
              <p className="text-sm font-medium">Give the event a title and a start time</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Links and the .ics file appear here the moment both are set — no sample event is filled in for you.
              </p>
            </div>
          )}

          {valid && resolved.ok && (
            <>
              {resolved.notes.length > 0 && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
                  {resolved.notes.map((note) => (
                    <p key={note} className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                      {note}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" className="w-full justify-between">
                  <a href={built?.google ?? '#'} target="_blank" rel="noopener noreferrer">
                    Google Calendar
                    <span className="text-xs font-normal text-muted-foreground">calendar.google.com</span>
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full justify-between">
                  <a href={built?.outlook ?? '#'} target="_blank" rel="noopener noreferrer">
                    Outlook.com
                    <span className="text-xs font-normal text-muted-foreground">outlook.live.com</span>
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full justify-between">
                  <a href={built?.yahoo ?? '#'} target="_blank" rel="noopener noreferrer">
                    Yahoo Calendar
                    <span className="text-xs font-normal text-muted-foreground">calendar.yahoo.com</span>
                  </a>
                </Button>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Google and Yahoo links carry the exact UTC instant computed from this device&rsquo;s time zone;
                Outlook gets ISO timestamps. All-day events use exclusive end days per each service&rsquo;s spec.
              </p>
            </>
          )}
        </div>
      </div>

      {/* The .ics section always renders; the download stays disabled until
          title + start are set, and the preview fills in live after that. */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Event file (.ics)</p>
          <Button size="sm" disabled={!valid} onClick={downloadIcs}>
            <Download className="size-4" aria-hidden="true" />
            Download .ics
          </Button>
        </div>
        <pre
          data-testid="ics-preview"
          className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed"
        >
          {built?.ics ?? '# Give the event a title and a start time to see the RFC 5545 body here.'}
        </pre>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Times in the file are written as floating local times (no timezone) so the event lands at the clock
          times typed here; commas, semicolons and newlines are escaped and lines are folded at 75 octets per
          RFC&nbsp;5545. The UID is derived from the event fields, so re-downloads replace the event instead of
          duplicating it.
        </p>
      </div>

      <PrivacyStrip detail="The event details stay in this tab: links are assembled in page memory and the .ics is generated on click, nothing is sent anywhere." />
    </div>
  )
}
