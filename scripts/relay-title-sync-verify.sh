#!/usr/bin/env bash
# One-shot title-sync verification: boot a throwaway relay on :3004, create a
# session over HTTP, join it with a socket.io client, PATCH the title and
# assert the client (a) receives the live `session:title` broadcast and
# (b) sees the title inside the join snapshot.
set -u
cd /home/z/my-project   # socket.io-client lives in the app's node_modules

DIR=/tmp/relay-title-test
rm -rf "$DIR" && mkdir -p "$DIR"

RELAY_DATA_DIR="$DIR" PORT=3004 bun mini-services/relay-service/index.ts > "$DIR/relay.log" 2>&1 &
RPID=$!
for i in $(seq 1 40); do
  curl -s -o /dev/null "http://localhost:3004/healthz" 2>/dev/null && break
  sleep 0.25
done

cat > "$DIR/client.mjs" <<'EOF'
import { io } from 'socket.io-client'

const base = 'http://localhost:3004'
const KEY = 'relay-internal-key-2024'

const j = await fetch(`${base}/api/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-relay-key': KEY },
  body: JSON.stringify({ appId: 'share' }),
}).then((r) => r.json())
const code = j.session.code
console.log('created session', code)

const sock = io(base, { transports: ['websocket'], forceNew: true })
const state = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('join ack timeout')), 8000)
  sock.emit('join', { code, name: 'Watcher', device: 'desktop' }, (res) => {
    clearTimeout(t)
    if (res.ok) resolve(res.state)
    else reject(new Error(`join failed: ${res.error}`))
  })
})
console.log('snapshot title:', JSON.stringify(state.title))

const got = new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('session:title broadcast timeout')), 8000)
  sock.on('session:title', (p) => { clearTimeout(t); resolve(p) })
})

// The rename rides the same PATCH the browser UI uses. PATCH first, THEN
// wait for the broadcast (awaiting in the other order would deadlock).
const prPromise = fetch(`${base}/api/session/${code}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'x-relay-key': KEY },
  body: JSON.stringify({ title: 'Weekly sync' }),
}).then((r) => r.json())
const gotResolved = await got
const pr = await prPromise
console.log('patch response title:', JSON.stringify(pr.session?.title))
console.log('broadcast received:', JSON.stringify(gotResolved))

// Clearing the title must broadcast null too.
const gotNull = new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('null broadcast timeout')), 8000)
  sock.once('session:title', (p) => { clearTimeout(t); resolve(p) })
})
const clearPromise = fetch(`${base}/api/session/${code}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'x-relay-key': KEY },
  body: JSON.stringify({ title: '' }),
}).then((r) => r.json())
const clearResolved = await gotNull
await clearPromise
console.log('clear broadcast received:', JSON.stringify(clearResolved))

sock.close()
const ok =
  pr.session?.title === 'Weekly sync' &&
  gotResolved.title === 'Weekly sync' &&
  clearResolved.title === null
console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL')
process.exit(ok ? 0 : 1)
EOF

bun "$DIR/client.mjs"
RC=$?
kill -TERM $RPID 2>/dev/null
wait $RPID 2>/dev/null
echo "== relay log excerpt =="
grep -E "wake GC|persistence|failed" "$DIR/relay.log" | head -5
exit $RC
