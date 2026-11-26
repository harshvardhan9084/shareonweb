import type { AppArticle } from '@/lib/article-types'

// Long-form articles for the instant tools. Every fact here reflects the
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
      'Image Toolkit is one workbench for the six things images always need: compress to a target size or quality, convert between PNG, JPEG and WebP, resize by pixels or percentage, crop to an absolute pixel box, rotate in quarter turns, and mirror horizontally or vertically — in batches.',
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
        heading: 'Crop, rotate and flip — the framing jobs',
        paragraphs: [
          'Crop takes an absolute pixel box — left, top, width, height — and applies it to every image in the batch, clamped to each image\u2019s own bounds so one setting always yields a valid rectangle per file. The clamping is stated, not silent: a box wider than the image crops to the image, it does not error the batch.',
          'Rotate is quarter turns only — 90°, 180°, 270° — because quarter turns move pixels without resampling them: no blur, no interpolation softening, exactly the pixels you dropped in, rearranged. 90° and 270° swap the width and height, and the output preview reports the new dimensions.',
          'Flip mirrors horizontally, vertically or both (both at once is a 180° rotation, and the page says so rather than pretending they differ). Together with crop, the framing jobs cover the pre-processing every screenshot, scan and marketplace photo needs before it is useful.',
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
          'Crop a screenshot to the region that matters before pasting it into docs',
          'Straighten a scanned page a quarter turn and mirror it the way it needs',
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
      'QR Studio takes codes from gimmick to production. Five payload types — links, plain text, Wi-Fi join codes, vCard 3.0 contact cards and UPI payment intents — plus the design controls that decide whether a code actually scans in the real world: error correction, quiet zone, contrast checking and an optional center logo with honest guidance.',
      'Every code is drawn on this device, and the raw encoded payload is always visible before you print. That combination is the difference between a code that works at the cash counter and one that fails in front of a customer: you can verify exactly what is encoded, at exactly the size it will print.',
    ],
    sections: [
      {
        heading: 'Payloads that follow the specs',
        paragraphs: [
          'Wi-Fi mode builds the standard network string with proper escaping of semicolons, commas, colons and quotes — the characters that quietly break naive Wi-Fi codes on picky phone cameras. vCard 3.0 packs name, organization, title, phone, email, website, address and a note so the scan lands in contacts as a person, not a paragraph of mangled text.',
          'UPI mode emits the standard upi://pay intent that GPay, PhonePe, Paytm and bank apps on both Android and iOS understand: payee VPA, display name, an optional fixed amount in INR, and a note that lands in the payment record. Shops print one code with the amount blank for counter payments, or fixed-amount codes for specific products.',
          'Link mode adds the https:// scheme if you leave it out, because bare domains scan into some camera apps as plain text instead of opening a browser.',
        ],
      },
      {
        heading: 'The design controls that matter',
        paragraphs: [
          'Error correction is a real choice: L survives 7% damage, M 15%, Q 25% and H 30%. A center logo covers modules, so the studio warns you when a logo is paired with L or M — the code may simply not scan — and offers the switch to H in one click.',
          'Contrast is checked continuously against the WCAG luminance formula: below 3:1 you get a warning before the code goes to the printer, not after a customer shrugs at their phone. The quiet zone — the white border scanners rely on — is adjustable from 0 to 4 modules, with 2 as the safe default.',
          'Transparent-background codes are supported for overlays on packaging and screens; the contrast check then assumes paper white, which is what a transparent PNG will print onto in practice.',
        ],
      },
      {
        heading: 'Batch export for real deployments',
        paragraphs: [
          'Table tent numbers, locker labels, order links, table menus: usually you need a hundred codes, not one. Batch mode takes one payload per line — links or text — renders each at your chosen size and settings, and hands you a ZIP of sequentially named PNGs. It runs at local renderer speed, capped at 200 codes per run, and nothing about the batch touches a server.',
        ],
      },
      {
        heading: 'Verify before you print',
        paragraphs: [
          'The raw payload string is shown under the preview at all times, with a copy button. For payment and Wi-Fi codes this matters: you can confirm the VPA, the amount and the note exactly as a phone will read them. The Scan tab (camera or image upload) decodes real-world codes too, so you can round-trip a printed sheet before ordering a thousand stickers.',
          'Static codes like these are permanent by construction. The "editable" QR codes on marketing sites encode a redirect the vendor controls — when the subscription lapses, the poster goes dark. A code built here answers to nobody.',
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

  // -------------------------------------------------------------------- diff
  diff: {
    lede: [
      'Text Diff compares two texts and shows exactly what changed: lines added, lines removed, and the words that moved inside edited lines. It runs a real patience diff \u2014 the same strategy as git diff --patience \u2014 in this tab as you type, in a side-by-side or inline view, and it can export the result as a standard unified patch that applies with git apply or patch.',
      'The algorithm is the interesting part. A naive line diff struggles the moment files get rearranged: whole sections show as deleted and re-added in red and green walls. Patience diff takes the lines that appear exactly once on both sides as anchors, keeps the ones whose order agrees (the longest increasing subsequence), and diffs only between anchors \u2014 so moved blocks stay recognizable as blocks, and the fallback for hopelessly different segments is a plain block replace, bounded so it can never blow up.',
    ],
    sections: [
      {
        heading: 'How the pairing works',
        paragraphs: [
          'The diff is computed on normalized lines according to your options \u2014 ignore case, ignore whitespace, ignore blank lines \u2014 but always displayed as your original text. Each deletion run is paired with the insertion run that follows it, so a rewritten line shows as one edited row instead of a separate remove and add; remaining unpaired lines show as pure additions or deletions. Live counters keep score: added, removed, unchanged and a similarity percentage, all recomputed on every keystroke.',
          'Edited rows get a second, word-level pass: the two versions of the line are tokenized into words and punctuation, diffed with the same patience strategy, and the exact changed words are highlighted \u2014 so you see that a line changed because one word moved, without reading both versions letter by letter.',
        ],
      },
      {
        heading: 'The patch export, and why it is trustworthy',
        paragraphs: [
          'The Copy patch and Download .patch buttons emit a standard unified diff: file headers, @@ hunk headers with correct start-and-count math, three context lines around each change, and proper \\ No newline at end of file markers when a side lacks the trailing newline. Hunk starts are computed the way the patch(1) format requires \u2014 an insertion-first hunk points at the line before which content lands \u2014 which is exactly where hand-rolled diff exporters usually go wrong.',
          'This exporter was validated against git apply itself: across hand-built edge cases (insertions and deletions at both ends, multiple hunks, repeated identical lines, files with and without trailing newlines) and a randomized fuzz round, every generated patch applied cleanly and reconstructed the target file byte for byte. When two texts differ only in the trailing newline, the patch says so with the marker instead of claiming the files are identical.',
        ],
      },
      {
        heading: 'When it beats opening a terminal',
        paragraphs: [
          'The moment is familiar: someone pastes two versions of a config, a paragraph, a JSON file, a contract clause, and asks what changed. Installing or reaching for git is heavier than the question; screenshotting two texts side by side answers nothing. This page answers it as you paste, on any device, including a phone.',
        ],
        list: [
          'Compare two versions of a config file before you overwrite the live one',
          'See which sentences moved in a rewritten document or contract clause',
          'Check a teammate\u2019s claimed change against the actual before/after',
          'Produce a patch a colleague can apply with git apply, without a git repo',
        ],
      },
      {
        heading: 'What happens to your texts',
        paragraphs: [
          'Nothing. The diff runs in this tab on text the browser already holds; there is no upload code on the page at all, so the network panel stays empty except for the page itself. Paste source code, keys in config files, unpublished prose \u2014 nothing leaves the device, and nothing is stored once the tab closes.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'The cap is one million characters per side, stated rather than discovered; beyond it the page says so instead of pretending. The ignore options change what counts as equal \u2014 the displayed text is always your original. And a patience diff is correct but not always minimal: where git\u2019s default might find a shorter edit script in pathological cases, this one finds the more readable one, which is the point.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------- uuid
  uuid: {
    lede: [
      'ID Generator makes the three identifiers modern systems actually exchange \u2014 UUID v4, UUID v7 and ULID \u2014 from the browser\u2019s own crypto engine, in bulk, with an inspector that decodes any of them back into their parts. Open the page and ten IDs are already on screen; change the format or count and they regenerate instantly.',
      'The three formats answer different needs. UUID v4 is pure randomness \u2014 122 bits shaped by the RFC\u2019s version and variant bits \u2014 and fits anywhere uniqueness is enough. UUID v7 (RFC 9562) embeds a 48-bit Unix-millisecond timestamp ahead of the random bits, so IDs sort by creation time, which is why databases increasingly prefer it for primary keys. ULID packs the same timestamp idea into 26 Crockford-base32 characters with 80 random bits behind it, plus an optional monotonic mode.',
    ],
    sections: [
      {
        heading: 'Where the randomness comes from',
        paragraphs: [
          'Every bit of randomness is drawn from crypto.getRandomValues, the browser\u2019s cryptographically secure random source \u2014 not Math.random, which is predictable and has burned real applications that treated its output as unique. For v4 the sixteen random bytes are then shaped: six bits are overwritten with the version (4) and variant (10xx) markers that make a UUID decodable, leaving 122 random bits \u2014 the reason two v4 IDs collide with roughly one chance in 5.3 \u00d7 10\u00b3\u2076.',
          'v7 and ULID spend some of that budget on time. The first 48 bits are the current Unix millisecond count, big-endian, so lexicographic order is chronological order; the remaining bits stay random. That is the whole trick behind \u201csortable IDs\u201d: a database index on the ID column becomes an index on creation time for free, and page splits in B-trees stop thrashing because new rows always land on the right edge.',
        ],
      },
      {
        heading: 'Monotonic ULIDs, honestly implemented',
        paragraphs: [
          'Two ULIDs generated in the same millisecond normally differ only in their random halves, so their sort order is a coin flip. Monotonic mode fixes exactly that: within the same millisecond the generator increments its random part instead of re-rolling it, making every ID strictly greater than the previous one \u2014 the guarantee database inserts want when rows arrive faster than the clock ticks. The increment lives in an 80-bit space, so the counter cannot realistically wrap.',
        ],
        list: [
          'UUID v4 \u2014 uniqueness anywhere, no clock involved',
          'UUID v7 \u2014 time-ordered per RFC 9562, the modern database default',
          'ULID \u2014 26 characters, Crockford base32, no I/L/O/U to misread',
          'Monotonic ULID \u2014 strictly increasing even inside a tight loop',
        ],
      },
      {
        heading: 'The inspector: what an ID actually carries',
        paragraphs: [
          'Paste any UUID or ULID and the inspector reads its structure instead of checking a regex. For UUIDs it reports the version nibble \u2014 v1 through v8, each named \u2014 and the variant bits, and for time-based versions it decodes the embedded timestamp into a real date: v1\u2019s 60-bit Gregorian ticks, v7\u2019s Unix milliseconds. For ULIDs it validates the 26 characters against the Crockford alphabet (rejecting I, L, O and U with the reason) and splits the timestamp part from the randomness part.',
        ],
      },
      {
        heading: 'What happens on this page',
        paragraphs: [
          'Everything runs in this tab: the crypto engine generates the bytes, the formatter shapes them, and the inspector decodes what you paste \u2014 there is no upload code on the page at all. Generated IDs are not secrets, but they are still never sent anywhere; close the tab and nothing remains.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------- convert-units
  'convert-units': {
    lede: [
      'Unit Converter is three converters sharing one page. The unit side carries 73 units across ten categories — length, mass, temperature, volume, data, speed, area, time, pressure, energy — and converts through a table of exact published factors rather than rounded chart values. The number side switches an integer between bases 2 and 36 with bit length, byte length and two\u2019s-complement views, and the Roman side reads numerals under the strict classical grammar, rejecting forgeries with the precise rule they break.',
      'Everything is computed in this tab: no session, no account, no upload code at all. Type in either field and the other side answers as you type. An \u201cexactly\u201d note appears only when the ratio between two units genuinely terminates — silence is honest where a wrong \u201cexactly\u201d is not.',
    ],
    sections: [
      {
        heading: 'Why a factor table beats a screenshot',
        paragraphs: [
          'A screenshot of a conversion chart gives one pair at a time, pre-rounded; a search box answers like a fortune cookie, confident and unsourced. A factor table converts every pair in a category with one multiplication: the value times the from-unit\u2019s factor, divided by the to-unit\u2019s. Because the factors are definitions rather than measurements — the international inch is exactly 0.0254 m, the avoirdupois pound exactly 0.45359237 kg, the US gallon exactly 231 cubic inches — the result inherits their exactness, and the page can prove a relation like 1 in = 2.54 cm instead of merely asserting it.',
          'Precision is a control, not a promise: 4 to 12 significant digits, 7 by default, with exponential notation beyond 1e15 where plain decimals would sprawl. Temperature is deliberately not in the factor table at all — degrees are affine, not proportional, so °F = °C × 9/5 + 32 is special-cased with its own formulas. The classic converter bug of multiplying Celsius by 1.8 and calling it Fahrenheit cannot happen here.',
        ],
      },
      {
        heading: 'The kilobyte mess, with both families labeled',
        paragraphs: [
          'Data units are the one place where two honest systems collide. Decimal units step by 10³ — KB, MB, GB, TB — and that is what drive makers quote. Binary units step by 2¹⁰ — KiB, MiB, GiB, TiB — and that is what memory is actually built from and what Windows reports, mislabeled, as \u201cMB\u201d. Neither family is wrong; they disagree by about 2.4% at gigabyte scale and 7% at terabyte scale, which is why a \u201c1 TB\u201d drive shows up as 931 GiB.',
          'The table keeps both families side by side with their labels intact, so a spec sheet and an OS readout can be compared without a detour through a forum thread — and the exact line states the gap precisely: 1 KB = 0.9765625 KiB.',
        ],
      },
      {
        heading: 'Bases, and what two\u2019s complement means',
        paragraphs: [
          'The rows for bases 2, 8, 10 and 16 are live: edit any one and the others follow, plus a fifth row that speaks any base from 2 to 36. The guard is stated rather than hidden — values beyond 2^53 − 1 (9,007,199,254,740,991) are refused, because plain double-precision numbers stop being exact there, and fractional input is declined with a note that fractional bases are not supported either. Invalid digits are named, not coerced.',
          'Below the rows the page shows what a computer sees: bit length, byte length, and the two\u2019s-complement view in signed 8/16/32/64-bit widths — how negative integers are actually stored, where −1 becomes FF, FFFF, FFFFFFFF. A value that does not fit a width says how many signed bits it needs instead of wrapping silently; the 64-bit view itself is built with string arithmetic so it stays exact for every value the guard allows.',
        ],
      },
      {
        heading: 'Roman grammar, privacy, and the honest limits',
        paragraphs: [
          'Roman numerals are a grammar, not an alphabet, and the parser enforces it: thousands, then hundreds (CM, CD, D, C), then tens (XC, XL, L, X), then ones (IX, IV, V, I), each place once. IIII, VX and IC are rejected with the precise rule they break, never coerced into a number. The range stops at 3999 — MMMCMXCIX — because classical notation has no symbol above M, and plain text cannot carry the vinculum bar that meant ×1000.',
          'Privacy needs one line: there is no upload code on this page, so nothing can be sent anywhere. The limits are stated too — double-precision arithmetic is trustworthy to roughly 15 significant digits, bases stop at 2^53 − 1, Roman numerals stop at 3999 — and the page says so out loud instead of letting you discover each one the hard way.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ lorem
  lorem: {
    lede: [
      'Placeholder Text Studio builds the filler text every wireframe, mockup and CMS migration needs: Lorem ipsum the way typesetters have used it since the 1500s, or plain-English wireframe copy for prototypes that go to people who find Latin distracting. Paragraphs, sentences, bare words or bullet lists, from one to a few thousand words, rebuilt as you change any setting.',
      'The defining feature is the seed. The generator hashes the seed string with xmur3 and drives every word pick with mulberry32, so the same seed with the same settings always rebuilds the exact same text. A wireframe’s filler survives a refresh, a teammate who re-enters your seed sees precisely what you saw, and nothing needs to be stored anywhere to make that happen.',
    ],
    sections: [
      {
        heading: 'How the generator builds a sentence',
        paragraphs: [
          'Each sentence draws 6–24 words from the corpus, sprinkles a conjunction every so often so the rhythm does not read as a list, and inserts a mid-sentence comma in roughly three out of five sentences. Paragraphs are 3–7 such sentences. The classic “Lorem ipsum dolor sit amet, consectetur adipiscing elit” opening is a toggle, applied to the front of the first paragraph exactly the way print shops have done it for centuries.',
          'The Latin corpus is the standard Lorem Ipsum vocabulary — the real words the traditional filler is built from — and the plain-English corpus is a hand-written bank of neutral interface vocabulary: sections, headers, controls, samples. Neither is scraped from anywhere, and neither can contain anything you would have to fact-check, which is the entire point of filler text.',
        ],
      },
      {
        heading: 'When seeded filler matters more than random filler',
        paragraphs: [
          'Random filler fights collaboration. A teammate reviews a mockup in the morning, the filler changed by lunch, and now “the second paragraph” means something different on every screen. A seed pins the text: screenshot it, review it, file bugs against it, and the same seed reproduces the same words on every machine that opens this page.',
          'It also matters for testing. A layout that overflows with a 40-word paragraph keeps overflowing with the same 40-word paragraph every time you re-render, which turns an intermittent visual bug into a reproducible one.',
        ],
      },
      {
        heading: 'What happens to your settings',
        paragraphs: [
          'Nothing — there is nothing to store. The text is computed from your settings and seed on every render, in this tab, with no upload code on the page. The word, character and paragraph counters are computed from the same output, and the HTML mode strips tags before counting so the numbers reflect the visible text.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'The HTML mode emits one <p> element per paragraph, one per line — paste it straight into markup or a CMS block. The bullet-list shape emits one short sentence per item, which suits feature lists and menu stubs better than paragraph filler does.',
          'Counts cap honestly: 50 paragraphs, 100 sentences or list items, 2,000 words per run. That is more than any single screen needs; the seed means you can always regenerate the same text again tomorrow instead of hoarding it.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------- fake-data
  'fake-data': {
    lede: [
      'Fake Data Studio generates test records that look real enough to exercise a form and are guaranteed never to belong to anyone: names, usernames, e-mails, phone numbers, street and city, company, job title, birthday with age, IPv4, user agent and hex color, across six name locales, up to 500 records per run, exportable as CSV or JSON.',
      'Every value stays inside officially reserved space by construction. E-mails use only the IANA-reserved example.com, example.net and example.org domains. North-American phone numbers use the 555-01XX exchange that the numbering plan reserves for fiction. Other locales’ numbers carry a leading digit that makes them invalid for international dialing. IPv4s come from the RFC 5737 documentation blocks that are never routed on the public internet.',
    ],
    sections: [
      {
        heading: 'Why reserved ranges beat “just make something up”',
        paragraphs: [
          'A made-up phone number can ring. A made-up e-mail can belong to someone. Test data that leaks into a demo, a screenshot or a staging database is the classic way a developer accidentally doxxes a stranger — and the reason proper test suites demand obviously-fake values. Reserved space solves this at the protocol level: example.* can never receive mail, 555-01XX can never complete a call, documentation IPs can never route. A value drawn from those ranges is fake not by promise but by impossibility.',
          'The trade-off is honesty about realism: an example.com address will not exercise an e-mail validation rule the way a real provider domain does, and that is exactly what you want in a test dataset — the field works, and nobody can be harmed by it.',
        ],
      },
      {
        heading: 'The seed makes bugs reproducible',
        paragraphs: [
          'The generator is deterministic: locale, field set, count and seed hash into the same stream of picks every time. A bug report that says “row 14 of seed ktv29x breaks the form” can be replayed exactly — same name, same address, same birthday — instead of chasing a shape of data you can no longer produce. Roll the dice only when you want a new shape of data, not when you want the same one back.',
        ],
      },
      {
        heading: 'Six locales, twelve fields',
        paragraphs: [
          'Name banks cover English, German, French, Spanish, Indian and Japanese (romaji) — first and last names, street names, city lists and locale-shaped postcodes, from five-digit ZIPs to Indian PIN codes that never start with 0 or 9 and Japanese NNN-NNNN codes. Company names take a locale-appropriate legal suffix: LLC, GmbH, SAS, S.L., Pvt Ltd or K.K.',
          'Every field is a switch, and the table and exports show exactly the toggled set — so a spreadsheet that needs only names and e-mails exports two columns, not twelve. The table preview renders the first 25 rows; the CSV and JSON downloads always carry the full run.',
        ],
      },
      {
        heading: 'What happens to the data',
        paragraphs: [
          'It is computed in this tab from the seed and settings, rendered into the table, and downloaded straight to your disk when you export. There is no upload code on the page; the browser’s network tab will show nothing but the page itself. Close the tab and it is gone — the seed can rebuild it identically whenever you need it again.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------- css-tools
  'css-tools': {
    lede: [
      'CSS Style Studio is three generators under one roof — gradient, box-shadow and border-radius — each with a live preview and a formatted CSS block underneath. The rule that makes it useful: the preview element is styled by the exact same state that produces the copied CSS, so what you see is byte-for-byte what you paste into your stylesheet.',
      'Everything runs in this tab. There is no account, no gallery of other people’s “styles” to browse, and no upload — just the controls, the preview, and the CSS that matches them.',
    ],
    sections: [
      {
        heading: 'Gradients, with as many stops as the design needs',
        paragraphs: [
          'Linear, radial and conic fills with up to eight color stops, each with its own position slider and the browser’s native color picker. The angle dial drives linear gradients; radial and conic gradients get a center point you can move anywhere on the surface, and conic adds a start angle for sweeps that do not begin at twelve o’clock. Five presets — Sunrise, Forest, Dusk, Ripple and a full color wheel — give you a starting point instead of a blank canvas.',
          'The emitted CSS uses the modern one-line background-image syntax browsers have shipped for years, with stops in sorted order and the percentages explicit, so the output reads the same way a hand-written declaration would.',
        ],
      },
      {
        heading: 'Shadows as layers, not a single blur',
        paragraphs: [
          'Real interface shadows are composites: a tight contact shadow plus a wide ambient one, or a zero-blur ring layered over depth. The generator lets you stack up to six layers, each with offset X and Y, blur, spread, a hex color with alpha and the inset flag. The layer list writes the CSS list in the same order — first layer on top, exactly as the cascade paints it — and presets like “Ring + shadow” show the composition technique in one click.',
        ],
      },
      {
        heading: 'Radius corners, linked or separate',
        paragraphs: [
          'Four corner sliders cover the classic card work, and the link-all toggle turns any adjustment into a uniform radius. Shapes like Leaf (two opposite corners round, two tight) and Blob (four different values) demonstrate what asymmetric corners do to a box. When the corners differ, the copied CSS carries the TL TR BR BL comment so the next person to read the stylesheet knows the order.',
          'One deliberate difference: the preview clamps corners to 100 px so extreme values stay visible on the screen, while the copied CSS keeps the true numbers — the comment under the preview says so rather than letting the clamp surprise you.',
        ],
      },
      {
        heading: 'Privacy and limits',
        paragraphs: [
          'There is nothing to upload: the controls, the preview and the output are one React state, computed in this tab. The studio aims at the design-the-component moment — for a full design system you outgrow any single page, but for “what does this shadow actually look like?” it is faster than editing a stylesheet and refreshing.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------- meta-tags
  'meta-tags': {
    lede: [
      'Meta Tag Studio builds the head snippet that decides how a link looks everywhere it is shared — the search-result title and description, the Open Graph card Facebook, LinkedIn and Slack draw, and the X card — with live previews of all three rendering from the same fields that produce the copied HTML.',
      'The output is escaped and ordered: quotes and angle brackets in a title cannot break the tag structure, because every attribute value passes through HTML escaping before it lands in the snippet. Paste it into your page’s head and the platform crawlers read exactly what the previews showed.',
    ],
    sections: [
      {
        heading: 'The three previews, and why they clamp differently',
        paragraphs: [
          'The search preview clamps its title near 60 characters and its description near 160 — the approximate cut a results page applies before truncating with an ellipsis. The X and Open-Graph cards have their own geometry: image-led, domain on top, two description lines. Watching all three at once is the fastest way to write copy that fits every surface instead of perfecting one and breaking the others.',
          'Length guidance runs as you type: titles measure against the 50–60 character sweet spot, descriptions against 120–158, with the exact distance named — “12 over the limit”, “8 below the sweet spot”, “in the sweet spot” — instead of a vague red bar.',
        ],
      },
      {
        heading: 'What the snippet actually contains',
        paragraphs: [
          'Title and description, the canonical link, robots policy, theme color, then the Open Graph set — og:title, og:description, og:url, og:image when set, og:type, og:site_name, og:locale — then the X card tags. Empty fields emit nothing rather than empty tags: a crawler never sees an og:image pointing at nothing. og:type and the card flavor are dropdowns with the values platforms actually parse, and the locale list covers the seven locales the page can label.',
        ],
      },
      {
        heading: 'Escaping, and why “5\\" speakers” cannot break the page',
        paragraphs: [
          'Attribute values sit inside double quotes, so an unescaped quote in a title would terminate the attribute early and corrupt the tag — the classic way a hand-edited head silently breaks a share preview. Escaping turns & into &amp;, \" into &quot;, and angle brackets into entities; browsers read the entities back as the original characters, so the text displays correctly everywhere it is shown.',
        ],
      },
      {
        heading: 'Privacy and honest limits',
        paragraphs: [
          'Nothing is fetched and nothing is submitted: the previews are drawn from your own fields inside this tab, no validator service is called, and the browser’s network tab shows nothing but the page. The honest limit is that a preview approximates the platform’s live rendering — font, country and A/B tests shift real cards slightly — but the structural truth (what is set, what clamps, what falls back) is exactly what the snippet will do.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- barcode
  barcode: {
    lede: [
      'Barcode Studio renders scannable Code 128 and EAN-13 barcodes in this tab, as crisp vector SVG or a print-safe 3× PNG. Code 128 for any ASCII text — package codes, SKUs, serials, asset tags. EAN-13 for retail products, with real checksum discipline: 12 digits get the mod-10 check digit computed and appended, 13 are verified, and a mismatch names the expected digit instead of handing you a barcode scanners will reject.',
      'The encoding runs on JsBarcode, the engine libraries and POS systems have relied on for a decade, into vector SVG you can size after download without blur. There is no lookup service, no account and no watermark — the only network traffic is the page itself.',
    ],
    sections: [
      {
        heading: 'The two formats, and when each is right',
        paragraphs: [
          'Code 128 is the logistics workhorse: variable length, full ASCII 0–127, self-checking, and compact for short strings. It is the right choice for inventory labels, serial numbers, membership cards and internal codes — anything where you control both ends of the scan.',
          'EAN-13 is the worldwide retail standard: exactly 13 digits, printed on consumer packaging, scanned at every till. Its structure is strict — a leading system digit, manufacturer and product codes, and a final check digit computed from the rest — which is why the page verifies it rather than drawing whatever was typed: a wrong check digit means a real scanner rejects the code at the point of sale.',
        ],
      },
      {
        heading: 'Check digits, computed and explained',
        paragraphs: [
          'The EAN-13 check digit is a mod-10 weighting: odd positions count once, even positions count three times, and the check digit makes the total a multiple of ten. Type 12 digits and the page computes the thirteenth and shows it; type 13 and it verifies, naming the exact expected value on failure. Non-digit input reports its character position — the page refuses to encode garbage silently, because a barcode’s only job is to scan correctly the first time.',
        ],
      },
      {
        heading: 'Sizing for the destination',
        paragraphs: [
          'Bar width (1–4×) sets the module size; height sets the bar length; the human-readable value underneath is optional but every retail barcode must carry it. For print, download the SVG — vector stays sharp at any size, and thermal label software accepts it directly. For slides and documents, the PNG export renders at three times the preview size over a white underlay, which keeps contrast at the level scanners expect.',
          'One honest limit: Code 128 is ASCII-only, so emoji, curly quotes and accented letters are reported with their exact position instead of being mangled into bars that will not scan. Replace them and the code renders.',
        ],
      },
      {
        heading: 'Privacy and scope',
        paragraphs: [
          'The barcode is drawn from your text in this tab — no account, no lookup service, nothing sent anywhere, which you can confirm in the network tab. What this page is not: a label-design tool or a batch generator for a warehouse. It is the make-one-good-barcode moment, done properly — correct encoders, honest validation, print-clean output.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------- calculator
  calculator: {
    lede: [
      'Calculator Studio evaluates real expressions — 12 × (3 + 4) ÷ 5, sin(30) + log(1000), 7! ÷ 2 — with a hand-written parser instead of a JavaScript eval, which is the difference between a calculator and a security rumor. Basic mode is the everyday pad; Scientific mode adds trigonometry with a DEG/RAD switch, logarithms, powers, roots, factorials and the π and e constants.',
      'Everything answers as you type, commits to a scrollable tape you can reuse, and runs entirely in this tab: no eval(), no server round-trip, and a specific error message when something is wrong — division by zero, an unbalanced parenthesis, an unknown word — rather than a silent NaN.',
    ],
    sections: [
      {
        heading: 'Why a real parser matters',
        paragraphs: [
          'The usual web calculator wraps JavaScript’s eval() around your input, which is exactly as safe as it sounds and fails with "NaN" for anything malformed. This page tokenizes the expression, applies the shunting-yard algorithm to compile it to reverse-polish notation — the same pipeline 1970s HP calculators ran — and evaluates the RPN on an explicit stack. Operator precedence, right-associative powers, unary minus after an operator or opening parenthesis, and postfix factorial and percent all come out of that algorithm rather than from string hacks.',
          'The practical payoff is honesty. An unbalanced parenthesis is caught and named; two numbers without an operator between them are called out; "2(3+4)" asks for the × the math teacher would ask for; a negative factorial or a square root of a negative number explains the domain problem instead of printing NaN.',
        ],
      },
      {
        heading: 'The scientific pad',
        paragraphs: [
          'Trigonometry runs through a DEG/RAD switch, and the default is DEG because that is what most people reaching for a calculator mean. The inverse functions return values in the selected unit as well, so asin(0.5) reads 30 in degree mode. ln and log are natural and base-10 respectively — the convention calculators have used forever — and exp, sqrt, abs, x^y, n!, π and e round out the set.',
          'The keys are laid out for typing flow: functions insert their opening parenthesis, so sin( becomes sin(...) and you fill in the argument; the expression input stays a real text field, so keyboard warriors can type everything, with Enter committing and Escape clearing.',
        ],
      },
      {
        heading: 'Memory, ANS and the tape',
        paragraphs: [
          'The memory row works like the hardware calculator in a desk drawer: MS stores the current result, MR recalls it into the expression, M+ and M− add or subtract the current result to and from the stored value, and MC clears it. ANS inserts the last committed answer — the chain "compute a, then multiply by b, then subtract c" never needs retyping.',
          'Every committed calculation lands on the tape, newest first, with the expression and the result. Tap any row to reuse its result as the start of the next expression. The tape lives in page memory — close the tab and it is gone, which is the honest version of "no history is stored".',
        ],
      },
      {
        heading: 'What it will not do',
        paragraphs: [
          'No graphing, no symbolic algebra, no equation solving — those are different tools wearing a calculator costume. No arbitrary precision beyond JavaScript’s 64-bit floats, stated rather than hidden: results carry 12 significant digits and switch to exponential notation past 10^15. And no implicit multiplication — 2π must be typed 2 × π — because the parser would rather ask than guess.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------- percentage
  percentage: {
    lede: [
      'Six percentage calculators that people search for by name — what is X% of Y, X is what percent of Y, percent change, discount, tip with splitting, sales tax and VAT — on one page because they share one idea. Every result shows the formula that produced it, so the answer can be checked on sight instead of trusted blindly.',
      'The math runs in this tab as you type. Nothing is submitted, stored or logged; the only thing the page remembers is the tab it lives in.',
    ],
    sections: [
      {
        heading: 'The three core questions',
        paragraphs: [
          '"What is X% of Y" multiplies (X ÷ 100) × Y and also shows Y minus and plus that amount, which covers the discount-surcharge pair most shopping questions actually want. "X is what percent of Y" divides and scales to 100, declining to answer when Y is 0 — a share of zero has no meaning, and a page that invents one is lying. "Percent change" uses (New − Old) ÷ |Old| × 100, with the absolute value deliberately in the denominator so a fall from −40 to −20 reads as the 50% increase it is; the direction is spelled out ("increase" or "decrease") and a change from exactly zero is reported as undefined.',
          'Those three are the grammar of every other percentage question. Once you see the formula printed under each card, the page stops being an oracle and becomes a shortcut.',
        ],
      },
      {
        heading: 'Discount, tip and tax — the shopping trio',
        paragraphs: [
          'Discount mode takes the price and the percent off and shows both what you pay and what you save — the saved amount is the number people argue about at the till. Tip mode adds a people count: tip, total, and each person’s share, with a round-up switch that rounds the tip to the next whole unit before splitting, the restaurant-friendly order of operations. Tax mode works in both directions: add a rate to a net price, or flip "extract from gross" and pull the tax back out of a price that already includes it — the backwards calculation VAT invoices and reimbursement forms actually need.',
          'Every mode recomputes live and every card copies with one tap, because these numbers usually travel: into a chat, an expense row, a note to who owes what.',
        ],
      },
      {
        heading: 'Why the formulas are shown',
        paragraphs: [
          'Percentage answers are the most confidently wrong numbers in daily life — a "20% off plus an extra 10%" is not 30% off, and successive percentage changes do not add. Showing the formula is the cheapest way to teach the difference: you can see that the discount card computes a single percent off, not a compounding chain, and reach for the modes in sequence when the question really is sequential.',
        ],
      },
      {
        heading: 'Scope and privacy',
        paragraphs: [
          'No currency conversion, no compounding interest, no inflation math — the loan studio handles rates over time, and mixing the two would blur both. This page is the arithmetic you do at the counter and in the spreadsheet row: instant, formula-labeled, and computed nowhere but your own device.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------- date-calculator
  'date-calculator': {
    lede: [
      'Date Math Studio answers the four date questions everyone asks: how old is someone exactly, how long between two dates, what date is N days/months/years away, and how many working days is that. The arithmetic is calendar-exact — months borrow from the real length of the month before, Jan 31 plus one month lands on Feb 28 or 29 rather than a phantom March 3rd, and business days are counted one day at a time instead of approximated with a 5/7 ratio.',
      'Dates are built as local-time Y/M/D triples from the picker, never parsed from strings, which is what keeps the UTC off-by-one bugs out. Impossible dates like February 30 are rejected with a message rather than silently rolling over to March.',
    ],
    sections: [
      {
        heading: 'Age, counted the way birthdays feel',
        paragraphs: [
          'Age mode gives years, months and days — with the month borrow taken from the actual previous month’s length, so someone born on Jan 31 is 0 months and change older on Feb 28, not "-2 days". The totals run in both directions: months, weeks-plus-days, days, and hours-and-minutes from the actual timestamps for the "I have been alive for two billion seconds" moment. The next-birthday countdown lands on Feb 28 for Feb 29 birthdays in non-leap years, and says so.',
        ],
      },
      {
        heading: 'Differences, and the end-day question',
        paragraphs: [
          'Difference mode measures the span between two dates and settles the booking question with an explicit toggle: exclude the end day (default) counts Jan 1 → Jan 2 as one day, the hotel-night convention; include it and the same span is two days, the way a Monday-to-Friday job is five days. The weekday of each endpoint is shown, because "how long until Friday" and "how long until the 14th" are the same question wearing different clothes.',
          'If the second date is earlier than the first, the page swaps and says it swapped — a negative age is a typo, not a result.',
        ],
      },
      {
        heading: 'Adding, subtracting and the month-end clamp',
        paragraphs: [
          'Add/Subtract shifts a date by any mix of years, months, weeks and days. Months use the clamp convention every serious calendar library uses: the day-of-month is capped at the real end of the target month, so Jan 31 + 1 month is Feb 28/29 — the date people mean when they say "a month from now". A note under the result names the clamp when it fires.',
          'Business days walk the calendar one day at a time, skipping weekends, in either direction — an exact count for "ten working days from Friday", not a rounded guess. Public holidays are deliberately not assumed: they differ by country, company and year, and a calculator that guesses them produces confident wrong numbers. Count to the holiday and add the days it costs.',
        ],
      },
      {
        heading: 'Countdown and privacy',
        paragraphs: [
          'Countdown ticks live toward a future date — days, hours, minutes, seconds — updating every second while the tab is open. Everything is computed on this device in its local calendar: no server call, no storage, no timezone surprises, because the date never leaves the tab it was typed into.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------- bmi
  bmi: {
    lede: [
      'Body Metrics Studio computes the four numbers behind "bmi calculator" and "how many calories should I eat" searches: BMI with the WHO classification band and the healthy weight range for your height, BMR and TDEE with calorie targets, ideal weight by four published formulas, and body fat by the US Navy circumference method with the Deurenberg estimate as a cross-check.',
      'What makes this page different is not the math — the formulas are public — but the labeling: every result names its formula, the four ideal weights are shown side by side including their disagreement, and a standing note says plainly that these are population estimates, not a diagnosis.',
    ],
    sections: [
      {
        heading: 'BMI, with the honest band around it',
        paragraphs: [
          'BMI is weight ÷ height², in metric or imperial, classified against the WHO bands from severe thinness to obese class III. The more useful number is usually next to it: the weight range that would put your height in the 18.5–24.9 band, and the distance from wherever you are to the edge of it. BMI’s limits are famous — it cannot see muscle from fat — and the page says so rather than pretending otherwise; it is a screen, not a verdict.',
        ],
      },
      {
        heading: 'Calories: BMR, TDEE and the targets',
        paragraphs: [
          'BMR comes from Mifflin-St Jeor — the equation clinical guidelines generally rate best for the general population — from weight, height, age and sex. TDEE multiplies it by one of five activity levels from sedentary (×1.2) to very active (×1.9), and the honest description of each level matters more than the multiplier: "desk job, little exercise" versus "hard daily training" decides the answer more than the formula does.',
          'The targets are the arithmetic of energy balance: TDEE − 500 for roughly half a kilo a week of loss, − 250 for the gentle version, + 500 for gain. They are stated as what they are — approximations of a process that varies person to person — not prescriptions.',
        ],
      },
      {
        heading: 'Four ideal weights, on purpose',
        paragraphs: [
          'Robinson, Miller, Devine and Hamwi are four published formulas built from the same height and sex inputs, and they disagree by several kilograms at many heights. Showing all four side by side — plus each in pounds — is a small honesty with a big effect: it makes visible that "ideal weight" is a range of conventions, not a fact, and the BMI-derived healthy range is usually the most defensible reference to keep.',
        ],
      },
      {
        heading: 'Body fat and the measurement craft',
        paragraphs: [
          'The Navy method uses neck and waist circumferences (plus hips for the female formula) against height — typically within a few percent of a DEXA scan when the tape is used well. The page guards its inputs: implausible measurements produce a "check the numbers" message instead of a confident nonsense percentage. The Deurenberg estimate runs off BMI, age and sex and is labeled the rougher cross-check it is. Neither replaces a clinician; both travel well to a check-in conversation.',
        ],
      },
      {
        heading: 'Privacy',
        paragraphs: [
          'Every number is computed in this tab from what you typed. There is no account, no upload, no storage — your measurements never exist outside the device you typed them on, which is how body data should always be handled.',
        ],
      },
    ],
  },

  // --------------------------------------------------------------------- loan
  loan: {
    lede: [
      'Loan & Interest Studio answers the three money questions behind every "loan calculator" search: what does a loan cost per month (with the full amortization schedule to prove it), what does compounding build over time, and what monthly saving reaches a goal. The payment comes from the standard annuity formula, the schedule is simulated month by month, and every table exports as CSV.',
      'Nothing is submitted anywhere. There are no lender quotes, no lead forms, no data collection — the page is a calculator, not a funnel, and it says what its math cannot know instead of pretending.',
    ],
    sections: [
      {
        heading: 'The loan: EMI and the schedule behind it',
        paragraphs: [
          'The monthly payment is P·r·(1+r)ⁿ ÷ ((1+r)ⁿ − 1) — the annuity formula every amortizing loan uses — with r the monthly rate and n the months. Headline cards show the payment, total interest and total repaid before you have committed to anything, and the schedule table shows where every payment goes: interest is charged on the remaining balance first, the rest cuts principal, and the balance column walks to zero.',
          'The extra-payment field is the one that pays for itself: add an amount per month and the loan is simulated again — the result names the interest saved and the months cut, computed from the real shortened schedule rather than a rule of thumb. At a 0% rate the page switches to simple division rather than pretending the formula applies.',
        ],
      },
      {
        heading: 'Compound interest, simulated honestly',
        paragraphs: [
          'Compound mode starts from a principal, adds a monthly contribution at each month end, and applies the annual rate at your chosen frequency — annual, monthly or daily — with a year-by-year table of balance, contributed and interest-so-far. The contribution timing is stated: money lands at month end, which is when salaries do. Daily compounding applies a sliver of the rate 365 times a year and earns slightly more than monthly, which earns slightly more than annual — the table makes the difference visible instead of rounding it away.',
        ],
      },
      {
        heading: 'The savings goal, worked backwards',
        paragraphs: [
          'Goal mode solves the annuity formula in reverse: target, horizon and expected return become the required monthly contribution. If your starting amount alone reaches the target at that rate, the page says no contribution is needed — the honest answer to "am I already there?" — and at a 0% rate it divides the shortfall by the months.',
        ],
      },
      {
        heading: 'What the math cannot know',
        paragraphs: [
          'Fees, insurance, rate resets, taxes and prepayment penalties exist in real offers and not in this calculator — the closing note says so on every mode. Treat the numbers as the exact behavior of what you typed, and treat a lender’s offer document as the only binding truth. That is the correct amount of trust for a calculator: full, for arithmetic; zero, for predictions.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------- timer
  timer: {
    lede: [
      'Timer Studio puts the four timers people actually open a browser for on one page: a stopwatch with split laps, a countdown with a repeating local alarm, a pomodoro that cycles its own phases, and a tabata trainer that runs prepare/work/rest rounds. All four are timestamp-driven — the clock is recomputed from performance.now() on every tick, never accumulated — so a throttled background tab can delay the picture but cannot make the alarm late.',
      'The alarm is synthesized with WebAudio on this device (no audio file, works offline), a screen wake-lock is requested while running so phones stay awake, and the tab title mirrors the clock so a glance at the tab bar is enough.',
    ],
    sections: [
      {
        heading: 'Why timestamp clocks matter',
        paragraphs: [
          'The naive web timer counts setInterval fires, and browsers throttle background tabs to once per second or far worse — which is how a "10-minute" web timer quietly becomes eleven. Here, starting a timer records a timestamp; every frame recomputes elapsed time from the current timestamp; pausing banks the elapsed total. The interval only updates the picture. Switch tabs, lock the screen, come back — the next frame re-syncs to the truth, and the alarm fires at the computed instant, not at the throttled one.',
        ],
      },
      {
        heading: 'Stopwatch: laps that mean something',
        paragraphs: [
          'Laps record both columns athletes ask for: the split since the previous lap and the running total, at tenth-of-a-second precision from the high-resolution clock. The list is newest-first and clearable; the lap button lives next to pause so a single thumb can run the whole workout on a phone.',
        ],
      },
      {
        heading: 'Countdown, pomodoro, tabata',
        paragraphs: [
          'The countdown takes any h:m:s, one-tap presets for the common ones, and an alarm that repeats for twenty seconds until dismissed — with an optional auto-restart for kitchen rounds and call timers. Pomodoro runs configurable work, short-break and long-break lengths; after each work phase it advances automatically, and after every N completed rounds (four by tradition) it takes the long break, with a completed-round counter and a chime at each transition.',
          'Tabata builds a prepare phase, then work/rest cycles for a configurable number of rounds, announcing each phase change with a distinct beep pattern — the protocol’s 20/10 default is one tap away and every number is editable.',
        ],
      },
      {
        heading: 'Sound, wake-lock and privacy',
        paragraphs: [
          'The alarm is an oscillator, not a downloaded sound: instant, offline, and free of notification permissions. Browsers may hold audio until your first interaction — press anything once if the very first alarm is silent. The wake-lock keeps the screen on where the platform allows it; where it refuses, the timer still runs and the tab title carries the clock. Nothing about your timers leaves the device — there is no account to sync them to, by design.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- picker
  picker: {
    lede: [
      'Random Picker Studio is every "pick for me" tool on one page: a wheel of names that spins and decelerates like a real prize wheel, crypto-random number draws with a raffle mode, coin flips, dice of any shape, Fisher–Yates list shuffling, and team splits dealt the fair way. Every draw — wheel, number, coin, die, shuffle, team assignment — comes from crypto.getRandomValues with rejection sampling, which makes the distribution exactly uniform, not just "good enough".',
      'Math.random is never used, nothing is drawn on a server, and nothing about your list is remembered after the tab closes.',
    ],
    sections: [
      {
        heading: 'The wheel reads the geometry, not a script',
        paragraphs: [
          'The spin gets a random number of full turns plus a random angle and decelerates with an ease-out curve — the physics-shaped slowdown a real wheel has. The winner is the segment actually sitting under the pointer when it stops, read from the wheel’s rotation at rest. That ordering matters: a wheel that pre-picks and animates toward its pick can be biased by the animation. This one cannot be, because the animation has no destination until the physics stops.',
          'The remove-winner switch re-balances the wheel after each prize for successive draws — first prize, second prize, third — and the entries textarea stays the single source of truth.',
        ],
      },
      {
        heading: 'Numbers, coins and dice',
        paragraphs: [
          'Number mode draws between any bounds — negatives included — with a no-repeats raffle mode that removes each drawn number from the pool, an exact behavior for giveaway draws, and a sort switch for readable output. Asking for more unique numbers than the range contains gets a refusal instead of an infinite loop. Coin flips and dice rolls animate briefly and land on the same cryptographic source; dice run any count of d4 through d20 or a custom side count, with individual results and the total.',
        ],
      },
      {
        heading: 'Shuffles and teams',
        paragraphs: [
          'Shuffle runs Fisher–Yates — the algorithm whose every permutation is equally likely — over your pasted list, with an optional pick-K to extract a random subset in one step. Team splitter shuffles first, then deals round-robin into N teams, which guarantees balance to within one person per team: the playground-captain method with actual fairness under it. Team names are numbered, and re-splitting re-deals from scratch.',
        ],
      },
      {
        heading: 'Where the randomness comes from',
        paragraphs: [
          'crypto.getRandomValues is the browser’s cryptographic randomness source — the same one TLS uses. Rejection sampling discards the tiny bias that naive modulo introduces, so every entry, number and face is exactly equally likely. The history pane lists the session’s draws so a classroom can re-read who won what, and it vanishes with the tab. Nothing is uploaded because there is nothing to upload: the randomness is local, and that is the whole point.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------- regex
  regex: {
    lede: [
      'Regex Studio tests JavaScript regular expressions live — highlighted matches in place, a table of every match with capture and named groups, a replace preview using real String.replace semantics, a pattern library for the jobs that come up weekly, and a cheatsheet that stays honest. The engine under the page is the browser’s own RegExp, so what matches here is what will match in your code.',
      'Two safety nets matter as much as the features: invalid patterns are caught and explained rather than crashing the page, and zero-length matches are stepped past explicitly — so the classic /a*/g infinite-loop trap cannot hang the tab. Nothing you paste is sent anywhere.',
    ],
    sections: [
      {
        heading: 'Testing against the real engine',
        paragraphs: [
          'The pattern, the flags (g, i, m, s, u, y as toggles) and the test string compile to a live RegExp on every keystroke. Matches highlight inside the original text so context survives, and the match table lists position, line number, the matched text, and every capture group — numbered as $1, $2… and named as $<name> — with ∅ marking groups that did not participate in a particular match, the detail alternations make common.',
          'The replace tab previews String.replace with your replacement string, including backreferences, before the pattern ships to code. The library seeds eight patterns — e-mail, URL, ISO date, hex color, IPv4, duplicate words, time, HTML tag pairs — chosen because each demonstrates a class of syntax, not because lists of patterns impress anyone.',
        ],
      },
      {
        heading: 'The zero-length trap, disarmed',
        paragraphs: [
          'A pattern that can match the empty string — /a*/g, /\d*/g — matches forever at one position if the engine is not advanced, which is both a browser-tab freezer here and a production outage when the same loop runs in code. The page advances lastIndex past every zero-length match, the standard guard, and caps collection at 20,000 matches with a clear message. It is the same discipline the replacement code should carry, demonstrated where you can see it.',
        ],
      },
      {
        heading: 'Flags that mean something',
        paragraphs: [
          'g collects every match instead of the first; i folds case; m makes ^ and $ per line; s lets dot cross newlines; u enables unicode escapes and code-point matching; y anchors matching at lastIndex — each one a toggle with its meaning spelled out in the tooltip. Reading a pattern someone else wrote: paste it, tick the flags they claimed, paste their sample. The disagreement between what they said and what the engine does is visible immediately.',
        ],
      },
      {
        heading: 'Privacy where it matters most',
        paragraphs: [
          'The strings people test regexes against are logs, tokens, API responses, customer rows — exactly the data that should not be pasted into a random web form. This page has no form: matching runs on the device, the network tab shows nothing but the page itself, and no history survives the tab. That is not a feature bolted on; it is the only sane architecture for a regex tool.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------- csv
  csv: {
    lede: [
      'CSV & JSON Studio converts CSV to JSON and JSON to CSV with a real RFC 4180 parser — quoted fields, escaped quotes, embedded commas and newlines, CRLF endings, your choice of delimiter (comma, semicolon, tab, pipe) — instead of split(","), which is the difference between parsing a spreadsheet format and mangling one.',
      'The parsed grid previews before you commit, type inference turns "42" into 42 when you want it, unclosed quotes are warned about by line number, and both directions download as .json or .csv. Everything runs in this tab; spreadsheets never leave the device.',
    ],
    sections: [
      {
        heading: 'Why a real parser, not split()',
        paragraphs: [
          'Real CSV is a state machine, not a string split. Quoted fields may contain commas ("Asha, senior"), embedded newlines (a note field that wraps), and escaped quotes ("""" inside quotes); CRLF is the official terminator and bare CR shows up in the wild. A split-based "parser" corrupts every one of those silently — the worst kind of bug, because the damage appears downstream in the JSON nobody re-checked.',
          'This parser tracks quoted state character by character, warns when a quote opens and never closes — naming the line it started on — and treats a mid-field quote as literal text with a warning rather than a silent error. European Excel exports (semicolon), TSVs (tab) and pipe-delimited dumps all parse through the delimiter switch with no pre-conversion.',
        ],
      },
      {
        heading: 'CSV → JSON: keys, types and honesty',
        paragraphs: [
          'The first row becomes the object keys when the header switch is on, and column_1, column_2… when it is off. Type inference (on by default) converts number-shaped cells to numbers and true/false/null to their types — what most APIs expect. Switch it off when leading zeros are data: postal codes, phone numbers and part numbers are strings that happen to look like numbers, and "0123" as 123 is a corruption.',
          'The grid preview shows exactly what was parsed — including rows with missing cells rendered honestly as empty — so the conversion can be checked before the download button does anything.',
        ],
      },
      {
        heading: 'JSON → CSV: the union of keys',
        paragraphs: [
          'The columns are the union of every key across all rows, so objects with different shapes still make a rectangular table — a missing field leaves its cell empty rather than dropping data to force the grid. Nested objects and arrays are serialized as JSON strings in their cell: lossless, re-parseable, and stated plainly instead of flattened with invented column names. A single top-level object is treated as a one-row table, because that is usually what it means.',
        ],
      },
      {
        heading: 'Outputs and privacy',
        paragraphs: [
          'JSON output is pretty-printed and copyable; CSV output re-quotes any field that contains the delimiter, a quote or a newline, so the file round-trips through Excel without damage. Both download with correct names and MIME types. The whole conversion happens in this tab — paste a customer export, a log dump or a payment file, and nothing leaves the device. For the files that legally cannot be uploaded, this is the tool that legally can be used.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------- color
  color: {
    lede: [
      'Color Studio does the color chores design and accessibility work actually need: convert any format into every other (hex, rgb, hsl, bare components, alpha included), sample colors from an image or the screen itself, test two colors against WCAG 2.1 with exact ratios and verdicts, and build palettes with real HSL math — tint and shade ramps plus complementary, analogous and triadic harmonies.',
      'Everything is arithmetic in this tab. Images you sample are drawn to a local canvas and never uploaded; the EyeDropper API is used where the browser ships it and honestly absent where it does not.',
    ],
    sections: [
      {
        heading: 'Conversion that accepts what people actually paste',
        paragraphs: [
          'Real-world color input arrives as #f7a from a designer, rgba(255 122 69 / 0.8) from a stylesheet, hsl(18, 100%, 64%) from a tutorial. The parser takes hex in 3, 4, 6 and 8 digits, rgb()/rgba() and hsl()/hsla() in both comma and space syntax with % or raw components, and answers in every format at once — each with a copy button and a live swatch, because the person converting hex to hsl usually needs the value, not a lesson.',
        ],
      },
      {
        heading: 'Sampling: image and screen',
        paragraphs: [
          'Drop an image and it draws onto a local canvas; hovering reads the pixel under the cursor with getImageData and clicking commits the color. The image never leaves the tab — no upload endpoint exists. Where the browser ships the EyeDropper API (Chrome, Edge), one more button samples anywhere on screen; where it does not (Firefox, Safari), the button is not shown rather than replaced with a fake. Hover-then-click keeps inspection non-destructive: nothing changes until you commit.',
        ],
      },
      {
        heading: 'Contrast, computed per the spec',
        paragraphs: [
          'The ratio comes from the WCAG 2.1 relative-luminance formula — linearized sRGB channels, the standard coefficients — not from a quick perceptual guess. The verdicts map to the actual guidelines: 4.5:1 for AA normal text, 3:1 for AA large text (roughly 18.66px bold or 24px), 7:1 and 4.5:1 for AAA. A live preview renders sample text in the foreground color on the background color, so the verdict can be eyeballed alongside the number.',
        ],
      },
      {
        heading: 'Palettes from HSL, not vibes',
        paragraphs: [
          'The ramp walks the lightness axis through nine steps at your exact hue and saturation — the way design systems build 50–900 scales. Harmonies rotate the hue: 180° complementary, ±30° analogous, ±120° triadic — the classic color-wheel relationships, computed rather than hand-waved. Any swatch clicks into the working color, which feeds the contrast tab immediately: pick a palette, check it is readable, copy the hex. That loop is the whole job.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- signature
  signature: {
    lede: [
      'Signature Studio makes the mark you drop into documents: draw it with mouse, finger or stylus on a canvas that behaves like paper, or type it in one of five handwriting-style faces — then download a transparent PNG trimmed to the ink, at the width your document wants.',
      'The whole thing happens in this tab. The strokes never leave your device, the export is assembled on a local canvas, and the download is handed straight to your browser — there is no server in this loop to trust or to breach.',
    ],
    sections: [
      {
        heading: 'Drawing that behaves like a pen',
        paragraphs: [
          'The pad listens to Pointer Events, so the same stroke code covers trackpad, touchscreen and real stylus. Where the hardware reports pressure, the stroke widens and thins with it — the difference between writing and dragging a marker. A dashed baseline helps you sign level and never exports: the file contains only your ink, on transparency.',
          'Undo removes your last stroke (signatures are negotiation with yourself — the third attempt is usually the keeper), Clear starts over, and the pen color and width cover the ink-pen to felt-tip range. The checkerboard behind the canvas is the standard transparency indicator, not part of the image.',
        ],
      },
      {
        heading: 'Typing, for people who prefer to type',
        paragraphs: [
          'Type mode renders your name through canvas in five faces — casual pen, formal script, elegant italic, rounded hand, clean print — with size and slant controls. It exists because plenty of people sign faster than they scrawl, and a typed signature is still a signature on the documents that accept one.',
          'Because the render goes through the same canvas pipeline, what the preview shows is byte-identical to what the PNG contains: no font-substitution surprises when the file lands on another machine.',
        ],
      },
      {
        heading: 'The export: trimmed, transparent, sized',
        paragraphs: [
          'The download scans the image for the actual bounds of the ink, crops to it with a thin margin of breathing room, and resamples to your chosen width — 400 for inline email, 600 for documents, 800 for forms that print. Transparency is an alpha channel, so the signature sits on any background without a white box, and the page says so in the preview rather than leaving you to discover it in Word.',
        ],
      },
      {
        heading: 'What this page is not',
        paragraphs: [
          'It is not an e-signature platform: no certificate, no audit trail, no signing ceremony. What it produces is the mark itself — the thing you then place into a contract you control, or hand to a flow that does the legal wrapping. For regulated signing, the qualified services exist for a reason; this page is the pen, not the notary.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- invoice
  invoice: {
    lede: [
      'Invoice Studio builds the invoice a working freelancer actually sends: seller and client blocks, an invoice number and dates, line items with quantity and rate, a discount that can be a percent or a flat amount, tax applied in the correct order, shipping, notes and payment terms — with a live sheet that prints exactly as previewed.',
      'The math is shown, not hidden: subtotal, discount, taxable base, tax, shipping and total, each on its own line. The invoice is composed in this tab and printed by this tab; the browser\u2019s own print dialog is also where “Save as PDF” lives, so the PDF path needs no upload either.',
    ],
    sections: [
      {
        heading: 'The math order that matters',
        paragraphs: [
          'Discount first, tax second, shipping on top. A discount reduces the taxable amount in most jurisdictions, which is why the page computes tax on the post-discount base instead of the subtotal — the wrong order is the classic invoice bug that shows up as a few missing cents per line and an argument with an accountant per quarter.',
          'The breakdown panel spells out every step with the numbers in it, so a client who asks “what did the 21% apply to?” can be answered by pointing at the sheet. Flat discounts switch cleanly from percent mode for the “$50 off this one” cases.',
        ],
      },
      {
        heading: 'Printing that prints the invoice, only',
        paragraphs: [
          'A print stylesheet isolates the invoice sheet: headers, footers, the editor column and everything else on the page are hidden the moment the browser prints, and the sheet takes the full page width. What you previewed is what comes out — on paper or, with “Save as PDF”, as a file you attach to the email you were about to write.',
        ],
      },
      {
        heading: 'Fields that earn their place',
        paragraphs: [
          'Invoice number, issue date and due date live in the header the way clients expect to find them. Notes carry the human line — thank you, late-fee terms, a joke — and the payment terms block states the when and the how so the “when will I get paid?” conversation happens before the work, not after. Currency runs across the whole sheet, with a custom slot for anything the list missed.',
        ],
      },
      {
        heading: 'Nothing stored, nothing to leak',
        paragraphs: [
          'There is no account and no database behind this page: the invoice exists in the fields of the open tab and nowhere else. That is a feature with teeth — a client\u2019s name and a day rate are exactly the data a breach turns into a pricing leak. Save the PDF as your record; edit the fields again any time.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- timezone
  timezone: {
    lede: [
      'Time Zone Studio does the three jobs behind every “what time is it in…” search: convert one moment across any set of zones with the day shift named in words, keep a live world clock for the cities you actually care about, and lay out a meeting-planner strip that shows — hour by hour, in color — who is at work, who is awake and who is asleep.',
      'Every zone comes from your browser\u2019s own Intl database, the same IANA tables your operating system updates. Conversions are computed on this device from those tables; there is no server round-trip and no hardcoded, quietly outdated timezone list baked into the page.',
    ],
    sections: [
      {
        heading: 'Convert: the day shift is the answer',
        paragraphs: [
          'A 23:00 call in New York is tomorrow in Tokyo, and a converter that only says “9:00 AM” invites the wrong-day calendar invite. Each row names the offset, the difference from your source zone, and — when the date flips — a badge that says “next day” or “previous day” with the actual calendar date. Same-date rows say so plainly, because the absence of a badge should mean something too.',
        ],
      },
      {
        heading: 'World clock: the cities you keep',
        paragraphs: [
          'Add the zones you collaborate with and the cards tick every second — time, weekday and date, offset from UTC and the difference from your own zone spelled out. It is the dashboard for the week where three people are three workdays apart, and it keeps running in the tab while you write the schedule.',
        ],
      },
      {
        heading: 'Meeting planner: colors, then a verdict',
        paragraphs: [
          'The strip lays out all 24 hours in your source zone\u2019s time, one row per zone, coloring each hour green (inside working hours), amber (awake, off the clock) or grey (asleep) against working hours you set. The current hour is marked. Below it, the verdict line names every window where all zones are green at once — or, honestly, says that none exists and someone will be taking the 7 AM or the 10 PM call.',
          'Three zones maximum, deliberately: past that the strip stops being readable and the honest answer is “rotate the pain” — which the strip shows rather than hides.',
        ],
      },
      {
        heading: 'Why Intl instead of a timezone table',
        paragraphs: [
          'Timezone data changes: countries move DST rules, zone names get corrected, offsets shift by 30 minutes. The browser\u2019s Intl database carries the same updates your OS installs, so the page is never more current-ness-deprived than the machine it runs on — and never needs a network call to be right.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------- pdf-to-image
  'pdf-to-image': {
    lede: [
      'PDF to Image Studio is the reverse of images-to-PDF: each page of a PDF is rasterized to a real image — PNG or JPG, at 1×, 2× or 3× scale — with a thumbnail grid to check the run before you download one page or the whole set as a ZIP.',
      'The rendering is done by pdf.js, the same engine Firefox uses to display PDFs, running in this tab. The file is read into local memory, drawn onto local canvases and written out as downloads; no request ever carries a page, which you can verify in the network tab.',
    ],
    sections: [
      {
        heading: 'Scale: what 1×, 2× and 3× mean',
        paragraphs: [
          'A PDF page is defined in points, and 1× renders it at screen resolution — roughly 72 dpi, fine for slides and embedding. 2× doubles every dimension (about 144 dpi, the sweet spot for print and archiving), and 3× gives the sharpest text edges at the cost of nine times the pixels. The choice is per-run, not per-page: switch it and the whole grid re-renders.',
          'PNG keeps text crisp with lossless encoding; JPG with a quality slider shrinks scanned or photo-heavy pages dramatically. Both encode from the identical render — the difference is purely the container.',
        ],
      },
      {
        heading: 'Sequential rendering and the honest cap',
        paragraphs: [
          'Pages render one after another with a live progress count, so a hundred-page document fills its grid without freezing the tab. Memory is the real limit — a 3× render of a dense page is a large canvas — and when a run hits it, the page says so plainly: the first 100 pages are done, split the file for the rest. What it never does is fail silently or pretend a partial run is complete.',
        ],
      },
      {
        heading: 'Where this beats screenshots',
        paragraphs: [
          'A screenshot captures your zoom level, your scrollbars and your DPI; this renders the page at exact, chosen dimensions from the PDF\u2019s own vector data. Text comes out clean at every scale, dimensions are consistent across a run, and the filenames — document-page-01.png, page-02 — sort in order the moment the ZIP opens.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------- device-test
  'device-test': {
    lede: [
      'Device Check Studio is the pre-call check: start your camera and see its real resolution and frame rate — including a measured FPS that reflects what actually arrived, not what the track promised — start your mic and watch a level meter move with your voice, and copy a device-info card for the support ticket.',
      'The privacy model is structural: this page contains no recording code at all. No MediaRecorder, no capture graph, nothing that could write a file. Streams exist only while a panel is open and stop the moment you press Stop or close the tab.',
    ],
    sections: [
      {
        heading: 'Camera: settings versus reality',
        paragraphs: [
          'The track settings report what the camera negotiated — 1280×720 at 30 fps is the usual promise. The measured counter then counts actual painted frames for two seconds and reports what showed up, which is the number that matters: browsers deliver less than the promise under load, in dim light, or when another app holds the device.',
          'Every camera on the machine is enumerated once permission exists, and switching between them — front to back on a phone, webcam to capture card on a desk — happens in the page without losing the readouts.',
        ],
      },
      {
        heading: 'Microphone: a meter that moves',
        paragraphs: [
          'The mic feeds a WebAudio analyser: an RMS bar tracks your speaking level in real time, a peak-hold marker shows the loudest you got, and the sample rate readout confirms the stream is actually flowing. Speak at presentation distance and watch the bar — if it barely moves, the app that matters later will hear exactly as little.',
        ],
      },
      {
        heading: 'Device info: the ticket, pre-written',
        paragraphs: [
          'Screen and window size, pixel ratio, CPU cores, the memory hint, touch points, languages, timezone, the full user agent and a secure-context flag — laid out, with a copy-all button. The secure-context line is the one that saves the most time: camera and microphone APIs refuse to run on plain http, and the card says so instead of the symptoms confusing everyone.',
        ],
      },
      {
        heading: 'Permissions, stated before they are asked',
        paragraphs: [
          'Nothing opens a hardware light uninvited: the camera and mic start only when you press their Start buttons, and the browser\u2019s permission prompt explains itself. A denial is handled with instructions — where the address-bar control lives and what to flip — not with a silent black rectangle.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- beautify
  beautify: {
    lede: [
      'Code Formatter Studio pastes four languages into shape with the real engines: js-beautify for HTML, CSS and JavaScript, sql-formatter for SQL with five dialects and keyword casing, a JSON side-check that pins parse errors to the exact line and column, and compact modes that are honest about exactly what they preserve.',
      'Everything runs in this tab. The engines load once from the app bundle itself, and your code — client stylesheets, proprietary queries, someone\u2019s leaked config — never crosses the network to be formatted.',
    ],
    sections: [
      {
        heading: 'Engines, not regex pretending',
        paragraphs: [
          'Formatting is parsing, and the page uses parsers. js-beautify is the library behind browser devtools and JSFiddle; sql-formatter understands dialects — because MySQL and T-SQL are not the same language and reflowing one with the other\u2019s rules produces confident garbage. Indent size, wrap width and quote style are options that reach the engines, not labels next to a single hardcoded output.',
        ],
      },
      {
        heading: 'Compaction with stated limits',
        paragraphs: [
          'The compact modes do real work and name their edges. CSS compact strips comments and newlines but guards the argument lists of calc(), min(), max() and clamp() — those functions require spaces around + and −, and stripping them turns valid CSS invalid. HTML compact drops comments and inter-tag whitespace while leaving pre, textarea, script and style contents byte-exact, because collapsing a <pre> or a script changes what the browser shows or executes. SQL compact preserves string literals while stripping comments and runs of whitespace.',
        ],
      },
      {
        heading: 'The JS minifier that deliberately does not exist',
        paragraphs: [
          'JavaScript ships a beautifier only. Whitespace-stripping minifiers break automatic-semicolon-insertion: remove one newline and two statements merge, silently changing what the program does — the bug ships to production before anyone notices. Real minification parses first and re-emits, which is bundler work with source maps. A paste-and-pray box that pretends otherwise is a footgun, so this page refuses it in writing instead.',
        ],
      },
      {
        heading: 'The JSON side-check',
        paragraphs: [
          'Paste JSON and get it pretty-printed or compacted — or, when it is broken, the exact line and column of the failure instead of a truncated browser error. One misplaced comma in a 4,000-line API response is a two-second fix when the position is printed and an afternoon when it is not.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- favicon
  favicon: {
    lede: [
      'Favicon Studio takes one image and produces the whole set a modern site references: 16, 32, 48, 64, 96, 128, 180 (apple-touch), 192 and 512 px PNGs, plus a genuine multi-size .ico built byte-by-byte to the ICO container spec, plus the copy-paste <link> tags — previewed at true pixel size on light and dark, packed as one ZIP.',
      'The resampling is high-quality and stepped — an intermediate hop keeps a 2,000 px photo from falling to 16 px in one aliasing-prone drop — and every pixel is produced on this device. Nothing about your logo uploads.',
    ],
    sections: [
      {
        heading: 'The sizes, and what eats them',
        paragraphs: [
          'Browser tabs want 16 and 32; the classic favicon.ico carries 48; iOS home screens want the 180 apple-touch icon; PWA manifests reference 192 and 512. The generated HTML snippet maps each file to the tag that serves it, so the ZIP drops into a web root and the snippet drops into a <head> and the job is done in both directions at once.',
        ],
      },
      {
        heading: 'A real .ico, not a renamed PNG',
        paragraphs: [
          'The .ico is assembled per the spec: an ICONDIR header, one 16-byte directory entry per embedded image with size, color planes, bit depth, data length and offset, then the image payloads. Modern ICO entries carry PNG-encoded images, which is what this page embeds — the result works in the places that still demand an .ico, without a fake file that breaks one of them.',
        ],
      },
      {
        heading: 'Fit: cover, contain, and the 16-pixel test',
        paragraphs: [
          'Cover center-crops the source square and fills the tile edge to edge; contain letterboxes the whole mark with a background color or transparency, and an optional rounded-corner mask gives the tile look. The previews render every size at true pixel size on both light and dark chips — because a logo that dies at 16 px should die in your preview, not in a stranger\u2019s browser tab.',
        ],
      },
    ],
  },

  // --------------------------------------------------------------- watermark
  watermark: {
    lede: [
      'Watermark Studio stamps text or your logo across a batch of photos — nine positions with margins, opacity, rotation, or a diagonal tile grid — previews the first image live, then applies the same treatment to every file and hands you the set individually or as one ZIP.',
      'The work happens on canvases in this tab: images decode to bitmaps, the watermark composites on top, and the result re-encodes straight to your downloads. The originals and the watermarked copies never leave the device — which, for the agencies whose entire business is in those originals, is the requirement, not a bonus.',
    ],
    sections: [
      {
        heading: 'Text or logo, same grammar',
        paragraphs: [
          'Text scales as a percentage of the image\u2019s smaller side, so one setting reads correctly on a 1,200 px phone shot and a 6,000 px deliverable alike. A logo watermark uses your own PNG with its transparency intact — no white box — sized the same percentage way. Both support the nine-position grid, opacity down to a whisper, rotation in degrees, and tiling.',
        ],
      },
      {
        heading: 'Tile mode: the one they cannot crop out',
        paragraphs: [
          'A corner watermark is one crop away from gone; a diagonal grid across the whole frame is not. Tile spacing follows your watermark size automatically, and the density shows in the live preview before anything is committed. It is the pattern for proofs and preview sets where the point is “this is not the final file.”',
        ],
      },
      {
        heading: 'Format-faithful export',
        paragraphs: [
          'JPEG in, JPEG out, at a quality you set; PNG in, PNG out with alpha preserved. Files are named original.watermarked.ext so the batch sorts next to its sources. The preview canvas renders image one at full settings — check it at small size for legibility — and the apply pass runs the identical stamping across the batch.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------- typing-test
  'typing-test': {
    lede: [
      'Typing Test Studio measures speed the way the numbers are defined: WPM is correct characters ÷ 5 ÷ minutes, CPM is raw characters ÷ minutes, and accuracy counts uncorrected errors against you — with durations from 15 seconds to 3 minutes and a clock that starts on your first keystroke, not on page load.',
      'The word stream comes from a built-in list of common English words, shuffled locally each run. Nothing is fetched, nothing is stored, and there is no leaderboard — typing speed is between you and your keyboard.',
    ],
    sections: [
      {
        heading: 'What the meter counts while you type',
        paragraphs: [
          'The active word colors character by character: what matches goes solid, what does not goes red — and stays red until you fix it, because an uncorrected error is a real error by the standard definition. Space advances the word, the tally updates per keystroke, and the WPM/CPM/accuracy meters recompute live so you can watch pace collapse when you get sloppy and recover when you breathe.',
        ],
      },
      {
        heading: 'The finish, and what the result means',
        paragraphs: [
          'The test ends itself at zero — nobody grades their own stopping point. The result card shows WPM, CPM, accuracy, consistency (derived from the variance of your per-second pace, so bursts versus rhythm is visible) and the correct/raw character tally, with the formula written underneath. A session best is kept in the tab only; close it and it is gone.',
        ],
      },
      {
        heading: 'Why the words are common English',
        paragraphs: [
          'Speed on plausible prose is the speed that transfers to what you actually type; typing “quixotically” fast is a party trick. The stream draws from the most common words, shuffled with the same Fisher–Yates shuffle everywhere else in this app, so a New words button gives a fresh run without a network round-trip.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- markdown
  markdown: {
    lede: [
      'Markdown Studio is the workbench for READMEs, blog drafts and documentation: the editor sits beside a live preview rendered by a built-in engine, a table generator builds the pipe syntax nobody remembers, and exports produce raw HTML, a standalone styled HTML document, or the .md source itself.',
      'Raw HTML is escaped by default — a pasted <script> renders as the text it is — with an explicit switch for when you genuinely want tags live. Every render happens on this device; the document exists in this tab and nowhere else.',
    ],
    sections: [
      {
        heading: 'The subset that covers the writing',
        paragraphs: [
          'Headings through h6, bold, italic, strikethrough, inline and fenced code with a language label, links and images, blockquotes, horizontal rules, ordered and unordered lists with real nesting, and GFM tables with per-column alignment. The engine renders exactly this — the syntax people actually type in READMEs and issues — instead of failing quietly on the parts a lighter parser skipped.',
        ],
      },
      {
        heading: 'Escaped by default, and why that is the feature',
        paragraphs: [
          'A Markdown tool is where pasted text lands: issue bodies, chat logs, drafts written by strangers or by models. Rendering that text as live HTML executes whatever it embedded. With the switch off, every tag is escaped and shown as text — the safe default for other people\u2019s words. Turn it on for documents you wrote, and a URL guard still refuses javascript: links either way.',
        ],
      },
      {
        heading: 'Tables without the pipe-counting',
        paragraphs: [
          'The generator takes rows and columns and emits an aligned GFM table with placeholder cells, inserted into the editor or copied out — the syntax is generated once instead of miscounted four times. Edit the delimiter row\u2019s colons for center or right alignment and the preview follows immediately.',
        ],
      },
      {
        heading: 'Exports that match the preview',
        paragraphs: [
          'The HTML export produces the rendered fragment for embedding into an existing page or CMS. The standalone export wraps the same content in a complete document with embedded styles — typography, code, tables, quotes — so it opens in any browser as a finished file. The .md export is your source, byte for byte. What all three render is what the preview showed: there is no second renderer to disagree with.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- stats
  stats: {
    lede: [
      'Statistics Calculator reads a pasted list the way a stats course does: mean, median and mode for the center, range, quartiles, IQR, variance and standard deviation for the spread, and the 1.5×IQR fences that name outliers — with sample (n−1) and population (n) flavors on a switch, because the divisor is not a footnote, it is the question.',
      'Parsing is deliberately tolerant: commas, spaces, tabs and newlines all work, and stray non-numeric tokens are skipped and counted on the page rather than dropped in silence — you can paste straight out of a spreadsheet or a messy note and see exactly what the tool made of it.',
    ],
    sections: [
      {
        heading: 'The quartiles are the interpolated ones',
        paragraphs: [
          'Medians and quartiles are computed by linear interpolation — the same method as Excel\'s PERCENTILE.INC and numpy\'s default — so a list of ten numbers gives Q1 as the 25th point between the second and third values, not someone\'s textbook-only convention. There are several legitimate definitions of quartiles and they disagree by small amounts; this page picks the one your spreadsheet already agrees with and says so, which matters most when you are checking homework against software.',
          'The mode is equally honest: when every value occurs exactly once it prints "none" — the correct answer — instead of the "0" many tools emit. Multi-modal distributions list every value tied for the top frequency.',
        ],
      },
      {
        heading: 'Sample or population — the switch that changes the number',
        paragraphs: [
          'Variance and standard deviation divide the squared deviations by n−1 for a sample and by n for a population. The switch applies everywhere at once and the label on each card changes with it (s²/σ², s/σ), so the number you copy is the number your assignment wants. Below two values, a sample variance genuinely cannot be computed — the card shows that rather than a made-up placeholder.',
        ],
      },
      {
        heading: 'Outliers and the picture of the distribution',
        paragraphs: [
          'Outliers are flagged by the 1.5×IQR rule with both fences printed, so a value\'s outlier status is checkable, not asserted. The histogram draws ten equal bins across the observed range from the same data, which is the fastest way to see skew, a lone far point, or two clusters that the mean was quietly averaging away.',
          'The sorted list sits below everything for the by-eye check — statistics tools earn trust when the inputs and the math are both visible.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------- number-to-words
  'number-to-words': {
    lede: [
      'Number to Words converts figures into the words a bank cheque or contract needs: 1234567.89 becomes "one million two hundred thirty-four thousand five hundred sixty-seven dollars and eighty-nine cents only" — or the lakh/crore version a rupee cheque expects. Five framings (plain, USD, EUR, GBP, INR), two numbering systems, one trailing "only".',
      'The conversion rules are printed on the page: decimals beyond two places are cut — never rounded — because a cheque amount must not silently change value, negatives are spoken as "minus", and numbers beyond the JavaScript safe-integer maximum are refused with an explanation instead of hallucinated.',
    ],
    sections: [
      {
        heading: 'Two systems, because money is not written the same everywhere',
        paragraphs: [
          'The international short scale groups by thousands (thousand, million, billion, trillion); the Indian system groups two-after-three (thousand, lakh, crore, arab). The same figure 12,34,567 reads as "twelve lakh thirty-four thousand five hundred sixty-seven" in one and "one million two hundred thirty-four thousand…" in the other — a real difference on a cheque, not a styling choice.',
          'Currency framing changes the decimals\' names (cents, pence, paise) and adds the closing "only" the cheque format expects. The plain-number framing keeps the words bare for contracts that spell amounts without naming a currency.',
        ],
      },
      {
        heading: 'The rounding policy is "none", and why',
        paragraphs: [
          'A cheque written for 100.005 is 100 rupees and 0 paise in words only if the extra digits are dropped with a note; rounding them up would make the written amount disagree with the figures in the amount box — the exact mismatch banks reject. This tool truncates past two decimals and says so on the page, which is the only behavior that keeps the two representations equal.',
          'The upper bound is honest for the same reason: JavaScript numbers stop being exact past 9,007,199,254,740,991, and a words-converter that silently mangles its inputs there is worse than useless. The limit is stated when you hit it.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- morse
  morse: {
    lede: [
      'Morse Code Translator runs both directions in one box — type text and get ITU-standard Morse, type dots and dashes and get text — and sounds the message on a WebAudio oscillator with the timing done the standard way: dot 1 unit, dash 3, gaps of 1 / 3 / 7 units, the unit set by your WPM through the PARIS convention.',
      'The direction is detected from what you typed (predominantly dots, dashes and slashes reads as Morse), so there is no mode toggle to forget. Unencodable characters are named on the page instead of vanishing, which is the difference between a translation you can trust and one you cannot.',
    ],
    sections: [
      {
        heading: 'The audio clock is the whole point',
        paragraphs: [
          'Playback is scheduled entirely on the WebAudio clock: every element\'s start and end is computed once and handed to the browser, so a throttled tab cannot bend the rhythm the way timer-based players do. The envelope uses 5 ms ramps so each dot and dash is click-free at both ends, and the tone runs 300–1200 Hz so the pitch sits where your ear wants it.',
          'Speed follows the PARIS convention — the word PARIS is 50 units, so unit length = 1.2 ÷ WPM seconds — across 5 to 35 WPM. That is the standard every practice recording and every exam uses, and the page prints the computed unit length so you can check it.',
        ],
      },
      {
        heading: 'What the table covers, and what it refuses',
        paragraphs: [
          'The mapping is the full ITU set: A–Z, 0–9, and the punctuation block every guide lists (., ,, ?, /, =, +, @ and friends). A character outside the table — an emoji, a letter with a diacritic — is skipped and named, because guessing a code that does not exist is worse than admitting the gap.',
          'A flashing element readout follows the audio beat for silent practice — watch the dot/dash rhythm when a speaker would disturb the room, or slow to 5 WPM and learn the shapes by eye before your ear is trained.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------ font-changer
  'font-changer': {
    lede: [
      'Font Changer applies the thirteen Unicode "styled alphabets" bios and usernames use — bold, italic, script, fraktur, small caps, circled, fullwidth, upside-down and friends — to whatever you type, one copyable line per style, updated as you type.',
      'These are not fonts. They are Unicode code points — Mathematical Alphanumeric Symbols and friends — which is why they paste into Instagram or Discord anywhere plain text is accepted, and also why the tool says honestly which characters each style cannot render instead of quietly mangling your text.',
    ],
    sections: [
      {
        heading: 'The honest limits are the feature',
        paragraphs: [
          'Each style maps only what its Unicode block actually provides. Digits exist for the bold, serif bold, double-struck, monospace and circled blocks; the italic, script and fraktur blocks carry letters only. Script and fraktur have reserved holes (ℬ ℰ ℋ ℭ ℜ ℨ are honorific letters), filled the standard way the mathematics references do. Small caps has no true capital X — the table uses the closest glyph and lists what is unmapped on the card.',
          'Every card carries its "no mapping for" note when a character falls through, so what you paste is exactly what was rendered — no silent substitutions to discover later.',
        ],
      },
      {
        heading: 'The screen-reader caveat, stated plainly',
        paragraphs: [
          'A screen reader announced 𝐛𝐨𝐥𝐝 reads it as "mathematical bold small b, mathematical bold small o…" — the trick that styles a bio also makes it a slog for assistive tech. That is not a reason to avoid the styles in a display name; it is a reason not to write a paragraph in them. The page says this where the styles are chosen, because a tool that hides the trade-off is styling itself.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ emoji
  emoji: {
    lede: [
      'Emoji Finder is a searchable grid over a built-in dataset: every emoji carries its common name and the keywords people actually type — "heart", "fire", "dog", "pizza", "sad" — organized into nine categories, click to copy, recently-copied row for the ones you keep reusing.',
      'The set ships with the page: search is a local filter, the grid renders offline, and nothing you search for is sent or recorded. The honest scope is stated on the page too — this is the everyday set with real search terms, not the full Unicode 16 catalog, because the useful question is "which one is the sad face", not "list all 3,700".',
    ],
    sections: [
      {
        heading: 'Why keywords, not just names',
        paragraphs: [
          'The official name of 😭 is "loudly crying face", but you type "sob" or "sad". The dataset therefore carries the search terms people actually use per entry — emotions ("happy", "angry", "tired"), objects ("pizza", "rocket"), states ("fire", "star") — so one query finds the row you meant. Keyword hints under each tile make the vocabulary visible, so the next search can use it too.',
        ],
      },
      {
        heading: 'Click to copy, and the tab-local memory',
        paragraphs: [
          'A click copies the character to your clipboard with a visible "copied" state and pins it to a Recently-copied row (the last twelve). That row lives in this tab\'s memory only — close the page and it is gone, which is exactly right for a tool whose clipboard is its output and whose memory is nobody\'s business.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------- json-to-ts
  'json-to-ts': {
    lede: [
      'JSON to TypeScript types the document the way you would by hand: one export-ed interface per distinct object shape, nested objects lifted out, array items singularized (orders → Order), and fields that are missing or null in some array members marked optional everywhere in the tree — because "the API omits this sometimes" is exactly what `?` encodes.',
      'Identical shapes are deduplicated structurally — two objects with the same keys and types share one interface. Switch interfaces/type aliases, add readonly, rename the root; parse errors carry line and column; and the generation is deterministic and local, so the JSON never leaves the tab.',
    ],
    sections: [
      {
        heading: 'Optionals where they mean something',
        paragraphs: [
          'The common API shape — a list where most items carry a field and some omit it (or carry null) — is precisely the case naive generators get wrong: they emit the first item\'s shape and invent a type for the rest, or merge everything into `any`. Here the array members are inspected together: a key absent from some members (or null in all) comes out optional on the single merged item interface, with the field\'s real type taken from a member that carries it.',
          'Genuinely mixed arrays produce honest unions — `(string | number)[]` — and empty arrays become `unknown[]` rather than a guessed type, because an empty list carries no evidence and pretending otherwise writes a wrong type into your codebase.',
        ],
      },
      {
        heading: 'Names a human would pick',
        paragraphs: [
          'Property keys stay as they are (quoted only when illegal), type names are Pascal-cased and made legal (reserved words get a suffix), and array items inherit a singularized hint — `orders` yields `Order`, `items` yields `Item` — so the generated module reads like something a colleague wrote, not like a machine dump.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------ compress-pdf
  'compress-pdf': {
    lede: [
      'PDF Compressor takes the rasterization route and says so up front: each page is rendered by pdf.js at your chosen scale, encoded as JPEG at your chosen quality, and rebuilt into a fresh PDF at the original page size with pdf-lib. Scan-heavy and photo-heavy files shrink, often a lot.',
      'The honesty runs both directions: a vector-heavy file (text, line art) can come out LARGER, and the result card reports the real delta and recommends keeping the original when the math lost — because a compressor that always claims victory is not a tool, it is marketing.',
    ],
    sections: [
      {
        heading: 'The two knobs that move the size',
        paragraphs: [
          'Render scale (0.75× to 2×) sets the pixel density of the rasterized page; JPEG quality (30–95%) sets how aggressively each one is compressed. For a scanned document, 1× at 60% typically lands well below the original; for a text-heavy export, no setting beats the original\'s vector compression, and the before/after panel will say so with the numbers.',
          'Page dimensions are preserved regardless: the new page carries the scale-1 point size, so print layout never changes — only the pixel density inside it does.',
        ],
      },
      {
        heading: 'The cost, named before you run it',
        paragraphs: [
          'Rasterized pages are images: text stops being selectable and searchable, and screenshots of the file lose nothing but gain blur past the rendered resolution. That is the correct trade for a scanned contract you are emailing at 8 MB, and the wrong one for a form someone needs to fill digitally. The page states the trade on the result, every time.',
        ],
      },
    ],
  },

  // --------------------------------------------------------------- time-card
  'time-card': {
    lede: [
      'Time Card Calculator does the punched-card math for a week: two in/out pairs per day (for the lunch split), a break in minutes, worked time per day and the week in both h:mm and decimal hours, overtime after your threshold at your multiplier, and gross pay at your rate with the formula printed underneath.',
      'Overnight shifts are handled the way the schedule means them: an out earlier than its in counts across midnight, never as negative time. And the pay line is gross before taxes — the page says that instead of guessing your deductions.',
    ],
    sections: [
      {
        heading: 'Two pairs, one break, no second table',
        paragraphs: [
          'The lunch-split case fits in the same row as a continuous shift: in/out, optional second in/out, and a break column in minutes that comes off the day\'s total. One pair is all you need otherwise. The daily column updates as you type, and the weekly total carries the same arithmetic into a h:mm figure plus its decimal equivalent (what payroll systems usually want).',
        ],
      },
      {
        heading: 'Overtime is a setting, not an assumption',
        paragraphs: [
          'The threshold defaults to 40 hours and the multiplier to 1.5× because those are the common conventions — but they are editable, because plenty of schedules (and several jurisdictions) differ. Pay computes as regular hours × rate + overtime hours × rate × multiplier, with the exact numbers printed in the formula line so a paycheck can be checked digit by digit.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ grade
  grade: {
    lede: [
      'Grade Calculator answers the three questions the term actually asks: what is my weighted grade so far, what do I need on the final, and what is my GPA — each with its formula printed under the result and the honest caveats printed with it.',
      'The honesty rules are deliberate: a weighted grade is computed over the graded portion and labeled standing-not-prediction; the final solver says "not reachable on this final alone" when the required score exceeds 100% instead of printing a fantasy number; GPA uses the standard unweighted 4.0 mapping and names the school-varies caveat.',
    ],
    sections: [
      {
        heading: 'The final-exam algebra, in the open',
        paragraphs: [
          'The solver rearranges the course-weighting equation — target = current × (1 − w) + final score × w — and prints x = (target − current × (1 − w)) ÷ w with your numbers substituted, so the answer is checkable rather than oracular. The verdict line translates the number: comfortably reachable, demanding, or mathematically out of reach on this exam.',
        ],
      },
      {
        heading: 'Weights that do not sum to 100, and percents in the GPA box',
        paragraphs: [
          'Real terms are graded in stages: the tool computes the weighted average over the graded weights and states the covered share, which is the number you actually know. The GPA tab accepts letters (A=4.0 through F=0 with the standard ± steps) or percents converted on the 90/80/70/60 band, weighted by credit hours — with the caveat that some schools use weighted scales or A+ above 4.0, which is a mapping choice, not a math error.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- todo
  todo: {
    lede: [
      'Local Checklist is a to-do list with the storage story on its sleeve: items persist in this browser\'s localStorage, reload after reload, and exist nowhere else — no account, no sync, no server. Enter to add, click to tick, double-click to edit, drag to reorder, copy out as Markdown when the list needs to travel.',
      'The verbs are where your hands already are: Enter adds, the checkbox ticks, the pencil (or a double-click) edits inline, arrows and drag reorder — with button fallbacks that work on touch screens and for keyboard users alike.',
    ],
    sections: [
      {
        heading: 'What persistence means here, precisely',
        paragraphs: [
          'The list is saved to localStorage on every change and loaded on the next visit to the same browser. Clearing the browser\'s site data — or pressing Delete everything — removes it permanently; there is no cloud copy and no undo beyond that. That is not a limitation hidden in a FAQ; it is the page\'s privacy model stated on the page.',
          'The storage read is defensive: a corrupted or foreign JSON blob is discarded and the page starts empty rather than crashing on its own history. A checklist that dies because of one bad reload is not a checklist.',
        ],
      },
      {
        heading: 'The export that matters',
        paragraphs: [
          'Copy as Markdown emits a GitHub-flavored task list — `- [x] done item` — ready to paste into an issue, a pull request description, or any note app that renders checklists. The one export a developer to-do list actually needs is one click away, and the copy includes the done-state, because the point of the export is to carry the list, not just the words.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- meme
  meme: {
    lede: [
      'Meme Maker does the one layout the internet actually agreed on: your picture, a caption on top, a caption on the bottom, white letters with a black outline. It renders on a canvas in this tab and downloads a clean PNG with no watermark, no account, and no upload.',
      'The details that make a meme look right are handled: the Impact-style type, the outline thickness scaled to the font size, uppercasing you can switch off, and long captions that wrap to two lines instead of running off the edge of the picture.',
    ],
    sections: [
      {
        heading: 'How the canvas works',
        paragraphs: [
          'Drop in a picture (PNG, JPEG or WebP) or load the built-in sample to try the controls. The image is drawn at its own resolution up to a sensible maximum, captions render live as you type, and the download is exactly what the preview shows — a PNG at the image\u2019s own size.',
          'Long captions wrap: if a line would overflow the image, it splits at the space that balances the two halves best, with up to two lines per caption. A single word too wide to fit is drawn as-is rather than mangled — the honest failure for a word you clearly want at that size.',
          'The font-size slider changes the type, not the image, so a small caption on a big photo and a big caption on a small photo both stay readable.',
        ],
      },
      {
        heading: 'Where memes are usually ruined',
        paragraphs: [
          'The classic failure modes are all site-shaped: watermarks on the free tier, forced signups, images uploaded to someone else\u2019s server, and captions that re-encode the photo into a smaller, blurrier version of itself. Each one is a reason people keep screenshotting instead of using a meme site.',
        ],
        list: [
          'A caption a friend asked for, on a photo that never leaves your machine',
          'An inside-joke image for a group chat, made between meetings',
          'A labeled screenshot — top text for the setup, bottom for the punchline',
          'Quick annotated pictures for a team channel, no design tool opened',
        ],
      },
      {
        heading: 'What happens to your image',
        paragraphs: [
          'The picture is decoded, drawn and re-encoded inside this tab by the browser\u2019s own canvas engine. No request carries your pixels; there is no server in the loop, so nothing can log, retain or use the image. Close the tab and the memory goes back.',
          'The built-in sample image is drawn by the page itself — a generated scene clearly watermarked as a sample — so the tool can be tried without dropping in a real photo first.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------ svg-convert
  'svg-convert': {
    lede: [
      'SVG to PNG/JPG rasterizes vector markup into a bitmap at exactly the size you need: the native size, 2×, 4×, or a custom box with the aspect ratio locked, onto a transparent, white, black or custom background.',
      'Paste the markup or drop an .svg file — the render updates live as you edit, and the download is the canvas you previewed, nothing more.',
    ],
    sections: [
      {
        heading: 'Why rasterize an SVG at all',
        paragraphs: [
          'SVG is the right format for icons and logos, but the world runs on bitmaps: marketplaces want PNGs, forms want JPGs, avatars want square 512-pixel files, and some tool from 2013 accepts nothing else. Converting is the bridge — done at the exact target size, where upscaling a small PNG would have blurred, rendering the vector fresh at 4× stays crisp.',
          'That is the whole advantage of rasterizing from the vector source: every scale is a fresh render, not a resample of an old bitmap. An icon rendered at 16 and at 512 come from the same crisp curves.',
        ],
      },
      {
        heading: 'The security bit, handled',
        paragraphs: [
          'SVG is XML, and XML can carry more than shapes: script elements, event-handler attributes, external references. Before anything renders, the markup is parsed and stripped of script nodes, on* attributes and hrefs that point anywhere but inside the document — and when that stripping changed anything, the page shows a badge saying so.',
          'This is defense in depth on top of what browsers already do (an SVG drawn into a canvas via an img element never executes scripts), but defense in depth is the only kind worth having when the input is markup you found somewhere.',
        ],
      },
      {
        heading: 'Formats and backgrounds',
        paragraphs: [
          'PNG keeps transparency; JPG does not, so a transparent background chosen with a JPG target is honestly forced to white, with a note saying so rather than a black surprise. The JPG quality slider runs from 30 to 95, and the readout always names the exact output dimensions — what you set is what downloads.',
        ],
        list: [
          'Icons rendered fresh at 512×512 for an app store listing',
          'A logo exported onto white for a print shop that cannot take SVG',
          'A diagram scaled 4× for a slide deck without blur',
          'An avatar square-cropped by aspect-locked resizing',
        ],
      },
      {
        heading: 'What happens to your file',
        paragraphs: [
          'Parsing, sanitizing, rendering and encoding all happen in this tab. The markup and the output bitmap never leave the device — there is no upload step to trust, because there is no upload.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- cipher
  cipher: {
    lede: [
      'Cipher Studio puts the four classical letter ciphers — ROT13, Caesar, Atbash and Vigenère — in one box, with the one feature that makes Caesar actually useful: a brute-force view that shows all 25 shifts at once, so an unknown shift is read, not guessed.',
      'Case and punctuation survive every transform. Letters transform, everything else passes through, and the output reads like the input — which is exactly what makes a decoded message readable instead of a chore.',
    ],
    sections: [
      {
        heading: 'The four ciphers, precisely',
        paragraphs: [
          'ROT13 shifts letters by thirteen — the forum-spoiler classic, self-inverse, so the same button encodes and decodes. Caesar takes any shift 1–25 with an encode/decode toggle. Atbash mirrors the alphabet, A to Z and Z to A, also self-inverse. Vigenère uses a repeating key with the full tabula recta — the A=0 convention — encoding and decoding with key positions that survive punctuation, the way the cipher is actually specified.',
          'The brute-force panel is the part most Caesar pages skip: all 25 shifts of your input, listed as rows, with the row matching your current shift highlighted. If you paste a message of unknown shift, you do not need to know the shift — you read down the rows until English appears.',
          'These ciphers are math on letters, not security. They are for spoilers, puzzles, games and teaching — the page does not pretend otherwise, and that honesty is the point.',
        ],
      },
      {
        heading: 'Where this is actually used',
        paragraphs: [
          'Classical ciphers refuse to die because they are the right tool for tiny jobs: hiding a punchline below the fold, running a puzzle for a classroom, exchanging not-really-secret notes for fun, or teaching a child how a shift cipher works with sliders they can move.',
        ],
        list: [
          'Decode the ROT13 spoiler without a browser extension or a search',
          'Solve a puzzle-hunt clue that says "Caesar, unknown shift" in one paste',
          'Teach what Vigenère does by typing the same message with different keys',
          'Encode a message atbash-style for a game or a kid\u2019s treasure hunt',
        ],
      },
      {
        heading: 'What happens to your text',
        paragraphs: [
          'The transforms are arithmetic on character codes, done in this tab as you type. Nothing is sent anywhere — there is not even an interesting reason to send it. The output copies in one click.',
        ],
      },
    ],
  },

  // --------------------------------------------------------------- due-date
  'due-date': {
    lede: [
      'Due Date Estimator does the arithmetic a clinic does: from the first day of the last period it adds 280 days — Naegele\u2019s rule — adjusted for your actual cycle length; from a known conception date it adds 266 days. Then it fills in the rest of the picture: weeks pregnant today, trimester, days remaining, and the standard milestones as real dates.',
      'The framing is the feature: this is an estimate, not a prediction, and not medical advice. The page says so where you can see it, because a due date is a midpoint of a range, not a deadline.',
    ],
    sections: [
      {
        heading: 'How the estimate is computed',
        paragraphs: [
          'The last-period mode adds 280 days to the LMP date and shifts by your cycle length minus 28 — a 32-day cycle moves the estimate four days later, and the page says by how much. The conception mode adds 266 days, and keeps gestational age consistent by anchoring to a notional LMP two weeks earlier, so the weeks-and-days figure matches the obstetric convention instead of contradicting it.',
          'Pure date arithmetic drives everything — no month-length hand-waving — so a date picked today and the same date picked next month produce the same estimate, and the milestones land where the math says they do: end of the first trimester at week 12, halfway at 20, viability at 24, early term at 37, due at 40.',
        ],
      },
      {
        heading: 'What the progress view tells you',
        paragraphs: [
          'The card computes gestational age today — weeks and days — the current trimester, days remaining, and a progress bar across the 280 days. Edge states are handled honestly: a future LMP is flagged rather than producing negative weeks, the due date itself gets its own state, and past-42-weeks is called what it is instead of looping the counter.',
          'The honest context line matters: roughly 80% of births happen between week 37 and week 42. A due date is the center of a five-week window, and treating it as a deadline is how unnecessary anxiety gets manufactured.',
        ],
      },
      {
        heading: 'What this page is not',
        paragraphs: [
          'It is not a medical device and not medical advice. Ultrasound dating in the first trimester is more accurate than LMP arithmetic; individual cycles vary; and decisions belong to you and your clinician. Use the estimate to frame a conversation, not to replace one — that sentence is on the tool page on purpose.',
          'Nothing about a pregnancy date is sensitive enough to deserve an upload, and nothing about it is uploaded here: the dates are picked, the arithmetic runs in this tab, and the page remembers nothing when it closes.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------- word-frequency
  'word-frequency': {
    lede: [
      'Word Frequency & Readability shows a piece of writing the way a search engine and a reading teacher see it: which words dominate, how concentrated they are, and how hard the text is to read — with the numbers computed from your actual words, not vibes.',
      'The keyword table sorts live by count with a stopword switch; the totals row frames it with words, unique words, sentences, average sentence length and reading time; and two real formulas — Flesch reading ease and Flesch-Kincaid grade level — turn syllable counts into scores.',
    ],
    sections: [
      {
        heading: 'Keyword density, honestly',
        paragraphs: [
          'Density is count divided by total words — no mysticism. The table shows the top 20 words with their count and their share of the text, and the common-words switch filters the the-and-of layer to expose the content words that carry meaning. It defaults to off: you see everything first, then narrow.',
          'Tokenization is Unicode-aware and contraction-respecting — "don\u2019t" is one word, not "don" and a stray "t" — which keeps the counts honest for real prose instead of clean test sentences.',
        ],
      },
      {
        heading: 'Readability, the real formulas',
        paragraphs: [
          'Flesch reading ease combines two ratios — words per sentence and syllables per word — into the 0–100-ish score teachers and plain-language laws actually cite: 206.835 minus 1.015 times words-per-sentence minus 84.6 times syllables-per-word. The label bins are the standard ones, from Very easy down to Very difficult, and a score that escapes the range is shown raw with an honest note.',
          'Flesch-Kincaid grade level uses the same ingredients in school terms: 0.39 times words-per-sentence plus 11.8 times syllables-per-word minus 15.59, read as "a grade-N student can follow this". Together the two scores tell you whether your writing matches its audience — and which lever (shorter sentences, shorter words) moves it.',
          'The syllable heuristic is a real one: vowel groups per word, a silent trailing e removed, a minimum of one. English pronunciation will beat any heuristic eventually — the page would rather do the honest 95% than fake 100%.',
        ],
      },
      {
        heading: 'Who this is for',
        paragraphs: [
          'Anyone whose writing has a reader with expectations: a blog post aimed at actual humans, a privacy policy that legally must be plain-language, an essay being edited down, an SEO pass checking that a page does not repeat one phrase into absurdity, or a teacher showing students what their own writing scores.',
        ],
        list: [
          'Check a blog draft before publishing — sentence length is the usual offender',
          'Audit keyword density after a round of SEO edits',
          'Bring a policy or manual down to plain-language reading ease',
          'Show a class how word choice moves a readability score',
        ],
      },
      {
        heading: 'What happens to your text',
        paragraphs: [
          'The analysis is counting and arithmetic, run in this tab on every keystroke. Drafts, unpublished posts and confidential prose stay exactly where they were pasted — there is no upload step to trust, because there is no upload.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ vcard
  vcard: {
    lede: [
      'vCard & QR turns a typed contact into the two artifacts phones actually accept: a real vCard 3.0 file downloaded as .vcf that any address book imports with a double-click, and a QR code of the same card that another phone scans to save the contact without anyone typing on a glass keyboard.',
      'The preview shows the exact vCard text as you type, fields emit only when filled, values escape per the spec, and UTF-8 names survive intact — the details that separate a card that works from one that imports as garbage.',
    ],
    sections: [
      {
        heading: 'Why vCard still matters',
        paragraphs: [
          'Every contact exchange eventually meets the same wall: reading twenty fields aloud across a table, emailing yourself a half-typed card, or a photo of a business card nobody will ever transcribe. The vCard format solves it — it is the one interchange format every phone, mail client and address book has spoken for decades.',
          'The QR is the modern delivery: the card itself, encoded as an image the other phone scans with its camera app. No app install, no network at the moment of exchange, no account on either side — just a picture that means a contact.',
        ],
      },
      {
        heading: 'The details done right',
        paragraphs: [
          'Only filled fields are emitted — a card with a name and a phone does not carry empty TITLE and URL lines that some clients render as garbage. Commas, semicolons and backslashes in values escape per RFC so a company named "A, B & C" does not break the parser. The name field splits into the structured N and formatted FN correctly, which is where naive generators produce contacts that sort wrong forever.',
          'The QR regenerates with a short debounce as you edit, sized for phone cameras, with the honest tip on the page: a card this dense scans reliably at about 3 cm printed — smaller and camera shake starts winning.',
        ],
      },
      {
        heading: 'Where it earns its keep',
        paragraphs: [
          'The card is built and encoded entirely in this tab: your contact details are never sent anywhere, which matters exactly because contact details are the thing everyone is careful about pasting into websites.',
        ],
        list: [
          'A conference badge or email-signature QR that carries your real card',
          'A printed .vcf on the back of a small business card run',
          'A team onboarding page where new hires scan one QR for the team lead',
          'A personal card you keep at a known URL, reprinted when the phone changes',
        ],
      },
    ],
  },

  // ----------------------------------------------------------- calendar-link
  'calendar-link': {
    lede: [
      'Calendar Links & .ics takes one event and produces the three deep links everyone actually clicks — Google Calendar, Outlook.com and Yahoo — plus an RFC 5545 .ics file with real escaping and line folding that works in Apple Calendar, Thunderbird and everything else that speaks the standard.',
      'The failure this page exists to prevent is subtle: most hand-rolled calendar links work for the author\u2019s provider and time zone and quietly break for everyone else — off by an hour, or an all-day event that spans two days.',
    ],
    sections: [
      {
        heading: 'What each format gets right here',
        paragraphs: [
          'Google receives the TEMPLATE action with UTC timestamps; Outlook.com receives ISO start and end instants; Yahoo receives its own st/et parameter format. All-day events switch semantics per provider: Google takes plain dates with an exclusive end day, Outlook takes allday=true with date strings, Yahoo takes date bounds — three different conventions, each implemented the way that provider actually documents, not guessed.',
          'The .ics preview is the real file, not a mock: PRODID and VERSION, a deterministic UID built from the event (so re-downloading a corrected event replaces the old one instead of duplicating it), DTSTART and DTEND, and the text fields escaped per RFC 5545 — commas, semicolons and newlines — with 75-octet line folding implemented for real, because a long description that unfolds wrong in Apple Calendar is the classic silent failure.',
        ],
      },
      {
        heading: 'Where this earns its keep',
        paragraphs: [
          'Any "add to calendar" moment on a page you control: an event announcement, a webinar confirmation, a community meetup, a payment-due reminder, a launch stream. You type the event once; every audience member gets their own provider\u2019s flow, which is the only kind of calendar button people actually click.',
        ],
        list: [
          'A webinar confirmation email with all three links plus the .ics attachment',
          'A community event page where Google, Outlook and Apple users coexist',
          'A personal reminder file for a calendar app that speaks iCal',
          'A recurring manual need: generate the same event with new dates each month',
        ],
      },
      {
        heading: 'What happens to your event',
        paragraphs: [
          'The links are built and the file is generated in this tab — the event details go into a URL you copy or a file you download, and into nothing else. No analytics page sees the title of your meeting, because no request is made with it.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- px-rem
  'px-rem': {
    lede: [
      'px ⇄ rem Converter shows all four CSS units at once — px, rem, em and % — against a configurable root size and a separate em context, because rem depends on the root and em depends on the element\u2019s context and pretending otherwise is how layouts drift.',
      'The clamp() builder rounds it out: minimum, ideal and maximum become a copyable fluid-type declaration, with the honest warning about what the browser does (or rather does not do) when the bounds are inverted.',
    ],
    sections: [
      {
        heading: 'Why one number is not enough',
        paragraphs: [
          '16px is 1rem only when the root is 16px — and accessibility tooling changes the root, which is the entire point of rem. em compounds on context, which makes it powerful for spacing and treacherous for sizes. A converter that silently assumes root 16 tells the truth for a project you are not working on.',
          'So the root size is an input (default 16, one click away), the em context is a second input, and every answer recomputes live: type 24 and read 1.5 rem, 1.5 em at context 16, and 150% — the four numbers a real stylesheet needs, not just the one the converter prefers.',
          'The quick-reference grid — 4, 8, 12, 16, 24, 32, 48, 64, 96 pixels — re-derives with the root, because the grid exists to be glanced at while styling, not calculated once.',
        ],
      },
      {
        heading: 'The clamp() builder',
        paragraphs: [
          'Fluid type is clamp(min, ideal, max): the declaration every design system now ships. The builder takes the three bounds in any unit, emits the CSS string, and copies it in one click. When the bounds are inverted — min above max — the page warns plainly that the browser will not interpolate, instead of emitting a declaration that silently freezes.',
        ],
        list: [
          'Convert a designer\u2019s pixel spec into rem for a component library',
          'Check what an em-based spacing value becomes at a nested context',
          'Build the h1 clamp() once and reuse it across a whole site',
          'Sanity-check that a 1.25rem line-height matches the px your reviewer expects',
        ],
      },
      {
        heading: 'What happens to your numbers',
        paragraphs: [
          'The conversion is division, in this tab, per keystroke. There is nothing to upload, nothing to remember, and no account — a calculator that respects the CSS spec and your attention.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- binary
  binary: {
    lede: [
      'Binary & Hex Text Converter is a two-pane translator that goes both ways live: type text and read its bytes, or paste bytes and read the text. Binary, hexadecimal, octal and decimal bases; UTF-8 with honest multi-byte counts, or strict ASCII that names the first out-of-range character and its position.',
      'There is no mode toggle to get wrong: whichever pane you type in is the input, and the other pane updates. That is the whole interface — the way a converter should have always worked.',
    ],
    sections: [
      {
        heading: 'The encoding story, told straight',
        paragraphs: [
          'UTF-8 mode encodes the full Unicode range — an emoji is four bytes and the byte count says so; a CJK character is three. ASCII mode is strict on purpose: a character above 127 is rejected with the exact character and its 1-based position, because the useful answer to "why did this fail" is "position 3 is é, switch to UTF-8", not a dead pane.',
          'The reverse direction is where most converters quietly lie: not every byte sequence is valid UTF-8, and decoding garbage into mojibake helps nobody. This one validates the sequence and reports the first bad byte instead of printing replacement characters and calling it a day.',
          'Grouping is forgiving because real-world bytes arrive messy: spaces, newlines, commas and 0x prefixes all parse. Hex accepts mixed case; binary rejects anything that is not 0 or 1, naming where.',
        ],
      },
      {
        heading: 'Who uses this and why',
        paragraphs: [
          'The audience is everyone who meets bytes at the boundary: developers reading protocol dumps, students learning that "Hi" is 01001000 01101001 and why, embedded folks pasting hex from a datasheet, a writer decoding a puzzle, or anyone inspecting what a "plain text" file really contains.',
        ],
        list: [
          'Decode a binary string from a puzzle or a game without a character table',
          'Check what bytes a special character actually produces in UTF-8',
          'Turn a hex dump fragment back into the text it was',
          'Teach or learn ASCII by typing words and watching the bits',
        ],
      },
      {
        heading: 'What happens to your bytes',
        paragraphs: [
          'The conversion is TextEncoder and TextDecoder — the browser\u2019s own, spec-exact — running in this tab on every keystroke. Secrets pasted as hex stay in the tab; nothing is transmitted, stored or logged.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------ sound-tools
  'sound-tools': {
    lede: [
      'Sound Tools puts four audio utilities on one page: a decibel meter, a tone generator, a guitar tuner and a metronome. They share one design rule — every audio resource is created when you press start and closed the moment you stop, so nothing keeps listening, playing or running after you leave a mode.',
      'The microphone modes analyse the stream in memory, in real time, and never record: there is no buffer kept, no file written, no upload path in the code at all. You can verify it in the browser\u2019s network tab — the page has nothing to send audio to.',
    ],
    sections: [
      {
        heading: 'The dB meter, calibrated honestly',
        paragraphs: [
          'A microphone measures pressure; a meter wants a calibrated reference. The raw number here is dBFS — decibels relative to digital full scale — which is real and repeatable for your device. The displayed figure adds a calibration offset (default 100) so conversational speech lands near 60 dBA on typical built-in microphones. Hold a real SPL meter next to the mic once, slide the offset until they agree, and the estimate becomes genuinely useful for that room.',
          'The meter tracks peak, running average and min/max since start, with a bar scaled from 30 to 130 dBA. What it refuses to do is pretend a laptop mic is a Class-2 instrument — the page keeps the “estimate” label because the honest number you can calibrate beats a precise one you cannot.',
        ],
      },
      {
        heading: 'Tone generator and guitar tuner',
        paragraphs: [
          'The tone generator sweeps 20 Hz to 20 kHz on a log scale — one decade per third of the slider, the way hearing tests present frequency — in sine, square, sawtooth or triangle, with the nearest note name shown. Gain changes ramp on the audio clock, so there are no clicks when you start, stop or slide.',
          'The tuner detects pitch by trimmed autocorrelation: gate on signal level, trim the quiet head and tail, correlate the waveform against itself, and parabolic-interpolate the strongest peak. That yields a frequency, which maps onto the chromatic scale with a cents needle from −50 flat to +50 sharp, and the standard-tuning reference (E2 82.41 Hz up to E4 329.63 Hz) highlights the string you are closest to. It needs a clean single pitch — pluck one open string and let it ring.',
        ],
      },
      {
        heading: 'Why the metronome does not drift',
        paragraphs: [
          'Naive metronomes schedule clicks with setTimeout, and the beat wanders the moment the browser throttles timers. This one runs a 25 ms look-ahead loop that queues every click on the AudioContext clock ahead of time — the same discipline the morse player uses — so the tempo stays true even when the tab is busy. Accenting the first beat, 2/3/4/6/8 beats per bar and tap tempo (average of your last four taps) are all there.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------- tts
  tts: {
    lede: [
      'Text to Speech Reader speaks any text through your browser\u2019s own voices — the ones your operating system already ships, nothing downloaded, nothing uploaded. Voice, rate, pitch and volume are yours to set, and pause, resume and stop actually control the audio clock.',
      'The design problem worth explaining is length: browsers silently truncate or stall a single long utterance, so pasting a whole article into one speak() call fails in a way you cannot see. This tool splits text into sentence-bounded chunks, queues them in order, highlights the one being spoken, and shows real progress — chunk 3 of 9 — so playback is stable and inspectable.',
    ],
    sections: [
      {
        heading: 'How the chunking works',
        paragraphs: [
          'Text splits on sentence boundaries (periods, question marks, exclamation points, line breaks) and accumulates sentences up to about 220 characters per chunk; a pathological single sentence longer than the cap is hard-split. Each chunk becomes its own utterance, and the queue advances on each utterance\u2019s own end event — which is why pause and stop land cleanly between sentences instead of mid-word.',
          'The chunk list is visible before you press play, so you can see exactly what will be spoken and in what order. The highlighted line follows playback live.',
        ],
      },
      {
        heading: 'Who reads with this',
        paragraphs: [
          'Proofreaders — the ear catches repeated words, missing commas and sentences that never end, which the eye slides past. Students listening to notes while commuting. Writers hearing how their prose actually sounds. Anyone whose eyes are tired at the end of a long document.',
        ],
        list: [
          'Proofread an essay or email by listening at 0.8×',
          'Get through a long article hands-free at 1.5×',
          'Hear how a piece of writing flows before you publish it',
          'Rest your eyes while keeping up with a report',
        ],
      },
      {
        heading: 'Honest about the limits',
        paragraphs: [
          'Voice quality is whatever your OS provides — the tool prefers a local English voice and labels network voices, which can be slower and stop working offline. If the browser has no Web Speech API, or no voices are installed, the page says exactly that instead of showing a play button that does nothing. And nothing is sent anywhere: the engine runs on your device, the text never leaves the tab.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------- fuel-cost
  'fuel-cost': {
    lede: [
      'Trip Fuel Cost Calculator answers the question every road trip starts with: what will the fuel actually cost, and what does each person owe? Distance, efficiency and price, each in the units you already think in — km or miles, L/100km or km/L or MPG (US/UK), price per liter or per gallon — with an even passenger split and a round-trip toggle.',
      'The reason it accepts all those units without getting one wrong is a single design decision: everything normalizes internally to liters per kilometer and currency per liter. Your input is converted once, at the boundary, and the arithmetic after that is plain multiplication you can check by hand.',
    ],
    sections: [
      {
        heading: 'The unit trap this tool avoids',
        paragraphs: [
          'MPG is where most calculators lie. A US gallon is 3.79 liters and a UK (imperial) gallon is 4.55 — the same “35 MPG” is two different cars. Worse, MPG and L/100km are reciprocally related, so “twice the MPG” is not “half the consumption”: going from 25 to 50 MPG saves more fuel per km than going from 50 to 100. The equivalence line shows your figure in all three systems side by side, with the gallon caveat printed.',
          'Mile distances work the same way — the trip length is converted once and the vehicle\u2019s efficiency belongs to the vehicle, not the trip.',
        ],
      },
      {
        heading: 'What the outputs mean',
        paragraphs: [
          'Fuel needed is liters (the internal currency), shown to two decimals. Total cost multiplies through your chosen price. The per-km (or per-mile) figure is the one to compare vehicles, routes or driving styles with. The per-passenger split assumes everyone rides the same distance — fair for a road trip, and stated so you can decide.',
        ],
        list: [
          'Split a trip\u2019s petrol evenly before you leave',
          'Compare two cars\u2019 real cost per km, not their brochures',
          'Budget a road trip including the drive back',
          'Decode what your car\u2019s L/100km means in MPG, or the reverse',
        ],
      },
      {
        heading: 'Where the number meets reality',
        paragraphs: [
          'Real consumption climbs with highway speed, headwinds, roof boxes, cold starts, short trips and air conditioning — planning figures from the brochure assume ideal conditions. Treat the result as the center of a range and budget 10–15% above it for loaded cars at 120 km/h.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- salary
  salary: {
    lede: [
      'Salary Converter turns one number in one pay frequency into the whole table — hourly, daily, weekly, two-weekly, monthly and annual — and prints the exact pipeline it used, so every figure is checkable instead of magical.',
      'Two details it refuses to skip. Unpaid break minutes shrink the paid shift before anything is annualized (a 60-minute lunch in an 8-hour shift is 7 paid hours, and “annual salary” built on 8 would overstate it by more than 12%). And overtime enters at its multiplier on top of the base, not folded invisibly into the rate.',
    ],
    sections: [
      {
        heading: 'The pipeline, in order',
        paragraphs: [
          'Paid shift = shift hours minus unpaid break. Paid week = paid shift times days per week. Base annual = your amount annualized through its own frequency (hourly uses paid hours times weeks per year; monthly times twelve; and so on). Overtime annual = hourly rate times multiplier times OT hours times weeks. Every row in the table derives from that one annual figure — no rounding drift between rows, because there is one source of truth.',
          'The weeks-per-year input is not decoration: teachers on 40-week contracts, seasonal workers and contractors with unpaid time off all break the default 52, and a converter that hardcodes 52 quietly lies to them.',
        ],
      },
      {
        heading: 'Why there is no “take-home” estimate',
        paragraphs: [
          'Net pay depends on income tax brackets, social contributions, local surcharges, benefit deductions, retirement contributions and filing status — dozens of parameters that change every year and every jurisdiction. A converter that guesses them prints a confident-looking number that is wrong in ways you cannot audit. This tool states the honest boundary: everything here is gross and pre-tax, and the page says so on the table itself.',
        ],
      },
      {
        heading: 'Where it earns its keep',
        paragraphs: [
          'Comparing a salaried offer with a contract rate; checking that an overtime-heavy month is actually paid correctly; converting a freelancer\u2019s day rate into the annual it implies; sanity-checking what an unpaid break is really costing across a year.',
        ],
        list: [
          'Compare a job offer stated yearly with your current hourly rate',
          'Price a freelance day rate against a salaried month',
          'See what unpaid lunch breaks cost over a year',
          'Check overtime math before payday does',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ sleep
  sleep: {
    lede: [
      'Sleep Cycle Calculator plans bedtimes and alarms around the 90-minute sleep cycle — the standard heuristic that waking at the end of a cycle feels easier than waking from deep sleep mid-cycle. Tell it when your alarm rings and read the bedtimes that complete 3 to 6 cycles before it, or say “going to bed now” and read the alarm times that land between cycles.',
      'The model is simple and stated openly: add your fall-asleep latency (default 15 minutes), add or subtract whole 90-minute cycles, and rank the results — six cycles marked as the most-rested target, three as the shortest suggestion.',
    ],
    sections: [
      {
        heading: 'The two directions',
        paragraphs: [
          'Wake-at mode anchors on your alarm: bedtimes are alarm minus (cycles × 90 min) minus latency, wrapping past midnight cleanly — a 07:00 alarm suggests 21:45 for six cycles, 23:15 for five, 00:45 for four, 02:15 for three. Sleep-now mode anchors on lights-out: alarm times are lights-out plus latency plus whole cycles, for the nights you simply want to know when to set the alarm.',
          'The latency input matters more than people expect: if you typically take 30 minutes to fall asleep, a “six cycles” bedtime calculated without it is really five and a bit cycles in practice.',
        ],
      },
      {
        heading: 'The honesty section',
        paragraphs: [
          'Ninety minutes is a population average — individual cycles run roughly 80 to 110 minutes and vary night to night, and the stages inside a cycle shift across the night. The times here are a planning aid built on the standard heuristic, useful for deciding between a 23:00 and a 23:45 bedtime, not a medical instrument. Persistent sleep problems — trouble falling asleep, waking unrefreshed on a full schedule, snoring with gaps — belong with a doctor.',
        ],
        list: [
          'Pick a bedtime that completes whole cycles before a fixed alarm',
          'Set an alarm that lands between cycles after a late night',
          'Adjust for how long you actually take to fall asleep',
          'Plan a short night deliberately instead of accidentally',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- pace
  pace: {
    lede: [
      'Running Pace Calculator turns one run — a distance and a time — into pace per km and per mile, speed in both units, an even-pace splits table, and race-time predictions from 5K to marathon by Riegel\u2019s formula.',
      'The predictions use T₂ = T₁ × (D₂/D₁)^1.06, Peter Riegel\u2019s 1977 fit across real performances. It is the standard because it works across distances for trained runners — and it deserves the caveat it gets here: it assumes your training scales with the target distance. A 25-minute 5K projects about 3:59 for a marathon, but only for someone who has actually run the long runs.',
    ],
    sections: [
      {
        heading: 'Pace, speed and splits',
        paragraphs: [
          'Pace is time per unit distance (minutes and seconds per km, and per mile for the treadmill-bound); speed is its reciprocal in km/h and mph. The splits table walks the run at even pace, showing elapsed time at every full kilometer or mile plus the final partial — the reference line to check a real race against. Negative-splitting a race changes the finish time, not this table\u2019s usefulness as a pacing baseline.',
        ],
      },
      {
        heading: 'Using the prediction table honestly',
        paragraphs: [
          'The table predicts 5K, 10K, half marathon and marathon from your input run, each with its projected per-km pace. Long predictions are the least reliable: the exponent was fitted on trained racers, so a 5K alone under-predicts a marathon for a runner without long-run volume. The right use is directional — “is my goal marathon pace realistic given my half?” — not a promise.',
        ],
        list: [
          'Find the pace to hold for a goal race time',
          'Check whether a marathon goal matches your half marathon',
          'Build an even-pace splits plan for race day',
          'Convert treadmill speed (km/h) to outdoor pace',
        ],
      },
    ],
  },

  // ------------------------------------------------------------ one-rep-max
  'one-rep-max': {
    lede: [
      'One Rep Max Calculator estimates the most you could lift once, from a set you can already do: enter the weight and reps and read four published formulas side by side — Epley, Brzycki, Lander and Lombardi — plus a consensus that averages the three the evidence favors.',
      'Showing the formulas together is the point. They agree tightly at one to six reps and drift apart as reps climb — by twelve reps the spread can exceed ten percent of the answer. A calculator that shows only one formula hides that disagreement; this one puts it on the page and anchors programming to the consensus.',
    ],
    sections: [
      {
        heading: 'The formulas, and why they differ',
        paragraphs: [
          'Epley (w × (1 + r/30)) is the 1985 classic, linear in reps. Brzycki (w × 36 / (37 − r)) decays faster at high reps and tracks fatigue accumulation better there. Lander is close to Brzycki; Lombardi\u2019s power law (w × r^0.10) is the outlier that runs hot on short sets. All were fitted on real lifters doing real reps-to-failure — none is truth, and the truth varies by lift and by person (fatigue resistance differs between a squat and a bench).',
          'The consensus averages Epley, Brzycki and Lander, which cluster around the middle of the pack, and the training table uses it.',
        ],
      },
      {
        heading: 'Programming from the percentage table',
        paragraphs: [
          'The table maps percentages of the consensus to loads and the reps they typically allow: 95% for heavy doubles, 90% for strength fours, 85% for strength-hypertrophy sixes, 80% for the classic eights, 75% for tens, 70% for twelves, 60% for endurance and technique work. Percent-of-1RM programming exists precisely so loads scale automatically as the max moves — re-test, and the whole table shifts with it.',
        ],
        list: [
          'Set training loads without ever testing a true 1RM',
          'Check whether a rep-out PR implies the max you think it does',
          'Compare strength across bodyweight with kg and lb support',
          'Program strength blocks (90%+) and hypertrophy blocks (70–80%) from one number',
        ],
      },
      {
        heading: 'The safety line',
        paragraphs: [
          'An estimate is not a measured max. Testing a true 1RM is a skill — warm-up ramping, bar speed judgment, a spotter or safety pins — and fatigue, sleep and readiness move it day to day. For programming, the estimate from a hard set of 3–5 reps is as good as a max test and considerably safer; the page prints that, because it is the part that actually prevents injuries.',
        ],
      },
    ],
  },

  // --------------------------------------------------------------- fraction
  fraction: {
    lede: [
      'Fraction Calculator does the four operations on two fractions and shows every step it took: the LCD rewrite for addition and subtraction, the cross products for multiplication, keep-change-flip for division, and the GCD that reduced the result. The answer arrives four ways — unreduced, reduced, as a mixed number, and as a decimal — because homework, recipes and shop drawings all ask in different languages.',
      'A converter sits alongside: fraction to decimal by real long division with repeat detection (1/7 prints 0.(142857), the digits in parentheses looping forever), and decimal to fraction that is exact up to eight places and honestly labelled approximate beyond.',
    ],
    sections: [
      {
        heading: 'Why the steps are the product',
        paragraphs: [
          'An answer without steps teaches nothing and checks nothing. The printed steps show the least common multiple that aligns denominators, the multipliers each fraction needed, the exact integer arithmetic over that LCD, and the Euclidean GCD that reduced the result — which is precisely the sequence a student is being graded on reproducing. For the cook scaling a recipe, the mixed number (1 7/12 cups) is the usable form; the reduced improper fraction (19/12) is the canonical one.',
        ],
      },
      {
        heading: 'Terminating, repeating, and the honest approximation',
        paragraphs: [
          'A fraction of integers always produces a decimal that terminates or repeats — that is what a rational number is. The long-division engine detects the repeat by watching remainders: the first remainder seen twice marks the start of the cycle, so 1/7 yields 0.(142857) exactly rather than a truncated prefix pretending to be the whole answer. Decimal to fraction runs the reverse: place value makes it exact through eight decimal places, and longer decimals get the closest small-denominator fraction with the error stated, because a fifteen-digit decimal usually is not exactly any short fraction.',
        ],
        list: [
          'Check homework with the full worked steps visible',
          'Scale recipe quantities that arrive as fractions',
          'Convert 0.375 or 1/7 exactly, repeats included',
          'Reduce 15/24 to 5/8 and see the GCD that did it',
        ],
      },
      {
        heading: 'Exact arithmetic',
        paragraphs: [
          'Everything runs on integer arithmetic with inputs clamped below 2^53, so products of numerators and denominators never round — the answer is exact, not a float that happens to print cleanly. Division by the zero fraction is named and refused, not silently answered with Infinity.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------- quadratic
  quadratic: {
    lede: [
      'Quadratic Equation Solver answers ax² + bx + c = 0 completely: the discriminant, both roots (real, repeated, or complex conjugates stated as such), the vertex with its axis of symmetry, the opening direction, and the factored form when the roots print cleanly — with the worked steps substituting your actual numbers into D = b² − 4ac and the quadratic formula.',
      'It also draws the parabola. An SVG plot samples the function, auto-scales around the vertex so the interesting region fills the frame, and marks the roots where they cross the axis — so the algebra and the shape can be checked against each other in one glance, which is how the concepts actually stick.',
    ],
    sections: [
      {
        heading: 'What the discriminant decides',
        paragraphs: [
          'D = b² − 4ac sorts every quadratic into three families before any root is computed: D > 0 gives two distinct real roots where the parabola crosses the axis twice; D = 0 gives one repeated root — the vertex touching the axis; D < 0 gives complex conjugates a ± bi, which is the mathematically correct answer and the page\u2019s wording, never “no solution”. The nature line appears next to the discriminant itself, so the sign and its consequence are read together.',
        ],
      },
      {
        heading: 'Vertex, factoring, and when factoring is refused',
        paragraphs: [
          'The vertex sits at x = −b/2a with y = c − b²/4a, printed with the axis of symmetry and whether it is a minimum (a > 0) or maximum (a < 0). The factored form prints when both roots are clean at three decimals — (x − 1)(x − 2) for the default 1, −3, 2 — and the tool says why it refuses when it must: irrational roots (D not a perfect square) and complex roots are named as such rather than forced into a fake factorization. The y-intercept (0, c) is on the same card.',
        ],
        list: [
          'Check algebra homework against steps, not just answers',
          'See which quadratics factor and which need the formula',
          'Read the vertex form from the vertex card directly',
          'Connect the roots you computed to where the curve actually crosses',
        ],
      },
      {
        heading: 'The plot is the same math',
        paragraphs: [
          'The SVG samples 200 points of your actual coefficients and rescales both axes around the vertex — it is not a stock picture. Roots are drawn only when they are real, the vertex dot is the same (−b/2a, c − b²/4a) the card prints, and when the roots move because you typed new coefficients, the drawing moves with them. Everything is computed and drawn in this tab per keystroke.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------- spreadsheet
  spreadsheet: {
    lede: [
      'Spreadsheet Studio is a working spreadsheet in a browser tab: open an .xlsx, .xls or .csv file — or start on the demo sheet — and edit cells with a formula bar, run real formulas, sort, pivot, find-and-replace, then export back to xlsx or csv.',
      'The difference from every "online Excel viewer" is architectural: those sites receive your file on a server that parses it, renders it and remembers it. Here the file is read into the tab, parsed by SheetJS on your CPU, recalculated on every edit, and written back out as a download. There is no upload code on this page at all.',
    ],
    sections: [
      {
        heading: 'The formula engine, honestly labeled',
        paragraphs: [
          'This is a lite engine, not Excel: it evaluates cell references (A1), ranges (A1:B5), arithmetic with correct precedence and parentheses, and the functions SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, ROUND and ABS. That covers budgets, invoices, grade sheets, inventory tallies and most personal-finance math — which is exactly the honest scope the page states.',
          'When something is wrong, the cell says so in Excel grammar: #REF! for a reference outside the sheet, #DIV/0! for division by zero, #VALUE! for text where a number was required, #CIRC! for a formula that references itself. Errors are information, not noise — they tell you which assumption broke.',
          'Recalculation runs over the whole sheet on every commit. A 2000-row sheet recomputes in milliseconds, which is why there is no "recalculate" button to forget.',
        ],
      },
      {
        heading: 'The workflow tools around the grid',
        paragraphs: [
          'Sorting is numeric-aware (text sorts lexicographically, numbers by value) and one click per column letter — with the honest caveat printed on the page that formulas move with their rows but references are not rewritten, so re-sorting a sheet of cross-referencing formulas will not re-point them.',
          'The pivot panel answers the question most spreadsheets are opened for: group rows by one column, aggregate another by sum, average, count, min or max. No drag-and-drop field choreography — two selects and the summary table appears.',
          'Find and replace handles plain text or regular expressions with capture groups, reports how many cells changed, and matches raw stored content (a formula cell matches its formula, not its result).',
        ],
      },
      {
        heading: 'Files in, files out',
        paragraphs: [
          'Multi-sheet workbooks open as tabs with dimensions shown. Export writes a real .xlsx (which desktop Excel opens without complaint) or a .csv of the active sheet. The round-trip is the point: receive a workbook in email, fix three cells, send it back — on a borrowed laptop, a phone, or a work machine where installing software is not an option.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------- chart-maker
  'chart-maker': {
    lede: [
      'Chart Maker turns a pasted table into a finished chart: grouped bars, lines, filled areas, pie, donut or scatter, with editable titles, axes, legend and grid — exported as PNG or SVG with no watermark and no account.',
      'The chart is not a library component dropped in and themed; it is drawn by a hand-written SVG engine on this page — the same approach used by the parabola plotter and the pace projector. That means every bar, point and slice carries the real number behind it as its tooltip, and the export contains exactly what you see.',
    ],
    sections: [
      {
        heading: 'Data in, any shape',
        paragraphs: [
          'Paste from any spreadsheet: commas, tabs or semicolons are detected, the first column becomes the category axis, and every further column becomes a series you can show or hide independently. Percent signs and thousands separators are cleaned from numbers automatically, so pasted accounting formats just work.',
          'The stats strip under the chart gives each series its n, sum, average and range — the sanity check that catches the one mistyped cell before it becomes the wrong slide in a board meeting.',
        ],
      },
      {
        heading: 'Picking the right chart',
        paragraphs: [
          'Bars compare categories against each other. Lines show a trend across ordered labels. Areas emphasize volume over time. Pie and donut show one series as parts of a whole — the donut prints its total in the middle, and slices under 4.5% hide their labels rather than overlap them. Scatter plots get real numeric axes on both dimensions with the first fully-numeric column as X.',
          'Axis bounds are automatic by default, computed with a nice-ticks algorithm that lands on readable steps; when an exact scale matters — a percent axis pinned at 0–100, or matching two charts for comparison — type the bounds in and they are respected exactly.',
        ],
      },
      {
        heading: 'Export that holds up',
        paragraphs: [
          'PNG exports render at 2× for retina screens and slide decks; SVG exports are resolution-independent for print, posters and editing in any vector tool. Both come from the same drawing, so what you previewed is what ships. Everything renders in this tab — the data you paste never leaves the device.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- resume
  resume: {
    lede: [
      'Resume Builder is a full editor with a live A4 preview: header and contacts, summary, experience with reorderable bullets, education, skills and projects — themed, autosaved to your browser, and exported through your own browser\u2019s print pipeline to a pixel-perfect PDF.',
      'The privacy model is the product: nothing uploads, ever. Resumes are the most sensitive documents people casually paste into websites, and every "free resume builder" that harvests them knows it. Here the draft lives in localStorage, the PDF is made by the browser you are reading this in, and there is no account to delete because there was never an account.',
    ],
    sections: [
      {
        heading: 'Why the preview is real A4',
        paragraphs: [
          'The preview is a genuine 210×297 mm document scaled to fit the screen — not an approximation of a page. Margins, heading rules, date alignment and bullet indents are laid out in print units, so the PDF your browser prints is what you proofread, not a surprise reflow.',
          'Reordering is built for the two edits resumes actually need: promote a bullet up, demote one down, move a job above another. Every entry type — experience, education, projects, contact rows — has add, remove and reorder controls.',
        ],
      },
      {
        heading: 'ATS-friendly by construction',
        paragraphs: [
          'Applicant tracking systems parse text, and they are clumsy. This builder deliberately ships single-column layouts, standard section headings, no tables for structure, no images of text, and real selectable characters — the exact checklist recruiters repeat. A soft counter nudges the summary under 600 characters because wall-of-text summaries read badly in both contexts: human and parser.',
          'Three themes (serif classic, modern sans, compact) with four accent colors change presentation without touching structure — the parse-safe skeleton stays constant underneath.',
        ],
      },
      {
        heading: 'Export and drafts',
        paragraphs: [
          'Print uses a dedicated print stylesheet: the page hides everything except the sheet, removes the screen scaling, and prints at 100% on A4 with entries kept from breaking across pages. The "Download HTML" export writes a self-contained file with those rules baked in, for archiving or printing elsewhere.',
          'Autosave writes the draft to localStorage about half a second after you stop typing, with a status line that says what actually happened: Saving…, Saved locally at HH:MM, Draft restored. The reset button restores the sample and clears the stored draft — the data was only ever in this browser.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------- video-studio
  'video-studio': {
    lede: [
      'Video Studio runs real ffmpeg on your own CPU, inside the tab: compress a video to a target quality, or trim it to an exact range — without uploading, without a queue, without a watermark, and without the file-size ceilings that free upload-based compressors enforce to protect their bandwidth bill.',
      'The engine is ffmpeg.wasm, self-hosted from this site: about 32 MB fetched once, cached by the browser after that. From the second visit the page needs no network at all — which is also why it is the honest answer for sensitive footage that should not travel to somebody else\u2019s transcoder.',
    ],
    sections: [
      {
        heading: 'Compression that means something',
        paragraphs: [
          'Quality is controlled with CRF, the same constant-rate-factor scale ffmpeg experts use by hand: 18–20 visually transparent, 23 a sensible default, 28 for a small file that still looks fine. A custom slider exposes the full 18–34 range. Resolution caps (1080p, 720p, 480p), frame-rate limits and audio handling (re-encode to 128k AAC, copy untouched, or remove for silent output) compose freely.',
          'CRF is quality-based, and the page says so plainly: the final size depends on the footage. A static talking-head clip compresses dramatically; fast motion with grain barely shrinks at the same CRF. Anyone who promises a fixed "50% smaller" is hiding this physics from you.',
        ],
      },
      {
        heading: 'Trimming: fast versus precise',
        paragraphs: [
          'The trim preview plays your file locally; buttons stamp the playhead into start or end, or you type exact seconds. The fast cut re-muxes without re-encoding — instant, even on gigabyte files — but must snap to the nearest keyframe, so the boundary can land a second or two from your pick. The precise cut re-encodes the kept section at CRF 20 and lands exactly where you pointed. Both are honest about the trade-off; you choose per job.',
        ],
      },
      {
        heading: 'What runs where, and how long',
        paragraphs: [
          'All decoding and encoding happens on this device\u2019s CPU via the single-threaded wasm build — no SharedArrayBuffer requirements, no special headers, no cross-origin isolation games. The cost of that portability is speed: expect real time on long clips, which is exactly what the live progress bar shows rather than hiding behind a fake spinner.',
          'Output is standard MP4 with H.264 video and AAC audio, faststart-flagged so it begins playing before it finishes downloading — playable by every phone, browser and messaging app. Files never leave the tab; the only network request the page ever makes is fetching the engine itself, from this same site, once.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------ bg-remove
  'bg-remove': {
    lede: [
      'Background Remover gives you two honest engines on one page: an AI cutout that segments people, products and pets with a real ISNet model running in this browser, and a solid-color key that is pure canvas math for flat backgrounds. Both export a transparent PNG, and neither one uploads your image anywhere.',
      'The privacy model is structural, not a promise: there is no upload code on this page at all. The AI engine fetches its model binary once (tens of MB from the vendor CDN, then browser-cached) — after that, every cutout is computed on your CPU, which is also why it works on a plane, on a locked-down work laptop, and on photos you would rather not hand to a stranger\u2019s processing queue.',
    ],
    sections: [
      {
        heading: 'Two engines, honestly labeled',
        paragraphs: [
          'AI mode suits busy scenes: hair, fur, glassware, cluttered desks. It runs ISNet (fp16) locally through WebAssembly and shows live progress for both the one-time model fetch and the segmentation itself, so nothing ever looks like a frozen spinner. If the model fails to download, the page says so and points you at the mode that needs no network.',
          'Solid-key mode suits flat backgrounds: green screens, white studio product shots, screenshots with a uniform margin. It samples the image corners to guess the key color, then applies a tolerance you control through a soft two-threshold alpha ramp — the boundary blends instead of shredding, which is the difference between a cutout and confetti.',
        ],
      },
      {
        heading: 'Seeing the result before you trust it',
        paragraphs: [
          'A drag slider compares the original against the cutout over a checkerboard, so transparency is visible rather than guessed. If edges eat into the subject, lower the tolerance and re-apply; if background speckles survive, raise it. The loop is instant in key mode because there is no model and no network — just pixels and math.',
        ],
      },
      {
        heading: 'What happens to your files',
        paragraphs: [
          'The image decodes to a bitmap in this tab, the mask is computed here, and the result re-encodes straight to a PNG download. PNG is non-negotiable because it is the format that carries alpha; JPEG would flatten your cutout onto black. The result card prints the before/after sizes honestly — a transparent PNG of a cutout can be larger than the compressed JPEG you started with, and pretending otherwise would be a lie.',
        ],
        list: [
          'Profile photos and team pages — AI cutout, then drop the PNG onto any background',
          'Marketplace listings — key out a white studio background without a photo editor',
          'Screenshots and diagrams — paste with Ctrl+V, key the uniform margin, done',
          'Sensitive imagery — nothing is ever uploaded, so there is nothing to delete later',
        ],
      },
    ],
  },

  // ------------------------------------------------------------- speed-test
  'speed-test': {
    lede: [
      'Speed Test measures what your connection actually does, in this tab, in about fifteen seconds: download, upload, ping, jitter, and the one number the big apps hide — how much your latency degrades while the line is busy. It then turns those numbers into answers, with a capacity table that says plainly whether 4K streaming, cloud gaming, HD group calls and cloud backups fit on the line you just measured.',
      'There is no app to install and no account behind a paywall, and nothing is stored — the probes go from this browser straight to Cloudflare\u2019s public speed endpoints, and the run is capped at roughly 48 MB down and 12 MB up, with the exact volumes printed in the result. A test that secretly drained a data plan would betray the same person it measures.',
    ],
    sections: [
      {
        heading: 'What the numbers actually mean',
        paragraphs: [
          'Download and upload are throughput: how many bits per second the line can carry, measured with parallel streams because a single request never saturates a modern connection. Ping is round-trip reaction time — the difference between a call that feels live and one where people talk over each other. Jitter is the wobble in that reaction time; a line can have great throughput and still be useless for voice if the timing jitters.',
          'Bufferbloat is the sneaky one: latency measured again while the download is running. On a bloated line, a background backup or a family member\u2019s video dump adds hundreds of milliseconds to every packet, and suddenly the call freezes every time someone uploads photos. The test grades it A through F so there is a word for the problem, not just a number.',
        ],
      },
      {
        heading: 'How to run a test that means something',
        paragraphs: [
          'Run it the way you actually use the connection. Wi-Fi adds its own variability — walls, distance, a microwave mid-cycle — so if the router is the suspect, test near it and test far from it and compare. Pause big background transfers first, or the test will measure your backup instead of your line. Run it twice; if the numbers disagree wildly, the third run tells you which one was the fluke.',
          'The stop button is not a failure state: stop mid-run and the page keeps the partial results, honestly labeled. That matters on metered connections, where the point is to spend the least data that still yields a number.',
        ],
      },
      {
        heading: 'What your speed can carry',
        paragraphs: [
          'Raw megabits answer nothing by themselves; the capacity table translates them. Each row — a 4K stream, a cloud gaming session, an HD group call, a photo backup running while you work — carries a requirement plus 25% headroom, because a connection that exactly matches its workload drops the moment anything else starts. Passes are green, marginal rows are the ones that work alone and fail together, and fails are the reason the video call is the thing that breaks first.',
          'The two time estimates at the bottom — a 10 GB download, a 500 MB upload — answer the question people actually ask: not \u201chow fast is my line\u201d but \u201chow long will this take\u201d. Both are computed from the measurement just taken, never from assumptions about your plan.',
        ],
      },
      {
        heading: 'Why a browser test and not an app',
        paragraphs: [
          'The app-store speed tests are fine tools wrapped in ads, upsells and analytics. This page has none of that: no install, no account, no result database. The same physics runs underneath — parallel streams, timed probes — pointed at Cloudflare\u2019s public measurement endpoints, which exist precisely so web pages can measure honestly without a proprietary server.',
        ],
        list: [
          'Router shopping — test before and after the swap, same spot, same time of day',
          'Call quality disputes — the bufferbloat grade names what the complaint feels like',
          'Work-from-home checks — HD call rows are the pass line, not raw megabits',
          'Mobile data budgets — the transfer cap and printed volumes keep the test cheap',
          'Landlord or ISP arguments — numbers from a neutral endpoint, not an ad-funded one',
        ],
      },
      {
        heading: 'What happens during the test, precisely',
        paragraphs: [
          'Phase one sends eight zero-byte requests; the first pays the TCP and TLS setup and is discarded rather than counted, the median of the rest is your ping, and the mean difference between consecutive samples is your jitter. Phase two opens up to four parallel download streams and counts bytes live until seven seconds pass or 48 MB moves. While those streams run, a small probe every 1.2 seconds times the loaded latency — that is the bufferbloat measurement. Phase three posts random incompressible payloads in parallel until five seconds pass or 12 MB goes out; the payload is deliberately marked as plain text so no preflight handshake contaminates the timing.',
          'Every phase prints what it moved. If an endpoint is unreachable — a VPN, a firewall, an aggressive ad blocker — the page says so instead of showing a fake number, because a speed test that always says 100 Mbps is worse than no speed test at all.',
        ],
      },
    ],
  },
}
