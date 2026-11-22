'use client'

// Session workspace: the chrome around a live session (code, QR, connection
// status, presence, expiry) plus the panel for the app the session belongs to.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CHUNK_SIZE, RoomClient, detectDevice, getClientId, type ConnState } from '@/lib/room-client'
import { hasHostedRelay, relayMisconfigured, resolveRelayUrl, warmRelay } from '@/lib/relay-endpoint'
import { closeSession, renameSession } from '@/lib/api'
import { formatCode, joinUrl } from '@/lib/code'
import { loadProfileName, saveProfileName, usePlatform } from '@/lib/store'
import { getApp, getVariant } from '@/lib/registry'
import type {
  AppEvent,
  ChatMsg,
  FileMeta,
  NoteDoc,
  Participant,
  Poll,
  RoomSnapshot,
  SessionInfo,
  Stroke,
  TextItem,
  DeviceType,
} from '@/lib/types'
import { BrandMark } from '@/components/platform/app-icon'
import { SessionGate } from '@/components/platform/session-gate'
import { BeamPanel } from '@/components/session/beam-panel'
import { DropPanel, type RoomFile } from '@/components/session/drop-panel'
import { FolderPanel } from '@/components/session/folder-panel'
import { CanvasPanel } from '@/components/session/canvas-panel'
import { RoundtablePanel } from '@/components/session/roundtable-panel'
import { ScreenPanel } from '@/components/session/screen-panel'
import { NotePanel } from '@/components/session/note-panel'
import { CallPanel, callConfigFor } from '@/components/session/call-panel'
import { CodeEditorPanel } from '@/components/session/code-editor-panel'
import { PresentPanel } from '@/components/session/present-panel'
import { ClickerPanel } from '@/components/session/clicker-panel'
import { CoBrowsePanel } from '@/components/session/cobrowse-panel'
import { LocationPanel } from '@/components/session/location-panel'
import { CaptionsPanel } from '@/components/session/captions-panel'
import { AssistPanel } from '@/components/session/assist-panel'
import { QuickPairPanel } from '@/components/session/quick-pair-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'
import { formatDistanceToNowStrict, intervalToDuration } from 'date-fns'
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Monitor,
  Pencil,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
  Tag,
  Timer,
  Users,
  WifiOff,
} from 'lucide-react'
import { cn, humanError } from '@/lib/utils'

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function deviceIcon(d: string) {
  const cls = 'size-3.5 shrink-0 text-muted-foreground'
  if (d === 'phone') return <Smartphone className={cls} aria-hidden="true" />
  if (d === 'tablet') return <Tablet className={cls} aria-hidden="true" />
  return <Monitor className={cls} aria-hidden="true" />
}

function initials(name: string): string {
  const clean = name.trim()
  return clean ? clean.slice(0, 2).toUpperCase() : 'G'
}

// ---------------------------------------------------------------------------

export function SessionView({ session }: { session: SessionInfo }) {
  const navigate = usePlatform((s) => s.navigate)
  const setActiveSession = usePlatform((s) => s.setActiveSession)
  const addRecent = usePlatform((s) => s.addRecent)

  const app = getApp(session.appId)
  // Sessions are created under variant ids ('drop', 'video-call', …); the
  // panel and its config must switch on that raw id, while display copy
  // resolves to the merged tool ("Beam").
  const rawId = session.appId
  const variantInfo = getVariant(session.appId)

  const clientRef = useRef<RoomClient | null>(null)
  const [clientReady, setClientReady] = useState(false)
  const [profileName, setProfileName] = useState<string>('')
  const [device] = useState<DeviceType>(() => detectDevice())
  const [connState, setConnState] = useState<ConnState>('connecting')
  // True browser connectivity, separate from the relay link: the connection
  // banner must never claim "you lost your internet" while the machine is
  // online and only the relay is out of reach (hosted relays wake up, and
  // misconfigured deployments are a config problem, not a network problem).
  const [netOnline, setNetOnline] = useState(true)
  const [selfId, setSelfId] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [texts, setTexts] = useState<TextItem[]>([])
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [files, setFiles] = useState<RoomFile[]>([])
  const [initialStrokes, setInitialStrokes] = useState<Stroke[]>([])
  const [initialDoc, setInitialDoc] = useState<NoteDoc | null>(null)
  // Persisted app events (slides, captions, markup, checklist state…) for the
  // panels that rebuild their world from history — same late-joiner contract.
  const [initialEvents, setInitialEvents] = useState<AppEvent[]>([])
  // Canvas and Notepad take their initial content from the join snapshot via a
  // useState initializer, so they must only mount once the snapshot arrived —
  // otherwise late joiners render an empty surface.
  const [roomStateLoaded, setRoomStateLoaded] = useState(false)
  const [ended, setEnded] = useState<'closed' | 'expired' | null>(null)
  const [owning, setOwning] = useState(false) // ending-session request in flight
  const sentIdsRef = useRef<Set<string>>(new Set())
  const wasConnectedRef = useRef(false)
  const pendingRejoinRef = useRef(false)
  const hadContentRef = useRef(false)
  // Retry queue: the originating File objects of this sender's failed transfers.
  // Files stay in memory until the transfer succeeds or the session view unmounts.
  const retrySourceRef = useRef<Map<string, { file: File; relPath?: string }>>(new Map())
  const replacingRef = useRef<Set<string>>(new Set())
  const retryingRef = useRef<Set<string>>(new Set())
  const [namePopoverOpen, setNamePopoverOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [qrOpen, setQrOpen] = useState(false)
  const [title, setTitle] = useState<string | null>(session.title)
  const [titleOpen, setTitleOpen] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)

  // Expiry countdown (ticks every 30s).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const expiredByTime = useMemo(
    () => new Date(session.expiresAt).getTime() <= now,
    [session.expiresAt, now],
  )
  useEffect(() => {
    if (expiredByTime && !ended) setEnded('expired')
  }, [expiredByTime, ended])

  const expiresIn = useMemo(() => {
    if (expiredByTime) return 'expired'
    const dur = intervalToDuration({
      start: now,
      end: new Date(session.expiresAt).getTime(),
    })
    const h = dur.hours ?? 0
    const m = dur.minutes ?? 0
    return h > 0 ? `${h} h ${m} min` : `${m} min`
  }, [expiredByTime, now, session.expiresAt])

  // ------------------------------------------------------------ relay wiring
  // Track the browser's real connectivity for honest banner copy.
  useEffect(() => {
    const update = () => setNetOnline(window.navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    const name = loadProfileName() || 'Guest'
    setProfileName(name)
    setNameDraft(name)
    sentIdsRef.current = new Set()
    // Kick the hosted relay's cold start the moment a session view opens —
    // by the time the person reads the room, the relay is usually awake.
    warmRelay()

    // The socket endpoint resolves before the client exists: build-time
    // inline first, then the runtime /api/relay-config answer, then the
    // sandbox gateway. Until it exists the calm gate holds the room.
    let disposed = false
    let client: RoomClient | null = null
    let offs: Array<() => void> = []

    void (async () => {
      const relayUrl = await resolveRelayUrl()
      if (disposed) return
      client = new RoomClient(session.code, { name, device }, relayUrl || undefined)
      clientRef.current = client
      setClientReady(true)

      offs = [
      client.on('conn', (s) => {
        const state = s as ConnState
        setConnState(state)
        if (state === 'connected') {
          wasConnectedRef.current = true
        } else if ((state === 'reconnecting' || state === 'offline') && wasConnectedRef.current) {
          pendingRejoinRef.current = true
        }
      }),
      client.on('state', (snap) => {
        const s = snap as RoomSnapshot
        setSelfId(s.selfId)
        setParticipants(s.participants)
        setTexts(s.texts)
        setChat(s.chat)
        setPolls(s.polls)
        setInitialStrokes(s.strokes)
        setInitialDoc(s.doc ?? null)
        setInitialEvents(Array.isArray(s.appEvents) ? s.appEvents : [])
        setRoomStateLoaded(true)
        // Honest reconnection feedback: if the relay restarted during the
        // outage, the fresh snapshot is empty and previously shared items are
        // gone — say so plainly instead of claiming everything "restored".
        if (pendingRejoinRef.current) {
          pendingRejoinRef.current = false
          const wiped =
            s.texts.length === 0 &&
            s.chat.length === 0 &&
            s.strokes.length === 0 &&
            s.files.length === 0 &&
            (Array.isArray(s.appEvents) ? s.appEvents.length : 0) === 0
          if (hadContentRef.current && wiped) {
            toast.info(
              'Back online. The session relay restarted during the outage, so everything shared before it is gone. Sessions are ephemeral by design.',
              { duration: 8000 },
            )
          } else {
            toast.success('Back online, the session has been restored.')
          }
        }
        const myClientId = getClientId()
        setFiles(
          s.files.map((f: FileMeta & { chunks?: (string | null)[] }) => ({
            ...f,
            chunks: f.chunks ?? new Array(f.chunkCount).fill(null),
            received: (f.chunks ?? []).filter(Boolean).length,
            mine: f.ownerId ? f.ownerId === myClientId : f.from === name && f.device === device,
          })),
        )
      }),
      client.on('joinerror', (r) => {
        const reason = String(r)
        if (reason === 'closed') {
          setEnded('closed')
        } else {
          toast.error('Could not join the session room; try rejoining from My Sessions.')
        }
      }),
      client.on('presence', (p) => {
        const pp = p as { participants: Participant[] }
        setParticipants(pp.participants)
      }),
      client.on('text', (t) => setTexts((prev) => [...prev, t as TextItem])),
      client.on('textcleared', () => setTexts([])),
      client.on('chat', (m) => setChat((prev) => [...prev, m as ChatMsg])),
      client.on('poll', (p) => {
        const poll = p as Poll
        setPolls((prev) => {
          const idx = prev.findIndex((x) => x.id === poll.id)
          if (idx === -1) return [...prev, poll]
          const next = [...prev]
          next[idx] = poll
          return next
        })
      }),
      client.on('filenew', (f) => {
        const meta = f as FileMeta
        const myClientId = getClientId()
        setFiles((prev) =>
          prev.some((x) => x.fileId === meta.fileId)
            ? prev
            : [
                ...prev,
                {
                  ...meta,
                  chunks: new Array(meta.chunkCount).fill(null),
                  received: 0,
                  mine: meta.ownerId ? meta.ownerId === myClientId : false,
                },
              ],
        )
      }),
      client.on('filechunk', (c) => {
        const { fileId, index, data } = c as { fileId: string; index: number; data: string }
        setFiles((prev) =>
          prev.map((f) => {
            if (f.fileId !== fileId) return f
            if (f.chunks[index] != null) return f
            const chunks = [...f.chunks]
            chunks[index] = data
            return { ...f, chunks, received: f.received + 1 }
          }),
        )
      }),
      client.on('filecomplete', (c) => {
        const { fileId } = c as { fileId: string }
        setFiles((prev) => prev.map((f) => (f.fileId === fileId ? { ...f, complete: true } : f)))
      }),
      client.on('fileremoved', (c) => {
        const { fileId } = c as { fileId: string }
        // A retry re-sends the same fileId: the removal is ours, the row stays.
        if (replacingRef.current.has(fileId)) {
          replacingRef.current.delete(fileId)
          return
        }
        setFiles((prev) => prev.filter((f) => f.fileId !== fileId))
      }),
      client.on('closed', () => setEnded('closed'))
      ]
    })()

    return () => {
      disposed = true
      offs.forEach((off) => off())
      client?.disconnect()
      clientRef.current = null
    }
  }, [session.code, device])

  // Remember whether this session ever held anything, so a post-reconnect
  // empty snapshot can be reported honestly ("relay restarted") vs "restored".
  useEffect(() => {
    if (texts.length > 0 || files.length > 0) hadContentRef.current = true
  }, [texts, files])

  // Files with a purpose `slot` (presentation slides) are managed by their own
  // tool — keep them out of the general file lists (Drop / Folder Share / Beam).
  const panelFiles = useMemo(() => files.filter((f) => f.slot !== 'presentation'), [files])

  // ------------------------------------------------------------- session actions
  const sendText = useCallback(
    async (content: string) => {
      const client = clientRef.current
      if (!client) return
      const id = uid()
      sentIdsRef.current.add(id)
      try {
        await client.sendText(id, content)
      } catch (err) {
        sentIdsRef.current.delete(id)
        throw err
      }
    },
    [],
  )

  const clearTexts = useCallback(async () => {
    const client = clientRef.current
    if (!client) return
    try {
      await client.clearTexts()
    } catch (err) {
      toast.error(humanError(err, 'Could not clear.'))
    }
  }, [])

  const sendFiles = useCallback(
    async (input: FileList | File[] | { file: File; relPath?: string }[]) => {
      const client = clientRef.current
      if (!client) return
      // Normalize: both plain files and folder items become {file, relPath}.
      const items = Array.from(input as ArrayLike<unknown>).map((raw) => {
        if (raw instanceof File) {
          const rp = (raw as File & { webkitRelativePath?: string }).webkitRelativePath
          return { file: raw, relPath: rp && rp.includes('/') ? rp : undefined }
        }
        return raw as { file: File; relPath?: string }
      })
      for (const { file, relPath } of items) {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`“${file.name}” is over the 50 MB per-file limit.`)
          continue
        }
        const fileId = uid()
        const chunkCount = Math.max(1, Math.ceil(file.size / CHUNK_SIZE))
        retrySourceRef.current.set(fileId, { file, relPath })
        setFiles((prev) => [
          ...prev,
          {
            fileId,
            name: file.name,
            relPath,
            ownerId: getClientId(),
            size: file.size,
            type: file.type || 'application/octet-stream',
            chunkCount,
            complete: false,
            from: profileName,
            device,
            at: new Date().toISOString(),
            chunks: new Array(chunkCount).fill(null),
            received: 0,
            mine: true,
            sendProgress: 0,
          },
        ])
        try {
          await client.sendFile(
            file,
            fileId,
            (sent, total) => {
              setFiles((prev) =>
                prev.map((f) => (f.fileId === fileId ? { ...f, sendProgress: sent / total } : f)),
              )
            },
            relPath,
          )
          setFiles((prev) => prev.map((f) => (f.fileId === fileId ? { ...f, complete: true } : f)))
          retrySourceRef.current.delete(fileId)
        } catch (err) {
          setFiles((prev) =>
            prev.map((f) =>
              f.fileId === fileId
                ? { ...f, error: err instanceof Error ? err.message : 'Transfer failed' }
                : f,
            ),
          )
        }
      }
    },
    [profileName, device],
  )

  const removeFile = useCallback(async (fileId: string) => {
    const client = clientRef.current
    if (!client) return
    try {
      await client.removeFile(fileId)
    } catch {
      setFiles((prev) => prev.filter((f) => f.fileId !== fileId))
    }
  }, [])

  // Retry a failed outgoing transfer from the queue. The relay's file:remove
  // first frees the room quota the failed entry still holds, then the same
  // fileId goes out again (file:start resets the entry on every device).
  const retryFile = useCallback(async (fileId: string) => {
    const client = clientRef.current
    const src = retrySourceRef.current.get(fileId)
    if (!client || !src || retryingRef.current.has(fileId)) return
    retryingRef.current.add(fileId)
    const { file, relPath } = src
    setFiles((prev) =>
      prev.map((f) =>
        f.fileId === fileId
          ? {
              ...f,
              error: undefined,
              sendProgress: 0,
              received: 0,
              chunks: new Array(f.chunkCount).fill(null),
            }
          : f,
      ),
    )
    try {
      replacingRef.current.add(fileId)
      await client.removeFile(fileId).catch(() => undefined)
      await client.sendFile(
        file,
        fileId,
        (sent, total) => {
          setFiles((prev) =>
            prev.map((f) => (f.fileId === fileId ? { ...f, sendProgress: sent / total } : f)),
          )
        },
        relPath,
      )
      setFiles((prev) => prev.map((f) => (f.fileId === fileId ? { ...f, complete: true, error: undefined } : f)))
      retrySourceRef.current.delete(fileId)
      toast.success(`“${file.name}” sent.`)
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.fileId === fileId
            ? { ...f, error: err instanceof Error ? err.message : 'Transfer failed' }
            : f,
        ),
      )
      toast.error(`“${file.name}” failed again. Keep the tab open and try once more.`)
    } finally {
      replacingRef.current.delete(fileId)
      retryingRef.current.delete(fileId)
    }
  }, [])

  // Drain the queue: retry every failed transfer that originated here.
  const retryFailedFiles = useCallback(async () => {
    const failed = files.filter((f) => f.error && f.mine).map((f) => f.fileId)
    for (const fileId of failed) {
      await retryFile(fileId)
    }
  }, [files, retryFile])

  const endSession = useCallback(async () => {
    setOwning(true)
    try {
      await closeSession(session.code)
      setEnded('closed')
    } catch (err) {
      toast.error(humanError(err, 'Could not end the session.'))
    } finally {
      setOwning(false)
    }
  }, [session.code])

  const leave = useCallback(() => {
    navigate(app ? { name: 'app', appId: app.id } : { name: 'home' })
  }, [navigate, app])

  const applyName = useCallback(() => {
    const name = nameDraft.trim().slice(0, 24) || 'Guest'
    setProfileName(name)
    saveProfileName(name === 'Guest' ? '' : name)
    clientRef.current?.rename(name)
    setNamePopoverOpen(false)
  }, [nameDraft])

  // Save (or clear) the optional session title — cosmetic metadata shown in
  // My Sessions and on this device only for recents; stored on the session row.
  const saveTitle = useCallback(
    async (next: string) => {
      setSavingTitle(true)
      try {
        const updated = await renameSession(session.code, next)
        setTitle(updated.title)
        setActiveSession(updated)
        addRecent({
          code: updated.code,
          appId: updated.appId,
          title: updated.title,
          createdAt: updated.createdAt,
          expiresAt: updated.expiresAt,
        })
        setTitleOpen(false)
        toast.success(updated.title ? 'Session title saved.' : 'Session title removed.')
      } catch (err) {
        toast.error(humanError(err, 'Could not save the title.'))
      } finally {
        setSavingTitle(false)
      }
    },
    [session.code, setActiveSession, addRecent],
  )

  function copyText(value: string, label: string) {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`${label} copied.`))
      .catch(() => toast.error('Your browser blocked clipboard access, copy manually instead.'))
  }

  // ------------------------------------------------------------------ render
  if (!app) return null

  const code = formatCode(session.code)
  const url = joinUrl(session.code)

  if (ended) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:py-24 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border bg-muted/50 text-muted-foreground">
          <Timer className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight sm:text-2xl">
          {ended === 'closed' ? 'This session was ended' : 'This session expired'}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Everything inside it (text, files, boards and chats) has been discarded. Starting a
          new session takes one click.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Button
            onClick={async () => {
              try {
                const { createSession } = await import('@/lib/api')
                const fresh = await createSession(session.appId)
                setActiveSession(fresh)
                addRecent({
                  code: fresh.code,
                  appId: fresh.appId,
                  title: fresh.title,
                  createdAt: fresh.createdAt,
                  expiresAt: fresh.expiresAt,
                })
                navigate({ name: 'session', code: fresh.code })
              } catch {
                toast.error('Could not create a new session.')
              }
            }}
          >
            Start a new session
          </Button>
          <Button variant="outline" onClick={() => navigate({ name: 'app', appId: app.id })}>
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to {app.name}
          </Button>
        </div>
      </div>
    )
  }

  const connMeta: Record<ConnState, { label: string; className: string; icon: React.ReactNode }> = {
    connecting: { label: 'Connecting…', className: 'bg-muted text-muted-foreground', icon: <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> },
    connected: {
      label: 'Connected',
      className: 'bg-primary/10 text-primary',
      icon: (
        <span className="relative flex size-2.5" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-40" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
      ),
    },
    reconnecting: { label: 'Reconnecting…', className: 'bg-warning/15 text-warning-foreground', icon: <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" /> },
    offline: {
      label: netOnline ? 'Relay unreachable' : 'Offline',
      className: 'bg-destructive/10 text-destructive',
      icon: <WifiOff className="size-3.5" aria-hidden="true" />,
    },
    closed: { label: 'Ended', className: 'bg-muted text-muted-foreground', icon: <Timer className="size-3.5" aria-hidden="true" /> },
  }
  const conn = connMeta[connState]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* ------------------------------------------------------------ header */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button variant="ghost" size="sm" className="-ml-1 h-8 gap-1.5 text-muted-foreground" onClick={leave}>
          <ArrowLeft className="size-4" aria-hidden="true" /> {app.name}
        </Button>
        {variantInfo?.app.variants?.length ? (
          <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground" title={variantInfo.variant.tagline}>
            {variantInfo.variant.name}
          </span>
        ) : null}
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-300',
            conn.className,
          )}
          role="status"
          aria-live="polite"
          title={
            connState === 'connected'
              ? 'Direct session link is up, everything syncs instantly'
              : connState === 'reconnecting' || connState === 'offline'
                ? netOnline
                  ? 'The relay link dropped; we bring the session back automatically'
                  : 'You are offline; we rejoin the session when the internet is back'
                : connState === 'connecting'
                  ? 'Reaching the session…'
                  : 'This session has ended'
          }
        >
          {conn.icon} {conn.label}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <QrCode className="size-4" aria-hidden="true" /> Share
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <p className="text-sm font-semibold">Invite devices</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Scan, open the link, or type the code. No account needed.
            </p>
            <div className="mx-auto mt-3 w-fit rounded-lg border bg-white p-2.5">
              <QRCode value={url} size={148} aria-label={`QR code for session ${code}`} />
            </div>
            <p className="mt-3 text-center font-mono text-lg tracking-[0.25em]">{code}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => copyText(url, 'Invite link')}>
                <Copy className="size-3.5" aria-hidden="true" /> Link
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyText(session.code, 'Code')}>
                <Copy className="size-3.5" aria-hidden="true" /> Code
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-destructive hover:text-destructive">
              End
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End this session for everyone?</AlertDialogTitle>
              <AlertDialogDescription>
                All devices are removed immediately and everything inside (text, files, boards,
                chats) is discarded. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it open</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  endSession()
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={owning}
              >
                {owning ? 'Ending…' : 'End session'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* --------------------------------------------------------- session bar */}
      <Card className="mt-4">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {app.name}
              {variantInfo?.app.variants?.length ? (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  · {variantInfo.variant.name}
                </span>
              ) : null}
            </p>
              <Popover open={titleOpen} onOpenChange={(o) => { setTitleOpen(o); if (o) setTitleDraft(title ?? '') }}>
                <PopoverTrigger asChild>
                  <button
                    className="group/title mt-1 flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={title ? `Edit session title: ${title}` : 'Add a session title'}
                  >
                    <Tag className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <span
                      className={cn(
                        'truncate text-xs',
                        title ? 'font-medium text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {title ?? 'Add a title'}
                    </span>
                    <Pencil
                      className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100"
                      aria-hidden="true"
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80">
                  <p className="text-sm font-semibold">Session title</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Optional. Helps everyone recognize this session, and it shows next to the code on
                    join screens and in My Sessions.
                  </p>
                  <Input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value.slice(0, 80))}
                    placeholder="e.g. Design review files"
                    aria-label="Session title"
                    maxLength={80}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !savingTitle) void saveTitle(titleDraft)
                    }}
                    className="mt-3"
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => void saveTitle(titleDraft)}
                      disabled={savingTitle || titleDraft.trim().length === 0}
                    >
                      {savingTitle ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="size-4" aria-hidden="true" />
                      )}
                      Save
                    </Button>
                    {title && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => void saveTitle('')}
                        disabled={savingTitle}
                      >
                        Remove
                      </Button>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {titleDraft.length}/80
                    </span>
                  </div>
                </PopoverContent>
              </Popover>
              <p className="mt-1 text-xs text-muted-foreground">
                Started {formatDistanceToNowStrict(new Date(session.createdAt), { addSuffix: true })}
              </p>
          </div>

          <div className="flex items-center gap-2 sm:ml-2">
            <button
              onClick={() => copyText(session.code, 'Code')}
              className="group rounded-lg border bg-muted/40 px-3 py-2 text-center focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`Copy session code ${code}`}
              title="Copy code"
            >
              <span className="block font-mono text-lg font-semibold tracking-[0.25em] sm:text-xl">
                {code}
              </span>
              <span className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground group-hover:text-foreground">
                <Copy className="size-3" aria-hidden="true" /> tap to copy
              </span>
            </button>
            <Button
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              aria-label="Show QR code and invite link"
              onClick={() => setQrOpen(true)}
            >
              <QrCode className="size-5" aria-hidden="true" />
            </Button>
          </div>

          <div className="flex items-center gap-4 sm:ml-auto">
            <Popover open={namePopoverOpen} onOpenChange={setNamePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-2.5 rounded-lg px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label="Edit your name"
                  title="Edit your name"
                >
                  <div className="flex -space-x-1.5">
                    {participants.slice(0, 4).map((p) => (
                      <span
                        key={p.id}
                        className={cn(
                          'flex size-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold',
                          p.id === selfId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                        )}
                        title={`${p.name} (${p.device})`}
                      >
                        {initials(p.name)}
                      </span>
                    ))}
                    {participants.length > 4 && (
                      <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground">
                        +{participants.length - 4}
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="size-3.5" aria-hidden="true" />
                    {participants.length}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                <p className="text-sm font-semibold">You are “{profileName}”</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Change how others see you in this session.
                </p>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value.slice(0, 24))}
                    placeholder="Guest"
                    aria-label="Your name in this session"
                    onKeyDown={(e) => e.key === 'Enter' && applyName()}
                  />
                  <Button size="sm" onClick={applyName}>
                    <Check className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <ul className="mt-3 space-y-1.5 border-t pt-3">
                  {participants.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      {deviceIcon(p.device)}
                      <span className="font-medium text-foreground">{p.name}</span>
                      {p.id === selfId && <span className="text-primary">· you</span>}
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Timer className="size-3.5" aria-hidden="true" /> Self-destructs in {expiresIn}
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" aria-hidden="true" /> Nothing is stored after it ends
          </span>
          <span className="flex items-center gap-1.5">
            <KeyRound className="size-3.5" aria-hidden="true" /> Anyone with the code can join
          </span>
        </div>
      </Card>

      {/* ------------------------------------------------- connection banner */}
      {(connState === 'reconnecting' || connState === 'offline') && (
        <div
          role="alert"
          aria-live="assertive"
          className={cn(
            'mt-4 flex items-start gap-3 overflow-hidden rounded-xl border px-4 py-3.5 text-sm shadow-sm',
            connState === 'offline'
              ? 'border-destructive/40 bg-destructive/5 text-destructive'
              : 'border-warning/40 bg-warning/10 text-warning-foreground',
          )}
        >
          <span
            className={cn(
              'relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border',
              connState === 'offline'
                ? 'border-destructive/30 bg-destructive/10'
                : 'border-warning/30 bg-warning/10',
            )}
          >
            {connState === 'offline' ? (
              <WifiOff className="size-4 animate-pulse" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {connState === 'offline'
                ? netOnline
                  ? 'Can’t reach the session relay'
                  : 'You lost your internet connection'
                : 'Connection hiccup, getting you back in…'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed opacity-80">
              {connState === 'offline' && netOnline ? (
                relayMisconfigured() ? (
                  <>Your connection is fine, but this deployment has no relay URL configured, so
                  sessions cannot connect. Set <code className="font-mono">RELAY_URL</code> (or{' '}
                  <code className="font-mono">NEXT_PUBLIC_RELAY_URL</code>) on the app host and
                  redeploy, then rejoin this session.</>
                ) : (
                  <>Your connection is fine — the relay is out of reach. If it was idle it is
                  waking up right now; we keep retrying and rejoin this session automatically,
                  usually within a minute.</>
                )
              ) : (
                `We rejoin this session automatically, with no reload and no new code. Device-to-device
                media in calls keeps flowing meanwhile, but new devices can’t join and chat
                pauses until the line is back.`
              )}
            </p>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------- panel */}
      <div className="mt-5">
        {/* Until the client exists, or while Canvas/Notepad wait for the join
            snapshot, hold the room with the calm gate instead of a hole. */}
        {(!clientReady ||
          ((rawId === 'canvas' || rawId === 'shared-docs') && !roomStateLoaded)) && (
          <SessionGate appId={app.id} code={session.code} compact />
        )}
        {clientReady && rawId === 'beam' && (
          <BeamPanel client={clientRef.current} texts={texts} sentIdsRef={sentIdsRef} onSend={sendText} onClear={clearTexts} connected={connState === 'connected'} />
        )}
        {clientReady && rawId === 'drop' && (
          <DropPanel
            files={panelFiles}
            onSendFiles={sendFiles}
            onRemove={removeFile}
            onRetry={retryFile}
            onRetryAll={retryFailedFiles}
            connected={connState === 'connected'}
          />
        )}
        {clientReady && rawId === 'folder-share' && (
          <FolderPanel
            files={panelFiles}
            onSendItems={sendFiles}
            onRemove={removeFile}
            onRetry={retryFile}
            onRetryAll={retryFailedFiles}
            connected={connState === 'connected'}
          />
        )}
        {clientReady && roomStateLoaded && rawId === 'canvas' && (
          <CanvasPanel client={clientRef.current} initialStrokes={initialStrokes} connected={connState === 'connected'} />
        )}
        {clientReady && rawId === 'roundtable' && (
          <RoundtablePanel
            client={clientRef.current}
            chat={chat}
            polls={polls}
            participants={participants}
            selfId={selfId}
            connected={connState === 'connected'}
          />
        )}
        {clientReady && roomStateLoaded && rawId === 'shared-docs' && (
          <NotePanel
            client={clientRef.current}
            initialDoc={initialDoc}
            participants={participants}
            selfId={selfId}
            connected={connState === 'connected'}
          />
        )}
        {clientReady && (rawId === 'screen-share' || rawId === 'screen-to-phone') && (
          <ScreenPanel
            client={clientRef.current}
            selfId={selfId}
            participants={participants}
            connected={connState === 'connected'}
          />
        )}
        {clientReady && callConfigFor(rawId) && (
          <CallPanel
            client={clientRef.current}
            config={callConfigFor(rawId)!}
            selfId={selfId}
            participants={participants}
            chat={chat}
            connected={connState === 'connected'}
          />
        )}
        {clientReady && roomStateLoaded && rawId === 'code-editor' && (
          <CodeEditorPanel
            client={clientRef.current}
            selfId={selfId}
            participants={participants}
            initialEvents={initialEvents}
            connected={connState === 'connected'}
            isHost={participants[0]?.id === selfId}
            profileName={profileName}
            device={device}
          />
        )}
        {clientReady && roomStateLoaded && rawId === 'live-present' && (
          <PresentPanel
            client={clientRef.current}
            selfId={selfId}
            participants={participants}
            initialEvents={initialEvents}
            connected={connState === 'connected'}
            isHost={participants[0]?.id === selfId}
            profileName={profileName}
            device={device}
            files={files}
            sessionCode={session.code}
          />
        )}
        {clientReady && roomStateLoaded && rawId === 'presentation-clicker' && (
          <ClickerPanel
            client={clientRef.current}
            selfId={selfId}
            participants={participants}
            initialEvents={initialEvents}
            connected={connState === 'connected'}
            isHost={participants[0]?.id === selfId}
            profileName={profileName}
            device={device}
          />
        )}
        {clientReady && roomStateLoaded && rawId === 'co-browse' && (
          <CoBrowsePanel
            client={clientRef.current}
            selfId={selfId}
            participants={participants}
            initialEvents={initialEvents}
            connected={connState === 'connected'}
            isHost={participants[0]?.id === selfId}
            profileName={profileName}
            device={device}
          />
        )}
        {clientReady && roomStateLoaded && rawId === 'location-share' && (
          <LocationPanel
            client={clientRef.current}
            selfId={selfId}
            participants={participants}
            initialEvents={initialEvents}
            connected={connState === 'connected'}
            isHost={participants[0]?.id === selfId}
            profileName={profileName}
            device={device}
            sessionCode={session.code}
          />
        )}
        {clientReady && roomStateLoaded && rawId === 'live-captions' && (
          <CaptionsPanel
            client={clientRef.current}
            selfId={selfId}
            participants={participants}
            initialEvents={initialEvents}
            connected={connState === 'connected'}
            isHost={participants[0]?.id === selfId}
            profileName={profileName}
            device={device}
          />
        )}
        {clientReady && roomStateLoaded &&
          (rawId === 'remote-assist' || rawId === 'guided-pointer' || rawId === 'support-session') && (
          <AssistPanel
            client={clientRef.current}
            selfId={selfId}
            participants={participants}
            initialEvents={initialEvents}
            connected={connState === 'connected'}
            isHost={participants[0]?.id === selfId}
            profileName={profileName}
            device={device}
            variant={rawId as 'remote-assist' | 'guided-pointer' | 'support-session'}
          />
        )}
        {clientReady && rawId === 'quick-pair' && (
          <QuickPairPanel
            client={clientRef.current}
            selfId={selfId}
            participants={participants}
            initialEvents={initialEvents}
            connected={connState === 'connected'}
            isHost={participants[0]?.id === selfId}
            profileName={profileName}
            device={device}
            texts={texts}
            onSendText={sendText}
            onClearTexts={clearTexts}
            files={panelFiles}
            onSendFiles={sendFiles}
            onRemoveFile={removeFile}
          />
        )}
      </div>

      {/* ----------------------------------------------------------- QR dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrandMark className="size-5 text-primary" variant="mono" aria-hidden="true" />
              Open this session on another device
            </DialogTitle>
            <DialogDescription>
              {title
                ? `“${title}”. Scan with a phone camera, or open the link on the other device.`
                : 'Scan with a phone camera, or open the link on the other device.'}
            </DialogDescription>
          </DialogHeader>
          <div className="mx-auto rounded-xl border bg-white p-3">
            <QRCode value={url} size={196} aria-label={`QR code for session ${code}`} />
          </div>
          <p className="text-center font-mono text-2xl tracking-[0.3em]">{code}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => copyText(url, 'Invite link')}>
              <Copy className="size-4" aria-hidden="true" /> Copy link
            </Button>
            <Button variant="outline" onClick={() => copyText(session.code, 'Code')}>
              <Copy className="size-4" aria-hidden="true" /> Copy code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
