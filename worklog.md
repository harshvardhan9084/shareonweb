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
| **One session covers every mode of a tool** | DONE, QA-verified (this run) |
| **beam → share rename (URL + copy + SEO + OG)** | DONE (this run) |
| **Rebrand to Toolhive (name, mark, icons, OG, manifest)** | DONE (this run) |
| **Instant tools — Batch 1 (8 tools, deep, no placeholders)** | DONE (this run) |
| Reconnect honest dead-end (>90 s → "Dial again now" + fresh session) | DONE client-side (this run) |
| PDF suite, viewers, media tools | NOT STARTED — checklist below |
| AI upscaler / background removal (WASM) | NOT STARTED |

## 4. THE CHECKLIST (extracted from the owner's list + ChatGPT plan)

Rules of engagement: **no breadth-first placeholders** — a tool is only
"done" when its complete user journey works, with real edge cases handled,
browser-verified through :81. Work top-down; one batch per run is realistic.

### Batch 1 — Instant essentials (DONE this run, 8 tools / ~25 functions)
- [x] `/zip` — pack files+folders → ZIP; unpack ZIP with per-entry + bulk download
- [x] `/image` — compress (quality + target-KB binary search), convert PNG/JPG/WebP, resize (%/px/aspect lock), batch, before/after sizes
- [x] `/hash` — MD5 + SHA-1/256/512 for files & text, verify against expected hash
- [x] `/encode` — Base64 text↔ both directions Unicode-safe, file↔data URL, decode→download
- [x] `/json` — format (2/4), minify, validate with line:column, sort keys, stats
- [x] `/text` — counters (words/chars/sentences/paragraphs/read-time), 7 case modes, 8 line ops, find&replace (regex)
- [x] `/password` — crypto-random passwords + passphrase mode, entropy, bulk
- [x] `/qr` — link/text/Wi-Fi/vCard QR, ECC + size, PNG download

### Batch 2 — PDF & documents (NEXT)
- [ ] `/pdf` — merge, split, rotate, reorder, page extract (pdf-lib)
- [ ] `/pdf-view` — PDF viewer (pdf.js) with page nav
- [ ] `/office-view` — DOCX text (Mammoth), XLSX grid (SheetJS), CSV table view
- [ ] `/images-to-pdf` — images → single PDF, ordering + page size
- [ ] `/epub-view` — EPUB reader
- [ ] `/pdf-text` — extract text from PDF

### Batch 3 — Media (client-side)
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

## 5. QA log — 2026-11-23 (this run, via :81, scripts/final-qa.sh)

**15/15 PASS, zero console errors, hydration clean:**
- Home: new hub hero ("Every tool you need, already open."), Instant Tools
  section, Toolhive brand, no old brand anywhere (title/OG/manifest).
- `/zip`, `/hash`, `/password` render with primary action visible (all 8
  instant routes 200; build prerenders all 20 tool pages).
- `/beam` → 307 `/share`; `/share` shows Text/Files/Folder/Quick Pair.
- New session → `/R6MC6G`; in-session "Share modes" tablist present and the
  Folder tab is reachable **in the same session** (one code, all modes).
- Legacy `?s=` and `?app=drop` rewrites still work; garbage → 404.

Checks: `bun run lint` clean; `tsc` clean on src; `bun run build` succeeds
(30 routes; 20 SSG tool pages).

## 6. Sandbox lifecycle constraint (IMPORTANT for future runs)

The harness kills user-spawned processes BETWEEN tool calls; only
boot-registered services (relay :3003, Caddy :81) survive. Run browser QA as
ONE script invocation (scripts/final-qa.sh). Never `bun run build` against a
running boot dev server. Curl-warm routes before browser checks; a "failed"
check against a dead server is not a defect.

## 7. Git / deploy

- Commits go out under the owner's identity (harshvardhan9084) — configured
  in-repo. Credentials: `.git-credentials` **inside the project** (gitignored)
  via `credential.helper=store --file=…` — survives sandbox recycles, unlike
  `~/.git-credentials`. If pushes ever fail with auth errors, ask the owner
  for a fresh fine-grained PAT (repo `harshvardhan9084/shareonweb`, Contents:
  Read & write) and rewrite that file.
- Push after every meaningful milestone — always, unprompted.
