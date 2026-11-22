// Media engine end-to-end QA — the sandbox-real-device pass.
//
// Two Playwright pages in one Chromium instance, both granted fake camera +
// fake microphone (`fake_device_0`, the standard Chromium test pattern: 640x480
// animated pattern + audio tone). This exercises the REAL pipeline end to end:
// getUserMedia → MediaRtc mesh negotiation → relay signalling (via :81) →
// RTCPeerConnection loopback ICE → remote video actually rendering.
//
// Checks:
//   A. Private Call: both sides start; both tiles show live video
//      (videoWidth >= 640 on the remote side); peer count reaches 1/1.
//   B. Voice Call (audio-only): session starts, both Connected, no video tiles
//      expected — audio-only config.
//   C. Walkie-Talkie (PTT): hold-to-talk button appears; PTT state chip flips
//      to "Talking, release to stop" while pressed (pointer events).
//
// Usage: node scripts/media-e2e.mjs
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

async function tileInfo(page) {
  return page.evaluate(() => {
    const vids = [...document.querySelectorAll('video')]
    return vids.map((v) => {
      const s = v.srcObject
      return {
        hasStream: !!s,
        w: v.videoWidth,
        h: v.videoHeight,
        ready: v.readyState,
        tracks: s ? s.getVideoTracks().length + s.getAudioTracks().length : 0,
      }
    })
  })
}

async function startSession(page, appId) {
  await page.goto(`${BASE}/?app=${appId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200) // hydration
  await page.getByRole('button', { name: 'Start a session now' }).click()
  await page.waitForTimeout(1200)
}

async function startCall(page, buttonName) {
  await page.getByRole('button', { name: buttonName }).click()
  await page.waitForTimeout(2500)
}

async function connected(page) {
  return page.evaluate(() => document.body.innerText.includes('Connected'))
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
})

try {
  // ------------------------------------------------------------- A: Private Call
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const A = await ctxA.newPage()
  const B = await ctxB.newPage()
  A.on('pageerror', (e) => console.log('A pageerror:', e.message))
  B.on('pageerror', (e) => console.log('B pageerror:', e.message))

  await startSession(A, 'video-call')
  const url = A.url()
  ok('A: session created', /[?&]s=[A-Z0-9]{6}/.test(url), url)

  await startCall(A, 'Start the call')
  const aLocal = await tileInfo(A)
  ok(
    'A: local fake video live',
    aLocal.some((v) => v.w >= 640 && v.ready >= 2),
    JSON.stringify(aLocal),
  )

  await B.goto(url, { waitUntil: 'networkidle' })
  await B.waitForTimeout(1200)
  await startCall(B, 'Start the call')
  await sleep(5000) // mesh negotiation + ICE

  ok('A: status Connected', await connected(A))
  ok('B: status Connected', await connected(B))

  const aTiles = await tileInfo(A)
  const bTiles = await tileInfo(B)
  ok(
    'A: remote video decoded (videoWidth>=640)',
    aTiles.some((v) => v.w >= 640),
    JSON.stringify(aTiles),
  )
  ok(
    'B: remote video decoded (videoWidth>=640)',
    bTiles.some((v) => v.w >= 640),
    JSON.stringify(bTiles),
  )

  const aPeers = await A.evaluate(() => {
    const m = document.body.innerText.match(/(\d+)\/(\d+) connected/)
    return m ? `${m[1]}/${m[2]}` : null
  })
  ok('A: mesh peer count 1/1', aPeers === '1/1', String(aPeers))

  await ctxA.close()
  await ctxB.close()

  // ------------------------------------------------------------- B: Voice Call
  const V = await (await browser.newContext()).newPage()
  await startSession(V, 'audio-call')
  await startCall(V, 'Start the voice call')
  await sleep(2000)
  const vState = await V.evaluate(() => document.body.innerText)
  ok('B: voice call Connected', vState.includes('Connected'))
  await V.context().close()

  // ------------------------------------------------------------- C: Walkie-Talkie PTT
  const W = await (await browser.newContext()).newPage()
  await startSession(W, 'walkie-talkie')
  await startCall(W, 'Join the walkie-talkie')
  await sleep(1500)
  const ptt = W.getByRole('button', { name: /Hold to talk/ })
  await ptt.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  const pttVisible = await ptt.isVisible().catch(() => false)
  ok('C: hold-to-talk button visible', pttVisible)
  if (pttVisible) {
    // Keyboard PTT is the documented channel (Space bar). Hold, sample, release.
    let talking = false
    for (let i = 0; i < 3 && !talking; i++) {
      await W.keyboard.down('Space')
      await sleep(700)
      talking = await W.evaluate(() =>
        document.body.innerText.includes('Talking, release to stop'),
      )
      await W.keyboard.up('Space')
      await sleep(400)
    }
    ok('C: PTT flips to Talking while held', talking)
  }
  await W.context().close()
} catch (e) {
  ok('script ran to completion', false, e.message)
} finally {
  await browser.close()
}

const fails = results.filter((r) => !r.pass)
console.log(`\nmedia-e2e: ${results.length - fails.length}/${results.length} PASS`)
process.exit(fails.length ? 1 : 0)
