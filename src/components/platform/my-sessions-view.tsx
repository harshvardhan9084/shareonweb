'use client'

import { useEffect, useState } from 'react'
import { usePlatform } from '@/lib/store'
import { getApp } from '@/lib/registry'
import { fetchSession, closeSession } from '@/lib/api'
import { formatCode } from '@/lib/code'
import { cn, humanError } from '@/lib/utils'
import { AppIcon } from '@/components/platform/app-icon'
import { Button } from '@/components/ui/button'
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
import { differenceInHours, differenceInMinutes, format, isPast } from 'date-fns'
import {
  Link2,
  Loader2,
  Plus,
  Trash2,
  Copy,
  CircleCheck,
} from 'lucide-react'

export function MySessionsView() {
  const recent = usePlatform((s) => s.recent)
  const removeRecent = usePlatform((s) => s.removeRecent)
  const clearRecent = usePlatform((s) => s.clearRecent)
  const navigate = usePlatform((s) => s.navigate)
  const setActiveSession = usePlatform((s) => s.setActiveSession)
  const addRecent = usePlatform((s) => s.addRecent)

  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    // Re-sync from localStorage in case the store was not hydrated yet.
    usePlatform.getState().loadRecent()
  }, [])

  async function rejoin(code: string) {
    setBusyCode(code)
    try {
      const session = await fetchSession(code)
      setActiveSession(session)
      addRecent({
        code: session.code,
        appId: session.appId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        title: session.title,
      })
      navigate({ name: 'session', code: session.code })
    } catch (err) {
      toast.error(humanError(err, 'Could not rejoin.'))
    } finally {
      setBusyCode(null)
    }
  }

  async function copyLink(code: string) {
    const url = `${window.location.origin}/?join=${code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(code)
      toast.success('Link copied, open it on any device.')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Could not copy, your browser blocked clipboard access.')
    }
  }

  if (recent.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
        <h1 className="font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl">No sessions yet</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Sessions you start or join are listed here on this device only. Nothing about you is
          kept on our side.
        </p>
        <Button className="mt-6" onClick={() => navigate({ name: 'home' })}>
          <Plus className="size-4" aria-hidden="true" /> Find a tool
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">My Sessions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent and joined sessions on this device. Each one expires 24 hours after it started.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Trash2 className="size-4" aria-hidden="true" /> Clear list
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear the session list?</AlertDialogTitle>
              <AlertDialogDescription>
                This only removes the shortcuts on this device. Live sessions keep running until
                they end or expire.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={clearRecent}>Clear</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <ul className="mt-6 divide-y border-y">
        {recent.map((r) => {
          const app = getApp(r.appId)
          const expired = isPast(new Date(r.expiresAt))
          const minsLeft = differenceInMinutes(new Date(r.expiresAt), new Date())
          const expiresLabel = expired
            ? 'Expired'
            : minsLeft < 60
              ? `Expires in ${minsLeft} min`
              : `Expires in ${differenceInHours(new Date(r.expiresAt), new Date())} h`

          return (
            <li key={r.code} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {r.title ? (
                    <span className="max-w-full truncate" title={r.title}>{r.title}</span>
                  ) : (
                    <>{app?.name ?? r.appId}</>
                  )}
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {formatCode(r.code)}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-normal',
                      expired ? 'text-warning-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {expiresLabel}
                  </span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {r.title ? (
                    <>
                      <AppIcon name={app?.icon ?? 'zap'} className="size-3" aria-hidden="true" />
                      <span>{app?.name ?? r.appId}</span>
                      <span>·</span>
                    </>
                  ) : null}
                  <span>Started {format(new Date(r.createdAt), "MMM d, h:mm a")}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => rejoin(r.code)}
                  disabled={busyCode === r.code}
                  className="h-9"
                >
                  {busyCode === r.code ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    expired ? 'Check' : 'Rejoin'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label="Copy join link"
                  onClick={() => copyLink(r.code)}
                >
                  {copied === r.code ? (
                    <CircleCheck className="size-4 text-primary" aria-hidden="true" />
                  ) : (
                    <Link2 className="size-4" aria-hidden="true" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${formatCode(r.code)} from the list`}
                  onClick={() => removeRecent(r.code)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Copy className="size-3.5" aria-hidden="true" />
        Tip: the Rejoin button checks whether the session is still live before entering.
      </p>
    </div>
  )
}
