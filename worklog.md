# Toolhive — Development Worklog

(Previously ShareOnWeb — rebranded 2026-11-23 per the owner's direction. The
domain stays shareonweb.vercel.app; the product name, mark and copy are
Toolhive.)

## 1. Project overview

Toolhive is an account-free HUB of everyday web tools in two families:

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

- Name: **Toolhive**. Mark (v4): three honeycomb cells — filled cyan cell on
  top, two green cells beneath (`BrandMark` in app-icon.tsx, mirrored in
  `brand/*.svg`). PWA icons, favicon, OG cards and per-tool OG images are
  regenerated from those SVGs (`bun brand/build-icons.mjs`,
  `bun brand/build-og.mjs` — 20 live tool cards).
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
| Media tools (audio/video/GIF/recorder) — Batch 3 | NOT STARTED — checklist below |
| AI upscaler / background removal (WASM) | NOT STARTED |

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

### Batch 3 — Media (client-side) — NEXT
- [ ] `/audio` — trim, merge, speed, volume normalize (Web Audio + lamejs)
- [ ] `/video-trim` — trim/mute/speed (ffmpeg.wasm, lazy-loaded)
- [ ] `/gif` — video→GIF, GIF resize/compress
- [ ] `/frame-grab` — video frame extractor → PNG
- [ ] `/recorder` — screen recorder (getDisplayMedia + MediaRecorder), audio recorder
- [ ] `/upscaler` — real super-resolution via WASM/WebGPU model; interim: high-quality resample + sharpen

### Batch 4 — File tools deep + privacy
- [ ] `/archive` extensions — TAR/tar.gz view+extract, GZip single files
- [ ] `/file-tools` — splitter, merger, bulk renamer, extension changer, duplicate finder
- [ ] `/encrypt` — AES-GCM file/text encryption via WebCrypto (password → key)
- [ ] `/meta-scrub` — EXIF viewer + scrubber for photos
- [ ] `/jwt` — JWT decode/inspect (local only)
- [ ] `/hash-file-batch` — checksum list for many files, export .sha256

### Batch 5 — Dev & generators
- [ ] `/cron` — cron expression parser with human schedule + next runs
- [ ] `/convert-units` — units, number bases, Roman numerals
- [ ] `/diff` — text diff checker (LCS, side-by-side)
- [ ] `/lorem`, `/uuid`, `/fake-data` — generators
- [ ] `/css-tools` — gradient, shadow, radius generators + previews
- [ ] `/meta-tags` — OG/meta tag generator + preview
- [ ] `/barcode` — Code128/EAN generation
- [ ] `/wifi-qr` is already inside `/qr`; add QR **scanner** (camera) here

### Batch 6 — Session-tool polish (per owner feedback)
- [ ] >15 min reconnect: DONE client-side (honest dead-end); consider relay-side session GC on wake
- [ ] Session titles polish; folder share improvements; audio call quality
- [ ] PWA: cache instant tool shells for offline use in sw.js

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
