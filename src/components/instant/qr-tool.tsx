'use client'

// QR Studio — link / text / Wi-Fi / contact card / UPI payment QR codes with
// logo embedding, error-correction guidance, contrast checking and CSV-style
// batch export. Everything renders locally with the `qrcode` library; the
// encoded payload is always shown so you can verify before you print.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Check, Download, FileArchive, TriangleAlert, ImagePlus, X } from 'lucide-react'
import QRLib from 'qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip, downloadBlob } from '@/components/instant/instant-kit'
import { QrScanPanel } from '@/components/instant/qr-scan-panel'

type Kind = 'link' | 'text' | 'wifi' | 'vcard' | 'upi' | 'scan'
type Ecc = 'L' | 'M' | 'Q' | 'H'

const KINDS: Array<[Kind, string]> = [
  ['link', 'Link'],
  ['text', 'Text'],
  ['wifi', 'Wi-Fi'],
  ['vcard', 'Contact card'],
  ['upi', 'UPI'],
  ['scan', 'Scan'],
]

const ECC_NOTE: Record<Ecc, string> = {
  L: '7% damage tolerable',
  M: '15% damage tolerable',
  Q: '25% — minimum for logos',
  H: '30% — best for logos',
}

const FG_SWATCHES = ['#0e3a30', '#1c1917', '#57534e', '#7c2d12', '#701a75', '#14532d']
const BG_SWATCHES = ['#ffffff', '#fefce8', '#f0fdf4', '#fdf2f8']

/* ------------------------------- escaping --------------------------------- */

function wifiEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/([;,:"])/g, '\\$1')
}

function vcardEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1')
}

function wifiPayload(ssid: string, password: string, encryption: 'WPA' | 'WEP' | 'nopass', hidden: boolean): string {
  const parts = [`WIFI:T:${encryption}`, `S:${wifiEscape(ssid)}`]
  if (encryption !== 'nopass') parts.push(`P:${wifiEscape(password)}`)
  if (hidden) parts.push('H:true')
  return `${parts.join(';')};`
}

function vcardPayload(fields: {
  name: string
  org: string
  title: string
  phone: string
  email: string
  url: string
  address: string
  note: string
}): string {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${vcardEscape(fields.name)}`,
    `N:${vcardEscape(fields.name)}`,
    fields.org ? `ORG:${vcardEscape(fields.org)}` : '',
    fields.title ? `TITLE:${vcardEscape(fields.title)}` : '',
    fields.phone ? `TEL;TYPE=CELL:${vcardEscape(fields.phone)}` : '',
    fields.email ? `EMAIL:${vcardEscape(fields.email)}` : '',
    fields.url ? `URL:${vcardEscape(fields.url)}` : '',
    fields.address ? `ADR;TYPE=WORK:;;${vcardEscape(fields.address)}` : '',
    fields.note ? `NOTE:${vcardEscape(fields.note)}` : '',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\n')
}

function upiPayload(pa: string, pn: string, am: string, tn: string): string {
  const params = [`pa=${encodeURIComponent(pa)}`, `pn=${encodeURIComponent(pn)}`]
  if (am.trim() !== '') params.push(`am=${encodeURIComponent(am)}`, 'cu=INR')
  if (tn.trim() !== '') params.push(`tn=${encodeURIComponent(tn)}`)
  return `upi://pay?${params.join('&')}`
}

/* ------------------------------- contrast --------------------------------- */

function relLuminance(hex: string): number {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m.slice(0, 6)
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a)
  const lb = relLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/* ------------------------------ component --------------------------------- */

export function QrTool() {
  const [kind, setKind] = useState<Kind>('link')
  const [link, setLink] = useState('https://')
  const [text, setText] = useState('')
  const [ssid, setSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  const [encryption, setEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA')
  const [hiddenWifi, setHiddenWifi] = useState(false)
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [title, setTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [url, setUrl] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [upiPa, setUpiPa] = useState('')
  const [upiPn, setUpiPn] = useState('')
  const [upiAm, setUpiAm] = useState('')
  const [upiTn, setUpiTn] = useState('')

  const [size, setSize] = useState(512)
  const [margin, setMargin] = useState(2)
  const [ecc, setEcc] = useState<Ecc>('M')
  const [fg, setFg] = useState('#0e3a30')
  const [bg, setBg] = useState('#ffffff')
  const [transparent, setTransparent] = useState(false)

  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null)
  const [logoName, setLogoName] = useState('')
  const [logoPct, setLogoPct] = useState(22)

  const [batch, setBatch] = useState('')
  const [batchStatus, setBatchStatus] = useState('')

  const [copied, setCopied] = useState(false)
  const [drawError, setDrawError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const bgLight = transparent ? '#00000000' : bg

  // The payload is a pure function of the form — memoized, never an effect.
  const payloadResult = useMemo<{ value: string; error: string | null }>(() => {
    let value = ''
    let error: string | null = null
    switch (kind) {
      case 'link':
        value = link.trim()
        if (value && !/^https?:\/\//i.test(value) && !/^[a-z][a-z0-9+.-]*:/i.test(value)) {
          value = `https://${value}`
        }
        break
      case 'text':
        value = text
        break
      case 'wifi':
        value = ssid.trim() ? wifiPayload(ssid, wifiPassword, encryption, hiddenWifi) : ''
        if (encryption !== 'nopass' && ssid.trim() && !wifiPassword) {
          error = 'This network has a password — add it, or switch security to "Open".'
        }
        break
      case 'vcard':
        value = name.trim() ? vcardPayload({ name, org, title, phone, email, url, address, note }) : ''
        break
      case 'upi': {
        const pa = upiPa.trim()
        if (pa) {
          if (!pa.includes('@')) {
            error = 'A UPI ID looks like name@bank — the @ is required.'
          } else if (upiAm.trim() !== '' && !(Number(upiAm) > 0)) {
            error = 'Amount must be a positive number, or blank for "enter amount on payment".'
          } else {
            value = upiPayload(pa, upiPn.trim() || pa.split('@')[0], upiAm.trim(), upiTn.trim())
          }
        }
        break
      }
    }
    return { value, error }
  }, [kind, link, text, ssid, wifiPassword, encryption, hiddenWifi, name, org, title, phone, email, url, address, note, upiPa, upiPn, upiAm, upiTn])

  const payload = payloadResult.value
  const formError = payloadResult.error

  const contrast = contrastRatio(fg, '#ffffff')
  const lowContrast = contrast < 3
  const logoNeedsEcc = logoImg !== null && (ecc === 'L' || ecc === 'M')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!payload) {
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    QRLib.toCanvas(canvas, payload, {
      width: 480,
      errorCorrectionLevel: ecc,
      margin,
      color: { dark: fg, light: bgLight },
    })
      .then(() => {
        if (logoImg && ctx) {
          const px = canvas.width * (logoPct / 100)
          const pad = px * 0.18
          const box = px + pad * 2
          const x = (canvas.width - box) / 2
          const y = (canvas.height - box) / 2
          const r = box * 0.18
          ctx.fillStyle = transparent ? 'rgba(255,255,255,0.92)' : '#ffffff'
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath()
            ctx.roundRect(x, y, box, box, r)
            ctx.fill()
          } else {
            ctx.fillRect(x, y, box, box)
          }
          const ratio = Math.min(px / logoImg.width, px / logoImg.height)
          const lw = logoImg.width * ratio
          const lh = logoImg.height * ratio
          ctx.drawImage(logoImg, (canvas.width - lw) / 2, (canvas.height - lh) / 2, lw, lh)
        }
        setDrawError(null)
      })
      .catch(() => setDrawError('That content is too long for one QR code — shorten it.'))
  }, [payload, ecc, margin, fg, bgLight, logoImg, logoPct, transparent])

  function renderOffscreen(px: number, text: string): Promise<HTMLCanvasElement> {
    const c = document.createElement('canvas')
    return QRLib.toCanvas(c, text, {
      width: px,
      errorCorrectionLevel: ecc,
      margin,
      color: { dark: fg, light: bgLight },
    }).then(() => {
      const ctx = c.getContext('2d')
      if (logoImg && ctx) {
        const lpx = c.width * (logoPct / 100)
        const pad = lpx * 0.18
        const box = lpx + pad * 2
        const x = (c.width - box) / 2
        const y = (c.height - box) / 2
        ctx.fillStyle = transparent ? 'rgba(255,255,255,0.92)' : '#ffffff'
        ctx.fillRect(x, y, box, box)
        const ratio = Math.min(lpx / logoImg.width, lpx / logoImg.height)
        ctx.drawImage(logoImg, (c.width - lpx) / 2, (c.height - lpx) / 2, logoImg.width * ratio, logoImg.height * ratio)
      }
      return c
    })
  }

  function download() {
    if (!payload) return
    renderOffscreen(size, payload).then((c) => {
      c.toBlob((blob) => {
        if (blob) downloadBlob(blob, `qr-${kind}.png`)
      }, 'image/png')
    })
  }

  async function runBatch() {
    const lines = batch.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 200)
    if (lines.length === 0) {
      setBatchStatus('Nothing to generate — one payload per line.')
      return
    }
    setBatchStatus(`Rendering ${lines.length} codes…`)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      for (let i = 0; i < lines.length; i++) {
        const line = kind === 'link' && !/^https?:\/\//i.test(lines[i]) && !/^[a-z][a-z0-9+.-]*:/i.test(lines[i]) ? `https://${lines[i]}` : lines[i]
        const c = await renderOffscreen(size, line)
        const dataUrl = c.toDataURL('image/png')
        zip.file(`qr-${String(i + 1).padStart(3, '0')}.png`, dataUrl.split(',')[1], { base64: true })
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, `qr-batch-${lines.length}.zip`)
      setBatchStatus(`Done — ${lines.length} PNG files zipped, nothing left this device.`)
    } catch {
      setBatchStatus('Batch failed — a line may be too long for one QR code.')
    }
  }

  function copyPayload() {
    if (!payload) return
    navigator.clipboard
      .writeText(payload)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => setCopied(false))
  }

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        setLogoImg(img)
        setLogoName(file.name)
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const hasContent = payload.trim().length > 0
  const batchAllowed = kind === 'link' || kind === 'text'

  const kindTabs = (
    <div className="flex flex-wrap gap-1.5 rounded-full border bg-muted/40 p-1 w-fit" role="tablist" aria-label="QR type">
      {KINDS.map(([k, label]) => (
        <button
          key={k}
          role="tab"
          aria-selected={kind === k}
          onClick={() => setKind(k)}
          data-testid={`qr-mode-${k}`}
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
              <Input id="qr-link" data-testid="qr-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://example.com" className="mt-2" />
              <p className="mt-1.5 text-xs text-muted-foreground">A scheme is added for you — "example.com" becomes "https://example.com". Phone cameras will visit this address.</p>
            </div>
          )}
          {kind === 'text' && (
            <div>
              <Label htmlFor="qr-text">Text</Label>
              <Textarea id="qr-text" data-testid="qr-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Any text — a note, a code, an address…" className="mt-2 min-h-28" />
            </div>
          )}
          {kind === 'wifi' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="qr-ssid">Network name (SSID)</Label>
                  <Input id="qr-ssid" data-testid="qr-ssid" value={ssid} onChange={(e) => setSsid(e.target.value)} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="qr-wifipass">Password</Label>
                  <Input id="qr-wifipass" data-testid="qr-wifipass" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} className="mt-2" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <Label>Security</Label>
                  <div className="mt-2 flex gap-1.5 rounded-full border bg-muted/40 p-1 w-fit">
                    {(['WPA', 'WEP', 'nopass'] as const).map((enc) => (
                      <button
                        key={enc}
                        role="tab"
                        aria-selected={encryption === enc}
                        onClick={() => setEncryption(enc)}
                        data-testid={`qr-enc-${enc}`}
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
                <label className="flex min-h-[44px] items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={hiddenWifi} onChange={(e) => setHiddenWifi(e.target.checked)} data-testid="qr-wifi-hidden" className="accent-emerald-700" aria-label="Network broadcasts as hidden" />
                  Hidden network
                </label>
              </div>
              <p className="text-xs text-muted-foreground">Special characters in the name or password are escaped per the Wi-Fi QR spec, so phones parse them correctly.</p>
            </>
          )}
          {kind === 'vcard' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="qr-name">Full name</Label>
                <Input id="qr-name" data-testid="qr-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="qr-org">Organization</Label>
                <Input id="qr-org" value={org} onChange={(e) => setOrg(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="qr-title">Job title</Label>
                <Input id="qr-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="qr-phone">Phone</Label>
                <Input id="qr-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="qr-email">Email</Label>
                <Input id="qr-email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="qr-url">Website</Label>
                <Input id="qr-url" value={url} onChange={(e) => setUrl(e.target.value)} className="mt-2" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="qr-address">Address</Label>
                <Input id="qr-address" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-2" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="qr-note">Note</Label>
                <Input id="qr-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-2" placeholder="e.g. Met at the Pune meetup" />
              </div>
            </div>
          )}
          {kind === 'upi' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="qr-upi-pa">UPI ID (payee address)</Label>
                  <Input id="qr-upi-pa" data-testid="qr-upi-pa" value={upiPa} onChange={(e) => setUpiPa(e.target.value)} placeholder="shop@okhdfcbank" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="qr-upi-pn">Payee name shown in the app</Label>
                  <Input id="qr-upi-pn" value={upiPn} onChange={(e) => setUpiPn(e.target.value)} placeholder="Sharma General Store" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="qr-upi-am">Fixed amount ₹ (blank = payer enters)</Label>
                  <Input id="qr-upi-am" value={upiAm} onChange={(e) => setUpiAm(e.target.value)} inputMode="decimal" placeholder="199.00" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="qr-upi-tn">Note on the payment</Label>
                  <Input id="qr-upi-tn" value={upiTn} onChange={(e) => setUpiTn(e.target.value)} placeholder="Order #1024" className="mt-2" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Standard <code>upi://pay</code> intent — works in GPay, PhonePe, Paytm and bank apps on Android and iOS. Verify the ID twice: payments go where the code says.
              </p>
            </>
          )}

          {/* design */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label>Foreground</Label>
                <div className="mt-2 flex items-center gap-1.5">
                  {FG_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setFg(c)}
                      aria-label={`Foreground color ${c}`}
                      aria-pressed={fg === c}
                      data-testid={`qr-fg-${c.replace('#', '')}`}
                      className={`h-8 w-8 rounded-md border ${fg === c ? 'ring-2 ring-emerald-700 ring-offset-1' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                  <Input type="color" value={fg} onChange={(e) => setFg(e.target.value)} aria-label="Custom foreground color" data-testid="qr-fg-color" className="h-8 w-10 cursor-pointer p-0.5" />
                </div>
              </div>
              <div>
                <Label>Background</Label>
                <div className="mt-2 flex items-center gap-1.5">
                  {BG_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setBg(c)
                        setTransparent(false)
                      }}
                      aria-label={`Background color ${c}`}
                      aria-pressed={!transparent && bg === c}
                      data-testid={`qr-bg-${c.replace('#', '')}`}
                      className={`h-8 w-8 rounded-md border border-stone-300 ${!transparent && bg === c ? 'ring-2 ring-emerald-700 ring-offset-1' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                  <label className="flex min-h-[44px] items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} data-testid="qr-bg-transparent" className="accent-emerald-700" aria-label="Transparent background" />
                    transparent
                  </label>
                </div>
              </div>
            </div>
            {lowContrast && (
              <p role="alert" data-testid="qr-contrast-warning" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Contrast {contrast.toFixed(1)}:1 is too low to scan reliably — aim for 3:1 or better by darkening the foreground or lightening the background.
              </p>
            )}
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label>Error correction</Label>
                <div className="mt-2 flex gap-1.5 rounded-full border bg-muted/40 p-1 w-fit">
                  {(['L', 'M', 'Q', 'H'] as Ecc[]).map((level) => (
                    <button
                      key={level}
                      role="tab"
                      aria-selected={ecc === level}
                      onClick={() => setEcc(level)}
                      data-testid={`qr-ecc-${level}`}
                      title={ECC_NOTE[level]}
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
              <div>
                <Label htmlFor="qr-size">Download size: {size} px</Label>
                <Input id="qr-size" type="number" min={128} max={2048} step={64} value={size} onChange={(e) => setSize(Math.min(2048, Math.max(128, Number(e.target.value) || 512)))} className="mt-2 w-28" />
              </div>
              <div>
                <Label htmlFor="qr-margin">Quiet zone: {margin} modules</Label>
                <Input id="qr-margin" type="number" min={0} max={4} value={margin} onChange={(e) => setMargin(Math.min(4, Math.max(0, Number(e.target.value) || 0)))} className="mt-2 w-20" />
              </div>
            </div>
            {logoNeedsEcc && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="qr-logo-warning">
                <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                A logo covers part of the code — pick error correction Q or H so it still scans.
                <Button size="sm" variant="outline" className="min-h-[36px]" onClick={() => setEcc('H')}>Use H</Button>
              </div>
            )}
          </div>

          {/* logo */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="qr-logo-input" className="flex items-center gap-1.5">
                <ImagePlus className="h-4 w-4" aria-hidden="true" /> Center logo (optional)
              </Label>
              <Input id="qr-logo-input" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onLogoFile} data-testid="qr-logo-input" className="max-w-56 cursor-pointer" aria-label="Pick a logo image to embed in the QR center" />
              {logoImg && (
                <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => { setLogoImg(null); setLogoName('') }} aria-label="Remove logo">
                  <X className="mr-1 h-4 w-4" aria-hidden="true" /> Remove{logoName ? ` (${logoName})` : ''}
                </Button>
              )}
            </div>
            {logoImg && (
              <div className="flex items-center gap-3">
                <Label htmlFor="qr-logo-size">Logo size: {logoPct}% of code</Label>
                <input
                  id="qr-logo-size"
                  type="range"
                  min={12}
                  max={30}
                  value={logoPct}
                  onChange={(e) => setLogoPct(Number(e.target.value))}
                  data-testid="qr-logo-size"
                  className="w-44 accent-emerald-700"
                  aria-label="Logo size as percent of code width"
                />
              </div>
            )}
          </div>

          {/* batch */}
          {(kind === 'link' || kind === 'text') && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="qr-batch">Batch — one {kind === 'link' ? 'URL' : 'text'} per line (up to 200)</Label>
              <Textarea
                id="qr-batch"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                rows={4}
                data-testid="qr-batch-input"
                className="max-h-40 overflow-y-auto font-mono text-xs"
                placeholder={kind === 'link' ? 'https://shop.example.com/order/1024\nhttps://shop.example.com/order/1025' : 'Table 4 — reserve by Friday\nLocker 12 — code changes monthly'}
                aria-label="Batch payloads, one per line"
              />
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" className="min-h-[44px] border-stone-300" onClick={runBatch} disabled={!batch.trim()} data-testid="qr-batch-run">
                  <FileArchive className="mr-1 h-4 w-4" aria-hidden="true" /> Generate ZIP of PNGs
                </Button>
                {batchStatus && <span className="text-xs text-muted-foreground" data-testid="qr-batch-status">{batchStatus}</span>}
              </div>
            </div>
          )}
          {!batchAllowed && (
            <p className="border-t pt-3 text-xs text-muted-foreground">Batch ZIP export works for Link and Text codes; structured payloads (Wi-Fi, contact, UPI) are one-of-a-kind by design.</p>
          )}
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
        <Button size="sm" onClick={download} disabled={!hasContent} data-testid="qr-download">
          <Download className="size-4" aria-hidden="true" /> Download PNG ({size} px)
        </Button>
        {payload && (
          <div className="w-full max-w-sm rounded-lg border bg-stone-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Encoded payload</span>
              <Button size="sm" variant="ghost" className="min-h-[36px] px-2" onClick={copyPayload} data-testid="qr-copy-payload" aria-label="Copy encoded payload">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre data-testid="qr-payload-preview" className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-stone-700">{payload}</pre>
          </div>
        )}
        {formError && (
          <p role="alert" data-testid="qr-form-error" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        {drawError && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {drawError}
          </p>
        )}
        {!hasContent && !formError && !drawError && (
          <p className="text-sm text-muted-foreground">Fill in the details — the code renders as you type, and the raw payload is always shown so you can verify before printing.</p>
        )}
        <p className="max-w-sm text-center text-xs text-muted-foreground">
          Print tip: keep the quiet zone, at least 2×2 cm printed size, and matte surfaces — glossy laminate eats contrast.
        </p>
      </div>

      <div className="lg:col-span-2">
        <PrivacyStrip detail="Codes are drawn on this device with a local renderer — payloads, logos and batch exports never touch a server." />
      </div>
    </div>
  )
}
