'use client'

// Folder Share panel: hand over an entire folder, structure included.
// Built on the Drop transfer protocol — files carry a relPath that receivers
// use to group, display and reassemble the folder (as a ZIP download).

import { useEffect, useMemo, useRef, useState } from 'react'
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
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Download,
  File,
  FileText,
  Folder,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Music,
  RotateCcw,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { chunksToBlob } from '@/lib/file-blob'
import { dirnameOf, rootNameOf, type FolderItem } from '@/lib/folder-files'
import type { RoomFile } from '@/components/session/drop-panel'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function typeIcon(type: string) {
  const cls = 'size-5 text-muted-foreground'
  if (type.startsWith('image/')) return <ImageIcon className={cls} />
  if (type.startsWith('audio/')) return <Music className={cls} />
  if (type.startsWith('text/') || type.includes('pdf') || type.includes('document')) return <FileText className={cls} />
  return <File className={cls} />
}

interface FolderPanelProps {
  files: RoomFile[]
  onSendItems: (items: FolderItem[]) => Promise<void>
  onRemove: (fileId: string) => Promise<void>
  /** Re-send one failed transfer from this device's retry queue. */
  onRetry?: (fileId: string) => Promise<void>
  /** Re-send every failed transfer that originated on this device. */
  onRetryAll?: () => Promise<void>
  connected: boolean
}

export function FolderPanel({
  files,
  onSendItems,
  onRemove,
  onRetry,
  onRetryAll,
  connected,
}: FolderPanelProps) {
  const [dragging, setDragging] = useState(false)
  const [zipping, setZipping] = useState(false)
  // Which folder groups are collapsed (the whole group is one toggle — loose
  // files and the global ZIP stay outside of it).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  // Folder whose per-group ZIP is currently being built ("photos/2024" while
  // that group's download is in flight).
  const [zippingDir, setZippingDir] = useState<string | null>(null)
  const filesInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const loose = useMemo(() => files.filter((f) => !f.relPath), [files])
  const grouped = useMemo(() => {
    const map = new Map<string, RoomFile[]>()
    for (const f of files) {
      if (!f.relPath) continue
      const dir = dirnameOf(f.relPath)
      const list = map.get(dir)
      if (list) list.push(f)
      else map.set(dir, [f])
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [files])

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
  const folderCount = grouped.length
  const rootLabel = useMemo(() => {
    const roots = new Set(files.filter((f) => f.relPath).map((f) => rootNameOf(f.relPath)))
    return roots.size === 1 ? roots.values().next().value : null
  }, [files])
  const allDone = files.length > 0 && files.every((f) => f.complete)
  const doneCount = files.filter((f) => f.complete).length
  const failedMine = useMemo(() => files.filter((f) => f.error && f.mine), [files])

  function collect(list: FileList | null, kind: 'files' | 'folder') {
    if (!list || list.length === 0) return
    const items: FolderItem[] = Array.from(list).map((file) => ({
      file,
      relPath:
        kind === 'folder'
          ? ((file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined)
          : undefined,
    }))
    void onSendItems(items)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (!connected) {
      toast.error('Connect to the session before adding files.')
      return
    }
    try {
      const dt = e.dataTransfer
      const { folderItemsFromDataTransfer } = await import('@/lib/folder-files')
      const items = await folderItemsFromDataTransfer(dt)
      if (items.length === 0) return
      await onSendItems(items)
    } catch {
      toast.error('Could not read the dropped items, try the buttons instead.')
    }
  }

  function toggleDir(dir: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })
  }

  /** Build a ZIP of one folder group only, paths kept relative to that group. */
  async function downloadGroupZip(dir: string, dirFiles: RoomFile[]) {
    if (zippingDir || !dirFiles.every((f) => f.complete)) return
    setZippingDir(dir)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      for (const f of dirFiles) {
        const blob = chunksToBlob(f.chunks, f.type || 'application/octet-stream')
        if (!blob) continue
        // Keep the path inside the folder ("2024/beach.jpg" for "photos/2024"),
        // so the ZIP mirrors what was shared, not the whole session tree.
        const inner = f.relPath && f.relPath.includes('/')
          ? f.relPath.slice(f.relPath.indexOf('/') + 1)
          : f.name
        zip.file(inner, blob)
      }
      const base = dir.includes('/') ? dir.slice(dir.lastIndexOf('/') + 1) : dir
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${base}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      toast.success('Folder ZIP built, check your downloads.')
    } catch {
      toast.error('Could not build that folder ZIP, download its files individually instead.')
    } finally {
      setZippingDir(null)
    }
  }

  async function downloadZip() {
    if (!allDone || zipping) return
    setZipping(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      for (const f of files) {
        const blob = chunksToBlob(f.chunks, f.type || 'application/octet-stream')
        if (!blob) continue
        zip.file(f.relPath || f.name, blob)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${rootLabel ?? 'shared-files'}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      toast.success('ZIP built, check your downloads.')
    } catch {
      toast.error('Could not build the ZIP, download files individually instead.')
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* dropzone + pickers */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Add files or folders to send"
        onClick={() => filesInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') filesInputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-2 focus-visible:outline-ring',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30',
        )}
      >
        <p className="text-sm font-medium">
          Drop a folder here, or <span className="text-primary underline underline-offset-2">browse</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          The whole structure arrives on the other devices, nested folders included
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 bg-background"
            onClick={() => filesInputRef.current?.click()}
          >
            <File className="size-4" aria-hidden="true" /> Add files
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 bg-background"
            onClick={() => folderInputRef.current?.click()}
          >
            <Folder className="size-4" aria-hidden="true" /> Add folder
          </Button>
        </div>

        <input
          ref={filesInputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label="Choose files to send"
          onChange={(e) => {
            collect(e.target.files, 'files')
            e.target.value = ''
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          className="sr-only"
          aria-label="Choose a folder to send"
          onChange={(e) => {
            collect(e.target.files, 'folder')
            e.target.value = ''
          }}
          {...{ webkitdirectory: '', directory: '' }}
        />
      </div>

      {/* summary */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/30 px-4 py-3 text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <File className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {files.length} {files.length === 1 ? 'file' : 'files'} · {formatBytes(totalBytes)}
          </span>
          {folderCount > 0 && (
            <span className="flex items-center gap-1.5 font-medium">
              <Folder className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {folderCount} {folderCount === 1 ? 'folder' : 'folders'}
              {rootLabel && <span className="font-normal text-muted-foreground">· “{rootLabel}”</span>}
            </span>
          )}
          <span className="text-muted-foreground">
            {doneCount}/{files.length} delivered
          </span>
          {failedMine.length > 0 && (
            <span className="font-medium text-destructive">
              {failedMine.length} failed
            </span>
          )}
          {failedMine.length > 0 && onRetryAll && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => void onRetryAll()}
              disabled={!connected}
              title={connected ? 'Send every failed file again' : 'Reconnect to the session first'}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Retry failed
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-8 gap-1.5"
            onClick={() => void downloadZip()}
            disabled={!allDone || zipping}
          >
            {zipping ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-3.5" aria-hidden="true" />
            )}
            {allDone ? `Download all (.zip)` : 'ZIP ready when all delivered'}
          </Button>
        </div>
      )}

      {/* transfers */}
      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium">No folders or files yet</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Pick a folder on this device and it lands on every other device in the session with its
            structure intact. Nothing is uploaded to cloud storage.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([dir, dirFiles]) => {
            const isCollapsed = collapsed.has(dir)
            const groupDone = dirFiles.every((f) => f.complete)
            return (
            <div key={dir} className="overflow-hidden rounded-xl border">
              <div className="flex items-center gap-2 border-b bg-muted/40 px-3.5 py-2">
                <button
                  type="button"
                  onClick={() => toggleDir(dir)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-ring"
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? `Expand folder ${dir}` : `Collapse folder ${dir}`}
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  )}
                  <Folder className={cn('size-4 shrink-0', isCollapsed ? 'text-muted-foreground' : 'text-primary')} aria-hidden="true" />
                  <span className="truncate text-xs font-semibold" title={dir}>
                    {dir}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {dirFiles.length} {dirFiles.length === 1 ? 'file' : 'files'} ·{' '}
                    {formatBytes(dirFiles.reduce((s, f) => s + f.size, 0))}
                  </span>
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                  onClick={() => void downloadGroupZip(dir, dirFiles)}
                  disabled={!groupDone || zippingDir === dir}
                  title={groupDone ? `Download the contents of ${dir} as one ZIP` : 'ZIP is ready when every file in this folder is delivered'}
                >
                  {zippingDir === dir ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="size-3" aria-hidden="true" />
                  )}
                  ZIP
                </Button>
              </div>
              {!isCollapsed && (
              <div className="divide-y">
                {dirFiles.map((f) => (
                  <FolderFileRow
                    key={f.fileId}
                    file={f}
                    onRemove={() => onRemove(f.fileId)}
                    onRetry={onRetry}
                    connected={connected}
                  />
                ))}
              </div>
              )}
            </div>
            )
          })}
          {loose.length > 0 && (
            <div className="overflow-hidden rounded-xl border">
              <div className="flex items-center gap-2 border-b bg-muted/40 px-3.5 py-2">
                <File className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs font-semibold text-muted-foreground">Loose files</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {loose.length} {loose.length === 1 ? 'file' : 'files'}
                </span>
              </div>
              <div className="divide-y">
                {loose.map((f) => (
                  <FolderFileRow
                    key={f.fileId}
                    file={f}
                    onRemove={() => onRemove(f.fileId)}
                    onRetry={onRetry}
                    connected={connected}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleAlert className="size-3.5" aria-hidden="true" />
        Folders live only in this session and are discarded when it ends or expires. Keep every tab
        open until all transfers finish. Then use “Download all” to rebuild the folder.
      </p>
    </div>
  )
}

function FolderFileRow({
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

  const objUrl = useMemo(() => {
    if (!file.complete) return null
    try {
      const blob = chunksToBlob(file.chunks, file.type || 'application/octet-stream')
      return blob ? URL.createObjectURL(blob) : null
    } catch {
      return null
    }
  }, [file.complete, file.chunks, file.chunkCount, file.type])

  // Revoke the object URL when it changes or the row unmounts.
  useEffect(() => {
    if (!objUrl) return
    return () => URL.revokeObjectURL(objUrl)
  }, [objUrl])

  const receivedPct = Math.min(100, Math.round((file.received / Math.max(1, file.chunkCount)) * 100))
  const sendPct = Math.min(100, Math.round((file.sendProgress ?? 0) * 100))

  const status = file.error
    ? { label: file.error, tone: 'text-destructive' }
    : file.complete
      ? { label: `Delivered · ${format(new Date(file.at), 'h:mm a')}`, tone: 'text-primary' }
      : file.mine
        ? { label: `Sending · ${sendPct}%`, tone: 'text-muted-foreground' }
        : { label: `Receiving · ${receivedPct}%`, tone: 'text-muted-foreground' }

  const progress = file.mine ? sendPct : receivedPct
  const pathInFolder = file.relPath?.includes('/')
    ? file.relPath.slice(file.relPath.indexOf('/') + 1)
    : file.name

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      {isImage && objUrl ? (
        <img src={objUrl} alt={`Preview of ${file.name}`} className="size-10 shrink-0 rounded-lg border object-cover" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
          {typeIcon(file.type)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate" title={pathInFolder}>{pathInFolder}</span>
          <span className="shrink-0 text-xs font-normal text-muted-foreground">{formatBytes(file.size)}</span>
        </p>
        <p className={cn('mt-0.5 flex items-center gap-1.5 text-xs', status.tone)}>
          {file.mine ? (
            <>
              <Monitor className="size-3.5 shrink-0" aria-hidden="true" />
              You → session
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
          <Progress value={progress} className="mt-1.5 h-1" aria-label={status.label} />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {canRetry && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
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
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Download className="size-3.5" aria-hidden="true" /> Save
          </a>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${file.name}`}
            >
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
    </div>
  )
}
