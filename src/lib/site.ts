// Canonical site origin for SEO/GEO. The sandbox preview host is ephemeral,
// so production URL comes from the environment; the fallback is the live
// Vercel origin. metadataBase, canonical, OpenGraph, JSON-LD and the sitemap
// all derive from this one constant — change it in one place.
//
// Both env spellings are accepted (NEXT_PUBLIC_SITE_URL is the client-inlined
// name, SITE_URL the server-side name documented in DEPLOY.md) and bare
// hostnames work too: "shareonweb.vercel.app" without its scheme used to
// crash the production build via `new URL(...)` → "Invalid URL" (2026-11-22).
import { normalizeOriginOr } from '@/lib/normalize-url'

const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || ''
export const SITE_URL = normalizeOriginOr(RAW_SITE_URL, 'https://shareonweb.vercel.app')

// Kontivo — an invented brand word (not a dictionary term, not an existing
// product name). It evokes "context": every tool here opens aware of your
// context — this device, this session, these files — and forgets it when
// you leave. Third name in the project's history: ShareOnWeb → Toolhive →
// Kontivo. The domain stays shareonweb.vercel.app.
export const SITE_NAME = 'Kontivo'

export const SITE_TITLE = 'Kontivo — context-aware web tools: instant utilities, live device-to-device sessions'

export const SITE_DESCRIPTION =
  'A context-aware hub of everyday tools that just work: zip and unzip, compress and convert images, hash and verify files, format JSON, generate passwords and QR codes — all instantly, all on your device. Need two devices? Share files, text, screens and calls live over peer-to-peer sessions with a six-character code. No accounts, no uploads, no ads — every tool opens on your context and forgets it when you leave.'
