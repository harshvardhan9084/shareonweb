'use client'

// Tool landing page — ACTION FIRST, and its own thing.
// The very first thing on this page is the working panel: pick a mode if the
// tool has several, start a session or join one with a code. Explanation,
// features, FAQs and how-it-works live below the action, never in front of
// it. Recent rooms for THIS tool surface right under the action, so a
// mistaken back-click never strands anyone in My Sessions.
// Doctrine: DESIGN.md at the repo root.

import { useEffect, useState } from 'react'
import { AppIcon } from '@/components/platform/app-icon'
import { CodeInput } from '@/components/platform/code-input'
import { usePlatform } from '@/lib/store'
import {
  getApp,
  getCategory,
  getVariant,
  resolveAppId,
  variantsOf,
  type AppVariant,
} from '@/lib/registry'
import { createSession, fetchSession } from '@/lib/api'
import { quickStart } from '@/lib/quick-start'
import { normalizeCode, formatCode } from '@/lib/code'
import { APP_FAQS } from '@/lib/seo'
import { humanError } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatDistanceToNowStrict, isPast } from 'date-fns'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleAlert,
  Clock,
  History,
  Loader2,
  QrCode,
  ShieldCheck,
} from 'lucide-react'

export function AppLandingView({ appId }: { appId: string }) {
  const navigate = usePlatform((s) => s.navigate)
  const setActiveSession = usePlatform((s) => s.setActiveSession)
  const addRecent = usePlatform((s) => s.addRecent)
  const recent = usePlatform((s) => s.recent)

  const [creating, setCreating] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [busyCode, setBusyCode] = useState<string | null>(null)

  const app = getApp(appId)
  const modes = app ? variantsOf(app) : []
  const [modeId, setModeId] = useState<string | null>(
    app && modes.length > 1 ? (app.defaultVariantId ?? modes[0].id) : null,
  )

  // If the store hands us a different tool (back/forward), reset the mode.
  useEffect(() => {
    if (!app) return
    const list = variantsOf(app)
    setModeId(
      list.length > 1
        ? (list.find((v) => v.id === modeId) ? modeId : app.defaultVariantId ?? list[0].id)
        : null,
    )
  }, [app?.id])

  if (!app) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <CircleAlert className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">We could not find that tool.</h1>
        <Button className="mt-6" variant="outline" onClick={() => navigate({ name: 'home' })}>
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to Discover
        </Button>
      </div>
    )
  }

  const category = getCategory(app.category)
  const live = app.status === 'live'
  const relatedLive = (app.relatedLive ?? [])
    .map((id) => getApp(id))
    .filter((a): a is NonNullable<typeof a> => a != null && a.status === 'live')

  const mode: AppVariant | undefined = modeId
    ? modes.find((m) => m.id === modeId)
    : undefined

  // The copy shown below the action follows the selected mode; a single-mode
  // tool falls back to its own definition.
  const shown = mode ?? {
    id: app.id,
    name: app.name,
    tagline: app.tagline,
    icon: app.icon,
    features: app.features,
    howItWorks: app.howItWorks,
    deviceNote: app.deviceNote,
  }

  // Rooms this device still remembers for THIS tool, across its modes.
  const appRecents = recent
    .filter((r) => resolveAppId(r.appId) === app.id && !isPast(new Date(r.expiresAt)))
    .slice(0, 3)

  // Arrow (not a hoisted declaration) so TS keeps the `app` narrowing above.
  const startSession = async () => {
    if (!app) return
    setCreating(true)
    try {
      const session = await createSession(mode ? mode.id : app.id)
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
      toast.error(humanError(err, 'Could not create the session.'))
    } finally {
      setCreating(false)
    }
  }

  async function joinSession(raw?: string) {
    const normalized = normalizeCode(raw ?? joinCode)
    if (normalized.length < 4) {
      setJoinError('Enter the 6-character code your host shared; it looks like K7T-29Q.')
      return
    }
    setJoining(true)
    setJoinError(null)
    try {
      const session = await fetchSession(normalized)
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
      setJoinError(err instanceof Error ? err.message : 'Could not join, please try again.')
    } finally {
      setJoining(false)
    }
  }

  // Quick rejoin from this tool's own landing page — no detour to My Sessions.
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
      toast.error(humanError(err, 'That session is no longer available.'))
    } finally {
      setBusyCode(null)
    }
  }

  // Mode FAQs first (written for the selected way of using the tool), with the
  // tool-level FAQs as the base. Deduped: the Text variant shares the tool's
  // id, so both lookups can return the same list.
  const seenQs = new Set<string>()
  const faqs = [...(APP_FAQS[shown.id] ?? []), ...(APP_FAQS[app.id] ?? [])]
    .filter((f) => {
      if (seenQs.has(f.q)) return false
      seenQs.add(f.q)
      return true
    })
    .slice(0, 4)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* breadcrumb — this page is a place, not a modal */}
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            <button
              onClick={() => navigate({ name: 'home' })}
              className="flex items-center gap-1.5 rounded-md px-1 py-0.5 -ml-1 transition-colors hover:text-foreground hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Discover
            </button>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5 text-muted-foreground/60" />
          </li>
          <li>{category.label}</li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5 text-muted-foreground/60" />
          </li>
          <li aria-current="page" className="font-medium text-foreground">
            {app.name}
          </li>
        </ol>
      </nav>

      {/* ------------------------------------------------- ACTION (first!) */}
      {live ? (
        <section className="mt-5 rounded-lg border bg-card p-5 sm:p-6" aria-label={`Start ${app.name}`}>
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
                {app.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{app.tagline}</p>

              {/* mode picker — one tool, the ways people actually use it */}
              {mode && (
                <div
                  role="group"
                  aria-label={`${app.name} modes`}
                  className="mt-4 flex flex-wrap gap-2"
                >
                  {modes.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={m.id === mode.id}
                      onClick={() => setModeId(m.id)}
                      className={cnModeButton(m.id === mode.id)}
                    >
                      <AppIcon name={m.icon} className="size-4" aria-hidden="true" />
                      {m.name}
                    </button>
                  ))}
                </div>
              )}

              {/* the action, then the explanation — never the reverse */}
              <Button
                size="lg"
                className="mt-4 h-12 w-full text-base sm:w-auto sm:px-8"
                onClick={startSession}
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Starting…
                  </>
                ) : (
                  `Start ${mode && mode.name !== app.name ? mode.name.toLowerCase() : 'a session'} now`
                )}
              </Button>
              {mode && (
                <p className="mt-2.5 text-sm text-muted-foreground">{mode.tagline}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                One click creates it. No account, nothing to configure.
              </p>
            </div>

            <div className="lg:border-l lg:border-border lg:pl-6">
              <CodeInput
                value={joinCode}
                onChange={(raw) => {
                  setJoinCode(raw)
                  setJoinError(null)
                }}
                onComplete={(raw) => void joinSession(raw)}
                invalid={Boolean(joinError)}
                disabled={joining}
              />
              <p className="mt-2.5 text-xs text-muted-foreground">
                Have a code from the other device? The sixth character joins. Pasting a whole
                join link works too.
              </p>
              {joining && (
                <p
                  role="status"
                  className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Checking the
                  code…
                </p>
              )}
              {joinError && (
                <p
                  role="alert"
                  className="mt-2 flex items-start gap-2 text-xs text-destructive"
                >
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {joinError}
                </p>
              )}
            </div>
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <QrCode className="size-3.5" aria-hidden="true" /> Others join by link, QR or
              6-character code
            </li>
            <li className="flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden="true" /> Expires after 24 h, or end sooner
            </li>
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Content lives only inside the
              session
            </li>
          </ul>
        </section>
      ) : (
        <section className="mt-5 rounded-lg border border-dashed p-5 sm:p-6" aria-label={`${app.name} is on the way`}>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            {app.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{app.tagline}</p>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            This tool is being built on the same session layer the live tools run on. While it
            is on the way, you can already do the closest thing right now:
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {relatedLive.map((a) => (
              <Button key={a.id} size="lg" className="h-12 gap-2" onClick={() => void quickStart(a.id)}>
                <AppIcon name={a.icon} className="size-4" aria-hidden="true" />
                Do it now with {a.name}
              </Button>
            ))}
            <Button
              size="lg"
              variant="outline"
              className="h-12 bg-transparent"
              onClick={() => navigate({ name: 'home' })}
            >
              Browse live tools
            </Button>
          </div>
        </section>
      )}

      {/* --------------------------- quick joins for THIS tool (this device) */}
      {appRecents.length > 0 && (
        <section className="mt-6" aria-label={`Your recent ${app.name} rooms on this device`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <History className="size-4" aria-hidden="true" />
            Pick up where you left off
          </h2>
          <ul className="mt-2 divide-y rounded-lg border bg-card">
            {appRecents.map((r) => {
              const rec = getVariant(r.appId)
              return (
                <li key={r.code} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono font-medium tracking-wide" translate="no">
                        {formatCode(r.code)}
                      </span>
                      {rec?.app.variants?.length && (
                        <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {rec.variant.name}
                        </span>
                      )}
                      {r.title && (
                        <span className="max-w-[28ch] truncate text-muted-foreground" title={r.title}>
                          {r.title}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Started {formatDistanceToNowStrict(new Date(r.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => void rejoin(r.code)}
                    disabled={busyCode === r.code}
                  >
                    {busyCode === r.code ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      'Rejoin'
                    )}
                  </Button>
                </li>
              )
            })}
          </ul>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Kept on this device only. Live rooms rejoin in one click.
          </p>
        </section>
      )}

      {/* ------------------------------------------------- details (below) */}
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          <p className="text-pretty leading-relaxed text-foreground/90">{app.description}</p>

          <h2 className="mt-8 text-lg font-semibold tracking-tight">
            {mode ? `What ${mode.name.toLowerCase()} does` : 'What it does'}
          </h2>
          <ul className="mt-4 space-y-2.5">
            {shown.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-foreground/90">{f}</span>
              </li>
            ))}
          </ul>

          {faqs.length > 0 && (
            <section className="mt-8" aria-label={`Quick answers about ${app.name}`}>
              <h2 className="text-lg font-semibold tracking-tight">
                Quick answers about {app.name}
              </h2>
              <ul className="mt-3">
                {faqs.map((f) => (
                  <li key={f.q} className="border-t border-border py-4">
                    <h3 className="text-sm font-semibold">{f.q}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {shown.deviceNote && (
            <div className="mt-8 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-foreground/80">{shown.deviceNote}</p>
            </div>
          )}

          {app.soonNote && (
            <div className="mt-8 flex items-start gap-3 rounded-lg border border-dashed bg-muted/30 p-4">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Where this is headed</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{app.soonNote}</p>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6 lg:pt-1">
          {live && shown.howItWorks && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground">
                How it works
              </h2>
              <ol className="mt-3 space-y-3">
                {shown.howItWorks.map((step, i) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="pt-0.5 font-mono text-sm tabular-nums text-primary" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-foreground/90">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="border-t pt-4 text-sm">
            <p className="text-xs font-semibold text-muted-foreground">
              Details
            </p>
            <p className="mt-2 font-medium">{category.label}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{category.purpose}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function cnModeButton(active: boolean): string {
  return [
    'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    active
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border bg-transparent text-foreground/80 hover:bg-accent/60 hover:text-foreground',
  ].join(' ')
}
