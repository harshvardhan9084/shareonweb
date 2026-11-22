'use client'

// One-click session start: create it, remember it, go straight into it.
// Used by the Discover hero, the header menu, app landing pages and the
// ended-session screen — every "do it" surface shares this one path.

import { createSession } from '@/lib/api'
import { defaultVariantId, getApp } from '@/lib/registry'
import { usePlatform } from '@/lib/store'
import { toast } from 'sonner'

/**
 * One-click session start. Accepts either a tool id ('beam') or a variant id
 * ('drop'): tools with modes start their default mode; explicit variants win.
 */
export async function quickStart(appOrVariantId: string): Promise<boolean> {
  try {
    const app = getApp(appOrVariantId)
    const appId =
      app && !app.variants?.some((v) => v.id === appOrVariantId)
        ? defaultVariantId(app)
        : appOrVariantId
    const session = await createSession(appId)
    const store = usePlatform.getState()
    store.setActiveSession(session)
    store.addRecent({
      code: session.code,
      appId: session.appId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      title: session.title,
    })
    store.navigate({ name: 'session', code: session.code })
    return true
  } catch (err) {
    toast.error(
      err instanceof Error ? err.message : 'Could not start the session, please try again.',
    )
    // Fall back to the tool page, where starting is still one click away.
    usePlatform.getState().openApp(appOrVariantId)
    return false
  }
}
