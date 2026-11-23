'use client'

// Screen & Mic Recorder — the browser's own capture and MediaRecorder, wired
// to an honest local lifecycle: pick a surface, record with pause/resume,
// stop, keep or discard the WebM. Nothing is ever uploaded; there is no
// upload code on this page.

import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleDot, Download, Loader2, Mic, Monitor, Pause, Play, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadBlob, formatBytes, PrivacyStrip } from '@/components/instant/instant-kit'

type Phase = 'idle' | 'recording' | 'paused' | 'done'
type Surface = 'screen' | 'mic'

/** Pick the best recorder mime the browser actually supports. */
function pickMime(withVideo: boolean): string {
  const candidates = withVideo
    ? [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ]
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

function fmtClock(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s - m * 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function RecorderTool() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [surface, setSurface] = useState<Surface>('screen')
  const [mixMic, setMixMic] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<{ blob: Blob; seconds: number; mime: string; withVideo: boolean } | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // elapsed is read inside the onstop closure, so keep a ref in sync
  const elapsedRef = useRef(0)

  // timer only counts recorded time — pause stops the clock
  useEffect(() => {
    if (phase === 'recording') {
      tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [phase])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    setNotice(null)
    setResult(null)
    setElapsed(0)
    chunksRef.current = []
    const withVideo = surface === 'screen'
    try {
      let stream: MediaStream
      if (surface === 'screen') {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new Error('This browser does not support screen capture.')
        }
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: false,
        })
        if (mixMic && navigator.mediaDevices?.getUserMedia) {
          try {
            const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
            for (const track of mic.getAudioTracks()) stream.addTrack(track)
          } catch {
            setNotice('Microphone permission was refused — recording continues with screen only.')
          }
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      streamRef.current = stream

      // honest live preview: muted, so no feedback loop
      if (videoRef.current && withVideo) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        void videoRef.current.play().catch(() => undefined)
      }

      // if the user ends sharing from the browser UI, stop the take gracefully
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorderRef.current?.state === 'recording' || recorderRef.current?.state === 'paused') {
          recorderRef.current.stop()
        }
      })

      const mime = pickMime(withVideo)
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recorderRef.current = rec
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const type = rec.mimeType || (withVideo ? 'video/webm' : 'audio/webm')
        const blob = new Blob(chunksRef.current, { type })
        stopTracks()
        if (blob.size > 0) {
          setResult({ blob, seconds: elapsedRef.current, mime: type, withVideo })
          setPhase('done')
        } else {
          setError('The take came back empty — nothing was captured.')
          setPhase('idle')
        }
      }
      rec.start(1000)
      elapsedRef.current = 0
      setPhase('recording')
    } catch (err) {
      stopTracks()
      const e = err as DOMException
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setError(
          surface === 'screen'
            ? 'Screen capture permission was refused (or the chooser was cancelled). Nothing was recorded — pick a surface and try again.'
            : 'Microphone permission was refused. Nothing was recorded — grant access and try again.',
        )
      } else if (e?.name === 'NotFoundError') {
        setError('No capture surface or microphone was found on this device.')
      } else {
        setError(e?.message || 'The recorder could not start in this browser.')
      }
      setPhase('idle')
    }
  }, [surface, mixMic, stopTracks])

  // keep the ref in sync with the visible timer
  useEffect(() => {
    elapsedRef.current = elapsed
  }, [elapsed])

  const togglePause = useCallback(() => {
    const rec = recorderRef.current
    if (!rec) return
    if (rec.state === 'recording') {
      rec.pause()
      setPhase('paused')
    } else if (rec.state === 'paused') {
      rec.resume()
      setPhase('recording')
    }
  }, [])

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && (rec.state === 'recording' || rec.state === 'paused')) rec.stop()
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
    setNotice(null)
    setElapsed(0)
    setPhase('idle')
    chunksRef.current = []
  }, [])

  const ext = result?.mime.includes('audio') ? 'webm' : 'webm'

  return (
    <div>
      {/* ------------------------------------------------------------ action */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Recording surface">
          <button
            role="tab"
            aria-selected={surface === 'screen'}
            onClick={() => {
              setSurface('screen')
              reset()
            }}
            disabled={phase === 'recording' || phase === 'paused'}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors aria-selected:border-primary aria-selected:bg-primary/10 aria-selected:text-primary disabled:opacity-50"
          >
            <Monitor className="size-4" aria-hidden="true" /> Screen
          </button>
          <button
            role="tab"
            aria-selected={surface === 'mic'}
            onClick={() => {
              setSurface('mic')
              reset()
            }}
            disabled={phase === 'recording' || phase === 'paused'}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors aria-selected:border-primary aria-selected:bg-primary/10 aria-selected:text-primary disabled:opacity-50"
          >
            <Mic className="size-4" aria-hidden="true" /> Microphone
          </button>
          {surface === 'screen' && phase !== 'recording' && phase !== 'paused' && (
            <label className="ml-2 flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="accent-[oklch(0.55_0.14_190)]"
                checked={mixMic}
                onChange={(e) => setMixMic(e.target.checked)}
              />
              Mix in microphone (narration)
            </label>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {phase === 'idle' && (
            <Button onClick={startRecording}>
              <CircleDot className="size-4" aria-hidden="true" />
              {surface === 'screen' ? 'Record screen' : 'Record voice'}
            </Button>
          )}
          {(phase === 'recording' || phase === 'paused') && (
            <>
              <Button variant="destructive" onClick={stopRecording}>
                <Square className="size-4" aria-hidden="true" />
                Stop
              </Button>
              <Button variant="outline" onClick={togglePause}>
                {phase === 'recording' ? (
                  <>
                    <Pause className="size-4" aria-hidden="true" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="size-4" aria-hidden="true" /> Resume
                  </>
                )}
              </Button>
              <span
                className="flex items-center gap-2 font-mono text-lg tabular-nums"
                aria-live="polite"
              >
                <span
                  className={`inline-block size-2.5 rounded-full ${phase === 'recording' ? 'animate-pulse bg-destructive' : 'bg-muted-foreground'}`}
                  aria-hidden="true"
                />
                {fmtClock(elapsed)}
                {phase === 'paused' && <span className="font-sans text-sm text-muted-foreground">(paused)</span>}
              </span>
            </>
          )}
        </div>

        {/* muted live preview of the screen take */}
        {(phase === 'recording' || phase === 'paused') && surface === 'screen' && (
          <video
            ref={videoRef}
            className="mt-4 max-h-72 w-full rounded-lg border bg-black"
            autoPlay
            muted
            playsInline
            aria-label="Live screen preview (muted)"
          />
        )}

        {/* the take */}
        {phase === 'done' && result && (
          <div className="mt-4 rounded-lg border bg-muted/40 p-3">
            <p className="text-sm font-medium">
              Take ready — {fmtClock(result.seconds)} · {formatBytes(result.blob.size)} ·{' '}
              {result.withVideo ? 'WebM video+audio' : 'WebM audio'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                onClick={() => downloadBlob(result.blob, `toolhive-take.${ext}`)}
              >
                <Download className="size-4" aria-hidden="true" />
                Download {result.withVideo ? 'video' : 'voice'}
              </Button>
              <Button variant="outline" onClick={reset}>
                <Trash2 className="size-4" aria-hidden="true" />
                Discard and record again
              </Button>
            </div>
          </div>
        )}

        {notice && (
          <p className="mt-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{notice}</p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {phase === 'idle' && !error && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            The browser will ask which screen, window or tab to capture (or for microphone access on voice
            mode) — that prompt is the browser's own, and nothing records until you confirm it.
          </p>
        )}
      </div>

      <PrivacyStrip detail="Captured with this browser's own recorder straight to a download — there is no upload step, no cloud copy and no account. What you record stays on this device." />
    </div>
  )
}
