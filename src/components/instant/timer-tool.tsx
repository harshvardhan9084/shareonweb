'use client'

// Timer Studio — stopwatch, countdown, pomodoro and tabata on one page.
// The clocks are timestamp-driven: elapsed time is recomputed from
// performance.now() deltas on every tick, never accumulated by counting
// intervals. A throttled background tab can delay the UI, but it cannot
// make the clock drift — the next tick re-syncs to the truth. The alarm is
// synthesized with WebAudio (no audio file to fetch), a screen wake-lock is
// held while running, and the tab title mirrors the clock.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Flag, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Mode = 'stopwatch' | 'countdown' | 'pomodoro' | 'tabata'

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'stopwatch', label: 'Stopwatch' },
  { id: 'countdown', label: 'Countdown' },
  { id: 'pomodoro', label: 'Pomodoro' },
  { id: 'tabata', label: 'Tabata' },
]

const PAGE_TITLE = (() => {
  if (typeof document === 'undefined') return 'Kontivo'
  return document.title || 'Kontivo'
})()

// ----------------------------------------------------------------- audio -----

function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null)
  const mutedRef = useRef(false)
  return {
    setMuted: (m: boolean) => { mutedRef.current = m },
    play: useCallback((pattern: number[] = [880], durationMs = 220, volume = 0.25) => {
      if (mutedRef.current) return
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!ctxRef.current) ctxRef.current = new Ctor()
        const ctx = ctxRef.current
        if (ctx.state === 'suspended') void ctx.resume()
        let t = ctx.currentTime
        for (const freq of pattern) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          gain.gain.setValueAtTime(0.0001, t)
          gain.gain.exponentialRampToValueAtTime(volume, t + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000)
          osc.connect(gain).connect(ctx.destination)
          osc.start(t)
          osc.stop(t + durationMs / 1000 + 0.05)
          t += durationMs / 1000 + 0.12
        }
      } catch {
        /* audio blocked until first interaction — the visual flash still fires */
      }
    }, []),
  }
}

// ---------------------------------------------------------------- wake lock --

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let sentinel: { release: () => Promise<void>; addEventListener?: (t: string, cb: () => void) => void } | null = null
    let released = false
    const acquire = async () => {
      try {
        sentinel = (await (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<typeof sentinel> } }).wakeLock.request('screen')) as typeof sentinel
      } catch { /* some platforms refuse; the timer keeps working anyway */ }
    }
    void acquire()
    const onVisible = () => { if (document.visibilityState === 'visible' && !released) void acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}

// ------------------------------------------------------------------ format ---

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 10)) // centiseconds
  const cs = total % 100
  const s = Math.floor(total / 100) % 60
  const m = Math.floor(total / 6000) % 60
  const h = Math.floor(total / 360000)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  const c = String(cs).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}.${c}` : `${mm}:${ss}.${c}`
}

function parseHMStoMs(h: string, m: string, s: string): number {
  return (Number(h) || 0) * 3600000 + (Number(m) || 0) * 60000 + (Number(s) || 0) * 1000
}

interface Lap { n: number; split: number; total: number }

// -------------------------------------------------------------------- ui -----

export function TimerTool() {
  const [mode, setMode] = useState<Mode>('stopwatch')

  // shared clock state: startedAt = timestamp when the current run began,
  // base = ms accumulated before the current run.
  const [running, setRunning] = useState(false)
  const [now, setNow] = useState(0)
  const startedAtRef = useRef(0)
  const baseRef = useRef(0)
  const [muted, setMuted] = useState(false)
  const beep = useBeep()

  // stopwatch
  const [laps, setLaps] = useState<Lap[]>([])
  const lapBaseRef = useRef(0)

  // countdown
  const [cdH, setCdH] = useState('0')
  const [cdM, setCdM] = useState('5')
  const [cdS, setCdS] = useState('0')
  const [cdLoop, setCdLoop] = useState(false)
  const cdTotalRef = useRef(0)
  const [alarmActive, setAlarmActive] = useState(false)
  const alarmUntilRef = useRef(0)
  const [fired, setFired] = useState(false)

  // pomodoro
  const [workMin, setWorkMin] = useState('25')
  const [shortMin, setShortMin] = useState('5')
  const [longMin, setLongMin] = useState('15')
  const [roundsBeforeLong, setRoundsBeforeLong] = useState('4')
  const [phase, setPhase] = useState<'work' | 'short' | 'long'>('work')
  const [completed, setCompleted] = useState(0)

  // tabata
  const [prepSec, setPrepSec] = useState('10')
  const [workSec, setWorkSec] = useState('20')
  const [restSec, setRestSec] = useState('10')
  const [tbRounds, setTbRounds] = useState('8')
  const [tbPhase, setTbPhase] = useState<'prep' | 'work' | 'rest' | 'done'>('prep')
  const [tbRound, setTbRound] = useState(1)

  useWakeLock(running)

  useEffect(() => {
    if (!running) return
    let raf = 0
    const tick = () => {
      const t = performance.now()
      setNow(baseRef.current + (t - startedAtRef.current))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running])

  const start = () => {
    startedAtRef.current = performance.now()
    setRunning(true)
  }
  const pause = () => {
    baseRef.current += performance.now() - startedAtRef.current
    setRunning(false)
    setNow(baseRef.current)
  }
  const reset = () => {
    baseRef.current = 0
    startedAtRef.current = performance.now()
    setRunning(false)
    setNow(0)
    setLaps([])
    lapBaseRef.current = 0
    setAlarmActive(false)
    setFired(false)
  }

  // ------------------------------------------------- countdown completion ----
  const cdTotalMs = useMemo(() => parseHMStoMs(cdH, cdM, cdS), [cdH, cdM, cdS])

  useEffect(() => {
    if (mode !== 'countdown' || !running || cdTotalMs <= 0) return
    if (cdTotalRef.current === 0) cdTotalRef.current = cdTotalMs
    const remaining = cdTotalRef.current - (baseRef.current + performance.now() - startedAtRef.current)
    if (remaining <= 0) {
      setRunning(false)
      setFired(true)
      setAlarmActive(true)
      alarmUntilRef.current = Date.now() + 20000 // self-silence after 20 s
      baseRef.current = cdTotalRef.current
      setNow(cdTotalRef.current)
    }
  }, [now, mode, running, cdTotalMs])

  // alarm loop
  useEffect(() => {
    if (!alarmActive) return
    const id = setInterval(() => {
      if (Date.now() > alarmUntilRef.current) { setAlarmActive(false); return }
      beep.play([880, 660], 180)
    }, 1200)
    beep.play([880, 660], 180)
    return () => clearInterval(id)
  }, [alarmActive, beep])

  // ------------------------------------------------------ pomodoro cycling ---
  const pomoDurations = useMemo(() => ({
    work: parseHMStoMs('0', workMin, '0'),
    short: parseHMStoMs('0', shortMin, '0'),
    long: parseHMStoMs('0', longMin, '0'),
  }), [workMin, shortMin, longMin])

  useEffect(() => {
    if (mode !== 'pomodoro' || !running) return
    const dur = pomoDurations[phase]
    const elapsed = baseRef.current + performance.now() - startedAtRef.current
    if (elapsed >= dur) {
      beep.play(phase === 'work' ? [660, 880] : [880, 660], 200)
      baseRef.current = 0
      startedAtRef.current = performance.now()
      if (phase === 'work') {
        const done = completed + 1
        setCompleted(done)
        const isLong = done % (Number(roundsBeforeLong) || 4) === 0
        setPhase(isLong ? 'long' : 'short')
      } else {
        setPhase('work')
      }
    }
  }, [now, mode, running, phase, pomoDurations, completed, roundsBeforeLong, beep])

  // --------------------------------------------------------- tabata cycling --
  const tbDurations = useMemo(() => ({
    prep: parseHMStoMs('0', '0', prepSec),
    work: parseHMStoMs('0', '0', workSec),
    rest: parseHMStoMs('0', '0', restSec),
  }), [prepSec, workSec, restSec])

  useEffect(() => {
    if (mode !== 'tabata' || !running) return
    const dur = tbDurations[tbPhase === 'done' ? 'work' : tbPhase]
    const elapsed = baseRef.current + performance.now() - startedAtRef.current
    if (elapsed >= dur) {
      beep.play(tbPhase === 'work' ? [740] : [520], 150)
      baseRef.current = 0
      startedAtRef.current = performance.now()
      if (tbPhase === 'prep') { setTbPhase('work'); return }
      if (tbPhase === 'work') { setTbPhase('rest'); return }
      // rest → next round or done
      if (tbRound >= (Number(tbRounds) || 1)) setTbPhase('done')
      else { setTbRound((r) => r + 1); setTbPhase('work') }
    }
  }, [now, mode, running, tbPhase, tbDurations, tbRound, tbRounds, beep])

  // ------------------------------------------------------------- title -------
  useEffect(() => {
    const displayed = mode === 'countdown' && running && cdTotalRef.current > 0
      ? fmtClock(Math.max(0, cdTotalRef.current - (baseRef.current + performance.now() - startedAtRef.current)))
      : mode !== 'stopwatch' && (mode === 'pomodoro' || mode === 'tabata') && running
        ? fmtClock(Math.max(0, (mode === 'pomodoro' ? pomoDurations[phase] : tbDurations[tbPhase === 'done' ? 'work' : tbPhase]) - (baseRef.current + performance.now() - startedAtRef.current)))
        : mode === 'stopwatch' && running
          ? fmtClock(now)
          : null
    if (displayed) document.title = `${displayed} — ${MODES.find((m) => m.id === mode)!.label}`
    return () => { document.title = PAGE_TITLE }
  }, [now, running, mode, phase, pomoDurations, tbDurations, tbPhase])

  useEffect(() => () => { document.title = PAGE_TITLE }, [])

  const switchMode = (m: Mode) => {
    reset()
    cdTotalRef.current = 0
    setPhase('work')
    setTbPhase('prep')
    setTbRound(1)
    setMode(m)
  }

  const lap = () => {
    const total = now
    const split = total - lapBaseRef.current
    lapBaseRef.current = total
    setLaps((l) => [{ n: l.length + 1, split, total }, ...l])
  }

  const cdRemaining = mode === 'countdown' ? Math.max(0, (cdTotalRef.current || cdTotalMs) - now) : 0
  const pomoRemaining = mode === 'pomodoro' ? Math.max(0, pomoDurations[phase] - now) : 0
  const tbRemaining = mode === 'tabata' ? Math.max(0, tbDurations[tbPhase === 'done' ? 'work' : tbPhase] - now) : 0

  const display =
    mode === 'stopwatch' ? fmtClock(now)
    : mode === 'countdown' ? fmtClock(cdRemaining)
    : mode === 'pomodoro' ? fmtClock(pomoRemaining)
    : fmtClock(tbRemaining)

  const phaseLabel =
    mode === 'pomodoro' ? (phase === 'work' ? 'Work' : phase === 'short' ? 'Short break' : 'Long break')
    : mode === 'tabata' ? (tbPhase === 'prep' ? 'Get ready' : tbPhase === 'work' ? 'Work' : tbPhase === 'rest' ? 'Rest' : 'Done')
    : null

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Timer mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => switchMode(m.id)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                mode === m.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {m.label}
            </button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => { setMuted((m) => { beep.setMuted(!m); return !m }) }}
            aria-label={muted ? 'Unmute alarm' : 'Mute alarm'}
          >
            {muted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
            {muted ? 'Muted' : 'Sound on'}
          </Button>
        </div>

        {/* settings per mode */}
        {mode === 'countdown' && (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5"><Label htmlFor="cd-h">Hours</Label><Input id="cd-h" type="number" min={0} max={99} value={cdH} onChange={(e) => { setCdH(e.target.value); cdTotalRef.current = 0 }} className="font-mono" /></div>
            <div className="space-y-1.5"><Label htmlFor="cd-m">Minutes</Label><Input id="cd-m" type="number" min={0} max={59} value={cdM} onChange={(e) => { setCdM(e.target.value); cdTotalRef.current = 0 }} className="font-mono" /></div>
            <div className="space-y-1.5"><Label htmlFor="cd-s">Seconds</Label><Input id="cd-s" type="number" min={0} max={59} value={cdS} onChange={(e) => { setCdS(e.target.value); cdTotalRef.current = 0 }} className="font-mono" /></div>
            <label className="flex items-center gap-2.5 pt-5 text-sm">
              <Switch checked={cdLoop} onCheckedChange={(v) => { setCdLoop(v); cdTotalRef.current = 0 }} aria-label="Restart automatically" />
              <span>Restart when done</span>
            </label>
          </div>
        )}
        {mode === 'countdown' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: '1 min', ms: 60000 },
              { label: '5 min', ms: 300000 },
              { label: '10 min', ms: 600000 },
              { label: '25 min', ms: 1500000 },
              { label: '1 hour', ms: 3600000 },
            ].map((p) => (
              <Button key={p.label} type="button" variant="outline" size="sm" onClick={() => {
                reset(); cdTotalRef.current = p.ms
                setCdH(String(Math.floor(p.ms / 3600000)))
                setCdM(String(Math.floor((p.ms % 3600000) / 60000)))
                setCdS(String(Math.floor((p.ms % 60000) / 1000)))
              }}>
                {p.label}
              </Button>
            ))}
          </div>
        )}

        {mode === 'pomodoro' && (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5"><Label htmlFor="pm-work">Work (min)</Label><Input id="pm-work" type="number" min={1} max={120} value={workMin} onChange={(e) => setWorkMin(e.target.value)} className="font-mono" /></div>
            <div className="space-y-1.5"><Label htmlFor="pm-short">Short break (min)</Label><Input id="pm-short" type="number" min={1} max={60} value={shortMin} onChange={(e) => setShortMin(e.target.value)} className="font-mono" /></div>
            <div className="space-y-1.5"><Label htmlFor="pm-long">Long break (min)</Label><Input id="pm-long" type="number" min={1} max={60} value={longMin} onChange={(e) => setLongMin(e.target.value)} className="font-mono" /></div>
            <div className="space-y-1.5"><Label htmlFor="pm-rounds">Long break every N rounds</Label><Input id="pm-rounds" type="number" min={2} max={10} value={roundsBeforeLong} onChange={(e) => setRoundsBeforeLong(e.target.value)} className="font-mono" /></div>
          </div>
        )}

        {mode === 'tabata' && (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5"><Label htmlFor="tb-prep">Prepare (sec)</Label><Input id="tb-prep" type="number" min={0} max={120} value={prepSec} onChange={(e) => setPrepSec(e.target.value)} className="font-mono" /></div>
            <div className="space-y-1.5"><Label htmlFor="tb-work">Work (sec)</Label><Input id="tb-work" type="number" min={5} max={600} value={workSec} onChange={(e) => setWorkSec(e.target.value)} className="font-mono" /></div>
            <div className="space-y-1.5"><Label htmlFor="tb-rest">Rest (sec)</Label><Input id="tb-rest" type="number" min={0} max={600} value={restSec} onChange={(e) => setRestSec(e.target.value)} className="font-mono" /></div>
            <div className="space-y-1.5"><Label htmlFor="tb-rounds">Rounds</Label><Input id="tb-rounds" type="number" min={1} max={50} value={tbRounds} onChange={(e) => setTbRounds(e.target.value)} className="font-mono" /></div>
          </div>
        )}

        <PrivacyStrip detail="The clock runs on this device's high-resolution timestamps and the alarm is synthesized locally with WebAudio — no audio file, no server, no notification permission needed. Keep this tab open while it runs." />
      </div>

      {/* ------------------------------------------------------------ clock */}
      <div className={cn('rounded-xl border bg-card p-6 text-center transition-colors sm:p-10', alarmActive && 'animate-pulse border-destructive')}>
        {phaseLabel && (
          <p className={cn('text-sm font-semibold uppercase tracking-wider', tbPhase === 'work' || phase === 'work' ? 'text-primary' : 'text-muted-foreground')}>
            {phaseLabel}{mode === 'tabata' && tbPhase !== 'prep' && tbPhase !== 'done' ? ` — round ${tbRound} of ${tbRounds}` : ''}
            {mode === 'pomodoro' ? ` — ${completed} completed` : ''}
          </p>
        )}
        <p
          className={cn(
            'mt-2 font-mono text-5xl font-semibold tabular-nums tracking-tight sm:text-7xl',
            alarmActive && 'text-destructive',
          )}
          aria-live="off"
        >
          {display}
        </p>
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {alarmActive ? 'Time is up — the alarm repeats for 20 seconds.' : fired ? 'Done.' : running ? 'Running — the tab title carries the clock.' : 'Ready.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {!running ? (
            <Button type="button" size="lg" onClick={start} disabled={mode === 'countdown' && cdTotalMs <= 0}>
              <Play className="size-4" aria-hidden="true" /> {baseRef.current > 0 ? 'Resume' : 'Start'}
            </Button>
          ) : (
            <Button type="button" size="lg" variant="outline" onClick={pause}>
              <Pause className="size-4" aria-hidden="true" /> Pause
            </Button>
          )}
          {mode === 'stopwatch' && running && (
            <Button type="button" variant="outline" onClick={lap}>
              <Flag className="size-4" aria-hidden="true" /> Lap
            </Button>
          )}
          <Button type="button" variant="outline" onClick={reset}>
            <RotateCcw className="size-4" aria-hidden="true" /> Reset
          </Button>
          {alarmActive && (
            <Button type="button" onClick={() => { setAlarmActive(false); setFired(true); if (cdLoop && cdTotalRef.current > 0) { reset(); start() } }}>
              Dismiss & restart
            </Button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- laps */}
      {mode === 'stopwatch' && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-sm font-semibold">Laps</h2>
            {laps.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setLaps([])}>Clear</Button>}
          </div>
          {laps.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Press Lap while running to record a split.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {laps.map((l) => (
                <li key={l.n} className="flex items-center justify-between border-b px-4 py-2 font-mono text-sm tabular-nums last:border-0">
                  <span className="text-muted-foreground">#{l.n}</span>
                  <span>+{fmtClock(l.split)}</span>
                  <span className="font-medium">{fmtClock(l.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
