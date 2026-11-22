# ShareOnWeb — Development Worklog

Rebuilt 2026-11-23 after a sandbox recycle wiped the untracked copy. This file is
now committed to git so run-to-run continuity survives recycles.

## 1. Project overview

ShareOnWeb is an account-free HUB of practical web tools. Every tool opens a live
P2P session over WebRTC; a socket.io relay (`mini-services/relay-service/`, :3003)
only brokers signaling and room membership — content never touches a server.

- **App**: Next.js 16.1.3 (Turbopack), TypeScript strict, Tailwind 4, Prisma
  (SQLite, sessions only), bun. Dev :3000, relay :3003, gateway :81 (the ONLY
  browser entry — never :3000).
- **Deployment**: GitHub repo → Vercel. `NEXT_PUBLIC_*` env vars are build-time.
  Design rules: no indigo/blue, DO IT FIRST UX, sticky footer, restrained cards.

## 2. Current architecture (verified against code, not memory)

### 2.1 URL routing — DONE & QA-verified 2026-11-23

One dynamic segment (`src/app/[slug]/page.tsx`) resolves the shared namespace:

| URL | Behavior |
| --- | --- |
| `/beam` | Tool page — statically generated, own metadata/OG/JSON-LD, self-canonical |
| `/drop` (legacy variant slug) | 307 redirect → `/beam` (server-side) |
| `/Beam` | 307 redirect → `/beam` (case canonicalization) |
| `/K7T29Q` | Session path — client hydrates against session API; honest dead-end if unknown |
| `/tps9rc` | Canonicalizes to `/TPS9RC` |
| `/garbage` | Real 404 |
| `/?app=drop`, `/?s=CODE`, `/?join=`, `/?view=` | Legacy QR/bookmark links honored once on `/`, then URL is replaced with the clean path in place |

- Sessions created today get `/CODE` paths via `urlForView()` (`src/lib/store.ts`).
- QR codes and share links generate `${origin}/${CODE}` (`joinUrl()` in
  `src/lib/code.ts`) — no new `?s=` links are produced anywhere.
- `My Sessions`, `Help` are real paths (`/sessions`, `/help`).
- Sitemap lists `/` + all 12 tool paths; session paths are `noindex`.

### 2.2 Tool registry — 31 apps submerged into 12 tools

`src/lib/registry.ts` is the single source of truth. Related apps became *modes*
(variants) of one tool; each variant keeps its legacy session appId so old
sessions, panels, history and OG assets keep working. `APP_ALIASES` maps every
variant id → parent tool.

| Tool (path) | Modes (variant ids) |
| --- | --- |
| **Beam** `/beam` | beam, drop (text/files), folder-share, quick-pair |
| **Call** `/call` | video-call, group-meeting, audio-call, interview-room, classroom, webinar-room |
| **Screen** `/screen` | screen-share, screen-to-phone, remote-assist, guided-pointer, support-session |
| **Camera** `/camera` | camera-live, phone-webcam, baby-monitor, temp-stream |
| **Voice** `/voice` | walkie-talkie, phone-mic, voice-record |
| **Notepad** `/notepad` | shared-docs (prose), code-editor |
| **Present** `/present` | live-present, presentation-clicker |
| **Canvas** `/canvas` | — |
| **Roundtable** `/roundtable` | — |
| **Co-browse** `/co-browse` | — |
| **Location share** `/location-share` | — |
| **Live captions** `/live-captions` | — |

Display surfaces (`getApp`/`getVariant`) render legacy session ids as their
parent tool name.

### 2.3 Session model

Sessions still carry an appId equal to the **variant** id (e.g. `drop`), so
`/?s=`-era links and stored history remain valid. Every tool works in
sessions/codes today; standalone (no-session) tools are the next milestone —
none exist yet.

## 3. Milestones — status

| Milestone | Status |
| --- | --- |
| Git history rewrite + clean push (194 real files) | DONE — verified on GitHub |
| `?app=`/`?s=` → real path routing + legacy-compat redirects | DONE — QA-verified 2026-11-23 |
| 31 apps submerged into 12 tools with modes | DONE — QA-verified 2026-11-23 |
| Per-tool SEO (metadata, OG cards, JSON-LD, sitemap) | DONE |
| PWA manifest + icons + offline page + SW | DONE (earlier milestone) |
| Session titles | DONE (earlier milestone) |
| **Standalone tools (no session/code)** | NOT STARTED — next |
| **Everyday utility tools (converters, viewers, compressors, upscalers)** | NOT STARTED — pending user-approved list |

## 4. QA log — 2026-11-23 (this run, via :81 gateway)

Final automated pass (`scripts/final-qa.sh` + `scripts/qa-session-recheck.sh`,
single-invocation pattern — see 4.1): **8/8 PASS**.

- `/beam` renders, primary CTA "Start files now" visible. OK.
- `/?app=drop` → lands on Beam, URL rewritten to `/beam`. OK.
- `/drop` → 307 `/beam`. `/tps9rc` → `/TPS9RC`. `/garbage123` → 404. OK.
- Beam → Start files now → new session live at `/PURZPW`. OK.
- `/TPS9RC` deep link opens session view (API 200, UI hydrates). OK.
- Legacy `/?s=TPS9RC` → URL replaced with `/TPS9RC`. OK.
- Two-browser join + relay room membership + "Connected" status: verified
  earlier in this run against identical code. OK.
- Console: no errors.

### 4.1 Sandbox lifecycle constraint (IMPORTANT for future runs)

The harness kills user-spawned processes BETWEEN tool calls; only boot-registered
services (relay :3003, Caddy :81) survive. A dev server started ad hoc dies within
minutes. Consequences:

- Run browser QA as ONE script invocation that starts the dev server, waits for
  readiness, and performs all checks before exiting (see `scripts/final-qa.sh`).
- Do NOT `bun run build` against the boot-managed dev server: killing it leaves
  no :3000 for the rest of the run (boot restarts only at sandbox boot), and
  production build output in `.next` poisons the running dev server's chunks
  (ChunkLoadError). If a build is needed, do it and immediately re-verify with
  the single-call pattern.
- Cold Turbopack compiles take 5-13s per route; always curl-warm routes before
  browser checks, and never trust a "failed" check against a dead/gateway-502
  page — verify the server is alive first.

## 5. Checks — 2026-11-23

- `bun run lint` — clean.
- `bunx tsc --noEmit` — `src/` clean (errors exist only in dev `scripts/` test
  files and skill fixtures, which don't ship).
- `bun run build` — succeeds; 12 tool pages prerendered via
  `generateStaticParams`, rest dynamic/static as expected.

## 6. Known limitations

- Standalone tools (no-session category) do not exist yet — the HUB currently
  serves only session-based tools.
- The 50 MB per-file Beam limit is enforced client-side (P2P buffer budget).
- `skills/` fixtures break tsc if run without exclusions — never shipped.

## 7. Git / deploy state — 2026-11-23

- Local `main` = `ad0aa0d` (milestone commit + QA scripts), repo clean.
- **PUSH BLOCKED**: the GitHub PAT (`~/.git-credentials`) was wiped by the
  sandbox recycle; only a truncated prefix survives. Pushing `main` to
  `origin` and thereby deploying the URL refactor to Vercel requires the user
  to re-send a fine-grained PAT (repo `harshvardhan9084/shareonweb`, Contents:
  Read & write). Then: `git push origin main`.

## 8. Next milestones (proposed — awaiting user confirmation)

1. **Standalone everyday tools** (no session/code): file converters (extension
   + format), online file viewers, file compressors, image upscaler — pure
   client-side, privacy-first, instant. Detailed list presented to the user.
2. Session titles polish + folder sharing improvements (carried over from
   earlier backlog).
3. Quick-pair QR polish and audio call quality (carried over backlog).
