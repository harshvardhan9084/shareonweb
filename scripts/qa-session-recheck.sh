#!/usr/bin/env bash
# Focused re-check: session deep-link hydration on /TPS9RC.
set -u
cd /home/z/my-project
setsid bash -c 'bun run dev' > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 40); do
  sleep 3
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
done
echo "dev ready: $code"
# Does the session still exist server-side?
echo "session API: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:81/api/sessions/TPS9RC)"
agent-browser open "http://localhost:81/TPS9RC" --timeout 60000 > /dev/null 2>&1
agent-browser wait --text "Copy session code" --timeout 45000 > /dev/null 2>&1
if agent-browser snapshot -c 2>/dev/null | rg -q "Copy session code TPS-9RC"; then
  echo "PASS /TPS9RC opens session view"
else
  echo "FAIL /TPS9RC"
  agent-browser snapshot -c 2>/dev/null | head -12
fi
agent-browser errors 2>/dev/null | rg -v "stderr|launched" | head -3 || true
agent-browser close > /dev/null 2>&1
