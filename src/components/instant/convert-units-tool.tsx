'use client'

// Unit Converter — three converters on one page, all computed in this tab.
// Units convert through exact published factors (the international inch is
// exactly 0.0254 m; the pound is exactly 0.45359237 kg); temperature is
// special-cased because degrees are affine, not proportional. Number bases
// use plain IEEE-754 doubles guarded to Number.MAX_SAFE_INTEGER — no BigInt,
// because the build target does not guarantee it — with a range-checked
// Horner parser and string-based two's-complement arithmetic so the 64-bit
// view stays exact for every value the page accepts. Roman numerals enforce
// the classical subtractive grammar and reject forgeries like IIII, VX or IC
// with the precise rule that was broken. Nothing leaves the device; there is
// no upload code on this page.

import { useState } from 'react'
import { ArrowLeftRight, Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PrivacyStrip } from '@/components/instant/instant-kit'

// ------------------------------------------------------------- formatting ---

/** Clean '1.230000e+16' → '1.23e+16'. */
function cleanExponential(s: string): string {
  const i = s.indexOf('e')
  const mant = s.slice(0, i)
  const exp = s.slice(i)
  if (mant.indexOf('.') === -1) return s
  return mant.replace(/0+$/, '').replace(/\.$/, '') + exp
}

/**
 * Honest number formatting: `sig` significant digits, plain decimal inside
 * the readable range, exponential at or beyond 1e15 and below 1e-9 (where
 * plain text would sprawl or hide the precision actually held).
 */
function formatNumber(v: number, sig: number): string {
  if (Number.isNaN(v)) return ''
  if (!Number.isFinite(v)) return '—'
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1e15 || abs < 1e-9) {
    return cleanExponential(v.toExponential(Math.max(0, sig - 1)))
  }
  const rounded = Number(v.toPrecision(sig))
  let s = String(rounded)
  if (s.indexOf('e') !== -1) {
    // String() goes exponential for tiny values; expand honestly.
    const exp = Math.abs(Number(s.slice(s.indexOf('e') + 1)))
    s = rounded.toFixed(exp + sig - 1)
  }
  return s
}

type ParseResult = { ok: true; v: number } | { ok: false; why: string }

const NUM_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/

/** Parse a decimal number; `why === ''` means "empty input", not an error. */
function parseNum(text: string): ParseResult {
  const t = text.trim()
  if (t === '') return { ok: false, why: '' }
  if (!NUM_RE.test(t)) {
    return {
      ok: false,
      why: 'Not a number — digits with an optional decimal point or exponent, like 12, .5 or 1e6.',
    }
  }
  const v = Number(t)
  if (!Number.isFinite(v)) {
    return { ok: false, why: 'That value overflows a 64-bit float — the largest is about 1.8e308.' }
  }
  return { ok: true, v }
}

// ----------------------------------------------------- exact ratio engine ---
//
// The factor tables are exact published decimals. Their ratio is therefore an
// exact rational number; when it terminates within a handful of digits, the
// page may honestly say "exactly". Everything here is integer and string
// arithmetic on Numbers — no BigInt — with guards that keep every
// intermediate below 2^53 so nothing is ever silently rounded.

interface SplitFactor {
  m: number // integer mantissa
  e: number // decimal exponent: factor === m × 10^e
}

function splitFactor(f: number): SplitFactor | null {
  if (!Number.isFinite(f) || f === 0) return null
  const s = String(f) // shortest round-trip; equals the published decimal for every factor in the tables
  let mant = s
  let e = 0
  const ei = s.indexOf('e')
  if (ei !== -1) {
    mant = s.slice(0, ei)
    e = Number(s.slice(ei + 1))
    if (!Number.isFinite(e)) return null
  }
  const dot = mant.indexOf('.')
  if (dot !== -1) {
    e -= mant.length - dot - 1
    mant = mant.slice(0, dot) + mant.slice(dot + 1)
  }
  const m = Number(mant)
  if (!Number.isFinite(m) || !Number.isInteger(m)) return null
  return { m, e }
}

/**
 * Exact decimal ratio a/b — but only when it truly terminates, computed by
 * long division on the published mantissas. Returns null (no claim) when the
 * ratio repeats or the numbers grow past the exact-integer range: silence is
 * honest, a wrong "exactly" is not.
 */
function exactRatio(a: number, b: number): string | null {
  const fa = splitFactor(a)
  const fb = splitFactor(b)
  if (!fa || !fb) return null
  const m1 = Math.abs(fa.m)
  const m2 = Math.abs(fb.m)
  if (m1 === 0 || m2 === 0) return null
  if (m1 > 1e15 || m2 > 1e15) return null // keep every intermediate integer exact
  const ip = Math.floor(m1 / m2)
  let r = m1 - ip * m2
  let frac = ''
  while (r !== 0 && frac.length < 24) {
    const t = r * 10
    const d = Math.floor(t / m2)
    frac += String(d)
    r = t - d * m2
  }
  if (r !== 0) return null // non-terminating — no "exactly" claim
  while (frac.endsWith('0')) frac = frac.slice(0, -1)
  let digits = String(ip) + frac
  if (digits === '') digits = '0'
  // value = (ip + 0.frac) × 10^(e1 - e2): move the decimal point as a string.
  const point = String(ip).length + (fa.e - fb.e)
  let out: string
  if (point <= 0) {
    out = '0.' + '0'.repeat(-point) + digits
  } else if (point >= digits.length) {
    out = digits + '0'.repeat(point - digits.length)
  } else {
    out = digits.slice(0, point) + '.' + digits.slice(point)
  }
  out = out.replace(/^0+(?=[\d])/, '')
  const sigDigits = out.replace('.', '').replace(/^0+/, '')
  if (sigDigits.length === 0 || sigDigits.length > 15) return null
  return out
}

// ----------------------------------------------------------------- units ----

interface UnitDef {
  sym: string
  name: string
  /** Exact value in the category's canonical unit, as published. */
  factor: number
  /** Provenance shown in tooltips and the facts line. */
  note: string
}

interface CatDef {
  id: string
  name: string
  canonical: string
  temp?: boolean
  units: UnitDef[]
}

const CATEGORIES: CatDef[] = [
  {
    id: 'length',
    name: 'Length',
    canonical: 'm',
    units: [
      { sym: 'mm', name: 'millimeter', factor: 0.001, note: 'SI: 10⁻³ m' },
      { sym: 'cm', name: 'centimeter', factor: 0.01, note: 'SI: 10⁻² m' },
      { sym: 'm', name: 'meter', factor: 1, note: 'SI base unit' },
      { sym: 'km', name: 'kilometer', factor: 1000, note: 'SI: 10³ m' },
      { sym: 'in', name: 'inch', factor: 0.0254, note: 'international inch: exactly 0.0254 m since 1959' },
      { sym: 'ft', name: 'foot', factor: 0.3048, note: 'exactly 12 inches' },
      { sym: 'yd', name: 'yard', factor: 0.9144, note: 'exactly 3 feet' },
      { sym: 'mi', name: 'mile', factor: 1609.344, note: 'exactly 5280 feet' },
      { sym: 'nmi', name: 'nautical mile', factor: 1852, note: 'defined as exactly 1852 m (1929)' },
      { sym: 'ly', name: 'light-year', factor: 9460730472580800, note: 'Julian year × c: exactly 9.4607304725808 × 10¹⁵ m' },
    ],
  },
  {
    id: 'mass',
    name: 'Mass',
    canonical: 'kg',
    units: [
      { sym: 'mg', name: 'milligram', factor: 1e-6, note: 'SI: 10⁻⁶ kg' },
      { sym: 'g', name: 'gram', factor: 0.001, note: 'SI: 10⁻³ kg' },
      { sym: 'kg', name: 'kilogram', factor: 1, note: 'SI base unit' },
      { sym: 't', name: 'tonne', factor: 1000, note: 'metric ton: exactly 1000 kg' },
      { sym: 'oz', name: 'ounce', factor: 0.028349523125, note: 'exactly 1/16 lb' },
      { sym: 'lb', name: 'pound', factor: 0.45359237, note: 'international avoirdupois pound: exactly 0.45359237 kg since 1959' },
      { sym: 'st', name: 'stone', factor: 6.35029318, note: 'exactly 14 lb' },
    ],
  },
  {
    id: 'temperature',
    name: 'Temperature',
    canonical: '°C',
    temp: true,
    units: [
      { sym: '°C', name: 'Celsius', factor: 1, note: 'reference scale' },
      { sym: '°F', name: 'Fahrenheit', factor: 1, note: '°F = °C × 9/5 + 32 — affine, not a factor' },
      { sym: 'K', name: 'kelvin', factor: 1, note: 'K = °C + 273.15 — affine, not a factor' },
      { sym: '°R', name: 'Rankine', factor: 1, note: '°R = °F + 459.67 — affine, not a factor' },
    ],
  },
  {
    id: 'volume',
    name: 'Volume',
    canonical: 'L',
    units: [
      { sym: 'ml', name: 'milliliter', factor: 0.001, note: 'SI: 10⁻³ L' },
      { sym: 'l', name: 'liter', factor: 1, note: 'reference unit' },
      { sym: 'm³', name: 'cubic meter', factor: 1000, note: 'exactly 1000 L' },
      { sym: 'tsp', name: 'teaspoon (US)', factor: 0.00492892159375, note: 'exactly 1/768 US gallon' },
      { sym: 'Tbsp', name: 'tablespoon (US)', factor: 0.01478676478125, note: 'exactly 1/256 US gallon' },
      { sym: 'fl oz', name: 'fluid ounce (US)', factor: 0.0295735295625, note: 'exactly 1/128 US gallon' },
      { sym: 'cup', name: 'cup (US)', factor: 0.2365882365, note: 'exactly 1/16 US gallon' },
      { sym: 'pint', name: 'pint (US)', factor: 0.473176473, note: 'exactly 1/8 US gallon' },
      { sym: 'qt', name: 'quart (US)', factor: 0.946352946, note: 'exactly 1/4 US gallon' },
      { sym: 'gal', name: 'gallon (US)', factor: 3.785411784, note: 'exactly 231 cubic inches' },
    ],
  },
  {
    id: 'data',
    name: 'Data',
    canonical: 'B',
    units: [
      { sym: 'B', name: 'byte', factor: 1, note: 'reference unit' },
      { sym: 'KB', name: 'kilobyte', factor: 1e3, note: 'decimal family: 10³ B' },
      { sym: 'KiB', name: 'kibibyte', factor: 1024, note: 'binary family: 2¹⁰ B' },
      { sym: 'MB', name: 'megabyte', factor: 1e6, note: 'decimal family: 10⁶ B' },
      { sym: 'MiB', name: 'mebibyte', factor: 1048576, note: 'binary family: 2²⁰ B' },
      { sym: 'GB', name: 'gigabyte', factor: 1e9, note: 'decimal family: 10⁹ B' },
      { sym: 'GiB', name: 'gibibyte', factor: 1073741824, note: 'binary family: 2³⁰ B' },
      { sym: 'TB', name: 'terabyte', factor: 1e12, note: 'decimal family: 10¹² B' },
      { sym: 'TiB', name: 'tebibyte', factor: 1099511627776, note: 'binary family: 2⁴⁰ B' },
    ],
  },
  {
    id: 'speed',
    name: 'Speed',
    canonical: 'm/s',
    units: [
      { sym: 'm/s', name: 'meter per second', factor: 1, note: 'SI derived unit' },
      { sym: 'km/h', name: 'kilometer per hour', factor: 0.2777777777777778, note: '1 km/h = 1/3.6 m/s (repeating)' },
      { sym: 'mph', name: 'mile per hour', factor: 0.44704, note: 'exactly 1609.344/3600 m/s' },
      { sym: 'kn', name: 'knot', factor: 0.5144444444444445, note: '1 kn = 1852/3600 m/s (repeating)' },
      { sym: 'ft/s', name: 'foot per second', factor: 0.3048, note: 'exactly 0.3048 m/s' },
    ],
  },
  {
    id: 'area',
    name: 'Area',
    canonical: 'm²',
    units: [
      { sym: 'mm²', name: 'square millimeter', factor: 1e-6, note: 'SI: 10⁻⁶ m²' },
      { sym: 'cm²', name: 'square centimeter', factor: 1e-4, note: 'SI: 10⁻⁴ m²' },
      { sym: 'm²', name: 'square meter', factor: 1, note: 'SI derived unit' },
      { sym: 'km²', name: 'square kilometer', factor: 1e6, note: 'SI: 10⁶ m²' },
      { sym: 'ha', name: 'hectare', factor: 10000, note: 'exactly 100 m × 100 m' },
      { sym: 'acre', factor: 4046.8564224, name: 'acre', note: 'exactly 43560 ft²' },
      { sym: 'ft²', name: 'square foot', factor: 0.09290304, note: 'exactly (0.3048 m)²' },
      { sym: 'mi²', name: 'square mile', factor: 2589988.110336, note: 'exactly 5280² ft²' },
    ],
  },
  {
    id: 'time',
    name: 'Time',
    canonical: 's',
    units: [
      { sym: 'ms', name: 'millisecond', factor: 0.001, note: 'SI: 10⁻³ s' },
      { sym: 's', name: 'second', factor: 1, note: 'SI base unit' },
      { sym: 'min', name: 'minute', factor: 60, note: 'exactly 60 s' },
      { sym: 'h', name: 'hour', factor: 3600, note: 'exactly 3600 s' },
      { sym: 'day', name: 'day', factor: 86400, note: 'exactly 24 h' },
      { sym: 'week', name: 'week', factor: 604800, note: 'exactly 7 days' },
      { sym: 'year', name: 'year', factor: 31536000, note: '365 days — no leap days' },
    ],
  },
  {
    id: 'pressure',
    name: 'Pressure',
    canonical: 'Pa',
    units: [
      { sym: 'Pa', name: 'pascal', factor: 1, note: 'SI derived unit: 1 N/m²' },
      { sym: 'kPa', name: 'kilopascal', factor: 1000, note: 'SI: 10³ Pa' },
      { sym: 'bar', factor: 100000, name: 'bar', note: 'exactly 10⁵ Pa' },
      { sym: 'atm', name: 'standard atmosphere', factor: 101325, note: 'exactly 101325 Pa by definition' },
      { sym: 'mmHg', name: 'millimeter of mercury', factor: 133.322387415, note: 'conventional value at 0 °C: exactly 133.322387415 Pa' },
      { sym: 'psi', name: 'pound per square inch', factor: 6894.757293168, note: 'lbf/in² — 1 psi ≈ 6894.757293168 Pa' },
    ],
  },
  {
    id: 'energy',
    name: 'Energy',
    canonical: 'J',
    units: [
      { sym: 'J', name: 'joule', factor: 1, note: 'SI derived unit' },
      { sym: 'kJ', name: 'kilojoule', factor: 1000, note: 'SI: 10³ J' },
      { sym: 'cal', name: 'calorie', factor: 4.184, note: 'thermochemical calorie: exactly 4.184 J' },
      { sym: 'kcal', name: 'kilocalorie', factor: 4184, note: 'food calorie: exactly 1000 cal' },
      { sym: 'Wh', name: 'watt-hour', factor: 3600, note: 'exactly 3600 J' },
      { sym: 'kWh', name: 'kilowatt-hour', factor: 3.6e6, note: 'exactly 3.6 × 10⁶ J' },
      { sym: 'BTU', name: 'British thermal unit', factor: 1055.05585262, note: 'International Table BTU (1956)' },
    ],
  },
]

const DEFAULT_PAIR: Record<string, [string, string]> = {
  length: ['m', 'ft'],
  mass: ['kg', 'lb'],
  temperature: ['°C', '°F'],
  volume: ['l', 'gal'],
  data: ['MB', 'MiB'],
  speed: ['km/h', 'mph'],
  area: ['m²', 'ft²'],
  time: ['h', 'min'],
  pressure: ['bar', 'psi'],
  energy: ['kWh', 'BTU'],
}

const TEMP_TO_C: Record<string, (v: number) => number> = {
  '°C': (v) => v,
  '°F': (v) => ((v - 32) * 5) / 9,
  K: (v) => v - 273.15,
  '°R': (v) => ((v - 491.67) * 5) / 9,
}

const TEMP_FROM_C: Record<string, (v: number) => number> = {
  '°C': (v) => v,
  '°F': (v) => (v * 9) / 5 + 32,
  K: (v) => v + 273.15,
  '°R': (v) => ((v + 273.15) * 9) / 5,
}

const SIG_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12]

function findUnit(cat: CatDef, sym: string): UnitDef {
  return cat.units.find((u) => u.sym === sym) ?? cat.units[0]
}

function convertLinear(v: number, from: UnitDef, to: UnitDef, cat: CatDef): number {
  if (cat.temp) {
    const c = TEMP_TO_C[from.sym](v)
    return TEMP_FROM_C[to.sym](c)
  }
  return (v * from.factor) / to.factor
}

// ---------------------------------------------------------------- bases -----

const MAX_SAFE = Number.MAX_SAFE_INTEGER
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'
const FIXED_BASES = [2, 8, 10, 16]

function digitRange(base: number): string {
  return base === 2 ? '0–1' : `0–${DIGITS[base - 1]}`
}

/**
 * Parse an integer written in `base`, with a range-checked Horner loop so
 * overflow is detected before it can silently round. No BigInt.
 */
function parseInBase(text: string, base: number): ParseResult {
  let t = text.trim().toLowerCase()
  if (t === '') return { ok: false, why: '' }
  if (/[.,e]/.test(t)) {
    return {
      ok: false,
      why: 'Base conversion needs an integer — fractional values (and fractional bases) are not supported here.',
    }
  }
  let neg = false
  if (t.charAt(0) === '-') {
    neg = true
    t = t.slice(1)
  } else if (t.charAt(0) === '+') {
    t = t.slice(1)
  }
  if (t === '') return { ok: false, why: 'No digits after the sign.' }
  for (const ch of t) {
    const d = DIGITS.indexOf(ch)
    if (d === -1 || d >= base) {
      return {
        ok: false,
        why: `“${ch}” is not a base-${base} digit — valid digits are ${digitRange(base)}.`,
      }
    }
  }
  let acc = 0
  for (const ch of t) {
    const d = DIGITS.indexOf(ch)
    if (acc > (MAX_SAFE - d) / base) {
      return {
        ok: false,
        why: `Larger than 2^53 − 1 (9,007,199,254,740,991) — plain doubles cannot hold it exactly, so this page stops there.`,
      }
    }
    acc = acc * base + d
  }
  return { ok: true, v: neg ? -acc : acc }
}

function fmtInBase(v: number, base: number): string {
  return v < 0 ? '-' + (-v).toString(base) : v.toString(base)
}

function bitLength(abs: number): number {
  if (abs < 1) return 0
  let t = abs
  let bits = 1
  while (t >= 2) {
    t = Math.floor(t / 2)
    bits += 1
  }
  return bits
}

function groupBytes(hex: string): string {
  const out: string[] = []
  for (let i = 0; i < hex.length; i += 2) out.push(hex.slice(i, i + 2))
  return out.join(' ')
}

/**
 * Two's-complement hex of an integer in a signed `width`-bit field, built
 * with string arithmetic (digitwise one's complement, then +1) so the 64-bit
 * view is exact for every value the page accepts. Null when it does not fit.
 */
function twosComplementHex(v: number, width: number): string | null {
  const hexLen = width / 4
  if (v === 0) return groupBytes('0'.repeat(hexLen))
  const neg = v < 0
  const abs = Math.abs(v)
  const limit = Math.pow(2, width - 1)
  if (abs > limit - (neg ? 0 : 1)) return null
  let hex = abs.toString(16)
  hex = hex.padStart(hexLen, '0').slice(-hexLen)
  if (!neg) return groupBytes(hex.toUpperCase())
  const digits: number[] = hex.split('').map((c) => 15 - parseInt(c, 16))
  let carry = 1
  for (let i = digits.length - 1; i >= 0 && carry === 1; i--) {
    const d = digits[i] + carry
    digits[i] = d % 16
    carry = d === 16 ? 1 : 0
  }
  return groupBytes(digits.map((d) => d.toString(16)).join('').toUpperCase())
}

// ----------------------------------------------------------------- roman ----

const ROMAN_VALUES: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
  IV: 4,
  IX: 9,
  XL: 40,
  XC: 90,
  CD: 400,
  CM: 900,
}

const SUBTRACTIVE = ['CM', 'CD', 'XC', 'XL', 'IX', 'IV']

const ROMAN_PAIRS: Array<[number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

/** The canonical subtractive grammar — the whole law of Roman numerals. */
const ROMAN_GRAMMAR = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/

interface RomanRun {
  tok: string
  val: number
}

function romanRuns(n: number): RomanRun[] {
  const out: RomanRun[] = []
  let rest = n
  for (const [val, tok] of ROMAN_PAIRS) {
    const times = Math.floor(rest / val)
    if (times > 0) {
      // repeat the glyph: 1987 → XXX (not X) — repeat() is ES2015, target-safe
      out.push({ tok: tok.repeat(times), val: val * times })
      rest -= val * times
    }
  }
  return out
}

function tokenizeRoman(t: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < t.length) {
    const pair = t.slice(i, i + 2)
    if (SUBTRACTIVE.indexOf(pair) !== -1) {
      out.push(pair)
      i += 2
    } else {
      out.push(t.charAt(i))
      i += 1
    }
  }
  return out
}

/** Explain precisely which classical rule a malformed numeral breaks. */
function diagnoseRoman(t: string): string {
  const tokens = tokenizeRoman(t)
  const counts = new Map<string, number>()
  for (const tok of tokens) counts.set(tok, (counts.get(tok) ?? 0) + 1)
  const singleLimit: Record<string, number> = { I: 3, X: 3, C: 3, M: 3, V: 1, L: 1, D: 1 }
  for (const tok of tokens) {
    const limit = tok in singleLimit ? singleLimit[tok] : 1
    if ((counts.get(tok) ?? 0) > limit) {
      if (tok in singleLimit && singleLimit[tok] === 1) {
        return `“${tok}” is never repeated — V, L and D each stand alone.`
      }
      if (tok.length === 2) {
        return `A subtractive pair is used at most once — “${tok}” appears ${counts.get(tok)} times.`
      }
      return `“${tok}” repeats more than three times — the classical grammar allows at most three.`
    }
  }
  for (let i = 0; i < t.length - 1; i++) {
    const a = t.charAt(i)
    const b = t.charAt(i + 1)
    const va = ROMAN_VALUES[a] ?? 0
    const vb = ROMAN_VALUES[b] ?? 0
    if (va < vb && SUBTRACTIVE.indexOf(a + b) === -1) {
      return `“${a}${b}” is not a legal subtraction — only I before V or X, X before L or C, and C before D or M may subtract.`
    }
  }
  const groupOf: Record<string, number> = {
    M: 0,
    CM: 1,
    CD: 1,
    D: 1,
    C: 1,
    XC: 2,
    XL: 2,
    L: 2,
    X: 2,
    IX: 3,
    IV: 3,
    V: 3,
    I: 3,
  }
  let current = 0
  for (const tok of tokens) {
    const g = tok in groupOf ? groupOf[tok] : 3
    if (g < current) {
      return `“${tok}” appears out of place — the classical order is thousands (M), hundreds (CM, CD, D, C), tens (XC, XL, L, X), then ones (IX, IV, V, I), each place appearing once.`
    }
    if (g > current) current = g
  }
  return `“${t}” does not match the classical grammar — each place (thousands, hundreds, tens, ones) appears once, in order, with only its own shapes: M; CM, CD, D, C; XC, XL, L, X; IX, IV, V, I.`
}

function parseRoman(text: string): ParseResult {
  const t = text.trim().toUpperCase().replace(/\s+/g, '')
  if (t === '') return { ok: false, why: '' }
  if (/[^IVXLCDM]/.test(t)) {
    const bad = t.match(/[^IVXLCDM]/)
    return {
      ok: false,
      why: `“${bad ? bad[0] : t}” is not a Roman numeral character — the alphabet is I, V, X, L, C, D, M.`,
    }
  }
  if (!ROMAN_GRAMMAR.test(t)) return { ok: false, why: diagnoseRoman(t) }
  const tokens = tokenizeRoman(t)
  let total = 0
  for (const tok of tokens) total += ROMAN_VALUES[tok] ?? 0
  return { ok: true, v: total }
}

function romanNumCheck(text: string): ParseResult {
  const t = text.trim()
  if (t === '') return { ok: false, why: '' }
  if (!/^[+-]?\d+$/.test(t)) {
    return { ok: false, why: 'Roman numerals count whole units — enter an integer like 1987.' }
  }
  const v = Number(t)
  if (!Number.isSafeInteger(v)) {
    return {
      ok: false,
      why: 'Beyond 2^53 − 1 — far past the largest numeral this page can build (3999).',
    }
  }
  if (v < 1) {
    return { ok: false, why: 'Roman numerals start at 1 — there is no zero and no negative.' }
  }
  if (v > 3999) {
    return {
      ok: false,
      why: 'Roman numerals stop at 3999 (MMMCMXCIX). Larger values need a bar over the numeral — the vinculum — which plain text cannot carry.',
    }
  }
  return { ok: true, v }
}

// ------------------------------------------------------------------ copy ----

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 px-4"
      disabled={!text}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        })
      }}
    >
      {copied ? (
        <Check className="size-3.5 text-primary" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      {copied ? 'Copied' : label}
    </Button>
  )
}

// ------------------------------------------------------------- units mode ---

function UnitsMode() {
  const [catId, setCatId] = useState('length')
  const [fromSym, setFromSym] = useState(DEFAULT_PAIR.length[0])
  const [toSym, setToSym] = useState(DEFAULT_PAIR.length[1])
  const [leftText, setLeftText] = useState('1')
  const [rightText, setRightText] = useState('')
  const [active, setActive] = useState<'left' | 'right'>('left')
  const [sig, setSig] = useState(7)

  const cat = CATEGORIES.find((c) => c.id === catId) ?? CATEGORIES[0]
  const fromU = findUnit(cat, fromSym)
  const toU = findUnit(cat, toSym)

  function pickCategory(id: string) {
    const pair = DEFAULT_PAIR[id]
    setCatId(id)
    if (pair) {
      setFromSym(pair[0])
      setToSym(pair[1])
    }
  }

  function swapUnits() {
    setFromSym(toSym)
    setToSym(fromSym)
  }

  const srcText = active === 'left' ? leftText : rightText
  const src = parseNum(srcText)
  const out =
    src.ok && srcText.trim() !== ''
      ? convertLinear(src.v, active === 'left' ? fromU : toU, active === 'left' ? toU : fromU, cat)
      : null

  const leftShown = active === 'left' ? leftText : out === null ? '' : formatNumber(out, sig)
  const rightShown = active === 'right' ? rightText : out === null ? '' : formatNumber(out, sig)

  // Cheap pure computation — no memoization needed, which also keeps the
  // React compiler happy.
  const exact = (() => {
    if (cat.temp) return null
    const a = active === 'left' ? fromU : toU
    const b = active === 'left' ? toU : fromU
    if (a.sym === b.sym) return null
    return exactRatio(a.factor, b.factor)
  })()

  const fromError = active === 'left' && leftText.trim() !== '' && !src.ok ? src.why : ''
  const toError = active === 'right' && rightText.trim() !== '' && !src.ok ? src.why : ''
  const overflow = out !== null && !Number.isFinite(out)

  return (
    <div>
      {/* category chips */}
      <div role="group" aria-label="Unit category" className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant={c.id === catId ? 'default' : 'outline'}
            aria-pressed={c.id === catId}
            onClick={() => pickCategory(c.id)}
            className="min-h-11 rounded-full px-4"
          >
            {c.name}
          </Button>
        ))}
      </div>

      {/* from / swap / to */}
      <div className="mt-4 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Label htmlFor="units-from" className="w-12 shrink-0 text-sm">
            From
          </Label>
          <Select value={fromU.sym} onValueChange={setFromSym}>
            <SelectTrigger id="units-from" className="h-11 w-full shrink-0 sm:w-52" aria-label="From unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cat.units.map((u) => (
                <SelectItem key={u.sym} value={u.sym} title={`${u.name} — 1 ${u.sym} = ${formatNumber(u.factor, 12)} ${cat.canonical} · ${u.note}`}>
                  {u.sym} · {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1">
            <Input
              id="units-from-value"
              value={leftShown}
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              placeholder="—"
              aria-label={`Value in ${fromU.name}`}
              aria-invalid={fromError !== ''}
              onChange={(e) => {
                setLeftText(e.target.value)
                setActive('left')
              }}
              onFocus={() => {
                if (active !== 'left') {
                  setLeftText(leftShown)
                  setActive('left')
                }
              }}
              className="h-11 flex-1 font-mono text-base tabular-nums"
            />
            {fromError !== '' && (
              <p role="alert" className="mt-1.5 text-xs text-destructive">
                {fromError}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-center sm:justify-start sm:pl-48">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            aria-label="Swap the two units"
            onClick={swapUnits}
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Label htmlFor="units-to" className="w-12 shrink-0 text-sm">
            To
          </Label>
          <Select value={toU.sym} onValueChange={setToSym}>
            <SelectTrigger id="units-to" className="h-11 w-full shrink-0 sm:w-52" aria-label="To unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cat.units.map((u) => (
                <SelectItem key={u.sym} value={u.sym} title={`${u.name} — 1 ${u.sym} = ${formatNumber(u.factor, 12)} ${cat.canonical} · ${u.note}`}>
                  {u.sym} · {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1">
            <Input
              id="units-to-value"
              value={rightShown}
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              placeholder="—"
              aria-label={`Value in ${toU.name}`}
              aria-invalid={toError !== ''}
              onChange={(e) => {
                setRightText(e.target.value)
                setActive('right')
              }}
              onFocus={() => {
                if (active !== 'right') {
                  setRightText(rightShown)
                  setActive('right')
                }
              }}
              className="h-11 flex-1 font-mono text-base tabular-nums"
            />
            {toError !== '' && (
              <p role="alert" className="mt-1.5 text-xs text-destructive">
                {toError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* precision + exact relation */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="units-sig" className="text-xs text-muted-foreground">
            Significant digits
          </Label>
          <Select value={String(sig)} onValueChange={(s) => setSig(Number(s))}>
            <SelectTrigger id="units-sig" className="h-11 w-24" aria-label="Significant digits">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIG_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {exact && (
          <p className="text-xs text-muted-foreground">
            1 {fromU.sym} ={' '}
            <span className="font-mono text-foreground">{exact}</span> {toU.sym} — exact within
            these factor tables
          </p>
        )}
        {overflow && (
          <p role="alert" className="text-xs text-amber-600 dark:text-amber-400">
            The result overflows a 64-bit float — shrink the input to get a real number back.
          </p>
        )}
      </div>

      {/* facts line: the factor each current unit uses */}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {fromU.name} ({fromU.sym}) — 1 {fromU.sym} = {formatNumber(fromU.factor, 12)}{' '}
        {cat.canonical} · {fromU.note}
        <br />
        {toU.name} ({toU.sym}) — 1 {toU.sym} = {formatNumber(toU.factor, 12)} {cat.canonical} ·{' '}
        {toU.note}
        {cat.temp && (
          <>
            <br />
            Degrees are affine, not proportional: °F = °C × 9/5 + 32 · K = °C + 273.15 · °R = °F +
            459.67
          </>
        )}
      </p>

      {catId === 'data' && (
        <p className="mt-3 rounded-lg border border-amber-600/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          KB, MB, GB are the decimal family (10³ steps) — what drive makers quote. KiB, MiB, GiB are
          the binary family (2¹⁰ steps) — what memory counts and what Windows reports, mislabeled,
          as “MB”. The exact line above shows the honest gap: 1 KB = 0.9765625 KiB.
        </p>
      )}

      <PrivacyStrip detail="Every unit conversion is computed in this tab — no session, no account, no upload; nothing is sent anywhere." />
    </div>
  )
}

// ------------------------------------------------------------- bases mode ---

function BasesMode() {
  const [value, setValue] = useState(10)
  const [texts, setTexts] = useState<Record<number, string>>({
    2: '1010',
    8: '12',
    10: '10',
    16: 'a',
  })
  const [error, setError] = useState<{ base: number; why: string } | null>(null)
  const [arbBase, setArbBase] = useState(36)

  function editBase(base: number, text: string) {
    const res = parseInBase(text, base)
    setTexts((prev) => {
      const next = { ...prev, [base]: text }
      if (res.ok) {
        const bases = FIXED_BASES.slice()
        if (bases.indexOf(arbBase) === -1) bases.push(arbBase)
        for (const b of bases) {
          if (b !== base) next[b] = fmtInBase(res.v, b)
        }
      }
      return next
    })
    if (res.ok) {
      setValue(res.v)
      setError(null)
    } else {
      setError(res.why === '' ? null : { base, why: res.why })
    }
  }

  function changeArbBase(b: number) {
    setArbBase(b)
    setTexts((prev) => ({ ...prev, [b]: fmtInBase(value, b) }))
  }

  const bits = bitLength(Math.abs(value))
  const bytes = Math.ceil(bits / 8)
  const arbText = texts[arbBase] ?? fmtInBase(value, arbBase)

  const rowLabel: Record<number, string> = {
    2: 'Base 2 · binary',
    8: 'Base 8 · octal',
    10: 'Base 10 · decimal',
    16: 'Base 16 · hex',
  }

  return (
    <div>
      {/* live rows */}
      <div className="space-y-3">
        {FIXED_BASES.map((b) => (
          <div key={b}>
            <div className="flex items-center gap-3">
              <Label htmlFor={`base-${b}`} className="w-28 shrink-0 text-xs text-muted-foreground">
                {rowLabel[b]}
              </Label>
              <Input
                id={`base-${b}`}
                value={texts[b] ?? ''}
                inputMode={b === 10 ? 'numeric' : 'text'}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={error?.base === b}
                onChange={(e) => editBase(b, e.target.value)}
                className="h-11 flex-1 font-mono text-base"
              />
            </div>
            {error?.base === b && (
              <p role="alert" className="ml-0 mt-1.5 text-xs text-destructive sm:ml-31">
                {error.why}
              </p>
            )}
          </div>
        ))}

        {/* arbitrary base */}
        <div>
          <div className="flex items-center gap-3">
            <Label htmlFor="base-arb" className="w-28 shrink-0 text-xs text-muted-foreground">
              Any base
            </Label>
            <Select value={String(arbBase)} onValueChange={(s) => changeArbBase(Number(s))}>
              <SelectTrigger id="base-arb" className="h-11 w-32 shrink-0" aria-label="Arbitrary base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 35 }, (_, i) => i + 2).map((b) => (
                  <SelectItem key={b} value={String(b)}>
                    Base {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={arbText}
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              aria-label={`Value in base ${arbBase}`}
              aria-invalid={error?.base === arbBase}
              onChange={(e) => editBase(arbBase, e.target.value)}
              className="h-11 flex-1 font-mono text-base"
            />
          </div>
          <p className="ml-0 mt-1.5 text-xs text-muted-foreground sm:ml-31">
            Type here or in the decimal row — both directions convert live. Valid digits in base{' '}
            {arbBase}: {digitRange(arbBase)}.
          </p>
          {error?.base === arbBase && (
            <p role="alert" className="ml-0 mt-1.5 text-xs text-destructive sm:ml-31">
              {error.why}
            </p>
          )}
        </div>
      </div>

      {/* shape of the number */}
      <div className="mt-5 rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold">
          Shape of the number{' '}
          <span className="font-mono text-muted-foreground">
            ({value < 0 ? '−' : ''}
            {Math.abs(value).toLocaleString('en-US')})
          </span>
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {bits} {bits === 1 ? 'bit' : 'bits'} · {bytes} {bytes === 1 ? 'byte' : 'bytes'} ·
          exactness guard: |value| ≤ 2^53 − 1 = 9,007,199,254,740,991
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[8, 16, 32, 64].map((w) => {
            const hex = twosComplementHex(value, w)
            return (
              <div key={w} className="rounded-lg border bg-background px-3 py-2">
                <p className="text-[11px] text-muted-foreground">{w}-bit signed</p>
                {hex ? (
                  <p className="mt-0.5 font-mono text-sm font-semibold">{hex}</p>
                ) : (
                  <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                    needs {(value < 0 ? bits : bits + 1)} signed bits
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Two's complement is how negative integers are stored: -1 is every bit set (FF, FFFF,
          FFFFFFFF…). These views are built with string arithmetic, so they stay exact for every
          value the guard above allows.
        </p>
      </div>

      <PrivacyStrip detail="Every base conversion is computed in this tab — no session, no upload; nothing leaves the device." />
    </div>
  )
}

// ------------------------------------------------------------- roman mode ---

function RomanMode() {
  const [numText, setNumText] = useState('1987')
  const [romanText, setRomanText] = useState('MCMLXXXVII')

  const numRes = romanNumCheck(numText)
  const runs = numRes.ok ? romanRuns(numRes.v) : null
  const romanOut = numRes.ok && runs ? runs.map((r) => r.tok).join('') : null

  const parsed = parseRoman(romanText)

  return (
    <div className="space-y-4">
      {/* number -> roman */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Label htmlFor="roman-num" className="shrink-0 text-sm sm:w-36">
            Number (1–3999)
          </Label>
          <Input
            id="roman-num"
            value={numText}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={numRes.ok || numRes.why === '' ? false : true}
            onChange={(e) => setNumText(e.target.value)}
            className="h-11 flex-1 font-mono text-base tabular-nums"
          />
          <CopyButton text={romanOut ?? ''} label="Copy numeral" />
        </div>
        {!numRes.ok && numRes.why !== '' && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {numRes.why}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {numRes.ok ? (
            <>
              <p className="font-mono text-2xl font-semibold tracking-wide">{romanOut}</p>
              <p className="text-sm text-muted-foreground">
                {numRes.v} ={' '}
                <span className="font-mono">{runs?.map((r) => r.tok).join(' + ')}</span>
              </p>
            </>
          ) : (
            <p className="font-mono text-2xl font-semibold text-muted-foreground">—</p>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Subtractive notation: CM, CD, XC, XL, IX, IV — built from M(1000), D, C, L, X, V, I.
        </p>
      </div>

      {/* roman -> number */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Label htmlFor="roman-text" className="shrink-0 text-sm sm:w-36">
            Roman numeral
          </Label>
          <Input
            id="roman-text"
            value={romanText}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={parsed.ok || parsed.why === '' ? false : true}
            onChange={(e) => setRomanText(e.target.value)}
            className="h-11 flex-1 font-mono text-base uppercase"
          />
          <CopyButton text={parsed.ok ? String(parsed.v) : ''} label="Copy number" />
        </div>
        {!parsed.ok && parsed.why !== '' && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {parsed.why}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {parsed.ok ? (
            <p className="font-mono text-2xl font-semibold tabular-nums">{parsed.v}</p>
          ) : (
            <p className="font-mono text-2xl font-semibold text-muted-foreground">—</p>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Strict classical grammar — lowercase and spaces are accepted, but anything the grammar
          forbids (IIII, VX, IC…) is rejected with the exact rule it breaks, never guessed at.
        </p>
      </div>

      <PrivacyStrip detail="Every numeral check is computed in this tab — no session, no upload; nothing is sent anywhere." />
    </div>
  )
}

// ------------------------------------------------------------------ tool ----

export function ConvertUnitsTool() {
  return (
    <Tabs defaultValue="units" className="w-full">
      <TabsList className="h-11 w-full sm:w-auto">
        <TabsTrigger value="units" className="h-full px-4 sm:px-5">
          Units
        </TabsTrigger>
        <TabsTrigger value="bases" className="h-full px-4 sm:px-5">
          Bases
        </TabsTrigger>
        <TabsTrigger value="roman" className="h-full px-4 sm:px-5">
          Roman
        </TabsTrigger>
      </TabsList>
      <TabsContent value="units" className="mt-4">
        <UnitsMode />
      </TabsContent>
      <TabsContent value="bases" className="mt-4">
        <BasesMode />
      </TabsContent>
      <TabsContent value="roman" className="mt-4">
        <RomanMode />
      </TabsContent>
    </Tabs>
  )
}
