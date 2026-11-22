'use client'

// Join a session two ways: type the code (segmented, Telegram-style boxes,
// auto-joins when the sixth character lands) or scan the host's QR with the
// camera. Doctrine: DESIGN.md at the repo root.

import { useEffect, useState } from 'react'
import { usePlatform, loadProfileName, saveProfileName, detectDeviceType } from '@/lib/store'
import { fetchSession } from '@/lib/api'
import { normalizeCode } from '@/lib/code'
import type { SessionInfo } from '@/lib/types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CodeInput } from '@/components/platform/code-input'
import { QrScanner } from '@/components/platform/qr-scan'
import { Loader2, CircleAlert, Smartphone, Monitor, Tablet, Keyboard, QrCode } from 'lucide-react'
import { cn } from '@/lib/utils'

type JoinMode = 'code' | 'scan'

export function JoinDialog() {
  const open = usePlatform((s) => s.joinOpen)
  const prefill = usePlatform((s) => s.joinPrefill)
  const scanIntent = usePlatform((s) => s.joinScan)
  const setJoinOpen = usePlatform((s) => s.setJoinOpen)
  const setActiveSession = usePlatform((s) => s.setActiveSession)
  const addRecent = usePlatform((s) => s.addRecent)
  const navigate = usePlatform((s) => s.navigate)

  const [mode, setMode] = useState<JoinMode>('code')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [device, setDevice] = useState<'phone' | 'tablet' | 'desktop'>('desktop')

  useEffect(() => {
    if (open) {
      setMode(scanIntent ? 'scan' : 'code')
      setCode(prefill ? normalizeCode(prefill) : '')
      setError(null)
      setJoining(false)
      setName(loadProfileName())
      setDevice(detectDeviceType())
    }
  }, [open, prefill, scanIntent])

  async function join(raw?: string) {
    const normalized = normalizeCode(raw ?? code)
    if (normalized.length !== 6) {
      setError('Enter the 6-character code your host shared; it looks like K7T-29Q.')
      return
    }
    setJoining(true)
    setError(null)
    try {
      const session: SessionInfo = await fetchSession(normalized)
      saveProfileName(name.trim())
      setActiveSession(session)
      addRecent({
        code: session.code,
        appId: session.appId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        title: session.title,
      })
      setJoinOpen(false)
      navigate({ name: 'session', code: session.code })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join, please try again.')
    } finally {
      setJoining(false)
    }
  }

  // A scanned code goes straight into the session. If it turns out to be
  // stale or foreign, the error lands on the code view with the value
  // prefilled so one character can be fixed by hand.
  function onScan(scanned: string) {
    setMode('code')
    setCode(scanned)
    void join(scanned)
  }

  const DeviceIcon = device === 'phone' ? Smartphone : device === 'tablet' ? Tablet : Monitor

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setJoinOpen(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join a session</DialogTitle>
          <DialogDescription>
            Type the code shared with you, or scan the host&apos;s QR code with your camera.
          </DialogDescription>
        </DialogHeader>

        {/* quiet segmented control between the two ways in */}
        <div
          role="group"
          aria-label="How to join"
          className="grid grid-cols-2 gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
        >
          {(
            [
              { id: 'code', label: 'Type code', Icon: Keyboard },
              { id: 'scan', label: 'Scan QR', Icon: QrCode },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              aria-pressed={mode === tab.id}
              onClick={() => {
                setMode(tab.id)
                setError(null)
              }}
              className={cn(
                'flex h-9 items-center justify-center gap-1.5 rounded-md text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none',
                mode === tab.id
                  ? 'bg-card font-medium text-foreground shadow-none border border-border'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        {mode === 'code' ? (
          <div className="space-y-4">
            <CodeInput
              value={code}
              onChange={(raw) => {
                setCode(raw)
                setError(null)
              }}
              onComplete={(raw) => void join(raw)}
              invalid={Boolean(error)}
              disabled={joining}
            />

            <div className="space-y-1.5">
              <Label htmlFor="join-name">Your name (optional)</Label>
              <Input
                id="join-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 24))}
                placeholder="Guest"
                className="h-11"
                onKeyDown={(e) => e.key === 'Enter' && !joining && join()}
              />
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DeviceIcon className="size-3.5" aria-hidden="true" />
              Joining as {device === 'phone' ? 'a phone' : device === 'tablet' ? 'a tablet' : 'a computer'}.
              Others in the session will see this.
            </p>

            {error && (
              <p
                id="join-error"
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            <Button size="lg" className="h-12 w-full text-base" onClick={() => void join()} disabled={joining}>
              {joining ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Joining…
                </>
              ) : (
                'Join session'
              )}
            </Button>
          </div>
        ) : (
          <QrScanner onCode={onScan} />
        )}
      </DialogContent>
    </Dialog>
  )
}
