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
  image: 'Image Toolkit — compress, convert and resize images online free',
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
}

/** Hand-tuned meta descriptions (the snippet) — honest, specific, ~150 chars. */
const SEO_DESCRIPTIONS: Record<string, string> = {
  share:
    'Move text, files and whole folders between your phone and computer directly, up to 50 MB per file. One code serves text, files and folders. Nothing stored.',
  zip:
    'Pack files or a whole folder into a ZIP, or extract any archive with its structure intact. Runs entirely in your browser — nothing is ever uploaded.',
  image:
    'Compress photos to a target size, convert between PNG, JPEG and WebP, resize whole batches. Processed locally by your browser — no uploads, no sign-up.',
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
