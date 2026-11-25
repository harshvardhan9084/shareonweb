'use client'

// JSON to TypeScript — generate interfaces (or type aliases) from a JSON
// document the way you would by hand: one named interface per object shape,
// nested objects lifted out and re-used when they repeat, array members
// unioned, fields missing from some array members marked optional, and every
// name Pascal-cased legally. The generation is deterministic and runs here —
// the JSON never leaves the tab.

import { useMemo, useState } from 'react'
import { Braces, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

/** Parse with a line/column-carrying error, so a broken paste is fixable. */
function parseJson(text: string): { ok: true; value: Json } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as Json }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // V8 positions look like "…at position 123"; translate to line/column.
    const pos = /position (\d+)/.exec(msg)
    if (pos) {
      const upto = text.slice(0, Number(pos[1]))
      const line = upto.split('\n').length
      const col = Number(pos[1]) - (upto.lastIndexOf('\n') + 1) + 1
      return { ok: false, error: `${msg.replace(/ in JSON at position \d+/, '')} — line ${line}, column ${col}` }
    }
    return { ok: false, error: msg }
  }
}

/** Pascal-case an identifier and make it a legal TypeScript name. */
function pascal(raw: string): string {
  const cleaned = raw
    .replace(/[^a-zA-Z0-9_$]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
    .replace(/^[^a-zA-Z_$]+/, '')
  const named = cleaned.length > 0 ? cleaned : 'Field'
  const cased = named.charAt(0).toUpperCase() + named.slice(1)
  // Reserved words that are legal property names but illegal type names.
  return RESERVED.has(cased) ? cased + 'Type' : cased
}

const RESERVED = new Set([
  'Type', 'Interface', 'Class', 'Enum', 'Const', 'Let', 'Var', 'New', 'Export',
  'Import', 'Default', 'Return', 'Void', 'Null', 'Undefined', 'String',
  'Number', 'Boolean', 'Object', 'Any', 'Never', 'Unknown', 'Readonly',
])

interface Shape {
  expr: string
}

function isObject(v: Json): v is { [k: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Naive singularization for array-item names: orders → Order, items → Item. */
function singular(word: string): string {
  if (/ies$/i.test(word)) return word.replace(/ies$/i, 'y')
  if (/([sxz]|ch|sh)es$/i.test(word)) return word.replace(/es$/i, '')
  if (/[^s]s$/i.test(word)) return word.slice(0, -1)
  return word
}

/**
 * The collector walks the parsed value once, naming every distinct object
 * shape it meets. Two objects with identical keys-and-types get ONE
 * interface — the same structural dedup a careful engineer does by hand.
 * Shapes registered with an `optionalKeys` set encode "absent from some
 * siblings" as `?` on those fields, and the signature includes the flags so
 * an optional-bearing shape is never confused with its always-present twin.
 */
class Collector {
  private shapes = new Map<string, Array<{ key: string; expr: string; optional: boolean }>>()
  private names = new Map<string, string>()
  private counter = new Map<string, number>()

  /** Name a value's type, registering object shapes as named interfaces. */
  name(value: Json, hint: string, optionalKeys?: Set<string>): Shape {
    if (value === null) return { expr: 'null' }
    if (typeof value === 'boolean') return { expr: 'boolean' }
    if (typeof value === 'number') return { expr: 'number' }
    if (typeof value === 'string') return { expr: 'string' }
    if (Array.isArray(value)) {
      if (value.length === 0) return { expr: 'unknown[]' }
      const objects = value.filter(isObject)
      if (objects.length === value.length) {
        // Every member is an object — merge them into ONE item shape.
        // A key absent from some members (or null there) is genuinely
        // optional: that is what "the API omits this sometimes" looks like.
        const keyCounts = new Map<string, number>()
        for (const o of objects) {
          for (const k of Object.keys(o)) keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1)
        }
        const optionalKeys = new Set(
          [...keyCounts.entries()]
            .filter(([k, c]) => c < objects.length || objects.every((o) => o[k] === null))
            .map(([k]) => k),
        )
        const merged: { [k: string]: Json } = {}
        for (const o of objects) {
          for (const [k, v] of Object.entries(o)) {
            if (!(k in merged) || merged[k] === null) merged[k] = v
          }
        }
        const item = this.name(merged, singular(hint), optionalKeys)
        return { expr: `${item.expr}[]` }
      }
      // Mixed members: name each and union the distinct shapes.
      const memberExprs = [...new Set(value.map((v) => this.name(v, hint).expr))]
      const union = memberExprs.length === 1 ? memberExprs[0] : `(${memberExprs.join(' | ')})`
      return { expr: `${union}[]` }
    }
    // Object: collect member types first (recursion names nested objects).
    const members = Object.entries(value).map(([key, v]) => ({
      key,
      expr: this.name(v, key).expr,
      optional: optionalKeys?.has(key) ?? false,
    }))
    // Structural signature: key set + member types + optional flags.
    const sig = members.map((m) => `${m.key}${m.optional ? '?' : ''}:${m.expr}`).sort().join(';')
    const existing = this.names.get(sig)
    if (existing) return { expr: existing }
    const base = pascal(hint)
    const n = (this.counter.get(base) ?? 0) + 1
    this.counter.set(base, n)
    const finalName = n === 1 ? base : `${base}${n}`
    this.names.set(sig, finalName)
    this.shapes.set(finalName, members)
    return { expr: finalName }
  }

  emit(useType: boolean, readonly: boolean): string {
    const lines: string[] = []
    const prefix = readonly ? 'readonly ' : ''
    for (const [name, members] of this.shapes) {
      lines.push(`export ${useType ? 'type' : 'interface'} ${name} ${useType ? '= {' : '{'}`)
      for (const { key, expr, optional } of members) {
        const propKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
        lines.push(`  ${prefix}${propKey}${optional ? '?' : ''}: ${expr}`)
      }
      lines.push('}')
      lines.push('')
    }
    return lines.join('\n').trimEnd() + (lines.length > 0 ? '\n' : '')
  }
}

/**
 * Generate the TypeScript module for a JSON value. An array of objects at
 * the root names the ITEM type (with sibling-absent fields optional) and
 * wraps it as `{ items: Item[] }`; a primitive root becomes one type alias.
 */
function generate(value: Json, rootNameRaw: string, useType: boolean, readonly: boolean): string {
  const rootName = pascal(rootNameRaw || 'Root')
  const collector = new Collector()
  const kw = useType ? 'type' : 'interface'
  const open = useType ? '= {' : '{'

  // Root array whose members include objects: name the item shape(s), then
  // wrap them under the root name.
  if (Array.isArray(value) && value.some(isObject)) {
    const items = collector.name(value, `${rootName}Item`)
    const body = collector.emit(useType, readonly)
    return (
      body +
      `export ${kw} ${rootName} ${open}\n` +
      `  items: ${items.expr}\n` +
      `}\n`
    )
  }

  const root = collector.name(value, rootName)
  const body = collector.emit(useType, readonly)
  if (body.length > 0) return body
  // Primitive or empty-array root: a single type alias carries it.
  return `export type ${rootName} = ${root.expr}\n`
}

export function JsonToTsTool() {
  const [input, setInput] = useState(
    JSON.stringify(
      {
        id: 42,
        user: { name: 'Ada', email: 'ada@example.com', admin: false },
        tags: ['alpha', 'beta'],
        orders: [
          { sku: 'KT-100', qty: 2, price: 19.5 },
          { sku: 'KT-220', qty: 1, price: 42, note: 'gift wrap' },
        ],
      },
      null,
      2,
    ),
  )
  const [rootName, setRootName] = useState('OrderPayload')
  const [useType, setUseType] = useState(false)
  const [readonly, setReadonly] = useState(false)
  const [copied, setCopied] = useState(false)

  const parsed = useMemo(() => parseJson(input), [input])
  const output = useMemo(() => {
    if (!parsed.ok) return null
    return generate(parsed.value, rootName, useType, readonly)
  }, [parsed, rootName, useType, readonly])

  const copy = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard denied — output stays selectable */
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="jts-input" className="text-sm font-semibold">
            JSON in
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['interface', 'Interfaces'],
                ['type', 'Type aliases'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setUseType(key === 'type')}
                aria-pressed={key === 'type' ? useType : !useType}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  (key === 'type') === useType
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted',
                )}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setReadonly((r) => !r)}
              aria-pressed={readonly}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                readonly ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              readonly
            </button>
          </div>
        </div>
        <textarea
          id="jts-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={10}
          spellCheck={false}
          className="mt-2 w-full rounded-md border bg-background px-3.5 py-2.5 font-mono text-xs leading-relaxed"
          aria-label="JSON input"
        />
        <div className="mt-3">
          <Label htmlFor="jts-root" className="text-xs text-muted-foreground">Root type name</Label>
          <input
            id="jts-root"
            value={rootName}
            onChange={(e) => setRootName(e.target.value)}
            spellCheck={false}
            className="mt-1 h-9 w-56 rounded-md border bg-background px-3 font-mono text-sm"
          />
        </div>
        {!parsed.ok && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {parsed.error}
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Braces className="size-4 text-primary" aria-hidden="true" /> TypeScript
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={() => void copy()} disabled={!output}>
            <Copy className="size-3.5" aria-hidden="true" />
            {copied ? 'Copied' : 'Copy types'}
          </Button>
        </div>
        {output ? (
          <pre className="mt-3 max-h-96 overflow-auto rounded-lg border bg-background p-3.5 font-mono text-xs leading-relaxed" data-testid="jts-out">
            {output}
          </pre>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed bg-background p-3.5 text-sm text-muted-foreground">
            Fix the JSON above — types are generated the moment it parses.
          </p>
        )}
        {output && (
          <p className="mt-2 text-xs text-muted-foreground">
            One interface per distinct object shape (identical shapes are re-used, not duplicated); fields that are missing — or null — from some array items come out optional, everywhere in the tree.
          </p>
        )}
      </div>

      <PrivacyStrip detail="Parsing and generation run in this tab: your JSON is held in page memory only, no paste service, no telemetry." />
    </div>
  )
}
