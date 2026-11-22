// Live Location inline map end-to-end QA — the real-device-emulated pass.
//
// Two Playwright contexts with GRANTED geolocation permission and distinct
// real coordinates (Tokyo Station vs Osaka). Exercises the complete journey
// through the REAL relay path (no mocks):
//
//   consent-first start → watchPosition fix → loc:ping over the relay →
//   inline MiniMap (basemap tiles, self + remote markers, accuracy circle,
//   distance line, visible expiry) → manual zoom disables auto-fit →
//   "Fit all" restores it → reload rebuilds the sharer from the persisted
//   snapshot (late joiner) → Stop removes the marker and the map retires
//   when nobody shares anymore.
//
// Usage: node scripts/location-e2e.mjs
// Exit 0 = all green; failures print and exit 1.

import { createRequire } from 'module'
const require = createRequire('/home/z/.npm-global/lib/node_modules/')
const { chromium } = require('playwright')

const BASE = 'http://localhost:81'
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Tokyo Station vs Osaka — far enough that the distance line must read "km".
const GEO_A = { latitude: 35.6812, longitude: 139.7671, accuracy: 40 }
const GEO_B = { latitude: 34.6937, longitude: 135.5023, accuracy: 60 }

async function geoContext(browser, geo) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.grantPermissions(['geolocation'], { origin: BASE })
  await ctx.setGeolocation(geo)
  return ctx
}

async function connected(page) {
  return page.evaluate(() => document.body.innerText.includes('Connected'))
}

async function startSession(page, appId) {
  await page.goto(`${BASE}/?app=${appId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200) // hydration
  await page.getByRole('button', { name: 'Start a session now' }).click()
  await page.waitForTimeout(1200)
}

async function shareLocation(page) {
  await page.getByRole('button', { name: 'Share my location' }).click()
  await page
    .getByRole('button', { name: 'Stop sharing now' })
    .waitFor({ timeout: 15000 })
}

async function markerCount(page) {
  return page.evaluate(() => document.querySelectorAll('[data-map-marker]').length)
}

const browser = await chromium.launch({ headless: true })

try {
  const ctxA = await geoContext(browser, GEO_A)
  const ctxB = await geoContext(browser, GEO_B)
  const A = await ctxA.newPage()
  const B = await ctxB.newPage()
  const aErrors = []
  const bErrors = []
  A.on('pageerror', (e) => aErrors.push(e.message))
  B.on('pageerror', (e) => bErrors.push(e.message))

  // ------------------------------------------------ A starts and shares
  await startSession(A, 'location-share')
  ok('A: session created', /[?&]s=[A-Z0-9]{6}/.test(A.url()), A.url())

  await shareLocation(A)
  ok('A: sharing status hero shown', true)

  // Self marker appears once watchPosition returns the first fix.
  await A.waitForSelector('[data-testid="mini-map"]', { timeout: 15000 })
  await A.waitForSelector('[data-map-self="1"]', { timeout: 20000 })
  ok('A: self marker on the inline map', true)

  // Basemap tiles actually load (network up; SW passes external traffic).
  let tilesOk = false
  for (let i = 0; i < 20 && !tilesOk; i++) {
    tilesOk = await A.evaluate(
      () =>
        [...document.querySelectorAll('img[data-map-tile]')].filter(
          (t) => t.naturalWidth > 0,
        ).length > 0,
    )
    if (!tilesOk) await sleep(500)
  }
  ok('A: OpenStreetMap tiles load', tilesOk)

  // ------------------------------------------------ B joins and shares
  const url = A.url()
  await B.goto(url, { waitUntil: 'networkidle' })
  await B.waitForTimeout(1200)
  ok('B: joined and Connected', await connected(B))

  await shareLocation(B)

  // A now sees both markers + a km-scale distance line + visible expiry.
  let bothA = false
  for (let i = 0; i < 20 && !bothA; i++) {
    bothA = (await markerCount(A)) === 2
    if (!bothA) await sleep(500)
  }
  ok('A: both positions on the map', bothA, `markers=${await markerCount(A)}`)

  const distLine = await A.evaluate(() => {
    const m = document.body.innerText.match(/([\d.]+\s?km|m)\s+from you/)
    return m ? m[1] : null
  })
  ok('A: distance line in km', distLine != null && distLine.includes('km'), String(distLine))

  const expiryChip = await A.evaluate(() => document.body.innerText.includes('expires in'))
  ok('A: visible expiry on the remote card', expiryChip)

  let bothB = false
  for (let i = 0; i < 20 && !bothB; i++) {
    bothB = (await markerCount(B)) === 2
    if (!bothB) await sleep(500)
  }
  ok('B: both positions on the map', bothB, `markers=${await markerCount(B)}`)

  // ------------------------------------- manual zoom ↔ auto-fit controls
  await A.getByRole('button', { name: 'Zoom out' }).click()
  let fitShown = false
  for (let i = 0; i < 10 && !fitShown; i++) {
    fitShown = await A.getByRole('button', { name: 'Fit all positions' }).isVisible()
    if (!fitShown) await sleep(300)
  }
  ok('A: manual zoom disables auto-fit (Fit all appears)', fitShown)
  if (fitShown) {
    await A.getByRole('button', { name: 'Fit all positions' }).click()
    let fitGone = false
    for (let i = 0; i < 10 && !fitGone; i++) {
      fitGone = (await A.getByRole('button', { name: 'Fit all positions' }).count()) === 0
      if (!fitGone) await sleep(300)
    }
    ok('A: Fit all restores auto-follow mode', fitGone)
  }

  // ------------------------- reload → auto-resume + late-joiner rebuild
  await A.reload({ waitUntil: 'networkidle' })
  await A.waitForFunction(() => document.body.innerText.includes('Connected'), {
    timeout: 20000,
  })
  // A's own share must resume (persisted loc:start + same until), and B is
  // still sharing — so both markers must return via live pings.
  let resumed = false
  for (let i = 0; i < 30 && !resumed; i++) {
    resumed =
      (await markerCount(A)) === 2 &&
      (await A.getByRole('button', { name: 'Stop sharing now' }).count()) === 1
    if (!resumed) await sleep(500)
  }
  ok('A: reload resumes own share + remote marker', resumed, `markers=${await markerCount(A)}`)

  // ------------------------------------------------- stop retires markers
  await B.getByRole('button', { name: 'Stop sharing now' }).click()
  let backToOne = false
  for (let i = 0; i < 16 && !backToOne; i++) {
    backToOne =
      (await markerCount(A)) === 1 &&
      !(await A.evaluate(() => document.body.innerText.includes('expires in')))
    if (!backToOne) await sleep(500)
  }
  ok('A: B removed from map after Stop', backToOne, `markers=${await markerCount(A)}`)

  await A.getByRole('button', { name: 'Stop sharing now' }).click()
  let mapGone = false
  for (let i = 0; i < 10 && !mapGone; i++) {
    mapGone = (await A.locator('[data-testid="mini-map"]').count()) === 0
    if (!mapGone) await sleep(500)
  }
  ok('A: map retires when nobody shares', mapGone)

  // ---------------------------------------------------------- console
  ok('A: no page errors', aErrors.length === 0, aErrors.join(' | ').slice(0, 300))
  ok('B: no page errors', bErrors.length === 0, bErrors.join(' | ').slice(0, 300))

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  process.exitCode = failed.length ? 1 : 0
} catch (err) {
  console.error('E2E crashed:', err)
  process.exitCode = 1
} finally {
  await browser.close()
}
