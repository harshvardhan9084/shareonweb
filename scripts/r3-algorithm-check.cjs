/* eslint-disable @typescript-eslint/no-require-imports */
// Offline sanity check of the R3 pure algorithms, mirroring the component
// logic exactly (extracted, not imported — the components are 'use client'
// TSX; these copies must stay in sync and any drift shows up as a mismatch
// against the QA browser checks).
const assert = require('node:assert')

// ---- number-to-words -------------------------------------------------------
const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen']
const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']
function threeDigits(n) {
  const parts = []
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (hundreds > 0) parts.push(ONES[hundreds], 'hundred')
  if (rest > 0) {
    if (rest < 20) parts.push(ONES[rest])
    else {
      const t = TENS[Math.floor(rest / 10)]
      const o = rest % 10
      parts.push(o > 0 ? `${t}-${ONES[o]}` : t)
    }
  }
  return parts.join(' ')
}
const INTL = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion']
const INDIAN_GROUPS = ['', 'thousand', 'lakh', 'crore', 'arab']
function intWordsIntl(n) {
  if (n === 0) return 'zero'
  const groups = []
  let rest = n
  while (rest > 0) { groups.push(rest % 1000); rest = Math.floor(rest / 1000) }
  const parts = []
  for (let i = groups.length - 1; i >= 0; i--) { if (groups[i] === 0) continue; parts.push(threeDigits(groups[i]), INTL[i] ?? '') }
  return parts.filter(Boolean).join(' ').trim()
}
function intWordsIndian(n) {
  if (n === 0) return 'zero'
  const groups = [n % 1000]
  let rest = Math.floor(n / 1000)
  while (rest > 0) { groups.push(rest % 100); rest = Math.floor(rest / 100) }
  const parts = []
  for (let i = groups.length - 1; i >= 0; i--) { if (groups[i] === 0) continue; parts.push(threeDigits(groups[i]), INDIAN_GROUPS[i] ?? '') }
  return parts.filter(Boolean).join(' ').trim()
}
assert.equal(intWordsIntl(1234), 'one thousand two hundred thirty-four')
assert.equal(intWordsIntl(1234567), 'one million two hundred thirty-four thousand five hundred sixty-seven')
assert.equal(intWordsIndian(123456), 'one lakh twenty-three thousand four hundred fifty-six')
assert.equal(intWordsIndian(100000), 'one lakh')
assert.equal(intWordsIntl(1000000000), 'one billion')
assert.equal(intWordsIndian(10000000), 'one crore')
assert.equal(intWordsIntl(0), 'zero')
console.log('number-to-words: OK')

// ---- stats quantile --------------------------------------------------------
function quantile(sorted, p) {
  if (sorted.length === 0) return NaN
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * p
  const lo = Math.floor(pos); const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}
const s78 = [77, 78, 84, 85, 91]
assert.equal(quantile(s78, 0.5), 84)
// PERCENTILE.INC of [77,78,84,85,91] at 0.25 → pos=(5-1)*0.25=1 → sorted[1]=78
assert.equal(quantile(s78, 0.25), 78)
// mean 78+84+91+77+85 = 415/5 = 83
assert.equal(s78.reduce((a, b) => a + b, 0) / 5, 83)
console.log('stats quantiles/mean: OK')

// ---- json-to-ts generator (copy of the component logic) ---------------------
const RESERVED = new Set(['Type','Interface','Class','Enum','Const','Let','Var','New','Export','Import','Default','Return','Void','Null','Undefined','String','Number','Boolean','Object','Any','Never','Unknown','Readonly'])
function pascal(raw) {
  const cleaned = raw.replace(/[^a-zA-Z0-9_$]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^[^a-zA-Z_$]+/, '')
  const named = cleaned.length > 0 ? cleaned : 'Field'
  const cased = named.charAt(0).toUpperCase() + named.slice(1)
  return RESERVED.has(cased) ? cased + 'Type' : cased
}
function singular(word) {
  if (/ies$/i.test(word)) return word.replace(/ies$/i, 'y')
  if (/([sxz]|ch|sh)es$/i.test(word)) return word.replace(/es$/i, '')
  if (/[^s]s$/i.test(word)) return word.slice(0, -1)
  return word
}
function isObject(v) { return typeof v === 'object' && v !== null && !Array.isArray(v) }
class Collector {
  constructor() { this.shapes = new Map(); this.names = new Map(); this.counter = new Map() }
  name(value, hint, optionalKeys) {
    if (value === null) return { expr: 'null' }
    if (typeof value === 'boolean') return { expr: 'boolean' }
    if (typeof value === 'number') return { expr: 'number' }
    if (typeof value === 'string') return { expr: 'string' }
    if (Array.isArray(value)) {
      if (value.length === 0) return { expr: 'unknown[]' }
      const objects = value.filter(isObject)
      if (objects.length === value.length) {
        const keyCounts = new Map()
        for (const o of objects) for (const k of Object.keys(o)) keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1)
        const optionalKeys2 = new Set([...keyCounts.entries()].filter(([k, c]) => c < objects.length || objects.every(o => o[k] === null)).map(([k]) => k))
        const merged = {}
        for (const o of objects) for (const [k, v] of Object.entries(o)) { if (!(k in merged) || merged[k] === null) merged[k] = v }
        const item = this.name(merged, singular(hint), optionalKeys2)
        return { expr: `${item.expr}[]` }
      }
      const memberExprs = [...new Set(value.map(v => this.name(v, hint).expr))]
      const union = memberExprs.length === 1 ? memberExprs[0] : `(${memberExprs.join(' | ')})`
      return { expr: `${union}[]` }
    }
    const members = Object.entries(value).map(([key, v]) => ({ key, expr: this.name(v, key).expr, optional: optionalKeys?.has(key) ?? false }))
    const sig = members.map(m => `${m.key}${m.optional ? '?' : ''}:${m.expr}`).sort().join(';')
    const existing = this.names.get(sig)
    if (existing) return { expr: existing }
    const base = pascal(hint)
    const n = (this.counter.get(base) ?? 0) + 1
    this.counter.set(base, n)
    const finalName = n === 1 ? base : `${base}${n}`
    this.names.set(sig, finalName)
    this.shapes.set(finalName, members)
    return { expr: finalName }
  }
  emit(useType, readonly) {
    const lines = []
    const prefix = readonly ? 'readonly ' : ''
    for (const [name, members] of this.shapes) {
      lines.push(`export ${useType ? 'type' : 'interface'} ${name} ${useType ? '= {' : '{'}`)
      for (const { key, expr, optional } of members) {
        const propKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
        lines.push(`  ${prefix}${propKey}${optional ? '?' : ''}: ${expr}`)
      }
      lines.push('}')
      lines.push('')
    }
    return lines.join('\n').trimEnd() + (lines.length > 0 ? '\n' : '')
  }
}
function generate(value, rootNameRaw, useType, readonly) {
  const rootName = pascal(rootNameRaw || 'Root')
  const collector = new Collector()
  const kw = useType ? 'type' : 'interface'
  const open = useType ? '= {' : '{'
  if (Array.isArray(value) && value.some(isObject)) {
    const items = collector.name(value, `${rootName}Item`)
    const body = collector.emit(useType, readonly)
    return body + `export ${kw} ${rootName} ${open}\n  items: ${items.expr}\n}\n`
  }
  const root = collector.name(value, rootName)
  const body = collector.emit(useType, readonly)
  if (body.length > 0) return body
  return `export type ${rootName} = ${root.expr}\n`
}
const sample = {
  id: 42,
  user: { name: 'Ada', email: 'ada@example.com', admin: false },
  tags: ['alpha', 'beta'],
  orders: [
    { sku: 'KT-100', qty: 2, price: 19.5 },
    { sku: 'KT-220', qty: 1, price: 42, note: 'gift wrap' },
  ],
}
const out = generate(sample, 'OrderPayload', false, false)
assert.ok(out.includes('export interface OrderPayload'), 'root interface')
assert.ok(out.includes('note?: string'), 'optional note')
assert.ok(out.includes('sku: string'), 'order fields')
assert.ok(out.includes('tags: string[]'), 'string array')
assert.ok(out.includes('user: User'), 'nested named')
console.log('--- json-to-ts sample output ---')
console.log(out)
// root-array case
const arrOut = generate([{ a: 1, b: 'x' }, { a: 2, c: true }], 'Api', false, false)
assert.ok(arrOut.includes('export interface ApiItem'), 'item interface named')
assert.ok(arrOut.includes('c?: boolean'), 'optional c')
assert.ok(arrOut.includes('export interface Api'), 'wrapper')
assert.ok(arrOut.includes('items: ApiItem[]'), 'wrapper items')
console.log('--- root array output ---')
console.log(arrOut)
// primitive root
assert.equal(generate('hello', 'Root', false, false), 'export type Root = string\n')
console.log('json-to-ts: OK')

// ---- morse table spot checks ----------------------------------------------
const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..' }
assert.equal(['s','o','s'].map(c => MORSE[c]).join(' '), '... --- ...')
assert.equal(['a','d','k'].map(c => MORSE[c]).join(' '), '.- -.. -.-')
// PARIS timing: unit at 15 WPM = 80 ms
assert.equal(Math.round(1.2 / 15 * 1000), 80)
console.log('morse: OK')
console.log('ALL R3 ALGORITHM CHECKS PASSED')
