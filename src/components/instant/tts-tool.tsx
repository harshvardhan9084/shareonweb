'use client'

// Text-to-speech reader built on the browser's own speechSynthesis engine.
// Long text is split into sentence chunks before queueing because every
// major browser silently truncates or stalls a single long utterance —
// chunking keeps playback stable and gives real progress (chunk i of n,
// current chunk highlighted). Voice, rate, pitch and volume come from the
// installed voices; the voice list is loaded in an effect (it arrives
// asynchronously via the voiceschanged event), never during render. When the
// browser has no synthesis support, or no installed voices, the page says so
// honestly instead of pretending to play.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

/** Sentence-bounded chunks of at most ~220 characters: split on
 *  . ! ? and newlines, accumulate sentences until the cap, then hard-split
 *  any pathological single sentence longer than the cap. */
function chunkText(text: string, cap = 220): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const sentences = trimmed.split(/(?<=[.!?…])\s+|\n+/)
  const chunks: string[] = []
  let current = ''
  for (const raw of sentences) {
    const sentence = raw.trim()
    if (!sentence) continue
    if (sentence.length > cap) {
      if (current) {
        chunks.push(current.trim())
        current = ''
      }
      for (let i = 0; i < sentence.length; i += cap) {
        chunks.push(sentence.slice(i, i + cap).trim())
      }
      continue
    }
    if (current && current.length + 1 + sentence.length > cap) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current = current ? `${current} ${sentence}` : sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

const SAMPLE =
  'Reading aloud is one of the oldest proofreading tricks. Your ear catches what your eye slides past: the repeated word, the missing comma, the sentence that never ends. Set a slower rate for proofreading, a faster one for getting through an article, and pick the voice that stays clear to you for long stretches.'

/** Capability probe via useSyncExternalStore — the React-19-correct way to
 *  branch on a browser API without reading window during render: the server
 *  snapshot says "not supported", the client snapshot checks the real API,
 *  and React reconciles the two right after hydration. */
const noopSubscribe = () => () => {}

export function TtsTool() {
  const [text, setText] = useState(SAMPLE)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState('')
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [volume, setVolume] = useState(1)
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [chunkIndex, setChunkIndex] = useState(-1)
  const stoppedRef = useRef(false)

  const supported = useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    () => false,
  )
  const support: 'ok' | 'none' = supported ? 'ok' : 'none'

  const chunks = useMemo(() => chunkText(text), [text])

  // The voice list arrives asynchronously (voiceschanged event, sometimes
  // only after a short delay) — load it from timeouts and the subscription,
  // never synchronously in the effect body.
  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis
    const load = () => {
      const list = synth.getVoices()
      if (list.length) {
        setVoices(list)
        setVoiceURI((prev) => {
          if (prev && list.some((v) => v.voiceURI === prev)) return prev
          const preferred =
            list.find((v) => v.lang.startsWith('en') && v.localService) ??
            list.find((v) => v.lang.startsWith('en')) ??
            list[0]
          return preferred?.voiceURI ?? ''
        })
      }
    }
    const t0 = setTimeout(load, 0)
    synth.addEventListener('voiceschanged', load)
    const t1 = setTimeout(load, 400)
    return () => {
      clearTimeout(t0)
      clearTimeout(t1)
      synth.removeEventListener('voiceschanged', load)
      synth.cancel()
    }
  }, [supported])

  function stop() {
    stoppedRef.current = true
    window.speechSynthesis?.cancel()
    setSpeaking(false)
    setPaused(false)
    setChunkIndex(-1)
  }

  function read() {
    if (support !== 'ok') return
    const synth = window.speechSynthesis
    synth.cancel()
    stoppedRef.current = false
    setSpeaking(true)
    setPaused(false)

    const queue = [...chunks]
    const speakChunk = (i: number) => {
      if (stoppedRef.current) return
      if (i >= queue.length) {
        setSpeaking(false)
        setPaused(false)
        setChunkIndex(-1)
        return
      }
      const u = new SpeechSynthesisUtterance(queue[i])
      const v = voices.find((x) => x.voiceURI === voiceURI)
      if (v) {
        u.voice = v
        u.lang = v.lang
      }
      u.rate = rate
      u.pitch = pitch
      u.volume = volume
      u.onstart = () => setChunkIndex(i)
      u.onend = () => speakChunk(i + 1)
      u.onerror = () => speakChunk(i + 1)
      synth.speak(u)
    }
    setChunkIndex(0)
    speakChunk(0)
  }

  function togglePause() {
    const synth = window.speechSynthesis
    if (!speaking) return
    if (paused) {
      synth.resume()
      setPaused(false)
    } else {
      synth.pause()
      setPaused(true)
    }
  }

  const disabled = support !== 'ok' || chunks.length === 0

  return (
    <div className="space-y-4">
      {support === 'none' && (
        <p role="status" data-testid="tts-unsupported" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          This browser has no speech synthesis engine — the Web Speech API is not available here, so the page
          can only prepare text, not speak it. Chrome, Edge and Safari all ship one.
        </p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="tts-input">Text to read aloud</Label>
          <span data-testid="tts-chunks" className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            {chunks.length} {chunks.length === 1 ? 'chunk' : 'chunks'}
          </span>
        </div>
        <Textarea
          id="tts-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-40 text-sm"
          placeholder="Paste an article, an email, your own draft…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tts-voice">Voice ({voices.length} installed)</Label>
          <Select value={voiceURI} onValueChange={setVoiceURI} disabled={voices.length === 0}>
            <SelectTrigger id="tts-voice" className="w-full" aria-label="Voice">
              <SelectValue placeholder={voices.length === 0 ? 'No voices installed' : 'Pick a voice'} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {voices.map((v) => (
                <SelectItem key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang}){v.localService ? '' : ' · network'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="tts-rate">Rate</Label>
            <input
              id="tts-rate"
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={rate}
              onChange={(e) => setRate(Number.parseFloat(e.target.value))}
              className="w-full"
              aria-valuetext={`${rate.toFixed(1)} times`}
            />
            <p data-testid="tts-rate" className="text-center text-xs font-medium tabular-nums text-muted-foreground">
              {rate.toFixed(1)}×
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tts-pitch">Pitch</Label>
            <input
              id="tts-pitch"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={pitch}
              onChange={(e) => setPitch(Number.parseFloat(e.target.value))}
              className="w-full"
            />
            <p data-testid="tts-pitch" className="text-center text-xs font-medium tabular-nums text-muted-foreground">
              {pitch.toFixed(1)}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tts-volume">Volume</Label>
            <input
              id="tts-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number.parseFloat(e.target.value))}
              className="w-full"
            />
            <p data-testid="tts-volume" className="text-center text-xs font-medium tabular-nums text-muted-foreground">
              {Math.round(volume * 100)}%
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" id="tts-read" onClick={read} disabled={disabled}>
          Read aloud
        </Button>
        <Button type="button" variant="outline" onClick={togglePause} disabled={!speaking}>
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button type="button" variant="outline" onClick={stop} disabled={!speaking}>
          Stop
        </Button>
        {speaking && (
          <span data-testid="tts-progress" className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground" aria-live="polite">
            {paused ? 'Paused' : 'Speaking'} — chunk {Math.max(chunkIndex + 1, 1)} of {chunks.length}
          </span>
        )}
      </div>

      {chunks.length > 1 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">How the text will be queued</p>
          <ol className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {chunks.map((chunk, i) => (
              <li
                key={i}
                className={cn(
                  'rounded-lg border px-3 py-2 text-[13px] leading-relaxed',
                  i === chunkIndex ? 'border-primary/50 bg-primary/5 font-medium' : 'text-muted-foreground',
                )}
              >
                <span className="mr-2 font-mono text-xs">{i + 1}</span>
                {chunk}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            Each chunk is spoken as its own utterance because browsers cut off single long utterances — the
            chunk list is the real playback order, and the highlighted line is the one currently being spoken.
          </p>
        </div>
      )}

      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Voices are whatever your operating system and browser ship — nothing is downloaded here. The tool
        prefers a locally installed English voice by default; network voices are labelled, since they can be
        slower and may stop working offline.
      </p>

      <PrivacyStrip detail="Speech runs through the browser's own engine on this device — the text is not uploaded anywhere, and nothing is recorded." />
    </div>
  )
}
