'use client'

// QR Generator — link / text / Wi-Fi / vCard QR codes rendered locally with
// the `qrcode` library, downloadable as a crisp PNG.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import QRLib from 'qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip, downloadBlob } from '@/components/instant/instant-kit'
import { QrScanPanel } from '@/components/instant/qr-scan-panel'

type Kind = 'link' | 'text' | 'wifi' | 'vcard' | 'scan'
type Ecc = 'L' | 'M' | 'Q' | 'H'

const KINDS: Array<[Kind, string]> = [
  ['link', 'Link'],
  ['text', 'Text'],
  ['wifi', 'Wi-Fi'],
  ['vcard', 'Contact card'],
  ['scan', 'Scan'],
]

function wifiPayload(ssid: string, password: string, encryption: 'WPA' | 'WEP' | 'nopass', hidden: boolean): string {
  return `WIFI:T:${encryption};S:${ssid};P:${password};${hidden ? 'H:true;' : ''};`
}

function vcardPayload(name: string, org: string, phone: string, email: string, url: string): string {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    `N:${name}`,
    org ? `ORG:${org}` : '',
    phone ? `TEL:${phone}` : '',
    email ? `EMAIL:${email}` : '',
    url ? `URL:${url}` : '',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\n')
}

export function QrTool() {
  const [kind, setKind] = useState<Kind>('link')
  const [link, setLink] = useState('https://')
  const [text, setText] = useState('')
  const [ssid, setSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  const [encryption, setEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA')
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [url, setUrl] = useState('')
  const [size, setSize] = useState(512)
  const [ecc, setEcc] = useState<Ecc>('M')

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // The payload is a pure function of the form — memoized, never an effect.
  const payloadResult = useMemo<{ value: string; error: string | null }>(() => {
    let value = ''
    switch (kind) {
      case 'link':
        value = link.trim()
        break
      case 'text':
        value = text
        break
      case 'wifi':
        value = ssid.trim() ? wifiPayload(ssid, wifiPassword, encryption, false) : ''
        break
      case 'vcard':
        value = name.trim() ? vcardPayload(name, org, phone, email, url) : ''
        break
    }
    return { value, error: null }
  }, [kind, link, text, ssid, wifiPassword, encryption, name, org, phone, email, url])
  const payload = payloadResult.value
  const [drawError, setDrawError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!payload) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    QRLib.toCanvas(canvas, payload, {
      width: 480,
      errorCorrectionLevel: ecc,
      margin: 2,
      color: { dark: '#0e3a30', light: '#ffffff' },
    })
      .then(() => setDrawError(null))
      .catch(() => setDrawError('That content is too long for one QR code — shorten it.'))
  }, [payload, ecc])

  function download() {
    const canvas = canvasRef.current
    if (!canvas || !payload) return
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `qr-${kind}.png`)
    }, 'image/png')
  }

  const hasContent = payload.trim().length > 0
  const error = drawError

  const kindTabs = (
    <div className="flex flex-wrap gap-1.5 rounded-full border bg-muted/40 p-1 w-fit" role="tablist" aria-label="QR type">
      {KINDS.map(([k, label]) => (
        <button
          key={k}
          role="tab"
          aria-selected={kind === k}
          onClick={() => setKind(k)}
          className={
            kind === k
              ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
              : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground'
          }
        >
          {label}
        </button>
      ))}
    </div>
  )

  // The Scan tab replaces the whole generator surface — camera and image
  // decoding live in their own panel with the same pill row on top.
  if (kind === 'scan') {
    return (
      <div className="space-y-6">
        {kindTabs}
        <QrScanPanel />
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        {kindTabs}

        <div className="mt-4 space-y-4">
          {kind === 'link' && (
            <div>
              <Label htmlFor="qr-link">URL</Label>
              <Input id="qr-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://example.com" className="mt-2" />
              <p className="mt-1.5 text-xs text-muted-foreground">Opening the camera app on a phone will visit this address.</p>
            </div>
          )}
          {kind === 'text' && (
            <div>
              <Label htmlFor="qr-text">Text</Label>
              <Textarea id="qr-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Any text — a note, a code, an address…" className="mt-2 min-h-28" />
            </div>
          )}
          {kind === 'wifi' && (
            <>
              <div>
                <Label htmlFor="qr-ssid">Network name (SSID)</Label>
                <Input id="qr-ssid" value={ssid} onChange={(e) => setSsid(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="qr-wifipass">Password</Label>
                <Input id="qr-wifipass" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>Security</Label>
                <div className="mt-2 flex gap-1.5 rounded-full border bg-muted/40 p-1 w-fit">
                  {(['WPA', 'WEP', 'nopass'] as const).map((enc) => (
                    <button
                      key={enc}
                      role="tab"
                      aria-selected={encryption === enc}
                      onClick={() => setEncryption(enc)}
                      className={
                        encryption === enc
                          ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                          : 'rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground'
                      }
                    >
                      {enc === 'nopass' ? 'Open' : enc}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Guests scan it and join — no more reading passwords aloud.</p>
            </>
          )}
          {kind === 'vcard' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="qr-name">Full name</Label>
                <Input id="qr-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="qr-org">Organization</Label>
                <Input id="qr-org" value={org} onChange={(e) => setOrg(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="qr-phone">Phone</Label>
                <Input id="qr-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="qr-email">Email</Label>
                <Input id="qr-email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="qr-url">Website</Label>
                <Input id="qr-url" value={url} onChange={(e) => setUrl(e.target.value)} className="mt-2" />
              </div>
            </div>
          )}

          {/* render options */}
          <div className="flex flex-wrap items-end gap-4 border-t pt-4">
            <div>
              <Label htmlFor="qr-size">Download size: {size} px</Label>
              <Input id="qr-size" type="number" min={128} max={2048} step={64} value={size} onChange={(e) => setSize(Math.min(2048, Math.max(128, Number(e.target.value) || 512)))} className="mt-2 w-28" />
            </div>
            <div>
              <Label>Error correction</Label>
              <div className="mt-2 flex gap-1.5 rounded-full border bg-muted/40 p-1 w-fit">
                {(['L', 'M', 'Q', 'H'] as Ecc[]).map((level) => (
                  <button
                    key={level}
                    role="tab"
                    aria-selected={ecc === level}
                    onClick={() => setEcc(level)}
                    title={{ L: '7% damage tolerable', M: '15%', Q: '25%', H: '30%' }[level]}
                    className={
                      ecc === level
                        ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                        : 'rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground'
                    }
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* preview */}
      <div className="flex flex-col items-center justify-start gap-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <canvas
            ref={canvasRef}
            width={480}
            height={480}
            aria-label={payload ? `QR code preview for your ${kind}` : 'QR code preview (empty)'}
            className="max-w-full"
          />
        </div>
        <Button size="sm" onClick={download} disabled={!hasContent}>
          <Download className="size-4" aria-hidden="true" /> Download PNG ({size} px)
        </Button>
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {!hasContent && !error && (
          <p className="text-sm text-muted-foreground">Fill in the details — the code renders as you type.</p>
        )}
      </div>

      <div className="lg:col-span-2">
        <PrivacyStrip detail="The code is drawn on this device with a local renderer. The content never touches a server." />
      </div>
    </div>
  )
}
