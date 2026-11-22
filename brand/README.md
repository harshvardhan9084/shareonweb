# ShareOnWeb brand assets

## Current mark (v3, 2026-11-21) — "network diamond"

Drawn from the user's reference: four blue nodes (top / left / right / bottom),
a blue hub circle in the middle, and green edges + junction squares forming a
diamond — a small network with one hub. Brand palette (sampled from the
reference image):

- **brand blue** `#079fc2` — the four nodes and the hub
- **brand green** `#00866d` — edges, junctions, wordmark
- **brand tint** `#f2f9fb` — icon tile / OG background

UI chrome does NOT use these; the interface keeps the emerald signal from
`src/app/tokens.css`. The mark exposes them through tokens
(`--brand-node`, `--brand-edge`, `--brand-tint`, `--brand-wordmark`), brightened
in dark mode so the mark keeps its contrast.

Sources of truth (geometry identical across all of them — keep in sync):

- `brand/brandmark.svg` — full-colour glyph on transparent
- `brand/brandmark-mono.svg` — every element `currentColor` (mono variant)
- `brand/logo.svg` — tile version (rounded tint tile + glyph): favicon.svg,
  icon.svg, logo.svg in `public/`
- `brand/maskable.svg` — full-bleed tint, glyph at 72% (Android safe zone)
- `brand/apple-touch.svg` — full-bleed tint, glyph at 80%
- `src/components/platform/app-icon.tsx` — `BrandMark` (inline SVG,
  `variant="color" | "mono"`) and `BrandLockup` (mark + wordmark in the app
  display face)

Where each variant is respected:

| Surface | Variant |
| --- | --- |
| favicon / PWA icons / iOS icon | tint tile + colour glyph (`logo.svg` family) |
| header + footer wordmark pairing | colour glyph, no tile, `size-6/7` |
| install banner | mono glyph in white on the primary tile |
| small in-app chips (QR dialog title) | mono glyph in `text-primary` |
| OG / social card | `public/og.png` (lockup sheet, see below) |

Rebuild the raster icons and the OG card:

```
bun brand/build-icons.mjs   # public/icons/*.png + legibility previews
bun brand/build-og.mjs      # public/og.png + public/og/<appId>.png — one branded
                            #   card per live tool (needs Bricolage Grotesque in
                            #   ~/.fonts: ofl/bricolagegrotesque variable TTF from
                            #   the google/fonts repo, then fc-cache -f)
```

## Previous marks (rollback)

- `brand/v2/` — the 2026-11-21 "relay" tile (green tile #009966, white origin
  node → 45° shaft → arrowhead). Restore notes in `brand/v2/RESTORE.md`.
- `brand/v1/` — the original favicon (gradient triangle share), the lucide
  stock `Waypoints` app logo, and the broken mislabeled PNG; restore snippet in
  `brand/README` notes inside that folder.
