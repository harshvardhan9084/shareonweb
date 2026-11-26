'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  ChartLine,
  ChartPie,
  AreaChart,
  ScatterChart,
  Download,
  Image as ImageIcon,
  Table,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip, downloadBlob } from '@/components/instant/instant-kit'

/* ---------------------------------- types --------------------------------- */

type Row = { label: string; values: Array<number | null> }

type ChartKind = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter'

type SeriesMeta = { name: string; color: string; visible: boolean }

type Options = {
  title: string
  xLabel: string
  yLabel: string
  showGrid: boolean
  showLegend: boolean
  yMin: string
  yMax: string
}

/* -------------------------------- palette --------------------------------- */

const PALETTE = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
  '#ec4899', // pink
  '#84cc16', // lime
  '#a16207', // dark amber
  '#64748b', // slate
]

const SAMPLE = `Month,Savings,Spending
Jan,1200,850
Feb,1350,910
Mar,1100,1020
Apr,1500,870
May,1620,940
Jun,1810,760`

/* --------------------------------- parsing -------------------------------- */

function parseData(text: string): { rows: Array<Row>; series: Array<string> } | { error: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length < 2) return { error: 'Need a header row plus at least one data row.' }

  const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ','
  const header = lines[0].split(delim).map((h) => h.trim())
  if (header.length < 2) return { error: 'Need at least one label column and one numeric column.' }

  const series = header.slice(1).map((h, i) => (h || `Series ${i + 1}`))
  const rows: Array<Row> = []
  const maxLen = header.length

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map((c) => c.trim())
    const label = cells[0] ?? `Row ${i}`
    const values: Array<number | null> = []
    for (let c = 1; c < maxLen; c++) {
      const raw = (cells[c] ?? '').replace(/[,\s]/g, '').replace(/%$/, '')
      if (raw === '') values.push(null)
      else {
        const n = Number(raw)
        values.push(Number.isFinite(n) ? n : null)
      }
    }
    rows.push({ label: label || `Row ${i}`, values })
  }
  if (rows.length === 0) return { error: 'No data rows found.' }
  return { rows, series }
}

/* ------------------------------- formatting ------------------------------- */

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
function fmt(n: number): string {
  return compact.format(n)
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    const base = Number.isFinite(min) ? min : 0
    return [base - 1, base, base + 1]
  }
  const span = max - min
  const step0 = span / Math.max(1, count)
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const norm = step0 / mag
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 0.001; v += step) {
    out.push(Math.round(v * 1e6) / 1e6)
  }
  return out
}

/* ------------------------------- svg helpers ------------------------------- */

const W = 900
const H = 460
const M = { top: 42, right: 24, bottom: 58, left: 68 }
const IW = W - M.left - M.right
const IH = H - M.top - M.bottom

function arcPath(cx: number, cy: number, r: number, r2: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  if (r2 <= 0) {
    return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
  }
  const xi1 = cx + r2 * Math.cos(a1)
  const yi1 = cy + r2 * Math.sin(a1)
  const xi0 = cx + r2 * Math.cos(a0)
  const yi0 = cy + r2 * Math.sin(a0)
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r2} ${r2} 0 ${large} 0 ${xi0} ${yi0} Z`
}

/* -------------------------------- component ------------------------------- */

export function ChartMakerTool() {
  const [raw, setRaw] = useState(SAMPLE)
  const [applied, setApplied] = useState(SAMPLE)
  const [kind, setKind] = useState<ChartKind>('bar')
  const [opts, setOpts] = useState<Options>({
    title: 'Savings vs spending — first half of the year',
    xLabel: 'Month',
    yLabel: 'Amount',
    showGrid: true,
    showLegend: true,
    yMin: '',
    yMax: '',
  })
  const [hidden, setHidden] = useState<Record<number, boolean>>({})
  const [svgText, setSvgText] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)

  const parsed = useMemo(() => parseData(applied), [applied])
  const isError = 'error' in parsed

  const seriesMeta: Array<SeriesMeta> = useMemo(() => {
    if (isError) return []
    return parsed.series.map((name, i) => ({
      name,
      color: PALETTE[i % PALETTE.length],
      visible: !hidden[i],
    }))
  }, [applied, isError, JSON.stringify(hidden)])

  const visibleIdx = useMemo(
    () => seriesMeta.map((s, i) => (s.visible ? i : -1)).filter((i) => i >= 0),
    [seriesMeta],
  )

  const stats = useMemo(() => {
    if (isError) return []
    return parsed.series.map((name, si) => {
      const vals = parsed.rows.map((r) => r.values[si]).filter((v): v is number => v !== null)
      const sum = vals.reduce((a, b) => a + b, 0)
      const avg = vals.length ? sum / vals.length : 0
      const min = vals.length ? Math.min(...vals) : 0
      const max = vals.length ? Math.max(...vals) : 0
      return { name, n: vals.length, sum, avg, min, max }
    })
  }, [applied, isError, parsed])

  /* --------------------------- chart geometry --------------------------- */

  const geom = useMemo(() => {
    if (isError || parsed.rows.length === 0) return null
    const rows = parsed.rows
    const cats = rows.map((r) => r.label)

    if (kind === 'pie' || kind === 'donut') {
      const si = visibleIdx[0] ?? 0
      const vals = rows.map((r) => r.values[si] ?? 0)
      const total = vals.reduce((a, b) => a + Math.max(0, b), 0)
      if (total <= 0) return null
      const cx = W / 2
      const cy = H / 2 + 6
      const r = Math.min(IW, IH) / 2 - 10
      const r2 = kind === 'donut' ? r * 0.55 : 0
      let acc = -Math.PI / 2
      const slices = vals.map((v, i) => {
        const frac = Math.max(0, v) / total
        const a0 = acc
        const a1 = acc + frac * Math.PI * 2
        acc = a1
        return {
          i,
          label: cats[i],
          frac,
          color: PALETTE[i % PALETTE.length],
          path: frac <= 0 ? '' : arcPath(cx, cy, r, r2, a0, Math.max(a0 + 0.0001, a1)),
          midA: (a0 + a1) / 2,
        }
      })
      return { tag: 'pie' as const, slices, cx, cy, r, r2, seriesName: parsed.series[si], total }
    }

    // axes-based charts
    let vMin = Infinity
    let vMax = -Infinity
    for (const r of rows) {
      for (const si of visibleIdx) {
        const v = r.values[si]
        if (v !== null) {
          if (kind === 'scatter' && vMin === Infinity) continue
          vMin = Math.min(vMin, v)
          vMax = Math.max(vMax, v)
        }
      }
    }
    if (!Number.isFinite(vMin)) {
      vMin = 0
      vMax = 1
    }
    if (opts.yMin.trim() !== '' && Number.isFinite(Number(opts.yMin))) vMin = Number(opts.yMin)
    if (opts.yMax.trim() !== '' && Number.isFinite(Number(opts.yMax))) vMax = Number(opts.yMax)
    if (vMin === vMax) vMax = vMin + 1
    if (kind !== 'scatter' && vMin > 0 && opts.yMin.trim() === '') vMin = Math.max(0, vMin - (vMax - vMin) * 0.08)
    const pad = (vMax - vMin) * 0.08
    if (opts.yMin.trim() === '') vMin -= kind === 'scatter' ? 0 : 0
    vMax = opts.yMax.trim() !== '' ? vMax : vMax + (kind === 'bar' ? 0 : pad)

    const yTicks = niceTicks(vMin, vMax, 5)
    const y0 = Math.min(vMin, yTicks[0])
    const y1 = Math.max(vMax, yTicks[yTicks.length - 1])
    const yPix = (v: number) => M.top + IH - ((v - y0) / (y1 - y0)) * IH

    if (kind === 'scatter') {
      const firstNumericCol = (() => {
        for (let si = 0; si < parsed.series.length; si++) {
          const allNum = rows.every((r) => r.values[si] !== null)
          if (allNum) return si
        }
        return -1
      })()
      const xCol = firstNumericCol >= 0 ? firstNumericCol : 0
      const yCol = firstNumericCol >= 0 && firstNumericCol + 1 < parsed.series.length ? firstNumericCol + 1 : xCol
      const xs = rows.map((r) => r.values[xCol] ?? 0)
      const ys = rows.map((r) => r.values[yCol] ?? 0)
      const xMin = Math.min(...xs)
      const xMax = Math.max(...xs)
      const xTicks = niceTicks(xMin, xMax, 6)
      const x0 = Math.min(xMin, xTicks[0])
      const x1 = Math.max(xMax, xTicks[xTicks.length - 1])
      const xPix = (v: number) => M.left + ((v - x0) / (x1 - x0 || 1)) * IW
      return {
        tag: 'scatter' as const,
        axes: { y0, y1, yTicks, x0, x1, xTicks, xPix, yPix },
        dots: rows.map((r, i) => ({
          x: xPix(r.values[xCol] ?? 0),
          y: yPix(r.values[yCol] ?? 0),
          xv: r.values[xCol],
          yv: r.values[yCol],
          label: r.label,
          color: PALETTE[i % PALETTE.length],
        })),
        xName: parsed.series[xCol],
        yName: parsed.series[yCol],
      }
    }

    const bandW = IW / rows.length
    const groupW = bandW * 0.72
    const barW = visibleIdx.length > 0 ? groupW / visibleIdx.length : groupW
    const bars = rows.map((r, ri) => {
      const x0 = M.left + ri * bandW + (bandW - groupW) / 2
      return {
        label: r.label,
        x0,
        items: visibleIdx.map((si, k) => ({
          si,
          x: x0 + k * barW,
          v: r.values[si] ?? 0,
          has: r.values[si] !== null,
        })),
      }
    })

    const lines = visibleIdx.map((si) => ({
      si,
      pts: rows.map((r, ri) => ({
        x: M.left + ri * bandW + bandW / 2,
        y: yPix(r.values[si] ?? 0),
        v: r.values[si],
        label: r.label,
      })),
    }))

    return { tag: kind as 'bar' | 'line' | 'area', axes: { y0, y1, yTicks, yPix }, cats, bars, lines, bandW }
  }, [applied, kind, opts.yMin, opts.yMax, isError, parsed, visibleIdx])

  /* ------------------------------ rendering ------------------------------ */

  const gridLines = geom && geom.tag !== 'pie'
    ? geom.axes.yTicks.map((t: number) => ({ y: geom.axes.yPix(t), t }))
    : []

  function renderChart(): React.ReactElement {
    if (isError || !geom) return <g />

    if (geom.tag === 'pie') {
      const { slices, cx, cy, r, r2 } = geom
      return (
        <g data-testid="chart-svg-body">
          {slices.map((s) => (
            <g key={s.i}>
              <path d={s.path} fill={s.color} stroke="#ffffff" strokeWidth={2} opacity={0.92}>
                <title>{`${s.label}: ${fmt(s.frac * 100)}%`}</title>
              </path>
              {s.frac >= 0.045 && (
                <text
                  x={cx + (r + (r2 > 0 ? r2 : 0)) / 2 * Math.cos(s.midA)}
                  y={cy + (r + (r2 > 0 ? r2 : 0)) / 2 * Math.sin(s.midA)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={13}
                  fontWeight={600}
                  fill="#ffffff"
                >
                  {Math.round(s.frac * 100)}%
                </text>
              )}
            </g>
          ))}
          {kind === 'donut' && (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={700} fill="#334155">
              {fmt(geom.total)}
            </text>
          )}
        </g>
      )
    }

    const { axes } = geom
    return (
      <g data-testid="chart-svg-body">
        {opts.showGrid &&
          gridLines.map((g) => (
            <g key={`grid-${g.t}`}>
              <line x1={M.left} x2={W - M.right} y1={g.y} y2={g.y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={M.left - 8} y={g.y} textAnchor="end" dominantBaseline="middle" fontSize={12} fill="#64748b">
                {fmt(g.t)}
              </text>
            </g>
          ))}
        {!opts.showGrid &&
          geom.axes.yTicks.map((t: number) => (
            <text key={`tick-${t}`} x={M.left - 8} y={axes.yPix(t)} textAnchor="end" dominantBaseline="middle" fontSize={12} fill="#64748b">
              {fmt(t)}
            </text>
          ))}

        <line x1={M.left} x2={W - M.right} y1={axes.yPix(Math.max(axes.y0, 0))} y2={axes.yPix(Math.max(axes.y0, 0))} stroke="#94a3b8" strokeWidth={1.5} />

        {geom.tag === 'bar' &&
          geom.bars.map((b) => (
            <g key={b.label}>
              {b.items.map((it) => (
                <rect
                  key={`${b.label}-${it.si}`}
                  x={it.x}
                  y={Math.min(axes.yPix(it.v), axes.yPix(Math.max(axes.y0, 0)))}
                  width={Math.max(3, geom.bars.length > 0 ? (IW / geom.bars.length) * 0.72 / Math.max(1, visibleIdx.length) - 4 : 3)}
                  height={Math.abs(axes.yPix(it.v) - axes.yPix(Math.max(axes.y0, 0)))}
                  fill={seriesMeta[it.si].color}
                  opacity={it.has ? 0.9 : 0.35}
                  rx={2}
                >
                  <title>{`${b.label} — ${seriesMeta[it.si].name}: ${it.has ? fmt(it.v) : 'no data'}`}</title>
                </rect>
              ))}
              <text x={b.x0 + ((IW / geom.bars.length) * 0.72) / 2} y={H - M.bottom + 18} textAnchor="middle" fontSize={12} fill="#475569">
                {b.label.length > 9 ? `${b.label.slice(0, 8)}…` : b.label}
              </text>
            </g>
          ))}

        {geom.tag === 'scatter' &&
          geom.dots.map((d, i) => (
            <circle key={`dot-${i}`} cx={d.x} cy={d.y} r={5} fill={d.color} opacity={0.85}>
              <title>{`${d.label} — ${geom.xName}: ${d.xv !== null ? fmt(d.xv) : '—'}, ${geom.yName}: ${d.yv !== null ? fmt(d.yv) : '—'}`}</title>
            </circle>
          ))}
        {geom.tag === 'scatter' &&
          geom.axes.xTicks.map((t: number) => (
            <text key={`xt-${t}`} x={geom.axes.xPix(t)} y={H - M.bottom + 18} textAnchor="middle" fontSize={12} fill="#475569">
              {fmt(t)}
            </text>
          ))}

        {(geom.tag === 'line' || geom.tag === 'area') &&
          geom.lines.map((ln) => {
            const pts = ln.pts
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
            const areaD = `${d} L ${pts[pts.length - 1]?.x} ${axes.yPix(Math.max(axes.y0, 0))} L ${pts[0]?.x} ${axes.yPix(Math.max(axes.y0, 0))} Z`
            return (
              <g key={`line-${ln.si}`}>
                {kind === 'area' && (
                  <path d={areaD} fill={seriesMeta[ln.si].color} opacity={0.18} />
                )}
                <path d={d} fill="none" stroke={seriesMeta[ln.si].color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                {pts.map((p, i) => (
                  <circle key={`${ln.si}-${i}`} cx={p.x} cy={p.y} r={3.5} fill="#ffffff" stroke={seriesMeta[ln.si].color} strokeWidth={2}>
                    <title>{`${p.label} — ${seriesMeta[ln.si].name}: ${p.v !== null ? fmt(p.v) : '—'}`}</title>
                  </circle>
                ))}
              </g>
            )
          })}

        {geom.tag !== 'scatter' &&
          geom.cats.map((c, i) => (
            <text key={`cat-${i}`} x={M.left + i * geom.bandW + geom.bandW / 2} y={H - M.bottom + 18} textAnchor="middle" fontSize={12} fill="#475569">
              {c.length > 9 ? `${c.slice(0, 8)}…` : c}
            </text>
          ))}
      </g>
    )
  }

  const legendItems = isError
    ? []
    : kind === 'pie' || kind === 'donut'
      ? parsed.rows.map((r, i) => ({ name: r.label, color: PALETTE[i % PALETTE.length] }))
      : seriesMeta.map((s) => ({ name: s.name, color: s.color }))

  function exportSvg() {
    const el = svgRef.current
    if (!el) return
    const text = new XMLSerializer().serializeToString(el)
    const blob = new Blob([text], { type: 'image/svg+xml' })
    downloadBlob(blob, 'chart.svg')
  }

  function exportPng() {
    const el = svgRef.current
    if (!el) return
    const text = new XMLSerializer().serializeToString(el)
    const svgBlob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = W * scale
      canvas.height = H * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, 'chart.png')
      }, 'image/png')
    }
    img.src = url
  }

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    setSvgText(new XMLSerializer().serializeToString(el))
  })

  return (
    <div className="flex flex-col gap-4" data-testid="chart-maker-tool">
      {/* first-viewport: chart is live immediately from the sample data */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chart type">
            {(
              [
                { k: 'bar', icon: BarChart3, label: 'Bar' },
                { k: 'line', icon: ChartLine, label: 'Line' },
                { k: 'area', icon: AreaChart, label: 'Area' },
                { k: 'pie', icon: ChartPie, label: 'Pie' },
                { k: 'donut', icon: ChartPie, label: 'Donut' },
                { k: 'scatter', icon: ScatterChart, label: 'Scatter' },
              ] as Array<{ k: ChartKind; icon: typeof BarChart3; label: string }>
            ).map((t) => (
              <Button
                key={t.k}
                variant={kind === t.k ? 'default' : 'outline'}
                size="sm"
                className="min-h-[44px] bg-[#10b981] data-[state=active]:bg-[#10b981] text-white hover:bg-[#0d9668] border-stone-200"
                data-kind={t.k}
                aria-pressed={kind === t.k}
                onClick={() => setKind(t.k)}
              >
                <t.icon className="mr-1 h-4 w-4" aria-hidden="true" />
                {t.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="min-h-[44px] border-stone-300" onClick={exportSvg} data-testid="chart-export-svg" aria-label="Download chart as SVG">
              <Download className="mr-1 h-4 w-4" aria-hidden="true" /> SVG
            </Button>
            <Button size="sm" className="min-h-[44px] bg-emerald-600 text-white hover:bg-emerald-700" onClick={exportPng} data-testid="chart-export-png" aria-label="Download chart as PNG">
              <ImageIcon className="mr-1 h-4 w-4" aria-hidden="true" /> PNG
            </Button>
          </div>
        </div>

        {isError ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 border border-amber-200" data-testid="chart-data-error" role="alert">
            {parsed.error}
          </p>
        ) : (
          <>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="mt-3 h-auto w-full"
              role="img"
              aria-label={opts.title || 'Chart'}
              data-testid="chart-svg"
              xmlns="http://www.w3.org/2000/svg"
            >
              <text x={M.left} y={22} fontSize={16} fontWeight={700} fill="#1c1917">
                {opts.title}
              </text>
              {renderChart()}
              {/* axis captions */}
              {geom && geom.tag !== 'pie' && (
                <>
                  <text x={W - M.right} y={H - 8} textAnchor="end" fontSize={12} fill="#78716c">
                    {geom.tag === 'scatter' ? geom.xName : opts.xLabel}
                  </text>
                  <text x={16} y={M.top - 10} fontSize={12} fill="#78716c">
                    {geom.tag === 'scatter' ? geom.yName : opts.yLabel}
                  </text>
                </>
              )}
              {opts.showLegend && legendItems.length > 1 && (
                <g data-testid="chart-legend">
                  {legendItems.slice(0, 8).map((s, i) => {
                    const lw = Math.min(220, (W - M.left - M.right) / legendItems.length)
                    const lx = M.left + i * lw
                    return (
                      <g key={s.name}>
                        <rect x={lx} y={H - 34} width={10} height={10} fill={s.color} rx={2} />
                        <text x={lx + 14} y={H - 25} fontSize={11} fill="#57534e">
                          {s.name.length > 14 ? `${s.name.slice(0, 13)}…` : s.name}
                        </text>
                      </g>
                    )
                  })}
                </g>
              )}
            </svg>
          </>
        )}
      </div>

      {/* series toggles + stats */}
      {!isError && (
        <div className="flex flex-wrap gap-2">
          {seriesMeta.map((s, i) => (
            <label key={s.name} className="flex min-h-[44px] items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-sm">
              <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
              <span className="font-medium text-stone-700">{s.name}</span>
              <Switch
                checked={s.visible}
                aria-label={`Show series ${s.name}`}
                data-testid={`chart-series-toggle-${i}`}
                onCheckedChange={(v) => setHidden((h) => ({ ...h, [i]: !v }))}
              />
            </label>
          ))}
        </div>
      )}

      {!isError && (
        <div className="flex flex-wrap gap-2" data-testid="chart-stats">
          {stats.map((st) => (
            <div key={st.name} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600">
              <span className="font-semibold text-stone-800">{st.name}</span>
              <span className="mx-1">·</span>n {st.n}
              <span className="mx-1">·</span>Σ {fmt(st.sum)}
              <span className="mx-1">·</span>avg {fmt(st.avg)}
              <span className="mx-1">·</span>range {fmt(st.min)}–{fmt(st.max)}
            </div>
          ))}
        </div>
      )}

      {/* data editor */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-800">
            <Table className="h-4 w-4" aria-hidden="true" /> Data — first column is the category label, other columns are numeric series
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] border-stone-300"
            onClick={() => {
              setRaw(SAMPLE)
              setApplied(SAMPLE)
              setHidden({})
            }}
            aria-label="Reset chart data to sample"
          >
            <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" /> Reset sample
          </Button>
        </div>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          className="mt-2 max-h-64 overflow-y-auto font-mono text-xs"
          aria-label="Chart data, CSV, TSV or semicolon separated"
          data-testid="chart-maker-paste"
          placeholder={'Label,Series A,Series B\nJan,12,8\nFeb,15,11'}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="min-h-[44px] bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => setApplied(raw)}
            data-testid="chart-maker-apply"
          >
            Render chart
          </Button>
          <span className="text-xs text-stone-500">
            Paste from any spreadsheet (comma, tab or semicolon separated). Numbers may use % or thousands separators.
          </span>
        </div>
      </div>

      {/* options */}
      <div className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="chart-title">Chart title</Label>
          <Input id="chart-title" value={opts.title} onChange={(e) => setOpts({ ...opts, title: e.target.value })} data-testid="chart-title-input" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="chart-x">X axis label</Label>
          <Input id="chart-x" value={opts.xLabel} onChange={(e) => setOpts({ ...opts, xLabel: e.target.value })} data-testid="chart-x-label" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="chart-y">Y axis label</Label>
          <Input id="chart-y" value={opts.yLabel} onChange={(e) => setOpts({ ...opts, yLabel: e.target.value })} data-testid="chart-y-label" className="mt-1" />
        </div>
        <div className="flex items-end gap-4">
          <div className="flex items-center gap-2">
            <Switch id="chart-grid" checked={opts.showGrid} onCheckedChange={(v) => setOpts({ ...opts, showGrid: v })} data-testid="chart-grid-toggle" aria-label="Show horizontal grid lines" />
            <Label htmlFor="chart-grid">Grid lines</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="chart-legend" checked={opts.showLegend} onCheckedChange={(v) => setOpts({ ...opts, showLegend: v })} aria-label="Show legend" />
            <Label htmlFor="chart-legend">Legend</Label>
          </div>
        </div>
        <div>
          <Label htmlFor="chart-ymin">Y axis minimum (blank = auto)</Label>
          <Input id="chart-ymin" value={opts.yMin} onChange={(e) => setOpts({ ...opts, yMin: e.target.value })} inputMode="decimal" data-testid="chart-y-min" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="chart-ymax">Y axis maximum (blank = auto)</Label>
          <Input id="chart-ymax" value={opts.yMax} onChange={(e) => setOpts({ ...opts, yMax: e.target.value })} inputMode="decimal" data-testid="chart-y-max" className="mt-1" />
        </div>
      </div>

      <PrivacyStrip detail="Data stays in this tab — parsing, drawing and PNG/SVG export are all local canvas and Blob work. Nothing uploads." />
    </div>
  )
}

export default ChartMakerTool
