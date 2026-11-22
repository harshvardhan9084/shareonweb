'use client'

// JSON Formatter — format, minify, validate and sort keys, with the exact
// error position. All parsing happens locally with the engine's own JSON.

import { useMemo, useState } from 'react'
import { Braces, Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip } from '@/components/instant/instant-kit'

type Action = 'format2' | 'format4' | 'minify' | 'sort'

interface JsonStats {
  bytes: number
  keys: number
  depth: number
  isArray: boolean
}

function depthOf(value: unknown): number {
  if (Array.isArray(value)) return 1 + Math.max(0, ...value.map(depthOf))
  if (value && typeof value === 'object') {
    return 1 + Math.max(0, ...Object.values(value).map(depthOf))
  }
  return 0
}

function countKeys(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((s: number, v) => s + countKeys(v), 0)
  if (value && typeof value === 'object') {
    return Object.keys(value).length + Object.values(value).reduce((s: number, v) => s + countKeys(v as unknown), 0)
  }
  return 0
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    )
  }
  return value
}

/** Translate a JSON.parse error into an exact line/column. */
function errorPosition(input: string, err: unknown): { line: number; column: number; message: string } | null {
  const message = err instanceof Error ? err.message : String(err)
  const match = message.match(/position (\d+)/)
  if (!match) return { line: 1, column: 1, message }
  const pos = Number(match[1])
  const before = input.slice(0, pos)
  const line = before.split('\n').length
  const column = pos - before.lastIndexOf('\n')
  return { line, column, message }
}

export function JsonTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<{ line: number; column: number; message: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const stats: JsonStats | null = useMemo(() => {
    if (!input.trim()) return null
    try {
      const parsed = JSON.parse(input) as unknown
      return {
        bytes: new TextEncoder().encode(input).length,
        keys: countKeys(parsed),
        depth: depthOf(parsed),
        isArray: Array.isArray(parsed),
      }
    } catch {
      return null
    }
  }, [input])

  function run(action: Action) {
    setError(null)
    setOutput('')
    const value = input.trim()
    if (!value) return
    try {
      const parsed = JSON.parse(value) as unknown
      switch (action) {
        case 'format2':
          setOutput(JSON.stringify(parsed, null, 2))
          break
        case 'format4':
          setOutput(JSON.stringify(parsed, null, 4))
          break
        case 'minify':
          setOutput(JSON.stringify(parsed))
          break
        case 'sort':
          setOutput(JSON.stringify(sortKeys(parsed), null, 2))
          break
      }
    } catch (err) {
      setError(errorPosition(input, err) ?? { line: 1, column: 1, message: String(err) })
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
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="json-input">JSON in</Label>
            {stats && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {stats.isArray ? 'array' : 'object'} · {stats.keys} keys · depth {stats.depth} · {stats.bytes} B · valid
              </p>
            )}
          </div>
          <Textarea
            id="json-input"
            value={input}
            onChange={(e) => { setInput(e.target.value); setOutput(''); setError(null) }}
            placeholder='Paste JSON — e.g. {"ok":true,"items":[1,2,3]}'
            className="mt-2 min-h-64 font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="json-output">Result</Label>
            {output && (
              <Button size="sm" variant="ghost" onClick={copyOut}>
                {copied ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />} Copy
              </Button>
            )}
          </div>
          <Textarea
            id="json-output"
            value={output}
            readOnly
            placeholder="Formatted result appears here…"
            className="mt-2 min-h-64 font-mono text-xs"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ['format2', 'Format (2 spaces)'],
            ['format4', 'Format (4 spaces)'],
            ['minify', 'Minify'],
            ['sort', 'Sort keys'],
          ] as Array<[Action, string]>
        ).map(([action, label]) => (
          <Button key={action} size="sm" variant="outline" onClick={() => run(action)} disabled={!input.trim()}>
            <Braces className="size-3.5" aria-hidden="true" /> {label}
          </Button>
        ))}
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <p className="font-semibold">
            Invalid JSON — line {error.line}, column {error.column}
          </p>
          <p className="mt-0.5 text-xs opacity-90">{error.message}</p>
        </div>
      )}
      {!error && output && (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-sm text-primary">
          <Check className="size-4" aria-hidden="true" /> Valid JSON, transformed below — nothing left this device.
        </p>
      )}

      <PrivacyStrip detail="Parsing and formatting use this browser's own JSON engine. Paste API responses freely — nothing is sent anywhere." />
    </div>
  )
}
