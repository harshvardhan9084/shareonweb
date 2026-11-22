'use client'

// Pair Code Editor — a collaborative code editor for the session.
//
// Everyone shares one document. Edits are debounced and broadcast with the
// revision they started from; remote saves are only applied when the local
// user pauses typing (the same idle-window pattern the shared Notepad uses),
// so two people can type at the same time without words being cut mid-edit.
//
// Sync protocol (RoomClient app events):
//   'code:doc'          persisted {content, lang, rev}       the shared document
//   'code:cursor'       volatile  {line}                     caret line broadcast
//   'code:history:save' persisted {id, label, content, lang} named snapshot
//   'code:history:del'  persisted {id}                       remove a snapshot
//   'code:lock'         persisted {locked}                   host read-only lock
//
// The relay caps each event payload at 48 KB: snapshots are limited to a safe
// subset, and oversized documents fall back to a clear toast instead of dying
// silently. Late joiners rebuild doc + history + lock from the join snapshot.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactElement, SyntheticEvent, UIEvent } from 'react'
import type { RoomClient } from '@/lib/room-client'
import type { AppEvent, DeviceType, Participant } from '@/lib/types'
import { Prism as SyntaxHighlighterPrimitive } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Camera,
  Check,
  Code2,
  CloudUpload,
  Copy,
  Download,
  History,
  Loader2,
  Lock,
  Monitor,
  RotateCcw,
  Smartphone,
  Tablet,
  Trash2,
  Users,
} from 'lucide-react'

const SAVE_DEBOUNCE_MS = 500
const IDLE_WINDOW_MS = 1200 // remote merges wait until local typing paused this long
const CURSOR_THROTTLE_MS = 400
const CURSOR_TTL_MS = 6000
const MAX_CODE_CHARS = 100_000
const MAX_SNAPSHOT_CHARS = 20_000 // stays comfortably under the 48 KB relay cap
const GUTTER_MAX_LINES = 5000

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', prism: 'javascript', ext: 'js' },
  { id: 'typescript', label: 'TypeScript', prism: 'typescript', ext: 'ts' },
  { id: 'python', label: 'Python', prism: 'python', ext: 'py' },
  { id: 'html', label: 'HTML', prism: 'markup', ext: 'html' },
  { id: 'css', label: 'CSS', prism: 'css', ext: 'css' },
  { id: 'json', label: 'JSON', prism: 'json', ext: 'json' },
  { id: 'sql', label: 'SQL', prism: 'sql', ext: 'sql' },
  { id: 'text', label: 'Plain text', prism: 'text', ext: 'txt' },
] as const

type CodeLang = (typeof LANGUAGES)[number]['id']

function isLang(v: string): v is CodeLang {
  return LANGUAGES.some((l) => l.id === v)
}

const CURSOR_COLORS = [
  '#34d399',
  '#f472b6',
  '#facc15',
  '#fb923c',
  '#f87171',
  '#a78bfa',
  '#4ade80',
  '#e879f9',
]

function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CURSOR_COLORS[h % CURSOR_COLORS.length]
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface PanelProps {
  client: RoomClient | null
  selfId: string
  participants: Participant[]
  initialEvents: AppEvent[]
  connected: boolean
  isHost: boolean
  profileName: string
  device: DeviceType
}

interface DocState {
  content: string
  lang: CodeLang
  rev: number
}

interface HistoryItem {
  id: string
  label: string
  content: string
  lang: string
  at: string
  by: string
}

interface CursorMark {
  line: number
  at: number
  name: string
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function asRecord(payload: unknown): Record<string, unknown> | null {
  if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>
  }
  return null
}

// react-syntax-highlighter ships without type declarations — give the Prism
// component the exact prop surface we use so nothing leaks in as `any`.
const SyntaxHighlighter = SyntaxHighlighterPrimitive as (props: {
  language: string
  style: Record<string, Record<string, string>>
  customStyle?: CSSProperties
  codeTagProps?: { style?: CSSProperties }
  wrapLongLines?: boolean
  showLineNumbers?: boolean
  children: string
}) => ReactElement

const CursorChip = memo(function CursorChip({
  name,
  line,
  color,
}: {
  name: string
  line: number
  color: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-stage-raised/80 px-2.5 py-1 text-[11px] text-stage-muted">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {name} · line {line}
    </span>
  )
})

const HistoryRow = memo(function HistoryRow({
  item,
  canRestore,
  onRestore,
  onDelete,
}: {
  item: HistoryItem
  canRestore: boolean
  onRestore: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border bg-muted/40 p-2.5">
      <div className="flex items-center gap-1.5">
        <p className="min-w-0 flex-1 truncate text-xs font-medium" title={item.label}>
          {item.label}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px]"
          onClick={onRestore}
          disabled={!canRestore}
          aria-label={`Restore snapshot ${item.label}`}
        >
          <RotateCcw className="size-3" aria-hidden="true" /> Restore
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          aria-label={`Delete snapshot ${item.label}`}
        >
          <Trash2 className="size-3" aria-hidden="true" />
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {item.content.length.toLocaleString()} chars · {timeLabel(item.at)} · by {item.by}
      </p>
    </div>
  )
})

function DeviceIcon({ device }: { device: string }) {
  if (device === 'phone') return <Smartphone className="size-3.5" aria-hidden="true" />
  if (device === 'tablet') return <Tablet className="size-3.5" aria-hidden="true" />
  return <Monitor className="size-3.5" aria-hidden="true" />
}

export function CodeEditorPanel({
  client,
  selfId,
  participants,
  initialEvents,
  connected,
  isHost,
  profileName,
}: PanelProps) {
  const [state, setState] = useState<DocState>({ content: '', lang: 'javascript', rev: 0 })
  const [dirty, setDirty] = useState(false)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [lockState, setLockState] = useState<{ locked: boolean; by: string } | null>(null)
  const [cursors, setCursors] = useState<Map<string, CursorMark>>(new Map())
  const [snapOpen, setSnapOpen] = useState(false)
  const [snapLabel, setSnapLabel] = useState('')

  const lastTypedAtRef = useRef(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cursorLastSentRef = useRef(0)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queuedRemoteRef = useRef<DocState | null>(null)
  const revRef = useRef(0)
  const syncErrorToastRef = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const highlightRef = useRef<HTMLDivElement | null>(null)
  const gutterRef = useRef<HTMLDivElement | null>(null)

  const stateRef = useRef(state)
  const connectedRef = useRef(connected)

  useEffect(() => {
    stateRef.current = state
    connectedRef.current = connected
  })

  const locked = lockState?.locked ?? false
  const readOnly = locked && !isHost

  // -------------------------------------------------------- rebuild on mount
  useEffect(() => {
    const docs = initialEvents.filter((e) => e.type === 'code:doc')
    const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null
    const lastPayload = lastDoc ? asRecord(lastDoc.payload) : null
    const historyItems: HistoryItem[] = []
    let lock: { locked: boolean; by: string } | null = null

    for (const ev of initialEvents) {
      const p = asRecord(ev.payload)
      if (ev.type === 'code:history:save' && p && typeof p.id === 'string' && typeof p.content === 'string') {
        const item: HistoryItem = {
          id: p.id,
          label: typeof p.label === 'string' ? p.label : 'Snapshot',
          content: p.content,
          lang: typeof p.lang === 'string' ? p.lang : 'text',
          at: ev.at,
          by: ev.name,
        }
        const idx = historyItems.findIndex((h) => h.id === item.id)
        if (idx >= 0) historyItems[idx] = item
        else historyItems.push(item)
      } else if (ev.type === 'code:history:del' && p && typeof p.id === 'string') {
        const idx = historyItems.findIndex((h) => h.id === p.id)
        if (idx >= 0) historyItems.splice(idx, 1)
      } else if (ev.type === 'code:lock' && p) {
        lock = { locked: Boolean(p.locked), by: ev.name }
      }
    }

    revRef.current = lastPayload && typeof lastPayload.rev === 'number' ? lastPayload.rev : 0
    if (lastPayload && typeof lastPayload.content === 'string') {
      setState({
        content: lastPayload.content.slice(0, MAX_CODE_CHARS),
        lang: typeof lastPayload.lang === 'string' && isLang(lastPayload.lang) ? lastPayload.lang : 'javascript',
        rev: revRef.current,
      })
    }
    // newest snapshot first
    setHistory(historyItems.slice().reverse())
    if (lock) setLockState(lock)
  }, [initialEvents])

  // ------------------------------------------------------------ remote apply
  const applyRemote = useCallback((doc: DocState) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    queuedRemoteRef.current = null
    revRef.current = Math.max(revRef.current, doc.rev)
    setState((s) => ({
      content: doc.content.slice(0, MAX_CODE_CHARS),
      lang: isLang(doc.lang) ? doc.lang : s.lang,
      rev: doc.rev,
    }))
    setDirty(false)
  }, [])

  // ---------------------------------------------------------- local → remote
  const broadcastDoc = useCallback(
    (payload?: { content: string; lang: string }) => {
      const c = client
      if (!c || !connectedRef.current) {
        setDirty(true)
        return
      }
      const s = stateRef.current
      const content = payload ? payload.content : s.content
      const lang = payload ? payload.lang : s.lang
      revRef.current += 1
      const rev = revRef.current
      void c
        .sendAppEvent('code:doc', { content, lang, rev }, { persist: true })
        .then(() => {
          if (stateRef.current.content === content && stateRef.current.lang === lang) setDirty(false)
        })
        .catch(() => {
          setDirty(true)
          const nowMs = Date.now()
          if (nowMs - syncErrorToastRef.current > 5000) {
            syncErrorToastRef.current = nowMs
            toast.error('This edit is too heavy to sync (48 KB relay limit), so trim it or use a snapshot.')
          }
        })
    },
    [client],
  )

  // ------------------------------------------------------------- app events
  useEffect(() => {
    if (!client) return
    return client.on('appevent', (raw) => {
      const ev = raw as AppEvent
      const mine = ev.from === selfId
      const p = asRecord(ev.payload)

      if (ev.type === 'code:doc') {
        if (mine || !p || typeof p.content !== 'string') return
        const doc: DocState = {
          content: p.content,
          lang: typeof p.lang === 'string' && isLang(p.lang) ? p.lang : stateRef.current.lang,
          rev: typeof p.rev === 'number' ? p.rev : revRef.current,
        }
        if (Date.now() - lastTypedAtRef.current < IDLE_WINDOW_MS) {
          // keep the local typing flow; merge when the user goes idle
          queuedRemoteRef.current = doc
          return
        }
        applyRemote(doc)
        return
      }

      if (ev.type === 'code:history:save') {
        if (mine || !p || typeof p.id !== 'string' || typeof p.content !== 'string') return
        const item: HistoryItem = {
          id: p.id,
          label: typeof p.label === 'string' ? p.label : 'Snapshot',
          content: p.content,
          lang: typeof p.lang === 'string' ? p.lang : 'text',
          at: ev.at,
          by: ev.name,
        }
        setHistory((prev) => [item, ...prev.filter((h) => h.id !== item.id)])
        return
      }

      if (ev.type === 'code:history:del') {
        if (mine || !p || typeof p.id !== 'string') return
        setHistory((prev) => prev.filter((h) => h.id !== p.id))
        return
      }

      if (ev.type === 'code:lock') {
        if (mine || !p) return
        setLockState({ locked: Boolean(p.locked), by: ev.name })
        return
      }

      if (ev.type === 'code:cursor') {
        if (mine || !p) return
        const line = typeof p.line === 'number' ? Math.round(p.line) : 0
        if (line <= 0) return
        setCursors((prev) => {
          const next = new Map(prev)
          next.set(ev.from, { line, at: Date.now(), name: ev.name || 'Someone' })
          return next
        })
        return
      }
    })
  }, [client, selfId, applyRemote])

  // Flush a queued remote doc once local typing goes idle.
  useEffect(() => {
    const t = setInterval(() => {
      const queued = queuedRemoteRef.current
      if (!queued) return
      if (Date.now() - lastTypedAtRef.current < IDLE_WINDOW_MS) return
      applyRemote(queued)
    }, 400)
    return () => clearInterval(t)
  }, [applyRemote])

  // Expire remote caret chips after 6s without a refresh.
  useEffect(() => {
    const t = setInterval(() => {
      setCursors((prev) => {
        const nowMs = Date.now()
        let changed = false
        const next = new Map(prev)
        for (const [id, c] of prev) {
          if (nowMs - c.at >= CURSOR_TTL_MS) {
            next.delete(id)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // ------------------------------------------------------------- unmount
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  // ---------------------------------------------------------------- actions
  function scheduleBroadcast() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => broadcastDoc(), SAVE_DEBOUNCE_MS)
  }

  function onEdit(value: string) {
    lastTypedAtRef.current = Date.now()
    setState((s) => ({ ...s, content: value.slice(0, MAX_CODE_CHARS) }))
    setDirty(true)
    scheduleBroadcast()
  }

  function onLangChange(v: string) {
    if (!isLang(v)) return
    setState((s) => ({ ...s, lang: v }))
    setDirty(true)
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    broadcastDoc({ content: stateRef.current.content, lang: v })
  }

  function onCursorActivity(e: SyntheticEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget
    const line = ta.value.slice(0, ta.selectionStart).split('\n').length
    const nowMs = Date.now()
    const send = () => {
      cursorLastSentRef.current = Date.now()
      void client
        ?.sendAppEvent('code:cursor', { line }, { persist: false })
        .catch(() => undefined)
    }
    if (nowMs - cursorLastSentRef.current >= CURSOR_THROTTLE_MS) {
      send()
      return
    }
    if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current)
    cursorTimerRef.current = setTimeout(send, CURSOR_THROTTLE_MS - (nowMs - cursorLastSentRef.current))
  }

  function syncScroll(e: UIEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop
      highlightRef.current.scrollLeft = ta.scrollLeft
    }
    if (gutterRef.current) {
      gutterRef.current.style.transform = `translateY(${-ta.scrollTop}px)`
    }
  }

  function insertTab() {
    const ta = textareaRef.current
    if (!ta || readOnly) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const next = stateRef.current.content.slice(0, start) + '  ' + stateRef.current.content.slice(end)
    onEdit(next)
    requestAnimationFrame(() => {
      ta.selectionStart = start + 2
      ta.selectionEnd = start + 2
    })
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(state.content)
      setCopied(true)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Your browser blocked clipboard access, select the text manually.')
    }
  }

  function download() {
    const ext = LANGUAGES.find((l) => l.id === state.lang)?.ext ?? 'txt'
    const blob = new Blob([state.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `code-${new Date().toISOString().slice(0, 10)}.${ext}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  function saveSnapshot() {
    const c = client
    if (!c || !connectedRef.current) {
      toast.error('Not connected to the session yet.')
      return
    }
    if (state.content.length > MAX_SNAPSHOT_CHARS) {
      toast.error('Snapshot too heavy to sync; the relay caps events at 48 KB. Copy the code instead.')
      return
    }
    const id = uid()
    const label = snapLabel.trim() || `Snapshot ${timeLabel(new Date().toISOString())}`
    setHistory((prev) => [
      { id, label, content: state.content, lang: state.lang, at: new Date().toISOString(), by: profileName },
      ...prev,
    ])
    setSnapOpen(false)
    setSnapLabel('')
    toast.success('Snapshot saved for everyone.')
    void c
      .sendAppEvent('code:history:save', { id, label, content: state.content, lang: state.lang }, { persist: true })
      .catch(() => undefined)
  }

  function restoreItem(item: HistoryItem) {
    const c = client
    if (!c || !connectedRef.current) {
      toast.error('Not connected. Restoring only works while the session is live.')
      return
    }
    lastTypedAtRef.current = 0
    queuedRemoteRef.current = null
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const content = item.content.slice(0, MAX_CODE_CHARS)
    const lang = isLang(item.lang) ? item.lang : state.lang
    setState((s) => ({ ...s, content, lang }))
    broadcastDoc({ content, lang })
    toast.success('Snapshot restored for everyone.')
  }

  function deleteHistory(id: string) {
    setHistory((prev) => prev.filter((h) => h.id !== id))
    void client
      ?.sendAppEvent('code:history:del', { id }, { persist: true })
      .catch(() => undefined)
  }

  function clearAll() {
    const c = client
    if (!c || !connectedRef.current) return
    lastTypedAtRef.current = 0
    queuedRemoteRef.current = null
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    setState((s) => ({ ...s, content: '' }))
    broadcastDoc({ content: '', lang: state.lang })
    toast.success('Code cleared for everyone.')
  }

  function setLock(next: boolean) {
    if (!isHost) return
    setLockState({ locked: next, by: profileName })
    void client
      ?.sendAppEvent('code:lock', { locked: next }, { persist: true })
      .catch(() => undefined)
  }

  // ---------------------------------------------------------------- derived
  const lineCount = useMemo(() => Math.max(1, state.content.split('\n').length), [state.content])
  const gutterLines = useMemo(
    () => (lineCount <= GUTTER_MAX_LINES ? Array.from({ length: lineCount }, (_, i) => i + 1) : []),
    [lineCount],
  )
  const langMeta = useMemo(
    () => LANGUAGES.find((l) => l.id === state.lang) ?? LANGUAGES[0],
    [state.lang],
  )
  const highlight = useMemo(
    () => (
      <SyntaxHighlighter
        language={langMeta.prism}
        style={oneDark}
        wrapLongLines={false}
        showLineNumbers={false}
        customStyle={{
          margin: 0,
          background: 'transparent',
          padding: '12px 16px',
          minHeight: '100%',
          minWidth: 'max-content',
          overflow: 'visible',
          fontFamily: MONO_FONT,
          fontSize: 14,
          lineHeight: 1.625,
          whiteSpace: 'pre',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            background: 'transparent',
            whiteSpace: 'inherit',
          },
        }}
      >
        {state.content}
      </SyntaxHighlighter>
    ),
    [state.content, langMeta],
  )
  const activeCursors = useMemo(
    () => Array.from(cursors.entries()).map(([id, c]) => ({ id, ...c })),
    [cursors],
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {/* -------------------------------------------------------- the editor */}
      <Card className="overflow-hidden border-stage-border bg-stage p-0 text-stage-foreground">
        {/* toolbar — first thing on screen */}
        <div className="flex flex-wrap items-center gap-2 border-b border-stage-border bg-stage-soft/60 px-4 py-2.5">
          <p className="text-sm font-semibold">Pair code</p>
          <Select value={state.lang} onValueChange={onLangChange}>
            <SelectTrigger
              className="h-8 w-[126px] border-stage-border bg-stage-soft text-xs text-stage-foreground"
              aria-label="Code language"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.id} value={l.id} className="text-xs">
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
              !connected
                ? 'bg-stage-raised text-stage-muted'
                : dirty
                  ? 'bg-warning/15 text-warning'
                  : 'bg-primary/15 text-positive',
            )}
            role="status"
            aria-live="polite"
          >
            {!connected ? (
              'Offline'
            ) : dirty ? (
              <>
                <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Syncing…
              </>
            ) : (
              <>
                <Check className="size-3" aria-hidden="true" /> Synced
              </>
            )}
          </span>
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-medium text-warning">
              <Lock className="size-3" aria-hidden="true" /> Locked
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Popover open={snapOpen} onOpenChange={setSnapOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 border-stage-border bg-stage-soft text-xs text-stage-muted hover:bg-stage-raised hover:text-white"
                  disabled={!connected || !state.content}
                >
                  <Camera className="size-3.5" aria-hidden="true" /> Snapshot
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end">
                <Input
                  value={snapLabel}
                  onChange={(e) => setSnapLabel(e.target.value)}
                  placeholder="Label (e.g. before refactor)"
                  className="h-8 text-xs"
                  aria-label="Snapshot label"
                />
                <Button
                  size="sm"
                  className="mt-2 h-8 w-full text-xs"
                  onClick={saveSnapshot}
                  disabled={!state.content}
                >
                  Save snapshot for everyone
                </Button>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-stage-border bg-stage-soft text-xs text-stage-muted hover:bg-stage-raised hover:text-white"
              onClick={() => void copyAll()}
              disabled={!state.content}
              aria-label="Copy code"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-positive" aria-hidden="true" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" aria-hidden="true" /> Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-stage-border bg-stage-soft text-xs text-stage-muted hover:bg-stage-raised hover:text-white"
              onClick={download}
              disabled={!state.content}
              aria-label="Download code file"
            >
              <Download className="size-3.5" aria-hidden="true" /> Download
            </Button>
            {isHost && (
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-stage-muted">
                <Switch
                  checked={locked}
                  onCheckedChange={(v) => setLock(v)}
                  aria-label="Make the editor read-only for others"
                />
                <Lock className="size-3" aria-hidden="true" />
                read-only for others
              </label>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={!state.content}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" /> Clear for everyone
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear the shared code?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The editor becomes empty on every device in this session. Take a snapshot first
                    if you might want to roll back.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAll}>Clear code</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* read-only banner for non-hosts while locked */}
        {readOnly && (
          <div className="flex items-center gap-2 border-b border-warning/20 bg-warning/15 px-4 py-2 text-xs text-warning">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            Read-only: {lockState?.by || 'the host'} locked editing
          </div>
        )}

        {/* editor: gutter + highlight layer + transparent textarea */}
        <div className="flex h-[420px] font-mono text-sm leading-relaxed md:h-[500px]">
          <div
            aria-hidden="true"
            className="w-11 shrink-0 select-none overflow-hidden border-r border-stage-border/80 bg-stage-soft/40"
          >
            <div
              ref={gutterRef}
              style={{
                paddingTop: 12,
                fontFamily: MONO_FONT,
                fontSize: 14,
                lineHeight: 1.625,
                willChange: 'transform',
              }}
            >
              {gutterLines.map((n) => (
                <div key={n} className="pr-2 text-right text-stage-muted/50" style={{ height: '1.625em' }}>
                  {n}
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-w-0 flex-1">
            <div
              ref={highlightRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              {highlight}
            </div>
            <textarea
              ref={textareaRef}
              value={state.content}
              onChange={(e) => onEdit(e.target.value)}
              onScroll={syncScroll}
              onSelect={onCursorActivity}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault()
                  insertTab()
                }
              }}
              wrap="off"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              readOnly={readOnly}
              disabled={!connected}
              placeholder={
                connected
                  ? 'Paste a snippet, share the code, pair-program.'
                  : 'Waiting for the session to connect…'
              }
              className="absolute inset-0 h-full w-full resize-none overflow-auto border-0 bg-transparent px-4 py-3 text-transparent caret-white outline-none selection:bg-primary/30 placeholder:text-stage-muted/50 focus-visible:ring-0"
              style={{ fontFamily: MONO_FONT, fontSize: 14, lineHeight: 1.625 }}
              aria-label="Shared code editor"
            />
          </div>
        </div>

        {/* remote caret chips */}
        {activeCursors.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-stage-border px-4 py-2">
            {activeCursors.map((c) => (
              <CursorChip key={c.id} name={c.name} line={c.line} color={colorFor(c.id)} />
            ))}
          </div>
        )}

        {/* stats row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stage-border px-4 py-2 text-[11px] text-stage-muted/70">
          <span>{state.content.length.toLocaleString()} characters</span>
          <span>{(state.content ? lineCount : 0).toLocaleString()} lines</span>
          <span>{langMeta.label}</span>
          <span className="ml-auto flex items-center gap-1">
            <CloudUpload className="size-3" aria-hidden="true" /> autoshares with the session
          </span>
        </div>
      </Card>

      {/* ------------------------------------------------------------ sidebar */}
      <div className="space-y-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <History className="size-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold">Snapshots</p>
              <span className="ml-auto text-[11px] text-muted-foreground">{history.length}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Saved points for the whole room. Anyone can restore or delete one.
            </p>
            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {history.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  No snapshots yet. Take one to save the current code for everyone.
                </p>
              ) : (
                history.map((item) => (
                  <HistoryRow
                    key={item.id}
                    item={item}
                    canRestore={connected}
                    onRestore={() => restoreItem(item)}
                    onDelete={() => deleteHistory(item.id)}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold">In this session</p>
              <span className="ml-auto text-[11px] text-muted-foreground">{participants.length}</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    <DeviceIcon device={p.device} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {p.name}
                    {p.id === selfId && <span className="text-muted-foreground"> · you</span>}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {p.device}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start gap-2.5 rounded-xl border border-dashed px-4 py-3.5 text-xs leading-relaxed text-muted-foreground">
          <Code2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            The editor scrolls both ways and keeps line numbers in sync, great for live debugging.
            Take a <span className="font-medium text-foreground">Snapshot</span> before big refactors
            so anyone can roll back.
          </p>
        </div>
      </div>
    </div>
  )
}
