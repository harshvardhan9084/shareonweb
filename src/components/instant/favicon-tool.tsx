'use client'

// Favicon Studio — one image in, the whole favicon set out: 16…512 px PNGs,
// a genuine multi-size .ico built to the ICO container spec (PNG entries),
// an apple-touch icon and the copy-paste <link> block. Every pixel is
// produced on this device via high-quality stepped resampling.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DropZone, downloadBlob, PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

const SIZES = [16, 32, 48, 64, 96, 128, 180, 192, 512] as const
const ICO_SIZES = [16, 32, 48] as const

interface Entry {
  size: number
  blob: Blob
  url: string
}

/** Read a File into an ImageBitmap (or HTMLImageElement fallback). */
async function loadSource(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('This file could not be read as an image.'))
      img.src = url
    })
    return img
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }
}

/** Draw the source into a square canvas of `size` with the chosen fit. */
function drawSquare(
  source: CanvasImageSource & { width: number; height: number },
  size: number,
  fit: 'cover' | 'contain',
  bg: string,
  transparentBg: boolean,
  round: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  if (!transparentBg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, size, size)
  }
  if (round) {
    const r = size * 0.22
    ctx.beginPath()
    ctx.roundRect(0, 0, size, size, r)
    ctx.clip()
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const sw = source.width
  const sh = source.height
  if (fit === 'cover') {
    // center-crop the largest square, scale to fill
    const side = Math.min(sw, sh)
    ctx.drawImage(source, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, size, size)
  } else {
    const scale = Math.min(size / sw, size / sh)
    const w = sw * scale
    const h = sh * scale
    ctx.drawImage(source, (size - w) / 2, (size - h) / 2, w, h)
  }
  return canvas
}

/** High-quality downscale: hop through an intermediate square first so a
 *  2000 px photo reaching 16 px does not fall in one aliasing-prone drop. */
function steppedDraw(
  source: CanvasImageSource & { width: number; height: number },
  size: number,
  fit: 'cover' | 'contain',
  bg: string,
  transparentBg: boolean,
  round: boolean,
): HTMLCanvasElement {
  const srcSide = Math.min(source.width, source.height)
  if (srcSide <= size * 2) {
    return drawSquare(source, size, fit, bg, transparentBg, round)
  }
  const hopSize = Math.max(size * 2, Math.floor(srcSide / 2))
  const hop = document.createElement('canvas')
  hop.width = hopSize
  hop.height = hopSize
  const hctx = hop.getContext('2d')
  if (!hctx) return drawSquare(source, size, fit, bg, transparentBg, round)
  hctx.imageSmoothingEnabled = true
  hctx.imageSmoothingQuality = 'high'
  const sw = source.width
  const sh = source.height
  if (fit === 'cover') {
    hctx.drawImage(source, (sw - srcSide) / 2, (sh - srcSide) / 2, srcSide, srcSide, 0, 0, hopSize, hopSize)
  } else {
    const scale = Math.min(hopSize / sw, hopSize / sh)
    const w = sw * scale
    const h = sh * scale
    hctx.drawImage(source, (hopSize - w) / 2, (hopSize - h) / 2, w, h)
  }
  return drawSquare(hop, size, fit, bg, transparentBg, round)
}

/** Build a real .ico container (ICO spec: ICONDIR + entries + PNG payloads). */
async function buildIco(pngs: Map<number, Blob>): Promise<Blob> {
  const entries: Array<{ size: number; bytes: Uint8Array }> = []
  for (const s of ICO_SIZES) {
    const blob = pngs.get(s)
    if (!blob) continue
    entries.push({ size: s, bytes: new Uint8Array(await blob.arrayBuffer()) })
  }
  const headerSize = 6 + entries.length * 16
  const total = headerSize + entries.reduce((a, e) => a + e.bytes.length, 0)
  const buf = new ArrayBuffer(total)
  const view = new DataView(buf)
  // ICONDIR: reserved 0, type 1 (icon), count
  view.setUint16(0, 0, true)
  view.setUint16(2, 1, true)
  view.setUint16(4, entries.length, true)
  let offset = headerSize
  entries.forEach((e, i) => {
    const dir = 6 + i * 16
    view.setUint8(dir, e.size >= 256 ? 0 : e.size) // width (0 = 256)
    view.setUint8(dir + 1, e.size >= 256 ? 0 : e.size) // height
    view.setUint8(dir + 2, 0) // palette count (PNG entries carry their own)
    view.setUint8(dir + 3, 0) // reserved
    view.setUint16(dir + 4, 1, true) // color planes
    view.setUint16(dir + 6, 32, true) // bits per pixel
    view.setUint32(dir + 8, e.bytes.length, true) // data size
    view.setUint32(dir + 12, offset, true) // data offset
    new Uint8Array(buf, offset, e.bytes.length).set(e.bytes)
    offset += e.bytes.length
  })
  return new Blob([buf], { type: 'image/x-icon' })
}

export function FaviconTool() {
  const [source, setSource] = useState<ImageBitmap | HTMLImageElement | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [sourceInfo, setSourceInfo] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [ico, setIco] = useState<Blob | null>(null)
  const [fit, setFit] = useState<'cover' | 'contain'>('cover')
  const [bg, setBg] = useState('#0f766e')
  const [transparentBg, setTransparentBg] = useState(true)
  const [round, setRound] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const sourceRef = useRef<File | null>(null)

  const cleanup = () => {
    setEntries((prev) => {
      for (const e of prev) URL.revokeObjectURL(e.url)
      return []
    })
  }

  const generate = useCallback(async () => {
    const src = sourceRef.current
    if (!src) return
    setBusy(true)
    setError('')
    cleanup()
    try {
      const img = await loadSource(src)
      setSource(img)
      setSourceInfo(`${img.width} × ${img.height} px source`)
      const pngs = new Map<number, Blob>()
      const out: Entry[] = []
      for (const size of SIZES) {
        const canvas = steppedDraw(img, size, fit, bg, transparentBg, round)
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (!blob) throw new Error(`The browser refused to encode the ${size} px icon`)
        pngs.set(size, blob)
        out.push({ size, blob, url: URL.createObjectURL(blob) })
      }
      setEntries(out)
      setIco(await buildIco(pngs))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The image could not be processed.')
    } finally {
      setBusy(false)
    }
  }, [fit, bg, transparentBg, round])

  const onFiles = (files: File[]) => {
    const file = files.find((f) => f.type.startsWith('image/'))
    if (!file) {
      setError('Drop an image file — PNG, JPEG, WebP or SVG saved as an image.')
      return
    }
    sourceRef.current = file
    setSourceName(file.name)
    void generate()
  }

  // Re-generate when fit/background/mask settings change with a source loaded.
  useEffect(() => {
    if (sourceRef.current) void generate()
    }, [fit, bg, transparentBg, round])

  useEffect(() => {
    return () => {
      setEntries((prev) => {
        for (const e of prev) URL.revokeObjectURL(e.url)
        return []
      })
    }
  }, [])

  const downloadOne = (e: Entry) => {
    const suffix = e.size === 180 ? '-apple-touch' : ''
    downloadBlob(e.blob, `favicon${suffix}-${e.size}x${e.size}.png`)
  }

  const downloadZip = async () => {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const e of entries) {
      const suffix = e.size === 180 ? '-apple-touch' : ''
      zip.file(`favicon${suffix}-${e.size}x${e.size}.png`, e.blob)
    }
    if (ico) zip.file('favicon.ico', ico)
    zip.file('html-snippet.html', snippet)
    const out = await zip.generateAsync({ type: 'blob' })
    downloadBlob(out, 'favicon-pack.zip')
  }

  const snippet = `<!-- paste into the <head> of every page -->
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16">
<link rel="apple-touch-icon" href="/favicon-apple-touch-180x180.png">
<link rel="manifest" href="/manifest.webmanifest">
<!-- manifest icons: favicon-192x192.png and favicon-512x512.png -->`

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* manual selection still possible */
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        {!sourceName && (
          <DropZone
            onFiles={onFiles}
            accept="image/*"
            multiple={false}
            title="Drop one image to become every favicon size"
            hint="Resized on this device with high-quality downsampling — nothing uploads"
          />
        )}

        {sourceName && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="rounded-md border bg-muted/40 px-2.5 py-1 text-xs font-medium">{sourceName}</span>
                {sourceInfo && <span className="text-xs text-muted-foreground">{sourceInfo}</span>}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  sourceRef.current = null
                  setSourceName('')
                  setSource(null)
                  setSourceInfo('')
                  setError('')
                  cleanup()
                  setIco(null)
                }}
              >
                <X className="size-4" aria-hidden="true" /> Choose another image
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fv-fit">Fit</Label>
                <select
                  id="fv-fit"
                  value={fit}
                  onChange={(e) => setFit(e.target.value as 'cover' | 'contain')}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="cover">Cover (center-crop)</option>
                  <option value="contain">Contain (letterbox)</option>
                </select>
              </div>
              {fit === 'contain' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="fv-bg">Letterbox color</Label>
                    <input
                      id="fv-bg"
                      type="color"
                      value={bg}
                      onChange={(e) => { setBg(e.target.value); setTransparentBg(false) }}
                      className="h-9 w-14 rounded-md border bg-background p-1"
                      aria-label="Letterbox background color"
                    />
                  </div>
                  <label className="flex items-center gap-2.5 pb-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={transparentBg}
                      onChange={(e) => setTransparentBg(e.target.checked)}
                      className="size-4 accent-[var(--primary)]"
                      aria-label="Keep letterbox transparent"
                    />
                    <span>Transparent letterbox</span>
                  </label>
                </>
              )}
              <label className="flex items-center gap-2.5 pb-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={round}
                  onChange={(e) => setRound(e.target.checked)}
                  className="size-4 accent-[var(--primary)]"
                  aria-label="Rounded corners"
                />
                <span>Rounded corners</span>
              </label>
              {busy && <span className="pb-2 text-xs text-muted-foreground">Rendering {SIZES.length} sizes…</span>}
            </div>

            {error && (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            {entries.length > 0 && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {entries.map((e) => (
                    <div key={e.size} className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-medium">{e.size} × {e.size}</span>
                        <button
                          type="button"
                          onClick={() => downloadOne(e)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          aria-label={`Download the ${e.size} px icon`}
                        >
                          <Download className="size-3" aria-hidden="true" /> PNG
                        </button>
                      </div>
                      <div className="mt-2.5 flex items-center justify-center gap-3">
                        {/* true pixel size previews on light and dark chips */}
                        <span className="flex h-14 w-14 items-center justify-center rounded-md border bg-white">
                          <img src={e.url} alt={`${e.size} px icon on light`} width={e.size} height={e.size} style={{ width: e.size, height: e.size }} />
                        </span>
                        <span className="flex h-14 w-14 items-center justify-center rounded-md border bg-neutral-900">
                          <img src={e.url} alt={`${e.size} px icon on dark`} width={e.size} height={e.size} style={{ width: e.size, height: e.size }} />
                        </span>
                      </div>
                    </div>
                  ))}
                  {ico && (
                    <div className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-medium">favicon.ico</span>
                        <button
                          type="button"
                          onClick={() => downloadBlob(ico, 'favicon.ico')}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          aria-label="Download favicon.ico"
                        >
                          <Download className="size-3" aria-hidden="true" /> ICO
                        </button>
                      </div>
                      <div className="mt-2.5 flex items-center justify-center">
                        <span className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground">16 + 32 + 48 in one container</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <Button type="button" onClick={downloadZip}>
                    <Download className="size-4" aria-hidden="true" /> Download favicon-pack.zip
                  </Button>
                </div>

                <div className="mt-4 rounded-lg border bg-muted/30 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Paste this into your &lt;head&gt;</p>
                    <Button type="button" variant="outline" size="sm" onClick={copySnippet}>
                      {copied ? 'Copied' : 'Copy snippet'}
                    </Button>
                  </div>
                  <pre className="mt-2 overflow-auto rounded-md bg-background p-3 font-mono text-xs leading-relaxed">{snippet}</pre>
                </div>
              </>
            )}
          </>
        )}

        <PrivacyStrip detail="Every icon is resized on a canvas inside this tab and handed straight to your downloads. The .ico is assembled byte-by-byte here too — no image of yours is sent to any server, because there is no upload code on this page." />
      </div>
    </div>
  )
}
