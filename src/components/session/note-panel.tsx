'use client'

// Shared Notepad — one plain-text note per session, synced live.
//
// Sync model: every edit is debounced and saved with the revision it started
// from (optimistic concurrency). Remote saves are applied when the local user
// pauses typing; if someone else saved first (rev conflict) the server hands
// back its current doc and the panel decides: recent local typing wins and is
// retried on top of the new rev, otherwise the server version is adopted.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RoomClient } from '@/lib/room-client'
import type { NoteDoc, Participant } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
import { formatDistanceToNowStrict } from 'date-fns'
import {
  Check,
  CloudUpload,
  Copy,
  Download,
  Loader2,
  PencilLine,
  Trash2,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SAVE_DEBOUNCE_MS = 400
const IDLE_WINDOW_MS = 1400 // remote merge only when local typing paused this long
const MAX_NOTE_CHARS = 100_000

interface NotePanelProps {
  client: RoomClient | null
  initialDoc: NoteDoc | null
  participants: Participant[]
  selfId: string
  connected: boolean
}

interface LocalState {
  text: string
  rev: number
}

export function NotePanel({ client, initialDoc, participants, selfId, connected }: NotePanelProps) {
  const [state, setState] = useState<LocalState>(() => ({
    text: initialDoc?.content ?? '',
    rev: initialDoc?.rev ?? 0,
  }))
  const [lastEdit, setLastEdit] = useState<NoteDoc | null>(initialDoc)
  const [saved, setSaved] = useState(true) // false while a save is in flight/pending
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const lastTypedAtRef = useRef(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const queuedRemoteRef = useRef<NoteDoc | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const connectedRef = useRef(connected)
  connectedRef.current = connected

  // Relative "last edited" ticker.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  // --------------------------------------------------------------- save path
  const saveNow = useCallback(async () => {
    const c = client
    if (!c || !connectedRef.current || savingRef.current) return
    const current = stateRef.current
    if ((lastEdit?.rev ?? 0) === current.rev && lastEdit?.content === current.text) return

    savingRef.current = true
    try {
      const res = await c.sendDoc(current.text, current.rev)
      if (res.ok && res.doc) {
        setState({ text: res.doc.content, rev: res.doc.rev })
        setLastEdit(res.doc)
        setSaved(true)
      } else if (res.conflict && res.doc) {
        // Someone else saved first. If the local user typed very recently,
        // their version wins — retry on top of the new revision. Otherwise
        // adopt the server truth.
        const typedRecently = Date.now() - lastTypedAtRef.current < IDLE_WINDOW_MS
        if (typedRecently) {
          setState((prev) => ({ text: prev.text, rev: res.doc!.rev }))
          setSaved(false)
          saveNow()
        } else {
          setState({ text: res.doc.content, rev: res.doc.rev })
          setLastEdit(res.doc)
          setSaved(true)
        }
      } else {
        setSaved(false)
      }
    } catch {
      setSaved(false)
    } finally {
      savingRef.current = false
    }
  }, [client, lastEdit])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaved(false)
    saveTimerRef.current = setTimeout(() => void saveNow(), SAVE_DEBOUNCE_MS)
  }, [saveNow])

  // ------------------------------------------------------------- remote path
  useEffect(() => {
    if (!client) return
    const off = client.on('doc', (incoming) => {
      const doc = incoming as NoteDoc
      const typedRecently = Date.now() - lastTypedAtRef.current < IDLE_WINDOW_MS
      if (typedRecently) {
        // Defer: keep the user's flow, queue the remote version to merge when idle.
        queuedRemoteRef.current = doc
        return
      }
      queuedRemoteRef.current = null
      setState({ text: doc.content, rev: doc.rev })
      setLastEdit(doc)
      setSaved(true)
    })
    return off
  }, [client])

  // Flush queued remote edits once typing goes idle.
  useEffect(() => {
    const t = setInterval(() => {
      const queued = queuedRemoteRef.current
      if (!queued) return
      if (Date.now() - lastTypedAtRef.current < IDLE_WINDOW_MS) return
      if (savingRef.current) return
      queuedRemoteRef.current = null
      setState({ text: queued.content, rev: queued.rev })
      setLastEdit(queued)
      setSaved(true)
    }, 500)
    return () => clearInterval(t)
  }, [])

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    },
    [],
  )

  // ----------------------------------------------------------------- actions
  function onEdit(value: string) {
    lastTypedAtRef.current = Date.now()
    setState({ text: value.slice(0, MAX_NOTE_CHARS), rev: stateRef.current.rev })
    scheduleSave()
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(state.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Your browser blocked clipboard access, select the text manually.')
    }
  }

  function downloadTxt() {
    const blob = new Blob([state.text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shareonweb-note-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  async function clearNote() {
    if (!client) return
    lastTypedAtRef.current = 0
    setState({ text: '', rev: stateRef.current.rev })
    await saveNow()
    toast.success('Note cleared for everyone.')
  }

  // ------------------------------------------------------------------ derived
  const stats = useMemo(() => {
    const words = state.text.trim() ? state.text.trim().split(/\s+/).length : 0
    const lines = state.text ? state.text.split('\n').length : 0
    return { words, chars: state.text.length, lines }
  }, [state.text])

  const editors = participants.length
  const editorNames = participants
    .filter((p) => p.id !== selfId)
    .map((p) => p.name)
    .slice(0, 3)

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {/* ---------------------------------------------------------- the note */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
          <p className="text-sm font-semibold">Shared note</p>
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium',
              saved ? 'text-positive' : 'text-muted-foreground',
            )}
            role="status"
            aria-live="polite"
          >
            {saved ? (
              <>
                <Check className="size-3" aria-hidden="true" /> Synced
              </>
            ) : (
              <>
                <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Syncing…
              </>
            )}
          </span>
        </div>
        <CardContent className="p-0">
          <Textarea
            value={state.text}
            onChange={(e) => onEdit(e.target.value)}
            placeholder={
              connected
                ? 'Start typing, everyone in this session sees what you write, live. Meeting notes, a list, a draft…'
                : 'Waiting for the session to connect…'
            }
            className="min-h-[420px] resize-y rounded-none border-0 px-4 py-3.5 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0"
            aria-label="Shared note text"
            disabled={!connected}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-[11px] text-muted-foreground">
            <span>{stats.words} words</span>
            <span>{stats.chars} characters</span>
            <span>{stats.lines} lines</span>
            <span className="ml-auto flex items-center gap-1">
              <CloudUpload className="size-3" aria-hidden="true" /> autosaves to the session
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ sidebar */}
      <div className="space-y-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold">This note</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              One shared surface for everyone here. Edits appear for all devices within a
              moment, and nothing survives the session.
            </p>
            <div className="mt-3 space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
              {lastEdit?.updatedBy ? (
                <p>
                  Last edited by{' '}
                  <span className="font-medium text-foreground">{lastEdit.updatedBy}</span>
                  {' · '}
                  {formatDistanceToNowStrict(new Date(lastEdit.updatedAt), { addSuffix: true })}
                  <span className="sr-only"> (checked {now})</span>
                </p>
              ) : (
                <p>Not edited yet. Type the first line.</p>
              )}
              <p className="flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden="true" />
                {editors > 1
                  ? `${editors} people here; ${editorNames.join(', ')} can edit too`
                  : 'Only you right now. Invite someone with the code above.'}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={copyAll}
                disabled={!state.text}
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-primary" aria-hidden="true" /> Copied
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
                className="gap-1.5"
                onClick={downloadTxt}
                disabled={!state.text}
              >
                <Download className="size-3.5" aria-hidden="true" /> .txt
              </Button>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 w-full gap-1.5 text-destructive hover:text-destructive"
                  disabled={!state.text}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" /> Clear for everyone
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear the shared note?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The note becomes empty on every device in this session. This cannot be
                    undone. Copy anything you want to keep first.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearNote}>Clear note</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <div className="flex items-start gap-2.5 rounded-xl border border-dashed px-4 py-3.5 text-xs leading-relaxed text-muted-foreground">
          <PencilLine className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            Two people typing at once is fine; the note merges when each of you pauses. For
            back-and-forth discussion, <span className="font-medium text-foreground">Roundtable</span>{' '}
            gives you chat and polls.
          </p>
        </div>
      </div>
    </div>
  )
}
