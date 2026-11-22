'use client'

// Text Kit — counts, case conversion, line cleanup and find/replace.
// Everything is a pure function of the textarea content; nothing is stored.

import { useMemo, useState } from 'react'
import { Check, Copy, Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip } from '@/components/instant/instant-kit'

type CaseMode = 'upper' | 'lower' | 'title' | 'sentence' | 'camel' | 'snake' | 'kebab'
type LineOp = 'sort' | 'sortDesc' | 'dedupe' | 'trim' | 'dropEmpty' | 'reverse' | 'number' | 'shuffle'

const CASES: Array<[CaseMode, string]> = [
  ['upper', 'UPPER'],
  ['lower', 'lower'],
  ['title', 'Title'],
  ['sentence', 'Sentence'],
  ['camel', 'camelCase'],
  ['snake', 'snake_case'],
  ['kebab', 'kebab-case'],
]

const LINE_OPS: Array<[LineOp, string]> = [
  ['sort', 'Sort A→Z'],
  ['sortDesc', 'Sort Z→A'],
  ['dedupe', 'Dedupe'],
  ['trim', 'Trim lines'],
  ['dropEmpty', 'Drop empties'],
  ['reverse', 'Reverse lines'],
  ['number', 'Number lines'],
  ['shuffle', 'Shuffle'],
]

function toCase(text: string, mode: CaseMode): string {
  switch (mode) {
    case 'upper':
      return text.toUpperCase()
    case 'lower':
      return text.toLowerCase()
    case 'title':
      return text.toLowerCase().replace(/(^|[\s\-'([{])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
    case 'sentence':
      return text.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
    case 'camel':
      return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+(.)?/gu, (_, ch: string | undefined) => (ch ? ch.toUpperCase() : ''))
        .replace(/^./, (c) => c.toLowerCase())
    case 'snake':
      return text.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '')
    case 'kebab':
      return text.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
  }
}

function applyLineOp(text: string, op: LineOp): string {
  const lines = text.split('\n')
  switch (op) {
    case 'sort':
      return [...lines].sort((a, b) => a.localeCompare(b)).join('\n')
    case 'sortDesc':
      return [...lines].sort((a, b) => b.localeCompare(a)).join('\n')
    case 'dedupe': {
      const seen = new Set<string>()
      return lines.filter((l) => {
        const key = l.trim()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).join('\n')
    }
    case 'trim':
      return lines.map((l) => l.trim()).join('\n')
    case 'dropEmpty':
      return lines.filter((l) => l.trim() !== '').join('\n')
    case 'reverse':
      return [...lines].reverse().join('\n')
    case 'number':
      return lines.map((l, i) => `${i + 1}. ${l}`).join('\n')
    case 'shuffle':
      return [...lines]
        .map((l) => ({ l, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map(({ l }) => l)
        .join('\n')
  }
}

export function TextTool() {
  const [text, setText] = useState('')
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stats = useMemo(() => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const sentences = text.trim() ? text.split(/[.!?]+\s|[.!?]+$/).filter((s) => s.trim()).length : 0
    const paragraphs = text.trim() ? text.split(/\n\s*\n/).filter((p) => p.trim()).length : 0
    return {
      words,
      chars: text.length,
      charsNoSpaces: text.replace(/\s/g, '').length,
      sentences,
      paragraphs,
      lines: text ? text.split('\n').length : 0,
      readMin: Math.max(1, Math.round(words / 200)),
    }
  }, [text])

  function copyOut() {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  function doReplace() {
    setError(null)
    if (!find) return
    try {
      const pattern = useRegex ? new RegExp(find, 'g') : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      setText(text.replace(pattern, replace))
    } catch {
      setError('That regular expression is not valid — check it and try again.')
    }
  }

  return (
    <div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type text — every transform below is one click and runs live."
        aria-label="Text to transform"
        className="min-h-56 text-sm"
      />

      {/* live stats */}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-live="polite">
        {(
          [
            ['Words', stats.words],
            ['Characters', stats.chars],
            ['No spaces', stats.charsNoSpaces],
            ['Sentences', stats.sentences],
            ['Paragraphs', stats.paragraphs],
            ['Read time', `${stats.readMin} min`],
          ] as Array<[string, string | number]>
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card px-3 py-2 text-center">
            <p className="text-sm font-semibold tabular-nums">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* case + line ops */}
      <div className="mt-4 space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Switch case</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CASES.map(([mode, label]) => (
              <Button key={mode} size="sm" variant="outline" disabled={!text} onClick={() => setText(toCase(text, mode))}>
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Line operations</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {LINE_OPS.map(([op, label]) => (
              <Button key={op} size="sm" variant="outline" disabled={!text} onClick={() => setText(applyLineOp(text, op))}>
                <Type className="size-3.5" aria-hidden="true" /> {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <Label htmlFor="text-find" className="text-xs text-muted-foreground">Find & replace</Label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Input id="text-find" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find…" className="h-9 w-44" />
            <Input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Replace with…" className="h-9 w-44" aria-label="Replace with" />
            <Button size="sm" onClick={doReplace} disabled={!find || !text}>Replace all</Button>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch id="text-regex" checked={useRegex} onCheckedChange={setUseRegex} />
              <Label htmlFor="text-regex">Regex</Label>
            </span>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={copyOut} disabled={!text}>
          {copied ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy text'}
        </Button>
        {text && (
          <Button size="sm" variant="ghost" onClick={() => setText('')}>
            Clear
          </Button>
        )}
      </div>

      <PrivacyStrip detail="This page holds your text in memory only — nothing is stored, transmitted or logged." />
    </div>
  )
}
