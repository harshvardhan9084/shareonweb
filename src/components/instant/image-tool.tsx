'use client'

// Image Toolkit — compress, convert and resize images entirely on this device
// using the Canvas API and the browser's own encoders. Nothing is uploaded.

import { useCallback, useMemo, useState } from 'react'
import { Image as ImageIcon, Loader2, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  DownloadAllButton,
  DropZone,
  downloadBlob,
  formatBytes,
  PrivacyStrip,
} from '@/components/instant/instant-kit'

type Mode = 'compress' | 'convert' | 'resize'
type Target = 'image/png' | 'image/jpeg' | 'image/webp'

interface InputImage {
  file: File
  bitmap: ImageBitmap
}

interface OutputImage {
  name: string
  blob: Blob
  originalSize: number
  width: number
  height: number
}

const MIME_EXT: Record<Target, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

const isImage = (f: File) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)

async function loadImage(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file)
}

export function ImageTool() {
  const [images, setImages] = useState<InputImage[]>([])
  const [outputs, setOutputs] = useState<OutputImage[]>([])
  const [mode, setMode] = useState<Mode>('compress')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // compress
  const [quality, setQuality] = useState(75)
  const [targetKB, setTargetKB] = useState<number | null>(null)
  // convert
  const [target, setTarget] = useState<Target>('image/webp')
  // resize
  const [scale, setScale] = useState(50)
  const [widthPx, setWidthPx] = useState<number | ''>('')
  const [lockAspect, setLockAspect] = useState(true)
  const [heightPx, setHeightPx] = useState<number | ''>('')

  const originalSize = useMemo(() => images.reduce((s, i) => s + i.file.size, 0), [images])
  const outputSize = useMemo(() => outputs.reduce((s, o) => s + o.blob.size, 0), [outputs])

  const handleFiles = useCallback(async (files: File[]) => {
    setError(null)
    setOutputs([])
    const imgs = files.filter(isImage)
    if (!imgs.length) {
      setError('None of those files are images. Drop PNG, JPEG, WebP, GIF or BMP files.')
      return
    }
    try {
      const bitmaps = await Promise.all(imgs.map(loadImage))
      setImages((prev) => [
        ...prev,
        ...imgs.map((file, i) => ({ file, bitmap: bitmaps[i] })),
      ])
    } catch {
      setError('One of the images could not be decoded by this browser.')
    }
  }, [])

  function reset() {
    setImages([])
    setOutputs([])
    setError(null)
    setTargetKB(null)
  }

  /** Encode a bitmap to a blob with the current options. */
  async function encode(img: InputImage): Promise<OutputImage> {
    const w0 = img.bitmap.width
    const h0 = img.bitmap.height
    let w = w0
    let h = h0
    if (mode === 'resize') {
      if (widthPx !== '' && widthPx > 0) {
        w = Math.round(widthPx)
        h = lockAspect ? Math.round((h0 * w) / w0) : heightPx !== '' && heightPx > 0 ? Math.round(heightPx) : h0
      } else if (heightPx !== '' && heightPx > 0 && !lockAspect) {
        h = Math.round(heightPx)
      } else {
        w = Math.max(1, Math.round((w0 * scale) / 100))
        h = Math.max(1, Math.round((h0 * scale) / 100))
      }
    }
    const mime: Target = mode === 'convert' ? target : mode === 'compress' ? 'image/webp' : img.file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const q = mode === 'compress' ? quality / 100 : mode === 'convert' && mime === 'image/png' ? undefined : 0.9

    // Target-size mode: binary-search the quality (WebP/JPEG only).
    let blob: Blob | null = null
    let usedQ = q
    if (mode === 'compress' && targetKB && mime !== 'image/png') {
      let lo = 0.05
      let hi = 0.95
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        const canvas = new OffscreenCanvas(w, h)
        canvas.getContext('2d')!.drawImage(img.bitmap, 0, 0, w, h)
        const b = await canvas.convertToBlob({ type: mime, quality: mid })
        if (b.size / 1024 > targetKB) hi = mid
        else {
          lo = mid
          blob = b
          usedQ = mid
        }
      }
      if (!blob) {
        const canvas = new OffscreenCanvas(w, h)
        canvas.getContext('2d')!.drawImage(img.bitmap, 0, 0, w, h)
        blob = await canvas.convertToBlob({ type: mime, quality: lo })
      }
      void usedQ
    } else {
      const canvas = new OffscreenCanvas(w, h)
      const ctx = canvas.getContext('2d')!
      // Flatten transparency onto white for JPEG so it does not turn black.
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
      }
      ctx.drawImage(img.bitmap, 0, 0, w, h)
      blob = await canvas.convertToBlob({ type: mime, quality: q })
    }

    const base = img.file.name.replace(/\.[^.]+$/, '')
    return {
      name: `${base}.${MIME_EXT[mime]}`,
      blob,
      originalSize: img.file.size,
      width: w,
      height: h,
    }
  }

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const out: OutputImage[] = []
      for (const img of images) out.push(await encode(img))
      setOutputs(out)
    } catch {
      setError('Processing failed — the images may be too large for this device\u2019s memory.')
    } finally {
      setBusy(false)
    }
  }

  const saving = originalSize > 0 && outputSize > 0 ? Math.max(0, Math.round((1 - outputSize / originalSize) * 100)) : 0

  return (
    <div>
      {!images.length ? (
        <DropZone
          onFiles={(f) => void handleFiles(f)}
          accept="image/*"
          title="Drop one or many images"
          hint="PNG, JPEG, WebP, GIF, BMP — processed locally, in batches."
        />
      ) : (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="size-4 text-primary" aria-hidden="true" />
              {images.length} image{images.length === 1 ? '' : 's'} · {formatBytes(originalSize)}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={reset}>
                Start over
              </Button>
              <Button size="sm" onClick={run} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <SlidersHorizontal className="size-4" aria-hidden="true" />}
                {busy ? 'Processing…' : 'Process now'}
              </Button>
            </div>
          </div>

          {/* mode switch */}
          <div className="mt-4 flex flex-wrap gap-1.5 rounded-full border bg-muted/40 p-1" role="tablist" aria-label="Image operations">
            {(['compress', 'convert', 'resize'] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setOutputs([]) }}
                className={
                  mode === m
                    ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                    : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground'
                }
              >
                {m === 'compress' ? 'Compress' : m === 'convert' ? 'Convert' : 'Resize'}
              </button>
            ))}
          </div>

          {/* options */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {mode === 'compress' && (
              <>
                <div>
                  <Label htmlFor="img-quality">Quality: {quality}%</Label>
                  <Slider id="img-quality" min={5} max={100} step={1} value={[quality]} onValueChange={([v]) => setQuality(v)} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="img-target">Target size per image (KB, optional)</Label>
                  <Input
                    id="img-target"
                    type="number"
                    min={10}
                    placeholder="e.g. 200"
                    value={targetKB ?? ''}
                    onChange={(e) => setTargetKB(e.target.value ? Number(e.target.value) : null)}
                    className="mt-2"
                  />
                </div>
              </>
            )}
            {mode === 'convert' && (
              <div className="sm:col-span-2">
                <Label>Convert to</Label>
                <div className="mt-2 flex gap-1.5 rounded-full border bg-muted/40 p-1" role="tablist" aria-label="Target format">
                  {(['image/webp', 'image/jpeg', 'image/png'] as Target[]).map((t) => (
                    <button
                      key={t}
                      role="tab"
                      aria-selected={target === t}
                      onClick={() => setTarget(t)}
                      className={
                        target === t
                          ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                          : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground'
                      }
                    >
                      {MIME_EXT[t].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {mode === 'resize' && (
              <>
                <div>
                  <Label htmlFor="img-width">Width (px)</Label>
                  <Input id="img-width" type="number" min={1} placeholder="e.g. 1280" value={widthPx} onChange={(e) => setWidthPx(e.target.value ? Number(e.target.value) : '')} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="img-height">Height (px, needs aspect unlock)</Label>
                  <Input id="img-height" type="number" min={1} placeholder="auto" value={heightPx} onChange={(e) => setHeightPx(e.target.value ? Number(e.target.value) : '')} disabled={lockAspect} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="img-scale">Or scale: {scale}%</Label>
                  <Slider id="img-scale" min={5} max={200} step={5} value={[scale]} onValueChange={([v]) => setScale(v)} className="mt-2" />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <Switch id="img-lock" checked={lockAspect} onCheckedChange={setLockAspect} />
                  <Label htmlFor="img-lock">Lock aspect ratio</Label>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {outputs.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4">
            <p className="text-sm font-medium">
              {outputs.length} result{outputs.length === 1 ? '' : 's'} · {formatBytes(outputSize)}
              {saving > 0 && <span className="ml-1 text-primary">({saving}% smaller)</span>}
            </p>
            <DownloadAllButton
              files={outputs.map((o) => ({ name: o.name, blob: o.blob }))}
              archiveName="images.zip"
            />
          </div>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {outputs.map((o) => (
              <li key={o.name} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <img
                  src={URL.createObjectURL(o.blob)}
                  alt={`Processed result ${o.name}`}
                  className="size-14 rounded-lg border object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.width}×{o.height} · {formatBytes(o.originalSize)} → {formatBytes(o.blob.size)}
                    {o.blob.size < o.originalSize && (
                      <span className="text-primary"> ({Math.round((1 - o.blob.size / o.originalSize) * 100)}%)</span>
                    )}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => downloadBlob(o.blob, o.name)}>
                  Save
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PrivacyStrip detail="Every pixel is processed by this browser's own Canvas engine. Your images are never uploaded to anyone." />
    </div>
  )
}
