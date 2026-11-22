/**
 * Next.js instrumentation — runs once per server process.
 *
 * The relay-watchdog body lives in lib/relay-watchdog.ts and is loaded via a
 * dynamic import guarded by runtime checks. `NEXT_RUNTIME` is a compile-time
 * constant in Next builds, so Edge compiles drop this branch entirely and
 * never parse the Node-only module — this previously produced four
 * "not supported in the Edge Runtime" build warnings on Vercel.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Never run this during `next build` — only in a live server process.
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  // Hosted deployments (Vercel) cannot spawn sibling processes: the relay is
  // deployed separately and reachable via RELAY_URL/NEXT_PUBLIC_RELAY_URL.
  if (process.env.VERCEL) return

  // Sandbox opt-in — see .env (ENABLE_RELAY_WATCHDOG=1). Keeps a local dev
  // checkout of this repo free of surprise process spawning.
  if (process.env.ENABLE_RELAY_WATCHDOG !== '1') return

  try {
    const { startRelayWatchdog } = await import('@/lib/relay-watchdog')
    startRelayWatchdog()
  } catch {
    // Best-effort only — never block server startup on watchdog trouble.
  }
}
