'use client'

// Discover — the index. Do-it-first: the working controls (start a session,
// search the catalog, join with a code) sit in the first viewport. The page
// states the product's ethic plainly — nothing you do here ever lands on our
// servers — and presents the two tool families (Instant, Live) as one honest
// system instead of two competing stories. Doctrine: DESIGN.md at the root.

import { useMemo, useRef, useState, useEffect } from 'react'
import { AppIcon } from '@/components/platform/app-icon'
import { InstallBanner } from '@/components/platform/install-banner'
import { usePlatform } from '@/lib/store'
import { quickStart } from '@/lib/quick-start'
import {
  APPS,
  CATEGORIES,
  INSTANT_START_APPS,
  appsByCategory,
  getLiveApps,
  searchApps,
  getApp,
  getVariant,
} from '@/lib/registry'
import { HOME_FAQS } from '@/lib/seo'
import { createSession, fetchSession } from '@/lib/api'
import { normalizeCode } from '@/lib/code'
import { Button } from '@/components/ui/button'
import { CodeInput } from '@/components/platform/code-input'
import {
  Search,
  CircleAlert,
  ArrowRight,
  Cable,
  CloudUpload,
  UserPlus,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const QUICK_START_LABELS: Record<string, string> = {
  beam: 'Share text now',
  zip: 'Zip or unzip now',
  image: 'Compress images now',
  hash: 'Hash a file now',
  password: 'Generate a password now',
  drop: 'Send files now',
  'folder-share': 'Send a folder now',
  canvas: 'Draw together now',
  roundtable: 'Open a room now',
  'shared-docs': 'Write a note together',
  'screen-share': 'Share my screen now',
  'video-call': 'Start a video call',
  'audio-call': 'Start a voice call',
  'walkie-talkie': 'Open a walkie-talkie',
  'quick-pair': 'Pair a device now',
  'group-meeting': 'Start a meeting room',
}

function startLabel(id: string): string {
  const found = getVariant(id)
  if (!found) return id
  return QUICK_START_LABELS[id] ?? found.app.name
}

function startIcon(id: string): string {
  return getVariant(id)?.variant.icon ?? 'zap'
}

// The familiar detours, and the tool that removes each one.
const DETOURS: Array<{ detour: string; icon: typeof Cable; fix: string; appId: string }> = [
  {
    detour: 'Emailing files to yourself',
    icon: CloudUpload,
    fix: 'Drop moves them device to device: nothing uploaded, nothing waiting.',
    appId: 'drop',
  },
  {
    detour: 'Installing an app for a two-minute task',
    icon: Cable,
    fix: 'Every tool runs in the tab you already have open.',
    appId: 'quick-pair',
  },
  {
    detour: 'Creating an account to meet for five minutes',
    icon: UserPlus,
    fix: 'The code is the only ticket. Open the room, share it, done.',
    appId: 'roundtable',
  },
]

export function DiscoverView() {
  const openApp = usePlatform((s) => s.openApp)
  const setActiveSession = usePlatform((s) => s.setActiveSession)
  const addRecent = usePlatform((s) => s.addRecent)
  const openJoin = usePlatform((s) => s.openJoin)
  const navigate = usePlatform((s) => s.navigate)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const results = useMemo(() => (query.trim() ? searchApps(query) : []), [query])
  const liveCount = getLiveApps().length

  // Close the suggestion dropdown on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const startApps = INSTANT_START_APPS.slice(0, 3)

  async function joinSession(raw?: string) {
    const normalized = normalizeCode(raw ?? joinCode)
    if (normalized.length !== 6) {
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
      openApp(session.appId)
      navigate({ name: 'session', code: session.code })
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not join, please try again.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div>
      {/* ------------------------------------------------------------- hero */}
      <section className="border-b">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
          {/* left: the claim and the working controls */}
          <div>
            <h1 className="max-w-[26ch] font-display text-[clamp(2.5rem,5.2vw,3.75rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
              Every tool you need,
              <span className="whitespace-nowrap"> already open.</span>
            </h1>
            <p className="mt-4 max-w-[52ch] text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Zip, convert, compress, hash, format, generate — instantly, right in your browser.
              Need two devices? Share files, screens and calls live with a code.
            </p>
            {/* the ethic, stated where the eye lands first */}
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground/90">
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
              Nothing you do here ever lands on our servers.
            </p>

            {/* start controls: one filled action, its neighbours quiet */}
            <div className="mt-7 flex flex-wrap gap-2.5">
              {startApps.map((id, i) => (
                <Button
                  key={id}
                  size="lg"
                  variant={i === 0 ? 'default' : 'outline'}
                  className={cn('h-11 gap-2', i > 0 && 'bg-transparent')}
                  onClick={() => void quickStart(id)}
                >
                  <AppIcon name={startIcon(id)} className="size-4.5" aria-hidden="true" />
                  {startLabel(id)}
                </Button>
              ))}
            </div>

            {/* intention search */}
            <div ref={searchRef} className="relative mt-7 max-w-xl">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results[0]) {
                    openApp(results[0].id)
                    setQuery('')
                  }
                  if (e.key === 'Escape') setFocused(false)
                }}
                placeholder="What do you want to do? e.g. send photos from my phone to my laptop"
                aria-label="Find a tool by describing what you want to do"
                className="h-12 w-full rounded-lg border bg-card py-3 pl-10 pr-4 text-sm shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
              />
              {focused && results.length > 0 && (
                <ul
                  className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1.5 text-left"
                  role="listbox"
                  aria-label="Matching tools"
                >
                  {results.map((app) => (
                    <li key={app.id} role="option" aria-selected={false}>
                      <button
                        onClick={() => {
                          openApp(app.id)
                          setQuery('')
                          setFocused(false)
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent active:bg-muted motion-reduce:transition-none"
                      >
                        <AppIcon
                          name={app.icon}
                          className={cn(
                            'size-4 shrink-0',
                            app.status === 'live' ? 'text-primary' : 'text-muted-foreground',
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {app.name}
                            {app.status !== 'live' && (
                              <span className="text-xs font-normal text-muted-foreground">
                                planned
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {app.tagline}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {focused && query.trim() && results.length === 0 && (
                <div className="absolute inset-x-0 top-full z-20 mt-2 rounded-lg border bg-popover p-4 text-left text-sm text-muted-foreground">
                  Nothing matches “{query}” yet. The catalog grows around real intentions. Try
                  “send photos”, “draw together” or “poll”.
                </div>
              )}
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              {APPS.length - liveCount > 0
                ? `${liveCount} tools live today, ${APPS.length - liveCount} on the way. No accounts, no ads, no uploads.`
                : `${liveCount} tools. No accounts, no ads, no uploads.`}
            </p>
          </div>

          {/* right: the two families, and the one artifact a live tool needs */}
          <div className="border-t pt-9 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-1">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Two kinds of tools, one rule
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Instant</span> — Zip, PDF, images,
              JSON, passwords. Open the page and it works on this device. No code, because
              nobody else is involved.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Live</span> — Share, Call, Screen,
              Notepad. Two or more devices, in real time. A session opens with a code like
              this; hand it over by link, by QR, or by typing it in.
            </p>
            <p
              className="mt-4 font-mono text-[clamp(2.25rem,5vw,3.5rem)] font-medium leading-none tracking-tight tabular-nums"
              translate="no"
            >
              K7T<span aria-hidden="true" className="text-primary">-</span>29Q
            </p>
            <p className="sr-only">Example session code for live tools.</p>

            <div className="mt-5 max-w-sm">
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
                <p role="alert" className="mt-2 flex items-start gap-2 text-xs text-destructive">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {joinError}
                </p>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Or{' '}
              <button
                onClick={() => openJoin('', true)}
                className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                scan a QR to join
              </button>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Install suggestion — shown only when this device can actually install. */}
      <div className="px-4">
        <InstallBanner />
      </div>

      <div className="mx-auto max-w-6xl px-4">
        {/* ------------------------------------------- the problem, answered */}
        <section className="py-10 sm:py-12" aria-labelledby="why-this-exists">
          <h2
            id="why-this-exists"
            className="max-w-[34ch] font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl"
          >
            The usual ways are heavier than the task.
          </h2>
          <p className="mt-3 max-w-[62ch] text-pretty leading-relaxed text-muted-foreground">
            Moving one photo, sharing one link, meeting for five minutes: each usually drags a
            cable, an upload or a sign-up behind it. Toolhive strips that back: open the tool
            and the work happens here — on your device when it is a one-person job, between
            your devices live when it needs a second one.
          </p>
          <ul className="mt-6 grid gap-x-10 lg:grid-cols-3">
            {DETOURS.map((d) => (
              <li key={d.detour} className="border-t pt-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <d.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {d.detour}
                </p>
                <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                  <ArrowRight
                    className="mt-1 size-3.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {d.fix}
                </p>
                <button
                  onClick={() => openApp(d.appId)}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  Open {getApp(d.appId)?.name}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------- the two paths */}
        <section className="border-t py-10 sm:py-12" aria-labelledby="how-it-works">
          <h2
            id="how-it-works"
            className="font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl"
          >
            Two ways in, one rule
          </h2>
          <div className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            <div className="border-t pt-4">
              <h3 className="font-semibold">Alone — instant tools</h3>
              <ol className="mt-3 space-y-2.5">
                {[
                  {
                    title: 'Open the tool',
                    body: 'Zip, PDF, images, text, JSON, passwords — the page is the tool.',
                  },
                  {
                    title: 'It works immediately',
                    body: 'On this device, with the browser’s own engines. No code, no upload, no waiting.',
                  },
                  {
                    title: 'Take the result and go',
                    body: 'Download it, copy it, close the tab. Nothing was sent anywhere in the first place.',
                  },
                ].map((s, i) => (
                  <li key={s.title} className="flex items-start gap-3">
                    <span
                      className="pt-0.5 font-mono text-sm tabular-nums text-primary"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">{s.title}.</span> {s.body}
                    </span>
                  </li>
                ))}
              </ol>
              <button
                onClick={() => openApp(startApps[0])}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                Try it now
              </button>
            </div>
            <div className="border-t pt-4">
              <h3 className="font-semibold">Together — live tools</h3>
              <ol className="mt-3 space-y-2.5">
                {[
                  {
                    title: 'Open a live tool',
                    body: 'Share, Call, Screen, Notepad — one click creates a temporary session and its code.',
                  },
                  {
                    title: 'Hand over the code',
                    body: 'The link, the QR or the six characters bring anyone in, with no account.',
                  },
                  {
                    title: 'End it, it is gone',
                    body: 'Text, files and boards travel directly between the devices, then expire with the session.',
                  },
                ].map((s, i) => (
                  <li key={s.title} className="flex items-start gap-3">
                    <span
                      className="pt-0.5 font-mono text-sm tabular-nums text-primary"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">{s.title}.</span> {s.body}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- directory */}
        <section className="border-t py-10 sm:py-12" aria-labelledby="the-tools">
          <h2
            id="the-tools"
            className="font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl"
          >
            The tools
          </h2>

          <div className="mt-4 space-y-9">
            {CATEGORIES.map((cat) => {
              const apps = appsByCategory(cat.id)
              return (
                <div
                  key={cat.id}
                  className="grid gap-3 lg:grid-cols-[210px_1fr] lg:gap-x-10"
                >
                  <div>
                    <h3 className="font-medium">{cat.label}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{cat.purpose}</p>
                  </div>
                  {/* Cards on small screens — each tool a real, noticeable target;
                      hairline rows on large screens. */}
                  <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:block">
                    {apps.map((app, i) => {
                      const live = app.status === 'live'
                      return (
                        <li key={app.id} className={cn(i > 0 && 'lg:border-t lg:border-border')}>
                          <button
                            onClick={() => openApp(app.id)}
                            aria-label={
                              live
                                ? `Open ${app.name}: ${app.tagline}`
                                : `${app.name}: ${app.tagline} (planned)`
                            }
                            className={cn(
                              'group flex h-full w-full flex-col gap-2 rounded-lg border bg-card p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none',
                              'hover:border-foreground/25 active:bg-muted',
                              'lg:-mx-3 lg:w-[calc(100%+1.5rem)] lg:flex-row lg:items-center lg:gap-4 lg:rounded-md lg:border-0 lg:bg-transparent lg:px-3 lg:py-3',
                              'lg:hover:bg-accent lg:active:bg-muted',
                              !live && 'lg:text-muted-foreground',
                            )}
                          >
                            <AppIcon
                              name={app.icon}
                              className={cn(
                                'size-5 shrink-0',
                                live ? 'text-primary' : 'text-muted-foreground',
                              )}
                              aria-hidden="true"
                            />
                            <span className="min-w-0">
                              <span
                                className={cn(
                                  'block text-[15px] font-medium',
                                  !live && 'text-muted-foreground',
                                )}
                              >
                                {app.name}
                              </span>
                              <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground lg:mt-0 lg:truncate lg:line-clamp-none">
                                {app.tagline}
                              </span>
                              {app.variants && app.variants.length > 1 && (
                                <span className="mt-0.5 block text-[11px] text-muted-foreground/80 lg:mt-0.5">
                                  {app.variants.map((v) => v.name).join(' · ')}
                                </span>
                              )}
                            </span>
                            <span
                              className={cn(
                                'mt-auto flex shrink-0 items-center gap-1 text-sm lg:mt-0 lg:ml-auto',
                                live ? 'text-muted-foreground' : 'text-muted-foreground/70',
                              )}
                            >
                              {live ? (
                                <>
                                  <span className="hidden sm:inline">open</span>
                                  <ArrowRight
                                    className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                                    aria-hidden="true"
                                  />
                                </>
                              ) : (
                                'planned'
                              )}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>

        {/* ---------------------------------------------------------- ethic */}
        <section className="border-t py-10 sm:py-12" aria-labelledby="privacy-strip">
          <h2
            id="privacy-strip"
            className="max-w-[36ch] font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl"
          >
            The ethic: nothing you do here lands on a server
          </h2>
          <p className="mt-3 max-w-[62ch] text-pretty leading-relaxed text-muted-foreground">
            Instant tools compute on your device with the browser’s own engines — the file is
            never sent anywhere. Live tools pass content directly between the devices in the
            session. There is no storage bucket holding your files, no profile holding your
            name, no tracker mining what you shared. When a session ends it is discarded —
            and it never existed on our side to begin with.
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-muted-foreground">
            {[
              'No accounts anywhere',
              'No ads, no trackers',
              'Instant: files never leave your device',
              'Live: content dies with the session',
              'Free, with no plans to pick',
            ].map((fact) => (
              <li key={fact} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-primary/70" />
                {fact}
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------------ FAQ */}
        <section className="border-t py-10 sm:py-12" aria-labelledby="faq">
          <h2
            id="faq"
            className="font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl"
          >
            Questions first-time visitors ask
          </h2>
          <ul className="mt-4 max-w-3xl">
            {HOME_FAQS.map((f) => (
              <li key={f.q} className="border-t border-border py-4">
                <h3 className="text-sm font-semibold">{f.q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------- last CTA */}
        <section className="border-t py-10 sm:py-12" aria-label="Start now">
          <div className="rounded-lg border bg-card p-6 sm:p-8">
            <h2 className="max-w-[30ch] font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
              Start with what you need right now.
            </h2>
            <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted-foreground">
              Instant tools open ready to use. One click on a live tool opens a working session
              and its code, and anyone you hand it to joins from their browser — no account, no
              install, nothing stored.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {startApps.map((id, i) => (
                <Button
                  key={id}
                  size="lg"
                  variant={i === 0 ? 'default' : 'outline'}
                  className={cn('h-11 gap-2', i > 0 && 'bg-transparent')}
                  onClick={() => void quickStart(id)}
                >
                  <AppIcon name={startIcon(id)} className="size-4.5" aria-hidden="true" />
                  {startLabel(id)}
                </Button>
              ))}
              <Button
                size="lg"
                variant="outline"
                className="h-11 bg-transparent"
                onClick={() =>
                  document
                    .getElementById('the-tools')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                Browse all {liveCount} tools
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
