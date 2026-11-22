import { NextResponse } from 'next/server'
import { sessionStore } from '@/lib/session-store'
import { normalizeCode } from '@/lib/code'

const TITLE_MAX = 80

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const normalized = normalizeCode(code)

  if (normalized.length < 4) {
    return NextResponse.json(
      { error: 'That does not look like a session code.', reason: 'invalid' },
      { status: 400 },
    )
  }

  try {
    const lookup = await sessionStore.get(normalized)
    switch (lookup.status) {
      case 'not_found':
        return NextResponse.json(
          {
            error:
              'We could not find that session. Codes look like K7T-29Q; double-check it, or ask for a new code.',
            reason: 'not_found',
          },
          { status: 404 },
        )
      case 'closed':
        return NextResponse.json(
          {
            error: 'This session was ended by a participant. You can start a new one in seconds.',
            reason: 'closed',
          },
          { status: 410 },
        )
      case 'expired':
        return NextResponse.json(
          {
            error: 'This session has expired. Sessions live for 24 hours, so start a new one.',
            reason: 'expired',
          },
          { status: 410 },
        )
      case 'found':
        return NextResponse.json({ session: lookup.session })
    }
  } catch (err) {
    console.error(`GET /api/sessions/[code] failed (store=${sessionStore.kind})`, err)
    return NextResponse.json(
      { error: 'Something went wrong, please try again.' },
      { status: 500 },
    )
  }
}

// PATCH renames the session. The title is cosmetic metadata only — it helps
// people recognize the session in My Sessions and share dialogs. It can also
// be cleared with an empty string.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const normalized = normalizeCode(code)

  if (normalized.length < 4) {
    return NextResponse.json(
      { error: 'That does not look like a session code.', reason: 'invalid' },
      { status: 400 },
    )
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { title?: unknown }
    if (typeof body.title !== 'string') {
      return NextResponse.json({ error: 'A title string is required.' }, { status: 400 })
    }
    const title = body.title.trim().slice(0, TITLE_MAX)

    const lookup = await sessionStore.rename(normalized, title)
    switch (lookup.status) {
      case 'not_found':
        return NextResponse.json({ error: 'Session not found.', reason: 'not_found' }, { status: 404 })
      case 'closed':
        return NextResponse.json({ error: 'This session was ended.', reason: 'closed' }, { status: 410 })
      case 'expired':
        return NextResponse.json(
          { error: 'This session has expired.', reason: 'expired' },
          { status: 410 },
        )
      case 'found':
        return NextResponse.json({ session: lookup.session })
    }
  } catch (err) {
    console.error(`PATCH /api/sessions/[code] failed (store=${sessionStore.kind})`, err)
    return NextResponse.json(
      { error: 'Something went wrong, please try again.' },
      { status: 500 },
    )
  }
}
