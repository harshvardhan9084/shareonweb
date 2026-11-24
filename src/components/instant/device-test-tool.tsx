'use client'

// Device Check Studio — camera and microphone checks with honest readouts,
// plus a device info card for support tickets. There is no MediaRecorder on
// this page (nothing is recorded) and every stream stops when its panel
// closes. Permissions are requested only when you press a Start button.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Copy, Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

interface CamState {
  running: boolean
  error: string
  settings: { width?: number; height?: number; frameRate?: number; aspectRatio?: number } | null
  measuredFps: number | null
  devices: Array<{ label: string; id: string }>
  activeId: string
}
interface MicState {
  running: boolean
  error: string
  level: number // 0..1 RMS
  peak: number
  sampleRate: number | null
}

export function DeviceTestTool() {
  const [cam, setCam] = useState<CamState>({ running: false, error: '', settings: null, measuredFps: null, devices: [], activeId: '' })
  const [mic, setMic] = useState<MicState>({ running: false, error: '', level: 0, peak: 0, sampleRate: null })
  const [copied, setCopied] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const camStream = useRef<MediaStream | null>(null)
  const micStream = useRef<MediaStream | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const rafId = useRef(0)
  const meterRaf = useRef(0)

  const stopCam = useCallback(() => {
    cancelAnimationFrame(rafId.current)
    camStream.current?.getTracks().forEach((t) => t.stop())
    camStream.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCam((c) => ({ ...c, running: false, measuredFps: null }))
  }, [])

  const stopMic = useCallback(() => {
    cancelAnimationFrame(meterRaf.current)
    micStream.current?.getTracks().forEach((t) => t.stop())
    micStream.current = null
    void audioCtx.current?.close().catch(() => {})
    audioCtx.current = null
    setMic((m) => ({ ...m, running: false, level: 0, peak: 0 }))
  }, [])

  useEffect(() => {
    return () => {
      // Unmount: stop everything so the hardware light goes out.
      cancelAnimationFrame(rafId.current)
      cancelAnimationFrame(meterRaf.current)
      camStream.current?.getTracks().forEach((t) => t.stop())
      micStream.current?.getTracks().forEach((t) => t.stop())
      void audioCtx.current?.close().catch(() => {})
    }
  }, [])

  const startCam = async (deviceId?: string) => {
    stopCam()
    setCam((c) => ({ ...c, error: '' }))
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      camStream.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings()
      // enumerate all cameras now that permission exists
      const all = await navigator.mediaDevices.enumerateDevices()
      const cams = all.filter((d) => d.kind === 'videoinput')
      setCam({
        running: true,
        error: '',
        settings: { width: settings.width, height: settings.height, frameRate: settings.frameRate, aspectRatio: settings.aspectRatio },
        measuredFps: null,
        devices: cams.map((d) => ({ label: d.label || 'Camera', id: d.deviceId })),
        activeId: settings.deviceId ?? deviceId ?? '',
      })
      // measure real FPS over ~2 seconds of rAF while the video paints
      let frames = 0
      let last = performance.now()
      const count = () => {
        frames++
        const now = performance.now()
        if (now - last >= 2000) {
          const fps = Math.round((frames * 1000) / (now - last))
          setCam((c) => (c.running ? { ...c, measuredFps: fps } : c))
          return
        }
        rafId.current = requestAnimationFrame(count)
      }
      rafId.current = requestAnimationFrame(count)
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
      const none = e instanceof DOMException && e.name === 'NotFoundError'
      setCam((c) => ({
        ...c,
        running: false,
        error: denied
          ? 'Permission denied. Click the lock/camera icon in the address bar, allow camera for this site, and press Start again.'
          : none
            ? 'No camera was found on this device.'
            : e instanceof Error ? e.message : 'The camera could not be started.',
      }))
    }
  }

  const startMic = async () => {
    stopMic()
    setMic((m) => ({ ...m, error: '' }))
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStream.current = stream
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      audioCtx.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      src.connect(analyser)
      const buf = new Float32Array(analyser.fftSize)
      let peak = 0
      setMic((m) => ({ ...m, running: true, sampleRate: ctx.sampleRate }))
      const meter = () => {
        analyser.getFloatTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
        const rms = Math.sqrt(sum / buf.length)
        peak = Math.max(peak, Math.min(1, rms * 3))
        setMic((m) => ({ ...m, level: Math.min(1, rms * 3), peak }))
        meterRaf.current = requestAnimationFrame(meter)
      }
      meterRaf.current = requestAnimationFrame(meter)
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
      setMic((m) => ({
        ...m,
        running: false,
        error: denied
          ? 'Permission denied. Click the lock/microphone icon in the address bar, allow microphone for this site, and press Start again.'
          : e instanceof Error ? e.message : 'The microphone could not be started.',
      }))
    }
  }

  // Browser-only readout: every value here comes from window/navigator, so
  // it is gathered after mount — server rendering would crash on `screen`.
  const [info, setInfo] = useState<Array<[string, string]>>([])
  useEffect(() => {
    setInfo([
      ['Screen', `${screen.width} × ${screen.height} px`],
      ['Window', `${window.innerWidth} × ${window.innerHeight} px`],
      ['Pixel ratio', `${window.devicePixelRatio}×`],
      ['CPU cores', String(navigator.hardwareConcurrency ?? 'unknown')],
      ['Device memory', (navigator as unknown as { deviceMemory?: number }).deviceMemory ? `≥ ${(navigator as unknown as { deviceMemory: number }).deviceMemory} GB` : 'not reported'],
      ['Touch', 'ontouchstart' in window || navigator.maxTouchPoints > 0 ? `yes (${navigator.maxTouchPoints} points)` : 'no'],
      ['Languages', navigator.languages?.join(', ') || navigator.language || 'unknown'],
      ['Time zone', Intl.DateTimeFormat().resolvedOptions().timeZone],
      ['Platform', navigator.userAgent],
      ['Online', navigator.onLine ? 'yes' : 'no'],
      ['Cookies', navigator.cookieEnabled ? 'enabled' : 'disabled'],
      ['Secure context', window.isSecureContext ? 'yes (https or localhost)' : 'no — some APIs (camera, mic) will refuse'],
    ])
  }, [])

  const copyInfo = async () => {
    try {
      await navigator.clipboard.writeText(info.map(([k, v]) => `${k}: ${v}`).join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* manual selection still possible */
    }
  }

  const barWidth = (v: number) => `${Math.round(Math.min(1, v) * 100)}%`

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* -------------------------------------------------- camera panel */}
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Camera className="size-4 text-primary" aria-hidden="true" /> Camera test
            </h2>
            {cam.running ? (
              <Button type="button" variant="outline" size="sm" onClick={stopCam}>
                <Square className="size-3.5" aria-hidden="true" /> Stop
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => startCam()}>
                Start camera test
              </Button>
            )}
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border bg-muted/30">
            {cam.running ? (
              <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 text-center">
                <Camera className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {cam.error ? cam.error : 'Press Start camera test — the browser will ask for permission. Nothing is recorded.'}
                </p>
              </div>
            )}
          </div>

          {cam.running && (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border bg-background px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Track resolution</dt>
                  <dd className="mt-0.5 font-mono">{cam.settings?.width ?? '?'} × {cam.settings?.height ?? '?'}</dd>
                </div>
                <div className="rounded-lg border bg-background px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Track frame rate</dt>
                  <dd className="mt-0.5 font-mono">{cam.settings?.frameRate ? `${Math.round(cam.settings.frameRate)} fps` : '?'}</dd>
                </div>
                <div className="rounded-lg border bg-background px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Measured FPS (2 s)</dt>
                  <dd className="mt-0.5 font-mono">{cam.measuredFps === null ? 'measuring…' : `${cam.measuredFps} fps`}</dd>
                </div>
                <div className="rounded-lg border bg-background px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Aspect</dt>
                  <dd className="mt-0.5 font-mono">{cam.settings?.aspectRatio ? (Math.round(cam.settings.aspectRatio * 100) / 100).toFixed(2) : '?'}</dd>
                </div>
              </dl>
              {cam.devices.length > 1 && (
                <div className="mt-3 space-y-1.5">
                  <label htmlFor="dt-cam" className="text-xs font-medium text-muted-foreground">Switch camera</label>
                  <select
                    id="dt-cam"
                    value={cam.activeId}
                    onChange={(e) => startCam(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {cam.devices.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          {cam.error && <p className="mt-3 text-sm text-destructive" role="alert">{cam.error}</p>}
        </div>

        {/* ----------------------------------------------------- mic panel */}
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Mic className="size-4 text-primary" aria-hidden="true" /> Microphone test
            </h2>
            {mic.running ? (
              <Button type="button" variant="outline" size="sm" onClick={stopMic}>
                <Square className="size-3.5" aria-hidden="true" /> Stop
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={startMic}>
                Start microphone test
              </Button>
            )}
          </div>

          <div className="mt-3 rounded-lg border bg-background p-4">
            {mic.running ? (
              <>
                <p className="text-sm text-muted-foreground">Speak normally — the bar tracks your voice level.</p>
                <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-75" style={{ width: barWidth(mic.level) }} />
                </div>
                <div className="relative mt-1.5 h-2 w-full">
                  <div className="absolute h-2 w-0.5 rounded bg-foreground/70" style={{ left: barWidth(mic.peak) }} aria-hidden="true" />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Level (RMS)</dt>
                    <dd className="font-mono">{Math.round(mic.level * 100)}%</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Peak held</dt>
                    <dd className="font-mono">{Math.round(mic.peak * 100)}%</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Sample rate</dt>
                    <dd className="font-mono">{mic.sampleRate ? `${(mic.sampleRate / 1000).toFixed(1)} kHz` : '?'}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {mic.error ? mic.error : 'Press Start microphone test — the browser will ask for permission. Nothing is recorded.'}
              </p>
            )}
          </div>
          {mic.error && mic.running && <p className="mt-3 text-sm text-destructive" role="alert">{mic.error}</p>}
        </div>
      </div>

      {/* ------------------------------------------------- device info card */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">This device, for the support ticket</h2>
          <Button type="button" variant="outline" size="sm" onClick={copyInfo}>
            <Copy className="size-3.5" aria-hidden="true" /> {copied ? 'Copied' : 'Copy all'}
          </Button>
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {info.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-border/60 py-1 last:border-0">
              <dt className="shrink-0 text-muted-foreground">{k}</dt>
              <dd className={cn('truncate text-right font-mono text-xs leading-5', k === 'Platform' && 'max-w-[28ch] sm:max-w-[36ch]')} title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <PrivacyStrip detail="This page contains no recording code — there is no MediaRecorder anywhere — and it never sends a byte: camera and mic streams exist only inside this tab and stop the moment you press Stop or close the page." />
      </div>
    </div>
  )
}
