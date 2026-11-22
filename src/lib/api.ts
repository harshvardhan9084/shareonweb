// REST client for session lifecycle (Next.js API routes).

import type { SessionInfo } from '@/lib/types'

const SESSION_TTL_HOURS = 24

async function handle(res: Response): Promise<SessionInfo> {
  let body: { session?: SessionInfo; error?: string; reason?: string } = {}
  try {
    body = await res.json()
  } catch {
    // fall through
  }
  if (!res.ok) {
    const reason = body.reason ?? ''
    if (reason === 'expired' || body.error?.toLowerCase().includes('expired')) {
      throw new Error('This session has expired. Sessions live for 24 hours, so start a new one.')
    }
    if (reason === 'closed' || body.error?.toLowerCase().includes('ended')) {
      throw new Error('This session was ended by a participant. You can start a new one in seconds.')
    }
    throw new Error(body.error ?? 'We could not find that session. Double-check the code.')
  }
  if (!body.session) throw new Error('Unexpected response. Please try again.')
  return body.session
}

export async function createSession(appId: string, title?: string): Promise<SessionInfo> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, title }),
  })
  return handle(res)
}

export async function fetchSession(code: string): Promise<SessionInfo> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(code)}`, { cache: 'no-store' })
  return handle(res)
}

export async function closeSession(code: string): Promise<void> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(code)}/close`, { method: 'POST' })
  if (!res.ok) throw new Error('Could not end the session, try again.')
}

export async function renameSession(code: string, title: string): Promise<SessionInfo> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return handle(res)
}

export const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000
