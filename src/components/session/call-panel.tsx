'use client'

// CallPanel — the shared live-media surface for the Communicate / Utilities /
// Productivity call apps (Private Call, Group Meeting, Voice Call, Interview
// Room, Classroom, Webinar Room, Live Camera, Baby & Pet Monitor, Temporary
// Live Stream, Walkie-Talkie, Voice Recorder, Phone as Webcam/Microphone).
//
// One engine (MediaRtc, mesh WebRTC) — the `config` decides the shape of the
// experience: open mic vs push-to-talk, recording, consent-first camera,
// viewer snapshots, disconnect alerts, roles (presenter/teacher), hand raise,
// spotlight, reactions, in-call chat and private notes.
//
// Sync protocol (via RoomClient app events):
//   'call:state'    volatile {micOn, camOn, screen}   per-device media state
//   'call:ptt'      volatile {talking}                push-to-talk broadcast
//   'call:hand'     volatile {raised}                 hand raise
//   'call:spotlight' persisted {target}              host pin (late joiners see it)
//   'react'         volatile {emoji}                  floating reactions

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RoomClient } from '@/lib/room-client'
import { MediaRtc, LevelMeter, type MediaKind } from '@/lib/media-rtc'
import type { AppEvent, ChatMsg, Participant } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Camera,
  CameraOff,
  ChevronDown,
  Download,
  Eye,
  Hand,
  Heart,
  Laugh,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  NotebookPen,
  PartyPopper,
  Phone,
  Pin,
  PinOff,
  Radio,
  RefreshCw,
  Send,
  Square,
  SwitchCamera,
  ThumbsUp,
  Video,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react'

// ------------------------------------------------------------------ configs

export interface CallAppConfig {
  kind: MediaKind
  startLabel: string
  startHint: string
  ptt?: boolean
  record?: boolean
  consent?: boolean
  snapshot?: boolean
  monitor?: boolean
  levelMeter?: boolean
  handRaise?: boolean
  spotlight?: boolean
  reactions?: boolean
  role?: 'none' | 'presenter-viewer' | 'teacher-student'
  chat?: boolean
  notes?: boolean
  deviceHint?: 'sender' | 'receiver'
}

export function callConfigFor(appId: string): CallAppConfig | null {
  switch (appId) {
    case 'video-call':
      return {
        kind: 'av',
        startLabel: 'Start the call',
        startHint: 'Your camera and microphone stay on this device until you allow them below. Video travels directly to the other person, with no server in the middle.',
        reactions: true,
        chat: true,
      }
    case 'group-meeting':
      return {
        kind: 'av',
        startLabel: 'Start the meeting',
        startHint: 'A temporary room that disappears with the session. Share your screen any time from the control bar.',
        handRaise: true,
        spotlight: true,
        reactions: true,
        chat: true,
      }
    case 'audio-call':
      return {
        kind: 'audio',
        startLabel: 'Start the voice call',
        startHint: 'Audio only: a fraction of the data of a video call, perfect for weak mobile networks.',
        reactions: true,
        chat: true,
      }
    case 'interview-room':
      return {
        kind: 'av',
        startLabel: 'Open the interview room',
        startHint: 'The candidate joins with one click, no account and nothing to install. Private notes stay on your device only.',
        chat: true,
        notes: true,
      }
    case 'classroom':
      return {
        kind: 'av',
        startLabel: 'Open the classroom',
        startHint: 'You are the teacher if you started the session. Students raise their hand; you decide who is spotlighted.',
        role: 'teacher-student',
        handRaise: true,
        spotlight: true,
        reactions: true,
        chat: true,
      }
    case 'webinar-room':
      return {
        kind: 'av',
        startLabel: 'Start the webinar',
        startHint: 'You present, they watch. Viewers join muted, react and raise their hand; questions land in chat.',
        role: 'presenter-viewer',
        handRaise: true,
        spotlight: true,
        reactions: true,
        chat: true,
      }
    case 'camera-live':
      return {
        kind: 'camera',
        startLabel: 'Share my camera',
        startHint: 'Point your camera at anything, and others watch live from any device with the code. Viewers can take snapshots.',
        snapshot: true,
      }
    case 'baby-monitor':
      return {
        kind: 'camera',
        startLabel: 'I consent, start the monitor',
        startHint: 'Explicit consent is required on this device before the camera starts. The watching device gets a loud alert if this feed ever drops, and the session always expires.',
        consent: true,
        monitor: true,
      }
    case 'temp-stream':
      return {
        kind: 'av',
        startLabel: 'Go live',
        startHint: 'A self-destructing broadcast: no archive, no replay, nothing left over. When you stop, it is gone.',
        reactions: true,
        chat: true,
      }
    case 'walkie-talkie':
      return {
        kind: 'audio',
        startLabel: 'Join the walkie-talkie',
        startHint: 'Hold the big button, talk, release. No open mics; everyone hears you only while you hold it.',
        ptt: true,
      }
    case 'voice-record':
      return {
        kind: 'audio',
        startLabel: 'Start recording',
        startHint: 'Record while everyone in the session listens live. Stop to download the audio, then it is gone.',
        record: true,
        levelMeter: true,
      }
    case 'phone-webcam':
      return {
        kind: 'camera',
        startLabel: 'Use this device as the camera',
        startHint: 'Open this session on your phone to send its camera here, or start from this device if it has a better lens.',
        deviceHint: 'sender',
      }
    case 'phone-mic':
      return {
        kind: 'audio',
        startLabel: 'Use this device as the microphone',
        startHint: 'Open this session on your phone to send its microphone here, from across the room if needed.',
        deviceHint: 'sender',
        levelMeter: true,
      }
    default:
      return null
  }
}

// ------------------------------------------------------------------- helpers

const REACTIONS = [
  { id: 'like', label: 'Thumbs up', icon: ThumbsUp },
  { id: 'clap', label: 'Applause', icon: Hand },
  { id: 'heart', label: 'Heart', icon: Heart },
  { id: 'laugh', label: 'Laugh', icon: Laugh },
  { id: 'wow', label: 'Wow', icon: Eye },
  { id: 'party', label: 'Celebrate', icon: PartyPopper },
] as const

interface FloatReaction {
  key: number
  reaction: string
  left: number
}

interface DeviceMediaState {
  micOn: boolean
  camOn: boolean
  screen: boolean
}

function initials(name: string) {
  const clean = name.trim()
  return clean ? clean.slice(0, 2).toUpperCase() : 'G'
}

interface TileProps {
  stream: MediaStream | null
  muted: boolean
  label: string
  sublabel?: string
  device?: string
  isSelf?: boolean
  speaking?: boolean
  micOn?: boolean
  camOn?: boolean
  screen?: boolean
  level?: number
  spotlight?: boolean
  onSnapshot?: () => void
  onPin?: () => void
  pinned?: boolean
  canPin?: boolean
  showSnapshot?: boolean
  /** P2P link health for remote tiles: drives the reconnecting overlay. */
  linkState?: 'live' | 'linking' | 'dropped'
}

function VideoTile({
  stream,
  muted,
  label,
  sublabel,
  device,
  isSelf,
  speaking,
  micOn = true,
  camOn = true,
  screen,
  level = 0,
  spotlight,
  onSnapshot,
  onPin,
  pinned,
  canPin,
  showSnapshot,
  linkState = 'live',
}: TileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (stream) {
      v.srcObject = stream
      v.play().catch(() => undefined)
    } else {
      v.srcObject = null
    }
  }, [stream])

  const hasVideo = stream != null && stream.getVideoTracks().length > 0 && camOn

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-stage transition-[transform,box-shadow] duration-300',
        spotlight ? 'ring-2 ring-primary' : '',
        speaking ? 'ring-2 ring-positive' : spotlight ? '' : 'ring-1 ring-stage-border',
        linkState === 'dropped' && 'ring-2 ring-warning/70',
      )}
    >
      <div className="aspect-video w-full">
        {hasVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-stage-soft">
            <span className="flex size-14 items-center justify-center rounded-full border border-stage-border bg-stage-soft text-base font-semibold text-stage-muted">
              {initials(label)}
            </span>
          </div>
        )}
      </div>

      {/* reconnecting overlay — explains a frozen/paused P2P feed */}
      {linkState !== 'live' && (
        <div
          className={cn(
            'absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center',
            linkState === 'dropped'
              ? 'bg-stage/70 backdrop-blur-[3px]'
              : 'bg-black/25',
          )}
          role={linkState === 'dropped' ? 'status' : undefined}
        >
          {linkState === 'dropped' ? (
            <>
              <span className="flex size-11 items-center justify-center rounded-full border border-warning/40 bg-warning/15 text-warning">
                <WifiOff className="size-5 animate-pulse" aria-hidden="true" />
              </span>
              <p className="px-3 text-sm font-semibold text-warning">Reconnecting to {label}…</p>
              <p className="px-4 text-xs leading-snug text-stage-muted">
                Their device dropped the link. We re-establish it automatically.
              </p>
            </>
          ) : (
            !isSelf && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-stage-foreground backdrop-blur">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" /> linking…
              </span>
            )
          )}
        </div>
      )}

      {/* top-left badges */}
      <div className="absolute left-2.5 top-2.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          {label}
          {isSelf && <span className="text-white/60">· you</span>}
        </span>
        {screen && (
          <span className="inline-flex items-center gap-1 rounded-full bg-positive/90 px-2 py-0.5 text-[10px] font-semibold text-white">
            <MonitorUp className="size-3" aria-hidden="true" /> screen
          </span>
        )}
        {spotlight && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            <Pin className="size-3" aria-hidden="true" /> spotlight
          </span>
        )}
      </div>

      {/* bottom status + actions */}
      <div className="absolute inset-x-2.5 bottom-2.5 flex items-center gap-1.5">
        <span
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur',
            !micOn && 'text-destructive',
          )}
          title={micOn ? 'Microphone on' : 'Microphone muted'}
        >
          {micOn ? <Mic className="size-3.5" aria-hidden="true" /> : <MicOff className="size-3.5" aria-hidden="true" />}
        </span>
        <span
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur',
            !camOn && 'text-destructive',
          )}
          title={camOn ? 'Camera on' : 'Camera off'}
        >
          {camOn ? <Video className="size-3.5" aria-hidden="true" /> : <CameraOff className="size-3.5" aria-hidden="true" />}
        </span>
        {device && (
          <span className="rounded-full bg-black/40 px-2 py-1 text-[10px] font-medium text-white/70 backdrop-blur">
            {device}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {/* live level bars */}
          {level > 0.02 && (
            <span className="flex h-4 items-end gap-0.5" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-full w-1 origin-bottom rounded-full bg-positive transition-transform duration-100"
                  style={{
                    transform: `scaleY(${level > 0.75 - i * 0.28 ? 1 : level > 0.45 - i * 0.18 ? 2 / 3 : 1 / 3})`,
                  }}
                />
              ))}
            </span>
          )}
          {showSnapshot && onSnapshot && (
            <button
              onClick={onSnapshot}
              className="inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"
              title="Take a snapshot"
              aria-label={`Take a snapshot of ${label}'s stream`}
            >
              <Camera className="size-3.5" aria-hidden="true" />
            </button>
          )}
          {canPin && onPin && (
            <button
              onClick={onPin}
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100',
                pinned && 'opacity-100 text-primary',
              )}
              title={pinned ? 'Remove spotlight' : 'Spotlight this participant'}
              aria-label={pinned ? `Remove spotlight from ${label}` : `Spotlight ${label}`}
            >
              {pinned ? <PinOff className="size-3.5" aria-hidden="true" /> : <Pin className="size-3.5" aria-hidden="true" />}
            </button>
          )}
        </span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ the panel

interface CallPanelProps {
  client: RoomClient | null
  config: CallAppConfig
  selfId: string
  participants: Participant[]
  chat: ChatMsg[]
  connected: boolean
}

type Phase = 'idle' | 'starting' | 'live'

export function CallPanel({ client, config, selfId, participants, chat, connected }: CallPanelProps) {
  // ---------------------------------------------------------------- rtc state
  const rtcRef = useRef<MediaRtc | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [peerStates, setPeerStates] = useState<Map<string, RTCPeerConnectionState>>(new Map())
  const [phase, setPhase] = useState<Phase>('idle')
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [screenActive, setScreenActive] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [consented, setConsented] = useState(false)

  // -------------------------------------------------------------- room state
  const isHost = participants.length > 0 && participants[0].id === selfId
  const roleLocked = (config.role === 'presenter-viewer' || config.role === 'teacher-student') && !isHost

  // media state of others (from 'call:state' events)
  const [mediaStates, setMediaStates] = useState<Map<string, DeviceMediaState>>(new Map())
  // ptt states of others
  const [pttStates, setPttStates] = useState<Map<string, boolean>>(new Map())
  // raised hands
  const [hands, setHands] = useState<Map<string, boolean>>(new Map())
  const [myHand, setMyHand] = useState(false)
  // spotlight (persisted — late joiners see it)
  const [spotlightId, setSpotlightId] = useState<string | null>(null)
  // floating reactions
  const [floaters, setFloaters] = useState<FloatReaction[]>([])
  // monitor alert (baby monitor)
  const [alerting, setAlerting] = useState(false)

  // levels (0..1) keyed 'self' or peerId
  const [levels, setLevels] = useState<Record<string, number>>({})
  const metersRef = useRef<Map<string, LevelMeter>>(new Map())
  const rafRef = useRef<number | null>(null)

  // recording
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)

  // ptt
  const [pttTalking, setPttTalking] = useState(false)

  // chat + notes
  const [chatOpen, setChatOpen] = useState(false)
  const [chatDraft, setChatDraft] = useState('')
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const [noteText, setNoteText] = useState('')
  const noteKey = client ? `sow.notes.${client.code}` : 'sow.notes.tmp'

  // misc ui
  const [now, setNow] = useState(() => Date.now())
  const gridRef = useRef<HTMLDivElement>(null)
  const floatKeyRef = useRef(0)
  const phaseRef = useRef<Phase>('idle')
  useEffect(() => {
    phaseRef.current = phase
  })

  const remotePeerIds = useMemo(
    () => participants.filter((p) => p.id !== selfId).map((p) => p.id),
    [participants, selfId],
  )

  // ------------------------------------------------------------------ rtc set up
  useEffect(() => {
    if (!client) return
    const rtc = new MediaRtc(client)
    rtcRef.current = rtc

    const offs = [
      rtc.on('localstream', (p) => {
        const { stream, kind } = p as { stream: MediaStream | null; kind: MediaKind | null }
        setLocalStream(stream)
        if (kind === 'audio') setCamOn(false)
        // rebuild self meter
        const meters = metersRef.current
        meters.get('self')?.stop()
        meters.delete('self')
        if (stream && stream.getAudioTracks().length > 0) {
          try {
            meters.set('self', new LevelMeter(stream))
          } catch {
            // Web Audio unavailable
          }
        }
      }),
      rtc.on('stream', (p) => {
        const { peerId, stream } = p as { peerId: string; stream: MediaStream }
        setRemoteStreams((prev) => {
          const next = new Map(prev)
          next.set(peerId, stream)
          return next
        })
        // meter for this remote stream
        const meters = metersRef.current
        meters.get(peerId)?.stop()
        meters.delete(peerId)
        if (stream.getAudioTracks().length > 0) {
          try {
            meters.set(peerId, new LevelMeter(stream))
          } catch {
            // ignore
          }
        }
        // feed restored → clear monitor alert
        setAlerting(false)
      }),
      rtc.on('streamended', (p) => {
        const { peerId } = p as { peerId: string }
        setRemoteStreams((prev) => {
          const next = new Map(prev)
          next.delete(peerId)
          return next
        })
        metersRef.current.get(peerId)?.stop()
        metersRef.current.delete(peerId)
        // baby-monitor: loud alert when the feed dies
        if (config.monitor && phaseRef.current === 'live') setAlerting(true)
      }),
      rtc.on('peerstate', (p) => {
        const { peerId, state } = p as { peerId: string; state: RTCPeerConnectionState }
        setPeerStates((prev) => {
          const next = new Map(prev)
          next.set(peerId, state)
          return next
        })
      }),
      rtc.on('peerleft', (p) => {
        const { peerId } = p as { peerId: string }
        setRemoteStreams((prev) => {
          const next = new Map(prev)
          next.delete(peerId)
          return next
        })
        setMediaStates((prev) => {
          const next = new Map(prev)
          next.delete(peerId)
          return next
        })
        setPeerStates((prev) => {
          const next = new Map(prev)
          next.delete(peerId)
          return next
        })
        metersRef.current.get(peerId)?.stop()
        metersRef.current.delete(peerId)
        if (config.monitor && phaseRef.current === 'live') setAlerting(true)
      }),
      rtc.on('screen', (p) => {
        const { active } = p as { active: boolean }
        setScreenActive(active)
      }),
    ]

    return () => {
      offs.forEach((off) => off())
      rtc.destroy()
      rtcRef.current = null
    }
  }, [client, config.monitor])

  // ------------------------------------------------------------- app events
  useEffect(() => {
    if (!client) return
    return client.on('appevent', (raw) => {
      const ev = raw as AppEvent
      const mine = ev.from === selfId
      const pid = (ev.payload as Record<string, unknown> | null)?.pid === undefined ? ev.from : String((ev.payload as Record<string, unknown>).pid)

      if (ev.type === 'call:state' && !mine) {
        const s = ev.payload as DeviceMediaState
        setMediaStates((prev) => {
          const next = new Map(prev)
          next.set(ev.from, { micOn: s?.micOn ?? true, camOn: s?.camOn ?? true, screen: s?.screen ?? false })
          return next
        })
        return
      }
      if (ev.type === 'call:ptt' && !mine) {
        const s = ev.payload as { talking?: boolean }
        setPttStates((prev) => {
          const next = new Map(prev)
          next.set(ev.from, Boolean(s?.talking))
          return next
        })
        return
      }
      if (ev.type === 'call:hand' && !mine) {
        const s = ev.payload as { raised?: boolean }
        setHands((prev) => {
          const next = new Map(prev)
          next.set(pid, Boolean(s?.raised))
          return next
        })
        return
      }
      if (ev.type === 'call:spotlight') {
        const s = ev.payload as { target?: string | null }
        setSpotlightId(s?.target ?? null)
        return
      }
      if (ev.type === 'react' && !mine) {
        const s = ev.payload as { emoji?: string }
        const emoji = s?.emoji
        const reaction = REACTIONS.find((r) => r.id === emoji) ?? REACTIONS[0]
        if (emoji && reaction) {
          floatKeyRef.current += 1
          const key = floatKeyRef.current
          setFloaters((prev) => [
            ...prev.slice(-14),
            { key, reaction: reaction.id, left: 8 + Math.random() * 74 },
          ])
          setTimeout(() => setFloaters((prev) => prev.filter((f) => f.key !== key)), 4200)
        }
        return
      }
    })
  }, [client, selfId])

  // ---------------------------------------------------------------- levels rAF
  useEffect(() => {
    const tick = () => {
      const meters = metersRef.current
      if (meters.size > 0) {
        const next: Record<string, number> = {}
        for (const [key, meter] of meters) {
          const v = meter.level()
          if (v > 0.015) next[key] = v
        }
        setLevels(next)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // cleanup meters on unmount
  useEffect(
    () => () => {
      for (const m of metersRef.current.values()) m.stop()
      metersRef.current.clear()
    },
    [],
  )

  // 1s ticker (recording timer, clock)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // ---------------------------------------------------------- monitor beeper
  useEffect(() => {
    if (!alerting) return
    let ctx: AudioContext | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      ctx = new Ctor()
      const beep = () => {
        if (!ctx) return
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
        osc.connect(gain).connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.55)
      }
      beep()
      timer = setInterval(beep, 2500)
    } catch {
      // no Web Audio — banner only
    }
    return () => {
      if (timer) clearInterval(timer)
      try {
        void ctx?.close()
      } catch {
        // ignore
      }
    }
  }, [alerting])

  // ------------------------------------------------------------- chat autoscroll
  useEffect(() => {
    const el = chatScrollRef.current
    if (el && chatOpen) el.scrollTop = el.scrollHeight
  }, [chat, chatOpen])

  // ------------------------------------------------------------------ actions
  const broadcastState = useCallback(
    (s: DeviceMediaState) => {
      void client?.sendAppEvent('call:state', s).catch(() => undefined)
    },
    [client],
  )

  const start = useCallback(async () => {
    if (!rtcRef.current || phase !== 'idle') return
    setStartError(null)
    setPhase('starting')
    try {
      await rtcRef.current.start(config.kind)
      setPhase('live')
      setMicOn(config.kind !== 'camera' && !roleLocked)
      if (roleLocked) rtcRef.current.setMicEnabled(false)
      setCamOn(config.kind !== 'audio')
      toast.success('Connected. You are live.')
      broadcastState({
        micOn: config.kind !== 'camera' && !roleLocked,
        camOn: config.kind !== 'audio',
        screen: false,
      })
    } catch (err) {
      setPhase('idle')
      const msg = err instanceof Error ? err.message : 'Could not access your devices'
      if (/permission|denied|notallowed|dismiss/i.test(msg)) {
        setStartError(
          'Camera/microphone permission was blocked. Allow access in your browser’s address-bar icon, then try again.',
        )
      } else if (/not.?found|no.*(camera|mic|device)|notavailable|occupied/i.test(msg)) {
        setStartError('No camera or microphone was found on this device. Check that another app is not using it.')
      } else {
        setStartError(msg)
      }
    }
  }, [config.kind, phase, roleLocked, broadcastState])

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
      setRecording(false)
    }
    rtcRef.current?.stopLocal()
    setPhase('idle')
    setAlerting(false)
    broadcastState({ micOn: false, camOn: false, screen: false })
  }, [broadcastState])

  const toggleMic = useCallback(() => {
    const rtc = rtcRef.current
    if (!rtc) return
    const next = !rtc.isMicEnabled()
    rtc.setMicEnabled(next)
    setMicOn(next)
    broadcastState({ micOn: next, camOn, screen: screenActive })
  }, [camOn, screenActive, broadcastState])

  const toggleCam = useCallback(() => {
    const rtc = rtcRef.current
    if (!rtc) return
    const next = !rtc.isCameraEnabled()
    rtc.setCameraEnabled(next)
    setCamOn(next)
    broadcastState({ micOn, camOn: next, screen: screenActive })
  }, [micOn, screenActive, broadcastState])

  const toggleScreen = useCallback(async () => {
    const rtc = rtcRef.current
    if (!rtc) return
    try {
      if (rtc.isScreenActive()) {
        await rtc.stopScreenShare()
      } else {
        await rtc.startScreenShare()
      }
      broadcastState({ micOn, camOn, screen: rtc.isScreenActive() })
    } catch {
      toast.error('Screen sharing was cancelled or is unavailable here.')
    }
  }, [micOn, camOn, broadcastState])

  const switchCamera = useCallback(async () => {
    try {
      await rtcRef.current?.switchCamera()
    } catch {
      toast.error('Could not switch the camera.')
    }
  }, [])

  // push-to-talk
  const setPtt = useCallback(
    (on: boolean) => {
      const rtc = rtcRef.current
      if (!rtc || phase !== 'live') return
      rtc.setMicEnabled(on)
      setPttTalking(on)
      void client?.sendAppEvent('call:ptt', { talking: on }).catch(() => undefined)
    },
    [client, phase],
  )

  // space-bar PTT
  useEffect(() => {
    if (!config.ptt || phase !== 'live') return
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target as HTMLElement)?.closest('input, textarea')) {
        e.preventDefault()
        setPtt(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setPtt(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      setPtt(false)
    }
  }, [config.ptt, phase, setPtt])

  const toggleHand = useCallback(() => {
    const next = !myHand
    setMyHand(next)
    void client?.sendAppEvent('call:hand', { raised: next, pid: selfId }).catch(() => undefined)
    toast.success(next ? 'Your hand is up.' : 'Hand lowered.')
  }, [client, myHand, selfId])

  const sendSpotlight = useCallback(
    (target: string | null) => {
      setSpotlightId(target)
      void client?.sendAppEvent('call:spotlight', { target }, { persist: true }).catch(() => undefined)
    },
    [client],
  )

  const sendReaction = useCallback(
    (reactionId: string) => {
      floatKeyRef.current += 1
      const key = floatKeyRef.current
      setFloaters((prev) => [...prev.slice(-14), { key, reaction: reactionId, left: 8 + Math.random() * 74 }])
      setTimeout(() => setFloaters((prev) => prev.filter((f) => f.key !== key)), 4200)
      void client?.sendAppEvent('react', { emoji: reactionId }).catch(() => undefined)
    },
    [client],
  )

  // recording
  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setRecordSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [recording])

  const toggleRecording = useCallback(() => {
    const stream = localStream
    if (!stream) return
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    const mimes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    const mime = mimes.find((m) => MediaRecorder.isTypeSupported?.(m))
    try {
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `shareonweb-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 8000)
        setRecording(false)
        setRecordSecs(0)
        toast.success('Recording saved to your downloads.')
      }
      rec.start(1000)
      recorderRef.current = rec
      setRecordSecs(0)
      setRecording(true)
    } catch {
      toast.error('Recording is not supported in this browser.')
    }
  }, [localStream, recording])

  const snapshot = useCallback(
    (peerId: string | 'self') => {
      const stream = peerId === 'self' ? localStream : remoteStreams.get(peerId)
      const videoTrack = stream?.getVideoTracks()[0]
      if (!videoTrack) return
      const video = document.createElement('video')
      video.srcObject = new MediaStream([videoTrack])
      video.muted = true
      video.play().then(() => {
        setTimeout(() => {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth || 1280
          canvas.height = video.videoHeight || 720
          canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
          const a = document.createElement('a')
          a.href = canvas.toDataURL('image/png')
          a.download = `shareonweb-snapshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`
          a.click()
          toast.success('Snapshot saved.')
        }, 350)
      }).catch(() => toast.error('Could not capture the frame.'))
    },
    [localStream, remoteStreams],
  )

  const sendChat = useCallback(async () => {
    const text = chatDraft.trim()
    if (!text || !client) return
    setChatDraft('')
    await client.sendChat(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text)
  }, [chatDraft, client])

  // notes (interview room) — local only
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setNoteText(window.localStorage.getItem(noteKey) ?? '')
      } catch {
        // ignore
      }
    })
  }, [noteKey])
  const saveNote = useCallback(
    (value: string) => {
      setNoteText(value)
      try {
        window.localStorage.setItem(noteKey, value)
      } catch {
        // ignore
      }
    },
    [noteKey],
  )
  const downloadNote = useCallback(() => {
    const blob = new Blob([noteText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `interview-notes-${client?.code ?? 'session'}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }, [noteText, client])

  const fullscreen = useCallback(() => {
    const el = gridRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.().catch(() => toast.error('Fullscreen was blocked.'))
  }, [])

  // ------------------------------------------------------------- derived tiles
  const nameFor = useCallback(
    (id: string) => participants.find((p) => p.id === id)?.name ?? 'Guest',
    [participants],
  )
  const deviceFor = useCallback(
    (id: string) => participants.find((p) => p.id === id)?.device,
    [participants],
  )

  const tiles = useMemo(() => {
    const list: Array<{
      id: string
      stream: MediaStream | null
      label: string
      isSelf: boolean
      state: DeviceMediaState
      speaking: boolean
      talking: boolean
      link: 'live' | 'linking' | 'dropped'
    }> = []
    if (phase === 'live' || localStream) {
      list.push({
        id: 'self',
        stream: localStream,
        label: 'You',
        isSelf: true,
        state: { micOn: micOn && !pttTalking ? micOn : config.ptt ? pttTalking : micOn, camOn, screen: screenActive },
        speaking: (levels['self'] ?? 0) > 0.1,
        talking: config.ptt ? pttTalking : (levels['self'] ?? 0) > 0.1,
        link: 'live',
      })
    }
    for (const p of participants) {
      if (p.id === selfId) continue
      const stream = remoteStreams.get(p.id) ?? null
      const ms = mediaStates.get(p.id)
      const pcState = peerStates.get(p.id)
      list.push({
        id: p.id,
        stream,
        label: p.name,
        isSelf: false,
        state: ms ?? { micOn: true, camOn: stream != null && stream.getVideoTracks().length > 0, screen: false },
        speaking: (levels[p.id] ?? 0) > 0.1,
        talking: config.ptt ? (pttStates.get(p.id) ?? false) : (levels[p.id] ?? 0) > 0.1,
        link:
          pcState === 'disconnected' || pcState === 'failed' || pcState === 'closed'
            ? 'dropped'
            : pcState === 'connected'
              ? 'live'
              : 'linking',
      })
    }
    // spotlight first
    list.sort((a, b) => (a.id === spotlightId ? -1 : b.id === spotlightId ? 1 : 0))
    return list
  }, [
    phase, localStream, participants, selfId, remoteStreams, mediaStates, levels,
    micOn, pttTalking, camOn, screenActive, config.ptt, pttStates, spotlightId, peerStates,
  ])

  const raisedHands = useMemo(() => {
    const names: string[] = []
    for (const p of participants) {
      if (p.id === selfId) {
        if (myHand) names.push(`${p.name} (you)`)
      } else if (hands.get(p.id)) names.push(p.name)
    }
    return names
  }, [participants, selfId, myHand, hands])

  const connectedPeers = remotePeerIds.filter(
    (id) => peerStates.get(id) === 'connected',
  ).length

  const fmtRec = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const hints = participants.filter((p) => p.id !== selfId)

  // ------------------------------------------------------------------- render
  return (
    <div className="space-y-4">
      {alerting && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          <VolumeX className="size-5 shrink-0 animate-pulse" aria-hidden="true" />
          <span>The camera device disconnected. Check on it now. The alert stops when the feed returns.</span>
        </div>
      )}

      {/* -------------------------------------------------------- stage / idle */}
      <Card className="overflow-hidden border-none bg-stage p-0 text-white">
        <CardContent className="p-4 sm:p-5">
          {phase !== 'live' && localStream == null ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 py-10 text-center sm:min-h-[400px]">
              {config.consent ? (
                <>
                  <div className="max-w-md space-y-1.5">
                    <p className="text-lg font-semibold">Consent first, by design</p>
                    <p className="text-sm leading-relaxed text-stage-muted">{config.startHint}</p>
                  </div>
                  <label className="mt-1 flex max-w-md cursor-pointer items-start gap-3 rounded-xl border border-stage-border bg-stage-soft/70 px-4 py-3 text-left text-sm text-stage-foreground transition-colors hover:border-stage-border/70">
                    <input
                      type="checkbox"
                      checked={consented}
                      onChange={(e) => setConsented(e.target.checked)}
                      className="mt-0.5 size-4 accent-positive"
                    />
                    <span>
                      This device is allowed to share its camera with everyone in this session,
                      and I understand the feed ends when the session ends.
                    </span>
                  </label>
                  <Button
                    size="lg"
                    disabled={!consented || phase === 'starting'}
                    onClick={start}
                    className="mt-1 h-12 gap-2 bg-primary px-8 text-base font-semibold text-black hover:bg-positive"
                  >
                    {phase === 'starting' ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Camera className="size-5" aria-hidden="true" />
                    )}
                    {config.startLabel}
                  </Button>
                </>
              ) : (
                <>
                  <div className="max-w-md space-y-1.5">
                    <p className="text-lg font-semibold">{config.startLabel}</p>
                    <p className="text-sm leading-relaxed text-stage-muted">{config.startHint}</p>
                  </div>
                  {config.deviceHint === 'sender' && (
                    <p className="text-xs text-stage-muted">
                      Phone opens this link → it becomes the camera/mic. This device → watch here.
                    </p>
                  )}
                  <Button
                    size="lg"
                    disabled={phase === 'starting'}
                    onClick={start}
                    className="mt-1 h-12 gap-2 bg-primary px-8 text-base font-semibold text-black hover:bg-positive"
                  >
                    {phase === 'starting' ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                    ) : config.kind === 'audio' ? (
                      <Phone className="size-5" aria-hidden="true" />
                    ) : (
                      <Video className="size-5" aria-hidden="true" />
                    )}
                    {config.startLabel}
                  </Button>
                </>
              )}

              {startError && (
                <p role="alert" className="max-w-md rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                  {startError}
                </p>
              )}

              <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-stage-muted/70">
                <li>Direct browser-to-browser; nothing is recorded or stored</li>
                <li>{hints.length > 0 ? `${hints.length} device${hints.length > 1 ? 's' : ''} in the room` : 'Share the code to invite a device'}</li>
              </ul>
            </div>
          ) : (
            <>
              {/* video grid */}
              <div ref={gridRef} className="relative">
                <div
                  className={cn(
                    'grid gap-3',
                    tiles.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
                  )}
                >
                  {tiles.map((t) => (
                    <VideoTile
                      key={t.id}
                      stream={t.stream}
                      muted={t.isSelf}
                      label={t.isSelf ? 'You' : nameFor(t.id)}
                      device={t.isSelf ? undefined : deviceFor(t.id)}
                      isSelf={t.isSelf}
                      speaking={t.speaking}
                      micOn={t.state.micOn}
                      camOn={t.state.camOn}
                      screen={t.state.screen}
                      level={levels[t.id === 'self' ? 'self' : t.id] ?? 0}
                      spotlight={t.id === spotlightId}
                      canPin={Boolean(config.spotlight && isHost)}
                      pinned={t.id === spotlightId}
                      onPin={() => sendSpotlight(t.id === spotlightId ? null : t.id)}
                      showSnapshot={Boolean(config.snapshot)}
                      onSnapshot={() => snapshot(t.id === 'self' ? 'self' : t.id)}
                      linkState={t.isSelf ? 'live' : t.link}
                    />
                  ))}
                  {tiles.length === 0 && (
                    <div className="flex aspect-video items-center justify-center rounded-2xl border border-stage-border text-sm text-stage-muted/70">
                      Waiting for someone to share the code with…
                    </div>
                  )}
                </div>

                {/* floating reactions layer */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                  {floaters.map((f) => {
                    const reaction = REACTIONS.find((r) => r.id === f.reaction) ?? REACTIONS[0]
                    return (
                      <span
                        key={f.key}
                        className="sow-float-up absolute bottom-6 drop-shadow-lg"
                        style={{ left: `${f.left}%` }}
                      >
                        <reaction.icon className="size-7" aria-hidden="true" />
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* ---------------------------------------------------- controls */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {config.ptt ? (
                  <button
                    onPointerDown={() => setPtt(true)}
                    onPointerUp={() => setPtt(false)}
                    onPointerLeave={() => pttTalking && setPtt(false)}
                    className={cn(
                      'flex h-14 select-none items-center gap-3 rounded-full px-8 text-base font-semibold transition-[transform,background-color,border-color,box-shadow] active:scale-95',
                      pttTalking
                        ? 'bg-destructive text-white'
                        : 'bg-stage-raised text-stage-foreground hover:bg-stage-raised',
                    )}
                    aria-pressed={pttTalking}
                  >
                    <Radio className={cn('size-5', pttTalking && 'animate-pulse')} aria-hidden="true" />
                    {pttTalking ? 'Talking, release to stop' : 'Hold to talk'}
                  </button>
                ) : (
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={config.kind === 'camera' || roleLocked || localStream == null}
                    onClick={toggleMic}
                    className={cn(
                      'size-11 rounded-full',
                      micOn && !roleLocked ? 'bg-stage-raised text-stage-foreground hover:bg-stage-raised' : 'bg-destructive text-white hover:bg-destructive/90',
                    )}
                    title={roleLocked ? 'Viewers are muted; raise your hand' : micOn ? 'Mute' : 'Unmute'}
                    aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    {micOn && !roleLocked ? <Mic className="size-4.5" aria-hidden="true" /> : <MicOff className="size-4.5" aria-hidden="true" />}
                  </Button>
                )}

                {config.kind !== 'audio' && (
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={localStream == null || config.kind === 'camera'}
                    onClick={toggleCam}
                    className={cn(
                      'size-11 rounded-full',
                      camOn ? 'bg-stage-raised text-stage-foreground hover:bg-stage-raised' : 'bg-destructive text-white hover:bg-destructive/90',
                    )}
                    title={camOn ? 'Turn camera off' : 'Turn camera on'}
                    aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
                  >
                    {camOn ? <Video className="size-4.5" aria-hidden="true" /> : <CameraOff className="size-4.5" aria-hidden="true" />}
                  </Button>
                )}

                {config.kind === 'av' && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={toggleScreen}
                    className={cn(
                      'size-11 rounded-full',
                      screenActive ? 'bg-positive text-white hover:bg-positive/90' : 'bg-stage-raised text-stage-foreground hover:bg-stage-raised',
                    )}
                    title={screenActive ? 'Stop sharing your screen' : 'Share your screen'}
                    aria-label={screenActive ? 'Stop screen sharing' : 'Share your screen'}
                  >
                    <MonitorUp className="size-4.5" aria-hidden="true" />
                  </Button>
                )}

                {'ontouchstart' in window && config.kind !== 'audio' && localStream != null && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={switchCamera}
                    className="size-11 rounded-full bg-stage-raised text-stage-foreground hover:bg-stage-raised"
                    title="Switch camera"
                    aria-label="Switch camera"
                  >
                    <SwitchCamera className="size-4.5" aria-hidden="true" />
                  </Button>
                )}

                {config.levelMeter && (
                  <div className="flex h-11 items-center gap-2 rounded-full bg-stage-soft px-4" title="Input level">
                    <Volume2 className="size-4 text-stage-muted" aria-hidden="true" />
                    <span className="h-2 w-24 overflow-hidden rounded-full bg-stage-raised">
                      <span
                        className="block h-full w-full origin-left rounded-full bg-positive transition-transform duration-100"
                        style={{ transform: `scaleX(${Math.min(1, Math.max(0, levels['self'] ?? 0))})` }}
                      />
                    </span>
                  </div>
                )}

                {config.record && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={toggleRecording}
                    className={cn(
                      'h-11 gap-2 rounded-full px-4',
                      recording ? 'bg-destructive text-white hover:bg-destructive/90' : 'bg-stage-raised text-stage-foreground hover:bg-stage-raised',
                    )}
                    aria-label={recording ? 'Stop recording and download' : 'Start recording'}
                  >
                    {recording ? (
                      <>
                        <span className="size-2.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
                        <span className="font-mono text-sm">{fmtRec(recordSecs)}</span>
                        <Square className="size-3.5" aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        <Mic className="size-4.5" aria-hidden="true" /> Record
                      </>
                    )}
                  </Button>
                )}

                {config.handRaise && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={toggleHand}
                    className={cn(
                      'size-11 rounded-full',
                      myHand ? 'bg-warning text-black hover:bg-warning/90' : 'bg-stage-raised text-stage-foreground hover:bg-stage-raised',
                    )}
                    title={myHand ? 'Lower your hand' : 'Raise your hand'}
                    aria-label={myHand ? 'Lower your hand' : 'Raise your hand'}
                  >
                    <Hand className="size-4.5" aria-hidden="true" />
                  </Button>
                )}

                {config.reactions && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="size-11 rounded-full bg-stage-raised text-stage-foreground hover:bg-stage-raised"
                        title="Send a reaction"
                        aria-label="Send a reaction"
                      >
                        <PartyPopper className="size-4.5" aria-hidden="true" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2">
                      <div className="flex gap-1">
                        {REACTIONS.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => sendReaction(r.id)}
                            className="rounded-lg p-2 text-2xl transition-colors hover:bg-muted"
                            aria-label={`React with ${r.label}`}
                          >
                            <r.icon className="size-5" aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {config.chat && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setChatOpen((v) => !v)}
                    className={cn(
                      'relative size-11 rounded-full',
                      chatOpen ? 'bg-primary text-primary-foreground' : 'bg-stage-raised text-stage-foreground hover:bg-stage-raised',
                    )}
                    title={chatOpen ? 'Hide chat' : 'Open chat'}
                    aria-label={chatOpen ? 'Hide chat' : 'Open chat'}
                  >
                    <MessageSquare className="size-4.5" aria-hidden="true" />
                    {chat.length > 0 && !chatOpen && (
                      <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                        {Math.min(chat.length, 9)}
                      </span>
                    )}
                  </Button>
                )}

                <Button
                  variant="secondary"
                  size="icon"
                  onClick={fullscreen}
                  className="size-11 rounded-full bg-stage-raised text-stage-foreground hover:bg-stage-raised"
                  title="Fullscreen"
                  aria-label="Toggle fullscreen"
                >
                  <MonitorUp className="size-4.5 rotate-90" aria-hidden="true" />
                </Button>

                <Button
                  size="icon"
                  onClick={stop}
                  className="size-11 rounded-full bg-destructive text-white hover:bg-destructive/90"
                  title="Leave the call"
                  aria-label="Leave the call"
                >
                  <Phone className="size-4.5 rotate-[135deg]" aria-hidden="true" />
                </Button>
              </div>

              {/* status strip */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-stage-muted/70">
                <span>
                  P2P mesh · {connectedPeers}/{remotePeerIds.length} connected
                </span>
                {roleLocked && (
                  <span>
                    {config.role === 'teacher-student' ? 'Student view' : 'Viewer view'} (muted by design)
                  </span>
                )}
                {isHost && (config.role === 'teacher-student' || config.role === 'presenter-viewer') && (
                  <span className="font-medium text-stage-foreground">
                    {config.role === 'teacher-student' ? 'You are the teacher' : 'You are the presenter'}
                  </span>
                )}
                {screenActive && <span>Presenting your screen</span>}
                {spotlightId && <span>Spotlight: {nameFor(spotlightId)}</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- raised hands */}
      {config.handRaise && raisedHands.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/60 bg-warning/15 px-4 py-2.5 text-sm">
          <Hand className="size-4 text-warning" aria-hidden="true" />
          <span>
            <span className="font-semibold">Raised hands:</span> {raisedHands.join(', ')}
          </span>
          {isHost && (
            <span className="ml-auto text-xs text-muted-foreground">
              Pin someone to spotlight them
            </span>
          )}
        </div>
      )}

      {/* ---------------------------------------------- chat + notes sidecars */}
      {(config.chat || config.notes) && (
        <div className={cn('grid gap-4', config.notes ? 'lg:grid-cols-2' : 'grid-cols-1')}>
          {config.chat && chatOpen && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
                  <MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-semibold">In-call chat</p>
                  <button
                    onClick={() => setChatOpen(false)}
                    className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Close chat"
                  >
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div ref={chatScrollRef} className="max-h-64 min-h-40 divide-y overflow-y-auto px-4 py-3">
                  {chat.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Questions and links land here, and everyone in the call sees them.
                    </p>
                  )}
                  {chat.map((m) => (
                    <div key={m.id} className="py-2.5 first:pt-0 last:pb-0">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {m.from === participants.find((p) => p.id === selfId)?.name ? 'You' : m.from}
                        <span className="ml-1.5 font-normal">
                          {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </p>
                      <p className="mt-0.5 break-words text-sm">{m.content}</p>
                    </div>
                  ))}
                </div>
                <form
                  className="flex gap-2 border-t px-3 py-2.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void sendChat()
                  }}
                >
                  <Input
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    placeholder="Type a message…"
                    aria-label="Chat message"
                    className="h-9"
                  />
                  <Button size="sm" type="submit" disabled={!chatDraft.trim()} className="h-9 px-3" aria-label="Send message">
                    <Send className="size-4" aria-hidden="true" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {config.notes && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
                  <NotebookPen className="size-4 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-semibold">Private notes</p>
                  <span className="ml-auto text-[11px] text-muted-foreground">only on this device</span>
                </div>
                <textarea
                  value={noteText}
                  onChange={(e) => saveNote(e.target.value)}
                  placeholder="Interviewer notes: observations, scores, follow-ups. Never shared, never stored anywhere but this browser."
                  className="min-h-[220px] w-full resize-y bg-transparent px-4 py-3 text-sm leading-relaxed outline-none"
                  aria-label="Private notes"
                />
                <div className="flex items-center gap-2 border-t px-3 py-2.5">
                  <Button variant="outline" size="sm" onClick={downloadNote} disabled={!noteText} className="gap-1.5">
                    <Download className="size-3.5" aria-hidden="true" /> Download .txt
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => saveNote('')} disabled={!noteText} className="ml-auto gap-1.5 text-destructive hover:text-destructive">
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* --------------------------------------------------- participant strip */}
      {hints.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium">In the room:</span>
          {hints.map((p, i) => (
            <span key={p.id} className="inline-flex items-center gap-1">
              {i > 0 && <span aria-hidden="true">·</span>}
              {p.name}
              {hands.get(p.id) && <Hand className="size-3 text-warning" aria-hidden="true" />}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
