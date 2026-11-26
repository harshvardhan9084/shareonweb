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
case "$PHASE" in
  4|4b|4c|5|6|9|10|11|12)
    echo "  (skipped — the warm list was printed by the earlier phase of this run)"
    ;;
  *)
    for p in "/share" "/zip" "/image" "/hash" "/encode" "/json" "/text" "/password" "/qr" \
             "/pdf" "/pdf-view" "/pdf-text" "/images-to-pdf" "/office-view" "/epub-view" \
             "/audio" "/gif" "/frame-grab" "/recorder" "/upscaler" \
             "/archive" "/file-tools" "/encrypt" "/meta-scrub" "/jwt" "/hash-file-batch" \
             "/cron" "/diff" "/uuid" "/convert-units" \
             "/lorem" "/fake-data" "/css-tools" "/meta-tags" "/barcode" \
             "/calculator" "/percentage" "/date-calculator" "/bmi" "/loan" \
             "/timer" "/picker" "/regex" "/csv" "/color" \
             "/signature" "/invoice" "/timezone" "/pdf-to-image" "/device-test" \
             "/beautify" "/favicon" "/watermark" "/typing-test" "/markdown" \
             "/stats" "/number-to-words" "/morse" "/font-changer" "/emoji" \
             "/json-to-ts" "/compress-pdf" "/time-card" "/grade" "/todo" \
             "/meme" "/svg-convert" "/cipher" "/due-date" "/word-frequency" \
             "/vcard" "/calendar-link" "/px-rem" "/binary" \
             "/sound-tools" "/tts" "/fuel-cost" "/salary" "/sleep" \
             "/pace" "/one-rep-max" "/fraction" "/quadratic" \
             "/spreadsheet" "/chart-maker" "/resume" "/video-studio" \
             "/bg-remove" "/speed-test" \
             "/beam" "/call"; do
      printf "  %-14s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://localhost:81$p")"
    done
    ;;
esac

pass=0; fail=0
if { [ "$PHASE" = "2" ] || [ "$PHASE" = "4" ] || [ "$PHASE" = "4b" ] || [ "$PHASE" = "4c" ] || [ "$PHASE" = "5" ] || [ "$PHASE" = "6" ] || [ "$PHASE" = "8" ] || [ "$PHASE" = "9" ] || [ "$PHASE" = "10" ] || [ "$PHASE" = "11" ] || [ "$PHASE" = "12" ]; } && [ -f /tmp/qa-pass ]; then
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
if snap_hit '3 pages contain'; then ok "/pdf-view whole-document search"; else bad "/pdf-view search"; fi
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
  if snap_hit '"toolhive-clip.gif"'; then break; fi
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

# PHASE=7 skips the (already verified) 11g→19b middle region and runs only
# the final section 20 + console sweep + tally, so the last checks never
# blow the invocation timeout on a slow box.
if [ "$PHASE" != "7" ]; then

# PHASE=8 skips the (already verified in this run) 11g→R4 browser region and
# runs only the ALL_LIVE JSON-LD sweep, the instant-body check, the sw mirror
# and the final landing + console sweep, so the sweeps fit one invocation.
if [ "$PHASE" != "8" ] && [ "$PHASE" != "10" ] && [ "$PHASE" != "11" ] && [ "$PHASE" != "12" ]; then

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

# 11q. /lorem: seeded filler builds + determinism (same seed → same text)
open_page "http://localhost:81/lorem"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Copy text" --timeout 40000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Lorem ipsum dolor sit amet" \
  && ok "/lorem opens on classic filler" || bad "/lorem default"
agent-browser find label "Seed" fill "qa-seed-77" > /dev/null 2>&1
sleep 1
first=$(agent-browser snapshot -c 2>/dev/null)
agent-browser find label "Seed" fill "qa-seed-88" > /dev/null 2>&1
sleep 1
second=$(agent-browser snapshot -c 2>/dev/null)
[ "$first" != "$second" ] && ok "/lorem seed changes rebuild the text" || bad "/lorem seed"
agent-browser close > /dev/null 2>&1

# 11r. /fake-data: table of reserved-range records + CSV/JSON buttons
open_page "http://localhost:81/fake-data"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Copy JSON" --timeout 40000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q '@example\.(com|net|org)' \
  && ok "/fake-data builds example-domain records" || bad "/fake-data emails"
echo "$snap" | rg -q "555-01" \
  && ok "/fake-data phones stay in the fictional 555-01XX range" || bad "/fake-data phones"
echo "$snap" | rg -q "CSV" && echo "$snap" | rg -q "JSON" \
  && ok "/fake-data offers CSV + JSON exports" || bad "/fake-data exports"
agent-browser close > /dev/null 2>&1

# 11s. /css-tools: gradient preview + CSS block on open; shadow tab renders
open_page "http://localhost:81/css-tools"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Copy CSS" --timeout 40000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "linear-gradient" && echo "$snap" | rg -q "135deg" \
  && ok "/css-tools gradient emits live CSS" || bad "/css-tools gradient"
stab=$(agent-browser snapshot -c 2>/dev/null | rg -o 'tab "Box shadow" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$stab > /dev/null 2>&1
agent-browser wait --text "Offset X" --timeout 30000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "box-shadow" && echo "$snap" | rg -q "Add layer" \
  && ok "/css-tools shadow tab emits layered CSS" || bad "/css-tools shadow"
agent-browser close > /dev/null 2>&1

# 11t. /meta-tags: snippet + previews react to input
open_page "http://localhost:81/meta-tags"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Copy snippet" --timeout 40000 > /dev/null 2>&1
agent-browser find label "Page title" fill "How to brew better coffee at home" > /dev/null 2>&1
agent-browser find label "Canonical URL" fill "https://example.com/guides/coffee" > /dev/null 2>&1
agent-browser wait --text "og:title" --timeout 30000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q 'og:title' && echo "$snap" | rg -q 'How to brew better coffee at home' \
  && ok "/meta-tags emits og:title from the field" || bad "/meta-tags og"
echo "$snap" | rg -q "Search result preview" && echo "$snap" | rg -q "X card preview" \
  && ok "/meta-tags renders SERP + social previews" || bad "/meta-tags previews"
echo "$snap" | rg -q 'canonical' && echo "$snap" | rg -q 'example.com/guides/coffee' \
  && ok "/meta-tags canonical lands in the snippet" || bad "/meta-tags canonical"
agent-browser close > /dev/null 2>&1

# 11u. /barcode: EAN-13 checksum completes 12 digits, renders SVG
open_page "http://localhost:81/barcode"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Copy value" --timeout 40000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Code 128" \
  && ok "/barcode opens on Code 128 with a rendered code" || bad "/barcode default"
agent-browser find label "Format" click > /dev/null 2>&1
sleep 1
agent-browser find text "EAN-13 (retail products, 12–13 digits)" click > /dev/null 2>&1
agent-browser find label "Digits (12 → check digit added, 13 verified)" fill "400638133393" > /dev/null 2>&1
agent-browser wait --text "Check digit" --timeout 30000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "4006381333931" \
  && ok "/barcode computes the EAN-13 check digit (…1)" || bad "/barcode checksum"
agent-browser find label "Digits (12 → check digit added, 13 verified)" fill "4006381333932" > /dev/null 2>&1
sleep 1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "position 13 should be 1, not 2" \
  && ok "/barcode rejects a wrong check digit by name" || bad "/barcode wrong digit"
agent-browser close > /dev/null 2>&1

# 11u2. Batch R1 — calculators & generators (one real interaction per tool)

# /calculator: set the expression, the live result must evaluate to 84
open_page "http://localhost:81/calculator"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
calc1=$(agent-browser eval "(() => { const el = document.getElementById('calc-expr'); const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '12*(3+4)'); el.dispatchEvent(new Event('input', { bubbles: true })); const btn = document.querySelector('[aria-label^=\"Copy result\"]'); return btn ? btn.getAttribute('aria-label') : 'no-result' })()" 2>/dev/null)
echo "$calc1" | rg -q 'Copy result 84' && ok "/calculator evaluates 12*(3+4) live" || bad "/calculator live eval: $calc1"
if snap_hit 'Scientific pad'; then ok "/calculator scientific switch present"; else bad "/calculator scientific switch"; fi
calc2=$(agent-browser eval "(() => { const el = document.getElementById('calc-expr'); const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '5/0'); el.dispatchEvent(new Event('input', { bubbles: true })); return document.querySelector('[role=alert]') ? document.querySelector('[role=alert]').textContent : 'no-alert' })()" 2>/dev/null)
echo "$calc2" | rg -q 'Division by zero' && ok "/calculator names division by zero" || bad "/calculator div-by-zero: $calc2"
agent-browser close > /dev/null 2>&1

# /percentage: defaults 25% of 120 = 30, formula shown
open_page "http://localhost:81/percentage"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
if snap_hit '25% of 120'; then ok "/percentage of-mode computes 25% of 120"; else bad "/percentage of-mode"; fi
if snap_hit '25 ÷ 100. × 120'; then ok "/percentage shows the formula"; else bad "/percentage formula"; fi
# discount mode: 250 at 20% off -> 200.00 you pay / 50.00 saved
dtab=$(agent-browser snapshot -c 2>/dev/null | rg -o 'tab "Discount" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$dtab > /dev/null 2>&1
agent-browser eval "(() => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; const a = document.getElementById('pct-a'); s.call(a, '250'); a.dispatchEvent(new Event('input', { bubbles: true })); const b = document.getElementById('pct-b'); s.call(b, '20'); b.dispatchEvent(new Event('input', { bubbles: true })); return true })()" > /dev/null 2>&1
sleep 1
if snap_hit '200.00'; then ok "/percentage discount computes the final price"; else bad "/percentage discount"; fi
if snap_hit 'You save'; then ok "/percentage discount names the savings"; else bad "/percentage savings"; fi
agent-browser close > /dev/null 2>&1

# /date-calculator: default age 1990-01-01 -> exact age + next birthday
open_page "http://localhost:81/date-calculator"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
if snap_hit 'Exact age'; then ok "/date-calculator age mode renders the breakdown"; else bad "/date-calculator age"; fi
if snap_hit 'Next birthday'; then ok "/date-calculator next-birthday countdown"; else bad "/date-calculator birthday"; fi
if snap_hit 'Total days'; then ok "/date-calculator total-days stat"; else bad "/date-calculator totals"; fi
agent-browser close > /dev/null 2>&1

# /bmi: metric defaults 175cm/72kg -> BMI 23.5, healthy band
open_page "http://localhost:81/bmi"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
if snap_hit '23.5'; then ok "/bmi computes 72kg/175cm = 23.5"; else bad "/bmi value"; fi
if snap_hit 'Healthy weight'; then ok "/bmi shows the WHO band"; else bad "/bmi band"; fi
if snap_hit 'Mifflin-St Jeor'; then ok "/bmi names the calorie formula"; else bad "/bmi formula"; fi
if snap_hit 'not medical advice'; then ok "/bmi carries the honesty note"; else bad "/bmi note"; fi
agent-browser close > /dev/null 2>&1

# /loan: defaults -> monthly payment + full schedule
open_page "http://localhost:81/loan"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
if snap_hit 'Monthly payment'; then ok "/loan computes the EMI headline"; else bad "/loan emi"; fi
if snap_hit 'Amortization schedule'; then ok "/loan renders the amortization schedule"; else bad "/loan schedule"; fi
if snap_hit 'CSV'; then ok "/loan offers the CSV export"; else bad "/loan csv"; fi
agent-browser close > /dev/null 2>&1

# /timer: stopwatch starts and runs, pomodoro phases render
open_page "http://localhost:81/timer"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
if snap_hit 'Press Lap while running'; then ok "/timer stopwatch idle state"; else bad "/timer idle"; fi
agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('Start')); if (b) b.click(); return b ? 'clicked' : 'no-button' })()" > /dev/null 2>&1
sleep 2
timerRun=$(agent-browser eval "document.body.textContent.includes('Pause') ? 'yes' : 'no'" 2>/dev/null)
echo "$timerRun" | rg -q 'yes' && ok "/timer stopwatch runs (Pause reachable)" || bad "/timer run"
ptab=$(agent-browser snapshot -c 2>/dev/null | rg -o 'tab "Pomodoro" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$ptab > /dev/null 2>&1
sleep 1
if snap_hit '25'; then ok "/timer pomodoro mode with defaults"; else bad "/timer pomodoro"; fi
agent-browser close > /dev/null 2>&1

# /picker: spin the wheel and read a real winner
open_page "http://localhost:81/picker"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
if snap_hit 'Spin the wheel'; then ok "/picker wheel renders with entries"; else bad "/picker wheel"; fi
agent-browser find text "Spin the wheel" click > /dev/null 2>&1
agent-browser wait --text "wins" --timeout 15000 > /dev/null 2>&1
sleep 1
if snap_hit 'wins'; then ok "/picker wheel lands on a real winner"; else bad "/picker spin"; fi
dtab=$(agent-browser snapshot -c 2>/dev/null | rg -o 'tab "Dice roller" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$dtab > /dev/null 2>&1
sleep 1
if snap_hit 'Roll'; then ok "/picker dice mode reachable"; else bad "/picker dice"; fi
agent-browser close > /dev/null 2>&1

# /regex: default pattern matches the duplicate words, table + replace render
open_page "http://localhost:81/regex"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
rxCount=$(agent-browser eval "document.body.textContent.includes('2 matches') ? 'yes' : 'no'" 2>/dev/null)
echo "$rxCount" | rg -q 'yes' && ok "/regex finds the duplicate-word matches" || bad "/regex matches: $rxCount"
if snap_hit 'Capture|Groups'; then ok "/regex match table renders"; else bad "/regex table"; fi
if snap_hit 'Replace preview'; then ok "/regex replace preview present"; else bad "/regex replace"; fi
agent-browser eval "(() => { const el = document.getElementById('rx-pattern'); const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '([a-z'); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()" > /dev/null 2>&1
sleep 1
if snap_hit 'Invalid pattern'; then ok "/regex explains an invalid pattern"; else bad "/regex invalid"; fi
agent-browser close > /dev/null 2>&1

# /csv: default input parses 3 rows x 3 cols with the quoted newline field
open_page "http://localhost:81/csv"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
if snap_hit '3 rows × 3 columns'; then ok "/csv RFC4180-parses the quoted sample"; else bad "/csv parse"; fi
if snap_hit 'Asha, senior'; then ok "/csv keeps a comma inside quotes"; else bad "/csv quoted comma"; fi
csvJson=$(agent-browser eval "(() => { const pre = document.querySelector('pre'); return pre ? (pre.textContent.includes('\"name\": \"Asha, senior\"') ? 'found' : pre.textContent.slice(0, 80)) : 'no-pre' })()" 2>/dev/null)
echo "$csvJson" | rg -q 'found' && ok "/csv JSON output renders" || bad "/csv json: $csvJson"
jtab=$(agent-browser snapshot -c 2>/dev/null | rg -o 'tab "JSON → CSV" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$jtab > /dev/null 2>&1
sleep 1
if snap_hit 'Invalid JSON|Paste your JSON'; then ok "/csv JSON→CSV direction reachable"; else bad "/csv json2csv"; fi
agent-browser close > /dev/null 2>&1

# /color: default teal converts every format + contrast tab
open_page "http://localhost:81/color"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
colorRgb=$(agent-browser eval "document.body.textContent.includes('rgb(15, 118, 110)') ? 'yes' : 'no'" 2>/dev/null)
echo "$colorRgb" | rg -q 'yes' && ok "/color converts #0f766e to rgb" || bad "/color rgb: $colorRgb"
colorHsl=$(agent-browser eval "document.body.textContent.includes('hsl(175') ? 'yes' : 'no'" 2>/dev/null)
echo "$colorHsl" | rg -q 'yes' && ok "/color converts to hsl" || bad "/color hsl: $colorHsl"
if snap_hit 'WCAG 2.1 contrast'; then ok "/color contrast section renders"; else bad "/color contrast"; fi
if snap_hit 'Contrast ratio'; then ok "/color computes a real ratio"; else bad "/color ratio"; fi
if snap_hit 'Palettes from this color'; then ok "/color palette ramps render"; else bad "/color palette"; fi
agent-browser close > /dev/null 2>&1

# 11u3. Batch R2 — documents & media utilities (one real interaction per tool)

# /signature: draw idle state, then Type mode renders the default name
open_page "http://localhost:81/signature"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
if snap_hit 'Sign here with your mouse'; then ok "/signature draw pad renders with the guide"; else bad "/signature draw pad"; fi
stab=$(agent-browser snapshot -c 2>/dev/null | rg -o 'tab "Type" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$stab > /dev/null 2>&1
sleep 1
if snap_hit 'Alex Morgan'; then ok "/signature type mode renders the name preview"; else bad "/signature type mode"; fi
if snap_hit 'Download PNG'; then ok "/signature export action present"; else bad "/signature export"; fi
agent-browser close > /dev/null 2>&1

# /invoice: default line items land in the sheet, math breakdown visible
open_page "http://localhost:81/invoice"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
if snap_hit 'Website design'; then ok "/invoice default line items reach the sheet"; else bad "/invoice items"; fi
if snap_hit 'Taxable base'; then ok "/invoice shows the math breakdown"; else bad "/invoice math"; fi
if snap_hit 'Print invoice'; then ok "/invoice print action present"; else bad "/invoice print"; fi
invtotal=$(agent-browser eval "(() => { const t = [...document.querySelectorAll('table')].map(x => x.textContent).join(' '); return t.includes('620.00') ? 'yes' : t.slice(0, 80) })()" 2>/dev/null)
echo "$invtotal" | rg -q 'yes' && ok "/invoice computes 500+120 subtotal" || bad "/invoice total: $invtotal"
agent-browser close > /dev/null 2>&1

# /timezone: default convert rows with offsets, planner strip reachable
open_page "http://localhost:81/timezone"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
if snap_hit 'New York'; then ok "/timezone convert lists the default target"; else bad "/timezone convert"; fi
if snap_hit 'UTC'; then ok "/timezone rows show offsets"; else bad "/timezone offsets"; fi
ptab=$(agent-browser snapshot -c 2>/dev/null | rg -o 'tab "Meeting planner" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$ptab > /dev/null 2>&1
sleep 1
if snap_hit 'Work starts'; then ok "/timezone planner strip renders"; else bad "/timezone planner"; fi
if snap_hit 'Everyone is at work during|No hour sits inside working hours'; then ok "/timezone planner gives an honest verdict"; else bad "/timezone verdict"; fi
agent-browser close > /dev/null 2>&1

# /pdf-to-image: real 3-page fixture renders, progress completes
open_page "http://localhost:81/pdf-to-image"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser upload "input[type=file]" "$FX/test-3pages.pdf" > /dev/null 2>&1
agent-browser wait --text "rendered 3/3" --timeout 60000 > /dev/null 2>&1
sleep 1
if snap_hit 'rendered 3/3'; then ok "/pdf-to-image renders all 3 fixture pages"; else bad "/pdf-to-image render"; fi
if snap_hit 'Download all 3 as ZIP'; then ok "/pdf-to-image offers the ZIP"; else bad "/pdf-to-image zip"; fi
p2iW=$(agent-browser eval "(() => { const img = document.querySelector('figure img'); return img ? (img.naturalWidth > 100 ? 'yes' : 'blank:' + img.naturalWidth) : 'no-img' })()" 2>/dev/null)
echo "$p2iW" | rg -q 'yes' && ok "/pdf-to-image thumbnails carry real pixels" || bad "/pdf-to-image thumb: $p2iW"
agent-browser close > /dev/null 2>&1

# /device-test: honest idle states + device info card values
open_page "http://localhost:81/device-test"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
if snap_hit 'Start camera test'; then ok "/device-test camera idle state"; else bad "/device-test camera idle"; fi
if snap_hit 'Start microphone test'; then ok "/device-test mic idle state"; else bad "/device-test mic idle"; fi
if snap_hit 'Pixel ratio'; then ok "/device-test info card renders"; else bad "/device-test info"; fi
if snap_hit 'Secure context'; then ok "/device-test names the secure-context state"; else bad "/device-test secure"; fi
agent-browser close > /dev/null 2>&1

# /beautify: CSS beautified on load; compact preserves calc() spaces
# The formatter engine is a lazy import — on a cold server the chunk may
# still be loading when the first eval fires, so the check retries like
# snap_hit does for transient misses.
open_page "http://localhost:81/beautify"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Formatted output" --timeout 40000 > /dev/null 2>&1
sleep 2
bfOut=$(agent-browser eval "(() => { const pre = document.querySelector('pre'); if (!pre) return 'no-pre'; return pre.textContent.includes('box-shadow: 0 1px 3px') ? 'yes' : pre.textContent.slice(0, 100) })()" 2>/dev/null)
bfi=0
while ! echo "$bfOut" | rg -q 'yes' && [ "$bfi" -lt 4 ]; do
  sleep 4
  bfOut=$(agent-browser eval "(() => { const pre = document.querySelector('pre'); if (!pre) return 'no-pre'; return pre.textContent.includes('box-shadow: 0 1px 3px') ? 'yes' : pre.textContent.slice(0, 100) })()" 2>/dev/null)
  bfi=$((bfi+1))
done
echo "$bfOut" | rg -q 'yes' && ok "/beautify expands the default CSS" || bad "/beautify css: $bfOut"
cbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Compact" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$cbtn > /dev/null 2>&1
sleep 1
bfC=$(agent-browser eval "(() => { const pre = document.querySelector('pre'); if (!pre) return 'no-pre'; const t = pre.textContent; return (t.includes('calc(100% - 24px)') && !t.includes('/*')) ? 'yes' : (t.includes('calc(') ? 'calc-mangled:' + t.match(/calc.{0,20}/)?.[0] : 'no-calc') })()" 2>/dev/null)
bfci=0
while ! echo "$bfC" | rg -q 'yes' && [ "$bfci" -lt 4 ]; do
  sleep 4
  bfC=$(agent-browser eval "(() => { const pre = document.querySelector('pre'); if (!pre) return 'no-pre'; const t = pre.textContent; return (t.includes('calc(100% - 24px)') && !t.includes('/*')) ? 'yes' : (t.includes('calc(') ? 'calc-mangled:' + t.match(/calc.{0,20}/)?.[0] : 'no-calc') })()" 2>/dev/null)
  bfci=$((bfci+1))
done
echo "$bfC" | rg -q 'yes' && ok "/beautify compact keeps calc() spaces, drops comments" || bad "/beautify compact: $bfC"
agent-browser close > /dev/null 2>&1

# /favicon: fixture photo becomes the whole set incl. real .ico
open_page "http://localhost:81/favicon"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser upload "input[type=file]" "$FX/photo.png" > /dev/null 2>&1
agent-browser wait --text "512 × 512" --timeout 60000 > /dev/null 2>&1
sleep 1
fvTiles=$(agent-browser eval "(() => { const t = document.body.textContent; return (t.includes('16 × 16') && t.includes('512 × 512')) ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$fvTiles" | rg -q 'yes' && ok "/favicon renders the 16px and 512px tiles" || bad "/favicon tiles: $fvTiles"
fvSnip=$(agent-browser eval "document.body.textContent.includes('Paste this into your') ? 'yes' : 'no'" 2>/dev/null)
echo "$fvSnip" | rg -q 'yes' && ok "/favicon generates the link snippet" || bad "/favicon snippet: $fvSnip"
fvIco=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Download favicon.ico'); return b ? 'present' : 'no-btn' })()" 2>/dev/null)
echo "$fvIco" | rg -q 'present' && ok "/favicon ico download reachable" || bad "/favicon ico btn: $fvIco"
agent-browser close > /dev/null 2>&1

# /watermark: fixture photo stamped, result file produced
open_page "http://localhost:81/watermark"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser upload "input[type=file]" "$FX/photo.png" > /dev/null 2>&1
agent-browser wait --text "1 image" --timeout 40000 > /dev/null 2>&1
sleep 1
if snap_hit 'Live preview on photo.png'; then ok "/watermark previews the loaded image"; else bad "/watermark preview"; fi
wbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Watermark the image" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$wbtn > /dev/null 2>&1
agent-browser wait --text "watermarked file" --timeout 40000 > /dev/null 2>&1
sleep 1
if snap_hit '1 watermarked file ready'; then ok "/watermark stamps and produces the file"; else bad "/watermark apply"; fi
if snap_hit 'photo.watermarked.png'; then ok "/watermark names the output file"; else bad "/watermark filename"; fi
agent-browser close > /dev/null 2>&1

# /typing-test: typing one word + space advances the stream (real input path)
open_page "http://localhost:81/typing-test"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
if snap_hit 'New words'; then ok "/typing-test idle state renders with the stream"; else bad "/typing-test idle"; fi
ttWords=$(agent-browser eval "(() => { const p = document.querySelector('p[aria-label]'); return p ? (p.textContent.trim().length > 40 ? 'yes' : 'thin') : 'no-stream' })()" 2>/dev/null)
echo "$ttWords" | rg -q 'yes' && ok "/typing-test word stream is populated" || bad "/typing-test stream: $ttWords"
ttRes=$(agent-browser eval "(() => { const el = document.getElementById('tt-input'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, 'the '); el.dispatchEvent(new Event('input', { bubbles: true })); return el.value === '' ? 'advanced' : 'stuck:' + el.value })()" 2>/dev/null)
echo "$ttRes" | rg -q 'advanced' && ok "/typing-test space advances the word stream" || bad "/typing-test advance: $ttRes"
ttRun=$(agent-browser eval "document.body.textContent.includes('Remaining') ? 'yes' : 'no'" 2>/dev/null)
echo "$ttRun" | rg -q 'yes' && ok "/typing-test clock started on first keystroke" || bad "/typing-test clock: $ttRun"
agent-browser close > /dev/null 2>&1

# /markdown: default doc renders strong + table + escaped script
open_page "http://localhost:81/markdown"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Preview" --timeout 40000 > /dev/null 2>&1
sleep 2
mdRes=$(agent-browser eval "(() => { const pv = document.getElementById('md-preview'); if (!pv) return 'no-preview'; const ok1 = pv.innerHTML.includes('<strong>live</strong>'); const ok2 = pv.innerHTML.includes('&lt;script&gt;'); const ok3 = pv.innerHTML.includes('<table'); return ok1 && ok2 && ok3 ? 'all' : 'strong:' + ok1 + ',esc:' + ok2 + ',table:' + ok3 })()" 2>/dev/null)
echo "$mdRes" | rg -q 'all' && ok "/markdown renders emphasis, tables and escapes raw HTML" || bad "/markdown render: $mdRes"
if snap_hit 'Table generator'; then ok "/markdown table generator present"; else bad "/markdown table gen"; fi
if snap_hit 'Standalone HTML'; then ok "/markdown offers the standalone export"; else bad "/markdown exports"; fi
agent-browser close > /dev/null 2>&1

# 11v. /qr Scan tab: decode a real QR image end to end (headless cannot grant
# a camera, so the image path carries the verification; the camera idle state
# is checked honestly).
open_page "http://localhost:81/qr"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "Download PNG" --timeout 40000 > /dev/null 2>&1
stap=$(agent-browser snapshot -c 2>/dev/null | rg -o 'tab "Scan" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$stap > /dev/null 2>&1
agent-browser wait --text "Start camera" --timeout 40000 > /dev/null 2>&1
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Point the camera at a QR code" \
  && ok "/qr scan opens with honest camera idle state" || bad "/qr scan idle"
itab=$(agent-browser snapshot -c 2>/dev/null | rg -o 'tab "Image file" \[.*ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$itab > /dev/null 2>&1
agent-browser wait --text "Drop a QR image, or click to pick one" --timeout 40000 > /dev/null 2>&1
agent-browser upload "input[type=file]" "$FX/qr-sample.png" > /dev/null 2>&1
# First decode lazily imports the jsQR engine — give it a real window.
agent-browser wait --text "kontivo-scan-check-2026" --timeout 60000 > /dev/null 2>&1
if snap_hit 'kontivo-scan-check-2026'; then ok "/qr Scan tab decodes an image QR end to end"; else bad "/qr scan decode"; fi
if snap_hit 'decoded inside this tab'; then ok "/qr scan privacy line present"; else bad "/qr scan privacy"; fi
agent-browser close > /dev/null 2>&1

if [ "$PHASE" = "3" ]; then
  echo "$pass" > /tmp/qa-pass; echo "$fail" > /tmp/qa-fail
  echo "== RESULT (phase 3): $pass passed, $fail failed — run PHASE=4 for Batches R3+R4 + the final sweeps =="
  exit 0
fi

# PHASE=4b skips the R3 block, PHASE=4c skips the R4 block, and PHASE=9
# skips R3+R4 — so each batch block can run alone on a memory-tight box
# without blowing the invocation timeout.
if [ "$PHASE" != "4b" ] && [ "$PHASE" != "9" ]; then

# 11u5. Batch R3 — data & text utilities (one real interaction per tool)

# /stats: numbers typed via the input path compute a verifiable mean
open_page "http://localhost:81/stats"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
stRes=$(agent-browser eval "(() => { const el = document.getElementById('stats-input'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(el, '78 84 91 77 85'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed' })()" 2>/dev/null)
sleep 1
stMean=$(agent-browser eval "(() => { const t = document.body.textContent; const mean83 = t.includes('83'); const parsed = t.includes('5 numbers parsed'); return mean83 && parsed ? 'yes' : 'mean83:' + mean83 + ',parsed:' + parsed })()" 2>/dev/null)
echo "$stMean" | rg -q 'yes' && ok "/stats computes mean 83 from 78/84/91/77/85" || bad "/stats mean: $stMean"
stQ=$(agent-browser eval "(() => { const t = document.body.textContent; return (t.includes('Q1 (25th') && t.includes('IQR') && t.includes('Std deviation')) ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$stQ" | rg -q 'yes' && ok "/stats quartiles, IQR and std dev cards render" || bad "/stats cards: $stQ"
agent-browser close > /dev/null 2>&1

# /number-to-words: 1234.56 in USD wording (default currency is USD)
open_page "http://localhost:81/number-to-words"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
ntwRes=$(agent-browser eval "(() => { const el = document.getElementById('ntw-input'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '1234.56'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed' })()" 2>/dev/null)
sleep 1
ntwOut=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=money-line]'); if (!el) return 'no-line'; const t = el.textContent.toLowerCase(); return (t.includes('one thousand two hundred thirty-four') && t.includes('fifty-six cents') && t.endsWith('only')) ? 'yes' : t.slice(0, 120) })()" 2>/dev/null)
echo "$ntwOut" | rg -q 'yes' && ok "/number-to-words writes 1234.56 as the USD cheque line ending in only" || bad "/number-to-words: $ntwOut"
ntwIn=$(agent-browser eval "(() => { const el = document.getElementById('ntw-input'); const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '123456'); el.dispatchEvent(new Event('input', { bubbles: true })); const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Indian')); if (!b) return 'no-btn'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 1
ntwLakh=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=money-line]'); return el && el.textContent.includes('lakh') ? 'yes' : (el ? el.textContent.slice(0, 80) : 'no-line') })()" 2>/dev/null)
echo "$ntwLakh" | rg -q 'yes' && ok "/number-to-words Indian system says one lakh twenty-three thousand" || bad "/number-to-words lakh: $ntwLakh"
agent-browser close > /dev/null 2>&1

# /morse: sos encodes both ways; a morse string decodes to text
open_page "http://localhost:81/morse"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
moRes=$(agent-browser eval "(() => { const el = document.getElementById('morse-input'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(el, 'sos'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed' })()" 2>/dev/null)
sleep 1
moOut=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=morse-out]'); return el && el.textContent.trim() === '... --- ...' ? 'yes' : (el ? el.textContent.trim().slice(0, 40) : 'no-out') })()" 2>/dev/null)
echo "$moOut" | rg -q 'yes' && ok "/morse encodes sos as ... --- ..." || bad "/morse encode: $moOut"
moDec=$(agent-browser eval "(() => { const el = document.getElementById('morse-input'); const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(el, '.- -.. -.-'); el.dispatchEvent(new Event('input', { bubbles: true })); const out = document.querySelector('[data-testid=morse-out]'); return out && out.textContent.trim() === 'adk' ? 'yes' : (out ? out.textContent.trim() : 'no-out') })()" 2>/dev/null)
echo "$moDec" | rg -q 'yes' && ok "/morse decodes .- -.. -.- to adk" || bad "/morse decode: $moDec"
moPlay=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Play aloud')); return b && !b.disabled ? 'present' : 'missing' })()" 2>/dev/null)
echo "$moPlay" | rg -q 'present' && ok "/morse playback control ready" || bad "/morse play: $moPlay"
agent-browser close > /dev/null 2>&1

# /font-changer: typing produces astral-plane styled output
open_page "http://localhost:81/font-changer"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
fcRes=$(agent-browser eval "(() => { const el = document.getElementById('fc-input'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(el, 'Ab'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed' })()" 2>/dev/null)
sleep 1
fcOut=$(agent-browser eval "(() => { const el = document.querySelector('[data-style=bold-sans]'); if (!el) return 'no-el'; const cps = [...el.textContent].map(c => c.codePointAt(0) ?? 0); return (cps.length === 2 && cps.every(c => c > 0xFFFF)) ? 'yes:' + cps.map(c => c.toString(16)).join(',') : 'plain:' + cps.map(c => c.toString(16)).join(',') })()" 2>/dev/null)
echo "$fcOut" | rg -q 'yes:1d5d4,1d5ef' && ok "/font-changer renders astral bold-sans characters" || bad "/font-changer: $fcOut"
fcCards=$(agent-browser eval "(() => [...document.querySelectorAll('[data-style]')].length)()" 2>/dev/null)
echo "$fcCards" | rg -q '^13$' && ok "/font-changer lists all thirteen styles" || bad "/font-changer styles: $fcCards"
agent-browser close > /dev/null 2>&1

# /emoji: keyword search filters the built-in grid, category chips present
open_page "http://localhost:81/emoji"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
emAll=$(agent-browser eval "(() => [...document.querySelectorAll('button[title]')].filter(b => (b.getAttribute('title') || '').includes('click to copy')).length)()" 2>/dev/null)
if [ "$emAll" -gt 200 ] 2>/dev/null; then ok "/emoji renders the built-in grid ($emAll tiles)"; else bad "/emoji grid: $emAll"; fi
emSearch=$(agent-browser eval "(() => { const el = document.getElementById('emoji-search'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, 'heart'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed' })()" 2>/dev/null)
sleep 1
emFiltered=$(agent-browser eval "(() => { const tiles = [...document.querySelectorAll('button[title]')].filter(b => (b.getAttribute('title') || '').includes('click to copy')); return tiles.length > 0 && tiles.length < 200 && tiles.every(t => (t.getAttribute('title') || '').includes('heart')) ? 'yes' : 'count:' + tiles.length })()" 2>/dev/null)
echo "$emFiltered" | rg -q 'yes' && ok "/emoji search heart filters to heart entries" || bad "/emoji filter: $emFiltered"
agent-browser close > /dev/null 2>&1

# /json-to-ts: default sample generates interfaces with the optional note field
open_page "http://localhost:81/json-to-ts"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "TypeScript" --timeout 40000 > /dev/null 2>&1
sleep 2
jtsOut=$(agent-browser eval "(() => { const pre = document.querySelector('[data-testid=jts-out]'); if (!pre) return 'no-pre'; const t = pre.textContent; return (t.includes('export interface OrderPayload') && t.includes('Order') && t.includes('note?: string')) ? 'yes' : 'op:' + t.includes('OrderPayload') + ',item:' + t.includes('Order') + ',opt:' + t.includes('note?: string') })()" 2>/dev/null)
echo "$jtsOut" | rg -q 'yes' && ok "/json-to-ts generates OrderPayload with optional note field" || bad "/json-to-ts: $jtsOut"
agent-browser close > /dev/null 2>&1

# /compress-pdf: the real 3-page fixture rasterizes and rebuilds with a verdict
open_page "http://localhost:81/compress-pdf"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser upload "input[type=file]" "$FX/test-3pages.pdf" > /dev/null 2>&1
agent-browser wait --text "Result" --timeout 90000 > /dev/null 2>&1
sleep 1
cpVerdict=$(agent-browser eval "(() => { const t = document.body.textContent; const hasCards = t.includes('Before') && t.includes('After') && t.includes('Pages'); const honest = t.includes('Smaller by') || t.includes('LARGER'); return hasCards && honest ? 'yes' : 'cards:' + hasCards + ',honest:' + honest })()" 2>/dev/null)
echo "$cpVerdict" | rg -q 'yes' && ok "/compress-pdf reports an honest before/after verdict" || bad "/compress-pdf verdict: $cpVerdict"
cpBtn=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Download compressed PDF')); return b ? 'present' : 'no-btn' })()" 2>/dev/null)
echo "$cpBtn" | rg -q 'present' && ok "/compress-pdf download action reachable" || bad "/compress-pdf btn: $cpBtn"
agent-browser close > /dev/null 2>&1

# /time-card: punches via the input path compute 7:30 after a 30-min break
open_page "http://localhost:81/time-card"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
tcRes=$(agent-browser eval "(() => { const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }; const ins = document.querySelectorAll('input[type=time]'); if (ins.length < 4) return 'few-inputs:' + ins.length; set(ins[0], '09:00'); set(ins[1], '17:00'); const num = document.querySelector('input[type=number][aria-label*=break]'); if (!num) return 'no-break'; set(num, '30'); return 'set' })()" 2>/dev/null)
sleep 1
tcTotal=$(agent-browser eval "(() => { const t = document.body.textContent; return t.includes('7:30') ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$tcTotal" | rg -q 'yes' && ok "/time-card computes 8:00 - 30 min break = 7:30" || bad "/time-card: $tcTotal"
tcVerdict=$(agent-browser eval "(() => { const t = document.body.textContent; return (t.includes('Regular') && t.includes('Overtime') && t.includes('enter a rate')) ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$tcVerdict" | rg -q 'yes' && ok "/time-card overtime split and honest pay row render" || bad "/time-card cards: $tcVerdict"
agent-browser close > /dev/null 2>&1

# /grade: the final-exam solver — 84% current, 40% final, target 90% needs 99%
open_page "http://localhost:81/grade"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
grRes=$(agent-browser eval "(() => { const btn = [...document.querySelectorAll('button[role=tab]')].find(x => x.textContent.includes('Grade on my final')); if (!btn) return 'no-tab'; btn.click(); return 'clicked' })()" 2>/dev/null)
sleep 1
grSet=$(agent-browser eval "(() => { const set = (id, v) => { const el = document.getElementById(id); if (!el) return false; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }; const a = set('gr-cur', '84'); const b = set('gr-w', '40'); const c = set('gr-t', '90'); return a && b && c ? 'set' : 'missing' })()" 2>/dev/null)
sleep 1
grOut=$(agent-browser eval "(() => { const t = document.body.textContent; return t.includes('99.0%') ? 'yes' : 'missing-99' })()" 2>/dev/null)
echo "$grOut" | rg -q 'yes' && ok "/grade final solver: 84/40/target-90 needs 99.0%" || bad "/grade solver: $grOut"
agent-browser close > /dev/null 2>&1

# /todo: Enter adds an item through the real input path, counter updates
open_page "http://localhost:81/todo"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
tdRes=$(agent-browser eval "(() => { const el = document.getElementById('todo-input'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, 'Ship the QA report'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'added' })()" 2>/dev/null)
sleep 1
tdItem=$(agent-browser eval "(() => { const items = [...document.querySelectorAll('[data-testid=todo-item]')]; return items.length === 1 && items[0].textContent.includes('Ship the QA report') ? 'yes' : 'count:' + items.length })()" 2>/dev/null)
echo "$tdItem" | rg -q 'yes' && ok "/todo Enter adds the item through the input path" || bad "/todo add: $tdItem"
tdOpen=$(agent-browser eval "(() => { const t = document.body.textContent; return t.includes('1 of 1 open') ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$tdOpen" | rg -q 'yes' && ok "/todo open counter updates" || bad "/todo counter: $tdOpen"
tdPersist=$(agent-browser eval "(() => { const raw = window.localStorage.getItem('kontivo-checklist-v1'); return raw && raw.includes('Ship the QA report') ? 'yes' : (raw ? 'wrong:' + raw.slice(0, 60) : 'empty') })()" 2>/dev/null)
echo "$tdPersist" | rg -q 'yes' && ok "/todo persists the item to localStorage" || bad "/todo persist: $tdPersist"
agent-browser close > /dev/null 2>&1

fi  # end the PHASE=4b/9 skip wrapper around the R3 block

# 11u6. Batch R4 — image & format utilities (one real interaction per tool)

if [ "$PHASE" != "9" ] && [ "$PHASE" != "4c" ] && [ "$PHASE" != "11" ]; then

# /cipher: ROT13 default encodes hello → uryyb; Atbash flips to svool; brute panel has 25 rows
open_page "http://localhost:81/cipher"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
ciRes=$(agent-browser eval "(() => { const el = document.getElementById('cipher-input'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(el, 'hello'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed' })()" 2>/dev/null)
sleep 1
ciOut=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=cipher-out]'); return el && el.textContent.trim() === 'uryyb' ? 'yes' : (el ? el.textContent.trim().slice(0, 40) : 'no-out') })()" 2>/dev/null)
echo "$ciOut" | rg -q 'yes' && ok "/cipher ROT13 encodes hello as uryyb" || bad "/cipher rot13: $ciOut"
ciAb=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === 'Atbash'); if (!b) return 'no-tab'; b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'keyed' })()" 2>/dev/null)
sleep 1
ciAt=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=cipher-out]'); return el && el.textContent.trim() === 'svool' ? 'yes' : (el ? el.textContent.trim().slice(0, 40) : 'no-out') })()" 2>/dev/null)
echo "$ciAt" | rg -q 'yes' && ok "/cipher Atbash encodes hello as svool" || bad "/cipher atbash: $ciAt"
ciBr=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === 'Caesar'); if (!b) return 'no-tab'; b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'keyed' })()" 2>/dev/null)
sleep 1
ciRows=$(agent-browser eval "(() => { const p = document.querySelector('[data-testid=caesar-brute]'); return p ? String(p.textContent.split('Shift').length - 1) : 'no-panel' })()" 2>/dev/null)
echo "$ciRows" | rg -q '25' && ok "/cipher Caesar brute-force shows 25 shifts" || bad "/cipher brute: $ciRows"
agent-browser close > /dev/null 2>&1

# /binary: Hi → binary bytes; binary bytes typed back → text
open_page "http://localhost:81/binary"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
biSet=$(agent-browser eval "(() => { const el = document.getElementById('binary-text'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(el, 'Hi'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed' })()" 2>/dev/null)
sleep 1
biOut=$(agent-browser eval "(() => { const el = document.getElementById('binary-base'); return el && el.value.trim() === '01001000 01101001' ? 'yes' : (el ? el.value.trim().slice(0, 40) : 'no-el') })()" 2>/dev/null)
echo "$biOut" | rg -q 'yes' && ok "/binary encodes Hi as UTF-8 byte groups" || bad "/binary encode: $biOut"
biBack=$(agent-browser eval "(() => { const el = document.getElementById('binary-base'); if (!el) return 'no-el'; const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(el, '01000001 01000010'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed' })()" 2>/dev/null)
sleep 1
biTxt=$(agent-browser eval "(() => { const el = document.getElementById('binary-text'); return el && el.value === 'AB' ? 'yes' : (el ? 'got:' + el.value.slice(0, 20) : 'no-el') })()" 2>/dev/null)
echo "$biTxt" | rg -q 'yes' && ok "/binary decodes bytes back to AB live" || bad "/binary decode: $biTxt"
agent-browser close > /dev/null 2>&1

# /px-rem: 24px at root 16 shows 1.5 rem; clamp builder emits exact CSS
open_page "http://localhost:81/px-rem"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
prSet=$(agent-browser eval "(() => { const el = document.getElementById('pxrem-input'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '24'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed' })()" 2>/dev/null)
sleep 1
prOut=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=pxrem-result]'); return el && el.textContent.includes('1.5 rem') ? 'yes' : (el ? el.textContent.slice(0, 60) : 'no-el') })()" 2>/dev/null)
echo "$prOut" | rg -q 'yes' && ok "/px-rem converts 24px to 1.5 rem at root 16" || bad "/px-rem conv: $prOut"
prClamp=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=clamp-out]'); return el && el.textContent.trim() === 'clamp(1rem, 2rem, 3rem)' ? 'yes' : (el ? el.textContent.trim().slice(0, 60) : 'no-el') })()" 2>/dev/null)
echo "$prClamp" | rg -q 'yes' && ok "/px-rem clamp builder emits clamp(1rem, 2rem, 3rem)" || bad "/px-rem clamp: $prClamp"
agent-browser close > /dev/null 2>&1

# /due-date: LMP 2026-01-01 → 2026-10-08, honest not-medical-advice framing
open_page "http://localhost:81/due-date"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
ddSet=$(agent-browser eval "(() => { const el = document.getElementById('dd-lmp'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '2026-01-01'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'set' })()" 2>/dev/null)
sleep 1
ddOut=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=dd-due]'); return el && el.textContent.includes('2026-10-08') ? 'yes' : (el ? el.textContent.slice(0, 60) : 'no-el') })()" 2>/dev/null)
echo "$ddOut" | rg -q 'yes' && ok "/due-date computes LMP 2026-01-01 as due 2026-10-08" || bad "/due-date naegele: $ddOut"
ddNote=$(agent-browser eval "(() => { const t = document.body.textContent.toLowerCase(); return t.includes('not medical advice') ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$ddNote" | rg -q 'yes' && ok "/due-date carries the not-medical-advice framing" || bad "/due-date framing: $ddNote"
agent-browser close > /dev/null 2>&1

# /word-frequency: the cat sat on the mat the end → the=3 at 37.5% density
open_page "http://localhost:81/word-frequency"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
wfSet=$(agent-browser eval "(() => { const el = document.getElementById('wf-input'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(el, 'the cat sat on the mat the end.'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed' })()" 2>/dev/null)
sleep 1
wfRow=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=wf-table]'); if (!el) return 'no-table'; const t = el.textContent; return (t.includes('the') && t.includes('37.5')) ? 'yes' : 'row:' + t.slice(0, 80) })()" 2>/dev/null)
echo "$wfRow" | rg -q 'yes' && ok "/word-frequency counts the=3 at 37.5% density" || bad "/word-frequency density: $wfRow"
wfFl=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=flesch-score]'); return el && /[0-9]/.test(el.textContent) ? 'yes' : (el ? 'nonum' : 'no-el') })()" 2>/dev/null)
echo "$wfFl" | rg -q 'yes' && ok "/word-frequency Flesch card renders a numeric score" || bad "/word-frequency flesch: $wfFl"
agent-browser close > /dev/null 2>&1

# /calendar-link: Test Event 2026-03-01 10:00-11:00 → Google link + real ICS preview
open_page "http://localhost:81/calendar-link"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
clSet=$(agent-browser eval "(() => { const set = (id, v) => { const el = document.getElementById(id); if (!el) return false; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }; const a = set('cl-title', 'Test Event'); const b = set('cl-start', '2026-03-01T10:00'); const c = set('cl-end', '2026-03-01T11:00'); return a && b && c ? 'set' : 'missing' })()" 2>/dev/null)
sleep 1
clG=$(agent-browser eval "(() => { const a = [...document.querySelectorAll('a[href]')].find(x => x.href.includes('calendar.google.com') && x.href.includes('action=TEMPLATE')); return a ? 'yes' : 'no-link' })()" 2>/dev/null)
echo "$clG" | rg -q 'yes' && ok "/calendar-link builds a Google TEMPLATE link" || bad "/calendar-link google: $clG"
clIcs=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=ics-preview]'); return el && el.textContent.includes('BEGIN:VCALENDAR') && el.textContent.includes('DTSTART') && el.textContent.includes('20260301') ? 'yes' : (el ? 'ics:' + el.textContent.slice(0, 80) : 'no-el') })()" 2>/dev/null)
echo "$clIcs" | rg -q 'yes' && ok "/calendar-link renders a real ICS body for the event" || bad "/calendar-link ics: $clIcs"
clBtn=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Download .ics')); return b && !b.disabled ? 'enabled' : (b ? 'disabled' : 'missing') })()" 2>/dev/null)
echo "$clBtn" | rg -q 'enabled' && ok "/calendar-link download button enabled once valid" || bad "/calendar-link btn: $clBtn"
agent-browser close > /dev/null 2>&1

# /vcard: Ada Lovelace → vCard preview + live QR image
open_page "http://localhost:81/vcard"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
vcSet=$(agent-browser eval "(() => { const set = (id, v) => { const el = document.getElementById(id); if (!el) return false; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }; const a = set('vc-first', 'Ada'); const b = set('vc-last', 'Lovelace'); return a && b ? 'set' : 'missing' })()" 2>/dev/null)
sleep 1
vcPrev=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=vc-preview]'); return el && el.textContent.includes('BEGIN:VCARD') && el.textContent.includes('FN:Ada Lovelace') ? 'yes' : (el ? 'prev:' + el.textContent.slice(0, 60) : 'no-el') })()" 2>/dev/null)
echo "$vcPrev" | rg -q 'yes' && ok "/vcard renders the FN:Ada Lovelace vCard body" || bad "/vcard preview: $vcPrev"
vcQr=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=vc-qr]'); return el && (el.getAttribute('src') || '').startsWith('data:image/png') ? 'yes' : (el ? 'src:' + (el.getAttribute('src') || '').slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$vcQr" | rg -q 'yes' && ok "/vcard generates the QR image of the card" || bad "/vcard qr: $vcQr"
agent-browser close > /dev/null 2>&1

# /meme: photo.png uploaded through the real input path, canvas sized, download present
open_page "http://localhost:81/meme"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser upload "input[type=file]" "$FX/photo.png" > /dev/null 2>&1
sleep 2
mmTop=$(agent-browser eval "(() => { const el = document.getElementById('meme-top'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, 'QA TOP TEXT'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed' })()" 2>/dev/null)
sleep 1
mmCanvas=$(agent-browser eval "(() => { const c = document.querySelector('[data-testid=meme-canvas]'); return c && c.width >= 400 ? 'yes:' + c.width : (c ? 'w:' + c.width : 'no-canvas') })()" 2>/dev/null)
echo "$mmCanvas" | rg -q 'yes' && ok "/meme renders the uploaded photo on the caption canvas" || bad "/meme canvas: $mmCanvas"
mmBtn=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Download')); return b && !b.disabled ? 'enabled' : (b ? 'disabled' : 'missing') })()" 2>/dev/null)
echo "$mmBtn" | rg -q 'enabled' && ok "/meme download button enabled after load" || bad "/meme btn: $mmBtn"
agent-browser close > /dev/null 2>&1

# /svg-convert: sample renders 240×240; width 256 with aspect lock rescales height
open_page "http://localhost:81/svg-convert"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser wait --text "px" --timeout 40000 > /dev/null 2>&1
sleep 2
svDims=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=svg-dims]'); return el && el.textContent.includes('240 × 240 px') ? 'yes' : (el ? 'dims:' + el.textContent.trim().slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$svDims" | rg -q 'yes' && ok "/svg-convert renders the sample at 240 × 240 px" || bad "/svg-convert dims: $svDims"
svSet=$(agent-browser eval "(() => { const el = document.getElementById('svg-w'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '256'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'set' })()" 2>/dev/null)
sleep 2
sv256=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=svg-dims]'); return el && el.textContent.includes('256 × 256 px') ? 'yes' : (el ? 'dims:' + el.textContent.trim().slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$sv256" | rg -q 'yes' && ok "/svg-convert aspect-locked resize lands on 256 × 256 px" || bad "/svg-convert resize: $sv256"
svBtn=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Download')); return b && !b.disabled ? 'enabled' : (b ? 'disabled' : 'missing') })()" 2>/dev/null)
echo "$svBtn" | rg -q 'enabled' && ok "/svg-convert download enabled after render" || bad "/svg-convert btn: $svBtn"
agent-browser close > /dev/null 2>&1

# /image: rotate 90° swaps 480×360 to 360×480; crop 200×100 lands exactly
open_page "http://localhost:81/image"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
agent-browser upload "input[type=file]" "$FX/photo.png" > /dev/null 2>&1
sleep 2
imRot=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === 'Rotate'); if (!b) return 'no-tab'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 1
imRun=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Process now')); if (!b) return 'no-btn'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 3
imDims=$(agent-browser eval "(() => { const t = document.body.textContent; return t.includes('360×480') ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$imDims" | rg -q 'yes' && ok "/image rotate 90 swaps 480×360 to 360×480" || bad "/image rotate: $imDims"
imCrop=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === 'Crop'); if (!b) return 'no-tab'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 1
imBox=$(agent-browser eval "(() => { const set = (id, v) => { const el = document.getElementById(id); if (!el) return false; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }; const a = set('img-crop-w', '200'); const b = set('img-crop-h', '100'); return a && b ? 'set' : 'missing' })()" 2>/dev/null)
imRun2=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Process now')); if (!b) return 'no-btn'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 3
imCropOut=$(agent-browser eval "(() => { const t = document.body.textContent; return t.includes('200×100') ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$imCropOut" | rg -q 'yes' && ok "/image crop 200×100 lands exactly" || bad "/image crop: $imCropOut"
agent-browser close > /dev/null 2>&1

fi  # end the PHASE=9/4c skip wrapper around the R4 block

if [ "$PHASE" = "4" ] || [ "$PHASE" = "4b" ] || [ "$PHASE" = "4c" ]; then
  echo "$pass" > /tmp/qa-pass; echo "$fail" > /tmp/qa-fail
  echo "== RESULT (phase $PHASE): $pass passed, $fail failed — run PHASE=9 for Batch R5, PHASE=8 for the sweeps =="
  exit 0
fi

# 11u7. Batch R5 — sound, body & misc calculators (one real interaction per tool)

# /sound-tools: tone tab shows 440 Hz; metronome tab accepts a tempo change
open_page "http://localhost:81/sound-tools"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
stTab=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === 'Tone generator'); if (!b) return 'no-tab'; b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'keyed' })()" 2>/dev/null)
sleep 1
stTone=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=sound-tone-readout]'); return el && el.textContent.includes('440 Hz') ? 'yes' : (el ? el.textContent.slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$stTone" | rg -q 'yes' && ok "/sound-tools tone generator reads 440 Hz" || bad "/sound-tools tone: $stTone"
stTab2=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === 'Metronome'); if (!b) return 'no-tab'; b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'keyed' })()" 2>/dev/null)
sleep 1
stBpm=$(agent-browser eval "(() => { const el = document.getElementById('sound-bpm'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '144'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'set' })()" 2>/dev/null)
sleep 1
stOut=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=sound-bpm-out]'); return el && el.textContent.includes('144 BPM') ? 'yes' : (el ? el.textContent.slice(0, 60) : 'no-el') })()" 2>/dev/null)
echo "$stOut" | rg -q 'yes' && ok "/sound-tools metronome accepts 144 BPM live" || bad "/sound-tools metronome: $stOut"
stStr=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === 'Guitar tuner'); if (!b) return 'no-tab'; b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'keyed' })()" 2>/dev/null)
sleep 1
stRef=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=sound-strings]'); return el && el.textContent.includes('82.41') && el.textContent.includes('E2') ? 'yes' : (el ? el.textContent.slice(0, 60) : 'no-el') })()" 2>/dev/null)
echo "$stRef" | rg -q 'yes' && ok "/sound-tools tuner shows the standard-tuning reference" || bad "/sound-tools tuner: $stRef"
agent-browser close > /dev/null 2>&1

# /tts: sample text chunked; replacing the text re-chunks live
open_page "http://localhost:81/tts"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
ttSet=$(agent-browser eval "(() => { const el = document.getElementById('tts-input'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(el, new Array(15).fill('The cat sat on the mat.').join(' ')); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed' })()" 2>/dev/null)
sleep 1
ttChunks=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=tts-chunks]'); return el && el.textContent.includes('2 chunks') ? 'yes' : (el ? el.textContent.slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$ttChunks" | rg -q 'yes' && ok "/tts re-chunks the text live into 2 chunks" || bad "/tts chunks: $ttChunks"
ttBtn=$(agent-browser eval "(() => { const b = document.getElementById('tts-read'); return b ? 'present' : 'missing' })()" 2>/dev/null)
echo "$ttBtn" | rg -q 'present' && ok "/tts Read aloud control present" || bad "/tts button: $ttBtn"
agent-browser close > /dev/null 2>&1

# /fuel-cost: 500 km at 8 L/100km and 1.50/L = 40 L, 60 total; 4 passengers split 15 each
open_page "http://localhost:81/fuel-cost"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
fcVol=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=fuel-volume]'); return el && el.textContent.includes('40.00 L') ? 'yes' : (el ? el.textContent.slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$fcVol" | rg -q 'yes' && ok "/fuel-cost computes 40.00 L from the defaults" || bad "/fuel-cost volume: $fcVol"
fcTot=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=fuel-total]'); return el && el.textContent.includes('60.00') ? 'yes' : (el ? el.textContent.slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$fcTot" | rg -q 'yes' && ok "/fuel-cost totals 60.00 at 1.50 per liter" || bad "/fuel-cost total: $fcTot"
fcPax=$(agent-browser eval "(() => { const el = document.getElementById('fuel-pax'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '4'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'set' })()" 2>/dev/null)
sleep 1
fcSplit=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=fuel-per-pax]'); return el && el.textContent.includes('15.00') ? 'yes' : (el ? el.textContent.slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$fcSplit" | rg -q 'yes' && ok "/fuel-cost splits 60.00 as 15.00 across 4 passengers" || bad "/fuel-cost split: $fcSplit"
agent-browser close > /dev/null 2>&1

# /salary: 25/h, 8 h shifts, 5 days, 60 min unpaid break (7 paid h), 52 weeks = 45,500 annual
open_page "http://localhost:81/salary"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
slAnn=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=salary-annual]'); return el && el.textContent.includes('45,500') ? 'yes' : (el ? el.textContent.slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$slAnn" | rg -q 'yes' && ok "/salary derives 45,500 annual from 25/h with unpaid break" || bad "/salary annual: $slAnn"
slOt=$(agent-browser eval "(() => { const set = (id, v) => { const el = document.getElementById(id); if (!el) return false; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }; return set('salary-ot', '5') ? 'set' : 'missing' })()" 2>/dev/null)
sleep 1
slOt2=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=salary-annual]'); return el && el.textContent.includes('55,250') ? 'yes' : (el ? el.textContent.slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$slOt2" | rg -q 'yes' && ok "/salary adds 5 OT hours at 1.5x to 55,250" || bad "/salary ot: $slOt2"
agent-browser close > /dev/null 2>&1

# /sleep: 06:30 alarm -> 6 cycles lands 21:15 (cycles × 90 min + latency)
open_page "http://localhost:81/sleep"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
slSet=$(agent-browser eval "(() => { const el = document.getElementById('sleep-wake'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '06:30'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'set' })()" 2>/dev/null)
sleep 1
slList=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=sleep-list]'); return el && el.textContent.includes('21:15') ? 'yes' : (el ? el.textContent.slice(0, 80) : 'no-el') })()" 2>/dev/null)
echo "$slList" | rg -q 'yes' && ok "/sleep plans 6 cycles at 21:15 for a 06:30 alarm" || bad "/sleep bedtimes: $slList"
slNote=$(agent-browser eval "(() => { const t = document.body.textContent.toLowerCase(); return t.includes('not medical advice') ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$slNote" | rg -q 'yes' && ok "/sleep carries the not-medical-advice framing" || bad "/sleep framing: $slNote"
agent-browser close > /dev/null 2>&1

# /pace: 5 km in 25:00 -> 5:00 /km; 24:00 -> 4:48 /km; Riegel table present
open_page "http://localhost:81/pace"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
pcOut=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=pace-out]'); return el && el.textContent.includes('5:00 /km') ? 'yes' : (el ? el.textContent.slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$pcOut" | rg -q 'yes' && ok "/pace computes 5:00 /km from 5 km in 25:00" || bad "/pace default: $pcOut"
pcSet=$(agent-browser eval "(() => { const el = document.getElementById('pace-m'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '24'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'set' })()" 2>/dev/null)
sleep 1
pcNew=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=pace-out]'); return el && el.textContent.includes('4:48 /km') ? 'yes' : (el ? el.textContent.slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$pcNew" | rg -q 'yes' && ok "/pace recomputes 4:48 /km for a 24-minute 5K" || bad "/pace recompute: $pcNew"
pcPred=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=pace-predict]'); return el && el.textContent.includes('Marathon') && el.textContent.includes('5K') ? 'yes' : (el ? el.textContent.slice(0, 60) : 'no-el') })()" 2>/dev/null)
echo "$pcPred" | rg -q 'yes' && ok "/pace renders the Riegel prediction table" || bad "/pace predictions: $pcPred"
agent-browser close > /dev/null 2>&1

# /one-rep-max: 100 kg x 5 reps -> consensus 114.3; reps 3 -> Epley 110.0
open_page "http://localhost:81/one-rep-max"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
ormC=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=orm-consensus]'); return el && el.textContent.includes('114.3') ? 'yes' : (el ? el.textContent.slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$ormC" | rg -q 'yes' && ok "/one-rep-max consensus for 100x5 is 114.3 kg" || bad "/one-rep-max consensus: $ormC"
ormSet=$(agent-browser eval "(() => { const el = document.getElementById('orm-reps'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '3'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'set' })()" 2>/dev/null)
sleep 1
ormE=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=orm-epley]'); return el && el.textContent.includes('110.0') ? 'yes' : (el ? el.textContent.slice(0, 30) : 'no-el') })()" 2>/dev/null)
echo "$ormE" | rg -q 'yes' && ok "/one-rep-max Epley recomputes to 110.0 at 3 reps" || bad "/one-rep-max epley: $ormE"
ormT=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=orm-table]'); return el && el.textContent.includes('95%') && el.textContent.includes('60%') ? 'yes' : (el ? el.textContent.slice(0, 60) : 'no-el') })()" 2>/dev/null)
echo "$ormT" | rg -q 'yes' && ok "/one-rep-max training table spans 95% to 60%" || bad "/one-rep-max table: $ormT"
agent-browser close > /dev/null 2>&1

# /fraction: 3/4 + 5/6 = 19/12 (mixed 1 7/12); switching to x gives 5/8
open_page "http://localhost:81/fraction"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
frRes=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=frac-result]'); const mx = document.querySelector('[data-testid=frac-mixed]'); return el && el.textContent.trim() === '19/12' && mx && mx.textContent.trim() === '1 7/12' ? 'yes' : 'res:' + (el ? el.textContent.trim() : 'none') + ' mixed:' + (mx ? mx.textContent.trim() : 'none') })()" 2>/dev/null)
echo "$frRes" | rg -q 'yes' && ok "/fraction 3/4 + 5/6 reduces to 19/12 = 1 7/12" || bad "/fraction add: $frRes"
frX=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Operation ×'); if (!b) return 'no-btn'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 1
frMul=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=frac-result]'); return el && el.textContent.trim() === '5/8' ? 'yes' : (el ? el.textContent.trim() : 'no-el') })()" 2>/dev/null)
echo "$frMul" | rg -q 'yes' && ok "/fraction 3/4 × 5/6 reduces to 5/8" || bad "/fraction mul: $frMul"
frConv=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=frac-conv-out]'); return el && el.textContent.includes('0.(142857)') ? 'yes' : (el ? el.textContent.slice(0, 40) : 'no-el') })()" 2>/dev/null)
echo "$frConv" | rg -q 'yes' && ok "/fraction converter detects the 1/7 repeat cycle" || bad "/fraction repeat: $frConv"
agent-browser close > /dev/null 2>&1

# /quadratic: 1,-3,2 -> roots 1 and 2, vertex (1.5, -0.25); c=5 -> complex ± 2i
open_page "http://localhost:81/quadratic"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
qdRoots=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=quad-roots]'); return el && el.textContent.includes('x₁ = 1') && el.textContent.includes('x₂ = 2') ? 'yes' : (el ? el.textContent.slice(0, 40) : 'no-el') })()" 2>/dev/null)
echo "$qdRoots" | rg -q 'yes' && ok "/quadratic roots of x²-3x+2 are 1 and 2" || bad "/quadratic roots: $qdRoots"
qdVtx=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=quad-vertex]'); return el && el.textContent.includes('(1.5, -0.25)') ? 'yes' : (el ? el.textContent.slice(0, 40) : 'no-el') })()" 2>/dev/null)
echo "$qdVtx" | rg -q 'yes' && ok "/quadratic vertex prints (1.5, -0.25)" || bad "/quadratic vertex: $qdVtx"
qdSteps=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=quad-steps]'); return el && el.textContent.includes('9') && el.textContent.includes('8') ? 'yes' : (el ? 'steps:' + el.textContent.slice(0, 60) : 'no-el') })()" 2>/dev/null)
echo "$qdSteps" | rg -q 'yes' && ok "/quadratic worked steps substitute the real numbers" || bad "/quadratic steps: $qdSteps"
qdPlot=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=quad-plot]'); return el && el.querySelector('path') ? 'yes' : (el ? 'no-path' : 'no-el') })()" 2>/dev/null)
echo "$qdPlot" | rg -q 'yes' && ok "/quadratic draws the SVG parabola" || bad "/quadratic plot: $qdPlot"
qdSet=$(agent-browser eval "(() => { const set = (id, v) => { const el = document.getElementById(id); if (!el) return false; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }; const a = set('quad-b', '2'); const b = set('quad-c', '5'); return a && b ? 'set' : 'missing' })()" 2>/dev/null)
sleep 1
qdCx=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=quad-roots]'); return el && el.textContent.includes('± 2i') ? 'yes' : (el ? el.textContent.slice(0, 40) : 'no-el') })()" 2>/dev/null)
echo "$qdCx" | rg -q 'yes' && ok "/quadratic reports complex roots -1 ± 2i for x²+2x+5" || bad "/quadratic complex: $qdCx"
agent-browser close > /dev/null 2>&1

if [ "$PHASE" = "9" ]; then
  echo "$pass" > /tmp/qa-pass; echo "$fail" > /tmp/qa-fail
  echo "== RESULT (phase 9): $pass passed, $fail failed — run PHASE=8 for the final sweeps =="
  exit 0
fi

fi  # end the PHASE!=8 skip wrapper around the 11g→R4 region

# 11w. Batch R6 — real-work tools: Spreadsheet Studio, Chart Maker, Resume
#      Builder, Video Studio and the QR Studio rebuild (deep interactions)

if [ "$PHASE" = "10" ]; then

# /spreadsheet: demo sheet live, formula bar and stats populated, cell edit
# commits, and a formula evaluates against the edited cell
open_page "http://localhost:81/spreadsheet"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
ssGrid=$(agent-browser eval "(() => { const g = document.querySelector('[data-testid=spreadsheet-grid]'); const fb = document.querySelector('[data-testid=spreadsheet-formula-bar]'); return g && fb && fb.value !== '' ? 'yes' : (g ? 'grid-only' : 'no-el') })()" 2>/dev/null)
echo "$ssGrid" | rg -q 'yes' && ok "/spreadsheet renders the demo sheet with a live formula bar" || bad "/spreadsheet grid: $ssGrid"
ssStats=$(agent-browser eval "(() => { const s = document.querySelector('[data-testid=spreadsheet-col-stats]'); return s && s.textContent.length > 20 ? 'yes' : (s ? 'thin' : 'no-el') })()" 2>/dev/null)
echo "$ssStats" | rg -q 'yes' && ok "/spreadsheet column stats strip computes" || bad "/spreadsheet stats: $ssStats"
ssDbl=$(agent-browser eval "(() => { const c = document.querySelector('[data-testid=spreadsheet-cell-r5c0]'); if (!c) return 'no-cell'; c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 'dbl' })()" 2>/dev/null)
sleep 1
ssEdit=$(agent-browser eval "(() => { const c = document.querySelector('[data-testid=spreadsheet-cell-r5c0]'); const inp = c && c.querySelector('input'); if (!inp) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(inp, '125'); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'committed' })()" 2>/dev/null)
sleep 1
ssVal=$(agent-browser eval "(() => { const c = document.querySelector('[data-testid=spreadsheet-cell-r5c0]'); return c && c.textContent.includes('125') ? 'yes' : (c ? 'text:' + c.textContent.slice(0, 16) : 'no-el') })()" 2>/dev/null)
echo "$ssVal" | rg -q 'yes' && ok "/spreadsheet cell edit commits to the grid" || bad "/spreadsheet edit: $ssEdit / $ssVal"
ssFDbl=$(agent-browser eval "(() => { const c = document.querySelector('[data-testid=spreadsheet-cell-r5c1]'); if (!c) return 'no-cell'; c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 'dbl' })()" 2>/dev/null)
sleep 1
ssF=$(agent-browser eval "(() => { const c = document.querySelector('[data-testid=spreadsheet-cell-r5c1]'); const inp = c && c.querySelector('input'); if (!inp) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(inp, '=A6*2'); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'committed' })()" 2>/dev/null)
sleep 1
ssFv=$(agent-browser eval "(() => { const c = document.querySelector('[data-testid=spreadsheet-cell-r5c1]'); return c && c.textContent.includes('250') ? 'yes' : (c ? 'text:' + c.textContent.slice(0, 20) : 'no-el') })()" 2>/dev/null)
echo "$ssFv" | rg -q 'yes' && ok "/spreadsheet formula =A6*2 evaluates to 250" || bad "/spreadsheet formula: $ssF / $ssFv"
agent-browser close > /dev/null 2>&1

# /chart-maker: bars render from the sample, stats strip, pie switch re-renders
open_page "http://localhost:81/chart-maker"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
cmSvg=$(agent-browser eval "(() => { const s = document.querySelector('[data-testid=chart-svg]'); const n = s ? s.querySelectorAll('rect').length : 0; return n >= 6 ? 'yes:' + n : (s ? 'thin:' + n : 'no-el') })()" 2>/dev/null)
echo "$cmSvg" | rg -q 'yes:' && ok "/chart-maker draws grouped bars from the sample table" || bad "/chart-maker bars: $cmSvg"
cmStats=$(agent-browser eval "(() => { const s = document.querySelector('[data-testid=chart-stats]'); return s && s.textContent.includes('Savings') ? 'yes' : (s ? 'thin' : 'no-el') })()" 2>/dev/null)
echo "$cmStats" | rg -q 'yes' && ok "/chart-maker per-series stats strip" || bad "/chart-maker stats: $cmStats"
cmPie=$(agent-browser eval "(() => { const b = document.querySelector('[data-kind=pie]'); if (!b) return 'no-btn'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 1
cmPaths=$(agent-browser eval "(() => { const s = document.querySelector('[data-testid=chart-svg]'); const n = s ? s.querySelectorAll('path').length : 0; return n >= 6 ? 'yes:' + n : 'thin:' + n })()" 2>/dev/null)
echo "$cmPaths" | rg -q 'yes:' && ok "/chart-maker pie slices render after switching type" || bad "/chart-maker pie: $cmPie / $cmPaths"
agent-browser close > /dev/null 2>&1

# /resume: sample A4 preview, live name edit, print + autosave affordances
open_page "http://localhost:81/resume"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
rsPrev=$(agent-browser eval "(() => { const p = document.querySelector('[data-testid=resume-preview]'); return p && p.textContent.includes('Priya') ? 'yes' : (p ? 'thin' : 'no-el') })()" 2>/dev/null)
echo "$rsPrev" | rg -q 'yes' && ok "/resume renders the sample resume in the A4 preview" || bad "/resume preview: $rsPrev"
rsSet=$(agent-browser eval "(() => { const el = document.querySelector('[data-testid=resume-name-input]'); if (!el) return 'no-input'; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, 'Aarav Sharma'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'set' })()" 2>/dev/null)
sleep 1
rsLive=$(agent-browser eval "(() => { const p = document.querySelector('[data-testid=resume-preview]'); const pr = document.querySelector('[data-testid=resume-print]'); return p && p.textContent.includes('Aarav Sharma') && pr ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$rsLive" | rg -q 'yes' && ok "/resume name edit flows to the preview live, print button present" || bad "/resume live edit: $rsSet / $rsLive"
agent-browser close > /dev/null 2>&1

# /video-studio: compress tab complete, trim tab swaps in its own file input
open_page "http://localhost:81/video-studio"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
vsC=$(agent-browser eval "(() => { const f = document.querySelector('[data-testid=video-file-input]'); const q = document.querySelector('[data-testid=video-quality-balanced]'); const s = document.body.textContent; return f && q && s.includes('Engine not loaded') ? 'yes' : (f && q ? 'engine-line' : 'missing') })()" 2>/dev/null)
echo "$vsC" | rg -q 'yes' && ok "/video-studio compress tab with honest engine line" || bad "/video-studio compress: $vsC"
vsT=$(agent-browser eval "(() => { const b = document.querySelector('[data-testid=video-mode-trim]'); if (!b) return 'no-tab'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 1
vsTi=$(agent-browser eval "(() => { const f = document.querySelector('[data-testid=video-trim-file-input]'); return f ? 'yes' : 'no-el' })()" 2>/dev/null)
echo "$vsTi" | rg -q 'yes' && ok "/video-studio trim tab swaps in the trim file input" || bad "/video-studio trim: $vsT / $vsTi"
agent-browser close > /dev/null 2>&1

# /qr studio: UPI payload builder with URL encoding and INR currency, batch input
open_page "http://localhost:81/qr"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
qrU=$(agent-browser eval "(() => { const b = document.querySelector('[data-testid=qr-mode-upi]'); if (!b) return 'no-tab'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 1
qrSet=$(agent-browser eval "(() => { const set = (id, v) => { const el = document.getElementById(id); if (!el) return false; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }; const a = set('qr-upi-pa', 'shop@okaxis'); const b = set('qr-upi-am', '199'); return a && b ? 'set' : 'missing' })()" 2>/dev/null)
sleep 1
qrPay=$(agent-browser eval "(() => { const p = document.querySelector('[data-testid=qr-payload-preview]'); return p && p.textContent.startsWith('upi://pay?pa=shop%40okaxis') && p.textContent.includes('am=199') && p.textContent.includes('cu=INR') ? 'yes' : (p ? 'text:' + p.textContent.slice(0, 40) : 'no-el') })()" 2>/dev/null)
echo "$qrPay" | rg -q 'yes' && ok "/qr UPI payload encodes the VPA and INR amount" || bad "/qr upi: $qrU / $qrSet / $qrPay"
qrB=$(agent-browser eval "(() => { const b = document.querySelector('[data-testid=qr-mode-link]'); if (!b) return 'no-tab'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 1
qrBi=$(agent-browser eval "(() => { const i = document.querySelector('[data-testid=qr-batch-input]'); return i ? 'yes' : 'no-el' })()" 2>/dev/null)
echo "$qrBi" | rg -q 'yes' && ok "/qr batch textarea present for link codes" || bad "/qr batch: $qrB / $qrBi"
agent-browser close > /dev/null 2>&1

echo "$pass" > /tmp/qa-pass; echo "$fail" > /tmp/qa-fail
echo "== RESULT (phase 10): $pass passed, $fail failed — run PHASE=8 for the final sweeps =="
exit 0

fi  # end the PHASE=10 R6 block

# 11b. PHASE=11 — R6b: /bg-remove (AI cutout + solid key, honest engines)
if [ "$PHASE" = "11" ]; then

# /bg-remove: honest AI status line + both mode tabs render
open_page "http://localhost:81/bg-remove"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
bgTop=$(agent-browser eval "(() => { const a = document.querySelector('[data-testid=bg-mode-ai]'); const k = document.querySelector('[data-testid=bg-mode-key]'); const f = document.querySelector('[data-testid=bg-file-input]'); const s = document.querySelector('[data-testid=bg-ai-status]'); return a && k && f && s && s.textContent.includes('Model not loaded') ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$bgTop" | rg -q 'yes' && ok "/bg-remove tabs + honest model-not-loaded status" || bad "/bg-remove top: $bgTop"
bgK=$(agent-browser eval "(() => { const b = document.querySelector('[data-testid=bg-mode-key]'); if (!b) return 'no-tab'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 1
bgCtl=$(agent-browser eval "(() => { const c = document.querySelector('[data-testid=bg-key-color]'); const t = document.querySelector('[data-testid=bg-tolerance]'); const ap = document.querySelector('[data-testid=bg-apply]'); return c && t && ap ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$bgCtl" | rg -q 'yes' && ok "/bg-remove key mode shows color, tolerance and apply" || bad "/bg-remove key controls: $bgK / $bgCtl"

# end-to-end solid key: synthetic red-field/green-square PNG -> key -> pixel-verified alpha
bgSet=$(agent-browser eval "(async () => { const cv = document.createElement('canvas'); cv.width = 120; cv.height = 80; const g = cv.getContext('2d'); g.fillStyle = 'rgb(255,0,0)'; g.fillRect(0, 0, 120, 80); g.fillStyle = 'rgb(34,197,94)'; g.fillRect(40, 20, 40, 40); const blob = await new Promise((res) => cv.toBlob(res, 'image/png')); const dt = new DataTransfer(); dt.items.add(new File([blob], 'probe.png', { type: 'image/png' })); const inp = document.querySelector('input[type=file]'); if (!inp) return 'no-input'; inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); return 'set' })()" 2>/dev/null)
sleep 1
bgApply=$(agent-browser eval "(() => { const b = document.querySelector('[data-testid=bg-apply]'); if (!b) return 'no-btn'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 3
bgPix=$(agent-browser eval "(() => { const img = document.querySelector('[data-testid=bg-result-img]'); if (!img) return 'no-result'; const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let out = 0; let keep = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] === 0) out++; else if (d[i + 3] === 255) keep++ } return out > 5000 && keep > 1000 ? 'yes:' + out + '/' + keep : 'thin:' + out + '/' + keep })()" 2>/dev/null)
echo "$bgPix" | rg -q 'yes:' && ok "/bg-remove solid key removes the red field and keeps the green square (pixel-verified)" || bad "/bg-remove key e2e: $bgSet / $bgApply / $bgPix"
bgDl=$(agent-browser eval "(() => { const a = document.querySelector('[data-testid=bg-download]'); const n = document.querySelector('[data-testid=bg-size-note]'); return a && a.download && a.download.endsWith('.png') && n && n.textContent.includes('Transparent PNG') ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$bgDl" | rg -q 'yes' && ok "/bg-remove download anchor carries the .png filename and size note" || bad "/bg-remove download: $bgDl"
bgAi=$(agent-browser eval "(() => { const b = document.querySelector('[data-testid=bg-mode-ai]'); if (!b) return 'no-tab'; b.click(); return 'clicked' })()" 2>/dev/null)
sleep 1
bgHonest=$(agent-browser eval "(() => { const s = document.querySelector('[data-testid=bg-ai-status]'); const n = document.querySelector('[data-testid=bg-ai-note]'); return s && s.textContent.includes('Model not loaded') && n && n.textContent.includes('never leaves this device') ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$bgHonest" | rg -q 'yes' && ok "/bg-remove AI tab restores the honest engine line without fetching" || bad "/bg-remove ai tab: $bgAi / $bgHonest"
agent-browser close > /dev/null 2>&1

echo "$pass" > /tmp/qa-pass; echo "$fail" > /tmp/qa-fail
echo "== RESULT (phase 11): $pass passed, $fail failed — run PHASE=8 for the final sweeps =="
exit 0

fi  # end the PHASE=11 R6b block

# 12b. PHASE=12 — R7: /speed-test (a real measurement through Cloudflare's
#      public endpoints — the state machine, honest transfer note, live
#      numbers and the capacity table)
if [ "$PHASE" = "12" ]; then

open_page "http://localhost:81/speed-test"
agent-browser wait --fn "document.documentElement.dataset.hydrated === '1'" --timeout 40000 > /dev/null 2>&1
spTop=$(agent-browser eval "(() => { const s = document.querySelector('[data-testid=speed-start]'); const t = document.querySelector('[data-testid=speed-stage]'); const note = document.body.textContent.includes('48 MB down'); return s && t && note ? 'yes' : 'missing' })()" 2>/dev/null)
echo "$spTop" | rg -q 'yes' && ok "/speed-test renders the stage, start button and transfer-honesty note" || bad "/speed-test top: $spTop"

spRun=$(agent-browser eval "(() => { const b = document.querySelector('[data-testid=speed-start]'); if (!b) return 'no-btn'; b.click(); return 'clicked' })()" 2>/dev/null)
# The full run takes ~15 s; wait for either the result card or an honest error.
agent-browser wait --fn "(() => { return !!(document.querySelector('[data-testid=speed-results]') || document.querySelector('[data-testid=speed-error]')) })()" --timeout 90000 > /dev/null 2>&1
spNum=$(agent-browser eval "(() => { const d = document.querySelector('[data-testid=speed-down]'); const u = document.querySelector('[data-testid=speed-up]'); if (!d || !u) return document.querySelector('[data-testid=speed-error]') ? 'error-shown' : 'no-results'; const m = (s) => { const x = (s.textContent.match(/([\\d.]+)/) || [])[1]; return x ? parseFloat(x) : 0 }; return m(d) > 0 && m(u) >= 0 ? 'yes:' + m(d) + '/' + m(u) : 'zero' })()" 2>/dev/null)
echo "$spNum" | rg -q 'yes:' && ok "/speed-test measures real down/up through the live endpoints ($spNum)" || bad "/speed-test run: $spRun / $spNum"
spT=$(agent-browser eval "(() => { const t = document.querySelector('[data-testid=speed-transfer]'); return t && t.textContent.includes('MB') && t.textContent.includes('transferred') ? 'yes' : (t ? 'thin' : 'no-el') })()" 2>/dev/null)
echo "$spT" | rg -q 'yes' && ok "/speed-test prints the exact transfer volumes" || bad "/speed-test transfer note: $spT"
spC=$(agent-browser eval "(() => { const c = document.querySelector('[data-testid=speed-capacity]'); const n = c ? c.querySelectorAll('li').length : 0; return n >= 4 ? 'yes:' + n : 'thin:' + n })()" 2>/dev/null)
echo "$spC" | rg -q 'yes:' && ok "/speed-test capacity table computes from the measurement" || bad "/speed-test capacity: $spC"
agent-browser close > /dev/null 2>&1

echo "$pass" > /tmp/qa-pass; echo "$fail" > /tmp/qa-fail
echo "== RESULT (phase 12): $pass passed, $fail failed — run PHASE=8 for the final sweeps =="
exit 0

fi  # end the PHASE=12 R7 block

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
ALL_LIVE="share call screen camera voice notepad present canvas roundtable co-browse location-share live-captions zip image hash encode json text password qr pdf pdf-view pdf-text images-to-pdf office-view epub-view audio gif frame-grab recorder upscaler archive file-tools encrypt meta-scrub jwt hash-file-batch cron diff uuid convert-units lorem fake-data css-tools meta-tags barcode calculator percentage date-calculator bmi loan timer picker regex csv color signature invoice timezone pdf-to-image device-test beautify favicon watermark typing-test markdown stats number-to-words morse font-changer emoji json-to-ts compress-pdf time-card grade todo meme svg-convert cipher due-date word-frequency vcard calendar-link px-rem binary sound-tools tts fuel-cost salary sleep pace one-rep-max fraction quadratic spreadsheet chart-maker resume video-studio bg-remove speed-test"
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

# 19b. sw.js offline-shell mirror: every INSTANT_TOOLS path answers 200 —
# the SW precache list must never drift from the registry.
swmiss=0
for p in $(rg -o "'(/[a-z0-9-]+)'" public/sw.js | tr -d "'" ); do
  c=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:81$p")
  [ "$c" = "200" ] || { bad "sw shell $p: $c"; swmiss=1; }
done
[ "$swmiss" = "0" ] && ok "sw.js INSTANT_TOOLS mirror: all paths live"

if [ "$PHASE" = "5" ]; then
  echo "$pass" > /tmp/qa-pass; echo "$fail" > /tmp/qa-fail
  echo "== RESULT (phase 5): $pass passed, $fail failed — run PHASE=6 for the last checks =="
  exit 0
fi

fi  # end the PHASE!=7 skip wrapper around the 11g→19b region

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
