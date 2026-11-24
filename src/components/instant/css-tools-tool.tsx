'use client'

// CSS Style Studio — three generators (gradient, box-shadow, border-radius)
// with live previews and the exact CSS they produce, built entirely in this
// tab. Nothing here needs a server: the preview IS the style applied to a
// real element, and the emitted CSS is generated from the same state, so
// what you copy is what you saw.

import { useMemo, useState } from 'react'
import { Check, Copy, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PrivacyStrip } from '@/components/instant/instant-kit'

// ---------------------------------------------------------------- helpers ----

function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {
        /* clipboard refused — the CSS block is selectable by hand */
      })
  }
  return [copied, copy]
}

function hexColor(v: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback
}

const CHECKER_BG =
  'repeating-conic-gradient(var(--muted) 0% 25%, transparent 0% 50%) 50% / 16px 16px'

function CssBlock({ css, onCopy, copied }: { css: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="text-xs font-medium text-muted-foreground">CSS</span>
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onCopy}>
          {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy CSS'}
        </Button>
      </div>
      <pre
        className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed"
        aria-label="Generated CSS"
      >
        {css}
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------- gradient ---

interface Stop {
  color: string
  pos: number
}

const GRADIENT_PRESETS: { name: string; type: 'linear' | 'radial' | 'conic'; angle: number; stops: Stop[] }[] = [
  { name: 'Sunrise', type: 'linear', angle: 45, stops: [{ color: '#f59e0b', pos: 0 }, { color: '#ef4444', pos: 100 }] },
  { name: 'Forest', type: 'linear', angle: 135, stops: [{ color: '#059669', pos: 0 }, { color: '#a7f3d0', pos: 100 }] },
  { name: 'Dusk', type: 'linear', angle: 180, stops: [{ color: '#0f766e', pos: 0 }, { color: '#134e4a', pos: 60 }, { color: '#1c1917', pos: 100 }] },
  { name: 'Ripple', type: 'radial', angle: 0, stops: [{ color: '#10b981', pos: 0 }, { color: '#f0fdf4', pos: 100 }] },
  { name: 'Color wheel', type: 'conic', angle: 0, stops: [{ color: '#ef4444', pos: 0 }, { color: '#f59e0b', pos: 25 }, { color: '#10b981', pos: 50 }, { color: '#0ea5e9', pos: 75 }, { color: '#ef4444', pos: 100 }] },
]

function GradientTab() {
  const [type, setType] = useState<'linear' | 'radial' | 'conic'>('linear')
  const [angle, setAngle] = useState(135)
  const [posX, setPosX] = useState(50)
  const [posY, setPosY] = useState(50)
  const [stops, setStops] = useState<Stop[]>([
    { color: '#059669', pos: 0 },
    { color: '#a7f3d0', pos: 100 },
  ])
  const [copied, copy] = useCopy()

  const sorted = useMemo(() => [...stops].sort((a, b) => a.pos - b.pos), [stops])
  const stopList = sorted.map((s) => `${s.color} ${s.pos}%`).join(', ')
  const css =
    type === 'linear'
      ? `background-image: linear-gradient(${angle}deg,\n  ${stopList});`
      : type === 'radial'
        ? `background-image: radial-gradient(circle at ${posX}% ${posY}%,\n  ${stopList});`
        : `background-image: conic-gradient(from ${angle}deg at ${posX}% ${posY}%,\n  ${stopList});`

  const updateStop = (i: number, patch: Partial<Stop>) =>
    setStops((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {(['linear', 'radial', 'conic'] as const).map((t) => (
              <Button key={t} type="button" size="sm" variant={type === t ? 'default' : 'outline'} onClick={() => setType(t)}>
                {t}
              </Button>
            ))}
            <span className="mx-1 h-8 w-px bg-border" aria-hidden="true" />
            {GRADIENT_PRESETS.map((p) => (
              <Button
                key={p.name}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setType(p.type)
                  setAngle(p.angle)
                  setStops(p.stops.map((s) => ({ ...s })))
                }}
              >
                {p.name}
              </Button>
            ))}
          </div>

          <div className="mt-4 space-y-4">
            {type === 'linear' ? (
              <div>
                <Label htmlFor="grad-angle">Angle — {angle}°</Label>
                <Slider
                  id="grad-angle"
                  min={0}
                  max={360}
                  step={1}
                  value={[angle]}
                  onValueChange={([v]) => setAngle(v)}
                  className="mt-2"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="grad-x">Center X — {posX}%</Label>
                  <Slider id="grad-x" min={0} max={100} value={[posX]} onValueChange={([v]) => setPosX(v)} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="grad-y">Center Y — {posY}%</Label>
                  <Slider id="grad-y" min={0} max={100} value={[posY]} onValueChange={([v]) => setPosY(v)} className="mt-2" />
                </div>
                {type === 'conic' && (
                  <div className="col-span-2">
                    <Label htmlFor="grad-cangle">Start angle — {angle}°</Label>
                    <Slider id="grad-cangle" min={0} max={360} value={[angle]} onValueChange={([v]) => setAngle(v)} className="mt-2" />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2.5">
              <Label>Color stops</Label>
              {stops.map((stop, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Input
                    type="color"
                    value={stop.color}
                    onChange={(e) => updateStop(i, { color: hexColor(e.target.value, stop.color) })}
                    className="h-9 w-12 cursor-pointer p-1"
                    aria-label={`Stop ${i + 1} color`}
                  />
                  <Slider
                    min={0}
                    max={100}
                    value={[stop.pos]}
                    onValueChange={([v]) => updateStop(i, { pos: v })}
                    className="flex-1"
                    aria-label={`Stop ${i + 1} position`}
                  />
                  <span className="w-12 text-right font-mono text-xs text-muted-foreground">{stop.pos}%</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Remove stop ${i + 1}`}
                    disabled={stops.length <= 2}
                    onClick={() => setStops((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={stops.length >= 8}
                onClick={() =>
                  setStops((prev) => {
                    const last = prev[prev.length - 1]
                    return [...prev, { color: '#0f766e', pos: Math.min(100, last.pos === 100 ? Math.max(0, prev.length * 12) : last.pos) }]
                  })
                }
              >
                <Plus className="size-3.5" aria-hidden="true" /> Add stop
              </Button>
            </div>
          </div>
        </div>
        <CssBlock css={css} onCopy={() => copy(css)} copied={copied} />
      </div>

      <div className="rounded-xl border bg-card p-5" style={{ background: CHECKER_BG }}>
        <div
          className="h-full min-h-[280px] w-full rounded-lg"
          style={{
            backgroundImage:
              type === 'linear'
                ? `linear-gradient(${angle}deg, ${stopList})`
                : type === 'radial'
                  ? `radial-gradient(circle at ${posX}% ${posY}%, ${stopList})`
                  : `conic-gradient(from ${angle}deg at ${posX}% ${posY}%, ${stopList})`,
          }}
          aria-label="Gradient preview"
        />
        <PrivacyStrip detail="The preview applies the exact style string you copy — same state, no rendering gap." />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ shadow ---

interface Shadow {
  x: number
  y: number
  blur: number
  spread: number
  color: string
  inset: boolean
}

const SHADOW_PRESETS: { name: string; layers: Shadow[] }[] = [
  { name: 'Subtle card', layers: [{ x: 0, y: 1, blur: 3, spread: 0, color: '#00000024', inset: false }] },
  { name: 'Raised', layers: [{ x: 0, y: 4, blur: 12, spread: 0, color: '#0000001f', inset: false }] },
  { name: 'Floating', layers: [{ x: 0, y: 12, blur: 28, spread: 0, color: '#00000033', inset: false }] },
  { name: 'Inset well', layers: [{ x: 0, y: 2, blur: 6, spread: 0, color: '#0000001a', inset: true }] },
  { name: 'Ring + shadow', layers: [{ x: 0, y: 0, blur: 0, spread: 3, color: '#05966955', inset: false }, { x: 0, y: 2, blur: 8, spread: 0, color: '#00000026', inset: false }] },
]

function shadowCss(layers: Shadow[]): string {
  const parts = layers.map(
    (s) =>
      `${s.inset ? 'inset ' : ''}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`,
  )
  return `box-shadow:\n  ${parts.join(',\n  ')};`
}

function ShadowTab() {
  const [layers, setLayers] = useState<Shadow[]>([
    { x: 0, y: 4, blur: 12, spread: 0, color: '#0000001f', inset: false },
  ])
  const [copied, copy] = useCopy()
  const css = shadowCss(layers)

  const update = (i: number, patch: Partial<Shadow>) =>
    setLayers((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {SHADOW_PRESETS.map((p) => (
              <Button key={p.name} type="button" size="sm" variant="outline" onClick={() => setLayers(p.layers.map((l) => ({ ...l })))}>
                {p.name}
              </Button>
            ))}
          </div>
          <div className="mt-4 space-y-4">
            {layers.map((s, i) => (
              <div key={i} className="rounded-lg border p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Layer {i + 1}</span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={s.inset} onCheckedChange={(v) => update(i, { inset: v })} aria-label={`Layer ${i + 1} inset`} />
                      inset
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Remove layer ${i + 1}`}
                      disabled={layers.length <= 1}
                      onClick={() => setLayers((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <Label htmlFor={`sh-x-${i}`}>Offset X — {s.x}px</Label>
                    <Slider id={`sh-x-${i}`} min={-40} max={40} value={[s.x]} onValueChange={([v]) => update(i, { x: v })} className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor={`sh-y-${i}`}>Offset Y — {s.y}px</Label>
                    <Slider id={`sh-y-${i}`} min={-40} max={40} value={[s.y]} onValueChange={([v]) => update(i, { y: v })} className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor={`sh-blur-${i}`}>Blur — {s.blur}px</Label>
                    <Slider id={`sh-blur-${i}`} min={0} max={60} value={[s.blur]} onValueChange={([v]) => update(i, { blur: v })} className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor={`sh-spread-${i}`}>Spread — {s.spread}px</Label>
                    <Slider id={`sh-spread-${i}`} min={-30} max={40} value={[s.spread]} onValueChange={([v]) => update(i, { spread: v })} className="mt-2" />
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <Input
                      type="color"
                      value={s.color.slice(0, 7)}
                      onChange={(e) => {
                        const rgb = hexColor(e.target.value, s.color.slice(0, 7))
                        update(i, { color: rgb + s.color.slice(7) })
                      }}
                      className="h-9 w-12 cursor-pointer p-1"
                      aria-label={`Layer ${i + 1} color`}
                    />
                    <Input
                      value={s.color}
                      onChange={(e) => update(i, { color: e.target.value })}
                      className="h-9 flex-1 font-mono text-xs"
                      aria-label={`Layer ${i + 1} color value`}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={layers.length >= 6}
              onClick={() => setLayers((prev) => [...prev, { x: 0, y: 8, blur: 20, spread: 0, color: '#00000026', inset: false }])}
            >
              <Plus className="size-3.5" aria-hidden="true" /> Add layer
            </Button>
          </div>
        </div>
        <CssBlock css={css} onCopy={() => copy(css)} copied={copied} />
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex min-h-[280px] items-center justify-center rounded-lg bg-background/60 p-10">
          <div className="size-36 rounded-xl bg-card" style={{ boxShadow: css.replace(/^box-shadow:\s*/, '').replace(/;\s*$/, '').replace(/\n\s*/g, ' ') }} aria-label="Box shadow preview" />
        </div>
        <PrivacyStrip detail="Layers composite in the order listed, exactly like the CSS cascade applies them." />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ radius ---

const RADIUS_PRESETS: { name: string; values: [number, number, number, number] }[] = [
  { name: 'None', values: [0, 0, 0, 0] },
  { name: 'Subtle', values: [8, 8, 8, 8] },
  { name: 'Round', values: [16, 16, 16, 16] },
  { name: 'Pill', values: [999, 999, 999, 999] },
  { name: 'Leaf', values: [80, 8, 80, 8] },
  { name: 'Blob', values: [40, 120, 60, 140] },
]

function RadiusTab() {
  const [r, setR] = useState<[number, number, number, number]>([16, 16, 16, 16])
  const [linked, setLinked] = useState(true)
  const [copied, copy] = useCopy()

  const unique = [...new Set(r)]
  const css =
    unique.length === 1
      ? `border-radius: ${unique[0]}px;`
      : `border-radius: ${r[0]}px ${r[1]}px ${r[2]}px ${r[3]}px; /* TL TR BR BL */`

  const setCorner = (i: number, v: number) =>
    setR((prev) => (linked ? ([v, v, v, v] as typeof prev) : (prev.map((x, idx) => (idx === i ? v : x)) as typeof prev)))

  const corners = ['Top left', 'Top right', 'Bottom right', 'Bottom left']

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {RADIUS_PRESETS.map((p) => (
              <Button key={p.name} type="button" size="sm" variant="outline" onClick={() => setR([...p.values] as typeof r)}>
                {p.name}
              </Button>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2.5 text-sm">
            <Switch checked={linked} onCheckedChange={setLinked} aria-label="Link all corners" />
            <span>Link all corners</span>
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {r.map((v, i) => (
              <div key={i}>
                <Label htmlFor={`rad-${i}`}>{corners[i]} — {v}px</Label>
                <Slider id={`rad-${i}`} min={0} max={160} step={2} value={[v]} onValueChange={([x]) => setCorner(i, x)} className="mt-2" />
              </div>
            ))}
          </div>
        </div>
        <CssBlock css={css} onCopy={() => copy(css)} copied={copied} />
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex min-h-[280px] items-center justify-center rounded-lg bg-background/60 p-10">
          <div
            className="size-40 bg-primary/15 border border-primary/40"
            style={{ borderRadius: `${Math.min(r[0], 100)}px ${Math.min(r[1], 100)}px ${Math.min(r[2], 100)}px ${Math.min(r[3], 100)}px` }}
            aria-label="Border radius preview"
          />
        </div>
        <PrivacyStrip detail="The preview clamps corners to 100 px so extreme values stay visible; the copied CSS keeps the true numbers." />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------- root ----

export function CssToolsTool() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="gradient">
        <TabsList aria-label="CSS generator">
          <TabsTrigger value="gradient">Gradient</TabsTrigger>
          <TabsTrigger value="shadow">Box shadow</TabsTrigger>
          <TabsTrigger value="radius">Border radius</TabsTrigger>
        </TabsList>
        <TabsContent value="gradient" className="mt-4">
          <GradientTab />
        </TabsContent>
        <TabsContent value="shadow" className="mt-4">
          <ShadowTab />
        </TabsContent>
        <TabsContent value="radius" className="mt-4">
          <RadiusTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
