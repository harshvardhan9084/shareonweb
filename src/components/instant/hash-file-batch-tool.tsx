'use client'

// Batch Checksums — the many-files companion to Hash & Verify. Queue a pile
// of files or a whole folder, hash each one sequentially, export the manifest
// in the GNU two-space format (sha256sum -c reads it directly) and verify a
// pasted checksum list against the results — a visual sha256sum -c, local
// only. SHA-1/SHA-256 come from WebCrypto for files up to 64 MB and from
// incremental chunk-streamed implementations above that; MD5 is a hand-written
// incremental port of the compact implementation used by Hash & Verify, since
// Web Crypto deliberately omits it. A self-test button hashes "abc" and
// checks the published vectors so the local implementations prove themselves
// on the device they run on.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Loader2,
  Play,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  DropZone,
  PrivacyStrip,
  downloadBlob,
} from '@/components/instant/instant-kit'

// ------------------------------------------------------------------ limits ---

const TWO_GB = 2 * 1024 ** 3
/** Soft cap: past this the queue warns but still runs. */
const QUEUE_SOFT_CAP = 8 * 1024 ** 3
/** Files up to this size are hashed whole through WebCrypto; bigger stream. */
const WEB_CRYPTO_LIMIT = 64 * 1024 ** 2
/** Streaming slice size — 8 MB, with a UI yield between slices. */
const HASH_CHUNK = 8 * 1024 ** 2

type Algo = 'md5' | 'sha1' | 'sha256'
type DigestSet = Partial<Record<Algo, string>>

const ALGO_ORDER: Algo[] = ['md5', 'sha1', 'sha256']
const ALGO_LABEL: Record<Algo, string> = { md5: 'MD5', sha1: 'SHA-1', sha256: 'SHA-256' }

interface QueueItem {
  id: number
  file: File
  name: string
  /** Folder-relative path (webkitRelativePath) when present, else the name. */
  path: string
  size: number
  status: 'pending' | 'running' | 'done' | 'failed'
  /** 0..1 fraction for the running row. */
  progress: number
  elapsedMs?: number
  error?: string
  digests?: DigestSet
}

interface RunNote {
  tone: 'ok' | 'warn' | 'info'
  text: string
}

interface TestRow {
  label: string
  expected: string
  actual: string
  pass: boolean
}

interface ParsedEntry {
  algo: Algo
  name: string
  hash: string
}

interface VerifyRow extends ParsedEntry {
  verdict: 'ok' | 'mismatch' | 'notfound'
  detail: string
}

interface VerifyResult {
  rows: VerifyRow[]
  ok: number
  mismatch: number
  notFound: number
  malformed: number
  skipped512: number
  unreferenced: number
}

// --------------------------------------------------------------- formatting --

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / (1024 * 1024)).toFixed(2)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  const m = Math.floor(s / 60)
  return `${m} m ${String(Math.round(s % 60)).padStart(2, '0')} s`
}

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

function toHex(digest: ArrayBuffer): string {
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// ------------------------------------------------------- incremental MD5 -----
// Incremental port of the compact MD5 used by Hash & Verify: the same round
// function, but state carries across 64-byte blocks so it can digest a stream
// of chunks instead of one padded buffer.

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const MD5_K = (() => {
  const k = new Int32Array(64)
  for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32)
  return k
})()

class StreamingMd5 {
  private a0 = 0x67452301
  private b0 = 0xefcdab89
  private c0 = 0x98badcfe
  private d0 = 0x10325476
  private m = new Int32Array(16)
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
        this.block(this.buf)
        this.bufLen = 0
      }
    }
    while (offset + 64 <= data.length) {
      this.block(data.subarray(offset, offset + 64))
      offset += 64
    }
    if (offset < data.length) {
      this.buf.set(data.subarray(offset))
      this.bufLen = data.length - offset
    }
  }

  private block(blockBytes: Uint8Array): void {
    const dv = new DataView(blockBytes.buffer, blockBytes.byteOffset, 64)
    const m = this.m
    for (let i = 0; i < 16; i++) m[i] = dv.getInt32(i * 4, true)
    let a = this.a0
    let b = this.b0
    let c = this.c0
    let d = this.d0
    for (let i = 0; i < 64; i++) {
      let f: number
      let g: number
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }
      f = (f + a + MD5_K[i] + m[g]) | 0
      a = d
      d = c
      c = b
      b = (b + ((f << MD5_S[i]) | (f >>> (32 - MD5_S[i])))) | 0
    }
    this.a0 = (this.a0 + a) | 0
    this.b0 = (this.b0 + b) | 0
    this.c0 = (this.c0 + c) | 0
    this.d0 = (this.d0 + d) | 0
  }

  digestHex(): string {
    const bits = this.bytes * 8
    const lo = bits % 2 ** 32
    const hi = Math.floor(bits / 2 ** 32)
    // Padding is fed through update() so block boundaries stay handled in
    // exactly one place: 0x80, zeros to 56 mod 64, then the little-endian
    // 64-bit bit length.
    const padded = Math.ceil((this.bytes + 9) / 64) * 64
    const pad = new Uint8Array(padded - this.bytes)
    pad[0] = 0x80
    const dv = new DataView(pad.buffer)
    dv.setUint32(pad.length - 8, lo >>> 0, true)
    dv.setUint32(pad.length - 4, hi >>> 0, true)
    this.update(pad)
    const out = new DataView(new ArrayBuffer(16))
    out.setInt32(0, this.a0, true)
    out.setInt32(4, this.b0, true)
    out.setInt32(8, this.c0, true)
    out.setInt32(12, this.d0, true)
    return [...new Uint8Array(out.buffer)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
}

// ------------------------------------------------- incremental SHA-1/SHA-256 --
// WebCrypto's digest is one-shot only, so files above 64 MB stream 8 MB slices
// through these incremental FIPS 180-4 implementations instead. They agree
// byte for byte with WebCrypto — the self-test button proves it on-device.

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

/** Load 64 bytes as big-endian words into a scratch array. */
function loadBigEndianWords(block: Uint8Array, w: Uint32Array, count: number): void {
  for (let i = 0; i < count; i++) {
    const j = i * 4
    w[i] = (block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3]
  }
}

/** Append 0x80 + zeros + the big-endian 64-bit bit length, then one last block. */
function finalizeBlock(buf: Uint8Array, bufLen: number, bits: number, compress: (b: Uint8Array) => void): void {
  const hi = Math.floor(bits / 2 ** 32)
  const lo = bits % 2 ** 32
  let len = bufLen
  buf[len++] = 0x80
  if (len > 56) {
    while (len < 64) buf[len++] = 0
    compress(buf)
    len = 0
  }
  while (len < 56) buf[len++] = 0
  buf[56] = (hi >>> 24) & 0xff
  buf[57] = (hi >>> 16) & 0xff
  buf[58] = (hi >>> 8) & 0xff
  buf[59] = hi & 0xff
  buf[60] = (lo >>> 24) & 0xff
  buf[61] = (lo >>> 16) & 0xff
  buf[62] = (lo >>> 8) & 0xff
  buf[63] = lo & 0xff
  compress(buf)
}

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
    loadBigEndianWords(block, w, 16)
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15]
      const y = w[i - 2]
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)
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
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K256[i] + w[i]) | 0
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
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
    finalizeBlock(this.buf, this.bufLen, this.bytes * 8, (b) => this.compress(b))
    let hex = ''
    for (let i = 0; i < 8; i++) {
      hex += (this.h[i] >>> 0).toString(16).padStart(8, '0')
    }
    return hex
  }
}

class StreamingSha1 {
  private h = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0])
  private w = new Uint32Array(80)
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
    loadBigEndianWords(block, w, 16)
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]
      w[i] = (x << 1) | (x >>> 31)
    }
    let a = this.h[0]
    let b = this.h[1]
    let c = this.h[2]
    let d = this.h[3]
    let e = this.h[4]
    for (let t = 0; t < 80; t++) {
      let f: number
      let k: number
      if (t < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (t < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[t]) | 0
      e = d
      d = c
      c = (b << 30) | (b >>> 2)
      b = a
      a = temp
    }
    this.h[0] = (this.h[0] + a) | 0
    this.h[1] = (this.h[1] + b) | 0
    this.h[2] = (this.h[2] + c) | 0
    this.h[3] = (this.h[3] + d) | 0
    this.h[4] = (this.h[4] + e) | 0
  }

  digestHex(): string {
    finalizeBlock(this.buf, this.bufLen, this.bytes * 8, (b) => this.compress(b))
    let hex = ''
    for (let i = 0; i < 5; i++) {
      hex += (this.h[i] >>> 0).toString(16).padStart(8, '0')
    }
    return hex
  }
}

// ------------------------------------------------------------- file hashing --

class CancelledError extends Error {
  constructor() {
    super('cancelled')
  }
}

/**
 * Hash one file for the selected algorithms. Up to 64 MB the bytes go through
 * WebCrypto in one call; larger files stream 8 MB slices through the
 * incremental implementations, yielding to the event loop between slices so
 * the page stays alive. Both paths produce the same digests.
 */
async function hashFile(
  file: File,
  algos: Algo[],
  onBytes: (bytes: number) => void,
  isCancelled: () => boolean,
): Promise<DigestSet> {
  const out: DigestSet = {}
  if (file.size <= WEB_CRYPTO_LIMIT) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (isCancelled()) throw new CancelledError()
    if (algos.includes('sha1')) {
      out.sha1 = toHex(await crypto.subtle.digest('SHA-1', bytes as unknown as ArrayBuffer))
    }
    if (algos.includes('sha256')) {
      out.sha256 = toHex(await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer))
    }
    if (algos.includes('md5')) {
      const md5 = new StreamingMd5()
      md5.update(bytes)
      out.md5 = md5.digestHex()
    }
    onBytes(file.size)
    return out
  }
  const sha1 = algos.includes('sha1') ? new StreamingSha1() : null
  const sha256 = algos.includes('sha256') ? new StreamingSha256() : null
  const md5 = algos.includes('md5') ? new StreamingMd5() : null
  let offset = 0
  while (offset < file.size) {
    if (isCancelled()) throw new CancelledError()
    const end = Math.min(offset + HASH_CHUNK, file.size)
    const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer())
    sha1?.update(chunk)
    sha256?.update(chunk)
    md5?.update(chunk)
    offset = end
    onBytes(offset)
    await yieldToUi()
  }
  if (sha1) out.sha1 = sha1.digestHex()
  if (sha256) out.sha256 = sha256.digestHex()
  if (md5) out.md5 = md5.digestHex()
  return out
}

// ---------------------------------------------------------------- self-test --

const VECTORS: Record<Algo, string> = {
  md5: '900150983cd24fb0d6963f7d28e17f72',
  sha1: 'a9993e364706816aba3e25717850c26c9cd0d89d',
  sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
}

interface HasherLike {
  update(data: Uint8Array): void
  digestHex(): string
}

function chunkedHex(make: () => HasherLike, data: Uint8Array, slice: number): string {
  const h = make()
  for (let o = 0; o < data.length; o += slice) {
    h.update(data.subarray(o, Math.min(o + slice, data.length)))
  }
  return h.digestHex()
}

function testRow(label: string, expected: string, actual: string): TestRow {
  return { label, expected, actual, pass: expected.toLowerCase() === actual.toLowerCase() }
}

async function computeSelfTest(): Promise<TestRow[]> {
  const rows: TestRow[] = []
  const abc = new TextEncoder().encode('abc')
  const md5 = new StreamingMd5()
  md5.update(abc)
  rows.push(testRow('MD5 of "abc" (RFC 1321 vector)', VECTORS.md5, md5.digestHex()))
  const sha1 = new StreamingSha1()
  sha1.update(abc)
  rows.push(testRow('SHA-1 of "abc" (FIPS 180 vector)', VECTORS.sha1, sha1.digestHex()))
  const sha256 = new StreamingSha256()
  sha256.update(abc)
  rows.push(testRow('SHA-256 of "abc" (FIPS 180 vector)', VECTORS.sha256, sha256.digestHex()))
  try {
    const webCrypto = toHex(await crypto.subtle.digest('SHA-256', abc as unknown as ArrayBuffer))
    rows.push(testRow('SHA-256 of "abc" agrees with WebCrypto', webCrypto, sha256.digestHex()))
  } catch {
    rows.push({
      label: 'SHA-256 of "abc" agrees with WebCrypto',
      expected: 'WebCrypto available',
      actual: 'unavailable (insecure context?)',
      pass: false,
    })
  }
  // Chunk-boundary check: 1,000 pseudo-random bytes fed one-shot vs 13-byte
  // slices must produce the same digest — partial 64-byte blocks carry over.
  const buf = new Uint8Array(1000)
  for (let i = 0; i < buf.length; i++) buf[i] = (i * 31 + 7) & 0xff
  rows.push(
    testRow(
      'MD5 one-shot vs 13-byte slices',
      chunkedHex(() => new StreamingMd5(), buf, buf.length),
      chunkedHex(() => new StreamingMd5(), buf, 13),
    ),
  )
  rows.push(
    testRow(
      'SHA-1 one-shot vs 13-byte slices',
      chunkedHex(() => new StreamingSha1(), buf, buf.length),
      chunkedHex(() => new StreamingSha1(), buf, 13),
    ),
  )
  rows.push(
    testRow(
      'SHA-256 one-shot vs 13-byte slices',
      chunkedHex(() => new StreamingSha256(), buf, buf.length),
      chunkedHex(() => new StreamingSha256(), buf, 13),
    ),
  )
  return rows
}

// ------------------------------------------------------------- list parsing --

const HASH_LINE_RE = /^([0-9a-fA-F]{32}|[0-9a-fA-F]{40}|[0-9a-fA-F]{64})[ \t](\*| )?(.+)$/
const EQ_LINE_RE = /^(.+?)\s*=\s*([0-9a-fA-F]{32}|[0-9a-fA-F]{40}|[0-9a-fA-F]{64})\s*$/

function algoByLen(len: number): Algo | null {
  if (len === 32) return 'md5'
  if (len === 40) return 'sha1'
  if (len === 64) return 'sha256'
  return null
}

// ------------------------------------------------------------------ exports --

function csvField(value: string | number): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function buildChecksumExport(items: QueueItem[], algo: Algo, prefixDots: boolean): string {
  const lines: string[] = []
  for (const item of items) {
    const hash = item.digests?.[algo]
    if (!hash) continue
    const name = prefixDots ? `./${item.path}` : item.path
    lines.push(`${hash}  ${name}`)
  }
  return lines.length ? lines.join('\n') + '\n' : ''
}

function buildCsv(items: QueueItem[]): string {
  const header = 'name,path,size_bytes,status,elapsed_ms,md5,sha1,sha256'
  const lines = items.map((item) =>
    [
      csvField(item.name),
      csvField(item.path),
      item.size,
      item.status,
      item.elapsedMs ?? '',
      item.digests?.md5 ?? '',
      item.digests?.sha1 ?? '',
      item.digests?.sha256 ?? '',
    ].join(','),
  )
  return [header, ...lines].join('\n') + '\n'
}

function buildJson(items: QueueItem[]): string {
  const data = items.map((item) => ({
    name: item.name,
    path: item.path,
    sizeBytes: item.size,
    status: item.status,
    ...(item.elapsedMs !== undefined ? { elapsedMs: item.elapsedMs } : {}),
    ...(item.digests?.md5 ? { md5: item.digests.md5 } : {}),
    ...(item.digests?.sha1 ? { sha1: item.digests.sha1 } : {}),
    ...(item.digests?.sha256 ? { sha256: item.digests.sha256 } : {}),
    ...(item.error ? { error: item.error } : {}),
  }))
  return JSON.stringify(data, null, 2) + '\n'
}

// --------------------------------------------------------------- component ---

export function BatchHashTool() {
  const [items, setItems] = useState<QueueItem[]>([])
  const itemsRef = useRef<QueueItem[]>([])
  const idRef = useRef(1)

  const [algos, setAlgosState] = useState<Record<Algo, boolean>>({ md5: true, sha1: false, sha256: true })
  const algosRef = useRef(algos)

  const [running, setRunning] = useState(false)
  const runningRef = useRef(false)
  const cancelRef = useRef(false)
  const runStartRef = useRef(0)
  const [runElapsedMs, setRunElapsedMs] = useState(0)
  const [progress, setProgress] = useState({ hashed: 0, total: 0 })
  const [runNote, setRunNote] = useState<RunNote | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [prefixDots, setPrefixDots] = useState(false)
  const [verifyText, setVerifyText] = useState('')
  const [selfTest, setSelfTest] = useState<TestRow[] | null>(null)
  const [selfTestBusy, setSelfTestBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Keep the ref in lockstep with state so the runner always sees the truth.
  const setItemsSafe = useCallback((updater: (prev: QueueItem[]) => QueueItem[]) => {
    itemsRef.current = updater(itemsRef.current)
    setItems(itemsRef.current)
  }, [])

  useEffect(() => {
    if (!running) return
    const t0 = runStartRef.current
    const timer = setInterval(() => setRunElapsedMs(Date.now() - t0), 500)
    return () => clearInterval(timer)
  }, [running])

  const addFiles = useCallback(
    (files: File[]) => {
      setNotice(null)
      setRunNote(null)
      let refused = 0
      const added: QueueItem[] = files.map((f): QueueItem => {
        const path = f.webkitRelativePath || f.name
        if (f.size > TWO_GB) {
          refused++
          return {
            id: idRef.current++,
            file: f,
            name: f.name,
            path,
            size: f.size,
            status: 'failed',
            progress: 0,
            error: `Refused — ${fmtSize(f.size)} is over the 2 GB per-file cap. Browser file handling gets unreliable past that size; use sha256sum or certutil for files this big.`,
          }
        }
        return { id: idRef.current++, file: f, name: f.name, path, size: f.size, status: 'pending', progress: 0 }
      })
      setItemsSafe((prev) => [...prev, ...added])
      if (refused > 0) {
        setNotice(
          `${refused} file${refused === 1 ? ' was' : 's were'} over the 2 GB per-file cap and refused honestly — see the failed rows for the reasons.`,
        )
      }
    },
    [setItemsSafe],
  )

  function setAlgo(algo: Algo, on: boolean) {
    if (digestLocked) return
    const next = { ...algosRef.current, [algo]: on }
    algosRef.current = next
    setAlgosState(next)
  }

  const startQueue = useCallback(async () => {
    if (runningRef.current) return
    const selected = ALGO_ORDER.filter((a) => algosRef.current[a])
    if (selected.length === 0) {
      setRunNote({ tone: 'warn', text: 'Tick at least one digest first — there is nothing to compute.' })
      return
    }
    runningRef.current = true
    cancelRef.current = false
    setRunning(true)
    setRunNote(null)
    setNotice(null)
    setSelfTest(null)
    runStartRef.current = Date.now()
    setRunElapsedMs(0)

    // Denominator: bytes already hashed plus everything this run will attempt.
    // Refused rows (over the cap) never contributed bytes, so they stay out.
    const startItems = itemsRef.current
    let baseBytes = 0
    let totalBytes = 0
    for (const it of startItems) {
      if (it.status === 'done') baseBytes += it.size
      else if (it.status !== 'failed') totalBytes += it.size
    }
    setProgress({ hashed: baseBytes, total: totalBytes })

    let hashedCount = startItems.filter((i) => i.status === 'done').length
    let failedCount = 0
    try {
      for (let idx = 0; idx < itemsRef.current.length; idx++) {
        if (cancelRef.current) break
        const item = itemsRef.current[idx]
        if (item.status !== 'pending') continue
        if (idx >= startItems.length) {
          // File added while the run was already going: grow the denominator.
          totalBytes += item.size
          setProgress((p) => ({ ...p, total: p.total + item.size }))
        }
        setItemsSafe((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'running', progress: 0, error: undefined } : it)),
        )
        const startedAt = Date.now()
        try {
          const digests = await hashFile(
            item.file,
            selected,
            (bytes) => {
              setItemsSafe((prev) =>
                prev.map((it) =>
                  it.id === item.id ? { ...it, progress: item.size > 0 ? Math.min(1, bytes / item.size) : 1 } : it,
                ),
              )
              setProgress((p) => ({ ...p, hashed: baseBytes + bytes }))
            },
            () => cancelRef.current,
          )
          const elapsedMs = Date.now() - startedAt
          baseBytes += item.size
          hashedCount++
          setItemsSafe((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'done', progress: 1, elapsedMs, digests: { ...it.digests, ...digests }, error: undefined }
                : it,
            ),
          )
          setProgress((p) => ({ ...p, hashed: baseBytes }))
        } catch (err) {
          if (cancelRef.current || err instanceof CancelledError) {
            // Stopped mid-file: the partial hash is discarded, the row stays
            // pending so a resume can pick it up honestly.
            setItemsSafe((prev) =>
              prev.map((it) => (it.id === item.id ? { ...it, status: 'pending', progress: 0 } : it)),
            )
            break
          }
          failedCount++
          setItemsSafe((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'failed', progress: 0, error: 'The file could not be read — it may have moved, or the browser refused the read.' }
                : it,
            ),
          )
        }
        await yieldToUi()
      }
    } finally {
      runningRef.current = false
      setRunning(false)
    }
    const done = hashedCount
    const failedTotal = itemsRef.current.filter((i) => i.status === 'failed').length
    if (cancelRef.current) {
      const remaining = itemsRef.current.filter((i) => i.status === 'pending').length
      setRunNote({
        tone: 'info',
        text: `Queue stopped — ${done} file${done === 1 ? '' : 's'} hashed so far, ${remaining} still pending. Finished results are kept; resume when ready.`,
      })
    } else if (failedTotal > 0) {
      setRunNote({
        tone: 'warn',
        text: `Queue finished — ${done} hashed, ${failedTotal} not hashed (over the per-file cap or read errors — see the rows).`,
      })
    } else {
      setRunNote({
        tone: 'ok',
        text: `All ${done} file${done === 1 ? '' : 's'} hashed in ${fmtDuration(Date.now() - runStartRef.current)}.`,
      })
    }
  }, [setItemsSafe])

  function cancelQueue() {
    cancelRef.current = true
  }

  function clearAll() {
    setItemsSafe(() => [])
    setProgress({ hashed: 0, total: 0 })
    setRunNote(null)
    setNotice(null)
    setVerifyText('')
    setSelfTest(null)
  }

  function copy(value: string, key: string) {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1600)
    })
  }

  const runSelfTest = useCallback(async () => {
    setSelfTestBusy(true)
    try {
      setSelfTest(await computeSelfTest())
    } finally {
      setSelfTestBusy(false)
    }
  }, [])

  // ------------------------------------------------------------ derived state

  const pendingCount = items.filter((i) => i.status === 'pending').length
  const doneCount = items.filter((i) => i.status === 'done').length
  const anyDone = doneCount > 0
  const digestLocked = running || anyDone
  const queueBytes = items.reduce((s, i) => s + (i.status === 'failed' ? 0 : i.size), 0)
  const overSoftCap = queueBytes > QUEUE_SOFT_CAP
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.hashed / progress.total) * 100)) : 0
  const visibleAlgos = ALGO_ORDER.filter((a) => algos[a])

  const canExport = useCallback(
    (algo: Algo) => items.some((i) => i.status === 'done' && i.digests?.[algo]),
    [items],
  )

  function downloadChecksums(algo: Algo) {
    const text = buildChecksumExport(items, algo, prefixDots)
    if (text) downloadBlob(new Blob([text], { type: 'text/plain' }), `checksums.${algo}`)
  }
  function downloadCsv() {
    downloadBlob(new Blob([buildCsv(items)], { type: 'text/csv' }), 'checksums.csv')
  }
  function downloadJson() {
    downloadBlob(new Blob([buildJson(items)], { type: 'application/json' }), 'checksums.json')
  }

  // --------------------------------------------------------------- verify ----

  const verify: VerifyResult | null = useMemo(() => {
    if (!verifyText.trim()) return null
    const entries: ParsedEntry[] = []
    let malformed = 0
    let skipped512 = 0
    for (const rawLine of verifyText.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const m = HASH_LINE_RE.exec(line)
      if (m) {
        const algo = algoByLen(m[1].length)
        const name = m[3].trim()
        if (!algo) skipped512++
        else if (!name) malformed++
        else entries.push({ algo, name, hash: m[1].toLowerCase() })
        continue
      }
      const e = EQ_LINE_RE.exec(line)
      if (e) {
        const algo = algoByLen(e[2].length)
        const name = e[1].trim()
        if (!algo) skipped512++
        else if (!name) malformed++
        else entries.push({ algo, name, hash: e[2].toLowerCase() })
        continue
      }
      malformed++
    }
    if (entries.length === 0 && malformed === 0 && skipped512 === 0) return null

    let ok = 0
    let mismatch = 0
    let notFound = 0
    const rows: VerifyRow[] = entries.map((entry) => {
      const exact = items.find((i) => i.path === entry.name)
      const candidates = exact ? [exact] : items.filter((i) => basename(i.path) === basename(entry.name))
      if (candidates.length === 0) {
        notFound++
        return { ...entry, verdict: 'notfound', detail: 'No queued file matches this name.' }
      }
      const matching = candidates.find((c) => c.digests?.[entry.algo] === entry.hash)
      if (matching) {
        ok++
        return { ...entry, verdict: 'ok', detail: 'Digest matches the computed result.' }
      }
      const withDigest = candidates.find((c) => c.digests?.[entry.algo])
      if (!withDigest) {
        notFound++
        return {
          ...entry,
          verdict: 'notfound',
          detail: `File found, but ${ALGO_LABEL[entry.algo]} was not computed — press Clear, tick it and hash again.`,
        }
      }
      mismatch++
      return {
        ...entry,
        verdict: 'mismatch',
        detail: `Computed ${withDigest.digests?.[entry.algo] ?? ''} for this file.`,
      }
    })
    const referenced = new Set(entries.map((en) => basename(en.name)))
    const unreferenced = items.filter((i) => i.status === 'done' && !referenced.has(basename(i.path))).length
    return { rows, ok, mismatch, notFound, malformed, skipped512, unreferenced }
  }, [verifyText, items])

  // ------------------------------------------------------------------ render --

  return (
    <div>
      <DropZone
        onFiles={addFiles}
        directory
        multiple
        title="Drop the files — or pick a whole folder"
        hint="Drag files in, or use the folder button to pick a directory tree. Every byte is hashed on this device."
      />

      {/* digest selection */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2.5">
        <span className="text-sm font-medium">Digests</span>
        {ALGO_ORDER.map((a) => (
          <span key={a} className="flex items-center gap-2">
            <Checkbox
              id={`digest-${a}`}
              checked={algos[a]}
              onCheckedChange={(v) => setAlgo(a, v === true)}
              disabled={digestLocked}
              aria-label={ALGO_LABEL[a]}
            />
            <label htmlFor={`digest-${a}`} className="text-sm">
              {ALGO_LABEL[a]}
              {a === 'sha256' && <span className="ml-1 text-xs text-muted-foreground">(recommended)</span>}
              {a === 'md5' && <span className="ml-1 text-xs text-muted-foreground">(integrity only)</span>}
            </label>
          </span>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => void runSelfTest()}
          disabled={selfTestBusy}
        >
          {selfTestBusy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          Run self-test
        </Button>
      </div>
      {digestLocked && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {running ? 'Digests lock while the queue runs.' : 'Results exist — press Clear to change the digest set.'}
        </p>
      )}

      {/* self-test result */}
      {selfTest && (
        <div className="mt-3 rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">
            Self-test — the string &ldquo;abc&rdquo; and chunk boundaries
          </p>
          <ul className="mt-2 divide-y">
            {selfTest.map((row) => (
              <li key={row.label} className="flex items-center gap-3 py-1.5 text-xs">
                <span className={row.pass ? 'font-semibold text-primary' : 'font-semibold text-destructive'}>
                  {row.pass ? 'PASS' : 'FAIL'}
                </span>
                <span className="font-medium">{row.label}</span>
                <span className="ml-auto max-w-[26ch] truncate font-mono text-muted-foreground" title={row.actual}>
                  {row.actual}
                </span>
              </li>
            ))}
          </ul>
          {!selfTest.every((r) => r.pass) && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              At least one check failed — the affected digest cannot be trusted in this browser. Hash with a native
              tool instead of trusting this page.
            </p>
          )}
        </div>
      )}

      {/* controls */}
      {items.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => void startQueue()}
            disabled={running || pendingCount === 0}
            title={pendingCount === 0 ? 'Nothing pending — every file is done or refused' : undefined}
          >
            <Play className="size-4" aria-hidden="true" />
            {anyDone && pendingCount > 0 ? `Resume — ${pendingCount} file${pendingCount === 1 ? '' : 's'} left` : `Hash ${pendingCount} file${pendingCount === 1 ? '' : 's'}`}
          </Button>
          {running && (
            <Button type="button" variant="outline" onClick={cancelQueue}>
              <Square className="size-4" aria-hidden="true" />
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={clearAll}
            disabled={running}
            title={running ? 'Cancel the queue first' : 'Remove every file and result'}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Clear
          </Button>
        </div>
      )}

      {/* 8 GB soft-cap warning */}
      {overSoftCap && (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-600/5 px-3 py-2 text-sm text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/5 dark:text-amber-400"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            This queue holds {fmtSize(queueBytes)} — past the 8 GB soft cap. Hashing still runs, but smaller devices
            may slow down or run out of memory; consider batching into smaller groups.
          </span>
        </p>
      )}

      {/* inline notices */}
      {notice && (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-600/5 px-3 py-2 text-sm text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/5 dark:text-amber-400"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </p>
      )}
      {runNote && (
        <p
          role="status"
          className={
            runNote.tone === 'ok'
              ? 'mt-3 text-sm font-medium text-primary'
              : runNote.tone === 'warn'
                ? 'mt-3 flex items-start gap-2 text-sm font-medium text-amber-700 dark:text-amber-400'
                : 'mt-3 text-sm text-muted-foreground'
          }
        >
          {runNote.tone === 'ok' && <Check className="mr-1 inline size-4" aria-hidden="true" />}
          {runNote.tone === 'warn' && <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          <span>{runNote.text}</span>
        </p>
      )}

      {/* progress */}
      {progress.total > 0 && (
        <div className="mt-4">
          <Progress value={pct} aria-label={`Hashing progress: ${pct}% of bytes processed`} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {doneCount} of {items.length} files · {fmtSize(progress.hashed)} of {fmtSize(progress.total)} hashed
            {running ? ` · elapsed ${fmtDuration(runElapsedMs)}` : progress.hashed >= progress.total ? '' : ' · stopped early'}
          </p>
        </div>
      )}

      {/* queue + results table */}
      {items.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-3 border-b px-3 pb-2 text-[11px] font-semibold text-muted-foreground">
            <span className="min-w-0 flex-1">File</span>
            <span className="hidden w-20 shrink-0 text-right sm:block">Size</span>
            <span className="w-28 shrink-0 text-right">Status</span>
          </div>
          <ul className="max-h-96 divide-y overflow-y-auto rounded-b-xl border border-t-0 bg-card [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            {items.map((item) => (
              <li key={item.id} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={item.name}>
                      {item.name}
                    </p>
                    {item.path !== item.name && (
                      <p className="truncate text-xs text-muted-foreground" title={item.path}>
                        {item.path}
                      </p>
                    )}
                  </div>
                  <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:block">
                    {fmtSize(item.size)}
                  </span>
                  <span className="w-28 shrink-0 text-right text-xs">
                    {item.status === 'pending' && <span className="text-muted-foreground">Pending</span>}
                    {item.status === 'running' && (
                      <span className="inline-flex items-center justify-end gap-1.5 text-foreground">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        Hashing {Math.round(item.progress * 100)}%
                      </span>
                    )}
                    {item.status === 'done' && (
                      <span className="inline-flex items-center justify-end gap-1.5 font-medium text-primary" title={`Hashed in ${fmtDuration(item.elapsedMs ?? 0)}`}>
                        <Check className="size-3.5" aria-hidden="true" />
                        {fmtDuration(item.elapsedMs ?? 0)}
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="inline-flex items-center justify-end gap-1.5 font-medium text-destructive" title={item.error}>
                        <X className="size-3.5" aria-hidden="true" />
                        Failed
                      </span>
                    )}
                  </span>
                </div>
                {item.status === 'failed' && item.error && (
                  <p className="mt-1.5 text-xs leading-relaxed text-destructive">{item.error}</p>
                )}
                {item.status === 'done' && visibleAlgos.filter((a) => item.digests?.[a]).length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {visibleAlgos
                      .filter((a) => item.digests?.[a])
                      .map((a) => {
                        const value = item.digests?.[a] ?? ''
                        const key = `${item.id}:${a}`
                        return (
                          <li key={a} className="flex items-center gap-2">
                            <span className="w-16 shrink-0 text-[11px] font-semibold text-muted-foreground">
                              {ALGO_LABEL[a]}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-mono text-xs" title={value}>
                              {value}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copy(value, key)}
                              className="size-7 shrink-0"
                            >
                              {copied === key ? (
                                <Check className="size-3.5 text-primary" aria-hidden="true" />
                              ) : (
                                <Copy className="size-3.5" aria-hidden="true" />
                              )}
                              <span className="sr-only">
                                Copy {ALGO_LABEL[a]} hash for {item.name}
                              </span>
                            </Button>
                          </li>
                        )
                      })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* exports */}
      {anyDone && (
        <section className="mt-6" aria-label="Export checksums">
          <h2 className="text-sm font-semibold">Export</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {ALGO_ORDER.map((a) => (
              <Button
                key={a}
                type="button"
                variant="outline"
                size="sm"
                disabled={!canExport(a)}
                onClick={() => downloadChecksums(a)}
                title={canExport(a) ? undefined : `${ALGO_LABEL[a]} was not computed for this batch`}
              >
                <Download className="size-3.5" aria-hidden="true" />
                checksums.{a}
              </Button>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={downloadCsv}>
              <Download className="size-3.5" aria-hidden="true" />
              CSV
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadJson}>
              <Download className="size-3.5" aria-hidden="true" />
              JSON
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <Switch id="prefix-dots" checked={prefixDots} onCheckedChange={setPrefixDots} />
            <Label htmlFor="prefix-dots" className="text-sm">
              Prefix names with ./ (GNU style)
            </Label>
          </div>
          <p className="mt-2 max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
            The checksum exports use the standard two-space format (&ldquo;HASH&nbsp;&nbsp;filename&rdquo;), which
            sha256sum -c, sha1sum -c and md5sum -c read directly. Filenames are written as-is, never quoted: names
            containing plain spaces parse correctly, but GNU tools backslash-escape names containing backslashes or
            newlines and these exports do not — that is the one known gap. The ./ prefix and the escaping note apply
            only to the checksum exports; CSV and JSON always carry both name and folder path. When a folder was
            picked, entries use its relative paths, so save the list at the folder&rsquo;s root for verification to
            resolve.
          </p>
        </section>
      )}

      {/* verify mode */}
      <section className="mt-8" aria-label="Verify a checksum list">
        <h2 className="text-sm font-semibold">Verify a checksum list</h2>
        <p className="mt-1 max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
          Paste the contents of a .sha256, .sha1, .md5 or .txt list — &ldquo;HASH&nbsp;&nbsp;name&rdquo;,
          &ldquo;HASH *name&rdquo; or &ldquo;name=HASH&rdquo; — and every entry is matched against your results by
          path or filename and marked OK, MISMATCH or NOT FOUND: sha256sum -c, but visual and local.
        </p>
        <Label htmlFor="verify-list" className="sr-only">
          Checksum list to verify
        </Label>
        <Textarea
          id="verify-list"
          value={verifyText}
          onChange={(e) => setVerifyText(e.target.value)}
          placeholder={'ba7816bf8f01cfea414140de5dae2223…  ubuntu-24.04.iso'}
          className="mt-2 min-h-28 font-mono text-xs"
        />
        {verify && (
          <div className="mt-3">
            <p className="text-sm font-medium">
              <span className="text-primary">{verify.ok} OK</span>
              <span className="mx-1.5 text-muted-foreground">·</span>
              <span className="text-destructive">{verify.mismatch} mismatched</span>
              <span className="mx-1.5 text-muted-foreground">·</span>
              <span className="text-amber-700 dark:text-amber-400">{verify.notFound} not found</span>
            </p>
            {verify.rows.length === 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                No parseable checksum entries were found in that text{verify.malformed > 0 ? ` — ${verify.malformed} line${verify.malformed === 1 ? '' : 's'} could not be read` : ''}.
              </p>
            )}
            {verify.malformed > 0 && verify.rows.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {verify.malformed} line{verify.malformed === 1 ? '' : 's'} could not be parsed and were skipped.
              </p>
            )}
            {verify.skipped512 > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {verify.skipped512} SHA-512-length hash{verify.skipped512 === 1 ? ' was' : 'es were'} skipped — this
                tool computes MD5, SHA-1 and SHA-256.
              </p>
            )}
            {verify.unreferenced > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {verify.unreferenced} hashed file{verify.unreferenced === 1 ? ' is' : 's are'} not mentioned in the
                pasted list.
              </p>
            )}
            {doneCount === 0 && verify.rows.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Nothing is hashed yet — verdicts will populate as the queue finishes.
              </p>
            )}
            {verify.rows.length > 0 && (
              <ul className="mt-2 max-h-96 divide-y overflow-y-auto rounded-xl border bg-card [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                {verify.rows.map((row, i) => (
                  <li key={`${row.name}-${row.algo}-${i}`} className="flex items-start gap-3 px-3 py-2.5">
                    <span
                      className={
                        row.verdict === 'ok'
                          ? 'mt-0.5 text-primary'
                          : row.verdict === 'mismatch'
                            ? 'mt-0.5 text-destructive'
                            : 'mt-0.5 text-amber-700 dark:text-amber-400'
                      }
                      aria-hidden="true"
                    >
                      {row.verdict === 'ok' ? (
                        <Check className="size-4" />
                      ) : row.verdict === 'mismatch' ? (
                        <X className="size-4" />
                      ) : (
                        <AlertTriangle className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={row.name}>
                        {row.name}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {ALGO_LABEL[row.algo]} · {row.detail}
                      </p>
                    </div>
                    <span
                      className={
                        row.verdict === 'ok'
                          ? 'shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary'
                          : row.verdict === 'mismatch'
                            ? 'shrink-0 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive'
                            : 'shrink-0 rounded-full border border-amber-600/40 bg-amber-600/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-400'
                      }
                    >
                      {row.verdict === 'ok' ? 'OK' : row.verdict === 'mismatch' ? 'MISMATCH' : 'NOT FOUND'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <PrivacyStrip detail="Every checksum is computed on this device — the files are never uploaded. There is no upload code on this page at all." />
    </div>
  )
}
