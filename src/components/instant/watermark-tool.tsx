'use client'

// Watermark Studio — stamp text or a logo over a batch of images with
// position, opacity, rotation and tiling, then download the set individually
// or as a ZIP. Format-faithful export (JPEG stays JPEG, PNG keeps alpha).
// Everything is drawn on canvases in this tab; nothing uploads.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DropZone, downloadBlob, PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Mode = 'text' | 'logo'
type Pos = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br'

interface SourceImage {
  file: File
  bitmap: ImageBitmap | HTMLImageElement
}

interface Result {
  name: string
  blob: Blob
  url: string
}

const POSITIONS: Array<{ id: Pos; label: string }> = [
  { id: 'tl', label: 'Top left' }, { id: 'tc', label: 'Top center' }, { id: 'tr', label: 'Top right' },
  { id: 'ml', label: 'Middle left' }, { id: 'mc', label: 'Center' }, { id: 'mr', label: 'Middle right' },
  { id: 'bl', label: 'Bottom left' }, { id: 'bc', label: 'Bottom center' }, { id: 'br', label: 'Bottom right' },
]

const TEXT_COLORS = [
  { id: 'white', label: 'White', color: '#ffffff' },
  { id: 'black', label: 'Black', color: '#111111' },
  { id: 'teal', label: 'Teal', color: '#0f766e' },
]

/** Stamp the watermark onto a canvas copy of `img` with the live settings. */
async function stampImage(
  img: ImageBitmap | HTMLImageElement,
  mode: Mode,
  opts: {
    text: string
    textColor: string
    textScale: number // % of min dimension = font size
    logo: ImageBitmap | HTMLImageElement | null
    logoScale: number
    opacity: number
    rotation: number
    position: Pos
    margin: number // % of min dimension
    tile: boolean
  },
): Promise<HTMLCanvasElement> {
  const w = img.width
  const h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  ctx.save()
  ctx.globalAlpha = opts.opacity

  const minDim = Math.min(w, h)
  const margin = (minDim * opts.margin) / 100

  const anchor = (dw: number, dh: number): { x: number; y: number } => {
    const [v, hz] = opts.position.split('') as [string, string]
    const x = hz === 'l' ? margin : hz === 'r' ? w - dw - margin : (w - dw) / 2
    const y = v === 't' ? margin : v === 'b' ? h - dh - margin : (h - dh) / 2
    return { x, y }
  }

  const drawOne = (cx: number, cy: number) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((opts.rotation * Math.PI) / 180)
    if (mode === 'text' && opts.text) {
      const fontSize = Math.max(10, (minDim * opts.textScale) / 100)
      ctx.font = `600 ${fontSize}px "Hanken Grotesk", system-ui, sans-serif`
      ctx.fillStyle = opts.textColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(opts.text, 0, 0)
    } else if (mode === 'logo' && opts.logo) {
      const lw = (minDim * opts.logoScale) / 100
      const lh = lw * (opts.logo.height / opts.logo.width)
      ctx.drawImage(opts.logo, -lw / 2, -lh / 2, lw, lh)
    }
    ctx.restore()
  }

  if (opts.tile) {
    // diagonal tile grid sized from the watermark itself
    if (mode === 'text' && opts.text) {
      const fontSize = Math.max(10, (minDim * opts.textScale) / 100)
      ctx.font = `600 ${fontSize}px "Hanken Grotesk", system-ui, sans-serif`
      const tw = ctx.measureText(opts.text).width
      const gapX = tw * 1.35
      const gapY = fontSize * 3.2
      const stepX = gapX * 0.72 // diagonal offset
      let row = 0
      for (let y = -gapY; y < h + gapY; y += gapY, row++) {
        for (let x = -gapX; x < w + gapX; x += gapX) {
          drawOne(x + (row % 2) * stepX, y)
        }
      }
    } else if (mode === 'logo' && opts.logo) {
      const lw = (minDim * opts.logoScale) / 100
      const lh = lw * (opts.logo.height / opts.logo.width)
      const gapX = lw * 1.8
      const gapY = lh * 2.6
      const stepX = gapX * 0.72
      let row = 0
      for (let y = -gapY; y < h + gapY; y += gapY, row++) {
        for (let x = -gapX; x < w + gapX; x += gapX) {
          drawOne(x + (row % 2) * stepX, y)
        }
      }
    }
  } else {
    // anchor on the un-rotated box, then rotate around its center
    let dw = 0
    let dh = 0
    if (mode === 'text' && opts.text) {
      const fontSize = Math.max(10, (minDim * opts.textScale) / 100)
      ctx.font = `600 ${fontSize}px "Hanken Grotesk", system-ui, sans-serif`
      dw = ctx.measureText(opts.text).width
      dh = fontSize
    } else if (mode === 'logo' && opts.logo) {
      dw = (minDim * opts.logoScale) / 100
      dh = dw * (opts.logo.height / opts.logo.width)
    }
    const { x, y } = anchor(dw, dh)
    drawOne(x + dw / 2, y + dh / 2)
  }
  ctx.restore()
  return canvas
}

export function WatermarkTool() {
  const [images, setImages] = useState<SourceImage[]>([])
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('© Your name')
  const [textColor, setTextColor] = useState(TEXT_COLORS[0].color)
  const [textScale, setTextScale] = useState(6)
  const [logo, setLogo] = useState<ImageBitmap | HTMLImageElement | null>(null)
  const [logoName, setLogoName] = useState('')
  const [logoScale, setLogoScale] = useState(22)
  const [opacity, setOpacity] = useState(0.45)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState<Pos>('br')
  const [margin, setMargin] = useState(4)
  const [tile, setTile] = useState(false)
  const [quality, setQuality] = useState(0.92)
  const [results, setResults] = useState<Result[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const previewRef = useRef<HTMLCanvasElement>(null)
  const resultUrls = useRef<Result[]>([])

  const opts = { text, textColor, textScale, logo, logoScale, opacity, rotation, position, margin, tile }

  // Live preview of the first image.
  useEffect(() => {
    const canvas = previewRef.current
    const first = images[0]
    if (!canvas || !first) return
    let alive = true
    void stampImage(first.bitmap, mode, opts).then((stamped) => {
      if (!alive) return
      const ctx = canvas.getContext('2d')
      canvas.width = stamped.width
      canvas.height = stamped.height
      ctx?.drawImage(stamped, 0, 0)
    })
    return () => { alive = false }
  }, [images, mode, text, textColor, textScale, logo, logoScale, opacity, rotation, position, margin, tile])

  const clearResults = () => {
    for (const r of resultUrls.current) URL.revokeObjectURL(r.url)
    resultUrls.current = []
    setResults([])
  }

  const onFiles = async (files: File[]) => {
    setError('')
    const ok = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name))
    if (!ok.length) {
      setError('Those are not image files. Drop JPEG, PNG or WebP.')
      return
    }
    const loaded: SourceImage[] = []
    for (const file of ok.slice(0, 60)) {
      try {
        if (typeof createImageBitmap === 'function') {
          loaded.push({ file, bitmap: await createImageBitmap(file) })
        } else {
          const url = URL.createObjectURL(file)
          const img = new Image()
          await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url })
          loaded.push({ file, bitmap: img })
        }
      } catch {
        setError(`"${file.name}" could not be read as an image and was skipped.`)
      }
    }
    clearResults()
    setImages(loaded)
  }

  const onLogo = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    try {
      const bmp = typeof createImageBitmap === 'function'
        ? await createImageBitmap(file)
        : await new Promise<HTMLImageElement>((res, rej) => {
            const img = new Image()
            img.onload = () => res(img)
            img.onerror = rej
            img.src = URL.createObjectURL(file)
          })
      setLogo(bmp)
      setLogoName(file.name)
      setMode('logo')
    } catch {
      setError('That logo file could not be read.')
    }
  }

  const applyAll = async () => {
    if (!images.length) return
    setBusy(true)
    setError('')
    clearResults()
    try {
      const out: Result[] = []
      for (const img of images) {
        const stamped = await stampImage(img.bitmap, mode, opts)
        const isJpeg = img.file.type === 'image/jpeg' || /\.jpe?g$/i.test(img.file.name)
        const type = isJpeg ? 'image/jpeg' : 'image/png'
        const blob = await new Promise<Blob | null>((resolve) =>
          stamped.toBlob(resolve, type, isJpeg ? quality : undefined),
        )
        if (!blob) throw new Error(`Could not encode "${img.file.name}"`)
        const base = img.file.name.replace(/\.[^.]+$/, '')
        const name = `${base}.watermarked.${isJpeg ? 'jpg' : 'png'}`
        out.push({ name, blob, url: URL.createObjectURL(blob) })
      }
      resultUrls.current = out
      setResults(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The batch failed midway.')
    } finally {
      setBusy(false)
    }
  }

  const downloadZip = async () => {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const r of results) zip.file(r.name, r.blob)
    const out = await zip.generateAsync({ type: 'blob' })
    downloadBlob(out, 'watermarked-images.zip')
  }

  useEffect(() => {
    return () => {
      for (const r of resultUrls.current) URL.revokeObjectURL(r.url)
    }
  }, [])

  const removeImage = (idx: number) => {
    setImages((xs) => xs.filter((_, i) => i !== idx))
    clearResults()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        {images.length === 0 && (
          <DropZone
            onFiles={onFiles}
            accept="image/jpeg,image/png,image/webp"
            title="Drop one image or fifty to watermark"
            hint="JPEG, PNG and WebP · stamped and exported on this device"
          />
        )}

        {images.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                <span className="font-medium">{images.length} image{images.length === 1 ? '' : 's'}</span>
                <span className="text-muted-foreground"> loaded · preview shows the first one</span>
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setImages([]); clearResults() }}>
                  <X className="size-4" aria-hidden="true" /> Clear all
                </Button>
              </div>
            </div>
            {images.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {images.map((im, i) => (
                  <span key={`${im.file.name}-${i}`} className="flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs">
                    {im.file.name.length > 22 ? `${im.file.name.slice(0, 20)}…` : im.file.name}
                    <button type="button" aria-label={`Remove ${im.file.name}`} onClick={() => removeImage(i)}>
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              {/* preview */}
              <div>
                <div className="overflow-hidden rounded-lg border bg-muted/30">
                  <canvas ref={previewRef} className="max-h-72 w-full object-contain" aria-label="Watermark preview on the first image" />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Live preview on {images[0]?.file.name} — {images[0]?.bitmap.width}×{images[0]?.bitmap.height}
                </p>
              </div>

              {/* controls */}
              <div className="space-y-3">
                <div className="flex gap-1.5" role="tablist" aria-label="Watermark type">
                  {(['text', 'logo'] as Mode[]).map((m) => (
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
                      {m === 'text' ? 'Text' : 'Logo'}
                    </button>
                  ))}
                </div>

                {mode === 'text' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="wm-text">Watermark text</Label>
                      <Input id="wm-text" value={text} onChange={(e) => setText(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="wm-color">Color</Label>
                      <select
                        id="wm-color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        {TEXT_COLORS.map((c) => (
                          <option key={c.id} value={c.color}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="wm-tscale">Size (% of image)</Label>
                      <Input id="wm-tscale" type="number" min={1} max={40} value={textScale} onChange={(e) => setTextScale(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} className="font-mono" />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="wm-logo">Logo image</Label>
                      <input
                        id="wm-logo"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void onLogo([f])
                          e.target.value = ''
                        }}
                        className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
                      />
                      {logoName && <p className="text-xs text-muted-foreground">Using {logoName}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="wm-lscale">Logo size (% of image)</Label>
                      <Input id="wm-lscale" type="number" min={2} max={80} value={logoScale} onChange={(e) => setLogoScale(Math.max(2, Math.min(80, Number(e.target.value) || 2)))} className="font-mono" />
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="wm-opacity">Opacity</Label>
                    <Input id="wm-opacity" type="number" min={0.05} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Math.max(0.05, Math.min(1, Number(e.target.value) || 0.5)))} className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wm-rot">Rotation °</Label>
                    <Input id="wm-rot" type="number" min={-90} max={90} value={rotation} onChange={(e) => setRotation(Math.max(-90, Math.min(90, Number(e.target.value) || 0)))} className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wm-margin">Margin %</Label>
                    <Input id="wm-margin" type="number" min={0} max={30} value={margin} onChange={(e) => setMargin(Math.max(0, Math.min(30, Number(e.target.value) || 0)))} className="font-mono" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Watermark position">
                    {POSITIONS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={position === p.id}
                        onClick={() => setPosition(p.id)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors',
                          position === p.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2.5 text-sm">
                    <input type="checkbox" checked={tile} onChange={(e) => setTile(e.target.checked)} className="size-4 accent-[var(--primary)]" aria-label="Tile the watermark" />
                    <span>Tile across the image</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={applyAll} disabled={busy || (mode === 'text' && !text.trim()) || (mode === 'logo' && !logo)}>
                <Download className="size-4" aria-hidden="true" /> {busy ? 'Watermarking…' : `Watermark ${images.length === 1 ? 'the image' : `all ${images.length}`}`}
              </Button>
              {images.some((i) => i.file.type === 'image/jpeg' || /\.jpe?g$/i.test(i.file.name)) && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  JPG quality
                  <input type="range" min={0.5} max={1} step={0.02} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-32" aria-label="JPEG export quality" />
                  <span className="font-mono">{Math.round(quality * 100)}%</span>
                </label>
              )}
            </div>

            {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}

            {results.length > 0 && (
              <div className="mt-4 rounded-lg border bg-muted/30 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{results.length} watermarked file{results.length === 1 ? '' : 's'} ready</p>
                  {results.length > 1 && (
                    <Button type="button" variant="outline" size="sm" onClick={downloadZip}>
                      <Download className="size-3.5" aria-hidden="true" /> Download all as ZIP
                    </Button>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {results.map((r) => (
                    <button
                      key={r.name}
                      type="button"
                      onClick={() => downloadBlob(r.blob, r.name)}
                      className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                    >
                      <Download className="mr-1 inline size-3" aria-hidden="true" />
                      {r.name.length > 26 ? `${r.name.slice(0, 24)}…` : r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <PrivacyStrip detail="The images are decoded to bitmaps, stamped on a canvas and re-encoded inside this tab, then handed straight to your downloads. The originals and the watermarked copies never leave the device." />
      </div>
    </div>
  )
}
