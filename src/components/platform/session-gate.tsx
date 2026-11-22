'use client'

// The calm waiting room shown while a session opens: while the session
// runtime chunk loads, while the URL hydrates a ?s= link, or while the relay
// handshake has not delivered the first snapshot yet. Replaces the old bare
// spinner with honest staged status lines, the tool's identity and the code
// being dialed. Doctrine: DESIGN.md — one signal, neutral colors, no glow.

import { useEffect, useState } from 'react'
import { AppIcon, BrandMark } from '@/components/platform/app-icon'
import { getApp } from '@/lib/registry'
import { formatCode } from '@/lib/code'
import { cn } from '@/lib/utils'

const STAGES = [
  'Reaching the relay…',
  'Opening the session…',
  'Getting the tool ready…',
]

interface SessionGateProps {
  /** Tool the session belongs to (when known) — shows its glyph and name. */
  appId?: string
  /** Raw session code being opened (when known) — shown in mono. */
  code?: string
  /** Fixed status line (used while the session runtime chunk is loading). */
  label?: string
  /** Compact variant inside the session view; default is a tall, centered scene. */
  compact?: boolean
}

export function SessionGate({ appId, code, label, compact = false }: SessionGateProps) {
  const app = appId ? getApp(appId) : undefined
  const [stage, setStage] = useState(0)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (label) return
    const t1 = setTimeout(() => setStage(1), 1400)
    const t2 = setTimeout(() => setStage(2), 2800)
    const t3 = setTimeout(() => setSlow(true), 8000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [label])

  const text = label ?? STAGES[Math.min(stage, STAGES.length - 1)]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-12' : 'py-24 sm:py-32',
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="relative flex size-16 items-center justify-center rounded-2xl border bg-card">
        {/* the one live signal: a quiet ring breathing around the tile */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl border border-primary/40 animate-pulse motion-reduce:animate-none"
        />
        {app ? (
          <AppIcon name={app.icon} className="size-7 text-primary" aria-hidden="true" />
        ) : (
          <BrandMark className="size-7" variant="color" />
        )}
      </div>

      {app && !compact && (
        <p className="mt-4 font-display text-base font-semibold tracking-[-0.01em]">
          {app.name}
        </p>
      )}
      {code && (
        <p className="mt-4 font-mono text-lg tracking-[0.3em] tabular-nums" translate="no">
          {formatCode(code)}
        </p>
      )}

      <p
        key={text}
        className="mt-3 min-h-5 animate-in fade-in slide-in-from-bottom-1 duration-300 text-sm text-muted-foreground motion-reduce:animate-none"
      >
        {text}
      </p>
      {slow && (
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground/80">
          Some networks hold on for a moment; this almost always finishes on its own.
        </p>
      )}
    </div>
  )
}
