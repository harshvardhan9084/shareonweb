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

## 5. QA log — 2026-11-23 (SEO/ethic run, via :81, scripts/final-qa.sh)

**64/64 PASS, zero console errors, hydration clean.** This run answered the
owner's three fresh complaints, verified against real code first:

1. "None of the standalone page is SEO powered!" — the metadata layer existed
   (titles/descriptions/canonical/OG per tool) but the BODY was thin and the
   structured data incomplete. Fixed:
   - `src/lib/seo.ts`: hand-tuned titles + descriptions for the 6 Batch-2
     tools (pdf, pdf-view, pdf-text, images-to-pdf, office-view, epub-view)
     that had been falling back to generic taglines; **tool-level FAQs for
     all 14 instant tools** (they had none); home FAQs re-anchored on the
     ethic; new `defaultFaqsFor(app)` helper so SSR-visible FAQs and JSON-LD
     can never drift apart.
   - `src/app/[slug]/page.tsx`: **FAQPage graph** added to every tool page's
     JSON-LD (mirrors the Q&As shown on first paint: default mode + tool
     level, same dedupe/slice).
   - `src/app/layout.tsx`: **FAQPage graph** for the home page's visible FAQ
     section.
   - `InstantSurface`: instant pages now carry a written page below the tool —
     "What {tool} does" (registry description + features), "Quick answers"
     (the new FAQs), and a "Private by construction" aside. Action stays
     first; the copy lives below the fold, where it belongs.
   - QA now asserts, for all 26 live pages: tool-branded title,
     WebApplication + HowTo + FAQPage JSON-LD, no old brand in titles.
2. "The action should be on top and the shit should be below" — session-tool
   landing had a redundant mode tagline pushing the CTA down: button now sits
   directly under the mode picker, mode tagline moved BELOW the button.
   Instant pages were already action-first and keep their tightened header.
3. "The homepage does not tell the ethic; it conflicts logics/ideas" — the
   old homepage claimed "one click creates a temporary session" for EVERY
   tool (false for the 14 instant ones) and called the session code "the
   product's one real artifact". Rewritten:
   - Hero states the ethic plainly under the value prop: "Nothing you do
     here ever lands on our servers."
   - Right column: "Two kinds of tools, one rule" — Instant explained
     (no code because nobody else is involved), Live explained (the code),
     join input kept prominent under the Live half.
   - "Three steps, every tool" replaced by "Two ways in, one rule" —
     honest per-family paths.
   - Trust section renamed to THE ETHIC with explicit claims (no accounts,
     no ads/trackers, instant = files never leave the device, live =
     content dies with the session, free).
   - Footer copy no longer describes the whole product as
     "device-to-device sessions"; OG alt text updated likewise.

**>15-min "reconnecting forever" — investigated, no code bug reachable.**
Verified: client retries infinitely (5 s backoff cap), re-joins on every
connect, dead-end escalates at 90 s with working "Dial again now"
(`forceReconnect` closes the engine and re-dials); relay `join` is
synchronous, always acks, wrapped in try/catch, and recreates rooms on join
(that permissiveness is what makes recovery work — do not "fix" it without
a persistent session source in the relay); empty rooms sweep after 2 h,
registry rows after 24 h; no 15-minute constant exists anywhere. Remaining
causes are environmental (sandbox kills processes; device network switches),
and the UI already degrades honestly into actionable options. No change made
this run — a blind relay validation change would break post-restart joins.

Previous QA log (Batch 2) — 30/30 PASS — is retained in git history.

Checks this run: `bun run lint` clean; `bunx tsc --noEmit` clean on src.

### Credentials note (2026-11-23, this run)
`.git-credentials` (project-level) and `~/.git-credentials` were both wiped by
a sandbox recycle again — the credential helper still points at the missing
file, so pushes fail with auth errors until the owner supplies a fresh
fine-grained PAT (repo `harshvardhan9084/shareonweb`, Contents: Read & write)
and the file is rewritten with it. Everything else is committed locally.

## 6. Sandbox lifecycle constraint (IMPORTANT for future runs)

The harness kills user-spawned processes BETWEEN tool calls; only
boot-registered services (relay :3003, Caddy :81) survive. Run browser QA as
ONE script invocation (scripts/final-qa.sh). Never `bun run build` against a
running boot dev server. Curl-warm routes before browser checks; a "failed"
check against a dead server is not a defect.

## 7. Git / deploy

- Commits go out under the owner's identity (harshvardhan9084) — configured
  in-repo. Credentials: `.git-credentials` **inside the project** (gitignored)
  via `credential.helper=store --file=…`. NOTE (2026-11-23): the file was once
  lost to a sandbox recycle and had to be re-created from the owner's PAT;
  `~/.git-credentials` does NOT survive recycles — always restore the
  project-level file. If pushes ever fail with auth errors, ask the owner for
  a fresh fine-grained PAT (repo `harshvardhan9084/shareonweb`, Contents:
  Read & write) and rewrite that file.
- Push after every meaningful milestone — always, unprompted.
