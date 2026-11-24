'use client'

// Fake Data Studio — realistic-looking, guaranteed-fake test records built
// entirely on this device. The generator is seeded (xmur3 + mulberry32), so
// a dataset can be reproduced exactly by re-entering its seed — useful when
// a bug report says "row 14 breaks the form" and the teammate needs the same
// row. Honesty by construction: every field stays inside officially reserved
// or invalid value space — e-mails only use the IANA-reserved example.*
// domains, North-American phones only the 555-01XX fictional exchange, IP
// addresses only the RFC 5737 documentation blocks, and other locales' phone
// numbers start with a digit that makes them undialable internationally.

import { useMemo, useState } from 'react'
import { Check, Copy, Download, FileJson, RefreshCw } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { PrivacyStrip, downloadBlob } from '@/components/instant/instant-kit'

// ------------------------------------------------------------------- rng -----

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Rng {
  next: () => number
  int: (maxExclusive: number) => number
  pick: <T>(arr: T[]) => T
  chance: (p: number) => boolean
}

function makeRng(seedText: string): Rng {
  const next = mulberry32(xmur3(seedText)())
  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    pick: <T,>(arr: T[]) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  }
}

// ----------------------------------------------------------------- banks -----

interface LocaleBank {
  label: string
  first: string[]
  last: string[]
  streets: string[]
  cities: string[]
  /** Locale-shaped postcode. Documented formats, never a real address. */
  postcode: (rng: Rng) => string
  phone: (rng: Rng) => string
  companySuffix: string
}

const LOCALES: Record<string, LocaleBank> = {
  en: {
    label: 'English (US/UK)',
    first: ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Susan', 'Emma', 'Olivia', 'Noah', 'Liam', 'Ava', 'Sophia', 'Ethan', 'Grace'],
    last: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Martin', 'Lee', 'Walker', 'Hall', 'Young', 'King', 'Wright'],
    streets: ['Maple Street', 'Oak Avenue', 'Cedar Lane', 'Elm Drive', 'Willow Court', 'Pine Road', 'Birch Boulevard', 'Summit Way', 'Harbor Lane', 'Meadow View'],
    cities: ['Portland', 'Austin', 'Denver', 'Boston', 'Seattle', 'Chicago', 'Bristol', 'Leeds'],
    postcode: (rng) => String(10000 + rng.int(89999)),
    // NANP fictional range only: +1 (area) 555-0100…0199.
    phone: (rng) => `+1 (${200 + rng.int(700)}) 555-01${String(rng.int(100)).padStart(2, '0')}`,
    companySuffix: 'LLC',
  },
  de: {
    label: 'German',
    first: ['Lukas', 'Anna', 'Felix', 'Marie', 'Jonas', 'Emma', 'Leon', 'Lena', 'Maximilian', 'Sophie', 'Paul', 'Clara', 'Niklas', 'Johanna', 'Tim', 'Laura', 'Jan', 'Katrin', 'Tobias', 'Hannah'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Braun', 'Krüger', 'Lehmann', 'Vogel'],
    streets: ['Hauptstraße', 'Bahnhofstraße', 'Gartenweg', 'Lindenallee', 'Bergstraße', 'Kirchplatz', 'Rosenweg', 'Amselgasse', 'Seestraße', 'Wiesengrund'],
    cities: ['Berlin', 'München', 'Hamburg', 'Köln', 'Leipzig', 'Dresden'],
    postcode: (rng) => String(10000 + rng.int(89999)),
    // Leading 0 after +49 makes this invalid in international dialing.
    phone: (rng) => `+49 0${151 + rng.int(4)} ${String(rng.int(10000000)).padStart(8, '0')}`,
    companySuffix: 'GmbH',
  },
  fr: {
    label: 'French',
    first: ['Lucas', 'Emma', 'Gabriel', 'Louise', 'Raphaël', 'Jade', 'Louis', 'Alice', 'Hugo', 'Chloé', 'Léo', 'Manon', 'Nathan', 'Camille', 'Théo', 'Inès', 'Arthur', 'Léa', 'Adam', 'Sarah'],
    last: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'Roux', 'Fontaine', 'Benoît', 'Girard', 'Bonnet'],
    streets: ['Rue de la Paix', 'Avenue des Champs', 'Rue du commerce', 'Boulevard Voltaire', 'Impasse des Roses', 'Rue Victor Hugo', 'Allée des Tilleuls', 'Place de la Mairie', 'Chemin du Lavoir', 'Rue des Écoles'],
    cities: ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Toulouse'],
    postcode: (rng) => String(10000 + rng.int(89999)),
    phone: (rng) => `+33 0${6 + rng.int(2)} ${String(rng.int(100)).padStart(2, '0')} ${String(rng.int(100)).padStart(2, '0')} ${String(rng.int(100)).padStart(2, '0')} ${String(rng.int(100)).padStart(2, '0')}`,
    companySuffix: 'SAS',
  },
  es: {
    label: 'Spanish',
    first: ['Hugo', 'María', 'Martín', 'Lucía', 'Pablo', 'Sofía', 'Álvaro', 'Martina', 'Diego', 'Valeria', 'Mario', 'Paula', 'Adrián', 'Carla', 'Daniel', 'Noa', 'Javier', 'Elena', 'Sergio', 'Alba'],
    last: ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Navarro', 'Torres'],
    streets: ['Calle Mayor', 'Avenida de la Constitución', 'Calle del Sol', 'Paseo del Prado', 'Calle Real', 'Camino de Santiago', 'Plaza Mayor', 'Calle Nueva', 'Rua do Costas', 'Calle Jardín'],
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Bilbao'],
    postcode: (rng) => String(10000 + rng.int(89999)),
    phone: (rng) => `+34 000 000 ${String(100 + rng.int(900))}`,
    companySuffix: 'S.L.',
  },
  in: {
    label: 'Indian',
    first: ['Aarav', 'Ananya', 'Vivaan', 'Diya', 'Aditya', 'Aadhya', 'Vihaan', 'Myra', 'Arjun', 'Saanvi', 'Reyansh', 'Ira', 'Kabir', 'Kiara', 'Rohan', 'Anika', 'Dev', 'Tara', 'Rahul', 'Priya'],
    last: ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Reddy', 'Nair', 'Mehta', 'Iyer', 'Joshi', 'Verma', 'Malhotra', 'Chatterjee', 'Das', 'Khan', 'Bose', 'Rao', 'Desai', 'Kapoor', 'Pillai'],
    streets: ['MG Road', 'Park Street', 'Anna Salai', 'Ring Road', 'Civil Lines', 'Model Town Road', 'Jubilee Hills Road', 'Banjara Hills Road No. 5', 'Sector 12 Market', 'Vidya Vihar Street'],
    cities: ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad'],
    // Indian PIN codes: 6 digits, first digit 1–8 (never 0/9).
    postcode: (rng) => String((1 + rng.int(8)) * 100000 + rng.int(100000)),
    phone: (rng) => `+91 00000 ${String(rng.int(100000)).padStart(5, '0')}`,
    companySuffix: 'Pvt Ltd',
  },
  jp: {
    label: 'Japanese (romaji)',
    first: ['Haruto', 'Yui', 'Sota', 'Sakura', 'Riku', 'Hina', 'Kaito', 'Aoi', 'Ren', 'Rin', 'Yuto', 'Mei', 'Hiroto', 'Yuna', 'Takumi', 'Nanami', 'Daiki', 'Akari', 'Kenta', 'Mio'],
    last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi', 'Shimizu', 'Saito'],
    streets: ['Sakura-dori', 'Heiwadori 2-chome', 'Minami-aoyama', 'Shibuya 1-chome', 'Nishi-shinjuku', 'Higashi-ginza', 'Kita-ku Ohara', 'Chuo-ku Kachidoki'],
    cities: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka'],
    // Japanese postal codes: NNN-NNNN.
    postcode: (rng) => `${100 + rng.int(900)}-${String(rng.int(10000)).padStart(4, '0')}`,
    phone: (rng) => `+81 0${90 + rng.int(3)} ${String(1000 + rng.int(9000))} ${String(rng.int(10000)).padStart(4, '0')}`,
    companySuffix: 'K.K.',
  },
}

const JOB_TITLES = [
  'Product Designer', 'Frontend Engineer', 'Backend Engineer', 'Full-stack Developer',
  'QA Analyst', 'DevOps Engineer', 'Data Analyst', 'Product Manager',
  'Marketing Lead', 'Sales Manager', 'Customer Success', 'UX Researcher',
  'Technical Writer', 'Support Engineer', 'Security Analyst', 'Team Lead',
  'Project Manager', 'Mobile Developer', 'Platform Engineer', 'Office Manager',
]

const COMPANY_PREFIX = [
  'Northwind', 'Acme', 'Bright', 'Cedar', 'Summit', 'Bluepeak', 'Ironwood',
  'Redwood', 'Goldenleaf', 'Silverline', 'Falcon', 'Harbor', 'Vertex',
  'Lumen', 'Orbit', 'Pinnacle', 'Quartz', 'Sterling', 'Umbra', 'Zenith',
]
const COMPANY_MIDDLE = ['', 'Tech', 'Digital', 'Systems', 'Labs', 'Works', 'Group', 'Studio', 'Media', 'Analytics']

// RFC 5737 documentation-only IPv4 blocks — never routed on the public internet.
const DOC_BLOCKS = ['192.0.2.', '198.51.100.', '203.0.113.']

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
]

const EMAIL_DOMAINS = ['example.com', 'example.net', 'example.org'] // IANA-reserved

// ------------------------------------------------------------------ record ---

export interface FieldSpec {
  key: string
  label: string
  defaultOn: boolean
}

const FIELDS: FieldSpec[] = [
  { key: 'name', label: 'Full name', defaultOn: true },
  { key: 'username', label: 'Username', defaultOn: true },
  { key: 'email', label: 'E-mail', defaultOn: true },
  { key: 'phone', label: 'Phone (undialable)', defaultOn: true },
  { key: 'street', label: 'Street address', defaultOn: true },
  { key: 'city', label: 'City & postcode', defaultOn: true },
  { key: 'company', label: 'Company', defaultOn: true },
  { key: 'job', label: 'Job title', defaultOn: true },
  { key: 'birthday', label: 'Birthday & age', defaultOn: true },
  { key: 'ip', label: 'IPv4 (doc range)', defaultOn: false },
  { key: 'agent', label: 'User agent', defaultOn: false },
  { key: 'color', label: 'Color (hex)', defaultOn: false },
]

type Row = Record<string, string | number>

function generateRow(rng: Rng, locale: LocaleBank, on: Set<string>): Row {
  const row: Row = {}
  const first = rng.pick(locale.first)
  const last = rng.pick(locale.last)

  if (on.has('name')) row['Full name'] = `${first} ${last}`
  if (on.has('username')) {
    const handle = `${first}.${last}`.toLowerCase().replace(/[^a-z0-9.]/g, '') + rng.int(900)
    row['Username'] = handle
  }
  if (on.has('email')) {
    const slug = `${first}.${last}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.]/g, '')
    row['E-mail'] = `${slug}${rng.int(100)}@${rng.pick(EMAIL_DOMAINS)}`
  }
  if (on.has('phone')) row['Phone'] = locale.phone(rng)
  if (on.has('street')) {
    const unit = rng.chance(0.25) ? ` Apt ${5 + rng.int(40)}` : ''
    row['Street address'] = `${100 + rng.int(9900)} ${rng.pick(locale.streets)}${unit}`
  }
  if (on.has('city')) {
    const city = rng.pick(locale.cities)
    row['City & postcode'] = `${city} ${locale.postcode(rng)}`
  }
  if (on.has('company')) {
    const mid = rng.pick(COMPANY_MIDDLE)
    row['Company'] = `${rng.pick(COMPANY_PREFIX)}${mid} ${locale.companySuffix}`
  }
  if (on.has('job')) row['Job title'] = rng.pick(JOB_TITLES)
  if (on.has('birthday')) {
    const year = 1965 + rng.int(45)
    const month = 1 + rng.int(12)
    const day = 1 + rng.int(28)
    const birth = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    row['Birthday'] = birth
    row['Age'] = Math.max(0, new Date().getFullYear() - year)
  }
  if (on.has('ip')) row['IPv4'] = `${rng.pick(DOC_BLOCKS)}${2 + rng.int(251)}`
  if (on.has('agent')) row['User agent'] = rng.pick(USER_AGENTS)
  if (on.has('color')) {
    let hex = '#'
    for (let i = 0; i < 6; i++) hex += '0123456789ABCDEF'[rng.int(16)]
    row['Color'] = hex
  }
  return row
}

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = cols.map(esc).join(',')
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n')
  return head + '\n' + body
}

// -------------------------------------------------------------------- ui -----

export function FakeDataTool() {
  const [localeId, setLocaleId] = useState('en')
  const [count, setCount] = useState(10)
  const [seedText, setSeedText] = useState('kontivo')
  const [fieldOn, setFieldOn] = useState<Record<string, boolean>>(
    () => Object.fromEntries(FIELDS.map((f) => [f.key, f.defaultOn])),
  )
  const [copied, setCopied] = useState(false)

  const on = useMemo(() => new Set(Object.entries(fieldOn).filter(([, v]) => v).map(([k]) => k)), [fieldOn])
  const activeFields = FIELDS.filter((f) => on.has(f.key))
  const locale = LOCALES[localeId]

  const rows = useMemo(() => {
    if (activeFields.length === 0) return []
    const rng = makeRng(`${localeId}|${count}|${[...on].join(',')}|${seedText}`)
    const out: Row[] = []
    for (let i = 0; i < Math.min(Math.max(count, 1), 500); i++) out.push(generateRow(rng, locale, on))
    return out
  }, [localeId, count, on, seedText, locale, activeFields.length])

  const shown = rows.slice(0, 25)

  const roll = () => {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
    let s = ''
    for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
    setSeedText(s)
  }

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(rows, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard refused */
    }
  }

  const exportCsv = () =>
    downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `fake-data-${seedText}.csv`)

  const exportJson = () =>
    downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), `fake-data-${seedText}.json`)

  return (
    <div className="space-y-4">
      {/* controls */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="fd-locale">Name locale</Label>
            <Select value={localeId} onValueChange={setLocaleId}>
              <SelectTrigger id="fd-locale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LOCALES).map(([id, bank]) => (
                  <SelectItem key={id} value={id}>{bank.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fd-count">Records (1–500)</Label>
            <Input
              id="fd-count"
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (!Number.isNaN(n)) setCount(Math.floor(n))
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fd-seed">Seed</Label>
            <div className="flex gap-2">
              <Input
                id="fd-seed"
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                className="font-mono text-sm"
              />
              <Button type="button" variant="outline" size="icon" aria-label="New random seed" onClick={roll}>
                <RefreshCw className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Label>Fields</Label>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2.5">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <Switch
                  checked={fieldOn[f.key]}
                  onCheckedChange={(v) => setFieldOn((prev) => ({ ...prev, [f.key]: v }))}
                  aria-label={`Include ${f.label}`}
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>
        <PrivacyStrip detail="Every value is fabricated on this device from a seeded generator, and every fake identifier stays inside officially reserved space: e-mails use the IANA-reserved example.* domains, phones are the 555-01XX fictional exchange or a leading-zero (undialable) format, IPs are RFC 5737 documentation blocks. Nothing maps to a real person, and the same seed rebuilds the same dataset." />
      </div>

      {/* table */}
      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            {rows.length} record{rows.length === 1 ? '' : 's'} · {activeFields.length} field{activeFields.length === 1 ? '' : 's'}
            {rows.length > 25 ? ' · first 25 shown' : ''}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyJson} disabled={rows.length === 0}>
              {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy JSON'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-3.5" aria-hidden="true" /> CSV
            </Button>
            <Button type="button" size="sm" onClick={exportJson} disabled={rows.length === 0}>
              <FileJson className="size-3.5" aria-hidden="true" /> JSON
            </Button>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Turn on at least one field above to generate records.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">#</th>
                  {activeFields.map((f) => (
                    <th key={f.key} className="whitespace-nowrap px-4 py-2.5 font-medium text-muted-foreground">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{i + 1}</td>
                    {activeFields.map((f) => (
                      <td key={f.key} className="max-w-[240px] truncate px-4 py-2.5" title={String(r[f.label])}>
                        {String(r[f.label])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
