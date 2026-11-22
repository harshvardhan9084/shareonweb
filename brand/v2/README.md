# ShareOnWeb brand assets

## Current mark (v2, 2026-11-21)

"Relay" mark — a green rounded tile (`#009966`, matches `--primary` hue 163 and
the PWA `theme_color`) with a white glyph: one origin node, a bold 45-degree
shaft, and an arrowhead pointing to the receiving device. Reads at 16px as a
single diagonal motion: "send it over".

Source of truth:
- `brand/logo.svg` — tile version (favicon, PWA icons, OG images).
- `brand/brandmark.svg` — glyph-only, `currentColor` (in-app `BrandMark`
  component inside `bg-primary` tiles).

Generated PNGs live in `public/icons/` (192, 512, maskable-512, apple-touch
180). Rebuild them with:

```
bun brand/build-icons.mjs
```

`public/favicon.svg`, `public/icon.svg` and `public/logo.svg` are all the tile
version; the favicon and the app logo are the same drawing now.

## Previous mark (v1, backed up in `brand/v1/`)

Kept in case a rollback is ever wanted:

- `favicon-triangle-share.svg` — the v1 favicon: gradient green tile with a
  triangle of three nodes (generic "share network" glyph).
- `logo-z-tile.svg` — leftover scaffold logo (black Z tile, unused by the app
  but shipped in `public/`).
- `icon-mislabeled-png.svg` — a PNG binary named `.svg` (broken file, replaced).
- `icons-png/` — the v1 raster icon set.
- The v1 in-app logo was **not** a custom drawing at all: `BrandMark` rendered
  the lucide stock icon `Waypoints` inside a green tile. Restoring v1 means
  reverting `src/components/platform/app-icon.tsx` to:

  ```tsx
  import { Waypoints } from 'lucide-react'
  export function BrandMark({ className }: { className?: string }) {
    return <Waypoints className={className} aria-hidden="true" />
  }
  ```
