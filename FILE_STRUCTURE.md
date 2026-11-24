# FILE_STRUCTURE

A map of every useful file in this repository — what each one contains and why it exists,
in the spirit of gitingest: read top to bottom and you understand the whole app without
opening a single file.

Kontivo is a platform of small web tools. Two families: **Instant** tools run entirely in
your browser (files never leave the device), **Live** tools connect two or more devices
through a 6-character session code. One dynamic route serves every tool page and every
session path; a small socket.io relay forwards events between the devices in a session.

```
Generated / non-source artifacts omitted here: bun.lock, db/*.db, node_modules, .next,
binary icons under public/ (listed once per directory), credentials.
```

---

## Root

| File | Contents |
| --- | --- |
| `package.json` | Scripts (`dev`, `lint`, `db:push`, …) and dependencies of the Next.js app. |
| `next.config.ts` | Next.js 16 configuration (Turbopack, headers, image rules). |
| `tsconfig.json` | TypeScript strict-mode config with the `@/*` path alias. |
| `eslint.config.mjs` | ESLint flat config (Next.js core-web-vitals rules). |
| `postcss.config.mjs` | PostCSS pipeline for Tailwind CSS 4. |
| `tailwind.config.ts` | Tailwind theme extensions layered on top of CSS variables. |
| `components.json` | shadcn/ui generator config (New York style, `src/components/ui`). |
| `.env.example` | Template of every environment variable the app understands. |
| `.gitignore` | Ignored paths (build output, db files, dependencies). |
| `DEPLOY.md` | How to deploy the app + relay service (Vercel, env vars, Caddy notes). |
| `DESIGN.md` | The design doctrine: typography, spacing, color, do-it-first IA rules. |
| `worklog.md` | Engineering log: milestones, tool checklist, what shipped when and why. |
| `FILE_STRUCTURE.md` | This file. |

## `prisma/` and `db/`

| File | Contents |
| --- | --- |
| `prisma/schema.prisma` | Database schema: the `SessionRecord` model backing session codes. |
| `db/.gitkeep` | Keeps the SQLite database directory in git while the db file itself stays ignored. |

## `mini-services/relay-service/`

The only backend besides the Next.js API routes: an independent Bun process.

| File | Contents |
| --- | --- |
| `mini-services/relay-service/index.ts` | The real-time relay: plain `node:http` + socket.io server (port 3003). Devices join rooms by 6-character code; it forwards events between all devices in a room, keeps per-room state so late joiners get history, relays WebRTC signaling, exposes an internal `POST /close/:code` guarded by `x-relay-key`, and writes every registry/room mutation through the durable store below. |
| `mini-services/relay-service/store.ts` | Durable persistence for the relay: pluggable backends chosen from env — Upstash Redis REST (works on hosts without a persistent disk, e.g. Render free tier), an atomic JSON snapshot file (`RELAY_DATA_DIR`) for persistent disks, or memory (default). Session registry + closed markers + room content (texts, chat, strokes, polls, note, app events, completed files ≤ 20 MB) survive restarts for the 24 h session lifetime. |
| `mini-services/relay-service/Dockerfile` | Production image for hosting the relay (Render "Docker" runtime): oven/bun base, production-only dependency install, `/healthz` HEALTHCHECK, pre-created `/data` mount point for the disk backend. |
| `mini-services/relay-service/.dockerignore` | Keeps the Docker build context to the files the image actually needs. |
| `mini-services/relay-service/README.md` | Relay ops guide: rooms vs sessions (what `/healthz` counts), how persistence works, Render deployment recipes (Upstash free tier / paid disk), env-var table, capacity limits. |
| `mini-services/relay-service/package.json` | Dependency + dev script of the relay (separate from the app). |
| `mini-services/relay-service/bun.lock` | Lockfile for the relay's dependencies. |

## `src/app/` — routes

| File | Contents |
| --- | --- |
| `src/app/layout.tsx` | Root layout: fonts, ThemeProvider, Sonner toaster, header/footer shell, metadata defaults, PWA manifest link. |
| `src/app/page.tsx` | The homepage (`/`): metadata + JSON-LD (WebSite + FAQPage), renders `AppShell` in `home` view. |
| `src/app/[slug]/page.tsx` | The one dynamic segment that resolves the shared namespace: `/share` → statically generated tool page, `/beam`, `/drop` → legacy redirects, `/K7T29Q` → session path (private, client-hydrated), anything else → real 404. Emits per-tool `WebApplication` / `HowTo` / `FAQPage` JSON-LD. |
| `src/app/help/page.tsx` | Help Center at its own real path (indexable shell around the help view). |
| `src/app/sessions/page.tsx` | "My Sessions" at its own real path; `noindex` because the list lives only on the device. |
| `src/app/globals.css` | Global stylesheet: Tailwind layers, base element styles, scrollbar styling, print rules. |
| `src/app/tokens.css` | Design tokens: light/dark CSS variables (colors, radii, fonts) consumed by Tailwind. |
| `src/app/robots.ts` | `robots.txt` generator: allows crawlers, points at the sitemap, blocks session paths. |
| `src/app/sitemap.ts` | `sitemap.xml` generator: one self-canonical entry per live tool path, no session paths. |

### `src/app/api/` — the app's REST surface

| File | Contents |
| --- | --- |
| `src/app/api/route.ts` | Health-check stub (`GET /api` → hello-world JSON). |
| `src/app/api/sessions/route.ts` | `POST /api/sessions` — create a session record (code generation + collision retry). |
| `src/app/api/sessions/[code]/route.ts` | `GET/PATCH /api/sessions/:code` — fetch or update a session's metadata (title, expiry). |
| `src/app/api/sessions/[code]/close/route.ts` | `POST /api/sessions/:code/close` — end a session (marks the record closed; relay room is torn down). |
| `src/app/api/relay-config/route.ts` | `GET /api/relay-config` — tells the browser where the relay lives for the current deployment shape. |
| `src/app/api/translate/route.ts` | `POST /api/translate` — batch caption translation for Live Captions (LLM-backed; returns originals on failure so the feed degrades gracefully). |

## `src/components/platform/` — the shell every page shares

| File | Contents |
| --- | --- |
| `platform/app-shell.tsx` | The client-side router/view switch: maps the current platform view (`home`, `app`, `session`, `sessions`, `help`) to its component, handles URL hydration and legacy `?s=` / `?app=` links. |
| `platform/discover-view.tsx` | The landing page: hero with one-click start controls, search, join-by-code box, problem → process → tool directory → trust → FAQ flow. |
| `platform/app-landing-view.tsx` | A live tool's landing page (e.g. `/share`): action-first hero, mode tabs, "what it does", FAQs, details below the action. |
| `platform/session-view.tsx` | Session workspace chrome: code, QR, connection status, presence, expiry countdown, plus the panel for the session's tool. |
| `platform/session-gate.tsx` | Calm waiting room while a session opens (chunk load, URL hydration, relay handshake). Also hosts `SessionUnavailable` — the honest dead-end for expired/unknown session links, with three real ways out. |
| `platform/header.tsx` | Sticky header: brand, tool menu, search, join button, command palette trigger, theme toggle. |
| `platform/footer.tsx` | Sticky footer: brand summary, tool links, join CTA, and the one-line privacy statement. |
| `platform/code-input.tsx` | Segmented 6-character code entry (OTP-style boxes, paste-a-link support, auto-join). |
| `platform/join-dialog.tsx` | Join by typed code or by scanning the host's QR with the camera. |
| `platform/qr-scan.tsx` | In-app QR scanner: `BarcodeDetector` when available, ZXing-based canvas fallback otherwise. |
| `platform/command-palette.tsx` | ⌘K palette: start any tool, join a code, jump to sections. |
| `platform/app-icon.tsx` | Maps registry icon names to Lucide icons for every tool/category. |
| `platform/my-sessions-view.tsx` | "My Sessions": the list of sessions this device started/joined, stored locally. |
| `platform/help-view.tsx` | Help Center content: how codes work, per-tool answers, privacy model. |
| `platform/install-banner.tsx` | Dismissible PWA install banner on Discover (Chromium prompt / iOS guidance). |
| `platform/sw-register.tsx` | Registers the offline-shell service worker in production builds only. |
| `platform/theme.tsx` | Light/dark theme provider (next-themes) and toggle. |

## `src/components/session/` — live tools (the panels inside a session)

| File | Contents |
| --- | --- |
| `session/beam-panel.tsx` | Text/URL/link sharing between devices in real time. |
| `session/drop-panel.tsx` | P2P file transfer: chunked WebRTC sends, progress, resume-on-retry. |
| `session/folder-panel.tsx` | Folder sharing: preserves relative paths, transfers the whole tree. |
| `session/family-panels.tsx` | The Share tool's unified session — one code, tabbed modes (beam / drop / folder-share / quick-pair). The "modes live on one page ⇒ one session" law. |
| `session/quick-pair-panel.tsx` | Quick Pair: smallest possible handshake mode of the Share tool. |
| `session/call-panel.tsx` | Private Call: two-person WebRTC audio/video call. |
| `session/roundtable-panel.tsx` | Group Meeting: multi-peer room with device grid and controls. |
| `session/screen-panel.tsx` | Screen Sharing: presenter/viewer roles over `ScreenRtc`. |
| `session/assist-panel.tsx` | Remote Assist / Guided Pointer: one shares a screen, the other annotates and guides. |
| `session/cobrowse-panel.tsx` | Co-Browse: synchronized URL navigation with pointer presence. |
| `session/canvas-panel.tsx` | Shared whiteboard: strokes, ownership, resync after reconnect. |
| `session/note-panel.tsx` | Shared Notepad: live collaborative text. |
| `session/code-editor-panel.tsx` | Shared Code Editor: syntax-highlighted collaborative editing. |
| `session/present-panel.tsx` | Live Presentation: slides stay in sync between presenter and audience. |
| `session/captions-panel.tsx` | Live Captions: speech-to-text feed, translation toggle. |
| `session/location-panel.tsx` | Live Location: share position inside the session. |
| `session/clicker-panel.tsx` | Presentation Remote: phone drives slides on the computer (stage/remote roles). |
| `session/mini-map.tsx` | Dependency-free slippy map for Live Location (OpenStreetMap tiles on canvas). |

## `src/components/instant/` — the tools that never upload anything

| File | Contents |
| --- | --- |
| `instant/instant-surface.tsx` | Shared shell for instant tool pages: action-first layout, written page below the tool, FAQs, privacy aside. Picks the right tool component. |
| `instant/instant-kit.tsx` | Shared instant primitives: drop zones, file lists, result rows, download buttons, worker hooks. |
| `instant/zip-tool.tsx` | Zip/unzip in-browser (fflate): build archives or unpack one, nothing uploaded. |
| `instant/image-tool.tsx` | Image compression/conversion on-canvas (format, quality, resize). |
| `instant/hash-tool.tsx` | File/text hashing via Web Crypto (MD5 via fallback, SHA family) with per-chunk progress. |
| `instant/encode-tool.tsx` | Base64 / URL encode-decode for text and files. |
| `instant/json-tool.tsx` | JSON formatter/validator/minifier with error positions. |
| `instant/text-tool.tsx` | Text toolkit: case, counts, sort/dedupe, find-replace. |
| `instant/password-tool.tsx` | Cryptographically random password generator with entropy readout. |
| `instant/qr-tool.tsx` | QR generator (download as PNG/SVG) for text, URLs, Wi-Fi, vCard. |
| `instant/pdf-tool.tsx` | PDF workspace: merge, split/extract, reorder, rotate, delete pages (pdf-lib) with live thumbnails. |
| `instant/pdf-view-tool.tsx` | PDF viewer: page nav, zoom, whole-document search (pdf.js). |
| `instant/pdf-text-tool.tsx` | PDF text extraction per page, copy/download as .txt. |
| `instant/images-to-pdf-tool.tsx` | Images → single PDF (pdf-lib), ordering and page size controls. |
| `instant/office-view-tool.tsx` | Office viewer: DOCX via Mammoth, spreadsheets via SheetJS, sandboxed rendering. |
| `instant/epub-view-tool.tsx` | EPUB reader: metadata, TOC, paginated chapters (offline, in-browser). |
| `instant/audio-tool.tsx` | Audio bench: waveform trim, merge, speed, peak/RMS normalize, fades; WAV/MP3 export (Web Audio + lamejs). |
| `instant/gif-tool.tsx` | GIF studio: video→GIF with per-frame quantization (gifenc + Bayer dither) and GIF→smaller-GIF (gifuct-js decode, scale + frame-skip). |
| `instant/frame-grab-tool.tsx` | Frame grabber: single stills and batch sweeps from video, contact sheet, PNG/ZIP export (browser decoder + canvas). |
| `instant/recorder-tool.tsx` | Screen/mic recorder: getDisplayMedia/getUserMedia + MediaRecorder, pause/resume, muted preview, local WebM download. |
| `instant/upscaler-tool.tsx` | Image upscaler: stepped high-quality resampling + unsharp mask, before/after comparison, PNG/JPEG/WebP export. |
| `instant/archive-tool.tsx` | Archive Explorer: hand-written ustar reader/writer for .tar/.tar.gz/.tgz/.gz with header checksum verification, entry listing, selection → ZIP, folder → tar.gz, single-file gzip. |
| `instant/file-tools-tool.tsx` | File Workshop: split (Blob slices + SHA-256 manifest), verified rejoin, bulk rename (find/replace, numbering, case), extension changer, duplicate finder (content hash, labeled fingerprint above 256 MB). |
| `instant/encrypt-tool.tsx` | Encrypt: AES-256-GCM with PBKDF2-SHA256 (310k iterations), non-extractable WebCrypto keys, KENC1 container for files, Base64 container for text, breach-list password check. |
| `instant/meta-scrub-tool.tsx` | Metadata Cleaner: hand-written JPEG EXIF (IFD0/Exif/GPS) and PNG chunk (tEXt/zTXt/iTXt/eXIf + CRC) decoders; lossless scrub (JPEG structural segments, PNG critical chunks) with an in-memory proof re-parse. |
| `instant/jwt-tool.tsx` | JWT Inspector: header/payload decode with exact error positions, claim verdicts as local dates, HS*/RS*/PS*/ES* signature verification via WebCrypto. |
| `instant/hash-file-batch-tool.tsx` | Batch Checksums: MD5/SHA-1/SHA-256 for many files (WebCrypto ≤ 64 MB, streamed above; incremental MD5), GNU two-space .sha256 export, visual sha256sum -c verification. |
| `instant/cron-tool.tsx` | Cron Studio: hand-written parser for 5-field crontab and 6-field seconds-first syntax, plain-English sentence, next fire times (366-day cap) and simulated load; Quartz-only syntax refused with explanations. |
| `instant/diff-tool.tsx` | Text Diff: patience diff with LIS anchors and word-level intra-line highlights, side-by-side/inline views, live stats, unified patch export validated byte-exact against git apply (incl. no-newline EOF markers). |
| `instant/uuid-tool.tsx` | ID Generator: UUID v4/v7 (RFC 4122/9562) and ULID (Crockford base32, optional monotonic) from crypto.getRandomValues in bulk, plus an inspector decoding version/variant/embedded timestamps. |
| `instant/convert-units-tool.tsx` | Unit & Number Converter: exact published factors for 8 categories, temperature via real formulas, kB/MB vs KiB/MiB kept separate, BigInt number bases 2–36, strict classical Roman numerals. |
| `instant/lorem-tool.tsx` | Placeholder Text Studio: two corpora (classic Latin + plain-English wireframe), four shapes, xmur3+mulberry32 seeded generator (same seed rebuilds identical text), classic opening + HTML <p> modes. |
| `instant/fake-data-tool.tsx` | Fake Data Studio: 12 toggleable fields × 6 name locales, up to 500 rows, reserved-range honesty (example.* domains, 555-01XX phones, RFC 5737 IPs), seeded, CSV/JSON export. |
| `instant/css-tools-tool.tsx` | CSS Style Studio: gradient (linear/radial/conic, 8 stops, presets), layered box-shadow (6 layers, inset, alpha), per-corner radius — preview styled by the same state that emits the copied CSS. |
| `instant/meta-tags-tool.tsx` | Meta Tag Studio: escaped <head> snippet (OG + X + canonical + robots), live search-result / X-card / Open-Graph previews, ideal-length guidance. |
| `instant/barcode-tool.tsx` | Barcode Studio: Code 128 + EAN-13 via JsBarcode into SVG, 3× PNG export, EAN-13 mod-10 check digit computed (12 digits) or verified (13) with exact-position errors. |
| `instant/qr-scan-panel.tsx` | Scan tab of /qr: camera (BarcodeDetector native → jsQR lazy fallback, torch when supported) + image decode, WIFI/vCard/Kontivo-session payload parsing, session-only history. |

## `src/components/ui/` — shadcn/ui primitives

Stock shadcn/ui (New York) components, one file per component, used unchanged throughout
the app: `accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`,
`breadcrumb`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`,
`command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`,
`input`, `input-otp`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`,
`progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`,
`skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toaster`,
`toggle`, `toggle-group`, `tooltip`, `sidebar`.

| File | Contents |
| --- | --- |
| `src/components/SplitText.tsx` | GSAP SplitText wrapper for per-character/word text animation. |

## `src/lib/` — the engine room

| File | Contents |
| --- | --- |
| `lib/registry.ts` | The single source of truth: every tool (12), its variants (26), categories, icons, statuses, legacy aliases (`APP_ALIASES`), quick-start entries. Everything else derives from this file. |
| `lib/types.ts` | Shared types (`SessionInfo`, `DeviceType`, …) used by app and relay alike. |
| `lib/store.ts` | Zustand platform store: current view, active sessions, join dialog, header state. |
| `lib/room-client.ts` | RoomClient: browser-side socket.io client for the relay — join/leave, presence, event forwarding, WebRTC signaling channel, reconnect handling. |
| `lib/media-rtc.ts` | MediaRtc: P2P camera/microphone engine for the call/meeting tools (negotiation, tracks, ICE restarts). |
| `lib/screen-rtc.ts` | ScreenRtc: P2P screen-stream engine for Screen Sharing / Assist. |
| `lib/ice-watch.ts` | ICE resilience watchdog: watches `disconnected` peers, forces ICE restarts so calls survive Wi-Fi switches and NAT rebinds. |
| `lib/file-blob.ts` | Reassembles chunked file transfers into Blobs (handles base64 padding math correctly for 256 KB chunks). |
| `lib/folder-files.ts` | Folder picking/normalization: `webkitdirectory` inputs and drag-dropped directory trees → structured file lists. |
| `lib/pdf-loader.ts` | One shared pdf.js loader (worker setup) for the three PDF tools. |
| `lib/session-store.ts` | Session registry on Prisma/SQLite: how join codes are stored, looked up, expired. |
| `lib/api.ts` | REST client for session lifecycle against the Next.js API routes. |
| `lib/code.ts` | Session-code helpers: unambiguous alphabet, generation, normalization, `CODE_PATH_RE`. |
| `lib/quick-start.ts` | One-click session start: create, remember locally, navigate straight in. |
| `lib/relay-endpoint.ts` | Resolves the relay URL for every deployment shape (build-time env, same-origin gateway, dev port). |
| `lib/relay-watchdog.ts` | Sandbox-only watchdog: revives the relay mini-service if the harness reaps it (loaded via `instrumentation.ts`). |
| `lib/normalize-url.ts` | Normalizes human-typed URLs from the environment (adds scheme, strips junk) — born from a prod build crash. |
| `lib/seo.ts` | Per-tool SEO/GEO copy: titles, descriptions, FAQs (`APP_FAQS`, `HOME_FAQS`) — written per tool, not templated. |
| `lib/site.ts` | Site constants: name, domain, default title/description used in metadata. |
| `lib/content.ts` | Long-form article registry: merges live + instant articles, `getArticle(id)`, `HOME_ARTICLE`. |
| `lib/article-types.ts` | Types for the long-form articles (`AppArticle`, `ArticleSection`, `HomeArticle`). |
| `lib/articles-live.ts` | Written articles for the live tools (what it is / how it works / when to use / privacy). |
| `lib/articles-instant.ts` | Written articles for the instant tools, same shape. |
| `lib/db.ts` | Lazy Prisma client singleton. |
| `lib/utils.ts` | `cn()` class merger, `humanError()` (network/relay failures → human sentences). |
| `lib/wav.ts` | WAV/PCM encoding + sample math (trim, resample, concat, peak/RMS normalize, equal-power fades) for the audio tools. |

## `src/hooks/` and `src/types/`

| File | Contents |
| --- | --- |
| `src/hooks/use-mobile.ts` | Media-query hook for responsive behavior switches. |
| `src/hooks/use-pwa-install.ts` | Tracks `beforeinstallprompt` and installed-PWA state; only suggests install where it is actually possible. |
| `src/hooks/use-toast.ts` | Toast state hook backing the shadcn toaster. |
| `src/types/mammoth-browser.d.ts` | Type declarations for the browser build of Mammoth (DOCX → HTML). |
| `src/types/gifenc.d.ts` | Type declarations for gifenc (GIF quantize/encode surface this app uses). |
| `src/instrumentation.ts` | Next.js instrumentation hook: loads the relay watchdog once per server process (Node runtime only). |

## `scripts/` — engineering tools (not shipped)

| File | Contents |
| --- | --- |
| `scripts/final-qa.sh` | The full browser QA suite: fixtures → routes → agent-browser checks (home, tools, sessions, redirects, SEO/JSON-LD) in one invocation. |
| `scripts/qa-session-recheck.sh` | Focused re-check of session flows after changes. |
| `scripts/make-fixtures.mjs` | Generates real test fixtures (PDFs with known page counts, PNGs, CSV/DOCX/EPUB) into `/tmp/qa-fixtures`. |
| `scripts/test-e2e.ts` | End-to-end relay/room test driver (two clients, real socket.io). |
| `scripts/drop-retry-e2e.mjs` | E2E: file-drop transfer retry/resume behavior. |
| `scripts/folder-retry-e2e.mjs` | E2E: folder transfer retry/resume behavior. |
| `scripts/media-e2e.mjs` | E2E: call/screen media negotiation path. |
| `scripts/location-e2e.mjs` | E2E: live-location event flow. |
| `scripts/canvas-resync-e2e.mjs` | E2E: whiteboard stroke ownership + resync after reconnect. |
| `scripts/doc-sync-test.ts` | Test: shared document sync behavior. |
| `scripts/debug-room-dump.ts` | Debug: dumps a relay room's state for inspection. |
| `scripts/gen-icons.ts` | Generates PWA icon PNGs from the brand SVGs. |
| `scripts/sync-pdf-worker.mjs` | Copies the pdf.js worker build into `public/` for the PDF tools. |

## `brand/` and `public/` — identity and static assets

| File | Contents |
| --- | --- |
| `brand/logo.svg` | Primary wordmark/lockup SVG (source of truth for the brand). |
| `brand/brandmark.svg` | Symbol-only mark in full color (v5 "focus frame": four context brackets around a filled node). |
| `brand/brandmark-mono.svg` | Monochrome variant of the mark. |
| `brand/apple-touch.svg` | iOS home-screen icon source. |
| `brand/maskable.svg` | Android adaptive/maskable icon source (safe-zone padding). |
| `brand/build-icons.mjs` | Rasterizes the brand SVGs into `public/icons/*.png`. |
| `brand/build-og.mjs` | Generates one 1200×630 OG image per tool into `public/og/`. |
| `brand/README.md` | How the brand assets are structured and regenerated. |
| `brand/v2/` | Archived second brand iteration (logo, marks, its own builders, `RESTORE.md` rollback note). |
| `public/favicon.svg` | Browser-tab favicon. |
| `public/icon.svg` | Scalable app icon used by the manifest. |
| `public/logo.svg` | Header/logo copy served statically. |
| `public/icons/` | Generated PWA raster icons (192, 512, maskable 512, apple-touch). |
| `public/og/` | Generated per-tool Open Graph images (one PNG per tool page). |
| `public/og.png` | Site-level OG image for the homepage. |
| `public/manifest.webmanifest` | PWA manifest: name, icons, theme colors, display mode. |
| `public/sw.js` | Offline-shell service worker (v5): app shell + 35 instant-tool page shells precached at install with their build assets; session links stay network-first with the honest offline page. |
| `public/offline.html` | Static offline fallback page served by the SW. |
| `public/robots.txt` | Generated robots rules (see `src/app/robots.ts`). |
| `public/pdf.worker.min.mjs` | pdf.js worker build served to the PDF tools. |
