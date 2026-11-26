'use client'

// Video Studio — compress and trim video files entirely on this device using
// ffmpeg.wasm (single-thread build, no SharedArrayBuffer requirement). The
// engine (~32 MB) self-hosts from /ffmpeg and loads on first use; after that
// the browser cache serves it. Files never leave the tab.

import { useEffect, useRef, useState } from 'react'
import { Download, Film, Loader2, Scissors, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrivacyStrip, downloadBlob, formatBytes } from '@/components/instant/instant-kit'

/* ------------------------------ engine types ------------------------------ */

interface FFmpegProgressEvent {
  progress: number
  time: number
}

interface FFmpegLogEvent {
  type: string
  message: string
}

interface FFmpegInstance {
  load(opts: { coreURL: string; wasmURL: string }): Promise<boolean>
  writeFile(path: string, data: Uint8Array): Promise<boolean>
  readFile(path: string): Promise<Uint8Array | string>
  deleteFile(path: string): Promise<boolean>
  exec(args: string[]): Promise<number>
  terminate(): void
  on(event: 'progress', cb: (e: FFmpegProgressEvent) => void): void
  on(event: 'log', cb: (e: FFmpegLogEvent) => void): void
}

interface FFmpegWASMGlobal {
  FFmpeg: new () => FFmpegInstance
}

declare global {
  interface Window {
    FFmpegWASM?: FFmpegWASMGlobal
  }
}

/* --------------------------- engine singleton ----------------------------- */

let enginePromise: Promise<FFmpegInstance> | null = null
let progressSink: ((p: number) => void) | null = null
const logTail: string[] = []

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('engine script failed to load')), { once: true })
      if (window.FFmpegWASM) resolve()
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.addEventListener('load', () => resolve(), { once: true })
    s.addEventListener('error', () => reject(new Error('engine script failed to load')), { once: true })
    document.head.appendChild(s)
  })
}

function loadEngine(): Promise<FFmpegInstance> {
  if (enginePromise) return enginePromise
  enginePromise = (async () => {
    if (!window.FFmpegWASM) {
      await injectScript('/ffmpeg/ffmpeg.js')
    }
    const FF = window.FFmpegWASM
    if (!FF) throw new Error('ffmpeg engine did not initialise')
    const ff = new FF.FFmpeg()
    ff.on('progress', (e) => {
      if (progressSink && Number.isFinite(e.progress)) {
        progressSink(Math.max(0, Math.min(1, e.progress)))
      }
    })
    ff.on('log', (e) => {
      logTail.push(e.message)
      if (logTail.length > 30) logTail.shift()
    })
    await ff.load({ coreURL: '/ffmpeg/ffmpeg-core.js', wasmURL: '/ffmpeg/ffmpeg-core.wasm' })
    return ff
  })()
  return enginePromise
}

/* --------------------------------- helpers -------------------------------- */

function inputName(file: File): string {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase().match(/^[a-z0-9]{1,5}$/)?.[0]
  return `input.${ext ?? 'mp4'}`
}

function clampTime(v: number, max: number): number {
  if (!Number.isFinite(v) || v < 0) return 0
  return Math.min(v, Math.max(0, max))
}

function ts(v: number): string {
  const m = Math.floor(v / 60)
  const s = Math.floor(v % 60)
  const cs = Math.floor((v * 100) % 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

type EngineStatus = 'idle' | 'loading' | 'ready' | 'working' | 'error'
type Mode = 'compress' | 'trim'
type Quality = 'high' | 'balanced' | 'small' | 'custom'
type AudioMode = 'keep' | 'copy' | 'remove'
type CutMode = 'fast' | 'precise'

const CRF: Record<Quality, number> = { high: 20, balanced: 23, small: 28, custom: 23 }

/* ------------------------------- component -------------------------------- */

export function VideoStudioTool() {
  const [mode, setMode] = useState<Mode>('compress')

  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle')
  const [engineError, setEngineError] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)

  // compress state
  const [cFile, setCFile] = useState<File | null>(null)
  const [quality, setQuality] = useState<Quality>('balanced')
  const [customCrf, setCustomCrf] = useState(23)
  const [resolution, setResolution] = useState<'keep' | '1080' | '720' | '480'>('keep')
  const [fps, setFps] = useState<'keep' | '30' | '24'>('keep')
  const [audio, setAudio] = useState<AudioMode>('keep')
  const [result, setResult] = useState<{ blob: Blob; size: number; note: string } | null>(null)
  const [error, setError] = useState('')

  // trim state
  const [tFile, setTFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [cutMode, setCutMode] = useState<CutMode>('precise')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [tResult, setTResult] = useState<{ blob: Blob; size: number } | null>(null)
  const [tError, setTError] = useState('')

  useEffect(() => {
    return () => {
      progressSink = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function ensureEngine(): Promise<FFmpegInstance> {
    setEngineError('')
    if (engineStatus === 'idle' || engineStatus === 'error') {
      setEngineStatus('loading')
      try {
        await loadEngine()
        setEngineStatus('ready')
      } catch (e) {
        setEngineStatus('error')
        const msg = e instanceof Error ? e.message : 'engine failed'
        setEngineError(`${msg}. Reload the page and try again — the engine loads once, then comes from cache.`)
        throw e
      }
    }
    const ff = await loadEngine()
    return ff
  }

  async function runJob(
    file: File,
    args: (input: string, output: string) => string[],
    onDone: (blob: Blob, bytes: number) => void,
    fail: (msg: string) => void,
  ) {
    setBusy(true)
    setProgress(0)
    setResult(null)
    setTResult(null)
    setError('')
    setTError('')
    try {
      const ff = await ensureEngine()
      const input = inputName(file)
      const output = 'output.mp4'
      const data = new Uint8Array(await file.arrayBuffer())
      await ff.writeFile(input, data)
      progressSink = (p) => setProgress(p)
      const code = await ff.exec(args(input, output))
      progressSink = null
      if (code !== 0) {
        throw new Error(logTail.slice(-4).join(' · ') || `ffmpeg exited with code ${code}`)
      }
      const out = await ff.readFile(output)
      const bytes = typeof out === 'string' ? new TextEncoder().encode(out) : out
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'video/mp4' })
      onDone(blob, bytes.length)
      try {
        await ff.deleteFile(input)
        await ff.deleteFile(output)
      } catch {
        /* cleanup best-effort */
      }
      setEngineStatus('ready')
    } catch (e) {
      progressSink = null
      const msg = e instanceof Error ? e.message : 'processing failed'
      fail(msg)
      if (engineStatus !== 'ready') setEngineStatus('error')
    } finally {
      setBusy(false)
    }
  }

  function runCompress() {
    if (!cFile) return
    const crf = quality === 'custom' ? customCrf : CRF[quality]
    const vf = resolution !== 'keep' ? ['-vf', `scale=-2:${resolution}`] : []
    const audioArgs =
      audio === 'remove' ? ['-an'] : audio === 'copy' ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '128k']
    const fpsArgs = fps !== 'keep' ? ['-r', fps] : []
    runJob(
      cFile,
      (input, output) => ['-i', input, '-c:v', 'libx264', '-crf', String(crf), '-preset', 'veryfast', ...vf, ...fpsArgs, ...audioArgs, '-movflags', '+faststart', output],
      (blob, size) =>
        setResult({
          blob,
          size,
          note: `Quality ${crf === CRF[quality] && quality !== 'custom' ? quality : `CRF ${crf}`}${resolution !== 'keep' ? `, capped at ${resolution}p` : ''}${fps !== 'keep' ? `, ${fps} fps` : ''}${audio === 'remove' ? ', audio removed' : ''}.`,
        }),
      (msg) => setError(msg),
    )
  }

  function runTrim() {
    if (!tFile) return
    const dur = clampTime(end, duration) - clampTime(start, duration)
    if (dur <= 0.05) {
      setTError('Set an end time after the start time.')
      return
    }
    const base = cutMode === 'fast'
      ? (input: string, output: string) => ['-ss', String(start), '-i', input, '-t', String(dur), '-c', 'copy', output]
      : (input: string, output: string) => ['-ss', String(start), '-i', input, '-t', String(dur), '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k', output]
    runJob(
      tFile,
      base,
      (blob, size) => setTResult({ blob, size }),
      (msg) => setTError(msg),
    )
  }

  const engineLine: Record<EngineStatus, string> = {
    idle: 'Engine not loaded yet — it fetches once (~32 MB), then comes from this device.',
    loading: 'Loading the ffmpeg engine…',
    ready: 'Engine ready — processing happens entirely in this tab.',
    working: 'Working…',
    error: 'Engine failed to load.',
  }

  return (
    <div className="flex flex-col gap-4" data-testid="video-studio-tool">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-full border bg-muted/40 p-1 w-fit" role="tablist" aria-label="Video mode">
          <button
            role="tab"
            aria-selected={mode === 'compress'}
            onClick={() => setMode('compress')}
            data-testid="video-mode-compress"
            className={mode === 'compress'
              ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground inline-flex items-center gap-1.5'
              : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground inline-flex items-center gap-1.5'}
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" /> Compress
          </button>
          <button
            role="tab"
            aria-selected={mode === 'trim'}
            onClick={() => setMode('trim')}
            data-testid="video-mode-trim"
            className={mode === 'trim'
              ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground inline-flex items-center gap-1.5'
              : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground inline-flex items-center gap-1.5'}
          >
            <Scissors className="h-3.5 w-3.5" aria-hidden="true" /> Trim
          </button>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="video-engine-status">
          {engineStatus === 'loading' || busy ? (
            <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Film className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          )}
          {engineLine[busy ? 'working' : engineStatus]}
        </p>
      </div>

      {engineError && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="video-engine-error">
          {engineError}
        </p>
      )}

      {mode === 'compress' ? (
        <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm">
          <div>
            <Label htmlFor="video-file">Video to compress</Label>
            <Input
              id="video-file"
              type="file"
              accept="video/*"
              onChange={(e) => {
                setCFile(e.target.files?.[0] ?? null)
                setResult(null)
                setError('')
              }}
              data-testid="video-file-input"
              className="mt-2 cursor-pointer"
              aria-label="Pick a video file to compress"
            />
            {cFile && (
              <p className="mt-2 text-sm text-stone-600" data-testid="video-info">
                {cFile.name} — {formatBytes(cFile.size)}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Quality</Label>
              <div className="mt-2 flex flex-wrap gap-1.5 rounded-full border bg-muted/40 p-1 w-fit">
                {(['high', 'balanced', 'small', 'custom'] as Quality[]).map((q) => (
                  <button
                    key={q}
                    role="tab"
                    aria-selected={quality === q}
                    onClick={() => setQuality(q)}
                    data-testid={`video-quality-${q}`}
                    className={quality === q
                      ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                      : 'rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground'}
                  >
                    {q === 'high' ? 'High' : q === 'balanced' ? 'Balanced' : q === 'small' ? 'Small file' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>
            {quality === 'custom' && (
              <div>
                <Label htmlFor="video-crf">CRF {customCrf} — lower is better quality, bigger file (18–34)</Label>
                <input
                  id="video-crf"
                  type="range"
                  min={18}
                  max={34}
                  value={customCrf}
                  onChange={(e) => setCustomCrf(Number(e.target.value))}
                  data-testid="video-crf"
                  className="mt-3 w-full accent-emerald-700"
                  aria-label="Custom CRF quality slider"
                />
              </div>
            )}
            <div>
              <Label htmlFor="video-resolution">Resolution</Label>
              <select
                id="video-resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as typeof resolution)}
                data-testid="video-resolution"
                className="mt-2 h-10 w-fit rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="keep">Keep source</option>
                <option value="1080">Cap at 1080p</option>
                <option value="720">Cap at 720p</option>
                <option value="480">Cap at 480p</option>
              </select>
            </div>
            <div>
              <Label htmlFor="video-fps">Frame rate</Label>
              <select
                id="video-fps"
                value={fps}
                onChange={(e) => setFps(e.target.value as typeof fps)}
                data-testid="video-fps"
                className="mt-2 h-10 w-fit rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="keep">Keep source</option>
                <option value="30">30 fps</option>
                <option value="24">24 fps</option>
              </select>
            </div>
            <div>
              <Label>Audio</Label>
              <div className="mt-2 flex flex-wrap gap-1.5 rounded-full border bg-muted/40 p-1 w-fit">
                {(['keep', 'copy', 'remove'] as AudioMode[]).map((a) => (
                  <button
                    key={a}
                    role="tab"
                    aria-selected={audio === a}
                    onClick={() => setAudio(a)}
                    data-testid={`video-audio-${a}`}
                    className={audio === a
                      ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                      : 'rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground'}
                  >
                    {a === 'keep' ? 'Re-encode 128k' : a === 'copy' ? 'Copy as-is' : 'Remove'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={runCompress}
              disabled={!cFile || busy}
              data-testid="video-compress-run"
              className="min-h-[44px] bg-emerald-700 text-white hover:bg-emerald-800"
            >
              <Zap className="mr-1 h-4 w-4" aria-hidden="true" /> {busy ? 'Compressing…' : 'Compress video'}
            </Button>
            {cFile && (
              <p className="text-xs text-muted-foreground">
                CRF is quality-based: final size depends on the footage itself. A talking-head clip shrinks far more than fast motion.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm">
          <div>
            <Label htmlFor="video-trim-file">Video to trim</Label>
            <Input
              id="video-trim-file"
              type="file"
              accept="video/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setTFile(f)
                setTResult(null)
                setTError('')
                setStart(0)
                setEnd(0)
                setDuration(0)
                if (previewUrl) URL.revokeObjectURL(previewUrl)
                setPreviewUrl(f ? URL.createObjectURL(f) : '')
              }}
              data-testid="video-trim-file-input"
              className="mt-2 cursor-pointer"
              aria-label="Pick a video file to trim"
            />
            {tFile && (
              <p className="mt-2 text-sm text-stone-600" data-testid="video-trim-info">
                {tFile.name} — {formatBytes(tFile.size)} — {duration > 0 ? `${duration.toFixed(1)}s` : 'reading duration…'}
              </p>
            )}
          </div>

          {previewUrl && (
            <div className="flex flex-col gap-3">
              <video
                ref={videoRef}
                src={previewUrl}
                controls
                className="max-h-72 w-full rounded-lg border bg-black"
                data-testid="video-preview"
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration
                  if (Number.isFinite(d)) {
                    setDuration(d)
                    setEnd(d)
                  }
                }}
                aria-label="Video preview"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="min-h-[44px] border-stone-300" onClick={() => setStart(clampTime(videoRef.current?.currentTime ?? 0, duration))} data-testid="video-trim-set-start" aria-label="Set start to current playhead">
                  Start ← playhead
                </Button>
                <Button variant="outline" size="sm" className="min-h-[44px] border-stone-300" onClick={() => setEnd(clampTime(videoRef.current?.currentTime ?? 0, duration))} data-testid="video-trim-set-end" aria-label="Set end to current playhead">
                  End ← playhead
                </Button>
              </div>
              <div className="flex flex-wrap gap-4">
                <div>
                  <Label htmlFor="video-start">Start (seconds)</Label>
                  <Input id="video-start" type="number" min={0} step={0.1} value={start} onChange={(e) => setStart(clampTime(Number(e.target.value), duration))} data-testid="video-trim-start" className="mt-1 w-32" />
                </div>
                <div>
                  <Label htmlFor="video-end">End (seconds)</Label>
                  <Input id="video-end" type="number" min={0} step={0.1} value={end} onChange={(e) => setEnd(clampTime(Number(e.target.value), duration))} data-testid="video-trim-end" className="mt-1 w-32" />
                </div>
                <p className="self-end text-sm text-stone-700" data-testid="video-trim-range">
                  Keeping {ts(clampTime(start, duration))} → {ts(clampTime(end, duration))} ({(clampTime(end, duration) - clampTime(start, duration)).toFixed(1)}s)
                </p>
              </div>
              <div>
                <Label>Cut precision</Label>
                <div className="mt-2 flex gap-1.5 rounded-full border bg-muted/40 p-1 w-fit">
                  {(['fast', 'precise'] as CutMode[]).map((c) => (
                    <button
                      key={c}
                      role="tab"
                      aria-selected={cutMode === c}
                      onClick={() => setCutMode(c)}
                      data-testid={`video-cut-${c}`}
                      title={c === 'fast' ? 'Instant, no re-encode, but snaps to the nearest keyframe' : 'Frame-exact, re-encodes the kept section'}
                      className={cutMode === c
                        ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                        : 'rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground'}
                    >
                      {c === 'fast' ? 'Fast (keyframe snap)' : 'Precise (re-encode)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={runTrim}
              disabled={!tFile || busy || duration === 0}
              data-testid="video-trim-run"
              className="min-h-[44px] bg-emerald-700 text-white hover:bg-emerald-800"
            >
              <Scissors className="mr-1 h-4 w-4" aria-hidden="true" /> {busy ? 'Trimming…' : 'Trim video'}
            </Button>
            {tFile && (
              <p className="text-xs text-muted-foreground">
                Fast cut is instant because nothing is re-encoded, but the cut lands on the nearest keyframe — usually within a second or two of your pick.
              </p>
            )}
          </div>

          {tError && (
            <p role="alert" data-testid="video-trim-error" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {tError}
            </p>
          )}
          {tResult && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2" data-testid="video-trim-result">
              <span className="text-sm text-emerald-900">Trimmed clip ready — {formatBytes(tResult.size)}</span>
              <Button size="sm" onClick={() => downloadBlob(tResult.blob, 'trimmed.mp4')} data-testid="video-trim-download" className="min-h-[44px] bg-emerald-700 text-white hover:bg-emerald-800">
                <Download className="mr-1 h-4 w-4" aria-hidden="true" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      {(mode === 'compress' ? busy : busy) && (
        <div data-testid="video-progress">
          <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <div className="h-full bg-emerald-600 transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-stone-500">{Math.round(progress * 100)}% — single-threaded on your CPU, so long clips take real time.</p>
        </div>
      )}

      {mode === 'compress' && error && (
        <p role="alert" data-testid="video-compress-error" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {mode === 'compress' && result && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2" data-testid="video-compress-result">
          <span className="text-sm text-emerald-900">
            Compressed — {formatBytes(result.size)}{cFile ? ` (from ${formatBytes(cFile.size)})` : ''}. {result.note}
          </span>
          <Button size="sm" onClick={() => downloadBlob(result.blob, 'compressed.mp4')} data-testid="video-download" className="min-h-[44px] bg-emerald-700 text-white hover:bg-emerald-800">
            <Download className="mr-1 h-4 w-4" aria-hidden="true" /> Download
          </Button>
        </div>
      )}

      <PrivacyStrip detail="Decoding, re-encoding and cutting all run on your CPU inside this tab via ffmpeg.wasm — your video never uploads. First use fetches the engine from this site (~32 MB), then it is cached." />
    </div>
  )
}

export default VideoStudioTool
