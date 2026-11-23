'use client'

// JWT Inspector — decode, inspect and locally verify JSON Web Tokens.
// Everything runs in this tab: the decoder is hand-written base64url with
// strict UTF-8, signature checks run in the browser's WebCrypto engine, and
// there is no upload code on the page. A pasted token and a pasted key never
// leave the device — component state only, nothing stored anywhere.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Copy, FlaskConical, KeyRound, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

// --------------------------------------------------------------------- types

interface DecodedToken {
  header: Record<string, unknown>
  headerRaw: string
  headerB64: string
  payload: Record<string, unknown>
  payloadRaw: string
  payloadB64: string
  signatureB64: string
  signatureBytes: Uint8Array | null
}

interface AsymInfo {
  family: 'rs' | 'ps' | 'es'
  name: string
  hash: 'SHA-256' | 'SHA-384' | 'SHA-512'
  curve?: 'P-256' | 'P-384' | 'P-521'
  sigBytes?: number
  salt?: number
}

type AlgInfo =
  | { family: 'none'; name: string }
  | { family: 'hmac'; name: string; hash: 'SHA-256' | 'SHA-384' | 'SHA-512' }
  | AsymInfo
  | { family: 'unknown'; name?: string }

interface Parsed {
  token: DecodedToken
  algInfo: AlgInfo
  kid?: string
}

interface DecodeError {
  title: string
  detail: string
}

type VerifyState =
  | { kind: 'idle' }
  | { kind: 'unsigned'; message: string }
  | { kind: 'unsupported'; message: string }
  | { kind: 'no-key'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'verified'; message: string; note?: string }
  | { kind: 'failed'; message: string }

// ------------------------------------------------------- base64url + decoding

function b64urlToBytes(part: string, label: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(part)) {
    const bad = part.match(/[^A-Za-z0-9_-]/)?.[0] ?? ''
    const shown = bad === ' ' || bad === '\n' || bad === '\t' ? 'whitespace' : `"${bad}"`
    throw new Error(
      `The ${label} part contains ${shown}, which is not a base64url character (A-Z, a-z, 0-9, '-', '_').`,
    )
  }
  if (part.length % 4 === 1) {
    throw new Error(
      `The ${label} part has ${part.length} characters — no valid base64url string can have that length.`,
    )
  }
  let s = part.replace(/-/g, '+').replace(/_/g, '/')
  if (s.length % 4 === 2) s += '=='
  if (s.length % 4 === 3) s += '='
  let bin: string
  try {
    bin = atob(s)
  } catch {
    throw new Error(`The ${label} part is not valid base64url, even after padding.`)
  }
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function strictUtf8(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error(
      `The ${label} part decodes to bytes that are not valid UTF-8 — a JWT segment must be UTF-8 text.`,
    )
  }
}

function describeJson(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  switch (typeof value) {
    case 'string':
      return 'a string'
    case 'number':
      return 'a number'
    case 'boolean':
      return 'a boolean'
    default:
      return typeof value
  }
}

function parseJsonObject(text: string, label: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const m = message.match(/position (\d+)/)
    if (!m) throw new Error(`The ${label} part is not valid JSON. ${message}`)
    const pos = Number(m[1])
    const before = text.slice(Math.max(0, pos - 20), pos)
    const after = text.slice(pos, pos + 20)
    throw new Error(
      `The ${label} part is not valid JSON at byte ${pos}: …${before}▸${after}…`,
    )
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `The ${label} part decodes to ${describeJson(parsed)} — a JWT ${label} must be a JSON object.`,
    )
  }
  return parsed as Record<string, unknown>
}

function decodeToken(input: string): { parsed?: Parsed; error?: DecodeError } {
  const value = input.trim().replace(/\s+/g, '')
  if (!value) return {}

  try {
    const parts = value.split('.')
    if (parts.length < 2 || parts.length > 3) {
      return {
        error: {
          title: 'Not a JWS compact token',
          detail: `A JWT has two dots and two or three parts (header.payload, or header.payload.signature). This one has ${parts.length} ${parts.length === 1 ? 'part' : 'parts'}.`,
        },
      }
    }
    if (!parts[0]) return { error: { title: 'Empty header', detail: 'The part before the first dot is empty.' } }
    if (!parts[1]) return { error: { title: 'Empty payload', detail: 'The part between the two dots is empty.' } }

    const headerRaw = strictUtf8(b64urlToBytes(parts[0], 'header'), 'header')
    const header = parseJsonObject(headerRaw, 'header')
    const payloadRaw = strictUtf8(b64urlToBytes(parts[1], 'payload'), 'payload')
    const payload = parseJsonObject(payloadRaw, 'payload')

    let signatureB64 = ''
    let signatureBytes: Uint8Array | null = null
    if (parts.length === 3 && parts[2]) {
      signatureB64 = parts[2]
      signatureBytes = b64urlToBytes(parts[2], 'signature')
    }

    const alg = typeof header.alg === 'string' ? header.alg : undefined
    const kid = typeof header.kid === 'string' ? header.kid : undefined
    const algInfo = classifyAlg(alg)

    return {
      parsed: {
        token: {
          header,
          headerRaw,
          headerB64: parts[0],
          payload,
          payloadRaw,
          payloadB64: parts[1],
          signatureB64,
          signatureBytes,
        },
        algInfo,
        kid,
      },
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { error: { title: 'Could not decode this token', detail } }
  }
}

function classifyAlg(alg: string | undefined): AlgInfo {
  if (!alg) return { family: 'unknown' }
  if (alg === 'none') return { family: 'none', name: alg }
  const m = alg.match(/^(HS|RS|PS|ES)(256|384|512)$/)
  if (!m) return { family: 'unknown', name: alg }
  const bits = m[2]
  const hash = bits === '256' ? 'SHA-256' : bits === '384' ? 'SHA-384' : 'SHA-512'
  const name = alg
  if (m[1] === 'HS') return { family: 'hmac', name, hash }
  if (m[1] === 'RS') return { family: 'rs', name, hash }
  if (m[1] === 'PS') return { family: 'ps', name, hash, salt: Number(bits) / 8 }
  // ES: JWS r||s raw signatures — 64 / 96 / 132 bytes for P-256 / P-384 / P-521
  const curve = bits === '256' ? 'P-256' : bits === '384' ? 'P-384' : 'P-521'
  const sigBytes = curve === 'P-256' ? 64 : curve === 'P-384' ? 96 : 132
  return { family: 'es', name, hash, curve, sigBytes }
}

// ---------------------------------------------------------------- claims + time

const CLAIM_DOCS: Record<string, string> = {
  iss: 'Issuer — who created and signed this token.',
  sub: 'Subject — who or what this token is about.',
  aud: 'Audience — who the token is meant for. A correct app refuses tokens whose audience is not itself.',
  exp: 'Expiration — the second this token stops being valid, as seconds since 1970.',
  nbf: 'Not before — the token is invalid until this second.',
  iat: 'Issued at — when this token was minted. Informational on its own.',
  jti: 'JWT ID — a unique id for this one token, used for tracking or revocation.',
  scope: 'Scope — space-separated permissions some issuers embed (an OAuth 2.0 habit).',
}

function relTime(deltaMs: number): string {
  const past = deltaMs < 0
  let s = Math.floor(Math.abs(deltaMs) / 1000)
  if (s < 5) return 'just now'
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  const parts: string[] = []
  if (d) parts.push(`${d} d`)
  if (h) parts.push(`${h} h`)
  if (m) parts.push(`${m} m`)
  if (!parts.length) parts.push(`${s} s`)
  const text = parts.slice(0, 2).join(' ')
  return past ? `${text} ago` : `in ${text}`
}

function localDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })
}

function utcOffsetLabel(): string {
  const mins = -new Date().getTimezoneOffset()
  const sign = mins >= 0 ? '+' : '-'
  const abs = Math.abs(mins)
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

type ClaimVerdict = {
  badge: 'VALID' | 'EXPIRED' | 'NOT YET VALID' | 'NO EXPIRY CLAIM'
  tone: 'emerald' | 'amber' | 'neutral'
  line: string
}

function verdictOf(parsed: Parsed, now: number): ClaimVerdict {
  const p = parsed.token.payload
  const exp = typeof p.exp === 'number' && Number.isFinite(p.exp) ? p.exp * 1000 : null
  const nbf = typeof p.nbf === 'number' && Number.isFinite(p.nbf) ? p.nbf * 1000 : null

  if (exp !== null && now >= exp) {
    return { badge: 'EXPIRED', tone: 'amber', line: `Expired ${relTime(now - exp)} (at ${localDateTime(exp)}).` }
  }
  if (nbf !== null && now < nbf) {
    return { badge: 'NOT YET VALID', tone: 'amber', line: `Not valid yet — activates ${relTime(nbf - now)} (at ${localDateTime(nbf)}).` }
  }
  if (exp !== null) {
    return { badge: 'VALID', tone: 'emerald', line: `Valid for the next ${relTime(exp - now)} — until ${localDateTime(exp)}.` }
  }
  if (nbf !== null) {
    return { badge: 'VALID', tone: 'emerald', line: `Active since ${relTime(now - nbf)} — and nothing in the token says when it stops.` }
  }
  return {
    badge: 'NO EXPIRY CLAIM',
    tone: 'neutral',
    line: 'No exp or nbf claim — the token never declares an end to its validity.',
  }
}

// ------------------------------------------------------------------- verify

function pickJwk(
  text: string,
  info: Extract<AlgInfo, AsymInfo>,
  kid: string | undefined,
): { jwk?: Record<string, unknown>; note?: string; error?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      error: `The key field is not JSON — expected one JWK object or a JWKS document ({ "keys": [ … ] }). ${message}`,
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'The key field must be a JSON object — one JWK, or a JWKS document with a keys array.' }
  }
  const obj = parsed as Record<string, unknown>

  let jwk: Record<string, unknown> | undefined
  let note: string | undefined
  if (Array.isArray(obj.keys)) {
    const list = obj.keys.filter(
      (k): k is Record<string, unknown> => k !== null && typeof k === 'object' && !Array.isArray(k),
    )
    if (!list.length) return { error: 'The JWKS document lists no keys.' }
    if (kid) {
      const match = list.find((k) => k.kid === kid)
      if (!match) {
        const kids = list
          .map((k) => (typeof k.kid === 'string' ? `"${k.kid}"` : '(no kid)'))
          .join(', ')
        return { error: `No key in this JWKS carries kid "${kid}" from the token header. Keys present: ${kids}.` }
      }
      jwk = match
    } else {
      jwk = list[0]
      note = 'The token header carries no kid, so the first key in the JWKS was used.'
    }
  } else {
    jwk = obj
  }

  const kty = jwk.kty
  if (typeof kty !== 'string') return { error: 'The JWK has no kty field — it must be "RSA" or "EC" for public keys.' }
  if (kty === 'oct') {
    return { error: 'This is a symmetric (oct) key. Paste it in the shared-secret field instead — HS* tokens verify with the secret itself.' }
  }
  if (info.family === 'rs' || info.family === 'ps') {
    if (kty !== 'RSA') return { error: `${info.name} tokens are signed with an RSA key, but this JWK says kty "${kty}".` }
    if (typeof jwk.n !== 'string' || typeof jwk.e !== 'string') {
      return { error: 'The RSA JWK is missing its modulus n or exponent e.' }
    }
  }
  if (info.family === 'es') {
    if (kty !== 'EC') return { error: `${info.name} tokens are signed with an EC key, but this JWK says kty "${kty}".` }
    if (jwk.crv !== info.curve) {
      return { error: `This key uses curve ${String(jwk.crv)}, but ${info.name} JWS signatures use ${info.curve}.` }
    }
    if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
      return { error: 'The EC JWK is missing its point coordinates x or y.' }
    }
  }
  return { jwk, note }
}

async function importAsymKey(jwk: Record<string, unknown>, info: AsymInfo): Promise<CryptoKey> {
  const asJwk = jwk as unknown as JsonWebKey
  if (info.family === 'rs') {
    return crypto.subtle.importKey('jwk', asJwk, { name: 'RSASSA-PKCS1-v1_5', hash: info.hash }, false, ['verify'])
  }
  if (info.family === 'ps') {
    return crypto.subtle.importKey('jwk', asJwk, { name: 'RSA-PSS', hash: info.hash }, false, ['verify'])
  }
  return crypto.subtle.importKey('jwk', asJwk, { name: 'ECDSA', hash: info.hash }, false, ['verify'])
}

// ------------------------------------------------------------- sample token

const SAMPLE_SECRET = 'kontivo-sample-secret — this signs the sample token only'

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function b64urlEncode(bytes: Uint8Array | ArrayBuffer): Promise<string> {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function buildSampleToken(): Promise<string> {
  const enc = new TextEncoder()
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    iss: 'kontivo.sample',
    sub: 'user-1234',
    aud: ['api://demo'],
    iat: now,
    nbf: now - 3600,
    exp: now + 3 * 3600 + 12 * 60,
    jti: uuid(),
    scope: 'read:demo write:demo',
  }
  const h = await b64urlEncode(enc.encode(JSON.stringify(header)))
  const p = await b64urlEncode(enc.encode(JSON.stringify(payload)))
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SAMPLE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${h}.${p}`))
  return `${h}.${p}.${await b64urlEncode(sig)}`
}

// -------------------------------------------------------------------- pieces

function CopyChip({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        })
      }}
    >
      {copied ? (
        <Check className="size-3.5 text-primary" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      {copied ? 'Copied' : label}
    </Button>
  )
}

function StatusBadge({ tone, children }: { tone: 'emerald' | 'amber' | 'neutral'; children: ReactNode }) {
  const cls =
    tone === 'emerald'
      ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : tone === 'amber'
        ? 'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
        : 'border-border bg-muted text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', cls)}>
      {children}
    </span>
  )
}

/** Two-tone pretty JSON: keys vs values. No syntax-highlight library needed. */
function JsonView({ value }: { value: Record<string, unknown> }) {
  const text = JSON.stringify(value, null, 2)
  const tokens: Array<{ t: 'key' | 'val' | 'punct'; s: string }> = []
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ t: 'punct', s: text.slice(last, m.index) })
    if (m[2]) {
      tokens.push({ t: 'key', s: m[1] })
      tokens.push({ t: 'punct', s: m[2] })
    } else {
      tokens.push({ t: 'val', s: m[1] ?? m[3] ?? m[4] })
    }
    last = re.lastIndex
  }
  if (last < text.length) tokens.push({ t: 'punct', s: text.slice(last) })

  return (
    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
      <code>
        {tokens.map((tk, i) =>
          tk.t === 'key' ? (
            <span key={i} className="font-medium text-foreground">{tk.s}</span>
          ) : tk.t === 'val' ? (
            <span key={i} className="text-muted-foreground">{tk.s}</span>
          ) : (
            <span key={i} className="text-muted-foreground/80">{tk.s}</span>
          ),
        )}
      </code>
    </pre>
  )
}

function claimValue(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

// ----------------------------------------------------------------- the tool

export function JwtTool() {
  const [tokenInput, setTokenInput] = useState('')
  const [secret, setSecret] = useState('')
  const [jwkInput, setJwkInput] = useState('')
  const [verify, setVerify] = useState<VerifyState>({ kind: 'idle' })
  const [now, setNow] = useState<number | null>(null)
  const runId = useRef(0)

  // The device clock decides the validity badges — keep it honestly live.
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const decoded = useMemo(() => decodeToken(tokenInput), [tokenInput])
  const parsed = decoded.parsed
  const algInfo = parsed?.algInfo
  const needsSecret = algInfo?.family === 'hmac'
  const needsJwk = algInfo?.family === 'rs' || algInfo?.family === 'ps' || algInfo?.family === 'es'

  // Local signature verification — runs whenever the token or the key changes.
  useEffect(() => {
    if (!parsed) {
      setVerify({ kind: 'idle' })
      return
    }
    const { token } = parsed
    const info = parsed.algInfo

    if (info.family === 'none' || !token.signatureB64) {
      setVerify({
        kind: 'unsigned',
        message:
          info.family === 'none'
            ? 'The header declares alg "none" — this token is unsigned. There is nothing to verify, and anyone can forge or alter its contents.'
            : 'This token has no signature segment — nothing binds its contents to any key.',
      })
      return
    }
    if (info.family === 'unknown') {
      setVerify({
        kind: 'unsupported',
        message: info.name
          ? `This tool cannot verify alg "${info.name}" locally — some schemes (EdDSA/Ed25519, for example) are not in every browser's WebCrypto yet. Decoding above stays fully valid.`
          : 'The header carries no alg claim, so there is no signature scheme to check.',
      })
      return
    }

    const isHmac = info.family === 'hmac'
    const keyText = (isHmac ? secret : jwkInput).trim()
    if (!keyText) {
      setVerify({
        kind: 'no-key',
        message: isHmac
          ? 'No secret given — paste the shared secret the issuer signs with to check the signature.'
          : 'No public key given — asymmetric verification needs the issuer’s public key (JWK), usually published at a jwks_uri. This tool never fetches: paste it here.',
      })
      return
    }
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      setVerify({ kind: 'invalid', message: 'This browser exposes no WebCrypto (it needs a secure context), so the signature cannot be checked here.' })
      return
    }

    const id = ++runId.current
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const enc = new TextEncoder()
          const data = enc.encode(`${token.headerB64}.${token.payloadB64}`)
          const sig = token.signatureBytes as Uint8Array

          let key: CryptoKey
          let note: string | undefined
          if (isHmac) {
            key = await crypto.subtle.importKey('raw', enc.encode(keyText), { name: 'HMAC', hash: info.hash }, false, ['verify'])
          } else {
            const picked = pickJwk(keyText, info, parsed.kid)
            if (picked.error) {
              if (runId.current === id) setVerify({ kind: 'invalid', message: `Could not use this key: ${picked.error}` })
              return
            }
            note = picked.note
            key = await importAsymKey(picked.jwk as Record<string, unknown>, info)
            if (info.family === 'es' && sig.length !== info.sigBytes) {
              if (runId.current === id) {
                setVerify({
                  kind: 'invalid',
                  message: `The signature segment is ${sig.length} bytes, but a ${info.name} JWS signature is ${info.sigBytes} bytes (r and s concatenated).`,
                })
              }
              return
            }
          }

          const algo =
            info.family === 'hmac'
              ? { name: 'HMAC' }
              : info.family === 'ps'
                ? { name: 'RSA-PSS', saltLength: info.salt }
                : info.family === 'rs'
                  ? { name: 'RSASSA-PKCS1-v1_5' }
                  : { name: 'ECDSA' }
          const ok = await crypto.subtle.verify(algo, key, sig as unknown as BufferSource, data as unknown as BufferSource)
          if (runId.current !== id) return
          if (ok) {
            setVerify({
              kind: 'verified',
              message:
                isHmac
                  ? `Signature verified — ${info.name} over header.payload with the pasted secret.`
                  : `Signature verified — ${info.name} over header.payload with the pasted public key.`,
              note,
            })
          } else {
            setVerify({
              kind: 'failed',
              message: `Signature does not match. The token was signed with a different ${isHmac ? 'secret' : 'key'}, or its contents were altered after signing.`,
            })
          }
        } catch (err) {
          if (runId.current !== id) return
          const name = err instanceof DOMException ? err.name : 'Error'
          const message = err instanceof Error ? err.message : String(err)
          setVerify({ kind: 'invalid', message: `The browser refused this key (${name}): ${message}` })
        }
      })()
    }, 200)
    return () => clearTimeout(timer)
  }, [decoded, secret, jwkInput])

  function insertSample() {
    void buildSampleToken().then((tok) => {
      setTokenInput(tok)
      setSecret(SAMPLE_SECRET)
      setJwkInput('')
    })
  }

  function clearAll() {
    setTokenInput('')
    setSecret('')
    setJwkInput('')
  }

  const verdict = parsed && now !== null ? verdictOf(parsed, now) : null
  const hasKeyFields = Boolean(secret) || Boolean(jwkInput)

  // Segment strip geometry (grow proportionally, stay visible when tiny).
  const segLens = parsed
    ? [parsed.token.headerB64.length, parsed.token.payloadB64.length, parsed.token.signatureB64.length]
    : [0, 0, 0]

  return (
    <div>
      {/* ------------------------------------------------- the token, first */}
      <div className="flex items-center justify-between">
        <Label htmlFor="jwt-token">Token</Label>
        {parsed && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {parsed.token.signatureB64 ? '3 parts' : 'no signature part'} · decoded locally
          </p>
        )}
      </div>
      <Textarea
        id="jwt-token"
        value={tokenInput}
        onChange={(e) => setTokenInput(e.target.value)}
        placeholder="Paste a JWT — eyJhbGciOi… (header.payload.signature)"
        className="mt-2 min-h-24 font-mono text-xs"
        spellCheck={false}
        aria-describedby="jwt-token-hint"
      />
      <p id="jwt-token-hint" className="mt-1.5 text-xs text-muted-foreground">
        Decoding is instant and local. Verification is optional — add a key below.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={insertSample}>
          <FlaskConical className="size-3.5" aria-hidden="true" /> Insert sample
        </Button>
        <Button size="sm" variant="outline" onClick={clearAll} disabled={!tokenInput && !hasKeyFields}>
          <X className="size-3.5" aria-hidden="true" /> Clear
        </Button>
      </div>

      {decoded.error && (
        <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <p className="font-semibold">{decoded.error.title}</p>
          <p className="mt-0.5 text-xs opacity-90">{decoded.error.detail}</p>
        </div>
      )}

      {parsed && (
        <>
          {/* ------------------------------------------- segment color strip */}
          <div className="mt-5">
            <div className="flex h-3 w-full gap-px overflow-hidden" aria-label="Token segments by size">
              <span className="bg-emerald-500/80 dark:bg-emerald-600" style={{ flexGrow: segLens[0], flexBasis: 0 }} />
              <span className="bg-amber-400/80 dark:bg-amber-500" style={{ flexGrow: segLens[1], flexBasis: 0 }} />
              {parsed.token.signatureB64 ? (
                <span className="bg-stone-400/80 dark:bg-stone-500" style={{ flexGrow: segLens[2], flexBasis: 0 }} />
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" /> header · {segLens[0]} chars
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-400" aria-hidden="true" /> payload · {segLens[1]} chars
              </span>
              {parsed.token.signatureB64 ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-stone-400" aria-hidden="true" /> signature · {segLens[2]} chars
                </span>
              ) : (
                <span>no signature part</span>
              )}
            </div>
          </div>

          {/* ------------------------------------------------- alg, honestly */}
          {algInfo?.family === 'none' && (
            <div role="alert" className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">
              <p className="flex items-center gap-1.5 font-semibold">
                <TriangleAlert className="size-4" aria-hidden="true" /> alg “none” — unsigned token, anyone can forge this
              </p>
              <p className="mt-1 text-xs opacity-90">
                No key protects these contents: changing the payload and keeping the header is enough to mint a new
                token. Never trust one.
              </p>
            </div>
          )}
          {algInfo?.family === 'hmac' && (
            <p className="mt-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{algInfo.name}</span> — symmetric: the same secret signs
              and verifies, so whoever holds it can mint tokens.
            </p>
          )}
          {(algInfo?.family === 'rs' || algInfo?.family === 'ps' || algInfo?.family === 'es') && (
            <p className="mt-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{algInfo.name}</span> — asymmetric: signed with the
              issuer’s private key, verifiable with the public key alone{algInfo.family === 'ps' ? ' (RSA-PSS)' : ''}.
            </p>
          )}
          {algInfo?.family === 'unknown' && (
            <p className="mt-4 text-sm text-muted-foreground">
              {algInfo.name
                ? <>Unrecognized alg <span className="font-mono text-foreground">{algInfo.name}</span> — decoded as text, but scheme-specific checks below are limited.</>
                : 'The header has no alg claim — unusual, and nothing below the decode can be checked.'}
            </p>
          )}

          {/* ------------------------------------------- header + payload */}
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section aria-label="Decoded header">
              <div className="flex items-center justify-between">
                <Label>Header</Label>
                <div className="flex items-center">
                  <CopyChip text={JSON.stringify(parsed.token.header, null, 2)} label="Copy" />
                  <CopyChip text={parsed.token.headerRaw} label="Raw" />
                </div>
              </div>
              <div className="mt-2">
                <JsonView value={parsed.token.header} />
              </div>
            </section>
            <section aria-label="Decoded payload">
              <div className="flex items-center justify-between">
                <Label>Payload</Label>
                <div className="flex items-center">
                  <CopyChip text={JSON.stringify(parsed.token.payload, null, 2)} label="Copy" />
                  <CopyChip text={parsed.token.payloadRaw} label="Raw" />
                </div>
              </div>
              <div className="mt-2">
                <JsonView value={parsed.token.payload} />
              </div>
            </section>
          </div>

          {/* -------------------------------------------- claims + validity */}
          <section className="mt-6 rounded-xl border bg-card p-4" aria-label="Claims and validity">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold">Validity</h2>
              {verdict && <StatusBadge tone={verdict.tone}>{verdict.badge}</StatusBadge>}
              {verdict && <p className="text-sm text-muted-foreground">{verdict.line}</p>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {now !== null ? (
                <>
                  Your device clock decides: current local time{' '}
                  <span className="font-mono text-foreground">
                    {new Date(now).toLocaleTimeString(undefined, { timeStyle: 'medium' })}
                  </span>{' '}
                  · {Intl.DateTimeFormat().resolvedOptions().timeZone || 'local zone'} ({utcOffsetLabel()}). If this
                  clock is wrong, the badges are wrong too.
                </>
              ) : (
                'Reading the device clock…'
              )}
            </p>

            <dl className="mt-3">
              {Object.entries(parsed.token.payload).map(([key, value]) => {
                const doc = CLAIM_DOCS[key] ?? 'Custom claim — its meaning is defined by whoever issued the token.'
                const isTime = (key === 'exp' || key === 'nbf' || key === 'iat') && typeof value === 'number' && Number.isFinite(value)
                return (
                  <div key={key} className="flex flex-col gap-1 border-t py-2.5 sm:flex-row sm:gap-4">
                    <dt className="shrink-0 font-mono text-xs font-semibold sm:w-24 sm:pt-0.5">{key}</dt>
                    <dd className="min-w-0 flex-1">
                      <p className="font-mono text-xs break-words text-foreground">{claimValue(value)}</p>
                      {isTime && now !== null && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {localDateTime(value * 1000)} — {key === 'iat' ? `issued ${relTime(now - value * 1000)}` : relTime(value * 1000 - now)}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{doc}</p>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>

          {/* --------------------------------------------------- verify */}
          <section className="mt-6 border-t pt-5" aria-label="Local signature verification">
            <h2 className="font-display text-base font-semibold tracking-[-0.02em]">Verify the signature — locally</h2>

            {needsSecret && (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <Label htmlFor="jwt-secret">Shared secret (the signing key)</Label>
                </div>
                <Textarea
                  id="jwt-secret"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="The exact secret string the issuer signs with"
                  className="mt-2 min-h-16 font-mono text-xs"
                  spellCheck={false}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {algInfo?.name} checks the signature with the same secret that created it. Treat it like a password —
                  prefer test tokens, even in a fully local tool.
                </p>
              </div>
            )}

            {needsJwk && (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <Label htmlFor="jwt-jwk">Public key as JWK — or a whole JWKS document</Label>
                </div>
                <Textarea
                  id="jwt-jwk"
                  value={jwkInput}
                  onChange={(e) => setJwkInput(e.target.value)}
                  placeholder='{"kty":"RSA","n":"…","e":"AQAB"}  — or { "keys": [ … ] }'
                  className="mt-2 min-h-16 font-mono text-xs"
                  spellCheck={false}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {algInfo?.name} verifies with the public key alone. Issuers publish it at a jwks_uri — copy the JWK
                  from there and paste it. This tool never fetches anything; if the header has a kid, the matching key
                  is picked from a JWKS automatically.
                </p>
              </div>
            )}

            {verify.kind === 'verified' && (
              <div role="status" className="mt-4 rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Check className="size-4" aria-hidden="true" /> VERIFIED
                </p>
                <p className="mt-0.5 text-xs opacity-90">{verify.message}</p>
                {verify.note && <p className="mt-1 text-xs opacity-80">{verify.note}</p>}
              </div>
            )}
            {verify.kind === 'failed' && (
              <div role="status" className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">
                <p className="flex items-center gap-1.5 font-semibold">
                  <TriangleAlert className="size-4" aria-hidden="true" /> FAILED
                </p>
                <p className="mt-0.5 text-xs opacity-90">{verify.message}</p>
              </div>
            )}
            {verify.kind === 'invalid' && (
              <div role="status" className="mt-4 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                <p className="font-semibold">Could not run the check</p>
                <p className="mt-0.5 text-xs opacity-90">{verify.message}</p>
              </div>
            )}
            {verify.kind === 'unsigned' && (
              <div role="status" className="mt-4 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Nothing to verify</p>
                <p className="mt-0.5 text-xs">{verify.message}</p>
              </div>
            )}
            {verify.kind === 'unsupported' && (
              <div role="status" className="mt-4 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                <p className="font-semibold">Verification not supported here</p>
                <p className="mt-0.5 text-xs opacity-90">{verify.message}</p>
              </div>
            )}
            {verify.kind === 'no-key' && (
              <div role="status" className="mt-4 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                <p className="mt-0.5 text-xs">{verify.message}</p>
              </div>
            )}

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              The comparison runs inside the browser’s crypto engine (crypto.subtle.verify), so the timing of the
              check is the engine’s, not this page’s. A verified signature means exactly that these bytes were
              signed by that key — it does not mean the token is safe to trust: issuer, audience and expiry checks are
              still your app’s job.
            </p>
          </section>
        </>
      )}

      <PrivacyStrip detail="Decoding and verification run entirely in this tab with hand-written base64url and the browser's WebCrypto engine. The token and any key you paste never leave the device — there is no upload code on this page, and nothing is stored." />
    </div>
  )
}
