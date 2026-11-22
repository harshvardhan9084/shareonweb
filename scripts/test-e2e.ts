// Integration test: exercises the full stack the way a browser would —
// Next.js session APIs on :81 (gateway -> :3000) and the socket relay
// through the gateway's XTransformPort mechanism.
//
// Usage: bun scripts/test-e2e.ts

const BASE = 'http://127.0.0.1:81'
let pass = 0
let fail = 0

function check(name: string, ok: boolean, extra = '') {
  if (ok) {
    pass++
    console.log(`PASS: ${name}`)
  } else {
    fail++
    console.log(`FAIL: ${name} ${extra}`)
  }
}

async function main() {
  // 1. Page renders
  const page = await fetch(`${BASE}/`)
  const html = await page.text()
  check('GET / renders 200', page.status === 200)
  check('page contains app shell', html.includes('Practical tools') || html.toLowerCase().includes('relay'))

  // 2. Create a session via API
  const createRes = await fetch(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: 'beam' }),
  })
  const createBody = await createRes.json()
  check('POST /api/sessions 201', createRes.status === 201)
  const code: string = createBody?.session?.code ?? ''
  check('session code is 6 chars', /^[A-Z0-9]{6}$/.test(code), `got ${code}`)
  check('expiresAt ~24h ahead', createBody?.session?.expiresAt && Date.parse(createBody.session.expiresAt) > Date.now() + 23 * 3600e3)

  // 3. Fetch by code (lowercased + padded with a dash — must normalize)
  const getRes = await fetch(`${BASE}/api/sessions/${code.toLowerCase()}-`)
  const getBody = await getRes.json()
  check('GET /api/sessions/[code] normalizes code', getRes.status === 200 && getBody?.session?.code === code)

  // 4. Unknown code -> 404
  const missRes = await fetch(`${BASE}/api/sessions/ZZZZ99`)
  check('unknown code returns 404', missRes.status === 404)

  // 5. Socket relay through gateway (XTransformPort=3003)
  const { io } = await import('socket.io-client')
  const a = io(`${BASE}/?XTransformPort=3003`, { transports: ['websocket', 'polling'], forceNew: true, timeout: 10000 })
  const b = io(`${BASE}/?XTransformPort=3003`, { transports: ['websocket', 'polling'], forceNew: true, timeout: 10000 })

  const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), ms)),
    ])

  // Attach ALL listeners before awaiting anything — events may arrive early.
  a.on('connect', () => console.log('  [a] connected', a.id))
  b.on('connect', () => console.log('  [b] connected', b.id))
  b.on('connect_error', (e: Error) => console.log('  [b] connect_error:', e.message))
  b.on('disconnect', (r: string) => console.log('  [b] disconnect:', r))
  a.on('presence', (p: any) => console.log('  [a] presence:', p.participants.length))
  const aSawTwo = new Promise<void>((resolve) => {
    a.on('presence', (p: any) => {
      if (p.participants.length === 2) resolve()
    })
  })

  const aJoin = new Promise<any>((resolve, reject) => {
    a.on('connect', () => {
      a.emit('join', { code, name: 'Alpha', device: 'desktop' }, (res: any) =>
        res?.ok ? resolve(res) : reject(new Error(res?.error ?? 'join failed')),
      )
    })
    a.on('connect_error', (e: Error) => reject(e))
    setTimeout(() => reject(new Error('alpha join timed out')), 15000)
  })
  // Register Beta's join immediately so the early 'connect' is not missed.
  const bPresenceReached = new Promise<void>((resolve) => {
    b.on('connect', () => {
      b.emit('join', { code, name: 'Beta', device: 'phone' }, () => resolve())
    })
  })

  const aState = await withTimeout(aJoin, 15000, 'alpha join')
  check('socket join via gateway ok', aState?.ok === true && Array.isArray(aState.state.participants))

  await withTimeout(Promise.all([bPresenceReached, aSawTwo]), 15000, 'beta presence')
  check('presence broadcast reaches 2 participants', true)

  // text relay
  const aGotText = new Promise<any>((r) => a.on('text:new', r))
  const bGotText = new Promise<any>((r) => b.on('text:new', r))
  await new Promise<void>((resolve) => {
    a.emit('text:send', { id: 't1', content: 'hello from the gateway test' }, () => resolve())
  })
  const [ta, tb] = await withTimeout(Promise.all([aGotText, bGotText]), 10000, 'text relay')
  check('text relayed to both (incl. sender)', ta?.content === 'hello from the gateway test' && tb?.content === 'hello from the gateway test')

  // file relay (2 chunks)
  const bChunks: any[] = []
  const bFileNew = new Promise<any>((r) => b.on('file:new', r))
  const bComplete = new Promise<void>((r) => b.on('file:complete', () => r()))
  b.on('file:chunk', (c: any) => bChunks.push(c))
  await new Promise<void>((r) => a.emit('file:start', { fileId: 'f1', name: 'gw.bin', size: 8, type: 'application/octet-stream', chunkCount: 2 }, () => r()))
  await withTimeout(bFileNew, 10000, 'file:new')
  await new Promise<void>((r) => a.emit('file:chunk', { fileId: 'f1', index: 0, data: Buffer.from('abcd').toString('base64') }, () => r()))
  await new Promise<void>((r) => a.emit('file:chunk', { fileId: 'f1', index: 1, data: Buffer.from('efgh').toString('base64') }, () => r()))
  await new Promise<void>((r) => a.emit('file:end', { fileId: 'f1' }, () => r()))
  await withTimeout(bComplete, 10000, 'file:complete')
  check('file chunks relayed', bChunks.length === 2 && Buffer.from(bChunks[0].data, 'base64').toString() === 'abcd')

  // 6. Close via API -> relay kicks + DB marks closed
  const closed = new Promise<void>((r) => a.on('room:closed', () => r()))
  const closeRes = await fetch(`${BASE}/api/sessions/${code}/close`, { method: 'POST' })
  check('close API ok', closeRes.status === 200)
  await withTimeout(closed, 10000, 'room:closed')
  check('relay broadcast room:closed', true)
  const afterClose = await fetch(`${BASE}/api/sessions/${code}`)
  check('session reports ended after close', afterClose.status === 410)

  a.disconnect()
  b.disconnect()

  console.log(`\nSummary: ${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Test crashed:', err)
  process.exit(1)
})
