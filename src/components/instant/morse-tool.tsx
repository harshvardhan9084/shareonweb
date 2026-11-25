'use client'

// Morse Code Translator — text → Morse and Morse → text in one box (the
// direction is detected from what you typed), with live audio playback on a
// WebAudio oscillator. Timing follows the standard: the dot is one unit,
// dash three, the gap inside a letter one, between letters three, between
// words seven — and the unit length comes from your chosen WPM using the
// PARIS convention (unit = 1.2 / WPM seconds). Letters only map from the ITU
// table below; unencodable characters are reported honestly, never dropped
// silently.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

// ITU standard table plus the punctuation set every guide expects.
const MORSE: Record<string, string> = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....',
  i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.',
  q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-',
  y: '-.--', z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
}

const REVERSE: Record<string, string> = (() => {
  const rev: Record<string, string> = {}
  for (const [ch, code] of Object.entries(MORSE)) rev[code] = ch
  return rev
})()

/** Is the input predominantly Morse (dots, dashes, spaces)? */
function looksLikeMorse(s: string): boolean {
  const trimmed = s.trim()
  if (trimmed === '') return false
  const morseChars = (trimmed.match(/[.\-\s/]/g) ?? []).length
  return morseChars / trimmed.length > 0.6
}

function textToMorse(text: string): { out: string; unencodable: string[] } {
  const unencodable = new Set<string>()
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0)
  const out = words
    .map((word) =>
      word
        .split('')
        .map((ch) => {
          const code = MORSE[ch]
          if (!code) {
            unencodable.add(ch)
            return null
          }
          return code
        })
        .filter((c): c is string => c !== null)
        .join(' '),
    )
    .filter((w) => w.length > 0)
    .join(' / ')
  return { out, unencodable: [...unencodable] }
}

function morseToText(morse: string): { out: string; unknown: string[] } {
  const unknown = new Set<string>()
  const words = morse.trim().split(/\s*\/\s*|\s{3,}/)
  const out = words
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((code) => {
          const ch = REVERSE[code]
          if (!ch) {
            unknown.add(code)
            return ''
          }
          return ch
        })
        .join(''),
    )
    .join(' ')
    .trim()
  return { out, unknown: [...unknown] }
}

type Player = {
  stop: () => void
}

export function MorseTool() {
  const [input, setInput] = useState('')
  const [wpm, setWpm] = useState(15)
  const [hz, setHz] = useState(600)
  const [playing, setPlaying] = useState(false)
  const [litSymbol, setLitSymbol] = useState<'.' | '-' | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const playerRef = useRef<Player | null>(null)
  const flashTimer = useRef<number | null>(null)

  const detected: 'text' | 'morse' = looksLikeMorse(input) ? 'morse' : 'text'
  const converted = useMemo(() => {
    if (input.trim() === '') return null
    if (detected === 'morse') return morseToText(input)
    return textToMorse(input)
  }, [input, detected])
  const outputText = converted && 'out' in converted ? converted.out : ''
  const warnings = converted && ('unencodable' in converted || 'unknown' in converted)
    ? (converted.unencodable ?? converted.unknown ?? [])
    : []

  const stopPlayback = useCallback(() => {
    playerRef.current?.stop()
    playerRef.current = null
    setPlaying(false)
    setLitSymbol(null)
    if (flashTimer.current !== null) {
      window.clearInterval(flashTimer.current)
      flashTimer.current = null
    }
  }, [])

  useEffect(() => stopPlayback, [stopPlayback])

  const play = useCallback(async () => {
    if (playing) {
      stopPlayback()
      return
    }
    if (!outputText) return
    // The symbols to sound: re-encode the *text* side so playback works
    // whichever direction the user typed; normalize the separators so a
    // hand-typed Morse string schedules exactly like a generated one.
    const source =
      detected === 'morse'
        ? input.trim().replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ')
        : textToMorse(input).out
    const words = source.split(' / ').map((w) => w.split(' ').filter(Boolean))
    if (words.length === 0 || words.every((w) => w.length === 0)) return
    stopPlayback()
    const ctx = ctxRef.current ?? new AudioContext()
    ctxRef.current = ctx
    if (ctx.state === 'suspended') await ctx.resume()

    // Unit from the PARIS convention: the word PARIS is 50 units, so
    // unit = 1.2 / WPM seconds. Standard gaps: 1 unit between elements,
    // 3 between letters, 7 between words. The tone is scheduled entirely
    // on the WebAudio clock — tab throttling cannot bend the beat.
    const unit = 1.2 / Math.min(35, Math.max(5, wpm))
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(ctx.destination)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = hz
    osc.connect(gain)

    const start = ctx.currentTime + 0.15
    const events: Array<{ sym: '.' | '-'; at: number; end: number }> = []
    let t = start
    words.forEach((letters, wi) => {
      letters.forEach((letter, li) => {
        for (const sym of letter) {
          if (sym !== '.' && sym !== '-') continue
          const dur = sym === '.' ? unit : unit * 3
          events.push({ sym, at: t, end: t + dur })
          t += dur + unit // element gap: 1 unit of silence
        }
        if (li < letters.length - 1) t += unit * 2 // letter gap: 1 already added → 3 total
      })
      if (wi < words.length - 1) t += unit * 6 // word gap: 1 already added → 7 total
    })
    const end = t + 0.05
    // Envelope: 5 ms exponential ramps so every element is click-free.
    for (const e of events) {
      gain.gain.setValueAtTime(0.0001, e.at)
      gain.gain.exponentialRampToValueAtTime(1, e.at + 0.005)
      gain.gain.setValueAtTime(1, Math.max(e.end - 0.005, e.at + 0.005))
      gain.gain.exponentialRampToValueAtTime(0.0001, e.end + 0.005)
    }
    osc.start(start)
    osc.stop(end)

    // Visual sync: a flashing dot/dash readout follows the audio clock via
    // relative offsets (immune to how long scheduling itself took).
    const audioOffset = start - ctx.currentTime
    setPlaying(true)
    let idx = 0
    const tick = () => {
      const elapsed = performance.now() / 1000 - (performanceStart + audioOffset)
      while (idx < events.length && events[idx].at - start + 0 <= elapsed) {
        setLitSymbol(events[idx].sym)
        idx++
      }
      if (idx < events.length) {
        flashTimer.current = window.setTimeout(tick, 25)
      }
    }
    const performanceStart = performance.now() / 1000
    tick()

    playerRef.current = {
      stop: () => {
        try {
          osc.stop()
        } catch {
          /* already stopped */
        }
        gain.gain.value = 0
      },
    }
    osc.onended = () => {
      setPlaying(false)
      setLitSymbol(null)
      playerRef.current = null
      if (flashTimer.current !== null) {
        window.clearTimeout(flashTimer.current)
        flashTimer.current = null
      }
    }
  }, [playing, outputText, detected, input, wpm, hz, stopPlayback])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="morse-input" className="text-sm font-semibold">
            Text or Morse — the direction is detected from what you type
          </Label>
          <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground" aria-live="polite">
            {input.trim() === '' ? 'waiting' : detected === 'morse' ? 'morse → text' : 'text → morse'}
          </span>
        </div>
        <textarea
          id="morse-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder={'Type here — e.g. "sos" or ".-- ... / --- ..."'}
          className="mt-2 w-full rounded-md border bg-background px-3.5 py-2.5 font-mono text-sm leading-relaxed"
        />

        <div className="mt-3 rounded-lg border bg-background p-4">
          <p className="text-xs font-semibold text-muted-foreground">
            {detected === 'morse' ? 'Decoded text' : 'Morse code'}
          </p>
          <p className="mt-1.5 min-h-[2rem] break-words font-mono text-lg leading-relaxed tracking-[0.2em]" aria-live="polite" data-testid="morse-out">
            {outputText || <span className="text-base tracking-normal text-muted-foreground/60">translation appears here as you type</span>}
          </p>
        </div>

        {warnings.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            {detected === 'morse'
              ? `Not in the ITU table: ${warnings.join(', ')} — those symbols were skipped rather than guessed.`
              : `No Morse exists for: ${warnings.join(', ')} — those characters were skipped rather than dropped silently.`}
          </p>
        )}

        {/* playback controls */}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Button
            type="button"
            onClick={() => void play()}
            disabled={input.trim() === '' || (detected === 'text' && !textToMorse(input).out)}
            variant={playing ? 'destructive' : 'default'}
            size="sm"
          >
            {playing ? <Square className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
            {playing ? 'Stop' : 'Play aloud'}
          </Button>
          <div>
            <Label htmlFor="morse-wpm" className="text-xs text-muted-foreground">Speed: {wpm} WPM</Label>
            <input
              id="morse-wpm"
              type="range"
              min={5}
              max={35}
              value={wpm}
              onChange={(e) => setWpm(Number(e.target.value))}
              className="mt-1 w-40 accent-primary"
            />
          </div>
          <div>
            <Label htmlFor="morse-hz" className="text-xs text-muted-foreground">Tone: {hz} Hz</Label>
            <input
              id="morse-hz"
              type="range"
              min={300}
              max={1200}
              step={25}
              value={hz}
              onChange={(e) => setHz(Number(e.target.value))}
              className="mt-1 w-40 accent-primary"
            />
          </div>
        </div>

        {/* live element flash during playback */}
        <div className="mt-3 flex h-9 items-center" aria-hidden="true">
          {playing && litSymbol ? (
            <span
              className={cn(
                'rounded-md px-3 py-1 font-mono text-2xl tracking-widest text-primary-foreground',
                litSymbol === '.' ? 'w-10 bg-primary' : 'w-20 bg-primary',
              )}
            >
              {litSymbol}
            </span>
          ) : playing ? (
            <span className="text-xs text-muted-foreground">between letters…</span>
          ) : null}
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          Timing: dot = 1 unit, dash = 3, gap inside a letter = 1, between letters = 3, between words = 7 — the unit comes from {wpm} WPM by the PARIS convention ({(1.2 / Math.min(35, Math.max(5, wpm))).toFixed(0)} ms).
        </p>
      </div>

      <PrivacyStrip detail="Translation and playback run on this device: the table is on the page, the tone is generated by your browser's WebAudio, and nothing you type is sent or stored." />
    </div>
  )
}
