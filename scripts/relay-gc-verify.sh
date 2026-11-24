#!/usr/bin/env bash
# One-shot GC-on-wake verification: seed a disk store with an expired session,
# a closed session and their rooms, boot a throwaway relay on :3004, and
# confirm the wake-GC drops them from memory AND from the store.
set -u
cd /home/z/my-project/mini-services/relay-service

DIR=/tmp/relay-gc-test
rm -rf "$DIR" && mkdir -p "$DIR"

NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
OLD=$(date -u -d "3 hours ago" +%Y-%m-%dT%H:%M:%S.000Z)
FUT=$(date -u -d "20 hours" +%Y-%m-%dT%H:%M:%S.000Z)

cat > "$DIR/relay-state.json" <<EOF
{
  "sessions": [
    { "code": "EXPIRED", "appId": "share", "title": null, "createdAt": "$OLD", "expiresAt": "$OLD", "closed": false },
    { "code": "GHOST9",  "appId": "share", "title": null, "createdAt": "$NOW", "expiresAt": "$FUT", "closed": false }
  ],
  "closed": [
    { "code": "CLOSED1", "until": "$FUT" }
  ],
  "rooms": [
    { "code": "EXPIRED", "createdAt": "$OLD", "texts": [{"t": "stale"}], "chat": [], "strokes": [], "polls": [], "doc": null, "appEvents": [], "files": [] },
    { "code": "CLOSED1", "createdAt": "$NOW", "texts": [], "chat": [], "strokes": [], "polls": [], "doc": null, "appEvents": [], "files": [] },
    { "code": "GHOST9",  "createdAt": "$NOW", "texts": [{"t": "keep me"}], "chat": [], "strokes": [], "polls": [], "doc": null, "appEvents": [], "files": [] }
  ]
}
EOF

echo "== boot log =="
RELAY_DATA_DIR="$DIR" PORT=3004 timeout 30 bun index.ts > /tmp/relay-gc-test/boot.log 2>&1 &
RPID=$!
for i in $(seq 1 20); do
  sleep 0.5
  curl -s -o /dev/null "http://localhost:3004/healthz" 2>/dev/null && break
done
sleep 1
grep -E "restored from|wake GC|persistence:" /tmp/relay-gc-test/boot.log | head -6

echo "== healthz =="
curl -s "http://localhost:3004/healthz"
echo ""
echo "== expired code rejected? =="
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3004/api/session/EXPIRED"
echo "== live code still served? =="
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3004/api/session/GHOST9"

echo "== store file after GC (wait out the 4 s debounce + SIGTERM flush) =="
sleep 5
kill -TERM $RPID 2>/dev/null
wait $RPID 2>/dev/null
sleep 1
rg -o '"code":\s*"[A-Z0-9]+"' "$DIR/relay-state.json" | sort | uniq -c
echo "== done =="
