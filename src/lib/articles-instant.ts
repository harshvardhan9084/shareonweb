import type { AppArticle } from '@/lib/article-types'

// Long-form articles for the 14 instant tools. Every fact here reflects the
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
}
