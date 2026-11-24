'use client'

// Code Formatter Studio — real engines in this tab: js-beautify for
// HTML/CSS/JS, sql-formatter for SQL (five dialects), a JSON side-check with
// exact error position. Compaction is honest about what it preserves
// (calc() spaces, pre/textarea/script/style bytes) and JS ships no minifier,
// on ASI principle. Everything runs locally; nothing is sent anywhere.

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { downloadBlob } from '@/components/instant/instant-kit'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Lang = 'html' | 'css' | 'js' | 'sql' | 'json'

const DEFAULTS: Record<Lang, string> = {
  html: `<!DOCTYPE html>
<html>
<head>
    <title>demo page</title>
    <style>body{margin:0;font-family:sans-serif}
    .card{padding:16px;border:1px solid #ccc}</style>
</head>
<body>
<div class="card">
    <h1>Hello</h1>
    <p>A   messy   page with
    irregular spacing.</p>
</div>
</body>
</html>`,
  css: `.card{padding:16px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.15)}
/* layout rules */
.layout{display:flex;gap:12px;flex-direction:column}
.layout .item{flex:1;width:calc(100% - 24px);min-height:2rem}
@media (max-width:640px){.layout{flex-direction:row}}`,
  js: `function total(items){let sum=0
for(const it of items){sum+=it.price*it.qty}
return sum.toFixed(2)}
const cart=[{price:4.5,qty:2},{price:1.25,qty:4}]
console.log(total(cart))`,
  sql: `SELECT c.name, COUNT(o.id) AS orders, SUM(o.total) AS revenue FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.created_at >= '2026-01-01' AND c.country IN ('US','GB','DE') GROUP BY c.name HAVING COUNT(o.id) > 3 ORDER BY revenue DESC LIMIT 25;`,
  json: `{"name":"demo","tags":["alpha","beta"],"nested":{"count":3,"ok":true},"items":[{"id":1,"price":9.99},{"id":2,"price":24.5}]}`,
}

const LANGS: Array<{ id: Lang; label: string }> = [
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'js', label: 'JS' },
  { id: 'sql', label: 'SQL' },
  { id: 'json', label: 'JSON' },
]

const SQL_DIALECTS = [
  { id: 'sql', label: 'Standard SQL' },
  { id: 'mysql', label: 'MySQL' },
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'transactsql', label: 'T-SQL' },
  { id: 'plsql', label: 'PL/SQL' },
] as const

/** Collapse whitespace in CSS but never inside the parens of functions that
 *  need their inner spaces (calc/min/max/clamp). */
function compactCss(src: string): string {
  // protect the argument lists of space-sensitive functions
  const saved: string[] = []
  const guarded = src.replace(/\b(calc|min|max|clamp)\s*\(([^()]*)\)/gi, (_m, fn: string, args: string) => {
    saved.push(args)
    return `${fn}(\u0000${saved.length - 1}\u0000)`
  })
  const out = guarded
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([;:{},])\s*/g, '$1')
    .replace(/([;{}])\s*/g, '$1')
    .replace(/;\}/g, '}')
    .trim()
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => saved[Number(i)])
}

/** Remove HTML comments and inter-tag whitespace; pre, textarea, script and
 *  style contents stay byte-exact. */
function compactHtml(src: string): string {
  const VERBATIM = /<(pre|textarea|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi
  const saved: string[] = []
  const guarded = src.replace(VERBATIM, (m) => {
    saved.push(m)
    return `\u0000${saved.length - 1}\u0000`
  })
  const out = guarded
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => saved[Number(i)])
}

/** Strip SQL comments and collapse whitespace, preserving string literals. */
function compactSql(src: string): string {
  const saved: string[] = []
  const guarded = src.replace(/'(?:[^']|'')*'/g, (m) => {
    saved.push(m)
    return `\u0000${saved.length - 1}\u0000`
  })
  const out = guarded
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => saved[Number(i)])
}

/** JSON with the exact line and column of a parse failure. */
function jsonReport(src: string, indent: 0 | 2): string {
  try {
    const parsed = JSON.parse(src)
    return JSON.stringify(parsed, null, indent)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const posMatch = msg.match(/position (\d+)/)
    if (posMatch) {
      const pos = Number(posMatch[1])
      const upto = src.slice(0, pos)
      const line = upto.split('\n').length
      const col = pos - upto.lastIndexOf('\n')
      return `✗ Invalid JSON — ${msg.replace(/ in JSON at position \d+/, '')} at line ${line}, column ${col}`
    }
    return `✗ Invalid JSON — ${msg}`
  }
}

export function BeautifyTool() {
  const [lang, setLang] = useState<Lang>('css')
  const [mode, setMode] = useState<'beautify' | 'compact'>('beautify')
  const [input, setInput] = useState(DEFAULTS.css)
  const [indent, setIndent] = useState<'2' | '4' | 'tab'>('2')
  const [wrap, setWrap] = useState('80')
  const [dialect, setDialect] = useState<(typeof SQL_DIALECTS)[number]['id']>('sql')
  const [keywordCase, setKeywordCase] = useState<'upper' | 'lower' | 'preserve'>('upper')
  const [copied, setCopied] = useState(false)
  const [enginesReady, setEnginesReady] = useState(false)

  useEffect(() => {
    let alive = true
    // Warm both engines once so the first keystroke is already fast.
    void Promise.all([import('js-beautify'), import('sql-formatter')]).then(() => {
      if (alive) setEnginesReady(true)
    })
    return () => { alive = false }
  }, [])

  const switchLang = (l: Lang) => {
    setLang(l)
    setInput(DEFAULTS[l])
    setMode('beautify')
  }

  const output = useMemo<string>(() => {
    const tabWidth = indent === 'tab' ? 4 : Number(indent)
    const indentChar = indent === 'tab' ? '\t' : ' '
    const wrapLine = Number(wrap) || 0
    try {
      if (lang === 'json') {
        return mode === 'compact' ? jsonReport(input, 0) : jsonReport(input, 2)
      }
      if (lang === 'sql') {
        if (mode === 'compact') return compactSql(input)
        // sql-formatter is imported synchronously here via the warmed module;
        // to keep render sync, use the cached namespace.
        const sqlFormatter = sqlMod
        if (!sqlFormatter) return 'Loading the SQL engine…'
        return sqlFormatter.format(input, {
          language: dialect,
          tabWidth,
          useTabs: indent === 'tab',
          keywordCase,
        })
      }
      const b = jsbMod
      if (!b) return 'Loading the formatter engine…'
      if (lang === 'html') {
        return mode === 'compact'
          ? compactHtml(input)
          : b.html(input, { indent_size: tabWidth, indent_char: indentChar, wrap_line_length: wrapLine, preserve_newlines: true, max_preserve_newlines: 2 })
      }
      if (lang === 'css') {
        return mode === 'compact'
          ? compactCss(input)
          : b.css(input, { indent_size: tabWidth, indent_char: indentChar })
      }
      // JS — beautify only; minify is refused on ASI principle.
      return b.js(input, {
        indent_size: tabWidth,
        indent_char: indentChar,
        wrap_line_length: wrapLine,
        preserve_newlines: true,
        max_preserve_newlines: 2,
      })
    } catch (e) {
      return `✗ ${e instanceof Error ? e.message : 'The formatter choked on this input'}`
    }
  }, [lang, mode, input, indent, wrap, dialect, keywordCase])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* manual selection still possible */
    }
  }

  const download = () => {
    const ext = lang === 'json' ? 'json' : lang
    downloadBlob(new Blob([output], { type: 'text/plain' }), `formatted.${ext}`)
  }

  const kb = (s: string) => `${(new TextEncoder().encode(s).length / 1024).toFixed(1)} KB`

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Language">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={lang === l.id}
                onClick={() => switchLang(l.id)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                  lang === l.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {lang !== 'js' && (
              <div className="flex overflow-hidden rounded-full border" role="group" aria-label="Mode">
                {(['beautify', 'compact'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium transition-colors',
                      mode === m ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                    )}
                  >
                    {m === 'beautify' ? 'Beautify' : 'Compact'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* options row */}
        <div className="mt-3 flex flex-wrap items-end gap-3 text-xs">
          {lang !== 'json' && (
            <div className="space-y-1.5">
              <Label htmlFor="bf-indent" className="text-xs text-muted-foreground">Indent</Label>
              <select
                id="bf-indent"
                value={indent}
                onChange={(e) => setIndent(e.target.value as '2' | '4' | 'tab')}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="2">2 spaces</option>
                <option value="4">4 spaces</option>
                <option value="tab">Tab</option>
              </select>
            </div>
          )}
          {(lang === 'html' || lang === 'js') && mode === 'beautify' && (
            <div className="space-y-1.5">
              <Label htmlFor="bf-wrap" className="text-xs text-muted-foreground">Wrap width</Label>
              <select
                id="bf-wrap"
                value={wrap}
                onChange={(e) => setWrap(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="0">No wrap</option>
                <option value="80">80</option>
                <option value="120">120</option>
              </select>
            </div>
          )}
          {lang === 'sql' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="bf-dialect" className="text-xs text-muted-foreground">Dialect</Label>
                <select
                  id="bf-dialect"
                  value={dialect}
                  onChange={(e) => setDialect(e.target.value as (typeof SQL_DIALECTS)[number]['id'])}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  {SQL_DIALECTS.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>
              {mode === 'beautify' && (
                <div className="space-y-1.5">
                  <Label htmlFor="bf-case" className="text-xs text-muted-foreground">Keywords</Label>
                  <select
                    id="bf-case"
                    value={keywordCase}
                    onChange={(e) => setKeywordCase(e.target.value as 'upper' | 'lower' | 'preserve')}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="upper">UPPERCASE</option>
                    <option value="lower">lowercase</option>
                    <option value="preserve">As written</option>
                  </select>
                </div>
              )}
            </>
          )}
          {lang === 'js' && (
            <p className="max-w-md pb-1 text-xs leading-relaxed text-muted-foreground">
              JS ships a beautifier only. Whitespace-stripping minifiers break
              automatic-semicolon-insertion and can silently change what a program does — this page
              refuses to hand you that footgun. Use a real bundler (which parses first) to minify.
            </p>
          )}
          {lang === 'css' && mode === 'compact' && (
            <p className="max-w-md pb-1 text-xs leading-relaxed text-muted-foreground">
              Compact strips comments and newlines; spaces inside calc(), min(), max() and clamp()
              are preserved because removing them changes what the math means.
            </p>
          )}
          {lang === 'html' && mode === 'compact' && (
            <p className="max-w-md pb-1 text-xs leading-relaxed text-muted-foreground">
              Compact drops comments and inter-tag whitespace; the contents of pre, textarea,
              script and style stay byte-exact.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <Label htmlFor="bf-input" className="text-sm font-semibold">Input</Label>
            <button type="button" onClick={() => setInput('')} className="text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
          <textarea
            id="bf-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="mt-2 h-80 w-full resize-y rounded-md border bg-background p-3 font-mono text-[13px] leading-relaxed"
          />
          <p className="mt-2 text-xs text-muted-foreground">{kb(input)} in</p>
        </div>

        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Output</h2>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copy} disabled={!output || output.startsWith('✗') || output.startsWith('Loading')}>
                <Copy className="size-3.5" aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={download} disabled={!output || output.startsWith('✗')}>
                <Download className="size-3.5" aria-hidden="true" /> Save
              </Button>
            </div>
          </div>
          <pre
            className="mt-2 h-80 overflow-auto rounded-md border bg-background p-3 font-mono text-[13px] leading-relaxed"
            aria-label="Formatted output"
          >
            {output}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            {kb(output)} out · engines {enginesReady ? 'ready, running in this tab' : 'warming…'}
          </p>
        </div>
      </div>

      <PrivacyStrip detail="js-beautify and sql-formatter run inside this tab after a one-time load from the app bundle itself. Your code is never transmitted — paste a client's proprietary stylesheet and the network tab stays empty." />
    </div>
  )
}

// Cached engine namespaces — warmed on mount, then the render path stays
// synchronous (no flicker between "loading" and output on later keystrokes).
let jsbMod: Awaited<ReturnType<typeof loadBeautify>> | null = null
let sqlMod: Awaited<ReturnType<typeof loadSql>> | null = null

async function loadBeautify() {
  return import('js-beautify')
}
async function loadSql() {
  return import('sql-formatter')
}

// Hydrate the caches as early as possible (module scope, client only).
if (typeof window !== 'undefined') {
  void loadBeautify().then((m) => { jsbMod = m })
  void loadSql().then((m) => { sqlMod = m as typeof sqlMod })
}
