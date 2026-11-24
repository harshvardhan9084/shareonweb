'use client'

// Color Studio — convert any CSS color into every format, sample colors from
// an image or the screen (EyeDropper where the browser offers it), test WCAG
// contrast, and build palettes with real HSL math. All conversions are plain
// arithmetic in this tab; images you sample are never uploaded.

import { useCallback, useMemo, useRef, useState } from 'react'
import { Pipette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

// ------------------------------------------------------------------- model ---

interface Rgba { r: number; g: number; b: number; a: number }

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Parse #abc, #abcd, #aabbcc, #aabbccdd, rgb()/rgba(), hsl()/hsla(), or bare components. */
function parseColor(input: string): { color: Rgba; error: string } {
  const s = input.trim().toLowerCase()
  if (!s) return { color: { r: 247, g: 122, b: 69, a: 1 }, error: '' }
  // hex
  const hex = /^#?([0-9a-f]{3,8})$/.exec(s.replace(/\s/g, ''))
  if (hex && /^#/.test(s)) {
    const h = hex[1]
    if (h.length === 3 || h.length === 4) {
      const [r, g, b, a] = h.split('').map((c) => parseInt(c + c, 16))
      return { color: { r, g, b, a: a === undefined ? 1 : a / 255 }, error: '' }
    }
    if (h.length === 6 || h.length === 8) {
      return {
        color: {
          r: parseInt(h.slice(0, 2), 16),
          g: parseInt(h.slice(2, 4), 16),
          b: parseInt(h.slice(4, 6), 16),
          a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
        },
        error: '',
      }
    }
    return { color: null as unknown as Rgba, error: 'Hex needs 3, 4, 6 or 8 digits.' }
  }
  // rgb(a)
  const rgb = /^rgba?\(\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(s)
  if (rgb) {
    const ch = (v: string) => (v.endsWith('%') ? (Number.parseFloat(v) / 100) * 255 : Number.parseFloat(v))
    const alpha = (v?: string) => (v === undefined ? 1 : v.endsWith('%') ? Number.parseFloat(v) / 100 : Number.parseFloat(v))
    const color = { r: Math.round(clamp(ch(rgb[1]), 0, 255)), g: Math.round(clamp(ch(rgb[2]), 0, 255)), b: Math.round(clamp(ch(rgb[3]), 0, 255)), a: clamp(alpha(rgb[4]), 0, 1) }
    if (!Number.isFinite(color.r) || !Number.isFinite(color.g) || !Number.isFinite(color.b)) return { color: null as unknown as Rgba, error: 'rgb() components must be numbers.' }
    return { color, error: '' }
  }
  // hsl(a)
  const hsl = /^hsla?\(\s*([\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(s)
  if (hsl) {
    const h = Number.parseFloat(hsl[1])
    const sat = Number.parseFloat(hsl[2]) / 100
    const l = Number.parseFloat(hsl[3]) / 100
    const alpha = (v?: string) => (v === undefined ? 1 : v.endsWith('%') ? Number.parseFloat(v) / 100 : Number.parseFloat(v))
    if (sat < 0 || sat > 1 || l < 0 || l > 1) return { color: null as unknown as Rgba, error: 'hsl() percentages must stay between 0 and 100.' }
    const { r, g, b } = hslToRgb(h, sat, l)
    return { color: { r, g, b, a: clamp(alpha(hsl[4]), 0, 1) }, error: '' }
  }
  return { color: null as unknown as Rgba, error: 'Not a color I can read — try #ff7a45, rgb(255 122 69) or hsl(18 100% 64%).' }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360 / 360
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  return {
    r: Math.round(channel(hh + 1 / 3) * 255),
    g: Math.round(channel(hh) * 255),
    b: Math.round(channel(hh - 1 / 3) * 255),
  }
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) * 60
  else if (max === gg) h = ((bb - rr) / d + 2) * 60
  else h = ((rr - gg) / d + 4) * 60
  return { h, s, l }
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0')

// --------------------------------------------------------------- WCAG math ---

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function relativeLuminance({ r, g, b }: Rgba): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

// --------------------------------------------------------------------- ui ----

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        } catch { /* manual copy still possible */ }
      }}
      className="flex w-full items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-left font-mono text-sm hover:bg-muted/60"
      aria-label={`Copy ${label}: ${value}`}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
      <span className={cn('shrink-0 text-[10px] uppercase', copied ? 'text-primary' : 'text-muted-foreground/60')}>{copied ? 'copied' : 'copy'}</span>
    </button>
  )
}

export function ColorTool() {
  const [input, setInput] = useState('#0f766e')
  const [bgInput, setBgInput] = useState('#ffffff')
  const [imageMsg, setImageMsg] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasImage, setHasImage] = useState(false)

  const parsed = useMemo(() => parseColor(input), [input])
  const bgParsed = useMemo(() => parseColor(bgInput), [bgInput])
  const color = parsed.error ? null : parsed.color
  const bg = bgParsed.error ? null : bgParsed.color

  const formats = useMemo(() => {
    if (!color) return []
    const hsl = rgbToHsl(color.r, color.g, color.b)
    const hexStr = color.a < 1
      ? `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}${hex2(Math.round(color.a * 255))}`
      : `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`
    return [
      { label: 'HEX', value: hexStr },
      { label: 'RGB', value: color.a < 1 ? `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})` : `rgb(${color.r}, ${color.g}, ${color.b})` },
      { label: 'HSL', value: color.a < 1 ? `hsla(${hsl.h.toFixed(0)}, ${(hsl.s * 100).toFixed(0)}%, ${(hsl.l * 100).toFixed(0)}%, ${color.a})` : `hsl(${hsl.h.toFixed(0)}, ${(hsl.s * 100).toFixed(0)}%, ${(hsl.l * 100).toFixed(0)}%)` },
      { label: 'RGB components', value: `${color.r}, ${color.g}, ${color.b}` },
      { label: 'HSL components', value: `${hsl.h.toFixed(1)}°, ${(hsl.s * 100).toFixed(1)}%, ${(hsl.l * 100).toFixed(1)}%` },
    ]
  }, [color])

  const ratio = useMemo(() => (color && bg ? contrastRatio(color, bg) : null), [color, bg])

  // palette: tints/shades + harmonies via real HSL rotation
  const palette = useMemo(() => {
    if (!color) return null
    const { h, s, l } = rgbToHsl(color.r, color.g, color.b)
    const ramp = Array.from({ length: 9 }, (_, i) => {
      const li = clamp(0.08 + i * 0.105, 0.08, 0.95)
      return hslToRgb(h, s, li)
    })
    const harmony = (dh: number) => hslToRgb(h + dh, s, l)
    return {
      ramp,
      harmonies: [
        { name: 'Complementary', colors: [color, harmony(180)] },
        { name: 'Analogous', colors: [harmony(-30), color, harmony(30)] },
        { name: 'Triadic', colors: [color, harmony(120), harmony(240)] },
      ],
    }
  }, [color])

  const eyeDropperSupported = typeof window !== 'undefined' && 'EyeDropper' in window

  const pickScreen = useCallback(async () => {
    try {
      const Ctor = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
      const result = await new Ctor().open()
      setInput(result.sRGBHex)
    } catch {
      /* dismissed — nothing changes */
    }
  }, [])

  const sampleAt = useCallback((x: number, y: number, commit: boolean) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data
    const hexStr = `#${hex2(d[0])}${hex2(d[1])}${hex2(d[2])}`
    if (commit) {
      setInput(hexStr)
      setImageMsg(`Sampled ${hexStr} — now the working color.`)
    }
    return hexStr
  }, [])

  const loadImage = useCallback((file: File) => {
    setImageMsg('')
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const maxW = 720
      const scale = Math.min(1, maxW / img.width)
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
      setHasImage(true)
      URL.revokeObjectURL(url)
      setImageMsg('Hover the image to inspect, click to commit a color.')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setImageMsg('That file could not be drawn — is it a real image?')
    }
    img.src = url
  }, [])

  return (
    <div className="space-y-4">
      {/* -------------------------------------------------------- convert */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-1.5">
            <Label htmlFor="color-input">Any format — hex, rgb(), hsl(), with or without alpha</Label>
            <Input
              id="color-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="font-mono"
              spellCheck={false}
              autoComplete="off"
            />
            {parsed.error && <p className="text-sm text-destructive" role="alert">{parsed.error}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {eyeDropperSupported && (
                <Button type="button" variant="outline" size="sm" onClick={pickScreen}>
                  <Pipette className="size-3.5" aria-hidden="true" /> Pick from screen
                </Button>
              )}
              <label>
                <span className="sr-only">Load an image to sample colors from</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) loadImage(f)
                    e.target.value = ''
                  }}
                  id="color-image-file"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('color-image-file')?.click()}>
                  <Pipette className="size-3.5" aria-hidden="true" /> Sample from an image
                </Button>
              </label>
            </div>
            {imageMsg && <p className="text-xs text-muted-foreground">{imageMsg}</p>}
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              className="relative h-28 w-full rounded-xl border"
              style={{ backgroundColor: formats[0]?.value ?? 'transparent' }}
              role="img"
              aria-label={`Swatch of the current color: ${formats[0]?.value ?? 'none'}`}
            >
              <span className="absolute bottom-2 right-3 rounded bg-black/30 px-1.5 py-0.5 text-xs text-white">{formats[0]?.value}</span>
            </div>
            <span className="text-xs text-muted-foreground">Live swatch</span>
          </div>
        </div>

        {formats.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {formats.map((f) => (
              <CopyRow key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        )}
        <PrivacyStrip detail="Conversions are plain arithmetic in this tab. Images you sample are drawn to a local canvas and never leave the device." />
      </div>

      {/* ---------------------------------------------------------- image */}
      <div className={cn('rounded-xl border bg-card p-4 sm:p-5', !hasImage && 'hidden')}>
        <h2 className="text-sm font-semibold">Image sampler</h2>
        <canvas
          ref={canvasRef}
          className="mt-3 max-h-96 w-full cursor-crosshair rounded-lg border object-contain"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const scaleX = e.currentTarget.width / rect.width
            const scaleY = e.currentTarget.height / rect.height
            const hexStr = sampleAt((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY, false)
            if (hexStr) setImageMsg(`Hover: ${hexStr} — click to commit.`)
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const scaleX = e.currentTarget.width / rect.width
            const scaleY = e.currentTarget.height / rect.height
            sampleAt((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY, true)
          }}
          aria-label="Image canvas — move to inspect colors, click to pick"
        />
      </div>

      {/* ------------------------------------------------------- contrast */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold">WCAG 2.1 contrast — text on background</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bg-input">Background</Label>
            <Input id="bg-input" value={bgInput} onChange={(e) => setBgInput(e.target.value)} className="font-mono" spellCheck={false} />
            {bgParsed.error && <p className="text-xs text-destructive">{bgParsed.error}</p>}
          </div>
          <div className="flex items-end">
            <div
              className="flex h-20 w-full items-center justify-center rounded-lg border text-lg font-semibold"
              style={{ backgroundColor: bg ? `rgb(${bg.r} ${bg.g} ${bg.b})` : 'transparent', color: color ? `rgb(${color.r} ${color.g} ${color.b})` : undefined }}
              aria-label="Live preview of text color on background"
            >
              Aa — sample text
            </div>
          </div>
        </div>
        {ratio !== null ? (
          <div className="mt-4 grid gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg border border-primary/40 bg-primary/5 px-3.5 py-3">
              <p className="text-xs font-medium text-primary">Contrast ratio</p>
              <p className="mt-0.5 font-mono text-xl font-semibold text-primary">{ratio.toFixed(2)} : 1</p>
            </div>
            {[
              { label: 'AA normal text', pass: ratio >= 4.5 },
              { label: 'AA large text', pass: ratio >= 3 },
              { label: 'AAA normal text', pass: ratio >= 7 },
              { label: 'AAA large text', pass: ratio >= 4.5 },
            ].map((v) => (
              <div key={v.label} className={cn('rounded-lg border px-3.5 py-3', v.pass ? 'border-primary/30 bg-primary/5' : 'bg-muted/30')}>
                <p className="text-xs font-medium text-muted-foreground">{v.label}</p>
                <p className={cn('mt-0.5 font-semibold', v.pass ? 'text-primary' : 'text-destructive')}>{v.pass ? 'Pass' : 'Fail'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Fix both colors above to compute the ratio.</p>
        )}
      </div>

      {/* -------------------------------------------------------- palette */}
      {palette && (
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Palettes from this color — real HSL math</h2>
          <p className="mt-1 text-xs text-muted-foreground">Tints & shades ramp (lightness steps), then harmonies by rotating the hue.</p>
          <div className="mt-3 grid grid-cols-9 overflow-hidden rounded-lg border">
            {palette.ramp.map((c, i) => (
              <button
                key={i}
                type="button"
                className="h-14"
                style={{ backgroundColor: `rgb(${c.r} ${c.g} ${c.b})` }}
                aria-label={`Ramp step ${i + 1}: rgb(${c.r}, ${c.g}, ${c.b}) — click to copy hex`}
                onClick={() => { setInput(`#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`) }}
                title={`#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`}
              />
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {palette.harmonies.map((h) => (
              <div key={h.name}>
                <p className="text-xs font-medium text-muted-foreground">{h.name}</p>
                <div className="mt-1.5 flex overflow-hidden rounded-lg border">
                  {h.colors.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      className="h-12 flex-1"
                      style={{ backgroundColor: `rgb(${c.r} ${c.g} ${c.b})` }}
                      aria-label={`${h.name} color ${i + 1}: click to make it the working color`}
                      onClick={() => setInput(`#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`)}
                      title={`#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Click any swatch to make it the working color; hover to see its hex.</p>
        </div>
      )}
    </div>
  )
}
