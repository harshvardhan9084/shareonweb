'use client'

// Signature Studio — draw or type a signature, export a trimmed transparent
// PNG at a chosen width. The canvas never leaves this tab: there is no upload
// code, no storage, no analytics on the strokes.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Eraser, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { downloadBlob } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Mode = 'draw' | 'type'

const FONTS: Array<{ id: string; label: string; stack: string; slant: boolean }> = [
  { id: 'caveat', label: 'Casual pen', stack: '"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive', slant: false },
  { id: 'script', label: 'Formal script', stack: '"Brush Script MT", "Snell Roundhand", "Apple Chancery", cursive', slant: false },
  { id: 'italic', label: 'Elegant italic', stack: 'Georgia, "Times New Roman", serif', slant: true },
  { id: 'round', label: 'Rounded hand', stack: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", cursive', slant: false },
  { id: 'mono', label: 'Clean print', stack: '"Cascadia Code", Consolas, "Courier New", monospace', slant: false },
]

const PENS = [
  { id: 'ink', label: 'Ink black', color: '#1c1c1e' },
  { id: 'blue', label: 'Pen blue', color: '#1e3a8a' },
  { id: 'teal', label: 'Teal', color: '#0f766e' },
]

interface Point { x: number; y: number; w: number }
interface Stroke { points: Point[]; color: string; width: number }

/** Draw one stroke onto a canvas context. */
function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = stroke.points
  if (pts.length === 0) return
  ctx.strokeStyle = stroke.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (pts.length === 1) {
    ctx.arc(pts[0].x, pts[0].y, Math.max(pts[0].w, 1) / 2, 0, Math.PI * 2)
    ctx.fillStyle = stroke.color
    ctx.fill()
    return
  }
  ctx.lineWidth = pts[0].w
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) {
    ctx.lineWidth = pts[i].w
    ctx.lineTo(pts[i].x, pts[i].y)
  }
  ctx.stroke()
}

/** Find the bounds of non-transparent pixels, or null for a blank canvas. */
function inkBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

export function SignatureTool() {
  const [mode, setMode] = useState<Mode>('draw')
  const [penColor, setPenColor] = useState(PENS[0].color)
  const [penWidth, setPenWidth] = useState(3)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [typed, setTyped] = useState('Alex Morgan')
  const [fontId, setFontId] = useState(FONTS[0].id)
  const [fontSlant, setFontSlant] = useState(false)
  const [fontSize, setFontSize] = useState(64)
  const [exportWidth, setExportWidth] = useState(600)
  const hasInk = mode === 'draw' ? strokes.length > 0 : typed.trim() !== ''

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const current = useRef<Stroke | null>(null)

  const CSS_W = 640
  const CSS_H = 240
  const font = FONTS.find((f) => f.id === fontId) ?? FONTS[0]

  /** Repaint everything currently committed (used after undo / clear / resize). */
  const repaint = useCallback((strokesIn: Stroke[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = CSS_W * dpr
    canvas.height = CSS_H * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, CSS_W, CSS_H)
    for (const s of strokesIn) paintStroke(ctx, s)
  }, [])

  useEffect(() => {
    if (mode === 'draw') repaint(strokes)
  }, [mode, strokes, repaint])

  /** Render the typed signature onto a standalone canvas (for export). */
  const renderTyped = useCallback((scale: number): HTMLCanvasElement | null => {
    if (!typed.trim()) return null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const px = fontSize * scale
    ctx.font = `${fontSlant ? 'italic ' : ''}${px}px ${font.stack}`
    const metrics = ctx.measureText(typed)
    const pad = Math.ceil(px * 0.25)
    canvas.width = Math.ceil(metrics.width) + pad * 2
    canvas.height = Math.ceil(px * 1.6) + pad * 2
    const ctx2 = canvas.getContext('2d')!
    ctx2.font = `${fontSlant ? 'italic ' : ''}${px}px ${font.stack}`
    ctx2.fillStyle = penColor
    ctx2.textBaseline = 'middle'
    ctx2.fillText(typed, pad, canvas.height / 2)
    return canvas
  }, [typed, font, fontSlant, fontSize, penColor])

  // Pointer handlers (mouse, touch, pen — unified by Pointer Events).
  const posFrom = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 1
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      w: Math.max(1, penWidth * (0.55 + 0.65 * pressure)),
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw') return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    current.current = { points: [posFrom(e)], color: penColor, width: penWidth }
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx && current.current) paintStroke(ctx, current.current)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !current.current) return
    current.current.points.push(posFrom(e))
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) paintStroke(ctx, current.current)
  }
  const onPointerUp = () => {
    if (!drawing.current) return
    drawing.current = false
    if (current.current && current.current.points.length > 0) {
      setStrokes((s) => [...s, current.current!])
    }
    current.current = null
  }

  const undo = () => setStrokes((s) => s.slice(0, -1))
  const clear = () => setStrokes([])

  /** Build the trimmed export canvas at the requested width. */
  const buildExport = (): HTMLCanvasElement | null => {
    let source: HTMLCanvasElement | null = null
    if (mode === 'draw') {
      source = canvasRef.current
    } else {
      source = renderTyped(1)
    }
    if (!source) return null
    const bounds = inkBounds(source)
    if (!bounds) return null
    const pad = Math.max(6, Math.round(bounds.w * 0.04))
    const out = document.createElement('canvas')
    const scale = exportWidth / bounds.w
    out.width = exportWidth
    out.height = Math.max(1, Math.round(bounds.h * scale) + pad * 2)
    const ctx = out.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      source,
      bounds.x, bounds.y, bounds.w, bounds.h,
      pad, pad, Math.round(bounds.w * scale), Math.round(bounds.h * scale),
    )
    return out
  }

  const download = () => {
    const out = buildExport()
    if (!out) return
    out.toBlob((blob) => {
      if (blob) downloadBlob(blob, mode === 'draw' ? 'signature-drawn.png' : 'signature-typed.png')
    }, 'image/png')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Signature mode">
          {(['draw', 'type'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                mode === m ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {m === 'draw' ? 'Draw' : 'Type'}
            </button>
          ))}
        </div>

        {mode === 'draw' ? (
          <div className="mt-4">
            {/* checkerboard makes transparency honest */}
            <div
              className="relative w-full overflow-hidden rounded-lg border"
              style={{
                aspectRatio: `${CSS_W} / ${CSS_H}`,
                backgroundImage:
                  'linear-gradient(45deg, oklch(0.93 0.008 163) 25%, transparent 25%), linear-gradient(-45deg, oklch(0.93 0.008 163) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, oklch(0.93 0.008 163) 75%), linear-gradient(-45deg, transparent 75%, oklch(0.93 0.008 163) 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
              }}
            >
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
                style={{ width: '100%', height: '100%' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                aria-label="Signature drawing canvas"
              />
              {/* baseline guide — screen only, never exported (export reads
                  the canvas pixels, not this overlay) */}
              <div className="pointer-events-none absolute inset-x-8 bottom-12 border-b border-dashed border-muted-foreground/40" aria-hidden="true" />
              {!hasInk && (
                <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Sign here with your mouse, finger or stylus
                </p>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sig-pen">Pen</Label>
                <div className="flex gap-1.5" role="radiogroup" aria-label="Pen color">
                  {PENS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={penColor === p.color}
                      aria-label={p.label}
                      onClick={() => setPenColor(p.color)}
                      className={cn(
                        'size-8 rounded-full border-2 transition-transform',
                        penColor === p.color ? 'border-foreground scale-110' : 'border-transparent',
                      )}
                      style={{ backgroundColor: p.color }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sig-width">Pen width</Label>
                <Input
                  id="sig-width"
                  type="number"
                  min={1}
                  max={14}
                  value={penWidth}
                  onChange={(e) => setPenWidth(Math.min(14, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-20 font-mono"
                />
              </div>
              <div className="flex gap-2 pb-0.5">
                <Button type="button" variant="outline" size="sm" onClick={undo} disabled={!strokes.length}>
                  <RotateCcw className="size-4" aria-hidden="true" /> Undo
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={clear} disabled={!strokes.length}>
                  <Eraser className="size-4" aria-hidden="true" /> Clear
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sig-text">Your name</Label>
                <Input id="sig-text" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sig-font">Style</Label>
                <select
                  id="sig-font"
                  value={fontId}
                  onChange={(e) => setFontId(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {FONTS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sig-size">Font size</Label>
                <Input
                  id="sig-size"
                  type="number"
                  min={20}
                  max={140}
                  value={fontSize}
                  onChange={(e) => setFontSize(Math.min(140, Math.max(20, Number(e.target.value) || 20)))}
                  className="font-mono"
                />
              </div>
              <label className="flex items-center gap-2.5 pt-5 text-sm">
                <input
                  type="checkbox"
                  checked={fontSlant}
                  onChange={(e) => setFontSlant(e.target.checked)}
                  className="size-4 accent-[var(--primary)]"
                  aria-label="Slant the signature"
                />
                <span>Slant (italic)</span>
              </label>
            </div>
            {/* typed preview */}
            <div
              className="flex min-h-28 items-center justify-center overflow-hidden rounded-lg border p-4"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, oklch(0.93 0.008 163) 25%, transparent 25%), linear-gradient(-45deg, oklch(0.93 0.008 163) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, oklch(0.93 0.008 163) 75%), linear-gradient(-45deg, transparent 75%, oklch(0.93 0.008 163) 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
              }}
            >
              <span
                className="truncate"
                style={{ fontFamily: font.stack, fontStyle: fontSlant ? 'italic' : 'normal', fontSize: Math.min(fontSize, 72), color: penColor }}
              >
                {typed.trim() ? typed : 'Your name appears here'}
              </span>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sig-export">Export width</Label>
            <select
              id="sig-export"
              value={exportWidth}
              onChange={(e) => setExportWidth(Number(e.target.value))}
              className="h-9 rounded-md border bg-background px-3 text-sm font-mono"
            >
              <option value={400}>400 px</option>
              <option value={600}>600 px</option>
              <option value={800}>800 px</option>
            </select>
          </div>
          <Button type="button" onClick={download} disabled={!hasInk}>
            <Download className="size-4" aria-hidden="true" /> Download PNG
          </Button>
        </div>

        <PrivacyStrip detail="The signature is drawn and rendered on a canvas inside this tab and handed straight to your downloads. It is never uploaded, stored or analyzed — there is no server code on this page to send it to." />
      </div>

      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground sm:p-5">
        <p className="font-medium text-foreground">About the export</p>
        <p className="mt-2 leading-relaxed">
          The PNG carries a transparent background, so it sits on any document color without a white
          box. It is trimmed to the ink bounds with a little padding, scaled to your chosen width with
          high-quality resampling, and named for the mode you used. The dashed baseline on the drawing
          pad is a screen aid only — it never reaches the file.
        </p>
      </div>
    </div>
  )
}
