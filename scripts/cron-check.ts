// Temp QA harness for the /cron tool: parser shapes, shortcut expansion,
// Vixie dom/dow OR semantics, and next-run correctness against known dates.
import { parseCron, nextRuns } from '../src/components/instant/cron-tool'
import type { ParsedCron } from '../src/components/instant/cron-tool'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean, detail = '') {
  if (cond) pass++
  else {
    fail++
    console.log(`FAIL ${name} ${detail}`)
  }
}

function fields(p: ParsedCron): number[][] {
  return p.fields.map((f) => f.set)
}

// 1. simple daily
let r = parseCron('30 9 * * *')
ok('daily-30-9 parses', !!r.parsed && !r.error, r.error ?? '')

// 2. step
r = parseCron('*/15 * * * *')
ok('step15', r.parsed && JSON.stringify(fields(r.parsed)[0]) === '[0,15,30,45]')

// 3. range with step + list
r = parseCron('0,30 9-17/2 * * *')
ok('range-step hours', r.parsed && JSON.stringify(fields(r.parsed)[1]) === '[9,11,13,15,17]')
ok('list minutes', r.parsed && JSON.stringify(fields(r.parsed)[0]) === '[0,30]')

// 4. month names + day names
r = parseCron('0 0 1 jan,mar mon')
ok('month names', r.parsed && JSON.stringify(fields(r.parsed)[3]) === '[1,3]')
ok('dow names', r.parsed && JSON.stringify(fields(r.parsed)[4]) === '[1]')

// 5. dow 7 = sunday
r = parseCron('0 0 * * 7')
ok('dow 7 = 0', r.parsed && JSON.stringify(fields(r.parsed)[4]) === '[0]')

// 6. shortcuts
r = parseCron('@yearly')
ok('yearly expands', r.parsed && r.shortcut === '@yearly' && fields(r.parsed)[2].join() === '1' && fields(r.parsed)[3].join() === '1')
r = parseCron('@hourly')
ok('hourly expands', r.parsed && fields(r.parsed)[0].join() === '0' && fields(r.parsed)[1].length === 24)

// 7. @reboot honest
r = parseCron('@reboot')
ok('reboot no schedule', r.parsed === null && (r.error ?? '').includes('no wall-clock schedule'))

// 8. errors
r = parseCron('* * * *')
ok('too few fields', r.parsed === null && (r.error ?? '').includes('5 fields'))
r = parseCron('60 * * * *')
ok('minute range', r.parsed === null && (r.error ?? '').includes('outside'))
r = parseCron('* * * * xyz')
ok('bad dow name', r.parsed === null)
r = parseCron('5-1 * * * *')
ok('descending range', r.parsed === null && (r.error ?? '').includes('descending'))

// 9. Vixie OR semantics: "0 0 31 * 1" fires on the 31st OR Mondays
{
  const p = parseCron('0 0 31 * 1').parsed!
  const from = new Date(2026, 0, 1, 0, 0, 0)
  const runs: Date[] = []
  const cursor = new Date(from)
  for (let i = 0; i < 1200 && runs.length < 12; i++) {
    const dom = cursor.getDate()
    const dow = cursor.getDay()
    if ((dom === 31 || dow === 1) && cursor > from) runs.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  const got = nextRuns(p, from, 12)
  const both = runs.map((d) => d.toDateString()).join('|') === got.map((d) => d.toDateString()).join('|')
  ok('vixie OR semantics', both, `\nwant ${runs.map((d) => d.toDateString())}\ngot  ${got.map((d) => d.toDateString())}`)
}

// 10. AND semantics: "0 0 1 * *" = 1st of every month at midnight
{
  const p = parseCron('0 0 1 * *').parsed!
  const got = nextRuns(p, new Date(2026, 0, 2, 0, 0, 0), 3)
  ok(
    'monthly 1st AND',
    got.length === 3 && got.every((d) => d.getDate() === 1 && d.getHours() === 0 && d.getMinutes() === 0),
    got.map((d) => d.toDateString()).join('|'),
  )
}

// 11. next runs strictly increasing and after "from"
{
  const p = parseCron('*/10 * * * *').parsed!
  const from = new Date(2026, 5, 15, 12, 7, 30)
  const got = nextRuns(p, from, 5)
  ok(
    'step10 count+order',
    got.length === 5 &&
      got.every((d, i) => i === 0 || d > got[i - 1]) &&
      got.every((d) => d > from) &&
      got[0].getMinutes() === 10 &&
      got[0].getHours() === 12,
    got.map((d) => d.toISOString()).join('|'),
  )
}

// 12. Feb 29 leap-year only: "0 0 29 2 *" — 2032 sits beyond the 4-year horizon
{
  const p = parseCron('0 0 29 2 *').parsed!
  const got = nextRuns(p, new Date(2026, 0, 1, 0, 0), 2)
  ok(
    'feb29 leap years',
    got.length === 1 && got[0].getFullYear() === 2028,
    got.map((d) => d.toDateString()).join('|'),
  )
}

// 13. Sunday via names "0 12 * * sun"
{
  const p = parseCron('0 12 * * sun').parsed!
  const got = nextRuns(p, new Date(2026, 10, 20, 0, 0, 0), 2) // Fri Nov 20 2026
  ok(
    'sunday noon runs',
    got.length === 2 && got.every((d) => d.getDay() === 0 && d.getHours() === 12),
    got.map((d) => d.toDateString()).join('|'),
  )
}

console.log(`${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
