'use client'

// CoBrowsePanel — Collaborative Browsing: one shared page for the whole
// session. Anyone pastes a link, every device's embedded frame navigates
// together; a pointer mode lets a device point at things on the shared page
// for everyone else; a notes strip collects quick annotations.
//
// Sync protocol (via RoomClient app events):
//   'browse:url'     persisted {url}        → everyone navigates (late joiners rebuild from history)
//   'browse:pointer' volatile {x,y,gone?}   → live pointer dot, normalized 0..1 (never echoed to sender)
//   'browse:note'    persisted {text}       → session notes list
//
// Persisted events are echoed to everyone including the sender — own echoes
// are skipped here because state was applied optimistically at send time.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RoomClient } from '@/lib/room-client'
import type { AppEvent, DeviceType, Participant } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ArrowUpRight,
  ExternalLink,
  Globe,
  History,
  Info,
  MousePointer2,
  Send,
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

/** Stable hue 0..359 derived from a participant id (pointer dot color). */
function hueFor(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % 360
}

/** Validate as http(s) URL, adding https:// when the scheme is missing. */
function normalizeUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const u = new URL(candidate)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

function linkLabel(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/$/, '')
    return path && path !== '/' ? `${u.hostname}${path}` : u.hostname
  } catch {
    return url
  }
}

// ------------------------------------------------------------------- consts

const POINTER_TTL_MS = 1500 // remote dots linger 1.5s after each move
const POINTER_SEND_INTERVAL_MS = 80
const MAX_NOTES = 50
const MAX_HISTORY = 40
const VISIBLE_BACK_CHIPS = 10

interface HistoryEntry {
  url: string
  by: string
  at: string
}

interface BrowseNote {
  id: string
  text: string
  by: string
  at: string
  mine: boolean
}

interface RemotePointer {
  x: number
  y: number
  at: number
  name: string
  hue: number
}

interface CoBrowsePanelProps {
  client: RoomClient | null
  selfId: string
  participants: Participant[]
  /** Persisted events from the join snapshot — rebuild url + notes for late joiners. */
  initialEvents: AppEvent[]
  connected: boolean
  isHost: boolean
  profileName: string
  device: DeviceType
}

export function CoBrowsePanel({
  client,
  selfId,
  participants,
  initialEvents,
  connected,
  profileName,
}: CoBrowsePanelProps) {
  // ------------------------------------------------------------------- state
  const [current, setCurrent] = useState('')
  const [draft, setDraft] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [notes, setNotes] = useState<BrowseNote[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [pointerMode, setPointerMode] = useState(false)
  const [pointers, setPointers] = useState<Record<string, RemotePointer>>({})

  const lastPointerSentRef = useRef(0)
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const rebuiltRef = useRef(false)

  // ------------------------------------------------- rebuild from snapshot
  useEffect(() => {
    if (rebuiltRef.current) return
    rebuiltRef.current = true
    // Defer to a microtask: applying the snapshot is a one-time hydration, not
    // an effect-driven state sync — avoids a synchronous cascading render.
    queueMicrotask(() => {
      const hist: HistoryEntry[] = []
      const ns: BrowseNote[] = []
      for (const ev of initialEvents) {
        if (ev.type === 'browse:url') {
          const p = asRecord(ev.payload)
          const url = typeof p?.url === 'string' ? p.url : ''
          if (url && hist[hist.length - 1]?.url !== url) {
            hist.push({ url, by: ev.name, at: ev.at })
          }
        } else if (ev.type === 'browse:note') {
          const p = asRecord(ev.payload)
          const text = typeof p?.text === 'string' ? p.text.trim() : ''
          if (text) ns.unshift({ id: uid(), text, by: ev.name, at: ev.at, mine: ev.from === selfId })
        }
      }
      setHistory(hist.slice(-MAX_HISTORY))
      const last = hist[hist.length - 1]
      if (last) setCurrent(last.url)
      setNotes(ns.slice(0, MAX_NOTES))
    })
  }, [initialEvents, selfId])

  // -------------------------------------------------------- remote app events
  useEffect(() => {
    if (!client) return
    return client.on('appevent', (raw) => {
      const ev = raw as AppEvent
      if (ev.from === selfId) return // own echoes — applied optimistically at send time

      if (ev.type === 'browse:url') {
        const p = asRecord(ev.payload)
        const url = typeof p?.url === 'string' ? p.url : ''
        if (!url) return
        setCurrent(url)
        setHistory((prev) => {
          const next =
            prev[prev.length - 1]?.url === url
              ? prev
              : [...prev, { url, by: ev.name, at: ev.at }]
          return next.slice(-MAX_HISTORY)
        })
        return
      }

      if (ev.type === 'browse:note') {
        const p = asRecord(ev.payload)
        const text = typeof p?.text === 'string' ? p.text.trim() : ''
        if (!text) return
        setNotes((prev) =>
          [{ id: uid(), text, by: ev.name, at: ev.at, mine: false }, ...prev].slice(0, MAX_NOTES),
        )
        return
      }

      if (ev.type === 'browse:pointer') {
        const p = asRecord(ev.payload)
        if (!p) return

        // Pointer left the shared page — clear that device's dot immediately.
        if (p.gone === true) {
          setPointers((prev) => {
            if (!(ev.from in prev)) return prev
            const next = { ...prev }
            delete next[ev.from]
            return next
          })
          return
        }

        const x = typeof p.x === 'number' ? p.x : null
        const y = typeof p.y === 'number' ? p.y : null
        if (x == null || y == null) return
        const clampedX = Math.min(1, Math.max(0, x))
        const clampedY = Math.min(1, Math.max(0, y))
        const at = Date.now()
        setPointers((prev) => ({
          ...prev,
          [ev.from]: { x: clampedX, y: clampedY, at, name: ev.name, hue: hueFor(ev.from) },
        }))
        const t = setTimeout(() => {
          timersRef.current.delete(t)
          setPointers((prev) => {
            const cur = prev[ev.from]
            if (!cur || cur.at !== at) return prev // a newer move already replaced it
            const next = { ...prev }
            delete next[ev.from]
            return next
          })
        }, POINTER_TTL_MS)
        timersRef.current.add(t)
      }
    })
  }, [client, selfId])

  // ------------------------------------------------------------- cleanup
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const t of timers) clearTimeout(t)
      timers.clear()
    }
  }, [])

  // ---------------------------------------------------------------- actions
  const navigate = useCallback(
    async (url: string) => {
      const c = client
      if (!c) {
        toast.error('Not connected to the session yet.')
        return
      }
      // "Do it first" — navigate this device immediately, then announce.
      setCurrent(url)
      setHistory((prev) =>
        prev[prev.length - 1]?.url === url
          ? prev
          : [...prev, { url, by: profileName, at: new Date().toISOString() }].slice(-MAX_HISTORY),
      )
      try {
        await c.sendAppEvent('browse:url', { url }, { persist: true })
      } catch {
        toast.error('Could not share the link, check the connection.')
      }
    },
    [client, profileName],
  )

  function onSubmitUrl(e: React.FormEvent) {
    e.preventDefault()
    const url = normalizeUrl(draft)
    if (!url) {
      toast.error('Enter a valid http(s) link, e.g. en.wikipedia.org/wiki/Cat.')
      return
    }
    setDraft('')
    void navigate(url)
  }

  /** Throttled pointer broadcast (volatile — never echoed back to the sender). */
  const sendPointer = useCallback(
    (x: number, y: number, gone: boolean) => {
      const c = client
      if (!c) return
      const nowMs = Date.now()
      if (!gone && nowMs - lastPointerSentRef.current < POINTER_SEND_INTERVAL_MS) return
      lastPointerSentRef.current = nowMs
      void c
        .sendAppEvent('browse:pointer', gone ? { x, y, gone: true } : { x, y })
        .catch(() => undefined)
    },
    [client],
  )

  function onOverlayMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    sendPointer(x, y, false)
  }

  function onOverlayLeave() {
    sendPointer(0, 0, true)
  }

  async function sendNote() {
    const text = noteDraft.trim()
    const c = client
    if (!text || !c) return
    setNoteDraft('')
    // Optimistic — own persisted echo is skipped in the listener.
    setNotes((prev) =>
      [
        { id: uid(), text, by: profileName, at: new Date().toISOString(), mine: true },
        ...prev,
      ].slice(0, MAX_NOTES),
    )
    try {
      await c.sendAppEvent('browse:note', { text }, { persist: true })
    } catch {
      toast.error('Could not post the note, check the connection.')
    }
  }

  // ---------------------------------------------------------------- derived
  const backLinks = useMemo(() => {
    const earlier = history.slice(0, -1) // everything except the current (last) page
    return earlier.slice(-VISIBLE_BACK_CHIPS).reverse() // most recent first
  }, [history])

  const canSend = connected && Boolean(client)

  // ------------------------------------------------------------------ render
  return (
    <div className="space-y-4">
      {/* ------------------------------------------- main action: take everyone */}
      <Card>
        <CardContent className="p-4">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSubmitUrl}>
            <div className="relative flex-1">
              <Globe
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="url"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste a link, everyone lands on it together"
                className="h-12 pl-9 text-base"
                aria-label="Address to open for everyone"
                disabled={!canSend}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={!canSend || !draft.trim()}
              className="h-12 gap-2 bg-primary px-6 text-base font-semibold text-black hover:bg-positive"
            >
              <ArrowUpRight className="size-5" aria-hidden="true" />
              Take everyone here
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- back-to chips */}
      {backLinks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Earlier shared links">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <History className="size-3.5" aria-hidden="true" /> Back to:
          </span>
          {backLinks.map((h) => (
            <button
              key={`${h.at}-${h.url}`}
              type="button"
              onClick={() => void navigate(h.url)}
              title={`Reopen ${h.url} for everyone`}
              className="max-w-[260px] truncate rounded-full border bg-muted/50 px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              {linkLabel(h.url)}
            </button>
          ))}
        </div>
      )}

      {/* -------------------------------------------------------- shared stage */}
      <Card className="overflow-hidden border-none bg-stage p-0 text-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-stage-border bg-stage-soft/70 px-4 py-2.5">
          <p className="text-sm font-semibold">Shared page</p>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-stage-muted">
            <Users className="size-3" aria-hidden="true" />
            {participants.length} on the page
          </span>
          {current && (
            <span
              className="max-w-[240px] truncate text-[11px] text-stage-muted"
              title={current}
            >
              {linkLabel(current)}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Switch
              id="cobrowse-pointer-mode"
              checked={pointerMode}
              onCheckedChange={setPointerMode}
              disabled={!canSend || !current}
              aria-label="Show my pointer to others"
            />
            <label
              htmlFor="cobrowse-pointer-mode"
              className="cursor-pointer select-none text-xs font-medium text-stage-muted"
            >
              <MousePointer2 className="mr-1 inline size-3.5 text-positive" aria-hidden="true" />
              Show my pointer to others
            </label>
          </div>
        </div>

        <CardContent className="p-4">
          <div className="relative overflow-hidden bg-stage-soft">
            {current ? (
              <iframe
                key={current}
                src={current}
                title="Shared page"
                className="h-[520px] w-full rounded-xl border bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-[520px] flex-col items-center justify-center gap-2 text-center">
                <p className="max-w-xs text-sm text-stage-muted/70">
                  Nothing open yet. Paste a link above and every device here loads it together.
                </p>
              </div>
            )}

            {/* remote pointer dots */}
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              {Object.entries(pointers).map(([id, ptr]) => (
                <span
                  key={id}
                  className="absolute flex items-center"
                  style={{ left: `${ptr.x * 100}%`, top: `${ptr.y * 100}%` }}
                >
                  <span
                    className="size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      backgroundColor: `hsl(${ptr.hue} 75% 55%)`,
                      boxShadow: `0 0 14px 5px hsl(${ptr.hue} 90% 60% / 0.65)`,
                    }}
                  />
                  <span className="max-w-[140px] truncate rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {ptr.name}
                  </span>
                </span>
              ))}
            </div>

            {/* pointer capture overlay — blocks iframe interaction while pointing */}
            {pointerMode && current && (
              <div
                role="application"
                aria-label="Pointer broadcast surface, your moves are shown to everyone"
                className="absolute inset-0 z-10 cursor-crosshair"
                onPointerMove={onOverlayMove}
                onPointerLeave={onOverlayLeave}
              />
            )}
          </div>

          {/* permanent embed helper */}
          <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-dashed border-stage-border bg-stage-soft/60 px-4 py-3 sm:flex-row sm:items-center">
            <Info className="size-4 shrink-0 text-positive" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-stage-muted">
              If the page stays blank, the site refuses embedding. Open it in a new tab.
              Browsing stays synced either way: whenever someone here opens a link, the whole
              session moves with them.
            </p>
            {current && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="shrink-0 gap-1.5 border-stage-border bg-stage-soft text-stage-foreground hover:bg-stage-raised hover:text-white"
              >
                <a href={current} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" aria-hidden="true" /> Open in new tab
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ notes */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
            <p className="text-sm font-semibold">Page notes</p>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {notes.length} note{notes.length === 1 ? '' : 's'}
            </span>
          </div>
          <form
            className="flex gap-2 border-b px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault()
              void sendNote()
            }}
          >
            <Input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Add a note for this page, visible to everyone"
              className="h-9"
              maxLength={500}
              aria-label="Page note"
              disabled={!canSend}
            />
            <Button
              size="sm"
              type="submit"
              className="h-9 px-3"
              disabled={!canSend || !noteDraft.trim()}
              aria-label="Post note"
            >
              <Send className="size-4" aria-hidden="true" />
            </Button>
          </form>
          <div className="max-h-96 min-h-16 space-y-2 overflow-y-auto px-4 py-3">
            {notes.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No notes yet. Drop timestamps, names, or anything worth remembering while you
                browse.
              </p>
            )}
            {notes.slice(0, MAX_NOTES).map((n) => (
              <div
                key={n.id}
                className={cn('rounded-lg px-3 py-2', n.mine ? 'bg-primary/10' : 'bg-muted/60')}
              >
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {n.mine ? 'You' : n.by}
                  <span className="ml-1.5 font-normal">
                    {new Date(n.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
                <p className="mt-0.5 break-words text-sm">{n.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
