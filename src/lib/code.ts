// Session code helpers shared by client and server.
// Codes use an unambiguous alphabet (no I, L, O, 0, 1) so people can read them
// out loud or type them without confusion.

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

/**
 * What a session path segment looks like: 6–8 characters from the code
 * alphabet (no I, L, O, 0, 1). Used by routing to tell /K7T29Q (a session)
 * apart from /share (a tool) — and by 404 logic for anything else.
 */
export const CODE_PATH_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6,8}$/

/** Raw random 6-character code, e.g. "K7T29Q". Server-side use. */
export function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

/** Uppercase and strip anything that is not a code character. */
export function normalizeCode(input: string): string {
  const upper = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  // Drop the digits people most commonly confuse for letters.
  return upper.replace(/[OIL01]/g, '').slice(0, 8)
}

/** "K7T29Q" -> "K7T-29Q" for display. */
export function formatCode(code: string): string {
  const raw = normalizeCode(code)
  if (raw.length <= 3) return raw
  return `${raw.slice(0, 3)}-${raw.slice(3)}`
}

/** Absolute URL that opens this session directly: /K7T29Q. */
export function joinUrl(code: string): string {
  if (typeof window === 'undefined') return `/${code}`
  return `${window.location.origin}/${code}`
}
