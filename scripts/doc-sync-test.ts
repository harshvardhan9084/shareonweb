// Quick relay doc-sync verification (run: bun scripts/doc-sync-test.ts <CODE>):
// two clients join the same room; both try to save against the same baseRev —
// exactly one must win, the other must get a conflict with the winner's doc.
// Also verifies retry-on-conflict, late-joiner snapshot and size limits.
import { io } from 'socket.io-client'

const code = process.argv[2] ?? 'DOCTEST'
const url = 'http://localhost:3003'

function mkClient(name) {
  const socket = io(url, { transports: ['websocket'] })
  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      socket.emit('join', { code, name, device: 'desktop' }, (res) => {
        if (res.ok) resolve(socket)
        else reject(new Error(res.error))
      })
    })
    socket.on('connect_error', reject)
    setTimeout(() => reject(new Error('timeout')), 5000)
  })
}

const a = await mkClient('Alice')
const b = await mkClient('Bob')

// 1) Alice saves first (baseRev 0)
const aRes = await new Promise((r) => a.emit('doc:update', { content: 'Alice v1', baseRev: 0 }, r))
console.log('A save:', JSON.stringify(aRes))

// 2) Bob saves with the same stale baseRev -> must conflict
const bRes = await new Promise((r) => b.emit('doc:update', { content: 'Bob v1', baseRev: 0 }, r))
console.log('B save:', JSON.stringify(bRes))
if (!bRes.conflict || bRes.doc?.content !== 'Alice v1') {
  console.error('FAIL: expected conflict carrying Alice v1')
  process.exit(1)
}

// 3) Bob retries on top of the new rev -> must succeed
const bRes2 = await new Promise((r) => b.emit('doc:update', { content: 'Alice v1 + Bob v2', baseRev: bRes.doc.rev }, r))
console.log('B retry:', JSON.stringify(bRes2))
if (!bRes2.ok) {
  console.error('FAIL: retry should succeed')
  process.exit(1)
}

// 4) Late joiner gets the doc in the snapshot
const c = await mkClient('Carol')
const snap = await new Promise((r) => c.emit('join', { code, name: 'Carol2', device: 'phone' }, r))
console.log('late joiner doc:', JSON.stringify(snap.state.doc))
if (snap.state.doc?.content !== 'Alice v1 + Bob v2') {
  console.error('FAIL: late joiner did not receive doc')
  process.exit(1)
}

// 5) Oversized content must be rejected
const big = 'x'.repeat(100_001)
const bigRes = await new Promise((r) => a.emit('doc:update', { content: big, baseRev: 1 }, r))
console.log('oversize:', JSON.stringify({ ok: bigRes.ok, error: bigRes.error }))
if (bigRes.ok) {
  console.error('FAIL: oversize should be rejected')
  process.exit(1)
}

a.disconnect(); b.disconnect(); c.disconnect()
console.log('ALL DOC TESTS PASSED')
process.exit(0)
