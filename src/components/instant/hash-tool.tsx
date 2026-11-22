'use client'

// Hash & Verify — MD5/SHA checksums for files or text, computed locally.
// SHA via the Web Crypto API; MD5 via a compact pure-TS implementation
// (Web Crypto deliberately omits MD5, but download checksums still use it).

import { useCallback, useState } from 'react'
import { Check, Copy, Fingerprint, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DropZone, formatBytes, PrivacyStrip } from '@/components/instant/instant-kit'

type Source = 'file' | 'text'
type Digests = { md5: string; sha1: string; sha256: string; sha512: string }

// ------------------------------------------------------------------- MD5 ---
function md5(bytes: Uint8Array): string {
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ]
  const K = new Int32Array(64)
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32)

  const len = bytes.length
  const withPad = new Uint8Array((((len + 8) >> 6) + 1) << 6)
  withPad.set(bytes)
  withPad[len] = 0x80
  const bitLen = len * 8
  const dv = new DataView(withPad.buffer)
  dv.setUint32(withPad.length - 8, bitLen >>> 0, true)
  dv.setUint32(withPad.length - 4, Math.floor(bitLen / 2 ** 32), true)

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476
  const M = new Int32Array(16)
  for (let block = 0; block < withPad.length; block += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getInt32(block + i * 4, true)
    let A = a0, B = b0, C = c0, D = d0
    for (let i = 0; i < 64; i++) {
      let F: number, g: number
      if (i < 16) { F = (B & C) | (~B & D); g = i }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16 }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16 }
      else { F = C ^ (B | ~D); g = (7 * i) % 16 }
      F = (F + A + K[i] + M[g]) | 0
      A = D
      D = C
      C = B
      B = (B + ((F << s[i]) | (F >>> (32 - s[i])))) | 0
    }
    a0 = (a0 + A) | 0
    b0 = (b0 + B) | 0
    c0 = (c0 + C) | 0
    d0 = (d0 + D) | 0
  }
  const out = new DataView(new ArrayBuffer(16))
  out.setInt32(0, a0, true)
  out.setInt32(4, b0, true)
  out.setInt32(8, c0, true)
  out.setInt32(12, d0, true)
  return [...new Uint8Array(out.buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function shaHex(algo: 'SHA-1' | 'SHA-256' | 'SHA-512', data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(algo, data as unknown as ArrayBuffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function computeAll(bytes: Uint8Array): Promise<Digests> {
  const [sha1, sha256, sha512] = await Promise.all([
    shaHex('SHA-1', bytes),
    shaHex('SHA-256', bytes),
    shaHex('SHA-512', bytes),
  ])
  return { md5: md5(bytes), sha1, sha256, sha512 }
}

const HEX_RE = /^[0-9a-f]{32,128}$/i

export function HashTool() {
  const [source, setSource] = useState<Source>('file')
  const [text, setText] = useState('')
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null)
  const [digests, setDigests] = useState<Digests | null>(null)
  const [expected, setExpected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const handleText = useCallback((value: string) => {
    setText(value)
    setFileInfo(null)
    if (!value) {
      setDigests(null)
      return
    }
    void (async () => {
      try {
        setDigests(await computeAll(new TextEncoder().encode(value)))
      } catch {
        setError('Hashing failed unexpectedly.')
      }
    })()
  }, [])

  const handleFile = useCallback(async (files: File[]) => {
    setError(null)
    setDigests(null)
    setExpected('')
    const file = files[0]
    if (!file) return
    setFileInfo({ name: file.name, size: file.size })
    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      setDigests(await computeAll(bytes))
    } catch {
      setError('Could not read that file — very large files can exceed this device\u2019s memory. Try a smaller one.')
      setFileInfo(null)
    } finally {
      setBusy(false)
    }
  }, [])

  function copy(value: string, key: string) {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1600)
    })
  }

  const expectedNorm = expected.trim().toLowerCase()
  const verification: 'match' | 'mismatch' | null =
    expectedNorm && digests && HEX_RE.test(expectedNorm)
      ? [digests.md5, digests.sha1, digests.sha256, digests.sha512].includes(expectedNorm)
        ? 'match'
        : 'mismatch'
      : null

  return (
    <div>
      {/* source switch */}
      <div className="mb-4 flex w-fit gap-1.5 rounded-full border bg-muted/40 p-1" role="tablist" aria-label="Hash source">
        {(['file', 'text'] as Source[]).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={source === s}
            onClick={() => { setSource(s); setDigests(null); setFileInfo(null); setError(null) }}
            className={
              source === s
                ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground'
            }
          >
            {s === 'file' ? 'A file' : 'Text'}
          </button>
        ))}
      </div>

      {source === 'file' ? (
        <DropZone
          onFiles={(f) => void handleFile(f)}
          title="Drop the file to hash"
          hint="Any file type — ISO, ZIP, APK, whatever the publisher published a checksum for."
          multiple={false}
        />
      ) : (
        <div>
          <Label htmlFor="hash-text">Text to hash</Label>
          <Textarea
            id="hash-text"
            value={text}
            onChange={(e) => handleText(e.target.value)}
            placeholder="Paste anything — hashes update as you type"
            className="mt-2 min-h-28 font-mono text-xs"
          />
        </div>
      )}

      {busy && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Reading and hashing…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {fileInfo && (
        <p className="mt-3 text-sm text-muted-foreground">
          <Fingerprint className="mr-1 inline size-4 text-primary" aria-hidden="true" />
          {fileInfo.name} · {formatBytes(fileInfo.size)}
        </p>
      )}

      {digests && (
        <div className="mt-4">
          <ul className="divide-y rounded-xl border bg-card">
            {(
              [
                ['MD5', digests.md5],
                ['SHA-1', digests.sha1],
                ['SHA-256', digests.sha256],
                ['SHA-512', digests.sha512],
              ] as const
            ).map(([label, value]) => (
              <li key={label} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="truncate font-mono text-xs">{value}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(value, label)}>
                  {copied === label ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                  <span className="sr-only">Copy {label} hash</span>
                </Button>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-xl border bg-card p-4">
            <Label htmlFor="hash-expected">Expected checksum (from the publisher)</Label>
            <Input
              id="hash-expected"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              placeholder="Paste the hash they published…"
              className="mt-2 font-mono text-xs"
            />
            {verification && (
              <p
                role="status"
                className={
                  verification === 'match'
                    ? 'mt-3 flex items-center gap-2 text-sm font-medium text-primary'
                    : 'mt-3 flex items-center gap-2 text-sm font-medium text-destructive'
                }
              >
                {verification === 'match' ? (
                  <><Check className="size-4" aria-hidden="true" /> Match — the file is exactly what was published.</>
                ) : (
                  <><X className="size-4" aria-hidden="true" /> No match with any of the four hashes. The file differs — do not trust it blindly.</>
                )}
              </p>
            )}
            {expectedNorm && !HEX_RE.test(expectedNorm) && (
              <p className="mt-2 text-xs text-muted-foreground">
                That does not look like a hex checksum (MD5 = 32 chars, SHA-256 = 64…).
              </p>
            )}
          </div>
        </div>
      )}

      <PrivacyStrip detail="Hashing runs on this device — Web Crypto for SHA, a local implementation for MD5. The file is never uploaded." />
    </div>
  )
}
