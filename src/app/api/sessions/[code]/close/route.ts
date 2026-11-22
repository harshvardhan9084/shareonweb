import { NextResponse } from 'next/server'
import { sessionStore, SESSION_STORE_KIND } from '@/lib/session-store'
import { normalizeCode } from '@/lib/code'
import { normalizeOrigin } from '@/lib/normalize-url'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const normalized = normalizeCode(code)

  try {
    const closed = await sessionStore.close(normalized)
    if (!closed) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // With the relay store, closeSession already ends the live room (kicks
    // every participant). Any other store gets a best-effort nudge to the
    // local relay so connected sockets are dropped too.
    if (SESSION_STORE_KIND !== 'relay') {
      try {
        const relayUrl = normalizeOrigin(process.env.RELAY_URL) || 'http://127.0.0.1:3003'
        const relayKey = process.env.RELAY_KEY || 'relay-internal-key-2024'
        await fetch(`${relayUrl}/close/${encodeURIComponent(normalized)}`, {
          method: 'POST',
          headers: { 'x-relay-key': relayKey },
          signal: AbortSignal.timeout(3000),
        })
      } catch {
        // Relay may be restarting or the room may not exist yet — non-fatal.
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(`POST /api/sessions/[code]/close failed (store=${SESSION_STORE_KIND})`, err)
    return NextResponse.json({ error: 'Could not end the session.' }, { status: 500 })
  }
}
