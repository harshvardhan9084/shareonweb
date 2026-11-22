'use client'

// LocationPanel — Live Location. Strictly opt-in and always time-limited:
// sharing starts only from the explicit button, always carries an expiry, and
// stops itself when the time runs out. Coordinates are published as volatile
// pings (live-only, never persisted) so nothing survives the session; the
// start/stop markers are persisted so late joiners see who is sharing.
//
// Sync protocol (via RoomClient app events):
//   'loc:start' persisted {until}        → device shares until this ISO time
//   'loc:ping'  volatile {lat,lng,acc}   → live position fix, 6-decimal rounded
//   'loc:stop'  persisted {}             → device stopped sharing
//
// Persisted events are echoed to everyone including the sender — own echoes
// are skipped here because state was applied optimistically at send time.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RoomClient } from '@/lib/room-client'
import type { AppEvent, DeviceType, Participant } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { MiniMap, type MapPoint } from '@/components/session/mini-map'
import {
  Clock,
  ExternalLink,
  LocateFixed,
  LocateOff,
  MapPin,
  Monitor,
  ShieldCheck,
  Smartphone,
  Tablet,
  Users,
} from 'lucide-react'

// ------------------------------------------------------------------ helpers

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function asRecord(payload: unknown): Record<string, unknown> | null {
  return payload !== null && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

/** Great-circle distance in meters. */
function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

function fmtDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

function fmtRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h} h ${m % 60} min`
}

function fmtUpdated(secondsAgo: number): string {
  if (secondsAgo < 3) return 'just now'
  if (secondsAgo < 60) return `${secondsAgo}s ago`
  return `${Math.floor(secondsAgo / 60)} min ago`
}

function DeviceChip({ device }: { device: string }) {
  const Icon = device === 'phone' ? Smartphone : device === 'tablet' ? Tablet : Monitor
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Icon className="size-3" aria-hidden="true" />
      {device}
    </span>
  )
}

// ------------------------------------------------------------------- consts

const DURATIONS = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
] as const

const PUBLISH_INTERVAL_MS = 8000
const AUTO_STOP_CHECK_MS = 10000

// Device-local marker of an announced share. Lets the share survive a reload
// (the room snapshot's persisted loc:start is keyed by the OLD socket id,
// which no longer matches after the reload) without ever leaving the device.
const LS_KEY = 'sow.loc.v1'

interface StoredShare {
  code: string
  until: string
  fromId: string
}

function readStoredShare(): StoredShare | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as unknown
    if (v === null || typeof v !== 'object') return null
    const r = v as Record<string, unknown>
    if (typeof r.code !== 'string' || typeof r.until !== 'string' || typeof r.fromId !== 'string') {
      return null
    }
    return { code: r.code, until: r.until, fromId: r.fromId }
  } catch {
    return null
  }
}

function writeStoredShare(s: StoredShare): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {
    // storage unavailable (privacy mode) — resume simply won't work
  }
}

function clearStoredShare(): void {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    // ignore
  }
}

interface SharerState {
  name: string
  device: string
  lat: number | null
  lng: number | null
  acc: number | null
  until: string // ISO
  updatedAt: number // epoch ms of last ping (or start)
}

type GeoErr = 'denied' | 'unavailable' | 'timeout' | null

interface LocationPanelProps {
  client: RoomClient | null
  selfId: string
  participants: Participant[]
  /** Persisted events from the join snapshot — rebuild sharer list for late joiners. */
  initialEvents: AppEvent[]
  connected: boolean
  isHost: boolean
  profileName: string
  device: DeviceType
  /** Session code — scopes the device-local resume marker to this room. */
  sessionCode: string
}

export function LocationPanel({
  client,
  selfId,
  participants,
  initialEvents,
  connected,
  profileName,
  device,
  sessionCode,
}: LocationPanelProps) {
  // ------------------------------------------------------------------- state
  const [durationMin, setDurationMin] = useState(30)
  const [sharing, setSharing] = useState(false)
  /** State mirror of untilRef — countdowns render from state, not refs. */
  const [untilAt, setUntilAt] = useState(0)
  const [myPos, setMyPos] = useState<{ lat: number; lng: number; acc: number } | null>(null)
  const [sharers, setSharers] = useState<Record<string, SharerState>>({})
  const [geoErr, setGeoErr] = useState<GeoErr>(null)
  const [now, setNow] = useState(() => Date.now())
  const [geoSupported] = useState(
    () => typeof navigator !== 'undefined' && 'geolocation' in navigator,
  )

  const watchIdRef = useRef<number | null>(null)
  const untilRef = useRef(0)
  const sharingRef = useRef(false)
  const lastPingRef = useRef(0)
  const lastFixRef = useRef<{ lat: number; lng: number; acc: number } | null>(null)
  const clientRef = useRef(client)
  const selfIdRef = useRef(selfId)
  const rebuiltRef = useRef(false)
  const resumedRef = useRef(false)

  useEffect(() => {
    sharingRef.current = sharing
    clientRef.current = client
    selfIdRef.current = selfId
  })

  // ------------------------------------------------- rebuild from snapshot
  useEffect(() => {
    if (rebuiltRef.current) return
    rebuiltRef.current = true
    const restored: Record<string, SharerState> = {}
    for (const ev of initialEvents) {
      if (ev.type === 'loc:start') {
        const p = asRecord(ev.payload)
        const until = typeof p?.until === 'string' ? p.until : ''
        const untilMs = Date.parse(until)
        if (!Number.isFinite(untilMs) || untilMs <= Date.now()) continue
        restored[ev.from] = {
          name: ev.name,
          device: ev.device,
          lat: null,
          lng: null,
          acc: null,
          until,
          updatedAt: Date.parse(ev.at) || Date.now(),
        }
      } else if (ev.type === 'loc:stop') {
        delete restored[ev.from]
      }
    }
    // One-time snapshot hydration — deferred to a microtask to avoid a
    // synchronous cascading render from the effect body. Functional form:
    // a value-form set would clobber the optimistic self entry that the
    // auto-resume path adds between mount and this microtask.
    queueMicrotask(() => {
      setSharers((prev) => {
        const merged = { ...prev }
        for (const [id, s] of Object.entries(restored)) {
          const cur = merged[id]
          merged[id] = cur
            ? { ...s, lat: cur.lat, lng: cur.lng, acc: cur.acc, updatedAt: cur.updatedAt }
            : s
        }
        return merged
      })
    })
  }, [initialEvents])

  // -------------------------------------------------------- remote app events
  useEffect(() => {
    if (!client) return
    return client.on('appevent', (raw) => {
      const ev = raw as AppEvent

      // Retire a sharer by id (own echoes included — a reload must remove
      // the ghost card left under the previous socket id).
      if (ev.type === 'loc:retire') {
        const p = asRecord(ev.payload)
        const forId = typeof p?.forId === 'string' ? p.forId : ''
        if (!forId) return
        setSharers((prev) => {
          if (!(forId in prev)) return prev
          const next = { ...prev }
          delete next[forId]
          return next
        })
        return
      }

      if (ev.from === selfId) return // own echoes — applied optimistically at send time

      if (ev.type === 'loc:start') {
        const p = asRecord(ev.payload)
        const until = typeof p?.until === 'string' ? p.until : ''
        const untilMs = Date.parse(until)
        if (!Number.isFinite(untilMs)) return
        setSharers((prev) => ({
          ...prev,
          [ev.from]: {
            name: ev.name,
            device: ev.device,
            lat: prev[ev.from]?.lat ?? null,
            lng: prev[ev.from]?.lng ?? null,
            acc: prev[ev.from]?.acc ?? null,
            until,
            updatedAt: Date.now(),
          },
        }))
        return
      }

      if (ev.type === 'loc:stop') {
        setSharers((prev) => {
          if (!(ev.from in prev)) return prev
          const next = { ...prev }
          delete next[ev.from]
          return next
        })
        return
      }

      if (ev.type === 'loc:ping') {
        const p = asRecord(ev.payload)
        const lat = typeof p?.lat === 'number' ? p.lat : null
        const lng = typeof p?.lng === 'number' ? p.lng : null
        const acc = typeof p?.acc === 'number' ? p.acc : null
        if (lat == null || lng == null) return
        setSharers((prev) => {
          const cur = prev[ev.from]
          if (!cur) return prev // ping without a known sharer — ignore
          return { ...prev, [ev.from]: { ...cur, lat, lng, acc, updatedAt: Date.now() } }
        })
      }
    })
  }, [client, selfId])

  // ------------------------------------------------------------- stop sharing
  const stopSharing = useCallback(
    (silent = false) => {
      const c = clientRef.current
      if (watchIdRef.current != null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      watchIdRef.current = null
      sharingRef.current = false
      untilRef.current = 0
      lastPingRef.current = 0
      lastFixRef.current = null
      clearStoredShare()
      setUntilAt(0)
      setSharing(false)
      setMyPos(null)
      setSharers((prev) => {
        const id = selfIdRef.current
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
      if (c) {
        void c.sendAppEvent('loc:stop', {}, { persist: true }).catch(() => undefined)
      }
      if (!silent) toast.success('Location sharing stopped, nobody can see you anymore.')
    },
    [],
  )

  // ------------------------------------------------------------- start sharing
  /** Shared core for a fresh share and a post-reload resume (same until). */
  const beginSharing = useCallback(
    (until: string, resumed = false) => {
      const c = clientRef.current
      if (!c) {
        if (!resumed) toast.error('Not connected to the session yet.')
        return
      }
      if (!('geolocation' in navigator)) {
        if (!resumed) setGeoErr(null)
        return
      }
      const untilMs = Date.parse(until)
      if (!Number.isFinite(untilMs) || untilMs <= Date.now()) return
      untilRef.current = untilMs
      sharingRef.current = true
      setUntilAt(untilMs)
      setGeoErr(null)
      setSharing(true)
      lastPingRef.current = 0
      lastFixRef.current = null
      writeStoredShare({ code: sessionCode, until, fromId: selfIdRef.current })
      // Optimistic self entry — own persisted echo is skipped in the listener.
      setSharers((prev) => ({
        ...prev,
        [selfIdRef.current]: {
          name: profileName,
          device,
          lat: prev[selfIdRef.current]?.lat ?? null,
          lng: prev[selfIdRef.current]?.lng ?? null,
          acc: prev[selfIdRef.current]?.acc ?? null,
          until,
          updatedAt: Date.now(),
        },
      }))
      if (resumed) {
        toast.info('Location sharing resumed after the reload.')
      } else {
        const durationLabel = DURATIONS.find((d) => d.minutes === durationMin)?.label ?? ''
        toast.success(`Sharing your location for the next ${durationLabel}.`)
      }
      // Announce (persisted → late joiners see that this device is sharing).
      void c.sendAppEvent('loc:start', { until }, { persist: true }).catch(() =>
        toast.error('Could not announce location sharing, check the connection.'),
      )

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!sharingRef.current) return
          const lat = round6(pos.coords.latitude)
          const lng = round6(pos.coords.longitude)
          const acc = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : 0
          const nowMs = Date.now()
          const fix = { lat, lng, acc }
          lastFixRef.current = fix
          setMyPos(fix)
          setGeoErr(null)
          // Mirror the own fix into the sharers map — own pings are never
          // echoed back, and the inline map reads every fix from there.
          setSharers((prev) => {
            const cur = prev[selfIdRef.current]
            if (!cur) return prev
            return { ...prev, [selfIdRef.current]: { ...cur, lat, lng, acc, updatedAt: nowMs } }
          })
          if (nowMs - lastPingRef.current >= PUBLISH_INTERVAL_MS) {
            lastPingRef.current = nowMs
            void clientRef.current
              ?.sendAppEvent('loc:ping', fix)
              .catch(() => undefined)
          }
        },
        (err) => {
          if (err.code === 1) {
            // PERMISSION_DENIED — withdraw the announce so nobody waits on a fix.
            setGeoErr('denied')
            stopSharing(true)
          } else if (err.code === 2) {
            setGeoErr('unavailable')
          } else if (err.code === 3) {
            setGeoErr('timeout')
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      )
      watchIdRef.current = watchId
    },
    [durationMin, profileName, device, sessionCode, stopSharing],
  )

  const startSharing = useCallback(() => {
    beginSharing(new Date(Date.now() + durationMin * 60_000).toISOString())
  }, [beginSharing, durationMin])

  // ----------------------- periodic re-publish of the last known fix.
  // watchPosition only fires when the position changes — a stationary device
  // would go silent after its first fix and peers would see "updated N min
  // ago" drift. Re-publish the last fix on the cadence so freshness, the
  // inline map and late joiners all stay live.
  useEffect(() => {
    if (!sharing) return
    const t = setInterval(() => {
      const fix = lastFixRef.current
      if (!fix) return
      const nowMs = Date.now()
      if (nowMs - lastPingRef.current < PUBLISH_INTERVAL_MS - 500) return
      lastPingRef.current = nowMs
      void clientRef.current?.sendAppEvent('loc:ping', fix).catch(() => undefined)
    }, PUBLISH_INTERVAL_MS)
    return () => clearInterval(t)
  }, [sharing])

  // ------------------------------------ auto-resume an interrupted share
  // A reload (or tab reopen) while sharing gives this device a new socket id,
  // so the persisted loc:start in the room snapshot no longer matches selfId.
  // The device-local marker (code + until + old id) restores the share under
  // the SAME consent window and retires the ghost announce peers still see.
  // Deferred by a tick so the rebuild hydration microtask lands first.
  useEffect(() => {
    if (resumedRef.current || !client) return
    const stored = readStoredShare()
    if (!stored || stored.code !== sessionCode) return
    const untilMs = Date.parse(stored.until)
    if (!Number.isFinite(untilMs) || untilMs <= Date.now()) {
      clearStoredShare()
      return
    }
    resumedRef.current = true
    const t = setTimeout(() => {
      if (stored.fromId && stored.fromId !== selfIdRef.current) {
        void client
          .sendAppEvent('loc:retire', { forId: stored.fromId }, { persist: true })
          .catch(() => undefined)
      }
      beginSharing(stored.until, true)
    }, 0)
    return () => clearTimeout(t)
  }, [client, sessionCode, beginSharing])

  // -------------------------------------- auto-stop when the chosen time is up
  useEffect(() => {
    const t = setInterval(() => {
      if (!sharingRef.current) return
      if (untilRef.current > 0 && Date.now() >= untilRef.current) {
        stopSharing(true)
        toast.info('Location sharing ended (time limit)')
      }
    }, AUTO_STOP_CHECK_MS)
    return () => clearInterval(t)
  }, [stopSharing])

  // ------------------------------- 1s ticker + prune expired remote sharers
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now())
      setSharers((prev) => {
        let changed = false
        const next: Record<string, SharerState> = {}
        for (const [id, s] of Object.entries(prev)) {
          if (Date.parse(s.until) <= Date.now()) {
            changed = true // their client will have stopped — drop the stale card
            continue
          }
          next[id] = s
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // ------------------------------------------------------------- unmount
  useEffect(
    () => () => {
      if (watchIdRef.current != null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      // Privacy-first: if this panel goes away mid-share, tell the room and
      // drop the device-local resume marker (client-side nav is a real stop;
      // a hard reload never runs this — that is what makes resume work).
      if (sharingRef.current) {
        lastFixRef.current = null
        clearStoredShare()
        void clientRef.current
          ?.sendAppEvent('loc:stop', {}, { persist: true })
          .catch(() => undefined)
      }
    },
    [],
  )

  // ---------------------------------------------------------------- derived
  const otherSharers = useMemo(
    () => Object.entries(sharers).filter(([id]) => id !== selfId),
    [sharers, selfId],
  )

  /** Every live fix in the room — self first-class so the map shows "You" too. */
  const mapPoints = useMemo(() => {
    const pts: MapPoint[] = []
    for (const [id, s] of Object.entries(sharers)) {
      if (s.lat == null || s.lng == null) continue
      pts.push({ id, name: s.name, lat: s.lat, lng: s.lng, acc: s.acc, isSelf: id === selfId })
    }
    return pts
  }, [sharers, selfId])

  const canSend = connected && Boolean(client)
  const myUntilLeft = sharing && untilAt > 0 ? untilAt - now : 0

  // ------------------------------------------------------------------ render
  return (
    <div className="space-y-4">
      {/* ------------------------------------------ consent-first hero / status */}
      <Card className="overflow-hidden border-none bg-stage p-0 text-white">
        <CardContent className="p-4 sm:p-6">
          {sharing ? (
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
              <div className="flex items-center gap-3">
                <span className="relative flex size-3.5 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-60" />
                  <span className="relative inline-flex size-3.5 rounded-full bg-positive" />
                </span>
                <div>
                  <p className="text-base font-semibold">Sharing your location</p>
                  <p className="text-xs text-stage-muted">
                    Only the devices in this session can see it. Stop any time.
                  </p>
                </div>
              </div>

              <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-stage-border bg-stage-soft/70 px-3 py-2.5">
                  <p className="text-[10px] font-medium text-stage-muted/70">
                    Position
                  </p>
                  <p className="mt-0.5 font-mono text-sm text-stage-foreground">
                    {myPos ? `${myPos.lat}, ${myPos.lng}` : 'Waiting for first fix…'}
                  </p>
                </div>
                <div className="rounded-xl border border-stage-border bg-stage-soft/70 px-3 py-2.5">
                  <p className="text-[10px] font-medium text-stage-muted/70">
                    Accuracy
                  </p>
                  <p className="mt-0.5 text-sm text-stage-foreground">
                    {myPos ? `±${myPos.acc} m` : 'unknown'}
                  </p>
                </div>
                <div className="rounded-xl border border-stage-border bg-stage-soft/70 px-3 py-2.5">
                  <p className="text-[10px] font-medium text-stage-muted/70">
                    Expires
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-stage-foreground">
                    <Clock className="size-3.5 text-stage-muted/70" aria-hidden="true" />
                    in {fmtRemaining(myUntilLeft)}
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                onClick={() => stopSharing()}
                className="h-12 shrink-0 gap-2 bg-destructive px-8 text-base font-semibold text-white hover:bg-destructive/90"
              >
                <LocateOff className="size-5" aria-hidden="true" />
                Stop sharing now
              </Button>
            </div>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 py-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-3xl border border-stage-border bg-stage-soft text-positive">
                <MapPin className="size-7" aria-hidden="true" />
              </span>
              <div className="max-w-md space-y-1.5">
                <p className="text-lg font-semibold">Show everyone where you are</p>
                <p className="text-sm leading-relaxed text-stage-muted">
                  Only while you choose. You can stop any time, and sharing always expires on its
                  own.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Select
                  value={String(durationMin)}
                  onValueChange={(v) => setDurationMin(Number(v))}
                >
                  <SelectTrigger
                    className="h-12 w-[190px] border-stage-border bg-stage-soft text-stage-foreground"
                    aria-label="How long to share your location"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d.minutes} value={String(d.minutes)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="lg"
                  onClick={startSharing}
                  disabled={!canSend || !geoSupported}
                  className="h-12 gap-2 bg-primary px-8 text-base font-semibold text-black hover:bg-positive"
                >
                  <LocateFixed className="size-5" aria-hidden="true" />
                  Share my location
                </Button>
              </div>
              <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-stage-muted/70">
                <li>Expires automatically after {DURATIONS.find((d) => d.minutes === durationMin)?.label}</li>
                <li>Coordinates live only inside this session</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- error states */}
      {geoErr === 'denied' && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-foreground"
        >
          <LocateOff className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p>
            Location permission was blocked. Allow it in your browser&rsquo;s address-bar icon
            and try again.
          </p>
        </div>
      )}
      {geoErr === 'unavailable' && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-warning/60 bg-warning/15 px-4 py-3 text-sm text-foreground"
        >
          <LocateOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p>
            Your position is unavailable right now. Make sure location services are on for
            this device, then try sharing again.
          </p>
        </div>
      )}
      {geoErr === 'timeout' && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-warning/60 bg-warning/15 px-4 py-3 text-sm text-foreground"
        >
          <LocateOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p>
            Getting your position took too long. Move somewhere with a clearer view of the sky
            and try again; sharing is still on while we wait.
          </p>
        </div>
      )}
      {!geoSupported && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
        >
          <LocateOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            This browser doesn&rsquo;t support location sharing, but you can still follow other
            people&rsquo;s shared positions on the live map below.
          </p>
        </div>
      )}

      {/* ------------------------------------------------ privacy note chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
          Coordinates are shared only with this session&rsquo;s devices, never stored.
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5 text-primary" aria-hidden="true" />
          {participants.length} device{participants.length === 1 ? '' : 's'} in session
        </span>
      </div>

      {/* ------------------------------------------------------------ live map */}
      {mapPoints.length > 0 && <MiniMap points={mapPoints} className="h-[320px] sm:h-[400px]" />}

      {/* --------------------------------------------------------- sharer cards */}
      {otherSharers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {otherSharers.map(([id, s]) => {
            const untilLeft = Date.parse(s.until) - now
            const updatedSecs = Math.max(0, Math.floor((now - s.updatedAt) / 1000))
            const hasFix = s.lat != null && s.lng != null
            const dist =
              myPos && s.lat != null && s.lng != null
                ? haversineMeters(myPos, { lat: s.lat, lng: s.lng })
                : null
            return (
              <Card key={id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {(s.name || 'G').trim().slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.name}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <DeviceChip device={s.device} />
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[11px]',
                            updatedSecs > 30 ? 'text-warning' : 'text-muted-foreground',
                          )}
                        >
                          updated {fmtUpdated(updatedSecs)}
                        </span>
                      </div>
                    </div>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                      <Clock className="size-3" aria-hidden="true" />
                      expires in {fmtRemaining(untilLeft)}
                    </span>
                  </div>

                  {hasFix ? (
                    <>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-muted/60 px-3 py-2">
                          <p className="text-[10px] font-medium text-muted-foreground">
                            Position
                          </p>
                          <p className="mt-0.5 font-mono text-[13px] text-foreground">
                            {s.lat}, {s.lng}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/60 px-3 py-2">
                          <p className="text-[10px] font-medium text-muted-foreground">
                            Accuracy
                          </p>
                          <p className="mt-0.5 text-[13px] text-foreground">
                            {s.acc != null ? `±${s.acc} m` : 'unknown'}
                          </p>
                        </div>
                      </div>
                      {dist != null && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <MapPin className="mr-1 inline size-3 text-primary" aria-hidden="true" />
                          {fmtDistance(dist)} from you
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                          <a
                            href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-3.5" aria-hidden="true" /> Google Maps
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=16/${s.lat}/${s.lng}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-3.5" aria-hidden="true" /> OpenStreetMap
                          </a>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-60" />
                        <span className="relative inline-flex size-2 rounded-full bg-positive" />
                      </span>
                      Waiting for their first ping; positions update every few seconds.
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <MapPin className="mx-auto size-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">Nobody is sharing right now</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              When someone taps &ldquo;Share my location&rdquo;, their live position appears
              on the map here — always with a visible expiry.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
