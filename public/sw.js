// Kontivo service worker — the offline shell.
//
// Caches the app shell (landing HTML, immutable build assets, brand icons) so
// a repeat visit or installed PWA opens instantly on a weak network and the
// shell still opens with no connection at all. Live traffic is never touched:
// the relay socket (which rides this origin via the gateway query), session
// join links and every API call pass straight through — Kontivo runs
// between live browsers, and nothing here pretends otherwise.
//
// Bump VERSION whenever the precache list or a strategy changes; activation
// deletes every older cache.
const VERSION = 'sow-shell-v8'

// Instant tools open and run entirely in the browser, so their page shells
// (the server HTML plus every /_next/static asset the HTML references) are
// precached at install — after that, opening /zip, /qr or /json on a plane
// actually works. Live-tool pages are deliberately NOT precached: a session
// tool without a connection is a false promise, and those stay on the
// network-first path with the honest offline fallback.
// MIRROR RULE: this list must mirror the instant ids in src/lib/registry.ts;
// scripts/final-qa.sh asserts every entry answers 200 through the gateway.
const INSTANT_TOOLS = [
  '/zip', '/image', '/hash', '/encode', '/json', '/text', '/password', '/qr',
  '/pdf', '/pdf-view', '/pdf-text', '/images-to-pdf', '/office-view', '/epub-view',
  '/audio', '/gif', '/frame-grab', '/recorder', '/upscaler',
  '/archive', '/file-tools', '/encrypt', '/meta-scrub', '/jwt', '/hash-file-batch',
  '/cron', '/diff', '/uuid', '/convert-units',
  '/lorem', '/fake-data', '/css-tools', '/meta-tags', '/barcode',
  '/calculator', '/percentage', '/date-calculator', '/bmi', '/loan',
  '/timer', '/picker', '/regex', '/csv', '/color',
  '/signature', '/invoice', '/timezone', '/pdf-to-image', '/device-test',
  '/beautify', '/favicon', '/watermark', '/typing-test', '/markdown',
  '/stats', '/number-to-words', '/morse', '/font-changer', '/emoji',
  '/json-to-ts', '/compress-pdf', '/time-card', '/grade', '/todo',
]

const SHELL_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

/** Fetch a page, cache it, and cache every build asset its HTML references. */
async function cacheToolShell(cache, path) {
  const res = await fetch(new Request(path, { cache: 'reload' }))
  if (!res.ok) return
  await cache.put(path, res.clone())
  const html = await res.text()
  const assets = [...html.matchAll(/\/_next\/static\/[^"'\s\\]+/g)].map((m) => m[0])
  for (const asset of new Set(assets)) {
    try {
      const hit = await cache.match(asset)
      if (hit) continue
      const fresh = await fetch(new Request(asset, { cache: 'reload' }))
      if (fresh.ok) await cache.put(asset, fresh)
    } catch {
      /* a missing asset is a degraded shell, not a failed install */
    }
  }
}

const IMMUTABLE_PREFIXES = ['/_next/static/', '/icons/']
const IMMUTABLE_EXACT = ['/favicon.svg', '/manifest.webmanifest']
const NAV_TIMEOUT_MS = 6000

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION)
      // cache:'reload' bypasses the HTTP cache so the shell is stored fresh.
      await Promise.allSettled(
        SHELL_ASSETS.map((asset) => cache.add(new Request(asset, { cache: 'reload' }))),
      )
      // Instant-tool shells, one page at a time: a flaky network degrades to
      // fewer cached tools instead of failing the whole install.
      for (const path of INSTANT_TOOLS) {
        try {
          await cacheToolShell(cache, path)
        } catch {
          /* keep installing the rest */
        }
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== VERSION) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

// Navigations cannot be fetched by re-passing the navigate-mode Request (plus
// init, which Chromium rejects), so network-first fetches go by URL string.
// Cached responses are rebuilt before being returned: some Chromium versions
// refuse raw cache.match Response objects as navigation bodies.
async function fetchWithTimeout(url, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function cachedHtml(cache, key) {
  const hit = await cache.match(key)
  if (!hit) return null
  return new Response(await hit.arrayBuffer(), {
    status: hit.status,
    headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'text/html; charset=utf-8',
    },
  })
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Always live: relay socket polling (gateway query), the socket.io path and
  // the API routes. A cached handshake would fake a session that isn't there.
  if (
    url.searchParams.has('XTransformPort') ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/api/')
  ) {
    return
  }

  // Navigations: network first with a short timeout, then the best cached
  // surface. Tool and home navigations refresh the shell cache as they pass;
  // session links never enter the cache (ephemeral by design) and fall back
  // to the honest offline page instead of a stale session view.
  if (request.mode === 'navigate') {
    const isSessionLink = url.searchParams.has('s') || url.searchParams.has('join')
    const navUrl = url.pathname + url.search
    event.respondWith(
      (async () => {
        // Network first — but a broken upstream (5xx, e.g. the gateway's 502
        // when the app server is down) is as useless as no network, so it
        // also falls back to the cache. Honest 4xx pages pass through.
        let fresh = null
        try {
          fresh = await fetchWithTimeout(navUrl, NAV_TIMEOUT_MS)
        } catch {
          fresh = null
        }
        if (fresh && fresh.ok && !isSessionLink) {
          const cache = await caches.open(VERSION)
          cache.put(navUrl, fresh.clone())
        }
        if (fresh && (fresh.ok || fresh.status < 500)) return fresh
        const cache = await caches.open(VERSION)
        // A session link offline must never fake a room: the SPA would sit on
        // a join that cannot happen. Serve the honest offline page instead.
        if (isSessionLink) {
          return (
            (await cachedHtml(cache, '/offline.html')) ||
            new Response('You are offline. Kontivo sessions need a connection.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          )
        }
        return (
          (await cachedHtml(cache, navUrl)) ||
          (await cachedHtml(cache, '/')) ||
          (await cachedHtml(cache, '/offline.html')) ||
          new Response('You are offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        )
      })(),
    )
    return
  }

  // Immutable static assets: cache first, fill on first use.
  if (
    IMMUTABLE_EXACT.includes(url.pathname) ||
    IMMUTABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION)
        const hit = await cache.match(request)
        if (hit) {
          return new Response(await hit.arrayBuffer(), {
            status: hit.status,
            headers: {
              'Content-Type': hit.headers.get('Content-Type') || 'application/octet-stream',
            },
          })
        }
        try {
          const fresh = await fetch(request)
          if (fresh.ok) cache.put(request, fresh.clone())
          return fresh
        } catch {
          return Response.error()
        }
      })(),
    )
  }
})
