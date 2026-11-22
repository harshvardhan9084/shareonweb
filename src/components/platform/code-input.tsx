'use client'

// Segmented session-code entry, in the style of a one-time-password field:
// one character per box, auto-advance on type, backspace walks back, paste
// distributes across boxes (a pasted join link works too). Only the session
// code alphabet is accepted; ambiguous characters (I/L/O/0/1) are dropped,
// mirroring normalizeCode in lib/code.ts.
// Doctrine: DESIGN.md — hairline borders, one signal (focus), no glow.

import { useRef } from 'react'
import { cn } from '@/lib/utils'

const CODE_LENGTH = 6

function sanitizeChar(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .replace(/[OIL01]/g, '')
}

/** Accepts a raw code, "K7T-29Q", or a pasted join link — returns what fits. */
export function extractCode(text: string): string {
  // Old links carry the code as a query param; new links are /CODE paths.
  const param = text.match(/[?&](?:join|s)=([A-Za-z0-9-]+)/)
  const path = text.match(/\/([A-Za-z0-9]{4,8})(?:[?#].*)?\s*$/)
  const source = param ? param[1] : path ? path[1] : text
  let out = ''
  for (const ch of source) {
    const c = sanitizeChar(ch)
    if (c) out += c
    if (out.length === CODE_LENGTH) break
  }
  return out
}

interface CodeInputProps {
  /** Normalized raw code, e.g. "K7T29Q". */
  value: string
  onChange: (raw: string) => void
  /** Fires once when the sixth character lands. */
  onComplete?: (raw: string) => void
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
  className?: string
}

export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  autoFocus = false,
  className,
}: CodeInputProps) {
  const boxes = useRef<Array<HTMLInputElement | null>>([])
  const chars = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? '')
  const completedRef = useRef(false)

  function focusBox(i: number) {
    const box = boxes.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))]
    box?.focus()
    box?.select()
  }

  function write(index: number, text: string) {
    const incoming = extractCode(text)
    if (!incoming) return

    const next = chars.slice()
    let writeAt = index
    for (const ch of incoming) {
      if (writeAt >= CODE_LENGTH) break
      next[writeAt] = ch
      writeAt++
    }
    const raw = next.join('').slice(0, CODE_LENGTH)
    onChange(raw)

    focusBox(writeAt >= CODE_LENGTH ? CODE_LENGTH - 1 : writeAt)

    if (raw.length === CODE_LENGTH) {
      if (completedRef.current) return // one completion per full refill
      completedRef.current = true
      onComplete?.(raw)
    } else {
      completedRef.current = false
    }
  }

  function clearAt(index: number) {
    if (!chars[index]) return
    const next = chars.slice()
    next[index] = ''
    onChange(next.join(''))
    completedRef.current = false
  }

  return (
    <div
      role="group"
      aria-label="Session code, 6 characters"
      className={cn('flex items-center gap-1.5 sm:gap-2', className)}
      onKeyDown={(e) => {
        const box = e.target as HTMLInputElement
        const index = boxes.current.indexOf(box)
        if (index === -1) return
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          focusBox(index - 1)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          focusBox(index + 1)
        } else if (e.key === 'Home') {
          e.preventDefault()
          focusBox(0)
        } else if (e.key === 'End') {
          e.preventDefault()
          focusBox(CODE_LENGTH - 1)
        } else if (e.key === 'Backspace') {
          e.preventDefault()
          if (chars[index]) {
            clearAt(index)
            focusBox(index)
          } else if (index > 0) {
            clearAt(index - 1)
            focusBox(index - 1)
          }
        } else if (e.key === 'Delete') {
          e.preventDefault()
          clearAt(index)
        } else if (e.key === 'Enter' || e.key === ' ') {
          // Space inside an input would type nothing useful; keep Enter native.
          if (e.key === ' ') e.preventDefault()
        }
      }}
    >
      {chars.map((char, i) => (
        <div key={i} className="contents">
          {i === 3 && (
            <span
              aria-hidden="true"
              className="h-px w-2.5 shrink-0 rounded-full bg-muted-foreground/40 sm:w-3"
            />
          )}
          <input
            ref={(el) => {
              boxes.current[i] = el
            }}
            value={char}
            onChange={(e) => write(i, e.target.value)}
            onPaste={(e) => {
              e.preventDefault()
              write(i, e.clipboardData.getData('text'))
            }}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            autoFocus={autoFocus && i === 0}
            inputMode="text"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={2}
            aria-label={`Character ${i + 1} of ${CODE_LENGTH}`}
            className={cn(
              'size-11 rounded-md border bg-card text-center font-mono text-lg font-medium tabular-nums transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
              'sm:size-12 sm:text-xl',
              invalid
                ? 'border-destructive/50 text-destructive'
                : char
                  ? 'border-foreground/30'
                  : 'border-border',
              disabled && 'opacity-50',
            )}
          />
        </div>
      ))}
    </div>
  )
}
