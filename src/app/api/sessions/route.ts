import { NextResponse } from 'next/server'
import { sessionStore } from '@/lib/session-store'
import { getCreatableAppIds } from '@/lib/registry'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { appId?: string; title?: string }
    const appId = typeof body.appId === 'string' ? body.appId.trim() : ''
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : undefined

    // Sessions are created under variant ids ('drop', 'video-call', …) —
    // every mode of every merged tool is a legal session app.
    if (!appId || !getCreatableAppIds().includes(appId)) {
      return NextResponse.json(
        { error: 'Unknown app. Pick one of the live tools on Discover.' },
        { status: 400 },
      )
    }

    const session = await sessionStore.create(appId, title)
    return NextResponse.json({ session }, { status: 201 })
  } catch (err) {
    console.error(`POST /api/sessions failed (store=${sessionStore.kind})`, err)
    return NextResponse.json(
      { error: 'Something went wrong creating the session, please try again.' },
      { status: 500 },
    )
  }
}
