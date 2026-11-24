'use client'

// Typing Test Studio — the numbers defined the standard way: WPM = correct
// characters ÷ 5 ÷ minutes, CPM = raw characters ÷ minutes, accuracy from
// uncorrected errors. The clock starts on the first keystroke. The word
// stream is generated locally from a built-in list; nothing is fetched,
// stored or submitted anywhere.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

// ~240 of the most common English words — the stream people actually type.
const WORDS = `the be to of and a in that have I it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us man find thing tell high still small every add own life here world both under never end another between eye place big house both world large hand ask follow went show around three small set put does hand large high follow act why help school own read another change every point home water room mother write mother same near mean food feet mother light country story head stand own page should country found answer school grow study still learn plant cover food sun four state keep eye never last let thought city tree cross farm hard start might story saw far sea draw left late run press night close real life few north open seem together next white children begin got walk example ease paper often always music those both mark book letter until mile river car feet care second group carry took rain eat room friend began idea fish mountain stop once base hear horse cut sure watch color face wood main enough plain girl usual young ready above ever red list though feel talk bird soon body dog family direct leave song measure door product black short numeral class wind question happen complete ship area half rock order fire south problem piece told knew pass since top whole king space heard best hour better true during hundred five remember step early hold west ground interest reach fast verb sing listen table travel less morning ten simple several vowel war lay against pattern slow center love person money serve appear road map science rule govern pull cold notice voice fall town certain unit power fine circle scene supply town heavy dark daughter view`

const DURATIONS = [15, 30, 60, 180] as const

function shuffleWords(n: number): string[] {
  const pool = WORDS.split(/\s+/)
  // Fisher–Yates with Math.random is fine here: this is a practice stream,
  // not a security decision.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

type Phase = 'idle' | 'running' | 'finished'

interface Result {
  wpm: number
  cpm: number
  accuracy: number
  consistency: number
  rawChars: number
  correctChars: number
  seconds: number
}

export function TypingTestTool() {
  const [duration, setDuration] = useState<number>(30)
  const [words, setWords] = useState<string[]>(() => shuffleWords(60))
  const [phase, setPhase] = useState<Phase>('idle')
  const [typed, setTyped] = useState('')
  const [wordIndex, setWordIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [best, setBest] = useState<Result | null>(null)

  // keystroke accounting — the ref feeds the 1 s ticker, the state mirror
  // feeds the render (refs are not read during render)
  const keystrokes = useRef({ total: 0, correct: 0 })
  const [tally, setTally] = useState({ total: 0, correct: 0 })
  const bumpTally = () => setTally({ ...keystrokes.current })
  const startedAt = useRef(0)
  const wpmSamples = useRef<number[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const doneWords = useMemo(() => words.slice(0, wordIndex), [words, wordIndex])
  const activeWord = words[wordIndex] ?? ''

  const finish = useCallback((secondsUsed: number) => {
    const k = keystrokes.current
    const correctChars = k.correct
    const rawChars = k.total
    const minutes = Math.max(secondsUsed, 1) / 60
    const wpm = Math.round(correctChars / 5 / minutes)
    const cpm = Math.round(rawChars / minutes)
    const accuracy = k.total > 0 ? Math.round((k.correct / k.total) * 100) : 100
    // consistency: 100 − coefficient of variation of the per-second WPM samples
    const samples = wpmSamples.current.filter((s) => s > 0)
    let consistency = 100
    if (samples.length > 1) {
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length
      const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0
      consistency = Math.max(0, Math.round((1 - Math.min(cv, 1)) * 100))
    }
    const r: Result = { wpm, cpm, accuracy, consistency, rawChars, correctChars, seconds: Math.round(secondsUsed) }
    setResult(r)
    setBest((b) => (!b || wpm > b.wpm ? r : b))
    setPhase('finished')
  }, [])

  // ticking clock while running
  useEffect(() => {
    if (phase !== 'running') return
    const t = setInterval(() => {
      const secs = (performance.now() - startedAt.current) / 1000
      const used = Math.min(secs, duration)
      setElapsed(used)
      const mins = Math.max(used, 1) / 60
      wpmSamples.current.push(Math.round((keystrokes.current.correct / 5) / mins))
      setTally({ ...keystrokes.current })
      if (secs >= duration) finish(duration)
    }, 1000)
    return () => clearInterval(t)
  }, [phase, duration, finish])

  const restart = (newWords = false) => {
    if (newWords) setWords(shuffleWords(60))
    setPhase('idle')
    setTyped('')
    setWordIndex(0)
    setElapsed(0)
    setResult(null)
    keystrokes.current = { total: 0, correct: 0 }
    setTally({ total: 0, correct: 0 })
    wpmSamples.current = []
    inputRef.current?.focus()
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (phase === 'finished') return
    if (phase === 'idle') {
      // the clock starts on the first keystroke, not on page load
      startedAt.current = performance.now()
      setPhase('running')
    }
    // space advances the word
    if (value.endsWith(' ')) {
      const attempt = value.trimEnd()
      // account the word's keystrokes before advancing
      for (let i = 0; i < attempt.length; i++) {
        keystrokes.current.total++
        if (attempt[i] === activeWord[i]) keystrokes.current.correct++
      }
      setWordIndex((i) => i + 1)
      setTyped('')
      bumpTally()
      if (wordIndex + 1 >= words.length) {
        const secs = (performance.now() - startedAt.current) / 1000
        finish(Math.max(secs, 1))
      }
      return
    }
    // account new characters typed since the last change
    for (let i = typed.length; i < value.length; i++) {
      keystrokes.current.total++
      if (value[i] === activeWord[i]) keystrokes.current.correct++
    }
    if (value.length < typed.length) {
      // deletions: rewind the keystroke tally conservatively (raw chars only;
      // corrected errors then stop counting against accuracy — the standard
      // "uncorrected errors" definition)
      keystrokes.current.total = Math.max(0, keystrokes.current.total - (typed.length - value.length))
    }
    bumpTally()
    setTyped(value)
  }

  const remaining = Math.ceil(duration - elapsed)
  const liveMinutes = Math.max(elapsed, 1) / 60
  const liveWpm = phase === 'idle' ? 0 : Math.round(tally.correct / 5 / liveMinutes)
  const liveCpm = phase === 'idle' ? 0 : Math.round(tally.total / liveMinutes)
  const liveAcc = tally.total > 0 ? Math.round((tally.correct / tally.total) * 100) : 100

  const renderActiveWord = () => {
    const chars = activeWord.split('')
    const out: React.ReactNode[] = []
    for (let i = 0; i < chars.length; i++) {
      const ok = typed[i] === undefined || typed[i] === chars[i]
      out.push(
        <span key={i} className={cn(typed[i] === undefined ? 'text-foreground' : ok ? 'text-primary' : 'rounded-sm bg-destructive/20 text-destructive underline')}>
          {chars[i]}
        </span>,
      )
    }
    if (typed.length > chars.length) {
      out.push(
        <span key="extra" className="rounded-sm bg-destructive/20 text-destructive underline">
          {typed.slice(chars.length)}
        </span>,
      )
    }
    return out
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Test duration">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setDuration(d); restart() }}
                aria-pressed={duration === d}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                  duration === d ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                )}
              >
                {d < 60 ? `${d}s` : d === 60 ? '1 min' : '3 min'}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => restart(true)}>
              <Shuffle className="size-3.5" aria-hidden="true" /> New words
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => restart()}>
              <RotateCcw className="size-3.5" aria-hidden="true" /> Restart
            </Button>
          </div>
        </div>

        {/* live meters */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">WPM</p>
            <p className="font-mono text-xl font-semibold tabular-nums">{phase === 'finished' && result ? result.wpm : liveWpm}</p>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">CPM</p>
            <p className="font-mono text-xl font-semibold tabular-nums">{phase === 'finished' && result ? result.cpm : liveCpm}</p>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Accuracy</p>
            <p className="font-mono text-xl font-semibold tabular-nums">{phase === 'finished' && result ? `${result.accuracy}%` : `${liveAcc}%`}</p>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">{phase === 'running' ? 'Remaining' : 'Duration'}</p>
            <p className="font-mono text-xl font-semibold tabular-nums">{phase === 'idle' ? duration : remaining}s</p>
          </div>
        </div>
        {phase === 'running' && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, (elapsed / duration) * 100)}%` }} />
          </div>
        )}

        {/* word stream */}
        <div className="mt-4 rounded-lg border bg-background p-4">
          <p className="text-lg leading-relaxed tracking-wide" aria-label="Word stream">
            {doneWords.map((w, i) => (
              <span key={i} className="mr-2 text-muted-foreground/70">{w}</span>
            ))}
            <span className="mr-2 rounded-md bg-primary/10 px-0.5 font-medium">{renderActiveWord()}</span>
            {words.slice(wordIndex + 1, wordIndex + 14).map((w, i) => (
              <span key={i} className="mr-2 text-foreground/60">{w}</span>
            ))}
          </p>
        </div>

        <div className="mt-3">
          <Label htmlFor="tt-input" className="sr-only">Type here</Label>
          <input
            id="tt-input"
            ref={inputRef}
            value={typed}
            onChange={onChange}
            disabled={phase === 'finished'}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={phase === 'idle' ? 'Start typing — the clock starts on your first letter' : ''}
            className="h-11 w-full rounded-md border bg-background px-3.5 text-base"
            aria-label="Typing input"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {phase === 'idle'
              ? 'Words color as you go: green matches, red is a live mistake. Space moves to the next word; the timer ends the test.'
              : phase === 'running'
                ? 'Keep going — mistakes count until you fix them, the standard way.'
                : 'Test complete. Restart for a new run, or New words for a fresh stream.'}
          </p>
        </div>
      </div>

      {phase === 'finished' && result && (
        <div className="rounded-xl border bg-card p-4 sm:p-5" role="status">
          <h2 className="text-sm font-semibold">Result</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ['WPM', String(result.wpm)],
              ['CPM', String(result.cpm)],
              ['Accuracy', `${result.accuracy}%`],
              ['Consistency', `${result.consistency}%`],
              ['Characters', `${result.correctChars}/${result.rawChars}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {duration < 60 ? `${duration} seconds` : `${duration / 60} minute${duration === 60 ? '' : 's'}`} ·
            WPM is correct characters ÷ 5 ÷ minutes · session best {best?.wpm ?? result.wpm} WPM, kept in this tab only.
          </p>
        </div>
      )}

      <PrivacyStrip detail="The word stream comes from a built-in list, the timer runs on this device, and the scores are computed from your keystrokes in this tab. There is no account, no leaderboard and nothing submitted anywhere." />
    </div>
  )
}
