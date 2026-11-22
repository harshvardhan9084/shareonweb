'use client'

// Collaborative whiteboard. Strokes sync live: while drawing, point batches
// are emitted every ~40ms; the relay appends them and mirrors to others.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoomClient } from '@/lib/room-client'
import { uid } from '@/components/platform/session-view'
import type { Stroke } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Download, Eraser, Undo2, Trash2, Pencil } from 'lucide-react'
import { cn, humanError } from '@/lib/utils'

const COLORS = ['#18181b', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0ea5e9']
const CANVAS_BG = '#ffffff'
const EMIT_INTERVAL_MS = 40

interface CanvasPanelProps {
  client: RoomClient | null
  initialStrokes: Stroke[]
  connected: boolean
}

export function CanvasPanel({ client, initialStrokes, connected }: CanvasPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const currentRef = useRef<Stroke | null>(null)
  const pendingRef = useRef<number[][]>([])
  const lastEmitRef = useRef(0)
  const mySocketIdsRef = useRef<Set<string>>(new Set())

  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(4)
  const [erase, setErase] = useState(false)
  const [strokeCount, setStrokeCount] = useState(0)
  const colorRef = useRef(color)
  const sizeRef = useRef(size)
  const eraseRef = useRef(erase)
  // Keep the pointer handlers in sync without re-subscribing anything.
  useEffect(() => {
    colorRef.current = color
    sizeRef.current = size
    eraseRef.current = erase
  }, [color, size, erase])

  // ------------------------------------------------------------- rendering
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width / (window.devicePixelRatio || 1)
    const h = canvas.height / (window.devicePixelRatio || 1)
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0)
    ctx.fillStyle = CANVAS_BG
    ctx.fillRect(0, 0, w, h)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue
      ctx.strokeStyle = stroke.mode === 'erase' ? CANVAS_BG : stroke.color
      ctx.lineWidth = stroke.size * (stroke.mode === 'erase' ? 4 : 1)
      ctx.beginPath()
      const [x0, y0] = stroke.points[0]
      ctx.moveTo(x0 * w, y0 * h)
      if (stroke.points.length === 1) {
        ctx.lineTo(x0 * w + 0.01, y0 * h + 0.01)
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          const [x, y] = stroke.points[i]
          ctx.lineTo(x * w, y * h)
        }
      }
      ctx.stroke()
    }
  }, [])

  // Canvas sizing (DPR aware) + initial strokes.
  useEffect(() => {
    strokesRef.current = [...initialStrokes]
    setStrokeCount(strokesRef.current.length)
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = wrap.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.width * 0.62 * dpr)
      canvas.style.height = `${Math.round(rect.width * 0.62)}px`
      redraw()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // Remote strokes from the relay.
  useEffect(() => {
    if (!client) return
    const off1 = client.on('drawsegment', (payload) => {
      const seg = payload as Stroke
      const stroke = strokesRef.current.find((s) => s.strokeId === seg.strokeId)
      if (stroke) {
        stroke.points.push(...seg.points)
      } else {
        strokesRef.current.push({ ...seg, points: [...seg.points] })
        setStrokeCount(strokesRef.current.length)
      }
      redraw()
    })
    const off2 = client.on('drawundo', (payload) => {
      const { strokeId } = payload as { strokeId: string }
      strokesRef.current = strokesRef.current.filter((s) => s.strokeId !== strokeId)
      setStrokeCount(strokesRef.current.length)
      redraw()
    })
    const off3 = client.on('drawcleared', () => {
      strokesRef.current = []
      setStrokeCount(0)
      redraw()
    })
    return () => {
      off1()
      off2()
      off3()
    }
  }, [client, redraw])

  // -------------------------------------------------------------- drawing
  function normPoint(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    return [x, y]
  }

  function drawIncremental(from: number[], to: number[], stroke: Stroke) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = stroke.mode === 'erase' ? CANVAS_BG : stroke.color
    ctx.lineWidth = stroke.size * (stroke.mode === 'erase' ? 4 : 1)
    ctx.beginPath()
    ctx.moveTo(from[0] * w, from[1] * h)
    ctx.lineTo(to[0] * w, to[1] * h)
    ctx.stroke()
  }

  function flushPending() {
    const current = currentRef.current
    if (!current || !client || pendingRef.current.length === 0) return
    const points = pendingRef.current
    pendingRef.current = []
    client.sendDrawSegment({ strokeId: current.strokeId, ownerId: '', color: current.color, size: current.size, mode: current.mode, points })
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // setPointerCapture can throw for synthetic/test pointers — drawing must
    // never depend on it succeeding.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore — pointermove events still fire while the pointer is over us
    }
    const p = normPoint(e)
    const stroke: Stroke = {
      strokeId: uid(),
      ownerId: 'me',
      color: colorRef.current,
      size: sizeRef.current,
      mode: eraseRef.current ? 'erase' : 'draw',
      points: [p],
    }
    currentRef.current = stroke
    strokesRef.current.push(stroke)
    pendingRef.current = [p]
    setStrokeCount(strokesRef.current.length)
    drawIncremental([p[0] - 0.001, p[1] - 0.001], p, stroke)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const current = currentRef.current
    if (!current) return
    const p = normPoint(e)
    const last = current.points[current.points.length - 1]
    if (Math.abs(last[0] - p[0]) < 0.0015 && Math.abs(last[1] - p[1]) < 0.0015) return
    current.points.push(p)
    pendingRef.current.push(p)
    drawIncremental(last, p, current)
    const now = performance.now()
    if (now - lastEmitRef.current > EMIT_INTERVAL_MS) {
      lastEmitRef.current = now
      flushPending()
    }
  }

  function onPointerUp() {
    if (!currentRef.current) return
    flushPending()
    currentRef.current = null
  }

  // -------------------------------------------------------------- actions
  async function undo() {
    if (!client) return
    for (let i = strokesRef.current.length - 1; i >= 0; i--) {
      const s = strokesRef.current[i]
      if (s.ownerId === 'me') {
        try {
          const removed = await client.undoStroke(s.strokeId)
          strokesRef.current = strokesRef.current.filter((x) => x.strokeId !== s.strokeId)
          setStrokeCount(strokesRef.current.length)
          redraw()
          if (!removed) {
            // Server could not remove it (e.g. reconnect changed our id) —
            // stay consistent locally anyway; others may still see it.
          }
        } catch {
          toast.error('Could not undo, check the connection.')
        }
        return
      }
    }
  }

  async function clearAll() {
    if (!client) return
    try {
      await client.clearDrawing()
      strokesRef.current = []
      setStrokeCount(0)
      redraw()
      toast.success('Board cleared for everyone.')
    } catch (err) {
      toast.error(humanError(err, 'Could not clear the board.'))
    }
  }

  function exportPng() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shareonweb-canvas-${Date.now()}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }, 'image/png')
  }

  return (
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-xl border bg-card p-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-lg border',
              erase ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
            )}
            aria-hidden="true"
          >
            {erase ? <Eraser className="size-4" /> : <Pencil className="size-4" />}
          </span>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Brush color">
            {COLORS.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={color === c && !erase}
                aria-label={`Color ${c}`}
                disabled={erase}
                onClick={() => setColor(c)}
                className={cn(
                  'size-8 rounded-full border transition-transform focus-visible:outline-2 focus-visible:outline-ring',
                  color === c && !erase ? 'scale-110 border-foreground/60 ring-2 ring-ring' : 'hover:scale-105',
                  erase && 'opacity-40',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <Toggle
            pressed={erase}
            onPressedChange={setErase}
            aria-label="Toggle eraser"
            className="size-9 gap-0"
          >
            <Eraser className="size-4" />
          </Toggle>
        </div>

        <div className="flex min-w-40 items-center gap-2.5">
          <span className="text-xs text-muted-foreground">Size</span>
          <Slider
            value={[size]}
            min={2}
            max={24}
            step={1}
            onValueChange={(v) => setSize(v[0] ?? 4)}
            className="w-28"
            aria-label="Brush size"
          />
          <span className="w-6 text-center font-mono text-xs">{size}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={undo} disabled={!connected}>
            <Undo2 className="size-4" aria-hidden="true" /> Undo
          </Button>
          <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={exportPng}>
            <Download className="size-4" aria-hidden="true" /> PNG
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-destructive hover:text-destructive"
                disabled={strokeCount === 0}
              >
                <Trash2 className="size-4" aria-hidden="true" /> Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear the board for everyone?</AlertDialogTitle>
                <AlertDialogDescription>
                  All strokes disappear on every device in this session. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearAll}>Clear board</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* board */}
      <div ref={wrapRef} className="overflow-hidden rounded-xl border shadow-sm">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair touch-none bg-white"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          aria-label="Shared whiteboard. Draw with mouse, touch or stylus."
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Every stroke appears live on all devices in the session. Works with finger, stylus, trackpad or mouse.
      </p>
    </div>
  )
}
