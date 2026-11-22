// Canvas resync end-to-end test — real relay, real reconnects, no mocks.
//
// Scenarios:
//   1. Baseline live sync: A draws, B sees the stroke.
//   2. Ghost-stroke fix: relay restarts → A's board must reconcile to the
//      server truth (previously it kept strokes that no longer existed, so
//      A and any new joiner permanently diverged). Honest "Back online" toast.
//   3. Post-restart recovery: A draws again, server stores it, B sees it.
//   4. Undo survives reload: A reloads (new socket id, same clientId) and
//      undoes → relay must remove the stroke (previously owner keyed by
//      socket.id made undo silently fail after reconnect/reload) and B's
//      board must clear too.
//   5. Missed-stroke window: while B is still reconnecting after a relay
//      restart, A draws — when B comes back the stroke must be there via
//      the snapshot reconcile.
//
// The script kills/restarts the relay process itself (self-contained).
// Usage: node scripts/canvas-resync-e2e.mjs    (exit 0 = all green)

import { createRequire } from 'module'
import { execSync, spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
const require = createRequire('/home/z/.npm-global/lib/node_modules/')
const { chromium } = require('playwright')

const BASE = 'http://localhost:81'
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RELAY_DIR = join(PROJECT_ROOT, 'mini-services', 'relay-service')
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function inkOf(page) {
  return page.evaluate(() => {
    const c = document.querySelector('canvas[aria-label*="Shared whiteboard"]')
    if (!c) return -1
    const ctx = c.getContext('2d')
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let ink = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] < 200) ink++
    return ink
  })
}

async function waitConnected(page, timeoutMs = 30000) {
  await page.waitForFunction(
    () => document.body.innerText.includes('Connected'),
    null,
    { timeout: timeoutMs },
  )
}

async function waitDisconnectedFromRelay() {
  for (let i = 0; i < 20; i++) {
    try {
      execSync('curl -s --max-time 1 http://localhost:3003/health -o /dev/null')
      await sleep(300)
    } catch {
      return // port is down
    }
  }
  throw new Error('relay port did not close after pkill')
}

function killRelay() {
  // Bracket trick so the pattern never matches the transient shell itself.
  try { execSync('pkill -f "[b]un --hot index.ts" 2>/dev/null || true') } catch { /* noop */ }
  try { execSync('pkill -f "[b]un index.ts" 2>/dev/null || true') } catch { /* noop */ }
}

async function startRelay() {
  const child = spawn('bun', ['index.ts'], { cwd: RELAY_DIR, detached: true, stdio: 'ignore' })
  child.unref()
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    try {
      const res = execSync('curl -s --max-time 2 http://localhost:3003/health').toString()
      if (res.includes('"ok":true')) return
    } catch { /* not up yet */ }
  }
  throw new Error('relay did not come back on :3003')
}

async function dumpStrokes(code) {
  const out = execSync(`bun scripts/debug-room-dump.ts ${code}`, { cwd: PROJECT_ROOT }).toString()
  const m = out.match(/strokes:\s*(\d+)/)
  return m ? Number(m[1]) : -1
}

async function drawStroke(page) {
  const box = await page.locator('canvas[aria-label*="Shared whiteboard"]').boundingBox()
  if (!box) throw new Error('canvas not found')
  const { x, y, width: w, height: h } = box
  await page.mouse.move(x + w * 0.2, y + h * 0.4)
  await page.mouse.down()
  await page.mouse.move(x + w * 0.5, y + h * 0.55, { steps: 6 })
  await page.mouse.move(x + w * 0.8, y + h * 0.35, { steps: 6 })
  await page.mouse.up()
}

const browser = await chromium.launch({ headless: true })
try {
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const A = await ctxA.newPage()
  const B = await ctxB.newPage()
  let pageErrors = 0
  A.on('pageerror', (e) => { pageErrors++; console.log('A pageerror:', e.message) })
  B.on('pageerror', (e) => { pageErrors++; console.log('B pageerror:', e.message) })

  // ── 1. Baseline: A creates a Canvas session, B joins, A draws, B sees it.
  await A.goto(`${BASE}/?app=canvas`, { waitUntil: 'networkidle' })
  await A.waitForTimeout(1200)
  await A.getByRole('button', { name: 'Start a session now' }).click()
  await A.waitForTimeout(2000)
  const url = A.url()
  const code = (url.match(/[?&]s=([A-Z0-9]{6})/) ?? [])[1] ?? ''
  ok('setup: A created canvas session', code.length === 6, url)

  await B.goto(url, { waitUntil: 'networkidle' })
  await B.waitForTimeout(2000)
  ok('setup: B joined and Connected', (await B.evaluate(() => document.body.innerText.includes('Connected'))))

  await drawStroke(A)
  await sleep(1200)
  const bInk1 = await inkOf(B)
  ok('1. baseline: live draw sync reaches B', bInk1 > 50, `B ink=${bInk1}`)

  // ── 2. Ghost-stroke fix: restart the relay, A must reconcile to empty.
  killRelay()
  await waitDisconnectedFromRelay()
  await startRelay()
  await waitConnected(A)
  await sleep(1500) // snapshot reconcile + redraw
  const aInkAfter = await inkOf(A)
  ok('2. ghost-stroke fix: A board reconciled to empty server truth', aInkAfter < 50, `A ink=${aInkAfter} (pre-fix it kept the stroke)`)
  const toastSeen = await A.evaluate(() => /Back online/.test(document.body.innerText))
  ok('2b. honest reconnection toast shown', toastSeen)

  // ── 3. Post-restart recovery: A draws, relay stores, B sees.
  await drawStroke(A)
  await sleep(1200)
  const relayStrokes1 = await dumpStrokes(code)
  const bInk2 = await inkOf(B)
  ok('3. post-restart draw stored on relay', relayStrokes1 === 1, `relay strokes=${relayStrokes1}`)
  ok('3b. B sees the post-restart stroke', bInk2 > 50, `B ink=${bInk2}`)

  // ── 4. Undo survives reload (stable clientId ownership).
  await A.reload({ waitUntil: 'networkidle' })
  await A.waitForTimeout(2500)
  await waitConnected(A)
  const aInkReload = await inkOf(A)
  ok('4. board restored after reload', aInkReload > 50, `A ink=${aInkReload}`)
  const undoBtn = A.getByRole('button', { name: 'Undo' })
  await undoBtn.click()
  await sleep(1500)
  const aInkUndo = await inkOf(A)
  const relayStrokes2 = await dumpStrokes(code)
  const bInk3 = await inkOf(B)
  ok('4b. undo works after reload (client-side)', aInkUndo < 50, `A ink=${aInkUndo}`)
  ok('4c. undo removed on relay (pre-fix it silently failed)', relayStrokes2 === 0, `relay strokes=${relayStrokes2}`)
  ok('4d. B board cleared by the undo broadcast', bInk3 < 50, `B ink=${bInk3}`)

  // ── 5. Missed-stroke window: B still reconnecting when A draws.
  killRelay()
  await waitDisconnectedFromRelay()
  await startRelay()
  await waitConnected(A)
  await drawStroke(A) // B may still be offline — snapshot reconcile must carry it
  // Wait for B to be back, then give the reconcile time.
  await waitConnected(B)
  await sleep(2500)
  const bInk4 = await inkOf(B)
  ok('5. stroke drawn during B outage arrives via resync', bInk4 > 50, `B ink=${bInk4}`)
  const aInk5 = await inkOf(A)
  ok('5b. A board consistent after restart+draw', aInk5 > 50, `A ink=${aInk5}`)

  ok('no page errors during the whole run', pageErrors === 0, `errors=${pageErrors}`)
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
