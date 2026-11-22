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

export const SITE_NAME = 'ShareOnWeb'

export const SITE_TITLE = 'ShareOnWeb: open a session, share the code'

export const SITE_DESCRIPTION =
  'Send files between your phone and your computer, share text instantly, draw together, call across devices. Every session opens with a six-character code. No accounts, sessions expire on their own.'
