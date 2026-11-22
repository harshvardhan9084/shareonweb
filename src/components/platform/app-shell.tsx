'use client'

// The application shell: view switching, URL sync, code-split heavy views.
// Rendered by the server page component; when the URL points at a tool
// (?app=…), the tool's landing view takes part in the server HTML so search
// engines and answer engines see the real, action-first content of every tool.
// Doctrine: DESIGN.md at the repo root.

import { useEffect, useRef, useState } from 'react'
import nextDynamic from 'next/dynamic'
import { usePlatform, replaceUrlForView, syncTitle } from '@/lib/store'
import { fetchSession } from '@/lib/api'
import { normalizeCode } from '@/lib/code'
import { warmRelay } from '@/lib/relay-endpoint'
import type { View } from '@/lib/store'
import { Header } from '@/components/platform/header'
import { Footer } from '@/components/platform/footer'
import { DiscoverView } from '@/components/platform/discover-view'
import { AppLandingView } from '@/components/platform/app-landing-view'
import { SessionGate } from '@/components/platform/session-gate'
import { getApp } from '@/lib/registry'
import { humanError } from '@/lib/utils'
import { toast } from 'sonner'

// Session runtime and private views stay code-split and client-only — the
// first paint never waits on the WebRTC stack.
const SessionView = nextDynamic(
  () => import('@/components/platform/session-view').then((m) => m.SessionView),
  { ssr: false, loading: () => <SessionGate label="Loading the session" /> },
)
const MySessionsView = nextDynamic(
  () => import('@/components/platform/my-sessions-view').then((m) => m.MySessionsView),
  { ssr: false },
)
const HelpView = nextDynamic(
  () => import('@/components/platform/help-view').then((m) => m.HelpView),
  { ssr: false },
)
const JoinDialog = nextDynamic(
  () => import('@/components/platform/join-dialog').then((m) => m.JoinDialog),
  { ssr: false },
)
const CommandPalette = nextDynamic(
  () => import('@/components/platform/command-palette').then((m) => m.CommandPalette),
  { ssr: false },
)

export function AppShell({ initialAppId }: { initialAppId?: string }) {
  const view = usePlatform((s) => s.view)
  const activeSession = usePlatform((s) => s.activeSession)
  const setActiveSession = usePlatform((s) => s.setActiveSession)
  const addRecent = usePlatform((s) => s.addRecent)
  const openJoin = usePlatform((s) => s.openJoin)
  const loadRecent = usePlatform((s) => s.loadRecent)
  const [hydratingSession, setHydratingSession] = useState(false)

  // Boot view: with ?app=… in the URL the server already rendered this tool's
  // landing view. Keep showing it on the first client render so hydration
  // matches, then hand control back to the store once the URL is applied.
  const bootRef = useRef(
    initialAppId && getApp(initialAppId)
      ? ({ name: 'app', appId: initialAppId } as View)
      : null,
  )
  const shownView = bootRef.current ?? view

  // Parse the URL into app state — on first load and on back/forward.
  useEffect(() => {
    loadRecent()

    // Start the hosted relay's cold start on the very first render — while
    // the person is surfing or setting up tools, not while they wait inside
    // a session. Deduped inside warmRelay; a no-op for the local relay.
    warmRelay()

    // The SPA swaps views without full page loads; the browser must never
    // resurrect an old scroll offset after back/forward or a view swap
    // (the "opened a feature and landed at the bottom" bug).
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'

    const toTop = () => window.scrollTo(0, 0)

    async function applyFromUrl() {
      // Every URL-driven view lands at the top of the page.
      toTop()
      const params = new URLSearchParams(window.location.search)
      const s = params.get('s')
      const app = params.get('app')
      const join = params.get('join')
      const viewParam = params.get('view')

      if (s) {
        const code = normalizeCode(s)
        setHydratingSession(true)
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
          const next: View = { name: 'session', code: session.code }
          usePlatform.setState({ view: next })
          replaceUrlForView(next)
          syncTitle(next)
          toTop()
        } catch (err) {
          const next: View = { name: 'home' }
          usePlatform.setState({ view: next })
          replaceUrlForView(next)
          syncTitle(next)
          toast.error(humanError(err, 'That session is not available.'))
        } finally {
          setHydratingSession(false)
        }
        return
      }

      if (join) {
        openJoin(normalizeCode(join))
        // Strip the join param so closing the dialog does not re-open it.
        window.history.replaceState(null, '', '/')
        return
      }

      if (app && getApp(app)) {
        const next: View = { name: 'app', appId: app }
        usePlatform.setState({ view: next, activeAppId: app })
        replaceUrlForView(next)
        syncTitle(next)
        return
      }

      if (viewParam === 'sessions' || viewParam === 'help') {
        const next: View = { name: viewParam }
        usePlatform.setState({ view: next })
        replaceUrlForView(next)
        syncTitle(next)
        return
      }

      usePlatform.setState({ view: { name: 'home' } })
      syncTitle({ name: 'home' })
    }

    void applyFromUrl().then(() => {
      // The URL has been applied; the store is the source of truth now.
      bootRef.current = null
    })
    const onPop = () => {
      toTop()
      void applyFromUrl()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {hydratingSession ? (
          <SessionGate label="Opening the session" />
        ) : shownView.name === 'home' ? (
          <DiscoverView />
        ) : shownView.name === 'app' ? (
          <AppLandingView appId={shownView.appId} />
        ) : shownView.name === 'session' ? (
          activeSession && activeSession.code === shownView.code ? (
            <SessionView session={activeSession} />
          ) : (
            <SessionGate label="Restoring the session" code={shownView.code} />
          )
        ) : shownView.name === 'sessions' ? (
          <MySessionsView />
        ) : (
          <HelpView />
        )}
      </main>
      <Footer />
      <JoinDialog />
      <CommandPalette />
    </div>
  )
}
