'use client'

// Lorem Text Studio — placeholder copy generated entirely in this tab.
// Two corpora (the classic Latin vocabulary and a plain-English wireframe
// filler), four shapes (paragraphs, sentences, words, bullet lists), and a
// seeded PRNG: the seed is hashed with xmur3 and drives mulberry32, so the
// SAME seed with the SAME settings always rebuilds the SAME text. A
// wireframe's filler survives refreshes and teammate reviews because of that
// determinism, not because anything is stored — there is no storage here.

import { useMemo, useState } from 'react'
import { Check, Copy, Dices } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip } from '@/components/instant/instant-kit'

// ------------------------------------------------------------------ corpora ---

// The classic Lorem Ipsum vocabulary: the words the standard filler text is
// actually built from (the lipsum.com corpus, de-duplicated, lower-case).
const LATIN_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et',
  'dolore', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis',
  'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex',
  'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit',
  'voluptate', 'velit', 'esse', 'cillum', 'eu', 'fugiat', 'nulla', 'pariatur',
  'excepteur', 'sint', 'occaecat', 'cupidatat', 'non', 'proident', 'sunt',
  'culpa', 'qui', 'officia', 'deserunt', 'mollit', 'anim', 'id', 'est',
  'laborum', 'curabitur', 'vestibulum', 'fusce', 'praesent', 'phasellus',
  'suspendisse', 'donec', 'integer', 'aenean', 'maecenas', 'aliquam',
  'vivamus', 'cras', 'pellentesque', 'nullam', 'morbi', 'nunc', 'quam',
  'orci', 'sapien', 'massa', 'nisl', 'turpis', 'lectus', 'augue', 'purus',
  'diam', 'felis', 'erat', 'libero', 'ligula', 'metus', 'malesuada',
  'fermentum', 'ultricies', 'hendrerit', 'condimentum', 'sollicitudin',
  'dignissim', 'tincidunt', 'volutpat', 'imperdiet', 'scelerisque',
  'elementum', 'porttitor', 'fringilla', 'lacinia', 'sagittis', 'dictum',
  'posuere', 'interdum', 'accumsan', 'facilisis', 'lobortis', 'pharetra',
  'vulputate', 'feugiat', 'bibendum', 'tortor', 'tellus', 'mattis', 'arcu',
  'vitae', 'sem', 'ante', 'justo', 'nibh', 'risus', 'natoque', 'penatibus',
  'magnis', 'dis', 'parturient', 'montes', 'nascetur', 'ridiculus', 'mus',
]

// Plain-English filler: neutral interface vocabulary that reads like real
// wireframe copy instead of Latin — for prototypes shown to non-Latinists.
const ENGLISH_WORDS = [
  'design', 'layout', 'content', 'section', 'header', 'footer', 'element',
  'component', 'column', 'grid', 'image', 'caption', 'button', 'label',
  'field', 'list', 'item', 'page', 'card', 'block', 'title', 'text', 'user',
  'sample', 'example', 'template', 'structure', 'detail', 'feature', 'option',
  'control', 'spacing', 'margin', 'padding', 'width', 'height', 'style',
  'theme', 'color', 'icon', 'badge', 'chart', 'table', 'row', 'cell', 'link',
  'menu', 'panel', 'tab', 'view', 'mode', 'draft', 'review', 'version',
  'update', 'note', 'summary', 'overview', 'metric', 'value', 'range',
  'filter', 'search', 'result', 'entry', 'record', 'message', 'notice',
  'status', 'state', 'action', 'step', 'flow', 'source', 'target', 'format',
  'output', 'input', 'data', 'file', 'name', 'mark', 'token', 'unit', 'scale',
  'size', 'shape', 'edge', 'corner', 'surface', 'layer', 'pattern', 'rule',
  'group', 'stack', 'series', 'preview', 'baseline', 'anchor', 'space',
]

type Corpus = 'latin' | 'english'
type Shape = 'paragraphs' | 'sentences' | 'words' | 'list'

const CORPUS_WORDS: Record<Corpus, string[]> = {
  latin: LATIN_WORDS,
  english: ENGLISH_WORDS,
}

const CORPUS_LABEL: Record<Corpus, string> = {
  latin: 'Classic Latin (Lorem ipsum)',
  english: 'Plain English (wireframe copy)',
}

// Conjunction banks keep sentences from reading as word lists. The Latin
// bank is the classical connectives; the English one its everyday equivalents.
const JOINERS: Record<Corpus, string[]> = {
  latin: ['et', 'sed', 'aut', 'ut', 'quod', 'nam'],
  english: ['and', 'but', 'with', 'when', 'while', 'because'],
}

const OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit'

interface UnitSpec {
  label: string
  min: number
  max: number
  def: number
}

const UNITS: Record<Shape, UnitSpec> = {
  paragraphs: { label: 'Paragraphs', min: 1, max: 50, def: 3 },
  sentences: { label: 'Sentences', min: 1, max: 100, def: 5 },
  words: { label: 'Words', min: 10, max: 2000, def: 100 },
  list: { label: 'List items', min: 3, max: 100, def: 8 },
}

// ------------------------------------------------------------------- rng -----

/** xmur3 string hash -> 32-bit seed function (the standard short hash). */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

/** mulberry32 — small, fast, well-distributed seeded PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Rng {
  next: () => number
  int: (maxExclusive: number) => number
  pick: <T>(arr: T[]) => T
}

function makeRng(seedText: string): Rng {
  const next = mulberry32(xmur3(seedText)())
  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    pick: <T,>(arr: T[]) => arr[Math.floor(next() * arr.length)],
  }
}

// ------------------------------------------------------------- generation ----

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** One sentence: 6–24 words with a mid comma in ~60% of cases, capitalized. */
function sentence(rng: Rng, corpus: Corpus): string {
  const words = CORPUS_WORDS[corpus]
  const joiners = JOINERS[corpus]
  const len = 6 + rng.int(19)
  const parts: string[] = []
  for (let i = 0; i < len; i++) {
    if (i > 1 && i < len - 2 && rng.next() < 0.1) {
      parts.push(rng.pick(joiners))
    } else {
      parts.push(words[rng.int(words.length)])
    }
  }
  const commaAt = rng.next() < 0.6 ? 2 + rng.int(Math.max(1, len - 4)) : -1
  if (commaAt > 0) {
    const before = parts.slice(0, commaAt).join(' ')
    const after = parts.slice(commaAt).join(' ')
    return capitalize(before) + ', ' + after + '.'
  }
  return capitalize(parts.join(' ')) + '.'
}

/** One paragraph of 3–7 sentences. */
function paragraph(rng: Rng, corpus: Corpus): string {
  const n = 3 + rng.int(5)
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(sentence(rng, corpus))
  return out.join(' ')
}

interface BuildResult {
  text: string
  words: number
  chars: number
  sentences: number
  paragraphs: number
}

function build(opts: {
  shape: Shape
  corpus: Corpus
  count: number
  seedText: string
  startClassic: boolean
  htmlMode: boolean
}): BuildResult {
  const { shape, corpus, count, seedText, startClassic, htmlMode } = opts
  const rng = makeRng(`${shape}|${corpus}|${count}|${startClassic}|${htmlMode}|${seedText}`)

  const paragraphs: string[] = []
  let sentencesTotal = 0

  if (shape === 'paragraphs') {
    for (let i = 0; i < count; i++) paragraphs.push(paragraph(rng, corpus))
  } else if (shape === 'sentences') {
    // Grouped five sentences per paragraph so the output wraps readably.
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(i / 5)
      if (!paragraphs[idx]) paragraphs[idx] = sentence(rng, corpus)
      else paragraphs[idx] += ' ' + sentence(rng, corpus)
    }
    sentencesTotal = count
  } else if (shape === 'words') {
    const parts: string[] = []
    for (let i = 0; i < count; i++) parts.push(CORPUS_WORDS[corpus][rng.int(CORPUS_WORDS[corpus].length)])
    paragraphs.push(parts.join(' '))
  } else {
    // Bullet list: each item is one short sentence.
    for (let i = 0; i < count; i++) paragraphs.push(sentence(rng, corpus))
  }

  // The classic opening — rewrites the front of the first paragraph when on.
  if (startClassic && paragraphs.length > 0 && shape !== 'list') {
    if (shape === 'words') {
      const rest = paragraphs[0].split(' ').slice(7)
      paragraphs[0] = OPENING + (rest.length ? ' ' + rest.join(' ') : '')
    } else {
      const restWords = paragraphs[0].replace(/[.]$/, '').split(' ').slice(7)
      paragraphs[0] = OPENING + (restWords.length ? ' ' + restWords.join(' ') : '') + '.'
    }
  }

  let text: string
  if (shape === 'list') {
    text = paragraphs.map((s) => `- ${s}`).join('\n')
  } else if (htmlMode) {
    text = paragraphs.map((p) => `<p>${p}</p>`).join('\n')
  } else {
    text = paragraphs.join('\n\n')
  }

  const plainWords = text
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length

  return {
    text,
    words: plainWords,
    chars: text.length,
    sentences: sentencesTotal,
    paragraphs: paragraphs.length,
  }
}

// -------------------------------------------------------------------- ui -----

function randomSeed(): string {
  // Readable, typable seed — enough entropy for filler text.
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}

export function LoremTool() {
  const [shape, setShape] = useState<Shape>('paragraphs')
  const [corpus, setCorpus] = useState<Corpus>('latin')
  const [count, setCount] = useState(UNITS.paragraphs.def)
  const [seedText, setSeedText] = useState('kontivo')
  const [startClassic, setStartClassic] = useState(true)
  const [htmlMode, setHtmlMode] = useState(false)
  const [copied, setCopied] = useState(false)

  const unit = UNITS[shape]
  const safeCount = Math.min(Math.max(count, unit.min), unit.max)

  const result = useMemo(
    () =>
      build({
        shape,
        corpus,
        count: safeCount,
        seedText,
        startClassic,
        htmlMode,
      }),
    [shape, corpus, safeCount, seedText, startClassic, htmlMode],
  )

  const roll = () => setSeedText(randomSeed())

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard refused — the textarea below is selectable by hand */
    }
  }

  return (
    <div className="space-y-4">
      {/* controls */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="lorem-shape">Generate</Label>
            <Select
              value={shape}
              onValueChange={(v) => {
                const next = v as Shape
                setShape(next)
                setCount(UNITS[next].def)
              }}
            >
              <SelectTrigger id="lorem-shape" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(UNITS) as Shape[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {UNITS[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lorem-corpus">Corpus</Label>
            <Select value={corpus} onValueChange={(v) => setCorpus(v as Corpus)}>
              <SelectTrigger id="lorem-corpus" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latin">{CORPUS_LABEL.latin}</SelectItem>
                <SelectItem value="english">{CORPUS_LABEL.english}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lorem-count">How many ({unit.min}–{unit.max})</Label>
            <Input
              id="lorem-count"
              type="number"
              min={unit.min}
              max={unit.max}
              value={count}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (!Number.isNaN(n)) setCount(Math.floor(n))
              }}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="lorem-seed">Seed</Label>
            <div className="flex gap-2">
              <Input
                id="lorem-seed"
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                className="font-mono text-sm"
              />
              <Button type="button" variant="outline" size="icon" aria-label="New random seed" onClick={roll}>
                <Dices className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <label className="flex items-center gap-2.5 pt-5 text-sm">
            <Switch checked={startClassic} onCheckedChange={setStartClassic} aria-label="Start with Lorem ipsum" />
            <span>Start with “Lorem ipsum dolor…”</span>
          </label>
          <label className="flex items-center gap-2.5 pt-5 text-sm">
            <Switch checked={htmlMode} onCheckedChange={setHtmlMode} aria-label="Wrap paragraphs in HTML" />
            <span>Wrap in &lt;p&gt; tags</span>
          </label>
        </div>
        <PrivacyStrip detail="Generated on this device from a seeded generator. The same seed with the same settings always rebuilds the same text — nothing is stored, nothing is sent anywhere." />
      </div>

      {/* output */}
      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            {result.words.toLocaleString()} words · {result.chars.toLocaleString()} chars
            {shape === 'paragraphs'
              ? ` · ${result.paragraphs} paragraph${result.paragraphs === 1 ? '' : 's'}`
              : ''}
            {shape === 'sentences' ? ` · ${result.sentences} sentences` : ''}
            {shape === 'list' ? ` · ${result.paragraphs} items` : ''}
          </span>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={roll}>
              <Dices className="size-3.5" aria-hidden="true" /> New seed
            </Button>
            <Button type="button" size="sm" onClick={copy}>
              {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy text'}
            </Button>
          </div>
        </div>
        <Textarea
          readOnly
          value={result.text}
          rows={12}
          className="min-h-[240px] resize-y rounded-none border-0 font-mono text-sm focus-visible:ring-0"
          aria-label="Generated placeholder text"
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
    </div>
  )
}
