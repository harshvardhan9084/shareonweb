'use client'

// Sound tools, four in one: an SPL meter (mic → RMS → dBFS with an
// adjustable calibration offset and an honest "estimate" label), a tone
// generator (oscillator 20 Hz–20 kHz with waveform and volume, nearest note
// named), a guitar tuner (trimmed-autocorrelation pitch detection with a
// cents needle and the six standard strings highlighted), and a metronome
// (lookahead scheduling on the AudioContext clock, accented first beat,
// tap tempo). Every audio resource is created on demand and torn down on
// stop or tab switch; nothing touches navigator or AudioContext during
// render, so the page is SSR-safe. The meter's dBA figure is explicitly an
// estimate — phone/laptop microphones are not calibrated instruments, and
// the page says so instead of pretending otherwise.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------- shared

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

interface GuitarString {
  name: string
  freq: number
}

const STRINGS: GuitarString[] = [
  { name: 'E2 (low)', freq: 82.407 },
  { name: 'A2', freq: 110.0 },
  { name: 'D3', freq: 146.832 },
  { name: 'G3', freq: 196.0 },
  { name: 'B3', freq: 246.942 },
  { name: 'E4 (high)', freq: 329.628 },
]

/** Frequency -> nearest chromatic note + cents deviation. */
function nearestNote(freq: number): { note: string; cents: number; noteFreq: number; midi: number } {
  const midi = 69 + 12 * Math.log2(freq / 440)
  const rounded = Math.round(midi)
  const noteFreq = 440 * Math.pow(2, (rounded - 69) / 12)
  const cents = 1200 * Math.log2(freq / noteFreq)
  const name = `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`
  return { note: name, cents, noteFreq, midi: rounded }
}

/** Trimmed autocorrelation pitch detection (the classic ACF2+): gates on
 *  RMS, trims the quiet head/tail, correlates, parabolic-interpolates the
 *  peak. Returns Hz or −1 when nothing confident is there. */
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const size = buf.length
  let rms = 0
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / size)
  if (rms < 0.01) return -1

  let r1 = 0
  let r2 = size - 1
  const thres = 0.2
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buf[i]) < thres) {
      r1 = i
      break
    }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buf[size - i]) < thres) {
      r2 = size - i
      break
    }
  }
  const s = buf.slice(r1, r2)
  const n = s.length
  if (n < 128) return -1
  const c = new Float32Array(n)
  for (let lag = 0; lag < n; lag++) {
    let sum = 0
    for (let i = 0; i < n - lag; i++) sum += s[i] * s[i + lag]
    c[lag] = sum
  }
  let d = 0
  while (d < n - 1 && c[d] > c[d + 1]) d++
  let maxval = -1
  let maxpos = -1
  for (let i = d; i < n; i++) {
    if (c[i] > maxval) {
      maxval = c[i]
      maxpos = i
    }
  }
  if (maxpos <= 0) return -1
  let t0 = maxpos
  const x1 = c[t0 - 1] ?? 0
  const x2 = c[t0]
  const x3 = c[t0 + 1] ?? 0
  const a = (x1 + x3 - 2 * x2) / 2
  const b = (x3 - x1) / 2
  if (a !== 0) t0 = t0 - b / (2 * a)
  const hz = sampleRate / t0
  if (!Number.isFinite(hz) || hz < 50 || hz > 2000) return -1
  return hz
}

// ------------------------------------------------------------- component

export function SoundToolsTool() {
  const [tab, setTab] = useState('meter')

  // ---- meter state
  const [meterOn, setMeterOn] = useState(false)
  const [meterError, setMeterError] = useState<string | null>(null)
  const [dbfs, setDbfs] = useState<number | null>(null)
  const [peak, setPeak] = useState(-100)
  const [stats, setStats] = useState<{ min: number; max: number; avg: number; n: number } | null>(null)
  const [calibration, setCalibration] = useState(100)
  const meterRefs = useRef<{
    ctx: AudioContext | null
    stream: MediaStream | null
    raf: number
    sum: number
    count: number
    min: number
    max: number
  }>({ ctx: null, stream: null, raf: 0, sum: 0, count: 0, min: 100, max: -100 })

  // ---- tone state
  const [toneFreq, setToneFreq] = useState(440)
  const [toneWave, setToneWave] = useState<OscillatorType>('sine')
  const [toneGain, setToneGain] = useState(0.3)
  const [toneOn, setToneOn] = useState(false)
  const toneRefs = useRef<{ ctx: AudioContext | null; osc: OscillatorNode | null; gain: GainNode | null }>({
    ctx: null,
    osc: null,
    gain: null,
  })

  // ---- tuner state
  const [tunerOn, setTunerOn] = useState(false)
  const [tunerError, setTunerError] = useState<string | null>(null)
  const [pitch, setPitch] = useState<number | null>(null)
  const tunerRefs = useRef<{ ctx: AudioContext | null; stream: MediaStream | null; raf: number; last: number }>({
    ctx: null,
    stream: null,
    raf: 0,
    last: 0,
  })

  // ---- metronome state
  const [bpm, setBpm] = useState(120)
  const [beatsPerBar, setBeatsPerBar] = useState(4)
  const [accent, setAccent] = useState(true)
  const [metroOn, setMetroOn] = useState(false)
  const [beatFlash, setBeatFlash] = useState(-1)
  const [taps, setTaps] = useState<number[]>([])
  const metroRefs = useRef<{
    ctx: AudioContext | null
    timer: number
    raf: number
    nextTime: number
    beatInBar: number
    pending: Array<{ time: number; beat: number }>
  }>({ ctx: null, timer: 0, raf: 0, nextTime: 0, beatInBar: 0, pending: [] })

  const stopEverything = useCallback(() => {
    // meter
    const m = meterRefs.current
    if (m.raf) cancelAnimationFrame(m.raf)
    m.stream?.getTracks().forEach((t) => t.stop())
    void m.ctx?.close()
    m.ctx = null
    m.stream = null
    m.raf = 0
    setMeterOn(false)
    setDbfs(null)
    setStats(null)
    setPeak(-100)
    // tone
    const t = toneRefs.current
    try {
      t.osc?.stop()
    } catch {
      /* already stopped */
    }
    t.osc?.disconnect()
    void t.ctx?.close()
    t.ctx = null
    t.osc = null
    t.gain = null
    setToneOn(false)
    // tuner
    const u = tunerRefs.current
    if (u.raf) cancelAnimationFrame(u.raf)
    u.stream?.getTracks().forEach((tr) => tr.stop())
    void u.ctx?.close()
    u.ctx = null
    u.stream = null
    u.raf = 0
    setTunerOn(false)
    setPitch(null)
    // metronome
    const mt = metroRefs.current
    if (mt.timer) clearInterval(mt.timer)
    if (mt.raf) cancelAnimationFrame(mt.raf)
    void mt.ctx?.close()
    mt.ctx = null
    mt.timer = 0
    mt.raf = 0
    mt.pending = []
    setMetroOn(false)
    setBeatFlash(-1)
  }, [])

  // tear everything down when the component unmounts or the tab changes
  useEffect(() => {
    return stopEverything
  }, [stopEverything, tab])

  // ------------------------------------------------------------ handlers

  async function startMeter() {
    setMeterError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      src.connect(analyser)
      meterRefs.current.ctx = ctx
      meterRefs.current.stream = stream
      meterRefs.current.min = 100
      meterRefs.current.max = -100
      meterRefs.current.sum = 0
      meterRefs.current.count = 0
      setMeterOn(true)
      const buf = new Float32Array(analyser.fftSize)
      const loop = () => {
        const r = meterRefs.current
        if (!r.ctx) return
        analyser.getFloatTimeDomainData(buf)
        let sumSq = 0
        for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i]
        const rms = Math.sqrt(sumSq / buf.length)
        const db = rms > 0 ? Math.max(-100, Math.min(0, 20 * Math.log10(rms))) : -100
        setDbfs(db)
        setPeak((p) => Math.max(p, db))
        r.sum += db
        r.count += 1
        r.min = Math.min(r.min, db)
        r.max = Math.max(r.max, db)
        if (r.count % 30 === 0) {
          setStats({ min: r.min, max: r.max, avg: r.sum / r.count, n: r.count })
        }
        r.raf = requestAnimationFrame(loop)
      }
      meterRefs.current.raf = requestAnimationFrame(loop)
    } catch (e) {
      setMeterError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Microphone permission was denied — the meter only works with mic access, and nothing is recorded even when it is granted.'
          : 'No microphone was available. Check that a input device is connected and not held by another app.',
      )
    }
  }

  function startTone() {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = toneWave
    osc.frequency.value = toneFreq
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(toneGain, ctx.currentTime + 0.03)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    toneRefs.current = { ctx, osc, gain }
    setToneOn(true)
  }

  function stopTone() {
    const t = toneRefs.current
    if (t.ctx && t.gain) {
      t.gain.gain.setValueAtTime(t.gain.gain.value, t.ctx.currentTime)
      t.gain.gain.exponentialRampToValueAtTime(0.0001, t.ctx.currentTime + 0.05)
    }
    const osc = t.osc
    const ctx = t.ctx
    setTimeout(() => {
      try {
        osc?.stop()
      } catch {
        /* already stopped */
      }
      osc?.disconnect()
      void ctx?.close()
    }, 80)
    toneRefs.current = { ctx: null, osc: null, gain: null }
    setToneOn(false)
  }

  function changeToneFreq(f: number) {
    setToneFreq(f)
    const t = toneRefs.current
    if (t.ctx && t.osc) t.osc.frequency.setTargetAtTime(f, t.ctx.currentTime, 0.01)
  }

  function changeToneWave(w: OscillatorType) {
    setToneWave(w)
    const t = toneRefs.current
    if (t.osc) t.osc.type = w
  }

  function changeToneGain(g: number) {
    setToneGain(g)
    const t = toneRefs.current
    if (t.ctx && t.gain) t.gain.gain.setTargetAtTime(g, t.ctx.currentTime, 0.01)
  }

  async function startTuner() {
    setTunerError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      src.connect(analyser)
      tunerRefs.current.ctx = ctx
      tunerRefs.current.stream = stream
      setTunerOn(true)
      const buf = new Float32Array(analyser.fftSize)
      const loop = (ts: number) => {
        const r = tunerRefs.current
        if (!r.ctx) return
        if (ts - r.last > 90) {
          r.last = ts
          analyser.getFloatTimeDomainData(buf)
          const hz = autoCorrelate(buf, ctx.sampleRate)
          setPitch(hz > 0 ? hz : null)
        }
        r.raf = requestAnimationFrame(loop)
      }
      tunerRefs.current.raf = requestAnimationFrame(loop)
    } catch (e) {
      setTunerError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Microphone permission was denied — the tuner listens but never records.'
          : 'No microphone was available for pitch detection.',
      )
    }
  }

  function startMetronome() {
    const ctx = new AudioContext()
    metroRefs.current.ctx = ctx
    metroRefs.current.nextTime = ctx.currentTime + 0.1
    metroRefs.current.beatInBar = 0
    metroRefs.current.pending = []
    setMetroOn(true)
    // look-ahead scheduler: queue clicks on the audio clock, never setTimeout
    const timer = window.setInterval(() => {
      const r = metroRefs.current
      if (!r.ctx) return
      const spb = 60 / bpm
      while (r.nextTime < r.ctx.currentTime + 0.12) {
        const beat = r.beatInBar
        const click = r.ctx.createOscillator()
        const g = r.ctx.createGain()
        click.frequency.value = accent && beat === 0 ? 1600 : 1100
        g.gain.setValueAtTime(0.001, r.nextTime)
        g.gain.exponentialRampToValueAtTime(accent && beat === 0 ? 0.5 : 0.3, r.nextTime + 0.004)
        g.gain.exponentialRampToValueAtTime(0.001, r.nextTime + 0.06)
        click.connect(g)
        g.connect(r.ctx.destination)
        click.start(r.nextTime)
        click.stop(r.nextTime + 0.08)
        r.pending.push({ time: r.nextTime, beat })
        r.nextTime += spb
        r.beatInBar = (r.beatInBar + 1) % beatsPerBar
      }
    }, 25)
    metroRefs.current.timer = timer
    // visual flash: drain the scheduled beats as the audio clock passes them
    const rafLoop = () => {
      const r = metroRefs.current
      if (!r.ctx) return
      const now = r.ctx.currentTime
      while (r.pending.length && r.pending[0].time <= now) {
        const b = r.pending.shift()
        if (b) setBeatFlash(b.beat)
      }
      r.raf = requestAnimationFrame(rafLoop)
    }
    metroRefs.current.raf = requestAnimationFrame(rafLoop)
  }

  function tapTempo() {
    const now = performance.now()
    const next = [...taps, now].slice(-4)
    setTaps(next)
    if (next.length >= 2) {
      const intervals: number[] = []
      for (let i = 1; i < next.length; i++) intervals.push(next[i] - next[i - 1])
      const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length
      const detected = Math.round(60000 / avg)
      if (detected >= 20 && detected <= 300) setBpm(detected)
    }
  }

  // ------------------------------------------------------------ derived

  const spl = dbfs === null ? null : dbfs + calibration
  const toneNote = nearestNote(toneFreq)
  const tunerNote = pitch ? nearestNote(pitch) : null
  const closestString = tunerNote
    ? STRINGS.reduce(
        (best, s) => (Math.abs(s.freq - pitch!) < Math.abs(best.freq - pitch!) ? s : best),
        STRINGS[0],
      )
    : null
  const centsPct = tunerNote ? Math.max(-50, Math.min(50, tunerNote.cents)) / 50 : 0

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap" aria-label="Sound tools">
          <TabsTrigger value="meter">dB meter</TabsTrigger>
          <TabsTrigger value="tone">Tone generator</TabsTrigger>
          <TabsTrigger value="tuner">Guitar tuner</TabsTrigger>
          <TabsTrigger value="metronome">Metronome</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------ meter */}
        <TabsContent value="meter" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {!meterOn ? (
              <Button type="button" id="sound-meter-start" onClick={startMeter}>
                Start microphone
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={stopEverything}>
                Stop meter
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              The mic stream is analysed in memory and dropped the moment you stop — nothing is recorded.
            </p>
          </div>

          {meterError && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {meterError}
            </p>
          )}

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Estimated sound level</p>
                <p data-testid="sound-db" className="mt-1 font-display text-5xl font-semibold tabular-nums tracking-[-0.02em]">
                  {spl === null ? '—' : Math.round(spl)}
                  <span className="ml-2 text-lg font-medium text-muted-foreground">dBA (est.)</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  raw {dbfs === null ? '—' : `${dbfs.toFixed(1)} dBFS`} + {calibration} offset
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>peak {peak === -100 ? '—' : `${Math.round(peak + calibration)}`} dBA</p>
                {stats && (
                  <p className="mt-1">
                    min {Math.round(stats.min + calibration)} · avg {Math.round(stats.avg + calibration)} · max{' '}
                    {Math.round(stats.max + calibration)}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={spl === null ? 0 : Math.round(spl)} aria-valuemin={30} aria-valuemax={130} aria-label="Estimated sound level">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-150"
                style={{ width: `${spl === null ? 0 : Math.max(0, Math.min(100, ((spl - 30) / 100) * 100))}%` }}
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sound-cal">Calibration offset (+ on top of dBFS)</Label>
                <input
                  id="sound-cal"
                  type="range"
                  min={60}
                  max={140}
                  step={1}
                  value={calibration}
                  onChange={(e) => setCalibration(Number.parseInt(e.target.value, 10))}
                  className="w-full"
                />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                A laptop or phone mic is not a calibrated instrument. The offset defaults to 100 dB, which
                lands conversational speech near 60 dBA on most built-ins — hold a real SPL meter (or a
                trusted app) next to the mic once and slide the offset until the two agree, then the estimate
                is genuinely useful for a given room.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* ------------------------------------------------ tone */}
        <TabsContent value="tone" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-end justify-between">
              <div>
                <p data-testid="sound-tone-readout" className="font-display text-4xl font-semibold tabular-nums tracking-[-0.02em]">
                  {toneFreq.toLocaleString('en-US')} Hz
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  nearest note {toneNote.note} ({toneNote.cents >= 0 ? '+' : ''}
                  {Math.round(toneNote.cents)} cents) · period {(1000 / toneFreq).toFixed(2)} ms
                </p>
              </div>
              {!toneOn ? (
                <Button type="button" id="sound-tone-start" onClick={startTone}>
                  Play tone
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={stopTone}>
                  Stop tone
                </Button>
              )}
            </div>
            <div className="mt-5 space-y-1.5">
              <Label htmlFor="sound-freq">Frequency — 20 Hz to 20 kHz (log scale)</Label>
              <input
                id="sound-freq"
                type="range"
                min={0}
                max={1000}
                step={1}
                value={Math.round((Math.log10(toneFreq / 20) / 3) * 1000)}
                onChange={(e) => {
                  const t = Number.parseInt(e.target.value, 10) / 1000
                  changeToneFreq(Math.round(20 * Math.pow(10, 3 * t) * 100) / 100)
                }}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>20 Hz</span>
                <span>200 Hz</span>
                <span>2 kHz</span>
                <span>20 kHz</span>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sound-wave">Waveform</Label>
                <Select value={toneWave} onValueChange={(v) => changeToneWave(v as OscillatorType)}>
                  <SelectTrigger id="sound-wave" aria-label="Waveform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sine">Sine — pure, no overtones</SelectItem>
                    <SelectItem value="square">Square — hollow, strong odd harmonics</SelectItem>
                    <SelectItem value="sawtooth">Sawtooth — bright, all harmonics</SelectItem>
                    <SelectItem value="triangle">Triangle — soft, some overtones</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sound-vol">Volume</Label>
                <input
                  id="sound-vol"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={toneGain}
                  onChange={(e) => changeToneGain(Number.parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Start low and turn the volume down before you raise the frequency — hearing loss from a loud
              high tone is instant and permanent, and tweeters distort before your ears warn you.
            </p>
          </div>
        </TabsContent>

        {/* ------------------------------------------------ tuner */}
        <TabsContent value="tuner" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {!tunerOn ? (
              <Button type="button" id="sound-tuner-start" onClick={startTuner}>
                Start listening
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={stopEverything}>
                Stop tuner
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Pitch detection runs in memory; nothing is recorded.</p>
          </div>

          {tunerError && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {tunerError}
            </p>
          )}

          <div className="rounded-xl border bg-card p-5">
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground">Detected pitch</p>
              <p data-testid="sound-tuner-note" className="mt-1 font-display text-5xl font-semibold tracking-[-0.02em]">
                {tunerNote ? tunerNote.note : tunerOn ? '—' : '—'}
              </p>
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                {pitch ? `${pitch.toFixed(1)} Hz` : tunerOn ? 'play a single open string' : 'waiting for the microphone'}
              </p>
            </div>

            <div className="mt-4">
              <div className="relative h-10">
                <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-primary/60" aria-hidden="true" />
                <div className="absolute inset-x-0 top-4 h-0.5 rounded bg-muted" aria-hidden="true" />
                <div
                  className="absolute top-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-background bg-primary shadow transition-[left] duration-100"
                  style={{ left: `${50 + centsPct * 47}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>−50 ¢ flat</span>
                <span className={tunerNote && Math.abs(tunerNote.cents) <= 5 ? 'font-semibold text-primary' : ''}>
                  {tunerNote && Math.abs(tunerNote.cents) <= 5 ? 'in tune' : 'in tune here'}
                </span>
                <span>+50 ¢ sharp</span>
              </div>
            </div>

            <ul data-testid="sound-strings" className="mt-5 grid gap-2 sm:grid-cols-3">
              {STRINGS.map((s) => {
                const active = closestString?.name === s.name && tunerOn
                const note = nearestNote(s.freq)
                return (
                  <li
                    key={s.name}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-sm',
                      active && 'border-primary/50 bg-primary/5',
                    )}
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {note.note} · {s.freq.toFixed(2)} Hz
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Standard tuning, A4 = 440 Hz. The needle shows how far the detected pitch sits from the nearest
              chromatic note; |cents| ≤ 5 counts as in tune. Pluck one open string at a time and let it ring —
              the detector needs a clean single pitch.
            </p>
          </div>
        </TabsContent>

        {/* --------------------------------------------- metronome */}
        <TabsContent value="metronome" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sound-bpm">Tempo (BPM)</Label>
                <Input
                  id="sound-bpm"
                  type="number"
                  min={20}
                  max={300}
                  value={bpm}
                  onChange={(e) => {
                    const v = Number.parseInt(e.target.value, 10)
                    if (Number.isFinite(v) && v >= 20 && v <= 300) setBpm(v)
                  }}
                  className="w-28"
                />
              </div>
              <div className="flex-1 space-y-1.5" data-testid="sound-bpm-out">
                <input
                  type="range"
                  min={20}
                  max={300}
                  step={1}
                  value={bpm}
                  onChange={(e) => setBpm(Number.parseInt(e.target.value, 10))}
                  className="w-full"
                  aria-label="Tempo slider"
                />
                <p className="text-xs font-medium text-muted-foreground">
                  {bpm} BPM · {beatsPerBar}/4 · {metroOn ? 'running' : 'stopped'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!metroOn ? (
                  <Button type="button" id="sound-metro-start" onClick={startMetronome}>
                    Start
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={stopEverything}>
                    Stop
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={tapTempo} disabled={metroOn}>
                  Tap tempo
                </Button>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <div className="flex gap-2" aria-label="Beat indicator">
                {Array.from({ length: beatsPerBar }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'flex size-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-75',
                      metroOn && beatFlash === i
                        ? i === 0 && accent
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-primary/60 bg-primary/15'
                        : 'bg-muted/40 text-muted-foreground',
                    )}
                  >
                    {i + 1}
                  </span>
                ))}
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Label htmlFor="sound-bpb" className="w-28">Beats per bar</Label>
                  <Select value={String(beatsPerBar)} onValueChange={(v) => setBeatsPerBar(Number.parseInt(v, 10))}>
                    <SelectTrigger id="sound-bpb" className="w-24" aria-label="Beats per bar">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 6, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-3">
                  <Switch checked={accent} onCheckedChange={setAccent} aria-label="Accent the first beat" />
                  <span className="text-foreground/90">Accent the first beat</span>
                </label>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Clicks are scheduled on the audio clock with a 120 ms look-ahead, so the beat does not drift when
              the tab throttles timers — the same discipline pro metronome apps use. Tap tempo averages your
              last four taps.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <PrivacyStrip detail="All four modes run on this device: the microphone stream is analysed in memory and never recorded, the tone and clicks are generated locally, and nothing is sent over the network." />
    </div>
  )
}
