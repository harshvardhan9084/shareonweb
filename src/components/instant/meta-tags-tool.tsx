'use client'

// Meta Tag Studio — build the <head> snippet a page needs for search and
// social, entirely on this device. Three live previews (search result, X
// card, Facebook/Open-Graph card) render from the same fields the snippet is
// generated from, and the emitted HTML is escaped so quotes and angle
// brackets in titles cannot break the tag structure. Ideal lengths are
// measured as you type: titles 50–60 characters, descriptions 120–158.

import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip } from '@/components/instant/instant-kit'

// ------------------------------------------------------------------ escape ---

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] || 'example.com'
  }
}

function pathOf(url: string): string {
  try {
    const u = new URL(url)
    return (u.host + u.pathname.replace(/\/$/, ''))
  } catch {
    return url
  }
}

// -------------------------------------------------------------------- ui -----

function LengthHint({ text, ideal, max }: { text: string; ideal: [number, number]; max: number }) {
  const n = text.length
  const tone =
    n === 0
      ? 'text-muted-foreground'
      : n > max
        ? 'text-destructive'
        : n >= ideal[0] && n <= ideal[1]
          ? 'text-primary'
          : 'text-muted-foreground'
  const note =
    n === 0
      ? 'empty'
      : n > max
        ? `${n - max} over the limit`
        : n < ideal[0]
          ? `${ideal[0] - n} below the sweet spot`
          : n > ideal[1]
            ? `${n - ideal[1]} past the sweet spot`
            : 'in the sweet spot'
  return (
    <span className={`text-xs ${tone}`}>
      {n}/{max} · {note}
    </span>
  )
}

function SerpPreview({ title, url, description }: { title: string; url: string; description: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">Search result preview</p>
      <div className="mt-3">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full border bg-muted text-[10px] font-semibold">
            {hostOf(url).charAt(0).toUpperCase() || 'E'}
          </span>
          <div>
            <p className="text-xs leading-tight">{hostOf(url)}</p>
            <p className="text-[11px] leading-tight text-muted-foreground">{pathOf(url) || 'https://example.com'}</p>
          </div>
        </div>
        <p className="mt-1.5 line-clamp-1 text-[15px] leading-snug text-primary underline decoration-primary/40">
          {title || 'Your page title appears here'}
        </p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
          {description || 'Your meta description appears here, clamped to about two lines exactly like a search engine does.'}
        </p>
      </div>
    </div>
  )
}

function SocialCard({ title, description, url, image, variant }: {
  title: string
  description: string
  url: string
  image: string
  variant: 'x' | 'fb'
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">
        {variant === 'x' ? 'X card preview (summary_large_image)' : 'Open Graph card preview (Facebook, LinkedIn, Slack)'}
      </p>
      <div className="mt-3 overflow-hidden rounded-xl border">
        <div
          className="flex h-40 items-center justify-center bg-muted"
          style={image ? undefined : { background: 'repeating-linear-gradient(45deg, transparent 0 12px, oklch(0.95 0.01 163) 12px 24px)' }}
        >
          {image ? (
            <img src={image} alt="Preview of the social image" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <span className="text-xs text-muted-foreground">no image URL set</span>
          )}
        </div>
        <div className="border-t p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{hostOf(url)}</p>
          <p className="mt-0.5 line-clamp-1 text-sm font-semibold">{title || 'Your page title appears here'}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{description || 'Your description appears here.'}</p>
        </div>
      </div>
    </div>
  )
}

const DEFAULTS = {
  title: '',
  description: '',
  url: '',
  siteName: '',
  image: '',
  ogType: 'website',
  cardType: 'summary_large_image',
  locale: 'en_US',
  robots: 'index, follow',
  themeColor: '',
}

export function MetaTagsTool() {
  const [form, setForm] = useState(DEFAULTS)
  const [copied, setCopied] = useState(false)

  const set = (k: keyof typeof DEFAULTS) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const snippet = useMemo(() => {
    const lines: string[] = []
    if (form.title) lines.push(`<title>${esc(form.title)}</title>`)
    if (form.description) lines.push(`<meta name="description" content="${esc(form.description)}" />`)
    if (form.url) lines.push(`<link rel="canonical" href="${esc(form.url)}" />`)
    if (form.robots) lines.push(`<meta name="robots" content="${esc(form.robots)}" />`)
    if (form.themeColor) lines.push(`<meta name="theme-color" content="${esc(form.themeColor)}" />`)
    lines.push('')
    if (form.title) lines.push(`<meta property="og:title" content="${esc(form.title)}" />`)
    if (form.description) lines.push(`<meta property="og:description" content="${esc(form.description)}" />`)
    if (form.url) lines.push(`<meta property="og:url" content="${esc(form.url)}" />`)
    if (form.image) lines.push(`<meta property="og:image" content="${esc(form.image)}" />`)
    lines.push(`<meta property="og:type" content="${esc(form.ogType)}" />`)
    if (form.siteName) lines.push(`<meta property="og:site_name" content="${esc(form.siteName)}" />`)
    lines.push(`<meta property="og:locale" content="${esc(form.locale)}" />`)
    lines.push('')
    lines.push(`<meta name="twitter:card" content="${esc(form.cardType)}" />`)
    if (form.title) lines.push(`<meta name="twitter:title" content="${esc(form.title)}" />`)
    if (form.description) lines.push(`<meta name="twitter:description" content="${esc(form.description)}" />`)
    if (form.image) lines.push(`<meta name="twitter:image" content="${esc(form.image)}" />`)
    return lines.join('\n')
  }, [form])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard refused */
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* form */}
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="mt-title">Page title</Label>
                <LengthHint text={form.title} ideal={[50, 60]} max={70} />
              </div>
              <Input id="mt-title" value={form.title} onChange={set('title')} placeholder="How to brew better coffee at home" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="mt-desc">Meta description</Label>
                <LengthHint text={form.description} ideal={[120, 158]} max={165} />
              </div>
              <Textarea id="mt-desc" value={form.description} onChange={set('description')} rows={3} placeholder="One honest sentence about the page, in the words a searcher would use." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mt-url">Canonical URL</Label>
                <Input id="mt-url" value={form.url} onChange={set('url')} placeholder="https://example.com/guides/coffee" className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mt-site">Site name</Label>
                <Input id="mt-site" value={form.siteName} onChange={set('siteName')} placeholder="The Morning Ledger" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-image">Social image URL (1200×630 works everywhere)</Label>
              <Input id="mt-image" value={form.image} onChange={set('image')} placeholder="https://example.com/og/coffee.png" className="font-mono text-sm" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="mt-ogtype">og:type</Label>
                <Select value={form.ogType} onValueChange={(v) => setForm((p) => ({ ...p, ogType: v }))}>
                  <SelectTrigger id="mt-ogtype" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">website</SelectItem>
                    <SelectItem value="article">article</SelectItem>
                    <SelectItem value="product">product</SelectItem>
                    <SelectItem value="video.other">video.other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mt-card">X card</Label>
                <Select value={form.cardType} onValueChange={(v) => setForm((p) => ({ ...p, cardType: v }))}>
                  <SelectTrigger id="mt-card" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">summary</SelectItem>
                    <SelectItem value="summary_large_image">summary_large_image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mt-locale">Locale</Label>
                <Select value={form.locale} onValueChange={(v) => setForm((p) => ({ ...p, locale: v }))}>
                  <SelectTrigger id="mt-locale" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en_US">en_US</SelectItem>
                    <SelectItem value="en_GB">en_GB</SelectItem>
                    <SelectItem value="de_DE">de_DE</SelectItem>
                    <SelectItem value="fr_FR">fr_FR</SelectItem>
                    <SelectItem value="es_ES">es_ES</SelectItem>
                    <SelectItem value="hi_IN">hi_IN</SelectItem>
                    <SelectItem value="ja_JP">ja_JP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mt-robots">Robots</Label>
                <Select value={form.robots} onValueChange={(v) => setForm((p) => ({ ...p, robots: v }))}>
                  <SelectTrigger id="mt-robots" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="index, follow">index, follow</SelectItem>
                    <SelectItem value="noindex, follow">noindex, follow</SelectItem>
                    <SelectItem value="index, nofollow">index, nofollow</SelectItem>
                    <SelectItem value="noindex, nofollow">noindex, nofollow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mt-theme">Theme color</Label>
                <Input id="mt-theme" type="color" value={form.themeColor || '#0d9488'} onChange={set('themeColor')} className="h-9 w-20 cursor-pointer p-1" />
              </div>
            </div>
          </div>
          <PrivacyStrip detail="Everything happens in this tab: the previews render from your own fields and the snippet is generated locally. Nothing is fetched from a crawler or sent anywhere." />
        </div>

        {/* previews */}
        <div className="space-y-4">
          <SerpPreview title={form.title} url={form.url} description={form.description} />
          <SocialCard variant="x" title={form.title} description={form.description} url={form.url} image={form.image} />
          <SocialCard variant="fb" title={form.title} description={form.description} url={form.url} image={form.image} />
        </div>
      </div>

      {/* output */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">Paste into your page’s &lt;head&gt;</span>
          <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={copy}>
            {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy snippet'}
          </Button>
        </div>
        <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed" aria-label="Generated meta tags">
          {snippet}
        </pre>
      </div>
    </div>
  )
}
