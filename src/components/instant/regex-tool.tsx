'use client'

// Regex Studio — live testing against the real JavaScript RegExp engine.
// Invalid patterns are caught and explained; zero-length matches are stepped
// past explicitly so /a*/g cannot wedge the page in an infinite loop. All
// matching happens in this tab — logs and tokens pasted here go nowhere.

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

const FLAGS = [
  { id: 'g', label: 'g — global (all matches)' },
  { id: 'i', label: 'i — ignore case' },
  { id: 'm', label: 'm — multiline (^ $ per line)' },
  { id: 's', label: 's — dot matches newlines' },
  { id: 'u', label: 'u — unicode mode' },
  { id: 'y', label: 'y — sticky (match at lastIndex only)' },
] as const

const PATTERNS: Array<{ name: string; pattern: string; sample: string; flags: string }> = [
  { name: 'E-mail (practical)', pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.]{2,}', sample: 'Contact ada@example.com or team+news@company.co.uk — not "bob@".', flags: 'g' },
  { name: 'URL', pattern: 'https?://[^\\s<>"\']+', sample: 'Docs at https://example.com/docs and http://sub.example.org/x?q=1.', flags: 'g' },
  { name: 'ISO date (YYYY-MM-DD)', pattern: '\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])', sample: 'Launch 2026-03-14, fallback 2026-03-30, typo 2026-13-99.', flags: 'g' },
  { name: 'Hex color', pattern: '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b', sample: 'Palette: #f7a #FF7A45 #FF7A45FF and the invalid #12345.', flags: 'g' },
  { name: 'IPv4', pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b', sample: 'Hosts: 192.168.1.1, 10.0.0.255, 999.1.1.1 is rejected.', flags: 'g' },
  { name: 'Duplicate word', pattern: '\\b(\\w+)\\s+\\1\\b', sample: 'This this sentence has has repeated words that that repeat.', flags: 'gim' },
  { name: 'Time HH:MM', pattern: '([01]?\\d|2[0-3]):([0-5]\\d)', sample: 'Meet at 9:30, backup at 14:05, never at 24:61.', flags: 'g' },
  { name: 'HTML tag', pattern: '<([a-z][a-z0-9]*)\\b[^>]*>(.*?)</\\1>', sample: '<p>Hello <b>world</b></p> and <div>block</div>.', flags: 'gis' },
]

const CHEATSHEET: Array<{ group: string; items: Array<[string, string]> }> = [
  {
    group: 'Characters',
    items: [['.', 'any character except newline'], ['\\d \\w \\s', 'digit, word character, whitespace'], ['\\D \\W \\S', 'the negations'], ['[abc]', 'a, b or c'], ['[^abc]', 'anything but a, b, c'], ['[a-z]', 'a range']],
  },
  {
    group: 'Quantifiers',
    items: [['* + ?', '0+, 1+, 0 or 1 (greedy)'], ['*? +? ??', 'lazy versions'], ['{2} {2,} {2,5}', 'exact, at-least, between']],
  },
  {
    group: 'Position',
    items: [['^ $', 'start / end (line with m)'], ['\\b \\B', 'word boundary / not one']],
  },
  {
    group: 'Groups',
    items: [['(…)', 'capturing group'], ['(?:…)', 'non-capturing'], ['(?<name>…)', 'named group'], ['\\1 $1', 'backreference / replacement'], ['a|b', 'alternation']],
  },
  {
    group: 'Lookaround',
    items: [['(?=…)', 'lookahead'], ['(?!…)', 'negative lookahead'], ['(?<=…)', 'lookbehind'], ['(?<!…)', 'negative lookbehind']],
  },
]

interface MatchRow {
  index: number
  end: number
  text: string
  groups: Array<string | undefined>
  named: Record<string, string | undefined>
  line: number
}

function collectMatches(re: RegExp, input: string): { rows: MatchRow[]; error: string } {
  const rows: MatchRow[] = []
  try {
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g'
    const global = new RegExp(re.source, flags)
    const lineStarts: number[] = [0]
    for (let i = 0; i < input.length; i++) if (input[i] === '\n') lineStarts.push(i + 1)
    let guard = 0
    let m: RegExpExecArray | null
    while ((m = global.exec(input)) !== null) {
      // zero-length match: force the engine past it, the standard trick
      if (m[0].length === 0) {
        global.lastIndex++
        if (global.lastIndex > input.length) break
        continue
      }
      let line = 1
      for (const s of lineStarts) { if (s > m.index) break; line++ }
      rows.push({
        index: m.index,
        end: m.index + m[0].length,
        text: m[0],
        groups: m.slice(1),
        named: m.groups ?? {},
        line,
      })
      if (++guard > 20000) return { rows, error: 'Stopped after 20,000 matches — refine the pattern.' }
    }
    return { rows, error: '' }
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : 'Matching failed' }
  }
}

export function RegexTool() {
  const [pattern, setPattern] = useState('\\b(\\w+)\\s+\\1\\b')
  const [flagsOn, setFlagsOn] = useState<Record<string, boolean>>({ g: true, i: false, m: false, s: false, u: false, y: false })
  const [input, setInput] = useState('This sentence has has repeated words that that repeat.\nNames: ada@example.com, site https://example.com/docs')
  const [replace, setReplace] = useState('$1')

  const flagStr = FLAGS.filter((f) => flagsOn[f.id]).map((f) => f.id).join('')

  const compiled = useMemo(() => {
    if (!pattern) return { ok: false as const, error: '' }
    try {
      return { ok: true as const, re: new RegExp(pattern, flagStr) }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message.replace(/^Invalid regular expression: /, '') : 'Invalid pattern' }
    }
  }, [pattern, flagStr])

  const matches = useMemo(() => {
    if (!compiled.ok || !input) return { rows: [], error: '' }
    return collectMatches(compiled.re, input)
  }, [compiled, input])

  const replaced = useMemo(() => {
    if (!compiled.ok || !input) return ''
    try {
      return input.replace(compiled.re, replace)
    } catch {
      return ''
    }
  }, [compiled, input, replace])

  // highlighted input: segments around matches
  const highlighted = useMemo(() => {
    if (!compiled.ok || matches.rows.length === 0) return [{ text: input, hit: false }]
    const parts: Array<{ text: string; hit: boolean }> = []
    let cursor = 0
    for (const m of matches.rows) {
      if (m.index > cursor) parts.push({ text: input.slice(cursor, m.index), hit: false })
      parts.push({ text: input.slice(m.index, m.end), hit: true })
      cursor = m.end
    }
    if (cursor < input.length) parts.push({ text: input.slice(cursor), hit: false })
    return parts
  }, [compiled, input, matches])

  const applyPattern = (p: string, f: string) => {
    setPattern(p)
    setFlagsOn({ g: f.includes('g'), i: f.includes('i'), m: f.includes('m'), s: f.includes('s'), u: f.includes('u'), y: f.includes('y') })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        {/* pattern row */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Label htmlFor="rx-pattern">Pattern</Label>
            <div className="mt-1.5 flex items-center rounded-lg border bg-muted/40 font-mono text-sm focus-within:ring-1 focus-within:ring-ring">
              <span className="pl-3 text-muted-foreground">/</span>
              <Input
                id="rx-pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="h-10 border-0 bg-transparent font-mono focus-visible:ring-0"
                spellCheck={false}
                autoComplete="off"
              />
              <span className="text-muted-foreground">/{flagStr}</span>
              <span className="w-2" />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pb-1">
            {FLAGS.map((f) => (
              <label key={f.id} className="flex items-center gap-1.5 text-xs" title={f.label}>
                <Switch
                  checked={flagsOn[f.id]}
                  onCheckedChange={(v) => setFlagsOn((s) => ({ ...s, [f.id]: v }))}
                  aria-label={`Flag ${f.label}`}
                />
                <span className="font-mono font-semibold">{f.id}</span>
              </label>
            ))}
          </div>
        </div>
        {!compiled.ok && compiled.error && (
          <p className="mt-2 text-sm text-destructive" role="alert">Invalid pattern — {compiled.error}</p>
        )}

        {/* input */}
        <div className="mt-4">
          <Label htmlFor="rx-input">Test string</Label>
          <Textarea id="rx-input" value={input} onChange={(e) => setInput(e.target.value)} rows={5} className="mt-1.5 font-mono text-sm" spellCheck={false} />
        </div>

        <PrivacyStrip detail="Matching runs on the browser's own RegExp engine in this tab. Whatever you paste — logs, tokens, customer rows — stays on this device." />
      </div>

      {compiled.ok && (
        <>
          {/* highlighted matches */}
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Matches</h2>
              <span className="text-xs text-muted-foreground">{matches.rows.length} match{matches.rows.length === 1 ? '' : 'es'}</span>
            </div>
            {matches.error && <p className="mt-2 text-sm text-destructive">{matches.error}</p>}
            <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 font-mono text-sm leading-relaxed" aria-label="Test string with matches highlighted">
              {highlighted.map((p, i) =>
                p.hit ? (
                  <mark key={i} className="rounded bg-primary/25 px-0.5 text-foreground">{p.text}</mark>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </div>
            {matches.rows.length > 0 && (
              <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Position</th>
                      <th className="px-3 py-2 font-medium">Line</th>
                      <th className="px-3 py-2 font-medium">Match</th>
                      <th className="px-3 py-2 font-medium">Groups</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {matches.rows.slice(0, 200).map((m, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-1.5 tabular-nums">{m.index}–{m.end}</td>
                        <td className="px-3 py-1.5 tabular-nums">{m.line}</td>
                        <td className="max-w-[200px] truncate px-3 py-1.5">{m.text}</td>
                        <td className="px-3 py-1.5 text-xs">
                          {m.groups.length === 0 && Object.keys(m.named).length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <>
                              {m.groups.map((g, gi) => (
                                <span key={gi} className="mr-2">
                                  ${gi + 1}: <span className={cn(g === undefined && 'text-muted-foreground')}>{g === undefined ? '∅' : g}</span>
                                </span>
                              ))}
                              {Object.entries(m.named).map(([k, v]) => (
                                <span key={k} className="mr-2">
                                  $&lt;{k}&gt;: <span className={cn(v === undefined && 'text-muted-foreground')}>{v === undefined ? '∅' : v}</span>
                                </span>
                              ))}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* replace preview */}
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Replace preview — String.replace semantics</h2>
            <div className="mt-3 grid gap-3 lg:grid-cols-[280px_1fr]">
              <div>
                <Label htmlFor="rx-replace">Replacement ($1, $&lt;name&gt;, $&amp; …)</Label>
                <Input id="rx-replace" value={replace} onChange={(e) => setReplace(e.target.value)} className="mt-1.5 font-mono text-sm" spellCheck={false} />
              </div>
              <div>
                <Label>Result</Label>
                <div className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 font-mono text-sm" aria-label="Replace result">
                  {replaced || <span className="text-muted-foreground">—</span>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* library */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Pattern library — click to load</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {PATTERNS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => { applyPattern(p.pattern, p.flags); setInput((cur) => cur || p.sample) }}
              className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              title={p.pattern}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* cheatsheet */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Cheatsheet</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHEATSHEET.map((g) => (
            <div key={g.group}>
              <p className="text-xs font-semibold text-primary">{g.group}</p>
              <ul className="mt-1.5 space-y-1">
                {g.items.map(([sym, meaning]) => (
                  <li key={sym} className="flex gap-2 text-xs">
                    <code className="shrink-0 font-mono font-semibold">{sym}</code>
                    <span className="text-muted-foreground">{meaning}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
