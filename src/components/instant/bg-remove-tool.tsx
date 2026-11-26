'use client'

/*
 * Background Remover — AI cutout + solid-color key, both fully on-device.
 *
 * Two honest engines:
 *  1. AI cutout: @imgly/background-removal (ISNet fp16) lazy-imported on
 *     first use. The model binary (~tens of MB) is fetched once from the
 *     vendor CDN and cached by the browser; the image itself is segmented
 *     in this tab and never uploaded.
 *  2. Solid-color key: pure canvas math. Corner patches are sampled to
 *     guess the key color, a tolerance slider with a soft alpha ramp does
 *     the rest — instant, zero downloads, ideal for green screens and
 *     white product shots.
 *
 * SSR rules respected: no window/screen/navigator during render; engine
 * loads happen inside async event handlers only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Eraser, ImagePlus, RotateCcw, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrivacyStrip, formatBytes } from '@/components/instant/instant-kit'

/* ---------------------------------- types --------------------------------- */

type Mode = 'ai' | 'key'

type Phase = 'idle' | 'engine' | 'processing' | 'done' | 'error'

const IDLE_STATUS: Record<Mode, string> = {
  ai: 'Model not loaded — it fetches on first use (~80 MB one-time from the vendor CDN, then cached by the browser).',
  key: 'Pick or auto-sample the key color, set the tolerance, then apply.',
}

/* -------------------------------- helpers --------------------------------- */

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [255, 255, 255]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return '#' + [r, g, b].map((v) => cl(v).toString(16).padStart(2, '0')).join('')
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode this image in the browser.'))
    img.src = url
  })
}

const CHECKER =
  'repeating-conic-gradient(#e7e5e4 0% 25%, #fafaf9 0% 50%) 0 0 / 16px 16px'

/* Average color of a w×w patch at (x, y) from a drawn-offscreen canvas. */
function samplePatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): [number, number, number] {
  const d = ctx.getImageData(Math.max(0, x), Math.max(0, y), w, h).data
  let r = 0
  let g = 0
  let b = 0
  const n = w * h
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]
    g += d[i + 1]
    b += d[i + 2]
  }
  return [r / n, g / n, b / n]
}

/* -------------------------------- component ------------------------------- */

export function BgRemoveTool() {
  const [mode, setMode] = useState<Mode>('ai')
  const [file, setFile] = useState<File | null>(null)
  const [srcUrl, setSrcUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [statusText, setStatusText] = useState<string>(IDLE_STATUS.ai)
  const [compare, setCompare] = useState(50)
  const [keyColor, setKeyColor] = useState('#ffffff')
  const [tolerance, setTolerance] = useState(28)

  const fileRef = useRef<File | null>(null)
  const srcUrlRef = useRef<string | null>(null)

  /* Object URLs: revoke the previous value when replaced, and on unmount. */
  useEffect(() => {
    return () => {
      if (srcUrl) URL.revokeObjectURL(srcUrl)
    }
  }, [srcUrl])
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [resultUrl])

  const busy = phase === 'engine' || phase === 'processing'

  const downloadName = useMemo(() => {
    const base = (file?.name ?? 'image').replace(/\.[^.]+$/, '')
    return `${base}-cutout.png`
  }, [file])

  const setResult = useCallback((blob: Blob) => {
    setResultBlob(blob)
    setResultUrl(URL.createObjectURL(blob))
  }, [])

  /* ------------------------------ solid-key ------------------------------ */

  const sampleCorners = useCallback(async (url: string) => {
    try {
      const img = await loadImage(url)
      const scale = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(4, Math.round(img.naturalWidth * scale))
      const h = Math.max(4, Math.round(img.naturalHeight * scale))
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(img, 0, 0, w, h)
      const pw = Math.max(2, Math.round(w * 0.05))
      const ph = Math.max(2, Math.round(h * 0.05))
      const corners: Array<[number, number, number]> = [
        samplePatch(ctx, 0, 0, pw, ph),
        samplePatch(ctx, w - pw, 0, pw, ph),
        samplePatch(ctx, 0, h - ph, pw, ph),
        samplePatch(ctx, w - pw, h - ph, pw, ph),
      ]
      const avg = corners.reduce(
        (acc, c2) => [acc[0] + c2[0] / 4, acc[1] + c2[1] / 4, acc[2] + c2[2] / 4] as [number, number, number],
        [0, 0, 0] as [number, number, number],
      )
      setKeyColor(rgbToHex(avg[0], avg[1], avg[2]))
    } catch {
      /* sampling is best-effort; the manual color input remains */
    }
  }, [])

  const runKey = useCallback(
    async (color: string, tol: number) => {
      const f = fileRef.current
      const url = srcUrlRef.current
      if (!f || !url || busy) return
      setPhase('processing')
      setStatusText('Keying out the background on canvas…')
      try {
        const img = await loadImage(url)
        const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.')
        ctx.drawImage(img, 0, 0, w, h)
        const data = ctx.getImageData(0, 0, w, h)
        const px = data.data
        const [kr, kg, kb] = hexToRgb(color)
        /* Soft two-threshold alpha ramp: fully out at t0, fully kept at t1. */
        const t0 = tol * 2.2
        const t1 = t0 + 26
        for (let i = 0; i < px.length; i += 4) {
          const dr = px[i] - kr
          const dg = px[i + 1] - kg
          const db = px[i + 2] - kb
          const d = Math.sqrt(dr * dr + dg * dg + db * db)
          if (d <= t0) px[i + 3] = 0
          else if (d < t1) px[i + 3] = Math.round(((d - t0) / (t1 - t0)) * 255)
        }
        ctx.putImageData(data, 0, 0)
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (!blob) throw new Error('PNG encoding failed in this browser.')
        setResult(blob)
        setPhase('done')
        setStatusText(`Done — ${formatBytes(f.size)} in, ${formatBytes(blob.size)} out (transparent PNG).`)
      } catch (err) {
        setPhase('error')
        setStatusText(err instanceof Error ? err.message : 'Keying failed.')
      }
    },
    [busy, setResult],
  )

  /* -------------------------------- AI mode ------------------------------ */

  const runAi = useCallback(
    async (f: File) => {
      if (busy) return
      setPhase('engine')
      setStatusText('Fetching the segmentation model — one-time download, cached by the browser…')
      try {
        const mod = await import('@imgly/background-removal')
        const blob = await mod.removeBackground(f, {
          model: 'isnet_fp16',
          output: { format: 'image/png' },
          progress: (key: string, cur: number, tot: number) => {
            if (key.startsWith('fetch')) {
              setStatusText(`Downloading model — ${formatBytes(cur)} / ${formatBytes(tot)}`)
            } else {
              setStatusText('Segmenting on your CPU — this can take a few seconds per megapixel…')
            }
          },
        })
        setResult(blob)
        setPhase('done')
        setStatusText(`Done — ${formatBytes(f.size)} in, ${formatBytes(blob.size)} out (transparent PNG).`)
      } catch (err) {
        setPhase('error')
        setStatusText(
          err instanceof Error
            ? `${err.message} — if the model failed to download, solid-key mode works without it.`
            : 'The AI engine failed to load. Solid-key mode works without any download.',
        )
      }
    },
    [busy, setResult],
  )

  /* ------------------------------ file intake ---------------------------- */

  const handleFiles = useCallback(
    (files: File[]) => {
      const f = files[0]
      if (!f) return
      if (!f.type.startsWith('image/')) {
        setPhase('error')
        setStatusText('That file is not an image. Drop a PNG, JPEG, WebP or similar.')
        return
      }
      fileRef.current = f
      setFile(f)
      const url = URL.createObjectURL(f)
      srcUrlRef.current = url
      setSrcUrl(url)
      setResultBlob(null)
      setResultUrl(null)
      setPhase('idle')
      setStatusText(IDLE_STATUS[mode])
      setCompare(50)
      if (mode === 'ai') {
        void runAi(f)
      } else {
        void sampleCorners(url)
      }
    },
    [mode, runAi, sampleCorners],
  )

  const switchMode = useCallback(
    (next: Mode) => {
      if (next === mode) return
      setMode(next)
      setPhase('idle')
      setStatusText(IDLE_STATUS[next])
      setResultBlob(null)
      setResultUrl(null)
    },
    [mode],
  )

  /* Paste-from-clipboard support (Ctrl+V pastes a screenshot straight in). */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) {
            handleFiles([f])
            e.preventDefault()
            break
          }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFiles])

  /* -------------------------------- render ------------------------------- */

  return (
    <div className="flex flex-col gap-4" data-testid="bg-root">
      <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm">
        <div
          className="flex flex-wrap gap-1.5 rounded-full border bg-muted/40 p-1 w-fit"
          role="tablist"
          aria-label="Removal engine"
        >
          <Button
            variant={mode === 'ai' ? 'default' : 'ghost'}
            size="sm"
            className="min-h-[44px] rounded-full"
            onClick={() => switchMode('ai')}
            data-testid="bg-mode-ai"
            aria-selected={mode === 'ai'}
            role="tab"
          >
            <Wand2 className="mr-1 h-4 w-4" aria-hidden="true" /> AI cutout
          </Button>
          <Button
            variant={mode === 'key' ? 'default' : 'ghost'}
            size="sm"
            className="min-h-[44px] rounded-full"
            onClick={() => switchMode('key')}
            data-testid="bg-mode-key"
            aria-selected={mode === 'key'}
            role="tab"
          >
            <Eraser className="mr-1 h-4 w-4" aria-hidden="true" /> Solid-color key
          </Button>
        </div>

        <div>
          <Label htmlFor="bg-file">Image to cut out</Label>
          <Input
            id="bg-file"
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
            data-testid="bg-file-input"
            className="mt-1 cursor-pointer"
          />
          <p className="mt-1 text-xs text-stone-500">
            PNG, JPEG or WebP · drag a file onto the picker or paste with Ctrl+V · processed in this tab, never uploaded
          </p>
        </div>

        {mode === 'ai' ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2" data-testid="bg-ai-note">
            <ImagePlus className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span className="text-sm text-emerald-900">
              AI mode segments people, products and pets on your CPU with an ISNet model. The one-time model
              download comes from the vendor CDN — the image itself never leaves this device.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border px-3 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="bg-key-color">Key color</Label>
              <input
                id="bg-key-color"
                type="color"
                value={keyColor}
                onChange={(e) => setKeyColor(e.target.value)}
                data-testid="bg-key-color"
                className="h-9 w-14 cursor-pointer rounded border border-stone-300 bg-white"
              />
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px] border-stone-300"
                onClick={() => {
                  if (srcUrlRef.current) void sampleCorners(srcUrlRef.current)
                }}
                disabled={busy || !srcUrl}
                data-testid="bg-resample"
              >
                <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" /> Sample corners
              </Button>
            </div>
            <div>
              <Label htmlFor="bg-tolerance">Tolerance ({tolerance})</Label>
              <input
                id="bg-tolerance"
                type="range"
                min={2}
                max={80}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                data-testid="bg-tolerance"
                className="mt-2 w-full cursor-pointer accent-emerald-600"
              />
              <p className="mt-1 text-xs text-stone-500">
                Low tolerance keeps more near-key pixels; high tolerance eats softer edges. A soft alpha ramp
                blends the boundary so cutouts do not look shredded.
              </p>
            </div>
            <Button
              onClick={() => void runKey(keyColor, tolerance)}
              disabled={busy || !file}
              className="min-h-[44px] bg-emerald-700 text-white hover:bg-emerald-800"
              data-testid="bg-apply"
            >
              <Eraser className="mr-1 h-4 w-4" aria-hidden="true" /> Remove background
            </Button>
          </div>
        )}

        <p className="text-sm text-stone-600" data-testid="bg-ai-status" aria-live="polite">
          {busy ? <span className="mr-1 inline h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-300 border-t-emerald-700 align-[-2px]" aria-hidden="true" /> : null}
          {statusText}
        </p>

        {phase === 'error' ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" data-testid="bg-error">
            {statusText}
          </div>
        ) : null}
      </div>

      {srcUrl ? (
        <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm">
          <div>
            <Label htmlFor="bg-compare">Compare — drag the slider: original on the left, cutout on the right</Label>
            <div className="relative mt-2 overflow-hidden rounded-lg border" data-testid="bg-compare">
              <img src={srcUrl} alt="Original image" className="block w-full" data-testid="bg-src-img" />
              {resultUrl ? (
                <img
                  src={resultUrl}
                  alt="Background removed"
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ clipPath: `inset(0 0 0 ${compare}%)`, background: CHECKER }}
                  data-testid="bg-result-img"
                />
              ) : null}
            </div>
            <input
              id="bg-compare"
              type="range"
              min={0}
              max={100}
              value={compare}
              onChange={(e) => setCompare(Number(e.target.value))}
              className="mt-2 w-full cursor-pointer accent-emerald-600"
              data-testid="bg-compare-slider"
            />
          </div>

          {resultBlob && resultUrl ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2" data-testid="bg-result-card">
              <span className="text-sm text-emerald-900" data-testid="bg-size-note">
                Transparent PNG ready — {formatBytes(resultBlob.size)}{file ? ` (from ${formatBytes(file.size)})` : ''}. PNG keeps the alpha channel; JPEG cannot.
              </span>
              <a
                href={resultUrl}
                download={downloadName}
                data-testid="bg-download"
                className="inline-flex min-h-[44px] items-center rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800"
              >
                <Download className="mr-1 h-4 w-4" aria-hidden="true" /> Download PNG
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <PrivacyStrip detail="Both engines run in this tab: the solid-key math is plain canvas code, and the AI model (fetched once from the vendor CDN) segments locally. Your image is never uploaded — there is no upload code on this page." />
    </div>
  )
}

export default BgRemoveTool
