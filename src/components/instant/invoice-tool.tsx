'use client'

// Invoice Studio — line items, discount, tax-on-the-post-discount-base,
// shipping, notes; a live printable sheet and a print stylesheet that shows
// only the invoice when the browser prints (or saves as PDF). All math is
// plain JS in this tab; nothing is stored or sent.

import { useMemo, useState } from 'react'
import { Plus, Printer, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

interface Item { id: number; desc: string; qty: string; rate: string }

const CURRENCIES = [
  { symbol: '$', label: '$ Dollar' },
  { symbol: '€', label: '€ Euro' },
  { symbol: '£', label: '£ Pound' },
  { symbol: '₹', label: '₹ Rupee' },
  { symbol: '¥', label: '¥ Yen' },
  { symbol: 'A$', label: 'A$ Australian dollar' },
  { symbol: 'C$', label: 'C$ Canadian dollar' },
]

const today = () => new Date().toISOString().slice(0, 10)
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

function money(n: number, symbol: string): string {
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #invoice-sheet, #invoice-sheet * { visibility: visible !important; }
  #invoice-sheet {
    position: absolute !important;
    left: 0 !important; top: 0 !important;
    width: 100% !important;
    max-width: none !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
  }
  @page { margin: 14mm; }
}
`

export function InvoiceTool() {
  const [seller, setSeller] = useState('Your name / business\nAddress line\nemail@example.com')
  const [buyer, setBuyer] = useState('Client name\nClient address')
  const [number, setNumber] = useState('INV-001')
  const [issue, setIssue] = useState(today())
  const [due, setDue] = useState(daysFromNow(14))
  const [currency, setCurrency] = useState('$')
  const [customCurrency, setCustomCurrency] = useState('')
  const [items, setItems] = useState<Item[]>([
    { id: 1, desc: 'Website design', qty: '1', rate: '500' },
    { id: 2, desc: 'Hosting (12 months)', qty: '1', rate: '120' },
  ])
  const [discountMode, setDiscountMode] = useState<'percent' | 'flat'>('percent')
  const [discount, setDiscount] = useState('')
  const [taxRate, setTaxRate] = useState('')
  const [shipping, setShipping] = useState('')
  const [notes, setNotes] = useState('Thank you for your business.')
  const [terms, setTerms] = useState('Payment due within 14 days by bank transfer.')

  const symbol = currency === 'custom' ? customCurrency || '$' : currency

  const math = useMemo(() => {
    const subtotal = items.reduce((acc, it) => {
      const qty = Number(it.qty)
      const rate = Number(it.rate)
      return acc + (Number.isFinite(qty) && Number.isFinite(rate) ? qty * rate : 0)
    }, 0)
    const d = Number(discount)
    const discountValue = Number.isFinite(d) && d > 0
      ? (discountMode === 'percent' ? (subtotal * Math.min(d, 100)) / 100 : Math.min(d, subtotal))
      : 0
    const base = Math.max(0, subtotal - discountValue)
    const t = Number(taxRate)
    const tax = Number.isFinite(t) && t > 0 ? (base * Math.min(t, 100)) / 100 : 0
    const s = Number(shipping)
    const ship = Number.isFinite(s) && s > 0 ? s : 0
    const total = base + tax + ship
    return { subtotal, discountValue, base, tax, ship, total }
  }, [items, discount, discountMode, taxRate, shipping])

  const addItem = () => setItems((xs) => [...xs, { id: Date.now(), desc: '', qty: '1', rate: '' }])
  const removeItem = (id: number) => setItems((xs) => (xs.length > 1 ? xs.filter((x) => x.id !== id) : xs))
  const patch = (id: number, key: keyof Item, value: string) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, [key]: value } : x)))

  const field = 'mt-1.5 block w-full'
  const labelCls = 'text-xs font-medium text-muted-foreground'

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.05fr]">
        {/* ------------------------------------------------ editor column */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Invoice details</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <span className={labelCls}>Invoice number</span>
                <Input id="inv-number" value={number} onChange={(e) => setNumber(e.target.value)} className={field} />
              </div>
              <div>
                <span className={labelCls}>Issue date</span>
                <Input id="inv-issue" type="date" value={issue} onChange={(e) => setIssue(e.target.value)} className={field} />
              </div>
              <div>
                <span className={labelCls}>Due date</span>
                <Input id="inv-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="inv-currency" className={cn(labelCls, 'mt-3 block')}>Currency</Label>
                <select
                  id="inv-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1.5 h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.symbol} value={c.symbol}>{c.label}</option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
              </div>
              {currency === 'custom' && (
                <div>
                  <span className={labelCls}>Custom symbol</span>
                  <Input id="inv-custom-currency" value={customCurrency} onChange={(e) => setCustomCurrency(e.target.value)} className={field} />
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <Label htmlFor="inv-seller" className={labelCls}>From (seller)</Label>
              <textarea
                id="inv-seller"
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
                rows={4}
                className="mt-1.5 w-full rounded-md border bg-background p-2.5 text-sm"
              />
            </div>
            <div className="rounded-xl border bg-card p-4">
              <Label htmlFor="inv-buyer" className={labelCls}>Bill to (buyer)</Label>
              <textarea
                id="inv-buyer"
                value={buyer}
                onChange={(e) => setBuyer(e.target.value)}
                rows={4}
                className="mt-1.5 w-full rounded-md border bg-background p-2.5 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Line items</h2>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="size-4" aria-hidden="true" /> Add item
              </Button>
            </div>
            <div className="mt-3 space-y-2.5">
              {items.map((it, i) => (
                <div key={it.id} className="grid grid-cols-[1fr_5rem_6.5rem_2rem] items-center gap-2">
                  <Input
                    aria-label={`Item ${i + 1} description`}
                    placeholder="Description"
                    value={it.desc}
                    onChange={(e) => patch(it.id, 'desc', e.target.value)}
                  />
                  <Input
                    aria-label={`Item ${i + 1} quantity`}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Qty"
                    value={it.qty}
                    onChange={(e) => patch(it.id, 'qty', e.target.value)}
                    className="font-mono"
                  />
                  <Input
                    aria-label={`Item ${i + 1} unit rate`}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Rate"
                    value={it.rate}
                    onChange={(e) => patch(it.id, 'rate', e.target.value)}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove item ${i + 1}`}
                    onClick={() => removeItem(it.id)}
                    disabled={items.length === 1}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="inv-discount" className={labelCls}>Discount</Label>
                <div className="mt-1.5 flex gap-1.5">
                  <Input
                    id="inv-discount"
                    type="number"
                    min="0"
                    step="any"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="font-mono"
                    placeholder="0"
                  />
                  <select
                    aria-label="Discount type"
                    value={discountMode}
                    onChange={(e) => setDiscountMode(e.target.value as 'percent' | 'flat')}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="percent">%</option>
                    <option value="flat">{symbol}</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="inv-tax" className={labelCls}>Tax / VAT %</Label>
                <Input
                  id="inv-tax"
                  type="number"
                  min="0"
                  step="any"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className={cn(field, 'font-mono')}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="inv-shipping" className={labelCls}>Shipping</Label>
                <Input
                  id="inv-shipping"
                  type="number"
                  min="0"
                  step="any"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  className={cn(field, 'font-mono')}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="inv-notes" className={labelCls}>Notes</Label>
                <textarea id="inv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1.5 w-full rounded-md border bg-background p-2.5 text-sm" />
              </div>
              <div>
                <Label htmlFor="inv-terms" className={labelCls}>Payment terms</Label>
                <textarea id="inv-terms" value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} className="mt-1.5 w-full rounded-md border bg-background p-2.5 text-sm" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 text-sm sm:p-5">
            <h2 className="text-sm font-semibold">The math, shown</h2>
            <dl className="mt-2.5 space-y-1.5 font-mono text-[13px]">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(math.subtotal, symbol)}</dd></div>
              <div className="flex justify-between">
                <dt>Discount {discount ? (discountMode === 'percent' ? `(${discount}%)` : '(flat)') : ''}</dt>
                <dd>−{money(math.discountValue, symbol)}</dd>
              </div>
              <div className="flex justify-between"><dt>Taxable base</dt><dd>{money(math.base, symbol)}</dd></div>
              <div className="flex justify-between"><dt>Tax {taxRate ? `(${taxRate}% of base)` : ''}</dt><dd>{money(math.tax, symbol)}</dd></div>
              <div className="flex justify-between"><dt>Shipping</dt><dd>{money(math.ship, symbol)}</dd></div>
              <div className="flex justify-between border-t pt-1.5 font-semibold"><dt>Total</dt><dd>{money(math.total, symbol)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              Tax applies to the post-discount base — discount first, then tax, then shipping on top.
            </p>
          </div>
        </div>

        {/* ------------------------------------------- live printable sheet */}
        <div>
          <div className="sticky top-20">
            <div id="invoice-sheet" className="rounded-xl border bg-card p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold tracking-tight">Invoice</p>
                  <p className="mt-0.5 font-mono text-sm text-muted-foreground">{number || '—'}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Issued <span className="font-medium text-foreground">{issue || '—'}</span></p>
                  <p className="mt-0.5">Due <span className="font-medium text-foreground">{due || '—'}</span></p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
                <div>
                  <p className="font-semibold uppercase tracking-wide text-muted-foreground">From</p>
                  <p className="mt-1 whitespace-pre-line leading-relaxed text-foreground/90">{seller || '—'}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-muted-foreground">Bill to</p>
                  <p className="mt-1 whitespace-pre-line leading-relaxed text-foreground/90">{buyer || '—'}</p>
                </div>
              </div>
              <table className="mt-5 w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 font-medium">Description</th>
                    <th className="py-1.5 text-right font-medium">Qty</th>
                    <th className="py-1.5 text-right font-medium">Rate</th>
                    <th className="py-1.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">No items yet</td></tr>
                  )}
                  {items.map((it) => {
                    const qty = Number(it.qty)
                    const rate = Number(it.rate)
                    const amount = Number.isFinite(qty) && Number.isFinite(rate) ? qty * rate : 0
                    return (
                      <tr key={it.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-2">{it.desc || <span className="text-muted-foreground">—</span>}</td>
                        <td className="py-1.5 text-right font-mono">{Number.isFinite(qty) ? qty : '—'}</td>
                        <td className="py-1.5 text-right font-mono">{Number.isFinite(rate) ? money(rate, symbol) : '—'}</td>
                        <td className="py-1.5 text-right font-mono">{money(amount, symbol)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="mt-4 flex justify-end">
                <table className="w-64 text-xs">
                  <tbody className="[&_td]:py-1">
                    <tr><td>Subtotal</td><td className="text-right font-mono">{money(math.subtotal, symbol)}</td></tr>
                    {math.discountValue > 0 && (
                      <tr><td>Discount{discountMode === 'percent' && discount ? ` (${discount}%)` : ''}</td><td className="text-right font-mono">−{money(math.discountValue, symbol)}</td></tr>
                    )}
                    {math.tax > 0 && <tr><td>Tax{taxRate ? ` (${taxRate}%)` : ''}</td><td className="text-right font-mono">{money(math.tax, symbol)}</td></tr>}
                    {math.ship > 0 && <tr><td>Shipping</td><td className="text-right font-mono">{money(math.ship, symbol)}</td></tr>}
                    <tr className="border-t font-semibold"><td className="pt-1.5">Total</td><td className="pt-1.5 text-right font-mono">{money(math.total, symbol)}</td></tr>
                  </tbody>
                </table>
              </div>
              {(notes || terms) && (
                <div className="mt-5 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                  {notes && <p className="whitespace-pre-line">{notes}</p>}
                  {terms && <p className="mt-1.5 whitespace-pre-line">{terms}</p>}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <Button type="button" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden="true" /> Print invoice
              </Button>
              <p className="text-xs text-muted-foreground">
                The print dialog also offers “Save as PDF”.
              </p>
            </div>
          </div>
        </div>
      </div>

      <PrivacyStrip detail="The invoice is composed and printed entirely in this tab — the Print button calls your own browser, which is also where “Save as PDF” lives. No field ever leaves the device and nothing is stored." />
    </div>
  )
}
