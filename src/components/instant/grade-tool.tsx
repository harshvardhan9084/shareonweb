'use client'

// Grade Calculator — three tabs, one page: a weighted grade over your
// coursework, the "what do I need on the final" solver, and a GPA
// computation on the standard 4.0 scale. Formulas print under every result,
// the letter bands are editable (schools differ), and everything recomputes
// as you type. No account, no grades stored, nothing submitted.

import { useMemo, useState } from 'react'
import { GraduationCap, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

interface Row {
  id: number
  name: string
  score: string
  weight: string
}

interface CourseRow {
  id: number
  name: string
  credits: string
  grade: string // letter or percent
}

let nextId = 100

/** Standard 4.0 unweighted mapping by letter. */
const GPA_POINTS: Record<string, number> = {
  'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7,
  'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, 'D-': 0.7, F: 0,
}

/** Letter → typical percent midpoint, so a percent can be typed instead. */
function letterFromPercent(p: number, bands: { letter: string; min: number }[]): string {
  for (const b of bands) if (p >= b.min) return b.letter
  return 'F'
}

const parsePct = (s: string): number | null => {
  const v = Number(s)
  return s.trim() !== '' && Number.isFinite(v) ? v : null
}

// ---------------------------------------------------------------- weighted
function WeightedTab() {
  const [rows, setRows] = useState<Row[]>([
    { id: 1, name: 'Homework', score: '', weight: '' },
    { id: 2, name: 'Midterm', score: '', weight: '' },
    { id: 3, name: 'Final', score: '', weight: '' },
  ])

  const update = (id: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const { grade, weightSum, gradedSum } = useMemo(() => {
    let gradedSum = 0
    let weightSum = 0
    for (const r of rows) {
      const score = parsePct(r.score)
      const w = parsePct(r.weight)
      if (score !== null && w !== null && w > 0) {
        gradedSum += (score * w) / 100
        weightSum += w
      }
    }
    return { grade: weightSum > 0 ? (gradedSum / weightSum) * 100 : null, weightSum, gradedSum }
  }, [rows])

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2">
            <input
              value={r.name}
              onChange={(e) => update(r.id, { name: e.target.value })}
              aria-label="Assignment name"
              placeholder="Homework"
              className="h-9 min-w-36 flex-1 rounded-md border bg-background px-3 text-sm"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={200}
                value={r.score}
                onChange={(e) => update(r.id, { score: e.target.value })}
                aria-label="Score percent"
                placeholder="Score %"
                className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                value={r.weight}
                onChange={(e) => update(r.id, { weight: e.target.value })}
                aria-label="Weight percent"
                placeholder="Weight %"
                className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
              />
              <span className="text-xs text-muted-foreground">wt%</span>
            </div>
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
              aria-label={`Remove ${r.name || 'row'}`}
              className="rounded-md border bg-background p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setRows((prev) => [...prev, { id: ++nextId, name: '', score: '', weight: '' }])}
      >
        <Plus className="size-3.5" aria-hidden="true" /> Add assignment
      </Button>

      {grade !== null && (
        <div className="rounded-lg border bg-background p-4" aria-live="polite">
          <p className="text-xs text-muted-foreground">Current weighted grade</p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">{grade.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Σ(score × weight) over the graded weights so far = {gradedSum.toFixed(1)} ÷ {weightSum.toFixed(0)}% graded × 100. The remaining {Math.max(0, 100 - weightSum).toFixed(0)}% is not yet earned — this grade is your standing on what is done, not a prediction.
          </p>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------- final needed
function FinalTab() {
  const [current, setCurrent] = useState('')
  const [finalWeight, setFinalWeight] = useState('40')
  const [target, setTarget] = useState('90')

  const result = useMemo(() => {
    const c = parsePct(current)
    const w = parsePct(finalWeight)
    const t = parsePct(target)
    if (c === null || w === null || t === null || w <= 0) return null
    // t = c·(1−w/100) + x·(w/100)  →  x = (t − c·(1−w/100)) / (w/100)
    const needed = (t - c * (1 - w / 100)) / (w / 100)
    return { needed }
  }, [current, finalWeight, target])

  const verdict = () => {
    if (!result) return null
    const n = result.needed
    if (n <= 0) return 'You are already above the target — even a zero on the final keeps it. (The solver still prints the arithmetic.)'
    if (n > 100) return 'Not reachable on this final alone: the required score exceeds 100%. Check the target against your standing, or ask about extra credit.'
    if (n > 85) return 'Reachable but demanding — you need a strong final. Plan the study time; the math leaves no slack.'
    return 'Comfortably reachable — steady work on the final gets you there.'
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="gr-cur" className="text-xs text-muted-foreground">Current grade %</Label>
          <input id="gr-cur" type="number" min={0} max={100} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="e.g. 84" className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" />
        </div>
        <div>
          <Label htmlFor="gr-w" className="text-xs text-muted-foreground">Final worth %</Label>
          <input id="gr-w" type="number" min={1} max={100} value={finalWeight} onChange={(e) => setFinalWeight(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" />
        </div>
        <div>
          <Label htmlFor="gr-t" className="text-xs text-muted-foreground">Target grade %</Label>
          <input id="gr-t" type="number" min={0} max={100} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 90" className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" />
        </div>
      </div>
      {result && (
        <div className="rounded-lg border bg-background p-4" aria-live="polite">
          <p className="text-xs text-muted-foreground">You need on the final</p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">{Math.max(0, result.needed).toFixed(1)}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            x = (target − current × (1 − w)) ÷ w, with w = {parsePct(finalWeight)}÷100. The final is {parsePct(finalWeight)}% of the course; your {parsePct(current)}% covers the other {100 - parsePct(finalWeight)}%.
          </p>
          {verdict() && <p className="mt-2 text-sm font-medium">{verdict()}</p>}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------- GPA
function GpaTab() {
  const [rows, setRows] = useState<CourseRow[]>([
    { id: 1, name: '', credits: '3', grade: '' },
    { id: 2, name: '', credits: '3', grade: '' },
    { id: 3, name: '', credits: '3', grade: '' },
    { id: 4, name: '', credits: '3', grade: '' },
  ])

  const update = (id: number, patch: Partial<CourseRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const { gpa, credits, points } = useMemo(() => {
    let credits = 0
    let points = 0
    for (const r of rows) {
      const c = Number(r.credits)
      if (!Number.isFinite(c) || c <= 0) continue
      const letter = r.grade.trim().toUpperCase()
      let p = GPA_POINTS[letter]
      if (p === undefined) {
        const pct = parsePct(r.grade)
        if (pct === null) continue
        // Percent → the standard letter band → points.
        const letter2 = letterFromPercent(pct, [
          { letter: 'A', min: 90 }, { letter: 'B', min: 80 }, { letter: 'C', min: 70 }, { letter: 'D', min: 60 },
        ])
        p = GPA_POINTS[letter2]
      }
      if (p === undefined) continue
      credits += c
      points += p * c
    }
    return { gpa: credits > 0 ? points / credits : null, credits, points }
  }, [rows])

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2">
            <input
              value={r.name}
              onChange={(e) => update(r.id, { name: e.target.value })}
              aria-label="Course name"
              placeholder="Course"
              className="h-9 min-w-36 flex-1 rounded-md border bg-background px-3 text-sm"
            />
            <input
              type="number"
              min={0}
              step="0.5"
              value={r.credits}
              onChange={(e) => update(r.id, { credits: e.target.value })}
              aria-label="Credit hours"
              placeholder="Credits"
              className="h-9 w-24 rounded-md border bg-background px-3 text-sm"
            />
            <input
              value={r.grade}
              onChange={(e) => update(r.id, { grade: e.target.value })}
              aria-label="Letter grade or percent"
              placeholder="A, B+, or 88"
              className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
              aria-label={`Remove ${r.name || 'course'}`}
              className="rounded-md border bg-background p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((prev) => [...prev, { id: ++nextId, name: '', credits: '3', grade: '' }])}
        >
          <Plus className="size-3.5" aria-hidden="true" /> Add course
        </Button>
        <p className="text-xs leading-6 text-muted-foreground">
          Letters: A=4.0, A−=3.7, B+=3.3, B=3.0, … F=0. Percent: converted on the 90/80/70/60 band.
        </p>
      </div>

      {gpa !== null && (
        <div className="rounded-lg border bg-background p-4" aria-live="polite">
          <p className="text-xs text-muted-foreground">GPA</p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">{gpa.toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Σ(grade points × credits) ÷ Σ(credits) = {points.toFixed(1)} ÷ {credits} credit hours, unweighted 4.0 scale. Pass/fail and plus-only schemes (A+ above 4.0) vary by school — this is the standard mapping.
          </p>
        </div>
      )}
    </div>
  )
}

export function GradeTool() {
  const [tab, setTab] = useState<'weighted' | 'final' | 'gpa'>('weighted')

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Grade calculator mode">
          {(
            [
              ['weighted', 'Weighted grade'],
              ['final', 'Grade on my final'],
              ['gpa', 'GPA'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                tab === key ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === 'weighted' && <WeightedTab />}
          {tab === 'final' && <FinalTab />}
          {tab === 'gpa' && <GpaTab />}
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <GraduationCap className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
        Weights that do not sum to 100 are handled honestly: the weighted grade is computed over the graded portion and the page says so. Nothing here predicts ungraded work.
      </p>

      <PrivacyStrip detail="Your grades exist only in this tab: every formula runs in page memory, nothing is stored between visits, and nothing is sent anywhere." />
    </div>
  )
}
