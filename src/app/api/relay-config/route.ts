import { NextResponse } from 'next/server'
import { SESSION_STORE_KIND } from '@/lib/session-store'
import { normalizeOrigin } from '@/lib/normalize-url'

export const dynamic = 'force-dynamic'

// Runtime relay configuration for the browser client. Deliberately read at
// REQUEST time: NEXT_PUBLIC_* vars are inlined at build, but this route also
// honors the plain server variable (RELAY_URL), so a deployment that set only
// that still hands a working relay URL to the socket.
//
// storeKind is exposed for deployment diagnostics: 'relay' means the session
// registry reaches the relay's control API; 'prisma'/'memory' means the
// deployment has no RELAY_URL and is running a detached fallback registry —
// sessions "create" fine but no relay ever knows about them.
export function GET() {
  if (process.env.NODE_ENV === 'production' && SESSION_STORE_KIND !== 'relay') {
    console.warn(
      `[relay-config] session registry is running on the "${SESSION_STORE_KIND}" fallback — set RELAY_URL (and a matching RELAY_KEY) so sessions register on the hosted relay.`,
    )
  }
  // normalizeOrigin upgrades bare hostnames ("shareonweb.onrender.com") to
  // https:// and strips stray slashes, so either spelling reaches the relay.
  const relayUrl =
    normalizeOrigin(process.env.RELAY_URL || process.env.NEXT_PUBLIC_RELAY_URL || '') || ''
  return NextResponse.json(
    { relayUrl: relayUrl || null, storeKind: SESSION_STORE_KIND },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
