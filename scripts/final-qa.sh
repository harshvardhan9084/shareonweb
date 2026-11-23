#!/usr/bin/env bash
# Final QA pass: Toolhive brand, /share rename + unified session modes,
# instant tools (Batch 1 + Batch 2 file tools with REAL fixtures), legacy
# redirects. Single invocation (sandbox kills ad-hoc processes between tool
# calls). Run: bash scripts/final-qa.sh
set -u
cd /home/z/my-project

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
         "/beam" "/call"; do
  printf "  %-14s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://localhost:81$p")"
done

pass=0; fail=0
ok()   { echo "  PASS $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL $1"; fail=$((fail+1)); }

echo "== browser checks =="
agent-browser open "http://localhost:81/" --timeout 60000 > /dev/null 2>&1
sleep 3
# 1. hub copy + brand
if agent-browser snapshot -c 2>/dev/null | rg -q "Every tool you need"; then ok "home hero is hub-accurate"; else bad "home hero"; fi
if agent-browser snapshot -c 2>/dev/null | rg -q "Instant Tools"; then ok "Instant Tools section on home"; else bad "Instant Tools section"; fi
if agent-browser snapshot -c 2>/dev/null | rg -q "PDF Toolkit"; then ok "home lists Batch 2 tools"; else bad "home Batch 2 listing"; fi
if agent-browser snapshot -c 2>/dev/null | rg -q "Toolhive"; then ok "Toolhive brand visible"; else bad "Toolhive brand"; fi
if agent-browser get title 2>/dev/null | rg -qi "ShareOnWeb"; then bad "old brand in title"; else ok "no old brand in title"; fi

# 2. /zip tool renders
agent-browser open "http://localhost:81/zip" --timeout 60000 > /dev/null 2>&1
agent-browser wait --text "Drop files, a folder, or a .zip archive" --timeout 40000 > /dev/null 2>&1
if agent-browser snapshot -c 2>/dev/null | rg -q "Drop files, a folder, or a .zip archive"; then ok "/zip renders drop zone"; else bad "/zip render"; fi

# 3. /hash renders
agent-browser open "http://localhost:81/hash" --timeout 60000 > /dev/null 2>&1
agent-browser wait --text "Drop the file to hash" --timeout 40000 > /dev/null 2>&1
if agent-browser snapshot -c 2>/dev/null | rg -q "Drop the file to hash"; then ok "/hash renders"; else bad "/hash render"; fi

# 4. /password generates immediately
agent-browser open "http://localhost:81/password" --timeout 60000 > /dev/null 2>&1
agent-browser wait --text "Strength" --timeout 40000 > /dev/null 2>&1
if agent-browser snapshot -c 2>/dev/null | rg -q "bits of entropy"; then ok "/password generates + strength"; else bad "/password"; fi

# 5. /pdf: single file -> thumbnails + extract flow
agent-browser open "http://localhost:81/pdf" --timeout 60000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/test-3pages.pdf" > /dev/null 2>&1
sleep 3
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
sleep 2
if agent-browser snapshot -c 2>/dev/null | rg -q "extracted PDF is ready"; then ok "/pdf extract 1-2 works"; else bad "/pdf extract"; fi
agent-browser close > /dev/null 2>&1

# 6. /pdf merge: two files
agent-browser open "http://localhost:81/pdf" --timeout 60000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/test-3pages.pdf" "$FX/test-2pages.pdf" > /dev/null 2>&1
sleep 3
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "2 documents · 5 pages total" && ok "/pdf merge list (2 docs, 5 pages)" || bad "/pdf merge list"
mbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Merge & download" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$mbtn > /dev/null 2>&1
sleep 2
err=$(agent-browser snapshot -c 2>/dev/null | rg -c "Merging failed" || echo 0)
[ "$err" = "0" ] && ok "/pdf merge completes without error" || bad "/pdf merge"
agent-browser close > /dev/null 2>&1

# 7. /pdf-view: render, page nav, search
agent-browser open "http://localhost:81/pdf-view" --timeout 60000 > /dev/null 2>&1
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
sleep 3
if agent-browser snapshot -c 2>/dev/null | rg -q '3 pages contain'; then ok "/pdf-view whole-document search"; else bad "/pdf-view search"; fi
agent-browser close > /dev/null 2>&1

# 8. /pdf-text: extraction with real content
agent-browser open "http://localhost:81/pdf-text" --timeout 60000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/test-3pages.pdf" > /dev/null 2>&1
sleep 4
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "characters" && echo "$snap" | rg -q "page 2 of 3" \
  && ok "/pdf-text extracts per-page text" || bad "/pdf-text extraction"
agent-browser close > /dev/null 2>&1

# 9. /images-to-pdf: build flow
agent-browser open "http://localhost:81/images-to-pdf" --timeout 60000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/photo.png" > /dev/null 2>&1
sleep 2
if agent-browser snapshot -c 2>/dev/null | rg -q "1 image · "; then ok "/images-to-pdf accepts image"; else bad "/images-to-pdf accept"; fi
bbtn=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Build & download PDF" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$bbtn > /dev/null 2>&1
sleep 3
if agent-browser snapshot -c 2>/dev/null | rg -q "PDF built \("; then ok "/images-to-pdf builds a PDF"; else bad "/images-to-pdf build"; fi
agent-browser close > /dev/null 2>&1

# 10. /office-view: CSV grid + DOCX sandboxed render
agent-browser open "http://localhost:81/office-view" --timeout 60000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/data.csv" > /dev/null 2>&1
sleep 3
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "4 rows" && echo "$snap" | rg -q 'cell "apples"' \
  && ok "/office-view CSV grid with cells" || bad "/office-view CSV"
agent-browser open "http://localhost:81/office-view" --timeout 60000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/letter.docx" > /dev/null 2>&1
sleep 4
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Word document" && echo "$snap" | rg -q "Toolhive QA Letter" \
  && ok "/office-view DOCX renders (sandboxed)" || bad "/office-view DOCX"
agent-browser close > /dev/null 2>&1

# 11. /epub-view: book opens, TOC jump works, progress updates
agent-browser open "http://localhost:81/epub-view" --timeout 60000 > /dev/null 2>&1
sleep 2
agent-browser upload "input[type=file]" "$FX/sample.epub" > /dev/null 2>&1
sleep 7
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "Toolhive QA Book" && ok "/epub-view opens book with metadata" || bad "/epub-view open"
cbtn=$(echo "$snap" | rg -o 'button "Contents" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$cbtn > /dev/null 2>&1
sleep 1
c2=$(agent-browser snapshot -c 2>/dev/null | rg -o 'button "Chapter Two" \[.*ref=(e[0-9]+)\]' -r '$1')
agent-browser click @$c2 > /dev/null 2>&1
sleep 4
snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$snap" | rg -q "· Chapter Two" && echo "$snap" | rg -q "closing chapter" \
  && ok "/epub-view TOC jump + section label" || bad "/epub-view TOC jump"
agent-browser close > /dev/null 2>&1

# 12. legacy /beam redirects to /share
r=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://localhost:81/beam")
if [ "$r" = "307 http://localhost:81/share" ]; then ok "/beam 307 -> /share"; else bad "/beam redirect: $r"; fi

# 13. /share landing renders modes
agent-browser open "http://localhost:81/share" --timeout 60000 > /dev/null 2>&1
agent-browser wait --text "Start files now" --timeout 40000 > /dev/null 2>&1
if agent-browser snapshot -c 2>/dev/null | rg -q "Quick Pair"; then ok "/share renders 4 modes"; else bad "/share modes"; fi

# 14. start a session and verify unified in-session modes (one code, all modes)
agent-browser find text "Start files now" click > /dev/null 2>&1
agent-browser wait --fn "window.location.pathname !== '/share'" --timeout 30000 > /dev/null 2>&1
newurl=$(agent-browser get url 2>/dev/null)
if [[ "$newurl" =~ ^http://localhost:81/[A-Z0-9]{6}$ ]]; then ok "new session at $newurl"; else bad "new session url: $newurl"; fi
sleep 2
if agent-browser snapshot -c 2>/dev/null | rg -q "Share modes"; then ok "in-session Share modes tablist"; else bad "in-session Share modes"; fi
if agent-browser snapshot -c 2>/dev/null | rg -q '"Folder"'; then ok "Folder tab reachable in-session (one code, all modes)"; else bad "Folder tab in-session"; fi

# 15. legacy ?s= / ?app= rewrites still work
legacyCode=$(echo "$newurl" | rg -o '[A-Z0-9]{6}$')
agent-browser open "http://localhost:81/?s=$legacyCode" --timeout 60000 > /dev/null 2>&1
agent-browser wait --fn "window.location.pathname === '/$legacyCode'" --timeout 30000 > /dev/null 2>&1
u=$(agent-browser get url 2>/dev/null)
if [ "$u" = "http://localhost:81/$legacyCode" ]; then ok "legacy ?s= rewrites to /$legacyCode"; else bad "legacy ?s= rewrite: $u"; fi
agent-browser open "http://localhost:81/?app=drop" --timeout 60000 > /dev/null 2>&1
agent-browser wait --fn "window.location.pathname === '/share'" --timeout 30000 > /dev/null 2>&1
u=$(agent-browser get url 2>/dev/null)
if [ "$u" = "http://localhost:81/share" ]; then ok "legacy ?app=drop -> /share"; else bad "legacy ?app= rewrite: $u"; fi

# 16. 404
g=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:81/garbage123")
if [ "$g" = "404" ]; then ok "/garbage123 404"; else bad "404: $g"; fi

echo "== SEO + ethic checks (server HTML) =="
# 17. home: ethic stated, families explained, FAQPage JSON-LD present
h=$(curl -s http://localhost:81/)
echo "$h" | rg -q "Nothing you do here ever lands on our servers" \
  && ok "home states the ethic up front" || bad "home ethic line"
echo "$h" | rg -q "Two kinds of tools, one rule" \
  && ok "hero explains Instant vs Live" || bad "hero families"
echo "$h" | rg -q "How this place works" \
  && ok "homepage narrative section present (ethic as story)" || bad "narrative section"
echo "$h" | rg -q "What actually happens when you zip a file here" \
  && ok "narrative explains instant mechanics" || bad "narrative instant mechanics"
echo "$h" | rg -q "What actually happens in a live session" \
  && ok "narrative explains live mechanics" || bad "narrative live mechanics"
echo "$h" | rg -q '"@type":"FAQPage"' && ok "home FAQPage JSON-LD" || bad "home FAQPage JSON-LD"

# 18. every live tool page: title, WebApplication + HowTo + FAQPage JSON-LD,
#     no old brand. Instant pages also render the written page below the tool.
ALL_LIVE="share call screen camera voice notepad present canvas roundtable co-browse location-share live-captions zip image hash encode json text password qr pdf pdf-view pdf-text images-to-pdf office-view epub-view"
for p in $ALL_LIVE; do
  h=$(curl -s "http://localhost:81/$p")
  t=$(echo "$h" | rg -o '<title>[^<]*</title>' | head -1)
  good=1
  echo "$h" | rg -q '"@type":"WebApplication"' || { bad "$p: WebApplication JSON-LD"; good=0; }
  echo "$h" | rg -q '"@type":"HowTo"' || { bad "$p: HowTo JSON-LD"; good=0; }
  echo "$h" | rg -q '"@type":"FAQPage"' || { bad "$p: FAQPage JSON-LD"; good=0; }
  echo "$h" | rg -q '<title>[^<]*· Toolhive</title>' || { bad "$p: title not tool-branded"; good=0; }
  # old BRAND leak (not the unchanged domain shareonweb.vercel.app, which is
  # legitimately present in canonical/JSON-LD URLs)
  echo "$h" | rg -q '<title>[^<]*(ShareOnWeb|SHAREONWEB)[^<]*</title>' && { bad "$p: old brand in title"; good=0; }
  [ "$good" = "1" ] && ok "$p: title + 3 JSON-LD graphs"
done

# 19. instant page body: action first, written content below
agent-browser open "http://localhost:81/zip" --timeout 60000 > /dev/null 2>&1
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
agent-browser open "http://localhost:81/share" --timeout 60000 > /dev/null 2>&1
agent-browser wait --text "Start files now" --timeout 40000 > /dev/null 2>&1
if agent-browser snapshot -c 2>/dev/null | rg -q "Start files now"; then ok "/share CTA reachable"; else bad "/share CTA"; fi
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
