'use client'

// Random Picker Studio — wheel of names, number draws, coin/dice, list
// shuffles and team splits, all drawing from crypto.getRandomValues. The
// wheel is a real canvas wheel with easing and a result read at rest, not a
// pre-picked animation. Everything runs locally and nothing is remembered
// after the tab closes.

import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Mode = 'wheel' | 'numbers' | 'coin' | 'dice' | 'shuffle' | 'teams'

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'wheel', label: 'Wheel of names' },
  { id: 'numbers', label: 'Random numbers' },
  { id: 'coin', label: 'Coin flip' },
  { id: 'dice', label: 'Dice roller' },
  { id: 'shuffle', label: 'Shuffle & pick' },
  { id: 'teams', label: 'Team splitter' },
]

/** Cryptographically random integer in [0, maxExclusive). Unbiased. */
function randInt(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new RangeError('maxExclusive must be positive')
  // Rejection sampling on the largest multiple of max below 2^32.
  const limit = Math.floor(4294967296 / maxExclusive) * maxExclusive
  const buf = new Uint32Array(1)
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= limit)
  return buf[0] % maxExclusive
}

function randBetween(min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) throw new RangeError('Bounds must be finite numbers')
  if (max < min) throw new RangeError('Maximum must be at least the minimum')
  const span = max - min
  // integer bounds: exact unbiased draw; otherwise scale a float draw
  if (Number.isInteger(min) && Number.isInteger(max)) return min + randInt(span + 1)
  return min + randInt(2 ** 48) / 2 ** 48 * span
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const WHEEL_COLORS = [
  '#0f766e', '#b45309', '#7c3aed', '#be185d', '#15803d', '#a16207',
  '#9d174d', '#115e59', '#854d0f', '#6d28d9', '#166534', '#b91c1c',
]

// ------------------------------------------------------------------- wheel ---

function drawWheel(canvas: HTMLCanvasElement, entries: string[], rotation: number, highlight: number | null) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const size = 320
  if (canvas.width !== size * dpr) {
    canvas.width = size * dpr
    canvas.height = size * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size, size)
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 8
  const n = Math.max(entries.length, 1)
  const arc = (Math.PI * 2) / n
  for (let i = 0; i < n; i++) {
    const start = rotation + i * arc
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, radius, start, start + arc)
    ctx.closePath()
    ctx.fillStyle = highlight === i ? '#facc15' : WHEEL_COLORS[i % WHEEL_COLORS.length]
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    ctx.stroke()
    // label
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(start + arc / 2)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffffff'
    const label = entries[i] ?? ''
    const font = Math.min(15, Math.max(9, radius / Math.max(6, label.length * 0.6)))
    ctx.font = `600 ${font}px system-ui, sans-serif`
    const clipped = label.length > 24 ? label.slice(0, 23) + '…' : label
    ctx.fillText(clipped, radius - 10, 5)
    ctx.restore()
  }
  // center hub + pointer
  ctx.beginPath()
  ctx.arc(cx, cy, 26, 0, Math.PI * 2)
  ctx.fillStyle = 'hsl(var(--background))'
  ctx.fill()
  ctx.strokeStyle = 'hsl(var(--border))'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = 'hsl(var(--foreground))'
  ctx.beginPath()
  ctx.moveTo(cx - 10, 2)
  ctx.lineTo(cx + 10, 2)
  ctx.lineTo(cx, 18)
  ctx.closePath()
  ctx.fill()
}

interface HistoryRow { mode: string; text: string }

// --------------------------------------------------------------------- ui ----

export function PickerTool() {
  const [mode, setMode] = useState<Mode>('wheel')

  // entries shared by wheel / shuffle / teams
  const [names, setNames] = useState('Alice\nBen\nChen\nDivya\nEmeka\nFatima')
  const [removeWinner, setRemoveWinner] = useState(false)
  const [pickCount, setPickCount] = useState('3')
  const [teamCount, setTeamCount] = useState('2')

  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  // null = the wheel follows the names textarea; after a remove-winner spin
  // it holds the shortened list until the textarea changes again.
  const [wheelList, setWheelList] = useState<string[] | null>(null)
  const rafRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [numMin, setNumMin] = useState('1')
  const [numMax, setNumMax] = useState('100')
  const [numCount, setNumCount] = useState('5')
  const [numUnique, setNumUnique] = useState(false)
  const [numSorted, setNumSorted] = useState(false)

  const [diceCount, setDiceCount] = useState('2')
  const [diceSides, setDiceSides] = useState('6')

  const [coinFlips, setCoinFlips] = useState('1')

  const [history, setHistory] = useState<HistoryRow[]>([])
  const [shake, setShake] = useState(false)

  const parsedNames = useMemo(
    () => names.split('\n').map((s) => s.trim()).filter(Boolean),
    [names],
  )
  const wheelEntries = wheelList ?? parsedNames

  const log = (text: string) => setHistory((h) => [{ mode: MODES.find((m) => m.id === mode)!.label, text }, ...h].slice(0, 30))

  const updateNames = (v: string) => {
    setNames(v)
    setWheelList(null)
  }

  // render the wheel whenever it is at rest
  useEffect(() => {
    if (mode !== 'wheel' || spinning) return
    const canvas = canvasRef.current
    if (!canvas) return
    drawWheel(canvas, wheelEntries.length ? wheelEntries : ['Add names'], rotation, null)
  }, [wheelEntries, rotation, mode, spinning])

  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }, [])

  const spin = () => {
    if (spinning || wheelEntries.length === 0) return
    setWinner(null)
    setSpinning(true)
    const list = wheelEntries
    const startRot = rotation
    const turns = 5 + randInt(4) // 5–8 full turns
    const target = startRot + turns * Math.PI * 2 + randInt(360) * (Math.PI / 180)
    const dur = 3200 + randInt(1200)
    const t0 = performance.now()
    // read the winner at rest: the segment under the top pointer
    const readWinner = (rot: number) => {
      const n = list.length
      const arc = (Math.PI * 2) / n
      // the pointer triangle is drawn at 12 o'clock — canvas angle 1.5π
      const pointerAngle = Math.PI * 1.5
      const rel = ((pointerAngle - rot) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
      return Math.floor(rel / arc) % n
    }
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic: real deceleration
      const rot = startRot + (target - startRot) * eased
      const canvas = canvasRef.current
      if (canvas) drawWheel(canvas, list, rot, null)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        const idx = readWinner(rot)
        setRotation(rot % (Math.PI * 2))
        const canvas2 = canvasRef.current
        if (canvas2) drawWheel(canvas2, list, rot % (Math.PI * 2), idx)
        const w = list[idx]
        setWinner(w)
        setSpinning(false)
        log(w)
        if (removeWinner) {
          setWheelList(list.filter((_, i) => i !== idx))
        }
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }

  const drawNumbers = () => {
    const min = Number(numMin)
    const max = Number(numMax)
    const count = Math.max(1, Math.min(200, Math.floor(Number(numCount) || 1)))
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      return
    }
    let out: number[]
    if (numUnique) {
      if (Number.isInteger(min) && Number.isInteger(max)) {
        const span = max - min + 1
        if (count > span) return
        const pool = Array.from({ length: span }, (_, i) => min + i)
        out = fisherYates(pool).slice(0, count)
      } else {
        // unique draws for non-integer bounds: track what was drawn
        const set = new Set<number>()
        out = []
        let guard = 0
        while (out.length < count && guard++ < count * 1000) {
          const v = Number(randBetween(min, max).toFixed(6))
          if (!set.has(v)) { set.add(v); out.push(v) }
        }
      }
    } else {
      out = Array.from({ length: count }, () => randBetween(min, max))
    }
    if (numSorted) out.sort((a, b) => a - b)
    log(out.map((n) => Number.isInteger(n) ? n : n.toFixed(4)).join(', '))
  }

  const flipCoins = () => {
    const n = Math.max(1, Math.min(100, Math.floor(Number(coinFlips) || 1)))
    const flips = Array.from({ length: n }, () => (randInt(2) === 0 ? 'Heads' : 'Tails'))
    const heads = flips.filter((f) => f === 'Heads').length
    log(n === 1 ? flips[0] : `${flips.join(', ')} — ${heads} heads / ${n - heads} tails`)
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const rollDice = () => {
    const n = Math.max(1, Math.min(20, Math.floor(Number(diceCount) || 1)))
    const sides = Math.max(2, Math.min(1000, Math.floor(Number(diceSides) || 6)))
    const rolls = Array.from({ length: n }, () => randInt(sides) + 1)
    const total = rolls.reduce((a, b) => a + b, 0)
    log(n === 1 ? `d${sides}: ${rolls[0]}` : `${n}d${sides}: ${rolls.join(' + ')} = ${total}`)
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const doShuffle = () => {
    const k = Math.max(0, Math.floor(Number(pickCount) || 0))
    const shuffled = fisherYates(parsedNames)
    const picked = k > 0 ? shuffled.slice(0, Math.min(k, shuffled.length)) : null
    log(picked ? `Shuffled; picked ${k}: ${picked.join(', ')}` : `Shuffled: ${shuffled.join(', ')}`)
  }

  const doTeams = () => {
    const t = Math.max(2, Math.min(20, Math.floor(Number(teamCount) || 2)))
    if (parsedNames.length < t) return
    // deal snake-style for balance, from a shuffled order
    const order = fisherYates(parsedNames)
    const teams: string[][] = Array.from({ length: t }, () => [])
    order.forEach((name, i) => teams[i % t].push(name))
    log(teams.map((tm, i) => `Team ${i + 1}: ${tm.join(', ')}`).join('  ·  '))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Picker mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => { setMode(m.id); setWinner(null); setSpinning(false) }}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                mode === m.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'wheel' && (
          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-1.5">
              <Label htmlFor="wheel-names">Entries — one per line</Label>
              <Textarea id="wheel-names" value={names} onChange={(e) => updateNames(e.target.value)} rows={7} className="font-mono text-sm" />
              <label className="flex items-center gap-2.5 pt-1 text-sm">
                <Switch checked={removeWinner} onCheckedChange={setRemoveWinner} aria-label="Remove winner after each spin" />
                <span>Remove the winner after each spin</span>
              </label>
            </div>
            <div className="flex flex-col items-center gap-3">
              <canvas
                ref={canvasRef}
                style={{ width: 320, height: 320 }}
                className="rounded-full border shadow-sm"
                aria-label={`Wheel with ${wheelEntries.length} entries${winner ? `, winner ${winner}` : ''}`}
                role="img"
              />
              <Button type="button" size="lg" onClick={spin} disabled={spinning || wheelEntries.length === 0} className="w-full">
                {spinning ? 'Spinning…' : 'Spin the wheel'}
              </Button>
              {winner && (
                <p className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-center text-lg font-semibold text-primary" role="status">
                  {winner} wins
                </p>
              )}
            </div>
          </div>
        )}

        {mode === 'numbers' && (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label htmlFor="num-min">Minimum</Label><Input id="num-min" type="number" value={numMin} onChange={(e) => setNumMin(e.target.value)} className="font-mono" /></div>
              <div className="space-y-1.5"><Label htmlFor="num-max">Maximum</Label><Input id="num-max" type="number" value={numMax} onChange={(e) => setNumMax(e.target.value)} className="font-mono" /></div>
              <div className="space-y-1.5"><Label htmlFor="num-count">How many</Label><Input id="num-count" type="number" min={1} max={200} value={numCount} onChange={(e) => setNumCount(e.target.value)} className="font-mono" /></div>
            </div>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2.5 text-sm">
                <Switch checked={numUnique} onCheckedChange={setNumUnique} aria-label="Unique draws only" />
                <span>No repeats (raffle)</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <Switch checked={numSorted} onCheckedChange={setNumSorted} aria-label="Sort the results" />
                <span>Sort results</span>
              </label>
            </div>
            <Button type="button" size="lg" onClick={drawNumbers}>Draw numbers</Button>
          </div>
        )}

        {mode === 'coin' && (
          <div className="mt-4 space-y-3">
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="coin-n">How many flips</Label>
              <Input id="coin-n" type="number" min={1} max={100} value={coinFlips} onChange={(e) => setCoinFlips(e.target.value)} className="font-mono" />
            </div>
            <Button type="button" size="lg" onClick={flipCoins} className={cn(shake && 'animate-bounce')}>Flip</Button>
          </div>
        )}

        {mode === 'dice' && (
          <div className="mt-4 space-y-3">
            <div className="grid max-w-md gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="dice-n">Number of dice</Label><Input id="dice-n" type="number" min={1} max={20} value={diceCount} onChange={(e) => setDiceCount(e.target.value)} className="font-mono" /></div>
              <div className="space-y-1.5"><Label htmlFor="dice-s">Sides per die</Label><Input id="dice-s" type="number" min={2} max={1000} value={diceSides} onChange={(e) => setDiceSides(e.target.value)} className="font-mono" /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[4, 6, 8, 10, 12, 20].map((s) => (
                <Button key={s} type="button" variant="outline" size="sm" onClick={() => { setDiceSides(String(s)); setDiceCount('1'); }}>
                  d{s}
                </Button>
              ))}
            </div>
            <Button type="button" size="lg" onClick={rollDice} className={cn(shake && 'animate-bounce')}>Roll</Button>
          </div>
        )}

        {(mode === 'shuffle' || mode === 'teams') && (
          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-1.5">
              <Label htmlFor="list-names">Your list — one per line</Label>
              <Textarea id="list-names" value={names} onChange={(e) => setNames(e.target.value)} rows={7} className="font-mono text-sm" />
              {mode === 'shuffle' && (
                <div className="max-w-xs space-y-1.5 pt-1">
                  <Label htmlFor="pick-k">Also pick the first K (0 = shuffle only)</Label>
                  <Input id="pick-k" type="number" min={0} value={pickCount} onChange={(e) => setPickCount(e.target.value)} className="font-mono" />
                </div>
              )}
              {mode === 'teams' && (
                <div className="max-w-xs space-y-1.5 pt-1">
                  <Label htmlFor="team-n">Number of teams</Label>
                  <Input id="team-n" type="number" min={2} max={20} value={teamCount} onChange={(e) => setTeamCount(e.target.value)} className="font-mono" />
                </div>
              )}
            </div>
            <div>
              {mode === 'shuffle' ? (
                <Button type="button" size="lg" onClick={doShuffle} className="w-full">Shuffle</Button>
              ) : (
                <Button type="button" size="lg" onClick={doTeams} disabled={parsedNames.length < 2} className="w-full">Split into teams</Button>
              )}
            </div>
          </div>
        )}

        <PrivacyStrip detail="Every draw comes from crypto.getRandomValues — the browser's cryptographic randomness, unbiased by rejection sampling. Nothing is drawn on a server and nothing about your list is stored." />
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Results — this session</h2>
          {history.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setHistory([])}>
              <RefreshCw className="size-3.5" aria-hidden="true" /> Clear
            </Button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Draws collect here so you can re-read them.</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto" aria-label="Draw history">
            {history.map((h, i) => (
              <li key={i} className="border-b px-4 py-2 text-sm last:border-0">
                <span className="mr-2 text-xs font-medium text-muted-foreground">{h.mode}</span>
                {h.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
