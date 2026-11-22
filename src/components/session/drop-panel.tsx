'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
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
import { format } from 'date-fns'
import {
  CircleAlert,
  Download,
  File,
  FileText,
  Image as ImageIcon,
  Monitor,
  Music,
  RotateCcw,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { chunksAreComplete, chunksToBlob, formatBytes } from '@/lib/file-blob'

export interface RoomFile {
  fileId: string
  name: string
  /** Relative path incl. root folder (Folder Share only). */
  relPath?: string
  /** Logical bucket (e.g. "presentation") — filtered out of general file lists. */
  slot?: string
  /** Stable per-tab sender id (attribution of "mine"). */
  ownerId?: string
  size: number
  type: string
  chunkCount: number
  chunks: (string | null)[]
  received: number
  complete: boolean
  from: string
  device: string
  at: string
  mine: boolean
  sendProgress?: number
  error?: string
}

function typeIcon(type: string) {
  const cls = 'size-5 text-muted-foreground'
  if (type.startsWith('image/')) return <ImageIcon className={cls} />
  if (type.startsWith('audio/')) return <Music className={cls} />
  if (type.startsWith('text/') || type.includes('pdf') || type.includes('document')) return <FileText className={cls} />
  return <File className={cls} />
}

interface DropPanelProps {
  files: RoomFile[]
  onSendFiles: (files: FileList | File[]) => Promise<void>
  onRemove: (fileId: string) => Promise<void>
  /** Re-send one failed transfer from this device's retry queue. */
  onRetry?: (fileId: string) => Promise<void>
  /** Retry every failed transfer that originated here. */
  onRetryAll?: () => Promise<void>
  connected: boolean
}

export function DropPanel({ files, onSendFiles, onRemove, onRetry, onRetryAll, connected }: DropPanelProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const totalBytes = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files])
  const doneCount = useMemo(() => files.filter((f) => f.complete).length, [files])
  const failedMine = useMemo(() => files.filter((f) => f.error && f.mine), [files])

  function handleFiles(list: FileList | File[] | null) {
    if (!list) return
    void onSendFiles(list)
  }

  return (
    <div className="space-y-4">
      {/* dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Add files to send"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-2 focus-visible:outline-ring',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30',
        )}
      >
        <p className="text-sm font-medium">
          Drop files here, or <span className="text-primary underline underline-offset-2">browse</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Up to 50 MB per file · they go straight to the other devices in this session
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label="Choose files to send"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {/* summary — delivered/failed at a glance, with the queue-wide retry */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/30 px-4 py-3 text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <File className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {files.length} {files.length === 1 ? 'file' : 'files'} · {formatBytes(totalBytes)}
          </span>
          <span className="text-muted-foreground">
            {doneCount}/{files.length} delivered
          </span>
          {failedMine.length > 0 && (
            <span className="font-medium text-destructive">{failedMine.length} failed</span>
          )}
          {failedMine.length > 0 && onRetryAll && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-8 gap-1.5"
              onClick={() => void onRetryAll()}
              disabled={!connected}
              title={connected ? 'Send every failed file again' : 'Reconnect to the session first'}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Retry failed
            </Button>
          )}
        </div>
      )}

      {/* transfers */}
      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium">No transfers yet</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Add a file here and it lands on every other device in the session (phone to computer,
            computer to phone, any mix). Nothing is uploaded to cloud storage.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {files.map((f) => (
            <FileRow
              key={f.fileId}
              file={f}
              onRemove={() => onRemove(f.fileId)}
              onRetry={onRetry}
              connected={connected}
            />
          ))}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleAlert className="size-3.5" aria-hidden="true" />
        Files live only in this session and are discarded when it ends or expires. Keep the tab
        open on both devices until a transfer finishes.
      </p>
    </div>
  )
}

function FileRow({
  file,
  onRemove,
  onRetry,
  connected,
}: {
  file: RoomFile
  onRemove: () => void
  onRetry?: (fileId: string) => Promise<void>
  connected: boolean
}) {
  const isImage = file.type.startsWith('image/')
  const canRetry = Boolean(file.error && file.mine && onRetry)

  // Build a downloadable/previewable object URL once the file is complete.
  // Chunks decode independently (see file-blob.ts for why joining base64
  // strings would corrupt every multi-chunk file).
  // useMemo (not an effect) so we never set state during render commitment.
  const objUrl = useMemo(() => {
    if (!file.complete) return null
    if (!chunksAreComplete(file.chunks, file.chunkCount)) return null
    const blob = chunksToBlob(file.chunks, file.type)
    return blob ? URL.createObjectURL(blob) : null
  }, [file.complete, file.chunks, file.chunkCount, file.type])

  // Revoke the object URL when it changes or the row unmounts.
  useEffect(() => {
    if (!objUrl) return
    return () => URL.revokeObjectURL(objUrl)
  }, [objUrl])

  const receivedPct = Math.min(100, Math.round((file.received / Math.max(1, file.chunkCount)) * 100))
  const sendPct = Math.min(100, Math.round((file.sendProgress ?? 0) * 100))

  const status = useMemo(() => {
    if (file.error) return { label: file.error, tone: 'text-destructive' }
    if (file.complete) return { label: `Delivered · ${format(new Date(file.at), 'h:mm a')}`, tone: 'text-primary' }
    if (file.mine) return { label: `Sending · ${sendPct}%`, tone: 'text-muted-foreground' }
    return { label: `Receiving · ${receivedPct}%`, tone: 'text-muted-foreground' }
  }, [file.error, file.complete, file.mine, sendPct, receivedPct, file.at])

  const progress = file.mine ? sendPct : receivedPct

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3.5">
        {isImage && objUrl ? (
          <img src={objUrl} alt={`Preview of ${file.name}`} className="size-12 shrink-0 rounded-lg border object-cover" />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
            {typeIcon(file.type)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground">{formatBytes(file.size)}</span>
          </p>
          <p className={cn('mt-0.5 flex items-center gap-1.5 text-xs', status.tone)}>
            {file.mine ? (
              <>
                <Monitor className="size-3.5 shrink-0" aria-hidden="true" />
                You → {file.complete ? 'session' : 'sending'}
              </>
            ) : (
              <>
                {file.device === 'phone' ? (
                  <Smartphone className="size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Monitor className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                {file.from} → this device
              </>
            )}
            <span className="truncate">· {status.label}</span>
          </p>
          {!file.complete && !file.error && (
            <Progress value={progress} className="mt-2 h-1.5" aria-label={`${status.label}`} />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {canRetry && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => void onRetry?.(file.fileId)}
              disabled={!connected}
              title={connected ? 'Send this file again' : 'Reconnect to the session first'}
              aria-label={`Retry sending ${file.name}`}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" /> Retry
            </Button>
          )}
          {objUrl && (
            <a
              href={objUrl}
              download={file.name}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="size-3.5" aria-hidden="true" /> Save
            </a>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-destructive" aria-label={`Remove ${file.name}`}>
                {file.mine && !file.complete ? <X className="size-4" /> : <Trash2 className="size-4" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove “{file.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  {file.mine
                    ? 'It disappears from every device in the session, including yours.'
                    : 'It disappears from this device. Other devices keep their copy.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}
