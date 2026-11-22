'use client'

// Relay endpoint resolution for the browser client.
//
// The session socket must reach the hosted relay in every deployment shape:
//   1. NEXT_PUBLIC_RELAY_URL   — build-time inline (the recommended setup:
//      set it on Vercel and REDEPLOY; it is inlined into the client bundle).
//   2. /api/relay-config       — runtime fallback. The server route reads
//      RELAY_URL (or NEXT_PUBLIC_RELAY_URL) from the deployment environment
//      at request time, so a deployment that only configured the plain
//      server variable still gets a working socket. Every value passes
//      through normalize-url.ts, so "https://host" and bare "host" both work.
//   3. '/?XTransformPort=3003' — the sandbox gateway to the local relay.
//
// This file also owns relay warm-up: hosted relays on free tiers (Render
// et al) spin down when idle and a cold start takes up to a minute. Pinging
// /health the moment the app opens starts that wake-up while the person is
// still browsing or setting up tools — not while they stare at a session
// that cannot connect.

import { normalizeOrigin } from '@/lib/normalize-url'

export const LOCAL_GATEWAY_RELAY = '/?XTransformPort=3003'

const CONFIG_TIMEOUT_MS = 8000
const WARMUP_TIMEOUT_MS = 20000
const WARMUP_DEDUPE_MS = 60_000

let resolvedCache: string | null | undefined
let lastWarmAt = 0

/** Build-time inline relay URL ('' when unset or unusable). */
export function inlineRelayUrl(): string {
  return normalizeOrigin(process.env.NEXT_PUBLIC_RELAY_URL) || ''
}

/**
 * The relay base URL the socket should use. Resolves once per page and
 * caches the answer. Returns '' when nothing is configured — the caller
 * then falls back to the sandbox gateway.
 */
export async function resolveRelayUrl(): Promise<string> {
  const inline = inlineRelayUrl()
  if (inline) return inline
  if (resolvedCache !== undefined) return resolvedCache ?? ''
  try {
    const res = await fetch('/api/relay-config', {
      cache: 'no-store',
      signal: AbortSignal.timeout(CONFIG_TIMEOUT_MS),
    })
    if (res.ok) {
      const data = (await res.json()) as { relayUrl?: string | null }
      resolvedCache =
        typeof data.relayUrl === 'string' && data.relayUrl.trim()
          ? normalizeOrigin(data.relayUrl.trim()) || ''
          : ''
    } else {
      resolvedCache = ''
    }
  } catch {
    resolvedCache = ''
  }
  return resolvedCache
}

/**
 * Synchronous peek at what is already known (inline var or a completed
 * runtime lookup). '' when unresolved or unconfigured.
 */
export function peekRelayUrl(): string {
  return inlineRelayUrl() || resolvedCache || ''
}

/** True when a hosted (cross-origin) relay is configured. */
export function hasHostedRelay(): boolean {
  const url = peekRelayUrl()
  return url !== '' && url !== LOCAL_GATEWAY_RELAY
}

/**
 * True in a production build when NO hosted relay is configured — the
 * deployment is broken by config and the connection banner should say so
 * plainly instead of blaming the user's network.
 */
export function relayMisconfigured(): boolean {
  return process.env.NODE_ENV === 'production' && !hasHostedRelay()
}

/**
 * Fire-and-forget cold-start ping. Deduped to at most one ping a minute so
 * mounting views and reconnects never spam the relay's health endpoint.
 */
export function warmRelay(): void {
  const now = Date.now()
  if (now - lastWarmAt < WARMUP_DEDUPE_MS) return
  lastWarmAt = now
  void (async () => {
    try {
      const base = await resolveRelayUrl()
      if (!base || base === LOCAL_GATEWAY_RELAY) return // the local relay never sleeps
      await fetch(`${base}/health`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(WARMUP_TIMEOUT_MS),
      })
    } catch {
      // Best effort. If the relay is genuinely down, the session view shows
      // its honest connection state; this ping only exists to start the
      // wake-up early.
    }
  })()
}
