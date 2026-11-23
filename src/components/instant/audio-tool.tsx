'use client'

// Audio Toolkit — trim / merge / speed / normalize / fades, rendered with the
// Web Audio engine and exported as WAV or MP3, entirely on-device. The
// waveform is drawn from the decoded samples, so the selection is real, not a
// stylized proxy. Doctrine: DESIGN.md at the repo root.

import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioLines, Download, Loader2, Scissors, Waves } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { downloadBlob, DropZone, formatBytes, PrivacyStrip } from '@/components/instant/instant-kit'
import {
  applyFades,
  concatBuffers,
  encodeWav16,
  normalizeGain,
  renderClip,
} from '@/lib/wav'

interface Clip {
  name: string
  buffer: AudioBuffer
  sizeBytes: number
}

interface RenderResult {
  name: string
  blob: Blob
  seconds: number
  sampleRate: number
  channels: number
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = (s - m * 60).toFixed(1)
  return `${m}:${sec.padStart(4, '0')}`
}

export function AudioTool() {
  const [clips, setClips] = useState<Clip[]>([])
  const [decoding, setDecoding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selStart, setSelStart] = useState(0)
  const [selEnd, setSelEnd] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [normMode, setNormMode] = useState<'off' | 'peak' | 'rms'>('off')
  const [targetDb, setTargetDb] = useState(-1)
  const [fadeIn, setFadeIn] = useState(0)
  const [fadeOut, setFadeOut] = useState(0)
  const [format, setFormat] = useState<'wav' | 'mp3'>('wav')
  const [mp3Kbps, setMp3Kbps] = useState(192)
  const [rendering, setRendering] = useState(false)
  const [result, setResult] = useState<RenderResult | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mergeRef = useRef(false)

  const total = clips.length ? clips.reduce((a, c) => a + c.buffer.duration, 0) : 0

  // ------------------------------------------------------------- waveform
  useEffect(() => {
    const canvas = canvasRef.current
    const first = clips[0]
    if (!canvas || !first) return
    // single clip: its own samples. several clips: the merged mono mixdown,
    // so the selection overlay matches the merged timeline being rendered.
    let data: Float32Array
    if (clips.length > 1) {
      const merged = concatBuffers(clips.map((c) => c.buffer))
      data = merged.getChannelData(0)
    } else {
      data = first.buffer.getChannelData(0)
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = canvas.clientWidth
    const h = 120
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)
    // background track
    ctx.fillStyle = 'rgb(0 0 0 / 0.04)'
    ctx.fillRect(0, 0, w, h)
    // per-pixel min/max peaks
    const step = Math.max(1, Math.floor(data.length / w))
    const mid = h / 2
    ctx.fillStyle = 'oklch(0.55 0.14 190)' // brand teal, no blue/indigo
    for (let x = 0; x < w; x++) {
      const i0 = x * step
      let min = 1
      let max = -1
      for (let i = i0; i < i0 + step && i < data.length; i += 4) {
        const v = data[i]
        if (v < min) min = v
        if (v > max) max = v
      }
      const y0 = mid - max * (mid - 6)
      const y1 = mid - min * (mid - 6)
      ctx.fillRect(x, y0, 1, Math.max(1, y1 - y0))
    }
    // selection overlay (spans all merged clips proportionally)
    if (total > 0 && selEnd > selStart) {
      const x0 = (selStart / total) * w
      const x1 = (selEnd / total) * w
      ctx.fillStyle = 'oklch(0.55 0.14 190 / 0.16)'
      ctx.fillRect(x0, 0, x1 - x0, h)
      ctx.fillStyle = 'oklch(0.55 0.14 190)'
      ctx.fillRect(x0 - 1, 0, 2, h)
      ctx.fillRect(x1 - 1, 0, 2, h)
    }
    // time ruler
    ctx.fillStyle = 'rgb(0 0 0 / 0.45)'
    ctx.font = '10px sans-serif'
    for (let t = 0; t <= total; t += 1) {
      const x = (t / total) * w
      ctx.fillRect(x, h - 8, 1, 8)
      if (t % 1 === 0 && x < w - 30) ctx.fillText(fmtTime(t), x + 2, h - 12)
    }
  }, [clips, selStart, selEnd, total])

  // click on the waveform moves the nearest selection edge
  const onWaveClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas || !total) return
      const rect = canvas.getBoundingClientRect()
      const t = ((e.clientX - rect.left) / rect.width) * total
      if (Math.abs(t - selStart) <= Math.abs(t - selEnd)) setSelStart(t)
      else setSelEnd(t)
    },
    [selStart, selEnd, total],
  )

  // --------------------------------------------------------------- ingest
  const onFiles = useCallback(async (files: File[]) => {
    setError(null)
    setResult(null)
    setDecoding(true)
    try {
      const ctx = new AudioContext()
      const next: Clip[] = []
      for (const f of files) {
        if (f.size > 200 * 1024 * 1024) {
          setError(`"${f.name}" is ${formatBytes(f.size)} — over the 200 MB this tab can decode safely.`)
          continue
        }
        try {
          const buf = await ctx.decodeAudioData(await f.arrayBuffer())
          next.push({ name: f.name, buffer: buf, sizeBytes: f.size })
        } catch {
          setError(`"${f.name}" could not be decoded by this browser — try WAV, MP3, OGG, FLAC or M4A.`)
        }
      }
      await ctx.close()
      if (next.length) {
        setClips((prev) => {
          // replacing vs merging: multiple files at once replace the set and
          // auto-merge them; a single new file replaces too (clear mental model)
          void prev
          return next
        })
        setSelStart(0)
        setSelEnd(next.reduce((a, c) => a + c.buffer.duration, 0))
        mergeRef.current = next.length > 1
      }
    } finally {
      setDecoding(false)
    }
  }, [])

  // --------------------------------------------------------------- render
  const render = useCallback(async () => {
    if (!clips.length || selEnd <= selStart) {
      setError('Make a selection longer than zero seconds first.')
      return
    }
    setError(null)
    setResult(null)
    setRendering(true)
    try {
      await new Promise((r) => setTimeout(r, 20)) // let the spinner paint
      // 1. assemble the source span (merge mode concatenates all clips)
      let source: AudioBuffer
      if (mergeRef.current && clips.length > 1) {
        source = concatBuffers(clips.map((c) => c.buffer))
      } else {
        source = clips[0].buffer
      }
      // 2. slice + speed + normalize gain — the selection edges bound the render
      const span = Math.min(selEnd, source.duration)
      const norm = normMode === 'off' ? 1 : normalizeGain(source, normMode, targetDb)
      const sliced = renderClip(source, Math.max(0, Math.min(selStart, span - 0.05)), span, speed, norm)
      // 3. fades
      applyFades(sliced, fadeIn, fadeOut)
      // 4. encode
      const base = (clips[0].name.replace(/\.[^.]+$/, '') || 'clip') + '-toolhive'
      if (format === 'wav') {
        const blob = encodeWav16(sliced)
        setResult({
          name: `${base}.wav`,
          blob,
          seconds: sliced.duration,
          sampleRate: sliced.sampleRate,
          channels: sliced.numberOfChannels,
        })
      } else {
        const { Mp3Encoder } = await import('@breezystack/lamejs')
        const enc = new Mp3Encoder(Math.min(sliced.numberOfChannels, 2), sliced.sampleRate, mp3Kbps)
        const left = sliced.getChannelData(0)
        const right = sliced.numberOfChannels > 1 ? sliced.getChannelData(1) : null
        const toInt16 = (f: Float32Array) => {
          const out = new Int16Array(f.length)
          for (let i = 0; i < f.length; i++) {
            const s = Math.max(-1, Math.min(1, f[i]))
            out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
          }
          return out
        }
        const l = toInt16(left)
        const r = right ? toInt16(right) : undefined
        const chunks: Uint8Array[] = []
        const block = 1152 * 16
        for (let i = 0; i < l.length; i += block) {
          const part = r
            ? enc.encodeBuffer(l.subarray(i, i + block), r.subarray(i, i + block))
            : enc.encodeBuffer(l.subarray(i, i + block))
          if (part.length) chunks.push(part)
        }
        const tail = enc.flush()
        if (tail.length) chunks.push(tail)
        const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' })
        setResult({
          name: `${base}.mp3`,
          blob,
          seconds: sliced.duration,
          sampleRate: sliced.sampleRate,
          channels: sliced.numberOfChannels,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rendering failed in this browser.')
    } finally {
      setRendering(false)
    }
  }, [clips, selStart, selEnd, speed, normMode, targetDb, fadeIn, fadeOut, format, mp3Kbps])

  return (
    <div>
      {/* ------------------------------------------------------------ action */}
      {clips.length === 0 ? (
        <DropZone
          onFiles={onFiles}
          accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac"
          title="Drop an audio file — or two to merge"
          hint="WAV, MP3, OGG, FLAC, M4A · decoded and edited on this device"
        />
      ) : (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <AudioLines className="size-4 text-primary" aria-hidden="true" />
              {clips.length > 1
                ? `${clips.length} clips, merged end-to-end`
                : clips[0].name}
            </span>
            <span className="text-muted-foreground">
              {clips.length > 1
                ? `${fmtTime(total)} total`
                : `${fmtTime(clips[0].buffer.duration)} · ${clips[0].buffer.sampleRate} Hz · ${clips[0].buffer.numberOfChannels === 1 ? 'mono' : 'stereo'}`}
            </span>
            {clips.length > 1 && (
              <span className="text-muted-foreground">{formatBytes(clips.reduce((a, c) => a + c.sizeBytes, 0))} in</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setClips([])
                setResult(null)
                setError(null)
              }}
            >
              Start over
            </Button>
          </div>

          <canvas
            ref={canvasRef}
            onClick={onWaveClick}
            className="mt-3 h-[120px] w-full cursor-crosshair rounded-lg border"
            aria-label="Waveform — click to move a selection edge"
            role="img"
          />

          {/* selection */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-muted-foreground">
              Start (s)
              <Input
                type="number"
                className="mt-1 h-9"
                step={0.1}
                min={0}
                max={total}
                value={selStart.toFixed(1)}
                onChange={(e) => setSelStart(Math.min(Number(e.target.value), selEnd - 0.1))}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              End (s)
              <Input
                type="number"
                className="mt-1 h-9"
                step={0.1}
                min={0}
                max={total}
                value={selEnd.toFixed(1)}
                onChange={(e) => setSelEnd(Math.max(Number(e.target.value), selStart + 0.1))}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Speed ({speed}×, pitch shifts)
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((v) => (
                  <option key={v} value={v}>
                    {v}×
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Normalize
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={normMode}
                onChange={(e) => setNormMode(e.target.value as typeof normMode)}
              >
                <option value="off">Off</option>
                <option value="peak">Peak → ceiling</option>
                <option value="rms">Loudness (RMS)</option>
              </select>
            </label>
          </div>

          {normMode !== 'off' && (
            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Target level: <span className="font-mono text-foreground">{targetDb} dBFS</span>
              <input
                type="range"
                className="mt-1 w-full accent-[oklch(0.55_0.14_190)]"
                min={-24}
                max={-1}
                step={1}
                value={targetDb}
                onChange={(e) => setTargetDb(Number(e.target.value))}
              />
            </label>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
            <label className="text-xs font-medium text-muted-foreground">
              Fade in (s)
              <Input
                type="number"
                className="mt-1 h-9"
                step={0.1}
                min={0}
                value={fadeIn}
                onChange={(e) => setFadeIn(Math.max(0, Number(e.target.value)))}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Fade out (s)
              <Input
                type="number"
                className="mt-1 h-9"
                step={0.1}
                min={0}
                value={fadeOut}
                onChange={(e) => setFadeOut(Math.max(0, Number(e.target.value)))}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Format
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={format}
                onChange={(e) => setFormat(e.target.value as 'wav' | 'mp3')}
              >
                <option value="wav">WAV (16-bit)</option>
                <option value="mp3">MP3 (LAME)</option>
              </select>
            </label>
            {format === 'mp3' && (
              <label className="text-xs font-medium text-muted-foreground">
                Bitrate
                <select
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={mp3Kbps}
                  onChange={(e) => setMp3Kbps(Number(e.target.value))}
                >
                  {[128, 192, 320].map((v) => (
                    <option key={v} value={v}>
                      {v} kbps
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={render} disabled={rendering || selEnd <= selStart}>
              {rendering ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Scissors className="size-4" aria-hidden="true" />
              )}
              {rendering ? 'Rendering…' : 'Render clip'}
            </Button>
            {result && (
              <Button variant="outline" onClick={() => downloadBlob(result.blob, result.name)}>
                <Download className="size-4" aria-hidden="true" />
                Download {result.name.split('.').pop()?.toUpperCase()} · {formatBytes(result.blob.size)}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              Selection {fmtTime(Math.max(0, selEnd - selStart))} →{' '}
              {fmtTime(Math.max(0, (selEnd - selStart) / speed))} at {speed}×
            </span>
          </div>

          {result && (
            <p className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <Waves className="size-4 text-primary" aria-hidden="true" />
              Ready: {result.name} — {result.seconds.toFixed(1)} s ·{' '}
              {(result.sampleRate / 1000).toFixed(1)} kHz ·{' '}
              {result.channels === 1 ? 'mono' : 'stereo'} · {formatBytes(result.blob.size)}
            </p>
          )}
        </div>
      )}

      {decoding && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Decoding audio on this device…
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <PrivacyStrip detail="Decoded, edited and encoded entirely in this tab with Web Audio and LAME — the recording never leaves this device, and nothing is sent to any server." />
    </div>
  )
}
