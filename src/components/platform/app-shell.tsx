'use client'

// The application shell: view switching, URL sync, code-split heavy views.
// Rendered by the server pages; when the URL points at a tool (/beam), the
// tool's landing view takes part in the server HTML so search engines and
// answer engines see the real, action-first content of every tool. Session
// paths (/K7T29Q) hydrate against the session API and fail into an honest
// "not available" state instead of a silent redirect. Doctrine: DESIGN.md.

import { useEffect, useState } from 'react'
import nextDynamic from 'next/dynamic'
import { usePlatform, parsePath, replaceUrlForView, syncTitle } from '@/lib/store'
import { fetchSession } from '@/lib/api'
import { normalizeCode } from '@/lib/code'
import { warmRelay } from '@/lib/relay-endpoint'
import type { View } from '@/lib/store'
import { getTopApp } from '@/lib/registry'
import { Header } from '@/components/platform/header'
import { Footer } from '@/components/platform/footer'
import { DiscoverView } from '@/components/platform/discover-view'
import { AppLandingView } from '@/components/platform/app-landing-view'
import { InstantSurface } from '@/components/instant/instant-surface'
import { SessionGate } from '@/components/platform/session-gate'
import { humanError } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CircleAlert, Home, KeyRound, LogIn } from 'lucide-react'

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

export function AppShell({ initialView }: { initialView?: View }) {
  const view = usePlatform((s) => s.view)
  const activeSession = usePlatform((s) => s.activeSession)
  const setActiveSession = usePlatform((s) => s.setActiveSession)
  const addRecent = usePlatform((s) => s.addRecent)
  const openJoin = usePlatform((s) => s.openJoin)
  const loadRecent = usePlatform((s) => s.loadRecent)
  const navigate = usePlatform((s) => s.navigate)
  const [hydratingSession, setHydratingSession] = useState(false)
  const [failedCode, setFailedCode] = useState<string | null>(null)

  // Boot view: with a tool path (/beam) the server already rendered this
  // tool's landing view. Keep showing it on the first client render so
  // hydration matches, then hand control back to the store once the URL is
  // applied. State, not a ref: clearing it must trigger the re-render that
  // swaps the boot view for the store's view.
  const [bootView, setBootView] = useState<View | null>(initialView ?? null)
  const shownView = bootView ?? view

  // Keep the tab title in lockstep with the store's view. The server owns the
  // title for the boot HTML; after the boot handoff (and whenever the store
  // view changes) the title follows the store. Re-asserted a beat later as
  // well: when React recovers from a hydration mismatch it replays the tree,
  // which re-commits the server metadata title over an imperative sync.
  useEffect(() => {
    if (bootView) return
    syncTitle(view)
    const raf = requestAnimationFrame(() => syncTitle(view))
    const t = setTimeout(() => syncTitle(view), 900)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [view, bootView])

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

    async function openSessionByCode(rawCode: string): Promise<boolean> {
      const code = normalizeCode(rawCode)
      setFailedCode(null)
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
        return true
      } catch (err) {
        setFailedCode(code)
        toast.error(humanError(err, 'That session is not available.'))
        return false
      } finally {
        setHydratingSession(false)
      }
    }

    async function applyFromUrl() {
      // Every URL-driven view lands at the top of the page.
      toTop()

      // Legacy query-param links first (?s=, ?join=, ?app=, ?view=) — QR
      // codes and bookmarks printed before path routing existed still
      // resolve. Only honored while on "/", so a real path like /beam is
      // never hijacked by stray params.
      const params = new URLSearchParams(window.location.search)
      const hasLegacy =
        params.has('s') || params.has('join') || params.has('app') || params.has('view')

      if (hasLegacy && parsePath(window.location.pathname)?.name === 'home') {
        const s = params.get('s')
        const app = params.get('app')
        const join = params.get('join')
        const viewParam = params.get('view')

        if (s) {
          await openSessionByCode(s)
          return
        }

        if (join) {
          openJoin(normalizeCode(join))
          // Strip the join param so closing the dialog does not re-open it.
          window.history.replaceState(null, '', '/')
          return
        }

        if (app) {
          // parsePath resolves variant ids too: /?app=drop lands on /beam.
          const parsed = parsePath(`/${app}`)
          if (parsed?.name === 'app') {
            usePlatform.setState({ view: parsed, activeAppId: parsed.appId })
            replaceUrlForView(parsed)
            syncTitle(parsed)
            return
          }
        }

        if (viewParam === 'sessions' || viewParam === 'help') {
          const next: View = { name: viewParam }
          usePlatform.setState({ view: next })
          replaceUrlForView(next)
          syncTitle(next)
          return
        }
      }

      // Real paths: /beam, /K7T29Q, /help, /sessions, /.
      const fromPath = parsePath(window.location.pathname)
      if (fromPath) {
        if (fromPath.name === 'session') {
          await openSessionByCode(fromPath.code)
          return
        }
        usePlatform.setState({
          view: fromPath,
          ...(fromPath.name === 'app' ? { activeAppId: fromPath.appId } : {}),
        })
        replaceUrlForView(fromPath)
        syncTitle(fromPath)
        return
      }

      usePlatform.setState({ view: { name: 'home' } })
      syncTitle({ name: 'home' })
    }

    void applyFromUrl()
      .catch((err) => {
        // A failed URL parse must never strand the shell on its boot view.
        console.error('[sow] applyFromUrl failed:', err)
        usePlatform.setState({ view: { name: 'home' } })
        syncTitle({ name: 'home' })
      })
      .then(() => {
        // The URL has been applied; the store is the source of truth now.
        setBootView(null)
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
          <SessionGate
            label="Opening the session"
            code={shownView.name === 'session' ? shownView.code : undefined}
          />
        ) : failedCode &&
          !(
            shownView.name === 'session' &&
            activeSession &&
            activeSession.code === shownView.code
          ) ? (
          <SessionUnavailable
            code={failedCode}
            onHome={() => {
              setFailedCode(null)
              navigate({ name: 'home' })
            }}
            onJoin={() => {
              setFailedCode(null)
              openJoin()
            }}
          />
        ) : shownView.name === 'home' ? (
          <DiscoverView />
        ) : shownView.name === 'app' ? (
          getTopApp(shownView.appId)?.kind === 'instant' ? (
            <InstantSurface appId={shownView.appId} />
          ) : (
            <AppLandingView appId={shownView.appId} />
          )
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

// The honest dead end: a session link that no longer resolves. Three real
// ways out, no silent redirect to a page that pretends nothing happened.
function SessionUnavailable({
  code,
  onHome,
  onJoin,
}: {
  code: string
  onHome: () => void
  onJoin: () => void
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center sm:py-32">
      <div className="flex size-16 items-center justify-center rounded-2xl border bg-card">
        <CircleAlert className="size-7 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="mt-5 font-display text-xl font-semibold tracking-[-0.01em]">
        That session is not available
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        The code <span className="font-mono font-medium tracking-widest">{code}</span> has
        expired, was ended, or was mistyped. Sessions live for 24 hours, then they are gone
        for good.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Button onClick={onHome}>
          <Home className="size-4" aria-hidden="true" /> Discover tools
        </Button>
        <Button variant="outline" className="bg-transparent" onClick={onJoin}>
          <KeyRound className="size-4" aria-hidden="true" /> Join another code
        </Button>
      </div>
      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <LogIn className="size-3.5" aria-hidden="true" /> Joining one you are in? Ask the host
        to re-share the link.
      </p>
    </div>
  )
}
