'use client'

// Slim, dismissible install banner surfaced on Discover. Offers the native
// install prompt (Chromium/Android) or one-step guidance (iOS Safari).

import { toast } from 'sonner'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { BrandMark } from '@/components/platform/app-icon'
import { Button } from '@/components/ui/button'
import { X, Download, Share, PlusSquare } from 'lucide-react'

export function InstallBanner() {
  const { bannerVisible, canInstall, dismiss, promptInstall } = usePwaInstall()
  if (!bannerVisible) return null

  async function onInstall() {
    const outcome = await promptInstall()
    if (outcome === 'accepted') toast.success('Kontivo was installed. Find it on your home screen.')
    // 'dismissed' and 'unavailable' keep the banner; no nagging either way.
  }

  return (
    <section
      aria-label="Install Kontivo"
      className="relative mx-auto mt-8 max-w-3xl animate-in fade-in duration-500"
    >
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3.5 sm:gap-4 sm:p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <BrandMark className="size-5" variant="mono" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install Kontivo</p>
          {canInstall ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Add it to your home screen. One tap to send files, share text and draw together.
            </p>
          ) : (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed text-muted-foreground">
              In Safari, tap <Share className="inline size-3.5 shrink-0 text-foreground" aria-label="Share" />{' '}
              Share, then <PlusSquare className="inline size-3.5 shrink-0 text-foreground" aria-label="Add to Home Screen" />{' '}
              <span className="font-medium text-foreground">Add to Home Screen</span>.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {canInstall && (
            <Button size="sm" className="h-9 gap-1.5" onClick={() => void onInstall()}>
              <Download className="size-4" aria-hidden="true" /> Install
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss install suggestion"
            onClick={dismiss}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  )
}
