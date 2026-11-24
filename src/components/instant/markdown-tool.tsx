'use client'

// Markdown Studio — editor + live preview powered by a built-in rendering
// engine (headings, emphasis, strike, code, links, images, quotes, rules,
// nested lists, GFM tables). Raw HTML is escaped by default — pasted
// <script> renders as text — with an explicit allow-HTML switch. Exports:
// standalone styled HTML, HTML fragment, or the .md source. Everything
// renders in this tab.

import { useCallback, useMemo, useState } from 'react'
import { Check, Copy, Download, Table } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { downloadBlob } from '@/components/instant/instant-kit'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

const SAMPLE = `# Project Notes

A **live** Markdown workbench — edit on the left, read on the right.

## What it renders

- Headings, *emphasis*, **bold**, ~~strikethrough~~ and \`inline code\`
- Nested lists:
  1. Ordered items
     - With sub-points
  2. And more
- GFM tables with alignment:

| Feature | Status | Notes |
| --- | :---: | ---: |
| Tables | done | aligned |
| Export | done | HTML + MD |

> Blockquotes hold the caveats.

    \`\`\`js
    console.log('fenced code, with a language label')
    \`\`\`

[Links work](https://example.com), raw HTML like <script>alert(1)</script> is
**escaped** by default — flip the switch only when you mean it.

---

Words, characters and lines update live below the editor.`

const STANDALONE_CSS = `:root { color-scheme: light dark; }
body { margin: 0 auto; padding: 48px 24px; max-width: 72ch; font: 16px/1.65 -apple-system, "Segoe UI", "Hanken Grotesk", system-ui, sans-serif; color: #1a1a1a; background: #fbfdfc; }
h1, h2, h3, h4, h5, h6 { line-height: 1.2; margin: 1.6em 0 0.6em; }
h1 { font-size: 2.2em; margin-top: 0; }
code, pre { font-family: "Cascadia Code", Consolas, "Courier New", monospace; font-size: 0.9em; }
code { background: rgba(15, 118, 110, 0.08); padding: 0.15em 0.35em; border-radius: 4px; }
pre { background: rgba(15, 118, 110, 0.06); padding: 16px; border-radius: 8px; overflow: auto; }
pre code { background: none; padding: 0; }
blockquote { margin: 1em 0; padding: 0.2em 1em; border-left: 3px solid rgba(15, 118, 110, 0.5); color: #444; }
table { border-collapse: collapse; margin: 1em 0; }
th, td { border: 1px solid #d8ddd9; padding: 6px 12px; }
th { background: rgba(15, 118, 110, 0.07); }
hr { border: 0; border-top: 1px solid #d8ddd9; margin: 2em 0; }
img { max-width: 100%; }`

// ---------------------------------------------------------------- rendering

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function safeUrl(url: string): string {
  const trimmed = url.trim()
  if (/^(https?:|mailto:|\/|#|\.\/)/i.test(trimmed) && !/^javascript:/i.test(trimmed)) return trimmed
  return '#'
}

/** Inline syntax → HTML. Input is raw text; escaping happens here first. */
function renderInline(src: string, allowHtml: boolean): string {
  let s = allowHtml ? src : escapeHtml(src)
  // protect inline code first so emphasis inside code never applies
  const codes: string[] = []
  s = s.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(c)
    return `\u0000${codes.length - 1}\u0000`
  })
  // images before links (the ! prefix distinguishes them)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, alt: string, url: string) =>
    `<img src="${escapeHtml(safeUrl(url))}" alt="${alt}" loading="lazy">`)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, label: string, url: string) =>
    `<a href="${escapeHtml(safeUrl(url))}" rel="noopener">${label}</a>`)
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  s = s.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1<em>$2</em>')
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => `<code>${allowHtml ? codes[Number(i)] : escapeHtml(codes[Number(i)])}</code>`)
  return s
}

function renderTableRow(line: string): string[] {
  return line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
}

function tableAlignment(delim: string[]): Array<'left' | 'center' | 'right'> {
  return delim.map((d) => {
    const t = d.trim()
    if (t.startsWith(':') && t.endsWith(':')) return 'center'
    if (t.endsWith(':')) return 'right'
    return 'left'
  })
}

function alignAttr(a: 'left' | 'center' | 'right'): string {
  return a === 'left' ? '' : ` style="text-align:${a}"`
}

/** The block-level renderer. Returns an HTML fragment. */
export function renderMarkdown(src: string, allowHtml: boolean): string {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  let para: string[] = []
  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${renderInline(para.join('\n'), allowHtml).replace(/\n/g, '<br>')}</p>`)
      para = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // fenced code
    const fence = line.match(/^\s*```\s*(\w*)\s*$/)
    if (fence) {
      flushPara()
      const lang = fence[1]
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i])
        i++
      }
      i++ // skip the closing fence
      out.push(
        `<pre${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><code>${allowHtml ? body.join('\n') : escapeHtml(body.join('\n'))}</code></pre>`,
      )
      continue
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      flushPara()
      const level = h[1].length
      out.push(`<h${level}>${renderInline(h[2], allowHtml)}</h${level}>`)
      i++
      continue
    }

    // horizontal rule
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      flushPara()
      out.push('<hr>')
      i++
      continue
    }

    // blockquote (consecutive > lines)
    if (/^\s*>\s?/.test(line)) {
      flushPara()
      const quote: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      out.push(`<blockquote>${renderMarkdown(quote.join('\n'), allowHtml)}</blockquote>`)
      continue
    }

    // table: header row + delimiter row
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) &&
      lines[i + 1].includes('-')
    ) {
      flushPara()
      const headers = renderTableRow(line.trim())
      const aligns = tableAlignment(renderTableRow(lines[i + 1].trim()))
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(renderTableRow(lines[i].trim()))
        i++
      }
      const head = headers.map((c, ci) => `<th${alignAttr(aligns[ci] ?? 'left')}>${renderInline(c, allowHtml)}</th>`).join('')
      const body = rows
        .map((r) => `<tr>${r.map((c, ci) => `<td${alignAttr(aligns[ci] ?? 'left')}>${renderInline(c, allowHtml)}</td>`).join('')}</tr>`)
        .join('')
      out.push(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`)
      continue
    }

    // lists (ul/ol, nested by 2-space indentation)
    const listItem = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
    if (listItem) {
      flushPara()
      const stack: Array<{ tag: 'ul' | 'ol'; indent: number }> = []
      const items: string[] = []
      const closeTo = (indent: number) => {
        while (stack.length && stack[stack.length - 1].indent >= indent) {
          items.push(`</${stack.pop()!.tag}>`)
        }
      }
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
        if (!m) {
          // a lazy continuation line joins the last open item
          if (/\S/.test(lines[i]) && !/^\s*$/.test(lines[i]) && stack.length && items.length) {
            items[items.length - 1] = items[items.length - 1].replace(/<\/li>$/, `<br>${renderInline(lines[i].trim(), allowHtml)}</li>`)
            i++
            continue
          }
          break
        }
        const indent = m[1].replace(/\t/g, '  ').length
        const tag: 'ul' | 'ol' = /\d+\./.test(m[2]) ? 'ol' : 'ul'
        if (!stack.length || indent > stack[stack.length - 1].indent) {
          stack.push({ tag, indent })
          items.push(`<${tag}>`)
        } else {
          closeTo(indent)
          if (!stack.length || stack[stack.length - 1].tag !== tag) {
            closeTo(0)
            stack.push({ tag, indent })
            items.push(`<${tag}>`)
          }
        }
        items.push(`<li>${renderMarkdownInlineBlock(m[3], allowHtml)}</li>`)
        i++
      }
      closeTo(0)
      out.push(items.join(''))
      continue
    }

    // blank line closes a paragraph
    if (/^\s*$/.test(line)) {
      flushPara()
      i++
      continue
    }

    // allow-HTML: a line that starts a block tag passes through verbatim
    if (allowHtml && /^\s*<[a-zA-Z][^>]*>/.test(line)) {
      flushPara()
      out.push(line.trim())
      i++
      continue
    }

    para.push(line)
    i++
  }
  flushPara()
  return out.join('\n')
}

/** Inline-only wrapper for list items (no <p> inside <li>). */
function renderMarkdownInlineBlock(src: string, allowHtml: boolean): string {
  return renderInline(src.trim(), allowHtml)
}

// ------------------------------------------------------------------ exports

function standaloneDoc(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Document</title>
<style>
${STANDALONE_CSS}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`
}

// ---------------------------------------------------------------- component

export function MarkdownTool() {
  const [text, setText] = useState(SAMPLE)
  const [allowHtml, setAllowHtml] = useState(false)
  const [copied, setCopied] = useState('')
  const [tableRows, setTableRows] = useState('3')
  const [tableCols, setTableCols] = useState('3')

  const html = useMemo(() => renderMarkdown(text, allowHtml), [text, allowHtml])

  const stats = useMemo(() => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    return { words, chars: text.length, lines: text.split('\n').length }
  }, [text])

  const table = useMemo(() => {
    const r = Math.max(1, Math.min(20, Number(tableRows) || 3))
    const c = Math.max(1, Math.min(10, Number(tableCols) || 3))
    const header = Array.from({ length: c }, (_, i) => `Column ${i + 1}`)
    const delim = header.map(() => '---')
    const body = Array.from({ length: r }, (_, ri) => header.map((_, ci) => `R${ri + 1}C${ci + 1}`))
    return [
      `| ${header.join(' | ')} |`,
      `| ${delim.join(' | ')} |`,
      ...body.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n')
  }, [tableRows, tableCols])

  const copy = useCallback(async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(what)
      setTimeout(() => setCopied(''), 1400)
    } catch {
      /* manual selection still possible */
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={allowHtml} onChange={(e) => setAllowHtml(e.target.checked)} className="size-4 accent-[var(--primary)]" aria-label="Allow raw HTML" />
            <span>Allow raw HTML</span>
            <span className="text-xs text-muted-foreground">(off = pasted tags render as text)</span>
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => copy(text, 'md')}>
              <Copy className="size-3.5" aria-hidden="true" /> {copied === 'md' ? 'Copied' : 'Copy .md'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadBlob(new Blob([text], { type: 'text/markdown' }), 'document.md')}>
              <Download className="size-3.5" aria-hidden="true" /> .md
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadBlob(new Blob([html], { type: 'text/html' }), 'document.html')}>
              <Download className="size-3.5" aria-hidden="true" /> HTML
            </Button>
            <Button type="button" size="sm" onClick={() => downloadBlob(new Blob([standaloneDoc(html)], { type: 'text/html' }), 'document-standalone.html')}>
              <Download className="size-3.5" aria-hidden="true" /> Standalone HTML
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <Label htmlFor="md-editor" className="text-xs text-muted-foreground">Markdown</Label>
            <textarea
              id="md-editor"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              className="mt-1.5 h-96 w-full resize-y rounded-lg border bg-background p-3.5 font-mono text-[13px] leading-relaxed"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {stats.words} words · {stats.chars} characters · {stats.lines} lines
            </p>
          </div>
          <div>
            <Label htmlFor="md-preview" className="text-xs text-muted-foreground">Preview</Label>
            <div
              id="md-preview"
              className="md-preview mt-1.5 h-96 overflow-auto rounded-lg border bg-background p-4 text-[15px] leading-relaxed [&_blockquote]:border-l-[3px] [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-primary/10 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:mb-3 [&_h1]:mt-0 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-semibold [&_hr]:my-4 [&_hr]:border-border [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[13px] [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:text-sm [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_ul]:list-disc [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>

      {/* table generator */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Table className="size-4 text-primary" aria-hidden="true" /> Table generator
        </h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-24 space-y-1.5">
            <Label htmlFor="md-rows" className="text-xs text-muted-foreground">Rows</Label>
            <Input id="md-rows" type="number" min={1} max={20} value={tableRows} onChange={(e) => setTableRows(e.target.value)} className="font-mono" />
          </div>
          <div className="w-24 space-y-1.5">
            <Label htmlFor="md-cols" className="text-xs text-muted-foreground">Columns</Label>
            <Input id="md-cols" type="number" min={1} max={10} value={tableCols} onChange={(e) => setTableCols(e.target.value)} className="font-mono" />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setText((t) => `${t.trimEnd()}\n\n${table}\n`)}>
            Insert into the editor
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => copy(table, 'table')}>
            <Copy className="size-3.5" aria-hidden="true" /> {copied === 'table' ? 'Copied' : 'Copy table'}
          </Button>
        </div>
        <pre className="mt-3 overflow-auto rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed">{table}</pre>
      </div>

      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground sm:p-5">
        <p className="font-medium text-foreground">Why raw HTML is off by default</p>
        <p className="mt-2 leading-relaxed">
          A Markdown tool is where people paste text they did not write — issue bodies, chat logs,
          AI drafts. Rendering that text with live HTML would execute whatever a stranger embedded.
          With the switch off, every tag is escaped and shown as the text it is; turn it on only for
          documents you wrote yourself, and the URL guard still refuses javascript: links.
        </p>
      </div>

      <PrivacyStrip detail="The renderer, the table generator and the exports all run inside this tab. Your document is never transmitted or stored — close the tab and it exists only in your editor's undo history." />
    </div>
  )
}
