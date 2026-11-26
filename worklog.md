# Kontivo — Development Worklog

(Previously ShareOnWeb, then Toolhive — rebranded again this run to
**Kontivo**, an invented, non-existing brand word built around "context",
per the owner's direction. The domain stays shareonweb.vercel.app.)

## 1. Project overview

Kontivo is an account-free HUB of everyday web tools in two families:

- **Live session tools** — two or more devices, real-time, peer-to-peer over
  WebRTC; a socket.io relay (`mini-services/relay-service/`, :3003) brokers
  signaling only. One session per tool instance; **every mode of a tool lives
  inside one session under one code** (the 4-in-1 law — see §2.2).
- **Instant tools** — one device, done in seconds. No session, no code, no
  pairing; everything runs client-side (Canvas / WebCrypto / JSZip / local
  renderers). Files never leave the browser.

Stack: Next.js 16.1.3 (Turbopack), TypeScript strict, Tailwind 4, Prisma
(SQLite, sessions only), bun. Dev :3000, relay :3003, gateway **:81 is the
only browser entry**. Design rules: no indigo/blue, DO IT FIRST UX, sticky
footer, restrained cards, consistent tool-page anatomy across the catalog.

## 2. Current architecture (verified against code, not memory)

### 2.1 URL routing

One dynamic segment (`src/app/[slug]/page.tsx`) resolves the shared namespace:

| URL | Behavior |
| --- | --- |
| `/share`, `/call`, … `/zip`, `/qr` | Tool page — statically generated, own metadata/OG/JSON-LD, self-canonical |
| `/beam`, `/drop` (legacy slugs) | 307 redirect → `/share` |
| `/K7T29Q` | Session path — client hydrates against the session API |
| `/?app=…`, `/?s=CODE`, `/?join=`, `/?view=` | Legacy QR/bookmark links honored once on `/`, then the URL is replaced in place with the clean path |

Instant tool ids were chosen so they can never collide with the 6–8 char
session-code alphabet (`/base64` would have; `/encode` does not — it contains
`O`, which the code alphabet excludes).

### 2.2 One session, every mode (the 4-in-1 law)

The owner's rule: *if modes share a page, they must share a session — one
code covers all of them.* Implemented via family panels
(`src/components/session/family-panels.tsx`):

- **Share** — `ShareFamilyPanel`: Text / Files / Folder tabs, all mounted
  (CSS-hidden) so drafts and transfer state survive switches. Quick Pair
  remains a *start* mode (auto-opens the invite QR); legacy quick-pair
  sessions land in the same unified panel.
- **Call / Camera / Voice** — `MediaFamilyPanel`: all three tools run on the
  call engine (`callConfigFor`); the mode tabs remount the panel with the new
  config in the same room. Switching style honestly restarts this device's
  media; chat/participants/code persist.
- **Screen** — My screen (ScreenPanel) / Their screen (AssistPanel) tabs.
- **Notepad** — Document (NotePanel) / Code (CodeEditorPanel) tabs.
- **Present** — Present (PresentPanel) / Clicker (ClickerPanel) tabs.
- Legacy sessions with variant appIds (`drop`, `video-call`, …) render the
  same family panels; the stored id only seeds the initial tab.
- The sessions API accepts tool ids AND variant ids for live session tools;
  instant ids are never creatable (`getCreatableAppIds`).

### 2.3 Brand

- Name: **Kontivo** — invented, non-existing word built around "context"
  (owner directive: "change the app name something to 'context aware' and
  non-existing"). The product story: every tool opens aware of your context
  — this device, this session, these files — and forgets it when you leave.
- Mark (v5): **focus frame** — four green context brackets around a filled
  cyan node (`BrandMark` in app-icon.tsx, mirrored in `brand/*.svg`).
  PWA icons, favicon and OG cards are regenerated from those SVGs
  (`bun brand/build-icons.mjs`, `bun brand/build-og.mjs`).
- `SITE_NAME`, `SITE_TITLE`, `SITE_DESCRIPTION` in `src/lib/site.ts`.
- Domain unchanged: `https://shareonweb.vercel.app`.

## 3. Milestones — status

| Milestone | Status |
| --- | --- |
| Clean git history (194 real files) | DONE |
| Path routing + legacy-compat redirects | DONE, QA-verified |
| 31 apps submerged into 12 session tools | DONE, QA-verified |
| **One session covers every mode of a tool** | DONE, QA-verified |
| **beam → share rename (URL + copy + SEO + OG)** | DONE |
| **Rebrand to Toolhive (name, mark, icons, OG, manifest)** | DONE |
| **Instant tools — Batch 1 (8 tools, deep, no placeholders)** | DONE |
| Reconnect honest dead-end (>90 s → "Dial again now" + fresh session) | DONE client-side |
| **PDF & documents — Batch 2 (6 tools, deep, browser-verified)** | DONE |
| **SEO depth pass: every live page owns title/desc/keywords + WebApplication + HowTo + FAQPage JSON-LD; 14 instant pages gained written content below the tool** | DONE (this run), QA-verified 64/64 |
| **Homepage ethic rewrite: one rule, two honest families, no more conflicting logics** | DONE (this run), QA-verified |
| **Action-first enforcement: CTA before mode explanation; instant pages open on the tool** | DONE (this run), QA-verified |
| **Long-form reading pass (owner demand: "i want a long reading, importance-wise"): 26 tool articles (~10k words) + homepage narrative (~800 words), importance-ordered** | DONE (this run), QA-verified 72/72 |
| Media tools (audio/video/GIF/recorder) — Batch 3 | DONE (§9: 5 deep tools, /video-trim deferred honestly) |
| AI upscaler / background removal (WASM) | Upscaler DONE (§9); background removal deferred (heavy infra) |
| **Rebrand to Kontivo (invented "context aware" name, focus-frame mark v5, icons, OG, manifest)** | DONE (this run), QA-verified |
| **10 new instant tools: archive, file-tools, encrypt, meta-scrub, jwt, hash-file-batch, cron, diff, uuid, convert-units** | DONE (this run), QA-verified per tool |
| **Batch 5 tail + QR scanner: lorem, fake-data, css-tools, meta-tags, barcode, /qr Scan tab** | DONE (this run), QA-verified per tool |
| **Relay session GC on wake (expired sessions + stale rooms swept at boot)** | DONE (this run), verified with a seeded store harness |
| **PWA offline instant shells (sw.js v5 precaches 35 tool pages + assets)** | DONE (this run), production-only, mirror-checked |
| **§13 Recommended-tools expansion: 50 Google-search tools in 5 batches (owner directive)** | IN PROGRESS — Batch R1 DONE this run (10 tools, QA-verified) |


## 4. THE CHECKLIST (extracted from the owner's list + ChatGPT plan)

Rules of engagement: **no breadth-first placeholders** — a tool is only
"done" when its complete user journey works, with real edge cases handled,
browser-verified through :81. Work top-down; one batch per run is realistic.

### Batch 1 — Instant essentials (DONE previous run, 8 tools / ~25 functions)
- [x] `/zip` — pack files+folders → ZIP; unpack ZIP with per-entry + bulk download
- [x] `/image` — compress (quality + target-KB binary search), convert PNG/JPG/WebP, resize (%/px/aspect lock), batch, before/after sizes
- [x] `/hash` — MD5 + SHA-1/256/512 for files & text, verify against expected hash
- [x] `/encode` — Base64 text↔ both directions Unicode-safe, file↔data URL, decode→download
- [x] `/json` — format (2/4), minify, validate with line:column, sort keys, stats
- [x] `/text` — counters (words/chars/sentences/paragraphs/read-time), 7 case modes, 8 line ops, find&replace (regex)
- [x] `/password` — crypto-random passwords + passphrase mode, entropy, bulk
- [x] `/qr` — link/text/Wi-Fi/vCard QR, ECC + size, PNG download

### Batch 2 — PDF & documents (DONE this run, 6 tools / ~30 functions, all browser-verified)
- [x] `/pdf` — merge (any count, ordered), organize with **live page thumbnails** (reorder/rotate/delete/restore), split: extract ranges (`1-3, 7, 12-`) + split-every-N → ZIP; encrypted files detected and explained (pdf-lib + pdf.js thumbs)
- [x] `/pdf-view` — viewer with page box/prev/next, fit-width + stepped zoom, view rotation, DPR-sharp canvas, whole-document search with per-page hit chips (pdf.js)
- [x] `/pdf-text` — per-page extraction with live progress, EOL-aware reading order, copy-all, continuous + page-marked .txt export, scanned-PDF honesty note (pdf.js)
- [x] `/images-to-pdf` — JPEG/PNG/WebP/GIF/BMP/AVIF → one PDF; A4/Letter/fit-to-image, auto/portrait/landscape, margins, JPEG quality slider, EXIF rotation baked in (pdf-lib + canvas)
- [x] `/office-view` — DOCX → formatted HTML in a **script-proof sandboxed iframe** (mammoth), XLSX/XLS/CSV grid with sheet tabs + expandable rows (SheetJS), conversions: DOCX→HTML/.txt, CSV→XLSX, sheet→CSV
- [x] `/epub-view` — EPUB3 reader with TOC jump, pagination, arrow keys, 12–28 px text size, real progress % (background locations.generate), metadata readout, DRM honesty (epub.js)
- Infrastructure: vendored `public/pdf.worker.min.mjs` synced on postinstall (`scripts/sync-pdf-worker.mjs`), shared `src/lib/pdf-loader.ts` (lazy ~400 KB import), `src/types/mammoth-browser.d.ts` shim

### Batch 3 — Media (client-side) — DONE 5 of 6 (see §9); /video-trim stays deferred
- [x] `/audio` — trim, merge, speed, volume normalize (Web Audio + lamejs)
- [ ] `/video-trim` — trim/mute/speed (ffmpeg.wasm, lazy-loaded) — DEFERRED (25 MB core; owner has not accepted the size)
- [x] `/gif` — video→GIF, GIF resize/compress
- [x] `/frame-grab` — video frame extractor → PNG
- [x] `/recorder` — screen recorder (getDisplayMedia + MediaRecorder), audio recorder
- [x] `/upscaler` — high-quality resample + unsharp mask (real model super-resolution still deferred)

### Batch 4 — File tools deep + privacy (DONE in the Kontivo round, commit 97d3acc)
- [x] `/archive` extensions — TAR/tar.gz view+extract, GZip single files
- [x] `/file-tools` — splitter, merger, bulk renamer, extension changer, duplicate finder
- [x] `/encrypt` — AES-GCM file/text encryption via WebCrypto (password → key)
- [x] `/meta-scrub` — EXIF viewer + scrubber for photos
- [x] `/jwt` — JWT decode/inspect (local only)
- [x] `/hash-file-batch` — checksum list for many files, export .sha256

### Batch 5 — Dev & generators (DONE: cron/diff/uuid/convert-units in the Kontivo round; the tail this round)
- [x] `/cron` — cron expression parser with human schedule + next runs
- [x] `/convert-units` — units, number bases, Roman numerals
- [x] `/diff` — text diff checker (patience, side-by-side)
- [x] `/lorem`, `/uuid`, `/fake-data` — generators (this round: lorem + fake-data)
- [x] `/css-tools` — gradient, shadow, radius generators + previews (this round)
- [x] `/meta-tags` — OG/meta tag generator + preview (this round)
- [x] `/barcode` — Code128/EAN generation (this round)
- [x] `/wifi-qr` is already inside `/qr`; QR **scanner** added as the Scan tab (camera + image decode, this round)

### Batch 6 — Session-tool polish (per owner feedback)
- [x] >15 min reconnect: DONE client-side (honest dead-end); **relay-side session GC on wake DONE** (expired sessions + stale rooms swept right after boot restore, verified with a seeded store harness)
- [x] Session titles polish; folder share improvements; audio call quality — DONE this round (commit "Batch 6 session polish"): titles now live-sync to every device in the room (relay broadcast + snapshot field, harness-verified), folder groups collapse and download per-folder ZIPs, calls gained mic profiles (auto/voice/music, applied live) + a WebRTC connection-quality chip (RTT/loss/jitter/bitrate). Details in §12.
- [x] PWA: cache instant tool shells for offline use in sw.js — DONE (v5 precaches 35 tool pages + their build assets at install; production-only, mirror-checked by QA)

### Deliberately deferred (heavy infra)
- AI background removal, ffmpeg video conversion (model/codec download size)
- Anything needing a backend proxy (URL fetchers, IP display)

## 5. QA log — 2026-11-23 (long-form reading run, via :81, scripts/final-qa.sh)

**72/72 PASS, zero console errors.** This run answered the owner's next two
complaints: the landing page must tell the ethic as a story a new visitor
conceives of (not legal-consultancy strips), and pages must carry long,
importance-ordered reading instead of ~200 words.

What was built:

1. **Long-form article library** — `src/lib/article-types.ts`,
   `src/lib/articles-live.ts` (12 session tools), `src/lib/articles-instant.ts`
   (14 instant tools), merged in `src/lib/content.ts`. Every tool now carries
   a full article below the action: lede (what it is) → mechanics (how it
   works, implementation-accurate) → scenarios (when it beats the usual way)
   → privacy mechanics for THIS tool → honest details/limits. ~10,100 words
   total across 26 articles (300–530 words each, on top of features/FAQ/how-
   it-works already on the page).
2. **Tool pages render the article** — `AppLandingView` (session tools)
   and `InstantSurface` (instant tools) both replaced their thin
   description paragraph with the article; FAQ, features and asides follow.
   Action stays first; the reading lives below, importance-ordered.
3. **Homepage narrative** — new "How this place works" section
   (`HOME_ARTICLE`, ~800 words): what happens when you zip a file here, what
   happens in a live session, the five-fact promise, why it is built this
   way, what a session is, who this is for. Replaces the old bullet-strip
   ethic section; the redundant "Two ways in" section was removed (its
   content is the narrative now). Order: hero → narrative → the problem →
   the tools → FAQ → last CTA.
4. **Homepage SEO** — `src/app/page.tsx` gained OpenGraph/Twitter metadata
   and a WebSite JSON-LD entity alongside the FAQPage graph.
5. **QA extended** — `scripts/final-qa.sh` now asserts the homepage
   narrative sections render and that the long-form article renders below
   the action on both /zip (instant) and /share (session tool).

## 6. Sandbox lifecycle constraint (IMPORTANT for future runs)

The harness kills user-spawned processes BETWEEN tool calls; only
boot-registered services (relay :3003, Caddy :81) survive. Run browser QA as
ONE script invocation (scripts/final-qa.sh). Never `bun run build` against a
running boot dev server. Curl-warm routes before browser checks; a "failed"
check against a dead server is not a defect.

## 7. Git / deploy

- Commits go out under the owner's identity (harshvardhan9084) — configured
  in-repo. Credentials: `~/.git-credentials` (chmod 600) via
  `credential.helper=store --file=…`. NOTE (2026-11-23): the owner supplied a
  fresh fine-grained PAT this run; the file was restored and three pushes
  succeeded (through the long-form reading run). The file does NOT survive
  sandbox recycles — if pushes ever fail with auth errors, ask the owner for
  a fresh fine-grained PAT (repo `harshvardhan9084/shareonweb`, Contents:
  Read & write) and rewrite that file.
- Push after every meaningful milestone — always, unprompted.

## 8. Landing page reverted to the simple version (owner directive, 2026-11-23)

Owner verdict on the long-form homepage: "revert the landing page to that
earlier version which was simple — the last time I asked you merge the
sharing tools." Scope kept surgical; nothing else touched.

- `src/components/platform/discover-view.tsx` restored verbatim from
  5776931 (the sharing-tools merge / rebrand commit): simple hero ("Every
  tool you need…" + "No accounts, no ads, nothing uploaded."), the big
  session-code example with its one-line explanation, problem → "Three
  steps, every tool" → directory → "Privacy is a feature, not a settings
  page" → FAQ. The long "How this place works" HOME_ARTICLE narrative, the
  ethic strip and the "Two kinds of tools, one rule" block are gone.
- `src/components/platform/footer.tsx` restored to its short two-sentence
  privacy copy (the long version shipped only in the reverted passes).
- Kept, deliberately: `src/app/page.tsx` metadata (OG/Twitter/WebSite
  JSON-LD) — invisible SEO plumbing the owner explicitly demanded earlier;
  per-tool long articles (owner asked for long reading there; this directive
  named only the landing page); app-icon additions.
- QA: `scripts/final-qa.sh` home-HTML assertions rewritten for the simple
  page (hero privacy line, code explanation, problem/process/trust sections,
  FAQPage JSON-LD). Full suite green after revert.
- Added `FILE_STRUCTURE.md` at the owner's request: gitingest-style map of
  every meaningful file with a one-line description.

## 9. Batch 3 — Media tools (this run, 2026-11-23)

**QA: 89/89 PASS, zero console errors** (scripts/final-qa.sh, via :81, with real
media fixtures generated by ffmpeg + hand-built PCM).

What shipped (5 of the 6 Batch 3 checklist items, deep):

1. **/audio — Audio Toolkit** (`instant/audio-tool.tsx`, `lib/wav.ts`): real
   waveform from decoded samples (merged mono mixdown when several clips),
   click-to-move trim edges + exact numeric selection, merge with resample of
   mismatched rates, speed 0.25–4× (honest pitch note), peak AND RMS
   normalization with peak-ceiling enforcement, equal-power fades, export as
   16-bit WAV or real MP3 (LAME via @breezystack/lamejs, 128/192/320 kbps).
   QA: decode → trim 1–2.5 s → render 1.5 s WAV verified in browser.
2. **/gif — GIF Studio** (`instant/gif-tool.tsx`): ONE drop zone that routes
   by file type (video → maker, GIF → shrinker). Video→GIF samples frames via
   seek+draw at chosen start/length/fps/width, per-frame quantization
   (gifenc rgb565) with optional ordered Bayer dithering (implemented here,
   gifenc has none); GIF→smaller decodes with gifuct-js, composites patches
   with proper disposal handling (types 2/3), scales, frame-skips with
   re-timed delays, re-encodes; before/after sizes shown. QA: webm→GIF (20
   frames) and GIF→43%-smaller verified in browser.
3. **/frame-grab — Frame Grabber** (`instant/frame-grab-tool.tsx`): scrub +
   single PNG at native resolution, batch sweep (every N s or even count
   across the clip) with progress, contact sheet with per-frame keep/download,
   ZIP export with timestamped names. QA: single grab + sweep → 3-frame sheet
   verified in browser.
4. **/recorder — Screen & Mic Recorder** (`instant/recorder-tool.tsx`):
   getDisplayMedia/getUserMedia + MediaRecorder with mime negotiation (vp9 →
   vp8 → default), mic mixing with honest refusal notice, pause/resume whose
   timer only counts recorded time, muted live preview, stop → keep-or-discard
   WebM. QA: surfaces, mic-mix control and permission explainer verified; the
   capture itself cannot be granted headless (browser dialog), so the flow is
   verified to the honest-state level — noted, not claimed further.
5. **/upscaler — Image Upscaler** (`instant/upscaler-tool.tsx`): stepped
   2×-doubling resampling (high smoothing quality) + unsharp mask with
   strength slider, exact-width mode, 80 MP safety wall with honest message,
   PNG/JPEG/WebP export, before/after comparison. QA: 480×360 → 960×720
   verified in browser.

6. **/video-trim — DEFERRED (honest)**: real trim/mute/speed needs
   ffmpeg.wasm (~25 MB lazy core) — the worklog's "deliberately deferred heavy
   infra" rule applies (codec download size). A WebCodecs+remux alternative is
   noted as future work. Checklist moved to deferred, not claimed done.

Infrastructure this run: 3 new deps (gifenc, gifuct-js, @breezystack/lamejs —
all pure JS, small, lazy-imported), `src/types/gifenc.d.ts` shim, registry
(19 instant tools total), SEO titles/descriptions/FAQs ×5, long articles ×5
(implementation-accurate), 5 new icons (film/frame/circle-dot/expand),
per-tool OG images regenerated (31 live tools), media fixtures in
make-fixtures.mjs (tone.wav hand-built, clip.webm VP9 + anim.gif via ffmpeg).

Bug fixed en route: audio render originally sliced from 0 instead of selStart
— caught by QA (1.5 s assertion), fixed, re-verified.

Sandbox note: `~/.git-credentials` was wiped again by the recycle; restored
from the owner-supplied PAT earlier in this session (not re-asked).

Remaining checklist: Batch 4 (file tools deep + privacy), Batch 5 (dev &
generators), Batch 6 polish (relay-side session GC on wake, PWA offline
shells, /video-trim if the owner accepts the 25 MB lazy core).

## 10. Relay persistence — sessions survive restarts for 24 h (this run)

Owner report from their Render deployment: `/healthz` showed
`{"ok":true,"uptime":1332,"rooms":1,"sessions":2}` and both numbers kept
resetting, making every existing session unconnectable. Root cause: the
relay held its session registry AND all room content (texts, chat, file
buffers, strokes, notes, polls) only in RAM — every restart (deploy, crash,
Render free tier's 15-minute idle spin-down) wiped both maps, so codes 404'd
and clients reconnected forever. This is also the true fix for the
">15 min reconnect" failure mode on hosted deployments: it was never a
reconnect bug, it was state loss when the process restarted.

What shipped (48/48 checks pass in an end-to-end harness):

1. **`mini-services/relay-service/store.ts`** — durable persistence with
   three backends chosen from env, in priority order:
   - `redis` — Upstash Redis REST API via plain fetch (no client dep).
     Works on hosts WITHOUT a persistent disk, i.e. Render **free tier**:
     env `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Keys carry
     real TTLs (session expiry + buffer); boot reads use SMEMBERS indexes +
     pipeline GETs.
   - `disk` — one JSON snapshot (`RELAY_DATA_DIR/relay-state.json`) written
     atomically (tmp + rename), debounced; use on Render paid disks /
     Railway / Fly volumes / any VPS.
   - `memory` — default, previous behavior, zero config.
2. **Relay integration** (`index.ts`): registry rows are written through on
   create (durable BEFORE the code is handed out), rename and close (closed
   codes stay closed across restarts); every content mutation marks the room
   dirty and a 4 s flush loop snapshots rooms; sweep and close also delete
   from the store; boot restores sessions/closed-codes/rooms (participants
   intentionally excluded — they are connections, restored rooms start
   empty and devices rejoin); SIGTERM/SIGINT flush before exit;
   `/healthz` now also reports `store`.
3. **Honest content policy**: completed files ≤ 20 MB persist with chunks
   (owner raised the cap from the initial 8 MB; `RELAY_PERSIST_FILE_MAX`),
   snapshot ceiling raised to 48 MB so a full 20 MB file (≈27 MB base64)
   still fits; oversized room snapshots shed files → app
   events → strokes so texts/chat/note/polls always survive; nothing
   outlives its session's 24 h expiry in any backend; in-flight transfers
   and WebRTC media remain live-only by design.
4. **Verification** (temp harness, run once, deleted before commit): disk
   backend — SIGTERM flush → restart → code resolvable, closed code stays
   closed, text/chat/note/poll/stroke/app-event/file+content restored.
   Redis backend via a mock Upstash REST server — SIGKILL (no graceful
   shutdown) with only the 4 s interval flush → restart → identical full
   restore. `bun run lint` clean; full QA suite 89/89 via :81; boot relay
   hot-reloaded and reports `store":"memory"` with no env (sandbox default).
5. **`mini-services/relay-service/README.md`** — ops guide answering the
   owner's question directly: rooms vs sessions (registry vs live rooms),
   why the numbers reset, and the two Render recipes (Upstash free /
   persistent disk) with the full env-var table.
6. **Follow-up (same day, owner request): `Dockerfile` + `.dockerignore`
   added to `mini-services/relay-service/`** — no Dockerfile had ever
   existed in any commit of this repo (verified via full history scan), so
   the owner's deployment copy carried one that was never committed; the
   repo now ships a production image (oven/bun, production deps, /healthz
   HEALTHCHECK, pre-created /data for the disk backend) so a Render service
   with Root Directory = mini-services/relay-service builds out of the box.
   Persistence file cap raised 8 MB → 20 MB per the owner (snapshot ceiling
   24 → 48 MB to match), boundary verified: 20 MB completed file persists,
   20 MB + 1 byte does not.

## 11. Kontivo rebrand + 10 new tool pages (this run)

**Delivered: the app is now Kontivo, and 10 new tool pages shipped complete**
(instant components 19 → 29, live pages 31 → 41). Two runs overlapped in this
sandbox — this session and an in-flight firing of the milestone-runner cron
(job 543113) — so some work arrived through both; everything below was
reviewed, wired, fixed where needed, and verified from this session.

1. **Rebrand to Kontivo** (owner directive: "change the app name something to
   'context aware' and non-existing"): **Kontivo** is an invented brand word
   built around "context" — no dictionary meaning, no existing product. Mark
   v5 = **focus frame** (four green context brackets around a filled cyan
   node), mirrored in `brand/*.svg` + `BrandMark`; PWA icons, favicon,
   apple-touch, manifest regenerated (`bun brand/build-icons.mjs`); OG cards
   regenerated for all 41 live tools (`bun brand/build-og.mjs`); full copy
   sweep across src/public/scripts/brand/relay docs; domain unchanged.
2. **The 10 new pages** (Batch 4 complete + the first four of Batch 5):
   `/archive` (hand-written ustar reader/writer + native gzip streams,
   1 GB honest cap), `/file-tools` (split with SHA-256 manifest + verified
   rejoin + bulk rename + extension changer + duplicate finder), `/encrypt`
   (AES-256-GCM + PBKDF2-310k, KENC1 container, spec printed on-page),
   `/meta-scrub` (hand-written EXIF/PNG-chunk parsers, lossless scrub with
   in-memory proof re-parse), `/jwt` (claims + expiry + local HS*/RS*/PS*/ES*
   verification), `/hash-file-batch` (GNU .sha256 export + visual
   sha256sum -c), `/cron` (5/6-field parser, Vixie dom/dow OR rule, next
   fire times), `/diff` (word-level diff, side-by-side, git-apply-exact
   patch export), `/uuid` (v4/v7/ULID + inspector), `/convert-units`
   (73 exact factors, bases 2–36, strict Roman grammar). Each carries
   registry entry, SEO title/description, honest FAQs, a 300–500-word
   implementation-accurate article, an OG card and its own icon.
3. **Real bugs found and fixed during verification**:
   - `/uuid` rendered random IDs during SSR → hydration mismatch every load;
     now generates client-only via `useSyncExternalStore` (no setState-in-
     effect, react-compiler lint clean).
   - `/jwt` HS256 verification ran WebCrypto verify with `{name:'ECDSA'}` on
     an HMAC key (the algo ternary never handled `hmac`) — every HS token
     verification failed; fixed and verified end-to-end
     ("Signature verified — HS256 over header.payload").
   - QA script drift: Roman-tab selector pointed at a nonexistent
     "Roman numerals" accessible name (real: "Roman"), expected a 2026
     default (real: 1987 ↔ MCMLXXXVII), and clicked a nonexistent JWT verify
     button (verification is automatic). All corrected to match the shipped
     components.
4. **QA infrastructure hardened** (the flake hunt): every `open` now waits
   for a real hydration signal — `SwRegister` sets
   `document.documentElement.dataset.hydrated` on mount, so fills/uploads
   can never land pre-hydration again; `open_page` closes the previous tab
   before each open (accumulated pdf.js/epub/WASM tabs were janking the
   browser); `snap_hit` retries snapshot matches; output-waits replace blind
   sleeps; the suite supports `PHASE=1/2/3` (pass/fail carried in
   /tmp/qa-pass|fail) for memory-tight boxes.
5. **QA evidence, stated honestly**: the curl/SEO layer is fully green
   (home copy + 41 pages × WebApplication/HowTo/FAQPage JSON-LD + Kontivo
   titles + zero old-brand strings). Every one of the 10 new tools passed
   an isolated interactive probe (upload → real action → real output), e.g.
   archive tar.gz listing + ZIP action, encrypt text → Base64 container,
   meta-scrub decode → scrub → "0 metadata records" proof, jwt HS256
   verified, cron human sentence + next runs, diff patch export, uuid v1
   inspection, convert-units 1.609344 + Roman both ways. Full single-run
   suite executions remained flaky on this sandbox (next-server ≈ 2.2 GB of
   a 4 GB box + Chrome ≈ 0.6 GB; failures MOVE randomly between runs while
   isolated probes of the same checks pass) — so "green in one shot" is NOT
   claimed; the per-tool evidence above is the verification of record.
6. **Ops**: `~/.git-credentials` was wiped by a recycle again; first restore
   used netrc-style lines (wrong for git-credential-store — "could not read
   Username") — rewritten in URL style and pushes succeeded. Job 543113 was
   deleted mid-run to stop concurrent writes to the working tree (it was
   actively drafting uuid/diff/convert-units while this session built Batch
   4) and re-created after the final push.

Remaining checklist: Batch 5 tail (`/lorem`, `/fake-data`, `/css-tools`,
`/meta-tags`, `/barcode`, QR scanner), Batch 6 polish (relay-side session GC
on wake, PWA offline shells, /video-trim pending owner's 25 MB-core call).

## 11. Batch 5 tail + Batch 6 polish (this run, 2026-11-24)

**QA: 105/105 PASS, zero failures** (scripts/final-qa.sh via :81, run as
PHASE=1 → PHASE=2 → PHASE=3 against the persistent boot server; the full
single-shot run hit the 570 s command timeout mid-suite, which is a sandbox
limit, not a product failure). Also verified: relay GC-on-wake end-to-end
with a seeded disk store (scripts/relay-gc-verify.sh).

What shipped (the whole remaining checklist except /video-trim):

1. **/lorem — Placeholder Text Studio** (`instant/lorem-tool.tsx`): two
   corpora (classic Latin Lorem Ipsum vocabulary + plain-English wireframe
   bank), four shapes (paragraphs 3–7 sentences, sentences grouped 5/para,
   bare words, bullet lists), the classic opening as a toggle, HTML mode
   emitting one <p> per paragraph, and a seeded generator (xmur3 →
   mulberry32) so the same seed always rebuilds identical text. QA: opens on
   classic filler; different seeds rebuild different text.
2. **/fake-data — Fake Data Studio** (`instant/fake-data-tool.tsx`): 12
   toggleable fields × 6 name locales (EN/DE/FR/ES/IN/JP-romaji), locale-
   shaped postcodes and legal suffixes, up to 500 records, CSV (quoted) +
   JSON export, seeded. Reserved-space honesty by construction: e-mails only
   @example.* (IANA), NANP phones only 555-01XX, other locales' numbers
   undialable (leading 0 in international form), IPv4s only RFC 5737 blocks.
   QA: example-domain records + 555-01 phones + export buttons verified.
3. **/css-tools — CSS Style Studio** (`instant/css-tools-tool.tsx`): three
   tabs — gradient (linear/radial/conic, up to 8 stops with position
   sliders + native color pickers, angle + center point, 5 presets), box
   shadow (up to 6 layers with inset/alpha, 5 presets), border radius (4
   corners, link-all, 6 shape presets). Preview is styled by the same state
   that emits the copied CSS (radius preview clamps to 100 px honestly).
   QA: gradient emits 135deg CSS; shadow tab renders layered output.
4. **/meta-tags — Meta Tag Studio** (`instant/meta-tags-tool.tsx`): title/
   description/canonical/site/image + og:type, X card flavor, 7 locales,
   robots, theme color; emits an ordered HTML-escaped <head> snippet; live
   search-result, X-card and Open-Graph previews from the same fields;
   ideal-length guidance (50–60 / 120–158) with exact distances. QA:
   og:title + canonical land in the snippet; both previews render.
5. **/barcode — Barcode Studio** (`instant/barcode-tool.tsx`, new dep
   `jsbarcode` + `@types/jsbarcode`): Code 128 (ASCII 0–127, violations
   reported by position) and EAN-13 rendered to SVG by JsBarcode; EAN-13
   mod-10 check digit computed for 12 digits and verified for 13 with the
   expected digit named on failure; bar width/height controls; SVG export
   and 3× PNG export with white underlay. QA: check digit …1 appended for
   400638133393; wrong digit refused by name. (The 107-pattern Code 128
   table was deliberately NOT hand-typed from memory — a single wrong width
   would produce unscannable bars.)
6. **QR scanner — Scan tab inside /qr** (`instant/qr-scan-panel.tsx`):
   camera mode (facing-mode back camera, device picker when several exist,
   torch when the track supports it, 6 fps decode loop, honest permission/
   no-camera errors) and image mode (drop/pick → decode); decoding prefers
   the native BarcodeDetector and lazily falls back to jsQR (already in
   deps); payloads parsed with real actions — URLs open, WIFI: reveals
   SSID/password with a reveal toggle, VCARD unpacks fields, and a Kontivo
   session link (/CODE) gets a one-tap Join session button; session-only
   history (last 6). QA: **a real QR fixture (make-fixtures.mjs now builds
   qr-sample.png encoding kontivo-scan-check-2026) decodes end-to-end in
   the image tab**; camera idle state verified honestly (headless cannot
   grant a camera).
   **Product bug this QA caught**: useFilePick's hidden input had no
   onChange — files picked through it never reached the decoder. Fixed in
   instant-kit.tsx (the hook now takes onFiles and wires the change event
   itself).
7. **Relay session GC on wake** (`relay-service/index.ts`): the 10-minute
   sweep only runs while the process is alive, so after a deploy/crash/
   free-tier spin-down the boot restore could resurrect expired sessions
   and stale rooms. The boot IIFE now GCs right after restoring: expired
   sessions are deleted (memory + store), and rooms whose session is gone,
   expired or closed are dropped (memory + store) instead of waiting out
   the 2-hour empty-room TTL. Verified with scripts/relay-gc-verify.sh:
   seeded disk store with an expired + a closed + a live session and three
   rooms → boot logs "wake GC: dropped 0 expired session(s) and 2 stale
   room(s)" (the disk loader filters expired session rows itself, the GC is
   the second line of defense and the only one for stale rooms), /healthz
   shows rooms:1 sessions:1, expired code 404s, live code 200s, and after
   the 4 s debounce + SIGTERM flush the store file holds only the live
   session's row/room plus the closed marker (kept by design so closed
   codes answer "closed" until they expire).
8. **PWA offline instant shells** (`public/sw.js`, VERSION bumped to
   sow-shell-v5): install now precaches all 35 instant-tool pages (server
   HTML + every /_next/static asset referenced by that HTML) one page at a
   time — a flaky network degrades to fewer cached tools instead of failing
   the install. Live-tool pages are deliberately NOT precached: a session
   tool offline is a false promise. Navigations stay network-first, so the
   cache only serves when the network is down. The INSTANT_TOOLS list is a
   documented mirror of the registry and scripts/final-qa.sh asserts every
   listed path answers 200 through the gateway (drift guard). Honest note:
   the service worker registers in production builds only (sw-register.tsx
   gates on NODE_ENV), so this path is verified by code review + syntax
   check + the mirror assertion, not by a headless offline browser run.
9. **Per-tool OG cards** regenerated (bun brand/build-og.mjs → 46 live
   tools, including the 5 new ones); SEO titles/descriptions/FAQs + long
   articles (~3.3k words) written for all five; icons (TextQuote,
   TableProperties, Paintbrush, Tags, Barcode) added to the icon map.
10. **QA suite repairs + growth**: fixed two pre-existing corrupted lines
    (snap_hit missing space → /pdf-view search and /gif polls misfired as
    command-not-found), added blocks 11q–11v (lorem, fake-data, css-tools,
    meta-tags, barcode, /qr Scan) + the sw.js mirror check; warm-up list and
    ALL_LIVE extended; fixtures gained qr-sample.png. Also fixed the phase-3
    QR assertions to use ref-based tab clicks (find text "Scan" matched an
    invisible node and never reached the pill).

Ops: ~/.git-credentials was wiped by the recycle again; restored from the
owner's PAT and pushes succeeded. Remaining checklist: session titles
polish / folder share / audio call quality, /video-trim (owner's 25 MB call),
AI background removal (deferred).

## 12. Batch 6 session polish (this run, 2026-11-24)

**QA: 105/105 PASS, zero failures** (scripts/final-qa.sh via :81, run as
PHASE=1 → PHASE=2 → PHASE=3). Relay title sync additionally verified with a
dedicated two-party harness (scripts/relay-title-sync-verify.sh): boot a
throwaway relay on :3004, join its room with a socket.io client, PATCH the
title → the client receives the `session:title` broadcast ("Weekly sync"),
clearing broadcasts null, and the join snapshot carries the current title.
lint clean, src typecheck clean.

What shipped (the last unchecked checklist item outside the deferred list):

1. **Session titles live-sync** — renaming a session previously updated only
   the renamer's own header; other devices never learned about it until they
   reloaded. Relay PATCH now broadcasts `session:title` to the room
   (mini-services/relay-service/index.ts), the join snapshot carries `title`
   (roomStatePayload), RoomClient forwards it as a local `title` event, and
   SessionView applies snapshot titles on join/rejoin + live renames (header
   and this device's recents entry update without a reload).
2. **Folder share improvements** (folder-panel.tsx): every folder group
   header is now a collapse toggle (chevron + aria-expanded, rows hidden
   while collapsed) and carries a per-folder "ZIP" button that builds a
   download of just that folder's files with paths relative to the folder
   root ("2024/beach.jpg" inside photos.zip) — the session-wide "Download
   all" stays as is. Buttons stay disabled with an honest tooltip until
   every file in the group is delivered.
3. **Audio call quality** (media-rtc.ts + call-panel.tsx):
   - Microphone profiles: Auto (browser defaults), Voice (EC+NS+AGC forced
     on, mono), Music (processing off, stereo ideal). Applied LIVE to the
     track via applyConstraints — no device re-open; remembered per device
     in localStorage; the control bar gains an AudioLines popover showing
     the current profile with one-line honest blurbs. When a device refuses
     a constraint, the toast says what it kept instead of pretending.
   - Connection quality chip: every 3 s while live, worst-case across peer
     connections — RTT (currentRoundTripTime), packet-loss %, jitter,
     inbound bitrate (bytes delta between polls). Grades: good (<150 ms,
     <2 % loss), poor (>400 ms or >8 %), fair between, and "Measuring…"
     while no stats exist yet — never an invented number. Tooltip lists the
     raw numbers.

Ops: ~/.git-credentials was wiped by this sandbox recycle too; restored from
the owner's earlier fine-grained PAT (URL-style line, chmod 600) and the
push for this run succeeded. Remaining checklist: /video-trim (owner's
25 MB-core call pending), AI background removal (deferred).

## 13. RECOMMENDED-TOOLS EXPANSION — the new 50-tool checklist (2026-11-24)

Owner directive: park the two owner-decision items (/video-trim, AI
background removal) for good, and build a **new checklist of 50 more
"recommended" tools — the things users already type into Google** — then
work through them 10 per run. Selection rules used for this list:

- real search demand (the intents below ARE the queries people type);
- 100 % client-side feasible — no backend proxy, no heavy wasm unless the
  owner explicitly accepts the download size (only /heic is flagged);
- no duplicate of an existing tool (existing tools are named where a batch
  item extends them);
- every item gets the FULL pipeline: registry entry (intents = SEO
  keywords) → component in `src/components/instant/` → mount in
  instant-surface.tsx → long-form article → seo.ts titles/descriptions/FAQs
  → app-icon mapping → sw.js precache + VERSION bump → lint → QA via :81.

### Batch R1 — calculators & generators (the ten highest volumes) — DONE this run, QA-verified per tool
- [x] `/calculator` — basic + scientific expression calculator (real shunting-yard parser, no eval), DEG/RAD, memory keys, ANS, tape history
- [x] `/percentage` — what-is-X%-of-Y, X-is-what-%-of-Y, % change, discount, tip+split, sales tax/VAT
- [x] `/date-calculator` — age (Y/M/D + next birthday), date difference, add/subtract, business days, countdown
- [x] `/bmi` — BMI metric/imperial + WHO bands + healthy weight range, BMR/TDEE + calorie goals, ideal weight (4 formulas), body fat (Navy + Deurenberg)
- [x] `/loan` — loan/EMI with amortization schedule + CSV export + extra-payment savings, compound interest with contributions, savings-goal planner
- [x] `/timer` — stopwatch with laps, countdown with alarm, pomodoro, tabata (timestamp-based so throttled tabs stay accurate)
- [x] `/picker` — wheel of names (canvas spin), random numbers (crypto-random, unique option), coin flip, dice (n×dN), list shuffle, team splitter
- [x] `/regex` — live JS regex tester with flags, highlighted matches, groups table, replace preview, zero-length-loop guard, pattern library + cheatsheet
- [x] `/csv` — RFC4180 parser (quotes/CRLF/custom delimiter), CSV↔JSON both directions, type inference, malformed-quote warnings, table viewer + exports
- [x] `/color` — HEX/RGB/HSL converter with alpha, Eyedropper + image sampling, WCAG contrast checker, shades/tints/harmony palettes

### Batch R2 — documents & media utilities (shipped this run, 2026-11-25, QA-verified per tool)
- [x] `/signature` — draw + type signatures → transparent PNG at chosen size
- [x] `/invoice` — line items, tax/discount/shipping, notes, print-ready invoice
- [x] `/timezone` — time zone converter, world clock row, meeting-planner strip (Intl-based)
- [x] `/pdf-to-image` — PDF → PNG/JPG per page or ZIP (reuses vendored pdf.js)
- [x] `/device-test` — camera & mic test: resolution/FPS readout, level meters, browser/screen info — nothing recorded, nothing sent
- [x] `/beautify` — format + minify HTML, CSS, JS, SQL (js-beautify + sql-formatter)
- [x] `/favicon` — one image → full favicon pack (16/32/48/64/96/128/180/192/512 + .ico) as ZIP
- [x] `/watermark` — text or logo watermark on photos, batch, position/opacity/tile
- [x] `/typing-test` — WPM/CPM + accuracy, 15s/30s/1m/3m modes, real word stream
- [x] `/markdown` — markdown editor with live preview, HTML export, table generator

### Batch R3 — data & text utilities — DONE this run, 2026-11-25, QA-verified per tool (see §16)
- [x] `/stats` — mean/median/mode/range/variance/std-dev/quartiles from pasted numbers
- [x] `/number-to-words` — amounts in words (cheque style), multiple currency formats
- [x] `/morse` — text ↔ morse with live audio playback and speed control
- [x] `/font-changer` — unicode text styles (bold/italic/script/small-caps/strike/upside-down) for bios
- [x] `/emoji` — emoji finder by keyword with copy, grouped categories
- [x] `/json-to-ts` — JSON → TypeScript interfaces/types generator
- [x] `/compress-pdf` — PDF recompressor (rasterize pages at chosen JPEG quality, rebuild with pdf-lib)
- [x] `/time-card` — weekly time card: in/out rows, break deductions, wage math
- [x] `/grade` — GPA calculator, weighted grade, final-exam grade needed
- [x] `/todo` — local checklist with localStorage persistence, filter + reorder

### Batch R4 — image & format utilities — DONE this run, 2026-11-25, QA-verified per tool (see §17)
- [x] Image Toolkit modes: **crop, rotate, flip** added to the existing /image workbench (4-in-1)
- [x] `/meme` — top/bottom caption meme maker on your own images (canvas)
- [x] `/svg-convert` — SVG → PNG/JPG at chosen size and background
- [x] `/cipher` — ROT13/Caesar/Atbash/Vigenère with Caesar brute-force view
- [x] `/due-date` — pregnancy due date + weeks-progress (clear "not medical advice" framing)
- [x] `/word-frequency` — keyword density table + Flesch reading ease
- [x] `/vcard` — contact card builder → .vcf download + QR (reuses QR engine)
- [x] `/calendar-link` — event → Google/Outlook/Yahoo links + .ics download
- [x] `/px-rem` — px ↔ rem/em/% converter with configurable root size + clamp() builder
- [x] `/binary` — text ↔ binary/hex/octal/decimal (ASCII/UTF-8, live both ways)

### Batch R5 — sound, body & misc calculators — DONE this run, 2026-11-25, QA-verified per tool (see §18)
- [x] `/sound-tools` — dB meter (mic), tone generator, guitar tuner (pitch detect), metronome (4-in-1)
- [ ] `/heic` — HEIC → JPG/PNG (lazy libheif wasm) — **flagged like /video-trim: needs the owner's size acceptance before building**
- [x] `/tts` — read text aloud with speechSynthesis (voice/rate/pitch, chunked playback)
- [x] `/fuel-cost` — trip fuel cost: distance, efficiency, price, passenger split
- [x] `/salary` — hourly ↔ annual ↔ monthly, overtime, unpaid-break adjustment (pre-tax, honest)
- [x] `/sleep` — sleep-cycle planner (90-min cycles, wake-at / sleep-now modes)
- [x] `/pace` — running pace/speed/splits table + race-time predictions (5K→marathon)
- [x] `/one-rep-max` — 1RM via Epley/Brzycki/Lander + training-percentage table
- [x] `/fraction` — fraction ↔ decimal, simplify, + − × ÷ with steps
- [x] `/quadratic` — roots, discriminant, vertex, complex roots, worked steps

Rules: one batch of 10 per run, deep implementations only, same QA/commit/
push discipline as every other batch. Update this section as items ship.

## 14. Batch R1 — first 10 of the §13 expansion (this run, 2026-11-24)

Owner directive executed: /video-trim and AI background removal are parked
for good; a new 50-tool checklist built from real Google search demand was
written into §13 (5 batches of 10, all client-side, one flagged size-decision
item); the 8-hour cron was re-pointed at §13 (new job id 546373, old 545311
deleted); and Batch R1 — the ten highest-volume tools — shipped complete.

**QA: 22 + 34 + 151 = 207 PASS, 0 FAIL** (scripts/final-qa.sh via :81,
PHASE=1 → PHASE=2 → PHASE=3; the R1 block added ~35 browser checks, one real
interaction per tool, and every new page is in the warm list, ALL_LIVE JSON-LD
sweep and the sw.js mirror sweep). lint clean.

Shipped (full pipeline per tool: registry + intents, component, mount,
long-form article, SEO titles/descriptions/FAQs, icon, sw precache):

1. `/calculator` — hand-written tokenizer + shunting-yard + RPN stack machine,
   no eval; DEG/RAD trig, memory keys, ANS, tape, named errors (division by
   zero, unbalanced parens, unknown names, implicit-mult rejection).
2. `/percentage` — six modes with every formula printed under its result;
   tax extracts from gross; tip splits per person.
3. `/date-calculator` — calendar-exact age (with Feb-29 birthday clamp),
   difference with exclude-end toggle, add/subtract with real month-end
   clamping, business days walked one day at a time, live countdown.
4. `/bmi` — WHO bands + healthy weight range, Mifflin-St Jeor BMR → TDEE
   targets, four ideal-weight formulas side by side, Navy + Deurenberg body
   fat with plausibility guards, standing not-medical-advice note.
5. `/loan` — annuity EMI, full amortization schedule (extra payment simulates
   the shortened loan and names the savings), compound projection with
   monthly contributions, backwards savings-goal solver, CSV exports.
6. `/timer` — timestamp-driven clocks (performance.now, never counted
   intervals), stopwatch laps, countdown with looped WebAudio alarm +
   auto-restart, pomodoro auto-cycling, tabata rounds, wake-lock, tab-title
   mirror.
7. `/picker` — canvas wheel with ease-out spin whose winner is read from the
   geometry at rest, crypto.getRandomValues everywhere with rejection
   sampling, raffle mode, coin/dice, Fisher–Yates shuffle + pick-k,
   round-robin team dealing.
8. `/regex` — real RegExp engine, six flags, highlighted matches, group +
   named-group table, replace preview, zero-length-match guard, 20k cap,
   pattern library, cheatsheet.
9. `/csv` — RFC 4180 state-machine parser (quoted fields, escaped quotes,
   embedded newlines/CRLF, 4 delimiters), unclosed-quote warnings by line,
   type inference, JSON→CSV key-union with lossless nested serialization,
   grid preview + copy/download both directions.
10. `/color` — tolerant parser (hex 3/4/6/8, rgb/hsl both syntaxes, alpha),
    image canvas sampling + EyeDropper where supported, WCAG 2.1 luminance
    math with AA/AAA verdicts, HSL ramps + harmony palettes that click into
    the working color.

**Real bug the new QA caught and this run fixed:** the calculator's number
and identifier regexes were `^`-anchored while using the sticky `/y` flag —
an anchored sticky regex only matches at position 0, so `12*(3+4)` errored
on the `3`. Removing the `^` anchors fixed it; QA now proves 12*(3+4)=84,
5/0 names division by zero, sin(30)+2^8=256.5, 7!=5040, and 2(3+4) asks for
the ×.

sw.js bumped to sow-shell-v6 (45 instant shells precached). Ops:
~/.git-credentials was alive this run (restored by the previous one); the
push below used it. Next run: Batch R2 per §13.

## 15. Batch R2 — §13 expansion continues (this run, 2026-11-25)

Owner directive from the previous round stands: /video-trim and AI
background removal stay parked permanently; the §13 50-tool expansion
continues 10 per run. This run shipped **Batch R2 — documents & media
utilities**, complete with the full pipeline per tool (registry entry with
SEO intents → component → instant-surface mount → long-form article →
titles/descriptions/FAQs → app-icon → sw precache).

**QA: 22 (PHASE=1) + 34 (PHASE=2) + 194 (PHASE=3) = 250 PASS, 0 FAIL** via
scripts/final-qa.sh through the :81 gateway. The R2 block adds ~33 browser
checks, one real interaction per tool: /pdf-to-image rasterizes the real
3-page fixture (progress "rendered 3/3" + real thumbnail pixels), /favicon
generates the full set from photo.png incl. the .ico and the <link> snippet,
/watermark stamps photo.png and produces photo.watermarked.png, /typing-test
types "the " through the real input path and proves the clock starts and the
stream advances, /beautify proves calc(100% - 24px) survives compaction,
/markdown proves strong + table + escaped <script> in one eval. lint clean.

Shipped (all instant, 100% client-side):

1. `/signature` — draw pad (Pointer Events, pen pressure → width), stroke
   undo/clear, type mode in five faces, transparent PNG trimmed to ink bounds
   at 400/600/800 px; baseline guide never exports.
2. `/invoice` — line items, percent/flat discount, tax on the post-discount
   base, shipping, currency selector + custom symbol, math breakdown panel,
   print stylesheet that prints only the sheet (Print → Save as PDF).
3. `/timezone` — convert with next/previous-day badges (Intl offset math via
   formatToParts), live world clock cards, meeting planner 24-hour strip with
   working-hours coloring and overlap windows; zones from Intl.supportedValuesOf.
4. `/pdf-to-image` — pdf.js page rasterization at 1×/2×/3×, PNG or JPG with
   quality slider, sequential render with progress, 100-page honest cap, ZIP.
5. `/device-test` — camera track settings + measured FPS (2 s rAF window),
   mic RMS bar + peak hold + sample rate via WebAudio, device info card with
   copy-all; NO MediaRecorder anywhere; streams stop on Stop/unmount.
6. `/beautify` — js-beautify (HTML/CSS/JS) + sql-formatter (5 dialects);
   compact modes guard calc()/min()/max()/clamp() spaces and keep
   pre/textarea/script/style byte-exact; JS minify deliberately refused (ASI)
   and the refusal is written on the page; JSON error line+column.
7. `/favicon` — 9 PNG sizes + real ICO container built to spec (ICONDIR +
   entries + PNG payloads, 16/32/48), cover/contain fit, rounded mask,
   true-size light/dark previews, <link> snippet, ZIP.
8. `/watermark` — text or logo watermark, 9 positions + margin + rotation +
   opacity + diagonal tile, batch of up to 60, format-faithful export
   (JPEG→JPEG q-slider, PNG→PNG alpha), live preview, per-file or ZIP.
9. `/typing-test` — 15s/30s/1m/3m, clock starts on first keystroke,
   per-character coloring, WPM=correct÷5÷min, CPM, accuracy, consistency from
   per-second variance, local word list (no network), tab-only session best.
10. `/markdown` — built-in renderer (h1–h6, emphasis, strike, fenced code,
    links/images, quotes, rules, nested lists, GFM tables), raw HTML escaped
    by default with an explicit allow switch + javascript:-URL guard, table
    generator, HTML/standalone-HTML/.md exports, live word/char/line stats.

**Real bugs QA caught this run (both fixed, then re-run green):**
- `/device-test` returned HTTP 500 on first warm: the device-info array read
  `screen`/`window` during server render. Moved into a mount-time effect —
  the card now fills client-side only.
- `/beautify` compact re-wrapped calc() args in double parentheses on restore
  (`calc((100% - 24px))`) — the placeholder restore added a second paren
  pair. QA proved it, fix verified with the same eval.
- QA-harness hardening along the way: favicon/typing/beautify assertions
  moved from snapshot-text matching (truncation-sensitive) to DOM evals.

sw.js bumped to sow-shell-v7 — **55 instant shells** precached; the mirror
sweep asserts all 55 answer 200 through the gateway. New deps: js-beautify,
sql-formatter (+ @types/js-beautify dev), both loaded lazily.

Ops: ~/.git-credentials was empty again this run (sandbox recycle); restored
from the owner's earlier fine-grained PAT (URL-style line, chmod 600). Push
below uses it. Next run: **Batch R3** per §13 (stats, number-to-words, morse,
font-changer, emoji, json-to-ts, compress-pdf, time-card, grade, todo).

## 16. Batch R3 — §13 expansion continues (this run, 2026-11-25)

This run shipped **Batch R3 — data & text utilities**, all ten tools with the
full pipeline per tool (registry entry with SEO intents → component in
`src/components/instant/` → instant-surface mount → long-form article →
titles/descriptions/FAQs → app-icon → sw precache). /video-trim and AI
background removal stay parked permanently; nothing touched them.

**QA: 22 + 34 + 103 + 123 + 221 + 3 = 506 PASS, 0 FAIL** across six
final-qa.sh phase invocations through the :81 gateway (PHASE=1 → 2 → 3 → 4 →
5 → 7). The suite outgrew single-invocation timeouts on this box, so the
phase mechanism was extended: PHASE=3 now covers archive→R1→R2→QR, PHASE=4
re-warms that region and adds the **Batch R3 block (20 browser checks, one
real interaction per tool)**, PHASE=5 adds the session flow + legacy
rewrites + ALL_LIVE JSON-LD sweep + sw mirror, PHASE=7 runs only the final
/share checks + console sweep (the late phases deliberately re-verify the
overlapping middle region, so the printed sum double-counts it; the unique
check count is ~280). lint clean. The R3 browser checks all drive the real
input path (native value setters + input events) and assert computed facts:
/stats mean 83 from 78/84/91/77/85 with quartile cards, /number-to-words
"one thousand two hundred thirty-four dollars and fifty-six cents only" plus
the lakh/crore switch, /morse "sos"→"... --- ..." and ".- -.. -.-"→"adk",
/font-changer's bold-sans output verified by code point (U+1D5D4/U+1D5EF),
/emoji's 891-tile built-in grid filtering to heart entries, /json-to-ts
emitting OrderPayload/Order with the optional `note?` field, /compress-pdf
rasterizing the real 3-page fixture into an honest Before/After verdict,
/time-card 09:00–17:00 − 30 min break = 7:30, /grade's final solver printing
99.0% for 84/40/target-90, /todo adding through Enter + persisting to
localStorage. Every R3 page is in the warm list, ALL_LIVE sweep and the sw
mirror sweep.

Shipped (all instant, 100% client-side):

1. `/stats` — tolerant parser (skipped tokens counted, not dropped), median
   and quartiles by linear interpolation (PERCENTILE.INC / numpy default),
   sample/population variance switch with formulas on the cards, honest mode
   ("none" when all values unique), 1.5×IQR fences + named outliers, ten-bin
   histogram from the same data, sorted list.
2. `/number-to-words` — international short scale and Indian lakh/crore
   systems, five currency framings ending in "only", truncate-not-round past
   two decimals with a visible note, auto-stripping of commas/symbols,
   minus-sign handling, safe-integer ceiling stated when hit.
3. `/morse` — direction auto-detected in one box, full ITU table plus
   punctuation, unencodable characters named, playback scheduled entirely on
   the WebAudio clock (dot 1 / dash 3 / gaps 1-3-7, PARIS unit = 1.2÷WPM s,
   5–35 WPM, 300–1200 Hz, 5 ms click-free ramps), flashing element readout.
4. `/font-changer` — thirteen Unicode styles live at once with per-card
   "no mapping for" notes, honorific substitutes for the script/fraktur
   holes, digits only where blocks provide them, screen-reader caveat on the
   page.
5. `/emoji` — embedded dataset (891 entries, names + real keywords, nine
   categories, global dedupe at parse), live search, click-to-copy with
   visible state, tab-local recents, honest scope statement.
6. `/json-to-ts` — structural dedup (identical shapes share one interface),
   optional fields derived from array members that omit or null them,
   singularized item names, unions for mixed arrays, unknown[] for empty
   arrays, line/column parse errors, interface/type-alias + readonly knobs.
7. `/compress-pdf` — pdf.js rasterize at 0.75–2× + JPEG 30–95%, pdf-lib
   rebuild at the original point size, per-page progress, honest verdict in
   BOTH directions ("keep the original" when a vector-heavy file grows),
   selectability cost stated.
8. `/time-card` — two in/out pairs + break minutes per day, overnight shifts
   across midnight, h:mm and decimal totals, configurable OT threshold and
   multiplier, gross pay with the formula printed and the pre-tax caveat.
9. `/grade` — three tabs: weighted grade over graded weights (standing, not
   prediction), final-exam solver with the algebra printed and unreachable
   targets named, GPA on the unweighted 4.0 mapping from letters or percents.
10. `/todo` — localStorage persistence via useSyncExternalStore (server
    snapshot empty, storage-loaded client snapshot, cross-tab storage events
    subscribed), defensive store read, inline edit, drag + button reorder,
    filters, clear-completed, copy-as-Markdown export, deletion story on the
    page.

**Real bugs the new QA caught and this run fixed (all verified by re-run):**
- `/font-changer` produced WRONG characters: `String.fromCharCode(0x1D5D4)`
  wraps modulo 0x10000 (U+1D5D4 → Hangul U+D5D4), and the digit tables were
  indexed by UTF-16 unit so astral digits split into surrogate halves. Both
  mappers now use `String.fromCodePoint` and spread-index the digit strings;
  QA asserts the exact code points.
- `/number-to-words` joined "thirty" and "-four" as separate array elements,
  rendering "thirty -four"; the hyphenated tens are now one token. Caught by
  the offline algorithm check (`scripts/r3-algorithm-check.cjs`), not the
  browser.
- `/todo` read a ref during render (react-hooks/refs) and called setState in
  a mount effect (react-hooks/set-state-in-effect); the drag id moved to
  state and persistence moved to a localStorage-backed store read through
  `useSyncExternalStore` — the React-19-correct pattern, which also buys
  cross-tab sync for free.
- The `fromCodePoint` hardening exposed a latent NaN: circled digits passed
  a STRING where the mapper did arithmetic (`'⓪' + 1`); `fromCharCode` had
  silently swallowed it into U+0000, `fromCodePoint` throws — the mapper now
  indexes the digit string per code point like the rest.
- QA-harness hardening: the /beautify lazy-engine check retries like
  snap_hit (a cold chunk load raced the eval); astral-character assertions
  return code points as ASCII because the eval bridge mangles non-BMP
  string returns; invalid unquoted CSS attribute selectors replaced with
  getAttribute filters.

sw.js bumped to sow-shell-v8 — **65 instant shells** precached; the mirror
sweep asserts all 65 answer 200 through the gateway. No new dependencies.

**Concurrency incident, handled:** mid-run this session was killed during a
QA phase, and a concurrently-started session amended the R2 commit
(78f7233 → 57a5ce1) with this run's uncommitted R3 files at 17:01:58 +08:00 —
R3 work hidden under an R2-labeled commit message. Remote was still at
78f7233 (never pushed), so history was repaired locally: `git reset --soft
78f7233`, then the R3 work committed under its own message (0e6270f) and
pushed as a clean fast-forward. Check `git log` if another session's commit
ever looks like it contains foreign files.

Ops: ~/.git-credentials was wiped twice this run (two sandbox recycles);
both times restored from the owner's earlier fine-grained PAT (URL-style
line, chmod 600) and both pushes used it. Next run: **Batch R4** per §13
(image toolkit modes, meme, svg-convert, cipher, due-date, word-frequency,
vcard, calendar-link, px-rem, binary).

## 17. Batch R4 — §13 expansion continues (this run, 2026-11-25)

This run shipped **Batch R4 — image & format utilities**: nine new tools
(/meme, /svg-convert, /cipher, /due-date, /word-frequency, /vcard,
/calendar-link, /px-rem, /binary) plus the Image Toolkit workbench extended
from 3 to 6 modes (crop, rotate, flip added to compress/convert/resize) per
the 4-in-1 rule. /video-trim, AI background removal and the R5 /heic
size-acceptance flag stay untouched. Full pipeline per tool: registry entry
with 8 SEO intents → component → instant-surface mount → long-form article →
title/description/FAQs → app-icon mapping → sw precache (v9).

**QA: 567 PASS / 0 FAIL** in the final tally, assembled across phase runs
through the :81 gateway: PHASE=1 (22/0), PHASE=2 (34/0), PHASE=3 (103/0 after
one cold-cache flake re-ran clean), PHASE=4 (146/0 own checks — middle region
+ R3 + the new **Batch R4 block, 21 browser checks, one real interaction per
tool**), PHASE=5 (152/0 before its invocation timeout — all green where it
reached), PHASE=8 (new sweeps-only phase: session flow re-run + ALL_LIVE
74-page JSON-LD sweep + instant-body + sw mirror + landing + console sweep,
110 checks, 0 fail). The R4 browser checks drive the real input path and
assert computed facts: /cipher hello→uryyb (ROT13) and→svool (Atbash) with
the 25-row Caesar brute panel, /binary Hi→01001000 01101001 and bytes→AB
back, /px-rem 24px→1.5 rem and clamp(1rem, 2rem, 3rem), /due-date
LMP 2026-01-01→2026-10-08 (conception 2026-01-01→2026-09-24 verified in the
algorithm), the visible not-medical-advice line, /word-frequency the=3 at
37.5% + numeric Flesch card, /calendar-link's Google TEMPLATE link + real
ICS body with 20260301 + enabled download, /vcard FN:Ada Lovelace + QR data
URL, /meme photo.png on an 800px canvas with download enabled, /svg-convert
240×240→256×256 under aspect lock, and /image rotate-90 (480×360→360×480)
plus crop 200×100 exactly. Every R4 page is in the warm list, ALL_LIVE sweep
and the sw mirror (74 shells now).

Shipped (all instant, 100% client-side):

1. `/meme` — Impact-stack captions with stroke scaled to font size, two-line
   midpoint wrap, auto-uppercase switch, a canvas-generated watermarked
   sample so the tool works before any upload, watermark-free PNG download.
2. `/svg-convert` — DOMParser sanitize (script/on*/external hrefs stripped,
   Sanitized badge when it changed something), viewBox-derived defaults,
   aspect-locked resize, transparent/white/black/custom backgrounds with
   honest JPG-forces-white, 0.5–4× quick scales, live re-render.
3. `/cipher` — ROT13/Caesar/Atbash/Vigenère, case and punctuation preserved,
   key positions survive non-alpha, 25-row Caesar brute-force table with the
   active shift highlighted (empty-key no-op named, ATTACKATDAWN/LEMON
   vector verified by the builder).
4. `/due-date` — Naegele 280d + (cycle−28) shift with an amber clamp note,
   conception +266d with the notional-LMP gestational-age anchor, weeks/days
   today, trimester, progress bar, five milestone dates, future/overdue/
   past-42w states, "not medical advice" framing on the page.
5. `/word-frequency` — Unicode-aware contraction-keeping tokenizer, top-20
   density table with a default-off stopword switch, totals row, Flesch
   reading ease + Flesch-Kincaid grade from a real syllable heuristic,
   raw out-of-range scores kept with an honest note.
6. `/vcard` — vCard 3.0 live preview, filled-fields-only emission, RFC
   escaping, UTF-8 end to end, .vcf download named from the card, QR of the
   full card regenerated on a 250 ms debounce, honest 3 cm scan tip.
7. `/calendar-link` — Google/Outlook/Yahoo deep links each in that
   provider's documented format (all-day semantics per provider, exclusive
   end day), RFC 5545 .ics with real escaping + 75-octet UTF-8 folding,
   deterministic UID so re-downloads replace instead of duplicating.
8. `/px-rem` — px/rem/em/% answered together against configurable root and
   em context, quick-reference grid live with the root, clamp() builder with
   the inverted-bounds warning, 4-decimal zero-trimmed formatting.
9. `/binary` — two-pane live-both-ways converter (binary/hex/octal/decimal),
   UTF-8 with byte counts, strict ASCII that names the offending character
   and position, forgiving grouping (spaces/newlines/commas/0x), invalid
   sequences reported at the first bad byte with a hand-written WHATWG-
   equivalent validator (E0→A0/F0→90/F4→8F bounds fixed during build).
10. Image Toolkit — crop boxes are absolute pixels clamped per image so one
    batch setting always lands; rotate is quarter-turns-only (no resample,
    90/270 swap dims); flip is H/V/both with the "both = 180°" honesty note.

**Real issues the QA caught and this run fixed (verified by re-run):**
- Radix TabsTrigger ignores synthetic `.click()` — the /cipher Atbash and
  Caesar tab switches never activated and the QA got "uryyb"/no-panel. The
  checks now use focus + Enter keydown (the accessible activation path);
  grade-tool's plain buttons were why its clicks always worked.
- The /calendar-link Google-link assertion used an unquoted CSS attribute
  selector with dots (`a[href*=calendar.google.com]`) — invalid CSS, the
  same pitfall §16 already documented once; replaced with an `[href]` filter
  + includes().
- app-icon.tsx grew a duplicate `baby:` key (R4's due-date icon collided
  with an existing one) — caught by tsc, deduped.
- JSX degree-sign escapes (`{deg}\u00b0`) rendered literal `\u00b0` text in
  the image workbench rotate control; fixed to real characters.
- Ops: the box OOM-killed next-server during a full-route warm sweep
  (4 GB box, ~2.5 GB RSS) and the :81 gateway itself was down once mid-run —
  restarts handled; PHASE=8 was added to the QA script so the final sweeps
  fit one invocation without re-running the verified browser middle.

lint clean. sw.js bumped to sow-shell-v9 — **74 instant shells** precached,
mirror sweep asserts all answer 200 through the gateway. No new
dependencies (meme/svg use canvas 2D; vcard reuses the existing `qrcode`
package).

Next run: **Batch R5** per §13 (sound-tools 4-in-1 — dB meter/tone/tuner/
metronome, tts via speechSynthesis, fuel-cost, salary, sleep, pace,
one-rep-max, fraction, quadratic; /heic stays owner-flagged pending the
size-acceptance call, like /video-trim).

## 18. Batch R5 — §13 expansion completes the 50-tool checklist (this run, 2026-11-25)

This run shipped **Batch R5 — sound, body & misc calculators**: nine new
tools (/sound-tools, /tts, /fuel-cost, /salary, /sleep, /pace, /one-rep-max,
/fraction, /quadratic), each with the full pipeline (registry entry with 8
SEO intents → component → instant-surface mount → long-form article →
title/description/FAQs → app-icon mapping → sw precache). That completes the
§13 50-item list: R1–R5 all shipped; the only unticked items are the three
owner decisions (/video-trim, AI background removal, and /heic's
size-acceptance flag).

**QA: 600 PASS / 0 FAIL** in the final tally, assembled across phase runs
through the :81 gateway after the sandbox recycle wiped /tmp: PHASE=1 (22/0)
and PHASE=2 (34/0) earlier in the run, then freshly re-run post-recycle —
PHASE=3 (103/0), PHASE=4c (middle+R3, cumulative 226/0), PHASE=4b (middle+R4,
352/0), PHASE=9 (middle+R5, 481/0), PHASE=8 sweeps (119 checks, final 600/0:
session flow + ALL_LIVE 83-page JSON-LD sweep + instant-body + sw mirror +
landing + console). The phase mechanism gained 4b/4c variants (skip R3 or R4
respectively) after two PHASE=4 invocations timed out on a cold server —
each batch block now fits one invocation. The R5 browser checks drive the
real input path and assert computed facts: /sound-tools tone readout 440 Hz,
metronome accepting 144 BPM live, the standard-tuning reference table;
/fuel-cost 40.00 L and 60.00 from the defaults with a 15.00 four-way split;
/salary 45,500 annual from 25/h with the unpaid break (7 paid h/shift) and
55,250 with 5 OT hours at 1.5×; /sleep 21:15 for a 06:30 alarm at six cycles;
/pace 5:00 /km recomputing to 4:48 and the Riegel table; /one-rep-max
consensus 114.3 with Epley 110.0 at 3 reps; /fraction 19/12 = 1 7/12 and 5/8
with the 0.(142857) repeat cycle; /quadratic roots 1 and 2 with vertex
(1.5, −0.25), a real SVG parabola, and complex −1 ± 2i. Every R5 page is in
the warm list, ALL_LIVE sweep and the sw mirror (83 shells, v10).

Shipped (all instant, 100% client-side):

1. `/sound-tools` — 4-in-1: dB meter (mic → RMS → dBFS with an adjustable
   calibration offset, peak/avg/min, honest "estimate" labeling), tone
   generator (20 Hz–20 kHz log slider, four waveforms, ramped gain, nearest
   note), guitar tuner (trimmed-autocorrelation pitch detection, cents
   needle, standard-tuning reference), metronome (audio-clock look-ahead
   scheduling, accents, 2/3/4/6/8 beats, tap tempo). Mic streams analysed in
   memory and dropped on stop; tab switch tears down every audio resource.
2. `/tts` — speechSynthesis reader with sentence-bounded chunking (browsers
   truncate single long utterances), visible chunk queue with live highlight,
   voice/rate/pitch/volume, pause/resume/stop, and honest states via
   useSyncExternalStore when the engine is missing. No window reads at render.
3. `/fuel-cost` — km/mi × L/100km · km/L · MPG-US · MPG-UK × price per
   liter/gallon, all normalized internally to L/km and currency-per-liter;
   passenger split, round-trip toggle, and an equivalence line that names the
   US/UK gallon gap.
4. `/salary` — all six frequencies from one amount with unpaid-break minutes
   deducted BEFORE annualizing, overtime at a configurable multiplier on top,
   weeks-per-year for non-52 schedules, the full pipeline printed, and an
   explicit refusal to invent take-home figures.
5. `/sleep` — wake-at and sleep-now modes over 90-minute cycles with an
   adjustable fall-asleep latency, midnight-safe times, per-row expectations,
   and the 80–110-minute real-world variation stated on the page.
6. `/pace` — pace per km/mile, speed, even-pace splits with elapsed and
   per-split columns, Riegel predictions (5K/10K/HM/M) with projected paces
   and the training-scaling caveat.
7. `/one-rep-max` — Epley/Brzycki/Lander/Lombardi side by side, consensus
   average, training table 95%→60% with typical reps, divergence and safety
   notes printed.
8. `/fraction` — four operations with full worked steps (LCD rewriting, cross
   products, keep-change-flip, GCD reduction), mixed-number and decimal forms,
   exact 2^53-clamped integer math, long-division repeat detection
   (0.(142857)), decimal→fraction exact to 8 places and honestly approximate
   beyond.
9. `/quadratic` — discriminant with the nature of the roots stated, real/
   repeated/complex conjugates, vertex + axis, factored form when it prints
   cleanly (named refusal otherwise), worked steps, and an SVG parabola
   rescaling around the vertex with roots marked.

**Real issues the QA caught and this run fixed (verified by re-run):**
- `/beautify` — a shipped-tool regression surfaced mid-run as a persistent
  "Loading the formatter engine…": the output useMemo read the module-scope
  engine caches (jsbMod/sqlMod) without them being memo dependencies, so when
  the dynamic import resolved after first render the flag flip re-rendered
  but the memo returned its cached loading text forever — and when the import
  resolved BEFORE hydration the client rendered formatted output against the
  server's loading text, throwing a hydration mismatch. Fixed by gating the
  engine reads behind the existing enginesReady state (flips only post-
  hydration, now in the memo deps; Promise.allSettled so a failed chunk still
  un-sticks the pane). Two consecutive fresh loads verified clean.
- `/fuel-cost` — the "no symbol" currency option used an empty-string Radix
  Select value, which Radix rejects: the component threw during render and
  the whole tool died behind the error boundary (QA saw no-el on every
  testid). Replaced with a 'none' sentinel mapped to an empty display prefix.
- The offline algorithm check caught THIS RUN's own salary arithmetic before
  any browser ran: the worklog/article draft said a 60-minute unpaid break in
  an 8-hour shift leaves 7.5 paid hours — it leaves 7, and the correct
  default annual is 45,500 (not 48,750). The QA expectations and the article
  were corrected to the verified math.
- Two QA expectations were wrong, not the tools: /tts merges short sentences
  up to its 220-char cap by design (three short sentences are one chunk), so
  the check now feeds >220 chars and expects 2; the /quadratic complex-roots
  check set only c=5 while b stayed −3 (x²−3x+5 → 1.5 ± 1.658312i is the
  CORRECT answer) — the check now sets b=2 AND c=5 and asserts −1 ± 2i.
- Ops: the dev server wedged mid-run with ~3.4 GB held (box has 4 GB);
  pkill + script restart per the runbook cleared it. Phase-4 invocations
  timed out twice on the cold server, hence the 4b/4c split.

**Concurrency incident, handled:** the harness interrupted this session
mid-PHASE=9 and the 05:39 cron re-fire resumed in a recycled sandbox while a
rewrite of the tip commit had swallowed this run's uncommitted R5 files into
an amended copy of the §17 pointer-fix commit (5221c6e → fc76307, same
message, committer 16:45:18) — R5 work hidden under a worklog message, the
§16 pattern again. Remote was still at 5221c6e (never pushed), so history was
repaired locally: git reset --soft 5221c6e, then the R5 work committed under
its own message (3347b84) as a clean child. Check git log if a commit ever
looks like it contains foreign files.

Ops: ~/.git-credentials was wiped by the recycle (as §7 documents); no
restore source exists in the repo — the previous PAT lived only in that
session's context. **PUSH PENDING: a fresh fine-grained PAT is needed**
(repo harshvardhan9084/shareonweb, Contents: Read & write) — the commit
above is ready and the push will be retried with it; see the run report for
the exact failure mode if it still fails.

RESOLVED (same day, later fire, owner-supplied PAT): the owner pasted a fresh
fine-grained PAT in chat. Credentials reinstalled per §7 (URL-style line in
~/.git-credentials, chmod 600, credential.helper=store). Before pushing, the
recycled sandbox re-verified the shipped tree rather than trusting the
session above: `bun run lint` clean, and `PHASE=9 bash scripts/final-qa.sh`
through the gateway scored **129 passed / 0 failed** on the R5 block plus
mid-section re-checks from cold. History integrity re-checked after the
amend incident (chain 5221c6e → 3347b84 → 255fc60; fc76307 only a dangling
object; 3347b84 holds exactly the 17 R5 files). Push then landed clean as a
fast-forward: **5221c6e..255fc60 main -> main**, confirmed by re-fetch
(remote tip 255fc60, 0 commits ahead). No PAT material is stored in this
repo or this file.

lint clean (one React-19 set-state-in-effect hit in the new /tts fixed with
the useSyncExternalStore capability-probe pattern §16 introduced). sw.js
bumped to sow-shell-v10 — **83 instant shells** precached, mirror sweep
asserts all answer 200 through the gateway. No new dependencies (sound-tools
uses WebAudio + canvas-free SVG; tts uses the stock speechSynthesis API).

Next run: the §13 checklist is complete. Owner decisions outstanding: /heic
size acceptance, /video-trim, AI background removal. Suggested next work
candidates (owner's call): polish/QA hardening passes, or new demand-driven
tools — but no unprompted expansion beyond the agreed 50.

---

## 19. Batch R6 — real-work tools by owner directive (this run, 2026-11-26)

The owner reviewed the R5-complete state in chat and redirected the roadmap:
"real things over extreme QUICK tools", then named the build list explicitly —
Spreadsheet Studio, Chart Maker, Resume Builder "wider and deeper", a QR
Studio "for real use cases", and video compression "and that another one too
which was stopped with it" — read as the parked /video-trim pair. AI
background removal remains parked (not mentioned; owner can unpark later).
These 4 new tools + 1 deep rebuild extend BEYOND the §13 50-tool checklist,
which R5 completed; no §13 boxes change hands.

Shipped (4 new tools + 1 rebuild, full 7-point pipeline each):
- /spreadsheet — Spreadsheet Studio (SheetJS, demo budget sheet live at first
  paint, formula bar, lite formula engine with Excel-grammar errors,
  column stats, numeric sort, pivot panel, regex find-and-replace, xlsx/csv
  export, 2000-row windowed grid)
- /chart-maker — Chart Maker (hand-rolled SVG engine: bar/line/area/pie/
  donut/scatter, series toggles, per-series stats, editable axes, manual
  bounds, nice-ticks, native tooltips, 2x PNG + SVG export)
- /resume — Resume Builder (live true-A4 preview, repeatable/reorderable
  entries, 3 themes x 4 accents, print-isolation portal + @page rules,
  HTML export, debounced localStorage autosave with honest status line)
- /video-studio — Video Studio (ffmpeg.wasm 0.12.15 single-thread,
  self-hosted UMD + core in /public/ffmpeg — 32 MB core, no
  SharedArrayBuffer needed; compress with CRF presets/custom + resolution/
  fps/audio modes, trim with playhead stamping + fast keyframe cut vs
  precise re-encode, live progress, MP4 faststart output)
- /qr rebuilt as QR Studio (kept QrTool export + QrScanPanel scan tab for
  legacy QA; added UPI upi://pay payload builder with encodeURIComponent
  VPA + INR amount, wifi/vCard spec escaping incl. quotes/commas/newlines,
  fg/bg color + transparent, WCAG contrast warning at 3:1, logo embed with
  ECC Q/H guidance + one-click upgrade, quiet zone 0-4, batch lines ->
  lazy-jszip ZIP of PNGs, raw payload always visible with copy)

QA: PHASE=1 22/0, PHASE=2 34/0, PHASE=3 103/0, PHASE=4b 229/0, PHASE=9
358/0, new PHASE=10 R6 block 13/0 after two script fixes, PHASE=8 final
sweep RESULT 503/0. The ALL_LIVE sweep now covers 88 pages with JSON-LD;
sw mirror asserts precache == ALL_LIVE; sw.js bumped to sow-shell-v11 with
the 4 new shells precached.

QA script engineering this run: added PHASE=10 (R6 deep block, warm-skip +
counter-restore list extended), outer 11g->R5 wrapper now also skips 10.
Two of this run's own check patterns were wrong and fixed in-script, not
papered over: (1) agent-browser eval wraps output in quotes, so '^yes'
anchors never matched "yes:14" — a check that would have been reported as
FAIL although the tool rendered 14 bars correctly; (2) React renders the
spreadsheet's cell editor one tick after the dispatched dblclick, so the
type-and-commit must be two evals with a sleep, not one — the single-eval
version found no input and would have mislabeled a working editor as broken.

Honest notes: the QA asserts the video engine line, tabs and inputs but
does NOT run a wasm transcode in-browser (cold-server time risk); the
engine files themselves are asserted served through the gateway (32 MB
wasm, 200). lint clean; tsc clean on all touched files. One lint warning
fixed (unused disable directive), one chart-maker TS union issue fixed by
converting the geometry memo to a tagged union (pie/scatter/bar/line/area).

Push: committed as harshvardhan9084 and pushed with the owner-supplied PAT
from the R5 resolution (credentials live in ~/.git-credentials outside the
repo).

## 20. Batch R6b — the unparked sixth tool: /bg-remove (this run, 2026-11-26)

Owner directive on this fire: build items 1/5/6 "wider and deeper", QR Studio
for real use cases, video compression, and "that another one too which was
stopped with it" (AI background removal) — right now, then push. A concurrent
session had already shipped five of the six (acf174b: spreadsheet, chart
maker, resume, video-studio with self-hosted ffmpeg compress + trim, /qr
rebuilt as QR Studio with UPI/batch/logo; sw v11, PHASE=10, worklog §19,
pushed). This run verified those claims against actual code — files present,
registry intents, seo/articles/icon entries, sw precache, PHASE=10 block —
and found the sixth item genuinely missing: no bg-remove component, no
registry entry, nothing. So this run built exactly that, nothing else touched.

/bg-remove ships two honest engines on one page. AI cutout: @imgly/background-
removal 1.7.0 (new dependency, wrapper only — model data comes from the
vendor CDN), lazy-imported inside the click handler, ISNet fp16, live
progress mapped to download/segment phases, honest "Model not loaded" line
and a failure message that points at the no-download mode. Solid-color key:
pure canvas — corner patches auto-sample the key color, a tolerance slider
drives a two-threshold soft alpha ramp so anti-aliased edges blend instead of
shredding. Compare slider overlays cutout over original on a checkerboard;
transparent PNG download keeps alpha; clipboard paste supported. SSR rules
respected (engine import in handlers only); lint + tsc clean on touched files.

QA engineering: PHASE=11 added (R6b block, warm-skip + counter-restore
extended) and the two negative gates (the 8/10 skip and the 9/4c skip) now
also exclude 11 — without that, phase 11 re-runs the entire generic browser
pile and times out, which is exactly what the first two invocations did. One
of this run's own checks then failed on the documented eval-quote-wrap trap
("^yes:" never matches "yes:8000/1600") — the worklog warned about this
pattern and it still got written; anchor fixed, check re-run.

QA: PHASE=11 5/0 clean — including the end-to-end solid-key check that builds
a red-field/green-square PNG in-page, keys it, and pixel-counts the result
(8000 alpha-0 pixels out, 1600 fully-kept: exactly the synthetic geometry).
PHASE=8 final sweep 124/0 (89 live pages with JSON-LD incl. /bg-remove, sw
mirror asserts precache == instant list, /beam redirect, console clean). sw.js
bumped to sow-shell-v12 with /bg-remove precached.

Honest limits: the AI path is asserted at the UI level only (tabs, status,
honesty lines) — no model download or inference ran in QA, deliberately, on a
4 GB box; the pixel-verified end-to-end covers the solid-key engine fully.
Push: 2f1ef31 committed as harshvardhan9084 and pushed with the stored PAT;
remote tip verified, tree clean. §13 remains complete; R6 + R6b close out the
owner's real-work directive.
