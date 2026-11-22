'use client'

// In-app QR scanner for joining sessions: point the camera at the host's QR
// code instead of typing the code. Uses the platform BarcodeDetector when the
// browser ships one (Chrome/Android), falls back to decoding canvas frames
// with jsQR. Permission and hardware failures are plain-language states with
// a way out — scanning is never a dead end.

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { extractCode } from '@/components/platform/code-input'
import { Camera, CircleAlert } from 'lucide-react'

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike
  }
}

type ScanPhase = 'starting' | 'scanning' | 'denied' | 'unavailable'

export function QrScanner({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stoppedRef = useRef(false)
  const [phase, setPhase] = useState<ScanPhase>('starting')
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    stoppedRef.current = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setPhase('unavailable')
          return
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (stoppedRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play().catch(() => undefined)
        setPhase('scanning')

        const Detector = window.BarcodeDetector
        if (Detector) {
          const detector = new Detector({ formats: ['qr_code'] })
          timer = setInterval(async () => {
            if (stoppedRef.current || !videoRef.current) return
            try {
              const hits = await detector.detect(videoRef.current)
              handleHit(hits[0]?.rawValue)
            } catch {
              // transient decode errors are normal mid-frame; keep polling
            }
          }, 220)
        } else {
          // jsQR fallback: sample scaled-down frames onto a canvas.
          const canvas = canvasRef.current
          const ctx = canvas?.getContext('2d', { willReadFrequently: true })
          if (!canvas || !ctx) return
          timer = setInterval(() => {
            if (stoppedRef.current || !videoRef.current || videoRef.current.readyState < 2) return
            const vw = videoRef.current.videoWidth
            const vh = videoRef.current.videoHeight
            if (!vw || !vh) return
            const scale = 420 / vw
            canvas.width = Math.round(vw * scale)
            canvas.height = Math.round(vh * scale)
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const hit = jsQR(image.data, image.width, image.height, {
              inversionAttempts: 'dontInvert',
            })
            handleHit(hit?.data)
          }, 220)
        }
      } catch (err) {
        if (stoppedRef.current) return
        const name = err instanceof DOMException ? err.name : ''
        if (name === 'NotAllowedError' || name === 'SecurityError') setPhase('denied')
        else setPhase('unavailable')
      }
    }

    function handleHit(raw: string | undefined) {
      if (!raw || stoppedRef.current) return
      const code = extractCode(raw)
      if (code.length >= 4) {
        stoppedRef.current = true
        onCode(code)
        return
      }
      // A QR code, but not one of ours — say so and keep scanning.
      setNote('That QR code is not a ShareOnWeb session code.')
    }

    void start()

    return () => {
      stoppedRef.current = true
      if (timer) clearInterval(timer)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  if (phase === 'denied' || phase === 'unavailable') {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-4 py-8 text-center"
      >
        <CircleAlert className="size-5 text-muted-foreground" aria-hidden="true" />
        {phase === 'denied' ? (
          <p className="max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
            Camera access was blocked. Allow the camera for this site (padlock icon in the
            address bar), then try again.
          </p>
        ) : (
          <p className="max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
            No usable camera was found on this device. Type the session code instead.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="size-full object-cover"
          aria-label="Camera view for scanning a session QR code"
        />
        {/* Hairline aiming brackets */}
        <div className="pointer-events-none absolute inset-8" aria-hidden="true">
          <span className="absolute left-0 top-0 h-6 w-6 rounded-tl-md border-l-2 border-t-2 border-primary" />
          <span className="absolute right-0 top-0 h-6 w-6 rounded-tr-md border-r-2 border-t-2 border-primary" />
          <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-md border-b-2 border-l-2 border-primary" />
          <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-md border-b-2 border-r-2 border-primary" />
        </div>
        {phase === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
            <Camera className="mr-2 size-4" aria-hidden="true" /> Starting camera…
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      <p role="status" className="text-center text-sm text-muted-foreground">
        {note ?? 'Point your camera at the session QR code.'}
      </p>
    </div>
  )
}
