'use client'

// Body Metrics Studio — BMI, BMR/TDEE calorie targets, ideal weight and
// body-fat estimates, all from published formulas (WHO classification bands,
// Mifflin-St Jeor, Robinson/Miller/Devine/Hamwi, US Navy, Deurenberg). The
// page states each formula next to its result and carries a standing note:
// population estimates, not a diagnosis. Nothing leaves the tab.

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

type Units = 'metric' | 'imperial'
type Sex = 'male' | 'female'

const ACTIVITY = [
  { label: 'Sedentary — desk job, little exercise', mult: 1.2 },
  { label: 'Light — 1–3 workouts a week', mult: 1.375 },
  { label: 'Moderate — 3–5 workouts a week', mult: 1.55 },
  { label: 'Active — 6–7 workouts a week', mult: 1.725 },
  { label: 'Very active — hard daily training', mult: 1.9 },
]

interface Band { max: number; name: string }
const WHO_BANDS: Band[] = [
  { max: 16, name: 'Severe thinness' },
  { max: 17, name: 'Moderate thinness' },
  { max: 18.5, name: 'Mild thinness' },
  { max: 25, name: 'Healthy weight' },
  { max: 30, name: 'Overweight (pre-obese)' },
  { max: 35, name: 'Obese class I' },
  { max: 40, name: 'Obese class II' },
  { max: Infinity, name: 'Obese class III' },
]

function bandFor(bmi: number): string {
  return WHO_BANDS.find((b) => bmi < b.max)!.name
}

function Stat({ label, value, sub, primary }: { label: string; value: string; sub?: string; primary?: boolean }) {
  return (
    <div className={cn('rounded-lg border px-3.5 py-3', primary ? 'border-primary/40 bg-primary/5' : 'bg-muted/30')}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 font-mono text-lg font-semibold tabular-nums', primary && 'text-primary')}>{value}</p>
      {sub && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{sub}</p>}
    </div>
  )
}

function NumField({ id, label, value, onChange, unit }: { id: string; label: string; value: string; onChange: (v: string) => void; unit?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{unit ? ` (${unit})` : ''}</Label>
      <Input id={id} type="number" inputMode="decimal" min={0} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
    </div>
  )
}

export function BmiTool() {
  const [units, setUnits] = useState<Units>('metric')
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState('30')
  const [cm, setCm] = useState('175')
  const [kg, setKg] = useState('72')
  const [ft, setFt] = useState('5')
  const [inch, setInch] = useState('9')
  const [lb, setLb] = useState('160')
  const [activity, setActivity] = useState(1)
  const [neck, setNeck] = useState('38')
  const [waist, setWaist] = useState('85')
  const [hip, setHip] = useState('95')

  const r = useMemo(() => {
    const ageN = Number(age)
    const heightM = units === 'metric' ? Number(cm) / 100 : (Number(ft) * 12 + Number(inch)) * 0.0254
    const weightKg = units === 'metric' ? Number(kg) : Number(lb) * 0.45359237
    if (!(ageN >= 2 && ageN <= 120) || !(heightM > 0.5 && heightM < 2.6) || !(weightKg > 10 && weightKg < 500)) {
      return { ok: false as const, msg: 'Enter a real height, weight and age — the formulas only make sense inside human ranges.' }
    }
    const bmi = weightKg / (heightM * heightM)
    const healthyLo = 18.5 * heightM * heightM
    const healthyHi = 24.9 * heightM * heightM

    // Mifflin-St Jeor BMR
    const bmr = 10 * weightKg + 6.25 * (heightM * 100) - 5 * ageN + (sex === 'male' ? 5 : -161)
    const tdee = bmr * ACTIVITY[activity].mult

    // Ideal weight — four published formulas, height in inches
    const heightIn = heightM / 0.0254
    const inchesOver5ft = Math.max(0, heightIn - 60)
    const ideal = {
      Robinson: sex === 'male' ? 52 + 1.9 * inchesOver5ft : 49 + 1.7 * inchesOver5ft,
      Miller: sex === 'male' ? 56.2 + 1.41 * inchesOver5ft : 53.1 + 1.36 * inchesOver5ft,
      Devine: sex === 'male' ? 50 + 2.3 * inchesOver5ft : 45.5 + 2.3 * inchesOver5ft,
      Hamwi: sex === 'male' ? 48 + 2.7 * inchesOver5ft : 45.5 + 2.2 * inchesOver5ft,
    }

    // Navy body fat — needs neck + waist (+ hip for female), all in cm
    let navy: number | null = null
    let navyErr = ''
    const neckN = Number(neck)
    const waistN = Number(waist)
    const hipN = Number(hip)
    const minNeck = heightM < 1.5 ? 20 : 25 // rough human plausibility guards
    if (neckN >= minNeck && waistN >= minNeck) {
      if (sex === 'female' && hipN < minNeck) {
        navyErr = 'Hips measurement is needed for the female formula.'
      } else {
        if (sex === 'male') navy = 495 / (1.032 - 0.19077 * Math.log10(waistN - neckN) + 0.15456 * Math.log10(heightM * 100)) - 450
        else navy = 495 / (1.29579 - 0.35004 * Math.log10(waistN + hipN - neckN) + 0.221 * Math.log10(heightM * 100)) - 450
        if (navy !== null && (navy < 2 || navy > 70)) {
          navyErr = 'Those measurements give an implausible result — check the numbers.'
          navy = null
        }
      }
    } else if (neck.trim() || waist.trim()) {
      navyErr = 'Measurements look too small to be real — check them.'
    }
    // Deurenberg estimate from BMI
    const deurenberg = 1.2 * bmi + 0.23 * ageN - 10.8 * (sex === 'male' ? 1 : 0) - 5.4

    return { ok: true as const, bmi, healthyLo, healthyHi, bmr, tdee, ideal, navy, navyErr, deurenberg, weightKg, heightM }
  }, [units, sex, age, cm, kg, ft, inch, lb, activity, neck, waist, hip])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex overflow-hidden rounded-lg border" role="group" aria-label="Unit system">
            {(['metric', 'imperial'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnits(u)}
                aria-pressed={units === u}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  units === u ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                )}
              >
                {u}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-lg border" role="group" aria-label="Sex for formula constants">
            {(['male', 'female'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSex(s)}
                aria-pressed={sex === s}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  sex === s ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="w-44">
            <Label htmlFor="bmi-age" className="sr-only">Age</Label>
            <Input id="bmi-age" type="number" min={2} max={120} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" aria-label="Age in years" className="font-mono" />
          </div>
        </div>

        {units === 'metric' ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <NumField id="bmi-cm" label="Height" unit="cm" value={cm} onChange={setCm} />
            <NumField id="bmi-kg" label="Weight" unit="kg" value={kg} onChange={setKg} />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <NumField id="bmi-ft" label="Height" unit="ft" value={ft} onChange={setFt} />
            <NumField id="bmi-in" label="Height" unit="in (remainder)" value={inch} onChange={setInch} />
            <NumField id="bmi-lb" label="Weight" unit="lb" value={lb} onChange={setLb} />
          </div>
        )}

        <div className="mt-4 border-t pt-4">
          <p className="text-sm font-medium">Body-fat measurements (optional) — cm</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <NumField id="bmi-neck" label="Neck circumference" unit="cm" value={neck} onChange={setNeck} />
            <NumField id="bmi-waist" label="Waist circumference" unit="cm" value={waist} onChange={setWaist} />
            {sex === 'female' && <NumField id="bmi-hip" label="Hip circumference" unit="cm" value={hip} onChange={setHip} />}
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="bmi-act">Activity level (for calorie targets)</Label>
          <select
            id="bmi-act"
            value={activity}
            onChange={(e) => setActivity(Number(e.target.value))}
            className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
          >
            {ACTIVITY.map((a, i) => (
              <option key={a.mult} value={i}>{a.label} (×{a.mult})</option>
            ))}
          </select>
        </div>

        <PrivacyStrip detail="Every formula runs in this tab from the numbers you typed. Nothing is stored, nothing is uploaded — close the tab and it is gone." />
      </div>

      {!r.ok ? (
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <p className="text-sm text-destructive" role="alert">{r.msg}</p>
        </div>
      ) : (
        <>
          {/* BMI */}
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Body Mass Index</h2>
            <p className="mt-1 text-xs text-muted-foreground">BMI = weight ÷ height² (kg/m²)</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <Stat primary label="Your BMI" value={r.bmi.toFixed(1)} sub={`WHO band: ${bandFor(r.bmi)}`} />
              <Stat label="Healthy weight range for your height" value={`${(r.healthyLo).toFixed(1)}–${(r.healthyHi).toFixed(1)} kg`} sub={`BMI 18.5–24.9 = ${(r.heightM * 100).toFixed(0)} cm tall`} />
              <Stat
                label="Distance from the healthy band"
                value={
                  r.bmi < 18.5
                    ? `+${(r.healthyLo - r.weightKg).toFixed(1)} kg to reach it`
                    : r.bmi >= 25
                      ? `−${(r.weightKg - r.healthyHi).toFixed(1)} kg to reach it`
                      : 'Inside the band'
                }
              />
            </div>
          </div>

          {/* Calories */}
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Calories — BMR and daily targets</h2>
            <p className="mt-1 text-xs text-muted-foreground">BMR: Mifflin-St Jeor (10·kg + 6.25·cm − 5·age {sex === 'male' ? '+ 5' : '− 161'}); TDEE = BMR × activity</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="BMR (at rest)" value={`${Math.round(r.bmr)} kcal`} />
              <Stat primary label={`TDEE (${ACTIVITY[activity].label.split(' — ')[0]})`} value={`${Math.round(r.tdee)} kcal`} sub={`activity ×${ACTIVITY[activity].mult}`} />
              <Stat label="Mild loss (−0.25 kg/wk)" value={`${Math.round(r.tdee - 250)} kcal`} sub="TDEE − 250" />
              <Stat label="Loss (−0.5 kg/wk)" value={`${Math.round(r.tdee - 500)} kcal`} sub="TDEE − 500" />
              <Stat label="Gain (+0.5 kg/wk)" value={`${Math.round(r.tdee + 500)} kcal`} sub="TDEE + 500" />
            </div>
          </div>

          {/* Ideal weight */}
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Ideal weight — four published formulas</h2>
            <p className="mt-1 text-xs text-muted-foreground">They disagree with each other; that disagreement is worth seeing, not hiding.</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-4">
              {Object.entries(r.ideal).map(([name, kgVal]) => (
                <Stat key={name} label={name} value={`${kgVal.toFixed(1)} kg`} sub={`${(kgVal * 2.20462).toFixed(0)} lb`} />
              ))}
            </div>
          </div>

          {/* Body fat */}
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Body fat — two estimates</h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {r.navy !== null ? (
                <Stat label="US Navy circumference method" value={`${r.navy.toFixed(1)} %`} sub={sex === 'male' ? 'from neck, waist and height' : 'from neck, waist, hips and height'} />
              ) : (
                <div className="rounded-lg border bg-muted/30 px-3.5 py-3">
                  <p className="text-xs font-medium text-muted-foreground">US Navy circumference method</p>
                  <p className="mt-1 text-sm text-destructive">{r.navyErr || 'Enter neck and waist measurements above to compute it.'}</p>
                </div>
              )}
              <Stat label="Deurenberg BMI-based estimate" value={`${r.deurenberg.toFixed(1)} %`} sub="from BMI, age and sex — a rougher population estimate" />
            </div>
          </div>

          <p className="rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
            These are population-level estimates from published formulas (WHO bands, Mifflin-St Jeor, Robinson/Miller/Devine/Hamwi, the US Navy
            circumference method, Deurenberg). They cannot see muscle mass, bone density, or anything else individual about you, and they are not a
            diagnosis or medical advice. For decisions about your health, talk to a clinician.
          </p>
        </>
      )}
    </div>
  )
}
