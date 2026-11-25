'use client'

// SVG → PNG/JPG rasterizer. The markup is sanitized BEFORE it ever reaches
// the raster engine: <script> elements and on* handler attributes are
// removed, and href/xlink:href targets that are not in-document fragments
// or inline data: URLs are stripped, so rendering can neither execute code
// nor fetch anything external. The render lives on a local canvas and the
// download is built by the browser — nothing leaves this tab.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { PrivacyStrip, downloadBlob, useFilePick } from '@/components/instant/instant-kit'

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

const MIN_PX = 16
const MAX_PX = 4096
const DEBOUNCE_MS = 200

type Bg = 'transparent' | 'white' | 'black' | 'custom'
type Fmt = 'png' | 'jpg'

// Self-contained sample: rounded rect + circle + text, no external
// references, so the first viewport shows a live render before any input.
const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <rect x="10" y="10" width="220" height="220" rx="28" fill="#ecfdf5" stroke="#059669" stroke-width="4" />
  <circle cx="120" cy="98" r="52" fill="#10b981" />
  <circle cx="104" cy="90" r="8" fill="#ffffff" />
  <circle cx="136" cy="90" r="8" fill="#ffffff" />
  <path d="M98 110 Q120 130 142 110" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round" />
  <text x="120" y="196" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="700" fill="#065f46">Kontivo</text>
  <text x="120" y="220" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" fill="#047857">local SVG rasterizer</text>
</svg>`

interface Prepared {
  xml: string
  changed: boolean
  size: { w: number; h: number } | null
}

/** Parse a dimension field: null while the value is transiently invalid so
 *  the preview can hold its last good size while the user types. */
function parseDim(text: string): number | null {
  const n = Math.round(Number(text))
  if (!Number.isFinite(n) || n < MIN_PX) return null
  return Math.min(MAX_PX, n)
}

/** Intrinsic size from viewBox first, then concrete width/height attrs.
 *  Percentages are ignored — they mean nothing without layout context. */
function intrinsicSize(doc: Document): { w: number; h: number } | null {
  const root = doc.documentElement
  const viewBox = root.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n)) && parts[2] > 0 && parts[3] > 0) {
      return { w: parts[2], h: parts[3] }
    }
  }
  const wAttr = root.getAttribute('width') ?? ''
  const hAttr = root.getAttribute('height') ?? ''
  const w = /^(\d+(?:\.\d+)?)px?$/.exec(wAttr.trim())
  const h = /^(\d+(?:\.\d+)?)px?$/.exec(hAttr.trim())
  if (w && h && Number(w[1]) > 0 && Number(h[1]) > 0) {
    return { w: Number(w[1]), h: Number(h[1]) }
  }
  return null
}

/** Sanitize, then serialize. Throws with a human-readable reason when the
 *  markup cannot be a rendered SVG at all. Runs only in effects/handlers
 *  (DOMParser is a browser API). */
function prepareSvg(markup: string): Prepared {
  let text = markup
  // A root <svg> without xmlns parses as namespace-less XML and rasterizes
  // to a blank image. Patch the opening tag before parsing when the
  // declaration is missing so pasted fragments still render.
  const rootOpen = /<svg\b[^>]*>/i.exec(text)
  if (rootOpen && !rootOpen[0].includes('xmlns=')) {
    text = text.replace(/<svg\b[^>]*>/i, (m) => `${m.slice(0, -1)} xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}">`)
  }

  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const root = doc.documentElement
  if (
    doc.getElementsByTagName('parsererror').length > 0 ||
    !root ||
    root.namespaceURI !== SVG_NS ||
    root.localName !== 'svg'
  ) {
    throw new Error('Could not parse the markup as SVG — it must be well-formed XML with a lowercase <svg> root.')
  }

  let changed = false

  // Strip <script> elements entirely: a rendered SVG must never execute code.
  for (const node of Array.from(doc.getElementsByTagName('script'))) {
    node.remove()
    changed = true
  }

  // Walk every element and drop attributes that could smuggle behavior or
  // external content into the render:
  //   - on* handler attributes (event attributes of any namespace prefix),
  //   - href / xlink:href values that do not point at an in-document
  //     fragment (#id) or an inline data: URL — external references blocked.
  // Browsers already refuse to fetch inside <img>-rendered SVGs; stripping
  // here is defense in depth, so the markup itself is safe before it draws.
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name)
        changed = true
      } else if (name === 'href' || name === 'xlink:href' || name.endsWith(':href')) {
        if (!value.startsWith('#') && !value.startsWith('data:')) {
          el.removeAttribute(attr.name)
          changed = true
        }
      }
    }
  }

  return { xml: new XMLSerializer().serializeToString(root), changed, size: intrinsicSize(doc) }
}

export function SvgConvertTool() {
  const [markup, setMarkup] = useState(SAMPLE_SVG)
  const [wText, setWText] = useState(String(240))
  const [hText, setHText] = useState(String(240))
  const [lock, setLock] = useState(true)
  const [bg, setBg] = useState<Bg>('transparent')
  const [customColor, setCustomColor] = useState('#f5f5f4')
  const [format, setFormat] = useState<Fmt>('png')
  const [quality, setQuality] = useState(90)
  // Readout of the LAST successful render; initialized to the sample's
  // intrinsic size so the readout is correct from the very first paint.
  const [dims, setDims] = useState<{ w: number; h: number } | null>({ w: 240, h: 240 })
  const [rendered, setRendered] = useState(false)
  const [stripped, setStripped] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runId = useRef(0)
  const ratioRef = useRef(1)
  const lastIntrinsic = useRef<{ w: number; h: number } | null>(null)
  // Hold the last valid dimension while a field is transiently empty.
  const wHold = useRef(240)
  const hHold = useRef(240)

  const wParsed = parseDim(wText)
  const hParsed = parseDim(hText)
  useEffect(() => {
    if (wParsed !== null) wHold.current = wParsed
    if (hParsed !== null) hHold.current = hParsed
  })
  const wNum = wParsed ?? wHold.current
  const hNum = hParsed ?? hHold.current

  // JPG has no alpha channel: a transparent background is flattened to white
  // in both the preview and the download (WYSIWYG), with a visible note.
  const effectiveBg: Bg | 'white' = format === 'jpg' && bg === 'transparent' ? 'white' : bg

  const renderNow = useCallback(async () => {
    const seq = ++runId.current
    const source = markup.trim()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null

    if (!source) {
      if (runId.current !== seq) return
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      setDims(null)
      setRendered(false)
      setStripped(false)
      setError('Paste SVG markup or load a .svg file — the render appears here.')
      return
    }

    let prepared: Prepared
    try {
      prepared = prepareSvg(source)
    } catch (e) {
      if (runId.current !== seq) return
      setError(e instanceof Error ? e.message : 'Could not parse the markup as SVG.')
      return
    }

    const url = URL.createObjectURL(new Blob([prepared.xml], { type: 'image/svg+xml;charset=utf-8' }))
    const img = new Image()
    try {
      img.src = url
      if (typeof img.decode === 'function') {
        await img.decode()
      } else {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('image load failed'))
        })
      }
      if (runId.current !== seq) return // superseded by a newer render
      if (!canvas || !ctx) return

      canvas.width = wNum
      canvas.height = hNum
      if (effectiveBg !== 'transparent') {
        ctx.fillStyle = effectiveBg === 'custom' ? customColor : effectiveBg
        ctx.fillRect(0, 0, wNum, hNum)
      }
      ctx.drawImage(img, 0, 0, wNum, hNum)

      setDims({ w: wNum, h: hNum })
      setRendered(true)
      setStripped(prepared.changed)
      setError(null)

      // Follow the document's own size: when the intrinsic size actually
      // changes (viewBox or width/height edited, new file), reset the
      // fields to it. User scaling is preserved otherwise, and the aspect
      // ratio for the lock comes from the intrinsic size.
      if (prepared.size) {
        ratioRef.current = prepared.size.w / prepared.size.h
        const prev = lastIntrinsic.current
        if (!prev || prev.w !== prepared.size.w || prev.h !== prepared.size.h) {
          lastIntrinsic.current = prepared.size
          setWText(String(prepared.size.w))
          setHText(String(prepared.size.h))
        }
      }
    } catch {
      if (runId.current === seq) {
        setError('The markup parsed as XML, but the browser refused to rasterize it as an image.')
      }
    } finally {
      URL.revokeObjectURL(url)
    }
  }, [markup, wNum, hNum, effectiveBg, customColor])

  // Live render, debounced: markup edits, size changes and background
  // changes all re-render ~200ms after the last keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      void renderNow()
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [renderNow])

  const onWidthInput = (raw: string) => {
    setWText(raw)
    if (!lock) return
    const n = parseDim(raw)
    if (n === null) return // wait for a valid number before rescaling
    setHText(String(Math.min(MAX_PX, Math.max(MIN_PX, Math.round(n / ratioRef.current)))))
  }

  const onHeightInput = (raw: string) => {
    setHText(raw)
    if (!lock) return
    const n = parseDim(raw)
    if (n === null) return
    setWText(String(Math.min(MAX_PX, Math.max(MIN_PX, Math.round(n * ratioRef.current)))))
  }

  // Scale buttons multiply the CURRENT width/height together, so the aspect
  // ratio is kept regardless of the lock switch state.
  const applyScale = (s: number) => {
    setWText(String(Math.min(MAX_PX, Math.max(MIN_PX, Math.round(wNum * s)))))
    setHText(String(Math.min(MAX_PX, Math.max(MIN_PX, Math.round(hNum * s)))))
  }

  const onSvgFile = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
      setError('That is not an SVG file — drop a .svg or pick one with the button.')
      return
    }
    try {
      const text = await file.text()
      setMarkup(text)
    } catch {
      setError('That file could not be read on this device.')
    }
  }, [])

  const { pick, input } = useFilePick('.svg,image/svg+xml', false, false, (files) => void onSvgFile(files))

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas || !rendered || !dims) return
    const isJpg = format === 'jpg'
    canvas.toBlob(
      (blob) => {
        if (blob) downloadBlob(blob, `converted-${dims.w}x${dims.h}.${isJpg ? 'jpg' : 'png'}`)
      },
      isJpg ? 'image/jpeg' : 'image/png',
      isJpg ? quality / 100 : undefined,
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="svg-in">SVG markup</Label>
              <Button type="button" variant="outline" size="sm" onClick={pick}>
                <Upload className="size-3.5" aria-hidden="true" /> Load an .svg file
              </Button>
            </div>
            <Textarea
              id="svg-in"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              spellCheck={false}
              className="mt-2 min-h-56 font-mono text-xs"
            />
            {input}
          </div>

          {stripped && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <Badge variant="outline" className="shrink-0 border-amber-500/40 text-amber-700 dark:text-amber-400">
                Sanitized
              </Badge>
              <span>Scripts and external references are stripped before rendering — nothing executes and nothing is fetched.</span>
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {!error && !markup.trim() && (
            <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Paste SVG markup or load a file — the render appears on the right as you type.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
              <div>
                <Label htmlFor="svg-w">Width (px)</Label>
                <Input
                  id="svg-w"
                  type="number"
                  inputMode="numeric"
                  min={MIN_PX}
                  max={MAX_PX}
                  value={wText}
                  onChange={(e) => onWidthInput(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="svg-h">Height (px)</Label>
                <Input
                  id="svg-h"
                  type="number"
                  inputMode="numeric"
                  min={MIN_PX}
                  max={MAX_PX}
                  value={hText}
                  onChange={(e) => onHeightInput(e.target.value)}
                  className="mt-2"
                />
              </div>
              <label className="flex items-center gap-2.5 pb-2 text-sm">
                <Switch checked={lock} onCheckedChange={setLock} aria-label="Lock aspect ratio" />
                <span>Lock aspect</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Scale:</span>
              {[0.5, 1, 2, 4].map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => applyScale(s)}
                >
                  {s}×
                </Button>
              ))}
              <span data-testid="svg-dims" className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                {dims ? `${dims.w} × ${dims.h} px` : '—'}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="svg-bg">Background</Label>
                <Select value={bg} onValueChange={(v) => setBg(v as Bg)}>
                  <SelectTrigger id="svg-bg" className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transparent">Transparent (PNG)</SelectItem>
                    <SelectItem value="white">White</SelectItem>
                    <SelectItem value="black">Black</SelectItem>
                    <SelectItem value="custom">Custom color</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="svg-format">Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as Fmt)}>
                  <SelectTrigger id="svg-format" className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="jpg">JPG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {bg === 'custom' && (
              <div className="flex items-center gap-3">
                <Label htmlFor="svg-color">Custom color</Label>
                <input
                  id="svg-color"
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="h-9 w-16 cursor-pointer rounded-md border bg-transparent p-1"
                />
              </div>
            )}

            {format === 'jpg' && (
              <div>
                <Label htmlFor="svg-quality">JPG quality — {quality}%</Label>
                <Slider
                  id="svg-quality"
                  min={30}
                  max={95}
                  value={[quality]}
                  onValueChange={([v]) => setQuality(v)}
                  className="mt-3"
                />
              </div>
            )}
            {format === 'jpg' && bg === 'transparent' && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                JPG has no transparency — the background is flattened to white in both the preview and the download.
              </p>
            )}
          </div>

          <div className="rounded-xl border bg-card">
            <div className="overflow-x-auto bg-[repeating-conic-gradient(#e5e5e5_0%_25%,white_0%_50%)] bg-[length:16px_16px] p-4 md:p-6">
              <canvas ref={canvasRef} data-testid="svg-canvas" aria-label="SVG raster preview" className="mx-auto block" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {rendered
                  ? 'Rendered live in this tab — the download matches the preview.'
                  : 'The render appears here once the markup parses.'}
              </p>
              <Button type="button" size="sm" onClick={download} disabled={!rendered}>
                <Download className="size-4" aria-hidden="true" /> Download {format === 'jpg' ? 'JPG' : 'PNG'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PrivacyStrip detail="The SVG is parsed, sanitized and rasterized in this tab: scripts and external references are stripped before anything renders, the preview is a local canvas, and the PNG/JPG download is built by your own browser. Nothing is uploaded." />
    </div>
  )
}
