# Deploying ShareOnWeb

Two moving parts, deployed separately. Sessions only work when BOTH halves
of the wiring below exist — a wrong name or a missing redeploy breaks them
silently (the UI keeps looking fine, the relay just never sees anyone).

- **App** (Next.js, static-ish SPA + registry API): Vercel → `https://shareonweb.vercel.app`
- **Relay** (long-running socket.io process, holds rooms): Render → `https://shareonweb.onrender.com`

## Environment variables

### Vercel (app)

| Variable | Required | Value | Why |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_RELAY_URL` | **Yes** | `https://shareonweb.onrender.com` | Baked into the client bundle at BUILD time; the browser socket uses it. Bare `shareonweb.onrender.com` also works (auto-upgraded to https). |
| `RELAY_URL` | **Yes** | `https://shareonweb.onrender.com` | Read at RUNTIME by the server session registry (`/api/sessions`) and the new `/api/relay-config` runtime fallback. Bare hostnames work. |
| `RELAY_KEY` | Recommended | same secret as Render's `RELAY_KEY` | Guards the relay control API (`/api/session`, `/close/:code`). Mismatch = registry 401s. |
| `SITE_URL` | Recommended | `https://shareonweb.vercel.app` | Canonical + OG image absolute URLs. `NEXT_PUBLIC_SITE_URL` is accepted as an alias; bare `shareonweb.vercel.app` also works. |

**Set `NEXT_PUBLIC_RELAY_URL` BEFORE deploying, and REDEPLOY after changing it.**
Everything `NEXT_PUBLIC_*` is inlined at build time — adding it to the dashboard
does nothing until a new build runs. This exact gap is what broke sessions on
2026-11-22: the deployed bundle still contained the sandbox fallback, so every
browser tried to reach a relay on Vercel's own domain.

**Values are protocol-tolerant (fixed 2026-11-22).** Every URL variable above
accepts both spellings — `https://shareonweb.vercel.app` and bare
`shareonweb.vercel.app` (quotes and stray slashes are tolerated too; bare
hosts are upgraded to https). This matters because the exact typo used to be
fatal: `SITE_URL=shareonweb.vercel.app` crashed the production build with
`TypeError: Invalid URL` (`new URL` inside `metadataBase`), and a bare relay
hostname silently killed the socket. All env URLs now pass through
`src/lib/normalize-url.ts`, so the class of misconfiguration is closed.

If only `RELAY_URL` is set, the client now recovers at runtime via
`/api/relay-config` (added 2026-11-22) — but the recommended, zero-round-trip
setup is setting both names.

### Render (relay)

| Variable | Required | Value | Why |
| --- | --- | --- | --- |
| `RELAY_KEY` | Recommended | a long random secret; must MATCH Vercel's `RELAY_KEY` | Protects `/api/session` and `/close/:code`. Defaults to a dev value when unset. |
| `PORT` | No | Render injects it | The relay binds `process.env.PORT` automatically. |

- Health check path: `/health` (returns `{"ok":true,...}`).
- CORS is already open (`origin: "*"`); no per-domain allowlist needed.
- WebSockets work on Render free tier, no extra config.

## Render free tier: spin-down and the built-in warm-up

Render free services sleep after ~15 minutes idle and take up to a minute to
cold start. The app now handles this end to end:

1. **Warm-up on open** — the app shell pings `GET {relay}/health` once on
   first load (deduped to 1/minute). While someone is browsing the catalog or
   setting up tools, the relay is already waking up.
2. **Warm-up on session open** — opening a session view re-fires the ping.
3. **Patient socket** — socket.io retries forever (1s–5s backoff) and
   re-joins the room by itself once the relay is up.
4. **Honest copy** — if the relay is unreachable while the browser is online,
   the banner says "Can't reach the session relay … waking up right now",
   never "you lost your internet". A production deployment with NO relay URL
   configured gets an explicit misconfiguration message instead.

## Deploy checklist

1. Render: set `RELAY_KEY`, redeploy if changed. Confirm `/health` returns ok.
2. Vercel: set `NEXT_PUBLIC_RELAY_URL`, `RELAY_URL`, `RELAY_KEY`, `SITE_URL`.
3. **Redeploy Vercel** (env vars apply only to new builds).
4. Verify (2 minutes):
   - Open the app, create a session → status pill turns **Connected**.
   - Relay `/health` now shows `"rooms":1,"sessions":1` while you are in it.
   - DevTools → Network → WebSocket to `wss://shareonweb.onrender.com` exists.
   - Join the same code from a second device → both see each other.
5. If the pill says **Relay unreachable** with the misconfiguration message:
   the deployment has no relay URL — go back to step 2 and redeploy.

## Known platform limits (honest inventory)

- Relay state is in memory: a Render restart/sleep wipes rooms and the
  session registry. Sessions self-destruct within 24h by design anyway.
- The registry on Render is the single source for "My Sessions" across
  devices; if `RELAY_KEY` mismatches, the app host falls back to a detached
  local registry (logged as a `/api/relay-config` warning) and cross-device
  history stops working.
- Vercel cannot host the relay (no long-lived WebSocket process); the split
  in this document is the supported topology.
