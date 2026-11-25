'use client'

// Number to Words — figures into words, the way a bank cheque needs them.
// Two numbering systems (international short scale: thousand/million/billion;
// Indian: thousand/lakh/crore) and several currency framings, with the
// decimals rendered as cents/paise and the classic "… only" cheque line.
// The conversion runs on this device; nothing is submitted anywhere.

import { useMemo, useState } from 'react'
import { Banknote } from 'lucide-react'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/** 0–999 into words, US cheque style (no “and” between hundreds and tens). */
function threeDigits(n: number): string {
  const parts: string[] = []
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (hundreds > 0) {
    parts.push(ONES[hundreds], 'hundred')
  }
  if (rest > 0) {
    if (rest < 20) parts.push(ONES[rest])
    else {
      const tens = TENS[Math.floor(rest / 10)]
      const ones = rest % 10
      // One element, so the join never inserts a space inside "twenty-one".
      parts.push(ones > 0 ? `${tens}-${ONES[ones]}` : tens)
    }
  }
  return parts.join(' ')
}

/** Indian system: groups of 2 after the first 3 (lakh, crore, arab…). */
const INDIAN_GROUPS = ['', 'thousand', 'lakh', 'crore', 'arab']

function intToWordsIndian(n: number): string {
  if (n === 0) return 'zero'
  const groups: number[] = []
  // First group of 3, then groups of 2.
  groups.push(n % 1000)
  let rest = Math.floor(n / 1000)
  while (rest > 0) {
    groups.push(rest % 100)
    rest = Math.floor(rest / 100)
  }
  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]
    if (g === 0) continue
    parts.push(threeDigits(g), INDIAN_GROUPS[i] ?? '')
  }
  return parts.filter(Boolean).join(' ').trim()
}

/** International short scale: groups of 3 (thousand, million, billion…). */
const INTL_GROUPS = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion']

function intToWordsIntl(n: number): string {
  if (n === 0) return 'zero'
  const groups: number[] = []
  let rest = n
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }
  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]
    if (g === 0) continue
    parts.push(threeDigits(g), INTL_GROUPS[i] ?? '')
  }
  return parts.filter(Boolean).join(' ').trim()
}

type System = 'intl' | 'indian'

interface CurrencyStyle {
  id: string
  label: string
  major: string        // "dollars"
  minor: string        // "cents"
  /** Word for the whole-amount line in the cheque style ("Rupees"). */
  cheque: string
}

const CURRENCIES: CurrencyStyle[] = [
  { id: 'none', label: 'Plain number', major: '', minor: '', cheque: '' },
  { id: 'usd', label: 'USD — dollars', major: 'dollars', minor: 'cents', cheque: 'Dollars' },
  { id: 'eur', label: 'EUR — euros', major: 'euros', minor: 'cents', cheque: 'Euros' },
  { id: 'gbp', label: 'GBP — pounds', major: 'pounds', minor: 'pence', cheque: 'Pounds' },
  { id: 'inr', label: 'INR — rupees', major: 'rupees', minor: 'paise', cheque: 'Rupees' },
]

const MAX_INT = Number.MAX_SAFE_INTEGER // 9,007,199,254,740,991

export function NumberToWordsTool() {
  const [input, setInput] = useState('')
  const [system, setSystem] = useState<System>('intl')
  const [currency, setCurrency] = useState('usd')

  const result = useMemo(() => {
    const raw = input.trim().replace(/,/g, '').replace(/^\$/, '').replace(/[₹€]/, '')
    if (raw === '') return null
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(raw)) {
      return { error: 'Enter a plain number — digits, an optional decimal point, an optional leading sign. Commas and currency symbols are stripped automatically.' }
    }
    const negative = raw.startsWith('-')
    const digits = raw.replace(/^[+-]/, '')
    const [intPart, decPart = ''] = digits.split('.')
    const intVal = Number(intPart === '' ? '0' : intPart)
    if (!Number.isFinite(intVal) || intVal > MAX_INT) {
      return { error: 'This number is beyond what the words can carry — the limit is 9,007,199,254,740,991 (the JavaScript safe-integer maximum, about nine quadrillion).' }
    }
    // Decimals: keep up to two places (cheques carry two). ".5" reads as
    // 50 cents; ".05" as 5; a third decimal is truncated, never rounded —
    // a cheque amount must not silently change value.
    let cents: string
    if (decPart === '') cents = '0'
    else if (decPart.length === 1) cents = decPart + '0'
    else cents = decPart.slice(0, 2)
    const centsVal = Number(cents === '' ? '0' : cents)

    const words = system === 'indian' ? intToWordsIndian(intVal) : intToWordsIntl(intVal)
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

    const cur = CURRENCIES.find((c) => c.id === currency)!
    const moneyLine =
      cur.major === ''
        ? cap(words) + (centsVal > 0 ? ` point ${intToWordsIntl(centsVal)}` : '')
        : centsVal === 0
          ? `${cap(words)} ${cur.major} only`
          : `${cap(words)} ${cur.major} and ${intToWordsIntl(centsVal)} ${cur.minor} only`

    return {
      negative,
      words,
      moneyLine: (negative ? 'minus ' : '') + moneyLine,
      cents: centsVal,
      truncated: decPart.length > 2,
    }
  }, [input, system, currency])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="ntw-input" className="text-sm font-semibold">
            Amount in figures
          </label>
          <div className="flex flex-wrap gap-1.5">
            <div className="flex gap-1.5" role="group" aria-label="Numbering system">
              {(
                [
                  ['intl', 'International'],
                  ['indian', 'Indian (lakh / crore)'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSystem(key)}
                  aria-pressed={system === key}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    system === key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <input
          id="ntw-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. 1234567.89"
          className="mt-2 h-11 w-full rounded-md border bg-background px-3.5 font-mono text-base"
        />
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Currency framing">
          {CURRENCIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCurrency(c.id)}
              aria-pressed={currency === c.id}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                currency === c.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {result === null ? (
        <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
          Type a number above — the words appear here as you type, with the cheque line ready to copy.
        </p>
      ) : 'error' in result ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
          {result.error}
        </p>
      ) : (
        <div className="rounded-xl border bg-card p-4 sm:p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <Banknote className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">Cheque line</p>
              <p className="mt-1 break-words text-lg font-semibold leading-snug" data-testid="money-line">
                {result.moneyLine}
              </p>
            </div>
          </div>
          <div className="mt-4 border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Plain words ({system === 'indian' ? 'Indian system — thousand, lakh, crore' : 'international short scale — thousand, million, billion'})
            </p>
            <p className="mt-1 break-words text-sm leading-relaxed">
              {(result.negative ? 'minus ' : '') + result.words}
              {result.cents > 0 ? ` · ${String(result.cents).padStart(2, '0')}/100` : ''}
            </p>
          </div>
          {result.truncated && (
            <p className="mt-3 text-xs text-muted-foreground" role="status">
              Note: your amount has more than two decimal places. Cheques carry two, so the extra digits were cut off — not rounded — so the written amount matches the figures exactly.
            </p>
          )}
        </div>
      )}

      <PrivacyStrip detail="The conversion runs on this device: the number you type never leaves this tab, and the words are built by the mapping rules on this page — no dictionary service, no submission." />
    </div>
  )
}
