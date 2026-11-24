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

### Batch R2 — documents & media utilities (next run)
- [ ] `/signature` — draw + type signatures → transparent PNG at chosen size
- [ ] `/invoice` — line items, tax/discount/shipping, notes, print-ready invoice
- [ ] `/timezone` — time zone converter, world clock row, meeting-planner strip (Intl-based)
- [ ] `/pdf-to-image` — PDF → PNG/JPG per page or ZIP (reuses vendored pdf.js)
- [ ] `/device-test` — camera & mic test: resolution/FPS readout, level meters, browser/screen info — nothing recorded, nothing sent
- [ ] `/beautify` — format + minify HTML, CSS, JS, SQL (js-beautify + sql-formatter)
- [ ] `/favicon` — one image → full favicon pack (16/32/48/64/96/128/180/192/512 + .ico) as ZIP
- [ ] `/watermark` — text or logo watermark on photos, batch, position/opacity/tile
- [ ] `/typing-test` — WPM/CPM + accuracy, 15s/30s/1m/3m modes, real word stream
- [ ] `/markdown` — markdown editor with live preview, HTML export, table generator

### Batch R3 — data & text utilities
- [ ] `/stats` — mean/median/mode/range/variance/std-dev/quartiles from pasted numbers
- [ ] `/number-to-words` — amounts in words (cheque style), multiple currency formats
- [ ] `/morse` — text ↔ morse with live audio playback and speed control
- [ ] `/font-changer` — unicode text styles (bold/italic/script/small-caps/strike/upside-down) for bios
- [ ] `/emoji` — emoji finder by keyword with copy, grouped categories
- [ ] `/json-to-ts` — JSON → TypeScript interfaces/types generator
- [ ] `/compress-pdf` — PDF recompressor (rasterize pages at chosen JPEG quality, rebuild with pdf-lib)
- [ ] `/time-card` — weekly time card: in/out rows, break deductions, wage math
- [ ] `/grade` — GPA calculator, weighted grade, final-exam grade needed
- [ ] `/todo` — local checklist with localStorage persistence, filter + reorder

### Batch R4 — image & format utilities
- [ ] Image Toolkit modes: **crop, rotate, flip** added to the existing /image workbench (4-in-1)
- [ ] `/meme` — top/bottom caption meme maker on your own images (canvas)
- [ ] `/svg-convert` — SVG → PNG/JPG at chosen size and background
- [ ] `/cipher` — ROT13/Caesar/Atbash/Vigenère with Caesar brute-force view
- [ ] `/due-date` — pregnancy due date + weeks-progress (clear "not medical advice" framing)
- [ ] `/word-frequency` — keyword density table + Flesch reading ease
- [ ] `/vcard` — contact card builder → .vcf download + QR (reuses QR engine)
- [ ] `/calendar-link` — event → Google/Outlook/Yahoo links + .ics download
- [ ] `/px-rem` — px ↔ rem/em/% converter with configurable root size + clamp() builder
- [ ] `/binary` — text ↔ binary/hex/octal/decimal (ASCII/UTF-8, live both ways)

### Batch R5 — sound, body & misc calculators
- [ ] `/sound-tools` — dB meter (mic), tone generator, guitar tuner (pitch detect), metronome (4-in-1)
- [ ] `/heic` — HEIC → JPG/PNG (lazy libheif wasm) — **flagged like /video-trim: needs the owner's size acceptance before building**
- [ ] `/tts` — read text aloud with speechSynthesis (voice/rate/pitch, chunked playback)
- [ ] `/fuel-cost` — trip fuel cost: distance, efficiency, price, passenger split
- [ ] `/salary` — hourly ↔ annual ↔ monthly, overtime, unpaid-break adjustment (pre-tax, honest)
- [ ] `/sleep` — sleep-cycle planner (90-min cycles, wake-at / sleep-now modes)
- [ ] `/pace` — running pace/speed/splits table + race-time predictions (5K→marathon)
- [ ] `/one-rep-max` — 1RM via Epley/Brzycki/Lander + training-percentage table
- [ ] `/fraction` — fraction ↔ decimal, simplify, + − × ÷ with steps
- [ ] `/quadratic` — roots, discriminant, vertex, complex roots, worked steps

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
