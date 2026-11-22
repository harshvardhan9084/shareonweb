# v2 mark restore notes (the "relay" tile, 2026-11-21)

The v2 brand was a green rounded tile (#009966) with a white diagonal
origin-node + shaft + arrowhead glyph. To restore: copy the svg files here
back to brand/, copy build-icons.mjs back, run `bun brand/build-icons.mjs`,
copy logo.svg/favicon.svg/icon.svg to public/, and revert the BrandMark
glyph in src/components/platform/app-icon.tsx to:

```tsx
<svg viewBox="0 0 512 512" className={className} aria-hidden="true">
  <g fill="none" stroke="currentColor" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round">
    <path d="M150 150 L388 388" />
    <path d="M388 292 L388 388 L292 388" />
  </g>
  <circle cx="150" cy="150" r="56" fill="currentColor" />
</svg>
```

(That glyph is preserved verbatim in v2-brandmark.svg.)
