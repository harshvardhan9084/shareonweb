// Per-tool SEO/GEO copy and FAQs — the "every tool ranks on its own search
// terms" layer. Written per tool, not templated: search engines and answer
// engines reward specific, honest phrasing, and each tool page should read
// like its own product. All claims here mirror actual app behavior.
//
// Keys are tool ids ('share', 'call', …). Mode-specific FAQs stay keyed under
// the variant ids ('drop', 'video-call', …) and surface when that mode is
// picked on the tool's landing page.

import type { AppDef } from '@/lib/registry'

export interface Faq {
  q: string
  a: string
}

/** Hand-tuned search titles (the blue link) — intent-first, tool-named. */
const SEO_TITLES: Record<string, string> = {
  share: 'Share — send text, files and folders between devices instantly',
  zip: 'Zip & Unzip — pack and unpack archives right in your browser',
  image: 'Image Toolkit — compress, convert, resize, crop, rotate and flip images online free',
  hash: 'Hash & Verify — MD5 and SHA-256 checksums for any file',
  encode: 'Base64 Encode & Decode — text and files, data URLs included',
  json: 'JSON Formatter — format, validate and minify with error positions',
  text: 'Text Kit — word counter, case converter, line cleanup',
  password: 'Password Generator — strong, random, built in your browser',
  qr: 'QR Generator — links, text, Wi-Fi and contact cards as QR codes',
  call: 'Call — video and voice rooms with a link, no accounts',
  screen: 'Screen — share your screen live, or see theirs, from the browser',
  camera: 'Camera — live camera sharing, phone webcam, baby monitor',
  voice: 'Voice — walkie-talkie, wireless mic and live recorder in the browser',
  notepad: 'Notepad — write notes and code together, live',
  present: 'Present — slides on every screen, clicker on your phone',
  canvas: 'Canvas — draw together on a live whiteboard',
  roundtable: 'Roundtable — a quick room for chat and live polls',
  'co-browse': 'Collaborative Browsing — browse the same page together',
  'location-share': 'Live Location — share where you are, live',
  'live-captions': 'Live Captions — caption and translate speech',
  pdf: 'PDF Toolkit — merge, split, organize and rotate PDFs in your browser',
  'pdf-view': 'PDF Viewer — read, search and zoom any PDF without installing anything',
  'pdf-text': 'PDF to Text — extract every word, page by page, download as .txt',
  'images-to-pdf': 'Images to PDF — turn photos and scans into one PDF, no upload',
  'office-view': 'Word & Excel Viewer — open DOCX and XLSX online, convert them too',
  'epub-view': 'EPUB Reader — read books in your browser with contents and progress',
  audio: 'Audio Toolkit — trim, merge and normalize audio, export WAV or MP3, no upload',
  gif: 'GIF Studio — turn video into a GIF or shrink an existing GIF, all in your browser',
  'frame-grab': 'Frame Grabber — pull still PNG frames from any video, one shot or the whole clip',
  recorder: 'Screen & Mic Recorder — capture your screen or voice to a file, never uploaded',
  upscaler: 'Image Upscaler — enlarge photos 2–4× with stepped resampling and sharpening, locally',
  archive: 'Archive Explorer — open TAR and tar.gz archives, list and extract entries, locally',
  'file-tools': 'File Workshop — split, merge, rename and de-duplicate files in your browser',
  encrypt: 'Encrypt — password-encrypt files and text with AES-256-GCM, never uploaded',
  'meta-scrub': 'Metadata Cleaner — view and strip EXIF & GPS from photos, losslessly, in your browser',
  jwt: 'JWT Inspector — decode JSON Web Tokens and verify signatures locally',
  'hash-file-batch': 'Batch Checksums — MD5 & SHA-256 for many files, with sha256sum-compatible lists',
  cron: 'Cron Studio — parse, explain and preview cron expressions in your browser',
  diff: 'Text Diff — compare two texts line by line and export a patch that applies',
  uuid: 'ID Generator — UUID v4, UUID v7 and ULID in bulk, with an inspector',
  'convert-units': 'Unit Converter — 73 units, number bases and Roman numerals, exact and local',
  lorem: 'Placeholder Text Studio — seeded Lorem ipsum and wireframe filler text, generated locally',
  'fake-data': 'Fake Data Studio — realistic fake test records as CSV or JSON, reproducible from a seed',
  'css-tools': 'CSS Style Studio — gradient, box-shadow and border-radius generators with live previews',
  'meta-tags': 'Meta Tag Studio — Open Graph and X card tags with live search and social previews',
  barcode: 'Barcode Studio — Code 128 and EAN-13 barcodes as SVG or PNG, checksum included',
  calculator: 'Calculator Studio — expressions, scientific functions and a tape, computed locally',
  percentage: 'Percentage Studio — discounts, tips, tax and percent change with the formulas shown',
  'date-calculator': 'Date Math Studio — age, date differences, business days and countdowns, calendar-exact',
  bmi: 'Body Metrics Studio — BMI, calories, ideal weight and body fat, formulas stated openly',
  loan: 'Loan & Interest Studio — EMI, amortization schedules and compound projections, exportable',
  timer: 'Timer Studio — stopwatch, countdown, pomodoro and tabata that stay accurate in any tab',
  picker: 'Random Picker Studio — wheel of names, dice, raffle numbers and fair team splits',
  regex: 'Regex Studio — live JavaScript regex testing with groups, replace preview and a library',
  csv: 'CSV & JSON Studio — real RFC 4180 conversions between CSV and JSON, warnings included',
  color: 'Color Studio — convert, sample and check colors: HEX/RGB/HSL, WCAG contrast, palettes',
  signature: 'Signature Studio — draw or type a signature, download a trimmed transparent PNG, all local',
  invoice: 'Invoice Studio — line items, tax, discount, shipping and a print-ready invoice, nothing stored',
  timezone: 'Time Zone Studio — convert times, world clock and meeting planner on the Intl database',
  'pdf-to-image': 'PDF to Image Studio — render every PDF page to PNG or JPG at print scale, ZIP included',
  'device-test': 'Device Check Studio — webcam and microphone tests with real readouts, nothing recorded',
  beautify: 'Code Formatter Studio — beautify HTML, CSS, JS and SQL with real engines, honest compaction',
  favicon: 'Favicon Studio — one image into every favicon size plus a real .ico, packed as a ZIP',
  watermark: 'Watermark Studio — text or logo watermarks on a batch of photos, position, tile, opacity',
  'typing-test': 'Typing Test Studio — WPM, CPM and accuracy over 15s to 3min, the clock starts on typing',
  markdown: 'Markdown Studio — live preview, GFM tables and clean HTML export from a built-in engine',
  stats: 'Statistics Calculator — mean, median, mode, quartiles and std dev from pasted numbers, live',
  'number-to-words': 'Number to Words — cheque-style amounts in words, USD/EUR/GBP/INR and lakh/crore',
  morse: 'Morse Code Translator — text ↔ Morse both ways, live audio at 5–35 WPM on PARIS timing',
  'font-changer': 'Font Changer — thirteen Unicode styles for bios and usernames, honest coverage per style',
  emoji: 'Emoji Finder — search by name or keyword, click to copy, a built-in set with zero tracking',
  'json-to-ts': 'JSON to TypeScript — interfaces from any JSON, optionals done right, structural dedup',
  'compress-pdf': 'PDF Compressor — shrink PDFs locally by rasterizing at your scale and JPEG quality',
  'time-card': 'Time Card Calculator — a week of punches into hours, overtime and gross pay, overnight-safe',
  grade: 'Grade Calculator — weighted grade, the final-exam solver and GPA on the 4.0 scale',
  todo: 'Local Checklist — a to-do list persisted in your browser only, filters, reorder, Markdown export',
  meme: 'Meme Maker — top and bottom text memes on your own images, no watermark, no upload',
  'svg-convert': 'SVG to PNG/JPG Converter — rasterize at any size and background, transparent supported',
  cipher: 'Cipher Studio — ROT13, Caesar, Atbash and Vigenère with a Caesar brute-force view',
  'due-date': 'Due Date Calculator — from LMP or conception, weeks pregnant, trimester, milestones',
  'word-frequency': 'Word Frequency Counter — keyword density table plus Flesch reading ease',
  vcard: 'vCard & QR Generator — contact card to .vcf download and a scannable QR code',
  'calendar-link': 'Add to Calendar Links — Google, Outlook and Yahoo links plus a real .ics download',
  'px-rem': 'px ⇄ rem Converter — px, rem, em and % at once, with a clamp() builder',
  binary: 'Binary to Text Converter — text ↔ binary, hex, octal and decimal, live both ways',
  'sound-tools': 'Sound Tools — online dB meter, tone generator, guitar tuner and drift-free metronome, all in one page',
  tts: 'Text to Speech Reader — read text aloud with your browser’s own voices, chunked and pausable',
  'fuel-cost': 'Fuel Cost Calculator — trip fuel cost from distance, efficiency and price, split per passenger',
  salary: 'Salary Converter — hourly, daily, weekly, monthly and annual pay from one number, breaks and OT included',
  sleep: 'Sleep Calculator — bedtimes and alarms that land on whole 90-minute sleep cycles',
  pace: 'Running Pace Calculator — pace, splits and Riegel race predictions from 5K to marathon',
  'one-rep-max': 'One Rep Max Calculator — 1RM via Epley, Brzycki, Lander and Lombardi plus the training table',
  fraction: 'Fraction Calculator — add, subtract, multiply and divide fractions with every step shown',
  quadratic: 'Quadratic Formula Calculator — roots, discriminant, vertex, factored form, steps and a live plot',
}

/** Hand-tuned meta descriptions (the snippet) — honest, specific, ~150 chars. */
const SEO_DESCRIPTIONS: Record<string, string> = {
  share:
    'Move text, files and whole folders between your phone and computer directly, up to 50 MB per file. One code serves text, files and folders. Nothing stored.',
  zip:
    'Pack files or a whole folder into a ZIP, or extract any archive with its structure intact. Runs entirely in your browser — nothing is ever uploaded.',
  image:
    'Compress photos to a target size, convert between PNG, JPEG and WebP, resize, crop, rotate and mirror whole batches. Processed locally by your browser — no uploads, no sign-up.',
  hash:
    'Get MD5, SHA-1, SHA-256 and SHA-512 checksums for any file or text, then verify against the published hash. Computed on your device, instantly.',
  encode:
    'Encode text to Base64 and back, turn files into data URLs, decode Base64 files into downloads. Unicode-safe and entirely client-side.',
  json:
    'Format, minify, sort and validate JSON with the exact line and column of any error. Perfect for API responses — nothing is sent anywhere.',
  text:
    'Count words, characters and reading time; switch case; sort, dedupe and clean up lines; find and replace with regex. One quick, private page.',
  password:
    'Generate strong passwords and memorable passphrases with real browser randomness — length, symbols and look-alike controls, entropy shown.',
  qr:
    'Create QR codes for links, text, Wi-Fi networks and contact cards. Pick size and error correction, download a crisp PNG. Rendered locally.',
  call:
    'One-click video or voice rooms for two people or a small group: meetings, interviews, classrooms, webinars. Everyone joins from a browser. Nothing recorded.',
  screen:
    'Share a tab, window or whole screen from the browser, watch your PC on your phone, or guide someone through a fix. Peer-to-peer, nothing recorded.',
  camera:
    'Stream what your camera sees, use a phone as a wireless webcam, or turn two devices into a consent-first baby monitor. Live, direct and temporary.',
  voice:
    'Push-to-talk between devices like real walkie-talkies, use a phone as a PC microphone, or record while everyone listens live. Nothing kept afterwards.',
  notepad:
    'One live document on every device: shared notes that sync as you type, plus a pair-programming mode with highlighting and snapshots. No accounts.',
  present:
    'Present slides while the audience follows on their phones at full quality, and drive the deck from your phone. No upload, no signup, nothing stored.',
  canvas:
    'A shared whiteboard that opens in every browser. Draw together from a phone, tablet or laptop with strokes syncing live. Nothing saved afterwards.',
  roundtable:
    'Open a room, share the six-character code and run a quick discussion with live chat and instant polls. No accounts, room expires on its own.',
  'co-browse':
    'Open a web page in a session and everyone sees the same page and scroll. Works with sites that allow embedding; logins stay on your side.',
  'location-share':
    'Share your live position with people in the session, from your browser. Only session members see it; nothing is stored afterwards.',
  'live-captions':
    'Live captions for speech in the session, with translation built in. Runs in the browser; speech recognition support varies by browser.',
  pdf:
    'Merge PDFs in any order, rearrange pages with live thumbnails, extract ranges like 1-3 or split every N pages into a ZIP. Local with pdf-lib — nothing uploads.',
  'pdf-view':
    'Read any PDF right in the browser: page navigation, zoom, rotation and a search that shows which pages match. Rendered locally with pdf.js, never uploaded.',
  'pdf-text':
    'Extract all text from a PDF page by page, copy it or download it as a .txt. Scanned image-only PDFs are detected honestly. Runs entirely on your device.',
  'images-to-pdf':
    'Combine JPEG, PNG, WebP and more into one PDF with ordered pages, A4 or Letter sizes, margins and EXIF-correct rotation. Built locally with pdf-lib.',
  'office-view':
    'Open DOCX, XLSX and CSV files without Office: formatted documents, spreadsheet grids with sheet tabs, plus DOCX→HTML and CSV→XLSX conversion. All local.',
  'epub-view':
    'Read DRM-free EPUB books in the browser: paginated chapters, table of contents, text-size control and live progress. Rendered locally with epub.js.',
  audio:
    'Cut a clip from a recording, join files, change speed, normalize loudness and add fades — rendered by Web Audio and exported as WAV or MP3 on your device.',
  gif:
    'Convert video to a looping GIF with your own start, length, fps and width, or shrink a GIF by scaling and frame-skipping. Encoded locally, nothing uploaded.',
  'frame-grab':
    'Scrub a video and grab exact frames as PNGs at native resolution, or sweep the clip every N seconds and download the set as a ZIP. Fully local.',
  recorder:
    'Record the screen, a window or a tab — with mic narration mixed in — or capture voice alone. Pause, resume, stop and download the WebM. Nothing leaves your device.',
  upscaler:
    'Enlarge images 2×, 3× or 4× with stepped high-quality resampling plus unsharp sharpening. Before/after sizes shown side by side. Runs in your browser.',
  archive:
    'Open .tar and .tar.gz archives, list every entry, extract a selection to a ZIP, build tar.gz from a folder or gzip one file. In your browser, nothing uploaded.',
  'file-tools':
    'Split files into verified parts and rejoin them, bulk-rename a batch with live preview, swap extensions and find duplicates. Runs in your browser — nothing uploaded.',
  encrypt:
    'Encrypt files or text with a password: AES-256-GCM plus PBKDF2 key stretching at 310,000 iterations, all inside your browser tab. No upload, no account, no recovery.',
  'meta-scrub':
    'See every EXIF record a photo carries — camera, GPS coordinates, timestamps — then strip them losslessly: JPEG segment surgery, PNG critical-chunk rebuild. Runs in your browser, nothing uploaded.',
  jwt:
    'Decode a JWT’s header and payload with exact error positions, read every claim as a local date with expiry distances, and verify HS*, RS*, PS* or ES* signatures with WebCrypto — all in your browser, nothing uploaded.',
  'hash-file-batch':
    'Checksum many files or a whole folder with MD5, SHA-1 and SHA-256, export sha256sum-compatible lists and verify pasted checksums visually. Nothing uploads.',
  cron:
    'Read a cron expression in plain English, preview its next fire times from your device clock and simulate its per day/week/month load. Hand-written parser, real Vixie rules, nothing uploaded.',
  diff:
    'Compare two texts with a real patience diff — word-level highlights inside edited lines, side-by-side or inline, and a unified patch export that applies with git apply. Nothing is uploaded.',
  uuid:
    'Generate UUID v4, UUID v7 and ULID in bulk from your browser’s crypto engine, with a monotonic ULID mode and an inspector that decodes versions, variants and embedded timestamps.',
  'convert-units':
    'Convert 73 units across 10 categories through exact published factors, switch numbers between bases 2–36 with two’s-complement views and read strict Roman numerals. All computed in your browser.',
  lorem:
    'Generate Lorem ipsum or plain-English wireframe filler as paragraphs, sentences, words or lists — seeded, so the same seed rebuilds the same text. HTML mode included, nothing uploaded.',
  'fake-data':
    'Generate up to 500 guaranteed-fake test records — names, e-mails, phones, addresses, companies across six locales — as CSV or JSON. Reserved-range honest, seeded, entirely in your browser.',
  'css-tools':
    'Build CSS gradients (linear, radial, conic), layered box shadows and per-corner border radius with live previews — copy the exact CSS you are looking at. Everything runs in your browser.',
  'meta-tags':
    'Build your page’s Open Graph, X card and search meta tags with live previews of the Google snippet, X card and Facebook card — escaped HTML output, length guidance, nothing uploaded.',
  barcode:
    'Generate scannable Code 128 and EAN-13 barcodes as vector SVG or 3× PNG, with real EAN-13 check-digit validation and adjustable bar width and height. Rendered locally, no watermark.',
  calculator:
    'A real online calculator: full expressions with precedence, scientific functions, DEG/RAD, memory keys and a reusable tape — parsed by hand, no eval, nothing uploaded.',
  percentage:
    'Six percentage calculators in one page: X% of Y, percent change, discounts, tips with splitting, and sales tax/VAT — every answer shows the formula behind it, computed live.',
  'date-calculator':
    'Age in years, months and days, days between dates, add or subtract time with real month-end clamping, business days and a live countdown — computed on your device.',
  bmi:
    'BMI with WHO bands, BMR and TDEE calorie targets, ideal weight by four published formulas and body-fat estimates — every formula shown, nothing stored, nothing sent.',
  loan:
    'Loan and mortgage payments with the full amortization schedule, extra-payment savings, compound-interest projections and a savings-goal planner — exact math, CSV exports, computed locally.',
  timer:
    'Online stopwatch with laps, countdown with alarm, pomodoro and tabata intervals — timestamp-driven so a throttled tab cannot drift, with a local WebAudio alarm.',
  picker:
    'Wheel of names, crypto-random numbers, coin flips, dice, list shuffling and balanced team splits — real randomness from crypto.getRandomValues, drawn entirely on your device.',
  regex:
    'Test JavaScript regexes live: highlighted matches, capture and named groups, replace preview with backreferences, zero-length-loop protection and a pattern library. Fully local.',
  csv:
    'Convert CSV to JSON and JSON to CSV with a real RFC 4180 parser — quoted fields, escaped quotes, CRLF, custom delimiters, type inference and honest malformed-quote warnings.',
  color:
    'Convert any color between HEX, RGB and HSL with alpha, sample from an image or the screen, test WCAG 2.1 contrast, and build tints, shades and harmony palettes — all in your browser.',
  signature:
    'Draw with mouse, finger or stylus, or type your name in handwriting faces — a transparent PNG trimmed to the ink bounds downloads at your chosen width. Nothing is uploaded or stored.',
  invoice:
    'Build an invoice with line items, percent or flat discount, tax on the post-discount base, shipping and notes, then print or save as PDF from the browser dialog. No account, nothing stored.',
  timezone:
    'Convert a time across IANA zones with next-day badges, keep live world-clock cards, and read a meeting-planner strip that colors every hour and names the overlap windows. Fully local.',
  'pdf-to-image':
    'Turn PDF pages into PNG or JPG images at 1×, 2× or 3× scale with pdf.js — page thumbnails, single downloads or a ZIP of the run. The file never leaves your device.',
  'device-test':
    'Test your webcam and microphone before the real call: track resolution, measured FPS, a live mic level meter and a device info card. No recording code exists on the page.',
  beautify:
    'Format HTML, CSS and JavaScript with js-beautify and SQL with sql-formatter (five dialects), compact with calc-safe minifiers, and pin JSON errors to the exact line and column — all local.',
  favicon:
    'One image becomes every favicon: 16–512 px PNGs, a genuine multi-size .ico built to spec, an apple-touch icon and the copy-paste link tags — previewed at true size, packed as a ZIP.',
  watermark:
    'Stamp text or your logo across a batch of photos with position, rotation, opacity and tiling, preview live, and download the watermarked set as a ZIP. Nothing uploads.',
  'typing-test':
    'Measure real typing speed: WPM, CPM, accuracy and consistency over 15 seconds to 3 minutes on a locally generated word stream. The clock starts on your first keystroke, not on load.',
  markdown:
    'Write Markdown with a live preview, a table generator and HTML exports from a built-in engine that escapes raw HTML by default. READMEs, drafts and docs, rendered on your device.',
  stats:
    'Paste any list of numbers for mean, median, mode, range, quartiles, IQR, variance and standard deviation — sample or population — with outliers named by the 1.5×IQR rule and a live histogram. Runs on this device.',
  'number-to-words':
    'Write amounts in words the way a cheque needs: dollars and cents, euros, pounds, rupees and paise, with Indian lakh/crore or international million/billion. Truncates, never rounds, and states the limit.',
  morse:
    'Translate text to Morse code and back in one box, with live audio playback at 5–35 WPM on the standard PARIS timing and an adjustable tone. The full ITU table, unencodable characters named.',
  'font-changer':
    'Turn text into the Unicode styles bios use — bold, italic, script, fraktur, small caps, circled, fullwidth, upside-down — thirteen styles live at once, each copied in one click, with coverage limits written on the page.',
  emoji:
    'Find the emoji you mean by name or keyword — “heart”, “fire”, “sad” — across nine categories, click to copy. A built-in set that works offline and tracks nothing; the scope is stated honestly.',
  'json-to-ts':
    'Generate clean TypeScript interfaces from any JSON: one per distinct object shape, array items singularized, fields missing from some members marked optional, unions for mixed arrays. Local and deterministic.',
  'compress-pdf':
    'Shrink PDFs in your browser: pages rasterized at your chosen scale and JPEG quality, rebuilt at the original page size, with an honest before/after verdict — including “keep the original” when rasterization loses.',
  'time-card':
    'Turn a week of in/out punches into hours and pay: two pairs per day, break deductions, overnight shifts across midnight, overtime after your threshold at your multiplier, gross pay with the formula printed.',
  grade:
    'Three grade calculators: weighted grade over your coursework, the score you need on the final (algebra printed, unreachable targets named), and GPA on the standard unweighted 4.0 scale from letters or percents.',
  todo:
    'A to-do list that lives in your browser only: Enter to add, click to tick, drag to reorder, filters and a Markdown export — persisted in localStorage, synced with nobody, deleted when you say so.',
  meme:
    'Turn your own picture into a classic top-and-bottom text meme: Impact-style captions, two-line wrapping, font-size control, watermark-free PNG download — rendered in your browser, nothing uploaded.',
  'svg-convert':
    'Rasterize SVG markup to PNG or JPG at any size and background: native, 2×, 4× or custom with aspect lock, transparent PNG supported, scripts stripped before render — all client-side.',
  cipher:
    'Encode and decode ROT13, Caesar, Atbash and Vigenère in one box — case and punctuation preserved, with a Caesar brute-force table showing all 25 shifts for unknown keys.',
  'due-date':
    'Estimate a pregnancy due date by Naegele’s rule from the last period (cycle-adjusted) or 266 days from conception — weeks pregnant today, trimester, progress and milestone dates. An estimate, not medical advice.',
  'word-frequency':
    'Paste text and get a live keyword density table with a stopword switch, totals and reading time, plus Flesch reading ease and Flesch-Kincaid grade level computed from your actual words.',
  vcard:
    'Build a contact card and export it as a real vCard 3.0 .vcf file plus a QR code of the same card — only filled fields, RFC-correct escaping, UTF-8 names, generated entirely on your device.',
  'calendar-link':
    'One event, every calendar: Google, Outlook and Yahoo deep links plus an RFC 5545 .ics with proper escaping and line folding. All-day events and exclusive end days handled exactly right.',
  'px-rem':
    'Convert px to rem, em and % at once against a configurable root and em context, with a quick-reference grid and a clamp() builder for fluid type — including the honest inverted-bounds warning.',
  binary:
    'Convert text to binary, hex, octal or decimal and back, live in both directions — UTF-8 with real byte counts or strict ASCII that names the first bad character, forgiving grouping.',
  'sound-tools':
    'Four sound tools on one page: a dB meter with calibration, a 20 Hz–20 kHz tone generator, an autocorrelation guitar tuner with a cents needle, and a metronome scheduled on the audio clock. Nothing is recorded.',
  tts:
    'Read any text aloud with the voices your browser already ships — sentence-chunked playback that survives long articles, real progress, pause and stop that work, and honest states when a browser has no speech engine.',
  'fuel-cost':
    'Work out a trip’s fuel cost in km or miles, L/100km, km/L or MPG (US/UK), priced per liter or gallon — with an even passenger split, round-trip toggle and the L/100km ↔ MPG equivalence shown both ways.',
  salary:
    'Convert pay between hourly, daily, weekly, monthly and annual — with unpaid breaks deducted before annualizing, overtime at its multiplier on top, and the whole pipeline printed. Gross, pre-tax, honestly labelled.',
  sleep:
    'Bedtimes that complete 3–6 ninety-minute sleep cycles before your alarm, or wake times after whole cycles from lights-out — with adjustable fall-asleep latency and the average-cycle caveat stated, not hidden.',
  pace:
    'Pace per km and per mile, speed, an even-pace splits table, and race-time predictions for 5K, 10K, half and full marathon by Riegel’s formula — with the assumptions the formula carries stated on the page.',
  'one-rep-max':
    'Estimate your one-rep max from weight × reps with Epley, Brzycki, Lander and Lombardi side by side, a consensus average, and the training-percentage table from 95% strength doubles down to 60% endurance work.',
  fraction:
    'Add, subtract, multiply and divide fractions with the full worked steps — LCD rewriting, cross products, keep-change-flip, GCD reduction — plus fraction ↔ decimal conversion with repeating cycles detected and parenthesised.',
  quadratic:
    'Solve ax² + bx + c = 0: discriminant, real or complex roots, vertex and axis of symmetry, factored form when it prints cleanly — worked steps with your numbers, and an SVG parabola that rescales around the vertex.',
}

/**
 * Per-tool FAQs. Mode-specific entries keep the variant ids as keys and are
 * shown on the landing page when that mode is selected; the tool-level entries
 * ship in structured data for the tool page.
 */
export const APP_FAQS: Record<string, Faq[]> = {
  // ------------------------------------------------------------- tool-level
  share: [
    {
      q: 'Are my files uploaded to a server?',
      a: 'No. Text, files and folders travel through the live session directly between the devices in it, and they are discarded when the session ends. The 50 MB per-file limit exists because the transfer runs peer-to-peer.',
    },
    {
      q: 'What happens if the connection drops mid-transfer?',
      a: 'Kontivo reconnects on its own, and failed files stay queued on your side so you can resend them with one tap once the link is back.',
    },
    {
      q: 'Do text, files and folders need separate codes?',
      a: 'No — one session serves all of them. Inside the room you switch between Text, Files and Folder tabs freely; the code stays the same.',
    },
  ],
  call: [
    {
      q: 'Do my guests need to install anything?',
      a: 'No. Everyone joins from a browser with the code, the link or the QR, on a phone or a computer. No accounts anywhere.',
    },
    {
      q: 'Are meetings recorded?',
      a: 'No. There is no recording and no cloud storage; when the session ends, it is gone.',
    },
    {
      q: 'Is the video routed through a server?',
      a: 'The connection is set up through our relay, but the video and audio flow directly between the browsers whenever the networks allow it.',
    },
  ],
  screen: [
    {
      q: 'Can I share just one tab instead of my whole screen?',
      a: 'Yes. Your browser’s picker offers tabs, windows and entire screens. Pick the narrowest thing that does the job; nothing leaves the session.',
    },
    {
      q: 'Can the helper control the other device?',
      a: 'No, and that is deliberate. Remote Assist sees the shared view and talks the person through the fix; their device stays theirs.',
    },
    {
      q: 'What does the viewer need?',
      a: 'A browser and the session code. They watch live on any device, including a phone.',
    },
  ],
  camera: [
    {
      q: 'Is the video stored anywhere?',
      a: 'No. Streams exist only between the devices in the session and disappear when it ends. The baby and pet monitor adds explicit consent and loud disconnect alerts on top.',
    },
    {
      q: 'How does the phone become a webcam?',
      a: 'Open the session on your computer, join from the phone with the code, allow the camera, and the phone’s video appears on the computer as a webcam source.',
    },
  ],
  voice: [
    {
      q: 'How does push-to-talk work?',
      a: 'Hold the button to talk, release to listen, on any device in the session. It behaves like real walkie-talkies, so nobody talks over anybody.',
    },
    {
      q: 'Where do my recordings go?',
      a: 'They live inside the session and can be downloaded from it. Nothing is kept on our side once the session ends or expires.',
    },
    {
      q: 'Why use a phone as a microphone?',
      a: 'Phone mics are usually better than laptop mics, and this works even if the computer has no mic at all. The phone joins the session and its audio lands on the computer.',
    },
  ],
  notepad: [
    {
      q: 'Can several people type at the same time?',
      a: 'Yes, it is one live document. Everyone in the session writes into the same note and sees the others as they type — in prose or in the code mode.',
    },
    {
      q: 'Is the note saved for later?',
      a: 'Nothing is stored on our side. Copy the note out (or keep the session alive) before you end it; ending the session discards the text.',
    },
    {
      q: 'Does the code mode need any setup or extensions?',
      a: 'No. It opens in the browser like every tool here. Create a session, share the code, and you are editing together with highlighting and snapshots.',
    },
  ],
  present: [
    {
      q: 'Can the audience follow on their phones?',
      a: 'That is the main setup: you present from your laptop, everyone else opens the session code on their phone and sees the current slide live.',
    },
    {
      q: 'Are my slides uploaded anywhere?',
      a: 'No. Slides travel through the live session at full quality and exist only on the devices in it.',
    },
    {
      q: 'Can I control slides from my phone?',
      a: 'Yes: join the same session on your phone and it becomes the remote — next, back, blank and a live pointer for the audience.',
    },
  ],
  canvas: [
    {
      q: 'Can I draw on Canvas from a phone?',
      a: 'Yes. Canvas is touch-first: draw with a finger or stylus on phones and tablets, or with the mouse on a laptop, and every stroke reaches the other devices live.',
    },
    {
      q: 'Is the whiteboard saved anywhere?',
      a: 'No. The board lives only while the session does. If you want to keep it, export or screenshot before you end the session.',
    },
  ],
  roundtable: [
    {
      q: 'How do I get people into a Roundtable room?',
      a: 'Share the six-character code, the link or the QR code. They join in a browser: no app, no account.',
    },
    {
      q: 'What is Roundtable good for?',
      a: 'Short, ad-hoc discussions: a quick stand-up, a decision, a class check-in. Chat keeps the context and polls settle questions in seconds.',
    },
  ],
  'co-browse': [
    {
      q: 'Does Collaborative Browsing work with every website?',
      a: 'With sites that allow being shown inside a session page. Some (banks, portals with strict security) refuse to be embedded and cannot be co-browsed.',
    },
    {
      q: 'Do the other people see my logins?',
      a: 'No. You browse as yourself on your side; the session shares the page and scroll, not your credentials.',
    },
  ],
  'location-share': [
    {
      q: 'Who can see my location?',
      a: 'Only the devices in that session, and only while it runs. There is no history: when the session ends, the position is discarded.',
    },
    {
      q: 'Can I see everyone on a map?',
      a: 'Yes. Every live position is plotted on one map inside the tool, with accuracy circles and an expiry on each; classic Google Maps and OpenStreetMap links stay available for navigation.',
    },
  ],
  'live-captions': [
    {
      q: 'Which browsers support the captions?',
      a: 'Speech recognition in the browser varies: Chrome and Edge currently give the best results, and the tool tells you honestly when your browser cannot caption.',
    },
    {
      q: 'Can it translate while captioning?',
      a: 'Yes, captions can be translated live for other people in the session, so a mixed-language room can still follow along.',
    },
  ],

  // ------------------------------------------------- instant tools (14)
  zip: [
    {
      q: 'Is there a file size limit?',
      a: 'No hard wall. Packing and unpacking run on this device, so the practical limit is its memory — and a folder that would take minutes to upload finishes in seconds because nothing ever leaves the browser.',
    },
    {
      q: 'Does the folder structure survive?',
      a: 'Yes. Subfolders arrive nested exactly as they went in, and extracting a ZIP rebuilds its internal structure.',
    },
    {
      q: 'Can I see what is inside a ZIP before extracting?',
      a: 'Yes — every entry is listed first, so you can take a single file or download everything at once.',
    },
  ],
  image: [
    {
      q: 'Are my photos uploaded anywhere?',
      a: 'No. Compression, conversion and resizing use the browser’s own image encoder on this device. The files never leave your machine.',
    },
    {
      q: 'Can I hit an exact file size, like “under 100 KB”?',
      a: 'Yes — target-size mode searches the quality scale automatically until the output fits under your number where the format allows.',
    },
    {
      q: 'Which formats can I convert between?',
      a: 'PNG, JPEG and WebP in any direction, for one image or a whole batch, with a preview showing the real before/after size before you download.',
    },
    {
      q: 'How does crop work for a batch of different-sized images?',
      a: 'The box is absolute pixels — left, top, width, height — applied to every image and clamped to each image\u2019s own bounds, so one setting always produces a valid rectangle per file instead of erroring the batch.',
    },
    {
      q: 'Does rotating blur the image?',
      a: 'No — rotation is quarter turns only (90\u00b0, 180\u00b0, 270\u00b0), which move pixels without resampling them. Free-angle rotation would require interpolation and soften the image; this tool does not pretend otherwise. 90\u00b0 and 270\u00b0 swap the width and height.',
    },
  ],
  hash: [
    {
      q: 'Can this verify a download is intact?',
      a: 'Yes: paste the hash the publisher published and the tool gives a clear match / no-match. A match proves the file is byte-for-byte what was published.',
    },
    {
      q: 'How big can the file be?',
      a: 'Files are hashed in streaming chunks, so multi-gigabyte ISOs work without freezing the tab — and without uploading anything.',
    },
    {
      q: 'Which algorithms are supported?',
      a: 'MD5, SHA-1, SHA-256 and SHA-512, computed in one pass for both files and plain text.',
    },
  ],
  encode: [
    {
      q: 'Does it handle emojis and non-Latin text?',
      a: 'Yes. Encoding is Unicode-safe: text is UTF-8 encoded before Base64, so emoji, CJK and accented text round-trip exactly.',
    },
    {
      q: 'What is a data URL for?',
      a: 'It embeds a file directly inside HTML, CSS or JSON — an inline image in a stylesheet, for example — so the file ships with the code instead of as a separate request.',
    },
    {
      q: 'Can I turn Base64 back into a file?',
      a: 'Yes. Drop or paste Base64 and decode it into a downloadable file, byte-for-byte.',
    },
  ],
  json: [
    {
      q: 'What does “exact error position” mean?',
      a: 'When JSON fails to parse, the validator reports the line and column and the parser’s message — a stray comma takes seconds to find, even in a large document.',
    },
    {
      q: 'Is my JSON sent to a server?',
      a: 'No. Parsing and formatting happen in this tab, so API responses with tokens or private data are safe to paste.',
    },
    {
      q: 'Can I sort keys alphabetically?',
      a: 'Yes — sorted keys make two documents easy to diff and compare side by side.',
    },
  ],
  text: [
    {
      q: 'What counts as a word?',
      a: 'Whitespace-separated tokens, the same way most word processors count. Character, sentence, paragraph and reading-time counts update live as you type.',
    },
    {
      q: 'Can I remove duplicate lines?',
      a: 'Yes, along with sorting, trimming, numbering, reversing and removing empty lines — each one click on the same text.',
    },
    {
      q: 'Does find and replace support regex?',
      a: 'Yes — switch the pattern to regex for bulk edits; plain-text mode stays the default for simple swaps.',
    },
  ],
  password: [
    {
      q: 'Are these passwords really random?',
      a: 'They come from the browser’s cryptographic random source, not Math.random, and they are generated on your device — never transmitted, never stored.',
    },
    {
      q: 'What is the passphrase mode for?',
      a: 'Word-based passphrases are easier to type and remember — on a TV remote or a phone — while still carrying high entropy. Separators and numbering are optional.',
    },
    {
      q: 'What does the strength estimate mean?',
      a: 'It is the entropy of what was generated: how many tries a brute-force attack would need on average. Longer and more varied means more entropy.',
    },
  ],
  qr: [
    {
      q: 'Do the QR codes expire?',
      a: 'Never. The code is rendered on your device and encodes your content directly — it works offline, forever, and you download the PNG.',
    },
    {
      q: 'Can guests join my Wi-Fi without me reading out the password?',
      a: 'Yes — Wi-Fi mode encodes the network name and password; a phone camera scan offers to join the network.',
    },
    {
      q: 'What can I put in a QR code here?',
      a: 'A link, plain text, a Wi-Fi network, or a contact card (vCard) that a phone camera saves straight into contacts.',
    },
    {
      q: 'Can this page read a QR code too, not just draw one?',
      a: 'Yes — the Scan tab reads codes from your camera or from an image you drop in. It decodes inside this tab (native BarcodeDetector when your browser has one, a bundled engine otherwise), and parsed payloads get real actions: links open, Wi-Fi payloads reveal their password, vCards unpack their fields, and a Kontivo session QR offers a one-tap join. Frames never leave the device.',
    },
  ],
  pdf: [
    {
      q: 'Are my PDFs uploaded to a server?',
      a: 'No. Merging, organizing and splitting run entirely in your browser with pdf-lib — the files never leave your device.',
    },
    {
      q: 'How do I extract specific pages?',
      a: 'Type ranges like 1-3, 7, 12- into the extract box and the tool builds a fresh PDF from exactly those pages. “Split every N” cuts the file into parts delivered as a ZIP.',
    },
    {
      q: 'Can I delete or rotate pages?',
      a: 'Yes — every page shows as a live thumbnail; rotate, delete or reorder from there, and deleted pages stay restorable until you rebuild.',
    },
    {
      q: 'What about password-protected PDFs?',
      a: 'Encrypted files are detected and explained up front, rather than failing silently or coming out mangled.',
    },
  ],
  'pdf-view': [
    {
      q: 'Does the whole PDF upload for viewing?',
      a: 'No. pdf.js renders it locally in this tab — the document never leaves your device, which is also why it works offline once loaded.',
    },
    {
      q: 'Can I search inside the PDF?',
      a: 'Yes — the search scans every page and lists which pages contain the phrase, with hit counts; click a result to jump straight there.',
    },
    {
      q: 'What about password-protected PDFs?',
      a: 'They are refused with the reason. Honest refusal beats a broken viewer.',
    },
  ],
  'pdf-text': [
    {
      q: 'Does it work on scanned PDFs?',
      a: 'Scanned (image-only) PDFs have no text layer; the tool detects that and tells you honestly instead of returning empty pages — no fake OCR.',
    },
    {
      q: 'How is the text exported?',
      a: 'Copy everything at once, or download a .txt — continuous, or page-marked so you know which page each part came from.',
    },
    {
      q: 'Where does extraction run?',
      a: 'Locally, with pdf.js in this tab. Big documents show live per-page progress; nothing is uploaded.',
    },
  ],
  'images-to-pdf': [
    {
      q: 'Which image formats can I combine?',
      a: 'JPEG, PNG, WebP, GIF, BMP and AVIF — any mix, in the order you arrange.',
    },
    {
      q: 'Will phone photos come out sideways?',
      a: 'No. EXIF rotation is read and applied before embedding, so photos arrive straight-side-up in the PDF.',
    },
    {
      q: 'What page sizes are supported?',
      a: 'A4, US Letter, or a page exactly the size of each image — with auto, portrait or landscape orientation and none, small or large margins.',
    },
  ],
  'office-view': [
    {
      q: 'Do I need Microsoft Office installed?',
      a: 'No. DOCX renders as formatted HTML in a locked-down sandbox; XLSX, XLS and CSV show as a grid with sheet tabs — all inside this browser tab.',
    },
    {
      q: 'Can I convert files here too?',
      a: 'Yes — DOCX to HTML or plain text, CSV to XLSX, and any spreadsheet sheet to CSV, all produced locally.',
    },
    {
      q: 'Why are old .doc and PowerPoint files refused?',
      a: 'They are different binary formats this tool does not parse. It says so honestly and points at what works — convert to .docx, or use the PDF tools — rather than showing garbage.',
    },
  ],
  'epub-view': [
    {
      q: 'Can it open DRM-protected library books?',
      a: 'No — and it says so plainly. DRM-locked files cannot be rendered; DRM-free .epub books open fine.',
    },
    {
      q: 'Where does the book go when I close the tab?',
      a: 'Nowhere. The file is read locally each visit and nothing about you or your library is kept. The table of contents makes it easy to jump back to a chapter.',
    },
    {
      q: 'Can I change the text size?',
      a: 'Yes, from 12 to 28 px, applied without reloading the book.',
    },
  ],
  audio: [
    {
      q: 'Which formats can I drop in?',
      a: 'Whatever your browser decodes: WAV, MP3, OGG, FLAC, M4A and friends. If a file cannot be decoded, the page says so instead of guessing.',
    },
    {
      q: 'Does speeding audio up change the pitch?',
      a: 'Yes — like tape. The samples are resampled, so a 2× clip plays an octave up. It is stated on the control rather than hidden behind a lossy algorithm.',
    },
    {
      q: 'Is the MP3 export real MP3?',
      a: 'Yes — encoded on this device with the LAME engine compiled to JavaScript. WAV export is 16-bit PCM, which plays everywhere.',
    },
  ],
  gif: [
    {
      q: 'How long a video should I convert?',
      a: 'Short is better: every frame is captured and quantized in this tab, so a 5–10 second clip at 10 fps is the sweet spot and finishes in seconds.',
    },
    {
      q: 'Why is my GIF bigger than the video?',
      a: 'GIF stores every frame as raw indexed pixels — it cannot match video compression. Lower fps, smaller width, or skipping frames in the shrink mode brings the size down.',
    },
    {
      q: 'What does frame-skip do when shrinking a GIF?',
      a: 'It keeps every Nth frame and re-times the delays so the animation plays at the same speed, just with fewer frames to store.',
    },
  ],
  'frame-grab': [
    {
      q: 'What resolution are the frames?',
      a: 'The video’s own native resolution, straight from the decoder — a 1080p clip yields 1920×1080 PNGs unless you pick a smaller scale.',
    },
    {
      q: 'Why does the video have to play in this browser?',
      a: 'Frames are decoded by the browser’s video engine, so formats it supports (WebM, MP4/H.264 on most systems) work and DRM-protected streams are honestly refused.',
    },
    {
      q: 'Can I grab every frame?',
      a: 'You can sweep at a fixed interval (every 0.5 s, 1 s, …) or request an even count across the clip. True every-single-frame export is a job for desktop tools.',
    },
  ],
  recorder: [
    {
      q: 'Where does the recording go?',
      a: 'Into this tab’s memory only. When you stop, the WebM is handed to you as a download — there is no cloud copy, because there is no upload code here.',
    },
    {
      q: 'Why does my browser ask for permission?',
      a: 'Screen and microphone capture are protected browser features: you choose the surface (screen, window, tab) and can cancel any time. The page records only what you granted.',
    },
    {
      q: 'What file do I get?',
      a: 'WebM — VP8/VP9 video with Opus audio, or Opus alone for voice recordings. It plays in any modern browser and VLC.',
    },
  ],
  upscaler: [
    {
      q: 'Is this AI super-resolution?',
      a: 'No, and the page will not pretend otherwise. It uses stepped high-quality resampling plus an unsharp mask — real, predictable quality without a 50 MB model download.',
    },
    {
      q: 'Why step through 2× doublings instead of one jump?',
      a: 'Each doubling reuses smooth interpolation on an already-clean intermediate, which preserves far more edge structure than a single large resample.',
    },
    {
      q: 'What does the sharpening slider do?',
      a: 'An unsharp-mask pass: it exaggerates local contrast along edges. Small amounts crisp up enlargement; heavy amounts start to halo — the preview shows it honestly.',
    },
  ],
  archive: [
    {
      q: 'Should I use this or the Zip tool?',
      a: 'ZIP files belong to the Zip tool — packing, unpacking and batch downloads all live there. Archive Explorer is for the TAR family: .tar, .tar.gz, .tgz and lone .gz files. Both run entirely on your device, so choosing wrong costs nothing but one tab.',
    },
    {
      q: 'What happens to symlinks inside a TAR?',
      a: 'They are listed with the path they point to, but never extracted or followed. Links are skipped when the ZIP of your selection is rebuilt, so an archive cannot place files outside the tree you chose.',
    },
    {
      q: 'Is there a size limit?',
      a: 'Extraction is capped at 1 GB uncompressed. The work runs in this tab’s memory on purpose, and the cap keeps that honest on small devices — the page shows the archive’s uncompressed total before you extract anything.',
    },
    {
      q: 'Are my archives uploaded anywhere?',
      a: 'No. There is no upload code on this page at all: the archive is parsed and rebuilt in this tab, and the only network traffic is the page itself. The browser’s network tab will confirm it.',
    },
  ],
  'file-tools': [
    {
      q: 'Can it delete the duplicate files from my disk?',
      a: 'No — and no browser page can. The sandbox only lets a page hand you downloads, never modify files on disk. File Workshop marks a suggested keeper per group (the oldest copy) and gives you a keeper list (.txt), but removing the duplicates stays a manual step on your side.',
    },
    {
      q: 'Is merging split parts safe?',
      a: 'When the manifest is picked, every claim is checked: the total size must match the recorded original, and the rejoined bytes are streamed through SHA-256 again and compared with the hash taken at split time. A green banner means the restore is byte-identical; a mismatch stops the automatic download and tells you which verdict failed instead of handing you a broken file.',
    },
    {
      q: 'How big can the files be?',
      a: 'Single-file operations — split and merge — are capped at 2 GB, because the work runs in this tab and the cap keeps it honest on ordinary devices. Duplicate detection full-hashes files up to 256 MB each; bigger files are judged on their first and last 64 KB and labelled “likely duplicate — partial hash”.',
    },
    {
      q: 'Does renaming change my original files?',
      a: 'No. A browser cannot rename files on disk. Applying downloads copies with the new names — individually or as one ZIP — and the originals stay exactly where and as they were.',
    },
    {
      q: 'Are my files uploaded anywhere?',
      a: 'No. There is no upload code on this page: splitting, hashing, renaming and duplicate detection all read your files locally in this tab, and the only network traffic is the page itself.',
    },
  ],
  encrypt: [
    {
      q: 'Is this compatible with OpenSSL, GPG or age?',
      a: 'No, and it does not pretend to be. The primitives are the standard ones — AES-256-GCM and PBKDF2-SHA256 — but the wiring is Kontivo\u2019s own KENC1 container format, so a .enc file made here opens with this page, not with those tools. The full byte layout is printed on the page, so another developer could implement a reader from the spec.',
    },
    {
      q: 'What happens if I lose the password?',
      a: 'The data is unrecoverable. There is no recovery, no reset and no backdoor — that is what working encryption means. Keep the password in a password manager, and encrypt again before deleting anything you still care about.',
    },
    {
      q: 'How strong is the encryption?',
      a: 'The cipher is AES-256-GCM, the authenticated mode browsers use for TLS, and the key is stretched from your password with PBKDF2-SHA256 at 310,000 iterations plus a fresh random salt and IV per operation. That makes brute force expensive — but the weakest link stays the password itself, which is why the page shows an entropy estimate and checks it against the most common passwords.',
    },
    {
      q: 'What if I type the wrong password when decrypting?',
      a: 'GCM authentication fails and the page reports honestly: \u201CWrong password, or the file is damaged.\u201D It never decrypts to garbage, because an authenticated cipher refuses to produce output when the tag does not check out.',
    },
    {
      q: 'Does anything get uploaded?',
      a: 'No. There is no upload code on the page at all: the key is derived in this tab, the file is encrypted or decrypted in this tab\u2019s memory, and the only network traffic is the page itself. The browser\u2019s network tab will confirm it.',
    },
  ],
  'meta-scrub': [
    {
      q: 'What exactly survives the scrub?',
      a: 'The pixels, exactly. For a JPEG, the scrub copies the structural segments (quantization tables, frame, Huffman tables, scan data, EOI) byte for byte, so the image data is untouched — only APPn/EXIF/ICC/COM segments are cut. For a PNG, the file is rebuilt from its critical chunks (IHDR, PLTE, IDATs, IEND), so the pixel data is identical and every ancillary chunk — text, EXIF, timestamps, color profile — is gone.',
    },
    {
      q: 'Will it break my photo?',
      a: 'No, when the lossless path runs — and it is the only path for PNG. The JPEG strip never re-encodes anything, so there is no quality loss at all; if a JPEG has an unusual structure the page cannot walk, it falls back to a canvas re-encode at quality 0.92 and labels that honestly (pixels touched, metadata gone). One honest side effect: the ICC color profile rides in an APPn segment and goes with the scrub — sRGB photos shift nothing, wide-gamut photos can shift colors slightly.',
    },
    {
      q: 'Which formats does it work with?',
      a: 'JPEG and PNG, detected by magic bytes rather than file names. HEIC/HEIF — the iPhone default — and WebP are not parsed here, and the page says so instead of guessing: export or share those photos as JPEG first, then bring them back.',
    },
    {
      q: 'Do social networks strip metadata anyway?',
      a: 'Usually yes — major platforms re-encode uploads and drop most EXIF in the process. But that only covers what you upload to them. Send the file directly by email, chat attachment, AirDrop or a link, and the metadata travels with it — GPS coordinates and all. That is the case this tool closes.',
    },
    {
      q: 'Does anything get uploaded?',
      a: 'No. There is no upload code on this page at all: the photo is parsed and rebuilt in this tab\u2019s memory, and the only network traffic is the page itself. Even the verification pass that re-checks the cleaned file runs locally. The browser\u2019s network tab will confirm it.',
    },
  ],
  jwt: [
    {
      q: 'Is it safe to paste a token here?',
      a: 'Mechanically, yes: decoding and verification run entirely in this browser tab, there is no upload code on the page, and nothing is stored — the paste lives only in component state and disappears when you press Clear or close the tab. But a token is still a credential: prefer test tokens, and press Clear when you are done.',
    },
    {
      q: 'Can it verify RS256 signatures?',
      a: 'Yes — paste the issuer\u2019s public key as a JWK, or a whole JWKS document; if the token header carries a kid, the matching key is picked automatically. RS256/384/512, PS256/384/512 and ES256/384/512 all verify locally with the browser\u2019s crypto engine. HS* tokens verify against the shared secret instead.',
    },
    {
      q: 'Does it fetch the jwks_uri to get the key?',
      a: 'No — this tool is offline by design and has no fetch code at all. Copy the JWK from your identity provider\u2019s JWKS endpoint yourself and paste it; it stays in the tab and never travels anywhere.',
    },
    {
      q: 'What about alg "none"?',
      a: 'It is flagged loudly: a token with alg "none" is unsigned, meaning nothing binds its contents to any key and anyone can forge one. The page never reports such a token as verified — it says plainly that there is nothing to verify.',
    },
    {
      q: 'Does it accept expired tokens?',
      a: 'Yes — inspection and validity are separate. An expired token still decodes fully so you can read its claims and see exactly when it stopped being valid; the badge simply says EXPIRED. Every status is computed against your device clock, which the page shows next to the verdict, wrong clock and all.',
    },
  ],
  'hash-file-batch': [
    {
      q: 'Is the export compatible with Linux sha256sum -c?',
      a: 'Yes. The .sha256, .sha1 and .md5 exports use the GNU two-space format — “HASH  filename” — which sha256sum -c, sha1sum -c and md5sum -c read directly. Filenames are written as-is, never quoted: names containing plain spaces parse correctly, but GNU tools backslash-escape names containing backslashes or newlines and this export does not, so that is the one known gap. The optional ./ prefix matches what GNU tools print for explicit paths.',
    },
    {
      q: 'How big can the files be?',
      a: 'Each file can be up to 2 GB — anything larger is refused honestly before hashing starts, because browser file handling gets unreliable past that size and a native tool such as sha256sum or certutil does it better. The whole queue carries a soft cap of 8 GB: past it the page warns you but still runs, at the cost of possible slowdowns or memory pressure on smaller devices.',
    },
    {
      q: 'Is MD5 still safe to use?',
      a: 'For integrity, yes: MD5 reliably detects a corrupted, truncated or re-downloaded file. For security it is broken — collisions can be crafted on purpose, so an MD5 match is never proof a file is authentic. That is why SHA-256 is ticked by default; keep MD5 for comparing against older lists that only publish it.',
    },
    {
      q: 'Do my files get uploaded?',
      a: 'No. There is no upload code on this page at all: files are read with the browser File API and hashed in this tab, and the only network traffic is the page itself — the browser’s network tab will confirm it. Pasted checksum lists are parsed and matched in memory the same way, and the self-test runs on-device too.',
    },
  ],
  cron: [
    {
      q: 'Why does 0 0 13 * FRI fire on every Friday, not only Friday the 13th?',
      a: 'That is the classic Vixie cron rule: when day-of-month and day-of-week are both restricted, a day fires when EITHER matches — not both. The expression above fires on the 13th of every month and on every Friday. Cron cannot say “both at once” in a single line, so the page warns whenever both day fields are restricted, and the next-runs grid shows the combined schedule so you can see the real behavior before it surprises you.',
    },
    {
      q: 'Does it support L, W and # like Quartz?',
      a: 'No, and that is deliberate: L (last day), W (nearest weekday) and # (nth weekday) are Quartz extensions, not part of standard crontab syntax. Guessing what a Quartz expression means risks a silently wrong schedule, so the parser refuses them with an error that names the field and the exact character. The one exception is ? in the two day fields: it reads exactly like *, is accepted, and is flagged as Quartz-only syntax that Vixie cron would reject.',
    },
    {
      q: 'What timezone are the next runs computed in?',
      a: 'Your device’s local timezone, shown next to the grid. Cron daemons fire in the timezone of the machine they run on — usually the server’s, which may differ from yours. The schedule is in local wall-clock time, so on daylight-saving nights real-world intervals shift with the clock: an hour that does not exist resolves to the next real instant, and a repeated hour shows its first occurrence.',
    },
    {
      q: 'Can I preview @reboot?',
      a: 'No — honestly. @reboot means “fire when the machine boots”, which has no wall-clock time to compute, so there is nothing to preview on a device that is always on. The other shortcuts expand automatically: @hourly is 0 * * * *, @daily is 0 0 * * *, @weekly is 0 0 * * 0, @monthly is 0 0 1 * * and @yearly is 0 0 1 1 *.',
    },
    {
      q: 'Does this tool run my job when the time comes?',
      a: 'No. It only computes when a schedule would fire — nothing executes here, no process starts and no notification is scheduled. It is a reading lamp for crontab lines: paste an expression from your server, check the next runs against your calendar, then fix or keep it. The per day/week/month load numbers are simulations over one representative window, and nothing is uploaded while you do any of it.',
    },
  ],

  // ------------------------------------------------------------------ lorem
  lorem: [
    {
      q: 'Why does my text rebuild exactly the same every time?',
      a: 'That is the seed working, not a bug. The generator hashes the seed string and drives every pick from it, so the same seed with the same settings always produces the identical text — which means a wireframe’s filler survives refreshes and a teammate who re-enters your seed sees exactly what you saw. Press the dice button (or type a new seed) for different text.',
    },
    {
      q: 'What is the plain-English corpus for?',
      a: 'Some prototypes go straight to stakeholders who find Latin distracting or fake-looking. The plain-English corpus is neutral interface vocabulary — sections, headers, controls, samples — so filler reads like wireframe copy instead of Lorem ipsum. Both corpora are hand-written word banks, not scraped text, and both are generated on this device.',
    },
    {
      q: 'How do I get paragraphs wrapped in <p> tags?',
      a: 'Flip on the “Wrap in <p> tags” switch — every paragraph is emitted as its own <p> element, one per line, ready to paste into HTML or a CMS block. The word and character counters strip the tags before counting, so the numbers reflect the visible text.',
    },
    {
      q: 'Is the text real Latin?',
      a: 'It is the classic Lorem Ipsum vocabulary — real Latin words, scrambled by centuries of typesetters into nonsense that reads like prose. That is the point: filler that looks like language but carries no meaning nobody has to fact-check. It is generated here, not fetched, so nothing is uploaded anywhere.',
    },
  ],

  // -------------------------------------------------------------- fake-data
  'fake-data': [
    {
      q: 'Can any of this data reach a real person?',
      a: 'No, and that is by construction. E-mails use only the IANA-reserved example.com / example.net / example.org domains that cannot receive mail. North-American phones use the 555-01XX exchange that is officially reserved for fiction. Other locales’ numbers start with a digit that makes them invalid for international dialing, and IPv4s come from the RFC 5737 documentation blocks that are never routed on the public internet.',
    },
    {
      q: 'What is the seed for?',
      a: 'Reproducibility. The generator is deterministic: the same seed with the same locale and fields always rebuilds the identical dataset, so a bug report can say “row 14 of seed ktv29x breaks the form” and anyone can reproduce that exact row. Roll the dice for a fresh seed when you want new data instead.',
    },
    {
      q: 'How many records can I generate?',
      a: 'Up to 500 per run. The table shows the first 25 so the page stays fast; the CSV and JSON exports always contain the full set. Change the count field and the dataset rebuilds immediately — everything is generated in this tab at the speed of your device.',
    },
    {
      q: 'Which fields can I export?',
      a: 'Exactly the ones you toggled on. Every field switch (name, username, e-mail, phone, street, city, company, job, birthday, IP, user agent, color) shapes both the table and the CSV/JSON columns, so the export matches what your form or spreadsheet actually needs.',
    },
  ],

  // -------------------------------------------------------------- css-tools
  'css-tools': [
    {
      q: 'Does the preview show exactly the CSS I copy?',
      a: 'Yes — that is the core rule of the page. The preview element is styled from the same state that generates the output block, so there is no rendering gap: what you see is byte-for-byte what lands in your stylesheet. The only deliberate difference is the radius preview clamping corners to 100 px so extreme values stay visible, while the copied CSS keeps the true numbers.',
    },
    {
      q: 'How do multiple box-shadow layers work?',
      a: 'Comma-separated shadows composite front to back — the first layer in the list paints on top. The layer list here writes in the same order, so adding a layer in the UI adds it to the front of the CSS list, and the preset “Ring + shadow” shows the technique: a zero-blur spread layer for the ring behind a soft blur layer for depth.',
    },
    {
      q: 'What is the difference between radial and conic gradients?',
      a: 'A radial gradient sweeps outward from a center point — good for glows and vignettes. A conic gradient sweeps around the center like a clock hand — good for color wheels, pie-chart washes and hard-edged angular stops. The controls adapt: radial and conic get a center point, conic additionally gets a start angle.',
    },
    {
      q: 'Is there a color picker?',
      a: 'Yes — every gradient stop and every shadow layer carries the browser’s native color picker plus an editable value field, so you can either pick visually or paste a hex (including #RRGGBBAA alpha values for shadows).',
    },
  ],

  // -------------------------------------------------------------- meta-tags
  'meta-tags': [
    {
      q: 'What lengths should the title and description be?',
      a: 'Titles land best between 50 and 60 characters (results pages clamp near 70), descriptions between 120 and 158 (the clamp sits near 165). The counters under each field show your exact distance from those sweet spots as you type, and the search preview clamps the same way a results page does so you can see the cut before Google makes it.',
    },
    {
      q: 'Why does the emitted HTML escape my quotes?',
      a: 'Attribute values sit inside double quotes, so a title like 5" speakers would break out of the attribute and corrupt the tag. Every value is HTML-escaped — & becomes &amp;, " becomes &quot;, < and > become entities — which is exactly what browsers expect to read back. Your text displays correctly everywhere.',
    },
    {
      q: 'What is the difference between the X card and the Open-Graph card?',
      a: 'Facebook, LinkedIn and Slack read the og:* tags; X reads its own twitter:* tags and falls back to the Open-Graph values when they are missing. This page emits both sets so the same link unfurls properly everywhere, and the two previews show exactly what each platform will draw from your fields.',
    },
    {
      q: 'Does this submit my URL to any service?',
      a: 'No. The previews are drawn from your own fields inside this tab — nothing is fetched from a crawler, no validator is called, no URL is submitted anywhere. What you type never leaves the device.',
    },
  ],

  // ---------------------------------------------------------------- barcode
  barcode: [
    {
      q: 'Which format should I use?',
      a: 'Code 128 when you get to choose: it takes any ASCII text — SKUs, serials, asset tags, short URLs — and stays compact. EAN-13 when the barcode is a retail product: it is the worldwide standard for consumer packages, encodes exactly 13 digits, and scanners expect its strict structure.',
    },
    {
      q: 'What is the check digit, and what if mine is wrong?',
      a: 'EAN-13 ends with a mod-10 check digit computed from the first twelve. Type 12 digits and the page computes and appends it for you; type all 13 and it verifies, naming the expected digit on mismatch. A wrong check digit means a scanner would reject the code at the till — the page refuses to draw it rather than handing you a broken barcode.',
    },
    {
      q: 'Why does my text with an emoji or accent fail?',
      a: 'Code 128 encodes ASCII 0–127 only. Characters outside that range — emoji, curly quotes, accented letters — are reported with their exact position instead of being silently mangled into a barcode that would not scan. Replace them with plain ASCII and the code renders.',
    },
    {
      q: 'Should I download SVG or PNG?',
      a: 'SVG for anything printed or sized after download: it is vector, so it stays sharp at any dimension. The PNG export renders at three times the display size with a white underlay — safe for slides, documents and screens where SVG support is awkward. Both are generated in this tab from the same rendering.',
    },
  ],

  // -------------------------------------------------------------- calculator
  calculator: [
    {
      q: 'Is this a real calculator or a JavaScript eval wrapper?',
      a: 'A real calculator. The expression is tokenized and compiled to reverse-polish notation with the shunting-yard algorithm, then evaluated on an explicit stack — there is no eval() and no Function constructor anywhere in the page. Precedence, parentheses, unary minus and postfix factorial and percent all behave the way a math teacher would expect.',
    },
    {
      q: 'How do the memory keys work?',
      a: 'Like the hardware calculator on your desk: MS stores the current result, MR recalls it into the expression, M+ and M− add or subtract the current result from the stored value, and MC clears it. ANS inserts the last committed answer. The stored value lives only in this tab and disappears when you close it.',
    },
    {
      q: 'Does sin(30) mean degrees or radians?',
      a: 'It depends on the switch — DEG is the default because that is what most people mean, and RAD makes the trigonometric functions interpret arguments as radians for real math and engineering. The inverse functions return values in the selected unit too, so asin(0.5) is 30 in DEG mode and 0.524 in RAD mode.',
    },
    {
      q: 'What happens when an expression is invalid?',
      a: 'You get a specific message, not a NaN shrug: division by zero says so, an unbalanced parenthesis names which one, an unknown word lists the available functions, and two numbers without an operator between them are called out. The live preview shows the error before you commit anything to the tape.',
    },
  ],

  // -------------------------------------------------------------- percentage
  percentage: [
    {
      q: 'Which mode answers “what is 15% of 80”?',
      a: 'The first mode, X% of Y — type 15 and 80 and it answers 12, with the formula (15 ÷ 100) × 80 printed right under the result so you can check the math on sight. It also shows 80 minus and plus that amount, which covers most shopping and markup questions in one view.',
    },
    {
      q: 'How is percent change computed, and why does the direction matter?',
      a: '(New − Old) ÷ |Old| × 100 — the absolute value in the denominator is deliberate, so a change from −40 to −20 reads as a 50% increase, not a negative mess. The result card names “increase” or “decrease” explicitly, and a change from exactly 0 is honestly reported as undefined instead of inventing a number.',
    },
    {
      q: 'Can it extract tax from a price that already includes it?',
      a: 'Yes — flip on “Extract from gross” in the tax mode. A gross of 121 at a 21% rate gives a net of 100 and 21 of tax, using Gross ÷ (1 + rate). That is the backwards calculation VAT invoices need, and it is shown with its formula like every other result.',
    },
    {
      q: 'Does the tip mode split the bill?',
      a: 'It does: set the people count and you get the tip, the total, and what each person pays. The “round tip up” switch rounds the tip to the next whole unit before splitting, which is the restaurant-friendly way to do it. Everything recomputes live as you type, and any card copies its value with one tap.',
    },
  ],

  // ---------------------------------------------------------- date-calculator
  'date-calculator': [
    {
      q: 'How exact is the age calculation?',
      a: 'Calendar-exact: years, months and days are counted the way calendars actually work, with the month borrow taken from the real length of the previous month — not a 30-day approximation. Totals in weeks, months, days, hours and minutes are computed from the actual timestamps, and the next-birthday countdown handles Feb 29 birthdays by clamping to Feb 28 on non-leap years.',
    },
    {
      q: 'What does “exclude the end day” mean in the difference mode?',
      a: 'It settles the booking-style question: from Jan 1 to Jan 2 is that one day or two? With the toggle on (the default) it is one day — the hotel-night count. With it off, both endpoints count — the way you would count a job that runs from Monday to Friday as five working days.',
    },
    {
      q: 'What happens when I add one month to January 31?',
      a: 'You get February 28 or 29, not March 3rd. The month arithmetic clamps to the real end of the target month — the same convention most calendar libraries use and the one people actually mean. A note under the result tells you the clamp was applied.',
    },
    {
      q: 'How are business days counted?',
      a: 'Weekend days are skipped one day at a time, never approximated with a 5/7 ratio — the count between two dates is exact, and adding or subtracting N business days walks the calendar one day at a time until it has skipped past every weekend. Public holidays vary by country, so they are deliberately not assumed; count to a holiday and shift by the extra days it costs.',
    },
  ],

  // ---------------------------------------------------------------------- bmi
  bmi: [
    {
      q: 'Is BMI actually meaningful?',
      a: 'As a population screen, yes; as a personal diagnosis, no. It cannot see muscle mass, bone density or fat distribution, which is why athletes read as overweight. The page shows the WHO band your BMI falls in and the weight range that would move you into the healthy band — and says plainly that this is an estimate, not medical advice.',
    },
    {
      q: 'Why are there four different ideal weights?',
      a: 'Because Robinson, Miller, Devine and Hamwi are four different published formulas, and they genuinely disagree — by several kilograms at some heights. Showing all four side by side is more honest than picking one and pretending it is authoritative. The BMI-derived healthy range is usually the most defensible reference.',
    },
    {
      q: 'Which calorie formula does the page use?',
      a: 'Mifflin-St Jeor for BMR — the equation most clinical guidelines consider the best general formula — then one of five activity multipliers (1.2 to 1.9) for TDEE. The targets (−500, −250, +500) correspond roughly to half a kilo per week of loss or gain, which is the rate most sources call sustainable.',
    },
    {
      q: 'How accurate is the Navy body-fat method?',
      a: 'It is a circumference estimate — typically within 3–4% of a DEXA scan for most people, better than the BMI-based estimate, and sensitive to how you measure. Measure the neck below the larynx and the waist at the navel (plus hips for the female formula), keep the tape level and snug, and read the result as an estimate. The Deurenberg number is shown only as a rougher cross-check.',
    },
  ],

  // --------------------------------------------------------------------- loan
  loan: [
    {
      q: 'How is the monthly payment computed?',
      a: 'The standard annuity formula: P·r·(1+r)ⁿ ÷ ((1+r)ⁿ − 1), where r is the monthly rate (annual ÷ 12) and n the number of months. At a 0% rate the page switches to simple division. The same schedule then runs month by month — interest on the remaining balance first, the rest to principal — which is exactly how amortizing loans work.',
    },
    {
      q: 'What does the extra payment field do?',
      a: 'It simulates the loan again with your extra amount added to every payment, then compares: the result names how much interest you save and how many months earlier the loan ends. The savings come from the real simulation, not a rule of thumb — and the schedule table shows the shortened loan, not the original one.',
    },
    {
      q: 'What is the difference between monthly and daily compounding?',
      a: 'How often the rate is applied. Annual applies 6% once a year; monthly applies 0.5% twelve times, which earns slightly more through interest-on-interest; daily applies a sliver 365 times. The page simulates month by month with your chosen frequency and monthly contributions landing at month end, so the year-by-year table is honest about the timing.',
    },
    {
      q: 'Does the calculator include fees, insurance or taxes?',
      a: 'No, and it says so rather than pretending. Real loans carry arrangement fees, mandatory insurance, rate resets — none of that can be known from amount, rate and term. Treat the results as the exact math of the numbers you entered, and treat a real lender offer as the only binding truth.',
    },
  ],

  // -------------------------------------------------------------------- timer
  timer: [
    {
      q: 'Why does the countdown stay accurate when I switch tabs?',
      a: 'Because the clock is not counted — it is computed. Every tick recalculates the remaining time from performance.now() timestamps instead of adding up interval fires, so the browser throttling a background tab can delay the picture but cannot make the alarm late. When you come back, the display re-syncs to the true time immediately.',
    },
    {
      q: 'How does the alarm sound?',
      a: 'It is synthesized locally with WebAudio — an oscillator, not an audio file — so it works offline and never waits on a download. Browsers may hold audio until your first interaction with the page; press anything once if the first alarm is silent. The alarm repeats for twenty seconds and can be dismissed or set to restart the countdown automatically.',
    },
    {
      q: 'What does the pomodoro cycle do automatically?',
      a: 'After each work phase it moves to a short break; after every N completed work rounds (four by default) it takes a long break instead, then the cycle repeats. A counter tracks completed rounds, and a chime marks each phase change. All the durations are editable — 25/5/15 is the tradition, not a requirement.',
    },
    {
      q: 'Will my phone keep the screen on while the timer runs?',
      a: 'The page requests a screen wake-lock while a timer is running, which keeps the display awake on supporting browsers. If the platform refuses it, the timer still runs — and the tab title mirrors the clock, so a glance at your tab switcher shows the time even from another app.',
    },
  ],

  // ------------------------------------------------------------------- picker
  picker: [
    {
      q: 'How random is this, really?',
      a: 'Cryptographically random. Every draw — wheel result, number, coin, die, shuffle, team assignment — comes from crypto.getRandomValues, the browser’s cryptographic randomness source, with rejection sampling used to keep the distribution exactly uniform. Math.random is never used. Nothing is drawn on a server, so nothing can be rigged or logged.',
    },
    {
      q: 'How does the wheel decide the winner?',
      a: 'The spin gets a random number of full turns and a random angle, decelerates with a real ease-out curve, and the winner is the segment actually sitting under the pointer when the wheel stops — read from the geometry at rest, not chosen in advance and animated toward.',
    },
    {
      q: 'What is the raffle mode for numbers?',
      a: 'The “no repeats” switch: each drawn number is removed from the pool before the next draw, so you get unique results — a raffle, not a dice roll. It needs integer bounds, and if you ask for more unique numbers than exist in the range, the page says so instead of looping forever.',
    },
    {
      q: 'Are the teams split fairly?',
      a: 'The names are shuffled first (Fisher–Yates with the same crypto source), then dealt round-robin into the teams — the same way a sensible playground captain does it, and balance is guaranteed to within one person per team. Changing the team count re-deals from scratch; nothing is remembered between runs.',
    },
  ],

  // -------------------------------------------------------------------- regex
  regex: [
    {
      q: 'Which regex flavor does this test?',
      a: 'JavaScript’s own RegExp engine — the same one that will run your pattern in Node and the browser. That is the point: what matches here matches in your code. Perl, PCRE and Python have small differences (lookbehind support, unicode \\p classes, flag names), so verify there before shipping if your target is another language.',
    },
    {
      q: 'Why does my /a*/g pattern not freeze the page?',
      a: 'Zero-length matches are the classic infinite-loop trap: a pattern that matches the empty string can match forever at the same position. The page steps the engine past any zero-length match explicitly — the standard guard — so patterns like that return their matches and stop instead of hanging. The same trick your production code should use.',
    },
    {
      q: 'How do I read the capture-group columns?',
      a: 'Numbered groups appear as $1, $2… in match order, and named groups as $<name>. An empty circle means the group did not participate in that particular match — common with alternations. Those same references work in the replace preview and in real code: String.replace and String.replaceAll accept exactly this syntax.',
    },
    {
      q: 'Is my test data sent anywhere?',
      a: 'No. Matching runs on this device against the browser’s engine — there is no upload step at all, which matters when the test string is a production log, a token, or customer data. Close the tab and nothing persists; the page stores no history.',
    },
  ],

  // ---------------------------------------------------------------------- csv
  csv: [
    {
      q: 'Why not just split on commas?',
      a: 'Because real CSV breaks: quoted fields containing commas (“Asha, senior”), embedded newlines, escaped quotes ("""), and CRLF line endings are all standard RFC 4180 behavior that split(",") mangles. The parser here is a real state machine for the spec — and it warns you by line number when a quote never closes, instead of silently corrupting the rest of the file.',
    },
    {
      q: 'What does “infer types” change?',
      a: 'With it on (the default), "42" becomes the number 42, "true" becomes boolean true and "null"/"n/a" become null in the JSON output — what most APIs expect. With it off, every cell stays a string exactly as written, which is safer when leading zeros matter (postal codes, phone numbers, part numbers).',
    },
    {
      q: 'How does JSON → CSV handle objects with different keys?',
      a: 'The columns are the union of every key found across all rows, so objects that are missing a field simply leave that cell empty — nothing is dropped to make the grid rectangular. Nested objects and arrays are serialized as JSON strings inside their cell, which is lossless and re-parseable, and a note in the description says so plainly.',
    },
    {
      q: 'Can I use semicolons or tabs instead of commas?',
      a: 'Yes — the delimiter switch covers comma, semicolon, tab and pipe, which covers European Excel exports (semicolon) and TSV files (tab) without any pre-conversion. The chosen delimiter is used for parsing in the CSV→JSON direction and for escaping/quoting in the JSON→CSV direction, and fields containing the delimiter are re-quoted on output.',
    },
  ],

  // -------------------------------------------------------------------- color
  color: [
    {
      q: 'Which color formats can I paste in?',
      a: 'Hex in 3, 4, 6 or 8 digits (#f7a, #ff7a45, #ff7a45ff), rgb() and rgba() with commas or spaces and % or 0–255 components, and hsl()/hsla() in the modern and legacy syntaxes. The page answers in every format at once — hex, rgb, hsl plus the bare components — each with a one-tap copy and a live swatch.',
    },
    {
      q: 'How does picking from an image work?',
      a: 'The image you drop is drawn onto a local canvas; hovering reads the pixel under the cursor with getImageData and clicking commits that color as the working color. The image is never uploaded — the canvas lives in your tab. For picking anywhere on your screen, the browser’s EyeDropper API is used where it exists (Chrome, Edge); where it does not, the button simply is not shown rather than pretending.',
    },
    {
      q: 'What do the WCAG verdicts mean?',
      a: 'The ratio is computed with the WCAG 2.1 relative-luminance formula. 4.5:1 passes AA for normal text, 3:1 passes AA for large text (roughly 18.66px bold or 24px), and 7:1 / 4.5:1 are the AAA levels. The verdicts are shown for both normal and large text so you can match the verdict to the text you are actually styling.',
    },
    {
      q: 'How are the palettes generated?',
      a: 'With real HSL math: the tint-and-shade ramp walks the lightness axis through nine steps at your exact hue and saturation, and the harmonies rotate the hue by 180° (complementary), ±30° (analogous) or ±120° (triadic). Click any swatch to make it the working color — and the contrast tab then tests it against your background immediately.',
    },
  ],

  // --------------------------------------------------------------- signature
  signature: [
    {
      q: 'Is a typed or drawn signature legally valid?',
      a: 'The page produces an image, and the legal weight of an image comes from the agreement around it, not from the pixels. Many jurisdictions accept typed or drawn signatures on contracts (with the usual caveats), and the drawn PNG is what most e-sign flows ask you to supply anyway. For regulated documents, use a qualified e-signature service — this page is where you make the mark, not where you sign the deal.',
    },
    {
      q: 'Why is the PNG trimmed instead of the full canvas?',
      a: 'A signature pasted into a document works better without dead space around it: trimmed ink sits at the size you place it, scales predictably, and does not carry an invisible margin that pushes layouts around. The export crops to the actual bounds of the strokes with a little padding, then scales to the width you picked with high-quality resampling.',
    },
    {
      q: 'Does the background really stay transparent?',
      a: 'Yes — the canvas is transparent by default and the export encodes it as an alpha channel. The checkerboard behind the preview is the standard way of showing transparency honestly: it is not part of the image. If a tool you paste the PNG into shows a white box, that tool is flattening the alpha, not the file.',
    },
    {
      q: 'Does my signature get stored or analyzed anywhere?',
      a: 'No. The strokes live in this tab\u2019s memory, the export happens on a local canvas, and the download is handed to your browser directly. There is no upload endpoint on the page and no stroke data is kept after you close it — refresh and it is gone.',
    },
  ],

  // ----------------------------------------------------------------- invoice
  invoice: [
    {
      q: 'How do I get a PDF of the invoice?',
      a: 'Press Print invoice and choose “Save as PDF” as the destination — every browser\u2019s print dialog offers it. The print stylesheet hides everything except the invoice sheet, so the PDF contains exactly the document you previewed: header, parties, items, totals, notes and terms.',
    },
    {
      q: 'Is tax computed before or after the discount?',
      a: 'After. The subtotal gets the discount first, tax applies to the post-discount base, and shipping adds on top untaxed. That order is how most tax authorities describe it (a discount reduces the taxable amount) and the on-page math breakdown shows every step so your accountant can verify it in seconds.',
    },
    {
      q: 'Can I use my own currency or symbol?',
      a: 'Yes — pick Dollar, Euro, Pound, Rupee, Yen and more from the list, or choose Custom and type any symbol. The symbol applies consistently across the editor, the sheet and the totals, and the discount selector follows it when you switch between percent and flat discounts.',
    },
    {
      q: 'Where is the invoice data saved?',
      a: 'Nowhere. There is no account, no database and no draft folder — the invoice exists in the form fields of this tab and prints from this tab. If you need a copy for the next month, save the PDF; the fields are re-editable any time the page is open.',
    },
  ],

  // ---------------------------------------------------------------- timezone
  timezone: [
    {
      q: 'Where does the zone data come from?',
      a: 'From your browser\u2019s own Intl database — the same IANA tzdata your operating system ships and updates. That means DST rule changes your OS has already downloaded are honored here automatically, and the page never serves a stale timezone table from a server.',
    },
    {
      q: 'What do the “next day” / “previous day” badges mean?',
      a: 'Exactly what they say about the wall-clock date: a 23:00 meeting in New York lands on the next calendar day in Tokyo, and the badge names it with the actual date — the mistake this prevents is scheduling the wrong day in a calendar invite. Same-date rows say so plainly.',
    },
    {
      q: 'How is the meeting-planner strip colored?',
      a: 'Green means the hour falls inside that zone\u2019s working hours (9:00–18:00 by default — adjustable), amber means the person is awake but off the clock, grey means asleep. Hours read left to right in your source zone\u2019s time, the current hour is marked, and the overlap line names every window where all zones are green at once.',
    },
    {
      q: 'Can I compare more than three zones?',
      a: 'Convert and world-clock modes take up to twelve zones each. The planner caps at three because a strip of colored cells stops being readable past that — if you are coordinating more than three zones, run the planner for the critical three and check the stragglers on the convert tab.',
    },
  ],

  // ------------------------------------------------------------- pdf-to-image
  'pdf-to-image': [
    {
      q: 'Which scale should I pick?',
      a: '1× renders at the PDF\u2019s native point size (roughly 72 dpi — fine for screens), 2× doubles it (roughly 144 dpi — good for slides and most print), 3× gives the sharpest text at the cost of four to nine times the pixels per page. For archiving printed pages, 2× is the sweet spot; for zoomable page art, go 3×.',
    },
    {
      q: 'PNG or JPG?',
      a: 'PNG is lossless and keeps text edges crisp — it is the right call for documents, diagrams and screenshots of code. JPG compresses scans and photo-heavy pages far smaller, with the quality slider controlling artifacts. Either way the render is identical; only the encoding differs.',
    },
    {
      q: 'How big a PDF can it handle?',
      a: 'Pages render sequentially with a progress count, so long documents do not freeze the tab; the practical cap is memory, and the page states it honestly when a run hits it — the first 100 pages render, and splitting the PDF lets the rest through. A 500-page file is not a crash here, it is a number you are told.',
    },
    {
      q: 'Does anything upload?',
      a: 'No. The PDF is read into this tab\u2019s memory, each page is rasterized by pdf.js onto a local canvas, and the images go straight to your downloads. You can watch the network tab: no request ever carries a page.',
    },
  ],

  // ------------------------------------------------------------- device-test
  'device-test': [
    {
      q: 'Is my camera or microphone recording anything?',
      a: 'No — there is no recording code on this page at all. No MediaRecorder, no capture graph, no buffer that could be saved: the camera stream paints to a video element and the mic stream feeds a level analyser, and both are stopped the instant you press Stop or close the tab.',
    },
    {
      q: 'Why does the measured FPS differ from the track setting?',
      a: 'The track setting is what the camera promises; the measured number is what actually arrived on screen during a two-second window. Browsers commonly deliver less than the promise under load, in dim light, or when another app holds the camera. If the measured FPS is far below the setting, close other capture apps or drop the resolution.',
    },
    {
      q: 'The browser blocked the camera — what now?',
      a: 'A denied permission is explained on the page, not hidden: click the lock or camera icon in the address bar, set camera (or microphone) to allow for this site, then press Start again. The page only asks for permission when you press a Start button, so nothing opens a hardware light uninvited.',
    },
    {
      q: 'What is the device info card for?',
      a: 'Support tickets. Screen size, pixel ratio, CPU cores, memory hint, touch support, languages, timezone and the full user agent are laid out with a copy-all button, so you can paste exactly what a support engineer asks for instead of describing it — with a secure-context line that explains why camera APIs refuse on plain http.',
    },
  ],

  // ---------------------------------------------------------------- beautify
  beautify: [
    {
      q: 'Which formatter engines are used?',
      a: 'js-beautify for HTML, CSS and JavaScript — the same library that powers browser devtools and JSFiddle — and sql-formatter for SQL, with Standard, MySQL, PostgreSQL, T-SQL and PL/SQL dialects. They run in this tab after loading from the app bundle; your code is never sent anywhere to be formatted.',
    },
    {
      q: 'Why is there no JavaScript minifier?',
      a: 'Because whitespace-stripping minifiers break automatic-semicolon-insertion: remove the wrong newline and two statements merge, silently changing what the program does. Real minifiers parse first and re-emit — that is bundler territory, not a paste-and-pray box. This page ships the beautifier and says no to the footgun, out loud.',
    },
    {
      q: 'What does CSS compact preserve, and why?',
      a: 'Comments and newlines go away, but the spaces inside calc(), min(), max() and clamp() survive. Those functions require spaces around + and − operators — `calc(100% - 24px)` collapses into invalid CSS without them — so the compactor guards those argument lists and restores them byte-exact after collapsing everything else.',
    },
    {
      q: 'How does HTML compact treat pre, textarea, script and style?',
      a: 'As byte-exact islands. Comments and inter-tag whitespace are removed everywhere else, but the contents of those elements are protected verbatim: collapsing whitespace inside a <pre> or a script would change what the browser executes or displays, so the compactor simply never enters them.',
    },
  ],

  // ----------------------------------------------------------------- favicon
  favicon: [
    {
      q: 'Which sizes does a modern site actually need?',
      a: 'This page generates the set the standard <link> tags reference: 16 and 32 for browser tabs, 48 for the classic favicon.ico, 180 for apple-touch, and 192 plus 512 for PWA manifests — plus 64, 96 and 128 for the contexts that ask. The generated HTML snippet lists exactly which file serves which tag.',
    },
    {
      q: 'Is the .ico file just a renamed PNG?',
      a: 'No — it is a real ICO container built to the spec byte-by-byte: an ICONDIR header, one directory entry per size with planes, bit depth and data offsets, then the embedded 16, 32 and 48 pixel images. That is why it works everywhere, including the tools that still refuse anything else.',
    },
    {
      q: 'Cover or contain — which fit should I choose?',
      a: 'Cover center-crops the source to a square and fills the tile edge to edge — right for logos and photos. Contain letterboxes the whole image inside the square with a background color you pick (or transparency), which keeps a wide logo fully visible at the cost of empty margins. Check the 16 px preview either way: that is the size that actually decides legibility.',
    },
    {
      q: 'Why do the previews sit on light and dark chips?',
      a: 'Because a dark-mode browser tab is a different surface: a dark-grey logo that dies on dark needs to be caught in the preview, not in production. Every size renders at true pixel size on both backgrounds, so what you judge is what users get.',
    },
  ],

  // --------------------------------------------------------------- watermark
  watermark: [
    {
      q: 'Text or logo — which watermark should I use?',
      a: 'Text for statements: copyright lines, “SAMPLE”, a name — it scales with the image and never needs a second file. A logo for brands: your PNG sits on the photo at a size you set, and its own transparency is preserved so there is no white box. Both support the same nine positions, opacity, rotation and tiling.',
    },
    {
      q: 'What does tile mode do?',
      a: 'It repeats the watermark across the whole image in a diagonal grid instead of one anchored spot — the pattern photographers use because it cannot be cropped or cloned out from a single corner. Spacing follows your watermark size automatically, and the preview shows the density before you commit the batch.',
    },
    {
      q: 'Are my original files kept intact?',
      a: 'Yes — the stamping happens on a canvas copy of each decoded image, and the originals are never modified or re-uploaded. Exports are format-faithful: a JPEG in gives a JPEG out (at the quality you set), a PNG in gives a PNG out with its transparency preserved, named original.watermarked.ext.',
    },
    {
      q: 'How many images can the batch take?',
      a: 'Up to sixty per run, processed sequentially with every result held in memory for the ZIP — the honest limit is device RAM, and large originals at high resolution are the thing that meets it. For phone-photo batches this is a non-issue; for 50-megapixel TIFFs, work in smaller runs.',
    },
  ],

  // ------------------------------------------------------------- typing-test
  'typing-test': [
    {
      q: 'How are WPM and CPM defined here?',
      a: 'The standard way: WPM is correct characters ÷ 5 ÷ minutes, where five characters is the conventional “word” for typing measurement; CPM is raw characters ÷ minutes. Correct characters means the text that is right at the end — a mistake you fix stops counting against you, one you leave in does count.',
    },
    {
      q: 'When does the timer start?',
      a: 'On your first keystroke, not on page load — reading the word stream before you type is not cheating, it is how the test should work. The clock runs for the duration you picked (15 seconds to 3 minutes) and the test ends itself, so nobody grades their own stopping point.',
    },
    {
      q: 'What does the accuracy number count?',
      a: 'Correct keystrokes over total keystrokes, counted live as you type. The active word shows character-by-character what matches and what does not; uncorrected errors stay in the tally. Fixing as you go is the honest habit — and the consistency score (from the variance of your per-second pace) shows whether you type in bursts or in rhythm.',
    },
    {
      q: 'Where do the words come from, and is my best score saved?',
      a: 'The words come from a built-in list of the most common English words, shuffled locally each run — no network word API, no per-day unlocks. Your session best lives in this tab\u2019s memory only; close the tab and it is gone. There is no account and no leaderboard because typing speed is between you and your keyboard.',
    },
  ],

  // ---------------------------------------------------------------- markdown
  markdown: [
    {
      q: 'Which Markdown features are supported?',
      a: 'What people actually write: headings through h6, bold, italic, strikethrough, inline and fenced code with a language label, links and images, blockquotes, horizontal rules, ordered and unordered lists with nesting, and GFM tables with :— alignment. Raw HTML is handled per the safety switch, not silently.',
    },
    {
      q: 'Why is raw HTML escaped by default?',
      a: 'Because a Markdown tool is where pasted text lands — issue bodies, chat logs, drafts written by strangers or models. Rendering that text as live HTML would execute whatever they embedded. Escaped, a pasted <script> displays as the text it is; the switch exists for documents you wrote, and a URL guard still refuses javascript: links.',
    },
    {
      q: 'What is the difference between the two HTML exports?',
      a: '“HTML” downloads the rendered fragment — the part you embed in an existing page or CMS. “Standalone HTML” wraps the same content in a complete document with embedded styles, so it opens in any browser as a finished file. Both render exactly what the preview shows.',
    },
    {
      q: 'How does the table generator work?',
      a: 'Set rows and columns, and it emits a properly aligned GFM table with placeholder cells — the pipe-and-dash syntax nobody remembers, generated once. Insert it into the editor (it renders in the preview immediately) or copy it for another tool. Alignment defaults to left; edit the dashes to :—: or —: for center or right.',
    },
  ],

  // ------------------------------------------------------------------- stats
  stats: [
    {
      q: 'Which quartile method does this use?',
      a: 'Linear interpolation — the same convention as Excel PERCENTILE.INC and numpy\'s default — for the median, Q1 and Q3. Several textbook definitions exist and disagree by small amounts; this one matches what your spreadsheet already produces, which matters most when you are checking homework against software.',
    },
    {
      q: 'Sample or population variance — which should I pick?',
      a: 'Sample (divide by n−1) when your numbers are a sample of a bigger group and you want to estimate that group\'s spread; population (divide by n) when your numbers ARE the whole group. The switch changes variance and standard deviation together, and each card\'s label and formula update with it.',
    },
    {
      q: 'How are outliers decided?',
      a: 'The 1.5×IQR rule: values below Q1 − 1.5×IQR or above Q3 + 1.5×IQR are outliers, and both fences are printed so the classification is checkable rather than asserted. The outliers themselves are listed with the count.',
    },
    {
      q: 'What happens to words mixed into my numbers?',
      a: 'They are skipped and counted: the page reports "N numbers parsed · M non-numeric tokens skipped", so pasting straight from a messy spreadsheet works, and you can see exactly how much of your paste was ignored instead of wondering.',
    },
  ],

  // ---------------------------------------------------------- number-to-words
  'number-to-words': [
    {
      q: 'How do I write a cheque amount in words?',
      a: 'Type the figure, pick the currency framing (USD, EUR, GBP or INR), and read the cheque line: "Dollars one million two hundred thirty-four thousand five hundred sixty-seven and eighty-nine cents only". Every money line ends in "only", the convention that makes the written amount hard to alter.',
    },
    {
      q: 'What is the difference between the international and Indian systems?',
      a: 'Grouping. International groups by thousands (thousand, million, billion); the Indian system groups two-after-three (thousand, lakh, crore, arab). The same digits 12,34,567 read as "twelve lakh thirty-four thousand five hundred sixty-seven" in one and "one million two hundred…" in the other — pick the one your bank or document expects.',
    },
    {
      q: 'What happens to amounts with more than two decimals?',
      a: 'They are truncated, not rounded, and the page says so. A cheque whose words say "one hundred and 1/100" while the figures say 100.005 is the mismatch banks reject — keeping the written amount equal to the figures is the only correct behavior, even when rounding would look nicer.',
    },
    {
      q: 'How large a number can this convert?',
      a: 'Up to 9,007,199,254,740,991 — the JavaScript safe-integer maximum, about nine quadrillion — in either system. Beyond that, floating-point numbers stop being exact and the tool refuses with an explanation rather than inventing words for a number it cannot represent faithfully.',
    },
  ],

  // ------------------------------------------------------------------- morse
  morse: [
    {
      q: 'How fast should the WPM setting be?',
      a: 'Beginners start at 5–10 WPM to learn the shapes; the amateur radio exam pace is around 5–15; experienced operators run 20–35. The unit length follows the PARIS convention (1.2 ÷ WPM seconds), which is the standard every practice recording and every test uses, and the page prints the computed unit so you can verify it.',
    },
    {
      q: 'Why does my Morse input decode automatically without a toggle?',
      a: 'The tool detects direction from the characters: predominantly dots, dashes, slashes and spaces reads as Morse, anything else as plain text. One box, both directions — there is no mode to forget to switch, and the badge above the input always states how the current input was read.',
    },
    {
      q: 'Which characters have Morse code?',
      a: 'The full ITU set: letters A–Z, digits 0–9, and the punctuation block every guide lists — period, comma, question mark, slash, apostrophe, parentheses, equals, plus, hyphen, @ and friends. Anything outside the table (emoji, accented letters) is skipped and named on the page rather than silently dropped.',
    },
    {
      q: 'Can I practice without the sound?',
      a: 'Yes — the flashing dot/dash readout follows the audio beat, so you can watch the rhythm of a message at any speed. It also helps when learning to copy by eye before your ear is trained, or in a place where a beeping speaker would not be welcome.',
    },
  ],

  // ------------------------------------------------------------ font-changer
  'font-changer': [
    {
      q: 'Are these real fonts?',
      a: 'No — they are Unicode characters from the Mathematical Alphanumeric Symbols block and friends. That is why they paste anywhere plain text is accepted with no font file needed, and why they render even in apps that know nothing about typography.',
    },
    {
      q: 'Why do some styles miss digits or certain letters?',
      a: 'Because the Unicode blocks genuinely do not provide them: italic, script and fraktur carry letters only; small caps has no true capital X. The tool maps only what exists, keeps unmapped characters as-is, and lists them on the card — no silent substitutions to discover after you paste.',
    },
    {
      q: 'Do these styles cause any accessibility problems?',
      a: 'Yes, worth knowing: screen readers announce 𝐛𝐨𝐥𝐝 as "mathematical bold small b…" character by character, so styled text is a slog for assistive tech. Fine for a display name or a short heading-flavored line; write paragraphs in plain text.',
    },
    {
      q: 'Where do these styles paste correctly?',
      a: 'Anywhere that accepts plain text: Instagram and X bios, Discord, Telegram, WhatsApp status, notes apps. They are characters, not formatting — so they survive copy-paste, but they do not "turn off" like real bold, and search engines match them poorly.',
    },
  ],

  // ------------------------------------------------------------------ emoji
  emoji: [
    {
      q: 'How many emojis are in the set, and which ones?',
      a: 'Several hundred everyday emojis organized into nine categories — smileys and hearts, people and gestures, animals and nature, food and drink, activity and music, travel and places, objects, symbols, flags. The page states the count in the search bar. It is the everyday set, not the full Unicode catalog.',
    },
    {
      q: 'How does the search work?',
      a: 'Every entry carries its common name plus the keywords people actually type — "heart", "fire", "sad", "pizza" — and search matches both live as you type. Typing "sob" finds 😭 even though its official name is "loudly crying face", because the keywords model how you think, not the registry.',
    },
    {
      q: 'Is anything sent to a server when I search or copy?',
      a: 'No. The emoji table ships with the page; search is a local filter and copies go straight to your clipboard. The Recently-copied row lives in this tab\'s memory only and vanishes when you close the page.',
    },
    {
      q: 'Does it work offline?',
      a: 'Yes — the dataset is embedded on the page, so search and copy run with no connection at all. It is also part of the app\'s offline shell, so the page opens on a plane the same way it does at home.',
    },
  ],

  // -------------------------------------------------------------- json-to-ts
  'json-to-ts': [
    {
      q: 'Why are some fields marked optional with a question mark?',
      a: 'Because they are genuinely optional: the field is missing (or null) in some members of an array but present in others. The generator inspects array members together, marks the field `?`, and gives it the real type from a member that carries it — which is exactly how a hand-written type for "the API sometimes omits this" would look.',
    },
    {
      q: 'What happens when two object shapes are identical?',
      a: 'Structural dedup: the second occurrence re-uses the first\'s interface instead of emitting a duplicate. The signature compares keys, member types and optional flags, so only truly identical shapes merge — two similar-but-different shapes stay separate interfaces.',
    },
    {
      q: 'What do empty arrays and mixed arrays become?',
      a: 'An empty array becomes `unknown[]` — an empty list carries no evidence, and guessing would write a wrong type into your code. A mixed array produces an honest union like `(string | number)[]`, and an array of objects produces one merged item interface with the optionals marked.',
    },
    {
      q: 'Should I choose interfaces or type aliases?',
      a: 'Either compiles the same for object shapes. Interfaces read more conventionally in most codebases and can be augmented by declaration merging; type aliases are the pragmatic choice when a root is a primitive or a union. The switch exists because both are common house styles, not because one is correct.',
    },
  ],

  // ------------------------------------------------------------ compress-pdf
  'compress-pdf': [
    {
      q: 'Why did my PDF come out larger after compression?',
      a: 'Because it is vector-heavy. Text and line art compress extremely well as vectors; rasterizing them into JPEG pages can only lose that. The result card reports the real delta and recommends keeping the original when the math lost — the honest answer, not a fake win.',
    },
    {
      q: 'What settings should I use for a scanned document?',
      a: 'Start at 1× scale and 60% JPEG quality — for typical scans that lands well below the original with readable text. Push quality down toward 30% for reference-only copies, up toward 95% for documents people will read closely; the file re-compresses each time you change a setting.',
    },
    {
      q: 'Does compression change the page dimensions?',
      a: 'No. The rebuilt pages carry the original point size — the scale-1 viewport — whatever render scale you chose. Print layout never changes; only the pixel density inside each page does.',
    },
    {
      q: 'What is the cost of the rasterization route?',
      a: 'The pages become images: text stops being selectable and searchable. For a scanned contract you are emailing, that is the right trade; for a form someone must fill digitally, it is not — and the page states the trade on the result every time.',
    },
  ],

  // --------------------------------------------------------------- time-card
  'time-card': [
    {
      q: 'How do I enter a shift that ends after midnight?',
      a: 'Just type it: an out time earlier than its in is read as crossing midnight and counted forward — 22:00 in, 06:00 out is eight hours, never negative. The overnight handling applies per pair, so a split shift can span midnight in either half.',
    },
    {
      q: 'Why two in/out pairs per day?',
      a: 'The lunch split: clock out, clock back in, and both spans add to the day. One pair covers a continuous shift; leave the second pair empty and it contributes nothing. The break column (in minutes) comes off the day\'s total after both pairs.',
    },
    {
      q: 'How is overtime calculated?',
      a: 'Hours beyond your weekly threshold (default 40) multiply by your multiplier (default 1.5×) at the same hourly rate. Both numbers are editable because schedules and jurisdictions differ. The formula — regular × rate + overtime × rate × multiplier — is printed under the pay card with your numbers substituted.',
    },
    {
      q: 'Is the pay figure my take-home?',
      a: 'No — it is gross pay before taxes and deductions, and the page says so rather than guessing your tax situation. Payroll systems vary in withholding; the calculator\'s job is the hours-and-rate math you can check against it.',
    },
  ],

  // ------------------------------------------------------------------ grade
  grade: [
    {
      q: 'What do I need on my final to get a certain grade?',
      a: 'Open the "Grade on my final" tab: enter your current grade, the final\'s weight, and the target. The solver rearranges target = current × (1 − w) + final × w and prints the required score with the algebra shown — plus a plain-language verdict, including "not reachable" when the needed score exceeds 100%.',
    },
    {
      q: 'My weights do not add up to 100% — what happens?',
      a: 'The weighted grade is computed over the graded weights only, and the result says exactly that: "over the graded weights so far". That is your standing on what is done — the ungraded remainder is not predicted, because guessing it would make the number up.',
    },
    {
      q: 'How is GPA computed here?',
      a: 'Unweighted 4.0 scale: A=4.0, A−=3.7, B+=3.3, B=3.0 … F=0, multiplied by each course\'s credit hours and divided by total credits. Percents are accepted too and convert through the 90/80/70/60 letter band. Schools with weighted scales or A+ above 4.0 differ — that is a policy choice, not a math error, and the page says so.',
    },
    {
      q: 'Are my grades saved anywhere?',
      a: 'No. Every tab runs in page memory: nothing persists between visits, nothing syncs, nothing is submitted. Close the tab and the inputs are gone — which is the correct privacy model for something as personal as a transcript.',
    },
  ],

  // ------------------------------------------------------------------- todo
  todo: [
    {
      q: 'Where is my checklist stored?',
      a: 'In this browser\'s localStorage — that is the entire storage system. It survives reloads and browser restarts on the same device and browser, and it exists nowhere else: no account, no sync, no server. Clearing site data or pressing Delete everything removes it permanently.',
    },
    {
      q: 'Can I move the list to another device?',
      a: 'Not automatically — that is what "no sync" means. Use Copy as Markdown for a one-way export: a GitHub-flavored task list (`- [x] done item`) that pastes into issues, PR descriptions and note apps. The copy carries the done-state, so the list arrives complete.',
    },
    {
      q: 'How do I edit or reorder items?',
      a: 'Double-click an item (or the pencil) to edit inline; Enter saves, Escape cancels. Drag items to reorder, or use the up/down arrows that appear on hover — the buttons are there for touch screens and keyboards, where HTML drag-and-drop alone is hostile.',
    },
    {
      q: 'What happens if the stored list is corrupted?',
      a: 'The page discards it and starts empty rather than crashing: the storage read validates every entry\'s shape and silently drops anything malformed. A checklist should survive a bad reload — that is why the read is defensive instead of trusting the blob.',
    },
  ],

  // ------------------------------------------------------------------- meme
  meme: [
    {
      q: 'Is there a watermark?',
      a: 'No. The download is exactly what the preview shows — your image and the captions, as a PNG at the image’s own resolution. No logo burned in, no paid tier that removes one, because there is no server charging rent on your picture.',
    },
    {
      q: 'What if my caption is too long for the image?',
      a: 'It wraps: a caption wider than the picture splits at the space that balances the two halves best, up to two lines per caption. A single word too wide to fit is drawn as-is rather than mangled — shrink the font and try again.',
    },
    {
      q: 'Can I use a photo of a real person?',
      a: 'That is your call, not a filter: the tool processes images and does not know or store what they contain. Follow the law and common decency for the pictures you caption — the tool has no server to implicate you, which is exactly why the responsibility stays with you.',
    },
    {
      q: 'Why is there a sample image?',
      a: 'So the tool works before you upload anything: the sample is drawn by the page itself on the canvas — a generated scene clearly marked as a sample — letting you try the captions and download path without dropping in a real photo.',
    },
  ],

  // ------------------------------------------------------------ svg-convert
  'svg-convert': [
    {
      q: 'Why does my SVG render smaller or larger than expected?',
      a: 'The rasterizer uses the SVG’s own dimensions — its width/height attributes or its viewBox — as the starting size. If the markup has neither, the render falls back to a sane default and the size fields show it, so you can set the output box explicitly before downloading.',
    },
    {
      q: 'Is rendering a foreign SVG safe?',
      a: 'Script elements, on* attributes and external references are stripped from the markup before anything renders, and a badge appears when the stripping changed something. This is defense in depth on top of the browser’s own rule that an SVG drawn through an img element never executes scripts.',
    },
    {
      q: 'Why is my JPG white where the design should be transparent?',
      a: 'JPG has no transparency channel. A transparent background chosen with a JPG target is forced to white, and the page says so — PNG is the format that keeps transparency, and the selector keeps both honest.',
    },
    {
      q: 'What does “2×” actually do?',
      a: 'It multiplies the current output width and height, re-rendering from the vector source at the new size — so a 2× render is crisp curves redrawn, not a bitmap upscaled. 4× is the same deal; the pixels are computed fresh each time.',
    },
  ],

  // ----------------------------------------------------------------- cipher
  cipher: [
    {
      q: 'Which cipher should I use?',
      a: 'For fun and puzzles: any of them. ROT13 for the classic spoiler convention, Caesar when a shift is specified (or the brute-force table when it is not), Atbash for mirror-alphabet puzzles, Vigenère when someone says “use my keyword”. None of them are encryption — that is a feature of the genre, not a flaw of this page.',
    },
    {
      q: 'How do I decode a Caesar message when I do not know the shift?',
      a: 'Switch to Caesar and look at the brute-force panel: it lists all 25 shifts at once, and you read down the rows until English appears. No guessing, no math — the panel exists precisely for the “unknown shift” case.',
    },
    {
      q: 'Does it handle punctuation, numbers and accents?',
      a: 'Punctuation, digits and spaces pass through untouched — only A-Z and a-z transform. Accented characters (é, ü) are not in the cipher alphabets and pass through as-is too, so a French word stays legible rather than becoming garbage.',
    },
    {
      q: 'Is ROT13 the same as Caesar?',
      a: 'ROT13 is Caesar with the shift fixed at 13 — exactly half the 26-letter alphabet, making it self-inverse: applying it twice returns the original text. That is why the page gives it its own mode with no encode/decode toggle.',
    },
  ],

  // --------------------------------------------------------------- due-date
  'due-date': [
    {
      q: 'How accurate is this estimate?',
      a: 'It is arithmetic, not foresight: the estimate is the midpoint of a window — roughly 80% of births happen between week 37 and 42. First-trimester ultrasound dating is more accurate than LMP math, and individual cycles vary. Treat the date as a conversation starter with your clinician.',
    },
    {
      q: 'My cycle is not 28 days — does that matter?',
      a: 'The rule assumes 28; the tool shifts the estimate by your cycle length minus 28 days, so a 32-day cycle moves it four days later. That adjustment is the standard convention, and the page tells you how many days it moved.',
    },
    {
      q: 'Which mode should I use — LMP or conception?',
      a: 'Last period if that is the date you know (it usually is); conception if you know it precisely, for example from fertility tracking. The two modes agree by construction: 280 days from LMP equals 266 from conception, two weeks apart.',
    },
    {
      q: 'Is anything I enter stored or sent?',
      a: 'No. The dates are picked, the arithmetic runs in this tab, and nothing is transmitted or remembered — a pregnancy date is exactly the kind of thing that should never need an upload to be calculated.',
    },
  ],

  // ---------------------------------------------------------- word-frequency
  'word-frequency': [
    {
      q: 'What counts as a “word”?',
      a: 'A run of letters, digits, apostrophes or hyphens — so “don’t” is one word and “mother-in-law” is one word, not four. The tokenization is Unicode-aware, which keeps accented text and non-Latin scripts counted properly.',
    },
    {
      q: 'What does the Flesch score actually measure?',
      a: 'Two ratios: words per sentence and syllables per word. Short sentences and short words push the score up (easier); the label bins are the standard ones used by plain-language laws and readability research — 60–70 is roughly the range of ordinary newspaper prose.',
    },
    {
      q: 'Why is my score above 100 or below 0?',
      a: 'The formula is not clamped — a one-syllable word list scores over 100, dense legal prose can score under 0. The page shows the raw number with an honest label rather than faking a tidy range; the extremes carry information too.',
    },
    {
      q: 'Is keyword density an SEO ranking factor?',
      a: 'Not directly, and it has not been for many years — but density is still the fastest way to notice that a draft repeats one phrase into absurdity, or that the words you thought you were using are not actually on the page. Read it as a mirror, not a target.',
    },
  ],

  // ------------------------------------------------------------------ vcard
  vcard: [
    {
      q: 'What is the difference between the .vcf and the QR?',
      a: 'Same card, two carriers. The .vcf is a file any address book imports — attach it to an email or host it. The QR is the same vCard text encoded as an image: the other phone scans it with its camera and saves the contact. Neither needs an app on either side.',
    },
    {
      q: 'Will non-English characters survive?',
      a: 'Yes — the card is UTF-8 end to end, which vCard 3.0 supports properly. Accented names, CJK names and emoji in the note field all survive the export and the QR; the tool does not transliterate or mangle them.',
    },
    {
      q: 'How big should I print the QR?',
      a: 'A card with several fields is a dense QR — at business-card size, print it at least 3 cm across, more if it sits on glossy paper. The page would rather tell you the honest number than let a 1 cm QR fail in the field.',
    },
    {
      q: 'Can I include my photo or logo?',
      a: 'Not in this builder — vCard photo fields bloat the QR past the point where phone cameras scan it reliably. The card here keeps to the fields that scan well: name, org, title, phone, email, web, note.',
    },
  ],

  // ----------------------------------------------------------- calendar-link
  'calendar-link': [
    {
      q: 'Which link should I share?',
      a: 'Whatever your audience uses: Google Calendar’s link for Gmail and Android users, Outlook.com’s for Microsoft accounts, Yahoo’s for Yahoo Calendar. For everyone else — Apple Calendar, Thunderbird, anything standards-based — the .ics file is the universal answer, which is why the page provides both.',
    },
    {
      q: 'What is an “all-day” event, technically?',
      a: 'A date-bounded event with no time component, whose end day is exclusive: a one-day event on the 5th runs from the 5th to the 6th. That exclusive end is where hand-built calendar files go wrong, and it is handled per provider here because each provider spells it differently.',
    },
    {
      q: 'Why does the .ics preview show times without a Z?',
      a: 'The file uses floating local time — RFC 5545’s form-one datetime — so the event lands at the wall-clock time you typed regardless of the recipient’s time zone. The deep links carry the absolute UTC instant instead; each format does the job it is best at.',
    },
    {
      q: 'Does re-downloading a corrected event duplicate it?',
      a: 'No — the UID is derived deterministically from the event’s title and start, so re-importing an edited version updates the existing calendar entry instead of adding a second one. It is a small detail that saves real annoyance.',
    },
  ],

  // ----------------------------------------------------------------- px-rem
  'px-rem': [
    {
      q: 'Why does my rem value look wrong in the browser?',
      a: 'Check the root size: 1 rem is whatever the html element’s font-size is, and user stylesheets, accessibility settings or a CSS reset may have moved it off 16. Set the root field here to your actual root and the numbers will match what the browser computes.',
    },
    {
      q: 'What is the difference between rem and em here?',
      a: 'rem resolves against the root font-size always; em resolves against the element’s own context — which in this tool is the separate context field. Same number, different base: that is why the converter asks for both instead of guessing one.',
    },
    {
      q: 'When should I use the clamp() builder?',
      a: 'When a size should flex between two bounds as the viewport changes — most commonly type. The builder emits clamp(min, ideal, max) with your units; keep min below max or the browser will not interpolate, which the page warns about rather than letting you ship a frozen value.',
    },
    {
      q: 'How precise are the conversions?',
      a: 'Exact to four decimals with trailing zeros trimmed — 24px at root 16 is 1.5rem, not 1.5000. Sub-pixel values like 4px are 0.25rem exactly; there is no hidden rounding to make output look tidy.',
    },
  ],

  // ----------------------------------------------------------------- binary
  binary: [
    {
      q: 'Why does one character turn into several byte groups?',
      a: 'UTF-8 encodes characters beyond ASCII as multi-byte sequences: an emoji is four bytes, most CJK characters three, accented Latin two. The byte count under the panes says exactly how many — the tool shows the real encoding rather than pretending one character is always one byte.',
    },
    {
      q: 'Why does my binary paste fail to decode?',
      a: 'Most likely the byte sequence is not valid UTF-8 — every 8-bit group is a byte, but not every sequence decodes to a character. The tool validates the sequence and reports the first bad byte instead of printing replacement characters; check for a truncated copy or a wrong base.',
    },
    {
      q: 'What separators does the byte input accept?',
      a: 'Spaces, newlines and commas, freely mixed; hex groups may carry a leading 0x. Real-world bytes arrive messy, so the parser is forgiving about grouping and strict about the digits themselves — a stray letter in a binary group is named with its position.',
    },
    {
      q: 'What is ASCII mode for?',
      a: 'Strictness: it refuses any character above 127, naming the exact character and its position — the right mode when the target system genuinely only speaks ASCII (many protocols, labels and legacy formats), where a silent é would produce bytes the other end cannot read.',
    },
  ],

  // ------------------------------------------------------------ sound-tools
  'sound-tools': [
    {
      q: 'Is the dB meter accurate?',
      a: 'It is an estimate until you calibrate it, and the page says so. The raw measurement is dBFS — real and repeatable for your device — and the displayed figure adds an adjustable offset (default 100). Hold a trusted SPL meter next to the mic once, slide the offset until the numbers agree, and the estimate is genuinely useful for that room. A laptop mic is not a Class-2 instrument, and pretending otherwise would be the dishonest version.',
    },
    {
      q: 'Does the meter or tuner record me?',
      a: 'No. The microphone stream is analysed in memory one buffer at a time — the meter reads RMS levels, the tuner reads pitch — and the stream is stopped and closed the moment you press stop or leave the mode. There is no recording buffer, no file, and no upload path in the code; you can watch the network tab stay silent.',
    },
    {
      q: 'Why can’t the tuner find my pitch?',
      a: 'The detector needs a clean single pitch above a quiet floor: pluck one open string, let it ring, and play nothing else. Heavy fret buzz, multiple strings at once or a noisy room drop the correlation peak below the confidence gate — the tool shows “—” rather than a wrong note it does not believe.',
    },
    {
      q: 'Why doesn’t the metronome drift like web metronomes usually do?',
      a: 'Clicks are scheduled on the AudioContext clock through a 25 ms look-ahead loop, not fired by setTimeout — the same discipline professional metronome apps use. Timer throttling slows the scheduler, but every click still lands where the audio clock says it should, so the tempo stays true even in a busy tab.',
    },
  ],

  // -------------------------------------------------------------------- tts
  tts: [
    {
      q: 'Which voices does it use?',
      a: 'Whatever your operating system and browser already ship — nothing is downloaded. The list loads asynchronously (browsers populate it after the page starts), local voices are preferred by default, and network voices are labelled as such since they can be slower and stop working offline.',
    },
    {
      q: 'Why is my long text split into chunks?',
      a: 'Browsers silently truncate or stall a single utterance that runs too long — the failure is invisible, the audio just stops. Sentence-bounded chunks (about 220 characters) each become their own utterance, so playback is stable, pause and resume land cleanly between sentences, and the visible chunk list shows the real queue with the current line highlighted.',
    },
    {
      q: 'Does my text get uploaded anywhere?',
      a: 'No. The Web Speech API is the browser’s own engine running on your device; the text is handed to it locally and never leaves the tab. There is no server call in this page at all — that is also why the tool cannot fake a voice when your browser has none.',
    },
    {
      q: 'Why is there no play button working in some browsers?',
      a: 'When a browser ships no speech synthesis engine, or the system has no installed voices, the page states exactly that instead of showing a button that does nothing — the honest failure state. Chrome, Edge and Safari all ship an engine; some minimal browsers and kiosk setups do not.',
    },
  ],

  // -------------------------------------------------------------- fuel-cost
  'fuel-cost': [
    {
      q: 'Why does MPG need a US/UK switch?',
      a: 'Because “gallon” means two things: a US gallon is 3.785 liters and a UK (imperial) gallon is 4.546. The same “35 MPG” is 6.7 L/100km in the US system and 8.1 in the UK — two different cars. The tool keeps the systems separate and the equivalence line shows what your figure means in both, plus L/100km.',
    },
    {
      q: 'How is the per-passenger split computed?',
      a: 'Total fuel cost divided evenly by the passenger count including the driver — the fair default for a shared road trip where everyone rides the same distance. Parking, tolls and wear are deliberately excluded; this is the fuel line only.',
    },
    {
      q: 'Can I price fuel per gallon?',
      a: 'Yes — per liter, per US gallon or per UK gallon, in $, €, £, ₹ or unit-free. Everything normalizes to currency per liter internally, so mixing “MPG UK car with US pump prices” still gives the honest answer instead of the silently wrong one most calculators produce.',
    },
    {
      q: 'Why does my real cost come out higher?',
      a: 'Real consumption climbs with highway speed, headwinds, roof boxes, cold starts, short trips and air conditioning — brochure figures assume ideal conditions. Budget 10–15% above the calculator’s number for a loaded car driven fast; the tool is the planning center of the range, not the receipt.',
    },
  ],

  // ----------------------------------------------------------------- salary
  salary: [
    {
      q: 'Why is my unpaid break deducted?',
      a: 'Because it is unpaid — a 60-minute lunch inside an 8-hour shift means 7 paid hours, and annualizing from 8 overstates the true hourly rate by about 6%. The deduction happens before anything else is derived, so hourly, weekly and annual figures all stay consistent with what actually gets paid.',
    },
    {
      q: 'Are these numbers take-home pay?',
      a: 'No — and the tool refuses to pretend otherwise. Everything shown is gross and pre-tax; net pay depends on tax brackets, social contributions and deductions that vary by year and jurisdiction, and a bracket-less “net” estimate would be a confident-looking wrong number. The gross boundary is stated on the table itself.',
    },
    {
      q: 'How is overtime handled?',
      a: 'Overtime hours per week are paid at the hourly rate times your multiplier (1.5 default), on top of the base salary — added after annualization, never folded invisibly into the rate. The pipeline line at the bottom shows the exact OT math so you can check it against your pay slip.',
    },
    {
      q: 'What if I don’t work 52 weeks a year?',
      a: 'Set the weeks-per-year field: teachers on 40-week contracts, seasonal workers and contractors with unpaid time off all break the default 52, and a converter that hardcodes 52 quietly lies to them. Every figure in the table re-derives from your weeks.',
    },
  ],

  // ------------------------------------------------------------------ sleep
  sleep: [
    {
      q: 'Is the 90-minute cycle rule real?',
      a: 'It is a useful average, not a law: sleep cycles run roughly 80–110 minutes and vary between people and between nights. The calculator treats it as the planning heuristic it is — good for choosing between a 23:00 and a 23:45 bedtime — and the page states the real-world variation instead of hiding it behind false precision.',
    },
    {
      q: 'Why do the bedtimes include a 15-minute offset?',
      a: 'You do not fall asleep the moment your head hits the pillow. The default 15-minute fall-asleep latency is added on top of the sleep time; if you typically take 30 minutes, set it, because a “six cycles” bedtime computed without your real latency is really five and a bit cycles in practice.',
    },
    {
      q: 'Should I aim for 6 cycles?',
      a: 'Six cycles is about 9 hours of sleep and is the most-rested target on the list; five is solid, four is a decent short night, three is the shortest the tool suggests deliberately. Adults generally do best in the 5–6 cycle range — consistently waking tired on 6 cycles is information worth acting on, not something to override with more alarms.',
    },
    {
      q: 'Is this medical advice?',
      a: 'No, and the page says so. This is arithmetic around the standard sleep-cycle heuristic. Persistent trouble falling asleep, waking unrefreshed on a full schedule, or snoring with breathing gaps are things to raise with a doctor, not to solve with a calculator.',
    },
  ],

  // ------------------------------------------------------------------- pace
  pace: [
    {
      q: 'How accurate are the race predictions?',
      a: 'Riegel’s formula T₂ = T₁ × (D₂/D₁)^1.06 is fitted from real performances and holds well for trained runners between distances they have trained for. Long jumps are the least reliable — a 5K under-predicts a marathon for a runner without long-run volume — so treat the table as directional: a sanity check on a goal, not a promise.',
    },
    {
      q: 'What pace should I aim for on race day?',
      a: 'The splits table shows the even-pace line: elapsed time at every kilometer or mile at your target pace. Even splits are the standard recommendation; if you plan to negative-split, run the first half slightly slower than the table and bank the difference — the table is the baseline to deviate from deliberately.',
    },
    {
      q: 'Why does the tool show both km and miles?',
      a: 'Because runners are bilingual in practice: races are measured in km (5K, 10K, marathon 42.195 km), treadmills often speak mph, and training plans mix both. Pace per km and per mile, speed in km/h and mph, and the distance itself in both units are all shown so no conversion happens in your head.',
    },
    {
      q: 'Is my pace from a treadmill the same as outside?',
      a: 'The math is identical, but treadmills often overestimate — no wind resistance, a belt that assists stride, and frequently uncalibrated speed readouts. Enter an outdoor race or GPS run for predictions; treat treadmill-derived pace as its own local currency.',
    },
  ],

  // ------------------------------------------------------------ one-rep-max
  'one-rep-max': [
    {
      q: 'Why do the formulas disagree?',
      a: 'Each was fitted on a different population of lifters doing reps-to-failure, and none accounts for how fatigue resistance varies by lift and by person. They agree tightly at 1–6 reps and drift apart beyond — by 12 reps the spread can exceed 10%. The tool shows all four so the disagreement is visible, and anchors the training table to a consensus average of Epley, Brzycki and Lander.',
    },
    {
      q: 'How many reps should I base the estimate on?',
      a: 'A hard, honest set of 3–5 reps. Short sets keep the formulas in their tight-agreement window and avoid the compounding errors of high-rep estimates; a true maximal set of 1 also works but carries the injury risk the whole point of estimating is to avoid.',
    },
    {
      q: 'What is the training table for?',
      a: 'Programming loads as percentages of your 1RM: 95% for heavy doubles, 90% for strength fours, 85% for sixes, 80% for the classic eights, 75% for tens, 70% for twelves, 60% for endurance work. Percent-based programming lets the whole plan scale automatically when the estimated max moves.',
    },
    {
      q: 'Can I test a real 1RM instead?',
      a: 'You can, and it is the ground truth — but it is a skill: warm-up ramping, bar-speed judgment, and a spotter or safety pins are not optional. An estimate from a hard set of 3–5 is as useful for programming and considerably safer; the page prints that because it is the part that prevents injuries.',
    },
  ],

  // --------------------------------------------------------------- fraction
  fraction: [
    {
      q: 'Why does the answer show both 19/12 and 1 7/12?',
      a: 'The same value in two dialects: the reduced improper fraction is the canonical math form, and the mixed number is the practical one for recipes, lengths and shop drawings. The decimal expansion is the third form, with repeating cycles shown in parentheses rather than truncated into a lie.',
    },
    {
      q: 'How does the tool decide the LCD?',
      a: 'Least common multiple of the two denominators by Euclid’s GCD: lcm(a, b) = |a·b| / gcd(a, b). The steps show the LCM, the multiplier each fraction needed, and the arithmetic over the common denominator — the exact sequence a graded solution is expected to show.',
    },
    {
      q: 'What does 0.(142857) mean?',
      a: 'The digits in parentheses repeat forever: 1/7 = 0.142857142857… . The long-division engine detects the cycle by watching remainders — the first remainder seen twice starts it — so repeating fractions are shown exactly, not cut off after some digits with the rest silently lost.',
    },
    {
      q: 'How exact is decimal → fraction?',
      a: 'Exact through eight decimal places by place value — 0.375 is exactly 375/1000 reduced to 3/8. Longer decimals get the closest small-denominator fraction with the error printed, honestly labelled approximate, because a fifteen-digit decimal is usually not exactly any short fraction.',
    },
  ],

  // -------------------------------------------------------------- quadratic
  quadratic: [
    {
      q: 'What does a negative discriminant mean?',
      a: 'That no real number solves the equation — the parabola never crosses the x-axis. The roots are complex conjugates x = (−b ± i√|D|)/2a, which the tool states as the correct answer rather than “no solution”: complex roots are a real answer, just not a point on the real-number line.',
    },
    {
      q: 'Why does the factored form sometimes refuse?',
      a: 'It prints only when both roots are clean at three decimals, so you get (x − 1)(x − 2), not (x − 1.0000001)(x − 1.9999999) dressed up as factoring. Irrational roots (discriminant not a perfect square) and complex roots are named as such — a refusal with a reason instead of a fake factorization.',
    },
    {
      q: 'How is the vertex computed?',
      a: 'x = −b/2a, then y = c − b²/4a (equivalently f(−b/2a)). The card shows both coordinates with the axis of symmetry and whether the point is a minimum (a > 0) or maximum (a < 0) — the same numbers the SVG plot uses to position the vertex dot, so the two views cannot disagree.',
    },
    {
      q: 'What if a = 0?',
      a: 'Then the equation is linear (bx + c = 0), not quadratic, and the tool says so instead of dividing by zero. Set a to any non-zero value to get the full solve — the nature of the discriminant, the roots, the vertex and the plot all follow from that one constraint.',
    },
  ],

  // ------------------------------------------------------------------ diff
  diff: [
    {
      q: 'Which diff algorithm does this use?',
      a: 'A patience diff — the strategy git diff --patience uses. Lines that appear exactly once on both sides act as anchors, the longest increasing subsequence of those anchors forms the diff’s spine, and the segments between anchors are diffed recursively. It avoids the classic LCS failure where every line of a rearranged file shows as changed, and it falls back to a block replace only when nothing unique remains, so the result is always a correct diff.',
    },
    {
      q: 'Will the exported patch really apply?',
      a: 'Yes — it is a standard unified diff with @@ hunk headers, three context lines and correct no-newline-at-EOF handling. It was validated against git apply: every generated patch applies cleanly and reconstructs the target byte for byte, including files without a trailing newline. Save it with the Download button and run git apply the-name.patch in the folder that holds the original file.',
    },
    {
      q: 'What do the ignore options actually change?',
      a: 'They change how lines are compared, not what is shown: ignore-case compares lines lowercased, ignore-whitespace collapses runs of spaces and tabs before comparing, and ignore-blank-lines removes empty lines from the comparison entirely. The displayed text is always your original, unmodified text — only the matching is relaxed.',
    },
    {
      q: 'Is there a size limit?',
      a: 'A million characters per side, stated in the page rather than failing silently past it. The diff runs synchronously in this tab, and patience diffs stay fast even on large rearranged files; if you regularly need to diff more than that, git diff --no-index on real files is the better tool — this page aims at the paste-two-snippets moment.',
    },
  ],

  // ------------------------------------------------------------------ uuid
  uuid: [
    {
      q: 'Which format should I pick?',
      a: 'v4 when you just need uniqueness. v7 when the IDs land in a database or a sorted list — the first 48 bits are the creation time in Unix milliseconds, so indexing by ID is roughly indexing by time. ULID when a 26-character, case-insensitive, slightly shorter form is convenient; it carries the same timestamp idea with 80 random bits behind it.',
    },
    {
      q: 'Are these cryptographically random?',
      a: 'Yes. The randomness comes from crypto.getRandomValues, the browser’s CSPRNG — not Math.random. A v4 UUID carries 122 random bits shaped by the RFC’s version and variant bits, so the chance of two colliding is about one in 5.3 × 10³⁶. Generated IDs are not secrets, but they are unguessable in practice.',
    },
    {
      q: 'What does the monotonic ULID option do?',
      a: 'Normally two ULIDs generated within the same millisecond differ only by their random half, so their order is a coin flip. Monotonic mode keeps the millisecond and increments the random part, making every ID strictly greater than the previous one — the property database indexes want when you insert faster than the clock ticks.',
    },
    {
      q: 'What does the inspector tell me?',
      a: 'Paste any UUID or ULID and it decodes the version nibble and the variant bits, and — for time-ordered IDs — the timestamp hidden inside, shown as a real date. For v1 it recovers the 60-bit Gregorian timestamp; for v7 the Unix milliseconds; for ULIDs the first ten Crockford characters. It also rejects impossible ULIDs, like ones containing I, L, O or U, with the reason.',
    },
  ],

  // ---------------------------------------------------------- convert-units
  'convert-units': [
    {
      q: 'How precise are the conversions?',
      a: 'Every category converts through a table of exact published factors — the international inch is exactly 0.0254 m and the avoirdupois pound exactly 0.45359237 kg — not rounded chart values. You control the display precision from 4 to 12 significant digits (7 by default), and when the ratio between two units terminates cleanly (1 in = 2.54 cm, 1 KB = 0.9765625 KiB) the page says “exactly”; when it would be a repeating decimal, it stays silent rather than pretending. Underneath, arithmetic is IEEE-754 double precision, so roughly the first 15 digits are trustworthy — honest for every everyday conversion.',
    },
    {
      q: 'Why is temperature handled differently?',
      a: 'Because degrees are affine, not proportional: 0 °C is not “zero temperature”, it is 273.15 kelvins. Multiplying by a factor cannot map one scale onto the other, so temperature is special-cased with its own formulas — °F = °C × 9/5 + 32, K = °C + 273.15, °R = °F + 459.67 — instead of sitting in the factor table. The classic converter bug of “multiplying Celsius by 1.8” cannot happen here.',
    },
    {
      q: 'What is the difference between KB and KiB?',
      a: 'Two families share the “kilo” name: decimal units step by 10³ (KB, MB, GB — what drive makers quote) and binary units step by 2¹⁰ (KiB, MiB, GiB — what memory actually counts and what Windows reports, mislabeled, as “MB”). The table keeps both side by side with the labels intact, and the exact line shows the honest gap: 1 KB = 0.9765625 KiB, exactly.',
    },
    {
      q: 'Why do Roman numerals stop at 3999?',
      a: 'The classical subtractive grammar has no symbol larger than M (1000) and M may repeat at most three times, so the largest expressible number is MMMCMXCIX — 3999. Larger values were written with a bar over the numeral (the vinculum, ×1000), which plain text cannot carry. The page states the limit instead of inventing notation, and the strict parser rejects anything that breaks the classical rules — IIII, VX, IC — naming the rule that was broken.',
    },
    {
      q: 'Does anything get uploaded?',
      a: 'No. Every conversion — units, bases, Roman numerals — is computed in this tab with plain arithmetic; there is no session, no account and no upload code on the page at all. Close the tab and nothing remains: no history, no storage, nothing on a server to trust or delete.',
    },
  ],

  // ------------------------------------------------------------ mode-level
  drop: [
    {
      q: 'What happens if a file fails halfway?',
      a: 'Kontivo reconnects on its own, and the failed file stays queued on your side so you can resend it with one tap once the link is back.',
    },
    {
      q: 'Why is there a 50 MB per-file limit?',
      a: 'Because files travel directly between browsers, not through a storage server. No cloud, no account — that trade keeps your files private.',
    },
  ],
  'folder-share': [
    {
      q: 'Does the folder structure survive the transfer?',
      a: 'Yes, nested subfolders arrive exactly as they left. The receiving device can download everything as a single ZIP or grab files one by one.',
    },
    {
      q: 'How big can a folder be?',
      a: 'Each file can be up to 50 MB, and there is no limit on the number of files. The tab must stay open on both devices while the transfer runs.',
    },
  ],
  'quick-pair': [
    {
      q: 'What does pairing actually do?',
      a: 'It puts two devices into the same live session instantly, so you can move to the real work (files, text) without typing a code on the second device.',
    },
    {
      q: 'Does it use Bluetooth?',
      a: 'No. Pairing runs over the web like everything else on Kontivo: the second device joins through a link or QR, so it works across networks, not just in the same room.',
    },
  ],
  'video-call': [
    {
      q: 'How many people can a two-person call hold?',
      a: 'It is built for two devices; that is what keeps the media direct between browsers. For a group, pick the Group Meeting mode.',
    },
  ],
  'audio-call': [
    {
      q: 'Why choose a voice-only call?',
      a: 'It is much lighter on battery and mobile data than video, and it opens faster, which is good for a long talk on a weak connection.',
    },
  ],
  'interview-room': [
    {
      q: 'What does the candidate need?',
      a: 'Just the link or code and a browser. No account, no download, no calendar magic, which is exactly what you want for a one-off interview.',
    },
  ],
  classroom: [
    {
      q: 'How do students join the class?',
      a: 'You share the six-character code or QR; they type it in at the top of the site or scan it. No sign-up, so a class can be running in under a minute.',
    },
    {
      q: 'Can I show my screen to the class?',
      a: 'Yes. Share a tab, a window or the whole screen, and students follow live on their own devices.',
    },
  ],
  'webinar-room': [
    {
      q: 'Do viewers need to register?',
      a: 'No. They open the code or link and they are in. The room is temporary and needs no roster.',
    },
  ],
  'remote-assist': [
    {
      q: 'How do I start helping someone?',
      a: 'Open Screen, pick Remote Assist, start a session, and send them the code. They point their camera at the problem; you see it live and guide them.',
    },
  ],
  'guided-pointer': [
    {
      q: 'What does everyone else see when I point?',
      a: 'Your pointer and your marks render live on the shared screen for the whole session, which is useful for “look here” moments during a walkthrough.',
    },
  ],
  'support-session': [
    {
      q: 'What is the difference from plain screen sharing?',
      a: 'A Support Session bundles the pieces a fix actually needs (screen sharing plus the camera) and keeps a transcript of the steps you took.',
    },
  ],
  'walkie-talkie': [
    {
      q: 'Does the tab need to stay open?',
      a: 'Yes, on every device in the session. It runs in the browser, so keep the tab in the foreground while you use it.',
    },
  ],
  'voice-record': [
    {
      q: 'Can others hear the recording while I record?',
      a: 'Yes. People in the session hear it live as you speak, which is the point: share audio without sending files afterwards.',
    },
  ],
  'camera-live': [
    {
      q: 'Can I show my phone’s camera on a laptop?',
      a: 'Yes, that is the classic setup. The laptop opens the session, the phone joins with the code, and the camera streams live.',
    },
  ],
  'baby-monitor': [
    {
      q: 'What if the phone locks its screen?',
      a: 'Some phones pause video when the screen locks. Keep the watcher plugged in and the tab open; if your browser allows it, allow audio/video playback in the background.',
    },
  ],
  'temp-stream': [
    {
      q: 'What is a temporary stream for?',
      a: 'Short-lived moments: a demo, a quick view from a camera, a one-off event. Open the session, stream, close it. Nothing lingers.',
    },
  ],
  'phone-mic': [
    {
      q: 'Is the audio uploaded anywhere?',
      a: 'No. It streams through the live session between your devices only.',
    },
  ],
  'presentation-clicker': [
    {
      q: 'Does it work with PowerPoint or Keynote?',
      a: 'It is built to drive Live Presentation and shared screens inside the session. For desktop apps, share your screen and use the pointer to walk through your deck.',
    },
  ],
  'screen-to-phone': [
    {
      q: 'Can I control the computer from the phone?',
      a: 'No. This is a viewer. Control stays on the computer, which keeps it safe to share the code inside your home or office.',
    },
  ],
  'shared-docs': [
    {
      q: 'Is the shared note saved for later?',
      a: 'Nothing is stored on our side. Copy the note out (or keep the session alive) before you end it; ending the session discards the text.',
    },
  ],
  'code-editor': [
    {
      q: 'Do both people need to open the editor in the same session?',
      a: 'Yes. The editor is live pair-programming: one shared buffer, keystrokes from both sides as they happen.',
    },
  ],
  'live-present': [
    {
      q: 'Are my slides uploaded anywhere?',
      a: 'No. Slides travel through the live session at full quality and exist only on the devices in it.',
    },
  ],
}

/** Home-page FAQs: the questions a first-time visitor asks. */
export const HOME_FAQS: Faq[] = [
  {
    q: 'What is the difference between Instant and Live tools?',
    a: 'Instant tools (ZIP, PDF, images, JSON, passwords…) are one-device utilities: open the page and the work happens on your device in seconds — no session, no code, no upload. Live tools (Share, Call, Screen, Notepad…) connect two or more devices in real time through a six-character code.',
  },
  {
    q: 'Is Kontivo really free?',
    a: 'Yes. There are no accounts, no plans and no paywalls: instant tools open ready to use, and a live session starts with one click.',
  },
  {
    q: 'Do the people I invite need an account?',
    a: 'No. They join a live session with the six-character code, the QR code or the link, from any modern browser, on a phone or a computer. Instant tools never involve anyone else.',
  },
  {
    q: 'Where does my content go?',
    a: 'Nowhere near us. Instant tools compute entirely on your device — the file never leaves it. Live tools pass content directly between the devices in the session, and it is discarded when the session ends or expires. There is no storage bucket and no profile on our side.',
  },
  {
    q: 'Does it work on phones?',
    a: 'Yes. The tools are built phone-first: touch to draw, camera and mic tools, join-by-QR, and pages that fit a small screen.',
  },
  {
    q: 'Can I use it once and leave?',
    a: 'That is the design. Open the tool, do the thing, close the tab. Instant tools were never connected to anything; live sessions expire on their own and nothing about you is kept.',
  },
  {
    q: 'Is there something to install?',
    a: 'Installing is optional. When your browser supports it, an Install button appears; on iPhone the browser offers “Add to Home Screen”. Without installing, everything works the same in the tab.',
  },
]

/**
 * The FAQ set a tool page shows on first paint: the default mode's FAQs (for
 * tools with modes) merged with the tool-level set, deduped. The server
 * JSON-LD must mirror exactly what SSR renders, so both the landing view and
 * the structured-data builder call this one function.
 */
export function defaultFaqsFor(app: AppDef): Faq[] {
  const modes = app.variants ?? []
  const defaultModeId =
    modes.length > 1 ? (app.defaultVariantId ?? modes[0].id) : undefined
  const seen = new Set<string>()
  return [
    ...(defaultModeId ? (APP_FAQS[defaultModeId] ?? []) : []),
    ...(APP_FAQS[app.id] ?? []),
  ]
    .filter((f) => {
      if (seen.has(f.q)) return false
      seen.add(f.q)
      return true
    })
    .slice(0, 4)
}

/** Metadata for one tool URL: title, description, keywords. */
export function appMeta(app: AppDef): {
  title: string
  description: string
  keywords: string[]
} {
  return {
    title: `${SEO_TITLES[app.id] ?? app.name} · Kontivo`,
    description:
      SEO_DESCRIPTIONS[app.id] ?? `${app.tagline} ${app.description}`.slice(0, 158),
    keywords: [
      app.name.toLowerCase(),
      ...(app.variants ?? []).map((v) => v.name.toLowerCase()),
      ...app.intents.slice(0, 10),
    ],
  }
}
