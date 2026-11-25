'use client'

// Keyword density + readability analyzer — tokenizer, stoplist, Flesch
// reading ease and Flesch–Kincaid grade level, all computed live in page
// memory as you type. Everything below is deterministic: same text, same
// numbers, every run.

import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip } from '@/components/instant/instant-kit'

// ---------------------------------------------------------------------------
// Tokenization
//
// Unicode-aware token regex: letters and numbers, plus apostrophes (straight
// ' and curly ') and hyphens *inside* words, so "don't" and "well-known" stay
// single tokens. Lowercasing happens before matching.
//
// DECISION on apostrophe-clitics (don't vs the stoplist's "don"/"t"): for
// COUNTING, contractions are one word — "don't" is never split into "don"+"t".
// For the STOPWORD FILTER, a token is hidden if the token itself is in the
// list OR every fragment left after splitting on apostrophes is listed, so
// "don't" → "don"+"t" → hidden, while "king's" → "king"+"s" → kept (because
// "king" is not a stopword). Possessives survive; pure contractions don't.
// ---------------------------------------------------------------------------
const TOKEN_RE = /[\p{L}\p{N}'’-]+/gu

// Built-in English stoplist (~80 of the most common function words). The list
// includes the fragments "s", "t" and "don" so the clitic rule above can
// match contractions. The toggle that uses this list is OFF by default.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'with', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'this',
  'that', 'these', 'those', 'as', 'by', 'from', 'i', 'you', 'he', 'she',
  'we', 'they', 'them', 'his', 'her', 'my', 'your', 'our', 'their', 'not',
  'no', 'so', 'if', 'then', 'than', 'too', 'very', 'can', 'will', 'just',
  'do', 'does', 'did', 'have', 'has', 'had', 'what', 'which', 'who', 'whom',
  'how', 'when', 'where', 'why', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'only', 'own', 'same', 's', 't', 'don',
  'now',
])

function isStopword(token: string): boolean {
  if (STOPWORDS.has(token)) return true
  const fragments = token.split(/['’]/).filter((f) => f !== '')
  return fragments.length > 1 && fragments.every((f) => STOPWORDS.has(f))
}

// ---------------------------------------------------------------------------
// Syllable heuristic: count vowel GROUPS ([aeiouy]+ runs) per word, subtract
// one for a trailing silent 'e' (unless the word ends in 'le'), minimum 1.
// Digits-only tokens have no vowels to group — they count as one syllable.
// ---------------------------------------------------------------------------
function countSyllables(rawToken: string): number {
  const w = rawToken.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 1
  let groups = w.match(/[aeiouy]+/g)?.length ?? 0
  if (w.endsWith('e') && !w.endsWith('le') && groups > 1) groups -= 1
  return Math.max(1, groups)
}

// Sentences: split on runs of . ! ? followed by whitespace or the end of the
// text, then drop empty segments. Text with no terminal punctuation at all
// naturally yields a single segment — the whole text as one sentence — and
// the UI says so.
function countSentences(text: string): { sentences: string[]; hasPunctuation: boolean } {
  const segments = text
    .split(/[.!?]+(?:\s+|$)/)
    .map((s) => s.trim())
    .filter((s) => s !== '')
  return { sentences: segments, hasPunctuation: /[.!?]/.test(text) }
}

function fleschLabel(score: number): string {
  if (score > 100) return 'Very easy'
  if (score < 0) return 'Very difficult'
  if (score >= 90) return 'Very easy'
  if (score >= 80) return 'Easy'
  if (score >= 70) return 'Fairly easy'
  if (score >= 60) return 'Plain English'
  if (score >= 50) return 'Fairly difficult'
  if (score >= 30) return 'Difficult'
  return 'Very difficult'
}

function readingTime(words: number): string {
  if (words === 0) return '—'
  const seconds = (words / 200) * 60
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`
  return `${(seconds / 60).toFixed(1)} min`
}

// Sample prose about writing clearly — 70 words, 5 sentences.
const SAMPLE =
  'Clear writing is a habit, not a gift. Start with a short sentence that states the point, then add the detail that proves it. Cut every word that does real work somewhere else; most drafts lose a third of their length this way. Read the result aloud, because your ear catches the clunky phrases your eye forgives. If a paragraph still feels heavy, split it and let the ideas breathe.'

interface TableRowData {
  word: string
  count: number
  density: string
}

export function WordFrequencyTool() {
  const [text, setText] = useState(SAMPLE)
  const [hideStopwords, setHideStopwords] = useState(false)

  const analysis = useMemo(() => {
    const tokens = text.toLowerCase().match(TOKEN_RE) ?? []
    const words = tokens.length
    const counts = new Map<string, number>()
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1)
    const syllables = tokens.reduce((sum, t) => sum + countSyllables(t), 0)
    const { sentences, hasPunctuation } = countSentences(text)
    const sentenceCount = sentences.length

    const rows: TableRowData[] = Array.from(counts.entries())
      .filter(([word]) => word.length >= 2 && (!hideStopwords || !isStopword(word)))
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .slice(0, 20)
      .map(([word, count]) => ({
        word,
        count,
        density: words > 0 ? ((count / words) * 100).toFixed(1) : '0.0',
      }))

    const readable = words > 0 && sentenceCount > 0
    const flesch = readable
      ? 206.835 - 1.015 * (words / sentenceCount) - 84.6 * (syllables / words)
      : null
    const kincaid = readable
      ? 0.39 * (words / sentenceCount) + 11.8 * (syllables / words) - 15.59
      : null

    return {
      words,
      unique: counts.size,
      sentenceCount,
      hasPunctuation,
      hasText: text.trim() !== '',
      avgSentence: readable ? (words / sentenceCount).toFixed(1) : '—',
      reading: readingTime(words),
      rows,
      flesch,
      kincaid,
    }
  }, [text, hideStopwords])

  const { flesch } = analysis

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="wf-input">Your text</Label>
        <Textarea
          id="wf-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text…"
          className="mt-1.5 min-h-40"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs text-muted-foreground">Words</p>
          <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums">{analysis.words}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs text-muted-foreground">Unique words</p>
          <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums">{analysis.unique}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs text-muted-foreground">Sentences</p>
          <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums">{analysis.sentenceCount}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs text-muted-foreground">Avg words / sentence</p>
          <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums">{analysis.avgSentence}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs text-muted-foreground">Reading time (200 wpm)</p>
          <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums">{analysis.reading}</p>
        </div>
      </div>

      {analysis.hasText && !analysis.hasPunctuation && (
        <p className="text-xs text-amber-600 dark:text-amber-500" role="note">
          No ending punctuation found — the whole text is counted as one sentence.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Default OFF: everything is shown until the reader asks to hide it. */}
        <Switch
          id="wf-stop"
          checked={hideStopwords}
          onCheckedChange={setHideStopwords}
          aria-label="Hide common words"
        />
        <Label htmlFor="wf-stop" className="text-sm font-normal">
          Hide common words
        </Label>
        <span className="text-xs text-muted-foreground">
          filters a built-in list of ~80 English function words (the, a, of, to, …)
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <BarChart3 className="size-4 text-muted-foreground" aria-hidden="true" />
            Keyword density
          </p>
          <Table data-testid="wf-table">
            <TableHeader>
              <TableRow>
                <TableHead>Word</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Density %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                    {analysis.hasText
                      ? 'No words long enough to list — single letters are skipped.'
                      : 'Type or paste text to see the table.'}
                  </TableCell>
                </TableRow>
              ) : (
                analysis.rows.map((row) => (
                  <TableRow key={row.word}>
                    <TableCell className="font-mono text-sm">{row.word}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.density}%</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Density is each word&rsquo;s share of all {analysis.words} words, to one decimal. The list shows the top
            20 words of two letters or more; ties are ordered alphabetically.
          </p>
        </div>

        <div className="space-y-3">
          <div data-testid="flesch-score" className="rounded-lg border bg-background p-4" aria-live="polite">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs text-muted-foreground">Flesch reading ease</p>
              {flesch !== null && <Badge variant="secondary">{fleschLabel(flesch)}</Badge>}
            </div>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
              {flesch === null ? '—' : flesch.toFixed(1)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              206.835 − 1.015 × (words/sentence) − 84.6 × (syllables/word). Bins: 90+ very easy, 80–89 easy,
              70–79 fairly easy, 60–69 plain English, 50–59 fairly difficult, 30–49 difficult, below 30 very
              difficult.
            </p>
            {flesch !== null && flesch > 100 && (
              <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-500">
                Above the standard 0–100 scale — the label reads Very easy; the raw score is kept as computed.
              </p>
            )}
            {flesch !== null && flesch < 0 && (
              <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                Below the 0–100 scale — the label reads Very difficult; the raw score is kept as computed.
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-background p-4">
            <p className="text-xs text-muted-foreground">Flesch–Kincaid grade level</p>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
              {analysis.kincaid === null ? '—' : analysis.kincaid.toFixed(1)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              0.39 × (words/sentence) + 11.8 × (syllables/word) − 15.59 — roughly the US school grade that can read
              the text.
              {analysis.kincaid !== null && analysis.kincaid < 0 && ' Negative values mean below grade 1.'}
            </p>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Syllables come from a vowel-group heuristic (silent-e rule, minimum one), not a dictionary — treat the
            scores as approximations, especially on short texts.
          </p>
        </div>
      </div>

      <PrivacyStrip detail="The analysis runs in this tab as you type — the text is never stored between visits and never sent anywhere." />
    </div>
  )
}
