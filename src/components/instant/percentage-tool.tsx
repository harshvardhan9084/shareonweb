'use client'

// Percentage Studio — six live percentage calculators on one page. Each mode
// shows the formula it used, so every answer can be checked on sight. All
// arithmetic is plain JS in this tab; there is nothing to upload.

import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Mode = 'of' | 'share' | 'change' | 'discount' | 'tip' | 'tax'

const MODES: Array<{ id: Mode; label: string; question: string }> = [
  { id: 'of', label: 'X% of Y', question: 'What is X% of Y?' },
  { id: 'share', label: 'X is what % of Y', question: 'X is what percent of Y?' },
  { id: 'change', label: '% change', question: 'What is the percent change from X to Y?' },
  { id: 'discount', label: 'Discount', question: 'What does X% off cost?' },
  { id: 'tip', label: 'Tip & split', question: 'Tip on the bill, split by the group?' },
  { id: 'tax', label: 'Sales tax / VAT', question: 'Add or extract tax on a price?' },
]

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(n: number, digits = 4): string {
  const rounded = Number(n.toFixed(digits))
  return `${rounded.toLocaleString('en-US', { maximumFractionDigits: digits })}%`
}

interface Row { label: string; value: string; formula?: string; primary?: boolean }

function ResultRow({ row, onCopy }: { row: Row; onCopy: (v: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCopy(row.value)}
      className={cn(
        'flex w-full items-start justify-between gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors hover:bg-muted/50',
        row.primary && 'border-primary/40 bg-primary/5',
      )}
      aria-label={`Copy ${row.label}: ${row.value}`}
    >
      <span className="min-w-0">
        <span className={cn('block text-xs font-medium text-muted-foreground', row.primary && 'text-primary')}>{row.label}</span>
        <span className={cn('block font-mono text-lg font-semibold tabular-nums', row.primary && 'text-primary')}>
          {row.value}
        </span>
        {row.formula && <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{row.formula}</span>}
      </span>
      <Copy className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  )
}

export function PercentageTool() {
  const [mode, setMode] = useState<Mode>('of')
  const [a, setA] = useState('25') // X / from / price / bill — mode-dependent label
  const [b, setB] = useState('120') // Y / to / % / —
  const [tipSplit, setTipSplit] = useState('4')
  const [tipRound, setTipRound] = useState(false)
  const [taxExtract, setTaxExtract] = useState(false)
  const [copied, setCopied] = useState('')

  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v)
      setCopied(v)
      setTimeout(() => setCopied(''), 1400)
    } catch {
      /* selection copy still possible by hand */
    }
  }

  const na = Number(a)
  const nb = Number(b)
  const nSplit = Number(tipSplit)
  const valid = { a: a.trim() !== '' && Number.isFinite(na), b: b.trim() !== '' && Number.isFinite(nb) }

  const rows = useMemo<Row[]>(() => {
    switch (mode) {
      case 'of': {
        if (!valid.a || !valid.b) return []
        const r = (na / 100) * nb
        return [
          { label: `${pct(na)} of ${nb.toLocaleString('en-US')}`, value: Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/\.?0+$/, ''), formula: `X% × Y = (${na} ÷ 100) × ${nb}`, primary: true },
          { label: 'Y minus that (remaining)', value: String(Number((nb - r).toFixed(6))), formula: `Y − result = ${nb} − ${r.toFixed(4)}` },
          { label: 'Y plus that (increased)', value: String(Number((nb + r).toFixed(6))), formula: `Y + result = ${nb} + ${r.toFixed(4)}` },
        ]
      }
      case 'share': {
        if (!valid.a || !valid.b) return []
        if (nb === 0) return [{ label: 'Answer', value: 'undefined', formula: 'Y is 0 — a share of zero cannot be computed' }]
        const r = (na / nb) * 100
        return [
          { label: `${na.toLocaleString('en-US')} is this percent of ${nb.toLocaleString('en-US')}`, value: pct(r), formula: `(X ÷ Y) × 100 = (${na} ÷ ${nb}) × 100`, primary: true },
          { label: 'As a plain fraction', value: `${na} ÷ ${nb} = ${(na / nb).toFixed(6).replace(/\.?0+$/, '')}` },
        ]
      }
      case 'change': {
        if (!valid.a || !valid.b) return []
        if (na === 0) return [{ label: 'Answer', value: 'undefined', formula: 'A change from 0 has no meaningful percent — the base is zero' }]
        const r = ((nb - na) / Math.abs(na)) * 100
        const dir = r > 0 ? 'increase' : r < 0 ? 'decrease' : 'no change'
        return [
          { label: `Percent ${dir} from ${na.toLocaleString('en-US')} to ${nb.toLocaleString('en-US')}`, value: `${r > 0 ? '+' : ''}${pct(r)}`, formula: `(New − Old) ÷ |Old| × 100 = (${nb} − ${na}) ÷ ${Math.abs(na)} × 100`, primary: true },
          { label: 'Absolute difference', value: String(Number((nb - na).toFixed(6))), formula: `New − Old = ${nb} − ${na}` },
        ]
      }
      case 'discount': {
        if (!valid.a || !valid.b) return []
        const save = (na * nb) / 100
        const final = na - save
        return [
          { label: 'You pay', value: money(final), formula: `Price × (1 − %off ÷ 100) = ${na} × (1 − ${nb} ÷ 100)`, primary: true },
          { label: 'You save', value: money(save), formula: `Price × %off ÷ 100 = ${na} × ${nb} ÷ 100` },
        ]
      }
      case 'tip': {
        if (!valid.a || !valid.b) return []
        const tip = (na * nb) / 100
        const total = na + tip
        const per = nSplit > 0 ? total / nSplit : null
        const rowsOut: Row[] = [
          { label: 'Tip amount', value: money(tipRound ? Math.ceil(tip) : tip), formula: `Bill × tip% ÷ 100 = ${na} × ${nb} ÷ 100${tipRound ? ' (rounded up)' : ''}` },
          { label: 'Total with tip', value: money(tipRound ? na + Math.ceil(tip) : total), formula: `Bill + tip = ${na} + ${tipRound ? Math.ceil(tip) : tip.toFixed(2)}`, primary: true },
        ]
        if (per !== null) rowsOut.push({ label: `Each of ${nSplit} pays`, value: money(tipRound ? (na + Math.ceil(tip)) / nSplit : per), formula: `Total ÷ people = ${(tipRound ? na + Math.ceil(tip) : total).toFixed(2)} ÷ ${nSplit}` })
        return rowsOut
      }
      case 'tax': {
        if (!valid.a || !valid.b) return []
        if (taxExtract) {
          const net = na / (1 + nb / 100)
          const tax = na - net
          return [
            { label: 'Net price (before tax)', value: money(net), formula: `Gross ÷ (1 + rate) = ${na} ÷ (1 + ${nb} ÷ 100)`, primary: true },
            { label: 'Tax contained in the gross', value: money(tax), formula: `Gross − net = ${na} − ${net.toFixed(2)}` },
          ]
        }
        const tax = (na * nb) / 100
        return [
          { label: 'Gross price (with tax)', value: money(na + tax), formula: `Net × (1 + rate ÷ 100) = ${na} × (1 + ${nb} ÷ 100)`, primary: true },
          { label: 'Tax added', value: money(tax), formula: `Net × rate ÷ 100 = ${na} × ${nb} ÷ 100` },
        ]
      }
    }
  }, [mode, a, b, tipSplit, tipRound, taxExtract, na, nb, nSplit, valid])

  const labelA: Record<Mode, string> = {
    of: 'X — the percent',
    share: 'X — the part',
    change: 'Old value',
    discount: 'Price',
    tip: 'Bill amount',
    tax: taxExtract ? 'Gross price (tax included)' : 'Net price (before tax)',
  }
  const labelB: Record<Mode, string> = {
    of: 'Y — the whole',
    share: 'Y — the whole',
    change: 'New value',
    discount: '% off',
    tip: 'Tip percent',
    tax: 'Tax / VAT rate %',
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        {/* mode tabs */}
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Percentage mode">
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

        <p className="mt-3 text-sm font-medium">{MODES.find((m) => m.id === mode)!.question}</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pct-a">{labelA[mode]}</Label>
            <Input id="pct-a" type="number" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pct-b">{labelB[mode]}</Label>
            <Input id="pct-b" type="number" inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} className="font-mono" />
          </div>
          {mode === 'tip' && (
            <div className="space-y-1.5">
              <Label htmlFor="pct-split">People splitting</Label>
              <Input id="pct-split" type="number" min={1} value={tipSplit} onChange={(e) => setTipSplit(e.target.value)} className="font-mono" />
            </div>
          )}
          {mode === 'tax' && (
            <label className="flex items-center gap-2.5 pt-5 text-sm">
              <Switch checked={taxExtract} onCheckedChange={setTaxExtract} aria-label="Extract tax from gross" />
              <span>Extract from gross</span>
            </label>
          )}
          {mode === 'tip' && (
            <label className="flex items-center gap-2.5 pt-5 text-sm">
              <Switch checked={tipRound} onCheckedChange={setTipRound} aria-label="Round tip up" />
              <span>Round tip up</span>
            </label>
          )}
        </div>
        <PrivacyStrip detail="The arithmetic happens in this tab as you type, using the formulas printed under each result. Nothing is stored, nothing is sent." />
      </div>

      {/* results */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Results — tap any card to copy its value</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Fill both fields to see results.</p>
        ) : (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {rows.map((r) => (
              <ResultRow key={r.label} row={r} onCopy={copy} />
            ))}
          </div>
        )}
        {copied && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-primary" role="status">
            <Check className="size-3.5" aria-hidden="true" /> Copied {copied}
          </p>
        )}
      </div>
    </div>
  )
}
