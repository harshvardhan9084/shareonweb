'use client'

// Classical cipher studio — ROT13, Caesar, Atbash and Vigenère in one page.
// Every transform is plain arithmetic over A–Z with case preserved and every
// non-letter passed through untouched, so encoding and decoding are exact
// inverses. The Caesar brute-force panel answers "what shift was used?" by
// showing all 25 rotations side by side. Nothing leaves the tab.

import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Mode = 'rot13' | 'caesar' | 'atbash' | 'vigenere'
type Dir = 'encode' | 'decode'

const SHIFTS = Array.from({ length: 25 }, (_, i) => i + 1)

/** Shift every A–Z letter by k positions with wraparound; case preserved,
 *  non-letters pass through untouched. Negative k works (used for decode). */
function shiftText(text: string, k: number): string {
  const s = ((k % 26) + 26) % 26
  if (s === 0) return text
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code >= 65 && code <= 90) out += String.fromCharCode(((code - 65 + s) % 26) + 65)
    else if (code >= 97 && code <= 122) out += String.fromCharCode(((code - 97 + s) % 26) + 97)
    else out += ch
  }
  return out
}

/** Mirror the alphabet: A↔Z, B↔Y … Self-inverse by construction. */
function atbash(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code >= 65 && code <= 90) out += String.fromCharCode(90 - (code - 65))
    else if (code >= 97 && code <= 122) out += String.fromCharCode(122 - (code - 97))
    else out += ch
  }
  return out
}

/** Classic Vigenère on an A=0 tabula recta over A–Z only. The key is
 *  uppercased and reduced to its letters; non-letters in the message pass
 *  through and never advance the key index; case is preserved; an empty
 *  key is a no-op. */
function vigenere(text: string, key: string, decode: boolean): string {
  const ks = key.toUpperCase().replace(/[^A-Z]/g, '')
  if (ks === '') return text
  let out = ''
  let ki = 0
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    const upper = code >= 65 && code <= 90
    const lower = code >= 97 && code <= 122
    if (upper || lower) {
      const base = upper ? 65 : 97
      const k = ks.charCodeAt(ki % ks.length) - 65
      ki++
      out += String.fromCharCode(((code - base + (decode ? -k : k)) % 26 + 26) % 26 + base)
    } else {
      out += ch
    }
  }
  return out
}

export function CipherTool() {
  const [mode, setMode] = useState<Mode>('rot13')
  const [dir, setDir] = useState<Dir>('encode')
  const [shift, setShift] = useState(3)
  const [key, setKey] = useState('KEY')
  const [input, setInput] = useState('hello')
  const [copied, setCopied] = useState(false)

  const normShift = ((shift % 26) + 26) % 26
  const cleanKey = key.toUpperCase().replace(/[^A-Z]/g, '')
  const keyIsEmpty = mode === 'vigenere' && cleanKey === ''
  // The rotation actually applied to the text: decode applies the inverse.
  const effectiveShift = mode === 'caesar' && dir === 'decode' ? (26 - normShift) % 26 : normShift

  const output = useMemo(() => {
    if (input === '') return ''
    switch (mode) {
      case 'rot13':
        return shiftText(input, 13)
      case 'caesar':
        return shiftText(input, dir === 'decode' ? -normShift : normShift)
      case 'atbash':
        return atbash(input)
      case 'vigenere':
        return vigenere(input, key, dir === 'decode')
    }
  }, [input, mode, dir, normShift, key])

  const outputLabel =
    mode === 'rot13'
      ? 'ROT13'
      : mode === 'caesar'
        ? dir === 'encode'
          ? `Caesar +${normShift}`
          : `Caesar −${normShift} (decoded)`
        : mode === 'atbash'
          ? 'Atbash mirror'
          : `Vigenère ${dir === 'encode' ? 'encoded' : 'decoded'}`

  function copyOut() {
    void navigator.clipboard
      ?.writeText(output)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {
        /* clipboard refused — the output box is selectable by hand */
      })
  }

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList aria-label="Cipher algorithm">
          <TabsTrigger value="rot13">ROT13</TabsTrigger>
          <TabsTrigger value="caesar">Caesar</TabsTrigger>
          <TabsTrigger value="atbash">Atbash</TabsTrigger>
          <TabsTrigger value="vigenere">Vigenère</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === 'rot13' && (
        <p className="text-xs text-muted-foreground">
          ROT13 shifts every letter 13 places — it is its own inverse, so the same action encodes and decodes.
        </p>
      )}
      {mode === 'atbash' && (
        <p className="text-xs text-muted-foreground">
          Atbash mirrors the alphabet (A↔Z, B↔Y …) — self-inverse by construction.
        </p>
      )}
      {mode === 'caesar' && (
        <p className="text-xs text-muted-foreground">
          Encode shifts letters forward by {normShift}; decode applies the inverse rotation ({(26 - normShift) % 26}), so the same number encrypts and recovers. Non-letters pass through untouched.
        </p>
      )}
      {mode === 'vigenere' && (
        <p className="text-xs text-muted-foreground">
          The key repeats across the message on a classic A=0 tabula recta; spaces and punctuation never advance the key, and only letters in the key are used.
        </p>
      )}

      {(mode === 'caesar' || mode === 'vigenere') && (
        <div className="flex flex-wrap items-end gap-4">
          {mode === 'caesar' && (
            <div>
              <Label htmlFor="cipher-shift">Shift (0–25)</Label>
              <Input
                id="cipher-shift"
                type="number"
                min={0}
                max={25}
                step={1}
                value={shift}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10)
                  setShift(Number.isNaN(n) ? 0 : Math.min(25, Math.max(0, n)))
                }}
                className="mt-1.5 w-24"
              />
            </div>
          )}
          {mode === 'vigenere' && (
            <div>
              <Label htmlFor="cipher-key">Key</Label>
              <Input
                id="cipher-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="e.g. KEY"
                className="mt-1.5 w-44 font-mono"
              />
            </div>
          )}
          <div className="flex gap-1.5 rounded-full border bg-muted/40 p-1" role="tablist" aria-label="Direction">
            {(['encode', 'decode'] as Dir[]).map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={dir === d}
                onClick={() => setDir(d)}
                className={
                  dir === d
                    ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                    : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground'
                }
              >
                {d === 'encode' ? 'Encode' : 'Decode'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <Label htmlFor="cipher-input">Your text</Label>
          <Textarea
            id="cipher-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder="Type or paste text…"
            className="mt-2 min-h-44 font-mono text-sm"
          />
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">{outputLabel}</p>
            <Button type="button" size="sm" variant="ghost" disabled={!output} onClick={copyOut}>
              {copied ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="mt-2 rounded-lg border bg-background p-4">
            <p data-testid="cipher-out" aria-live="polite" className="empty:hidden break-words font-mono text-lg leading-relaxed">{output}</p>
            {output === '' && (
              <p aria-hidden="true" className="font-mono text-lg text-muted-foreground/50">the transformed text appears here as you type</p>
            )}
          </div>
          {keyIsEmpty && (
            <p role="status" className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Key is empty — output matches the input
            </p>
          )}
        </div>
      </div>

      {mode === 'caesar' && input.trim() !== '' && (
        <section data-testid="caesar-brute" aria-label="All Caesar shifts of your text" className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">Every Caesar shift of your text</p>
            <p className="text-xs text-muted-foreground">Scan the rows for readable English — the highlighted row is your current setting.</p>
          </div>
          <div className="mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-lg border bg-background">
            {SHIFTS.map((n) => {
              const current = n === effectiveShift
              return (
                <div key={n} aria-current={current ? 'true' : undefined} className={cn('flex gap-3 px-3 py-1.5', current && 'bg-primary/10')}>
                  <span className={cn('w-20 shrink-0 pt-0.5 font-mono text-xs', current ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                    Shift {n}
                  </span>
                  <span className="min-w-0 flex-1 break-words font-mono text-xs leading-relaxed">{shiftText(input, n)}</span>
                </div>
              )
            })}
          </div>
          {effectiveShift === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Shift 0 (and decode of 0) leaves the text unchanged, so no row is highlighted.</p>
          )}
        </section>
      )}

      <PrivacyStrip detail="Every shift, mirror and key runs in this tab with plain JavaScript — your text is never sent anywhere and nothing is stored." />
    </div>
  )
}
