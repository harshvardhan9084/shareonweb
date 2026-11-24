'use client'

// ScanPanel — the Scan tab of the QR tool. Reads QR codes in this tab from
// two sources: the device camera (live preview, decode loop) and image files
// dropped or picked from disk. Decoding prefers the browser's native
// BarcodeDetector when it exists and falls back to jsQR (pure JS, lazy
// imported) everywhere else — the same code path handles both. Parsed
// payloads get honest actions: URLs open, Wi-Fi payloads reveal SSID and
// password, vCards extract their fields, and Kontivo session links offer a
// one-tap join. Frames are decoded in-memory and never uploaded.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, CameraOff, Check, Copy, ExternalLink, Eye, EyeOff, Image as ImageIcon, Lightbulb, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PrivacyStrip, useFilePick } from '@/components/instant/instant-kit'
import { CODE_PATH_RE } from '@/lib/code'
import { SITE_URL } from '@/lib/site'

// ------------------------------------------------------------ decode engine --

// Minimal typings for the (still non-standard) BarcodeDetector API.
interface DetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string; format: string }>>
}
type DetectorCtor = new (options?: { formats?: string[] }) => DetectorLike

let detectorPromise: Promise<DetectorLike | null> | null = null

async function getDetector(): Promise<DetectorLike | null> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
      if (!ctor) return null
      try {
        return new ctor({ formats: ['qr_code'] })
      } catch {
        return null
      }
    })()
  }
  return detectorPromise
}

let jsqrPromise: Promise<typeof import('jsqr')['default']> | null = null

async function getJsqr() {
  if (!jsqrPromise) {
    jsqrPromise = import('jsqr').then((m) => m.default)
  }
  return jsqrPromise
}

/** Decode one image source: native detector first, jsQR fallback. */
async function decodeSource(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<string | null> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  canvas.width = width
  canvas.height = height
  ctx.drawImage(source, 0, 0, width, height)

  const detector = await getDetector()
  if (detector) {
    try {
      const hits = await detector.detect(canvas)
      if (hits.length > 0) return hits[0].rawValue
    } catch {
      /* fall through to jsQR */
    }
  }
  const jsqr = await getJsqr()
  const data = ctx.getImageData(0, 0, width, height)
  const hit = jsqr(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' })
  return hit?.data ?? null
}

// ------------------------------------------------------------ payload parser --

interface ParsedPayload {
  kind: 'url' | 'wifi' | 'vcard' | 'text' | 'session'
  sessionCode?: string
  wifi?: { ssid: string; password: string; encryption: string }
  vcard?: { name: string; org: string; phone: string; email: string }
}

function parsePayload(raw: string): ParsedPayload {
  const trimmed = raw.trim()

  // Kontivo session link — the QR codes this site prints for live sessions.
  try {
    const u = new URL(trimmed)
    const seg = u.pathname.split('/').filter(Boolean).pop() ?? ''
    const sameSite = u.origin === SITE_URL || `${u.origin}/` === SITE_URL
    if (sameSite && CODE_PATH_RE.test(seg)) {
      return { kind: 'session', sessionCode: seg }
    }
  } catch {
    /* not a URL at all */
  }

  if (/^https?:\/\//i.test(trimmed)) return { kind: 'url' }

  if (trimmed.startsWith('WIFI:')) {
    const field = (key: string) => {
      const m = trimmed.match(new RegExp(`(?:^|;)${key}:((?:\\\\.|[^;])*)(?:;|$)`))
      return m ? m[1].replace(/\\(.)/g, '$1') : ''
    }
    return {
      kind: 'wifi',
      wifi: { ssid: field('S'), password: field('P'), encryption: field('T') || 'WPA' },
    }
  }

  if (trimmed.startsWith('BEGIN:VCARD')) {
    const line = (key: string) => {
      const m = trimmed.match(new RegExp(`^${key}[:;][^\\n]*:(.+)$`, 'mi'))
      return m ? m[1].trim() : ''
    }
    return {
      kind: 'vcard',
      vcard: {
        name: line('FN'),
        org: line('ORG'),
        phone: line('TEL'),
        email: line('EMAIL'),
      },
    }
  }

  return { kind: 'text' }
}

// ------------------------------------------------------------------ result ----

interface ScanRecord {
  id: number
  raw: string
  source: 'camera' | 'image'
  at: number
}

function ResultCard({ record, onOpen }: { record: ScanRecord; onOpen: (code: string) => void }) {
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const parsed = useMemo(() => parsePayload(record.raw), [record.raw])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(record.raw)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard refused */
    }
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ScanLine className="size-3.5" aria-hidden="true" />
          {record.source === 'camera' ? 'Camera' : 'Image'} · {new Date(record.at).toLocaleTimeString()}
        </span>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {parsed.kind === 'session' && parsed.sessionCode ? (
            <Button type="button" size="sm" onClick={() => onOpen(parsed.sessionCode!)}>
              <ExternalLink className="size-3.5" aria-hidden="true" /> Join session
            </Button>
          ) : parsed.kind === 'url' ? (
            <Button type="button" size="sm" onClick={() => window.open(record.raw, '_blank', 'noopener')}>
              <ExternalLink className="size-3.5" aria-hidden="true" /> Open link
            </Button>
          ) : null}
        </div>
      </div>

      {/* payload body */}
      {parsed.kind === 'wifi' && parsed.wifi ? (
        <div className="space-y-1.5 px-4 py-3 text-sm">
          <p>
            <span className="text-muted-foreground">Network:</span>{' '}
            <span className="font-medium">{parsed.wifi.ssid}</span>{' '}
            <span className="text-xs text-muted-foreground">({parsed.wifi.encryption})</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-muted-foreground">Password:</span>{' '}
            <span className="font-mono">{revealed ? parsed.wifi.password || '(open network)' : '••••••••'}</span>
            <button
              type="button"
              aria-label={revealed ? 'Hide password' : 'Reveal password'}
              onClick={() => setRevealed((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              {revealed ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
            </button>
          </p>
        </div>
      ) : parsed.kind === 'vcard' && parsed.vcard ? (
        <div className="grid gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-2">
          <p><span className="text-muted-foreground">Name:</span> {parsed.vcard.name || '—'}</p>
          <p><span className="text-muted-foreground">Org:</span> {parsed.vcard.org || '—'}</p>
          <p><span className="text-muted-foreground">Phone:</span> {parsed.vcard.phone || '—'}</p>
          <p><span className="text-muted-foreground">Email:</span> {parsed.vcard.email || '—'}</p>
        </div>
      ) : (
        <div className="px-4 py-3">
          {parsed.kind === 'session' && parsed.sessionCode ? (
            <p className="text-sm">
              Kontivo session code:{' '}
              <span className="font-mono font-semibold">{parsed.sessionCode}</span> — tap “Join session”.
            </p>
          ) : (
            <p className="break-all font-mono text-sm">{record.raw}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------- panel ----

export function QrScanPanel() {
  const router = useRouter()
  const [mode, setMode] = useState<'camera' | 'image'>('camera')
  const [history, setHistory] = useState<ScanRecord[]>([])

  // camera state
  const [camState, setCamState] = useState<'idle' | 'starting' | 'live' | 'error'>('idle')
  const [camError, setCamError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string>('')
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loopRef = useRef<number | null>(null)
  const lastReadRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })

  const pushResult = useCallback((raw: string, source: 'camera' | 'image') => {
    const text = raw.trim()
    if (!text) return
    // Debounce identical camera reads within 2 s (a held-still code fires many frames).
    if (source === 'camera' && lastReadRef.current.text === text && Date.now() - lastReadRef.current.at < 2000) return
    lastReadRef.current = { text, at: Date.now() }
    setHistory((prev) => [{ id: Date.now() + Math.random(), raw: text, source, at: Date.now() }, ...prev].slice(0, 6))
  }, [])

  // ---------------------------------------------------------------- camera ---
  const stopCamera = useCallback(() => {
    if (loopRef.current !== null) {
      window.clearInterval(loopRef.current)
      loopRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamState('idle')
    setTorchOn(false)
    setTorchAvailable(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCamState('starting')
    setCamError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => undefined)
      }
      const track = stream.getVideoTracks()[0]
      const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean; deviceId?: string }
      setTorchAvailable(Boolean(caps.torch))
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices(list.filter((d) => d.kind === 'videoinput'))
      setCamState('live')

      // Decode loop: ~6 fps is plenty and keeps the tab light.
      loopRef.current = window.setInterval(async () => {
        const v = videoRef.current
        const canvas = canvasRef.current
        if (!v || !canvas || v.readyState < 2 || !v.videoWidth) return
        const scale = Math.min(1, 640 / v.videoWidth)
        const text = await decodeSource(canvas, v, Math.round(v.videoWidth * scale), Math.round(v.videoHeight * scale))
        if (text) pushResult(text, 'camera')
      }, 160)
    } catch (err) {
      const name = (err as { name?: string })?.name ?? ''
      setCamState('error')
      setCamError(
        name === 'NotAllowedError'
          ? 'Camera permission was refused. Allow it in the browser’s address-bar menu and press Start again.'
          : name === 'NotFoundError'
            ? 'No camera was found on this device. You can still scan a QR image from disk with the Image tab.'
            : `The camera could not start (${name || 'unknown error'}). Close other apps using it and try again.`,
      )
    }
  }, [deviceId, pushResult])

  useEffect(() => stopCamera, [stopCamera]) // unmount cleanup

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      // Torch is a Chromium extension outside the standard constraint types.
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as unknown as MediaTrackConstraints)
      setTorchOn((v) => !v)
    } catch {
      setTorchAvailable(false)
    }
  }

  // ----------------------------------------------------------------- image ---
  const decodeFiles = useCallback(
    async (files: File[]) => {
      const canvas = canvasRef.current
      if (!canvas) return
      for (const file of files) {
        try {
          const bitmap = await createImageBitmap(file)
          const scale = Math.min(1, 1280 / bitmap.width)
          const text = await decodeSource(canvas, bitmap, Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))
          bitmap.close()
          if (text) pushResult(text, 'image')
        } catch {
          /* unreadable file — skip it */
        }
      }
    },
    [pushResult],
  )
  const imagePick = useFilePick('image/*', true, false, (files) => void decodeFiles(files))

  const openSession = (code: string) => {
    stopCamera()
    router.push(`/${code}`)
  }

  const last = history[0]

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        {/* source switch */}
        <div className="flex flex-wrap gap-1.5 rounded-full border bg-muted/40 p-1 w-fit" role="tablist" aria-label="Scan source">
          {([['camera', 'Camera'], ['image', 'Image file']] as const).map(([m, label]) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m)
                if (m === 'image') stopCamera()
              }}
              className={
                mode === m
                  ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                  : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground'
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          {mode === 'camera' ? (
            <>
              {devices.length > 1 && (
                <div className="space-y-1.5">
                  <Label htmlFor="scan-cam">Camera</Label>
                  <Select value={deviceId} onValueChange={setDeviceId}>
                    <SelectTrigger id="scan-cam" className="w-full">
                      <SelectValue placeholder="Default camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((d, i) => (
                        <SelectItem key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="relative overflow-hidden rounded-xl border bg-black/80">
                <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" aria-label="Camera preview" />
                {/* scan region guide */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-1/2 w-1/2 rounded-lg border-2 border-white/70 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" />
                </div>
                {camState !== 'live' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 px-6 text-center">
                    {camState === 'starting' ? (
                      <p className="text-sm text-muted-foreground">Starting the camera…</p>
                    ) : (
                      <>
                        <Camera className="size-6 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm text-muted-foreground">{camError ?? 'Point the camera at a QR code.'}</p>
                        <Button type="button" size="sm" onClick={startCamera}>
                          <Camera className="size-4" aria-hidden="true" /> Start camera
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {camState === 'live' ? (
                  <Button type="button" variant="outline" size="sm" onClick={stopCamera}>
                    <CameraOff className="size-3.5" aria-hidden="true" /> Stop camera
                  </Button>
                ) : null}
                {camState === 'live' && torchAvailable ? (
                  <Button type="button" variant={torchOn ? 'default' : 'outline'} size="sm" onClick={toggleTorch}>
                    <Lightbulb className="size-3.5" aria-hidden="true" /> {torchOn ? 'Torch on' : 'Torch off'}
                  </Button>
                ) : null}
                {camState === 'live' && (
                  <p className="text-xs text-muted-foreground">Hold the code inside the frame — results appear on the right.</p>
                )}
              </div>
            </>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop a QR image to decode"
              onClick={() => imagePick.pick()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  imagePick.pick()
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                decodeFiles(Array.from(e.dataTransfer.files))
              }}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
            >
              <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">Drop a QR image, or click to pick one</p>
              <p className="text-xs text-muted-foreground">A photo of a code, a screenshot — decoded right here.</p>
              {imagePick.input}
            </div>
          )}
        </div>
      </div>

      {/* results */}
      <div className="space-y-4">
        {last ? (
          <>
            <ResultCard record={last} onOpen={openSession} />
            {history.length > 1 && (
              <div className="rounded-xl border bg-card">
                <p className="border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">Earlier scans (this visit only)</p>
                <ul>
                  {history.slice(1).map((h) => (
                    <li key={h.id} className="border-t first:border-0 px-4 py-2">
                      <button
                        type="button"
                        className="line-clamp-1 w-full text-left font-mono text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setHistory((prev) => [h, ...prev.filter((x) => x.id !== h.id)])}
                        title="Show this scan"
                      >
                        {h.raw}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-10 text-center">
            <ScanLine className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing decoded yet. {mode === 'camera' ? 'Start the camera and hold a QR code in the frame.' : 'Drop a QR image to decode it.'}
            </p>
          </div>
        )}
        {/* offscreen decode canvas */}
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        <PrivacyStrip detail="Frames and images are decoded inside this tab — the native BarcodeDetector when your browser has one, the bundled jsQR engine otherwise. Nothing is uploaded, and the scan history lives only in this page until you close it." />
      </div>
    </div>
  )
}
