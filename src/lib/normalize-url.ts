// Shared normalizer for URLs that arrive from the environment — values typed
// by humans, and humans omit "https://". A bare host fed to `new URL` throws
// "Invalid URL", which crashed the Vercel production build on 2026-11-22
// (SITE_URL="shareonweb.vercel.app"). Instead of trusting every deployment to
// type fully qualified URLs, every env URL goes through here so both
// spellings work:
//
//   "shareonweb.vercel.app"          → "https://shareonweb.vercel.app"
//   "shareonweb.vercel.app/"         → "https://shareonweb.vercel.app"
//   "https://shareonweb.vercel.app/" → "https://shareonweb.vercel.app"
//   "http://127.0.0.1:3003"          → "http://127.0.0.1:3003"  (scheme kept)
//   "", quotes, "javascript:…", garbage → null (caller picks the fallback)
//
// A bare hostname is always upgraded to https:// — these values point at
// hosted app/relay origins (Vercel, Render), which terminate TLS.

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * Normalize a configured origin URL. Returns null when the value is unset,
 * empty, or not a usable http(s) URL — callers supply their own fallback.
 */
export function normalizeOrigin(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = String(raw)
    .trim()
    .replace(/^["']|["']$/g, '') // tolerate copy-pasted quotes
    .replace(/^\/+/, '') // tolerate protocol-relative "//host"
    .replace(/\/+$/, '') // tolerate trailing slashes
  if (!trimmed) return null
  const candidate = SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

/** normalizeOrigin with an explicit fallback when the value is unusable. */
export function normalizeOriginOr(
  raw: string | null | undefined,
  fallback: string,
): string {
  return normalizeOrigin(raw) ?? fallback
}
