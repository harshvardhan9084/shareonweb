'use client'

// Base64 Encode & Decode — text and files, Unicode-safe, all local.

import { useCallback, useState } from 'react'
import { ArrowDownUp, Check, Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DropZone, downloadBlob, PrivacyStrip } from '@/components/instant/instant-kit'

type Dir = 'encode' | 'decode'
type Source = 'text' | 'file'

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function decodeBase64(value: string): string {
  const clean = value.replace(/\s+/g, '')
  const bin = atob(clean)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function EncodeTool() {
  const [source, setSource] = useState<Source>('text')
  const [dir, setDir] = useState<Dir>('encode')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null)
  const [copied, setCopied] = useState(false)

  const runText = useCallback(
    (value: string, direction: Dir) => {
      setInput(value)
      setError(null)
      if (!value.trim()) {
        setOutput('')
        return
      }
      try {
        setOutput(direction === 'encode' ? encodeBase64(value) : decodeBase64(value))
      } catch {
        setError('That is not valid Base64 — check for stray characters or line breaks.')
        setOutput('')
      }
    },
    [],
  )

  const handleFile = useCallback(async (files: File[]) => {
    setError(null)
    setOutput('')
    const file = files[0]
    if (!file) return
    setFileInfo({ name: file.name, size: file.size })
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('read failed'))
        reader.readAsDataURL(file)
      })
      setOutput(dataUrl)
    } catch {
      setError('Could not read that file on this device.')
      setFileInfo(null)
    }
  }, [])

  function decodeToFile(value: string) {
    try {
      const clean = value.trim()
      const match = clean.match(/^data:([^;]+);base64,([\s\S]*)$/)
      const mime = match?.[1] || 'application/octet-stream'
      const b64 = match?.[2] ?? clean
      const bin = atob(b64.replace(/\s+/g, ''))
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const ext = mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin'
      downloadBlob(new Blob([bytes as unknown as BlobPart], { type: mime }), `decoded.${ext}`)
      setError(null)
    } catch {
      setError('That is not valid Base64 file data.')
    }
  }

  function copyOut() {
    void navigator.clipboard?.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4">
        <div className="flex gap-1.5 rounded-full border bg-muted/40 p-1" role="tablist" aria-label="Input kind">
          {(['text', 'file'] as Source[]).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={source === s}
              onClick={() => { setSource(s); setInput(''); setOutput(''); setFileInfo(null); setError(null) }}
              className={
                source === s
                  ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                  : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground'
              }
            >
              {s === 'text' ? 'Text' : 'A file'}
            </button>
          ))}
        </div>
        {source === 'text' && (
          <div className="flex gap-1.5 rounded-full border bg-muted/40 p-1" role="tablist" aria-label="Direction">
            {(['encode', 'decode'] as Dir[]).map((d) => (
              <button
                key={d}
                role="tab"
                aria-selected={dir === d}
                onClick={() => { setDir(d); setOutput(''); setError(null); if (input) runText(input, d) }}
                className={
                  dir === d
                    ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                    : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground'
                }
              >
                {d === 'encode' ? 'Text → Base64' : 'Base64 → Text'}
              </button>
            ))}
          </div>
        )}
      </div>

      {source === 'text' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <Label htmlFor="enc-input">{dir === 'encode' ? 'Plain text' : 'Base64'}</Label>
            <Textarea
              id="enc-input"
              value={input}
              onChange={(e) => runText(e.target.value, dir)}
              placeholder={dir === 'encode' ? 'Type or paste text…' : 'Paste Base64…'}
              className="mt-2 min-h-44 font-mono text-xs"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enc-output">{dir === 'encode' ? 'Base64' : 'Decoded text'}</Label>
              <Button size="sm" variant="ghost" onClick={() => { setDir(dir === 'encode' ? 'decode' : 'encode'); if (output) { setInput(output); runText(output, dir === 'encode' ? 'decode' : 'encode') } }}>
                <ArrowDownUp className="size-3.5" aria-hidden="true" /> Swap
              </Button>
            </div>
            <Textarea
              id="enc-output"
              value={output}
              readOnly
              placeholder="Result appears here as you type…"
              className="mt-2 min-h-44 font-mono text-xs"
            />
          </div>
        </div>
      ) : (
        <div>
          <DropZone
            onFiles={(f) => void handleFile(f)}
            title="Drop a file to get its Base64 / data URL"
            hint="Any file — the result is a data: URL you can paste into HTML, CSS or JSON."
            multiple={false}
          />
          {fileInfo && (
            <p className="mt-3 text-sm text-muted-foreground">
              {fileInfo.name} · {fileInfo.size} bytes → data URL below.
            </p>
          )}
          {output && (
            <div className="mt-3 rounded-xl border bg-card p-4">
              <Label htmlFor="enc-file-out">Data URL</Label>
              <textarea
                id="enc-file-out"
                readOnly
                value={output}
                className="mt-2 h-24 w-full resize-none rounded-lg border bg-muted/30 p-2 font-mono text-xs"
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={copyOut}>
                  {copied ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />} Copy
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {source === 'text' && dir === 'decode' && output && (
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => decodeToFile(input)}>
            <Download className="size-4" aria-hidden="true" /> Save as file
          </Button>
        </div>
      )}

      <PrivacyStrip detail="Encoding happens in this tab with the browser's own Unicode-safe routines. Nothing is sent anywhere." />
    </div>
  )
}
