'use client'

/*
 * Speed Test — a real connection measurement that runs entirely in this tab.
 *
 * Protocol (honest engineering, no fake meters):
 *  - Latency & jitter: 8 tiny requests (0 bytes) to Cloudflare's public
 *    speed endpoint; the first is discarded as TCP/TLS warm-up (it doubles
 *    as the server-label probe), the median is the ping, the mean absolute
 *    difference of consecutive samples is the jitter.
 *  - Download: up to 4 parallel streams pulled with a ReadableStream reader,
 *    bytes accumulated live. Stops at 7 seconds or 48 MB total, whichever
 *    comes first — a speed test is a measurement, not a data-plan drain,
 *    and the moved volumes are printed in the result.
 *  - Upload: rounds of 3 parallel POSTs of a random 3 MB payload, capped at
 *    12 MB / 5 s. The payload carries a text/plain content type on purpose:
 *    a CORS-simple request, so no preflight round-trip skews the timing.
 *  - Bufferbloat: while the download streams run, a probe every 1.2 s times
 *    an unloaded-size request — the loaded-vs-idle latency delta is what
 *    makes video calls stutter on a saturated line.
 *
 * Endpoints: https://speed.cloudflare.com/__down and /__up — public,
 * CORS-open (Access-Control-Allow-Origin: *), operated by Cloudflare. No
 * Kontivo server is involved; nothing is stored anywhere.
 *
 * SSR rules respected: no window/performance/crypto at render time; every
 * measurement lives inside the run handler behind a click.
 */

import { useCallback, useRef, useState } from 'react'
import { Activity, ArrowDown, ArrowUp, CircleAlert, Gauge, RotateCcw, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PrivacyStrip } from '@/components/instant/instant-kit'

/* --------------------------------- constants ------------------------------ */

const DOWN_URL = 'https://speed.cloudflare.com/__down?bytes='
const UP_URL = 'https://speed.cloudflare.com/__up'

const PING_COUNT = 8
const DOWN_STREAMS = 4
const DOWN_PER_STREAM = 8_000_000 // 8 MB requested per stream
const DOWN_MAX_BYTES = 48_000_000 // hard transfer cap across all streams
const DOWN_MAX_MS = 7_000
const UP_STREAMS = 3
const UP_PER_POST = 3_000_000 // 3 MB per POST
const UP_MAX_BYTES = 12_000_000
const UP_MAX_MS = 5_000
const LOADED_PROBE_MS = 1_200

/* ---------------------------------- types --------------------------------- */

type Phase = 'idle' | 'latency' | 'download' | 'upload' | 'done'

interface SpeedResult {
  downMbps: number | null
  upMbps: number | null
  idleMs: number | null
  jitterMs: number | null
  loadedMs: number | null
  downBytes: number
  upBytes: number
  server: string | null
  stoppedEarly: boolean
}

const EMPTY_RESULT: SpeedResult = {
  downMbps: null,
  upMbps: null,
  idleMs: null,
  jitterMs: null,
  loadedMs: null,
  downBytes: 0,
  upBytes: 0,
  server: null,
  stoppedEarly: false,
}

/* --------------------------------- helpers -------------------------------- */

function median(values: number[]): number {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function fmtMbps(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (v >= 1000) return `${(v / 1000).toFixed(2)} Gbps`
  if (v >= 100) return `${v.toFixed(0)} Mbps`
  return `${v.toFixed(1)} Mbps`
}

function fmtMs(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${Math.round(v)} ms`
}

function fmtMb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

function fmtDuration(bytes: number, mbps: number | null): string {
  if (!mbps || mbps <= 0 || !Number.isFinite(mbps)) return '—'
  const seconds = (bytes * 8) / (mbps * 1_000_000)
  if (seconds < 90) return `${Math.round(seconds)} s`
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`
  return `${(seconds / 3600).toFixed(1)} h`
}

function makePayload(bytes: number): Blob {
  const buf = new Uint8Array(bytes)
  // 64 KiB slices of crypto random: incompressible, cheap to build.
  for (let off = 0; off < bytes; off += 65536) {
    crypto.getRandomValues(buf.subarray(off, Math.min(off + 65536, bytes)))
  }
  // text/plain keeps this a CORS-simple request — no preflight round trip
  // in front of the timed upload.
  return new Blob([buf], { type: 'text/plain' })
}

/* Capacity rows: what a measured speed can carry. need is in Mbps. */
interface CapacityRow {
  label: string
  need: number
  dir: 'down' | 'up'
  note: string
}

const CAPACITY_ROWS: CapacityRow[] = [
  { label: 'SD video (480p stream)', need: 3, dir: 'down', note: 'Casual watching on one screen' },
  { label: 'HD video (1080p stream)', need: 8, dir: 'down', note: 'Netflix/YouTube high quality' },
  { label: '4K stream', need: 25, dir: 'down', note: 'Ultra HD on one screen' },
  { label: 'Cloud gaming (720p60)', need: 16, dir: 'down', note: 'GeForce Now / Xbox Cloud' },
  { label: 'HD group video call', need: 4, dir: 'up', note: 'Zoom/Meet gallery view' },
  { label: 'Cloud backup in use', need: 10, dir: 'up', note: 'Photos syncing while you work' },
]

type Capacity = 'yes' | 'marginal' | 'no'

function capacityFor(need: number, have: number | null): Capacity {
  if (have == null || !Number.isFinite(have)) return 'no'
  if (have >= need * 1.25) return 'yes'
  if (have >= need) return 'marginal'
  return 'no'
}

function bloatGrade(deltaMs: number | null): { label: string; tone: 'good' | 'ok' | 'bad' } | null {
  if (deltaMs == null || !Number.isFinite(deltaMs)) return null
  if (deltaMs < 30) return { label: 'A — calls stay smooth under load', tone: 'good' }
  if (deltaMs < 60) return { label: 'B — minor lag while uploading', tone: 'ok' }
  if (deltaMs < 150) return { label: 'C — calls may stutter during big transfers', tone: 'bad' }
  return { label: 'F — heavy buffering under load (bufferbloat)', tone: 'bad' }
}

/* ------------------------------- component -------------------------------- */

const PHASE_STEPS: Array<{ key: Phase; label: string }> = [
  { key: 'latency', label: 'Ping' },
  { key: 'download', label: 'Download' },
  { key: 'upload', label: 'Upload' },
]

export function SpeedTestTool() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [liveValue, setLiveValue] = useState('')
  const [liveHint, setLiveHint] = useState('')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<SpeedResult | null>(null)

  // Guards a run against a stale async tail (stop pressed, second run, or
  // the view unmounting mid-measurement).
  const runIdRef = useRef(0)
  const stopRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const running = phase === 'latency' || phase === 'download' || phase === 'upload'

  const stop = useCallback(() => {
    stopRef.current = true
    abortRef.current?.abort()
  }, [])

  const run = useCallback(async () => {
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    const stale = () => runIdRef.current !== runId || stopRef.current

    // Each phase gets its own controller: a download aborted at its byte
    // cap must not leave a dead controller for the upload phase.
    let controller = new AbortController()
    const rotateController = () => {
      controller = new AbortController()
      abortRef.current = controller
      return controller
    }
    abortRef.current = controller
    stopRef.current = false
    setError(null)
    setResult(null)
    setProgress(0)

    const out: SpeedResult = { ...EMPTY_RESULT }

    try {
      /* ------------------------------ latency ----------------------------- */
      setPhase('latency')
      setLiveHint('Timing small probes')
      setLiveValue('…')

      const samples: number[] = []
      for (let i = 0; i < PING_COUNT; i++) {
        if (stale()) break
        setProgress((i + 1) / PING_COUNT)
        try {
          const t0 = performance.now()
          const res = await fetch(`${DOWN_URL}0`, {
            cache: 'no-store',
            credentials: 'omit',
            signal: controller.signal,
          })
          await res.arrayBuffer()
          const ms = performance.now() - t0
          if (i === 0) {
            // First probe pays the TCP/TLS handshake — use it for the edge
            // location label, not for the ping.
            const city = res.headers.get('city')
            const colo = res.headers.get('cf-meta-colo')
            if (city || colo) {
              out.server = `Cloudflare ${city ?? ''} (${colo ?? 'edge'})`
                .replace(/\s+/g, ' ')
                .trim()
            }
            continue
          }
          samples.push(ms)
        } catch (err) {
          if (stopRef.current) break
          throw new Error(
            err instanceof Error && err.name === 'AbortError'
              ? 'Stopped.'
              : 'Could not reach the measurement endpoint (speed.cloudflare.com). A VPN, firewall or ad blocker may be blocking it.',
          )
        }
      }

      if (samples.length >= 2) {
        out.idleMs = median(samples)
        let jitterSum = 0
        for (let i = 1; i < samples.length; i++) {
          jitterSum += Math.abs(samples[i] - samples[i - 1])
        }
        out.jitterMs = jitterSum / (samples.length - 1)
      }
      if (stale()) {
        setResult({ ...out, stoppedEarly: true })
        setPhase('done')
        setLiveValue('')
        setLiveHint('')
        return
      }

      /* ----------------------------- download ----------------------------- */
      setPhase('download')
      setLiveHint('Pulling parallel streams')
      controller = rotateController()

      const loadedSamples: number[] = []
      const loadedTimer = window.setInterval(() => {
        void (async () => {
          try {
            const c = new AbortController()
            const t = setTimeout(() => c.abort(), 4_000)
            const t0 = performance.now()
            await fetch(`${DOWN_URL}0`, {
              cache: 'no-store',
              credentials: 'omit',
              signal: c.signal,
            })
            clearTimeout(t)
            loadedSamples.push(performance.now() - t0)
          } catch {
            /* a dropped probe is noise, not an error */
          }
        })()
      }, LOADED_PROBE_MS)

      const downStart = performance.now()
      let downBytes = 0
      try {
        while (!stale()) {
          const elapsed = performance.now() - downStart
          if (elapsed >= DOWN_MAX_MS || downBytes >= DOWN_MAX_BYTES) break

          const pull = async (): Promise<void> => {
            const res = await fetch(`${DOWN_URL}${DOWN_PER_STREAM}`, {
              cache: 'no-store',
              credentials: 'omit',
              signal: controller.signal,
            })
            if (!res.ok || !res.body) {
              throw new Error('the measurement endpoint refused a download stream')
            }
            const reader = res.body.getReader()
            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              downBytes += value.byteLength
              if (stale() || downBytes >= DOWN_MAX_BYTES) controller.abort()
              const el = Math.max(1, performance.now() - downStart)
              setLiveValue(fmtMbps(((downBytes * 8) / el) / 1000))
              setProgress(Math.min(1, Math.max(el / DOWN_MAX_MS, downBytes / DOWN_MAX_BYTES)))
            }
          }

          const settled = await Promise.allSettled(
            Array.from({ length: DOWN_STREAMS }, () => pull()),
          )
          // A non-abort failure on every stream is a real error; aborts
          // (stop button or byte cap) are expected control flow.
          const realFailure = settled.find(
            (r) =>
              r.status === 'rejected' &&
              r.reason instanceof Error &&
              r.reason.name !== 'AbortError',
          )
          if (realFailure && !stale()) throw realFailure.reason
        }
      } catch (err) {
        window.clearInterval(loadedTimer)
        if (!stopRef.current) {
          const msg = err instanceof Error ? err.message : 'network error'
          throw new Error(`Download measurement failed: ${msg}`)
        }
      }
      window.clearInterval(loadedTimer)

      const downElapsed = Math.max(1, performance.now() - downStart)
      if (downBytes > 0) {
        out.downBytes = downBytes
        out.downMbps = (downBytes * 8) / downElapsed / 1000
      }
      if (loadedSamples.length > 0 && out.idleMs != null) {
        out.loadedMs = median(loadedSamples)
      }
      if (stale()) {
        setResult({ ...out, stoppedEarly: true })
        setPhase('done')
        setLiveValue('')
        setLiveHint('')
        return
      }

      /* ------------------------------ upload ------------------------------ */
      setPhase('upload')
      setLiveHint('Sending parallel payloads')
      controller = rotateController()
      const payload = makePayload(UP_PER_POST)

      const upStart = performance.now()
      let upBytes = 0
      try {
        while (!stale()) {
          const elapsed = performance.now() - upStart
          if (elapsed >= UP_MAX_MS || upBytes >= UP_MAX_BYTES) break

          const settled = await Promise.allSettled(
            Array.from(
              { length: UP_STREAMS },
              () =>
                fetch(UP_URL, {
                  method: 'POST',
                  body: payload,
                  cache: 'no-store',
                  credentials: 'omit',
                  signal: controller.signal,
                }),
            ),
          )
          // Only completed POSTs moved data; aborted ones moved a partial
          // body that cannot be timed honestly, so they count as zero.
          const okCount = settled.filter((r) => r.status === 'fulfilled').length
          if (!stale() && okCount > 0) upBytes += UP_PER_POST * okCount

          const realFailure = settled.find(
            (r) =>
              r.status === 'rejected' &&
              r.reason instanceof Error &&
              r.reason.name !== 'AbortError',
          )
          if (realFailure && !stale() && upBytes === 0) throw realFailure.reason

          const el = Math.max(1, performance.now() - upStart)
          setLiveValue(fmtMbps(((upBytes * 8) / el) / 1000))
          setProgress(Math.min(1, Math.max(el / UP_MAX_MS, upBytes / UP_MAX_BYTES)))
        }
      } catch (err) {
        if (!stopRef.current) {
          const msg = err instanceof Error ? err.message : 'network error'
          throw new Error(`Upload measurement failed: ${msg}`)
        }
      }

      const upElapsed = Math.max(1, performance.now() - upStart)
      if (upBytes > 0) {
        out.upBytes = upBytes
        out.upMbps = (upBytes * 8) / upElapsed / 1000
      }

      out.stoppedEarly = stopRef.current
      setResult({ ...out })
      setPhase('done')
      setLiveValue('')
      setLiveHint('')
      setProgress(1)
    } catch (err) {
      if (runIdRef.current !== runId) return
      setError(err instanceof Error ? err.message : 'The measurement failed unexpectedly.')
      setPhase('done')
      setLiveValue('')
      setLiveHint('')
    } finally {
      if (runIdRef.current === runId) abortRef.current = null
    }
  }, [])

  /* -------------------------------- render -------------------------------- */

  const phaseIndex = PHASE_STEPS.findIndex((p) => p.key === phase)
  const stepsDone = (i: number) =>
    (phase === 'done' && result != null) || (phaseIndex > i && phaseIndex >= 0)

  const capacity = result
    ? CAPACITY_ROWS.map((row) => ({
        ...row,
        status: capacityFor(row.need, row.dir === 'down' ? result.downMbps : result.upMbps),
      }))
    : []

  const bloat =
    result && result.loadedMs != null && result.idleMs != null
      ? bloatGrade(result.loadedMs - result.idleMs)
      : null

  return (
    <section aria-label="Connection speed measurement" className="space-y-4">
      {/* ------------------------------------------------------------ stage */}
      <div className="rounded-xl border bg-card p-5 sm:p-6" data-testid="speed-stage" data-phase={phase}>
        {/* phase stepper */}
        <ol className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Measurement phases">
          {PHASE_STEPS.map((step, i) => {
            const active = phase === step.key
            const done = stepsDone(i)
            return (
              <li
                key={step.key}
                data-speed-phase={step.key}
                className={
                  'flex items-center gap-1.5 text-sm ' +
                  (active
                    ? 'font-medium text-foreground'
                    : done
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/60')
                }
              >
                <span
                  className={
                    'flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold ' +
                    (active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground/70')
                  }
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {step.label}
              </li>
            )
          })}
        </ol>

        {/* live readout */}
        <div className="mt-5 flex min-h-[88px] flex-col justify-center rounded-lg border bg-muted/30 px-5 py-4">
          {phase === 'idle' && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Press start. The test runs three phases — ping, download, upload — and takes about
              fifteen seconds. It transfers real data (capped at roughly 48 MB down and 12 MB up)
              so the numbers are real too.
            </p>
          )}
          {running && (
            <>
              <p
                className="font-display text-4xl font-semibold tabular-nums tracking-[-0.02em] sm:text-5xl"
                data-testid="speed-live"
              >
                {liveValue || '…'}
                {phase === 'latency' ? (
                  <span className="ml-1 text-base font-medium text-muted-foreground">ms</span>
                ) : (
                  <span className="ml-1 text-base font-medium text-muted-foreground">Mbps</span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {PHASE_STEPS[phaseIndex]?.label} · {liveHint}
              </p>
            </>
          )}
          {phase === 'done' && !error && (
            <p className="text-sm text-muted-foreground">
              {result?.stoppedEarly
                ? 'Measurement stopped early — partial results below.'
                : 'Measurement complete. Results and what your line can carry are below.'}
            </p>
          )}
          {phase === 'done' && error && (
            <p className="flex items-start gap-2 text-sm text-destructive" data-testid="speed-error">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>

        {/* progress */}
        {running && (
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Measurement progress"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}

        {/* controls */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {running ? (
            <Button variant="outline" onClick={stop} data-testid="speed-stop">
              Stop
            </Button>
          ) : (
            <Button onClick={() => void run()} disabled={running} data-testid="speed-start">
              {phase === 'done' ? (
                <>
                  <RotateCcw className="size-4" aria-hidden="true" /> Run again
                </>
              ) : (
                <>
                  <Gauge className="size-4" aria-hidden="true" /> Start the test
                </>
              )}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Measured against Cloudflare&apos;s public speed endpoints from this browser — no app,
            no account, nothing stored.
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------- results */}
      {result && (result.downMbps != null || result.upMbps != null || result.idleMs != null) && (
        <div className="rounded-xl border bg-card p-5 sm:p-6" data-testid="speed-results">
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">Your numbers</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3.5" data-testid="speed-down">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ArrowDown className="size-3.5" aria-hidden="true" /> Download
              </dt>
              <dd className="mt-1.5 font-display text-xl font-semibold tabular-nums">
                {fmtMbps(result.downMbps)}
              </dd>
            </div>
            <div className="rounded-lg border p-3.5" data-testid="speed-up">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ArrowUp className="size-3.5" aria-hidden="true" /> Upload
              </dt>
              <dd className="mt-1.5 font-display text-xl font-semibold tabular-nums">
                {fmtMbps(result.upMbps)}
              </dd>
            </div>
            <div className="rounded-lg border p-3.5" data-testid="speed-ping">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Timer className="size-3.5" aria-hidden="true" /> Ping
              </dt>
              <dd className="mt-1.5 font-display text-xl font-semibold tabular-nums">
                {fmtMs(result.idleMs)}
              </dd>
            </div>
            <div className="rounded-lg border p-3.5" data-testid="speed-jitter">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Activity className="size-3.5" aria-hidden="true" /> Jitter
              </dt>
              <dd className="mt-1.5 font-display text-xl font-semibold tabular-nums">
                {fmtMs(result.jitterMs)}
              </dd>
            </div>
            <div className="col-span-2 rounded-lg border p-3.5 sm:col-span-1" data-testid="speed-bloat">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Activity className="size-3.5" aria-hidden="true" /> Under load
              </dt>
              <dd className="mt-1.5 text-sm font-medium">
                {result.loadedMs != null && result.idleMs != null
                  ? `+${Math.max(0, Math.round(result.loadedMs - result.idleMs))} ms vs idle`
                  : 'not sampled'}
              </dd>
              {bloat && (
                <dd
                  className={
                    'mt-1 text-xs ' +
                    (bloat.tone === 'good'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : bloat.tone === 'ok'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400')
                  }
                >
                  {bloat.label}
                </dd>
              )}
            </div>
          </dl>

          <p className="mt-4 text-xs text-muted-foreground" data-testid="speed-transfer">
            This run transferred {fmtMb(result.downBytes)} down and {fmtMb(result.upBytes)} up
            {result.server ? ` · measured against ${result.server}` : ''}.
          </p>
        </div>
      )}

      {/* --------------------------------------------------------- capacity */}
      {result && capacity.length > 0 && (
        <div className="rounded-xl border bg-card p-5 sm:p-6" data-testid="speed-capacity">
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">
            What your line can carry
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Computed from the measurement above, with headroom built in: a pass needs 25% more
            than the requirement, so a call does not drop the moment something else starts.
          </p>
          <ul className="mt-4 divide-y">
            {capacity.map((row) => (
              <li key={row.label} className="flex items-center gap-3 py-2.5" data-capacity={row.status}>
                <span
                  className={
                    'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ' +
                    (row.status === 'yes'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : row.status === 'marginal'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400')
                  }
                  aria-hidden="true"
                >
                  {row.status === 'yes' ? '✓' : row.status === 'marginal' ? '~' : '✕'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{row.label}</span>
                  <span className="block text-xs text-muted-foreground">{row.note}</span>
                </span>
                <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  needs {row.need} Mbps {row.dir}
                </span>
              </li>
            ))}
          </ul>
          {(result.downMbps != null || result.upMbps != null) && (
            <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <p data-testid="speed-eta-down">
                10 GB download at your speed:{' '}
                <span className="font-medium text-foreground">
                  {fmtDuration(10_000_000_000, result.downMbps)}
                </span>
              </p>
              <p data-testid="speed-eta-up">
                500 MB upload at your speed:{' '}
                <span className="font-medium text-foreground">
                  {fmtDuration(500_000_000, result.upMbps)}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      <PrivacyStrip detail="The measurement talks directly to Cloudflare's public speed endpoints from this tab — Kontivo's servers are never in the path, and no result is stored, logged or shared. The only traffic is the test itself, and the page shows you exactly how much it moved." />
    </section>
  )
}
