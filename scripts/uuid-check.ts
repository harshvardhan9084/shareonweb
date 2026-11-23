// Temp QA harness for the /uuid tool: format conformance, round-trip decode,
// monotonic ordering, inspector accuracy. Deleted before commit.
import { uuidV4, uuidV7From, ulidFrom, makeMonotonicUlid, inspectUuid, inspectUlid, CROCKFORD } from '../src/components/instant/uuid-tool'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean, detail = '') {
  if (cond) pass++
  else {
    fail++
    console.log(`FAIL ${name} ${detail}`)
  }
}

// --- v4: 200 ids, all conform, all unique
{
  const ids = new Set<string>()
  let conform = true
  for (let i = 0; i < 200; i++) {
    const id = uuidV4()
    ids.add(id)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
      conform = false
      console.log('  bad v4:', id)
    }
  }
  ok('v4 format+variant', conform)
  ok('v4 unique', ids.size === 200)
}

// --- v7: timestamp encoded correctly, version nibble 7, decodes back
{
  const ms = 1763912400000 // 2025-11-23T15:00:00Z-ish
  const id = uuidV7From(ms)
  const hex = id.replace(/-/g, '')
  const encoded = parseInt(hex.slice(0, 12), 16)
  ok('v7 version nibble', hex[12] === '7', id)
  ok('v7 variant', /^[89ab]/.test(hex.slice(16, 17)))
  ok('v7 timestamp round-trip', encoded === ms, `${encoded} vs ${ms}`)
  const info = inspectUuid(id)
  ok('v7 inspect version', info.valid && info.version === 7 && (info.versionName ?? '').includes('v7'))
  ok('v7 inspect timestamp', (info.timestamp ?? '').startsWith(new Date(ms).toISOString().slice(0, 13)), info.timestamp)
}

// --- ULID: 26 chars, Crockford alphabet, timestamp round-trip
{
  const ms = 1763912400000
  const id = ulidFrom(ms)
  ok('ulid length+alphabet', /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/.test(id), id)
  const info = inspectUlid(id)
  ok('ulid inspect valid', info.valid, info.reason)
  ok('ulid timestamp round-trip', (info.timestamp ?? '') === new Date(ms).toISOString(), `${info.timestamp} vs ${new Date(ms).toISOString()}`)
  ok('ulid no ILIOU', !/[ILOU]/.test(id))
}

// --- ULID rejects non-alphabet chars
{
  const info = inspectUlid('01ARZ3NDEKTSV4RRFFQ69G5FAU') // ends with U
  ok('ulid rejects U', !info.valid && (info.reason ?? '').includes('not in the alphabet'))
}

// --- ULID wrong length
{
  const info = inspectUlid('01ARZ3NDEKTSV4RRFFQ69G5FA')
  ok('ulid rejects 25 chars', !info.valid && (info.reason ?? '').includes('26'))
}

// --- monotonic ULID: strictly increasing across 500 fast calls
{
  const gen = makeMonotonicUlid()
  let increasing = true
  let prev = ''
  for (let i = 0; i < 500; i++) {
    const id = gen()
    if (prev !== '' && !(id > prev)) {
      increasing = false
      console.log('  not increasing at', i, prev, '->', id)
    }
    prev = id
  }
  ok('ulid monotonic ordering', increasing)
}

// --- inspect: nil-ish, v4 detection, garbage
{
  const info = inspectUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479')
  ok('v4 inspect', info.valid && info.version === 4 && (info.versionName ?? '').includes('random'))
  const bad = inspectUuid('not-a-uuid')
  ok('uuid rejects garbage', !bad.valid)
  const v1 = inspectUuid('c232ab00-9414-1ec0-9800-1c5ec5218cd9') // RFC 4122 example doc? use synthetic
  ok('v1 inspect parses', v1.valid && v1.version === 1, JSON.stringify(v1))
}

// --- crockford lookalikes decode (I->1, L->1, O->0)
{
  const info = inspectUlid('01ARZ3NDEKTSV4RRFFQ69G5FAV'.replace('1', 'I'))
  ok('ulid accepts lookalike I', info.valid, info.reason)
  void CROCKFORD
}

console.log(`${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
