'use client'

// Font Changer — turns plain text into the Unicode "styled alphabet"
// characters people use in bios and usernames (𝗯𝗼𝗹𝗱, 𝑖𝑡𝑎𝑙𝑖𝑐, ꜱᴍᴀʟʟ
// ᴄᴀᴘꜱ…). These are not fonts — they are code points from the Mathematical
// Alphanumeric Symbols block and friends, so every style maps only the
// letters and digits Unicode actually provides, and the tool says honestly
// which characters a style cannot render. Nothing leaves the tab.

import { useMemo, useState } from 'react'
import { Check, Copy, Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PrivacyStrip } from '@/components/instant/instant-kit'

/** Build an A-Z / a-z map from a base offset; digits come from a literal
 *  string indexed per code point (the blocks are not contiguous with
 *  letters, and astral digits split into surrogate halves under plain
 *  indexing). */
function offsetAlphabet(upperStart: number, lowerStart: number, digits?: string) {
  const map: Record<string, string> = {}
  for (let i = 0; i < 26; i++) {
    map[String.fromCharCode(65 + i)] = String.fromCodePoint(upperStart + i)
    map[String.fromCharCode(97 + i)] = String.fromCodePoint(lowerStart + i)
  }
  if (digits) {
    const digitChars = [...digits]
    for (let i = 0; i < 10; i++) map[String(i)] = digitChars[i]
  }
  return map
}

// The Mathematical Alphanumeric blocks run in code-point order with known
// holes (the honorific letters at 0x2100-ish and the reserved slots inside
// 0x1D49C/0x1D504), so those styles override the standard letters after the
// offset build. Digits come from their own (non-contiguous) block where the
// style provides them. fromCodePoint, not fromCharCode — the blocks live
// beyond 0xFFFF and fromCharCode wraps modulo 0x10000.
function mathAlphabet(upperStart: number, lowerStart: number, digits?: string) {
  const map = offsetAlphabet(upperStart, lowerStart)
  if (digits) {
    const digitChars = [...digits]
    for (let i = 0; i < 10; i++) map[String(i)] = digitChars[i]
  }
  return map
}

// Explicit string tables for the styles whose Unicode coverage is ragged —
// writing them out makes the honest limits visible instead of hidden.
const SMALL_CAPS_MAP: Record<string, string> = Object.fromEntries(
  'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘꞯʀꜱᴛᴜᴠᴡxʏᴢ'
    .split('')
    .map((c, i) => [String.fromCharCode(97 + i), c])
    .concat([['A', 'ᴀ'], ['B', 'ʙ'], ['C', 'ᴄ'], ['D', 'ᴅ'], ['E', 'ᴇ'], ['F', 'ꜰ'], ['G', 'ɢ'], ['H', 'ʜ'], ['I', 'ɪ'], ['J', 'ᴊ'], ['K', 'ᴋ'], ['L', 'ʟ'], ['M', 'ᴍ'], ['N', 'ɴ'], ['O', 'ᴏ'], ['P', 'ᴘ'], ['Q', 'ꞯ'], ['R', 'ʀ'], ['S', 'ꜱ'], ['T', 'ᴛ'], ['U', 'ᴜ'], ['V', 'ᴠ'], ['W', 'ᴡ'], ['X', 'x'], ['Y', 'ʏ'], ['Z', 'ᴢ']]),
)

const UPSIDE_DOWN: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ',
  k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ',
  u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  A: '∀', B: 'ᙠ', C: 'Ɔ', D: 'ᗡ', E: 'Ǝ', F: 'Ⅎ', G: '⅁', H: 'H', I: 'I', J: 'ſ',
  K: 'ʞ', L: '˥', M: 'W', N: 'N', O: 'O', P: 'Ԁ', Q: 'Ò', R: 'ᴚ', S: 'S', T: '⊥',
  U: '∩', V: 'Λ', W: 'M', X: 'X', Y: '⅄', Z: 'Z',
  '0': '0', '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ', '6': '9', '7': 'ㄥ',
  '8': '8', '9': '6',
  '.': '˙', ',': "'", '?': '¿', '!': '¡', "'": ',', '"': '„', '(': ')', ')': '(',
  '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '&': '⅋', '_': '‾',
}

interface StyleDef {
  id: string
  label: string
  sample: string
  map: Record<string, string>
  /** True when digits map too. */
  digits: boolean
}

const STYLES: StyleDef[] = [
  {
    id: 'bold-sans',
    label: 'Bold sans-serif',
    sample: '𝗯𝗼𝗹𝗱',
    map: mathAlphabet(0x1d5d4, 0x1d5ee, '𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵'),
    digits: true,
  },
  {
    id: 'italic-sans',
    label: 'Italic sans-serif',
    sample: '𝘪𝘵𝘢𝘭𝘪𝘤',
    // Sans italic block has no bold companion for digits; letters only.
    map: mathAlphabet(0x1d608, 0x1d622),
    digits: false,
  },
  {
    id: 'bold-italic-sans',
    label: 'Bold italic',
    sample: '𝙗𝙤𝙡𝙙 𝙞𝙩𝙖𝙡𝙞𝙘',
    map: mathAlphabet(0x1d63c, 0x1d656),
    digits: false,
  },
  {
    id: 'serif-bold',
    label: 'Serif bold',
    sample: '𝐬𝐞𝐫𝐢𝐟𝐬',
    map: mathAlphabet(0x1d400, 0x1d41a, '𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗'),
    digits: true,
  },
  {
    id: 'script',
    label: 'Script (cursive)',
    sample: '𝓼𝓬𝓻𝓲𝓹𝓽',
    // 0x1D49C block has reserved holes (B, E, F, H, I, L, M, R are honorific
    // letters); fill them with the standard substitutes.
    map: (() => {
      const m = mathAlphabet(0x1d49c, 0x1d4b6)
      m['B'] = 'ℬ'; m['E'] = 'ℰ'; m['F'] = 'ℱ'; m['H'] = 'ℋ'
      m['I'] = 'ℐ'; m['L'] = 'ℒ'; m['M'] = 'ℳ'; m['R'] = 'ℛ'
      m['e'] = 'ℯ'; m['g'] = 'ℊ'; m['o'] = 'ℴ'
      return m
    })(),
    digits: false,
  },
  {
    id: 'bold-script',
    label: 'Bold script',
    sample: '𝓼𝓬𝓻𝓲𝓹𝓽 𝓫𝓸𝓵𝓭',
    map: mathAlphabet(0x1d4d0, 0x1d4ea),
    digits: false,
  },
  {
    id: 'fraktur',
    label: 'Fraktur (gothic)',
    sample: '𝔤𝔬𝔱𝔥𝔦𝔠',
    map: (() => {
      const m = mathAlphabet(0x1d504, 0x1d51e)
      m['C'] = 'ℭ'; m['H'] = 'ℌ'; m['I'] = 'ℑ'; m['R'] = 'ℜ'; m['Z'] = 'ℨ'
      return m
    })(),
    digits: false,
  },
  {
    id: 'double-struck',
    label: 'Double-struck (outline)',
    sample: '𝕠𝕦𝕥𝕝𝕚𝕟𝕖',
    map: (() => {
      const m = mathAlphabet(0x1d538, 0x1d552, '𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡')
      m['C'] = 'ℂ'; m['H'] = 'ℍ'; m['N'] = 'ℕ'; m['P'] = 'ℙ'; m['Q'] = 'ℚ'
      m['R'] = 'ℝ'; m['Z'] = 'ℤ'
      return m
    })(),
    digits: true,
  },
  {
    id: 'monospace',
    label: 'Monospace',
    sample: '𝚖𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎',
    map: mathAlphabet(0x1d670, 0x1d68a, '𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿'),
    digits: true,
  },
  {
    id: 'small-caps',
    label: 'Small caps',
    sample: 'sᴍᴀʟʟ ᴄᴀᴘs',
    map: SMALL_CAPS_MAP,
    digits: false,
  },
  {
    id: 'circled',
    label: 'Circled',
    sample: 'ⓒⓘⓡⓒⓛⓔ',
    map: offsetAlphabet(0x24b6, 0x24d0, '⓪①②③④⑤⑥⑦⑧⑨'),
    digits: true,
  },
  {
    id: 'fullwidth',
    label: 'Fullwidth (vaporwave)',
    sample: 'ｆｕｌｌｗｉｄｔｈ',
    map: offsetAlphabet(0xff21, 0xff41, '０１２３４５６７８９'),
    digits: true,
  },
  {
    id: 'upside-down',
    label: 'Upside-down (flip)',
    sample: 'ʇxǝʇ pǝddılɟ',
    map: UPSIDE_DOWN,
    digits: true,
  },
]

/** Apply one style: map what Unicode provides, keep the rest as-is and count. */
function applyStyle(text: string, style: StyleDef): { out: string; unmapped: string[] } {
  const unmappedSet = new Set<string>()
  let out = ''
  for (const ch of text) {
    const mapped = style.map[ch]
    if (mapped !== undefined) out += mapped
    else {
      out += ch
      unmappedSet.add(ch)
    }
  }
  return { out, unmapped: [...unmappedSet] }
}

export function FontChangerTool() {
  const [text, setText] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const results = useMemo(
    () => STYLES.map((s) => ({ style: s, ...applyStyle(text, s) })),
    [text],
  )

  const copy = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(id)
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600)
    } catch {
      /* clipboard denied — the text stays selectable as a fallback */
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <Label htmlFor="fc-input" className="text-sm font-semibold">
          Your text
        </Label>
        <textarea
          id="fc-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder="Type a bio line or username — every style below updates as you type"
          className="mt-2 w-full rounded-md border bg-background px-3.5 py-2.5 text-sm leading-relaxed"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          These are Unicode characters, not installed fonts — they paste anywhere rich text does (Instagram, X, Discord bios), and they keep working when you copy them.
        </p>
      </div>

      <div className="space-y-2">
        {results.map(({ style, out, unmapped }) => {
          const hasText = text.trim().length > 0
          return (
            <div key={style.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Type className="size-3.5" aria-hidden="true" />
                  {style.label}
                </span>
                {unmapped.length > 0 && hasText && (
                  <span className="text-[11px] text-muted-foreground/80" title="Characters this style's Unicode block does not provide">
                    no mapping for: {unmapped.slice(0, 8).join(' ')}
                    {unmapped.length > 8 ? '…' : ''}
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  disabled={!hasText}
                  onClick={() => void copy(style.id, out)}
                  aria-label={`Copy ${style.label} version`}
                >
                  {copied === style.id ? (
                    <>
                      <Check className="size-3.5" aria-hidden="true" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden="true" /> Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="mt-2 min-h-[1.6rem] break-words text-lg leading-relaxed" data-style={style.id} aria-live="polite">
                {hasText ? (
                  out || <span className="text-sm text-muted-foreground/60">nothing maps yet</span>
                ) : (
                  <span className="text-muted-foreground/60">{style.sample}</span>
                )}
              </p>
            </div>
          )
        })}
      </div>

      <PrivacyStrip detail="The mapping is a code-point table on this page: your text is transformed character by character in this tab, and nothing is sent, stored or suggested anywhere." />
    </div>
  )
}
