#!/usr/bin/env bash
# Final QA pass: Toolhive brand, /share rename + unified session modes,
# instant tools, legacy redirects. Single invocation (sandbox kills ad-hoc
# processes between tool calls). Run: bash scripts/final-qa.sh
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

echo "== warming routes (curl) =="
for p in "/share" "/zip" "/image" "/hash" "/encode" "/json" "/text" "/password" "/qr" "/beam" "/call"; do
  printf "  %-10s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://localhost:81$p")"
done

pass=0; fail=0
ok()   { echo "  PASS $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL $1"; fail=$((fail+1)); }

echo "== browser checks =="
agent-browser open "http://localhost:81/" --timeout 60000 > /dev/null 2>&1
sleep 3
# 1. new hero + hub copy
if agent-browser snapshot -c 2>/dev/null | rg -q "Every tool you need"; then ok "home hero is hub-accurate"; else bad "home hero"; fi
# 2. instant tools listed under Instant Tools
if agent-browser snapshot -c 2>/dev/null | rg -q "Instant Tools"; then ok "Instant Tools section on home"; else bad "Instant Tools section"; fi
# 3. brand rename
if agent-browser snapshot -c 2>/dev/null | rg -q "Toolhive"; then ok "Toolhive brand visible"; else bad "Toolhive brand"; fi
if agent-browser get title 2>/dev/null | rg -qi "ShareOnWeb"; then bad "old brand in title"; else ok "no old brand in title"; fi

# 4. /zip tool renders
agent-browser open "http://localhost:81/zip" --timeout 60000 > /dev/null 2>&1
agent-browser wait --text "Drop files, a folder, or a .zip archive" --timeout 40000 > /dev/null 2>&1
if agent-browser snapshot -c 2>/dev/null | rg -q "Drop files, a folder, or a .zip archive"; then ok "/zip renders drop zone"; else bad "/zip render"; fi

# 5. /hash renders
agent-browser open "http://localhost:81/hash" --timeout 60000 > /dev/null 2>&1
agent-browser wait --text "Drop the file to hash" --timeout 40000 > /dev/null 2>&1
if agent-browser snapshot -c 2>/dev/null | rg -q "Drop the file to hash"; then ok "/hash renders"; else bad "/hash render"; fi

# 6. /password generates immediately
agent-browser open "http://localhost:81/password" --timeout 60000 > /dev/null 2>&1
agent-browser wait --text "Strength" --timeout 40000 > /dev/null 2>&1
if agent-browser snapshot -c 2>/dev/null | rg -q "bits of entropy"; then ok "/password generates + strength"; else bad "/password"; fi

# 7. legacy /beam redirects to /share
r=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://localhost:81/beam")
if [ "$r" = "307 http://localhost:81/share" ]; then ok "/beam 307 -> /share"; else bad "/beam redirect: $r"; fi

# 8. /share landing renders modes
agent-browser open "http://localhost:81/share" --timeout 60000 > /dev/null 2>&1
agent-browser wait --text "Start files now" --timeout 40000 > /dev/null 2>&1
if agent-browser snapshot -c 2>/dev/null | rg -q "Quick Pair"; then ok "/share renders 4 modes"; else bad "/share modes"; fi

# 9. start a session and verify unified in-session modes
agent-browser find text "Start files now" click > /dev/null 2>&1
agent-browser wait --fn "window.location.pathname !== '/share'" --timeout 30000 > /dev/null 2>&1
newurl=$(agent-browser get url 2>/dev/null)
if [[ "$newurl" =~ ^http://localhost:81/[A-Z0-9]{6}$ ]]; then ok "new session at $newurl"; else bad "new session url: $newurl"; fi
sleep 2
if agent-browser snapshot -c 2>/dev/null | rg -q "Share modes"; then ok "in-session Share modes tablist"; else bad "in-session Share modes"; fi
if agent-browser snapshot -c 2>/dev/null | rg -q '"Folder"'; then ok "Folder tab reachable in-session (one code, all modes)"; else bad "Folder tab in-session"; fi

# 10. legacy ?s= / ?app= rewrites still work
legacyCode=$(echo "$newurl" | rg -o '[A-Z0-9]{6}$')
agent-browser open "http://localhost:81/?s=$legacyCode" --timeout 60000 > /dev/null 2>&1
agent-browser wait --fn "window.location.pathname === '/$legacyCode'" --timeout 30000 > /dev/null 2>&1
u=$(agent-browser get url 2>/dev/null)
if [ "$u" = "http://localhost:81/$legacyCode" ]; then ok "legacy ?s= rewrites to /$legacyCode"; else bad "legacy ?s= rewrite: $u"; fi
agent-browser open "http://localhost:81/?app=drop" --timeout 60000 > /dev/null 2>&1
agent-browser wait --fn "window.location.pathname === '/share'" --timeout 30000 > /dev/null 2>&1
u=$(agent-browser get url 2>/dev/null)
if [ "$u" = "http://localhost:81/share" ]; then ok "legacy ?app=drop -> /share"; else bad "legacy ?app= rewrite: $u"; fi

# 11. 404
g=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:81/garbage123")
if [ "$g" = "404" ]; then ok "/garbage123 404"; else bad "404: $g"; fi

echo "== console errors =="
agent-browser errors 2>/dev/null | rg -v "stderr|launched" | head -4 || true

echo "== RESULT: $pass passed, $fail failed =="
agent-browser close > /dev/null 2>&1
