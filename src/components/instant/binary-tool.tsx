'use client'

// Text ↔ base-N byte converter, live in both directions. Typing on either
// side re-derives the other, and the last-edited pane stays authoritative so
// the panes never fight. Bytes are the shared currency: text → TextEncoder
// bytes → groups in your chosen base, and back. Grouping is forgiving
// (spaces, commas, line breaks, optional 0x for hex) but invalid characters
// are reported honestly with the first bad character and its position, and
// the other pane keeps its last good value. All local, nothing stored.

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip } from '@/components/instant/instant-kit'

type Base = 'bin' | 'hex' | 'oct' | 'dec'
type Enc = 'utf8' | 'ascii'
type Side = 'text' | 'base'

const RADIX: Record<Base, number> = { bin: 2, oct: 8, dec: 10, hex: 16 }
const BASE_LABEL: Record<Base, string> = { bin: 'Binary', hex: 'Hexadecimal', oct: 'Octal', dec: 'Decimal' }
const BASE_WIDTH: Record<Base, number> = { bin: 8, hex: 2, oct: 3, dec: 0 }

/** Bytes → space-separated groups in the chosen base, zero-padded so every
 *  group of the same base lines up (decimal stays unpadded). */
function formatGroups(bytes: number[], base: Base): string {
  const width = BASE_WIDTH[base]
  return bytes.map((b) => b.toString(RADIX[base]).padStart(width, '0')).join(' ')
}

function isDigit(ch: string, base: Base): boolean {
  switch (base) {
    case 'bin':
      return ch === '0' || ch === '1'
    case 'oct':
      return ch >= '0' && ch <= '7'
    case 'dec':
      return ch >= '0' && ch <= '9'
    case 'hex':
      return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')
  }
}

/** Parse the raw base-pane input into bytes. Separators may be any mix of
 *  whitespace and commas; hex groups may carry a 0x/0X prefix. The first
 *  invalid character is reported with its 1-based position in the raw
 *  string; groups that overflow one byte are reported too. */
function parseGroups(raw: string, base: Base): { bytes: number[]; error: string | null } {
  const label = BASE_LABEL[base].toLowerCase()
  const bytes: number[] = []
  let token = ''

  const flush = (): string | null => {
    if (token === '') return null
    if (base === 'hex' && /^0[xX]$/.test(token)) {
      return 'A group is just "0x" — put hexadecimal digits after the prefix.'
    }
    const digits = base === 'hex' && /^0[xX]/.test(token) ? token.slice(2) : token
    const value = Number.parseInt(digits, RADIX[base])
    if (Number.isNaN(value)) return `Group "${token}" is not a valid ${label} number.`
    if (value > 255) return `Group "${token}" is ${value} — larger than one byte (max 255).`
    bytes.push(value)
    token = ''
    return null
  }

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (/\s/.test(ch) || ch === ',') {
      const err = flush()
      if (err) return { bytes: [], error: err }
      continue
    }
    if (isDigit(ch, base)) {
      token += ch
      continue
    }
    if (base === 'hex' && (ch === 'x' || ch === 'X') && token === '0') {
      token += ch
      continue
    }
    const hint = base === 'bin' ? ' — binary allows only 0 and 1' : ''
    return { bytes: [], error: `Position ${i + 1} is '${ch}' — not a valid ${label} digit${hint}.` }
  }
  const err = flush()
  if (err) return { bytes: [], error: err }
  return { bytes, error: null }
}

/** First 1-based byte position that breaks a UTF-8 sequence, or null when the
 *  whole array is valid. Mirrors the WHATWG UTF-8 decoder's ranges so stray
 *  continuations, overlong forms, surrogates and anything above U+10FFFF are
 *  all rejected — the same set TextDecoder(fatal) rejects. The tighter lower
 *  bound (E0→A0, F0→90, F4→8F) applies only to the first continuation byte;
 *  later continuations may use the full 0x80–0xBF range. */
function utf8BadByte(bytes: number[]): number | null {
  const n = bytes.length
  let i = 0
  while (i < n) {
    const b = bytes[i]
    if (b <= 0x7f) {
      i += 1
      continue
    }
    let len: number
    let lo = 0x80
    let hi = 0xbf
    if (b >= 0xc2 && b <= 0xdf) len = 2
    else if (b === 0xe0) { len = 3; lo = 0xa0 }
    else if (b >= 0xe1 && b <= 0xec) len = 3
    else if (b === 0xed) { len = 3; hi = 0x9f }
    else if (b >= 0xee && b <= 0xef) len = 3
    else if (b === 0xf0) { len = 4; lo = 0x90 }
    else if (b >= 0xf1 && b <= 0xf3) len = 4
    else if (b === 0xf4) { len = 4; hi = 0x8f }
    else return i + 1
    if (i + len > n) return i + 1
    for (let j = 1; j < len; j++) {
      const c = bytes[i + j]
      const min = j === 1 ? lo : 0x80
      const max = j === 1 ? hi : 0xbf
      if (c < min || c > max) return i + j + 1
    }
    i += len
  }
  return null
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={!value}
      aria-label={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          })
          .catch(() => {
            /* clipboard refused — the pane is selectable by hand */
          })
      }}
    >
      {copied ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

export function BinaryTool() {
  const [text, setText] = useState('Hi')
  const [baseText, setBaseText] = useState('01001000 01101001')
  const [lastEdited, setLastEdited] = useState<Side>('text')
  const [base, setBase] = useState<Base>('bin')
  const [enc, setEnc] = useState<Enc>('utf8')
  const [bytes, setBytes] = useState<number[] | null>([72, 105])
  const [error, setError] = useState<string | null>(null)

  const charCount = Array.from(text).length

  /** Text pane is the source: encode to bytes, format to base N. */
  function runFromText(v: string, useBase: Base, useEnc: Enc) {
    setLastEdited('text')
    setText(v)
    if (v === '') {
      setBaseText('')
      setBytes([])
      setError(null)
      return
    }
    if (useEnc === 'ascii') {
      const chars = Array.from(v)
      const badIdx = chars.findIndex((c) => (c.codePointAt(0) ?? 0) > 127)
      if (badIdx !== -1) {
        setError(`Position ${badIdx + 1} is '${chars[badIdx]}' — not ASCII; switch to UTF-8`)
        setBytes(null)
        return
      }
    }
    const encoded = Array.from(new TextEncoder().encode(v))
    setBaseText(formatGroups(encoded, useBase))
    setBytes(encoded)
    setError(null)
  }

  /** Base pane is the source: parse groups to bytes, decode to text. On any
   *  failure the text pane keeps its last good value and the error explains. */
  function runFromBase(v: string, useBase: Base, useEnc: Enc) {
    setLastEdited('base')
    setBaseText(v)
    if (v.trim() === '') {
      setText('')
      setBytes([])
      setError(null)
      return
    }
    const parsed = parseGroups(v, useBase)
    if (parsed.error) {
      setError(parsed.error)
      setBytes(null)
      return
    }
    const bs = parsed.bytes
    if (useEnc === 'ascii') {
      const badIdx = bs.findIndex((b) => b > 127)
      if (badIdx !== -1) {
        setError(`Byte ${badIdx + 1} is ${bs[badIdx]} (0x${bs[badIdx].toString(16)}) — not ASCII; switch to UTF-8`)
        setBytes(null)
        return
      }
    }
    if (useEnc === 'utf8') {
      const badAt = utf8BadByte(bs)
      if (badAt !== null) {
        const b = bs[badAt - 1]
        setError(`Byte ${badAt} (0x${b.toString(16).padStart(2, '0')}) does not fit a valid UTF-8 sequence — the text pane keeps the last value that decoded`)
        setBytes(null)
        return
      }
    }
    let decoded: string
    try {
      decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bs))
    } catch {
      setError('Those bytes are not valid UTF-8 — the text pane keeps the last value that decoded.')
      setBytes(null)
      return
    }
    setText(decoded)
    setBytes(bs)
    setError(null)
  }

  /** Re-derive the non-authoritative pane from whichever side was edited last. */
  function changeBase(b: Base) {
    setBase(b)
    if (lastEdited === 'text') runFromText(text, b, enc)
    else runFromBase(baseText, b, enc)
  }

  function changeEnc(e: Enc) {
    setEnc(e)
    if (lastEdited === 'text') runFromText(text, base, e)
    else runFromBase(baseText, base, e)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="binary-base-select">Base</Label>
          <Select value={base} onValueChange={(v) => changeBase(v as Base)}>
            <SelectTrigger id="binary-base-select" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bin">Binary (base 2)</SelectItem>
              <SelectItem value="hex">Hexadecimal (base 16)</SelectItem>
              <SelectItem value="oct">Octal (base 8)</SelectItem>
              <SelectItem value="dec">Decimal (base 10)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="binary-enc-select">Encoding</Label>
          <Select value={enc} onValueChange={(v) => changeEnc(v as Enc)}>
            <SelectTrigger id="binary-enc-select" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="utf8">UTF-8</SelectItem>
              <SelectItem value="ascii">ASCII</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2" aria-live="polite">
          <span className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            {bytes === null ? '—' : bytes.length} bytes
          </span>
          <span className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            {charCount} {charCount === 1 ? 'character' : 'characters'}
          </span>
          <span className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            {BASE_LABEL[base]} · {enc === 'utf8' ? 'UTF-8' : 'ASCII'}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="binary-text">Text</Label>
            <CopyButton value={text} label="text" />
          </div>
          <Textarea
            id="binary-text"
            value={text}
            onChange={(e) => runFromText(e.target.value, base, enc)}
            spellCheck={false}
            placeholder="Type or paste text…"
            className="mt-2 min-h-44 font-mono text-sm"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Each character becomes one byte group — 2 to 4 groups for accented letters and emoji in UTF-8.
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="binary-base">{BASE_LABEL[base]} bytes</Label>
            <CopyButton value={baseText} label={BASE_LABEL[base]} />
          </div>
          <Textarea
            id="binary-base"
            value={baseText}
            onChange={(e) => runFromBase(e.target.value, base, enc)}
            spellCheck={false}
            placeholder="Paste bytes…"
            className="mt-2 min-h-44 font-mono text-sm"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {base === 'hex'
              ? 'Separators: spaces, commas, line breaks — a 0x prefix on each group is fine too.'
              : 'Separators: spaces, commas, line breaks — grouping is flexible.'}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <PrivacyStrip detail="The conversion runs in this tab with the browser's own TextEncoder and TextDecoder — nothing you type or paste leaves the page." />
    </div>
  )
}
