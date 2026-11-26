'use client'

// Resume Builder — a fully local, single-file instant tool. A realistic sample
// resume (Priya Sharma, product analyst) is on screen as a live A4 sheet in the
// first viewport, next to a sectioned editor: header + extra contact rows,
// summary, experience entries with 1–8 reorderable bullets, education, skills
// as chips and projects. Three themes (classic serif, modern sans, compact)
// and four print-safe accents are applied to the preview only, through CSS
// variables scoped to the sheet. The draft autosaves to localStorage
// (debounced, quota-guarded); printing isolates the sheet via a portal print
// root plus a body class set in the click handler and the beforeprint event;
// an HTML export writes a self-contained printable document from the same
// sheet model. Nothing ever leaves this tab.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Download,
  Eye,
  Maximize2,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip, downloadBlob } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

// ------------------------------------------------------------------- types

type ThemeId = 'classic' | 'modern' | 'compact'
type AccentId = 'emerald' | 'amber' | 'rose' | 'violet'

interface ContactRow {
  label: string
  value: string
}

interface ExperienceEntry {
  role: string
  company: string
  location: string
  start: string
  end: string
  bullets: string[]
}

interface EducationEntry {
  degree: string
  school: string
  years: string
  note: string
}

interface ProjectEntry {
  name: string
  link: string
  description: string
}

interface ResumeDraft {
  name: string
  headline: string
  location: string
  email: string
  phone: string
  website: string
  extraContacts: ContactRow[]
  summary: string
  experience: ExperienceEntry[]
  education: EducationEntry[]
  skills: string
  projects: ProjectEntry[]
  theme: ThemeId
  accent: AccentId
}

interface SheetModel {
  name: string
  headline: string
  contact: string[]
  summary: string
  experience: Array<{ role: string; org: string; dates: string; bullets: string[] }>
  education: Array<{ degree: string; school: string; dates: string; note: string }>
  skills: string[]
  projects: Array<{ name: string; link: string; description: string }>
}

type SaveStatus = {
  kind: 'idle' | 'saved' | 'restored' | 'error'
  time?: string
  message?: string
}

// --------------------------------------------------------------- constants

const STORAGE_KEY = 'kontivo-resume-draft'
const PRINT_CLASS = 'kontivo-printing-resume'
const PRINT_ROOT_ID = 'kontivo-resume-print-root'
const SUMMARY_SOFT_MAX = 600
const BULLET_SOFT_MAX = 140
const MAX_BULLETS = 8
const ATS_HINT = 'Single column, standard headings, real text — parsers can read this.'

/** Stable no-op subscription backing the hydration check below. */
const subscribeNoop = () => () => {}

const THEMES: Array<{ id: ThemeId; label: string }> = [
  { id: 'classic', label: 'Classic serif' },
  { id: 'modern', label: 'Modern sans' },
  { id: 'compact', label: 'Compact' },
]

/** Print-legible shades on white paper — all from the allowed palette. */
const ACCENTS: Array<{ id: AccentId; label: string; hex: string }> = [
  { id: 'emerald', label: 'Emerald', hex: '#047857' },
  { id: 'amber', label: 'Amber', hex: '#b45309' },
  { id: 'rose', label: 'Rose', hex: '#be123c' },
  { id: 'violet', label: 'Violet', hex: '#6d28d9' },
]

function accentHex(id: AccentId): string {
  return ACCENTS.find((a) => a.id === id)?.hex ?? ACCENTS[0].hex
}

// A4 geometry: the sheet is authored in real millimetres; the preview measures
// its container in an effect and scales with a transform (never during render).
const MM_TO_PX = 96 / 25.4
const A4_W_PX = 210 * MM_TO_PX
const A4_H_PX = 297 * MM_TO_PX

const SAMPLE_DRAFT: ResumeDraft = {
  name: 'Priya Sharma',
  headline: 'Product Analyst',
  location: 'Bengaluru, India',
  email: 'priya.sharma@example.com',
  phone: '+91 98450 12345',
  website: 'priyasharma.dev',
  extraContacts: [{ label: 'LinkedIn', value: 'linkedin.com/in/priyasharma' }],
  summary:
    'Product analyst with four years of experience turning messy usage and sales data into decisions that ship. Owns the full loop — event instrumentation, retention modelling, experiments and the weekly narrative leadership actually reads. Wants to sit inside a product team, not one dashboard away.',
  experience: [
    {
      role: 'Product Analyst',
      company: 'Northwind Software',
      location: 'Bengaluru',
      start: 'Mar 2022',
      end: 'Present',
      bullets: [
        'Built the retention dashboard now used by 40+ people across product, growth and support, replacing four competing spreadsheets.',
        'Designed and analysed the pricing experiment that lifted trial-to-paid conversion from 9.4% to 12.1% in a single quarter.',
        'Wrote the weekly metrics memo read by the leadership team; cut reporting prep from six hours to forty minutes.',
        'Partnered with engineering to instrument checkout, recovering about 2% of drop-offs traced to missing events.',
      ],
    },
    {
      role: 'Data Analyst',
      company: 'Crestline Retail',
      location: 'Pune',
      start: 'Jul 2020',
      end: 'Feb 2022',
      bullets: [
        'Owned category-level sales reporting for 300+ stores and flagged the dead-stock pattern that freed ₹1.2 Cr of inventory.',
        'Automated the monthly supplier scorecard in SQL, cutting two days of manual spreadsheet work per cycle.',
        'Trained twelve merchandisers on the self-serve BI tool; weekly active usage rose from 3 to 11.',
      ],
    },
  ],
  education: [
    {
      degree: 'B.Tech, Computer Science',
      school: 'Vellore Institute of Technology',
      years: '2016 — 2020',
      note: 'GPA 8.7/10 · electives in statistics and databases',
    },
    {
      degree: 'PG Certificate, Data Analytics',
      school: 'Great Lakes Institute of Management',
      years: '2021',
      note: 'Capstone: churn modelling on telecom subscription data',
    },
  ],
  skills: 'SQL, Product analytics, A/B testing, Python (pandas), Tableau, Cohort retention',
  projects: [
    {
      name: 'Churn Signal',
      link: 'github.com/priyasharma/churn-signal',
      description:
        'Open-source Python package that flags at-risk subscription users straight from event logs; 400+ GitHub stars, in production at two startups.',
    },
    {
      name: 'The Metric Memo',
      link: 'themetricmemo.substack.com',
      description: 'A weekly newsletter on metrics design and honest dashboards, read by about 3,000 analysts.',
    },
  ],
  theme: 'modern',
  accent: 'emerald',
}

// --------------------------------------------------------------- styles

// Shared by the live preview, the print portal and the HTML export — one
// source of truth for the document typography. All theme differences are
// CSS variables scoped to the [data-resume-theme] sheet element, so the
// editor UI is never affected.
const RESUME_CSS = `
.resume-sheet, .resume-sheet * { box-sizing: border-box; }
.resume-sheet {
  --resume-accent: #047857;
  --rs-ink: #1c1917;
  --rs-muted: #57534e;
  --rs-font-body: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
  --rs-font-head: var(--rs-font-body);
  --rs-name-size: 24pt;
  --rs-name-weight: 700;
  --rs-name-track: -0.01em;
  --rs-name-underline: none;
  --rs-headline-size: 11pt;
  --rs-body-size: 10pt;
  --rs-line: 1.5;
  --rs-section-gap: 5.4mm;
  --rs-entry-gap: 3.4mm;
  --rs-bullet-gap: 1.1mm;
  --rs-title-size: 10.5pt;
  --rs-title-track: 0.08em;
  --rs-title-case: uppercase;
  --rs-title-underline: 1px;
  width: 210mm;
  min-height: 297mm;
  margin: 0;
  padding: 14mm 15mm;
  background: #ffffff;
  color: var(--rs-ink);
  font-family: var(--rs-font-body);
  font-size: var(--rs-body-size);
  line-height: var(--rs-line);
  text-align: left;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.resume-sheet h1, .resume-sheet h2, .resume-sheet h3, .resume-sheet p,
.resume-sheet ul, .resume-sheet li, .resume-sheet article,
.resume-sheet header, .resume-sheet section { margin: 0; padding: 0; }
.resume-name {
  font-family: var(--rs-font-head);
  font-size: var(--rs-name-size);
  font-weight: var(--rs-name-weight);
  letter-spacing: var(--rs-name-track);
  line-height: 1.14;
  color: var(--rs-ink);
  text-decoration: var(--rs-name-underline);
  text-decoration-color: var(--resume-accent);
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.16em;
}
.resume-headline { margin-top: 1.2mm; font-size: var(--rs-headline-size); font-weight: 500; color: var(--rs-muted); }
.resume-contact { margin-top: 2.2mm; font-size: 9pt; color: var(--rs-muted); line-height: 1.5; overflow-wrap: break-word; }
.resume-section { margin-top: var(--rs-section-gap); }
.resume-section-title {
  font-family: var(--rs-font-head);
  font-size: var(--rs-title-size);
  font-weight: 700;
  text-transform: var(--rs-title-case);
  letter-spacing: var(--rs-title-track);
  color: var(--rs-ink);
  padding-bottom: 1.1mm;
  border-bottom: var(--rs-title-underline) solid var(--resume-accent);
  margin-bottom: 2.8mm;
}
.resume-section-body > * + * { margin-top: var(--rs-entry-gap); }
.resume-summary { overflow-wrap: break-word; }
.resume-entry { break-inside: avoid; page-break-inside: avoid; }
.resume-entry-line { display: flex; align-items: baseline; justify-content: space-between; gap: 6mm; }
.resume-role { font-family: var(--rs-font-head); font-size: 10.5pt; font-weight: 700; color: var(--rs-ink); }
.resume-dates { flex-shrink: 0; font-size: 9.5pt; color: var(--rs-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.resume-org { margin-top: 0.6mm; font-size: 10pt; color: var(--rs-muted); }
.resume-note { margin-top: 0.6mm; font-size: 9.5pt; color: var(--rs-muted); }
.resume-bullets { margin-top: 1.8mm; padding-left: 4.6mm; list-style: disc outside; }
.resume-bullets li { margin-top: var(--rs-bullet-gap); padding-left: 0.8mm; }
.resume-bullets li::marker { color: var(--rs-muted); }
.resume-chips { display: flex; flex-wrap: wrap; gap: 1.8mm; list-style: none; }
.resume-chip { border: 1px solid var(--resume-accent); border-radius: 999px; padding: 0.7mm 3mm; font-size: 9pt; color: var(--rs-ink); }
.resume-link { color: var(--rs-muted); text-decoration: underline; text-decoration-color: var(--resume-accent); text-underline-offset: 0.15em; }

/* Theme: classic serif — serif faces, stone-black ink, thin rules, no case shifts. */
[data-resume-theme='classic'] {
  --rs-font-body: Georgia, 'Times New Roman', 'Noto Serif', serif;
  --rs-font-head: Georgia, 'Times New Roman', 'Noto Serif', serif;
  --rs-name-size: 23pt;
  --rs-name-track: 0.005em;
  --rs-title-size: 11.5pt;
  --rs-title-track: 0.03em;
  --rs-title-case: none;
  --rs-section-gap: 5.8mm;
  --rs-entry-gap: 3.8mm;
  --rs-bullet-gap: 1.2mm;
}
/* Theme: modern sans — bold geometric name with an accent underline. */
[data-resume-theme='modern'] {
  --rs-name-underline: underline;
  --rs-name-size: 26pt;
  --rs-name-track: -0.02em;
  --rs-title-underline: 2px;
  --rs-title-track: 0.1em;
}
/* Theme: compact — reduced spacing, denser bullets, smaller name. */
[data-resume-theme='compact'] {
  --rs-name-size: 17pt;
  --rs-headline-size: 10pt;
  --rs-body-size: 9.5pt;
  --rs-line: 1.4;
  --rs-section-gap: 3.6mm;
  --rs-entry-gap: 2.2mm;
  --rs-bullet-gap: 0.6mm;
  --rs-title-size: 10pt;
}
`

// Print isolation: a portal-mounted print root (direct child of <body>) is the
// only thing left visible when body carries the printing class. The class is
// added by the print button before window.print() and by the beforeprint
// event (covers Ctrl+P), and removed on afterprint / unmount.
const PRINT_CSS = `
#${PRINT_ROOT_ID} { display: none; }
@media print {
  @page { size: A4; margin: 0; }
  html, body { background: #ffffff !important; }
  body.${PRINT_CLASS} > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
  body.${PRINT_CLASS} #${PRINT_ROOT_ID} { display: block !important; }
  body.${PRINT_CLASS} #${PRINT_ROOT_ID} .resume-sheet {
    width: 210mm !important;
    min-height: 297mm !important;
    transform: none !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  .resume-entry { break-inside: avoid; page-break-inside: avoid; }
  .resume-section-title { break-after: avoid; page-break-after: avoid; }
}
`

// Slim scrollbars for the two independently scrollable columns (neutral stone).
const SCROLL_CSS = `
.resume-scroll { scrollbar-width: thin; scrollbar-color: rgb(168 162 158 / 0.6) transparent; }
.resume-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.resume-scroll::-webkit-scrollbar-track { background: transparent; }
.resume-scroll::-webkit-scrollbar-thumb { background: rgb(168 162 158 / 0.55); border-radius: 9999px; }
.dark .resume-scroll { scrollbar-color: rgb(120 113 108 / 0.65) transparent; }
.dark .resume-scroll::-webkit-scrollbar-thumb { background: rgb(120 113 108 / 0.6); }
`

// Wrapper styles for the exported standalone HTML document.
const EXPORT_CSS = `
body { margin: 0; padding: 32px 16px; background: #f5f5f4; display: flex; justify-content: center; }
@media print {
  body { padding: 0; background: #ffffff; display: block; }
  .resume-sheet { box-shadow: none !important; }
  @page { size: A4; margin: 0; }
  .resume-entry { break-inside: avoid; page-break-inside: avoid; }
}
`

// ------------------------------------------------------------ pure helpers

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function clampBullets(v: unknown): string[] {
  const list = strList(v).slice(0, MAX_BULLETS)
  return list.length ? list : ['']
}

function normalizeDraft(raw: unknown): ResumeDraft {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const rows = Array.isArray(r.extraContacts)
    ? (r.extraContacts as unknown[]).slice(0, 12).map((row) => {
        const x = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
        return { label: str(x.label), value: str(x.value) }
      })
    : []
  const experience = Array.isArray(r.experience)
    ? (r.experience as unknown[]).slice(0, 30).map((item) => {
        const x = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
        return {
          role: str(x.role),
          company: str(x.company),
          location: str(x.location),
          start: str(x.start),
          end: str(x.end),
          bullets: clampBullets(x.bullets),
        }
      })
    : []
  const education = Array.isArray(r.education)
    ? (r.education as unknown[]).slice(0, 20).map((item) => {
        const x = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
        return { degree: str(x.degree), school: str(x.school), years: str(x.years), note: str(x.note) }
      })
    : []
  const projects = Array.isArray(r.projects)
    ? (r.projects as unknown[]).slice(0, 20).map((item) => {
        const x = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
        return { name: str(x.name), link: str(x.link), description: str(x.description) }
      })
    : []
  return {
    name: str(r.name),
    headline: str(r.headline),
    location: str(r.location),
    email: str(r.email),
    phone: str(r.phone),
    website: str(r.website),
    extraContacts: rows,
    summary: str(r.summary),
    experience,
    education,
    skills: str(r.skills),
    projects,
    theme: THEMES.some((t) => t.id === r.theme) ? (r.theme as ThemeId) : SAMPLE_DRAFT.theme,
    accent: ACCENTS.some((a) => a.id === r.accent) ? (r.accent as AccentId) : SAMPLE_DRAFT.accent,
  }
}

function parseSkills(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}

function countLabel(n: number, unit: string): string {
  if (n === 0) return 'empty'
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

function clockTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function saveStatusView(status: SaveStatus): { text: string; dot: string } {
  switch (status.kind) {
    case 'saved':
      return { text: `Saved locally ${status.time ?? ''}`.trimEnd(), dot: 'bg-emerald-500' }
    case 'restored':
      return { text: `Draft restored ${status.time ?? ''}`.trimEnd(), dot: 'bg-emerald-500' }
    case 'error':
      return { text: status.message ?? 'Storage unavailable — edits kept in this tab', dot: 'bg-rose-500' }
    default:
      return { text: status.message ?? 'Edits save to this browser', dot: 'bg-stone-400' }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'resume'
}

/** The single document model consumed by the live sheet, the print portal and
 *  the HTML export, so all three can never drift apart. */
function buildSheetModel(d: ResumeDraft): SheetModel {
  const contact: string[] = []
  for (const part of [d.location, d.email, d.phone, d.website]) {
    const t = part.trim()
    if (t) contact.push(t)
  }
  for (const row of d.extraContacts) {
    const value = row.value.trim()
    if (!value) continue
    const label = row.label.trim()
    contact.push(label ? `${label}: ${value}` : value)
  }
  const dates = (start: string, end: string) =>
    [start.trim(), end.trim()].filter(Boolean).join(' – ')
  const org = (company: string, location: string) =>
    [company.trim(), location.trim()].filter(Boolean).join(', ')
  return {
    name: d.name.trim() || 'Your Name',
    headline: d.headline.trim(),
    contact,
    summary: d.summary.trim(),
    experience: d.experience
      .filter(
        (x) =>
          x.role.trim() !== '' || x.company.trim() !== '' || x.bullets.some((b) => b.trim() !== ''),
      )
      .map((x) => ({
        role: x.role.trim(),
        org: org(x.company, x.location),
        dates: dates(x.start, x.end),
        bullets: x.bullets.map((b) => b.trim()).filter(Boolean),
      })),
    education: d.education
      .filter((x) => x.degree.trim() !== '' || x.school.trim() !== '' || x.note.trim() !== '')
      .map((x) => ({
        degree: x.degree.trim(),
        school: x.school.trim(),
        dates: x.years.trim(),
        note: x.note.trim(),
      })),
    skills: parseSkills(d.skills),
    projects: d.projects
      .filter((x) => x.name.trim() !== '' || x.description.trim() !== '' || x.link.trim() !== '')
      .map((x) => ({ name: x.name.trim(), link: x.link.trim(), description: x.description.trim() })),
  }
}

function buildStandaloneHtml(d: ResumeDraft): string {
  const m = buildSheetModel(d)
  const e = escapeHtml
  const parts: string[] = []
  parts.push('<header>')
  parts.push(`<h1 class="resume-name">${e(m.name)}</h1>`)
  if (m.headline) parts.push(`<p class="resume-headline">${e(m.headline)}</p>`)
  if (m.contact.length) {
    parts.push(`<p class="resume-contact">${m.contact.map((c) => e(c)).join(' · ')}</p>`)
  }
  parts.push('</header>')
  if (m.summary) {
    parts.push(
      `<section class="resume-section"><h2 class="resume-section-title">Summary</h2><div class="resume-section-body"><p class="resume-summary">${e(m.summary)}</p></div></section>`,
    )
  }
  if (m.experience.length) {
    const entries = m.experience
      .map((x) => {
        const line = `<div class="resume-entry-line">${x.role ? `<h3 class="resume-role">${e(x.role)}</h3>` : '<span></span>'}${x.dates ? `<span class="resume-dates">${e(x.dates)}</span>` : ''}</div>`
        const orgLine = x.org ? `<p class="resume-org">${e(x.org)}</p>` : ''
        const bullets = x.bullets.length
          ? `<ul class="resume-bullets">${x.bullets.map((b) => `<li>${e(b)}</li>`).join('')}</ul>`
          : ''
        return `<article class="resume-entry">${line}${orgLine}${bullets}</article>`
      })
      .join('')
    parts.push(
      `<section class="resume-section"><h2 class="resume-section-title">Experience</h2><div class="resume-section-body">${entries}</div></section>`,
    )
  }
  if (m.education.length) {
    const entries = m.education
      .map((x) => {
        const line = `<div class="resume-entry-line"><h3 class="resume-role">${e(x.degree)}</h3>${x.dates ? `<span class="resume-dates">${e(x.dates)}</span>` : ''}</div>`
        const school = x.school ? `<p class="resume-org">${e(x.school)}</p>` : ''
        const note = x.note ? `<p class="resume-note">${e(x.note)}</p>` : ''
        return `<article class="resume-entry">${line}${school}${note}</article>`
      })
      .join('')
    parts.push(
      `<section class="resume-section"><h2 class="resume-section-title">Education</h2><div class="resume-section-body">${entries}</div></section>`,
    )
  }
  if (m.skills.length) {
    parts.push(
      `<section class="resume-section"><h2 class="resume-section-title">Skills</h2><div class="resume-section-body"><ul class="resume-chips">${m.skills
        .map((s) => `<li class="resume-chip">${e(s)}</li>`)
        .join('')}</ul></div></section>`,
    )
  }
  if (m.projects.length) {
    const entries = m.projects
      .map((x) => {
        const line = `<div class="resume-entry-line"><h3 class="resume-role">${e(x.name)}</h3>${x.link ? `<span class="resume-dates resume-link">${e(x.link)}</span>` : ''}</div>`
        const description = x.description ? `<p class="resume-note">${e(x.description)}</p>` : ''
        return `<article class="resume-entry">${line}${description}</article>`
      })
      .join('')
    parts.push(
      `<section class="resume-section"><h2 class="resume-section-title">Projects</h2><div class="resume-section-body">${entries}</div></section>`,
    )
  }
  const title = m.headline ? `${e(m.name)} — ${e(m.headline)}` : `${e(m.name)} — resume`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
${RESUME_CSS}
${EXPORT_CSS}
</style>
</head>
<body>
<div class="resume-sheet" data-resume-theme="${d.theme}" style="--resume-accent: ${accentHex(d.accent)}">
${parts.join('\n')}
</div>
</body>
</html>`
}

// ------------------------------------------------------------ small pieces

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function CharCount({ value, softMax }: { value: string; softMax: number }) {
  const over = value.length > softMax
  return (
    <span
      className={cn(
        'text-[11px] tabular-nums',
        over ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
      )}
    >
      {value.length} / {softMax} chars
    </span>
  )
}

/** 44px icon button used for the row-level move/remove controls. */
function RowIconButton({
  label,
  onClick,
  disabled,
  testId,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  testId?: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        'size-11',
        danger && 'text-muted-foreground hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive',
      )}
      aria-label={label}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

/** Shared chrome for one repeatable entry: a labelled head with move up /
 *  move down / remove controls and the fields below. */
function EntryShell({
  label,
  onUp,
  onDown,
  onRemove,
  upDisabled,
  downDisabled,
  upAria,
  downAria,
  removeAria,
  upTestId,
  downTestId,
  removeTestId,
  children,
}: {
  label: string
  onUp: () => void
  onDown: () => void
  onRemove: () => void
  upDisabled?: boolean
  downDisabled?: boolean
  upAria: string
  downAria: string
  removeAria: string
  upTestId?: string
  downTestId?: string
  removeTestId?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          <RowIconButton label={upAria} testId={upTestId} onClick={onUp} disabled={upDisabled}>
            <ArrowUp aria-hidden="true" />
          </RowIconButton>
          <RowIconButton label={downAria} testId={downTestId} onClick={onDown} disabled={downDisabled}>
            <ArrowDown aria-hidden="true" />
          </RowIconButton>
          <RowIconButton label={removeAria} testId={removeTestId} onClick={onRemove} danger>
            <Trash2 aria-hidden="true" />
          </RowIconButton>
        </div>
      </div>
      {children}
    </div>
  )
}

function EditorSection({
  id,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  count?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle} className="overflow-hidden rounded-xl border bg-card" data-section={id}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex h-14 w-full items-center justify-between gap-3 px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-expanded={open}
        >
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{title}</span>
            {count ? <span className="text-[11px] font-normal text-muted-foreground">{count}</span> : null}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-t px-4 pb-5 pt-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ------------------------------------------------------------ the A4 sheet

interface ResumeSheetProps {
  draft: ResumeDraft
  testId?: string
  sheetRef?: React.RefObject<HTMLDivElement | null>
  scale?: number
}

/** The document itself: semantic h1/h2/ul, real selectable text, no images,
 *  no layout tables — single column throughout. */
function ResumeSheet({ draft, testId, sheetRef, scale }: ResumeSheetProps) {
  const m = buildSheetModel(draft)
  const sheetStyle = {
    ...(scale !== undefined ? { transform: `scale(${scale})`, transformOrigin: 'top left' } : {}),
    '--resume-accent': accentHex(draft.accent),
  } as React.CSSProperties
  return (
    <div ref={sheetRef} className="resume-sheet" data-resume-theme={draft.theme} data-testid={testId} style={sheetStyle}>
      <header>
        <h1 className="resume-name">{m.name}</h1>
        {m.headline ? <p className="resume-headline">{m.headline}</p> : null}
        {m.contact.length > 0 ? <p className="resume-contact">{m.contact.join(' · ')}</p> : null}
      </header>

      {m.summary ? (
        <section className="resume-section">
          <h2 className="resume-section-title">Summary</h2>
          <div className="resume-section-body">
            <p className="resume-summary">{m.summary}</p>
          </div>
        </section>
      ) : null}

      {m.experience.length > 0 ? (
        <section className="resume-section">
          <h2 className="resume-section-title">Experience</h2>
          <div className="resume-section-body">
            {m.experience.map((x, i) => (
              <article className="resume-entry" key={i}>
                <div className="resume-entry-line">
                  {x.role ? <h3 className="resume-role">{x.role}</h3> : <span />}
                  {x.dates ? <span className="resume-dates">{x.dates}</span> : null}
                </div>
                {x.org ? <p className="resume-org">{x.org}</p> : null}
                {x.bullets.length > 0 ? (
                  <ul className="resume-bullets">
                    {x.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {m.education.length > 0 ? (
        <section className="resume-section">
          <h2 className="resume-section-title">Education</h2>
          <div className="resume-section-body">
            {m.education.map((x, i) => (
              <article className="resume-entry" key={i}>
                <div className="resume-entry-line">
                  {x.degree ? <h3 className="resume-role">{x.degree}</h3> : <span />}
                  {x.dates ? <span className="resume-dates">{x.dates}</span> : null}
                </div>
                {x.school ? <p className="resume-org">{x.school}</p> : null}
                {x.note ? <p className="resume-note">{x.note}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {m.skills.length > 0 ? (
        <section className="resume-section">
          <h2 className="resume-section-title">Skills</h2>
          <div className="resume-section-body">
            <ul className="resume-chips">
              {m.skills.map((s, i) => (
                <li className="resume-chip" key={`${s}-${i}`}>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {m.projects.length > 0 ? (
        <section className="resume-section">
          <h2 className="resume-section-title">Projects</h2>
          <div className="resume-section-body">
            {m.projects.map((x, i) => (
              <article className="resume-entry" key={i}>
                <div className="resume-entry-line">
                  {x.name ? <h3 className="resume-role">{x.name}</h3> : <span />}
                  {x.link ? <span className="resume-dates resume-link">{x.link}</span> : null}
                </div>
                {x.description ? <p className="resume-note">{x.description}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

/** Measures its container in an effect (ResizeObserver + initial pass) and
 *  transform-scales the 210mm sheet to fit — never measured during render. */
function ScaledSheet({ draft, testId }: { draft: ResumeDraft; testId?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0)
  const [contentH, setContentH] = useState(A4_H_PX)

  useEffect(() => {
    const wrap = wrapRef.current
    const sheet = sheetRef.current
    if (!wrap || !sheet) return
    let raf = 0
    const update = () => {
      const w = wrap.clientWidth
      if (w > 0) setScale(Math.min(1, w / A4_W_PX))
      const h = sheet.scrollHeight
      if (h > 0) setContentH(Math.max(A4_H_PX, h))
    }
    update()
    const ro = new ResizeObserver(() => {
      if (raf) window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(update)
    })
    ro.observe(wrap)
    ro.observe(sheet)
    return () => {
      ro.disconnect()
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={wrapRef} className="w-full overflow-hidden" style={{ height: contentH * scale }}>
      <ResumeSheet draft={draft} testId={testId} sheetRef={sheetRef} scale={scale} />
    </div>
  )
}

// ------------------------------------------------------------- editors

function HeaderEditor({
  draft,
  patch,
}: {
  draft: ResumeDraft
  patch: (p: Partial<ResumeDraft>) => void
}) {
  const rows = draft.extraContacts
  const setRow = (i: number, p: Partial<ContactRow>) =>
    patch({ extraContacts: rows.map((row, k) => (k === i ? { ...row, ...p } : row)) })
  const addRow = () => patch({ extraContacts: [...rows, { label: '', value: '' }] })
  const removeRow = (i: number) => patch({ extraContacts: rows.filter((_, k) => k !== i) })
  const moveRow = (i: number, dir: -1 | 1) => patch({ extraContacts: moveItem(rows, i, dir) })

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" htmlFor="resume-name" className="sm:col-span-2">
          <Input
            id="resume-name"
            data-testid="resume-name-input"
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Priya Sharma"
            className="h-11"
            autoComplete="name"
          />
        </Field>
        <Field label="Headline / title" htmlFor="resume-headline" className="sm:col-span-2">
          <Input
            id="resume-headline"
            data-testid="resume-headline-input"
            value={draft.headline}
            onChange={(e) => patch({ headline: e.target.value })}
            placeholder="Product Analyst"
            className="h-11"
          />
        </Field>
        <Field label="Location" htmlFor="resume-location">
          <Input
            id="resume-location"
            value={draft.location}
            onChange={(e) => patch({ location: e.target.value })}
            placeholder="Bengaluru, India"
            className="h-11"
          />
        </Field>
        <Field label="Email" htmlFor="resume-email">
          <Input
            id="resume-email"
            type="email"
            value={draft.email}
            onChange={(e) => patch({ email: e.target.value })}
            placeholder="you@example.com"
            className="h-11"
            autoComplete="email"
          />
        </Field>
        <Field label="Phone" htmlFor="resume-phone">
          <Input
            id="resume-phone"
            type="tel"
            value={draft.phone}
            onChange={(e) => patch({ phone: e.target.value })}
            placeholder="+91 98450 12345"
            className="h-11"
            autoComplete="tel"
          />
        </Field>
        <Field label="Website" htmlFor="resume-website">
          <Input
            id="resume-website"
            value={draft.website}
            onChange={(e) => patch({ website: e.target.value })}
            placeholder="yoursite.dev"
            className="h-11"
          />
        </Field>
      </div>

      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-2.5">
          <Field label="Label" htmlFor={`contact-label-${i}`} className="w-32 shrink-0">
            <Input
              id={`contact-label-${i}`}
              value={row.label}
              onChange={(e) => setRow(i, { label: e.target.value })}
              placeholder="LinkedIn"
              className="h-11"
            />
          </Field>
          <Field label="Value" htmlFor={`contact-value-${i}`} className="min-w-40 flex-1">
            <Input
              id={`contact-value-${i}`}
              value={row.value}
              onChange={(e) => setRow(i, { value: e.target.value })}
              placeholder="linkedin.com/in/you"
              className="h-11"
            />
          </Field>
          <div className="flex items-center gap-1 pb-0.5">
            <RowIconButton
              label={`Move contact row ${i + 1} up`}
              onClick={() => moveRow(i, -1)}
              disabled={i === 0}
            >
              <ArrowUp aria-hidden="true" />
            </RowIconButton>
            <RowIconButton
              label={`Move contact row ${i + 1} down`}
              onClick={() => moveRow(i, 1)}
              disabled={i === rows.length - 1}
            >
              <ArrowDown aria-hidden="true" />
            </RowIconButton>
            <RowIconButton label={`Remove contact row ${i + 1}`} onClick={() => removeRow(i)} danger>
              <Trash2 aria-hidden="true" />
            </RowIconButton>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" className="h-11 w-full border-dashed" onClick={addRow}>
        <Plus aria-hidden="true" /> Add contact row
      </Button>
      <p className="text-xs text-muted-foreground">
        Location, email, phone and website join the contact line; extra rows print as
        &ldquo;Label: value&rdquo;.
      </p>
    </div>
  )
}

function SummaryEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Field label="Professional summary" htmlFor="resume-summary">
        <Textarea
          id="resume-summary"
          data-testid="resume-summary-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder="Two to four tight sentences: what you do, proof it works, what you want next."
          className="min-h-28"
        />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CharCount value={value} softMax={SUMMARY_SOFT_MAX} />
        {value.length > SUMMARY_SOFT_MAX ? (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            Over the skimmable sweet spot — cut about {value.length - SUMMARY_SOFT_MAX} characters.
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Recruiters read the top third first.</span>
        )}
      </div>
    </div>
  )
}

const emptyExperience = (): ExperienceEntry => ({
  role: '',
  company: '',
  location: '',
  start: '',
  end: '',
  bullets: [''],
})

function ExperienceEditor({
  items,
  onChange,
}: {
  items: ExperienceEntry[]
  onChange: (next: ExperienceEntry[]) => void
}) {
  const patchAt = (i: number, p: Partial<ExperienceEntry>) =>
    onChange(items.map((entry, k) => (k === i ? { ...entry, ...p } : entry)))

  return (
    <div className="space-y-3">
      {items.map((entry, i) => (
        <EntryShell
          key={i}
          label={`Experience ${i + 1}`}
          onUp={() => onChange(moveItem(items, i, -1))}
          onDown={() => onChange(moveItem(items, i, 1))}
          onRemove={() => onChange(items.filter((_, k) => k !== i))}
          upDisabled={i === 0}
          downDisabled={i === items.length - 1}
          upAria={`Move experience entry ${i + 1} up`}
          downAria={`Move experience entry ${i + 1} down`}
          removeAria={`Remove experience entry ${i + 1}`}
          upTestId={`resume-move-experience-${i}`}
          downTestId={`resume-move-experience-${i}-down`}
          removeTestId={`resume-remove-experience-${i}`}
        >
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Role" htmlFor={`exp-${i}-role`}>
                <Input
                  id={`exp-${i}-role`}
                  value={entry.role}
                  onChange={(e) => patchAt(i, { role: e.target.value })}
                  placeholder="Product Analyst"
                  className="h-11"
                />
              </Field>
              <Field label="Company" htmlFor={`exp-${i}-company`}>
                <Input
                  id={`exp-${i}-company`}
                  value={entry.company}
                  onChange={(e) => patchAt(i, { company: e.target.value })}
                  placeholder="Northwind Software"
                  className="h-11"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Location (optional)" htmlFor={`exp-${i}-location`}>
                <Input
                  id={`exp-${i}-location`}
                  value={entry.location}
                  onChange={(e) => patchAt(i, { location: e.target.value })}
                  placeholder="Bengaluru"
                  className="h-11"
                />
              </Field>
              <Field label="Start" htmlFor={`exp-${i}-start`}>
                <Input
                  id={`exp-${i}-start`}
                  value={entry.start}
                  onChange={(e) => patchAt(i, { start: e.target.value })}
                  placeholder="Mar 2022"
                  className="h-11"
                />
              </Field>
              <Field label="End" htmlFor={`exp-${i}-end`}>
                <Input
                  id={`exp-${i}-end`}
                  value={entry.end}
                  onChange={(e) => patchAt(i, { end: e.target.value })}
                  placeholder="Present"
                  className="h-11"
                />
              </Field>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Bullet points</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{entry.bullets.length} / {MAX_BULLETS}</span>
              </div>
              {entry.bullets.map((bullet, j) => (
                <div key={j} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <Input
                      id={`exp-${i}-bullet-${j}`}
                      value={bullet}
                      onChange={(e) =>
                        patchAt(i, { bullets: entry.bullets.map((b, k) => (k === j ? e.target.value : b)) })
                      }
                      placeholder="Start with an action — Built…, Cut…, Led…"
                      className="h-11"
                      aria-label={`Bullet ${j + 1} of experience entry ${i + 1}`}
                    />
                    <div className="mt-1 text-right">
                      <CharCount value={bullet} softMax={BULLET_SOFT_MAX} />
                    </div>
                  </div>
                  <div className="flex items-start gap-1">
                    <RowIconButton
                      label={`Move bullet ${j + 1} up`}
                      onClick={() => patchAt(i, { bullets: moveItem(entry.bullets, j, -1) })}
                      disabled={j === 0}
                    >
                      <ArrowUp aria-hidden="true" />
                    </RowIconButton>
                    <RowIconButton
                      label={`Move bullet ${j + 1} down`}
                      onClick={() => patchAt(i, { bullets: moveItem(entry.bullets, j, 1) })}
                      disabled={j === entry.bullets.length - 1}
                    >
                      <ArrowDown aria-hidden="true" />
                    </RowIconButton>
                    <RowIconButton
                      label={`Remove bullet ${j + 1}`}
                      onClick={() => patchAt(i, { bullets: entry.bullets.filter((_, k) => k !== j) })}
                      disabled={entry.bullets.length <= 1}
                      danger
                    >
                      <Trash2 aria-hidden="true" />
                    </RowIconButton>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-dashed"
                disabled={entry.bullets.length >= MAX_BULLETS}
                onClick={() => patchAt(i, { bullets: [...entry.bullets, ''] })}
              >
                <Plus aria-hidden="true" /> Add bullet{entry.bullets.length >= MAX_BULLETS ? ' (max 8)' : ''}
              </Button>
            </div>
          </div>
        </EntryShell>
      ))}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full border-dashed"
        data-testid="resume-add-experience"
        onClick={() => onChange([...items, emptyExperience()])}
      >
        <Plus aria-hidden="true" /> Add experience
      </Button>
    </div>
  )
}

const emptyEducation = (): EducationEntry => ({ degree: '', school: '', years: '', note: '' })

function EducationEditor({
  items,
  onChange,
}: {
  items: EducationEntry[]
  onChange: (next: EducationEntry[]) => void
}) {
  const patchAt = (i: number, p: Partial<EducationEntry>) =>
    onChange(items.map((entry, k) => (k === i ? { ...entry, ...p } : entry)))

  return (
    <div className="space-y-3">
      {items.map((entry, i) => (
        <EntryShell
          key={i}
          label={`Education ${i + 1}`}
          onUp={() => onChange(moveItem(items, i, -1))}
          onDown={() => onChange(moveItem(items, i, 1))}
          onRemove={() => onChange(items.filter((_, k) => k !== i))}
          upDisabled={i === 0}
          downDisabled={i === items.length - 1}
          upAria={`Move education entry ${i + 1} up`}
          downAria={`Move education entry ${i + 1} down`}
          removeAria={`Remove education entry ${i + 1}`}
        >
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <Field label="Degree" htmlFor={`edu-${i}-degree`}>
                <Input
                  id={`edu-${i}-degree`}
                  value={entry.degree}
                  onChange={(e) => patchAt(i, { degree: e.target.value })}
                  placeholder="B.Tech, Computer Science"
                  className="h-11"
                />
              </Field>
              <Field label="Years" htmlFor={`edu-${i}-years`}>
                <Input
                  id={`edu-${i}-years`}
                  value={entry.years}
                  onChange={(e) => patchAt(i, { years: e.target.value })}
                  placeholder="2016 — 2020"
                  className="h-11"
                />
              </Field>
            </div>
            <Field label="School" htmlFor={`edu-${i}-school`}>
              <Input
                id={`edu-${i}-school`}
                value={entry.school}
                onChange={(e) => patchAt(i, { school: e.target.value })}
                placeholder="Vellore Institute of Technology"
                className="h-11"
              />
            </Field>
            <Field label="Note (optional)" htmlFor={`edu-${i}-note`}>
              <Input
                id={`edu-${i}-note`}
                value={entry.note}
                onChange={(e) => patchAt(i, { note: e.target.value })}
                placeholder="GPA, honours, relevant electives"
                className="h-11"
              />
            </Field>
          </div>
        </EntryShell>
      ))}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full border-dashed"
        onClick={() => onChange([...items, emptyEducation()])}
      >
        <Plus aria-hidden="true" /> Add education
      </Button>
    </div>
  )
}

function SkillsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const chips = parseSkills(value)
  return (
    <div className="space-y-3">
      <Field label="Skills — separate with commas" htmlFor="resume-skill-input">
        <Input
          id="resume-skill-input"
          data-testid="resume-skill-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="SQL, A/B testing, Tableau"
          className="h-11"
        />
      </Field>
      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Skills as they appear on the sheet">
          {chips.map((s, i) => (
            <li key={`${s}-${i}`}>
              <Badge variant="outline" className="rounded-full bg-primary/5 px-2.5 py-1 text-xs font-normal">
                {s}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No skills yet — commas become chips on the sheet.</p>
      )}
    </div>
  )
}

const emptyProject = (): ProjectEntry => ({ name: '', link: '', description: '' })

function ProjectsEditor({
  items,
  onChange,
}: {
  items: ProjectEntry[]
  onChange: (next: ProjectEntry[]) => void
}) {
  const patchAt = (i: number, p: Partial<ProjectEntry>) =>
    onChange(items.map((entry, k) => (k === i ? { ...entry, ...p } : entry)))

  return (
    <div className="space-y-3">
      {items.map((entry, i) => (
        <EntryShell
          key={i}
          label={`Project ${i + 1}`}
          onUp={() => onChange(moveItem(items, i, -1))}
          onDown={() => onChange(moveItem(items, i, 1))}
          onRemove={() => onChange(items.filter((_, k) => k !== i))}
          upDisabled={i === 0}
          downDisabled={i === items.length - 1}
          upAria={`Move project ${i + 1} up`}
          downAria={`Move project ${i + 1} down`}
          removeAria={`Remove project ${i + 1}`}
        >
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor={`proj-${i}-name`}>
                <Input
                  id={`proj-${i}-name`}
                  value={entry.name}
                  onChange={(e) => patchAt(i, { name: e.target.value })}
                  placeholder="Churn Signal"
                  className="h-11"
                />
              </Field>
              <Field label="Link (optional)" htmlFor={`proj-${i}-link`}>
                <Input
                  id={`proj-${i}-link`}
                  value={entry.link}
                  onChange={(e) => patchAt(i, { link: e.target.value })}
                  placeholder="github.com/you/project"
                  className="h-11"
                />
              </Field>
            </div>
            <Field label="Description" htmlFor={`proj-${i}-description`}>
              <Textarea
                id={`proj-${i}-description`}
                value={entry.description}
                onChange={(e) => patchAt(i, { description: e.target.value })}
                rows={2}
                placeholder="What it is, what it does, one proof point."
                className="min-h-16"
              />
            </Field>
          </div>
        </EntryShell>
      ))}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full border-dashed"
        onClick={() => onChange([...items, emptyProject()])}
      >
        <Plus aria-hidden="true" /> Add project
      </Button>
    </div>
  )
}

// --------------------------------------------------------------- the tool

type SectionId = 'header' | 'summary' | 'experience' | 'education' | 'skills' | 'projects'

const ALL_SECTIONS: SectionId[] = ['header', 'summary', 'experience', 'education', 'skills', 'projects']

export function ResumeTool() {
  const [draft, setDraft] = useState<ResumeDraft>(SAMPLE_DRAFT)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' })
  const [confirmReset, setConfirmReset] = useState(false)
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  // Hydration flag for the print portal — no effect-driven setState needed.
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>(
    () => Object.fromEntries(ALL_SECTIONS.map((id) => [id, true])) as Record<SectionId, boolean>,
  )
  // JSON snapshot of the last persisted draft — state, so the render-time
  // "Saving…" derivation can compare against it without touching a ref.
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(SAMPLE_DRAFT))

  const patch = (p: Partial<ResumeDraft>) => setDraft((d) => ({ ...d, ...p }))

  // A draft whose JSON no longer matches the last persisted snapshot is
  // mid-debounce — rendered as "Saving…" without touching state in effects.
  const savePending = JSON.stringify(draft) !== savedJson

  // Restore a saved draft once, after mount — never during render. The state
  // updates run inside a task callback (not synchronously in the effect
  // body), so the sample paints first and the restored draft lands a tick later.
  useEffect(() => {
    let cancelled = false
    const restore = window.setTimeout(() => {
      if (cancelled) return
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const restored = normalizeDraft(JSON.parse(raw))
        setSavedJson(JSON.stringify(restored))
        setDraft(restored)
        setSaveStatus({ kind: 'restored', time: clockTime() })
      } catch {
        // A corrupted or unreadable draft is dropped; the sample stays on screen.
      }
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(restore)
    }
  }, [])

  // Debounced autosave: every editor change lands in localStorage ~600ms
  // later. Terminal states (saved / quota error) are set inside the timer
  // callback, never synchronously in the effect body.
  useEffect(() => {
    const json = JSON.stringify(draft)
    if (json === savedJson) return
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, json)
        setSavedJson(json)
        setSaveStatus({ kind: 'saved', time: clockTime() })
      } catch {
        setSavedJson(json)
        setSaveStatus({
          kind: 'error',
          message: 'Storage full or blocked — edits kept in this tab only',
        })
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [draft, savedJson])

  // Ctrl+P support: put the isolation class on before the print render and
  // clean it up afterwards, same contract as the button-driven path.
  useEffect(() => {
    const before = () => document.body.classList.add(PRINT_CLASS)
    const after = () => document.body.classList.remove(PRINT_CLASS)
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
      document.body.classList.remove(PRINT_CLASS)
    }
  }, [])

  const handlePrint = () => {
    document.body.classList.add(PRINT_CLASS)
    const cleanup = () => document.body.classList.remove(PRINT_CLASS)
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }

  const handleExportHtml = () => {
    const html = buildStandaloneHtml(draft)
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${slugify(draft.name)}-resume.html`)
  }

  const doReset = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage may be blocked; resetting the in-memory draft still works.
    }
    const fresh = structuredClone(SAMPLE_DRAFT)
    setSavedJson(JSON.stringify(fresh))
    setDraft(fresh)
    setConfirmReset(false)
    setSaveStatus({ kind: 'idle', message: 'Sample restored — your draft was cleared' })
  }

  const status = savePending
    ? { text: 'Saving…', dot: 'bg-amber-500 animate-pulse' }
    : saveStatusView(saveStatus)

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: RESUME_CSS + PRINT_CSS + SCROLL_CSS }} />

      {/* ------------------------------------------------------- toolbar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-card p-3">
        <div role="group" aria-label="Resume theme" data-testid="resume-theme" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Theme</span>
          {THEMES.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant={draft.theme === t.id ? 'default' : 'outline'}
              className="h-11 px-3"
              aria-pressed={draft.theme === t.id}
              onClick={() => patch({ theme: t.id })}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <Separator orientation="vertical" className="hidden h-8 sm:block" />

        <div role="group" aria-label="Accent color" data-testid="resume-accent" className="flex items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Accent</span>
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-label={`${a.label} accent`}
              aria-pressed={draft.accent === a.id}
              title={`${a.label} accent`}
              onClick={() => patch({ accent: a.id })}
              className={cn(
                'flex size-11 items-center justify-center rounded-full border-2 transition-colors',
                draft.accent === a.id ? 'border-foreground' : 'border-transparent hover:border-border',
              )}
            >
              <span className="size-5 rounded-full" style={{ backgroundColor: a.hex }} aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <p
            data-testid="resume-autosave-status"
            aria-live="polite"
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span className={cn('size-2 shrink-0 rounded-full', status.dot)} aria-hidden="true" />
            {status.text}
          </p>
          <Button type="button" data-testid="resume-print" className="h-11 px-4" onClick={handlePrint}>
            <Printer aria-hidden="true" /> Print PDF
          </Button>
          <Button
            type="button"
            data-testid="resume-export-html"
            variant="outline"
            className="h-11 px-4"
            onClick={handleExportHtml}
          >
            <Download aria-hidden="true" /> HTML
          </Button>
          {confirmReset ? (
            <span
              role="group"
              aria-label="Confirm reset to sample"
              className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-50 px-2.5 py-1.5 dark:bg-amber-950/30"
            >
              <span className="text-xs font-medium">Discard edits, restore the sample?</span>
              <Button type="button" variant="destructive" className="h-11 px-3" onClick={doReset}>
                Restore
              </Button>
              <Button type="button" variant="ghost" className="h-11 px-3" onClick={() => setConfirmReset(false)}>
                Keep editing
              </Button>
            </span>
          ) : (
            <Button
              type="button"
              data-testid="resume-reset"
              variant="ghost"
              className="h-11 px-3 text-muted-foreground"
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw aria-hidden="true" /> Reset to sample
            </Button>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------- workspace */}
      <div className="lg:grid lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:items-start lg:gap-5">
        {/* editor column — independently scrollable on desktop */}
        <div
          data-testid="resume-editor"
          className="resume-scroll space-y-3 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto lg:pr-1.5"
        >
          <EditorSection
            id="header"
            title="Header"
            open={openSections.header}
            onToggle={() => setOpenSections((s) => ({ ...s, header: !s.header }))}
          >
            <HeaderEditor draft={draft} patch={patch} />
          </EditorSection>

          <EditorSection
            id="summary"
            title="Summary"
            count={`${draft.summary.trim().length} chars`}
            open={openSections.summary}
            onToggle={() => setOpenSections((s) => ({ ...s, summary: !s.summary }))}
          >
            <SummaryEditor value={draft.summary} onChange={(v) => patch({ summary: v })} />
          </EditorSection>

          <EditorSection
            id="experience"
            title="Experience"
            count={countLabel(draft.experience.length, 'role')}
            open={openSections.experience}
            onToggle={() => setOpenSections((s) => ({ ...s, experience: !s.experience }))}
          >
            <ExperienceEditor items={draft.experience} onChange={(next) => patch({ experience: next })} />
          </EditorSection>

          <EditorSection
            id="education"
            title="Education"
            count={countLabel(draft.education.length, 'entry')}
            open={openSections.education}
            onToggle={() => setOpenSections((s) => ({ ...s, education: !s.education }))}
          >
            <EducationEditor items={draft.education} onChange={(next) => patch({ education: next })} />
          </EditorSection>

          <EditorSection
            id="skills"
            title="Skills"
            count={countLabel(parseSkills(draft.skills).length, 'skill')}
            open={openSections.skills}
            onToggle={() => setOpenSections((s) => ({ ...s, skills: !s.skills }))}
          >
            <SkillsEditor value={draft.skills} onChange={(v) => patch({ skills: v })} />
          </EditorSection>

          <EditorSection
            id="projects"
            title="Projects"
            count={countLabel(draft.projects.length, 'project')}
            open={openSections.projects}
            onToggle={() => setOpenSections((s) => ({ ...s, projects: !s.projects }))}
          >
            <ProjectsEditor items={draft.projects} onChange={(next) => patch({ projects: next })} />
          </EditorSection>
        </div>

        {/* desktop preview column — its own scroll area */}
        <div className="mt-4 hidden lg:mt-0 lg:block" aria-label="Live A4 preview">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">A4 preview</h2>
              <span className="text-[11px] text-muted-foreground">scales to fit · prints at 100%</span>
            </div>
            <div className="resume-scroll mt-3 max-h-[calc(100dvh-22rem)] overflow-y-auto rounded-lg">
              <ScaledSheet draft={draft} testId="resume-preview" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{ATS_HINT}</p>
          </div>
        </div>

        {/* mobile: editor first, then a collapsible preview disclosure that
            can also open a full-width sheet */}
        <div className="mt-4 lg:hidden">
          <Collapsible open={mobilePreviewOpen} onOpenChange={setMobilePreviewOpen}>
            <div className="flex items-center gap-2 rounded-xl border bg-card p-2.5">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 flex-1 justify-between px-3"
                  aria-expanded={mobilePreviewOpen}
                >
                  <span className="flex items-center gap-2">
                    <Eye aria-hidden="true" className="size-4" /> Preview
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn('size-4 transition-transform duration-200', mobilePreviewOpen && 'rotate-180')}
                  />
                </Button>
              </CollapsibleTrigger>
              <Sheet>
                <SheetTrigger asChild>
                  <Button type="button" variant="outline" className="h-11 px-3" aria-label="Open full-width preview">
                    <Maximize2 aria-hidden="true" className="size-4" />
                    <span className="sr-only">Open full-width preview</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[92dvh] rounded-t-2xl">
                  <SheetHeader className="flex-row items-center justify-between gap-3 border-b p-4">
                    <div>
                      <SheetTitle className="text-base">Resume preview</SheetTitle>
                      <SheetDescription className="text-xs">Full-width A4 sheet — print or export from here too.</SheetDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" className="h-11 px-3" onClick={handlePrint}>
                        <Printer aria-hidden="true" /> Print
                      </Button>
                      <Button type="button" variant="outline" className="h-11 px-3" onClick={handleExportHtml}>
                        <Download aria-hidden="true" /> HTML
                      </Button>
                    </div>
                  </SheetHeader>
                  <div className="resume-scroll flex-1 overflow-y-auto px-4 pb-6">
                    <ScaledSheet draft={draft} />
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{ATS_HINT}</p>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <CollapsibleContent>
              <div className="mt-3 rounded-xl border bg-card p-4">
                <ScaledSheet draft={draft} />
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{ATS_HINT}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Print opens your browser dialog — choose “Save as PDF” for a pixel-exact A4 at 100% scale. The HTML
        export is a single self-contained file with the same sheet, themes and print rules baked in.
      </p>

      <PrivacyStrip detail="The whole builder runs in this tab: your draft autosaves to this browser's localStorage only, printing and the HTML export happen on your device, and nothing is ever uploaded." />

      {/* Print-only portal: an unscaled copy of the sheet mounted as a direct
          child of <body>, shown exclusively by the print stylesheet. */}
      {hydrated
        ? createPortal(
            <div id={PRINT_ROOT_ID} aria-hidden="true">
              <ResumeSheet draft={draft} />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export default ResumeTool
