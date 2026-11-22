'use client'

// Shared plumbing for instant tools: the privacy strip, the drop zone and the
// result/download patterns. Every instant tool composes these so the pages
// stay consistent — same spacing, same states, same voice.

import { useCallback, useRef, useState } from 'react'
import { Download, FolderOpen, ShieldCheck, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** The one privacy line every instant tool carries. */
export function PrivacyStrip({ detail }: { detail: string }) {
  return (
    <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
      {detail}
    </p>
  )
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

/** Click a hidden input programmatically. */
export function useFilePick(accept?: string, multiple = true, directory = false) {
  const ref = useRef<HTMLInputElement>(null)
  const pick = useCallback(() => ref.current?.click(), [])
  const input = (
    <input
      ref={ref}
      type="file"
      className="sr-only"
      aria-hidden="true"
      tabIndex={-1}
      accept={directory ? undefined : accept}
      multiple={multiple}
      {...(directory ? { webkitdirectory: '', directory: '' } : {})}
    />
  )
  return { pick, input }
}

interface DropZoneProps {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  directory?: boolean
  title: string
  hint: string
  compact?: boolean
}

/** Drag-and-drop target with a click-to-pick fallback and folder support. */
export function DropZone({
  onFiles,
  accept,
  multiple = true,
  directory = false,
  title,
  hint,
  compact = false,
}: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const depthRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)

  const emit = useCallback(
    (list: FileList | null) => {
      const files = Array.from(list ?? [])
      if (files.length) onFiles(files)
    },
    [onFiles],
  )

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        depthRef.current += 1
        setDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        depthRef.current -= 1
        if (depthRef.current <= 0) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        depthRef.current = 0
        setDragging(false)
        emit(e.dataTransfer.files)
      }}
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors',
        'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
      )}
    >
      {directory ? (
        <FolderOpen className="size-6 text-muted-foreground" aria-hidden="true" />
      ) : (
        <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
      )}
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="mt-1 flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}>
          Choose {multiple ? 'files' : 'a file'}
        </Button>
        {directory && (
          <Button type="button" size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); dirInputRef.current?.click() }}>
            <FolderOpen className="size-3.5" aria-hidden="true" /> Choose a folder
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          emit(e.target.files)
          e.target.value = ''
        }}
      />
      {directory && (
        <input
          ref={dirInputRef}
          type="file"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          multiple
          // @ts-expect-error — non-standard but universally supported folder pick
          webkitdirectory=""
          directory=""
          onChange={(e) => {
            emit(e.target.files)
            e.target.value = ''
          }}
        />
      )}
    </div>
  )
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function DownloadAllButton({ files, archiveName }: { files: Array<{ name: string; blob: Blob }>; archiveName: string }) {
  const [busy, setBusy] = useState(false)
  if (files.length < 2) return null
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const { default: JSZip } = await import('jszip')
          const zip = new JSZip()
          for (const f of files) zip.file(f.name, f.blob)
          const out = await zip.generateAsync({ type: 'blob' })
          downloadBlob(out, archiveName)
        } finally {
          setBusy(false)
        }
      }}
    >
      <Download className="size-4" aria-hidden="true" />
      {busy ? 'Packing…' : `Download all ${files.length} as ZIP`}
    </Button>
  )
}
