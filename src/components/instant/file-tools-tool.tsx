'use client'

// File Workshop — split, rejoin, bulk-rename, re-extend and de-duplicate.
// Five modes, one tab, zero network: files are read with the File API,
// processed locally and handed back as downloads. Splitting cuts the file as
// Blob slices, so the bytes are never even loaded a second time. SHA-256
// comes from WebCrypto for files that fit in memory and from a compact
// streaming implementation for the ones that do not — the same FIPS 180-4
// algorithm either way, and they agree byte for byte.

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileDown,
  Loader2,
  X,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DownloadAllButton,
  DropZone,
  PrivacyStrip,
  downloadBlob,
} from '@/components/instant/instant-kit'

// ------------------------------------------------------------------ limits ---

const TWO_GB = 2 * 1024 ** 3
const MAX_PARTS = 500
/** Full SHA-256 is only computed for files at or under this size. */
const FULL_HASH_LIMIT = 256 * 1024 ** 2
/** Fingerprint window: first 64 KB + last 64 KB. */
const PARTIAL_WINDOW = 64 * 1024
/** Blobs up to this size are hashed in one WebCrypto call; bigger stream. */
const WEB_CRYPTO_LIMIT = 32 * 1024 ** 2
const MANIFEST_TOOL = 'kontivo-file-workshop'

// ------------------------------------------------------------------ hashing --

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

/**
 * Incremental SHA-256 (FIPS 180-4). WebCrypto's digest is one-shot only, so
 * multi-GB blobs are hashed through this instead, 8 MB at a time. Verified
 * against WebCrypto output byte for byte during development.
 */
class StreamingSha256 {
  private h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ])
  private w = new Uint32Array(64)
  private buf = new Uint8Array(64)
  private bufLen = 0
  private bytes = 0

  update(data: Uint8Array): void {
    this.bytes += data.length
    let offset = 0
    if (this.bufLen > 0) {
      const take = Math.min(64 - this.bufLen, data.length)
      this.buf.set(data.subarray(0, take), this.bufLen)
      this.bufLen += take
      offset = take
      if (this.bufLen === 64) {
        this.compress(this.buf)
        this.bufLen = 0
      }
    }
    while (offset + 64 <= data.length) {
      this.compress(data.subarray(offset, offset + 64))
      offset += 64
    }
    if (offset < data.length) {
      this.buf.set(data.subarray(offset))
      this.bufLen = data.length - offset
    }
  }

  private compress(block: Uint8Array): void {
    const w = this.w
    for (let i = 0; i < 16; i++) {
      const j = i * 4
      w[i] =
        (block[j] << 24) |
        (block[j + 1] << 16) |
        (block[j + 2] << 8) |
        block[j + 3]
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15]
      const y = w[i - 2]
      const s0 =
        ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)
      const s1 =
        ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }
    let a = this.h[0]
    let b = this.h[1]
    let c = this.h[2]
    let d = this.h[3]
    let e = this.h[4]
    let f = this.h[5]
    let g = this.h[6]
    let h = this.h[7]
    for (let i = 0; i < 64; i++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K256[i] + w[i]) | 0
      const S0 =
        ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) | 0
      h = g
      g = f
      f = e
      e = (d + t1) | 0
      d = c
      c = b
      b = a
      a = (t1 + t2) | 0
    }
    this.h[0] = (this.h[0] + a) | 0
    this.h[1] = (this.h[1] + b) | 0
    this.h[2] = (this.h[2] + c) | 0
    this.h[3] = (this.h[3] + d) | 0
    this.h[4] = (this.h[4] + e) | 0
    this.h[5] = (this.h[5] + f) | 0
    this.h[6] = (this.h[6] + g) | 0
    this.h[7] = (this.h[7] + h) | 0
  }

  digestHex(): string {
    const bits = this.bytes * 8
    const hi = Math.floor(bits / 2 ** 32)
    const lo = bits % 2 ** 32
    this.buf[this.bufLen++] = 0x80
    if (this.bufLen > 56) {
      while (this.bufLen < 64) this.buf[this.bufLen++] = 0
      this.compress(this.buf)
      this.bufLen = 0
    }
    while (this.bufLen < 56) this.buf[this.bufLen++] = 0
    this.buf[56] = (hi >>> 24) & 0xff
    this.buf[57] = (hi >>> 16) & 0xff
    this.buf[58] = (hi >>> 8) & 0xff
    this.buf[59] = hi & 0xff
    this.buf[60] = (lo >>> 24) & 0xff
    this.buf[61] = (lo >>> 16) & 0xff
    this.buf[62] = (lo >>> 8) & 0xff
    this.buf[63] = lo & 0xff
    this.compress(this.buf)
    let hex = ''
    for (let i = 0; i < 8; i++) {
      hex += (this.h[i] >>> 0).toString(16).padStart(8, '0')
    }
    return hex
  }
}

function toHex(digest: ArrayBuffer): string {
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** SHA-256 via WebCrypto — for bytes already in memory. */
async function sha256HexWebCrypto(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer)
  return toHex(digest)
}

const HASH_CHUNK = 8 * 1024 * 1024

/**
 * SHA-256 of any Blob. Small blobs go through WebCrypto in one call; larger
 * ones stream slices through the incremental implementation above, because
 * a multi-GB file cannot sit in memory twice. Both paths are SHA-256.
 */
async function sha256Blob(
  blob: Blob,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  if (blob.size <= WEB_CRYPTO_LIMIT) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const hex = await sha256HexWebCrypto(bytes)
    onProgress?.(1)
    return hex
  }
  const hasher = new StreamingSha256()
  let offset = 0
  while (offset < blob.size) {
    const end = Math.min(offset + HASH_CHUNK, blob.size)
    const chunk = await blob.slice(offset, end).arrayBuffer()
    hasher.update(new Uint8Array(chunk))
    offset = end
    onProgress?.(offset / blob.size)
  }
  return hasher.digestHex()
}

/** Fast fingerprint: first 64 KB + last 64 KB (the whole file when small). */
async function partialHashBlob(blob: Blob): Promise<string> {
  if (blob.size <= PARTIAL_WINDOW * 2) return sha256Blob(blob)
  const head = new Uint8Array(await blob.slice(0, PARTIAL_WINDOW).arrayBuffer())
  const tail = new Uint8Array(await blob.slice(blob.size - PARTIAL_WINDOW).arrayBuffer())
  const both = new Uint8Array(head.length + tail.length)
  both.set(head, 0)
  both.set(tail, head.length)
  return sha256HexWebCrypto(both)
}

// ------------------------------------------------------------- name helpers --

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / (1024 * 1024)).toFixed(2)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

/** "video.mp4" -> { base: "video", ext: "mp4" }; dotfiles have no extension. */
function splitExt(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, dot), ext: name.slice(dot + 1) }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The trailing number in a name: video.mp4.part003 -> 3, scan_002 -> 2. */
function trailingNumber(name: string): number | null {
  const m = /(\d+)(?=[^\d]*$)/.exec(name)
  return m ? Number(m[1]) : null
}

/** Natural order for parts: numbered names by number, the rest by name. */
function naturalCompare(a: string, b: string): number {
  const na = trailingNumber(a)
  const nb = trailingNumber(b)
  if (na !== null && nb !== null && na !== nb) return na - nb
  return a.localeCompare(b, undefined, { numeric: true })
}

function fileKey(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`
}

function partName(original: string, index: number): string {
  return `${original}.part${String(index + 1).padStart(3, '0')}`
}

function stripPartSuffix(name: string): string {
  return name.replace(/\.part\d+$/i, '')
}

// ------------------------------------------------------------------ manifest -

interface SplitManifest {
  tool?: string
  version?: number
  originalName: string
  originalSize: number
  sha256: string
  parts: number
  partSize: number
  partSizes?: number[]
  splitBy?: 'size' | 'count'
}

function validateManifest(
  raw: unknown,
): { ok: true; manifest: SplitManifest } | { ok: false; reason: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: 'not a JSON object' }
  }
  const r = raw as Record<string, unknown>
  if (typeof r.originalName !== 'string' || !r.originalName) {
    return { ok: false, reason: 'originalName missing' }
  }
  if (typeof r.originalSize !== 'number' || r.originalSize < 0) {
    return { ok: false, reason: 'originalSize missing' }
  }
  if (typeof r.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(r.sha256)) {
    return { ok: false, reason: 'sha256 missing or not a 64-character hex string' }
  }
  if (typeof r.parts !== 'number' || r.parts < 1) {
    return { ok: false, reason: 'parts count missing' }
  }
  return {
    ok: true,
    manifest: {
      tool: typeof r.tool === 'string' ? r.tool : undefined,
      version: typeof r.version === 'number' ? r.version : undefined,
      originalName: r.originalName,
      originalSize: r.originalSize,
      sha256: r.sha256,
      parts: r.parts,
      partSize: typeof r.partSize === 'number' ? r.partSize : 0,
      partSizes: Array.isArray(r.partSizes)
        ? r.partSizes.filter((n): n is number => typeof n === 'number')
        : undefined,
      splitBy: r.splitBy === 'count' ? 'count' : 'size',
    },
  }
}

// ------------------------------------------------------------ shared pieces --

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {children}
    </p>
  )
}

function WarnNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
      {children}
    </p>
  )
}

function ProgressLine({ value, status }: { value: number; status: string }) {
  return (
    <div className="mt-3" role="status" aria-live="polite">
      <Progress value={Math.round(value * 100)} />
      <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
        {status}
      </p>
    </div>
  )
}

function PickedBar({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5">
      <p className="min-w-0 truncate text-sm text-muted-foreground">{label}</p>
      <Button size="sm" variant="ghost" onClick={onClear}>
        <X className="size-3.5" aria-hidden="true" /> Clear
      </Button>
    </div>
  )
}

function HashLine({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="truncate font-mono" title={hash}>
        {hash.slice(0, 32)}…
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-1.5"
        aria-label="Copy SHA-256"
        onClick={() => {
          void navigator.clipboard?.writeText(hash).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          })
        }}
      >
        {copied ? (
          <Check className="size-3 text-primary" aria-hidden="true" />
        ) : (
          <Copy className="size-3" aria-hidden="true" />
        )}
      </Button>
    </p>
  )
}

/** Shared copy-downloads note for the rename/extension apply actions. */
function CopiesNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/** old -> new preview rows with rose highlighting for name collisions. */
function RenamePreview({
  rows,
}: {
  rows: Array<{ oldName: string; newName: string }>
}) {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.newName, (counts.get(r.newName) ?? 0) + 1)
  const conflict = new Set(
    [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n),
  )
  return (
    <div className="mt-4">
      {conflict.size > 0 && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {conflict.size} name{conflict.size === 1 ? '' : 's'} would be claimed by two
          files at once (highlighted in rose). Adjust the rules so every file keeps a
          unique name — a ZIP cannot hold two identical names either.
        </p>
      )}
      <div className="fw-scroll max-h-96 overflow-auto rounded-xl border">
        <table className="w-full min-w-[440px] text-sm">
          <thead>
            <tr className="bg-card text-left">
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Current name</th>
              <th className="w-8 px-1 py-2"><span className="sr-only">becomes</span></th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">New name</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => {
              const bad = conflict.has(r.newName)
              const changed = r.newName !== r.oldName
              return (
                <tr key={`${r.oldName}-${i}`} className={bad ? 'bg-destructive/5' : 'bg-card'}>
                  <td className="max-w-[24ch] truncate px-3 py-2 text-muted-foreground" title={r.oldName}>
                    {r.oldName}
                  </td>
                  <td className="px-1 py-2 text-center">
                    {changed ? (
                      <ArrowRight className="mx-auto size-3.5 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <span className="text-xs text-muted-foreground">=</span>
                    )}
                  </td>
                  <td className="max-w-[28ch] truncate px-3 py-2" title={r.newName}>
                    <span className={bad ? 'font-medium text-destructive' : changed ? '' : 'text-muted-foreground'}>
                      {r.newName}
                      {!changed && ' (unchanged)'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------- SPLIT ---

type SplitBy = 'size' | 'count'

interface PartPlan {
  name: string
  size: number
  blob: Blob
}

function SplitTab() {
  const [file, setFile] = useState<File | null>(null)
  const [by, setBy] = useState<SplitBy>('size')
  const [sizeValue, setSizeValue] = useState('100')
  const [unit, setUnit] = useState<'KB' | 'MB'>('MB')
  const [countValue, setCountValue] = useState('4')
  const [hash, setHash] = useState<string | null>(null)
  const [hashing, setHashing] = useState(false)
  const [hashFrac, setHashFrac] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const pickFile = useCallback((files: File[]) => {
    const f = files[0]
    setError(null)
    setHash(null)
    setFile(null)
    if (!f) return
    if (f.size > TWO_GB) {
      setError(
        `“${f.name}” is ${fmtSize(f.size)} — over the 2 GB cap. Splitting runs in this browser tab, and files that big can exhaust a device's memory. Use a desktop tool for anything past the cap.`,
      )
      return
    }
    setFile(f)
    setHashing(true)
    setHashFrac(0)
    void (async () => {
      try {
        const hex = await sha256Blob(f, (frac) => setHashFrac(frac))
        setHash(hex)
      } catch {
        setError('Could not hash that file — the browser refused the read. Try a smaller one.')
        setFile(null)
      } finally {
        setHashing(false)
      }
    })()
  }, [])

  const reset = useCallback(() => {
    setFile(null)
    setHash(null)
    setError(null)
  }, [])

  const partSizeNominal = useMemo(() => {
    if (by === 'size') {
      const raw = Number(sizeValue)
      if (!Number.isFinite(raw) || raw <= 0) return 0
      return Math.floor(raw * (unit === 'MB' ? 1024 ** 2 : 1024))
    }
    const n = Number(countValue)
    if (!Number.isInteger(n) || n < 2 || !file) return 0
    return Math.floor(file.size / n)
  }, [by, sizeValue, unit, countValue, file])

  const planError = useMemo<string | null>(() => {
    if (!file) return null
    if (file.size === 0) return 'That file is empty — there is nothing to split.'
    if (by === 'size') {
      if (partSizeNominal < 1) return 'Enter a part size, like 100.'
      const parts = Math.ceil(file.size / partSizeNominal)
      if (parts > MAX_PARTS) {
        return `That would create ${parts.toLocaleString()} parts — this tool caps at ${MAX_PARTS}. Raise the part size.`
      }
      return null
    }
    const n = Number(countValue)
    if (!Number.isInteger(n) || n < 2) return 'Enter a whole number of parts, 2 or more.'
    if (n > file.size) return `More parts (${n.toLocaleString()}) than bytes in the file (${file.size.toLocaleString()}) — not possible.`
    if (n > MAX_PARTS) return `That would create ${n.toLocaleString()} parts — this tool caps at ${MAX_PARTS}.`
    return null
  }, [file, by, partSizeNominal, sizeValue, unit, countValue])

  const plan = useMemo<PartPlan[] | null>(() => {
    if (!file || planError) return null
    if (by === 'size') {
      const parts = Math.ceil(file.size / partSizeNominal)
      return Array.from({ length: parts }, (_, i) => {
        const start = i * partSizeNominal
        const size = Math.min(partSizeNominal, file.size - start)
        return { name: partName(file.name, i), size, blob: file.slice(start, start + size) }
      })
    }
    const n = Number(countValue)
    const base = Math.floor(file.size / n)
    const rem = file.size % n
    let start = 0
    return Array.from({ length: n }, (_, i) => {
      const size = base + (i < rem ? 1 : 0)
      const blob = file.slice(start, start + size)
      start += size
      return { name: partName(file.name, i), size, blob }
    })
  }, [file, by, planError, partSizeNominal, sizeValue, unit, countValue])

  const manifestJson = useMemo<string | null>(() => {
    if (!file || !hash || !plan) return null
    const manifest: SplitManifest = {
      tool: MANIFEST_TOOL,
      version: 1,
      originalName: file.name,
      originalSize: file.size,
      sha256: hash,
      parts: plan.length,
      partSize: partSizeNominal,
      partSizes: plan.map((p) => p.size),
      splitBy: by,
    }
    return JSON.stringify(manifest, null, 2)
  }, [file, hash, plan, partSizeNominal, by])

  const downloadManifest = useCallback(() => {
    if (!file || !manifestJson) return
    downloadBlob(
      new Blob([manifestJson], { type: 'application/json' }),
      `${file.name}.manifest.json`,
    )
  }, [file, manifestJson])

  return (
    <div>
      {!file ? (
        <>
          <DropZone
            onFiles={pickFile}
            multiple={false}
            title="Drop the file to split"
            hint="One file. Parts are cut as Blob slices — the bytes are read straight from disk into each download."
          />
          {error && <ErrorNote>{error}</ErrorNote>}
        </>
      ) : (
        <div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtSize(file.size)} · {plan ? `${plan.length.toLocaleString()} part${plan.length === 1 ? '' : 's'} planned` : '—'}
                  {plan && plan.length > 1 && ' · the last part carries the remainder'}
                </p>
                {hash && <HashLine hash={hash} />}
              </div>
              <Button size="sm" variant="ghost" onClick={reset}>
                <X className="size-3.5" aria-hidden="true" /> Start over
              </Button>
            </div>
            {hashing && (
              <ProgressLine
                value={hashFrac}
                status={`Hashing ${file.name} with SHA-256 for the manifest — ${Math.round(hashFrac * 100)}%`}
              />
            )}
          </div>

          <div className="mt-4 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="split-by" className="text-xs text-muted-foreground">Split</Label>
                <Select value={by} onValueChange={(v) => setBy(v as SplitBy)}>
                  <SelectTrigger id="split-by" className="mt-1.5 h-9 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="size">By part size</SelectItem>
                    <SelectItem value="count">Into N equal parts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {by === 'size' ? (
                <>
                  <div>
                    <Label htmlFor="split-size" className="text-xs text-muted-foreground">Part size</Label>
                    <Input
                      id="split-size"
                      type="number"
                      min="0"
                      step="any"
                      value={sizeValue}
                      onChange={(e) => setSizeValue(e.target.value)}
                      className="mt-1.5 h-9 w-32"
                      aria-describedby="split-size-unit"
                    />
                  </div>
                  <div>
                    <Label htmlFor="split-size-unit" className="sr-only">Unit</Label>
                    <Select value={unit} onValueChange={(v) => setUnit(v as 'KB' | 'MB')}>
                      <SelectTrigger id="split-size-unit" className="mt-1.5 h-9 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KB">KB</SelectItem>
                        <SelectItem value="MB">MB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div>
                  <Label htmlFor="split-count" className="text-xs text-muted-foreground">Number of parts</Label>
                  <Input
                    id="split-count"
                    type="number"
                    min="2"
                    step="1"
                    value={countValue}
                    onChange={(e) => setCountValue(e.target.value)}
                    className="mt-1.5 h-9 w-32"
                  />
                </div>
              )}
            </div>
            {planError && <ErrorNote>{planError}</ErrorNote>}
            {plan && plan.length === 1 && (
              <WarnNote>
                The whole file fits in one part with this size — the single “part” is the
                file itself. Pick a smaller part size to actually split it.
              </WarnNote>
            )}
          </div>

          {plan && plan.length > 1 && (
            <>
              <p className="mt-4 text-xs font-medium text-muted-foreground">Parts</p>
              <div className="fw-scroll mt-2 max-h-96 overflow-auto rounded-xl border">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="bg-card text-left">
                      <th className="w-12 px-3 py-2 text-xs font-medium text-muted-foreground">#</th>
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Name</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Size</th>
                      <th className="w-12 px-2 py-2"><span className="sr-only">Download part</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {plan.map((p, i) => (
                      <tr key={p.name} className="bg-card">
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{i + 1}</td>
                        <td className="max-w-[36ch] truncate px-3 py-2" title={p.name}>{p.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtSize(p.size)}</td>
                        <td className="px-2 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            aria-label={`Download ${p.name}`}
                            onClick={() => downloadBlob(p.blob, p.name)}
                          >
                            <Download className="size-3.5" aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={downloadManifest} disabled={!manifestJson}>
              <FileDown className="size-4" aria-hidden="true" /> Download manifest
            </Button>
            {plan && plan.length > 1 && (
              <DownloadAllButton
                files={plan.map((p) => ({ name: p.name, blob: p.blob }))}
                archiveName={`${file.name}.parts.zip`}
              />
            )}
          </div>
          {plan && plan.length > 1 && file.size > 512 * 1024 ** 2 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Packing this ZIP loads every part into the tab's memory — for a file this
              size, the per-part downloads above are the gentler route.
            </p>
          )}
          {!hash && !error && (
            <p className="mt-2 text-xs text-muted-foreground">
              The manifest (with the SHA-256 the merge will verify against) unlocks when
              hashing finishes below the file card.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------- MERGE ---

interface MergeResult {
  sizeOk: boolean | null
  hashOk: boolean | null
  restoredName: string
  restoredSize: number
  blob: Blob
}

function MergeTab() {
  const [manifest, setManifest] = useState<SplitManifest | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [parts, setParts] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [frac, setFrac] = useState(0)
  const [result, setResult] = useState<MergeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const partsRef = useRef<File[]>([])
  const manifestRef = useRef<SplitManifest | null>(null)

  const addFiles = useCallback((picked: File[]) => {
    setError(null)
    setResult(null)
    const nextNotes: string[] = []
    void (async () => {
      const additions: File[] = []
      for (const f of picked) {
        if (/\.manifest\.json$/i.test(f.name)) {
          try {
            const parsed = JSON.parse(await f.text()) as unknown
            const v = validateManifest(parsed)
            if (v.ok) {
              const prev = manifestRef.current
              if (prev && prev.sha256 !== v.manifest.sha256) {
                nextNotes.push('A second manifest was picked — the first one stays in charge.')
              } else {
                if (v.manifest.tool !== MANIFEST_TOOL) {
                  nextNotes.push(`“${f.name}” was not written by File Workshop — its fields are verified the same way anyway.`)
                }
                manifestRef.current = v.manifest
                setManifest(v.manifest)
              }
            } else {
              nextNotes.push(`“${f.name}” ignored: ${v.reason}.`)
            }
          } catch {
            nextNotes.push(`“${f.name}” could not be read as JSON — ignored.`)
          }
          continue
        }
        additions.push(f)
      }
      const seen = new Set(partsRef.current.map(fileKey))
      const fresh = additions.filter((f) => !seen.has(fileKey(f)))
      if (fresh.length) {
        const next = [...partsRef.current, ...fresh]
        partsRef.current = next
        setParts(next)
      }
      setNotes((prevNotes) => (nextNotes.length ? [...prevNotes, ...nextNotes] : prevNotes))
    })()
  }, [])

  const reset = useCallback(() => {
    setManifest(null)
    setNotes([])
    setParts([])
    setResult(null)
    setError(null)
    partsRef.current = []
    manifestRef.current = null
  }, [])

  const ordered = useMemo(() => {
    const sorted = [...parts].sort((a, b) => naturalCompare(a.name, b.name))
    const warnings: string[] = []
    let locked = false
    if (manifest && parts.length) {
      const re = new RegExp(`^${escapeRe(manifest.originalName)}\\.part(\\d+)$`, 'i')
      const allMatch = parts.every((f) => re.test(f.name))
      if (allMatch) {
        locked = true
        const numbered = [...parts]
          .map((f) => ({ f, n: Number(re.exec(f.name)![1]) }))
          .sort((a, b) => a.n - b.n)
        const list = numbered.map((x) => x.f)
        const missing: number[] = []
        const present = new Set(numbered.map((x) => x.n))
        for (let n = 1; n <= manifest.parts; n++) if (!present.has(n)) missing.push(n)
        if (missing.length) {
          warnings.push(
            `The manifest expects ${manifest.parts} parts; missing: ${missing.slice(0, 8).map((n) => `part ${n}`).join(', ')}${missing.length > 8 ? '…' : ''}.`,
          )
        }
        if (parts.length > manifest.parts) {
          warnings.push(`${parts.length - manifest.parts} extra file(s) beyond the manifest's ${manifest.parts} parts — they will be ignored by the hash check if they don't belong.`)
        }
        return { list, locked, warnings }
      }
      warnings.push(
        `The picked names do not match the manifest's pattern “${manifest.originalName}.part001 …” — order fell back to natural sort, and the SHA-256 check will settle it.`,
      )
    }
    const nums = sorted.map((f) => trailingNumber(f.name))
    const numbered = nums.filter((n): n is number => n !== null)
    if (numbered.length < sorted.length) {
      warnings.push('Some names carry no number — their position is a best guess from alphabetical order.')
    }
    if (new Set(numbered).size !== numbered.length) {
      warnings.push('Two files claim the same part number — check the order below.')
    }
    if (numbered.length === sorted.length && sorted.length > 0) {
      const min = Math.min(...numbered)
      const max = Math.max(...numbered)
      if (min !== 1) warnings.push(`The sequence starts at ${min} — earlier part(s) look missing.`)
      const missing: number[] = []
      for (let n = min; n <= max; n++) if (!numbered.includes(n)) missing.push(n)
      if (missing.length) {
        warnings.push(`Gap in the sequence: ${missing.slice(0, 8).map((n) => `part ${n}`).join(', ')}${missing.length > 8 ? '…' : ''} missing.`)
      }
    }
    return { list: sorted, locked, warnings }
  }, [parts, manifest])

  const totalSize = useMemo(
    () => ordered.list.reduce((s, f) => s + f.size, 0),
    [ordered.list],
  )

  const manifestCountMismatch = manifest !== null && ordered.list.length !== manifest.parts
  const overCap = totalSize > TWO_GB
  const canMerge =
    !busy && ordered.list.length >= 2 && !manifestCountMismatch && !overCap

  const disableReason = manifestCountMismatch
    ? `The manifest expects ${manifest!.parts} parts — ${ordered.list.length} picked so far.`
    : overCap
      ? `The parts add up to ${fmtSize(totalSize)} — over the 2 GB cap for this tab.`
      : ordered.list.length < 2
        ? 'Pick at least two parts to rejoin.'
        : null

  const runMerge = useCallback(async () => {
    const list = ordered.list
    if (list.length < 2) return
    setError(null)
    setResult(null)
    setBusy(true)
    setFrac(0)
    try {
      const total = list.reduce((s, f) => s + f.size, 0)
      const restoredName = manifest ? manifest.originalName : stripPartSuffix(list[0].name)
      const sizeOk = manifest ? total === manifest.originalSize : null
      setStatus(`Reading ${list.length} parts and hashing the restored file…`)
      const rejoin = new Blob(list)
      const hex = await sha256Blob(rejoin, (f) => setFrac(f))
      const hashOk = manifest ? hex.toLowerCase() === manifest.sha256.toLowerCase() : null
      setResult({ sizeOk, hashOk, restoredName, restoredSize: total, blob: rejoin })
      if (hashOk !== false && sizeOk !== false) {
        downloadBlob(rejoin, restoredName)
      }
    } catch {
      setError('Could not read the parts — the browser refused a read. Try fewer or smaller parts.')
    } finally {
      setBusy(false)
    }
  }, [ordered.list, manifest])

  return (
    <div>
      <DropZone
        onFiles={addFiles}
        title="Drop the manifest and every part"
        hint="The .manifest.json locks the order and enables verification; parts alone are sorted by their trailing number. Picks accumulate — add more any time."
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {notes.map((n, i) => (
        <WarnNote key={i}>{n}</WarnNote>
      ))}

      {(manifest || parts.length > 0) && (
        <div className="mt-4 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {manifest ? (
                <>
                  <p className="truncate text-sm font-medium">
                    Manifest: {manifest.originalName} · {fmtSize(manifest.originalSize)} · {manifest.parts} parts
                  </p>
                  <HashLine hash={manifest.sha256} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No manifest — the restored name comes from the part names and integrity
                  cannot be verified.
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {parts.length} part{parts.length === 1 ? '' : 's'} picked · {fmtSize(totalSize)} total ·{' '}
                {ordered.locked ? 'order locked by manifest' : 'order from file names'}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={reset}>
              <X className="size-3.5" aria-hidden="true" /> Start over
            </Button>
          </div>

          {ordered.warnings.map((w, i) => (
            <WarnNote key={i}>{w}</WarnNote>
          ))}

          {ordered.list.length > 0 && (
            <div className="fw-scroll mt-3 max-h-96 overflow-auto rounded-xl border">
              <table className="w-full min-w-[440px] text-sm">
                <thead>
                  <tr className="bg-card text-left">
                    <th className="w-12 px-3 py-2 text-xs font-medium text-muted-foreground">#</th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Part</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ordered.list.map((f, i) => (
                    <tr key={fileKey(f)} className="bg-card">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{i + 1}</td>
                      <td className="max-w-[36ch] truncate px-3 py-2" title={f.name}>{f.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtSize(f.size)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => void runMerge()} disabled={!canMerge}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              {busy ? 'Verifying…' : 'Rejoin and download'}
            </Button>
            {!busy && disableReason && (
              <p className="text-xs text-muted-foreground">{disableReason}</p>
            )}
          </div>

          {busy && (
            <ProgressLine
              value={frac}
              status={`Streaming SHA-256 over the restored bytes — ${Math.round(frac * 100)}%`}
            />
          )}

          {result && (
            <div className="mt-4 space-y-2" role="status">
              {result.sizeOk !== null && (
                <p className={`flex items-start gap-2 text-sm ${result.sizeOk ? 'text-primary' : 'text-destructive'}`}>
                  {result.sizeOk ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  )}
                  {result.sizeOk
                    ? `Size matches the manifest (${fmtSize(result.restoredSize)}).`
                    : `Size differs: the manifest says ${fmtSize(manifest!.originalSize)}, the parts add up to ${fmtSize(result.restoredSize)}.`}
                </p>
              )}
              {result.hashOk !== null && (
                <p className={`flex items-start gap-2 text-sm font-medium ${result.hashOk ? 'text-primary' : 'text-destructive'}`}>
                  {result.hashOk ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  )}
                  {result.hashOk
                    ? 'SHA-256 matches the manifest — restored byte for byte.'
                    : 'SHA-256 does NOT match the manifest. A part is corrupt, truncated or out of order — do not trust this restore.'}
                </p>
              )}
              {result.hashOk === null && result.sizeOk === null && (
                <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  No manifest — joined in name order and downloaded as “{result.restoredName}”
                  ({fmtSize(result.restoredSize)}). Integrity could not be verified.
                </p>
              )}
              {result.hashOk === false && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadBlob(result.blob, result.restoredName)}
                >
                  <Download className="size-4" aria-hidden="true" />
                  Download anyway (unverified)
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ RENAME ---

type CaseMode = 'keep' | 'lower' | 'upper'

function RenameTab() {
  const [files, setFiles] = useState<File[]>([])
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [numbering, setNumbering] = useState(false)
  const [startNum, setStartNum] = useState('1')
  const [padWidth, setPadWidth] = useState('3')
  const [caseMode, setCaseMode] = useState<CaseMode>('keep')
  const filesRef = useRef<File[]>([])

  const addFiles = useCallback((picked: File[]) => {
    const seen = new Set(filesRef.current.map(fileKey))
    const fresh = picked.filter((f) => !seen.has(fileKey(f)))
    if (!fresh.length) return
    filesRef.current = [...filesRef.current, ...fresh]
    setFiles(filesRef.current)
  }, [])

  const reset = useCallback(() => {
    filesRef.current = []
    setFiles([])
  }, [])

  const sorted = useMemo(() => [...files].sort((a, b) => naturalCompare(a.name, b.name)), [files])

  const rows = useMemo(() => {
    const start = Number.isInteger(Number(startNum)) && Number(startNum) >= 0 ? Number(startNum) : 1
    const width = Math.min(4, Math.max(1, Math.round(Number(padWidth)) || 3))
    return sorted.map((f, i) => {
      const { base, ext } = splitExt(f.name)
      let b = find ? base.split(find).join(replace) : base
      if (caseMode === 'lower') b = b.toLowerCase()
      else if (caseMode === 'upper') b = b.toUpperCase()
      b = prefix + b + suffix
      if (numbering) b += `_${String(start + i).padStart(width, '0')}`
      return { oldName: f.name, newName: b + (ext ? `.${ext}` : '') }
    })
  }, [sorted, find, replace, prefix, suffix, numbering, startNum, padWidth, caseMode])

  const conflicts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.newName, (counts.get(r.newName) ?? 0) + 1)
    return [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n)
  }, [rows])

  const changedCount = useMemo(
    () => rows.filter((r) => r.newName !== r.oldName).length,
    [rows],
  )

  return (
    <div>
      <DropZone
        onFiles={addFiles}
        title="Drop the files to rename"
        hint="Picks accumulate. Rules apply to the file name; extensions are kept as-is — the Extension tab handles those."
      />
      {files.length > 0 && (
        <>
          <PickedBar
            label={`${files.length} file${files.length === 1 ? '' : 's'} picked${numbering ? ' · numbered in name order' : ''}`}
            onClear={reset}
          />

          <div className="mt-4 rounded-xl border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="rename-find" className="text-xs text-muted-foreground">Find (plain text)</Label>
                <Input id="rename-find" value={find} onChange={(e) => setFind(e.target.value)} placeholder="e.g. IMG" className="mt-1.5 h-9" />
              </div>
              <div>
                <Label htmlFor="rename-replace" className="text-xs text-muted-foreground">Replace with</Label>
                <Input id="rename-replace" value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="e.g. PHOTO" className="mt-1.5 h-9" />
              </div>
              <div>
                <Label htmlFor="rename-prefix" className="text-xs text-muted-foreground">Prefix</Label>
                <Input id="rename-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="added in front" className="mt-1.5 h-9" />
              </div>
              <div>
                <Label htmlFor="rename-suffix" className="text-xs text-muted-foreground">Suffix</Label>
                <Input id="rename-suffix" value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="added before the extension" className="mt-1.5 h-9" />
              </div>
              <div>
                <Label htmlFor="rename-case" className="text-xs text-muted-foreground">Letter case (name only)</Label>
                <Select value={caseMode} onValueChange={(v) => setCaseMode(v as CaseMode)}>
                  <SelectTrigger id="rename-case" className="mt-1.5 h-9 w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Keep as-is</SelectItem>
                    <SelectItem value="lower">lowercase</SelectItem>
                    <SelectItem value="upper">UPPERCASE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="rename-numbering" className="text-xs text-muted-foreground">Add numbering (_001)</Label>
                  <Switch id="rename-numbering" checked={numbering} onCheckedChange={setNumbering} />
                </div>
                {numbering && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      aria-label="Start number"
                      type="number"
                      min="0"
                      step="1"
                      value={startNum}
                      onChange={(e) => setStartNum(e.target.value)}
                      className="h-8 w-20"
                    />
                    <Select value={padWidth} onValueChange={(v) => setPadWidth(v)}>
                      <SelectTrigger aria-label="Number padding width" className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 digit (7)</SelectItem>
                        <SelectItem value="2">2 digits (07)</SelectItem>
                        <SelectItem value="3">3 digits (007)</SelectItem>
                        <SelectItem value="4">4 digits (0007)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
            {changedCount} of {rows.length} file{rows.length === 1 ? '' : 's'} would change
            {conflicts.length > 0 && ` · ${conflicts.length} name${conflicts.length === 1 ? '' : 's'} collide`}
          </p>

          <RenamePreview rows={rows} />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {conflicts.length === 0 ? (
              <DownloadAllButton
                files={rows.map((r, i) => ({ name: r.newName, blob: sorted[i] }))}
                archiveName="renamed-files.zip"
              />
            ) : (
              <Button size="sm" disabled>
                <Download className="size-4" aria-hidden="true" />
                Download all as ZIP
              </Button>
            )}
          </div>
          <CopiesNote>
            Applying means downloading copies with the new names{conflicts.length > 0 && ' — fix the rose collisions first, the ZIP button stays off while two files want the same name'}. A
            browser page cannot rename files on disk in place, so the originals stay untouched.
          </CopiesNote>
        </>
      )}
    </div>
  )
}

// --------------------------------------------------------------- EXTENSION ---

type ExtCase = 'lower' | 'upper'

function ExtensionTab() {
  const [files, setFiles] = useState<File[]>([])
  const [ext, setExt] = useState('webp')
  const [caseMode, setCaseMode] = useState<ExtCase>('lower')
  const [append, setAppend] = useState(false)
  const filesRef = useRef<File[]>([])

  const addFiles = useCallback((picked: File[]) => {
    const seen = new Set(filesRef.current.map(fileKey))
    const fresh = picked.filter((f) => !seen.has(fileKey(f)))
    if (!fresh.length) return
    filesRef.current = [...filesRef.current, ...fresh]
    setFiles(filesRef.current)
  }, [])

  const reset = useCallback(() => {
    filesRef.current = []
    setFiles([])
  }, [])

  const newExt = useMemo(() => {
    const clean = ext.trim().replace(/^\.+/, '')
    if (!clean) return ''
    return caseMode === 'upper' ? clean.toUpperCase() : clean.toLowerCase()
  }, [ext, caseMode])

  const sorted = useMemo(() => [...files].sort((a, b) => naturalCompare(a.name, b.name)), [files])

  const rows = useMemo(() => {
    if (!newExt) return sorted.map((f) => ({ oldName: f.name, newName: f.name }))
    return sorted.map((f) => {
      const newName = append
        ? `${f.name}.${newExt}`
        : `${splitExt(f.name).base}.${newExt}`
      return { oldName: f.name, newName }
    })
  }, [sorted, newExt, append])

  const conflicts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.newName, (counts.get(r.newName) ?? 0) + 1)
    return [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n)
  }, [rows])

  const changedCount = useMemo(
    () => rows.filter((r) => r.newName !== r.oldName).length,
    [rows],
  )

  return (
    <div>
      <DropZone
        onFiles={addFiles}
        title="Drop the files to re-extend"
        hint="Set, replace or append one extension for every picked file. Copies download; originals are never touched."
      />
      {files.length > 0 && (
        <>
          <PickedBar label={`${files.length} file${files.length === 1 ? '' : 's'} picked`} onClear={reset} />

          <div className="mt-4 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="ext-value" className="text-xs text-muted-foreground">Extension</Label>
                <Input
                  id="ext-value"
                  value={ext}
                  onChange={(e) => setExt(e.target.value)}
                  placeholder="webp"
                  className="mt-1.5 h-9 w-32 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="ext-case" className="text-xs text-muted-foreground">Case</Label>
                <Select value={caseMode} onValueChange={(v) => setCaseMode(v as ExtCase)}>
                  <SelectTrigger id="ext-case" className="mt-1.5 h-9 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lower">lowercase</SelectItem>
                    <SelectItem value="upper">UPPERCASE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-1.5">
                <Switch id="ext-append" checked={append} onCheckedChange={setAppend} />
                <Label htmlFor="ext-append" className="text-xs text-muted-foreground">
                  Append instead of replace ({append ? 'photo.jpg → photo.jpg.' : 'photo.jpg → photo.'}
                  {newExt || 'ext'})
                </Label>
              </div>
            </div>
            {!newExt && <ErrorNote>Type an extension to apply, like webp — dots at the front are fine.</ErrorNote>}
          </div>

          <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
            {changedCount} of {rows.length} file{rows.length === 1 ? '' : 's'} would change
            {conflicts.length > 0 && ` · ${conflicts.length} name${conflicts.length === 1 ? '' : 's'} collide`}
          </p>

          <RenamePreview rows={rows} />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {conflicts.length === 0 && newExt ? (
              <DownloadAllButton
                files={rows.map((r, i) => ({ name: r.newName, blob: sorted[i] }))}
                archiveName="re-extended-files.zip"
              />
            ) : (
              <Button size="sm" disabled>
                <Download className="size-4" aria-hidden="true" />
                Download all as ZIP
              </Button>
            )}
          </div>
          <CopiesNote>
            A browser cannot modify files on disk in place — applying downloads renamed
            copies, and the originals keep their current names and bytes.
          </CopiesNote>
        </>
      )}
    </div>
  )
}

// -------------------------------------------------------------- DUPLICATES ---

interface DupGroup {
  files: File[]
  keeper: File
  /** true when the verdict rests on the 64 KB fingerprint (file over 256 MB). */
  partial: boolean
}

function pickKeeper(files: File[]): File {
  return [...files].sort(
    (a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name),
  )[0]
}

function keeperListText(groups: DupGroup[], checked: Set<string>): string {
  const wasted = groups.reduce(
    (s, g) => s + g.files.filter((f) => f !== g.keeper).reduce((x, f) => x + f.size, 0),
    0,
  )
  const lines: string[] = [
    'Kontivo File Workshop — duplicate keeper list',
    `Generated ${new Date().toISOString()}`,
    `${groups.length} duplicate group${groups.length === 1 ? '' : 's'} · ${fmtSize(wasted)} in extra copies`,
    '',
    'A browser page cannot delete files on disk. Keep the KEEP file in each',
    'group and remove the COPY files yourself. [marked] = ticked in the tool.',
    '',
  ]
  groups.forEach((g, i) => {
    const each = g.files[0].size
    lines.push(
      `Group ${i + 1} — ${g.files.length} copies of ${fmtSize(each)} each${g.partial ? ' · partial-hash verdict (file over 256 MB)' : ''}`,
    )
    for (const f of g.files) {
      const isKeeper = f === g.keeper
      const mark = !isKeeper && checked.has(fileKey(f)) ? ' [marked]' : ''
      const modified = new Date(f.lastModified).toISOString().slice(0, 10)
      lines.push(
        `  ${isKeeper ? 'KEEP' : 'COPY'}  ${f.name}  ${fmtSize(f.size)}  modified ${modified}${mark}`,
      )
    }
    lines.push('')
  })
  return lines.join('\n')
}

function DuplicatesTab() {
  const [files, setFiles] = useState<File[]>([])
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState('')
  const [frac, setFrac] = useState(0)
  const [groups, setGroups] = useState<DupGroup[]>([])
  const [ruledOut, setRuledOut] = useState(0)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const filesRef = useRef<File[]>([])
  const scanIdRef = useRef(0)

  const reset = useCallback(() => {
    scanIdRef.current += 1
    filesRef.current = []
    setFiles([])
    setGroups([])
    setChecked(new Set())
    setRuledOut(0)
    setStatus('')
    setFrac(0)
    setScanning(false)
    setError(null)
  }, [])

  const runScan = useCallback(async (list: File[]) => {
    const id = ++scanIdRef.current
    const alive = () => scanIdRef.current === id
    setScanning(true)
    setGroups([])
    setChecked(new Set())
    setRuledOut(0)
    setError(null)
    try {
      // 1 — group by exact size; different sizes can never be identical.
      setStatus('Step 1 of 2 — grouping by exact size…')
      const bySize = new Map<number, File[]>()
      for (const f of list) {
        const arr = bySize.get(f.size)
        if (arr) arr.push(f)
        else bySize.set(f.size, [f])
      }
      const shared = [...bySize.values()].filter((arr) => arr.length > 1)
      const totalPartial = shared.reduce((s, arr) => s + arr.length, 0)

      // 2 — fingerprint same-size files: first 64 KB + last 64 KB.
      const candidates: File[][] = []
      let done = 0
      for (const arr of shared) {
        const keyed = new Map<string, File[]>()
        for (const f of arr) {
          if (!alive()) return
          setStatus(`Step 1 of 2 — fingerprinting ${done + 1} of ${totalPartial}: ${f.name}`)
          const h = await partialHashBlob(f)
          keyed.set(h, [...(keyed.get(h) ?? []), f])
          done += 1
          setFrac(totalPartial ? done / totalPartial : 1)
        }
        for (const group of keyed.values()) if (group.length > 1) candidates.push(group)
      }
      const fullJobs = candidates.filter((g) => g.every((f) => f.size <= FULL_HASH_LIMIT))
      const totalFull = fullJobs.reduce((s, g) => s + g.length, 0)

      // 3 — full SHA-256 only for surviving candidates under the limit.
      const result: DupGroup[] = []
      let ruled = 0
      let fullDone = 0
      for (const cand of candidates) {
        if (!alive()) return
        if (!cand.every((f) => f.size <= FULL_HASH_LIMIT)) {
          result.push({ files: cand, keeper: pickKeeper(cand), partial: true })
          continue
        }
        const fulls = new Map<string, File[]>()
        for (const f of cand) {
          if (!alive()) return
          setStatus(`Step 2 of 2 — hashing ${fullDone + 1} of ${totalFull}: ${f.name}`)
          const h = await sha256Blob(f)
          fulls.set(h, [...(fulls.get(h) ?? []), f])
          fullDone += 1
          setFrac(totalFull ? fullDone / totalFull : 1)
        }
        for (const group of fulls.values()) {
          if (group.length > 1) result.push({ files: group, keeper: pickKeeper(group), partial: false })
          else ruled += 1
        }
      }
      if (!alive()) return
      result.sort((a, b) => {
        const wa = a.files.filter((f) => f !== a.keeper).reduce((s, f) => s + f.size, 0)
        const wb = b.files.filter((f) => f !== b.keeper).reduce((s, f) => s + f.size, 0)
        return wb - wa
      })
      setGroups(result)
      setRuledOut(ruled)
      setChecked(new Set(result.flatMap((g) => g.files.filter((f) => f !== g.keeper).map(fileKey))))
      setStatus('')
    } catch {
      if (alive()) setError('Could not read one of the files while hashing — try the batch again without it.')
    } finally {
      if (alive()) {
        setScanning(false)
        setFrac(0)
      }
    }
  }, [])

  const addFiles = useCallback(
    (picked: File[]) => {
      const seen = new Set(filesRef.current.map(fileKey))
      const fresh = picked.filter((f) => !seen.has(fileKey(f)))
      if (!fresh.length) return
      const next = [...filesRef.current, ...fresh]
      filesRef.current = next
      setFiles(next)
      void runScan(next)
    },
    [runScan],
  )

  const toggle = useCallback((key: string, on: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const wastedTotal = useMemo(
    () =>
      groups.reduce(
        (s, g) => s + g.files.filter((f) => f !== g.keeper).reduce((x, f) => x + f.size, 0),
        0,
      ),
    [groups],
  )
  const dupCount = useMemo(
    () => groups.reduce((s, g) => s + g.files.length - 1, 0),
    [groups],
  )
  const checkedBytes = useMemo(() => {
    let sum = 0
    for (const g of groups) {
      for (const f of g.files) {
        if (f !== g.keeper && checked.has(fileKey(f))) sum += f.size
      }
    }
    return sum
  }, [groups, checked])
  const partialGroups = useMemo(() => groups.filter((g) => g.partial).length, [groups])

  const downloadList = useCallback(() => {
    const txt = keeperListText(groups, checked)
    downloadBlob(new Blob([txt], { type: 'text/plain' }), 'duplicate-keeper-list.txt')
  }, [groups, checked])

  return (
    <div>
      <DropZone
        onFiles={addFiles}
        directory
        title="Drop files or a whole folder to compare"
        hint="Comparison runs on this device: exact size, then a first+last 64 KB fingerprint, then a full SHA-256 only when it matters."
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {files.length === 1 && !scanning && (
        <WarnNote>
          One file picked — a single file has nothing to compare against. Pick at least two.
        </WarnNote>
      )}
      {files.length > 0 && (
        <PickedBar
          label={`${files.length} file${files.length === 1 ? '' : 's'} picked${scanning ? ' · scanning…' : groups.length ? ` · ${groups.length} duplicate group${groups.length === 1 ? '' : 's'}` : ' · no duplicates found'}`}
          onClear={reset}
        />
      )}

      {scanning && <ProgressLine value={frac} status={status || 'Scanning…'} />}
      {!scanning && status && <p className="mt-3 text-xs text-muted-foreground">{status}</p>}

      {groups.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium" aria-live="polite">
              {groups.length} duplicate group{groups.length === 1 ? '' : 's'} · {dupCount} extra
              cop{dupCount === 1 ? 'y' : 'ies'} · {fmtSize(wastedTotal)} wasted
            </p>
            <Button size="sm" variant="outline" onClick={downloadList}>
              <FileDown className="size-4" aria-hidden="true" /> Download keeper list (.txt)
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {checked.size} of {dupCount} extra copies marked · {fmtSize(checkedBytes)} would be freed
            {ruledOut > 0 && ` · ${ruledOut} same-size lookalike${ruledOut === 1 ? '' : 's'} ruled out by full hash`}
            {partialGroups > 0 && ` · ${partialGroups} group${partialGroups === 1 ? '' : 's'} judged on the fingerprint only (file over ${fmtSize(FULL_HASH_LIMIT)})`}
          </p>

          <div className="mt-4 space-y-4">
            {groups.map((g, gi) => (
              <div key={gi} className="rounded-xl border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                  <p className="text-sm font-medium">
                    Group {gi + 1} · {g.files.length} identical copies
                  </p>
                  {g.partial && (
                    <span className="rounded-full border border-amber-600/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                      likely duplicate — partial hash
                    </span>
                  )}
                </div>
                <ul className="divide-y">
                  {g.files.map((f) => {
                    const keeper = f === g.keeper
                    const key = fileKey(f)
                    return (
                      <li key={key} className="flex items-center gap-3 px-4 py-2.5">
                        {!keeper && (
                          <Checkbox
                            checked={checked.has(key)}
                            onCheckedChange={(v) => toggle(key, v === true)}
                            aria-label={`Mark ${f.name} for removal`}
                            className="shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm ${keeper ? 'font-medium' : ''}`} title={f.name}>
                            {f.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fmtSize(f.size)} · modified {new Date(f.lastModified).toLocaleDateString()}
                          </p>
                        </div>
                        {keeper && (
                          <span className="shrink-0 text-xs font-medium text-primary">Keeper — oldest copy</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          <CopiesNote>
            The browser cannot delete files on disk — no page can. The keeper list is the
            hand-off: it names the keeper and every copy (with your marks), so the cleanup
            is a manual checklist instead of a guess.
          </CopiesNote>
        </div>
      )}

      {!scanning && files.length > 1 && groups.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          No duplicates found — every file is unique by size or content hash.
        </p>
      )}
    </div>
  )
}

// --------------------------------------------------------------------- root --

const MODES = [
  ['split', 'Split'],
  ['merge', 'Merge'],
  ['rename', 'Rename'],
  ['extension', 'Extension'],
  ['duplicates', 'Duplicates'],
] as const

export function FileToolsTool() {
  return (
    <div>
      <Tabs defaultValue="split">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-fit">
          {MODES.map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="h-10 px-3 sm:px-4">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="split" forceMount className="mt-4 data-[state=inactive]:hidden">
          <SplitTab />
        </TabsContent>
        <TabsContent value="merge" forceMount className="mt-4 data-[state=inactive]:hidden">
          <MergeTab />
        </TabsContent>
        <TabsContent value="rename" forceMount className="mt-4 data-[state=inactive]:hidden">
          <RenameTab />
        </TabsContent>
        <TabsContent value="extension" forceMount className="mt-4 data-[state=inactive]:hidden">
          <ExtensionTab />
        </TabsContent>
        <TabsContent value="duplicates" forceMount className="mt-4 data-[state=inactive]:hidden">
          <DuplicatesTab />
        </TabsContent>
      </Tabs>

      <PrivacyStrip detail="Everything on this page runs on this device: files are read with the browser's File API, split, hashed, renamed and compared inside this tab, and handed back as downloads. There is no upload code at all — the network tab will show nothing but the page itself." />

      <style jsx>{`
        .fw-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--muted-foreground) transparent;
        }
        .fw-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .fw-scroll::-webkit-scrollbar-thumb {
          background: var(--muted-foreground);
          opacity: 0.4;
          border-radius: 8px;
        }
        .fw-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  )
}
