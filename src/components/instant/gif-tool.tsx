'use client'

// GIF Studio — two local jobs: video → GIF (sampled from the browser's video
// decoder, quantized per frame with gifenc) and GIF → smaller GIF (decoded
// with gifuct-js, scaled + frame-skipped, re-encoded). No upload anywhere.
// Doctrine: DESIGN.md at the repo root.

import { useCallback, useRef, useState } from 'react'
import { Download, Film, Loader2, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { downloadBlob, DropZone, formatBytes, PrivacyStrip } from '@/components/instant/instant-kit'
import { quantize, applyPalette, GIFEncoder } from 'gifenc'
import { parseGIF, decompressFrames } from 'gifuct-js'

type Mode = 'idle' | 'video' | 'shrink'

// 8×8 Bayer matrix, normalized to ±strength — ordered dithering that keeps
// gradients smooth in 256 colors without smearing edges.
const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

function bayerDither(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  strength: number,
): void {
  for (let i = 0; i < data.length; i += 4) {
    const p = i >> 2
    const px = p % width
    const py = ((p / width) | 0) % 8
    const d = (BAYER[py][px % 8] / 64 - 0.5) * strength
    data[i] = Math.max(0, Math.min(255, data[i] + d))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + d))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + d))
  }
}

/** Encode an RGBA ImageData to an indexed GIF frame via a fresh palette. */
function encodeFrame(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  delayMs: number,
  dither: boolean,
  encoder: ReturnType<typeof GIFEncoder>,
): void {
  const rgba = new Uint8Array(data.buffer.slice(0))
  if (dither) bayerDither(rgba, width, 48)
  const palette = quantize(rgba, 256, { format: 'rgb565' })
  const index = applyPalette(rgba, palette, 'rgb565')
  encoder.writeFrame(index, width, height, { palette, delay: delayMs, repeat: 0 })
}

interface GifResult {
  name: string
  blob: Blob
  frames: number
  srcSize: number
  outSize: number
  width: number
  height: number
}

export function GifTool() {
  const [mode, setMode] = useState<Mode>('idle')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<GifResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // video→gif controls
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [clipLen, setClipLen] = useState(5)
  const [fps, setFps] = useState(10)
  const [width, setWidth] = useState(480)
  const [dither, setDither] = useState(true)

  // shrink controls
  const [scale, setScale] = useState(0.5)
  const [frameSkip, setFrameSkip] = useState(2)

  const urlRef = useRef<string | null>(null)

  const cleanup = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }

  // ------------------------------------------------------- routing ingest
  // One zone, both jobs: what was dropped decides the mode. A video goes to
  // the GIF maker, a GIF goes to the shrinker — no guessing by the user.
  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]
    setError(null)
    setResult(null)
    setBusy('Reading…')
    cleanup()
    const isVideo = f.type.startsWith('video/')
    try {
      if (isVideo) {
        const url = URL.createObjectURL(f)
        urlRef.current = url
        const video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.preload = 'auto'
        video.src = url
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve()
          video.onerror = () => reject(new Error('This browser could not decode the video. WebM always works; MP4/H.264 depends on the system.'))
          setTimeout(() => reject(new Error('The video took too long to open — try a smaller file.')), 15000)
        })
        const dur = video.duration
        if (!Number.isFinite(dur) || dur <= 0) {
          throw new Error('The video reported no duration — it may be a live stream or damaged file.')
        }
        setMode('video')
        setDuration(dur)
        setStart(0)
        setClipLen(Math.min(10, Math.max(0.5, dur)))
        ;(window as unknown as { __gifVideo: HTMLVideoElement }).__gifVideo = video
      } else {
        const buf = await f.arrayBuffer()
        const gif = parseGIF(buf)
        const frames = decompressFrames(gif, true)
        if (!frames.length) throw new Error('The GIF contains no frames.')
        setMode('shrink')
        ;(window as unknown as { __gifFrames?: { frames: typeof frames; w: number; h: number; name: string; size: number } })
          .__gifFrames = { frames, w: gif.lsd.width, h: gif.lsd.height, name: f.name, size: f.size }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setBusy(null)
    }
  }, [])

  const makeGifFromVideo = useCallback(async () => {
    const video = (window as unknown as { __gifVideo?: HTMLVideoElement }).__gifVideo
    if (!video) return
    setError(null)
    setResult(null)
    setBusy('Capturing frames…')
    try {
      await new Promise((r) => setTimeout(r, 20))
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) throw new Error('No video frames available.')
      const w = Math.min(width, vw) | 0
      const h = Math.max(2, Math.round((w / vw) * vh) | 0)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Canvas is unavailable in this browser.')
      const len = Math.min(clipLen, duration - start)
      const frameCount = Math.max(1, Math.round(len * fps))
      const delayMs = 1000 / fps
      const encoder = GIFEncoder()
      for (let i = 0; i < frameCount; i++) {
        const t = start + (i * len) / frameCount
        await new Promise<void>((resolve) => {
          const done = () => {
            video.removeEventListener('seeked', done)
            resolve()
          }
          video.addEventListener('seeked', done)
          video.currentTime = Math.min(t, duration - 0.01)
          setTimeout(() => {
            video.removeEventListener('seeked', done)
            resolve()
          }, 3000)
        })
        ctx.drawImage(video, 0, 0, w, h)
        encodeFrame(ctx.getImageData(0, 0, w, h).data, w, h, delayMs, dither, encoder)
        setBusy(`Capturing frames… ${i + 1}/${frameCount}`)
      }
      encoder.finish()
      const blob = new Blob([encoder.bytes() as unknown as BlobPart], { type: 'image/gif' })
      if (blob.size < 64) throw new Error('Encoding produced nothing — try a shorter range.')
      setResult({
        name: 'toolhive-clip.gif',
        blob,
        frames: frameCount,
        srcSize: 0,
        outSize: blob.size,
        width: w,
        height: h,
      })
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GIF rendering failed.')
    } finally {
      setBusy(null)
    }
  }, [start, clipLen, fps, width, dither, duration])

  // ------------------------------------------------------- gif → smaller
  const shrinkGif = useCallback(async () => {
    const held = (window as unknown as {
      __gifFrames?: { frames: Array<{ dims: { width: number; height: number; top: number; left: number }; delay: number; patch: Uint8ClampedArray; disposalType: number }>; w: number; h: number; name: string; size: number }
    }).__gifFrames
    if (!held) return
    setError(null)
    setResult(null)
    setBusy('Re-encoding…')
    try {
      await new Promise((r) => setTimeout(r, 20))
      const { frames, w, h, name, size } = held
      const outW = Math.max(2, Math.round(w * scale))
      const outH = Math.max(2, Math.round(h * scale))
      // full-size compositing canvas (handles frame patches + disposal)
      const comp = document.createElement('canvas')
      comp.width = w
      comp.height = h
      const compCtx = comp.getContext('2d', { willReadFrequently: true })
      if (!compCtx) throw new Error('Canvas is unavailable.')
      const out = document.createElement('canvas')
      out.width = outW
      out.height = outH
      const outCtx = out.getContext('2d', { willReadFrequently: true })
      if (!outCtx) throw new Error('Canvas is unavailable.')
      const encoder = GIFEncoder()
      let kept = 0
      let pendingDelay = 0
      let savedPatch: ImageData | null = null
      for (let i = 0; i < frames.length; i++) {
        const fr = frames[i]
        const { width: pw, height: ph, top, left } = fr.dims
        // disposal handling per the GIF spec
        if (fr.disposalType === 3 && savedPatch) compCtx.putImageData(savedPatch, 0, 0)
        if (fr.disposalType === 3) {
          savedPatch = compCtx.getImageData(left, top, pw, ph)
        }
        const patch = new ImageData(new Uint8ClampedArray(fr.patch), pw, ph)
        compCtx.putImageData(patch, left, top)
        pendingDelay += fr.delay
        if (i % frameSkip === 0) {
          outCtx.drawImage(comp, 0, 0, w, h, 0, 0, outW, outH)
          encodeFrame(outCtx.getImageData(0, 0, outW, outH).data, outW, outH, pendingDelay, false, encoder)
          pendingDelay = 0
          kept++
          setBusy(`Re-encoding… ${kept}/${Math.ceil(frames.length / frameSkip)}`)
        }
        if (fr.disposalType === 2) {
          compCtx.clearRect(left, top, pw, ph)
        }
      }
      encoder.finish()
      const blob = new Blob([encoder.bytes() as unknown as BlobPart], { type: 'image/gif' })
      if (blob.size < 64) throw new Error('Encoding produced nothing.')
      setResult({
        name: name.replace(/\.gif$/i, '') + '-small.gif',
        blob,
        frames: kept,
        srcSize: size,
        outSize: blob.size,
        width: outW,
        height: outH,
      })
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Shrinking failed.')
    } finally {
      setBusy(null)
    }
  }, [scale, frameSkip])

  return (
    <div>
      {/* ------------------------------------------------------------ action */}
      {mode === 'idle' && (
        <DropZone
          onFiles={onFiles}
          accept="video/*,image/gif"
          multiple={false}
          title="Drop a video to make a GIF — or a GIF to shrink it"
          hint="The page routes by what you dropped · sampled, scaled and encoded locally"
        />
      )}

      {mode === 'video' && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Film className="size-4 text-primary" aria-hidden="true" />
            Video loaded — {duration.toFixed(1)} s available
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setMode('idle'); cleanup() }}>
              Start over
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-muted-foreground">
              Start (s)
              <Input type="number" className="mt-1 h-9" step={0.1} min={0} max={duration} value={start}
                onChange={(e) => setStart(Math.max(0, Math.min(Number(e.target.value), duration - 0.1)))} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Length (s)
              <Input type="number" className="mt-1 h-9" step={0.5} min={0.5} max={Math.min(30, duration)} value={clipLen}
                onChange={(e) => setClipLen(Math.max(0.5, Math.min(Number(e.target.value), Math.min(30, duration - start))))} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Frame rate
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={fps}
                onChange={(e) => setFps(Number(e.target.value))}>
                {[5, 8, 10, 12, 15, 20].map((v) => <option key={v} value={v}>{v} fps</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Width
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={width}
                onChange={(e) => setWidth(Number(e.target.value))}>
                {[320, 480, 640, 800].map((v) => <option key={v} value={v}>{v} px</option>)}
              </select>
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[oklch(0.55_0.14_190)]" checked={dither}
              onChange={(e) => setDither(e.target.checked)} />
            Bayer dithering (smooth gradients — off for flat art)
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={makeGifFromVideo} disabled={!!busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Scissors className="size-4" aria-hidden="true" />}
              {busy ?? `Make GIF — ${Math.round(clipLen * fps)} frames`}
            </Button>
            {result && (
              <Button variant="outline" onClick={() => downloadBlob(result.blob, result.name)}>
                <Download className="size-4" aria-hidden="true" />
                Download GIF · {formatBytes(result.blob.size)}
              </Button>
            )}
          </div>
        </div>
      )}

      {mode === 'shrink' && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Film className="size-4 text-primary" aria-hidden="true" />
            GIF loaded
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setMode('idle'); cleanup() }}>
              Start over
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-muted-foreground">
              Scale
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={scale}
                onChange={(e) => setScale(Number(e.target.value))}>
                {[0.25, 0.5, 0.75, 1].map((v) => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Frame skip
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={frameSkip}
                onChange={(e) => setFrameSkip(Number(e.target.value))}>
                {[1, 2, 3, 4].map((v) => <option key={v} value={v}>{v === 1 ? 'Keep all frames' : `Keep every ${v}th`}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={shrinkGif} disabled={!!busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Scissors className="size-4" aria-hidden="true" />}
              {busy ?? 'Shrink GIF'}
            </Button>
            {result && (
              <Button variant="outline" onClick={() => downloadBlob(result.blob, result.name)}>
                <Download className="size-4" aria-hidden="true" />
                Download · {formatBytes(result.blob.size)} (from {formatBytes(result.srcSize)})
              </Button>
            )}
          </div>
        </div>
      )}

      {busy && !mode.startsWith('video') && mode !== 'shrink' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {busy}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium">{result.name}</span>
            <span className="text-muted-foreground">
              {result.width}×{result.height} · {result.frames} frames · {formatBytes(result.outSize)}
            </span>
            {result.srcSize > 0 && (
              <span className={result.outSize < result.srcSize ? 'font-medium text-primary' : 'text-muted-foreground'}>
                {result.outSize < result.srcSize
                  ? `${Math.round((1 - result.outSize / result.srcSize) * 100)}% smaller`
                  : `${Math.round((result.outSize / result.srcSize - 1) * 100)}% larger — try a lower scale or more frame skip`}
              </span>
            )}
          </div>
          {previewUrl && (
             
            <img src={previewUrl} alt="Rendered GIF preview" className="mt-3 max-h-64 rounded-lg border bg-[repeating-conic-gradient(#e5e5e5_0%_25%,white_0%_50%)] bg-[length:16px_16px]" />
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <PrivacyStrip detail="Frames are captured by this browser's video engine and encoded with gifenc in this tab — the video or GIF never leaves this device, and nothing is uploaded to any server." />
    </div>
  )
}
