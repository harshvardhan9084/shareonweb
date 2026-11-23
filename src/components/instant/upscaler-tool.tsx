'use client'

// Image Upscaler — stepped high-quality resampling (2× doubling stages) plus
// an unsharp-mask pass with a strength slider, all on canvases in this tab.
// Honest about what it is: careful resampling + sharpening, not AI SR.
// Doctrine: DESIGN.md at the repo root.

import { useCallback, useRef, useState } from 'react'
import { Download, Expand, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadBlob, DropZone, formatBytes, PrivacyStrip } from '@/components/instant/instant-kit'

interface Source {
  name: string
  bitmap: ImageBitmap | HTMLImageElement
  width: number
  height: number
  size: number
}

interface Upscaled {
  blob: Blob
  ext: 'png' | 'jpg' | 'webp'
  width: number
  height: number
}

/**
 * Unsharp mask on raw pixels: blur = box blur radius 1 (cheap, separable),
 * out = px + amount * (px - blur). `amount` 0 disables.
 */
function unsharp(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number): void {
  if (amount <= 0) return
  const img = ctx.getImageData(0, 0, w, h)
  const src = img.data
  const blurred = new Float32Array(src.length)
  // separable box blur, radius 1
  const tmp = new Float32Array(src.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const l = x > 0 ? src[i - 4 + c] : src[i + c]
        const r = x < w - 1 ? src[i + 4 + c] : src[i + c]
        tmp[i + c] = (l + src[i + c] + r) / 3
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const u = y > 0 ? tmp[i - w * 4 + c] : tmp[i + c]
        const d = y < h - 1 ? tmp[i + w * 4 + c] : tmp[i + c]
        blurred[i + c] = (u + tmp[i + c] + d) / 3
        src[i + c] = Math.max(0, Math.min(255, src[i + c] + amount * (src[i + c] - blurred[i + c])))
      }
      src[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

/** Progressive resample: double (or halve-jump) toward the target in stages. */
function steppedResize(
  source: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
  targetW: number,
  targetH: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  let curW = source instanceof ImageBitmap ? source.width : 'naturalWidth' in source ? source.naturalWidth || source.width : source.width
  let curH = source instanceof ImageBitmap ? source.height : 'naturalHeight' in source ? source.naturalHeight || source.height : source.height
  let cur: ImageBitmap | HTMLImageElement | HTMLCanvasElement = source
  while (curW * 2 <= targetW) {
    const next = document.createElement('canvas')
    next.width = curW * 2
    next.height = curH * 2
    const nctx = next.getContext('2d')
    if (!nctx) break
    nctx.imageSmoothingEnabled = true
    nctx.imageSmoothingQuality = 'high'
    nctx.drawImage(cur as CanvasImageSource, 0, 0, next.width, next.height)
    cur = next
    curW = next.width
    curH = next.height
  }
  const out = document.createElement('canvas')
  out.width = targetW
  out.height = targetH
  const octx = out.getContext('2d', { willReadFrequently: true })
  if (!octx) throw new Error('Canvas is unavailable in this browser.')
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(cur as CanvasImageSource, 0, 0, targetW, targetH)
  return { canvas: out, ctx: octx }
}

export function UpscalerTool() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState<Source | null>(null)
  const [factor, setFactor] = useState(2)
  const [targetWidth, setTargetWidth] = useState<number | ''>('')
  const [strength, setStrength] = useState(0.5)
  const [fmt, setFmt] = useState<'png' | 'jpg' | 'webp'>('png')
  const [quality, setQuality] = useState(0.9)
  const [result, setResult] = useState<Upscaled | null>(null)
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null)
  const [afterUrl, setAfterUrl] = useState<string | null>(null)
  const srcUrlRef = useRef<string | null>(null)

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]
    setError(null)
    setResult(null)
    setAfterUrl(null)
    if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current)
    try {
      const url = URL.createObjectURL(f)
      srcUrlRef.current = url
      setBeforeUrl(url)
      let bitmap: ImageBitmap | HTMLImageElement
      let width: number
      let height: number
      if ('createImageBitmap' in window) {
        bitmap = await createImageBitmap(f)
        width = bitmap.width
        height = bitmap.height
      } else {
        const img = new Image()
        img.src = url
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('This file could not be decoded as an image.'))
        })
        bitmap = img
        width = img.naturalWidth
        height = img.naturalHeight
      }
      setSource({ name: f.name, bitmap, width, height, size: f.size })
      setTargetWidth(width * 2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image.')
    }
  }, [])

  const upscale = useCallback(async () => {
    if (!source) return
    setError(null)
    setResult(null)
    setBusy(true)
    try {
      await new Promise((r) => setTimeout(r, 20))
      const scale = targetWidth ? targetWidth / source.width : factor
      const targetW = Math.round(source.width * scale)
      const targetH = Math.round(source.height * scale)
      if (targetW * targetH > 80_000_000) {
        throw new Error(
          `That target (${targetW}×${targetH}) is beyond what this device's memory can render safely — try a smaller width.`,
        )
      }
      const { canvas, ctx } = steppedResize(source.bitmap, targetW, targetH)
      unsharp(ctx, targetW, targetH, strength)
      const mime = fmt === 'png' ? 'image/png' : fmt === 'jpg' ? 'image/jpeg' : 'image/webp'
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed.'))), mime, fmt === 'png' ? undefined : quality),
      )
      if (afterUrl) URL.revokeObjectURL(afterUrl)
      const nextUrl = URL.createObjectURL(blob)
      setAfterUrl(nextUrl)
      setResult({ blob, ext: fmt, width: targetW, height: targetH })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upscaling failed.')
    } finally {
      setBusy(false)
    }
  }, [source, factor, targetWidth, strength, fmt, quality, afterUrl])

  const outName = source && result
    ? `${source.name.replace(/\.[^.]+$/, '')}-${result.width}x${result.height}.${result.ext}`
    : 'toolhive-upscaled.png'

  return (
    <div>
      {/* ------------------------------------------------------------ action */}
      {source ? (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <Expand className="size-4 text-primary" aria-hidden="true" />
              {source.name}
            </span>
            <span className="text-muted-foreground">
              {source.width}×{source.height} · {formatBytes(source.size)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setSource(null)
                setResult(null)
                setError(null)
                if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current)
              }}
            >
              Start over
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
            <label className="text-xs font-medium text-muted-foreground">
              Enlarge
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={targetWidth ? 'custom' : String(factor)}
                onChange={(e) => {
                  if (e.target.value === 'custom') setTargetWidth(source.width * 2)
                  else {
                    setFactor(Number(e.target.value))
                    setTargetWidth('')
                  }
                }}
              >
                {[2, 3, 4].map((v) => (
                  <option key={v} value={String(v)}>
                    {v}× ({Math.round(source.width * v)}×{Math.round(source.height * v)})
                  </option>
                ))}
                <option value="custom">Exact width…</option>
              </select>
            </label>
            {targetWidth !== '' ? (
              <label className="text-xs font-medium text-muted-foreground">
                Target width (px)
                <input
                  type="number"
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                  min={source.width}
                  max={Math.round(source.width * 8)}
                  value={targetWidth}
                  onChange={(e) => setTargetWidth(Math.max(source.width, Number(e.target.value)))}
                />
              </label>
            ) : (
              <div className="text-xs text-muted-foreground sm:self-end sm:pb-2">
                → output {Math.round(source.width * factor)}×{Math.round(source.height * factor)}
              </div>
            )}
            <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
              Sharpening: <span className="font-mono text-foreground">{strength.toFixed(2)}</span>{' '}
              (unsharp mask — high values halo)
              <input
                type="range"
                className="mt-1 w-full accent-[oklch(0.55_0.14_190)]"
                min={0}
                max={1.5}
                step={0.05}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              Format
              <select
                className="ml-1 inline h-9 rounded-md border bg-background px-2 text-sm"
                value={fmt}
                onChange={(e) => setFmt(e.target.value as 'png' | 'jpg' | 'webp')}
              >
                <option value="png">PNG (lossless)</option>
                <option value="jpg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
            </label>
            {fmt !== 'png' && (
              <label className="text-xs font-medium text-muted-foreground">
                Quality {Math.round(quality * 100)}
                <input
                  type="range"
                  className="ml-2 w-32 align-middle accent-[oklch(0.55_0.14_190)]"
                  min={0.5}
                  max={1}
                  step={0.05}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
              </label>
            )}
            <Button onClick={upscale} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Expand className="size-4" aria-hidden="true" />}
              {busy ? 'Upscaling…' : 'Upscale'}
            </Button>
            {result && (
              <Button
                variant="outline"
                onClick={() => downloadBlob(result.blob, outName)}
              >
                <Download className="size-4" aria-hidden="true" />
                Download {result.width}×{result.height} · {formatBytes(result.blob.size)}
              </Button>
            )}
          </div>

          {/* honest before/after comparison */}
          {afterUrl && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <figure className="rounded-lg border bg-muted/30 p-2">
                <figcaption className="text-xs font-medium text-muted-foreground">
                  Before — {source.width}×{source.height} · {formatBytes(source.size)}
                </figcaption>
                {beforeUrl && (
                   
                  <img src={beforeUrl} alt="Original image" className="mt-2 max-h-56 w-full rounded border object-contain" />
                )}
              </figure>
              <figure className="rounded-lg border bg-muted/30 p-2">
                <figcaption className="text-xs font-medium text-muted-foreground">
                  After — {result?.width}×{result?.height} · {formatBytes(result?.blob.size ?? 0)}
                </figcaption>
                { }
                <img src={afterUrl} alt="Upscaled image" className="mt-2 max-h-56 w-full rounded border object-contain" />
              </figure>
            </div>
          )}
        </div>
      ) : (
        <DropZone
          onFiles={onFiles}
          accept="image/png,image/jpeg,image/webp"
          multiple={false}
          title="Drop an image to enlarge"
          hint="PNG, JPEG or WebP — stepped resampling + sharpening on this device"
        />
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <PrivacyStrip detail="Resampled and sharpened on canvases in this tab — no pixel of the image is uploaded anywhere, and the source file is never modified." />
    </div>
  )
}
