#!/usr/bin/env bash
# Final QA pass for the path-routing + tool-merge milestone.
# Runs the whole sequence inside one invocation because the sandbox reaps
# user-spawned processes between tool calls; boot services survive, ours don't.
set -u
cd /home/z/my-project

echo "== starting dev server =="
setsid bash -c 'bun run dev' > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 40); do
  sleep 3
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
done
echo "dev ready: HTTP $code after ~$((i*3))s"

echo "== warming routes (curl, no browser) =="
for p in "/beam" "/call" "/TPS9RC" "/?app=drop" "/?s=TPS9RC" "/drop"; do
  printf "  %-12s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://localhost:81$p")"
done

echo "== browser checks =="
pass=0; fail=0
check() {
  local desc="$1" expect="$2"
  local url
  url=$(agent-browser get url 2>/dev/null)
  if [ "$url" = "$expect" ]; then echo "  PASS $desc -> $url"; pass=$((pass+1))
  else echo "  FAIL $desc -> $url (expected $expect)"; fail=$((fail+1)); fi
}

agent-browser open "http://localhost:81/" --timeout 60000 > /dev/null 2>&1
sleep 4
agent-browser snapshot -c 2>/dev/null | head -3

# 1. tool page renders
agent-browser open "http://localhost:81/beam" --timeout 60000 > /dev/null 2>&1
agent-browser wait --text "Start files now" --timeout 30000 > /dev/null 2>&1
if agent-browser snapshot -c 2>/dev/null | rg -q "Start files now"; then echo "  PASS /beam renders primary CTA"; pass=$((pass+1)); else echo "  FAIL /beam render"; fail=$((fail+1)); fi

# 2. legacy ?app= rewrites to clean path
agent-browser open "http://localhost:81/?app=drop" --timeout 60000 > /dev/null 2>&1
agent-browser wait --fn "window.location.pathname === '/beam'" --timeout 30000 > /dev/null 2>&1
check "legacy ?app=drop" "http://localhost:81/beam"

# 3. server-side legacy variant slug redirects
r=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://localhost:81/drop")
if [ "$r" = "307 http://localhost:81/beam" ]; then echo "  PASS /drop 307 -> /beam"; pass=$((pass+1)); else echo "  FAIL /drop: $r"; fail=$((fail+1)); fi

# 4. legacy ?s= rewrites to session path
agent-browser open "http://localhost:81/?s=TPS9RC" --timeout 60000 > /dev/null 2>&1
agent-browser wait --fn "window.location.pathname === '/TPS9RC'" --timeout 30000 > /dev/null 2>&1
check "legacy ?s=TPS9RC" "http://localhost:81/TPS9RC"

# 5. session deep link opens live session
if agent-browser snapshot -c 2>/dev/null | rg -q "Copy session code TPS-9RC"; then echo "  PASS /TPS9RC opens session"; pass=$((pass+1)); else echo "  FAIL /TPS9RC session"; fail=$((fail+1)); fi

# 6. lowercase canonicalization
agent-browser open "http://localhost:81/tps9rc" --timeout 60000 > /dev/null 2>&1
sleep 3
check "lowercase /tps9rc" "http://localhost:81/TPS9RC"

# 7. create a new session -> clean /CODE URL
agent-browser open "http://localhost:81/beam" --timeout 60000 > /dev/null 2>&1
sleep 2
agent-browser find text "Start files now" click > /dev/null 2>&1
agent-browser wait --fn "window.location.pathname !== '/beam'" --timeout 30000 > /dev/null 2>&1
newurl=$(agent-browser get url 2>/dev/null)
if [[ "$newurl" =~ ^http://localhost:81/[A-Z0-9]{6}$ ]]; then echo "  PASS new session at $newurl"; pass=$((pass+1)); else echo "  FAIL new session url: $newurl"; fail=$((fail+1)); fi

# 8. 404 for garbage
g=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:81/garbage123")
if [ "$g" = "404" ]; then echo "  PASS /garbage123 404"; pass=$((pass+1)); else echo "  FAIL garbage: $g"; fail=$((fail+1)); fi

echo "== console errors =="
agent-browser errors 2>/dev/null | rg -v "stderr|launched" | head -4 || true

echo "== RESULT: $pass passed, $fail failed =="
agent-browser close > /dev/null 2>&1
