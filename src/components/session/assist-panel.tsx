'use client'

// Remote Assist / Guided Pointer / Support Session workspace.
//
// One person shares their screen, the other guides them: the helper can watch
// the live stream (WebRTC, direct P2P via ScreenRtc) and draw on top of it —
// persistent ink strokes or a fading laser pointer. The sharer approves every
// request, sees the annotations overlaid on their own preview, and can stop
// sharing at any moment. The support-session variant adds a shared step
// checklist and an append-only session log.
//
// Signaling/state model:
// - Media: ScreenRtc (perfect negotiation) rides the room's rtc:signal channel.
// - Requests: `assist:request` volatile app events, sent DIRECT to one device.
// - Markup: `assist:stroke` / `assist:clear` persisted app events (late joiners
//   rebuild from history; senders apply optimistically and dedupe via `from`).
// - Support log/steps: `support:log` / `support:steps` persisted app events.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RoomClient } from '@/lib/room-client'
import { ScreenRtc } from '@/lib/screen-rtc'
import type { AppEvent, DeviceType, Participant } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Check,
  CircleCheck,
  Eraser,
  Hand,
  LifeBuoy,
  Loader2,
  Monitor,
  MonitorUp,
  PenLine,
  Send,
  Smartphone,
  Square,
  Tablet,
  Users,
  Wifi,
  X,
  Zap,
} from 'lucide-react'

const LASER_TTL_MS = 1200
const MAX_STROKE_POINTS = 600
const MAX_LOG_ENTRIES = 200
const MAX_STEP_TEXT = 120

const STROKE_COLORS = [
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#10b981', label: 'Emerald' },
] as const

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function deviceLabel(d: string): string {
  if (d === 'phone') return 'phone'
  if (d === 'tablet') return 'tablet'
  return 'computer'
}

function deviceGlyph(d: string) {
  const cls = 'size-3.5 shrink-0 text-muted-foreground'
  if (d === 'phone') return <Smartphone className={cls} aria-label="phone" />
  if (d === 'tablet') return <Tablet className={cls} aria-label="tablet" />
  return <Monitor className={cls} aria-label="computer" />
}

type AssistRole = 'helper' | 'sharer'
type MarkupMode = 'laser' | 'draw'

interface AssistStroke {
  id: string
  points: number[][] // [[x, y], …] normalized 0..1
  color: string
  mode: MarkupMode
  at: number // epoch ms — laser strokes expire after LASER_TTL_MS
}

interface StepItem {
  id: string
  text: string
  done: boolean
}

interface LogEntry {
  id: string
  text: string
  at: number
}

interface IncomingRequest {
  from: string
  name: string
  device: string
}

// --------------------------------------------------------------- shared props

interface PanelProps {
  client: RoomClient | null
  selfId: string
  participants: Participant[]
  initialEvents: AppEvent[] // persisted events from the join snapshot
  connected: boolean
  isHost: boolean
  profileName: string
  device: DeviceType
}

export type AssistVariant = 'remote-assist' | 'guided-pointer' | 'support-session'

export interface AssistPanelProps extends PanelProps {
  variant: AssistVariant
}

const VARIANT_META: Record<AssistVariant, { title: string; blurb: string }> = {
  'remote-assist': {
    title: 'Remote assist',
    blurb:
      'One screen, one helper. They see what you see and point at the fix; nothing is recorded and nothing leaves the two devices.',
  },
  'guided-pointer': {
    title: 'Guided pointer',
    blurb:
      'A live laser pointer on someone else\u2019s screen. Draw attention to exactly the right pixel, then let it fade.',
  },
  'support-session': {
    title: 'Support session',
    blurb:
      'Guided troubleshooting with a shared step checklist and a running log, so nothing gets missed.',
  },
}

// ------------------------------------------------------------------- helpers

function sanitizeSteps(raw: unknown): StepItem[] {
  if (!Array.isArray(raw)) return []
  const out: StepItem[] = []
  for (const item of raw) {
    const obj = item as { id?: unknown; text?: unknown; done?: unknown } | null
    if (!obj || typeof obj.text !== 'string' || !obj.text.trim()) continue
    out.push({
      id: typeof obj.id === 'string' && obj.id ? obj.id : uid(),
      text: obj.text.slice(0, MAX_STEP_TEXT),
      done: obj.done === true,
    })
  }
  return out
}

function strokeFromPayload(
  payload: unknown,
  fallbackAt: number,
): AssistStroke | null {
  const p = payload as { id?: unknown; points?: unknown; color?: unknown; mode?: unknown } | null
  if (!p || typeof p.id !== 'string' || !Array.isArray(p.points) || p.points.length === 0) {
    return null
  }
  const points: number[][] = []
  for (const pt of p.points.slice(0, MAX_STROKE_POINTS)) {
    if (!Array.isArray(pt) || typeof pt[0] !== 'number' || typeof pt[1] !== 'number') return null
    points.push([
      Math.min(1, Math.max(0, pt[0])),
      Math.min(1, Math.max(0, pt[1])),
    ])
  }
  const rawColor = typeof p.color === 'string' ? p.color : ''
  const color = STROKE_COLORS.some((c) => c.value === rawColor)
    ? rawColor
    : STROKE_COLORS[0].value
  return {
    id: p.id,
    points,
    color,
    mode: p.mode === 'laser' ? 'laser' : 'draw',
    at: fallbackAt,
  }
}

function peerStateLabel(state: RTCPeerConnectionState): { label: string; className: string } {
  switch (state) {
    case 'connected':
      return { label: 'P2P live', className: 'border-primary/30 bg-primary/10 text-primary' }
    case 'connecting':
    case 'new':
      return { label: 'linking\u2026', className: 'border-warning/30 bg-warning/15 text-warning' }
    case 'disconnected':
    case 'failed':
    case 'closed':
      return {
        label: 'dropped',
        className: 'border-destructive/30 bg-destructive/10 text-destructive',
      }
    default:
      return { label: 'idle', className: 'border-border bg-muted text-muted-foreground' }
  }
}

// ------------------------------------------------------------------- markup

interface AnnotatedStageProps {
  stream: MediaStream | null
  muted?: boolean
  ariaLabel: string
  strokes: AssistStroke[]
  interactive: boolean
  color: string
  mode: MarkupMode
  onStrokeComplete: (points: number[][]) => void
}

/**
 * Dark stage: the video with a canvas overlay on top. Strokes are normalized
 * 0..1 so every device renders them at the same relative position. The overlay
 * only captures the pointer when `interactive` (helper with markup enabled).
 */
function AnnotatedStage({
  stream,
  muted = false,
  ariaLabel,
  strokes,
  interactive,
  color,
  mode,
  onStrokeComplete,
}: AnnotatedStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef(strokes)
  const draftRef = useRef<number[][] | null>(null)
  const colorRef = useRef(color)
  const modeRef = useRef(mode)
  const interactiveRef = useRef(interactive)
  const onStrokeRef = useRef(onStrokeComplete)

  useEffect(() => {
    strokesRef.current = strokes
    colorRef.current = color
    modeRef.current = mode
    interactiveRef.current = interactive
    onStrokeRef.current = onStrokeComplete
  })

  useEffect(() => {
    const video = videoRef.current
    if (video && stream) {
      video.srcObject = stream
      video.play().catch(() => undefined)
    }
  }, [stream])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const pw = Math.max(1, Math.round(w * dpr))
    const ph = Math.max(1, Math.round(h * dpr))
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const now = Date.now()
    const draft = draftRef.current
    const all: AssistStroke[] = draft
      ? [
          ...strokesRef.current,
          { id: '__draft', points: draft, color: colorRef.current, mode: modeRef.current, at: now },
        ]
      : strokesRef.current

    for (const s of all) {
      if (s.mode === 'laser') {
        const age = now - s.at
        if (age >= LASER_TTL_MS) continue
        ctx.globalAlpha = Math.max(0.15, Math.min(1, (LASER_TTL_MS - age) / 400))
        ctx.lineWidth = 5
        ctx.shadowColor = s.color
        ctx.shadowBlur = 8
      } else {
        ctx.globalAlpha = 1
        ctx.lineWidth = 3
        ctx.shadowBlur = 0
      }
      ctx.strokeStyle = s.color
      ctx.fillStyle = s.color
      const pts = s.points
      if (pts.length === 1) {
        ctx.beginPath()
        ctx.arc(pts[0][0] * w, pts[0][1] * h, s.mode === 'laser' ? 4 : 3, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(pts[0][0] * w, pts[0][1] * h)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * w, pts[i][1] * h)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }, [])

  // Redraw on stroke changes, on resize, and continuously while a laser fades.
  useEffect(() => {
    draw()
  }, [strokes, draw])
  useEffect(() => {
    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    const t = setInterval(() => {
      if (draftRef.current || strokesRef.current.some((s) => s.mode === 'laser')) draw()
    }, 120)
    return () => {
      window.removeEventListener('resize', onResize)
      clearInterval(t)
    }
  }, [draw])

  function normPoint(e: React.PointerEvent<HTMLDivElement>): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / Math.max(1, rect.height)))
    return [x, y]
  }

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-xl border bg-stage"
      role="region"
      aria-label={ariaLabel}
    >
      {stream ? (
        <video
          ref={videoRef}
          muted={muted}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <MonitorUp className="size-8 text-stage-muted/50" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-stage-muted">Waiting for the video stream…</p>
        </div>
      )}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
      <div
        className={cn('absolute inset-0', interactive ? 'cursor-crosshair' : 'pointer-events-none')}
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          if (!interactiveRef.current) return
          e.preventDefault()
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // capture unsupported — drawing still works without it
          }
          draftRef.current = [normPoint(e)]
          draw()
        }}
        onPointerMove={(e) => {
          const draft = draftRef.current
          if (!draft || draft.length >= MAX_STROKE_POINTS) return
          draftRef.current = [...draft, normPoint(e)]
          draw()
        }}
        onPointerUp={() => {
          const pts = draftRef.current
          if (!pts) return
          draftRef.current = null
          draw()
          if (pts.length > 0) onStrokeRef.current(pts)
        }}
        onPointerCancel={() => {
          draftRef.current = null
          draw()
        }}
      />
    </div>
  )
}

// -------------------------------------------------------------------- panel

export function AssistPanel({
  client,
  selfId,
  participants,
  initialEvents,
  connected,
  profileName,
  variant,
}: AssistPanelProps) {
  // ------------------------------------------------------------------ state
  const [role, setRole] = useState<AssistRole | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<{ peerId: string; stream: MediaStream }[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [pendingTarget, setPendingTarget] = useState<{ id: string; name: string } | null>(null)
  const [request, setRequest] = useState<IncomingRequest | null>(null)
  const [peerStates, setPeerStates] = useState<Record<string, RTCPeerConnectionState>>({})
  const [peerSharing, setPeerSharing] = useState<Record<string, boolean>>({})
  const [strokes, setStrokes] = useState<AssistStroke[]>([])
  const [markupOn, setMarkupOn] = useState(variant === 'guided-pointer')
  const [mode, setMode] = useState<MarkupMode>(variant === 'guided-pointer' ? 'laser' : 'draw')
  const [color, setColor] = useState<string>(STROKE_COLORS[0].value)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [steps, setSteps] = useState<StepItem[]>([])
  const [stepDraft, setStepDraft] = useState('')

  const rtcRef = useRef<ScreenRtc | null>(null)
  const clientRef = useRef(client)
  const selfIdRef = useRef(selfId)
  const roleRef = useRef<AssistRole | null>(role)
  const sharingRef = useRef(false)
  const localStreamRef = useRef<MediaStream | null>(null)
  const variantRef = useRef<AssistVariant>(variant)

  useEffect(() => {
    clientRef.current = client
    selfIdRef.current = selfId
    roleRef.current = role
    localStreamRef.current = localStream
    variantRef.current = variant
  })

  // -------------------------------------------------- persisted-event replay
  // Rebuild strokes / log / steps from the join snapshot exactly once — the
  // same apply-path as live events, so late joiners land in the same state.
  const rebuiltRef = useRef(false)
  useEffect(() => {
    if (rebuiltRef.current) return
    rebuiltRef.current = true
    const builtStrokes: AssistStroke[] = []
    const builtLogs: LogEntry[] = []
    let builtSteps: StepItem[] = []
    for (const ev of initialEvents) {
      const atMs = Number.isFinite(Date.parse(ev.at)) ? Date.parse(ev.at) : Date.now()
      if (ev.type === 'assist:stroke') {
        const stroke = strokeFromPayload(ev.payload, atMs)
        if (stroke && !builtStrokes.some((s) => s.id === stroke.id)) {
          // Laser ink is ephemeral — history older than its TTL is dropped.
          if (stroke.mode !== 'laser' || Date.now() - stroke.at < LASER_TTL_MS) {
            builtStrokes.push(stroke)
          }
        }
      } else if (ev.type === 'assist:clear') {
        builtStrokes.length = 0
      } else if (ev.type === 'support:log') {
        const p = ev.payload as { text?: unknown } | null
        if (p && typeof p.text === 'string' && p.text.trim()) {
          builtLogs.push({ id: `${ev.from}:${ev.at}:${builtLogs.length}`, text: p.text.slice(0, 300), at: atMs })
        }
      } else if (ev.type === 'support:steps') {
        const p = ev.payload as { items?: unknown } | null
        if (p) builtSteps = sanitizeSteps(p.items)
      }
    }
    // One-time snapshot hydration — deferred to a microtask so it does not
    // cascade a synchronous re-render from inside the effect body.
    queueMicrotask(() => {
      if (builtStrokes.length > 0) setStrokes(builtStrokes)
      if (builtLogs.length > 0) setLogs(builtLogs.slice(-MAX_LOG_ENTRIES))
      if (builtSteps.length > 0) setSteps(builtSteps)
    })
  }, [initialEvents])

  // ------------------------------------------------------ ScreenRtc lifecycle
  useEffect(() => {
    if (!client) return
    const rtc = new ScreenRtc(client)
    rtcRef.current = rtc

    const offs = [
      rtc.on('stream', (payload) => {
        const { peerId, stream } = payload as { peerId: string; stream: MediaStream }
        setRemoteStreams((prev) =>
          prev.some((s) => s.stream.id === stream.id)
            ? prev
            : [...prev.filter((s) => s.peerId !== peerId), { peerId, stream }],
        )
        // A stream means the request was answered — clear the wait state.
        setPendingTarget(null)
      }),
      rtc.on('streamended', (payload) => {
        const { streamId } = payload as { peerId: string; streamId: string }
        setRemoteStreams((prev) => prev.filter((s) => s.stream.id !== streamId))
      }),
      rtc.on('peerleft', (payload) => {
        const { peerId } = payload as { peerId: string }
        setRemoteStreams((prev) => prev.filter((s) => s.peerId !== peerId))
        setPeerStates((prev) => {
          if (!(peerId in prev)) return prev
          const next = { ...prev }
          delete next[peerId]
          return next
        })
        setPeerSharing((prev) => {
          if (!(peerId in prev)) return prev
          const next = { ...prev }
          delete next[peerId]
          return next
        })
      }),
      rtc.on('peerstate', (payload) => {
        const { peerId, state } = payload as { peerId: string; state: RTCPeerConnectionState }
        setPeerStates((prev) => ({ ...prev, [peerId]: state }))
      }),
      rtc.on('sharingflag', (payload) => {
        const { peerId, active } = payload as { peerId: string; active: boolean }
        setPeerSharing((prev) => ({ ...prev, [peerId]: active }))
      }),
    ]

    return () => {
      offs.forEach((off) => off())
      rtc.destroy()
      rtcRef.current = null
    }
  }, [client])

  // ------------------------------------------------------- app-event intake
  useEffect(() => {
    if (!client) return
    const off = client.on('appevent', (raw) => {
      const ev = raw as AppEvent
      const mine = ev.from === selfIdRef.current // persisted echo of our own send
      if (ev.type === 'assist:request') {
        // Consent is the sharer's job; ignore if we are already public.
        if (roleRef.current !== 'sharer' || sharingRef.current) return
        setRequest({
          from: ev.from,
          name: ev.name || 'Someone',
          device: ev.device || 'desktop',
        })
      } else if (ev.type === 'assist:stroke') {
        if (mine) return
        const stroke = strokeFromPayload(ev.payload, Date.now())
        if (!stroke) return
        setStrokes((prev) => (prev.some((s) => s.id === stroke.id) ? prev : [...prev, stroke]))
      } else if (ev.type === 'assist:clear') {
        if (mine) return
        setStrokes([])
      } else if (ev.type === 'support:log') {
        const p = ev.payload as { text?: unknown } | null
        const text = p && typeof p.text === 'string' ? p.text : ''
        if (mine || !text.trim()) return
        setLogs((prev) => [
          ...prev.slice(-(MAX_LOG_ENTRIES - 1)),
          { id: `${ev.from}:${ev.at}:${prev.length}`, text: text.slice(0, 300), at: Date.parse(ev.at) || Date.now() },
        ])
      } else if (ev.type === 'support:steps') {
        if (mine) return
        const p = ev.payload as { items?: unknown } | null
        if (!p) return
        setSteps(sanitizeSteps(p.items))
      }
    })
    return off
  }, [client])

  // ---------------------------------------------- laser stroke sweeper (state)
  useEffect(() => {
    const t = setInterval(() => {
      setStrokes((prev) => {
        const now = Date.now()
        const next = prev.filter((s) => s.mode !== 'laser' || now - s.at < LASER_TTL_MS)
        return next.length === prev.length ? prev : next
      })
    }, 250)
    return () => clearInterval(t)
  }, [])

  // ------------------------------------------------------------- log helpers
  const pushLog = useCallback((text: string) => {
    setLogs((prev) => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), { id: uid(), text, at: Date.now() }])
    // The session log is a support-session feature; only persist there so the
    // other tools never write room history this panel does not display.
    const c = clientRef.current
    if (c && variantRef.current === 'support-session') {
      c.sendAppEvent('support:log', { text }, { persist: true }).catch(() => undefined)
    }
  }, [])

  // ------------------------------------------------------------ sharing flow
  const stopSharing = useCallback(() => {
    const rtc = rtcRef.current
    const stream = localStreamRef.current
    if (!sharingRef.current && !stream) return
    sharingRef.current = false
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
    }
    rtc?.setLocalStream(null)
    rtc?.broadcast({ sharing: { active: false } })
    setLocalStream(null)
    pushLog('Screen sharing stopped')
  }, [pushLog])

  // Always-current handle for the media track 'ended' listener.
  const stopSharingRef = useRef(stopSharing)
  useEffect(() => {
    stopSharingRef.current = stopSharing
  })

  const startSharing = useCallback(async () => {
    const rtc = rtcRef.current
    if (!rtc || !clientRef.current) return
    if (sharingRef.current) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      toast.error('This browser cannot share a screen; a secure (https) window is required.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      if (sharingRef.current) {
        for (const track of stream.getTracks()) track.stop()
        return
      }
      sharingRef.current = true
      rtc.setLocalStream(stream)
      rtc.broadcast({ sharing: { active: true } })
      setLocalStream(stream)
      // The browser fires 'ended' when the user presses its native "Stop".
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopSharingRef.current())
      pushLog('Screen sharing started')
    } catch {
      toast.error('Screen share was cancelled or blocked. Pick a screen or tab, then try again.')
    }
  }, [pushLog])

  // ------------------------------------------------------------- markup flow
  const handleStrokeComplete = useCallback(
    (points: number[][]) => {
      const stroke: AssistStroke = { id: uid(), points, color, mode, at: Date.now() }
      setStrokes((prev) => [...prev, stroke]) // optimistic — echo is deduped
      const c = clientRef.current
      if (!c) return
      c.sendAppEvent('assist:stroke', { id: stroke.id, points, color, mode }, { persist: true }).catch(
        () => undefined,
      )
    },
    [color, mode],
  )

  const clearMarkup = useCallback(() => {
    setStrokes([])
    const c = clientRef.current
    if (!c) return
    c.sendAppEvent('assist:clear', {}, { persist: true }).catch(() => undefined)
  }, [])

  // ------------------------------------------------------------ steps (support)
  const broadcastSteps = useCallback((items: StepItem[]) => {
    const c = clientRef.current
    if (!c) return
    c.sendAppEvent('support:steps', { items }, { persist: true }).catch(() => undefined)
  }, [])

  function addStep() {
    const text = stepDraft.trim().slice(0, MAX_STEP_TEXT)
    if (!text) return
    const next = [...steps, { id: uid(), text, done: false }]
    setSteps(next)
    setStepDraft('')
    broadcastSteps(next)
  }

  function toggleStep(id: string) {
    const next = steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
    setSteps(next)
    broadcastSteps(next)
    const toggled = next.find((s) => s.id === id)
    if (toggled?.done) pushLog(`Step completed: \u201C${toggled.text}\u201D`)
  }

  function sendSummary() {
    pushLog('Support summary sent')
    toast.success('Support summary sent. It is in the session log on every device.')
  }

  // ------------------------------------------------------------ request flow
  function requestFrom(p: Participant) {
    const c = clientRef.current
    if (!c) return
    setPendingTarget({ id: p.id, name: p.name })
    c.sendAppEvent('assist:request', null, { persist: false, to: p.id }).catch(() => {
      setPendingTarget(null)
      toast.error(`Could not reach ${p.name}; they may have left the session.`)
    })
  }

  function switchRole() {
    if (roleRef.current === 'sharer') stopSharing()
    setPendingTarget(null)
    setRequest(null)
    setRole((r) => (r === 'sharer' ? 'helper' : 'sharer'))
  }

  // --------------------------------------------------------------- derived
  const others = useMemo(() => participants.filter((p) => p.id !== selfId), [participants, selfId])
  const nameFor = useCallback(
    (id: string) => participants.find((p) => p.id === id)?.name ?? 'Someone',
    [participants],
  )
  const isSharingLive = role === 'sharer' && Boolean(localStream)

  // ------------------------------------------------------------------ render
  const meta = VARIANT_META[variant]

  // --- Role chooser: the do-it-first screen. Two big cards, nothing else. ---
  if (!role) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <p className="text-sm font-semibold">{meta.title}</p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{meta.blurb}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRole('sharer')}
                className="group rounded-xl border p-5 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <MonitorUp className="size-5 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3.5 text-base font-semibold">I need help</p>
                <p className="mt-0.5 whitespace-nowrap text-sm font-medium text-primary">Share my screen</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {variant === 'support-session'
                    ? 'Show your screen to the helper, follow the shared step list together, and keep a log of what was fixed.'
                    : variant === 'guided-pointer'
                      ? 'Show your screen and watch the helper\u2019s laser pointer land right where they mean.'
                      : 'Show your screen to a trusted helper and follow along while they point at the fix.'}
                </p>
                </button>
              <button
                type="button"
                onClick={() => setRole('helper')}
                className="group rounded-xl border p-5 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <LifeBuoy className="size-5 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3.5 text-base font-semibold">I&rsquo;m helping</p>
                <p className="mt-0.5 whitespace-nowrap text-sm font-medium text-primary">View their screen</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {variant === 'support-session'
                    ? 'Ask to view their screen, work through the shared step checklist, and send a wrap-up summary.'
                    : variant === 'guided-pointer'
                      ? 'Ask to view their screen and guide them with a live laser pointer they see in real time.'
                      : 'Ask to view their screen, then draw on it with persistent ink or a fading laser pointer.'}
                </p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  Choose <span aria-hidden="true">→</span>
                </p>
              </button>
            </div>
            <p className="mt-5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Check className="size-3.5 text-primary" aria-hidden="true" />
              Your role stays fixed for this session. A small switch button is always nearby.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ------------------------------------------------------------------ shared
  const connectionChips = (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Connection status">
      {connected && (
        <Badge className="gap-1 border-0 bg-primary/15 text-primary hover:bg-primary/15">
          <Wifi className="size-3" aria-hidden="true" /> Direct P2P
        </Badge>
      )}
      {Object.entries(peerStates).map(([id, st]) => {
        const meta2 = peerStateLabel(st)
        return (
          <span
            key={id}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
              meta2.className,
            )}
          >
            {nameFor(id)}: {meta2.label}
          </span>
        )
      })}
      {Object.entries(peerSharing).some(([, active]) => active) && (
        <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
          <span className="relative flex size-2" aria-hidden="true">
            <span className="absolute inline-flex size-2 animate-ping rounded-full bg-warning opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-warning" />
          </span>
          share live
        </span>
      )}
    </div>
  )

  const markupToolbar = role === 'helper' && (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl border bg-muted/30 px-3.5 py-3">
      <div className="flex items-center gap-2.5">
        <Switch
          id="assist-markup-switch"
          checked={markupOn}
          onCheckedChange={(v) => setMarkupOn(v === true)}
          aria-label="Draw on their screen"
        />
        <label htmlFor="assist-markup-switch" className="cursor-pointer select-none text-sm font-medium">
          Draw on their screen
        </label>
      </div>
      {markupOn && (
        <>
          <div className="flex items-center gap-1.5" role="group" aria-label="Ink color">
            {STROKE_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                aria-label={`${c.label} ink`}
                aria-pressed={color === c.value}
                className={cn(
                  'size-6 rounded-full border-2 transition-colors',
                  color === c.value ? 'border-foreground shadow-sm' : 'border-transparent hover:border-foreground/50',
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Markup mode">
            <button
              type="button"
              onClick={() => setMode('draw')}
              aria-pressed={mode === 'draw'}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                mode === 'draw' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <PenLine className="size-3.5" aria-hidden="true" /> Ink
            </button>
            <button
              type="button"
              onClick={() => setMode('laser')}
              aria-pressed={mode === 'laser'}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                mode === 'laser' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Zap className="size-3.5" aria-hidden="true" /> Laser
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 gap-1.5 text-muted-foreground"
            onClick={clearMarkup}
            disabled={strokes.length === 0}
          >
            <Eraser className="size-3.5" aria-hidden="true" /> Clear ink
          </Button>
        </>
      )}
      {markupOn && mode === 'laser' && (
        <p className="w-full text-[11px] text-muted-foreground">
          Laser marks fade away after a moment, perfect for pointing. Switch to Ink to leave lasting notes.
        </p>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------- role / status bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs font-medium">
          {role === 'sharer' ? (
            <>
              <MonitorUp className="size-3.5 text-primary" aria-hidden="true" /> Sharing my screen
            </>
          ) : (
            <>
              <LifeBuoy className="size-3.5 text-primary" aria-hidden="true" /> Helping
            </>
          )}
        </Badge>
        {connectionChips}
        <Button variant="ghost" size="sm" className="ml-auto h-8 gap-1.5 text-xs text-muted-foreground" onClick={switchRole}>
          Switch role
        </Button>
      </div>

      {/* ------------------------------------------------------ HELPER view */}
      {role === 'helper' && (
        <>
          {remoteStreams.length === 0 && (
            <Card>
              <CardContent className="p-5 sm:p-6">
                {pendingTarget ? (
                  <div
                    className="flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
                    <p className="mt-4 text-sm font-medium">
                      Waiting for {pendingTarget.name} to approve and start sharing
                      <AnimatedDots />
                    </p>
                    <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                      They see a permission prompt on their device, and nothing is shared until they allow it.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-5 h-9 gap-1.5"
                      onClick={() => setPendingTarget(null)}
                    >
                      <X className="size-3.5" aria-hidden="true" /> Cancel request
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold">Ask to view a screen</p>
                    <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
                      Pick the person you are helping. They get a consent prompt, and the stream starts the
                      moment they allow it.
                    </p>
                    {others.length === 0 ? (
                      <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center">
                        <p className="text-sm font-medium">Waiting for the other device to join</p>
                        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                          Share the session code or QR from the header, and the person you are helping
                          appears here the second they join.
                        </p>
                      </div>
                    ) : (
                      <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                        {others.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => requestFrom(p)}
                              className="flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
                            >
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Hand className="size-4" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{p.name}</span>
                                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                  {deviceGlyph(p.device)} {deviceLabel(p.device)}
                                  {peerSharing[p.id] && (
                                    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                                      already sharing
                                    </span>
                                  )}
                                </span>
                              </span>
                              <span className="shrink-0 text-xs font-medium text-primary">Ask to view</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {remoteStreams.map(({ peerId, stream }) => (
            <Card key={stream.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge className="gap-1 border-0 bg-primary/15 text-primary hover:bg-primary/15">
                    <CircleCheck className="size-3" aria-hidden="true" /> Live
                  </Badge>
                  <p className="text-sm font-semibold">{nameFor(peerId)}&rsquo;s screen</p>
                  {markupOn && (
                    <span className="text-xs text-muted-foreground">
                      your {mode === 'laser' ? 'laser pointer' : 'ink'} is visible to them
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <AnnotatedStage
                    stream={stream}
                    ariaLabel={`Live screen shared by ${nameFor(peerId)}`}
                    strokes={strokes}
                    interactive={markupOn}
                    color={color}
                    mode={mode}
                    onStrokeComplete={handleStrokeComplete}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Stream is direct P2P between the two devices, and no server touches the video.
                </p>
                {markupToolbar}
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {/* ------------------------------------------------------ SHARER view */}
      {role === 'sharer' && (
        <>
          {isSharingLive && localStream ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge className="gap-1 border-0 bg-primary/15 text-primary hover:bg-primary/15">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-2 animate-ping rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex size-2 rounded-full bg-primary" />
                    </span>
                    Live
                  </Badge>
                  <p className="text-sm font-semibold">You are sharing</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" aria-hidden="true" />
                    {others.length} device{others.length === 1 ? '' : 's'} can watch
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-9 gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => stopSharing()}
                  >
                    <Square className="size-3.5" aria-hidden="true" /> Stop sharing
                  </Button>
                </div>
                <div className="mt-3">
                  <AnnotatedStage
                    stream={localStream}
                    muted
                    ariaLabel="Your shared screen, helper annotations appear here live"
                    strokes={strokes}
                    interactive={false}
                    color={color}
                    mode={mode}
                    onStrokeComplete={handleStrokeComplete}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  The helper&rsquo;s pointer and ink appear on this preview exactly where they land. Sharing
                  stops when you press the button, stop it in the browser, or the session ends.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <p className="text-sm font-semibold">You are ready to share</p>
                <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
                  {variant === 'remote-assist'
                    ? 'When your helper asks, a permission prompt appears here. Nothing is shared until you allow it, and you choose exactly which screen or tab.'
                    : 'When your helper asks, a permission prompt appears here. Allow it once and they see your screen live until you stop.'}
                </p>
                <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center">
                  <p className="text-sm font-medium">
                    {others.length === 0
                      ? 'Waiting for your helper to join'
                      : `Waiting for ${others.map((p) => p.name).join(', ')} to ask for your screen`}
                    {others.length > 0 && <AnimatedDots />}
                  </p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                    {others.length === 0
                      ? 'They join with the session code or QR from the header; no install, no account.'
                      : 'Your helper taps your name on their device to send the request.'}
                  </p>
                  {others.length > 0 && (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Users className="size-3.5" aria-hidden="true" />
                      {others.length} other device{others.length === 1 ? '' : 's'} in this session
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* --------------------------------------- support-session extras (both) */}
      {variant === 'support-session' && (
        <div className={cn('grid gap-4', role === 'helper' && 'lg:grid-cols-2')}>
          {/* session log — append-only */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Session log</p>
                <span className="ml-auto text-[11px] text-muted-foreground">{logs.length} entries</span>
              </div>
              <div
                className="mt-3 max-h-60 space-y-1.5 overflow-y-auto pr-1 text-xs [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
                role="log"
                aria-label="Session log entries"
                aria-live="polite"
              >
                {logs.length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground">
                    Nothing logged yet. Approvals, sharing and completed steps appear here.
                  </p>
                ) : (
                  logs.map((entry) => (
                    <p key={entry.id} className="flex items-start gap-2 border-b border-border/60 pb-1.5 last:border-0">
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="leading-relaxed">{entry.text}</span>
                    </p>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* shared steps checklist */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Steps</p>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {steps.filter((s) => s.done).length} of {steps.length} done
                </span>
              </div>
              {role === 'helper' && (
                <div className="mt-3 flex gap-2">
                  <Input
                    value={stepDraft}
                    onChange={(e) => setStepDraft(e.target.value.slice(0, MAX_STEP_TEXT))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addStep()
                      }
                    }}
                    placeholder="Add a step, e.g. “Open Settings → Network”"
                    aria-label="Add a step to the checklist"
                  />
                  <Button size="sm" className="h-9 shrink-0 gap-1.5" onClick={addStep} disabled={!stepDraft.trim()}>
                    <Send className="size-3.5" aria-hidden="true" /> Add
                  </Button>
                </div>
              )}
              <div className="mt-3 max-h-48 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                {steps.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    {role === 'helper'
                      ? 'No steps yet, so break the fix into small, checkable moves.'
                      : 'Your helper will list the steps here; check them off as you go.'}
                  </p>
                ) : (
                  steps.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={s.done}
                        onCheckedChange={() => toggleStep(s.id)}
                        aria-label={`Step: ${s.text}`}
                      />
                      <span className={cn('leading-snug', s.done && 'text-muted-foreground line-through')}>
                        {s.text}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {role === 'helper' && steps.length > 0 && (
                <Button variant="outline" size="sm" className="mt-3 w-full gap-1.5" onClick={sendSummary}>
                  <CircleCheck className="size-3.5" aria-hidden="true" /> End session summary
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ------------------------------------------- consent dialog (sharer) */}
      <Dialog
        open={request !== null}
        onOpenChange={(open) => {
          if (!open) setRequest(null) // dismissed without an answer
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="size-5 text-primary" aria-hidden="true" />
              {request?.name ?? 'Someone'} wants to view your screen
            </DialogTitle>
            <DialogDescription>
              {request ? (
                <>
                  {request.name} on their {deviceLabel(request.device)} requests to view your screen.{' '}
                  {variant === 'remote-assist'
                    ? 'They will see everything on the surface you pick: windows, notifications, open messages. Nothing is recorded.'
                    : 'They will see the surface you pick, live, until you stop sharing. Nothing is recorded.'}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                pushLog(`${profileName} denied the request`)
                setRequest(null)
              }}
            >
              Deny
            </Button>
            <Button
              onClick={() => {
                pushLog(`${profileName} approved the screen-share request`)
                setRequest(null)
                void startSharing()
              }}
            >
              <MonitorUp className="size-4" aria-hidden="true" /> Allow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AnimatedDots() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-1 align-middle" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-primary"
          style={{ animationDelay: `${i * 0.15 - 0.45}s` }}
        />
      ))}
    </span>
  )
}
