'use client'

// Barcode Studio — scannable Code 128 and EAN-13 barcodes rendered locally
// with JsBarcode into crisp SVG, exportable as SVG or PNG. Validation is
// honest: EAN-13 requires 12 or 13 digits (12 get the check digit computed
// and appended, 13 are verified against the mod-10 rule with the exact
// position named on failure), Code 128 accepts any Latin-1 text and reports
// characters outside its alphabet. Nothing leaves the device.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Download, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { PrivacyStrip, downloadBlob } from '@/components/instant/instant-kit'

type Format = 'CODE128' | 'EAN13'

type JsBarcodeFn = (
  element: SVGSVGElement,
  text: string,
  options: Record<string, unknown>,
) => void

interface Build {
  ok: boolean
  error?: string
  /** The value actually encoded (after checksum completion). */
  value?: string
  /** Inflated width/height of the rendered SVG. */
  width?: number
  height?: number
}

/** EAN-13 mod-10 check digit: odd positions (1st, 3rd, …) ×1, even ×3.
 *  Takes the first 12 digits and returns the 13th. */
function ean13Check(digits12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = Number(digits12[i])
    sum += i % 2 === 0 ? d : d * 3
  }
  return (10 - (sum % 10)) % 10
}

function renderBarcode(
  svg: SVGSVGElement,
  JsBarcode: JsBarcodeFn,
  format: Format,
  raw: string,
  barWidth: number,
  height: number,
  showValue: boolean,
): Build {
  svg.replaceChildren() // clear previous render
  // JsBarcode throws on invalid input by default — caught by the caller.
  JsBarcode(svg, raw, {
    format,
    width: barWidth,
    height,
    displayValue: showValue,
    fontSize: 14,
    fontOptions: 'monospace',
    margin: 12,
    lineColor: '#0c1210',
    background: 'transparent',
  })
  const w = Number(svg.getAttribute('width') ?? 0)
  const h = Number(svg.getAttribute('height') ?? 0)
  return { ok: true, value: raw, width: w, height: h }
}

export function BarcodeTool() {
  const [format, setFormat] = useState<Format>('CODE128')
  const [raw, setRaw] = useState('Kontivo-2026')
  const [barWidth, setBarWidth] = useState(2)
  const [height, setHeight] = useState(90)
  const [showValue, setShowValue] = useState(true)
  const [copied, setCopied] = useState(false)

  const svgRef = useRef<SVGSVGElement>(null)
  const libRef = useRef<JsBarcodeFn | null>(null)
  const [libReady, setLibReady] = useState(false)
  const [build, setBuild] = useState<Build>({ ok: false })

  // Lazy import: the encoder (~30 KB) loads once, on first use of the page.
  useEffect(() => {
    let alive = true
    import('jsbarcode').then((mod) => {
      if (!alive) return
      libRef.current = mod.default as unknown as JsBarcodeFn
      setLibReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  // EAN-13 helpers computed from the raw input, shown as guidance.
  const digitsOnly = useMemo(() => raw.replace(/\s+/g, ''), [raw])

  const validation = useMemo<{ error?: string; completed?: string }>(() => {
    if (format === 'CODE128') {
      if (!raw) return { error: 'Type the content to encode.' }
      // Code 128 (subset auto) covers ASCII 0–127; JsBarcode rejects the rest.
      for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i)
        if (code > 127) {
          return { error: `“${raw[i]}” at position ${i + 1} is outside the Code 128 alphabet (ASCII 0–127).` }
        }
      }
      return {}
    }
    // EAN-13
    if (!/^\d+$/.test(digitsOnly)) {
      const pos = [...digitsOnly].findIndex((c) => !/\d/.test(c))
      return { error: pos >= 0 ? `Non-digit “${digitsOnly[pos]}” at position ${pos + 1} — EAN-13 uses digits only.` : 'EAN-13 uses digits only.' }
    }
    if (digitsOnly.length === 12) {
      const completed = digitsOnly + String(ean13Check(digitsOnly))
      return { completed }
    }
    if (digitsOnly.length !== 13) {
      return { error: `EAN-13 takes exactly 12 digits (check digit computed) or all 13 — you have ${digitsOnly.length}.` }
    }
    const expected = ean13Check(digitsOnly.slice(0, 12))
    if (Number(digitsOnly[12]) !== expected) {
      return { error: `Check digit is wrong: position 13 should be ${expected}, not ${digitsOnly[12]}.` }
    }
    return {}
  }, [format, raw, digitsOnly])

  const valueToEncode = format === 'EAN13' ? (validation.completed ?? digitsOnly) : raw

  const rerender = useCallback(() => {
    const svg = svgRef.current
    const JsBarcode = libRef.current
    if (!svg || !JsBarcode) return
    if (!valueToEncode) {
      setBuild({ ok: false, error: validation.error ?? 'Type the content to encode.' })
      return
    }
    try {
      const result = renderBarcode(svg, JsBarcode, format, valueToEncode, barWidth, height, showValue)
      setBuild(result)
    } catch {
      setBuild({ ok: false, error: validation.error ?? 'This value cannot be encoded with the chosen format.' })
    }
  }, [format, valueToEncode, barWidth, height, showValue, validation.error])

  useEffect(() => {
    if (libReady) rerender()
  }, [libReady, rerender])

  const exportSvg = () => {
    const svg = svgRef.current
    if (!svg || !build.ok) return
    const xml = new XMLSerializer().serializeToString(svg)
    downloadBlob(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], { type: 'image/svg+xml' }), `barcode-${Date.now()}.svg`)
  }

  const exportPng = () => {
    const svg = svgRef.current
    if (!svg || !build.ok) return
    const xml = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const scale = 3 // print-safe density
      const canvas = document.createElement('canvas')
      canvas.width = (build.width ?? img.width) * scale
      canvas.height = (build.height ?? img.height) * scale
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          if (blob) downloadBlob(blob, `barcode-${Date.now()}.png`)
        }, 'image/png')
      }
      URL.revokeObjectURL(url)
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(valueToEncode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard refused */
    }
  }

  return (
    <div className="space-y-4">
      {/* controls */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bc-format">Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger id="bc-format" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CODE128">Code 128 (any text, packages & logistics)</SelectItem>
                <SelectItem value="EAN13">EAN-13 (retail products, 12–13 digits)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc-value">
              {format === 'EAN13' ? 'Digits (12 → check digit added, 13 verified)' : 'Content'}
            </Label>
            <Input
              id="bc-value"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={format === 'EAN13' ? '4006381333931' : 'Kontivo-2026'}
              className={format === 'EAN13' ? 'font-mono' : undefined}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="bc-width">Bar width — {barWidth}×</Label>
            <Slider id="bc-width" min={1} max={4} step={1} value={[barWidth]} onValueChange={([v]) => setBarWidth(v)} className="mt-2" />
          </div>
          <div>
            <Label htmlFor="bc-height">Height — {height}px</Label>
            <Slider id="bc-height" min={40} max={200} step={5} value={[height]} onValueChange={([v]) => setHeight(v)} className="mt-2" />
          </div>
          <label className="flex items-center gap-2.5 pt-5 text-sm">
            <Switch checked={showValue} onCheckedChange={setShowValue} aria-label="Show human-readable value" />
            <span>Show value under bars</span>
          </label>
        </div>

        {validation.error ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {validation.error}
          </p>
        ) : null}
        {validation.completed ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Check digit for the first 12 digits: <span className="font-mono font-semibold text-foreground">{validation.completed}</span> — encoded with it appended.
          </p>
        ) : null}

        <PrivacyStrip detail="The barcode is drawn in this tab from your text. No account, no lookup service, nothing sent anywhere — and the SVG export is vector, so it prints cleanly at any size." />
      </div>

      {/* output */}
      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            {build.ok ? `${format === 'EAN13' ? 'EAN-13' : 'Code 128'} · encoded: ${build.value}` : 'No barcode'}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyValue} disabled={!build.ok}>
              {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy value'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportSvg} disabled={!build.ok}>
              <Download className="size-3.5" aria-hidden="true" /> SVG
            </Button>
            <Button type="button" size="sm" onClick={exportPng} disabled={!build.ok}>
              <Download className="size-3.5" aria-hidden="true" /> PNG (3×)
            </Button>
          </div>
        </div>
        <div className="flex min-h-[220px] items-center justify-center overflow-x-auto bg-white/40 p-6 dark:bg-white/5">
          {build.ok ? (
            <svg ref={svgRef} role="img" aria-label="Barcode preview" />
          ) : (
            <svg ref={svgRef} className="hidden" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  )
}
