'use client'

// Meme maker — classic top/bottom Impact captions drawn over an image on a
// local canvas. The tool opens with a generated, clearly watermarked sample
// scene (built on this device with the canvas 2D API) so the first viewport
// already shows a real meme before any upload; the PNG export never leaves
// the tab.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { DropZone, PrivacyStrip, downloadBlob } from '@/components/instant/instant-kit'

const MEME_FONT = 'Impact, Haettenschweiler, "Arial Black", sans-serif'
const CAPTION_MARGIN = 14

// Canvas sizing: fit the photo by width, 400–800px, aspect preserved; tiny
// images are upscaled so captions stay legible, and extreme portrait ratios
// are capped so the canvas never becomes a memory hazard.
const MAX_CANVAS_W = 800
const MIN_CANVAS_W = 400
const MAX_CANVAS_H = 1600

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.beginPath()
  ctx.ellipse(x, y, 46 * s, 19 * s, 0, 0, Math.PI * 2)
  ctx.ellipse(x - 36 * s, y + 7 * s, 28 * s, 14 * s, 0, 0, Math.PI * 2)
  ctx.ellipse(x + 38 * s, y + 5 * s, 30 * s, 15 * s, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, baseY: number, s: number): void {
  const h = 52 * s
  const halfW = 20 * s
  ctx.fillStyle = '#065f46'
  ctx.beginPath()
  ctx.moveTo(x, baseY - h)
  ctx.lineTo(x - halfW, baseY)
  ctx.lineTo(x + halfW, baseY)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#78350f'
  ctx.fillRect(x - 4 * s, baseY, 8 * s, 14 * s)
}

/** The demo scene: warm sunset sky, sun, clouds, hills, trees — and a big
 *  diagonal "SAMPLE IMAGE" watermark so nobody mistakes it for a photo. */
function drawSampleScene(canvas: HTMLCanvasElement): boolean {
  canvas.width = 800
  canvas.height = 600
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const sky = ctx.createLinearGradient(0, 0, 0, 600)
  sky.addColorStop(0, '#fef3c7')
  sky.addColorStop(0.5, '#fdba74')
  sky.addColorStop(1, '#fb7185')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 800, 600)

  const glow = ctx.createRadialGradient(600, 160, 20, 600, 160, 180)
  glow.addColorStop(0, 'rgba(255, 251, 235, 0.9)')
  glow.addColorStop(1, 'rgba(255, 251, 235, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 800, 600)

  ctx.fillStyle = '#f97316'
  ctx.beginPath()
  ctx.arc(600, 160, 58, 0, Math.PI * 2)
  ctx.fill()

  drawCloud(ctx, 150, 110, 1)
  drawCloud(ctx, 400, 80, 0.75)
  drawCloud(ctx, 690, 260, 0.6)

  ctx.fillStyle = '#34d399'
  ctx.beginPath()
  ctx.arc(150, 700, 380, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#10b981'
  ctx.beginPath()
  ctx.arc(660, 760, 430, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#059669'
  ctx.beginPath()
  ctx.arc(400, 1030, 540, 0, Math.PI * 2)
  ctx.fill()

  drawTree(ctx, 170, 548, 1)
  drawTree(ctx, 265, 512, 0.8)
  drawTree(ctx, 600, 534, 0.9)
  ctx.fillStyle = '#a8a29e'
  ctx.beginPath()
  ctx.ellipse(330, 588, 26, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#d6d3d1'
  ctx.beginPath()
  ctx.ellipse(452, 572, 17, 8, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.translate(400, 300)
  ctx.rotate(-0.35)
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.font = '700 64px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('SAMPLE IMAGE', 0, 0)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.font = '600 18px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('generated on this device — not a photo', 0, 34)
  ctx.restore()

  return true
}

/** Empty state — shown only when no image has been adopted yet. */
function drawPlaceholder(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  if (canvas.width !== 800 || canvas.height !== 450) {
    canvas.width = 800
    canvas.height = 450
  } else {
    ctx.clearRect(0, 0, 800, 450)
  }
  ctx.fillStyle = '#fafaf9'
  ctx.fillRect(0, 0, 800, 450)
  ctx.strokeStyle = '#d6d3d1'
  ctx.setLineDash([10, 8])
  ctx.lineWidth = 2
  ctx.strokeRect(18, 18, 764, 414)
  ctx.setLineDash([])
  ctx.textAlign = 'center'
  ctx.fillStyle = '#a8a29e'
  ctx.font = '600 24px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('Drop an image or load the sample to start', 400, 214)
  ctx.fillStyle = '#d6d3d1'
  ctx.font = '400 15px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('Captions draw live — nothing leaves this tab', 400, 244)
}

/** Split a caption into at most 2 lines: break at the space whose two halves
 *  are closest in measured width (the midpoint rule). A single unbroken word
 *  that exceeds the width cannot wrap — it is drawn as-is rather than
 *  clipped, which reads honestly on the canvas. */
function wrapCaption(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return []
  if (ctx.measureText(text).width <= maxWidth) return [text]
  const words = text.split(' ')
  if (words.length < 2) return [text]
  let best: string[] | null = null
  let bestDiff = Number.POSITIVE_INFINITY
  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(' ')
    const right = words.slice(i).join(' ')
    const diff = Math.abs(ctx.measureText(left).width - ctx.measureText(right).width)
    if (diff < bestDiff) {
      bestDiff = diff
      best = [left, right]
    }
  }
  return best ?? [text]
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  raw: string,
  where: 'top' | 'bottom',
  fontSize: number,
  canvasW: number,
  canvasH: number,
): void {
  if (!raw) return
  ctx.font = `${fontSize}px ${MEME_FONT}`
  ctx.textAlign = 'center'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = Math.max(3, fontSize / 8)
  ctx.strokeStyle = '#000000'
  ctx.fillStyle = '#ffffff'
  const lines = wrapCaption(ctx, raw, canvasW - CAPTION_MARGIN * 2)
  const lineHeight = Math.round(fontSize * 1.12)
  lines.forEach((line, i) => {
    const baseline =
      where === 'top'
        ? CAPTION_MARGIN + fontSize + i * lineHeight
        : canvasH - CAPTION_MARGIN - (lines.length - 1 - i) * lineHeight
    ctx.strokeText(line, canvasW / 2, baseline)
    ctx.fillText(line, canvasW / 2, baseline)
  })
}

export function MemeTool() {
  const [top, setTop] = useState('TOP TEXT')
  const [bottom, setBottom] = useState('BOTTOM TEXT')
  const [fontSize, setFontSize] = useState(48)
  const [upper, setUpper] = useState(true)
  // The decoded image lives in a ref; this counter only signals "redraw".
  const [imageVersion, setImageVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const loadSeqRef = useRef(0)

  const hasImage = imageVersion > 0

  const adoptImage = useCallback((img: HTMLImageElement, url: string | null) => {
    imgRef.current = img
    // Revoke the previously tracked object URL only after the new image is
    // live, so the current render never points at a revoked URL.
    if (objectUrlRef.current && objectUrlRef.current !== url) {
      URL.revokeObjectURL(objectUrlRef.current)
    }
    objectUrlRef.current = url
    setImageVersion((v) => v + 1)
  }, [])

  const loadSampleImage = useCallback(() => {
    // Generated fully on the client — a data URL, so there is no object URL
    // to track or revoke. No state is set synchronously here: adoption and
    // error reporting both go through async callbacks (also what lets this
    // run directly inside the mount effect).
    const stage = document.createElement('canvas')
    const img = new Image()
    const seq = ++loadSeqRef.current
    img.onload = () => {
      if (loadSeqRef.current !== seq) return
      adoptImage(img, null)
      setError(null)
    }
    if (!drawSampleScene(stage)) {
      setTimeout(() => {
        if (loadSeqRef.current === seq) setError('Canvas is unavailable in this browser.')
      }, 0)
      return
    }
    img.src = stage.toDataURL('image/png')
  }, [adoptImage])

  // First viewport: adopt the sample immediately so the canvas shows a real
  // meme before any upload. Cleanup invalidates in-flight decodes and
  // releases the tracked object URL.
  useEffect(() => {
    loadSampleImage()
    return () => {
      loadSeqRef.current += 1
      imgRef.current = null
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [loadSampleImage])

  const onFiles = useCallback(
    (files: File[]) => {
      const file = files[0]
      if (!file) return
      if (!file.type.startsWith('image/') && !/\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(file.name)) {
        setError('That file does not look like an image — drop a PNG, JPG, WebP or GIF.')
        return
      }
      const url = URL.createObjectURL(file)
      const img = new Image()
      const seq = ++loadSeqRef.current
      img.onload = () => {
        if (loadSeqRef.current !== seq) {
          URL.revokeObjectURL(url) // superseded by a newer load mid-flight
          return
        }
        adoptImage(img, url)
        setError(null)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        if (loadSeqRef.current === seq) {
          setError('That image could not be decoded on this device.')
        }
      }
      img.src = url
    },
    [adoptImage],
  )

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const img = imgRef.current
    if (!img || !img.complete || img.naturalWidth === 0) {
      drawPlaceholder(canvas, ctx)
      return
    }
    const w = img.naturalWidth
    const h = img.naturalHeight
    let cw = Math.min(MAX_CANVAS_W, Math.max(MIN_CANVAS_W, w))
    let ch = Math.round((h / w) * cw)
    if (ch > MAX_CANVAS_H) {
      ch = MAX_CANVAS_H
      cw = Math.max(1, Math.round((w / h) * ch))
    }
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    } else {
      ctx.clearRect(0, 0, cw, ch)
    }
    ctx.drawImage(img, 0, 0, cw, ch)
    const caption = (raw: string) => (upper ? raw.toUpperCase() : raw)
    drawCaption(ctx, caption(top), 'top', fontSize, cw, ch)
    drawCaption(ctx, caption(bottom), 'bottom', fontSize, cw, ch)
  }, [top, bottom, fontSize, upper])

  useEffect(() => {
    redraw()
  }, [imageVersion, redraw])

  const downloadPng = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasImage) return
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `meme-${Date.now()}.png`)
    }, 'image/png')
  }, [hasImage])

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <DropZone
            onFiles={onFiles}
            accept="image/*"
            multiple={false}
            title="Drop an image for the meme"
            hint="PNG, JPG, WebP or GIF — decoded and drawn in this tab"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={loadSampleImage}>
              <Sparkles className="size-3.5" aria-hidden="true" /> Load a sample image
            </Button>
            <span className="text-xs text-muted-foreground">
              The canvas opens with a generated sample (watermarked “SAMPLE IMAGE”) so you can try captions right away.
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="meme-top">Top caption</Label>
              <Input
                id="meme-top"
                value={top}
                onChange={(e) => setTop(e.target.value)}
                placeholder="TOP TEXT"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="meme-bottom">Bottom caption</Label>
              <Input
                id="meme-bottom"
                value={bottom}
                onChange={(e) => setBottom(e.target.value)}
                placeholder="BOTTOM TEXT"
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="meme-size">Caption size — {fontSize}px</Label>
              <Slider
                id="meme-size"
                min={24}
                max={96}
                step={2}
                value={[fontSize]}
                onValueChange={([v]) => setFontSize(v)}
                className="mt-3"
              />
            </div>
            <label className="flex items-center gap-2.5 text-sm sm:pt-6">
              <Switch checked={upper} onCheckedChange={setUpper} aria-label="Auto-uppercase captions" />
              <span>Auto-uppercase</span>
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Long captions wrap onto two balanced lines — the break happens at the space nearest the measured midpoint.
            A single word wider than the canvas is drawn as-is rather than clipped.
          </p>

          {error && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="overflow-x-auto rounded-lg bg-[repeating-conic-gradient(#e5e5e5_0%_25%,white_0%_50%)] bg-[length:16px_16px] p-2">
            <canvas ref={canvasRef} data-testid="meme-canvas" aria-label="Meme preview" className="block" />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {hasImage ? 'Live preview — every keystroke redraws the canvas.' : 'Load an image or the sample to enable the download.'}
            </p>
            <Button type="button" size="sm" onClick={downloadPng} disabled={!hasImage}>
              <Download className="size-4" aria-hidden="true" /> Download PNG
            </Button>
          </div>
        </div>
      </div>

      <PrivacyStrip detail="Your image and captions stay in this tab: the canvas is drawn locally and the PNG is built by your own browser. Nothing is uploaded — even the sample image is generated on your device." />
    </div>
  )
}
