#!/usr/bin/env bash
# Final QA pass: Kontivo brand, /share rename + unified session modes,
# instant tools (Batch 1 + Batch 2 file tools with REAL fixtures), legacy
# redirects. Single invocation (sandbox kills ad-hoc processes between tool
# calls). Run: bash scripts/final-qa.sh
set -u
cd /home/z/my-project

# The suite outgrew a single command timeout on a cold dev server, so it can
# run in two phases against the persistent boot server. PHASE defaults to
# "all" (one full run, exactly as before); "1" runs fixtures+warm+tool blocks,
# "2" runs the new-tool blocks + legacy/session/SEO + the final tally.
PHASE="${PHASE:-all}"

# Dedicated browser session. The default agent-browser session is ONE browser
# shared with every other agent on this machine — two drivers in it interleave
# navigations, steal each other's pages and corrupt assertions (the source of
# the migrating QA failures). QA runs in its own named session instead.
export AGENT_BROWSER_SESSION="${AGENT_BROWSER_SESSION:-kontivo-qa}"

echo "== fixtures =="
bun scripts/make-fixtures.mjs > /dev/null 2>&1 || { echo "fixture build failed"; exit 1; }
FX=/tmp/qa-fixtures
echo "fixtures in $FX"

echo "== starting dev server (if none is up) =="
code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null || echo 000)
if [ "$code" != "200" ]; then
  setsid bash -c 'bun run dev' > /dev/null 2>&1 < /dev/null &
  for i in $(seq 1 40); do
    sleep 3
    code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null || echo 000)
    [ "$code" = "200" ] && break
  done
fi
echo "dev ready: HTTP $code"

echo "== warming routes (curl) =="
for p in "/share" "/zip" "/image" "/hash" "/encode" "/json" "/text" "/password" "/qr" \
         "/pdf" "/pdf-view" "/pdf-text" "/images-to-pdf" "/office-view" "/epub-view" \
         "/audio" "/gif" "/frame-grab" "/recorder" "/upscaler" \
         "/archive" "/file-tools" "/encrypt" "/meta-scrub" "/jwt" "/hash-file-batch" \
         "/cron" "/diff" "/uuid" "/convert-units" \
         "/beam" "/call"; do
  printf "  %-14s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://localhost:81$p")"
done

pass=0; fail=0
if [ "$PHASE" = "2" ] && [ -f /tmp/qa-pass ]; then
  pass=$(cat /tmp/qa-pass); fail=$(cat /tmp/qa-fail)
fi
ok()   { echo "  PASS $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL $1"; fail=$((fail+1)); }
# One heavy page alive at a time: close the previous tab before each open —
# accumulated pdf.js/epub/WASM tabs progressively jank the browser and turn
# later checks into random timeouts.
open_page() {
  agent-browser close > /dev/null 2>&1
  agent-browser open "$1" --timeout 60000 > /dev/null 2>&1
}
# Retry a snapshot match a few times — agent-browser can return a stale or
# empty snapshot under load; a transient miss is not a product defect.
snap_hit() {
  local pat="$1" i=0
  while [ "$i" -lt 3 ]; do
    agent-browser snapshot -c 2>/dev/null | rg -q "$pat" && return 0
    sleep 3
    i=$((i+1))
  done
  return 1
}

echo "== browser checks =="
if [ "$PHASE" = "1" ] || [ "$PHASE" = "all" ]; then
open_page "http://localhost:81/"
sleep 3
agent-browser eval "window.scrollTo(0, document.body.scrollHeight)" > /dev/null 2>&1
sleep 2
# 1. hub copy + brand
if snap_hit "Every tool you need"; then ok "home hero is hub-accurate"; else bad "home hero"; fi
if snap_hit "Instant Tools"; then ok "Instant Tools section on home"; else bad "Instant Tools section"; fi
if snap_hit "PDF Toolkit"; then ok "home lists Batch 2 tools"; else bad "home Batch 2 listing"; fi
if snap_hit "Kontivo"; then ok "Kontivo brand visible"; else bad "Kontivo brand"; fi
if agent-browser get title 2>/dev/null | rg -qi "ShareOnWeb"; then bad "old brand in title"; else ok "no old brand in title"; fi

# 2. /zip tool renders
open_page "http://localhost:81/zip"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Drop files, a folder, or a .zip archive" --timeout 40000 > /dev/null 2>&1
if snap_hit "Drop files, a folder, or a .zip archive"; then ok "/zip renders drop zone"; else bad "/zip render"; fi

# 3. /hash renders
open_page "http://localhost:81/hash"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Drop the file to hash" --timeout 40000 > /dev/null 2>&1
if snap_hit "Drop the file to hash"; then ok "/hash renders"; else bad "/hash render"; fi

# 4. /password generates immediately
open_page "http://localhost:81/password"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Strength" --timeout 40000 > /dev/null 2>&1
if snap_hit "bits of entropy"; then ok "/password generates + strength"; else bad "/password"; fi

# 5. /pdf: single file -> thumbnails + extract flow
open_page "http://localhost:81/pdf"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/test-3pages.pdf" > /dev/null 2>&1
agent-browser wait --text "Page 1 thumbnail" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "3 pages · .* · 3 kept" && echo "$snap" | rg -q "Page 1 thumbnail" \
  && ok "/pdf workspace with 3 live thumbnails" || bad "/pdf workspace"
echo "$snap" | rg -q "Rebuild & download" && ok "/pdf rebuild action visible" || bad "/pdf rebuild action"
# extract 1-2
agent-browser find role tab click --name "Split & extract" > /dev/null 2>&1
sleep 1
agent-browser find label "Pages to extract" fill "1-2" > /dev/null 2>&1
ebtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Extract & download" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$ebtn > /dev/null 2>&1
agent-browser wait --text "extracted PDF is ready" --timeout 30000 > /dev/null 2>&1
if snap_hit "extracted PDF is ready"; then ok "/pdf extract 1-2 works"; else bad "/pdf extract"; fi
agent-browser close > /dev/null 2>&1

# 6. /pdf merge: two files
open_page "http://localhost:81/pdf"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/test-3pages.pdf" "$FX/test-2pages.pdf" > /dev/null 2>&1
agent-browser wait --text "2 documents · 5 pages total" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "2 documents · 5 pages total" && ok "/pdf merge list (2 docs, 5 pages)" || bad "/pdf merge list"
mbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Merge & download" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$mbtn > /dev/null 2>&1
sleep 2
err=$(agent-browser snapshot -c 2>/dev/null | rg -c "Merging failed" || echo 0)
[ "$err" = "0" ] && ok "/pdf merge completes without error" || bad "/pdf merge"
agent-browser close > /dev/null 2>&1

# 7. /pdf-view: render, page nav, search
open_page "http://localhost:81/pdf-view"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/test-3pages.pdf" > /dev/null 2>&1
sleep 3
agent-browser find role button click --name "Next page" > /dev/null 2>&1
sleep 1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q 'textbox "Page number".*\[ref=.*\]: 2' && ok "/pdf-view page nav (1 -> 2)" || bad "/pdf-view page nav"
agent-browser find label "Search the document" fill "fixture" > /dev/null 2>&1
fbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Find" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$fbtn > /dev/null 2>&1
agent-browser wait --text "3 pages contain" --timeout 40000 > /dev/null 2>&1
if snap_hit'3 pages contain'; then ok "/pdf-view whole-document search"; else bad "/pdf-view search"; fi
agent-browser close > /dev/null 2>&1

# 8. /pdf-text: extraction with real content
open_page "http://localhost:81/pdf-text"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/test-3pages.pdf" > /dev/null 2>&1
sleep 4
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "characters" && echo "$snap" | rg -q "page 2 of 3" \
  && ok "/pdf-text extracts per-page text" || bad "/pdf-text extraction"
agent-browser close > /dev/null 2>&1

# 9. /images-to-pdf: build flow
open_page "http://localhost:81/images-to-pdf"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/photo.png" > /dev/null 2>&1
sleep 2
if snap_hit "1 image · "; then ok "/images-to-pdf accepts image"; else bad "/images-to-pdf accept"; fi
bbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Build & download PDF" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$bbtn > /dev/null 2>&1
sleep 3
if snap_hit "PDF built \("; then ok "/images-to-pdf builds a PDF"; else bad "/images-to-pdf build"; fi
agent-browser close > /dev/null 2>&1

# 10. /office-view: CSV grid + DOCX sandboxed render
open_page "http://localhost:81/office-view"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/data.csv" > /dev/null 2>&1
sleep 3
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "4 rows" && echo "$snap" | rg -q 'cell "apples"' \
  && ok "/office-view CSV grid with cells" || bad "/office-view CSV"
open_page "http://localhost:81/office-view"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/letter.docx" > /dev/null 2>&1
sleep 4
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Word document" && echo "$snap" | rg -q "Kontivo QA Letter" \
  && ok "/office-view DOCX renders (sandboxed)" || bad "/office-view DOCX"
agent-browser close > /dev/null 2>&1

# 11. /epub-view: book opens, TOC jump works, progress updates
open_page "http://localhost:81/epub-view"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/sample.epub" > /dev/null 2>&1
sleep 7
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Kontivo QA Book" && ok "/epub-view opens book with metadata" || bad "/epub-view open"
cbtn=$(echo "$snap" | rg -o 'button "Contents" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$cbtn > /dev/null 2>&1
agent-browser wait --text "Chapter Two" --timeout 40000 > /dev/null 2>&1
c2=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Chapter Two" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$c2 > /dev/null 2>&1
agent-browser wait --text "closing chapter" --timeout 40000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "· Chapter Two" && echo "$snap" | rg -q "closing chapter" \
  && ok "/epub-view TOC jump + section label" || bad "/epub-view TOC jump"
agent-browser close > /dev/null 2>&1

fi  # end phase-1 region

if [ "$PHASE" = "1" ]; then
  echo "$pass" > /tmp/qa-pass; echo "$fail" > /tmp/qa-fail
  echo "== RESULT (phase 1): $pass passed, $fail failed — run PHASE=2 for media, PHASE=3 for the new tools =="
  exit 0
fi

if [ "$PHASE" = "2" ] || [ "$PHASE" = "all" ]; then

# 11a. /audio: decode WAV, trim to 1-2.5s, render WAV result
open_page "http://localhost:81/audio"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/tone.wav" > /dev/null 2>&1
agent-browser wait --text "44100 Hz" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "0:03.0 · 44100 Hz · mono" && ok "/audio decodes WAV + waveform stats" || bad "/audio decode"
agent-browser find label "Start (s)" fill "1" > /dev/null 2>&1
agent-browser find label "End (s)" fill "2.5" > /dev/null 2>&1
rbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Render clip" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$rbtn > /dev/null 2>&1
agent-browser wait --text "tone-toolhive.wav" --timeout 40000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q '"tone-toolhive.wav"' && echo "$snap" | rg -q '1\.5' \
  && ok "/audio trim renders 1.5 s WAV" || bad "/audio render"
agent-browser close > /dev/null 2>&1

# 11b. /gif: video -> GIF end-to-end (VP9 webm fixture)
open_page "http://localhost:81/gif"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/clip.webm" > /dev/null 2>&1
agent-browser wait --text "Video loaded" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q 'Video loaded' && ok "/gif loads video metadata" || bad "/gif video load"
gbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Make GIF — [0-9]+ frames" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$gbtn > /dev/null 2>&1
# 20 frames, each needing a seek+capture; under QA-suite load this can take a while
for i in $(seq 1 12); do
  sleep 5
  if snap_hit'"toolhive-clip.gif"'; then break; fi
done
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q '"toolhive-clip.gif"' && echo "$snap" | rg -q ' frames · ' \
  && echo "$snap" | rg -q '"320"' && ok "/gif video→GIF renders 20 frames" || bad "/gif video→GIF"
agent-browser close > /dev/null 2>&1

# 11c. /gif: drop a GIF -> routes to shrink mode
open_page "http://localhost:81/gif"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/anim.gif" > /dev/null 2>&1
agent-browser wait --text "GIF loaded" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q 'GIF loaded' && ok "/gif routes a GIF to shrink mode" || bad "/gif gif load"
sbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Shrink GIF" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$sbtn > /dev/null 2>&1
agent-browser wait --text "anim-small.gif" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q '"anim-small.gif"' && echo "$snap" | rg -q 'smaller' \
  && ok "/gif shrink produces smaller GIF" || bad "/gif shrink"
agent-browser close > /dev/null 2>&1

# 11d. /frame-grab: grab a frame + sweep batch
open_page "http://localhost:81/frame-grab"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/clip.webm" > /dev/null 2>&1
agent-browser wait --text "Video loaded" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q 'Video loaded' && echo "$snap" | rg -q '"320"' \
  && ok "/frame-grab reads video dims" || bad "/frame-grab metadata"
grbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Grab this frame" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$grbtn > /dev/null 2>&1
sleep 2
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q '" frame"' && ok "/frame-grab single frame lands in sheet" || bad "/frame-grab single"
sweep=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Sweep every 1s" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$sweep > /dev/null 2>&1
for i in $(seq 1 8); do
  sleep 3
  [ "$(agent-browser snapshot -c 2>/dev/null | rg -c 'Frame at' || true)" = "3" ] && break
done
snap=$(agent-browser snapshot -c 2>/dev/null)
[ "$(echo "$snap" | rg -c 'Frame at' || true)" = "3" ] \
  && ok "/frame-grab sweep brings sheet to 3 frames" || bad "/frame-grab sweep"
agent-browser close > /dev/null 2>&1

# 11e. /recorder: surfaces + honest explainer render (headless cannot grant
#      capture permission, so the capture flow itself is verified on-device)
open_page "http://localhost:81/recorder"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q 'Record screen' && echo "$snap" | rg -q 'Microphone' \
  && echo "$snap" | rg -q 'Mix in microphone' \
  && ok "/recorder renders surfaces + mic mix + explainer" || bad "/recorder render"
agent-browser close > /dev/null 2>&1

# 11f. /upscaler: 2x upscale with dimensions shown
open_page "http://localhost:81/upscaler"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/photo.png" > /dev/null 2>&1
sleep 3
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q '"480"' && echo "$snap" | rg -q '"360"' \
  && ok "/upscaler reads source dims" || bad "/upscaler source"
ubtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Upscale" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$ubtn > /dev/null 2>&1
agent-browser wait --text "After — 960×720" --timeout 40000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q 'After — 960×720' && echo "$snap" | rg -q 'Download 960×720' \
  && ok "/upscaler produces 2× result" || bad "/upscaler result"
agent-browser close > /dev/null 2>&1


fi  # end phase-2 region

if [ "$PHASE" = "2" ]; then
  echo "$pass" > /tmp/qa-pass; echo "$fail" > /tmp/qa-fail
  echo "== RESULT (phase 2): $pass passed, $fail failed — run PHASE=3 for the new tools =="
  exit 0
fi

# 11g. /archive: real tar.gz -> entries listed -> ZIP extraction ready
open_page "http://localhost:81/archive"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Drop a .tar, .tar.gz, .tgz or .gz file" --timeout 40000 > /dev/null 2>&1
agent-browser upload "input[type=file]" "$FX/sample.tar.gz" > /dev/null 2>&1
agent-browser wait --text "readme.txt" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "readme.txt" && echo "$snap" | rg -q "docs" \
  && ok "/archive lists tar.gz entries" || bad "/archive listing"
echo "$snap" | rg -q "Download selected \(" && ok "/archive ZIP extraction action ready" || bad "/archive extract action"
agent-browser close > /dev/null 2>&1

# 11h. /encrypt: text encrypt produces a Base64 container
open_page "http://localhost:81/encrypt"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Encrypt text" --timeout 40000 > /dev/null 2>&1
agent-browser find role tab click --name "Text" > /dev/null 2>&1
agent-browser wait --text "Text to encrypt" --timeout 20000 > /dev/null 2>&1
agent-browser find label "Text to encrypt" fill "Kontivo QA secret: launch code 4-7-11." > /dev/null 2>&1
agent-browser find label "Password" fill "correct horse battery staple 42" > /dev/null 2>&1
agent-browser find label "Confirm password" fill "correct horse battery staple 42" > /dev/null 2>&1
ebtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Encrypt text" \[.*ref=(e[0-9]+)\]' -r '$1' | tail -1)
agent-browser click @$ebtn > /dev/null 2>&1
agent-browser wait --text "Encrypted container" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Encrypted container" \
  && ok "/encrypt text produces a container" || bad "/encrypt text"
echo "$snap" | rg -q "characters" && ok "/encrypt reports container size" || bad "/encrypt size"
agent-browser close > /dev/null 2>&1

# 11i. /meta-scrub: PNG tEXt records shown, scrub, proof pass clean
open_page "http://localhost:81/meta-scrub"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/photo-text.png" > /dev/null 2>&1
agent-browser wait --text "Scrub metadata and verify" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Kontivo QA" && echo "$snap" | rg -q "Software" \
  && ok "/meta-scrub decodes PNG tEXt records" || bad "/meta-scrub decode"
sbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Scrub metadata and verify" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$sbtn > /dev/null 2>&1
agent-browser wait --text "Proof pass" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Proof pass" && echo "$snap" | rg -q "0 metadata records" \
  && ok "/meta-scrub proof pass is clean" || bad "/meta-scrub proof"
agent-browser close > /dev/null 2>&1

# 11j. /jwt: decode + verify an HS256 token end to end
open_page "http://localhost:81/jwt"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Paste a JWT" --timeout 40000 > /dev/null 2>&1
agent-browser find label "Token" fill "$(cat "$FX/jwt-sample.txt")" > /dev/null 2>&1
agent-browser wait --text "Decoded payload" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Kontivo QA Token" && echo "$snap" | rg -q "Decoded payload" \
  && ok "/jwt decodes header + payload" || bad "/jwt decode"
agent-browser find label "Shared secret" fill "kontivo-qa-signing-secret" > /dev/null 2>&1
# Verification runs automatically once a secret is present — no button.
agent-browser wait --text "Signature verified" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Signature verified" \
  && ok "/jwt verifies HS256 signature" || bad "/jwt verify"
agent-browser close > /dev/null 2>&1

# 11k. /hash-file-batch: two files -> digest rows in GNU format
open_page "http://localhost:81/hash-file-batch"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/data.csv" "$FX/photo.png" > /dev/null 2>&1
agent-browser wait --text "SHA-256" --timeout 60000 > /dev/null 2>&1
hbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Hash [0-9]+ files" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$hbtn > /dev/null 2>&1
agent-browser wait --text "done" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Digests" && echo "$snap" | rg -q '[0-9a-f]{64}' \
  && ok "/hash-file-batch computes SHA-256 digests" || bad "/hash-file-batch digests"
agent-browser close > /dev/null 2>&1

# 11l. /file-tools: split panel plans the cut
open_page "http://localhost:81/file-tools"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/data.csv" > /dev/null 2>&1
agent-browser wait --text "By part size" --timeout 60000 > /dev/null 2>&1
agent-browser find label "Split" click > /dev/null 2>&1
sleep 1
agent-browser find text "Into N equal parts" click > /dev/null 2>&1
sleep 1
agent-browser find label "Number of parts" fill "2" > /dev/null 2>&1
agent-browser wait --text "Download part" --timeout 30000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Into N equal parts|2 parts" && echo "$snap" | rg -q "Download part" \
  && ok "/file-tools split plans parts with downloads" || bad "/file-tools split"
agent-browser close > /dev/null 2>&1

# 11m. /cron: plain-English schedule + next runs grid
open_page "http://localhost:81/cron"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Cron expression" --timeout 40000 > /dev/null 2>&1
agent-browser find label "Cron expression" fill "30 9 * * 1-5" > /dev/null 2>&1
agent-browser wait --text "At 09:30" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "At 09:30" && echo "$snap" | rg -q "Next fire times" \
  && ok "/cron parses + describes the schedule" || bad "/cron sentence"
cbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Daily 03:30" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$cbtn > /dev/null 2>&1
agent-browser wait --text "At 03:30" --timeout 30000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "At 03:30" && echo "$snap" | rg -q "30 3 \* \* \*" \
  && ok "/cron preset gives sentence + expansion" || bad "/cron preset"
agent-browser close > /dev/null 2>&1

# 11n. /diff: live diff with stats and word highlight
open_page "http://localhost:81/diff"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Paste the original text" --timeout 40000 > /dev/null 2>&1
agent-browser find label "Original" fill "$(printf 'alpha line one\nbeta line two\nshared tail')" > /dev/null 2>&1
agent-browser find label "Changed" fill "$(printf 'alpha line ONE edited\ngamma line three\nshared tail')" > /dev/null 2>&1
agent-browser wait --text "gamma line three" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "removed" && echo "$snap" | rg -q "gamma line three" \
  && ok "/diff computes the live diff" || bad "/diff diff"
echo "$snap" | rg -q "Copy patch" && echo "$snap" | rg -q "Download .patch" \
  && ok "/diff patch export buttons ready" || bad "/diff patch export"
agent-browser close > /dev/null 2>&1

# 11o. /uuid: IDs generated on open; inspector decodes a known v1 UUID
open_page "http://localhost:81/uuid"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Copy all" --timeout 40000 > /dev/null 2>&1
agent-browser wait --fn "document.body.innerText.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}/) !== null" --timeout 40000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' \
  && ok "/uuid generates v4 IDs on open" || bad "/uuid generate"
itab=$(agent-browser snapshot -c 2>/dev/null | rg -o 'tab "Inspect" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$itab > /dev/null 2>&1
sleep 1
agent-browser find label "Paste a UUID or ULID" fill "c232ab00-9414-1ec0-9800-1c5ec5218cd9" > /dev/null 2>&1
agent-browser wait --text "v1 — time-based" --timeout 30000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "v1 — time-based" && echo "$snap" | rg -q "Embedded timestamp" \
  && ok "/uuid inspector decodes version + timestamp" || bad "/uuid inspect"
agent-browser close > /dev/null 2>&1

# 11p. /convert-units: exact factor result on open, Roman tab defaults
open_page "http://localhost:81/convert-units"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "3.28084" --timeout 60000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "3.28084" \
  && ok "/convert-units converts 1 m to ft exactly" || bad "/convert-units factor"
rtab=$(agent-browser snapshot -c 2>/dev/null | rg -o 'tab "Roman" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$rtab > /dev/null 2>&1
agent-browser wait --text "MCMLXXXVII" --timeout 30000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "MCMLXXXVII" && echo "$snap" | rg -q "1987" \
  && ok "/convert-units Roman tab converts both ways" || bad "/convert-units roman"
agent-browser close > /dev/null 2>&1

# 12. legacy /beam redirects to /share
r=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://localhost:81/beam")
if [ "$r" = "307 http://localhost:81/share" ]; then ok "/beam 307 -> /share"; else bad "/beam redirect: $r"; fi

# 13. /share landing renders modes
open_page "http://localhost:81/share"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Start files now" --timeout 40000 > /dev/null 2>&1
if snap_hit "Quick Pair"; then ok "/share renders 4 modes"; else bad "/share modes"; fi

# 14. start a session and verify unified in-session modes (one code, all modes)
agent-browser find text "Start files now" click > /dev/null 2>&1
agent-browser wait --fn "window.location.pathname !== '/share'" --timeout 30000 > /dev/null 2>&1
newurl=$(agent-browser get url 2>/dev/null)
if [[ "$newurl" =~ ^http://localhost:81/[A-Z0-9]{6}$ ]]; then ok "new session at $newurl"; else bad "new session url: $newurl"; fi
sleep 2
if snap_hit "Share modes"; then ok "in-session Share modes tablist"; else bad "in-session Share modes"; fi
if snap_hit '"Folder"'; then ok "Folder tab reachable in-session (one code, all modes)"; else bad "Folder tab in-session"; fi

# 15. legacy ?s= / ?app= rewrites still work
legacyCode=$(echo "$newurl" | rg -o '[A-Z0-9]{6}$')
open_page "http://localhost:81/?s=$legacyCode"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --fn "window.location.pathname === '/$legacyCode'" --timeout 30000 > /dev/null 2>&1
u=$(agent-browser get url 2>/dev/null)
if [ "$u" = "http://localhost:81/$legacyCode" ]; then ok "legacy ?s= rewrites to /$legacyCode"; else bad "legacy ?s= rewrite: $u"; fi
open_page "http://localhost:81/?app=drop"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --fn "window.location.pathname === '/share'" --timeout 30000 > /dev/null 2>&1
u=$(agent-browser get url 2>/dev/null)
if [ "$u" = "http://localhost:81/share" ]; then ok "legacy ?app=drop -> /share"; else bad "legacy ?app= rewrite: $u"; fi

# 16. 404
g=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:81/garbage123")
if [ "$g" = "404" ]; then ok "/garbage123 404"; else bad "404: $g"; fi

echo "== SEO + ethic checks (server HTML) =="
# 17. home: the SIMPLE landing page (reverted per owner) — hero privacy line,
#     code explanation, problem/process/trust sections, FAQPage JSON-LD present
h=$(curl -s http://localhost:81/)
echo "$h" | rg -q "No accounts, no ads, nothing uploaded" \
  && ok "home hero states the no-upload ethic" || bad "home ethic line"
echo "$h" | rg -q "Every session opens with a code like this" \
  && ok "hero explains the session code" || bad "hero code explanation"
echo "$h" | rg -q "The usual ways are heavier than the task" \
  && ok "problem section present" || bad "problem section"
echo "$h" | rg -q "Three steps, every tool" \
  && ok "process section present" || bad "process section"
echo "$h" | rg -q "Privacy is a feature, not a settings page" \
  && ok "trust section present" || bad "trust section"
echo "$h" | rg -q '"@type":"FAQPage"' && ok "home FAQPage JSON-LD" || bad "home FAQPage JSON-LD"

# 18. every live tool page: title, WebApplication + HowTo + FAQPage JSON-LD,
#     no old brand. Instant pages also render the written page below the tool.
ALL_LIVE="share call screen camera voice notepad present canvas roundtable co-browse location-share live-captions zip image hash encode json text password qr pdf pdf-view pdf-text images-to-pdf office-view epub-view audio gif frame-grab recorder upscaler archive file-tools encrypt meta-scrub jwt hash-file-batch cron diff uuid convert-units"
for p in $ALL_LIVE; do
  h=$(curl -s "http://localhost:81/$p")
  t=$(echo "$h" | rg -o '<title>[^<]*</title>' | head -1)
  good=1
  echo "$h" | rg -q '"@type":"WebApplication"' || { bad "$p: WebApplication JSON-LD"; good=0; }
  echo "$h" | rg -q '"@type":"HowTo"' || { bad "$p: HowTo JSON-LD"; good=0; }
  echo "$h" | rg -q '"@type":"FAQPage"' || { bad "$p: FAQPage JSON-LD"; good=0; }
  echo "$h" | rg -q '<title>[^<]*· Kontivo</title>' || { bad "$p: title not tool-branded"; good=0; }
  # old BRAND leak (not the unchanged domain shareonweb.vercel.app, which is
  # legitimately present in canonical/JSON-LD URLs)
  echo "$h" | rg -q '<title>[^<]*(ShareOnWeb|SHAREONWEB)[^<]*</title>' && { bad "$p: old brand in title"; good=0; }
  [ "$good" = "1" ] && ok "$p: title + 3 JSON-LD graphs"
done

# 19. instant page body: action first, written content below
open_page "http://localhost:81/zip"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Drop files, a folder, or a .zip archive" --timeout 40000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "What Zip & Unzip does" \
  && ok "/zip shows What-it-does below the tool" || bad "/zip what-it-does"
echo "$snap" | rg -q "Zip & Unzip packs a pile of files" \
  && ok "/zip long-form article renders below the action" || bad "/zip article lede"
echo "$snap" | rg -q "How packing and unpacking works" \
  && ok "/zip article mechanics section renders" || bad "/zip article mechanics"
echo "$snap" | rg -q "When it beats the desktop way" \
  && ok "/zip article scenarios section renders" || bad "/zip article scenarios"
echo "$snap" | rg -q "What happens to your files" \
  && ok "/zip article privacy section renders" || bad "/zip article privacy"
echo "$snap" | rg -q "Quick answers about Zip & Unzip" \
  && ok "/zip shows FAQs below the tool" || bad "/zip faq section"
echo "$snap" | rg -q "Private by construction" \
  && ok "/zip privacy aside" || bad "/zip privacy aside"
agent-browser close > /dev/null 2>&1

# 20. session landing: action first (button before any mode explanation)
open_page "http://localhost:81/share"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Start files now" --timeout 40000 > /dev/null 2>&1
if snap_hit "Start files now"; then ok "/share CTA reachable"; else bad "/share CTA"; fi
agent-browser wait --text "How a transfer actually happens" --timeout 40000 > /dev/null 2>&1
agent-browser snapshot -c 2>/dev/null | rg -q "How a transfer actually happens" \
  && ok "/share long-form article renders below the action" || bad "/share article"
agent-browser snapshot -c 2>/dev/null | rg -q "Details worth knowing" \
  && ok "/share article reaches the details section" || bad "/share article details"
agent-browser close > /dev/null 2>&1

echo "== console errors =="
agent-browser errors 2>/dev/null | rg -v "stderr|launched" | head -4 || true

echo "== RESULT: $pass passed, $fail failed =="
agent-browser close > /dev/null 2>&1
[ "$fail" = "0" ]
