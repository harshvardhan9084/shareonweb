# ShareOnWeb DESIGN.md

The locked design system. Every new page or component inherits this instead of
re-arguing taste. Derived from the installed skills: hallmark (floor + craft),
impeccable (craft floor + refuse list), humanizer (copy tells).

## Voice

Genre: modern-minimal utility. Posture: **Committed** (the tinted paper family
carries the surface; the emerald accent stays a signal under 5% of any
viewport: one filled control, focus rings, the live dot, link underlines).

The product's one real artifact is the **six-character session code**. Copy and
composition return to it. Copy passes the swap test: a line that could sit on a
competitor's page gets rewritten with a noun only ShareOnWeb has. No staging
("not just X, it's Y"), no triads, no dashes, no chatbot residue, no
"Features / Why us" category heads. Section heads say what the visitor will
see. Buttons carry the verb of the action.

## Type

| Role | Face | Usage |
| --- | --- | --- |
| Display | Bricolage Grotesque | h1, h2, wordmark. One weight per head, tracking -0.02em, line-height 1.05 to 1.15 |
| Body | Hanken Grotesk | everything else. 400 body, 500/600 emphasis. Body 16px, measure 45-75ch |
| Mono (outlier) | Geist Mono | session codes, figures, keyboard keys. Never for labels |

Headlines: seven words or fewer. h1 targets 44 to 60px; hierarchy past that
comes from weight and colour, not new sizes. Labels, captions, tags and nav
links: the body face, sentence case, untracked. No tracked caps anywhere.

## Colour

OKLCH, tinted toward the anchor hue (163, green). No pure-white or pure-black
surfaces, no untinted grey. The neutrals ramp is tinted 0.008 to 0.02 chroma.

- Paper: light `oklch(0.977 0.008 163)`, dark `oklch(0.16 0.012 163)`
- Ink: light `oklch(0.215 0.017 163)`, dark `oklch(0.93 0.008 163)`
- Accent (signal): emerald `oklch(0.55 0.145 163)` light / `oklch(0.70 0.16 163)` dark
- Body contrast target 7:1, floor 4.5:1. Grey text never sits on a coloured surface.

Never: gradient text, purple-blue or cyan-on-dark, glow shadows, blurred
orbs, grid backdrops, alpha as a colour definition. Colour literals live only
in `src/app/tokens.css`.

## Surfaces

The surface ladder, in order: whitespace, hairline (`border`), tinted well
(`bg-muted`), card. Cards are for independently interactive content only.
Never a card in a card, never white cards on the tinted page, never a side
stripe, never border plus wide shadow (ghost card). One shadow at most on the
page. Radii: `--radius` 12px, concentric; pills only for small controls.

Primary axis is left-biased on marketing surfaces; centre only when the task
is a single field. Grids hold hairline-separated rows before tiled cards. No
empty cells, no orphan rows.

## Motion

Transform and opacity only. Durations: micro 120ms, short 220ms, long 420ms.
One settle per page (0.5s fade with an 8px rise, ease-out), never per-element
stagger. Hover is one signal: a colour step or a 1px lift, never a shadow
bloom plus a translate. Focus rings never animate. Every animation keeps a
`prefers-reduced-motion` fallback showing the end state.

## Structure

- "Do it first": the page's action is the first thing. Marketing scaffolds
  (hero-metric templates, step cards, icon-plus-heading card grids, eyebrow
  badges, numbered sections) are refused.
- The hero: headline, one sentence, the working controls. No badges above the
  headline, no decorative underline, no backdrop texture.
- Catalogs render as an **index**: category rail plus hairline rows, not
  repeated card grids. Live versus planned is a text affordance, never a pill.
- The footer is a mast: wordmark, one honest sentence, links at body weight.
