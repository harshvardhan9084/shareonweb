'use client'

// Contact card builder → vCard 3.0 text + scannable QR. The card is pure
// UTF-8 text built locally (non-ASCII names pass through untouched), the QR
// is rendered by the local `qrcode` library, and the .vcf download comes
// straight from the browser. Nothing is stored or sent anywhere.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Check, Copy, Download, QrCode } from 'lucide-react'
import QRLib from 'qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip, downloadBlob } from '@/components/instant/instant-kit'

interface CardFields {
  first: string
  last: string
  org: string
  title: string
  phone: string
  email: string
  web: string
  note: string
}

const EMPTY_FIELDS: CardFields = {
  first: '',
  last: '',
  org: '',
  title: '',
  phone: '',
  email: '',
  web: '',
  note: '',
}

/** Collapse runs of whitespace and trim — names render as "single spaces". */
function collapseSpaces(v: string): string {
  return v.replace(/\s+/g, ' ').trim()
}

/** RFC 2426 value escaping: backslash first, then the structured-field
 *  delimiters ; and ,, then newlines as the literal two-character \n. */
function escValue(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function buildVCard(f: CardFields): string {
  const first = collapseSpaces(f.first)
  const last = collapseSpaces(f.last)
  // Without any name piece the card stays minimal (BEGIN/VERSION/END): N and
  // FN are the only mandatory identity properties, and every other field
  // dangles without them.
  if (!first && !last) {
    return ['BEGIN:VCARD', 'VERSION:3.0', 'END:VCARD'].join('\n')
  }
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0']
  lines.push(`N:${escValue(last)};${escValue(first)};;;`)
  // FN falls back to whichever name piece exists.
  lines.push(`FN:${escValue([first, last].filter(Boolean).join(' '))}`)
  if (f.org.trim()) lines.push(`ORG:${escValue(collapseSpaces(f.org))}`)
  if (f.title.trim()) lines.push(`TITLE:${escValue(collapseSpaces(f.title))}`)
  if (f.phone.trim()) lines.push(`TEL:${escValue(collapseSpaces(f.phone))}`)
  if (f.email.trim()) lines.push(`EMAIL:${escValue(collapseSpaces(f.email))}`)
  if (f.web.trim()) lines.push(`URL:${escValue(collapseSpaces(f.web))}`)
  // The note keeps its internal structure: newlines become the escaped \n.
  if (f.note.trim()) lines.push(`NOTE:${escValue(f.note)}`)
  lines.push('END:VCARD')
  return lines.join('\n')
}

/** Filename slug, Unicode-aware so non-ASCII names survive into the file
 *  name where the OS allows them; falls back to contact.vcf when empty. */
function slugify(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

export function VCardTool() {
  const [fields, setFields] = useState<CardFields>(EMPTY_FIELDS)
  const [qr, setQr] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const set = (key: keyof CardFields) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }))

  const vcard = useMemo(() => buildVCard(fields), [fields])
  const hasName = Boolean(collapseSpaces(fields.first) || collapseSpaces(fields.last))

  const fileName = useMemo(() => {
    const parts = [slugify(fields.first), slugify(fields.last)].filter(Boolean)
    return parts.length ? `${parts.join('-')}.vcf` : 'contact.vcf'
  }, [fields.first, fields.last])

  // The QR regenerates ~250ms after the card text settles — fast enough for
  // a sleep(1) QA pass, slow enough to stay snappy while typing.
  useEffect(() => {
    if (!hasName) return
    let alive = true
    const timer = setTimeout(() => {
      QRLib.toDataURL(vcard, { width: 240, margin: 2 })
        .then((url) => {
          if (!alive) return
          setQr(url)
          setQrError(null)
        })
        .catch(() => {
          if (!alive) return
          setQr(null)
          setQrError('This card is too long for one QR code — shorten the note or other fields.')
        })
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [vcard, hasName])

  const downloadVcf = useCallback(() => {
    if (!hasName) return
    // Blob strings are encoded as UTF-8, so non-ASCII names are preserved.
    downloadBlob(new Blob([vcard], { type: 'text/vcard;charset=utf-8' }), fileName)
  }, [vcard, fileName, hasName])

  const copyCard = useCallback(() => {
    if (!navigator.clipboard) return
    navigator.clipboard
      .writeText(vcard)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {
        /* clipboard refused */
      })
  }, [vcard])

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="vc-first">First name</Label>
              <Input id="vc-first" value={fields.first} onChange={set('first')} placeholder="Ada" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="vc-last">Last name</Label>
              <Input id="vc-last" value={fields.last} onChange={set('last')} placeholder="Lovelace" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="vc-org">Organization</Label>
              <Input id="vc-org" value={fields.org} onChange={set('org')} placeholder="Analytical Engines Ltd" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="vc-title">Title</Label>
              <Input id="vc-title" value={fields.title} onChange={set('title')} placeholder="Chief Mathematician" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="vc-phone">Phone</Label>
              <Input id="vc-phone" type="tel" value={fields.phone} onChange={set('phone')} placeholder="+44 20 7000 0000" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="vc-email">Email</Label>
              <Input id="vc-email" type="email" value={fields.email} onChange={set('email')} placeholder="ada@example.com" className="mt-2" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="vc-web">Website</Label>
              <Input id="vc-web" type="url" value={fields.web} onChange={set('web')} placeholder="https://example.com/ada" className="mt-2" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="vc-note">Note</Label>
              <Textarea
                id="vc-note"
                value={fields.note}
                onChange={set('note')}
                placeholder="Anything worth remembering — newlines become the escaped \\n sequence in the card."
                className="mt-2 min-h-20"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">vCard 3.0 preview</p>
              <Button type="button" variant="outline" size="sm" onClick={copyCard} disabled={!hasName}>
                {copied ? (
                  <Check className="size-3.5 text-primary" aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
                {copied ? 'Copied' : 'Copy text'}
              </Button>
            </div>
            <pre
              data-testid="vc-preview"
              className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border bg-muted/30 p-3 font-mono text-xs leading-relaxed"
            >
              {vcard}
            </pre>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Commas, semicolons and backslashes are escaped per RFC 2426 — the QR encodes exactly this text.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex w-full flex-col items-center gap-3 rounded-xl border bg-card p-6">
            {hasName && qr ? (
              <img
                src={qr}
                alt="QR code for this contact card"
                data-testid="vc-qr"
                width={240}
                height={240}
                className="rounded-lg border bg-white"
              />
            ) : hasName ? (
              <div className="flex h-[240px] w-[240px] items-center justify-center rounded-lg border bg-muted/30">
                <p className="text-sm text-muted-foreground">Rendering QR…</p>
              </div>
            ) : (
              <div className="flex h-[240px] w-[240px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 text-center">
                <QrCode className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="px-4 text-sm text-muted-foreground">Add at least a name to generate the card</p>
              </div>
            )}
            {hasName && qrError && (
              <p role="alert" className="text-sm text-destructive">
                {qrError}
              </p>
            )}
          </div>

          <Button type="button" onClick={downloadVcf} disabled={!hasName} className="w-full sm:w-auto">
            <Download className="size-4" aria-hidden="true" /> Download .vcf
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            QRs this dense scan best at ≥ 3 cm printed — larger is more reliable. On screen, a phone reads it straight from this preview.
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Saved as {fileName} — non-ASCII names are written as UTF-8, never mangled.
          </p>
        </div>
      </div>

      <PrivacyStrip detail="The card is built as UTF-8 text in this tab, the QR is rendered by a local library, and the .vcf download comes straight from your browser. No contact is stored, logged or sent anywhere." />
    </div>
  )
}
