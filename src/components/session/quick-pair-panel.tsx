'use client'

// Quick Pair — QR-first pairing hero plus one persistent transfer surface.
//
// Before a second device joins: a big scannable QR, the session code and copy
// actions, and an animated "waiting for a device" state. The moment another
// device is in the session, the hero collapses to a slim success strip and the
// QR moves into a popover for pairing yet another device. Below it, the
// existing Beam (text) and Drop (files) panels are composed as-is, so text and
// files live in one place for the whole session.

import { useRef, useState } from 'react'
import type { RoomClient } from '@/lib/room-client'
import type { AppEvent, DeviceType, Participant, TextItem } from '@/lib/types'
import { formatCode, joinUrl } from '@/lib/code'
import { BeamPanel } from '@/components/session/beam-panel'
import { DropPanel, type RoomFile } from '@/components/session/drop-panel'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'
import { Check, Copy, File as FileIcon, QrCode, Zap } from 'lucide-react'

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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

export interface QuickPairPanelProps extends PanelProps {
  texts: TextItem[]
  onSendText: (content: string) => Promise<void>
  onClearTexts: () => Promise<void>
  files: RoomFile[]
  onSendFiles: (input: FileList | File[] | { file: File; relPath?: string }[]) => Promise<void>
  onRemoveFile: (fileId: string) => Promise<void>
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

export function QuickPairPanel({
  client,
  selfId,
  participants,
  connected,
  texts,
  onSendText,
  onClearTexts,
  files,
  onSendFiles,
  onRemoveFile,
}: QuickPairPanelProps) {
  // Local mirror of the ids this device sent — BeamPanel marks them "You".
  const sentIdsRef = useRef<Set<string>>(new Set())
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)

  const rawCode = client?.code ?? ''
  const code = formatCode(rawCode)
  const url = rawCode ? joinUrl(rawCode) : ''
  const paired = participants.length >= 2
  const others = participants.filter((p) => p.id !== selfId)
  const partnerNames =
    others.length > 0
      ? others.length <= 2
        ? others.map((p) => p.name).join(', ')
        : `${others.slice(0, 2).map((p) => p.name).join(', ')} +${others.length - 2} more`
      : 'another device'

  async function copyValue(value: string, kind: 'link' | 'code') {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Your browser blocked clipboard access, copy manually instead.')
    }
  }

  const qrBlock = (size: number) => (
    <div className="mx-auto w-fit rounded-xl border bg-white p-3 shadow-sm">
      <QRCode value={url || '/'} size={size} aria-label={`QR code for session ${code}`} />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* --------------------------------------------------------- hero / strip */}
      {paired ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-primary/5 px-4 py-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Check className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium" role="status" aria-live="polite">
            Paired with <span className="font-semibold">{partnerNames}</span>
          </p>
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
            {code}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto h-8 gap-1.5">
                <QrCode className="size-3.5" aria-hidden="true" /> Show QR for another device
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <p className="text-sm font-semibold">Add another device</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Scan, open the link, or type the code. Everything in this session appears there too.
              </p>
              <div className="mt-3">{qrBlock(140)}</div>
              <p className="mt-3 text-center font-mono text-sm">{code}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full gap-1.5"
                onClick={() => void copyValue(url, 'link')}
                disabled={!url}
              >
                {copied === 'link' ? (
                  <>
                    <Check className="size-3.5 text-primary" aria-hidden="true" /> Link copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" aria-hidden="true" /> Copy link
                  </>
                )}
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <div className="rounded-xl border px-4 py-8 sm:px-6">
          {qrBlock(208)}
          <p
            className="mt-5 text-center font-mono text-2xl tracking-[0.3em]"
            aria-label={`Session code ${code}`}
          >
            {code}
          </p>
          <div className="mx-auto mt-4 grid w-full max-w-xs grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => void copyValue(url, 'link')} disabled={!url}>
              {copied === 'link' ? (
                <>
                  <Check className="size-4 text-primary" aria-hidden="true" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" aria-hidden="true" /> Copy link
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => void copyValue(rawCode, 'code')} disabled={!rawCode}>
              {copied === 'code' ? (
                <>
                  <Check className="size-4 text-primary" aria-hidden="true" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" aria-hidden="true" /> Copy code
                </>
              )}
            </Button>
          </div>
          <p
            className="mt-6 flex items-center justify-center text-sm font-medium"
            role="status"
            aria-live="polite"
          >
            waiting for a device
            <AnimatedDots />
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
            Scan the QR with a phone camera or open the link. Pairing completes the second the
            second device joins, and this turns into the transfer surface.
          </p>
          {!connected && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              connecting to the live session
              <AnimatedDots />
            </p>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- stat strip */}
      <div
        className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          <Zap className="size-3.5 text-primary" aria-hidden="true" />
          {texts.length} text{texts.length === 1 ? '' : 's'}
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          <FileIcon className="size-3.5 text-primary" aria-hidden="true" />
          {files.length} file{files.length === 1 ? '' : 's'}
        </span>
        <span className="ml-auto">
          in session{connected ? '' : ' (connecting…)'}
        </span>
      </div>

      {/* ------------------------------------------------- transfer surface */}
      <BeamPanel
        client={client}
        texts={texts}
        sentIdsRef={sentIdsRef}
        onSend={onSendText}
        onClear={onClearTexts}
        connected={connected}
      />
      <DropPanel
        files={files}
        onSendFiles={onSendFiles}
        onRemove={onRemoveFile}
        connected={connected}
      />
    </div>
  )
}
