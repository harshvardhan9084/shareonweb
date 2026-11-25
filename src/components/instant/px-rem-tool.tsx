'use client'

// CSS unit studio — px / rem / em / % in one live converter, a clamp() fluid
// type builder, and a px→rem quick-reference grid. rem is resolved against
// the root font size, em and % against the context (the font size an element
// inherits from its parent) — both are editable above the converter. The
// math is plain arithmetic recomputed from state on every render, so what
// you see is always consistent with the inputs.

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PrivacyStrip } from '@/components/instant/instant-kit'

type Unit = 'px' | 'rem' | 'em' | '%'

const QUICK_PX = [4, 8, 12, 16, 24, 32, 48, 64, 96]

/** Round to 4 decimals and trim trailing zeros: 1.5 stays "1.5", never "1.50". */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return String(Math.round(n * 10000) / 10000)
}

function num(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function PxRemTool() {
  const [rootRaw, setRootRaw] = useState('16')
  const [ctxRaw, setCtxRaw] = useState('16')
  const [valRaw, setValRaw] = useState('24')
  const [unit, setUnit] = useState<Unit>('px')
  const [cMinRaw, setCMinRaw] = useState('1')
  const [cIdealRaw, setCIdealRaw] = useState('2')
  const [cMaxRaw, setCMaxRaw] = useState('3')
  const [cUnit, setCUnit] = useState<Unit>('rem')
  const [copied, setCopied] = useState(false)

  const rootNum = Number(rootRaw)
  const root = Number.isFinite(rootNum) ? Math.min(40, Math.max(8, rootNum)) : 16
  const ctxNum = Number(ctxRaw)
  const ctx = Number.isFinite(ctxNum) && ctxNum > 0 ? ctxNum : 16
  const val = num(valRaw)

  // Canonical pixel value from the input, then all four equivalents from it.
  const px = unit === 'px' ? val : unit === 'rem' ? val * root : unit === 'em' ? val * ctx : (val / 100) * ctx
  const outPx = px
  const outRem = px / root
  const outEm = px / ctx
  const outPct = (px / ctx) * 100

  const cMin = num(cMinRaw)
  const cIdeal = num(cIdealRaw)
  const cMax = num(cMaxRaw)
  const clampCss = `clamp(${fmt(cMin)}${cUnit}, ${fmt(cIdeal)}${cUnit}, ${fmt(cMax)}${cUnit})`
  const clampInvalid = !(cMin <= cIdeal && cIdeal <= cMax)

  function copyClamp() {
    void navigator.clipboard
      ?.writeText(clampCss)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {
        /* clipboard refused — the CSS line is selectable by hand */
      })
  }

  return (
    <div className="space-y-4">
      {/* A — root & context sizes */}
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="pxrem-root">Root font size</Label>
            <Input
              id="pxrem-root"
              type="number"
              min={8}
              max={40}
              step={0.5}
              value={rootRaw}
              onChange={(e) => setRootRaw(e.target.value)}
              className="mt-1.5 w-28 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="pxrem-ctx">Context size</Label>
            <Input
              id="pxrem-ctx"
              type="number"
              min={1}
              step={0.5}
              value={ctxRaw}
              onChange={(e) => setCtxRaw(e.target.value)}
              className="mt-1.5 w-28 font-mono"
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          rem always resolves against the root font size (typically 16 px). em and % resolve against the context — the font size an element inherits from its parent. For top-level text, context = root; for nested elements, set the inherited size.
        </p>
      </section>

      {/* B — converter */}
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="pxrem-input">Value</Label>
            <Input
              id="pxrem-input"
              type="number"
              step="any"
              value={valRaw}
              onChange={(e) => setValRaw(e.target.value)}
              className="mt-1.5 w-32 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="pxrem-unit">Unit</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <SelectTrigger id="pxrem-unit" className="mt-1.5 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="px">px</SelectItem>
                <SelectItem value="rem">rem</SelectItem>
                <SelectItem value="em">em</SelectItem>
                <SelectItem value="%">%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 rounded-lg border bg-background p-4">
          <p className="text-xs font-semibold text-muted-foreground">All four units</p>
          <p data-testid="pxrem-result" aria-live="polite" className="mt-2 font-mono text-xl leading-loose">
            <span className="font-semibold">{fmt(outPx)}</span>
            <span className="text-muted-foreground"> px</span>
            <span className="text-muted-foreground/60"> · </span>
            <span className="font-semibold">{fmt(outRem)}</span>
            <span className="text-muted-foreground"> rem</span>
            <span className="text-muted-foreground/60"> · </span>
            <span className="font-semibold">{fmt(outEm)}</span>
            <span className="text-muted-foreground"> em</span>
            <span className="text-muted-foreground/60"> · </span>
            <span className="font-semibold">{fmt(outPct)}</span>
            <span className="text-muted-foreground"> %</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Computed against root {fmt(root)} px and context {fmt(ctx)} px — em and % follow the context, rem follows the root.
          </p>
        </div>
      </section>

      {/* C — clamp() builder */}
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="clamp-min">Min</Label>
            <Input
              id="clamp-min"
              type="number"
              step="any"
              value={cMinRaw}
              onChange={(e) => setCMinRaw(e.target.value)}
              className="mt-1.5 w-28 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="clamp-ideal">Ideal</Label>
            <Input
              id="clamp-ideal"
              type="number"
              step="any"
              value={cIdealRaw}
              onChange={(e) => setCIdealRaw(e.target.value)}
              className="mt-1.5 w-28 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="clamp-max">Max</Label>
            <Input
              id="clamp-max"
              type="number"
              step="any"
              value={cMaxRaw}
              onChange={(e) => setCMaxRaw(e.target.value)}
              className="mt-1.5 w-28 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="clamp-unit">Unit</Label>
            <Select value={cUnit} onValueChange={(v) => setCUnit(v as Unit)}>
              <SelectTrigger id="clamp-unit" className="mt-1.5 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="px">px</SelectItem>
                <SelectItem value="rem">rem</SelectItem>
                <SelectItem value="em">em</SelectItem>
                <SelectItem value="%">%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 rounded-lg border bg-background p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">CSS output</p>
            <Button type="button" size="sm" variant="outline" onClick={copyClamp}>
              {copied ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p data-testid="clamp-out" aria-live="polite" className="mt-2 break-words font-mono text-lg leading-relaxed">{clampCss}</p>
          {clampInvalid && (
            <p role="status" className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              min ≤ ideal ≤ max is violated — the browser renders this clamp as written but will not interpolate smoothly between the bounds.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            clamp() uses the ideal value until it would step outside [min, max]. Pair it with viewport units (for example an ideal of 4vw) for fluid scaling between fixed bounds.
          </p>
        </div>
      </section>

      {/* D — quick reference */}
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <p className="text-sm font-semibold">Quick reference — px to rem at {fmt(root)} px root</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {QUICK_PX.map((p) => (
            <div key={p} className="rounded-lg border bg-background px-3 py-2 text-center">
              <p className="font-mono text-sm font-semibold">{fmt(p / root)} rem</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{p} px</p>
            </div>
          ))}
        </div>
      </section>

      <PrivacyStrip detail="The converter and builder run entirely in this tab — plain arithmetic on your numbers, nothing sent or stored." />
    </div>
  )
}
