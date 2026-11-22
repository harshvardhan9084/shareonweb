'use client'

import { useEffect, useRef, useState } from 'react'
import type { RoomClient } from '@/lib/room-client'
import type { TextItem } from '@/lib/types'
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
import { format } from 'date-fns'
import { humanError } from '@/lib/utils'
import { Check, ClipboardPaste, Copy, Eraser, Monitor, Smartphone, Send, Tablet } from 'lucide-react'

interface BeamPanelProps {
  client: RoomClient | null
  texts: TextItem[]
  sentIdsRef: React.RefObject<Set<string>>
  onSend: (content: string) => Promise<void>
  onClear: () => Promise<void>
  connected: boolean
}

function deviceGlyph(d: string) {
  const cls = 'size-3.5 text-muted-foreground'
  if (d === 'phone') return <Smartphone className={cls} aria-label="phone" />
  if (d === 'tablet') return <Tablet className={cls} aria-label="tablet" />
  return <Monitor className={cls} aria-label="computer" />
}

export function BeamPanel({ client, texts, sentIdsRef, onSend, onClear, connected }: BeamPanelProps) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Keep the newest item visible.
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 })
  }, [texts.length])

  async function send() {
    const content = draft.trim()
    if (!content) return
    setSending(true)
    try {
      await onSend(content)
      setDraft('')
    } catch (err) {
      toast.error(humanError(err, 'Could not send, check the connection.'))
    } finally {
      setSending(false)
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setDraft((d) => (d ? `${d}\n${text}` : text))
      } else {
        toast.info('Your clipboard is empty, copy something first.')
      }
    } catch {
      toast.error('Your browser blocked clipboard access, paste manually instead (Ctrl+V / long-press).')
    }
  }

  async function copyItem(item: TextItem) {
    try {
      await navigator.clipboard.writeText(item.content)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      toast.error('Could not copy automatically, select the text manually.')
    }
  }

  const items = [...texts].reverse()

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      {/* compose */}
      <Card className="h-fit lg:sticky lg:top-20">
        <CardContent className="p-4">
          <p className="text-sm font-semibold">Send to this session</p>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 100_000))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
            }}
            placeholder="A link, an address, a Wi-Fi password… anything you need on your other device."
            className="mt-3 min-h-32 resize-y"
            aria-label="Text to send to the session"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={send} disabled={!draft.trim() || sending || !connected} className="flex-1 gap-1.5">
              <Send className="size-4" aria-hidden="true" />
              {sending ? 'Sending…' : 'Send'}
            </Button>
            <Button variant="outline" onClick={pasteFromClipboard} className="gap-1.5">
              <ClipboardPaste className="size-4" aria-hidden="true" /> Paste
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Paste uses the browser clipboard only when you tap it. ⌘/Ctrl+Enter sends.
          </p>
        </CardContent>
      </Card>

      {/* history */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            {texts.length === 0 ? 'Nothing shared yet' : `${texts.length} thing${texts.length === 1 ? '' : 's'} in this session`}
          </p>
          {texts.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
                  <Eraser className="size-3.5" aria-hidden="true" /> Clear history
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear the shared history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Removes everything from every device in this session. Devices that join later
                    will see nothing.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onClear}>Clear</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-start justify-center rounded-xl border border-dashed px-6 py-10 text-center sm:items-center">
            <p className="text-sm font-medium">Open this session on your other device</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              Send text here and it appears there instantly, or the other way around. The QR and
              code are in the Share panel above.
            </p>
          </div>
        ) : (
          <div
            ref={listRef}
            className="max-h-[32rem] overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
          >
            <ul className="divide-y">
              {items.map((item) => {
                const mine = sentIdsRef.current?.has(item.id) ?? false
                return (
                  <li key={item.id} className="group py-4 first:pt-1">
                    <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                      {item.content}
                    </pre>
                    <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {deviceGlyph(item.device)}
                      <span className="font-medium text-foreground/80">{mine ? 'You' : item.from}</span>
                      <span>·</span>
                      <span>{format(new Date(item.at), 'h:mm:ss a')}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-7 gap-1 px-2 text-xs"
                        onClick={() => copyItem(item)}
                        aria-label="Copy this text"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="size-3.5 text-primary" aria-hidden="true" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" aria-hidden="true" /> Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
