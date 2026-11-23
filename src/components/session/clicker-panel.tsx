'use client'

// Presentation Remote — the phone controls slides on the computer.
//
// One device runs the STAGE (holds the slides, shows them big, executes
// commands); any other device (auto-picked on phones) runs the REMOTE with
// big touch buttons. Slides never leave the stage device — remotes only get
// a tiny live preview, so even big decks stay inside the relay's payload cap.
//
// Sync protocol (RoomClient app events):
//   'clicker:cmd'   volatile  {cmd}                            next | prev | blank | restore
//   'clicker:state' volatile  {index, count, blank, preview?} stage → remotes, on every change
//   'clicker:title' persisted {title}                          text shown on the blank screen
//
// The stage announces its state when it comes online, so a remote that joins
// later immediately knows where the deck is.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import type { RoomClient } from '@/lib/room-client'
import type { AppEvent, DeviceType, Participant } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Keyboard,
  Loader2,
  Moon,
  Monitor,
  MonitorPlay,
  Smartphone,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'

const MAX_SLIDES = 15
const MAX_SLIDE_CHARS = 44_000 // data URL length guard, safely under the 48 KB relay cap
const SLIDE_MAX_W = 1280
const SLIDE_MAX_H = 720
const SLIDE_QUALITY = 0.62
const PREVIEW_MAX = 480
const PREVIEW_QUALITY = 0.5
const TITLE_DEBOUNCE_MS = 400
const FLASH_MS = 600

type ClickerMode = 'stage' | 'remote'
type ClickerCmd = 'next' | 'prev' | 'blank' | 'restore'

interface PanelProps {
  client: RoomClient | null
  selfId: string
  participants: Participant[]
  initialEvents: AppEvent[]
  connected: boolean
  isHost: boolean
  profileName: string
  device: DeviceType
}

interface Slide {
  id: string
  dataUrl: string
}

interface RemoteView {
  index: number
  count: number
  blank: boolean
  preview: string | null
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

/** Downscale an image file into a JPEG data URL that fits the relay cap. */
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

const RemoteButton = memo(function RemoteButton({
  cmd,
  flash,
  onClick,
  children,
  ariaLabel,
}: {
  cmd: string
  flash: boolean
  onClick: () => void
  children: ReactNode
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'flex h-16 select-none items-center justify-center gap-2 rounded-2xl text-base font-bold transition-[transform,background-color,border-color,box-shadow] active:scale-95',
        flash ? 'bg-primary text-primary-foreground' : 'bg-stage-raised text-stage-foreground hover:bg-stage-raised',
      )}
    >
      {children}
    </button>
  )
})

export function ClickerPanel({
  client,
  selfId,
  participants,
  initialEvents,
  connected,
  device,
}: PanelProps) {
  // phones start as the controller, everything else as the stage
  const [mode, setMode] = useState<ClickerMode>(() => (device === 'phone' ? 'remote' : 'stage'))

  // ------------------------------------------------------------- stage state
  const [slides, setSlides] = useState<Slide[]>([])
  const [index, setIndex] = useState(0)
  const [blank, setBlank] = useState(false)
  const [title, setTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const slidesRef = useRef<Slide[]>([])
  slidesRef.current = slides
  const indexRef = useRef(0)
  indexRef.current = index
  const blankRef = useRef(false)
  blankRef.current = blank
  const previewCacheRef = useRef<Map<string, string>>(new Map())

  // ------------------------------------------------------------ remote state
  const [view, setView] = useState<RemoteView | null>(null)
  const [remoteTitle, setRemoteTitle] = useState('')
  const [flashCmd, setFlashCmd] = useState<ClickerCmd | null>(null)

  const modeRef = useRef(mode)
  modeRef.current = mode
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ------------------------------------------------- stage → remotes announce
  const broadcastState = useCallback(() => {
    const c = client
    if (!c) return
    const current = slidesRef.current[indexRef.current]
    const preview =
      !blankRef.current && current ? previewCacheRef.current.get(current.id) ?? null : null
    void c
      .sendAppEvent(
        'clicker:state',
        {
          index: indexRef.current,
          count: slidesRef.current.length,
          blank: blankRef.current,
          preview: preview ?? undefined, // omitted when missing (payload cap)
        },
        { persist: false },
      )
      .catch(() => undefined)
  }, [client])

  const step = useCallback(
    (dir: 1 | -1) => {
      const count = slidesRef.current.length
      if (count === 0) return
      const next = Math.min(count - 1, Math.max(0, indexRef.current + dir))
      if (next === indexRef.current) return
      indexRef.current = next
      setIndex(next)
      broadcastState()
    },
    [broadcastState],
  )

  const toggleBlank = useCallback(
    (next?: boolean) => {
      const v = typeof next === 'boolean' ? next : !blankRef.current
      if (v === blankRef.current) return
      blankRef.current = v
      setBlank(v)
      broadcastState()
    },
    [broadcastState],
  )

  // Announce state when the stage comes online so late remotes sync up.
  useEffect(() => {
    if (mode !== 'stage') return
    broadcastState()
  }, [mode, broadcastState])

  // -------------------------------------------------------- rebuild on mount
  // Remotes recover the blank-screen title from the persisted room history.
  useEffect(() => {
    for (let i = initialEvents.length - 1; i >= 0; i--) {
      const ev = initialEvents[i]
      if (ev.type !== 'clicker:title') continue
      const p = asRecord(ev.payload)
      if (p && typeof p.title === 'string') {
        setRemoteTitle(p.title)
        break
      }
    }
  }, [initialEvents])

  // ------------------------------------------------------------- app events
  useEffect(() => {
    if (!client) return
    return client.on('appevent', (raw) => {
      const ev = raw as AppEvent
      const mine = ev.from === selfId
      const p = asRecord(ev.payload)

      if (ev.type === 'clicker:cmd') {
        if (modeRef.current !== 'stage' || !p) return
        const cmd = typeof p.cmd === 'string' ? p.cmd : ''
        if (cmd === 'next') step(1)
        else if (cmd === 'prev') step(-1)
        else if (cmd === 'blank') toggleBlank(true)
        else if (cmd === 'restore') toggleBlank(false)
        return
      }

      if (ev.type === 'clicker:state') {
        if (modeRef.current !== 'remote' || mine || !p) return
        const idx = Number(p.index)
        const count = Number(p.count)
        setView({
          index: Number.isFinite(idx) ? Math.max(0, Math.round(idx)) : 0,
          count: Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0,
          blank: Boolean(p.blank),
          preview: typeof p.preview === 'string' ? p.preview : null,
        })
        return
      }

      if (ev.type === 'clicker:title') {
        if (mine || !p) return
        if (typeof p.title === 'string') setRemoteTitle(p.title)
        return
      }
    })
  }, [client, selfId, step, toggleBlank])

  // ------------------------------------------------------------ stage extras
  async function makePreview(slideId: string, file: File) {
    const small = await shrinkImage(file, PREVIEW_MAX, PREVIEW_MAX, PREVIEW_QUALITY)
    if (!small || small.length > MAX_SLIDE_CHARS) return
    previewCacheRef.current.set(slideId, small)
    const current = slidesRef.current[indexRef.current]
    if (current && current.id === slideId) broadcastState()
  }

  async function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    setAdding(true)
    try {
      for (const file of files) {
        if (slidesRef.current.length >= MAX_SLIDES) {
          toast.error(`Up to ${MAX_SLIDES} slides.`)
          break
        }
        const dataUrl = await shrinkImage(file, SLIDE_MAX_W, SLIDE_MAX_H, SLIDE_QUALITY)
        if (!dataUrl) {
          toast.error(`Could not read ${file.name}.`)
          continue
        }
        if (dataUrl.length > MAX_SLIDE_CHARS) {
          toast.error('Slide too heavy, try a smaller image.')
          continue
        }
        const id = uid()
        slidesRef.current = [...slidesRef.current, { id, dataUrl }]
        setSlides(slidesRef.current)
        broadcastState()
        void makePreview(id, file)
      }
    } finally {
      setAdding(false)
    }
  }

  function onSlideInput(e: ChangeEvent<HTMLInputElement>) {
    void addFiles(e.target.files)
    e.target.value = ''
  }

  function onTitleChange(e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.slice(0, 200)
    setTitle(v)
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current)
    titleTimerRef.current = setTimeout(() => {
      void client
        ?.sendAppEvent('clicker:title', { title: v }, { persist: true })
        .catch(() => undefined)
    }, TITLE_DEBOUNCE_MS)
  }

  // Stage keyboard control: arrows navigate, B blanks.
  useEffect(() => {
    if (mode !== 'stage') return
    function onKey(e: KeyboardEvent) {
      const t = e.target
      if (
        t instanceof HTMLElement &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      ) {
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        step(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        step(-1)
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        toggleBlank()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, step, toggleBlank])

  // ------------------------------------------------------ remote → stage cmds
  function sendCmd(cmd: ClickerCmd) {
    const c = client
    if (!c || !connected) {
      toast.error('Not connected to the session yet.')
      return
    }
    void c.sendAppEvent('clicker:cmd', { cmd }, { persist: false }).catch(() => undefined)
    setFlashCmd(cmd)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashCmd(null), FLASH_MS)
  }

  function remoteToggleBlank() {
    const goingBlank = !(view?.blank ?? false)
    // optimistic feedback — the stage confirms with the next 'clicker:state'
    setView((v) => (v ? { ...v, blank: goingBlank } : v))
    sendCmd(goingBlank ? 'blank' : 'restore')
  }

  // ---------------------------------------------------------------- cleanup
  useEffect(
    () => () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    },
    [],
  )

  // ---------------------------------------------------------------- derived
  const remoteCount = Math.max(0, participants.length - 1)
  const current = slides[index] ?? null

  const stageChip = slides.length === 0 ? 'No slides' : `Slide ${Math.min(index + 1, slides.length)} of ${slides.length}`
  const remoteChip = view
    ? `Slide ${Math.min(view.index + 1, Math.max(1, view.count))} of ${view.count}`
    : 'No slide info yet'

  const connection = useMemo(() => {
    if (!connected) {
      return { icon: <WifiOff className="size-3" aria-hidden="true" />, text: 'Offline, reconnecting…', cls: 'bg-warning/15 text-warning' }
    }
    if (!view) {
      return { icon: <Wifi className="size-3" aria-hidden="true" />, text: 'Waiting for the stage…', cls: 'bg-stage-raised text-stage-muted' }
    }
    return { icon: <Wifi className="size-3" aria-hidden="true" />, text: 'Live', cls: 'bg-primary/15 text-positive' }
  }, [connected, view])

  return (
    <div className="space-y-4">
      {/* mode picker */}
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Monitor className="size-3.5 text-primary" aria-hidden="true" />
          Stage (this screen)
        </div>
        <Switch
          checked={mode === 'remote'}
          onCheckedChange={(v) => setMode(v ? 'remote' : 'stage')}
          aria-label="Switch between stage and remote mode"
        />
        <div className="flex items-center gap-2 text-xs font-medium">
          Remote (controller)
          <Smartphone className="size-3.5 text-primary" aria-hidden="true" />
        </div>
      </div>

      {mode === 'stage' ? (
        /* ---------------------------------------------------------- STAGE */
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <Card className="overflow-hidden border-stage-border bg-stage p-0 text-stage-foreground">
            <div className="flex flex-wrap items-center gap-2 border-b border-stage-border bg-stage-soft/60 px-4 py-2.5">
              <p className="text-sm font-semibold">Stage</p>
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-stage-raised px-2.5 py-0.5 text-[11px] font-medium text-stage-muted"
                role="status"
                aria-live="polite"
              >
                {stageChip}
              </span>
              {blank && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-medium text-warning">
                  <Moon className="size-3" aria-hidden="true" /> blanked
                </span>
              )}
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-stage-raised px-2.5 py-0.5 text-[11px] font-medium text-stage-muted">
                <Smartphone className="size-3" aria-hidden="true" />
                {remoteCount} remote{remoteCount === 1 ? '' : 's'}
              </span>
            </div>

            <div className="p-4">
              <div
                className="relative aspect-video overflow-hidden rounded-xl border border-stage-border bg-black"
                role="region"
                aria-label="Presentation stage"
              >
                {blank ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black px-8 text-center">
                    {title && <p className="text-lg font-medium text-stage-muted">{title}</p>}
                  </div>
                ) : current ? (
                  <img
                    src={current.dataUrl}
                    alt={`Slide ${index + 1} of ${slides.length}`}
                    className="absolute inset-0 size-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-3 text-stage-muted/70">
                    <ImagePlus className="size-10" aria-hidden="true" />
                    <p className="text-sm">Upload slide images to start</p>
                    <p className="text-xs text-stage-muted/50">
                      Remotes on other devices will drive this deck.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  className="h-10 gap-1.5 border-stage-border bg-stage-soft text-xs text-stage-muted hover:bg-stage-raised hover:text-white"
                  onClick={() => step(-1)}
                  disabled={slides.length === 0 || index === 0}
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" /> Prev
                </Button>
                <Button
                  variant={blank ? 'default' : 'outline'}
                  className={cn(
                    'h-10 gap-1.5 text-xs',
                    !blank && 'border-stage-border bg-stage-soft text-stage-muted hover:bg-stage-raised hover:text-white',
                  )}
                  onClick={() => toggleBlank()}
                  aria-label={blank ? 'Restore the screen' : 'Blank the screen'}
                >
                  <Moon className="size-4" aria-hidden="true" /> {blank ? 'Restore' : 'Blank'}
                </Button>
                <Button
                  variant="outline"
                  className="h-10 gap-1.5 border-stage-border bg-stage-soft text-xs text-stage-muted hover:bg-stage-raised hover:text-white"
                  onClick={() => step(1)}
                  disabled={slides.length === 0 || index >= slides.length - 1}
                  aria-label="Next slide"
                >
                  Next <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-stage-muted/70">
                <Keyboard className="size-3" aria-hidden="true" />
                Arrow keys navigate · B blanks
              </p>
            </div>
          </Card>

          {/* stage sidebar */}
          <div className="space-y-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <ImagePlus className="size-4 text-primary" aria-hidden="true" />
                  <p className="text-sm font-semibold">Slides</p>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {slides.length}/{MAX_SLIDES}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Images shrink to 1280×720 JPEG. Slides stay on this device. Remotes only get a
                  small live preview.
                </p>
                <label className="mt-3 inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
                  {adding ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ImagePlus className="size-4" aria-hidden="true" />
                  )}
                  Upload slides
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={onSlideInput}
                    aria-label="Upload slide images"
                  />
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Moon className="size-4 text-primary" aria-hidden="true" />
                  <p className="text-sm font-semibold">Blank screen</p>
                  <span className="ml-auto">
                    <Switch
                      checked={blank}
                      onCheckedChange={(v) => toggleBlank(v)}
                      aria-label="Blank the presentation screen"
                    />
                  </span>
                </div>
                <Input
                  value={title}
                  onChange={onTitleChange}
                  placeholder="What's on the blank screen"
                  className="mt-3 h-9 text-xs"
                  aria-label="Text to show on the blank screen"
                />
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Blanking hides the slide everywhere and shows this text instead. Handy for
                  taking questions between slides.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" aria-hidden="true" />
                  <p className="text-sm font-semibold">Remotes</p>
                  <span className="ml-auto text-[11px] text-muted-foreground">{remoteCount}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {remoteCount > 0
                    ? `${remoteCount} other device${remoteCount === 1 ? '' : 's'} in the session can drive this deck.`
                    : 'Open Kontivo on your phone, join this session and switch to the remote, which becomes the controller.'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* --------------------------------------------------------- REMOTE */
        <div className="mx-auto w-full max-w-sm space-y-4">
          <Card className="overflow-hidden border-stage-border bg-stage p-0 text-stage-foreground">
            <div className="flex items-center gap-2 border-b border-stage-border bg-stage-soft/60 px-4 py-2.5">
              <p className="text-sm font-semibold">Presentation remote</p>
              <span
                className={cn(
                  'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                  connection.cls,
                )}
                role="status"
                aria-live="polite"
              >
                {connection.icon}
                {connection.text}
              </span>
            </div>

            <div className="space-y-4 p-4">
              {/* live preview */}
              <div className="relative aspect-video overflow-hidden rounded-xl border border-stage-border bg-black">
                {view?.blank ? (
                  <div className="flex size-full items-center justify-center bg-black px-6 text-center">
                    <p className="text-sm text-stage-muted">
                      {remoteTitle || 'Screen is blanked'}
                    </p>
                  </div>
                ) : view?.preview ? (
                  <img
                    src={view.preview}
                    alt="Current slide preview"
                    className="absolute inset-0 size-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2 text-stage-muted/50">
                    <MonitorPlay className="size-8" aria-hidden="true" />
                    <p className="text-center text-xs">
                      {view
                        ? 'The stage has no preview for this slide'
                        : 'Waiting for the stage to broadcast…'}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-stage-raised px-2.5 py-0.5 text-[11px] font-medium text-stage-muted"
                  role="status"
                  aria-live="polite"
                >
                  {remoteChip}
                </span>
                {remoteTitle && !view?.blank && (
                  <span className="min-w-0 truncate pl-2 text-[11px] text-stage-muted/70" title={remoteTitle}>
                    {remoteTitle}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <RemoteButton
                  cmd="prev"
                  flash={flashCmd === 'prev'}
                  onClick={() => sendCmd('prev')}
                  ariaLabel="Previous slide"
                >
                  <ChevronLeft className="size-5" aria-hidden="true" /> Prev
                </RemoteButton>
                <RemoteButton
                  cmd="next"
                  flash={flashCmd === 'next'}
                  onClick={() => sendCmd('next')}
                  ariaLabel="Next slide"
                >
                  Next <ChevronRight className="size-5" aria-hidden="true" />
                </RemoteButton>
              </div>

              <button
                type="button"
                onClick={remoteToggleBlank}
                aria-label={view?.blank ? 'Restore the screen' : 'Blank the screen'}
                className={cn(
                  'flex h-12 w-full select-none items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-[transform,background-color,border-color,box-shadow] active:scale-[0.98]',
                  view?.blank || flashCmd === 'blank' || flashCmd === 'restore'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-stage-raised text-stage-foreground hover:bg-stage-raised',
                )}
              >
                <Moon className="size-4" aria-hidden="true" />
                {view?.blank ? 'Restore screen' : 'Blank screen'}
              </button>

              <p className="text-center text-[11px] leading-relaxed text-stage-muted/70">
                Press Next and the computer advances instantly. Keyboard on the stage works too
                (arrows + B).
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
