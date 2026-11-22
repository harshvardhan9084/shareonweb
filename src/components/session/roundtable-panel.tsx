'use client'

// Live room: chat, polls and presence. Mobile gets tabs; desktop gets a
// three-column layout. Both use the same subcomponents.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RoomClient } from '@/lib/room-client'
import { uid } from '@/components/platform/session-view'
import type { ChatMsg, Participant, Poll } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { format, formatDistanceToNowStrict } from 'date-fns'
import {
  CircleCheck,
  Monitor,
  Plus,
  Send,
  Smartphone,
  Tablet,
  Users,
  BarChart3,
  MessagesSquare,
} from 'lucide-react'
import { cn, humanError } from '@/lib/utils'

interface RoundtablePanelProps {
  client: RoomClient | null
  chat: ChatMsg[]
  polls: Poll[]
  participants: Participant[]
  selfId: string
  connected: boolean
}

function deviceGlyph(d: string) {
  const cls = 'size-3.5 shrink-0 text-muted-foreground'
  if (d === 'phone') return <Smartphone className={cls} aria-label="phone" />
  if (d === 'tablet') return <Tablet className={cls} aria-label="tablet" />
  return <Monitor className={cls} aria-label="computer" />
}

function initials(name: string) {
  return name.trim() ? name.trim().slice(0, 2).toUpperCase() : 'G'
}

export function RoundtablePanel({ client, chat, polls, participants, selfId, connected }: RoundtablePanelProps) {
  return (
    <>
      {/* mobile: tabs */}
      <div className="sm:hidden">
        <Tabs defaultValue="chat">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat" className="gap-1.5">
              <MessagesSquare className="size-4" /> Chat
            </TabsTrigger>
            <TabsTrigger value="polls" className="gap-1.5">
              <BarChart3 className="size-4" /> Polls
            </TabsTrigger>
            <TabsTrigger value="people" className="gap-1.5">
              <Users className="size-4" /> People
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="mt-3">
            <ChatColumn client={client} chat={chat} connected={connected} />
          </TabsContent>
          <TabsContent value="polls" className="mt-3">
            <PollsColumn client={client} polls={polls} connected={connected} />
          </TabsContent>
          <TabsContent value="people" className="mt-3">
            <PeopleColumn participants={participants} selfId={selfId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* desktop: columns */}
      <div className="hidden gap-4 sm:grid sm:grid-cols-[1fr_320px] lg:grid-cols-[1fr_360px]">
        <ChatColumn client={client} chat={chat} connected={connected} />
        <div className="space-y-4">
          <PollsColumn client={client} polls={polls} connected={connected} />
          <PeopleColumn participants={participants} selfId={selfId} />
        </div>
      </div>
    </>
  )
}

// ------------------------------------------------------------------ chat

function ChatColumn({
  client,
  chat,
  connected,
}: {
  client: RoomClient | null
  chat: ChatMsg[]
  connected: boolean
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [chat.length])

  async function send() {
    const content = draft.trim()
    if (!content) return
    setSending(true)
    try {
      await client?.sendChat(uid(), content)
      setDraft('')
    } catch (err) {
      toast.error(humanError(err, 'Could not send, check the connection.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="flex max-h-[36rem] flex-col">
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="border-b px-4 py-2.5 text-sm font-semibold">Live chat</div>
        <div
          ref={listRef}
          className="min-h-48 flex-1 space-y-3 overflow-y-auto px-4 py-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        >
          {chat.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages yet. Say hello. Everyone in the session sees it instantly.
            </p>
          ) : (
            chat.map((m) => (
              <div key={m.id} className="text-sm">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {deviceGlyph(m.device)}
                  <span className="font-medium text-foreground/80">{m.from}</span>
                  <span>{format(new Date(m.at), 'h:mm a')}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
              </div>
            ))
          )}
        </div>
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Type a message…"
              aria-label="Chat message"
              className="h-11"
            />
            <Button onClick={send} disabled={!draft.trim() || sending || !connected} className="h-11 gap-1.5">
              <Send className="size-4" aria-hidden="true" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------- polls

function PollsColumn({
  client,
  polls,
  connected,
}: {
  client: RoomClient | null
  polls: Poll[]
  connected: boolean
}) {
  const [creating, setCreating] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [busy, setBusy] = useState(false)
  const [myVotes, setMyVotes] = useState<Record<string, number>>({})

  async function createPoll() {
    const opts = options.map((o) => o.trim()).filter(Boolean)
    if (!question.trim() || opts.length < 2) {
      toast.error('Give the poll a question and at least two options.')
      return
    }
    setBusy(true)
    try {
      await client?.createPoll(uid(), question.trim(), opts)
      setQuestion('')
      setOptions(['', ''])
      setCreating(false)
    } catch (err) {
      toast.error(humanError(err, 'Could not create the poll.'))
    } finally {
      setBusy(false)
    }
  }

  async function vote(poll: Poll, optionIndex: number) {
    try {
      await client?.votePoll(poll.id, optionIndex)
      setMyVotes((prev) => ({ ...prev, [poll.id]: optionIndex }))
    } catch (err) {
      toast.error(humanError(err, 'Could not record your vote.'))
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Instant polls</p>
          {!creating && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="size-3.5" aria-hidden="true" /> New poll
            </Button>
          )}
        </div>

        {creating && (
          <div className="mt-3 rounded-lg border bg-muted/30 p-3">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
              placeholder="Ask something… e.g. Lunch at 1?"
              aria-label="Poll question"
              className="h-10"
            />
            <div className="mt-2 space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...options]
                      next[i] = e.target.value.slice(0, 100)
                      setOptions(next)
                    }}
                    placeholder={`Option ${i + 1}`}
                    aria-label={`Poll option ${i + 1}`}
                    className="h-10"
                  />
                  {options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 shrink-0 text-muted-foreground"
                      aria-label={`Remove option ${i + 1}`}
                      onClick={() => setOptions(options.filter((_, j) => j !== i))}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              {options.length < 6 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => setOptions([...options, ''])}
                >
                  <Plus className="size-3.5" aria-hidden="true" /> Add option
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="h-8" onClick={createPoll} disabled={busy || !connected}>
                  {busy ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-3">
          {polls.length === 0 && !creating ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
              No polls yet. Create one and everyone votes with a single tap, and results update live.
            </p>
          ) : (
            [...polls].reverse().map((poll) => {
              const total = poll.options.reduce((sum, o) => sum + o.votes, 0)
              const myVote = myVotes[poll.id]
              return (
                <div key={poll.id} className="rounded-lg border p-3.5">
                  <p className="text-sm font-medium">{poll.question}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(poll.createdAt), { addSuffix: true })}
                    {' · '}
                    {total} vote{total === 1 ? '' : 's'}
                  </p>
                  <div className="mt-2.5 space-y-2">
                    {poll.options.map((opt, i) => {
                      const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0
                      const voted = myVote === i
                      return (
                        <button
                          key={i}
                          onClick={() => vote(poll, i)}
                          disabled={!connected}
                          className={cn(
                            'relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                            voted ? 'border-primary/50' : 'hover:border-primary/30',
                          )}
                          aria-pressed={voted}
                        >
                          <span
                            className="absolute inset-y-0 left-0 w-full origin-left bg-primary/10 transition-transform"
                            style={{ transform: `scaleX(${pct / 100})` }}
                            aria-hidden="true"
                          />
                          <span className="relative flex items-center gap-2">
                            <span className={cn('font-medium', voted && 'text-primary')}>{opt.text}</span>
                            {voted && <CircleCheck className="size-4 text-primary" aria-hidden="true" />}
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                              {pct}% · {opt.votes}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {myVote !== undefined && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      You voted. Tap another option to change it.
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------- people

function PeopleColumn({ participants, selfId }: { participants: Participant[]; selfId: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" aria-hidden="true" /> In this room ({participants.length})
        </p>
        <ul className="mt-3 space-y-2.5">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 text-sm">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                  p.id === selfId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {initials(p.name)}
              </span>
              <span className="font-medium">{p.name}</span>
              {p.id === selfId && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">you</span>
              )}
              <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                {deviceGlyph(p.device)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
