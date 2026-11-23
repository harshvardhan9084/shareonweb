'use client'

// Frame Grabber — pull still PNG frames out of a video with the browser's
// own decoder: one frame at the scrub position, or a batch sweep (interval or
// even count) rendered into a contact sheet, downloaded one by one or as a
// ZIP. Everything is local; the video never leaves this device.

import { useCallback, useRef, useState } from 'react'
import { Camera, Download, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { downloadBlob, DropZone, formatBytes, PrivacyStrip } from '@/components/instant/instant-kit'

interface Frame {
  t: number
  blob: Blob
  url: string
  width: number
  height: number
  size: number
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`
}

export function FrameGrabTool() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [duration, setDuration] = useState(0)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [current, setCurrent] = useState(0)
  const [frames, setFrames] = useState<Frame[]>([])
  const [sweepEvery, setSweepEvery] = useState(1)
  const [sweepCount, setSweepCount] = useState(0) // 0 = use interval mode
  const [scale, setScale] = useState(1)
  const videoRef = useRef<HTMLVideoElement>(null)
  const urlRef = useRef<string | null>(null)
  const nextIdRef = useRef(0)

  const cleanup = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setFrames((prev) => {
      for (const f of prev) URL.revokeObjectURL(f.url)
      return []
    })
  }, [])

  // grab the frame currently under the playhead of the hidden video element
  const grabAt = useCallback(async (video: HTMLVideoElement, t: number, outScale: number): Promise<Frame> => {
    await new Promise<void>((resolve) => {
      const done = () => {
        video.removeEventListener('seeked', done)
        resolve()
      }
      video.addEventListener('seeked', done)
      video.currentTime = Math.min(t, Math.max(0, video.duration - 0.01))
      // fallback resolve in case the seeked event is swallowed
      setTimeout(() => {
        video.removeEventListener('seeked', done)
        resolve()
      }, 3000)
    })
    const w = Math.max(2, Math.round(video.videoWidth * outScale))
    const h = Math.max(2, Math.round(video.videoHeight * outScale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is unavailable in this browser.')
    ctx.drawImage(video, 0, 0, w, h)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png'),
    )
    return {
      t,
      blob,
      url: URL.createObjectURL(blob),
      width: w,
      height: h,
      size: blob.size,
    }
  }, [])

  const onVideo = useCallback(
    async (files: File[]) => {
      const f = files[0]
      setError(null)
      setReady(false)
      setDims(null)
      cleanup()
      const url = URL.createObjectURL(f)
      urlRef.current = url
      setBusy('Reading video…')
      // let the <video> element pick it up
      const video = videoRef.current
      if (!video) return
      video.src = url
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          setError('This video reports no duration — it may be a live stream or damaged file.')
          setBusy(null)
          return
        }
        setDuration(video.duration)
        setDims({ w: video.videoWidth, h: video.videoHeight })
        setReady(true)
        setBusy(null)
        setCurrent(0)
      }
      video.onerror = () => {
        setError('This browser could not decode the video. WebM works everywhere; MP4/H.264 depends on the system. DRM-protected streams are refused by the browser.')
        setBusy(null)
      }
    },
    [cleanup],
  )

  const grabCurrent = useCallback(async () => {
    const video = videoRef.current
    if (!video || !ready) return
    setError(null)
    try {
      const frame = await grabAt(video, video.currentTime, scale)
      frame.t = video.currentTime
      setFrames((prev) => [{ ...frame, t: video.currentTime, url: frame.url }, ...prev].slice(0, 120))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grabbing failed.')
    }
  }, [grabAt, ready, scale])

  const runSweep = useCallback(async () => {
    const video = videoRef.current
    if (!video || !ready) return
    setError(null)
    setBusy('Sweeping…')
    const times: number[] = []
    if (sweepCount > 0) {
      const n = Math.min(120, sweepCount)
      for (let i = 0; i < n; i++) times.push(((i + 0.5) / n) * video.duration)
    } else {
      for (let t = sweepEvery / 2; t < video.duration; t += sweepEvery) times.push(t)
      if (!times.length) times.push(video.duration / 2)
    }
    try {
      const taken: Frame[] = []
      for (let i = 0; i < times.length; i++) {
        setBusy(`Sweeping… ${i + 1}/${times.length}`)
        taken.push(await grabAt(video, times[i], scale))
      }
      setFrames((prev) => [...taken, ...prev].slice(0, 120))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The sweep failed.')
    } finally {
      setBusy(null)
    }
  }, [grabAt, ready, scale, sweepEvery, sweepCount])

  const downloadAll = useCallback(async () => {
    if (frames.length < 2) return
    setBusy('Packing ZIP…')
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      for (const f of frames) zip.file(`frame-${f.t.toFixed(2)}s.png`, f.blob)
      const out = await zip.generateAsync({ type: 'blob' })
      downloadBlob(out, 'toolhive-frames.zip')
    } finally {
      setBusy(null)
    }
  }, [frames])

  return (
    <div>
      {/* ------------------------------------------------------------ action */}
      <div className={ready ? 'hidden' : ''}>
        <DropZone
          onFiles={onVideo}
          accept="video/*"
          multiple={false}
          title="Drop a video to pull frames from"
          hint="WebM and MP4 your browser can play — decoded at native resolution, locally"
        />
      </div>

      <video
        ref={videoRef}
        className={ready ? 'sr-only' : 'hidden'}
        muted
        playsInline
        preload="auto"
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
      />

      {ready && videoRef.current && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <Camera className="size-4 text-primary" aria-hidden="true" />
              Video loaded — {dims?.w}×{dims?.h} · {duration.toFixed(1)} s
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setReady(false)
                cleanup()
              }}
            >
              Start over
            </Button>
          </div>

          {/* scrubber: click seeks the hidden video; preview canvas is the grab target */}
          <div className="mt-3">
            <input
              type="range"
              className="w-full accent-[oklch(0.55_0.14_190)]"
              min={0}
              max={Math.max(0.1, duration)}
              step={0.05}
              value={current}
              aria-label="Scrub position (seconds)"
              onChange={(e) => {
                const t = Number(e.target.value)
                setCurrent(t)
                if (videoRef.current) videoRef.current.currentTime = t
              }}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{fmtTime(current)}</span>
              <span>{fmtTime(duration)}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={grabCurrent} disabled={!!busy}>
              <Camera className="size-4" aria-hidden="true" />
              Grab this frame
            </Button>
            <Button variant="outline" onClick={runSweep} disabled={!!busy}>
              {busy?.startsWith('Sweeping') ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {sweepCount > 0 ? `Sweep ${sweepCount} frames` : `Sweep every ${sweepEvery}s`}
            </Button>
            <label className="text-xs font-medium text-muted-foreground">
              Every (s)
              <Input
                type="number"
                className="ml-1 inline h-9 w-20"
                step={0.25}
                min={0.25}
                value={sweepEvery}
                onChange={(e) => {
                  setSweepEvery(Math.max(0.25, Number(e.target.value)))
                  setSweepCount(0)
                }}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              or N frames
              <Input
                type="number"
                className="ml-1 inline h-9 w-20"
                min={1}
                max={120}
                placeholder="—"
                value={sweepCount || ''}
                onChange={(e) => setSweepCount(Math.max(0, Math.min(120, Number(e.target.value))))}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Scale
              <select
                className="ml-1 inline h-9 rounded-md border bg-background px-2 text-sm"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              >
                {[1, 0.5, 0.25].map((v) => (
                  <option key={v} value={v}>
                    {Math.round(v * 100)}%
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* contact sheet */}
          {frames.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {frames.length} frame{frames.length > 1 ? 's' : ''} ·{' '}
                  {formatBytes(frames.reduce((a, f) => a + f.size, 0))}
                </span>
                {frames.length > 1 && (
                  <Button variant="outline" size="sm" onClick={downloadAll} disabled={!!busy}>
                    <Download className="size-4" aria-hidden="true" />
                    {busy === 'Packing ZIP…' ? 'Packing…' : 'Download all as ZIP'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFrames((prev) => {
                      for (const f of prev) URL.revokeObjectURL(f.url)
                      return []
                    })
                  }
                >
                  <Trash2 className="size-4" aria-hidden="true" /> Clear
                </Button>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {frames.map((f) => (
                  <li key={`${f.t}-${f.url}`} className="group relative overflow-hidden rounded-lg border bg-muted/30">
                    { }
                    <img src={f.url} alt={`Frame at ${f.t.toFixed(2)}s`} className="aspect-video w-full object-cover" />
                    <div className="flex items-center justify-between px-2 py-1.5 text-xs">
                      <span className="font-mono text-muted-foreground">{f.t.toFixed(2)}s</span>
                      <button
                        className="font-medium text-primary underline underline-offset-2"
                        onClick={() => downloadBlob(f.blob, `frame-${f.t.toFixed(2)}s.png`)}
                      >
                        PNG
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {busy && busy !== 'Packing ZIP…' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {busy}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <PrivacyStrip detail="Frames are decoded and drawn in this tab — the video never leaves this device and nothing is uploaded. What you grab stays in your downloads folder." />
    </div>
  )
}
