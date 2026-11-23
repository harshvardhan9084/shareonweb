import type { AppArticle } from '@/lib/article-types'

// Long-form articles for the 19 instant tools. Every fact here reflects the
// real implementation: the browser engines used, the honest limits (memory,
// formats, DRM, encryption), and the privacy model (files never leave the
// device because there is no upload code at all).

export const INSTANT_ARTICLES: Record<string, AppArticle> = {
  // -------------------------------------------------------------------- zip
  zip: {
    lede: [
      'Zip & Unzip packs a pile of files, or a whole folder with its structure, into one ZIP. It also opens a ZIP you received and lets you pull everything out, or one entry at a time, with the original structure intact.',
      'The archive is built and read on this device with fflate, a compact ZIP engine that runs in the browser. Nothing is uploaded at any step: a 500 MB folder compresses in seconds and stays entirely on your machine, because there is no upload code on this page at all.',
    ],
    sections: [
      {
        heading: 'How packing and unpacking works',
        paragraphs: [
          'Drop files in, or drop a folder and its whole tree comes with it. The list shows what is in the archive, and you can rename it before download. Press pack and the ZIP is assembled in memory, then handed to you as a download.',
          'Dropping an existing ZIP flips the page into unpack mode: every entry is listed before extraction, so you can see what is inside without committing. Extract everything at once, or take a single file out and leave the rest.',
          'There is no queue to wait in and no progress bar hostage situation. The work happens at the speed of this device\u2019s CPU and disk, which for a typical folder is a couple of seconds.',
        ],
      },
      {
        heading: 'When it beats the desktop way',
        paragraphs: [
          'Desktop tools work, but they assume you are on your own computer with software installed. This page fits everywhere else.',
        ],
        list: [
          'Zip attachments on a phone before sending them',
          'Open an archive a colleague sent, without installing anything',
          'Pull one file out of a big ZIP instead of extracting the lot',
          'Compress a folder on a locked-down work machine where you cannot install software',
        ],
      },
      {
        heading: 'What happens to your files',
        paragraphs: [
          'The files you drop are read into this tab\u2019s memory, compressed or decompressed there, and written back out as a download. No network request carries any part of your data, which you can verify in the browser\u2019s network tab: the page has nothing to send it to.',
          'Close the tab and the memory is released. There is no copy on a server to delete later, no retention policy to trust, because nothing was ever stored anywhere else.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Folder structure is preserved in both directions: pack a nested folder and unpacking rebuilds the same tree. The limit on size is this device\u2019s memory, not a subscription tier; very large archives on small devices may hit that wall honestly.',
          'Standard ZIP compression is used, so the archive opens anywhere: the desktop extractor on Windows, macOS, Linux, or another browser tab like this one.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ image
  image: {
    lede: [
      'Image Toolkit is one workbench for the three things photos always need: compress to a target size or quality, convert between PNG, JPEG and WebP, and resize by pixels or percentage, in batches.',
      'Every pixel is processed on this device with the browser\u2019s own encoder. Your photos are never uploaded to anyone: there is no upload step, so there is no upload risk, just the work, done in seconds, where the files already are.',
    ],
    sections: [
      {
        heading: 'How the workbench works',
        paragraphs: [
          'Drop one image or fifty. Pick the job: compress with a quality slider, or aim at an exact target size and let the tool walk the quality down until the file fits; convert to another format; resize by pixel dimensions or a percentage with the aspect ratio locked.',
          'A before-and-after preview shows the real numbers, not promises: the size before, the size after, the saving. Results download one by one or all at once.',
          'Because the encoder is the browser\u2019s, output quality matches what your own device would produce, and the whole batch finishes in the time an upload to a converter site would still be spending in its queue.',
        ],
      },
      {
        heading: 'When it is the right workbench',
        paragraphs: [
          'Photo sites want accounts and watermark the free tier. This page fits the jobs that are yours alone.',
        ],
        list: [
          'Shrink photos to an exact size a form demands',
          'Convert a batch of PNGs to WebP to make a site faster',
          'Resize images for a marketplace listing or a visa application',
          'Reduce a camera roll before sending it over a metered connection',
        ],
      },
      {
        heading: 'What happens to your photos',
        paragraphs: [
          'Images are decoded, transformed and re-encoded inside this tab. Nothing leaves the device: no request carries your pixels, so no server can log, retain or train on them.',
          'Close the tab and it is all gone. The originals on your disk were never touched; the tool works on copies it holds in memory.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'PNG keeps transparency, JPEG squeezes photos hardest, WebP usually beats both for the web. Conversion between them is exact where the format allows, and where a format cannot express something (transparency in JPEG, for example) the tool fills it honestly rather than pretending.',
          'Target-size compression is iterative: the tool re-encodes at descending quality until the file lands at or under the size you asked for, and it tells you the quality it settled on.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- hash
  hash: {
    lede: [
      'Hash & Verify computes the MD5, SHA-1, SHA-256 and SHA-512 checksum of any file or piece of text, instantly, and then tells you whether it matches the hash the publisher published. That match is how you prove a download arrived intact and untampered.',
      'Hashing runs on this device. The file streams through the browser\u2019s crypto engine in chunks, which means huge files do not freeze the page and never, at any point, leave your machine.',
    ],
    sections: [
      {
        heading: 'How verification works',
        paragraphs: [
          'Drop the file, or switch to text mode and paste. All four checksums appear at once, in the hex form publishers use. Switch to verify, paste the expected hash, and the page compares them character by character and gives a clear match or no-match, ignoring case and spacing differences.',
          'Big files are read in chunks and hashed incrementally, so an ISO or a disk image is processed without loading the whole thing into memory. A several-gigabyte file takes as long as reading it from disk, and nothing more.',
          'Text mode is for the small cases: verify a pasted string, a config value or a token matches what it should be, without a terminal.',
        ],
      },
      {
        heading: 'When it is the right check',
        paragraphs: [
          'Checksums sound arcane until you have installed something that did not work, or worse, something that was not what it claimed to be.',
        ],
        list: [
          'Verify an ISO or an installer against the hash the project published',
          'Check a downloaded archive matches what the vendor says it is',
          'Prove a backup copy is identical to the original file',
          'Hash a token or a key locally, without pasting it into a web form on someone else\u2019s server',
        ],
      },
      {
        heading: 'What happens to your file',
        paragraphs: [
          'The file is read from disk in this tab and streamed through the browser\u2019s Web Crypto engine. It is never sent anywhere; there is no upload endpoint on this page to send it to.',
          'This matters most for exactly the files you should be most careful hashing elsewhere: keys, credentials, confidential archives. A hashing site that receives your file receives your secret. This one receives nothing.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'MD5 and SHA-1 are included because publishers still use them for compatibility, but they are cryptographically broken for security purposes: for tamper checks, prefer the SHA-256 or SHA-512 line when both are offered.',
          'Verify mode is deliberately forgiving of formatting: uppercase, lowercase, spaces and colons in the expected hash are normalized before comparison, because publishers format checksums inconsistently and a mismatch should mean mismatch, not punctuation.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- encode
  encode: {
    lede: [
      'Base64 Encode & Decode turns text into Base64 and back, Unicode-safe, and turns any file into a data URL you can paste straight into HTML, CSS or JSON. A Base64 file can be decoded back into a real download too.',
      'All of it happens on this device. Encoding is pure math on bytes, so there is nothing to send and nowhere to send it: paste your token, your snippet or your file, and it stays in this tab.',
    ],
    sections: [
      {
        heading: 'How conversion works',
        paragraphs: [
          'Paste text and the encoded form appears as you type; paste Base64 and it decodes the same way. Direction swaps in one click, results copy instantly, and Unicode is handled correctly, so characters beyond plain ASCII survive the round trip exactly.',
          'File mode turns a file into a data URL, complete with its MIME type, ready to embed in a stylesheet, an HTML document or a JSON payload. The reverse path decodes a Base64 file back into a downloadable file, original bytes intact.',
          'Errors are explained, not thrown: malformed Base64 is reported with where it went wrong, so a truncated paste is obvious in seconds.',
        ],
      },
      {
        heading: 'When it is the right converter',
        paragraphs: [
          'Base64 shows up everywhere: API payloads, JWT segments, email attachments, embedded images. Most converter sites would love to see those payloads. This one never does.',
        ],
        list: [
          'Decode a token or a config value you found in a log, privately',
          'Embed a small image directly in CSS or HTML as a data URL',
          'Turn a file into Base64 for a JSON API that demands it',
          'Recover a file someone pasted as Base64 into a message',
        ],
      },
      {
        heading: 'What happens to your data',
        paragraphs: [
          'Encoding and decoding are arithmetic on the bytes already in this tab. No request is made with your text or your file, which makes the page safe for the secrets Base64 usually carries: tokens, keys, credentials and the like.',
          'Remember what Base64 is and is not: it is an encoding, not encryption. It makes data transportable, not secret. Use it to move bytes; use real crypto to keep them confidential.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Unicode correctness is the usual trap. Naive converters break on characters outside ASCII and mangle emoji or non-Latin scripts; this tool encodes through the browser\u2019s UTF-8 machinery so what comes back is exactly what went in.',
          'Data URLs include the correct MIME prefix, so a PNG embeds as an image and a font embeds as a font. Browsers accept data URLs for small resources, which is precisely the range this page is best at.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- json
  json: {
    lede: [
      'JSON Formatter formats, validates and minifies JSON, and when the JSON is broken it does not just say \u201Cinvalid\u201D: it points at the exact line and column and shows the parser\u2019s message, so a stray comma takes seconds to find.',
      'Everything runs locally, which matters because the JSON people paste into formatters is often the JSON they should not be pasting anywhere: API responses with real data, config with credentials, tokens. Nothing here is sent anywhere.',
    ],
    sections: [
      {
        heading: 'How the formatter works',
        paragraphs: [
          'Paste or drop JSON and it validates as you type. Format pretty-prints with two or four space indentation; minify strips every byte that is not data. Sort keys alphabetically, which turns two large objects into a compare your eyes can actually do.',
          'Live stats sit beside the result: size before and after, key count, depth. The size delta tells you immediately how much whitespace a minified payload is saving, and depth tells you how gnarly the structure is before you walk into it.',
          'When parsing fails, the error is positioned precisely: line, column and the parser\u2019s own message, so the failing character is a scroll, not a hunt.',
        ],
      },
      {
        heading: 'When it earns its tab',
        paragraphs: [
          'JSON is the lingua franca of everything with an API, and its failure modes are always character-level.',
        ],
        list: [
          'Pretty-print an API response so its structure is readable',
          'Find the exact character that broke a config file',
          'Minify a payload before sending or storing it',
          'Sort two configs\u2019 keys and diff them honestly',
          'Inspect data that contains credentials without pasting it to a public site',
        ],
      },
      {
        heading: 'What happens to your JSON',
        paragraphs: [
          'Parsing and formatting happen in this tab with the browser\u2019s own JSON engine. There is no round trip, so payloads with real user data, secrets or tokens never leave the machine that already has them.',
          'Close the tab and the text is gone from memory. Nothing was stored, logged or learned.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'The formatter accepts exactly the JSON standard: it will not silently repair loose syntax, because a formatter that \u201Cfixes\u201D unquoted keys is teaching you to write broken JSON. The error position exists to make the fix fast instead.',
          'Key sorting is deep: nested objects sort too, which is what makes structural comparison meaningful rather than cosmetic.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- text
  text: {
    lede: [
      'Text Kit is the everyday text workbench: live counts of words, characters, sentences, paragraphs and reading time; every case conversion you reach for; and one-click line cleanup, from sorting and deduping to trimming, numbering and reversing.',
      'Paste, transform, copy. The transformations preview live as you click, nothing leaves the page, and the paste field is just for you: your drafts, your logs, your lists are nobody else\u2019s business, including ours.',
    ],
    sections: [
      {
        heading: 'How the tools work',
        paragraphs: [
          'Counts update as you type: words, characters with and without spaces, sentences, paragraphs, and an honest reading-time estimate at average speed. They are live because the questions they answer (\u201Cis this over the limit?\u201D) need answers while you are still writing.',
          'Case conversion covers the full ladder: UPPER, lower, Title, Sentence, camel, snake and kebab. The programmer cases understand word boundaries, so \u201Cuser profile page\u201D becomes userProfilePage and not camelCase soup.',
          'Line operations work on the list-shaped text everyone actually has: sort alphabetically or by length, deduplicate, trim whitespace, remove empty lines, reverse, add line numbers. Find and replace accepts plain text or a regular expression, so one-off cleanup is one click instead of one script.',
        ],
      },
      {
        heading: 'When it is the right bench',
        paragraphs: [
          'The tasks are small, which is exactly why they deserve a tool that opens instantly and asks for nothing.',
        ],
        list: [
          'Count an essay, a post or a metadata description against a limit',
          'Convert a headline to title case, or a column of names to snake_case',
          'Deduplicate and sort a list of emails or keywords',
          'Strip empty lines and trailing spaces from pasted output',
          'Run a regex replace without opening a terminal',
        ],
      },
      {
        heading: 'What happens to your text',
        paragraphs: [
          'Every transformation runs in this tab on the string in the editor. No request carries your text anywhere, so it is safe to paste the draft, the log or the customer list.',
          'The page holds nothing between visits: no draft storage, no history. What you keep is what you copy out.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Reading time assumes roughly 200 words per minute, the commonly used average for adult readers; treat it as an estimate, not a stopwatch.',
          'The regex box is real regex, applied per line over the whole text, with the same engine your browser\u2019s console uses. Invalid patterns are reported instead of silently matching nothing.',
        ],
      },
    ],
  },

  // --------------------------------------------------------------- password
  password: {
    lede: [
      'Password Generator builds passwords and passphrases from the browser\u2019s cryptographic random source: length under your control, symbols and digits on or off, look-alike characters excluded, a live strength estimate, and a memorable word-based mode for the times you have to type it on a TV remote.',
      'Generated on this device, never transmitted, never stored. The generator has no backend to log what it produced, which is the only property that actually matters in a password tool.',
    ],
    sections: [
      {
        heading: 'How randomness works here',
        paragraphs: [
          'Every password is drawn from crypto.getRandomValues, the browser\u2019s cryptographic random source, the same primitive that powers HTTPS itself. Not Math.random with a costume on: cryptographically secure randomness, local to your machine.',
          'Set the length and the character mix, and exclude look-alikes (0/O, 1/l/I) if the password will ever be read aloud or typed from paper. The strength estimate updates live and explains itself in entropy terms, so you can see why sixteen characters beat twelve.',
          'Passphrase mode builds passwords from real words with separators and optional numbering: long, strong, and memorable in a way a random character soup never is. Bulk mode generates a list when you are rolling credentials for a whole team.',
        ],
      },
      {
        heading: 'When to generate instead of invent',
        paragraphs: [
          'Humans are terrible random sources. We pick birthdays, we pick patterns, and the cracks start exactly there.',
        ],
        list: [
          'A strong unique password for each account, into your password manager',
          'A passphrase you can actually type on a TV or a console',
          'A Wi\u00AD-Fi password a guest can read out loud',
          'A batch of initial credentials for new accounts or devices',
        ],
      },
      {
        heading: 'What happens to what is generated',
        paragraphs: [
          'The password exists in this tab\u2019s memory until you copy it or regenerate it. There is no server that knows it, no log that recorded it, no \u201Crecently generated\u201D list stored anywhere.',
          'That is the property to demand of any password tool. A generator that transmits what it generates is a generator that can leak what it generates; this one has nothing to leak.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Length is the lever that matters most: entropy grows with every character, so when in doubt, longer and memorable beats shorter and gnarly. A four-word passphrase is both easier to type and typically stronger than an eight-character scramble.',
          'The exclusions and toggles exist for real constraints, not habit. If the password only ever goes into a manager, leave every character class on and go long.',
        ],
      },
    ],
  },

  // --------------------------------------------------------------------- qr
  qr: {
    lede: [
      'QR Generator makes a QR code for anything: a URL, plain text, your Wi\u00AD-Fi network so guests join without you reading the password aloud, or a contact card a phone camera saves straight into its address book.',
      'Pick the size and error-correction level, and download a crisp PNG. The code is rendered on this device; whatever you encode never touches a server, which is the quiet difference between this page and every \u201Cfree QR generator\u201D that logs your links.',
    ],
    sections: [
      {
        heading: 'How a code is made',
        paragraphs: [
          'Choose the type and fill in the details. URL and plain text are immediate. Wi\u00AD-Fi mode builds the standard network string (name, password, security type) so a phone camera offers \u201Cjoin network\u201D on scan. vCard mode packs a name, number and email so the scan lands in contacts as a person, not a paragraph.',
          'Error correction is a real choice, not jargon: higher levels survive a scratch, a glare or a printed poster\u2019s wear, at the cost of some capacity. For codes that will live on paper or a wall, take the higher level.',
          'The PNG downloads at the size you picked, drawn crisply for print rather than screenshotted from a preview.',
        ],
      },
      {
        heading: 'When a QR is the right bridge',
        paragraphs: [
          'A QR is the shortest path from one screen to another, or from paper to a phone.',
        ],
        list: [
          'Put the guest Wi\u00AD-Fi on a card, a wall or the fridge',
          'Move a link from your computer to your phone in one scan',
          'Share contact details at a desk, a stall or a conference table',
          'Put a menu, a manual or a schedule on paper that phones can open',
        ],
      },
      {
        heading: 'What happens to the content',
        paragraphs: [
          'The code is drawn locally from the data you entered. No redirect service sits behind it: this QR contains your actual URL or text, not a short link that someone else\u2019s server resolves, logs and can expire.',
          'That is why these codes cannot die. A code built here will work as long as the thing it points to does, because it answers to nobody.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Static codes like these are permanent by construction. The \u201Ceditable\u201D QR codes on marketing sites are dynamic: they encode a redirect the vendor controls, and when the subscription lapses, the poster on your wall goes dark.',
          'For Wi\u00AD-Fi codes, the password is embedded in the code itself, so print it where guests may read it and nowhere strangers may.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------- pdf
  pdf: {
    lede: [
      'PDF Toolkit does the surgery: merge several PDFs in your chosen order, organize one PDF page by page with live thumbnails (reorder, rotate, delete, restore), extract exact page ranges, or split a file every N pages and take the parts as individual PDFs or one ZIP.',
      'All of it happens on this device with pdf-lib, a PDF assembly engine that runs in the browser. The document is never uploaded, which is the point: contracts, invoices and medical letters are exactly the files that should not be uploaded to a stranger to be rearranged.',
    ],
    sections: [
      {
        heading: 'How the toolkit works',
        paragraphs: [
          'Drop one PDF and the page becomes an organizer: every page appears as a real thumbnail you can reorder, rotate or delete, with restore for the moment you delete one page too many. Drop two or more PDFs and they merge, in the order the arrows set, no drag-and-drop gymnastics required.',
          'Splitting is precise rather than approximate: extract ranges like 1-3, 7 or 12- into a fresh PDF, or cut the file every N pages and receive the parts as separate PDFs or a single ZIP, named so you know which is which.',
          'Encrypted files are detected and explained, not silently mangled: the page tells you the document is locked and what that means, instead of producing a corrupt output and calling it done.',
        ],
      },
      {
        heading: 'When it replaces the usual tools',
        paragraphs: [
          'Desktop PDF suites are heavy and paid; online ones upload your document to somebody\u2019s queue. This one fits the jobs in between.',
        ],
        list: [
          'Merge scanned pages into one document before sending it',
          'Delete a signature page or a blank sheet before printing',
          'Extract the three pages you actually need from a forty-page PDF',
          'Rotate sideways scans upright, permanently',
          'Split a long invoice run into per-client chunks',
        ],
      },
      {
        heading: 'What happens to your document',
        paragraphs: [
          'The PDF is read into this tab, its pages are copied and arranged in memory with pdf-lib, and the rebuilt file is handed back as a download. No request carries any part of the document, so confidentiality is a property of the architecture, not a promise in a policy.',
          'Close the tab and the work disappears from memory. The original on your disk was never modified; outputs are always fresh files.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Organize operations copy pages, which preserves their content exactly; text stays selectable and searchable in the output, because the pages are moved, not re-rendered as images.',
          'Range syntax accepts open ends: 12- means from page twelve to the last page, which saves counting a long document before extracting.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- pdf-view
  'pdf-view': {
    lede: [
      'PDF Viewer opens a PDF and lets you just read it: sharp rendering, page navigation with a direct page box, fit-width or stepped zoom, view rotation, and a search that scans every page and tells you exactly which pages contain the phrase. Click a hit and you are there.',
      'The file is rendered locally by pdf.js, the same engine Firefox uses, running in this tab. The document never leaves the device, and password-protected files are refused honestly, with the reason, rather than rendering garbage.',
    ],
    sections: [
      {
        heading: 'How reading works',
        paragraphs: [
          'Drop the PDF and page one renders immediately, drawn at this screen\u2019s pixel density so text stays crisp when you zoom. Fit-width is the default for reading; stepped zoom and rotation cover documents that arrive sideways or dense.',
          'Search runs over the whole document, not just the visible page: the results list every matching page with hit counts, and each hit jumps straight to its page. For a forty-page contract, that is the difference between finding the clause and flipping pages.',
          'Navigation is built for both kinds of readers: continuous prev/next for the browsers, and a direct page box for the ones who know the document and want page 37 now.',
        ],
      },
      {
        heading: 'When it beats the desktop viewer',
        paragraphs: [
          'A desktop reader is fine on your own machine. This page is for everywhere else: other people\u2019s computers, locked-down machines, the phone you are holding.',
        ],
        list: [
          'Read a document on a machine you cannot install software on',
          'Search a long PDF for the page you need, then jump to it',
          'Open a manual on your phone while your hands are on the machine it describes',
          'Look at a PDF that arrived sideways, rotated in one tap',
        ],
      },
      {
        heading: 'What happens to the document',
        paragraphs: [
          'Rendering happens in this tab: the file is read from disk into memory and drawn on a canvas. There is no upload, no \u201Cprocessing\u201D spinner that is actually a transfer, no copy left on a server.',
          'Close the tab and the document is out of memory. Password-protected files are refused rather than guessed at, because a viewer that fumbles encryption is a viewer you should not trust with real documents.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Rendering is device-pixel-ratio aware, which is why text holds up on zoom instead of dissolving into interpolation blur. Rotation is of the view, so a sideways page reads upright without altering the file.',
          'Search works on the document\u2019s text layer. Scanned image-only PDFs have no text layer, and the viewer tells you so rather than reporting zero hits and letting you wonder.',
        ],
      },
    ],
  },

  // --------------------------------------------------------------- pdf-text
  'pdf-text': {
    lede: [
      'PDF Text Extractor pulls every word out of a text-based PDF: each page is read locally with pdf.js, shown page by page with character counts, and exported as one continuous .txt or a page-marked one.',
      'Scanned, image-only PDFs are detected and reported honestly. There is no fake OCR, no silent empty result pretending success: the page tells you the document has no text layer and what that means.',
    ],
    sections: [
      {
        heading: 'How extraction works',
        paragraphs: [
          'Drop the PDF and extraction starts immediately, with live progress page by page so a long document never feels like a hang. Each page\u2019s text appears with its character count, which is a quick way to spot a blank page or a scan in the middle of the run.',
          'Reading order is rebuilt from the text layer\u2019s own line-break markers, so multi-column layouts come out as sentences rather than interleaved fragments, and hyphenation at line ends is handled instead of split mid-word.',
          'Export as a continuous .txt when the text is one flow, or page-marked when you need to know which page each passage came from. Copy everything in one tap either way.',
        ],
      },
      {
        heading: 'When you need the words out',
        paragraphs: [
          'Copy-paste from a PDF viewer is the classic betrayal: broken lines, missing spaces, phantom columns. Extraction done properly is for every time that mattered.',
        ],
        list: [
          'Quote a passage from a report or a paper in your own document',
          'Feed a contract into a search or an analysis tool',
          'Recover the text of a document whose source is long gone',
          'Pull lecture or manual text out to read on an e-reader',
        ],
      },
      {
        heading: 'What happens to the document',
        paragraphs: [
          'The PDF is read in this tab and its text layer is parsed in memory. Nothing is uploaded: the text of a confidential document crosses no network, because there is no code on this page that could carry it.',
          'The output is yours as a download or a clipboard copy. Nothing is retained on our side, because there is no our side holding anything.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Extraction reads the text layer; it does not perform OCR. A scanned page has pixels where text would be, and the honest answer is \u201Cthis page contains no extractable text\u201D, delivered per document when the whole file is scans.',
          'Page-marked export is the one to pick when you will cite the document later: the markers tell you exactly where each chunk sat in the original.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------- images-to-pdf
  'images-to-pdf': {
    lede: [
      'Images to PDF turns photos and scans into one ordered PDF: each image on its own page, in the order you set, at A4, US Letter or exactly the image\u2019s own size, with margins and JPEG quality under your control.',
      'Phone photos arrive straight-side-up because EXIF rotation is read from each image and applied before embedding. The PDF is assembled locally with pdf-lib; your images never leave the device on the way to becoming a document.',
    ],
    sections: [
      {
        heading: 'How a document is built',
        paragraphs: [
          'Feed in images in any order, JPEG, PNG, WebP, GIF, BMP or AVIF. The list shows them with reorder controls, because the page order is the document, and nobody wants to re-shoot a scan to fix a sequence.',
          'Page size is a choice: A4 for the paperwork world, US Letter where that is the norm, or fit-to-image when the document should look like the photos themselves. Orientation follows the image or your explicit pick, and margins run from none to large.',
          'The JPEG quality slider trades file size against fidelity before the PDF is built, so a twenty-page scan stays emailable. Build produces the PDF with a size readout, so you know what you are about to send.',
        ],
      },
      {
        heading: 'When photos must become a document',
        paragraphs: [
          'Forms, landlords, schools and offices want a PDF, not fifteen photos in a message.',
        ],
        list: [
          'Turn signed paper forms into one PDF to email back',
          'Compile receipts into a single expense document, in order',
          'Assemble a scan set for an application or a claim',
          'Make a printable booklet from a set of images',
        ],
      },
      {
        heading: 'What happens to your images',
        paragraphs: [
          'Images are decoded in this tab, rotated per their EXIF data, and embedded into a PDF built in memory. Nothing is uploaded; the assembly engine is local, so the images go from your disk to the PDF on your disk without passing through anyone else\u2019s hands.',
          'Close the tab and it is gone. The images on your disk were never touched, and no copy of them exists anywhere else.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'EXIF rotation matters more than people expect: phone cameras store orientation as metadata, and a PDF builder that ignores it produces sideways documents. Rotation is applied before embedding, so the PDF is upright everywhere it opens.',
          'Fit-to-image pages keep the document honest to the source: every page is the size of the image, which is right for archives and previews, while A4 and Letter are right for printing.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------- office-view
  'office-view': {
    lede: [
      'Document Viewer opens Word and Excel files in the browser: .docx rendered as formatted HTML with headings, lists, tables and images intact; .xlsx, .xls and .csv shown as a grid with sheet tabs. Convert on the way out: DOCX to HTML or plain text, CSV to XLSX, any sheet to CSV.',
      'Parsing happens locally with mammoth and SheetJS, the browser-native engines for those formats. The document is never uploaded, which is exactly what you want when the file is someone\u2019s resume, contract or accounts spreadsheet.',
    ],
    sections: [
      {
        heading: 'How viewing and converting works',
        paragraphs: [
          'Drop a file and it renders in place. Word documents come through as clean, formatted HTML inside a locked-down sandbox, so the content displays while the file\u2019s scripts, if any, have nowhere to run. Spreadsheets appear as a grid with sheet tabs, row counts, and an expandable limit when a sheet is bigger than the initial view.',
          'Conversion is the exit ramp: DOCX to HTML or plain text, CSV to a proper XLSX, or any sheet of a workbook out as CSV. Copy the document text or the visible grid in one tap for everything else.',
          'Old formats are refused honestly: .doc and PowerPoint get a clear explanation and a suggestion, not a silent failure or a mangled render.',
        ],
      },
      {
        heading: 'When it is the right viewer',
        paragraphs: [
          'Office suites are expensive and heavy; the files, meanwhile, arrive at breakfast.',
        ],
        list: [
          'Read a resume or a contract on a machine with no Word installed',
          'Open an accounts spreadsheet on a phone or a locked-down work laptop',
          'Convert CSV to XLSX without opening a spreadsheet app',
          'Pull the text out of a DOCX for quoting or processing',
        ],
      },
      {
        heading: 'What happens to the file',
        paragraphs: [
          'The document is read in this tab and parsed in memory. No upload occurs, so confidential files stay where they are; the sandbox around rendered HTML means the file\u2019s own content cannot execute against you.',
          'Nothing is retained. Close the tab and the document is out of memory, with the original file on your disk untouched.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'DOCX rendering covers the structural core: headings, lists, tables, images and emphasis. Complex desktop-only constructs (tracked changes, text boxes, exotic layouts) are simplified rather than faked, which is why the output is clean HTML instead of a fragile imitation.',
          'Large sheets show an initial window with an expand button, so a hundred-thousand-row file does not freeze the tab just because it was opened. Copy grabs exactly what is visible.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------- epub-view
  'epub-view': {
    lede: [
      'EPUB Reader opens DRM-free .epub books and reads them right here: paginated chapters, a table of contents you can jump through, text size from 12 to 28 px, and a live reading progress bar. Title and author come from the book\u2019s own metadata.',
      'Rendered locally with epub.js. The book never leaves the device, and DRM-protected library books are refused with an honest explanation rather than a broken attempt.',
    ],
    sections: [
      {
        heading: 'How reading works',
        paragraphs: [
          'Drop a book and it opens where you left the controls: paginated chapters with prev and next, mouse or arrow keys, and no app to install. The table of contents mirrors the book\u2019s own structure, nested chapters included, one click to jump.',
          'Text size adjusts live from 12 to 28 px without reloading the book, which is the difference between reading comfortably and squinting through a chapter.',
          'The progress bar tracks where you are in the book, and the title and author come from the file\u2019s metadata, so the page feels like a book rather than a file listing.',
        ],
      },
      {
        heading: 'When it is the right reader',
        paragraphs: [
          'E-reader apps want accounts and sync you into their ecosystem. This page reads the book you already have, on the device you already have.',
        ],
        list: [
          'Read a book on a machine where you cannot install an e-reader app',
          'Open a textbook or manual right where you are working',
          'Check a chapter of a book without sending it to your e-reader and syncing',
          'Read on someone else\u2019s computer with nothing installed and nothing left behind',
        ],
      },
      {
        heading: 'What happens to the book',
        paragraphs: [
          'The book is read in this tab and rendered in memory. No upload, no reading-tracking service, no notes about what you read and where you stopped, kept or shared.',
          'Close the tab and the book is out of memory. Your reading stays as private as reading a paper book, which is the standard every reading app should be held to.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'DRM-protected books (typically library or store purchases tied to a vendor app) are refused by design: breaking DRM is not legal in most places, and the page explains this instead of pretending otherwise. DRM-free epubs, including most project titles and self-published books, open freely.',
          'Corrupted files are detected and reported with the reason, so a bad download is a clear message rather than a blank reader.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ audio
  audio: {
    lede: [
      'Audio Toolkit is a small bench for the audio jobs that come up in a normal week: cut the dead air off a voice memo, join two recordings into one, speed a lecture up to save twenty minutes, bring a quiet recording up to a sane loudness, or soften a hard cut with a fade. Everything happens in one page, on one device.',
      'The page decodes your file with the browser\u2019s own Web Audio engine, draws the waveform from the real samples \u2014 not a proxy thumbnail \u2014 and renders your edits into a finished clip that is encoded right here as 16-bit WAV or real MP3. There is no upload step anywhere in that journey, which is why there is nothing to promise about privacy: your audio never leaves the tab.',
    ],
    sections: [
      {
        heading: 'How the edits actually work',
        paragraphs: [
          'Trimming slices the decoded samples between your two points \u2014 the waveform shows exactly what is inside and outside the selection, so the cut is not a guess. Merging concatenates files end to end; when their sample rates differ, the extra files are resampled to the first file\u2019s rate first, because concatenating mismatched rates is how you get chipmunk audio.',
          'Speed resamples the audio: 2\u00d7 plays twice as fast and an octave up, like a tape machine, and the page says so on the control instead of hiding behind a lossy time-stretch. Normalization comes in two honest flavors: peak mode scales the loudest sample up to a ceiling you set (-1 dB by default) so nothing clips, and loudness (RMS) mode targets perceived level, with a peak ceiling applied after so the result is both loud and safe.',
          'Fades are equal-power ramps applied at the very end of the chain, on the trimmed clip you are actually exporting \u2014 not baked into the source, so re-trimming never double-fades.',
        ],
      },
      {
        heading: 'When it beats the desktop way',
        paragraphs: [
          'Most audio jobs people actually have are thirty-second jobs. Installing an audio editor for them is like buying a lathe to sharpen a pencil.',
        ],
        list: [
          'Trim a voice memo to the useful 40 seconds and send it',
          'Bring a recording made too quietly up to normal loudness',
          'Join three chapter recordings into one file for a podcast host',
          'Speed up a lecture recording 1.5\u00d7 before your commute',
          'Export a WAV snippet as MP3 without uploading it to a converter site',
        ],
      },
      {
        heading: 'What happens to your audio',
        paragraphs: [
          'The file is read into this tab\u2019s memory, decoded to raw samples, edited there and re-encoded to the download you take away. No network request carries any of it \u2014 open the browser\u2019s network tab and watch: nothing leaves. A recording of a private meeting stays as private as it was on your phone.',
          'Close the tab and the samples are gone. There is no server copy to request deletion of, no retention window to trust, no account history to purge.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Formats follow your browser\u2019s decoder: WAV and MP3 everywhere, plus OGG, FLAC and M4A on most systems. Undecodable files are refused with the reason, not rendered as silence.',
          'Export sizes are bounded by memory: a one-hour stereo WAV at 44.1 kHz is around 600 MB \u2014 big but manageable on a laptop, optimistic on an old phone. MP3 export (128/192/320 kbps) uses the LAME engine compiled to JavaScript and runs at real-time-or-faster on modern hardware. The page shows progress honestly during the encode.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------- gif
  gif: {
    lede: [
      'GIF Studio does the two things people actually need with GIFs: turning a short piece of video into a looping animation, and making an existing GIF small enough to survive a chat app\u2019s upload limit. Both run entirely in this tab.',
      'Video frames are captured by the browser\u2019s own video engine and each frame is quantized to a real 256-color palette \u2014 the classic GIF bottleneck, done properly with optional dithering \u2014 then encoded locally. Shrinking works the other way: the GIF is decoded frame by frame, scaled, frame-skipped and re-encoded with its original timing preserved.',
    ],
    sections: [
      {
        heading: 'Video to GIF, with the controls that matter',
        paragraphs: [
          'You choose the start point, the length, the frame rate and the output width \u2014 the four numbers that determine both what the GIF says and what it weighs. The frame rate is capped at a sensible 20 fps because GIF playback is delay-based anyway; the width defaults to 480 px, which is where chat apps display it.',
          'Every frame is quantized against its own palette, which keeps colors honest even when the scene changes \u2014 a global palette from one frame would tint the rest. Dithering is optional: on for gradients and screen recordings, off for flat art where you want clean edges.',
        ],
      },
      {
        heading: 'Shrinking a GIF that is too big',
        paragraphs: [
          'Three levers, in order of how much they save: width (pixels are squared, so 320 px instead of 480 px cuts area nearly in half), frame skip (keep every 2nd or 3rd frame \u2014 the delays are re-timed so the animation plays at the same speed), and re-quantization with fresh palettes. The page shows the original and resulting size side by side before you download anything.',
          'GIF cannot compete with video compression \u2014 it stores indexed pixels per frame \u2014 so \u201ccompress\u201d here means a genuinely smaller GIF, not magic. The honest numbers are on the result card.',
        ],
      },
      {
        heading: 'When it beats the converter sites',
        paragraphs: [
          'GIF converter sites have a failure mode everyone has met: the 50 MB upload of a clip you did not want on a server, the queue, the watermark. None of that applies here.',
        ],
        list: [
          'Clip a reaction GIF from a video that never leaves your machine',
          'Shrink a GIF to a chat app\u2019s limit before the upload bar stalls',
          'Make a loop of your own screen recording without uploading it anywhere',
          'Convert on a machine where you cannot install software',
        ],
      },
      {
        heading: 'What happens to your files, and the limits',
        paragraphs: [
          'Both directions are local: the video or GIF is decoded in this tab, the frames live in memory, the result is encoded and downloaded. Nothing is uploaded \u2014 the page has no endpoint to upload to.',
          'Length and size are bounded by memory, honestly: a 10-second clip at 10 fps and 480 px is roughly a hundred frames and finishes in seconds; a two-minute conversion will make itself obvious on a small device. Very wide GIFs are scaled down for the preview, not for the file.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------- frame-grab
  'frame-grab': {
    lede: [
      'Frame Grabber pulls still images out of video. Scrub to the exact moment \u2014 down to the tenth of a second \u2014 and take a full-resolution PNG, or sweep the whole clip automatically and end up with a contact sheet of the entire video to pick from.',
      'The frames come from the browser\u2019s video decoder at the clip\u2019s native resolution. There is no proxy service re-encoding your video somewhere else, no queue, no watermark, and no upload: the file is read locally, seeked locally, and every frame is drawn locally before it becomes a PNG.',
    ],
    sections: [
      {
        heading: 'One frame or a hundred',
        paragraphs: [
          'The single-shot path is the precise one: scrub the timeline, watch the preview, grab exactly what you see. The batch path is the thorough one \u2014 take a frame every half-second, every second, or ask for an even count (12 thumbnails across a 48-second clip means one every 4 seconds) and let the sweep run with a visible progress line.',
          'Every grabbed frame lands in a contact sheet. Keep the good ones, discard the rest, then download individual PNGs or all kept frames as one ZIP with time-stamped names so you can still tell which is which after the fact.',
        ],
      },
      {
        heading: 'When it beats the desktop way',
        paragraphs: [
          'Pulling stills from video usually means either pausing a player and screenshotting the window (resolution wrong, UI in the shot) or installing a video tool for one frame. This page is the middle path.',
        ],
        list: [
          'Get a clean cover image for a video post, without the player chrome',
          'Turn a video of drawings or slides into their stills in one sweep',
          'Pick the best moment from a burst of action for a thumbnail',
          'Extract evidence frames on a machine you cannot install anything on',
        ],
      },
      {
        heading: 'What happens to your video',
        paragraphs: [
          'The clip is read into this tab and seeked by the browser\u2019s decoder; each frame is drawn to a canvas and encoded to PNG in memory. No part of the video is sent anywhere \u2014 the network tab stays quiet by construction, not by promise.',
          'Close the tab and everything is gone: the video, the frames, the ZIP. Nothing was stored elsewhere, so nothing needs deleting.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Formats are what the browser plays: WebM everywhere, MP4 on most systems. The page tells you the detected duration and resolution up front and refuses DRM-protected streams honestly rather than showing black frames.',
          'Frames are named by their timestamp (frame-01.50s.png), so batch results survive being mixed with other exports. True every-single-frame extraction is a desktop job; the sweep here goes down to 0.25 s steps without pretending to be frame-accurate at 60 fps.',
        ],
      },
    ],
  },

  // --------------------------------------------------------------- recorder
  recorder: {
    lede: [
      'Screen & Mic Recorder captures what is happening on your device \u2014 the screen, a window, or a single browser tab, with your microphone mixed in for narration \u2014 or your voice alone. It uses the browser\u2019s own capture and encoding, and hands you the file the moment you press stop.',
      'The design rule of this page is that recording is a local act. The stream goes from the browser\u2019s capture API straight into its media recorder and into a download. No processing service, no cloud folder, no account \u2014 which is why a recording of anything sensitive (a customer\u2019s screen, an internal demo, a voice note) is exactly as private as your downloads folder.',
    ],
    sections: [
      {
        heading: 'How a take works',
        paragraphs: [
          'Pick the surface: the browser will ask which screen, window or tab to capture \u2014 that dialog is the browser\u2019s, and nothing records until you confirm it. Microphone mixing is a toggle, not a surprise: if it is on, your voice rides along into the same track.',
          'While recording, a muted live preview and an elapsed timer that only counts recorded time (pause stops the clock) tell you where you are. Pause and resume mid-take for jumping over interruptions. When you stop, the take lands as a finished WebM with its duration and size, and you keep it or throw it away \u2014 nothing was written anywhere in the meantime.',
        ],
      },
      {
        heading: 'When it beats the extensions and apps',
        paragraphs: [
          'Screen recorders are a graveyard of upsells: watermarks on the free tier, minutes limits, an account required before the file downloads. This page has no tier.',
        ],
        list: [
          'Record a bug with narration and attach it to the ticket, in two minutes',
          'Capture a walkthrough of an internal tool that must not leave the company',
          'Record voice notes that never pass through a transcription service',
          'Make a quick tutorial for a colleague without installing anything',
        ],
      },
      {
        heading: 'What happens to the recording',
        paragraphs: [
          'The capture stream exists only inside this tab. When you stop, the encoded WebM lives in tab memory until you download or discard it. There is no upload code on the page, so there is no copy to subpoena, breach or accidentally share \u2014 the recording\u2019s privacy is the same as any other file in your downloads folder.',
          'Close the tab mid-recording and the take is gone; the browser treats capture that way, and the page does not fight it.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Output is WebM: VP8 or VP9 video with Opus audio when your browser supports it, chosen by capability negotiation rather than hard-coded. Voice recordings are Opus-only WebM, small and clear.',
          'Permission prompts are the browser\u2019s own and are required \u2014 the page cannot record without them, and it explains what it is asking for before triggering the dialog. Refusing permission produces an honest state, not an error loop.',
        ],
      },
    ],
  },

  // --------------------------------------------------------------- upscaler
  upscaler: {
    lede: [
      'Image Upscaler makes pictures bigger without the usual mush. Give it a photo and a target \u2014 2\u00d7, 3\u00d7, 4\u00d7 or an exact width \u2014 and it enlarges with stepped high-quality resampling followed by an unsharp-mask pass whose strength you control. Before and after dimensions and file weights are shown side by side, and the result downloads as PNG, JPEG or WebP.',
      'The page is honest about what it is: careful resampling and sharpening, not an AI model that invents detail. That is a deliberate trade \u2014 model-based super-resolution needs tens of megabytes of download per use, while this runs instantly on any device \u2014 and for most real photos (screenshots, scans, product shots) the stepped path preserves more of what you actually shot.',
    ],
    sections: [
      {
        heading: 'Why stepping beats one big jump',
        paragraphs: [
          'Resampling 480 px to 1920 px in a single operation makes every new pixel an average of far-apart neighbors, which is how enlargements get soft. Doubling in stages \u2014 480 to 960, 960 to 1920 \u2014 reuses smooth interpolation on intermediates that are already clean, and the difference at 4\u00d7 is visible: text edges and thin lines survive.',
          'After the enlargement, an unsharp mask compares each pixel to a blurred version of its neighborhood and exaggerates the difference along edges. At low strength it restores the crispness enlargement diluted; at high strength it starts to halo, and the preview shows you exactly which side of that line you are on before you download.',
        ],
      },
      {
        heading: 'When it beats the usual options',
        paragraphs: [
          'The alternatives for enlarging an image are a photo editor (install, learn, save) or an online upscaler (upload, wait, trust, often watermark). This page is the third option.',
        ],
        list: [
          'Double a screenshot so text is readable on a projector',
          'Bring an old 640\u00d7480 scan up to printable size, then judge the result honestly',
          'Prepare a product image to a marketplace\u2019s minimum resolution',
          'Upscale a private photo without uploading it to a stranger\u2019s service',
        ],
      },
      {
        heading: 'What happens to your image',
        paragraphs: [
          'The image is decoded in this tab, enlarged on canvases in memory, sharpened there, and encoded back out as your download. No request carries any pixel of it. The comparison preview is rendered from the same buffers, so what you judge is what you get.',
          'Nothing about the image is kept: close the tab and the buffers are reclaimed. There is no history, no recent-uploads list, no account.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'PNG export is lossless and is the right choice for screenshots and line art; JPEG and WebP exports with a quality control are better for photographs heading to the web. Output dimensions are shown before download \u2014 no surprises.',
          'Very large targets (a 4000\u00d73000 source at 4\u00d7) are bounded by device memory, and the page states the limit instead of failing silently. Sharpening is applied after enlargement only \u2014 your source file is never modified.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- archive
  archive: {
    lede: [
      'Archive Explorer opens the TAR family of archives: plain .tar, gzipped .tar.gz and .tgz, and lone .gz files. It lists every entry with its size, type and timestamp, then lets you take a single file or a whole selection, rebuilt into a ZIP with folder structure intact. The same page builds new .tar.gz archives from loose files or a whole folder, and gzips or decompresses one file at a time.',
      'There is no tar library behind it. The reader and writer are hand-written ustar implementations running in this tab, and gzip is the browser\u2019s own native compression engine. Nothing is uploaded at any point \u2014 the page has no upload code at all, so the archive never leaves your device, something you can verify in the network tab, which will show nothing but the page itself.',
    ],
    sections: [
      {
        heading: 'How TAR really works',
        paragraphs: [
          'TAR is a format from tape-drive days, and it shows. The archive is a plain sequence of 512-byte blocks: one header block describing the next entry, then that entry\u2019s contents padded up to the next 512-byte boundary, then the next header, and finally two all-zero blocks to mark the end. There is no central directory to index the whole thing \u2014 a reader simply walks the chain from the start, which is exactly what this tool does.',
          'Each header carries fixed-width fields: the name in 100 bytes, the size and modification time as octal numbers, a type flag for file, folder or link, and a checksum of the header itself, which this tool verifies before trusting anything and reports with a byte offset when it fails. Long paths get two escape hatches: the ustar prefix field adds 155 bytes of path ahead of the name, and GNU tar\u2019s long-name entries or PAX extended headers can override the path entirely. All three are handled here, with PAX kept to its minimal path override.',
        ],
      },
      {
        heading: 'When it beats the desktop tools',
        paragraphs: [
          'Desktop archivers work, but they assume software is installed and you are on your own machine. This page fits the in-between moments.',
        ],
        list: [
          'Inspect a .tar.gz a colleague sent, on a machine where nothing is installed',
          'Pull two files out of a huge archive instead of unpacking the whole thing',
          'Hand over a folder as .tar.gz when the recipient expects one, straight from the browser',
          'Quickly gzip or uncompress a single file, with no terminal and no install',
        ],
      },
      {
        heading: 'What happens to your files',
        paragraphs: [
          'The archive is read into this tab, parsed there, and any output \u2014 a ZIP of your selection, a built .tar.gz, a decompressed file \u2014 is assembled in memory and handed to you as a download. No request ever carries your data; there is no endpoint on this page to send it to, which is a stronger guarantee than any privacy policy can offer.',
          'Close the tab and the memory is released. Nothing was stored anywhere else, so there is nothing to delete, retain or leak later.',
        ],
      },
      {
        heading: 'The honest limits',
        paragraphs: [
          'Symlinks and hardlinks are listed with their targets but never extracted or followed, and they are skipped when a ZIP is rebuilt \u2014 an archive cannot use them to place files outside the tree you chose. PAX support is the minimal path override, not the whole standard. Extraction is capped at 1 GB uncompressed: the work runs in this tab\u2019s memory, and the cap keeps the page honest on small devices; archives beyond that need a desktop tool, and the page says so plainly.',
          'ZIP files, for the record, belong to the Zip tool \u2014 this page is the TAR family. If you arrive with a .zip, the Zip tool two doors down handles packing and unpacking it.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------- file-tools
  'file-tools': {
    lede: [
      'File Workshop bundles the five file jobs a browser page can actually do without a server: split a file into parts, rejoin the parts, rename a batch, swap extensions and group duplicates. Everything reads from disk with the File API, works inside this tab and comes back as downloads \u2014 the page has no upload code at all, so your files never leave the device, something the network tab will happily confirm.',
      'The split/merge pair is the serious one. Splitting cuts the file as Blob slices (the bytes are not even loaded a second time), records the original name, size and SHA-256 in a .manifest.json, and names the parts name.part001, part002 and so on. Merging takes those parts in any pick order, sorts them by their numbers, and \u2014 when the manifest is present \u2014 refuses to guess: it checks the total size and re-hashes the restored file before the download starts.',
    ],
    sections: [
      {
        heading: 'How split and merge prove themselves',
        paragraphs: [
          'The manifest is plain JSON carrying the original name, byte size, SHA-256, the part count and the exact size of every part. The hash comes from WebCrypto for files that fit in memory, and from a compact streaming implementation for the ones that do not \u2014 the same FIPS 180-4 algorithm either way, verified to agree byte for byte. At merge time the tool adds up the parts\u2019 sizes and streams the restored bytes through SHA-256 again. A green banner means the restored file is identical to the original; a red one means a part is corrupt, truncated or out of order, and nothing downloads automatically until you say so.',
          'Without a manifest the merge still works: part numbers are read from the file names, so part003 lands after part002 wherever you picked them, and gaps in the sequence are called out loudly. The result downloads with an honest banner saying integrity could not be verified \u2014 the page never pretends a check happened that did not.',
        ],
      },
      {
        heading: 'Renaming and extensions: previews, not surprises',
        paragraphs: [
          'Bulk rename builds each new name from find/replace, prefix, suffix, numbering and case, applied to the base name with the extension kept as-is, and shows the old \u2192 new table live before anything happens. Files are numbered in name order, and any two files that would land on the same name are flagged in rose \u2014 a folder cannot hold two identical names, and neither can the ZIP of your results.',
          'The Extension tab is the narrow version: set, replace or append one extension for every picked file, lower or upper case. Both modes end the same honest way \u2014 a browser cannot modify files on disk in place, so applying means downloading renamed copies while the originals stay untouched.',
        ],
      },
      {
        heading: 'Finding duplicates without a server',
        paragraphs: [
          'Duplicate hunting is staged so it stays fast: files are grouped by exact size first (different sizes can never be identical), same-size groups get a fingerprint hashed from the first and last 64 KB, and only surviving candidates get a full SHA-256 \u2014 capped at 256 MB per file. Anything bigger is judged on the fingerprint alone and labelled \u201clikely duplicate \u2014 partial hash\u201d. Each group suggests a keeper, the oldest copy by modification time, and pre-marks the rest so the review starts from a sensible place.',
          'The honest limit: a browser page cannot delete files on disk. The keeper list (.txt) is the hand-off \u2014 it lists every group with the keeper, the copies and which ones you marked, so the manual cleanup is a checklist instead of an investigation.',
        ],
      },
      {
        heading: 'What happens to your files',
        paragraphs: [
          'Files are read locally, hashed sequentially so the tab stays responsive, and written back as downloads. Nothing is stored, queued or transmitted; close the tab and every buffer is gone. There is no account to delete, because there was never an account.',
          'The caps are stated rather than discovered: single-file operations refuse anything over 2 GB, parts cap at 500, and the duplicate finder\u2019s full-hash stage stops at 256 MB per file \u2014 all spelled out in the page instead of failing mysteriously.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- encrypt
  encrypt: {
    lede: [
      'Encrypt turns a password into real protection: drop a file and it comes back as a .enc container, or type text and it comes back as an encrypted Base64 block you can paste anywhere. Underneath is AES-256-GCM, the authenticated cipher browsers use for TLS, with the key stretched from your password by PBKDF2-SHA256 at 310,000 iterations. The same page decrypts, and a wrong password refuses to produce anything rather than decrypting to garbage.',
      'Everything happens in this tab. The key is derived in the browser\u2019s crypto engine and marked non-extractable, so it cannot be pulled out of it; the plaintext never leaves the device, because the page has no upload code at all. There is no account, no server copy and no recovery: lose the password and the data stays encrypted, exactly as promised.',
    ],
    sections: [
      {
        heading: 'How the encryption actually works',
        paragraphs: [
          'A password is a terrible key \u2014 people choose memorable ones, and memorable means guessable. So the password is never used directly. PBKDF2-SHA256 runs it through 310,000 hashing rounds together with a random 16-byte salt, which makes each guess cost real computation and means the same password produces a different key for every operation. The result is a 256-bit AES key the engine never exposes.',
          'The data is then sealed with AES-GCM and a fresh random 12-byte IV, the mode\u2019s one hard requirement per message. GCM is an authenticated mode: alongside the ciphertext it produces a tag that only the correct key verifies. That is what \u201Cauthenticated\u201D buys you \u2014 a flipped bit, a truncated file or a wrong password does not decrypt to plausible garbage; it refuses outright with \u201CWrong password, or the file is damaged.\u201D',
        ],
      },
      {
        heading: 'The container, byte by byte',
        paragraphs: [
          'Every operation writes the same layout: the five magic bytes \u201CKENC1\u201D, a one-byte version, the 16-byte salt, the 12-byte IV, then the ciphertext \u2014 the table is printed on the page, and a .enc file and the Base64 text container differ only in transport. Reading the header back is how the page decrypts: salt and IV come first, the key is re-derived from your password, the ciphertext is verified and opened.',
          'The honest compatibility note: this is Kontivo\u2019s own container, not an OpenSSL or GPG format. The primitives are the standard ones, and the spec is short enough to implement from the page, but a .enc file opens with a KENC1 reader \u2014 this page, today \u2014 and nothing else by default.',
        ],
      },
      {
        heading: 'When this is the right tool',
        paragraphs: [
          'It fits the moments where installing anything is heavier than the job itself.',
        ],
        list: [
          'Seal a document before emailing it, so the attachment is inert without the password',
          'Put a secret into a chat as a Base64 block that means nothing until decrypted',
          'Protect a file on a borrowed or locked-down machine where you cannot install software',
          'Hand someone a .enc file plus the password over a second channel, and nothing else reveals the contents',
        ],
      },
      {
        heading: 'What happens to your data, and the honest limits',
        paragraphs: [
          'The key derivation, the encryption and the decryption all run in this tab\u2019s engine; no request carries the password, the key or a single byte of your data, which the network tab will confirm. Close the tab and the key, the plaintext and the memory are gone \u2014 there is nothing stored anywhere else to breach or retain.',
          'The limits are stated, not hidden. Files are held whole in this tab\u2019s memory, so anything over 256 MB is refused up front \u2014 those jobs belong to a desktop tool such as age or GPG, which also serve command-line workflows and cross-tool formats better. There is no password recovery, by design. And the strength meter cannot save a leaked password: if the phrase is reused anywhere else, assume it is already known and pick another.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------- meta-scrub
  'meta-scrub': {
    lede: [
      'Metadata Cleaner opens a photo and shows you what it quietly carries: the camera that took it, the software that touched it, when it was taken, and \u2014 on many phones \u2014 the exact GPS coordinates of where. The viewer is a hand-written EXIF and PNG-chunk reader, not a library wrap: JPEG segment markers are walked one by one, the TIFF directories inside the EXIF block are decoded tag by tag, and PNG chunks are listed with their checksums verified. Then one press strips all of it.',
      'The scrub is byte surgery, not a re-encode. A JPEG is rebuilt from its structural segments alone \u2014 quantization tables, frame, Huffman tables, scan data, end marker \u2014 so the pixels come out byte-identical to the original; nothing is decompressed, nothing is recompressed. A PNG is rebuilt from its critical chunks with checksums recomputed. The cleaned file is then re-parsed in memory as proof: the page shows the record count it finds afterwards, instead of promising the metadata is gone.',
    ],
    sections: [
      {
        heading: 'What EXIF actually leaks',
        paragraphs: [
          'EXIF is a small database taped onto the front of a JPEG, and phone cameras fill it generously. The Make, Model, body serial number and lens serial number identify the device \u2014 sometimes down to the individual unit. DateTimeOriginal records the moment of capture to the second. And the GPS IFD, when the camera had a fix, stores latitude and longitude as three rational numbers each \u2014 which this page converts to decimal degrees with the hemisphere spelled out, so you can see exactly how locating that caf\u00e9 photo is.',
          'Beyond the headline fields there is a longer tail: Software (which editor or uploader touched the file last), UserComment and ImageDescription (free text some cameras fill), thumbnails that can outlive an edit, and XMP blocks from Adobe tools. The table on the page decodes every tag it can name and reports the ones it cannot, so the verdict card \u2014 \u201CFound: 63 metadata records, including GPS location\u201D \u2014 counts real entries, not vibes.',
        ],
      },
      {
        heading: 'How the lossless strip works',
        paragraphs: [
          'A JPEG file is a chain of segments: a start marker, optional metadata segments, then the coding tables, the frame header, the entropy-coded scan and an end marker. The strip walks that chain and copies only the segments a decoder actually needs, skipping every APPn (EXIF, ICC, XMP, Photoshop), every COM comment, and multi-picture extensions. The scan data is never touched, so what comes out renders identically to what went in \u2014 there is no quality slider because no pixel is re-computed.',
          'PNG takes the other path: its format is a sequence of typed chunks, and only four are critical (IHDR, PLTE, IDAT, IEND). The rebuild copies those, recomputes each checksum, and drops everything ancillary \u2014 text chunks, the eXIf block, timestamps, color profiles. When a JPEG\u2019s structure is too unusual to walk safely, the page falls back to a canvas re-encode at quality 0.92 and labels that honestly: pixels touched, metadata gone.',
        ],
      },
      {
        heading: 'What happens to your photos',
        paragraphs: [
          'The photo is read into this tab, parsed there, rebuilt there, and handed back as a download named after the original plus \u201c-clean\u201d. There is no upload code on this page at all, so the bytes never leave the device \u2014 the strongest privacy statement a tool can make is that it has nowhere to send them.',
          'The proof pass is part of that honesty: after scrubbing, the cleaned bytes are re-parsed with the same reader, and the verdict card shows what it finds \u2014 normally zero records, no GPS. If it ever found something, the page would say so rather than claim a clean bill.',
        ],
      },
      {
        heading: 'The honest limits',
        paragraphs: [
          'Formats are detected by magic bytes, and only JPEG and PNG are supported: HEIC/HEIF \u2014 the iPhone default \u2014 cannot be parsed here, and the page says so plainly instead of pretending. Files cap at 100 MB because the scrub holds the photo in memory more than once. Removing the ICC color profile alongside the metadata shifts nothing on ordinary sRGB photos, but wide-gamut photos can render slightly differently without it.',
          'And one thing no local tool can change: platforms usually strip metadata on upload \u2014 but email, chat attachments and direct file shares do not. If you post a photo somewhere, check what arrives, not just what you sent.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------- jwt
  jwt: {
    lede: [
      'A JWT looks like an encrypted blob, and that first impression causes most of the trouble around it. It is not encryption at all: a compact token is three base64url segments joined by dots, and anyone holding one can read every claim by decoding the first two. JWT Inspector does exactly that \u2014 paste a token and the header and payload appear as readable JSON, each standard claim explained in plain language, every epoch second turned into a real date in your local time.',
      'Everything happens in this tab. The decoder is hand-written base64url with strict UTF-8 checking, the signature checks run in the browser\u2019s own WebCrypto engine, and there is no upload code on the page: the token and any key you paste never leave the device. Verification answers one narrow question \u2014 were these exact bytes signed by this key \u2014 and the page is equally clear about what it does not answer.',
    ],
    sections: [
      {
        heading: 'Three segments, not encryption',
        paragraphs: [
          'The header names the scheme: alg, sometimes typ, often a kid saying which key signed this. The payload carries the claims \u2014 iss for who issued the token, sub for who it is about, aud for who may accept it, exp and nbf for its lifetime, iat for when it was minted, jti as a unique id, scope for embedded permissions. The signature is the third segment: proof, produced with the issuer\u2019s key, that neither of the first two has changed since signing. Base64url is a transport encoding, not a cipher \u2014 decoding a JWT is reading it, and every party between you and the issuer can read it too. Confidentiality needs JWE or another layer; a JWT offers integrity and identity, not secrecy.',
          'Because the encoding is so regular, honest decoding lives at the edges: missing padding, URL-safe characters, segments whose bytes are not valid UTF-8. This page reports exactly what failed \u2014 which part, at which byte \u2014 instead of a bare \u201Cinvalid\u201D with nothing behind it.',
        ],
      },
      {
        heading: 'Claims and clocks',
        paragraphs: [
          'exp, nbf and iat are NumericDates: seconds since 1970, deliberately timezone-free. The page renders them as local dates and as distances \u2014 \u201Cexpires in 3 h 12 m\u201D, \u201Cissued 2 h ago\u201D \u2014 and computes VALID, EXPIRED and NOT YET VALID against one clock only: your device\u2019s. That clock ticks next to the verdict with an honest note: if the device clock is wrong, the badges are wrong too. Real servers tolerate a small skew, a minute or two either side, for exactly this reason.',
          'A token without exp never expires on its own \u2014 the badge says so plainly instead of inventing an expiry. aud can be a string or an array; both are shown, and either way the decision \u201Cam I the audience?\u201D belongs to the app that accepts the token, not to this page.',
        ],
      },
      {
        heading: 'Verifying a signature locally',
        paragraphs: [
          'HS* tokens are symmetric: the same secret signs and verifies, so pasting the issuer\u2019s shared secret lets WebCrypto recompute the HMAC over header.payload and compare it. RS*, PS* and ES* tokens are asymmetric: a private key signs, and the public key \u2014 pasted here as a JWK, or as a whole JWKS document from which the key matching the header\u2019s kid is picked \u2014 is enough to check it. RSA-PSS uses the digest-sized salt the JWS standard mandates, and ES* signatures arrive as raw r\u2016s bytes that are length-checked before the curve ever sees them.',
          'alg \u201Cnone\u201D gets the loudest treatment on the page: an unsigned token is just JSON wearing a token costume, and this tool never calls it verified. What a verified result proves is stated just as plainly \u2014 the signature matches the key you provided. Not that the key belongs to a legitimate issuer, and not that the claims are safe to accept.',
        ],
      },
      {
        heading: 'What happens to your tokens, and the honest limits',
        paragraphs: [
          'There is no upload code, no fetch and no storage: the token, the secret and the key exist only in this tab\u2019s component state, and the Clear button wipes them in one press. Even so, treat every pasted secret like a password \u2014 test tokens are what this page is for.',
          'The limits are stated, not hidden: EdDSA (Ed25519) is not verified here because browser WebCrypto support is still uneven, the jwks_uri is never fetched \u2014 you paste the key yourself \u2014 and the timing of the signature comparison is the engine\u2019s, not this page\u2019s.',
        ],
      },
    ],
  },

  // -------------------------------------------------------- hash-file-batch
  'hash-file-batch': {
    lede: [
      'A checksum answers one question about one file: are these bytes still exactly what they were? A checksum list asks it about a whole folder at once \u2014 one line per file, a manifest you can re-check tomorrow, on another machine, or after a backup restore. Batch Checksums builds that manifest: drop a pile of files or pick a folder, and every file is hashed with MD5, SHA-1 or SHA-256 in a sequential queue that shows live progress, per-file status and elapsed time.',
      'The output speaks the format the command line already uses. The .sha256, .sha1 and .md5 exports follow the GNU two-space convention, so a list saved here verifies on any Linux machine with sha256sum -c \u2014 or verifies right here, by pasting any checksum list into the page and reading a color-coded verdict for every entry. Nothing is uploaded at any point: the page has no upload code at all.',
    ],
    sections: [
      {
        heading: 'Why checksum lists exist',
        paragraphs: [
          'Downloads publish them so you can prove a file arrived intact; backup scripts write them so a restore can be audited; archivists keep them as the receipt for what a collection contained on a given day. The list is more useful than the hash alone because it binds the hashes to names and sizes in one place \u2014 a single file hash tells you nothing once you forget which file it belonged to.',
          'This tool covers both sides of that exchange. Produce: hash a folder and export the manifest in a format native tools read. Check: paste any list \u2014 from a download page, a previous run of this tool, or a Linux machine \u2014 and every entry is matched against your files by relative path or filename, then marked OK, MISMATCH or NOT FOUND with the counts on top.',
        ],
      },
      {
        heading: 'Hashing a queue without freezing the page',
        paragraphs: [
          'WebCrypto hashes a whole file in one call, which is perfect until the file is bigger than the tab wants to hold in memory. Files up to 64 MB go that route. Anything larger is streamed through incremental implementations of the same algorithms: the file is read 8 MB at a time, each slice feeds MD5, SHA-1 and SHA-256 state machines that carry partial 64-byte blocks across chunk boundaries, and the page yields to the browser between slices so scrolling and clicking stay alive. The result is byte-identical to a one-shot hash \u2014 a self-test button proves it against the published \u201Cabc\u201D vectors, against WebCrypto itself, and against one-shot versus sliced input.',
          'The queue runs sequentially by design: one file at a time keeps disk reads and CPU from fighting each other, the progress bar counts files and bytes honestly, and the cancel button stops cleanly between chunks \u2014 finished results are kept and the interrupted row stays pending for a resume.',
        ],
      },
      {
        heading: 'The verify pass: sha256sum -c, made visual',
        paragraphs: [
          'The command-line verify prints one terse line per file. This page does the same match \u2014 entries are parsed from the three common line forms, compared digest by digest \u2014 but renders the outcome as a table: emerald OK, rose MISMATCH with the computed value shown beside it, amber NOT FOUND for names with no matching file. The page also reports the reverse direction the command line ignores: hashed files the pasted list never mentions.',
          'Honest edges are handled rather than hidden: unparseable lines are counted, SHA-512-length hashes are skipped with a note because the tool does not compute SHA-512, and a file that was found but never hashed for that algorithm says so plainly instead of pretending to verify.',
        ],
      },
      {
        heading: 'What happens to your files, and the honest limits',
        paragraphs: [
          'Every checksum is computed in this tab. Files are read with the browser File API, hashed in memory, and never sent anywhere \u2014 the page contains no upload code to audit, and the browser\u2019s network tab will show nothing but the page itself. Pasted checksum lists are matched in memory the same way, and the self-test runs on the same device.',
          'The limits are stated, not discovered: files over 2 GB are refused up front (browser file handling gets unreliable past that size \u2014 sha256sum or certutil handle those better), the whole queue carries a soft cap of 8 GB that warns rather than blocks, and the exports write filenames as-is: names with plain spaces parse correctly in the two-space format, but GNU tools backslash-escape names containing backslashes or newlines and this page does not. And MD5 remains fine for integrity but broken for secrecy \u2014 treat an MD5 match as proof the file is whole, never as proof it is authentic.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- cron
  cron: {
    lede: [
      'A cron expression is five (or six) small fields that decide when a job runs, and it is read wrong constantly. Cron Studio parses the expression into its exact set of values, writes the schedule out as a plain English sentence, and then shows the part that actually matters: the next fire times, computed against your device clock. Standard 5-field crontab syntax and 6-field seconds-first (the Quartz and lockfile convention) are both read, and the field count is detected for you \u2014 with a toggle to force either reading.',
      'The parser is hand-written for this page; there is no cron library. Names, ranges, steps and lists expand into the exact values they mean, and when something cannot be parsed the error names the field and the exact offending value. Nothing is sent anywhere: the expression, the parse and the schedule math all happen in this tab.',
    ],
    sections: [
      {
        heading: 'What the fields mean',
        paragraphs: [
          'Five fields, left to right: minute (0-59), hour (0-23), day-of-month (1-31), month (1-12, or JAN-DEC) and day-of-week (0-7, where 0 and 7 are both Sunday, or SUN-SAT). A sixth field in front means seconds, and each field accepts a single value, a range like 9-17, a step like */5 or 9-17/2, a list like 0,15,30, and any combination of those. The field chips under the input show what every field expanded to, value by value \u2014 */5 in the minute field becomes 0, 5, 10, \u2026 55, and nothing is left to guess about what the asterisk covered.',
          'The plain-English sentence is the tool\u2019s reading, not a guarantee \u2014 the next-runs grid below it is the ground truth. That order matters: a description can be fluent and still subtly wrong, but a grid of computed fire times cannot.',
        ],
      },
      {
        heading: 'The day-of-month OR day-of-week subtlety',
        paragraphs: [
          'The most misread rule in cron: when day-of-month and day-of-week are BOTH restricted, a day fires when EITHER matches \u2014 not both. 0 0 13 * FRI fires on the 13th of every month and on every Friday, while the person writing it usually meant \u201Cthe 13th, but only if it lands on a Friday\u201D \u2014 which cron cannot express in one line. Whenever the parser sees both day fields restricted, the page says so in plain words beside the schedule, so the reading is never silent.',
          'If one of the two day fields is a plain *, the intuitive rule applies and both conditions must hold. The parser treats a bare ? in a day field the same way \u2014 it is Quartz syntax that reads exactly like * \u2014 and flags it, while L, W, # and year fields are refused with an error naming the field and the character, because guessing them would risk a silently wrong schedule.',
        ],
      },
      {
        heading: 'Why the next-run preview catches bugs',
        paragraphs: [
          'Descriptions lie by omission; a grid of upcoming fire times cannot. Schedule 0 0 31 * * and the preview shows the honest gap: seven months of the year have no 31st, so the job goes quiet for weeks at a stretch. A step in the wrong field, a weekday off by one, a monthly job that lands on the 1st \u2014 all of it becomes visible in the first rows, each carrying the full local date and its distance from now.',
          'The per day, week and month load figures are labeled as a simulation: they are counted by walking one representative window on this device, and other months differ when weekdays shift or months run short. The search for fire times caps at 366 days ahead and says so plainly when nothing matches \u2014 day-of-month 31 in a 30-day month never fires, and no description would have warned you.',
        ],
      },
      {
        heading: 'What happens to your data, and the honest limits',
        paragraphs: [
          'There is no upload code on this page. The expression is parsed in this tab, the fire times are computed in your local timezone against your device clock \u2014 the only clock that matters here, so a wrong device clock shifts every computed run with it. Nothing is stored; close the tab and it is gone.',
          'Timezones are the honest limit worth repeating: your crontab fires in the timezone of the machine it runs on, which may not be the one in your pocket. And @reboot cannot be previewed at all, since firing at boot has no wall-clock time behind it \u2014 the other @-shortcuts expand to their expressions automatically.',
        ],
      },
    ],
  },
}
