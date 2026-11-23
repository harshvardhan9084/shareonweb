'use client'

// Archive Explorer — open TAR / TAR.GZ / TGZ / GZ, rebuild selections into a
// ZIP, build fresh .tar.gz archives and gzip one file. Everything runs on
// this device: the TAR layer is a hand-written ustar reader and writer (no
// tar library), gzip uses the browser's native CompressionStream /
// DecompressionStream, and ZIP output reuses JSZip. There is no upload code
// on this page, so an archive never leaves the device.

import { useMemo, useState } from 'react'
import { FileDown, Loader2, PackageOpen, FilePlus2 } from 'lucide-react'
import JSZip from 'jszip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropZone, downloadBlob, PrivacyStrip } from '@/components/instant/instant-kit'

// ------------------------------------------------------------- constants ---

const BLOCK = 512
/** Uncompressed-byte ceiling for extraction: the work lives in tab memory. */
const EXTRACT_LIMIT = 1024 ** 3
const LIMIT_LABEL = '1 GB'

// ----------------------------------------------------------- tar helpers ---

type EntryKind = 'file' | 'dir' | 'symlink' | 'hardlink' | 'other'

interface ListedEntry {
  path: string
  size: number
  mtime: number
  kind: EntryKind
  /** Offset of the entry's data in the (decompressed) archive bytes. */
  dataStart: number
  /** Link target, for symlink/hardlink entries. */
  linkname: string
}

class TarError extends Error {}

const nameDecoder = new TextDecoder('utf-8', { fatal: false })

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < EXTRACT_LIMIT) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / EXTRACT_LIMIT).toFixed(2)} GB`
}

function formatDate(mtime: number): string {
  if (!mtime) return '—'
  return new Date(mtime * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(i + 1) : path
}

/** Decode a NUL-terminated fixed-width header field as UTF-8. */
function decodeField(bytes: Uint8Array, start: number, len: number): string {
  let end = start
  const stop = start + len
  while (end < stop && bytes[end] !== 0) end++
  return nameDecoder.decode(bytes.subarray(start, end))
}

/**
 * Parse a numeric header field. Octal, space/NUL terminated, with GNU's
 * base-256 extension (first byte's high bit set) for values octal can't hold.
 */
function parseNumeric(bytes: Uint8Array, start: number, len: number): number {
  if (bytes[start] & 0x80) {
    let value = 0
    for (let i = start + 1; i < start + len; i++) value = value * 256 + bytes[i]
    return value
  }
  let text = ''
  for (let i = start; i < start + len; i++) {
    const c = bytes[i]
    if (c === 0) break
    text += String.fromCharCode(c)
  }
  text = text.trim()
  if (!text) return 0
  const value = parseInt(text, 8)
  return Number.isFinite(value) ? value : 0
}

function isZeroBlock(block: Uint8Array): boolean {
  for (let i = 0; i < block.length; i++) {
    if (block[i] !== 0) return false
  }
  return true
}

/** Sum of all 512 header bytes with the chksum field read as spaces. */
function headerChecksum(block: Uint8Array, signed = false): number {
  let sum = 0
  for (let i = 0; i < BLOCK; i++) {
    if (i >= 148 && i < 156) {
      sum += 0x20
      continue
    }
    const b = block[i]
    sum += signed && b & 0x80 ? b - 256 : b
  }
  return sum
}

/** Minimal PAX support: pull the "path=" record out of an extended header. */
function parsePaxPath(data: Uint8Array): string | null {
  const text = nameDecoder.decode(data)
  for (const line of text.split('\n')) {
    const match = /^\d+ path=(.*)$/.exec(line)
    if (match) return match[1]
  }
  return null
}

/**
 * Hand-written ustar reader. Walks 512-byte blocks from the start, verifies
 * every header checksum, and reports corrupt/truncated archives with the
 * byte offset where they went wrong.
 */
function parseTar(bytes: Uint8Array): ListedEntry[] {
  const entries: ListedEntry[] = []
  let off = 0
  let longName: string | null = null
  let longLink: string | null = null
  let paxPath: string | null = null

  while (off + BLOCK <= bytes.length) {
    const header = bytes.subarray(off, off + BLOCK)
    if (isZeroBlock(header)) break

    const stored = parseNumeric(header, 148, 8)
    if (stored !== headerChecksum(header) && stored !== headerChecksum(header, true)) {
      if (off === 0) {
        throw new TarError(
          'That file is not a TAR archive — its first header block (byte 0) fails the ustar checksum.',
        )
      }
      throw new TarError(
        `Corrupt archive: header checksum mismatch at byte ${off}. The archive is damaged or was not a TAR.`,
      )
    }

    const size = parseNumeric(header, 124, 12)
    const mtime = parseNumeric(header, 136, 12)
    const typeflag = String.fromCharCode(header[156])
    const dataStart = off + BLOCK
    const dataEnd = dataStart + size
    if (dataEnd > bytes.length) {
      throw new TarError(
        `Truncated archive: the header at byte ${off} promises ${formatSize(size)} of data, but the file ends at byte ${bytes.length}.`,
      )
    }

    if (typeflag === 'L' || typeflag === 'K') {
      // GNU long name / long linkname: the data block(s) hold the string and
      // apply to the next header.
      const text = decodeField(bytes.subarray(dataStart, dataEnd), 0, size)
      if (typeflag === 'L') longName = text
      else longLink = text
    } else if (typeflag === 'x' || typeflag === 'g') {
      // PAX extended header (applies to next entry) or global header.
      const path = parsePaxPath(bytes.subarray(dataStart, dataEnd))
      if (typeflag === 'x' && path) paxPath = path
    } else {
      let name = longName ?? paxPath ?? ''
      if (!name) {
        const base = decodeField(header, 0, 100)
        const prefix = decodeField(header, 345, 155)
        name = prefix ? `${prefix}/${base}` : base
      }
      const linkname = longLink ?? decodeField(header, 157, 100)
      let kind: EntryKind
      switch (typeflag) {
        case '0':
        case '\0':
        case '7': // contiguous file — stored like a regular one
          kind = 'file'
          break
        case '5':
          kind = 'dir'
          break
        case '2':
          kind = 'symlink'
          break
        case '1':
          kind = 'hardlink'
          break
        default:
          kind = 'other'
          break
      }
      if (name) {
        entries.push({
          path: name,
          size: kind === 'file' ? size : kind === 'other' ? size : 0,
          mtime,
          kind,
          dataStart: kind === 'file' ? dataStart : 0,
          linkname,
        })
      }
      longName = null
      longLink = null
      paxPath = null
    }

    off = dataStart + Math.ceil(size / BLOCK) * BLOCK
  }

  return entries
}

// ----------------------------------------------------------- gzip helpers ---

async function decompressGzip(file: File): Promise<Uint8Array<ArrayBuffer>> {
  const buf = await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
  return new Uint8Array(buf)
}

function gzipBlob(blob: Blob): Promise<Blob> {
  return new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob()
}

// ----------------------------------------------------------- ustar writer ---

const pathEncoder = new TextEncoder()

/**
 * Split a path into ustar's prefix (155 bytes) + name (100 bytes) at a slash.
 * Works on UTF-8 bytes (a 0x2f byte is always a real slash, never part of a
 * multi-byte character). Returns null when the path cannot be represented.
 */
function splitUstarPath(pathBytes: Uint8Array): { name: Uint8Array; prefix: Uint8Array } | null {
  if (pathBytes.length <= 100) {
    return { name: pathBytes, prefix: new Uint8Array(0) }
  }
  const top = Math.min(155, pathBytes.length - 2)
  const floor = pathBytes.length - 101
  for (let i = top; i >= floor && i > 0; i--) {
    if (pathBytes[i] !== 0x2f) continue
    const nameLen = pathBytes.length - i - 1
    if (nameLen >= 1 && nameLen <= 100) {
      return { name: pathBytes.subarray(i + 1), prefix: pathBytes.subarray(0, i) }
    }
  }
  return null
}

function writeAscii(header: Uint8Array, at: number, text: string): void {
  for (let i = 0; i < text.length; i++) header[at + i] = text.charCodeAt(i)
}

/** digits octal characters followed by a NUL (the field is digits + 1 wide). */
function octalField(value: number, digits: number): Uint8Array {
  const out = new Uint8Array(digits + 1)
  const text = value.toString(8)
  if (text.length > digits) {
    throw new TarError(`Value ${value} does not fit a ${digits}-digit octal ustar field.`)
  }
  const padded = text.padStart(digits, '0')
  for (let i = 0; i < digits; i++) out[i] = padded.charCodeAt(i)
  return out
}

function buildUstarHeader(opts: {
  pathBytes: Uint8Array
  size: number
  mtime: number
  typeflag: '0' | '5'
  mode: '0000644' | '0000755'
}): Uint8Array<ArrayBuffer> | null {
  const split = splitUstarPath(opts.pathBytes)
  if (!split) return null

  const h = new Uint8Array(BLOCK)
  h.set(split.name, 0) // name (100)
  writeAscii(h, 100, opts.mode) // mode, NUL comes from the zero fill
  writeAscii(h, 108, '0000000') // uid
  writeAscii(h, 116, '0000000') // gid
  h.set(octalField(opts.size, 11), 124) // size (12 with NUL)
  h.set(octalField(opts.mtime, 11), 136) // mtime (12 with NUL)
  h.fill(0x20, 148, 156) // checksum placeholder: spaces
  h[156] = opts.typeflag.charCodeAt(0) // typeflag
  // linkname (157..256) stays zero
  writeAscii(h, 257, 'ustar') // magic, NUL comes from the zero fill
  writeAscii(h, 263, '00') // version
  h.set(split.prefix, 345) // prefix (155)

  let sum = 0
  for (let i = 0; i < BLOCK; i++) sum += h[i]
  h.fill(0, 148, 156)
  h.set(octalField(sum, 6), 148) // 6 octal digits + NUL
  h[155] = 0x20 // the trailing space of the standard chksum field
  return h
}

/** Parent directories of every path, parents before children. */
function collectDirs(paths: string[]): string[] {
  const set = new Set<string>()
  for (const p of paths) {
    const parts = p.split('/')
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/')
      if (dir) set.add(dir)
    }
  }
  return [...set].sort((a, b) => a.length - b.length || a.localeCompare(b))
}

interface PickedItem {
  file: File
  path: string
  pathBytes: Uint8Array
  refused: boolean
}

// ---------------------------------------------------------------- component ---

const REJECT_REASON =
  'Name exceeds the ustar header limit (100 bytes + a 155-byte prefix) and cannot be split at a slash.'

function typeBadge(kind: EntryKind) {
  if (kind === 'dir') {
    return <Badge variant="outline" className="border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">Folder</Badge>
  }
  if (kind === 'symlink') {
    return <Badge variant="outline" className="border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300">Symlink</Badge>
  }
  if (kind === 'hardlink') {
    return <Badge variant="outline" className="border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300">Hardlink</Badge>
  }
  if (kind === 'other') {
    return <Badge variant="outline" className="border-stone-500/30 bg-stone-500/10 text-stone-700 dark:text-stone-300">Special</Badge>
  }
  return <Badge variant="outline" className="text-muted-foreground">File</Badge>
}

export function ArchiveTool() {
  const [openBusy, setOpenBusy] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [openFile, setOpenFile] = useState<{ name: string; size: number } | null>(null)
  const [tarBytes, setTarBytes] = useState<Uint8Array<ArrayBuffer> | null>(null)
  const [entries, setEntries] = useState<ListedEntry[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [zipBusy, setZipBusy] = useState(false)
  const [extractNote, setExtractNote] = useState<string | null>(null)

  const [picked, setPicked] = useState<PickedItem[]>([])
  const [makeName, setMakeName] = useState('archive')
  const [makeBusy, setMakeBusy] = useState(false)
  const [makeError, setMakeError] = useState<string | null>(null)

  const [gzFile, setGzFile] = useState<File | null>(null)
  const [gzIsGzip, setGzIsGzip] = useState(false)
  const [gzBusy, setGzBusy] = useState(false)
  const [gzError, setGzError] = useState<string | null>(null)
  const [gzResult, setGzResult] = useState<string | null>(null)

  const totalUncompressed = useMemo(
    () => entries.filter((e) => e.kind === 'file').reduce((s, e) => s + e.size, 0),
    [entries],
  )
  const linkCount = useMemo(
    () => entries.filter((e) => e.kind === 'symlink' || e.kind === 'hardlink').length,
    [entries],
  )
  const selectedTotal = useMemo(() => {
    let sum = 0
    for (const i of selected) {
      const e = entries[i]
      if (e && e.kind === 'file') sum += e.size
    }
    return sum
  }, [selected, entries])

  const eligible = picked.filter((p) => !p.refused)
  const makeTotal = eligible.reduce((s, p) => s + p.file.size, 0)
  const overLimit = makeTotal > EXTRACT_LIMIT
  const allSelected = entries.length > 0 && selected.size === entries.length
  const baseName = (openFile?.name ?? 'archive').replace(/\.(tar\.gz|tgz|tar|gz)$/i, '')

  // ------------------------------------------------------------ mode 1: open

  function resetOpen() {
    setOpenBusy(null)
    setOpenError(null)
    setOpenFile(null)
    setTarBytes(null)
    setEntries([])
    setSelected(new Set())
    setZipBusy(false)
    setExtractNote(null)
  }

  async function openArchive(file: File) {
    resetOpen()
    setOpenFile({ name: file.name, size: file.size })
    setOpenBusy(`Reading ${file.name} (${formatSize(file.size)})…`)
    try {
      let bytes: Uint8Array<ArrayBuffer>
      let wasGzipped = false
      const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
      if (head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b) {
        wasGzipped = true
        setOpenBusy('Decompressing gzip with the browser’s native engine…')
        bytes = await decompressGzip(file)
      } else {
        bytes = new Uint8Array(await file.arrayBuffer())
      }

      setOpenBusy('Walking the 512-byte blocks…')
      let parsed: ListedEntry[]
      try {
        parsed = parseTar(bytes)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'That file could not be read as a TAR archive.'
        throw new TarError(
          wasGzipped
            ? `${message} If the decompressed content is a single file, the GZip file tab below handles it directly.`
            : message,
        )
      }

      setTarBytes(bytes)
      setEntries(parsed)
      setSelected(new Set())
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not read that file — very large archives can exceed this device’s memory.'
      setOpenError(message)
      setOpenFile(null)
    } finally {
      setOpenBusy(null)
    }
  }

  function toggleEntry(index: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(index)
      else next.delete(index)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(entries.map((_, i) => i)) : new Set())
  }

  function saveOne(entry: ListedEntry) {
    setExtractNote(null)
    if (!tarBytes || entry.kind !== 'file') return
    if (entry.size > EXTRACT_LIMIT) {
      setExtractNote(
        `That entry is ${formatSize(entry.size)} — over the ${LIMIT_LABEL} extraction cap. Take it with a desktop tool.`,
      )
      return
    }
    downloadBlob(
      new Blob([tarBytes.subarray(entry.dataStart, entry.dataStart + entry.size)]),
      basename(entry.path) || 'file',
    )
  }

  async function saveSelectedZip() {
    if (!tarBytes) return
    setZipBusy(true)
    setExtractNote(null)
    try {
      const zip = new JSZip()
      let added = 0
      for (const i of selected) {
        const e = entries[i]
        if (!e) continue
        if (e.kind === 'file') {
          zip.file(e.path, tarBytes.subarray(e.dataStart, e.dataStart + e.size))
          added++
        } else if (e.kind === 'dir') {
          zip.folder(e.path)
        }
        // Symlinks and hardlinks are never extracted — they stay listed only.
      }
      if (added === 0) {
        setExtractNote('Nothing to extract in that selection (files only — folders and links carry no data).')
        return
      }
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })
      downloadBlob(blob, `${baseName || 'archive'}-selected.zip`)
    } catch {
      setExtractNote('Building the ZIP failed — most likely the selection exceeded this device’s memory.')
    } finally {
      setZipBusy(false)
    }
  }

  // ------------------------------------------------------ mode 2: make tar.gz

  function addFiles(files: File[]) {
    setMakeError(null)
    const mapped = files.map((file) => {
      const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
      const pathBytes = pathEncoder.encode(path)
      return {
        file,
        path,
        pathBytes,
        refused: splitUstarPath(pathBytes) === null,
      }
    })
    setPicked((prev) => {
      const seen = new Set(prev.map((p) => p.path))
      return [...prev, ...mapped.filter((m) => !seen.has(m.path))]
    })
  }

  function resetMake() {
    setPicked([])
    setMakeName('archive')
    setMakeBusy(false)
    setMakeError(null)
  }

  async function buildTarGz() {
    setMakeError(null)
    setMakeBusy(true)
    try {
      const now = Math.floor(Date.now() / 1000)
      const parts: BlobPart[] = []

      for (const dir of collectDirs(eligible.map((p) => p.path))) {
        const header = buildUstarHeader({
          pathBytes: pathEncoder.encode(dir),
          size: 0,
          mtime: now,
          typeflag: '5',
          mode: '0000755',
        })
        if (header) parts.push(header)
      }

      for (const item of eligible) {
        const header = buildUstarHeader({
          pathBytes: item.pathBytes,
          size: item.file.size,
          mtime: Math.max(0, Math.floor(item.file.lastModified / 1000)),
          typeflag: '0',
          mode: '0000644',
        })
        if (!header) continue // already marked refused at pick time
        parts.push(header)
        parts.push(item.file)
        const pad = (BLOCK - (item.file.size % BLOCK)) % BLOCK
        if (pad) parts.push(new Uint8Array(pad))
      }

      parts.push(new Uint8Array(BLOCK * 2)) // two zero blocks end the archive

      const tarBlob = new Blob(parts, { type: 'application/x-tar' })
      const gz = await gzipBlob(tarBlob)
      const outName = makeName.endsWith('.tar.gz')
        ? makeName
        : makeName.endsWith('.tar')
          ? `${makeName}.gz`
          : `${makeName || 'archive'}.tar.gz`
      downloadBlob(gz, outName)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Building the archive failed on this device.'
      setMakeError(`${message} Try fewer or smaller files.`)
    } finally {
      setMakeBusy(false)
    }
  }

  // ------------------------------------------------------- mode 3: gzip file

  async function pickGzFile(file: File) {
    setGzError(null)
    setGzResult(null)
    setGzFile(file)
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
    setGzIsGzip(head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b)
  }

  function resetGz() {
    setGzFile(null)
    setGzIsGzip(false)
    setGzBusy(false)
    setGzError(null)
    setGzResult(null)
  }

  async function runGzipCompress() {
    if (!gzFile) return
    setGzError(null)
    setGzBusy(true)
    try {
      const gz = await gzipBlob(gzFile)
      const outName = `${gzFile.name}.gz`
      downloadBlob(gz, outName)
      setGzResult(`Saved ${outName} — ${formatSize(gz.size)} (from ${formatSize(gzFile.size)}).`)
    } catch {
      setGzError('Gzip compression failed on this device — the file may be too large for this tab’s memory.')
    } finally {
      setGzBusy(false)
    }
  }

  async function runGzipDecompress() {
    if (!gzFile) return
    setGzError(null)
    setGzBusy(true)
    try {
      const blob = await new Response(gzFile.stream().pipeThrough(new DecompressionStream('gzip'))).blob()
      const stem = /\.gz$/i.test(gzFile.name) ? gzFile.name.slice(0, -3) : `${gzFile.name}-out`
      const outName = stem || 'file'
      downloadBlob(blob, outName)
      setGzResult(`Saved ${outName} — ${formatSize(blob.size)} (from ${formatSize(gzFile.size)} compressed).`)
    } catch {
      setGzError('That file does not decompress as gzip — the header said gzip, but the data is damaged or not gzip after all.')
    } finally {
      setGzBusy(false)
    }
  }

  // ------------------------------------------------------------------ render ---

  return (
    <div>
      <Tabs defaultValue="open">
        <TabsList className="h-11 w-full justify-start gap-1 p-1 sm:w-fit">
          <TabsTrigger value="open" className="h-10 px-3 sm:px-4">
            Open archive
          </TabsTrigger>
          <TabsTrigger value="make" className="h-10 px-3 sm:px-4">
            Make tar.gz
          </TabsTrigger>
          <TabsTrigger value="gz" className="h-10 px-3 sm:px-4">
            GZip file
          </TabsTrigger>
        </TabsList>

        {/* --------------------------------------------------- open archive */}
        <TabsContent value="open" className="mt-4">
          {!tarBytes ? (
            <div>
              <DropZone
                onFiles={(files) => void openArchive(files[0])}
                accept=".tar,.tar.gz,.tgz,.gz"
                multiple={false}
                title="Drop a .tar, .tar.gz, .tgz or .gz file"
                hint="Any file is accepted — the format is detected by its magic bytes. The archive is read, never uploaded."
              />
              {openBusy && (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {openBusy}
                </p>
              )}
              {openError && (
                <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {openError}
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <PackageOpen className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{openFile?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {entries.length} entries ·{' '}
                      {entries.filter((e) => e.kind === 'file').length} files ·{' '}
                      {entries.filter((e) => e.kind === 'dir').length} folders ·{' '}
                      {formatSize(totalUncompressed)} uncompressed
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => void saveSelectedZip()}
                    disabled={zipBusy || selected.size === 0 || selectedTotal > EXTRACT_LIMIT}
                  >
                    {zipBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
                    {zipBusy ? 'Packing…' : `Download selected (${selected.size}) as ZIP`}
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetOpen}>
                    Start over
                  </Button>
                </div>
              </div>

              {selectedTotal > EXTRACT_LIMIT && (
                <p role="alert" className="mt-3 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                  Your selection is {formatSize(selectedTotal)} uncompressed — over the {LIMIT_LABEL} extraction cap.
                  Take fewer entries, or use a desktop tool for the whole thing.
                </p>
              )}
              {totalUncompressed > EXTRACT_LIMIT && selectedTotal <= EXTRACT_LIMIT && (
                <p className="mt-3 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  Heads up: the whole archive holds {formatSize(totalUncompressed)} uncompressed. Any extraction
                  above {LIMIT_LABEL} is refused, per selection, to stay inside this device’s memory.
                </p>
              )}
              {linkCount > 0 && (
                <p className="mt-3 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  {linkCount} symlink/hardlink {linkCount === 1 ? 'entry is' : 'entries are'} listed with their
                  targets but never extracted or followed — links are skipped when the ZIP is rebuilt.
                </p>
              )}
              {extractNote && (
                <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {extractNote}
                </p>
              )}

              <div className="mt-4 max-h-96 overflow-auto rounded-xl border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="bg-card text-left">
                      <th className="w-10 px-3 py-2">
                        <Checkbox
                          checked={allSelected ? true : selected.size > 0 ? 'indeterminate' : false}
                          onCheckedChange={(checked) => toggleAll(checked === true)}
                          aria-label="Select all entries"
                        />
                      </th>
                      <th className="px-2 py-2 text-xs font-medium text-muted-foreground">Name</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">Size</th>
                      <th className="px-2 py-2 text-xs font-medium text-muted-foreground">Type</th>
                      <th className="px-2 py-2 text-xs font-medium text-muted-foreground">Modified</th>
                      <th className="w-12 px-2 py-2">
                        <span className="sr-only">Download entry</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {entries.map((entry, i) => (
                      <tr key={`${entry.path}-${i}`} className="bg-card">
                        <td className="px-3 py-2.5">
                          <Checkbox
                            checked={selected.has(i)}
                            onCheckedChange={(checked) => toggleEntry(i, checked === true)}
                            aria-label={`Select ${entry.path}`}
                          />
                        </td>
                        <td className="max-w-[240px] px-2 py-2.5 sm:max-w-none">
                          <p className="truncate font-mono text-xs">{entry.path}</p>
                          {entry.linkname && (
                            <p className="truncate font-mono text-[11px] text-muted-foreground">→ {entry.linkname}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                          {entry.kind === 'file' ? formatSize(entry.size) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5">{typeBadge(entry.kind)}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-muted-foreground">
                          {formatDate(entry.mtime)}
                        </td>
                        <td className="px-2 py-2.5">
                          {entry.kind === 'file' && (
                            <Button size="sm" variant="ghost" onClick={() => saveOne(entry)}>
                              <FileDown className="size-3.5" aria-hidden="true" />
                              <span className="sr-only">Download {entry.path}</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {entries.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  The archive parsed cleanly but holds no entries — it may be empty.
                </p>
              )}
            </div>
          )}

          <PrivacyStrip detail="Everything is parsed and rebuilt on this device — no archive is ever uploaded. Checksums are verified per header; corrupt or truncated archives are reported with the byte offset where they broke." />
        </TabsContent>

        {/* ---------------------------------------------------- make tar.gz */}
        <TabsContent value="make" className="mt-4">
          <DropZone
            onFiles={addFiles}
            multiple
            directory
            title="Drop files or a whole folder"
            hint="Folder structure is preserved inside the archive via the ustar prefix field. Nothing leaves this device."
          />

          {picked.length > 0 && (
            <div className="mt-4 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FilePlus2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {eligible.length} file{eligible.length === 1 ? '' : 's'} · {formatSize(makeTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">Plus a folder entry per directory, then two zero blocks close the archive.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div>
                    <Label htmlFor="archive-name" className="sr-only">
                      Archive name
                    </Label>
                    <Input
                      id="archive-name"
                      value={makeName}
                      onChange={(e) => setMakeName(e.target.value)}
                      aria-label="Archive name"
                      placeholder="archive"
                      className="h-9 w-40"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void buildTarGz()}
                    disabled={makeBusy || eligible.length === 0 || overLimit}
                  >
                    {makeBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
                    {makeBusy ? 'Packing…' : 'Download .tar.gz'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetMake}>
                    Start over
                  </Button>
                </div>
              </div>

              {overLimit && (
                <p role="alert" className="mt-3 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                  That is {formatSize(makeTotal)} of input — over the {LIMIT_LABEL} cap for building in this tab.
                  Split the set, or use a desktop archiver for this one.
                </p>
              )}
              {makeError && (
                <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {makeError}
                </p>
              )}

              <ul className="mt-3 max-h-96 divide-y overflow-y-auto">
                {picked.map((item) => (
                  <li key={item.path} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-xs">{item.path}</span>
                      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {formatSize(item.file.size)}
                        {item.refused && (
                          <Badge variant="outline" className="border-rose-600/30 bg-rose-500/10 text-rose-800 dark:text-rose-300">
                            Won’t fit — left out
                          </Badge>
                        )}
                      </span>
                      {item.refused && <span className="mt-0.5 block text-[11px] text-rose-700 dark:text-rose-300">{REJECT_REASON}</span>}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPicked((prev) => prev.filter((p) => p.path !== item.path))}
                    >
                      Remove
                      <span className="sr-only"> {item.path}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PrivacyStrip detail="Everything is parsed and rebuilt on this device — no archive is ever uploaded. The TAR is assembled here and gzipped with the browser’s native engine before download." />
        </TabsContent>

        {/* ------------------------------------------------------ gzip file */}
        <TabsContent value="gz" className="mt-4">
          {!gzFile ? (
            <DropZone
              onFiles={(files) => void pickGzFile(files[0])}
              multiple={false}
              title="Drop one file to gzip — or one .gz to decompress"
              hint="The format is detected from the first two bytes (0x1f 0x8b), not the file name."
            />
          ) : (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{gzFile.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatSize(gzFile.size)} ·{' '}
                    {gzIsGzip
                      ? 'gzip data detected — it can be decompressed here.'
                      : 'not gzip — it can be compressed here.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {gzIsGzip ? (
                    <Button size="sm" onClick={() => void runGzipDecompress()} disabled={gzBusy}>
                      {gzBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
                      {gzBusy ? 'Decompressing…' : 'Decompress'}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => void runGzipCompress()} disabled={gzBusy}>
                      {gzBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
                      {gzBusy ? 'Compressing…' : 'Gzip it'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={resetGz}>
                    Start over
                  </Button>
                </div>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                The gzip format stores no filename — the output name is derived from the input name
                {gzIsGzip ? ' (a .gz suffix is stripped, otherwise “-out” is appended).' : ' (a .gz suffix is added).'}
              </p>

              {gzError && (
                <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {gzError}
                </p>
              )}
              {gzResult && (
                <p role="status" className="mt-3 text-sm font-medium text-primary">
                  {gzResult}
                </p>
              )}
            </div>
          )}
          {gzError && !gzFile && (
            <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {gzError}
            </p>
          )}

          <PrivacyStrip detail="Everything is parsed and rebuilt on this device — no archive is ever uploaded. Compression and decompression stream through the browser’s native gzip engine." />
        </TabsContent>
      </Tabs>
    </div>
  )
}
