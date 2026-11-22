'use client'

// CaptionsPanel — Live Captions & Translation.
//
// Speech is recognized locally with the browser's SpeechRecognition engine
// (Chrome, Edge, Safari), broadcast as persisted caption lines so late joiners
// rebuild the full feed. Interim words stay local ("hearing…") — only finished
// sentences are shared. Translation is a per-viewer overlay: it never changes
// what is broadcast; each device asks the session's translate endpoint for the
// languages it wants.
//
// Sync protocol (via RoomClient app events):
//   'cap:line' persisted {text, lang} → one caption line (lang '' = typed manually)
//
// Persisted events are echoed to everyone including the sender — own echoes
// are skipped here because lines were applied optimistically at send time.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RoomClient } from '@/lib/room-client'
import type { AppEvent, DeviceType, Participant } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Keyboard,
  Languages,
  Mic,
  MicOff,
  Send,
  Square,
} from 'lucide-react'

// --------------------------------------------- SpeechRecognition (no `any`)
//
// Minimal local interface mirroring the vendor API, reached through an
// unknown-cast — keeps strict TypeScript clean without DOM lib dependencies.

interface SpeechResultAltLike {
  transcript: string
}

interface SpeechResultLike {
  isFinal: boolean
  0: SpeechResultAltLike
}

interface SpeechResultListLike {
  length: number
  [index: number]: SpeechResultLike
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: SpeechResultListLike
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// ------------------------------------------------------------------ helpers

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function asRecord(payload: unknown): Record<string, unknown> | null {
  return payload !== null && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
}

function baseOfLang(lang: string): string | null {
  if (!lang) return null
  return lang.split('-')[0].toLowerCase() || null
}

// ------------------------------------------------------------------- consts

const LANGS = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
  { code: 'es-ES', label: 'Español (Spanish)' },
  { code: 'fr-FR', label: 'Français (French)' },
  { code: 'de-DE', label: 'Deutsch (German)' },
  { code: 'pt-BR', label: 'Português (BR)' },
  { code: 'ru-RU', label: 'Русский (Russian)' },
  { code: 'ar-SA', label: 'العربية (Arabic)' },
  { code: 'zh-CN', label: '中文 (Chinese)' },
  { code: 'ja-JP', label: '日本語 (Japanese)' },
] as const

const MAX_LINES = 200
const TRANSLATE_DEBOUNCE_MS = 600
const RECENT_ON_ENABLE = 60 // how many existing lines to translate when the toggle flips on
const MAX_CAPTION_CHARS = 600

interface CaptionLine {
  id: string
  text: string
  lang: string
  by: string
  at: string
  mine: boolean
}

interface CaptionsPanelProps {
  client: RoomClient | null
  selfId: string
  participants: Participant[]
  /** Persisted events from the join snapshot — rebuild caption history for late joiners. */
  initialEvents: AppEvent[]
  connected: boolean
  isHost: boolean
  profileName: string
  device: DeviceType
}

export function CaptionsPanel({
  client,
  selfId,
  participants,
  initialEvents,
  connected,
  profileName,
}: CaptionsPanelProps) {
  // ------------------------------------------------------------------- state
  const [supported] = useState(() => getSpeechRecognition() != null)
  const [listening, setListening] = useState(false)
  const [srcLang, setSrcLang] = useState('en-US')
  const [lines, setLines] = useState<CaptionLine[]>([])
  const [interim, setInterim] = useState('')
  const [manualDraft, setManualDraft] = useState('')
  const [translateOn, setTranslateOn] = useState(false)
  const [targetLang, setTargetLang] = useState('en-US')
  const [translations, setTranslations] = useState<Record<string, string>>({})

  // ------------------------------------------------------------- refs (live)
  const clientRef = useRef(client)
  const profileNameRef = useRef(profileName)
  const selfIdRef = useRef(selfId)
  const translateOnRef = useRef(translateOn)
  const targetRef = useRef(targetLang)
  const linesRef = useRef(lines)
  const translationsRef = useRef(translations)

  useEffect(() => {
    clientRef.current = client
    profileNameRef.current = profileName
    selfIdRef.current = selfId
    translateOnRef.current = translateOn
    targetRef.current = targetLang
    linesRef.current = lines
    translationsRef.current = translations
  })

  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const enabledRef = useRef(false) // user still wants captions (survives Chrome's ~60s restarts)
  const srcLangRef = useRef(srcLang)
  useEffect(() => {
    srcLangRef.current = srcLang
  })
  const restartTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const feedRef = useRef<HTMLDivElement>(null)
  const rebuiltRef = useRef(false)

  // ------------------------------------------------- rebuild from snapshot
  useEffect(() => {
    if (rebuiltRef.current) return
    rebuiltRef.current = true
    const restored: CaptionLine[] = []
    for (const ev of initialEvents) {
      if (ev.type !== 'cap:line') continue
      const p = asRecord(ev.payload)
      const text = typeof p?.text === 'string' ? p.text.trim() : ''
      if (!text) continue
      const lang = typeof p?.lang === 'string' ? p.lang : ''
      restored.push({ id: uid(), text, lang, by: ev.name, at: ev.at, mine: ev.from === selfId })
    }
    // One-time snapshot hydration — deferred to a microtask to avoid a
    // synchronous cascading render from the effect body.
    queueMicrotask(() => {
      setLines(restored.slice(-MAX_LINES))
    })
  }, [initialEvents, selfId])

  // --------------------------------------------------- translation pipeline
  const pendingRef = useRef<Set<string>>(new Set())
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushTranslations = useCallback(async () => {
    flushTimerRef.current = null
    const texts = [...pendingRef.current]
    pendingRef.current.clear()
    const target = baseOfLang(targetRef.current)
    if (!texts.length || !target) return
    const need = texts.filter((t) => !(t in translationsRef.current))
    if (!need.length) return
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: need, target }),
      })
      if (!res.ok) return // failures keep the original text
      const data: unknown = await res.json()
      const rec = asRecord(data)?.translations
      if (!Array.isArray(rec)) return
      setTranslations((prev) => {
        const next = { ...prev }
        need.forEach((t, i) => {
          const tr = rec[i]
          if (typeof tr === 'string' && tr.trim() && tr !== t) next[t] = tr
        })
        return next
      })
    } catch {
      // network failure — originals stay in place
    }
  }, [])

  const queueTranslations = useCallback(
    (texts: string[], srcLangBase?: string | null) => {
      const target = baseOfLang(targetRef.current)
      if (!target) return
      if (srcLangBase && srcLangBase === target) return // same language — nothing to do
      for (const t of texts) {
        if (!t) continue
        if (t in translationsRef.current) continue
        pendingRef.current.add(t)
      }
      if (pendingRef.current.size === 0) return
      if (flushTimerRef.current) return // batch accumulates inside the debounce window
      flushTimerRef.current = setTimeout(() => void flushTranslations(), TRANSLATE_DEBOUNCE_MS)
    },
    [flushTranslations],
  )

  // Toggle/target changed: invalidate stale batches and (when enabling) walk
  // the recent feed so existing lines get translations too. The reset runs in
  // a microtask — it is a reaction to a user toggle, not an external sync.
  useEffect(() => {
    queueMicrotask(() => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      pendingRef.current.clear()
      if (!translateOn || targetLang === 'original') return
      // New target language → previous translations were for another language.
      translationsRef.current = {}
      setTranslations({})
      const target = baseOfLang(targetLang)
      const seen = new Set<string>()
      const texts: string[] = []
      for (const l of linesRef.current.slice(-RECENT_ON_ENABLE)) {
        if (target && baseOfLang(l.lang) === target) continue
        if (seen.has(l.text)) continue
        seen.add(l.text)
        texts.push(l.text)
      }
      queueTranslations(texts)
    })
  }, [translateOn, targetLang, queueTranslations])

  // ----------------------------------------------------------------- sending
  const sendLine = useCallback(async (text: string, lang: string) => {
    const c = clientRef.current
    const clean = text.trim().slice(0, MAX_CAPTION_CHARS)
    if (!c || !clean) return
    try {
      await c.sendAppEvent('cap:line', { text: clean, lang }, { persist: true })
      // Optimistic — own persisted echo is skipped in the listener.
      setLines((prev) =>
        [
          ...prev,
          {
            id: uid(),
            text: clean,
            lang,
            by: profileNameRef.current,
            at: new Date().toISOString(),
            mine: true,
          },
        ].slice(-MAX_LINES),
      )
      if (translateOnRef.current) {
        queueTranslations([clean], baseOfLang(lang))
      }
    } catch {
      toast.error('Could not send the caption, check the connection.')
    }
  }, [queueTranslations])

  // -------------------------------------------------------- remote app events
  useEffect(() => {
    if (!client) return
    return client.on('appevent', (raw) => {
      const ev = raw as AppEvent
      if (ev.from === selfIdRef.current) return // own echoes — applied at send time
      if (ev.type !== 'cap:line') return
      const p = asRecord(ev.payload)
      const text = typeof p?.text === 'string' ? p.text.trim() : ''
      if (!text) return
      const lang = typeof p?.lang === 'string' ? p.lang : ''
      setLines((prev) =>
        [
          ...prev,
          { id: uid(), text, lang, by: ev.name, at: ev.at, mine: false },
        ].slice(-MAX_LINES),
      )
      if (translateOnRef.current) {
        queueTranslations([text], baseOfLang(lang))
      }
    })
  }, [client, queueTranslations])

  // ----------------------------------------------------- recognition engine
  const stopListening = useCallback(() => {
    enabledRef.current = false
    const rec = recRef.current
    recRef.current = null
    if (rec) {
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
      try {
        rec.stop()
      } catch {
        // already stopped
      }
    }
    setListening(false)
    setInterim('')
  }, [])

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      toast.error('Automatic captions need Chrome, Edge or Safari, but you can still type captions below.')
      return
    }
    if (enabledRef.current) return
    const lang = srcLangRef.current
    enabledRef.current = true

    let rec: SpeechRecognitionLike
    try {
      rec = new Ctor()
    } catch {
      enabledRef.current = false
      toast.error('Could not start speech recognition in this browser.')
      return
    }

    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e) => {
      let finalText = ''
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const transcript = typeof r?.[0]?.transcript === 'string' ? r[0].transcript : ''
        if (!transcript) continue
        if (r.isFinal) finalText += transcript
        else interimText += transcript
      }
      if (finalText.trim()) void sendLine(finalText.trim(), lang)
      setInterim(interimText.trim())
    }

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error('Microphone permission was blocked. Allow it in your browser\u2019s address-bar icon, then start again.')
        enabledRef.current = false
        recRef.current = null
        setListening(false)
        setInterim('')
      } else if (e.error === 'network') {
        toast.error('The speech service is unreachable, so captions are paused. Start listening again to resume.')
      }
      // 'no-speech', 'aborted', … — onend decides whether to restart
    }

    rec.onend = () => {
      // Chrome ends the session roughly every 60s — restart while enabled.
      if (!enabledRef.current) return
      setInterim('')
      try {
        rec.start()
      } catch {
        const t = setTimeout(() => {
          if (enabledRef.current) {
            try {
              recRef.current?.start()
            } catch {
              // give up this cycle — the next onend retries
            }
          }
        }, 250)
        restartTimersRef.current.add(t)
      }
    }

    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      enabledRef.current = false
      recRef.current = null
      toast.error('Could not start speech recognition.')
    }
  }, [sendLine])

  // Language switched mid-flight → restart the engine with the new language.
  useEffect(() => {
    queueMicrotask(() => {
      if (!enabledRef.current) return
      stopListening()
      startListening()
    })
  }, [srcLang, startListening, stopListening])

  // ------------------------------------------------------------- cleanup
  useEffect(() => {
    const timers = restartTimersRef.current
    return () => {
      enabledRef.current = false
      const rec = recRef.current
      recRef.current = null
      if (rec) {
        rec.onresult = null
        rec.onerror = null
        rec.onend = null
        try {
          rec.abort()
        } catch {
          // ignore
        }
      }
      for (const t of timers) clearTimeout(t)
      timers.clear()
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      pendingRef.current.clear()
    }
  }, [])

  // ------------------------------------------------------------- autoscroll
  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, interim])

  // ---------------------------------------------------------------- derived
  const canSend = connected && Boolean(client)
  const showTranslations = translateOn && targetLang !== 'original'
  const targetLabel =
    targetLang === 'original'
      ? 'original'
      : (LANGS.find((l) => l.code === targetLang)?.label ?? targetLang)
  const srcLabel = LANGS.find((l) => l.code === srcLang)?.label ?? srcLang

  const translatedCount = useMemo(
    () => (showTranslations ? lines.filter((l) => translations[l.text]).length : 0),
    [lines, translations, showTranslations],
  )

  // ------------------------------------------------------------------ render
  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------ controls first */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={srcLang} onValueChange={setSrcLang}>
                <SelectTrigger
                  className="h-12 w-full gap-2 sm:w-[230px]"
                  aria-label="Caption language"
                >
                  <Languages className="size-4 text-muted-foreground" aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="lg"
                onClick={listening ? stopListening : startListening}
                disabled={(!supported || !canSend) && !listening}
                className={cn(
                  'h-12 gap-2 px-6 text-base font-semibold',
                  listening
                    ? 'bg-destructive text-white hover:bg-destructive/90'
                    : 'bg-primary text-black hover:bg-positive',
                )}
                aria-label={listening ? 'Stop listening' : 'Start listening'}
              >
                {listening ? (
                  <>
                    <span className="size-2.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
                    <Square className="size-4" aria-hidden="true" /> Stop
                  </>
                ) : (
                  <>
                    <Mic className="size-5" aria-hidden="true" /> Start listening
                  </>
                )}
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:ml-auto">
              <div className="flex items-center gap-2">
                <Switch
                  id="cap-translate"
                  checked={translateOn}
                  onCheckedChange={setTranslateOn}
                  aria-label="Also translate for me"
                />
                <label
                  htmlFor="cap-translate"
                  className="cursor-pointer select-none text-xs font-medium"
                >
                  Also translate for me
                </label>
              </div>
              <Select value={targetLang} onValueChange={setTargetLang} disabled={!translateOn}>
                <SelectTrigger
                  className="h-10 w-full gap-2 sm:w-[210px]"
                  aria-label="Translation language for me"
                >
                  <Languages className="size-4 text-muted-foreground" aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original only</SelectItem>
                  {LANGS.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">
            Spoken in {srcLabel}. Interim words appear as &ldquo;hearing…&rdquo; locally, and only
            finished sentences are shared with the session.
            {showTranslations && ` Translations are for your eyes only, in ${targetLabel}.`}
          </p>
        </CardContent>
      </Card>

      {/* ------------------------------------------------ unsupported banner */}
      {!supported && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-warning/60 bg-warning/15 px-4 py-3 text-sm text-foreground"
        >
          <MicOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p>
            Automatic captions need Chrome, Edge or Safari. This browser has no speech engine.
            Manual captions below still work and are seen by everyone.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- feed */}
      <Card className="overflow-hidden border-none bg-stage p-0 text-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-stage-border bg-stage-soft/70 px-4 py-2.5">
          <p className="text-sm font-semibold">Live captions</p>
          <span className="rounded-full border border-stage-border bg-stage-soft px-2.5 py-0.5 text-[11px] text-stage-muted">
            {lines.length} line{lines.length === 1 ? '' : 's'}
          </span>
          {listening && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-positive/15 px-2.5 py-0.5 text-[11px] font-medium text-positive"
              role="status"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-positive" />
              </span>
              You are the source
            </span>
          )}
          {!supported && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-medium text-warning">
              <MicOff className="size-3" aria-hidden="true" /> no speech engine, manual only
            </span>
          )}
          {showTranslations && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-stage-border bg-stage-soft px-2.5 py-0.5 text-[11px] text-stage-muted">
              <Languages className="size-3" aria-hidden="true" /> translating → {targetLabel}
            </span>
          )}
          <span className="ml-auto rounded-full border border-stage-border bg-stage-soft px-2.5 py-0.5 text-[11px] text-stage-muted">
            {participants.length} in session
          </span>
        </div>

        <CardContent className="p-0">
          <div
            ref={feedRef}
            className="h-[420px] space-y-3 overflow-y-auto px-4 py-3"
            aria-label="Caption feed"
            aria-live="polite"
          >
            {lines.length === 0 && !interim && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="max-w-xs text-sm text-stage-muted/70">
                  Nothing said yet. Start listening above, or type the first line. Everyone in
                  the session follows this feed.
                </p>
              </div>
            )}
            {lines.map((l) => {
              const tr = showTranslations ? translations[l.text] : undefined
              return (
                <div key={l.id}>
                  <p className="text-[11px] font-semibold text-stage-muted">
                    {l.mine ? 'You' : l.by}
                    {l.lang === '' && (
                      <span className="ml-1.5 rounded bg-stage-raised px-1.5 py-0.5 text-[9px] font-medium text-stage-muted">
                        <Keyboard className="mr-0.5 inline size-2.5" aria-hidden="true" />typed
                      </span>
                    )}
                    <span className="ml-1.5 font-normal text-stage-muted/70">
                      {new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </p>
                  <p className="mt-0.5 break-words text-[15px] leading-relaxed text-stage-foreground">
                    {l.text}
                  </p>
                  {tr && (
                    <p className="mt-0.5 break-words text-sm leading-relaxed text-stage-muted">
                      <Languages className="mr-1 inline size-3" aria-hidden="true" />
                      {tr}
                    </p>
                  )}
                </div>
              )
            })}
            {interim && (
              <div>
                <p className="text-[11px] font-semibold text-stage-muted">
                  You
                  <span className="ml-1.5 font-normal italic text-stage-muted/70">hearing…</span>
                </p>
                <p className="mt-0.5 break-words text-[15px] italic leading-relaxed text-stage-muted">
                  {interim}
                </p>
              </div>
            )}
          </div>

          {/* manual mode */}
          <form
            className="flex gap-2 border-t border-stage-border px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault()
              const text = manualDraft
              setManualDraft('')
              void sendLine(text, '')
            }}
          >
            <Input
              value={manualDraft}
              onChange={(e) => setManualDraft(e.target.value)}
              placeholder="Type a caption line, everyone sees it in the feed"
              className="h-10 border-stage-border bg-stage-soft text-stage-foreground placeholder:text-stage-muted/70"
              maxLength={MAX_CAPTION_CHARS}
              aria-label="Type a caption line"
              disabled={!canSend}
            />
            <Button
              size="sm"
              type="submit"
              className="h-10 bg-primary px-3 text-black hover:bg-positive"
              disabled={!canSend || !manualDraft.trim()}
              aria-label="Send caption line"
            >
              <Send className="size-4" aria-hidden="true" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- footer chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
          {translatedCount > 0
            ? `${translatedCount} of ${lines.length} lines translated for you`
            : 'Translation runs only on your device, so what others receive stays original'}
        </span>
        {listening && (
          <span className="rounded-full border border-positive/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-positive">
            Captions broadcasting as {srcLabel}
          </span>
        )}
        {!supported && (
          <span className="rounded-full border border-warning/40 bg-warning/15 px-3 py-1.5 text-xs font-medium text-warning">
            Mic captions unavailable in this browser
          </span>
        )}
      </div>
    </div>
  )
}
