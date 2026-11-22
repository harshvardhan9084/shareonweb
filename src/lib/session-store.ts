// Session registry — where join codes live.
//
// Sessions (the 6-character codes) need a home that every server instance
// agrees on. Three backends, chosen automatically from the environment:
//
//   relay   — proxies to the relay service's control API (POST /api/session).
//             Selected when RELAY_URL (or NEXT_PUBLIC_RELAY_URL) is set. This
//             is the hosted configuration (Vercel): serverless instances hold
//             no shared state, so the registry must live with the long-running
//             relay process — the same one that hosts the WebRTC rooms.
//   prisma  — SQLite via Prisma (self-hosted / sandbox). Selected when
//             DATABASE_URL is set and no relay URL is configured.
//   memory  — in-process fallback (zero config, single instance).
//
// All backends share one contract: a session row holds { id, code, appId,
// title, createdAt, expiresAt, closed }, sessions expire after 24h, and a
// closed session stays resolvable (with reason 'closed') until it expires.

import type { SessionInfo } from '@/lib/types'
import { generateCode } from '@/lib/code'
import { normalizeOrigin } from '@/lib/normalize-url'

export type SessionLookup =
  | { status: 'found'; session: SessionInfo }
  | { status: 'not_found' }
  | { status: 'closed' }
  | { status: 'expired' }

export interface SessionStore {
  readonly kind: 'relay' | 'prisma' | 'memory'
  create(appId: string, title?: string): Promise<SessionInfo>
  get(code: string): Promise<SessionLookup>
  rename(code: string, title: string): Promise<SessionLookup>
  /** Returns false when the session does not exist. */
  close(code: string): Promise<boolean>
}

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000

function toSessionInfo(row: {
  code: string
  appId: string
  title: string | null
  createdAt: Date | string
  expiresAt: Date | string
  closed: boolean
}): SessionInfo {
  return {
    id: row.code,
    code: row.code,
    appId: row.appId,
    title: row.title,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : row.expiresAt,
    closed: row.closed,
  }
}

// ---------------------------------------------------------------------------
// Backend selection
// ---------------------------------------------------------------------------

// normalizeOrigin tolerates bare hostnames ("shareonweb.onrender.com") and
// trailing slashes; an unusable value falls back to '' so the deployment
// selects a working store instead of a relay it can never reach.
const RELAY_URL =
  normalizeOrigin(process.env.RELAY_URL || process.env.NEXT_PUBLIC_RELAY_URL || '') || ''
const HAS_DATABASE = Boolean(process.env.DATABASE_URL)

// ---------------------------------------------------------------------------
// Relay backend (default for hosted deployments)
// ---------------------------------------------------------------------------

const RELAY_KEY = process.env.RELAY_KEY || 'relay-internal-key-2024'

async function relayFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${RELAY_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-relay-key': RELAY_KEY,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  })
}

const relayStore: SessionStore = {
  kind: 'relay',

  async create(appId, title) {
    const res = await relayFetch('/api/session', {
      method: 'POST',
      body: JSON.stringify({ appId, title }),
    })
    const body = (await res.json().catch(() => ({}))) as { session?: SessionInfo; error?: string }
    if (!res.ok || !body.session) {
      throw new Error(body.error || 'Relay rejected the session.')
    }
    return body.session
  },

  async get(code) {
    const res = await relayFetch(`/api/session/${encodeURIComponent(code)}`)
    const body = (await res.json().catch(() => ({}))) as {
      session?: SessionInfo
      reason?: string
    }
    if (res.ok && body.session) return { status: 'found', session: body.session }
    if (res.status === 410 && body.reason === 'closed') return { status: 'closed' }
    if (res.status === 410 && body.reason === 'expired') return { status: 'expired' }
    return { status: 'not_found' }
  },

  async rename(code, title) {
    const res = await relayFetch(`/api/session/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    })
    const body = (await res.json().catch(() => ({}))) as { session?: SessionInfo; reason?: string }
    if (res.ok && body.session) return { status: 'found', session: body.session }
    if (res.status === 410 && body.reason === 'closed') return { status: 'closed' }
    return { status: 'not_found' }
  },

  async close(code) {
    const res = await relayFetch(`/close/${encodeURIComponent(code)}`, { method: 'POST' })
    return res.ok
  },
}

// ---------------------------------------------------------------------------
// Prisma backend (self-hosted / sandbox, DATABASE_URL set)
// ---------------------------------------------------------------------------

const CLEANUP_AFTER_MS = 7 * 24 * 60 * 60 * 1000

const prismaStore: SessionStore = {
  kind: 'prisma',

  async create(appId, title) {
    // Lazy cleanup: drop sessions that expired more than 7 days ago.
    const { db } = await import('@/lib/db')
    try {
      await db.session.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - CLEANUP_AFTER_MS) } },
      })
    } catch {
      // non-fatal
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

    // Retry a few times in the (unlikely) event of a code collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateUniqueCode()
      const existing = await db.session.findUnique({ where: { code } })
      if (existing) continue
      const session = await db.session.create({
        data: { code, appId, title, expiresAt },
      })
      return toSessionInfo(session)
    }

    throw new Error('Could not allocate a session code, please try again.')
  },

  async get(code) {
    const { db } = await import('@/lib/db')
    const session = await db.session.findUnique({ where: { code } })
    if (!session) return { status: 'not_found' }
    if (session.closed) return { status: 'closed' }
    if (session.expiresAt.getTime() < Date.now()) return { status: 'expired' }
    return { status: 'found', session: toSessionInfo(session) }
  },

  async rename(code, title) {
    const { db } = await import('@/lib/db')
    const existing = await db.session.findUnique({ where: { code } })
    if (!existing) return { status: 'not_found' }
    if (existing.closed) return { status: 'closed' }
    const updated = await db.session.update({
      where: { code },
      data: { title: title || null },
    })
    return { status: 'found', session: toSessionInfo(updated) }
  },

  async close(code) {
    const { db } = await import('@/lib/db')
    const session = await db.session.findUnique({ where: { code } })
    if (!session) return false
    if (!session.closed) {
      await db.session.update({
        where: { code },
        data: { closed: true, closedAt: new Date() },
      })
    }
    return true
  },
}

// ---------------------------------------------------------------------------
// Memory backend (zero-config fallback; fine for a single warm instance)
// ---------------------------------------------------------------------------

interface MemoryRow {
  code: string
  appId: string
  title: string | null
  createdAt: Date
  expiresAt: Date
  closed: boolean
}

const globalStore = globalThis as unknown as { __sowSessions?: Map<string, MemoryRow> }
const memoryRows: Map<string, MemoryRow> = (globalStore.__sowSessions ??= new Map())

const MEMORY_MAX = 5000

function sweepMemory(): void {
  const now = Date.now()
  for (const [code, row] of memoryRows) {
    if (row.expiresAt.getTime() < now) memoryRows.delete(code)
  }
}

function generateUniqueCode(): string {
  return generateCode()
}

const memoryStore: SessionStore = {
  kind: 'memory',

  async create(appId, title) {
    sweepMemory()
    if (memoryRows.size >= MEMORY_MAX) {
      throw new Error('Session capacity reached, please try again later.')
    }
    const now = new Date()
    const row: MemoryRow = {
      code: generateUniqueCode(),
      appId,
      title: title || null,
      createdAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      closed: false,
    }
    memoryRows.set(row.code, row)
    return toSessionInfo(row)
  },

  async get(code) {
    sweepMemory()
    const row = memoryRows.get(code)
    if (!row) return { status: 'not_found' }
    if (row.closed) return { status: 'closed' }
    if (row.expiresAt.getTime() < Date.now()) return { status: 'expired' }
    return { status: 'found', session: toSessionInfo(row) }
  },

  async rename(code, title) {
    sweepMemory()
    const row = memoryRows.get(code)
    if (!row) return { status: 'not_found' }
    if (row.closed) return { status: 'closed' }
    row.title = title || null
    return { status: 'found', session: toSessionInfo(row) }
  },

  async close(code) {
    const row = memoryRows.get(code)
    if (!row) return false
    row.closed = true
    return true
  },
}

// ---------------------------------------------------------------------------
// Active backend
// ---------------------------------------------------------------------------

export const sessionStore: SessionStore = RELAY_URL ? relayStore : HAS_DATABASE ? prismaStore : memoryStore

export const SESSION_STORE_KIND = sessionStore.kind
