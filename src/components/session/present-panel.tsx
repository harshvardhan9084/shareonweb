'use client'

// Live Presentation — the host drives slides, everyone follows, reactions float.
//
// The presenter (room host) adds slide images. Slides travel through the same
// chunked file-transfer protocol the Share tools use (file:start → file:chunk
// → file:end, 256 KB chunks, slot "presentation"), so decks keep their full
// resolution — no more shrinking to a 44 KB JPEG just to fit one relay event.
// A tiny persisted app event ('present:slide') records the slide list and
// order; viewers assemble the picture from the file chunks they receive, and
// late joiners get both the events and the file chunks in the join snapshot.
//
// Sync protocol (RoomClient app events):
//   'present:slide'        persisted {id, fileId?, dataUrl?, name}
//                          fileId  → chunked transfer (current, full quality)
//                          dataUrl → legacy embedded slide (still rendered)
//   'present:slide:remove' persisted {id}            slide removed
//   'present:index'        persisted {index}         current slide (host only)
//   'present:pointer'      volatile  {x, y}          normalized 0..1 pointer
//   'react'                volatile  {emoji}         floating reaction
//
// Presenter notes live in localStorage on the presenter's device only — they
// are never sent to the session.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type { RoomClient } from '@/lib/room-client'
import type { AppEvent, DeviceType, Participant } from '@/lib/types'
import type { RoomFile } from '@/components/session/drop-panel'
import { base64ToBytes, chunksAreComplete, chunksToBlob, formatBytes } from '@/lib/file-blob'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Hand,
  Heart,
  ImageOff,
  ImagePlus,
  Laugh,
  Loader2,
  Maximize,
  Minimize,
  MonitorPlay,
  NotebookPen,
  PartyPopper,
  ThumbsUp,
  X,
} from 'lucide-react'

const MAX_SLIDES = 15
const SLIDE_MAX_W = 1920 // only used when an image exceeds the soft cap
const SLIDE_MAX_H = 1080
const SLIDE_QUALITY = 0.92
const SLIDE_SOFT_CAP_BYTES = 6 * 1024 * 1024 // above this, fit to 1920×1080
const POINTER_THROTTLE_MS = 80
const POINTER_TTL_MS = 1400
const FLOAT_TTL_MS = 3800
const NOTES_KEY_PREFIX = 'sow.present.notes.'

const REACTIONS = [
  { id: 'like', label: 'Thumbs up', icon: ThumbsUp },
  { id: 'clap', label: 'Applause', icon: Hand },
  { id: 'heart', label: 'Heart', icon: Heart },
  { id: 'laugh', label: 'Laugh', icon: Laugh },
  { id: 'wow', label: 'Wow', icon: Eye },
  { id: 'party', label: 'Celebrate', icon: PartyPopper },
] as const

const PRESENT_STYLES = `
@keyframes sow-present-float {
  from { transform: translateY(0); opacity: 1 }
  to { transform: translateY(-160px); opacity: 0 }
}
.sow-present-float { animation: sow-present-float 3.8s ease-out forwards; bottom: 8%; }
.sow-present-stage:fullscreen { aspect-ratio: auto; border: none; border-radius: 0; }
`

interface PanelProps {
  client: RoomClient | null
  selfId: string
  participants: Participant[]
  initialEvents: AppEvent[]
  connected: boolean
  isHost: boolean
  profileName: string
  device: DeviceType
  files: RoomFile[]
  sessionCode: string
}

interface Slide {
  id: string
  /** Chunked-transfer file backing this slide (current path). */
  fileId?: string
  /** Legacy embedded data URL (old sessions). */
  dataUrl?: string
  name?: string
}

interface Floater {
  key: number
  reaction: string
  left: number
  at: number
}

interface PointerMark {
  x: number
  y: number
  at: number
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function asRecord(payload: unknown): Record<string, unknown> | null {
  if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>
  }
  return null
}

function omitKey(rec: Record<string, number>, key: string): Record<string, number> {
  const next = { ...rec }
  delete next[key]
  return next
}

function extForType(type: string): string {
  if (type === 'image/png') return '.png'
  if (type === 'image/webp') return '.webp'
  if (type === 'image/gif') return '.gif'
  if (type === 'image/svg+xml') return '.svg'
  return '.jpg'
}

/** Turn a JPEG data URL (from the oversized-image fallback) into a File. */
function dataUrlToFile(dataUrl: string, name: string): File | null {
  try {
    const comma = dataUrl.indexOf(',')
    const meta = dataUrl.slice(0, comma)
    const b64 = dataUrl.slice(comma + 1)
    const type = /^data:([^;]+)/.exec(meta)?.[1] ?? 'image/jpeg'
    return new File([base64ToBytes(b64)], name, { type })
  } catch {
    return null
  }
}

/** Downscale an image file into a JPEG data URL (oversized-image fallback). */
async function shrinkImage(file: File, maxW: number, maxH: number, quality: number): Promise<string | null> {
  let revokeUrl: (() => void) | null = null
  try {
    let source: ImageBitmap | HTMLImageElement
    if (typeof createImageBitmap === 'function') {
      source = await createImageBitmap(file)
    } else {
      const url = URL.createObjectURL(file)
      revokeUrl = () => URL.revokeObjectURL(url)
      const img = new Image()
      img.src = url
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Could not decode image'))
      })
      source = img
    }
    const w0 = 'naturalWidth' in source ? source.naturalWidth : source.width
    const h0 = 'naturalHeight' in source ? source.naturalHeight : source.height
    if (w0 === 0 || h0 === 0) return null
    const scale = Math.min(1, maxW / w0, maxH / h0)
    const w = Math.max(1, Math.round(w0 * scale))
    const h = Math.max(1, Math.round(h0 * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(source, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return null
  } finally {
    revokeUrl?.()
  }
}

const ReactionButton = memo(function ReactionButton({
  reaction,
  onReact,
}: {
  reaction: (typeof REACTIONS)[number]
  onReact: (reactionId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onReact(reaction.id)}
      className="flex size-8 items-center justify-center rounded-full leading-none transition-colors hover:bg-stage-raised"
      aria-label={`React with ${reaction.label}`}
    >
      <reaction.icon className="size-5" aria-hidden="true" />
    </button>
  )
})

/**
 * Renders one slide picture from whatever source it has, in priority order:
 * the presenter's optimistic local URL, a legacy embedded data URL, or a
 * blob assembled from the chunked transfer. While the transfer is on its way
 * a shimmering placeholder shows progress; if it never completed the slide
 * says so honestly.
 */
const SlideImage = memo(function SlideImage({
  slide,
  file,
  localUrl,
  alt,
  className,
}: {
  slide: Slide
  file?: RoomFile
  localUrl?: string
  alt: string
  className?: string
}) {
  const assembled = useMemo(() => {
    if (!file || !file.complete) return null
    if (!chunksAreComplete(file.chunks, file.chunkCount)) return null
    const blob = chunksToBlob(file.chunks, file.type || 'image/jpeg')
    return blob ? URL.createObjectURL(blob) : null
  }, [file])

  useEffect(() => {
    if (!assembled) return
    return () => URL.revokeObjectURL(assembled)
  }, [assembled])

  const src = localUrl ?? slide.dataUrl ?? assembled
  if (src) {
    return <img src={src} alt={alt} className={className} draggable={false} />
  }

  if (file && !file.complete) {
    const pct = Math.min(100, Math.round((file.received / Math.max(1, file.chunkCount)) * 100))
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2.5 bg-stage-soft/70" role="status" aria-live="polite">
        <Loader2 className="size-6 animate-spin text-positive" aria-hidden="true" />
        <p className="text-xs font-medium text-stage-muted">Receiving slide… {pct}%</p>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-stage-raised">
          <div
            className="h-full w-full origin-left rounded-full bg-positive transition-transform duration-300"
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 text-stage-muted/70">
      <ImageOff className="size-6" aria-hidden="true" />
      <p className="max-w-[80%] text-center text-xs leading-relaxed">
        Slide image unavailable. Its transfer didn&apos;t complete.
      </p>
    </div>
  )
})

export function PresentPanel({
  client,
  selfId,
  participants,
  initialEvents,
  isHost,
  files,
  sessionCode,
}: PanelProps) {
  const isPresenter = isHost
  const [slides, setSlides] = useState<Slide[]>([])
  const [index, setIndex] = useState(0)
  const [adding, setAdding] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [floaters, setFloaters] = useState<Floater[]>([])
  const [pointer, setPointer] = useState<PointerMark | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  // Presenter-optimistic object URLs (slide visible while still uploading).
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({})
  // Upload progress per optimistic slide (percent, presenter only).
  const [sendPct, setSendPct] = useState<Record<string, number>>({})
  // Presenter notes — this device only.
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const slidesRef = useRef<Slide[]>([])
  slidesRef.current = slides
  const localUrlsRef = useRef<Record<string, string>>({})
  localUrlsRef.current = localUrls
  const indexRef = useRef(0)
  indexRef.current = index
  const floatKeyRef = useRef(0)
  const pointerLastRef = useRef(0)
  const pointerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const presenterName = useMemo(
    () => participants.find((p) => p.id !== selfId)?.name ?? participants[0]?.name ?? 'the presenter',
    [participants, selfId],
  )

  // -------------------------------------------------------- rebuild on mount
  useEffect(() => {
    const map = new Map<string, Slide>()
    let idx = 0
    for (const ev of initialEvents) {
      const p = asRecord(ev.payload)
      if (ev.type === 'present:slide' && p && typeof p.id === 'string') {
        const slide: Slide = {
          id: p.id,
          fileId: typeof p.fileId === 'string' ? p.fileId : undefined,
          dataUrl: typeof p.dataUrl === 'string' ? p.dataUrl : undefined,
          name: typeof p.name === 'string' ? p.name : undefined,
        }
        map.set(p.id, slide)
      } else if (ev.type === 'present:slide:remove' && p && typeof p.id === 'string') {
        map.delete(p.id)
      } else if (ev.type === 'present:index' && p) {
        const n = Number(p.index)
        if (Number.isFinite(n)) idx = n
      }
    }
    const arr = Array.from(map.values())
    setSlides(arr)
    setIndex(Math.max(0, Math.min(idx, Math.max(0, arr.length - 1))))
  }, [initialEvents])

  // ------------------------------------------------------------- app events
  useEffect(() => {
    if (!client) return
    return client.on('appevent', (raw) => {
      const ev = raw as AppEvent
      const mine = ev.from === selfId
      const p = asRecord(ev.payload)

      if (ev.type === 'present:slide') {
        if (mine || !p || typeof p.id !== 'string') return
        const slide: Slide = {
          id: p.id,
          fileId: typeof p.fileId === 'string' ? p.fileId : undefined,
          dataUrl: typeof p.dataUrl === 'string' ? p.dataUrl : undefined,
          name: typeof p.name === 'string' ? p.name : undefined,
        }
        const existing = slidesRef.current.findIndex((s) => s.id === slide.id)
        if (existing >= 0) {
          const next = slidesRef.current.map((s) => (s.id === slide.id ? slide : s))
          slidesRef.current = next
          setSlides(next)
        } else {
          slidesRef.current = [...slidesRef.current, slide]
          setSlides(slidesRef.current)
        }
        return
      }

      if (ev.type === 'present:slide:remove') {
        if (mine || !p || typeof p.id !== 'string') return
        const next = slidesRef.current.filter((s) => s.id !== p.id)
        slidesRef.current = next
        setSlides(next)
        setIndex(Math.max(0, Math.min(indexRef.current, Math.max(0, next.length - 1))))
        return
      }

      if (ev.type === 'present:index') {
        if (mine || !p) return
        const n = Number(p.index)
        if (!Number.isFinite(n)) return
        setIndex(Math.max(0, Math.min(Math.round(n), Math.max(0, slidesRef.current.length - 1))))
        return
      }

      if (ev.type === 'present:pointer') {
        if (mine || !p) return
        const x = Number(p.x)
        const y = Number(p.y)
        if (!Number.isFinite(x) || !Number.isFinite(y)) return
        setPointer({
          x: Math.max(0, Math.min(1, x)),
          y: Math.max(0, Math.min(1, y)),
          at: Date.now(),
        })
        return
      }

      if (ev.type === 'react') {
        if (mine || !p) return
        const value = typeof p.emoji === 'string' ? p.emoji : ''
        const reaction = REACTIONS.find((r) => r.id === value) ?? REACTIONS[0]
        if (value && reaction) addFloater(reaction.id)
        return
      }
    })
  }, [client, selfId])

  // Prune expired floaters and the remote pointer dot.
  useEffect(() => {
    const t = setInterval(() => {
      const nowMs = Date.now()
      setFloaters((prev) => {
        const next = prev.filter((f) => nowMs - f.at < FLOAT_TTL_MS)
        return next.length === prev.length ? prev : next
      })
      setPointer((prev) => (prev && nowMs - prev.at >= POINTER_TTL_MS ? null : prev))
    }, 300)
    return () => clearInterval(t)
  }, [])

  // Track fullscreen state so the button can toggle back out.
  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(
    () => () => {
      if (pointerTimerRef.current) clearTimeout(pointerTimerRef.current)
    },
    [],
  )

  // Presenter notes: load once per session, save debounced, never transmitted.
  const notesKey = `${NOTES_KEY_PREFIX}${sessionCode}`
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(notesKey)
      setNotes(raw ? (JSON.parse(raw) as Record<string, string>) : {})
    } catch {
      setNotes({})
    }
  }, [notesKey])
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(notesKey, JSON.stringify(notes))
      } catch {
        // storage full or blocked — notes simply stay in memory for this visit
      }
    }, 400)
    return () => clearTimeout(t)
  }, [notes, notesKey])

  // Revoke the presenter's optimistic object URLs when the panel unmounts.
  useEffect(
    () => () => {
      for (const url of Object.values(localUrlsRef.current)) URL.revokeObjectURL(url)
    },
    [],
  )

  // ---------------------------------------------------------------- helpers
  function addFloater(reactionId: string) {
    floatKeyRef.current += 1
    const key = floatKeyRef.current
    setFloaters((prev) => [
      ...prev.slice(-18),
      { key, reaction: reactionId, left: 6 + Math.random() * 78, at: Date.now() },
    ])
  }

  function react(reactionId: string) {
    // volatile events never echo back — render the self reaction locally
    addFloater(reactionId)
    void client?.sendAppEvent('react', { emoji: reactionId }, { persist: false }).catch(() => undefined)
  }

  const broadcastIndex = useCallback(
    (i: number) => {
      void client
        ?.sendAppEvent('present:index', { index: i }, { persist: true })
        .catch(() => undefined)
    },
    [client],
  )

  function goTo(i: number) {
    if (!isPresenter) return
    const clamped = Math.max(0, Math.min(i, Math.max(0, slidesRef.current.length - 1)))
    if (clamped === indexRef.current) return
    indexRef.current = clamped
    setIndex(clamped)
    broadcastIndex(clamped)
  }

  function addSlideObject(slide: Slide) {
    slidesRef.current = [...slidesRef.current, slide]
    setSlides(slidesRef.current)
  }

  /** Remove the optimistic slide after a failed upload (with URL cleanup). */
  function dropOptimisticSlide(id: string) {
    slidesRef.current = slidesRef.current.filter((s) => s.id !== id)
    setSlides(slidesRef.current)
    setSendPct((prev) => omitKey(prev, id))
    const url = localUrlsRef.current[id]
    if (url) {
      URL.revokeObjectURL(url)
      setLocalUrls(({ [id]: _gone, ...rest }) => rest)
    }
  }

  async function addFiles(fileList: FileList | File[] | null) {
    if (!fileList || !isPresenter) return
    const c = client
    if (!c) {
      toast.error('Not connected to the session yet; try again in a moment.')
      return
    }
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (incoming.length === 0) {
      toast.error('Slides must be images: PNG, JPEG, WebP or GIF.')
      return
    }
    setAdding(true)
    try {
      for (const original of incoming) {
        if (slidesRef.current.length >= MAX_SLIDES) {
          toast.error(`Up to ${MAX_SLIDES} slides per presentation.`)
          break
        }

        // Full-quality path: the original bytes go over the wire untouched.
        // Only oversized files (photos straight off a camera) are fitted to
        // 1920×1080 so a deck stays inside the session's file budget.
        let file = original
        if (original.size > SLIDE_SOFT_CAP_BYTES) {
          const shrunk = await shrinkImage(original, SLIDE_MAX_W, SLIDE_MAX_H, SLIDE_QUALITY)
          const asFile = shrunk ? dataUrlToFile(shrunk, `${original.name.replace(/\.[^.]+$/, '')}.jpg`) : null
          if (!asFile) {
            toast.error(`Could not read ${original.name}.`)
            continue
          }
          file = asFile
          toast.info(
            `${original.name} was over 6 MB, so it was fitted to 1920×1080 to keep the deck light.`,
          )
        }

        const id = uid()
        const fileId = `slide-${id}`
        const name = `slide-${slidesRef.current.length + 1}${extForType(file.type)}`
        const localUrl = URL.createObjectURL(file)
        setLocalUrls((prev) => ({ ...prev, [id]: localUrl }))
        const slide: Slide = { id, fileId, name }
        addSlideObject(slide)
        setSendPct((prev) => ({ ...prev, [id]: 0 }))

        try {
          await c.sendFile(
            file,
            fileId,
            (sent, total) =>
              setSendPct((prev) => ({ ...prev, [id]: Math.round((sent / Math.max(1, total)) * 100) })),
            undefined,
            'presentation',
          )
        } catch {
          dropOptimisticSlide(id)
          toast.error(`Could not share ${original.name}, check the connection and try again.`)
          continue
        }
        setSendPct((prev) => omitKey(prev, id))

        try {
          await c.sendAppEvent('present:slide', { id, fileId, name }, { persist: true })
        } catch {
          toast.error('The slide was added but could not be announced, so viewers may need to rejoin to see it.')
        }
      }
    } finally {
      setAdding(false)
    }
  }

  function removeSlide(id: string) {
    const c = client
    if (!c || !isPresenter) return
    const victim = slidesRef.current.find((s) => s.id === id)
    const next = slidesRef.current.filter((s) => s.id !== id)
    slidesRef.current = next
    setSlides(next)
    const clamped = Math.max(0, Math.min(indexRef.current, Math.max(0, next.length - 1)))
    const moved = clamped !== indexRef.current
    indexRef.current = clamped
    if (moved) setIndex(clamped)
    void c.sendAppEvent('present:slide:remove', { id }, { persist: true }).catch(() => undefined)
    if (victim?.fileId) {
      // the backing file leaves every device's session storage too
      void c.removeFile(victim.fileId).catch(() => undefined)
    }
    const url = localUrlsRef.current[id]
    if (url) {
      URL.revokeObjectURL(url)
      setLocalUrls(({ [id]: _gone, ...rest }) => rest)
    }
    setNotes((prev) => {
      const nextNotes = { ...prev }
      delete nextNotes[id]
      return nextNotes
    })
  }

  function onStageKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!isPresenter) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(indexRef.current - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(indexRef.current + 1)
    }
  }

  function onDragOver(e: ReactDragEvent<HTMLDivElement>) {
    if (!isPresenter) return
    e.preventDefault()
    setDragOver(true)
  }

  function onDrop(e: ReactDragEvent<HTMLDivElement>) {
    if (!isPresenter) return
    e.preventDefault()
    setDragOver(false)
    void addFiles(e.dataTransfer?.files ?? null)
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isPresenter) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    const nowMs = Date.now()
    const send = () => {
      pointerLastRef.current = Date.now()
      void client
        ?.sendAppEvent('present:pointer', { x, y }, { persist: false })
        .catch(() => undefined)
    }
    if (nowMs - pointerLastRef.current >= POINTER_THROTTLE_MS) {
      send()
      return
    }
    if (pointerTimerRef.current) clearTimeout(pointerTimerRef.current)
    pointerTimerRef.current = setTimeout(send, POINTER_THROTTLE_MS - (nowMs - pointerLastRef.current))
  }

  function toggleFullscreen() {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
    } else {
      void el.requestFullscreen().catch(() => toast.error('Fullscreen was blocked by the browser.'))
    }
  }

  // ---------------------------------------------------------------- derived
  const current = slides[index] ?? null
  const currentFile = useMemo(
    () => (current?.fileId ? files.find((f) => f.fileId === current.fileId) : undefined),
    [current?.fileId, files],
  )
  const deckBytes = useMemo(() => {
    let total = 0
    for (const s of slides) {
      if (s.dataUrl) total += Math.round(s.dataUrl.length * 0.75)
      else if (s.fileId) total += files.find((f) => f.fileId === s.fileId)?.size ?? 0
    }
    return total
  }, [slides, files])
  const chipText = useMemo(() => {
    if (slides.length === 0) return isPresenter ? 'No slides yet' : `Waiting for ${presenterName}`
    return isPresenter
      ? `Presenting · slide ${index + 1} of ${slides.length}`
      : `Slide ${index + 1} of ${slides.length} · Following ${presenterName}`
  }, [slides.length, index, isPresenter, presenterName])

  return (
    <div className="space-y-4">
      <style>{PRESENT_STYLES}</style>

      {/* presenter toolbar — the main action stays on top */}
      {isPresenter && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
            {adding ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-4" aria-hidden="true" />
            )}
            Add slides
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                void addFiles(e.target.files)
                e.target.value = ''
              }}
              aria-label="Add slide images"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            …or drop images on the stage. Slides go out at full quality, their original resolution. Only files over 6 MB are fitted to 1920×1080.
          </p>
          <span className="ml-auto text-xs text-muted-foreground">
            {slides.length}/{MAX_SLIDES} slides{deckBytes > 0 ? ` · ${formatBytes(deckBytes)}` : ''}
          </span>
        </div>
      )}

      <Card className="overflow-hidden border-stage-border bg-stage p-0 text-stage-foreground">
        {/* stage header: chip + reactions + fullscreen */}
        <div className="flex flex-wrap items-center gap-2 border-b border-stage-border bg-stage-soft/60 px-4 py-2.5">
          <p className="text-sm font-semibold">Live slides</p>
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-stage-raised px-2.5 py-0.5 text-[11px] font-medium text-stage-muted"
            role="status"
            aria-live="polite"
          >
            {chipText}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {isPresenter && (
              <Button
                variant="outline"
                size="sm"
                aria-pressed={notesOpen}
                className={cn(
                  'h-8 gap-1.5 border-stage-border bg-stage-soft text-xs hover:bg-stage-raised',
                  notesOpen
                    ? 'border-positive/40 text-positive hover:text-positive'
                    : 'text-stage-muted hover:text-white',
                )}
                onClick={() => setNotesOpen((v) => !v)}
              >
                <NotebookPen className="size-3.5" aria-hidden="true" />
                Notes
              </Button>
            )}
            <div
              className="flex items-center gap-0.5 rounded-full border border-stage-border bg-stage-soft/80 px-1.5 py-1"
              role="group"
              aria-label="Reactions"
            >
              {REACTIONS.map((r) => (
                <ReactionButton key={r.id} reaction={r} onReact={react} />
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-stage-border bg-stage-soft text-xs text-stage-muted hover:bg-stage-raised hover:text-white"
              onClick={toggleFullscreen}
            >
              {fullscreen ? (
                <Minimize className="size-3.5" aria-hidden="true" />
              ) : (
                <Maximize className="size-3.5" aria-hidden="true" />
              )}
              {fullscreen ? 'Exit' : 'Present'}
            </Button>
          </div>
        </div>

        {/* the stage */}
        <div className="p-4">
          <div
            ref={stageRef}
            className={cn(
              'sow-present-stage relative aspect-video overflow-hidden rounded-xl border bg-black outline-none transition-shadow',
              dragOver ? 'border-positive ring-2 ring-positive' : 'border-stage-border',
            )}
            tabIndex={0}
            role="region"
            aria-label={
              isPresenter
                ? 'Slide stage, press the arrow keys to change slides'
                : 'Slide stage'
            }
            onKeyDown={onStageKeyDown}
            onDragOver={onDragOver}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onPointerMove={handlePointerMove}
          >
            {current ? (
              <>
                <SlideImage
                  slide={current}
                  file={currentFile}
                  localUrl={localUrls[current.id]}
                  alt={`Slide ${index + 1} of ${slides.length}${current.name ? `, ${current.name}` : ''}`}
                  className="absolute inset-0 size-full object-contain"
                />
                {/* upload strip while the presenter's own copy is on its way */}
                {isPresenter && sendPct[current.id] != null && (
                  <div className="absolute inset-x-0 bottom-0 z-10 h-1.5 bg-stage/80" aria-hidden="true">
                    <div
                      className="h-full w-full origin-left bg-positive transition-transform duration-200"
                      style={{ transform: `scaleX(${(sendPct[current.id] ?? 0) / 100})` }}
                    />
                  </div>
                )}
              </>
            ) : isPresenter ? (
              <div className="flex size-full flex-col items-center justify-center gap-3 text-stage-muted/70">
                <ImagePlus className="size-10" aria-hidden="true" />
                <p className="text-sm">Drop slide images here</p>
                <p className="text-xs text-stage-muted/50">
                  Everyone in the session follows along live.
                </p>
              </div>
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-3 text-stage-muted/70">
                <MonitorPlay className="size-10" aria-hidden="true" />
                <p className="text-sm">Waiting for {presenterName} to start presenting…</p>
              </div>
            )}

            {/* remote pointer glow */}
            {pointer && (
              <span
                className="pointer-events-none absolute z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-positive sow-pointer-glow"
                style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }}
                aria-hidden="true"
              />
            )}

            {/* floating reactions */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              {floaters.map((f) => {
                const reaction = REACTIONS.find((r) => r.id === f.reaction) ?? REACTIONS[0]
                return (
                  <span
                    key={f.key}
                    className="sow-present-float absolute drop-shadow-lg"
                    style={{ left: `${f.left}%` }}
                  >
                    <reaction.icon className="size-9" aria-hidden="true" />
                  </span>
                )
              })}
            </div>

            {/* presenter stage navigation */}
            {isPresenter && slides.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(indexRef.current - 1)}
                  disabled={index === 0}
                  className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-30"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(indexRef.current + 1)}
                  disabled={index >= slides.length - 1}
                  className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-30"
                  aria-label="Next slide"
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </button>
              </>
            )}

            {dragOver && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-primary/10 text-sm font-medium text-positive">
                Drop to add slide{slides.length + 1 > MAX_SLIDES ? ' (list is full)' : ''}
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stage-muted/70">
            {isPresenter ? (
              <>
                <span>Click into the stage and use ← / → keys to navigate</span>
                <span>Move the mouse over the stage and everyone sees your pointer</span>
              </>
            ) : (
              <span>
                {presenterName} controls the slides; react with the reactions above
              </span>
            )}
          </div>
        </div>

        {/* presenter notes — this device only, never shared */}
        {isPresenter && notesOpen && (
          <div className="border-t border-stage-border bg-stage-soft/40 px-4 py-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-stage-muted">
                <NotebookPen className="size-3.5 text-positive" aria-hidden="true" />
                Notes · {slides.length === 0 ? 'no slide yet' : `slide ${index + 1}`}
              </p>
              <p className="text-[11px] text-stage-muted/70">
                Stays on this device, never shared with the session
              </p>
            </div>
            <textarea
              value={current ? (notes[current.id] ?? '') : ''}
              onChange={(e) => {
                const sid = current?.id
                if (!sid) return
                const value = e.target.value
                setNotes((prev) => ({ ...prev, [sid]: value }))
              }}
              disabled={!current}
              rows={3}
              placeholder={current ? 'Key points for this slide, visible only to you…' : 'Add a slide to start notes.'}
              className="w-full resize-y rounded-md border border-stage-border bg-stage px-3 py-2 text-sm leading-relaxed text-stage-foreground transition-colors placeholder:text-stage-muted/50 focus:border-positive/60 focus:outline-none focus:ring-2 focus:ring-positive/20 disabled:opacity-60"
              aria-label={`Presenter notes for slide ${index + 1}`}
            />
          </div>
        )}

        {/* thumbnails */}
        {slides.length > 0 && (
          <div className="border-t border-stage-border px-4 py-3">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {slides.map((s, i) => {
                const pct = sendPct[s.id]
                return (
                  <div
                    key={s.id}
                    role={isPresenter ? 'button' : undefined}
                    tabIndex={isPresenter ? 0 : undefined}
                    onClick={() => goTo(i)}
                    onKeyDown={(e) => {
                      if (isPresenter && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        goTo(i)
                      }
                    }}
                    className={cn(
                      'group relative aspect-video w-28 shrink-0 overflow-hidden rounded-md border bg-black/60 transition',
                      i === index
                        ? 'border-positive ring-2 ring-positive/60'
                        : 'border-stage-border opacity-70 hover:opacity-100',
                      isPresenter && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-positive',
                    )}
                    aria-label={isPresenter ? `Go to slide ${i + 1}` : `Slide ${i + 1}`}
                    aria-current={i === index || undefined}
                  >
                    <SlideImage
                      slide={s}
                      file={s.fileId ? files.find((f) => f.fileId === s.fileId) : undefined}
                      localUrl={localUrls[s.id]}
                      alt={`Slide ${i + 1} thumbnail`}
                      className="size-full object-cover"
                    />
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[10px] font-semibold text-white">
                      {i + 1}
                    </span>
                    {pct != null && (
                      <>
                        <span
                          className="pointer-events-none absolute inset-0 animate-pulse rounded-md ring-2 ring-positive/70"
                          aria-hidden="true"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-stage-raised" aria-hidden="true">
                          <div
                            className="h-full w-full origin-left bg-positive transition-transform duration-200"
                            style={{ transform: `scaleX(${pct / 100})` }}
                          />
                        </div>
                      </>
                    )}
                    {isPresenter && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeSlide(s.id)
                        }}
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition hover:bg-destructive focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label={`Remove slide ${i + 1}`}
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
