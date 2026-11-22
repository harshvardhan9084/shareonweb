'use client'

// Password Generator — cryptographic randomness from the browser (never
// Math.random), password + memorable passphrase modes, live strength.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, KeyRound, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { PrivacyStrip } from '@/components/instant/instant-kit'

type Mode = 'password' | 'passphrase'

// A compact, dependency-free word list (short, common, unambiguous words).
const WORDS = [
  'able', 'acorn', 'agile', 'apple', 'arrow', 'aspen', 'atlas', 'aurora', 'autumn', 'avenue',
  'awning', 'bacon', 'badge', 'bagel', 'baker', 'balsa', 'bamboo', 'banjo', 'barge', 'basil',
  'beach', 'beacon', 'beetle', 'bell', 'berry', 'birch', 'bison', 'bitter', 'blade', 'blanket',
  'blaze', 'bloom', 'blossom', 'board', 'bolt', 'border', 'bottle', 'boulder', 'bounce', 'branch',
  'brave', 'bread', 'breeze', 'bridge', 'bright', 'brook', 'brush', 'bubble', 'bucket', 'buffalo',
  'bugle', 'bundle', 'bunker', 'burnt', 'bushel', 'butter', 'button', 'cabin', 'cable', 'cactus',
  'camera', 'campus', 'canal', 'candle', 'canoe', 'canvas', 'canyon', 'cargo', 'carpet', 'carrot',
  'castle', 'cattle', 'cavern', 'cedar', 'cello', 'chalk', 'cherry', 'chess', 'chimney', 'cider',
  'cinder', 'citrus', 'clover', 'cluster', 'coach', 'cobalt', 'cocoa', 'comet', 'compass', 'copper',
  'coral', 'cotton', 'cove', 'crayon', 'cream', 'crisp', 'crown', 'crumb', 'crystal', 'cube',
  'cumin', 'curly', 'custard', 'cypress', 'dagger', 'dahlia', 'daisy', 'dandy', 'dawn', 'delta',
  'denim', 'desert', 'diamond', 'dinner', 'dolphin', 'domino', 'donkey', 'donut', 'dragon', 'dream',
  'driftwood', 'driver', 'drum', 'duckling', 'dune', 'dusk', 'eagle', 'earl', 'echo', 'eclipse',
  'edges', 'elbow', 'elder', 'electric', 'elephant', 'elk', 'ember', 'emerald', 'engine', 'envoy',
  'escape', 'essay', 'estate', 'ethanol', 'evening', 'event', 'exit', 'fable', 'fabric', 'falcon',
  'fantasy', 'farm', 'fathom', 'feather', 'fern', 'ferry', 'fiber', 'fiddle', 'fig', 'filter',
  'finch', 'finger', 'fjord', 'flamingo', 'flannel', 'flask', 'fleet', 'flint', 'flora', 'flower',
  'fluent', 'forest', 'forge', 'fortune', 'fossil', 'fountain', 'fox', 'freedom', 'fresh', 'friend',
]

const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const AMBIGUOUS = 'il1Lo0O'
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/'
const ALL_SAFE = LOWER + UPPER + DIGITS + SYMBOLS

function secureRandomInt(max: number): number {
  // Rejection sampling over crypto.getRandomValues — uniform, no modulo bias.
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  let v = 0
  do {
    crypto.getRandomValues(buf)
    v = buf[0]
  } while (v >= limit)
  return v % max
}

function pickChar(pool: string): string {
  return pool[secureRandomInt(pool.length)]
}

function generatePassword(length: number, opts: { upper: boolean; digits: boolean; symbols: boolean; noAmbiguous: boolean }): string {
  let pool = LOWER
  if (opts.noAmbiguous) {
    pool = [...pool].filter((c) => !AMBIGUOUS.includes(c)).join('')
  }
  const pools: string[] = [pool]
  if (opts.upper) {
    let u = UPPER
    if (opts.noAmbiguous) u = [...u].filter((c) => !AMBIGUOUS.includes(c)).join('')
    pools.push(u)
  }
  if (opts.digits) {
    let d = DIGITS
    if (opts.noAmbiguous) d = [...d].filter((c) => !AMBIGUOUS.includes(c)).join('')
    pools.push(d)
  }
  if (opts.symbols) pools.push(SYMBOLS)
  const all = pools.join('')

  // Guarantee one char from every enabled pool, then fill from the combined pool.
  const chars: string[] = pools.map((p) => pickChar(p))
  while (chars.length < length) chars.push(pickChar(all))
  // Fisher–Yates with crypto randomness.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.slice(0, length).join('')
}

function generatePassphrase(words: number, separator: string, addNumber: boolean, capitalize: boolean): string {
  const parts: string[] = []
  for (let i = 0; i < words; i++) {
    const w = WORDS[secureRandomInt(WORDS.length)]
    parts.push(capitalize ? w[0].toUpperCase() + w.slice(1) : w)
  }
  if (addNumber) parts.splice(secureRandomInt(parts.length + 1), 0, String(secureRandomInt(90) + 10))
  return parts.join(separator)
}

/** Rough entropy in bits — honest and explainable, not a fake score. */
function entropyBits(mode: Mode, length: number, words: number, opts: { upper: boolean; digits: boolean; symbols: boolean }): number {
  if (mode === 'passphrase') return Math.round(words * Math.log2(WORDS.length) + 10)
  let pool = 26 + (opts.upper ? 24 : 0) + (opts.digits ? 8 : 0) + (opts.symbols ? 22 : 0)
  return Math.round(length * Math.log2(pool))
}

function strengthLabel(bits: number): { label: string; className: string; width: number } {
  if (bits >= 100) return { label: 'Excellent', className: 'bg-primary', width: 100 }
  if (bits >= 75) return { label: 'Strong', className: 'bg-primary', width: 80 }
  if (bits >= 55) return { label: 'Decent', className: 'bg-warning', width: 60 }
  return { label: 'Weak', className: 'bg-destructive', width: 35 }
}

interface Options {
  mode: Mode
  length: number
  upper: boolean
  digits: boolean
  symbols: boolean
  noAmbiguous: boolean
  wordCount: number
  separator: string
  addNumber: boolean
  capitalize: boolean
  bulk: number
}

const DEFAULT_OPTIONS: Options = {
  mode: 'password',
  length: 18,
  upper: true,
  digits: true,
  symbols: true,
  noAmbiguous: true,
  wordCount: 4,
  separator: '-',
  addNumber: true,
  capitalize: true,
  bulk: 1,
}

function buildPasswords(o: Options): string[] {
  const count = Math.min(10, Math.max(1, o.bulk))
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(
      o.mode === 'password'
        ? generatePassword(o.length, { upper: o.upper, digits: o.digits, symbols: o.symbols, noAmbiguous: o.noAmbiguous })
        : generatePassphrase(o.wordCount, o.separator, o.addNumber, o.capitalize),
    )
  }
  return out
}

export function PasswordTool() {
  // All options live in one object so every change can regenerate
  // synchronously (event-driven). Generation itself is deferred to the
  // client after mount: randomness during SSR would hydrate differently
  // and tear the tree down.
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTIONS)
  const [passwords, setPasswords] = useState<string[]>([])
  const [copied, setCopied] = useState<number | null>(null)

  const patch = useCallback((p: Partial<Options>) => {
    setOpts((prev) => {
      const next = { ...prev, ...p }
      setPasswords(buildPasswords(next))
      return next
    })
  }, [])

  const regenerate = useCallback(() => {
    setPasswords(buildPasswords(opts))
  }, [opts])

  // First client paint fills the list — the page's purpose is visible
  // immediately, without any server/client mismatch.
  useEffect(() => {
    const t = setTimeout(() => setPasswords(buildPasswords(opts)), 0)
    return () => clearTimeout(t)
  }, [])

  const bits = useMemo(
    () => entropyBits(opts.mode, opts.length, opts.wordCount, { upper: opts.upper, digits: opts.digits, symbols: opts.symbols }),
    [opts],
  )
  const strength = strengthLabel(bits)

  function copy(value: string, index: number) {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(index)
      setTimeout(() => setCopied(null), 1600)
    })
  }

  return (
    <div>
      <div className="mb-4 flex gap-1.5 rounded-full border bg-muted/40 p-1 w-fit" role="tablist" aria-label="Generator mode">
        {(['password', 'passphrase'] as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={opts.mode === m}
            onClick={() => patch({ mode: m })}
            className={
              opts.mode === m
                ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground'
            }
          >
            {m === 'password' ? 'Password' : 'Passphrase'}
          </button>
        ))}
      </div>

      {/* results — the primary content, immediately visible */}
      {passwords.length === 0 ? (
        <div className="space-y-2" aria-hidden="true">
          <div className="h-11 animate-pulse rounded-xl border bg-muted/40" />
          <div className="h-11 animate-pulse rounded-xl border bg-muted/40" />
        </div>
      ) : (
        <ul className="space-y-2">
          {passwords.map((pw, i) => (
            <li key={`${pw}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
              <code className="min-w-0 flex-1 truncate font-mono text-sm" aria-label={`Generated password ${i + 1}`}>
                {pw}
              </code>
              <Button size="sm" variant="ghost" onClick={() => copy(pw, i)}>
                {copied === i ? <Check className="size-4 text-primary" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                <span className="sr-only">Copy password</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* strength */}
      {passwords[0] && (
        <div className="mt-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Strength</span>
            <span className="text-muted-foreground">{bits} bits of entropy — {strength.label}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full transition-all ${strength.className}`} style={{ width: `${strength.width}%` }} />
          </div>
        </div>
      )}

      {/* options */}
      <div className="mt-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4 text-primary" aria-hidden="true" />
            {opts.mode === 'password' ? 'Password options' : 'Passphrase options'}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={regenerate}>
              <RefreshCw className="size-3.5" aria-hidden="true" /> Regenerate
            </Button>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={10}
                value={opts.bulk}
                onChange={(e) => patch({ bulk: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
                aria-label="How many to generate"
                className="h-9 w-16"
              />
              <span className="text-xs text-muted-foreground">at once</span>
            </div>
          </div>
        </div>

        {opts.mode === 'password' ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="pw-length">Length: {opts.length} characters</Label>
              <Slider id="pw-length" min={8} max={64} step={1} value={[opts.length]} onValueChange={([v]) => patch({ length: v })} className="mt-2" />
            </div>
            <span className="flex items-center gap-2">
              <Switch id="pw-upper" checked={opts.upper} onCheckedChange={(v) => patch({ upper: v })} />
              <Label htmlFor="pw-upper">Capital letters</Label>
            </span>
            <span className="flex items-center gap-2">
              <Switch id="pw-digits" checked={opts.digits} onCheckedChange={(v) => patch({ digits: v })} />
              <Label htmlFor="pw-digits">Digits</Label>
            </span>
            <span className="flex items-center gap-2">
              <Switch id="pw-symbols" checked={opts.symbols} onCheckedChange={(v) => patch({ symbols: v })} />
              <Label htmlFor="pw-symbols">Symbols</Label>
            </span>
            <span className="flex items-center gap-2">
              <Switch id="pw-ambig" checked={opts.noAmbiguous} onCheckedChange={(v) => patch({ noAmbiguous: v })} />
              <Label htmlFor="pw-ambig">Avoid look-alikes (l/1, O/0)</Label>
            </span>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pp-words">Words: {opts.wordCount}</Label>
              <Slider id="pp-words" min={3} max={8} step={1} value={[opts.wordCount]} onValueChange={([v]) => patch({ wordCount: v })} className="mt-2" />
            </div>
            <div>
              <Label htmlFor="pp-sep">Separator</Label>
              <Input id="pp-sep" value={opts.separator} maxLength={3} onChange={(e) => patch({ separator: e.target.value })} className="mt-2 w-24" />
            </div>
            <span className="flex items-center gap-2">
              <Switch id="pp-num" checked={opts.addNumber} onCheckedChange={(v) => patch({ addNumber: v })} />
              <Label htmlFor="pp-num">Add a number</Label>
            </span>
            <span className="flex items-center gap-2">
              <Switch id="pp-cap" checked={opts.capitalize} onCheckedChange={(v) => patch({ capitalize: v })} />
              <Label htmlFor="pp-cap">Capitalize words</Label>
            </span>
          </div>
        )}
      </div>

      <PrivacyStrip detail="Every password comes from crypto.getRandomValues in this browser — generated locally, never transmitted, never stored." />
    </div>
  )
}
