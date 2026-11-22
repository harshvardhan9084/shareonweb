'use client'

// MiniMap — a dependency-free slippy map for Live Location.
//
// Renders OpenStreetMap raster tiles (© OpenStreetMap contributors) on a
// Web-Mercator grid with plain DOM: drag to pan, wheel / pinch / buttons to
// zoom, and one marker per live fix (self = green pulse, others = teal dot)
// with an accuracy circle scaled by the Mercator ground resolution.
//
// Why hand-rolled instead of Leaflet: the platform adds no runtime
// dependencies for a single surface, and the interaction set we need is
// small. Tile host is one const (TILE_URL) so a self-hosted / fallback
// provider can be swapped without touching the projection math.
//
// Behavior contracts:
//   - Auto-fit keeps every fix in view until the user pans/zooms manually
//     ("Fit all" restores the following mode).
//   - Offline the tiles simply fail to load and fade out; markers, labels
//     and accuracy circles still render on the token-tinted canvas, so the
//     relative picture survives without a basemap.
//   - The component never caches tiles (SW passes external traffic through).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

// ------------------------------------------------------------------ consts

const TILE = 256
const MIN_ZOOM = 2
const MAX_ZOOM = 19
const FIT_PAD = 56
const EARTH_R = 6_371_000

const TILE_URL = 'https://tile.openstreetmap.org'

// ------------------------------------------------------------ mercator math

function worldX(lng: number, z: number): number {
  return ((lng + 180) / 360) * TILE * 2 ** z
}

function worldY(lat: number, z: number): number {
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z
}

function lngAtX(x: number, z: number): number {
  return (x / (TILE * 2 ** z)) * 360 - 180
}

function latAtY(y: number, z: number): number {
  const n = Math.PI * (1 - (2 * y) / (TILE * 2 ** z))
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

/** Screen pixels per ground meter at a latitude — used for accuracy circles. */
function pxPerMeter(lat: number, z: number): number {
  const mPerPx = (2 * Math.PI * EARTH_R * Math.cos((lat * Math.PI) / 180)) / (TILE * 2 ** z)
  return mPerPx > 0 ? 1 / mPerPx : 0
}

// -------------------------------------------------------------------- types

export interface MapPoint {
  id: string
  name: string
  lat: number
  lng: number
  acc: number | null
  isSelf: boolean
}

interface View {
  lat: number
  lng: number
  zoom: number
}

interface Size {
  w: number
  h: number
}

function clampView(v: View): View {
  return {
    lat: Math.max(-85, Math.min(85, v.lat)),
    lng: v.lng,
    zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(v.zoom))),
  }
}

/** Largest integer zoom in which all points fit the viewport with padding. */
function fitAll(points: MapPoint[], size: Size): View {
  if (points.length === 1) {
    return { lat: points[0].lat, lng: points[0].lng, zoom: 16 }
  }
  const minLat = Math.min(...points.map((p) => p.lat))
  const maxLat = Math.max(...points.map((p) => p.lat))
  const minLng = Math.min(...points.map((p) => p.lng))
  const maxLng = Math.max(...points.map((p) => p.lng))

  let zoom = MIN_ZOOM
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const w = Math.abs(worldX(maxLng, z) - worldX(minLng, z))
    const h = Math.abs(worldY(minLat, z) - worldY(maxLat, z))
    if (w <= Math.max(0, size.w - 2 * FIT_PAD) && h <= Math.max(0, size.h - 2 * FIT_PAD)) {
      zoom = z
      break
    }
    if (z === MIN_ZOOM) zoom = MIN_ZOOM
  }
  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
    zoom,
  }
}

// --------------------------------------------------------------- component

export function MiniMap({ points, className }: { points: MapPoint[]; className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [view, setView] = useState<View>({ lat: 20, lng: 0, zoom: 2 })
  const [size, setSize] = useState<Size>({ w: 0, h: 0 })
  const [autoFit, setAutoFit] = useState(true)

  const viewRef = useRef(view)
  const sizeRef = useRef(size)
  const autoFitRef = useRef(autoFit)
  // Ref mirrors are written in an effect, not during render — handlers read
  // the last committed view without re-rendering the map.
  useEffect(() => {
    viewRef.current = view
    sizeRef.current = size
    autoFitRef.current = autoFit
  })

  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const dragRef = useRef<{ x: number; y: number; cx: number; cy: number; z: number } | null>(null)
  const pinchRef = useRef<number | null>(null)
  const wheelAccRef = useRef({ delta: 0, at: 0 })

  // ------------------------------------------------------------ observe size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ----------------------------------------------------------------- auto-fit
  useEffect(() => {
    if (!autoFit || points.length === 0 || size.w < 60) return
    const next = fitAll(points, size)
    const cur = viewRef.current
    if (
      Math.abs(cur.lat - next.lat) > 1e-9 ||
      Math.abs(cur.lng - next.lng) > 1e-9 ||
      cur.zoom !== next.zoom
    ) {
      // Deferred so a state update never cascades synchronously from the
      // effect body; the ref guard drops it if the user grabbed the map
      // during the tick (manual pan/zoom wins over auto-follow).
      queueMicrotask(() => {
        if (!autoFitRef.current) return
        setView(next)
      })
    }
  }, [autoFit, points, size])

  // ---------------------------------------------------------- anchored zoom
  const zoomAt = useCallback((delta: number, ax: number, ay: number) => {
    const { lat, lng, zoom } = viewRef.current
    const { w, h } = sizeRef.current
    const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta))
    if (nz === zoom) return
    // Geographic point currently under the anchor…
    const geoLng = lngAtX(worldX(lng, zoom) + (ax - w / 2), zoom)
    const geoLat = latAtY(worldY(lat, zoom) + (ay - h / 2), zoom)
    // …re-centred so it stays under the anchor at the new zoom.
    const newCx = worldX(geoLng, nz) - (ax - w / 2)
    const newCy = worldY(geoLat, nz) - (ay - h / 2)
    setAutoFit(false)
    setView(clampView({ lat: latAtY(newCy, nz), lng: lngAtX(newCx, nz), zoom: nz }))
  }, [])

  // ------------------------------------------------- wheel zoom (non-passive)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const now = performance.now()
      const acc = wheelAccRef.current
      if (now - acc.at > 250) acc.delta = 0
      acc.at = now
      acc.delta += e.deltaY
      if (Math.abs(acc.delta) < 90) return
      const dir = acc.delta < 0 ? 1 : -1
      acc.delta = 0
      zoomAt(dir, e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // ------------------------------------------------------------ drag / pinch
  const reseedDrag = useCallback(() => {
    const pts = [...pointersRef.current.values()]
    const { lat, lng, zoom } = viewRef.current
    if (pts.length === 1) {
      dragRef.current = {
        x: pts[0].x,
        y: pts[0].y,
        cx: worldX(lng, zoom),
        cy: worldY(lat, zoom),
        z: zoom,
      }
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Controls (zoom/fit buttons) and the attribution link live inside the
    // map; capturing their pointer would re-route pointerup to the container
    // and the composed click would never reach them. Let them be.
    const target = e.target as HTMLElement | null
    if (target?.closest('button, a')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = e.currentTarget
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    el.setPointerCapture(e.pointerId)
    if (pointersRef.current.size === 1) {
      reseedDrag()
      pinchRef.current = null
    } else if (pointersRef.current.size === 2) {
      dragRef.current = null
      const pts = [...pointersRef.current.values()]
      pinchRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size >= 2 && pinchRef.current != null) {
      const pts = [...pointersRef.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const rect = e.currentTarget.getBoundingClientRect()
      const midX = (pts[0].x + pts[1].x) / 2 - rect.left
      const midY = (pts[0].y + pts[1].y) / 2 - rect.top
      if (dist / pinchRef.current >= 1.12) {
        pinchRef.current = dist
        zoomAt(1, midX, midY)
      } else if (dist / pinchRef.current <= 0.89) {
        pinchRef.current = dist
        zoomAt(-1, midX, midY)
      }
      return
    }

    const drag = dragRef.current
    if (!drag || pointersRef.current.size !== 1) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (Math.abs(dx) + Math.abs(dy) > 3) setAutoFit(false)
    const { w, h } = sizeRef.current
    const cx = drag.cx - dx
    const cy = drag.cy - dy
    setView(clampView({ lat: latAtY(cy, drag.z), lng: lngAtX(cx, drag.z), zoom: drag.z }))
  }

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // pointer already released — nothing to do
    }
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) dragRef.current = null
    else reseedDrag()
  }

  // ------------------------------------------------------------- tile grid
  const tiles = useMemo(() => {
    const { w, h } = size
    if (w < 60 || h < 60) return []
    const { lat, lng, zoom: z } = view
    const n = 2 ** z
    const tx = worldX(lng, z) - w / 2
    const ty = worldY(lat, z) - h / 2
    const x0 = Math.floor(tx / TILE) - 1
    const x1 = Math.floor((tx + w) / TILE) + 1
    const y0 = Math.max(0, Math.floor(ty / TILE) - 1)
    const y1 = Math.min(n - 1, Math.floor((ty + h) / TILE) + 1)
    const out: { key: string; src: string; left: number; top: number }[] = []
    for (let x = x0; x <= x1; x++) {
      const wx = ((x % n) + n) % n
      for (let y = y0; y <= y1; y++) {
        out.push({
          key: `${z}/${x}/${y}`,
          src: `${TILE_URL}/${z}/${wx}/${y}.png`,
          left: x * TILE - tx,
          top: y * TILE - ty,
        })
      }
    }
    return out
  }, [size, view])

  // ------------------------------------------------------------ marker math
  const z = view.zoom
  const tx = worldX(view.lng, z) - size.w / 2
  const ty = worldY(view.lat, z) - size.h / 2

  return (
    <div
      ref={containerRef}
      data-testid="mini-map"
      role="application"
      aria-label="Live map of shared positions"
      className={cn(
        'relative touch-none select-none overflow-hidden rounded-xl border bg-stage-soft',
        'cursor-grab active:cursor-grabbing',
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      {/* tiles */}
      {tiles.map((t) => (
        <img
          key={t.key}
          data-map-tile=""
          src={t.src}
          alt=""
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden'
          }}
          className="pointer-events-none absolute z-0 size-64 max-w-none"
          style={{ left: t.left, top: t.top }}
        />
      ))}

      {/* markers */}
      {points.map((p) => {
        const left = worldX(p.lng, z) - tx
        const top = worldY(p.lat, z) - ty
        const circlePx =
          p.acc != null && p.acc > 0 ? Math.min(800, p.acc * 2 * pxPerMeter(p.lat, z)) : 0
        return (
          <div
            key={p.id}
            data-map-marker={p.name}
            data-map-self={p.isSelf ? '1' : '0'}
            className="absolute z-20"
            style={{ left, top }}
          >
            <div className="relative -translate-x-1/2 -translate-y-1/2">
              {circlePx >= 24 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2',
                    p.isSelf ? 'border-positive/50 bg-positive/15' : 'border-primary/40 bg-primary/10',
                  )}
                  style={{ width: circlePx, height: circlePx }}
                />
              )}
              {p.isSelf ? (
                <span className="relative flex size-4">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-60" />
                  <span className="relative inline-flex size-4 rounded-full border-2 border-background bg-positive shadow-sm" />
                </span>
              ) : (
                <span className="relative block size-4 rounded-full border-2 border-background bg-primary shadow-sm" />
              )}
              <span
                className={cn(
                  'absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border bg-background/90 px-1.5 py-0.5 text-[10px] font-medium',
                  p.isSelf ? 'text-positive' : 'text-foreground',
                )}
              >
                {p.isSelf ? 'You' : p.name || 'Guest'}
              </span>
            </div>
          </div>
        )
      })}

      {/* controls */}
      <div className="absolute right-2 top-2 z-30 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={(e) => {
            const rect = containerRef.current?.getBoundingClientRect()
            zoomAt(1, rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0)
            e.currentTarget.blur()
          }}
          className="flex size-8 items-center justify-center rounded-lg border bg-background/95 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={(e) => {
            const rect = containerRef.current?.getBoundingClientRect()
            zoomAt(-1, rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0)
            e.currentTarget.blur()
          }}
          className="flex size-8 items-center justify-center rounded-lg border bg-background/95 text-foreground transition-colors hover:bg-muted"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        {!autoFit && points.length > 0 && (
          <button
            type="button"
            aria-label="Fit all positions"
            onClick={(e) => {
              setAutoFit(true)
              e.currentTarget.blur()
            }}
            className="flex size-8 items-center justify-center rounded-lg border bg-background/95 text-foreground transition-colors hover:bg-muted"
          >
            <LocateFixed className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* attribution — required by the OSM tile licence */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-1 right-1 z-30 rounded bg-background/85 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground hover:text-foreground"
      >
        © OpenStreetMap
      </a>
    </div>
  )
}
