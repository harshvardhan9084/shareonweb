'use client'

// Zip & Unzip — pack files/folders into a ZIP or unpack an archive, entirely
// on this device (JSZip runs in the browser; nothing is uploaded).

import { useMemo, useState } from 'react'
import { FileDown, FileUp, Folder, Loader2, PackageOpen } from 'lucide-react'
import JSZip from 'jszip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DownloadAllButton, DropZone, downloadBlob, formatBytes, PrivacyStrip } from '@/components/instant/instant-kit'

type Mode = 'pack' | 'unpack'

interface PackedItem {
  file: File
  /** Path inside the archive (webkitRelativePath preserves folders). */
  path: string
}

interface ZipEntry {
  path: string
  size: number
  dir: boolean
}

const isZip = (f: File) => /\.zip$/i.test(f.name) || f.type === 'application/zip'

export function ZipTool() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [items, setItems] = useState<PackedItem[]>([])
  const [entries, setEntries] = useState<ZipEntry[]>([])
  const [archive, setArchive] = useState<File | null>(null)
  const [archiveName, setArchiveName] = useState('archive.zip')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [unpacked, setUnpacked] = useState<{ name: string; blob: Blob }[] | null>(null)

  const totalSize = useMemo(() => items.reduce((s, i) => s + i.file.size, 0), [items])
  const entriesSize = useMemo(() => entries.reduce((s, e) => s + e.size, 0), [entries])

  function reset() {
    setMode(null)
    setItems([])
    setEntries([])
    setArchive(null)
    setUnpacked(null)
    setError(null)
    setProgress(0)
  }

  async function handleFiles(files: File[]) {
    setError(null)
    setUnpacked(null)
    const zip = files.find(isZip)
    if (zip && files.length === 1) {
      // A single .zip drops into unpack mode; anything else packs.
      setMode('unpack')
      setArchive(zip)
      setArchiveName(zip.name.replace(/\.zip$/i, ''))
      setBusy(true)
      try {
        const loaded = await JSZip.loadAsync(zip)
        const list: ZipEntry[] = []
        loaded.forEach((path, entry) => {
          list.push({ path, size: entry.dir ? 0 : (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0, dir: entry.dir })
        })
        list.sort((a, b) => a.path.localeCompare(b.path))
        setEntries(list)
      } catch {
        setError('That file could not be read as a ZIP archive. If it is a RAR or 7z, this tool does not handle those formats.')
        setMode(null)
        setArchive(null)
      } finally {
        setBusy(false)
      }
      return
    }
    setMode('pack')
    setEntries([])
    const mapped: PackedItem[] = files.map((f) => ({
      file: f,
      path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
    }))
    setItems((prev) => {
      const seen = new Set(prev.map((p) => p.path))
      return [...prev, ...mapped.filter((m) => !seen.has(m.path))]
    })
  }

  async function pack() {
    setBusy(true)
    setError(null)
    setProgress(0)
    try {
      const zip = new JSZip()
      for (const item of items) zip.file(item.path, item.file)
      const blob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => setProgress(Math.round(meta.percent)),
      )
      const name = archiveName.endsWith('.zip') ? archiveName : `${archiveName || 'archive'}.zip`
      downloadBlob(blob, name)
    } catch {
      setError('Packing failed — most likely the combined size exceeded this device\u2019s memory. Try smaller batches.')
    } finally {
      setBusy(false)
    }
  }

  async function unpackAll() {
    if (!archive) return
    setBusy(true)
    setError(null)
    try {
      const loaded = await JSZip.loadAsync(archive)
      const out: { name: string; blob: Blob }[] = []
      for (const entry of Object.values(loaded.files)) {
        if (entry.dir) continue
        const blob = await entry.async('blob')
        out.push({ name: entry.name, blob })
      }
      setUnpacked(out)
    } catch {
      setError('Extraction failed — the archive may be encrypted or corrupted.')
    } finally {
      setBusy(false)
    }
  }

  async function unpackOne(entry: ZipEntry) {
    if (!archive) return
    try {
      const loaded = await JSZip.loadAsync(archive)
      const file = loaded.file(entry.path)
      if (!file) return
      const blob = await file.async('blob')
      downloadBlob(blob, entry.path.split('/').pop() || entry.path)
    } catch {
      setError('Could not extract that entry.')
    }
  }

  // ---------------------------------------------------------------- mode pick
  if (mode === null) {
    return (
      <div>
        <DropZone
          onFiles={handleFiles}
          title="Drop files, a folder, or a .zip archive"
          hint="Files and folders are packed into a ZIP — a .zip opens for extraction. Nothing is uploaded."
          multiple
          directory
        />
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {busy && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Reading the archive…
          </p>
        )}
        <PrivacyStrip detail="Archives are built and read entirely on this device with JavaScript. Your files never touch a server." />
      </div>
    )
  }

  // ------------------------------------------------------------------ unpack
  if (mode === 'unpack') {
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="flex min-w-0 items-center gap-3">
            <PackageOpen className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{archive?.name}</p>
              <p className="text-xs text-muted-foreground">
                {entries.filter((e) => !e.dir).length} files · {formatBytes(entriesSize)} uncompressed
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={unpackAll} disabled={busy || entries.every((e) => e.dir)}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
              {busy ? 'Extracting…' : 'Extract everything'}
            </Button>
            <Button size="sm" variant="outline" onClick={reset}>
              Start over
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {entries.length > 0 && (
          <div className="mt-4 max-h-96 overflow-y-auto rounded-xl border" data-testid="zip-entries">
            <ul className="divide-y text-sm">
              {entries.map((e) => (
                <li key={e.path} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    {e.dir ? (
                      <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <span className="size-4 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate font-mono text-xs">{e.path}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    {!e.dir && formatBytes(e.size)}
                    {!e.dir && (
                      <Button size="sm" variant="ghost" onClick={() => void unpackOne(e)}>
                        <FileDown className="size-3.5" aria-hidden="true" /> Save
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {unpacked && (
          <div className="mt-4 rounded-xl border bg-card p-4">
            <p className="text-sm font-medium">
              Extracted {unpacked.length} files — your browser downloaded them one by one.
            </p>
            <DownloadAllButton
              files={unpacked}
              archiveName={`${archiveName || 'extracted'}.zip`}
            />
          </div>
        )}

        <PrivacyStrip detail="The archive is opened in this tab with JavaScript — it is never uploaded anywhere." />
      </div>
    )
  }

  // -------------------------------------------------------------------- pack
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex min-w-0 items-center gap-3">
          <FileUp className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {items.length} file{items.length === 1 ? '' : 's'} · {formatBytes(totalSize)}
            </p>
            <p className="text-xs text-muted-foreground">Folder structure is preserved inside the archive.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={archiveName}
            onChange={(e) => setArchiveName(e.target.value)}
            aria-label="Archive name"
            className="h-9 w-44"
          />
          <Button size="sm" onClick={pack} disabled={busy || items.length === 0}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
            {busy ? `Packing ${progress}%` : 'Download ZIP'}
          </Button>
          <Button size="sm" variant="outline" onClick={reset}>
            Start over
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <DropZone
        onFiles={handleFiles}
        compact
        multiple
        directory
        title="Add more files or folders"
        hint="They join the archive with their structure intact."
      />

      {items.length > 0 && (
        <div className="mt-4 max-h-96 overflow-y-auto rounded-xl border">
          <ul className="divide-y text-sm">
            {items.map((it) => (
              <li key={it.path} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="truncate font-mono text-xs">{it.path}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  {formatBytes(it.file.size)}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setItems((prev) => prev.filter((p) => p.path !== it.path))}
                  >
                    Remove
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PrivacyStrip detail="The archive is built entirely on this device with JavaScript. Your files never touch a server." />
    </div>
  )
}
