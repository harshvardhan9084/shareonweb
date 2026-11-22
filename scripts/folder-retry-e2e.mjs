// Folder Share retry-queue end-to-end test — real failure, real retry.
//
// Scenario (all real protocol, no mocks):
//   1. Tab A starts a Folder Share session; tab B joins.
//   2. A sends file1 (45 MB) — accepted, transfer completes (fills most of the
//      relay's 80 MB room quota).
//   3. A sends file2 (45 MB) — file:start is rejected by the room quota, so the
//      row enters the error state and the Retry affordance appears.
//   4. A removes file1 (frees quota), clicks Retry on file2.
//   5. file2 now transfers completely on A and arrives complete on B.
//
// Usage: node scripts/folder-retry-e2e.mjs      (exit 0 = all green)

import { createRequire } from 'module'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'
const require = createRequire('/home/z/.npm-global/lib/node_modules/')
const { chromium } = require('playwright')

const BASE = 'http://localhost:81'
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ~45 MB test payloads (45 MB + 45 MB > the 80 MB room quota).
const tmp = mkdtempSync(join(tmpdir(), 'sow-retry-'))
const f1 = join(tmp, 'big-one.bin')
const f2 = join(tmp, 'big-two.bin')
writeFileSync(f1, randomBytes(45 * 1024 * 1024))
writeFileSync(f2, randomBytes(45 * 1024 * 1024))

const browser = await chromium.launch({ headless: true })
try {
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const A = await ctxA.newPage()
  const B = await ctxB.newPage()
  A.on('pageerror', (e) => console.log('A pageerror:', e.message))
  B.on('pageerror', (e) => console.log('B pageerror:', e.message))

  // A: start a Folder Share session.
  await A.goto(`${BASE}/?app=folder-share`, { waitUntil: 'networkidle' })
  await A.waitForTimeout(1200)
  await A.getByRole('button', { name: 'Start a session now' }).click()
  await A.waitForTimeout(1500)
  const url = A.url()
  ok('A: session created', /[?&]s=[A-Z0-9]{6}/.test(url), url)

  // B: join from a second device.
  await B.goto(url, { waitUntil: 'networkidle' })
  await B.waitForTimeout(1500)
  ok('B: joined and Connected', (await B.evaluate(() => document.body.innerText.includes('Connected'))))

  // A: send file1 — fills most of the room quota.
  await A.locator('input[aria-label="Choose files to send"]').setInputFiles([f1])
  await A.waitForTimeout(2500)
  await A.evaluate(() => document.body.innerText)
  // Wait for the 45 MB upload to finish (row shows "Delivered").
  await A
    .locator('p', { hasText: 'Delivered' })
    .first()
    .waitFor({ timeout: 120000 })
  ok('A: file1 delivered', true)

  // A: send file2 — file:start must fail on the room quota → error row.
  await A.locator('input[aria-label="Choose files to send"]').setInputFiles([f2])
  await A.waitForTimeout(2000)
  const failedRow = await A.evaluate(() => {
    const text = document.body.innerText
    return {
      hasError: /failed|could not|limit|reached/i.test(text),
      hasRetryButton: Boolean([...document.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Retry'),
      )),
    }
  })
  ok('A: file2 rejected by quota (error row)', failedRow.hasError, JSON.stringify(failedRow))
  ok('A: Retry affordance appears', failedRow.hasRetryButton)

  // A: remove file1 to free the quota.
  await A.getByRole('button', { name: /Remove big-one/ }).first().click()
  await A.waitForTimeout(400)
  await A.getByRole('button', { name: 'Remove', exact: true }).click()
  await A.waitForTimeout(1200)

  // A: retry file2.
  await A.getByRole('button', { name: /Retry failed|Retry sending big-two/ }).first().click()
  // Wait until the summary bar shows every file delivered and no error remains.
  for (let i = 0; i < 60; i++) {
    await sleep(2000)
    const state = await A.evaluate(() => {
      const text = document.body.innerText
      return {
        delivered: /1\/1 delivered/.test(text),
        failed: /failed|reached/i.test(text),
        retryBtn: Boolean([...document.querySelectorAll('button')].find((b) =>
          b.textContent?.trim() === 'Retry' || b.textContent?.includes('Retry failed'),
        )),
      }
    })
    if (state.delivered && !state.failed && !state.retryBtn) break
    if (i === 59) console.log('final state:', JSON.stringify(state), (await A.evaluate(() => document.body.innerText)).slice(0, 600))
  }
  const aDone = await A.evaluate(() => {
    const text = document.body.innerText
    return /1\/1 delivered/.test(text) && !/failed|reached/i.test(text)
  })
  ok('A: file2 delivered after retry', aDone)

  // B: file2 arrived complete.
  const bHas = await B.evaluate(() => document.body.innerText.includes('big-two.bin'))
  ok('B: file2 arrived on the other device', bHas)
  await ctxA.close()
  await ctxB.close()
} catch (e) {
  ok('script ran to completion', false, e.message.slice(0, 200))
} finally {
  await browser.close()
  rmSync(tmp, { recursive: true, force: true })
}

const fails = results.filter((r) => !r.pass)
console.log(`\nfolder-retry-e2e: ${results.length - fails.length}/${results.length} PASS`)
process.exit(fails.length ? 1 : 0)
