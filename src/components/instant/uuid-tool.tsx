'use client'

// ID Generator — the three identifiers modern systems actually exchange,
// generated in this tab from the browser's crypto-grade random source:
// UUID v4 (122 random bits, RFC 4122), UUID v7 (RFC 9562: a 48-bit Unix
// millisecond timestamp followed by 62 random bits, so IDs sort by creation
// time) and ULID (48-bit timestamp + 80 random bits in Crockford base32,
// with an optional monotonic mode that guarantees strictly increasing IDs
// within the same millisecond). The inspector decodes any of the three back
// into its parts — version, variant, embedded timestamp — instead of just
// checking a regex. There is no upload code on this page: IDs are generated
// and decoded locally, and a generated ID is never a secret but it still
// never leaves the device.

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { Check, Copy, Fingerprint, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PrivacyStrip } from '@/components/instant/instant-kit'

// --------------------------------------------------------------- primitives --

export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // no I, L, O, U
const CROCKFORD_DECODE: Record<string, number> = (() => {
  const m: Record<string, number> = {}
  // Crockford's decoder also accepts the ambiguous letters as their lookalikes
  CROCKFORD.split('').forEach((c, i) => {
    m[c] = i
    m[c.toLowerCase()] = i
  })
  m['I'] = m['i'] = 1
  m['L'] = m['l'] = 1
  m['O'] = m['o'] = 0
  return m
})()

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n)
  crypto.getRandomValues(b)
  return b
}

function bytesToUuid(b: Uint8Array): string {
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** UUID v4 per RFC 4122: 122 random bits shaped by version and variant. */
export function uuidV4(): string {
  const b = randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // variant 10xx
  return bytesToUuid(b)
}

/** UUID v7 per RFC 9562: 48-bit Unix ms + 62 random bits. */
export function uuidV7(): string {
  return uuidV7From(Date.now())
}

export function uuidV7From(ms: number): string {
  const b = randomBytes(16)
  // 48-bit big-endian unix millis
  const t = ms
  b[0] = Number((t / 2 ** 40) & 0xff)
  b[1] = Number((t / 2 ** 32) & 0xff)
  b[2] = Number((t / 2 ** 24) & 0xff)
  b[3] = Number((t / 2 ** 16) & 0xff)
  b[4] = Number((t / 2 ** 8) & 0xff)
  b[5] = Number(t & 0xff)
  b[6] = 0x70 | (b[6] & 0x0f) // version 7, low nibble stays random (rand_a)
  b[8] = (b[8] & 0x3f) | 0x80
  return bytesToUuid(b)
}

/** Crockford-base32 encode of a 48-bit timestamp -> 10 chars. */
function ulidTime(ms: number): string {
  let out = ''
  let t = ms
  for (let i = 0; i < 10; i++) {
    out = CROCKFORD[t % 32] + out
    t = Math.floor(t / 32)
  }
  return out
}

export function ulid(): string {
  return ulidFrom(Date.now())
}

export function ulidFrom(ms: number): string {
  const b = randomBytes(10) // 80 bits of randomness
  let acc = 0n
  for (const x of b) acc = (acc << 8n) | BigInt(x)
  let rand = ''
  for (let i = 0; i < 16; i++) {
    rand = CROCKFORD[Number(acc & 31n)] + rand
    acc >>= 5n
  }
  return ulidTime(ms) + rand
}

/** Monotonic generator: same-millisecond IDs increment, never repeat. */
export function makeMonotonicUlid() {
  let lastMs = -1
  let lastRandom = 0n // 80-bit
  return (): string => {
    const ms = Date.now()
    if (ms !== lastMs) {
      lastMs = ms
      lastRandom = BigInt('0x' + [...randomBytes(10)].map((x) => x.toString(16).padStart(2, '0')).join(''))
    } else {
      // increment within the same millisecond; a rollover is 2^80 — unreachable
      lastRandom = (lastRandom + 1n) & ((1n << 80n) - 1n)
    }
    let rand = ''
    let acc = lastRandom
    for (let i = 0; i < 16; i++) {
      rand = CROCKFORD[Number(acc & 31n)] + rand
      acc >>= 5n
    }
    return ulidTime(lastMs) + rand
  }
}

// ---------------------------------------------------------------- inspector --

export interface UuidInfo {
  kind: 'uuid'
  valid: boolean
  reason?: string
  version?: number
  versionName?: string
  variant?: string
  timestamp?: string
  fields?: Array<{ label: string; value: string }>
}

export function inspectUuid(text: string): UuidInfo {
  const t = text.trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(t) && !/^[0-9a-f]{32}$/.test(t)) {
    return { kind: 'uuid', valid: false, reason: 'Not a UUID — expected 32 hex digits, with or without hyphens.' }
  }
  const hex = t.replace(/-/g, '')
  const version = parseInt(hex[12], 16)
  const variantBits = parseInt(hex[16], 16) >> 2
  let variant = 'reserved'
  if (variantBits === 0 || variantBits === 1) variant = 'NCS (backward compat)'
  else if (variantBits === 2) variant = 'RFC 4122 / 9562 (Leach–Salz)'
  else variant = 'Microsoft COM'
  const names: Record<number, string> = {
    0: 'nil / custom',
    1: 'v1 — time-based (MAC + timestamp)',
    2: 'v2 — DCE security',
    3: 'v3 — MD5 name-based',
    4: 'v4 — random',
    5: 'v5 — SHA-1 name-based',
    6: 'v6 — reordered v1 (draft)',
    7: 'v7 — Unix-ms time-based (RFC 9562)',
    8: 'v8 — custom',
  }
  const info: UuidInfo = {
    kind: 'uuid',
    valid: true,
    version,
    versionName: names[version] ?? 'unknown version',
    variant,
    fields: [],
  }
  if (version === 1) {
    // 60-bit timestamp: time_low + time_mid + time_hi, 100-ns since 1582-10-15
    const tl = BigInt(parseInt(hex.slice(0, 8), 16))
    const tm = BigInt(parseInt(hex.slice(8, 12), 16))
    const th = BigInt(parseInt(hex.slice(12, 16), 16))
    const ts = (th << 48n) | (tm << 32n) | tl
    const ms = Number(ts / 10000n) - 12219292800000 // offset to Unix epoch
    info.timestamp = new Date(ms).toISOString()
    info.fields!.push({ label: 'Timestamp (100-ns units)', value: ts.toString() })
  }
  if (version === 7) {
    const ms = parseInt(hex.slice(0, 12), 16)
    info.timestamp = new Date(ms).toISOString()
    info.fields!.push({ label: 'Unix milliseconds', value: String(ms) })
  }
  info.fields!.push({ label: 'Version nibble', value: hex[12] })
  info.fields!.push({ label: 'Variant bits', value: hex[16] })
  return info
}

export interface UlidInfo {
  kind: 'ulid'
  valid: boolean
  reason?: string
  timestamp?: string
  randomness?: string
}

export function inspectUlid(text: string): UlidInfo {
  const t = text.trim()
  if (!/^[0-9A-Za-z]{26}$/.test(t)) {
    return { kind: 'ulid', valid: false, reason: 'A ULID is exactly 26 characters from the Crockford base32 alphabet.' }
  }
  const bad = [...t.toUpperCase()].filter((c) => !(c in CROCKFORD_DECODE))
  if (bad.length > 0) {
    return { kind: 'ulid', valid: false, reason: `Not Crockford base32: "${[...new Set(bad)].join('')}" ${[...new Set(bad)].length > 1 ? 'are' : 'is'} not in the alphabet (I, L, O, U are excluded).` }
  }
  let ts = 0n
  for (const c of t.slice(0, 10).toUpperCase()) ts = ts * 32n + BigInt(CROCKFORD_DECODE[c])
  if (ts > 2n ** 48n) return { kind: 'ulid', valid: false, reason: 'The 48-bit timestamp overflows — this is not a real ULID.' }
  return {
    kind: 'ulid',
    valid: true,
    timestamp: new Date(Number(ts)).toISOString(),
    randomness: t.slice(10),
  }
}

// ---------------------------------------------------------------- component --

type IdType = 'v4' | 'v7' | 'ulid'

const TYPE_LABEL: Record<IdType, string> = {
  v4: 'UUID v4 — random',
  v7: 'UUID v7 — time-ordered (RFC 9562)',
  ulid: 'ULID — time-ordered, 26 chars',
}

export function UuidTool() {
  const [tab, setTab] = useState('generate')
  const [type, setType] = useState<IdType>('v4')
  const [quantity, setQuantity] = useState(10)
  const [uppercase, setUppercase] = useState(false)
  const [noHyphens, setNoHyphens] = useState(false)
  const [monotonic, setMonotonic] = useState(false)
  const [seed, setSeed] = useState(0)
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(-1)

  const monoGen = useMemo(() => makeMonotonicUlid(), [])
  const gen = useCallback((): string => {
    if (type === 'v4') return uuidV4()
    if (type === 'v7') return uuidV7()
    return monotonic ? monoGen() : ulid()
  }, [type, monotonic, monoGen])

  // Derived state: IDs regenerate whenever the format or quantity changes,
  // and on demand via the seed the Regenerate button bumps. Generation is
  // client-only: crypto.getRandomValues during SSR would produce values the
  // client cannot match, so the first paint waits for hydration.
  // useSyncExternalStore gives the is-mounted flag without an effect —
  // false on the server snapshot, true on every client render.
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )
  const ids = useMemo(() => {
    if (!mounted) return []
    void seed
    const n = Math.max(1, Math.min(500, Math.floor(quantity) || 1))
    const out: string[] = []
    for (let i = 0; i < n; i++) out.push(gen())
    return out
  }, [gen, quantity, seed, mounted])

  const shown = useMemo(
    () =>
      ids.map((id) => {
        let s = id
        if (noHyphens && s.includes('-')) s = s.replace(/-/g, '')
        if (uppercase) s = s.toUpperCase()
        return s
      }),
    [ids, uppercase, noHyphens],
  )

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(shown.join('\n'))
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 1500)
    } catch {
      /* clipboard refused */
    }
  }

  const copyOne = async (i: number, v: string) => {
    try {
      await navigator.clipboard.writeText(v)
      setCopiedIdx(i)
      setTimeout(() => setCopiedIdx(-1), 1200)
    } catch {
      /* clipboard refused */
    }
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="generate">Generate</TabsTrigger>
        <TabsTrigger value="inspect">Inspect</TabsTrigger>
      </TabsList>

      <TabsContent value="generate" className="mt-4">
        <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card px-4 py-3">
          <div>
            <Label htmlFor="uuid-type">Format</Label>
            <select
              id="uuid-type"
              value={type}
              onChange={(e) => setType(e.target.value as IdType)}
              className="mt-1.5 h-9 rounded-md border bg-transparent px-2 text-sm"
            >
              {(Object.keys(TYPE_LABEL) as IdType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="uuid-count">How many</Label>
            <select
              id="uuid-count"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="mt-1.5 h-9 rounded-md border bg-transparent px-2 text-sm"
            >
              {[1, 5, 10, 25, 50, 100, 250, 500].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          {type !== 'ulid' ? (
            <>
              <div className="flex items-center gap-2 pb-0.5">
                <Switch id="uuid-upper" checked={uppercase} onCheckedChange={setUppercase} />
                <Label htmlFor="uuid-upper" className="text-xs font-normal">
                  Uppercase
                </Label>
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <Switch id="uuid-flat" checked={noHyphens} onCheckedChange={setNoHyphens} />
                <Label htmlFor="uuid-flat" className="text-xs font-normal">
                  No hyphens
                </Label>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 pb-0.5">
              <Switch id="uuid-mono" checked={monotonic} onCheckedChange={setMonotonic} />
              <Label htmlFor="uuid-mono" className="text-xs font-normal">
                Monotonic
              </Label>
            </div>
          )}
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setSeed((s) => s + 1)}>
            <RefreshCw className="size-3.5" aria-hidden="true" /> Regenerate
          </Button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          <div className="max-h-96 overflow-auto">
            <ul className="divide-y">
              {shown.map((id, i) => (
                <li key={id} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm">{id}</span>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`Copy ${id}`} onClick={() => copyOne(i, id)}>
                    {copiedIdx === i ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={copyAll}>
            {copiedAll ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copiedAll ? 'Copied all' : `Copy all ${shown.length}`}
          </Button>
          <p className="text-xs text-muted-foreground">
            {type === 'v4' && '122 random bits from crypto.getRandomValues — the odds of two colliding are about 1 in 5.3 × 10³⁶.'}
            {type === 'v7' && 'First 48 bits are the Unix millisecond timestamp; the rest is random, so IDs sort by creation.'}
            {type === 'ulid' && !monotonic && '10 timestamp chars + 16 random chars in Crockford base32 — I, L, O, U never appear.'}
            {type === 'ulid' && monotonic && 'Same millisecond IDs increment instead of re-rolling — strictly increasing even in a tight loop.'}
          </p>
        </div>
      </TabsContent>

      <TabsContent value="inspect" className="mt-4">
        <InspectPanel />
      </TabsContent>

      <PrivacyStrip detail="IDs are generated from this tab's crypto engine and decoded in this tab — nothing is sent anywhere, and there is no upload code on this page at all." />
    </Tabs>
  )
}

function InspectPanel() {
  const [text, setText] = useState('')
  const info = useMemo(() => {
    const t = text.trim()
    if (t === '') return null
    if (/^[0-9A-Fa-f]{32}$/.test(t) || /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(t)) {
      return inspectUuid(t)
    }
    if (/^[0-9A-Za-z]{26}$/.test(t)) return inspectUlid(t)
    return {
      kind: 'unknown' as const,
      valid: false,
      reason:
        'That is neither a UUID (32 hex digits) nor a ULID (26 Crockford base32 characters) — paste one and its parts appear here.',
    }
  }, [text])

  return (
    <div>
      <div className="max-w-xl">
        <Label htmlFor="uuid-inspect">Paste a UUID or ULID</Label>
        <Input
          id="uuid-inspect"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="0198f10a-… or 01ARZ3NDEKTSV4RRFFQ69G5FAV"
          className="mt-1.5 font-mono"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {info === null ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Fingerprint className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            The inspector tells you what an ID actually carries: which version, which variant, and the timestamp hidden
            inside time-ordered IDs.
          </span>
        </p>
      ) : !info.valid ? (
        <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">{info.reason}</p>
      ) : info.kind === 'uuid' ? (
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="w-56 px-4 py-2 text-muted-foreground">Type</td>
                <td className="px-4 py-2 font-medium">{info.versionName}</td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-2 text-muted-foreground">Variant</td>
                <td className="px-4 py-2">{info.variant}</td>
              </tr>
              {info.timestamp && (
                <tr className="border-b">
                  <td className="px-4 py-2 text-muted-foreground">Embedded timestamp</td>
                  <td className="px-4 py-2 font-mono text-xs">{info.timestamp}</td>
                </tr>
              )}
              {(info.fields ?? []).map((f) => (
                <tr key={f.label} className="border-b last:border-b-0">
                  <td className="px-4 py-2 text-muted-foreground">{f.label}</td>
                  <td className="px-4 py-2 font-mono text-xs">{f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : info.kind === 'ulid' ? (
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="w-56 px-4 py-2 text-muted-foreground">Type</td>
                <td className="px-4 py-2 font-medium">ULID</td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-2 text-muted-foreground">Embedded timestamp</td>
                <td className="px-4 py-2 font-mono text-xs">{info.timestamp}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-muted-foreground">Randomness part</td>
                <td className="px-4 py-2 font-mono text-xs">{info.randomness}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
