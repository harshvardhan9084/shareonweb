'use client'

// Tracks the browser's PWA install affordance (beforeinstallprompt) and whether
// the app is already running as an installed PWA (standalone display mode).
// Honest rule: the install suggestion is only shown where an install is
// actually possible — a real one-tap prompt (Chromium/Android) or the known
// two-tap path on iOS Safari. Everywhere else it stays out of the way.
// Dismissal stores a 3-day cooldown so the banner does not nag.

import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_UNTIL_KEY = 'sow.pwa.dismissedUntil'
const LEGACY_DISMISS_KEY = 'sow.pwa.dismissed'
const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000 // re-offer after 3 days

function dismissedRecently(): boolean {
  try {
    const until = window.localStorage.getItem(DISMISS_UNTIL_KEY)
    if (until) return Date.now() < Number(until)
    return window.localStorage.getItem(LEGACY_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function usePwaInstall() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // Read the environment after the effect settles (avoids cascading renders
    // and keeps the first client render identical to the server output).
    queueMicrotask(() => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
      setInstalled(standalone)
      setDismissed(dismissedRecently())

      const ua = window.navigator.userAgent
      setIsIos(/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document))
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + DISMISS_COOLDOWN_MS))
      window.localStorage.removeItem(LEGACY_DISMISS_KEY)
    } catch {
      // ignore
    }
    setDismissed(true)
  }, [])

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!installEvent) return 'unavailable'
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') setInstallEvent(null)
    return outcome
  }, [installEvent])

  const canInstall = installEvent != null && !installed

  return {
    canInstall,
    installed,
    isIos,
    // Shown only when this device has a real way to install: the native
    // prompt, or the iOS Add-to-Home-Screen path. Never a vague fallback.
    bannerVisible: (canInstall || isIos) && !installed && !dismissed,
    dismiss,
    promptInstall,
  }
}
