'use client'

// RoomClient — the browser-side counterpart of the relay service.
//
// Connects to the relay over socket.io. The URL resolves in this order:
//   1. NEXT_PUBLIC_RELAY_URL — absolute URL of a hosted relay (Vercel et al).
//   2. '/?XTransformPort=3003' — the sandbox gateway route to the local relay.
// The relay serves socket.io at path "/" in both cases.

import { io, type Socket } from 'socket.io-client'
import { normalizeOrigin } from '@/lib/normalize-url'
import type {
  AppEvent,
  ChatMsg,
  DeviceType,
  FileMeta,
  NoteDoc,
  Participant,
  Poll,
  RoomSnapshot,
  Stroke,
  TextItem,
} from '@/lib/types'

export const CHUNK_SIZE = 256 * 1024
export const MAX_FILE_BYTES = 50 * 1024 * 1024

export type ConnState = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'closed'

export interface RoomProfile {
  name: string
  device: DeviceType
}

type Listener = (payload: unknown) => void

interface AckResult {
  ok: boolean
  error?: string
  reason?: string
  [key: string]: unknown
}

// Relay endpoint. Build-time inlined from the environment; unset (or invalid)
// means the local sandbox gateway (same-origin, port-forwarded by Caddy).
// Runtime deployments can pass an explicit `relayUrl` (resolved via
// /api/relay-config — see relay-endpoint.ts) so a server-side RELAY_URL works
// without a rebuild. normalizeOrigin accepts bare hostnames
// ("shareonweb.onrender.com") as well as full URLs — a missing "https://"
// can no longer silently break the socket.
const INLINE_RELAY = normalizeOrigin(process.env.NEXT_PUBLIC_RELAY_URL) || ''
export const RELAY_SOCKET_URL = INLINE_RELAY || '/?XTransformPort=3003'

export function detectDevice(): DeviceType {
  if (typeof window === 'undefined') return 'desktop'
  const ua = window.navigator.userAgent
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet'
  if (/Mobi|Android|iPhone/i.test(ua)) return 'phone'
  if (window.innerWidth < 768 && 'ontouchstart' in window) return 'phone'
  return 'desktop'
}

const CLIENT_ID_KEY = 'sow.client.id'

/**
 * Stable per-tab identity used to attribute files and other items to "mine".
 * sessionStorage keeps it unique per tab (two tabs in the same browser are two
 * participants) and stable across reconnects within that tab.
 */
export function getClientId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = window.sessionStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      window.sessionStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return 'anon'
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('Could not read file chunk'))
    reader.readAsDataURL(blob)
  })
}

export class RoomClient {
  readonly socket: Socket
  readonly code: string
  private readonly profile: RoomProfile
  private listeners = new Map<string, Set<Listener>>()
  private joined = false
  private joinPromise: Promise<RoomSnapshot> | null = null
  private lostSince: number | null = null

  constructor(code: string, profile: RoomProfile, relayUrl?: string) {
    this.code = code
    this.profile = profile
    this.socket = io(relayUrl || RELAY_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 12000,
    })

    this.socket.on('connect', () => {
      // Join (or re-join after a reconnect) — the server answers with a full
      // room snapshot so late joiners and reconnecting clients are in sync.
      const wasLost = this.lostSince != null
      this.lostSince = null
      this.joined = false
      this.joinPromise = new Promise<RoomSnapshot>((resolve, reject) => {
        this.socket.emit(
          'join',
          {
            code: this.code,
            name: this.profile.name,
            device: this.profile.device,
            clientId: getClientId(),
          },
          (res: AckResult) => {
            if (res.ok) {
              this.joined = true
              this.emitLocal('conn', 'connected')
              if (wasLost) this.emitLocal('reconnected', {})
              resolve(res.state as RoomSnapshot)
            } else {
              this.emitLocal('joinerror', res.reason ?? res.error ?? 'unknown')
              reject(new Error(res.error ?? 'Could not join session'))
            }
          },
        )
      })
      this.joinPromise
        .then((state) => this.emitLocal('state', state))
        .catch(() => undefined)
    })

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        this.emitLocal('conn', 'closed')
      } else {
        this.lostSince = Date.now()
        this.emitLocal('conn', 'reconnecting')
      }
    })

    this.socket.io.on('reconnect_attempt', () => this.emitLocal('conn', 'reconnecting'))
    this.socket.on('connect_error', () => {
      if (!this.socket.connected) this.emitLocal('conn', 'offline')
    })

    // Server -> client broadcasts
    this.socket.on('presence', (p: { participants: Participant[] }) =>
      this.emitLocal('presence', p),
    )
    this.socket.on('text:new', (t: TextItem) => this.emitLocal('text', t))
    this.socket.on('text:cleared', () => this.emitLocal('textcleared', {}))
    this.socket.on('file:new', (f: FileMeta) => this.emitLocal('filenew', f))
    this.socket.on('file:chunk', (c: { fileId: string; index: number; data: string }) =>
      this.emitLocal('filechunk', c),
    )
    this.socket.on('file:complete', (c: { fileId: string }) => this.emitLocal('filecomplete', c))
    this.socket.on('file:removed', (c: { fileId: string }) => this.emitLocal('fileremoved', c))
    this.socket.on('draw:segment', (s: Stroke) => this.emitLocal('drawsegment', s))
    this.socket.on('draw:undo', (c: { strokeId: string }) => this.emitLocal('drawundo', c))
    this.socket.on('draw:cleared', () => this.emitLocal('drawcleared', {}))
    this.socket.on('chat:new', (m: ChatMsg) => this.emitLocal('chat', m))
    this.socket.on('poll:update', (p: { poll: Poll }) => this.emitLocal('poll', p.poll))
    this.socket.on('doc:changed', (p: { doc: NoteDoc }) => this.emitLocal('doc', p.doc))
    this.socket.on('room:closed', () => this.emitLocal('closed', {}))
    this.socket.on('app:event', (m: AppEvent) => this.emitLocal('appevent', m))
    this.socket.on('rtc:signal', (m: { from: string; data: unknown }) =>
      this.emitLocal('rtcsignal', m),
    )
  }

  // ------------------------------------------------------------- subscription
  on(event: string, cb: Listener): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(cb)
    return () => {
      set?.delete(cb)
    }
  }

  private emitLocal(event: string, payload: unknown) {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(payload)
      } catch (e) {
        console.error(`relay listener error [${event}]`, e)
      }
    })
  }

  // ------------------------------------------------------------------- connect
  /** Resolves once the first snapshot has arrived. */
  whenReady(): Promise<RoomSnapshot> {
    if (!this.joinPromise) {
      // Not connected yet — wait for the promise created on 'connect'.
      return new Promise<RoomSnapshot>((resolve, reject) => {
        const off = this.on('state', (s) => {
          off()
          offErr()
          resolve(s as RoomSnapshot)
        })
        const offErr = this.on('joinerror', (r) => {
          off()
          offErr()
          reject(new Error(String(r)))
        })
      })
    }
    return this.joinPromise
  }

  // ------------------------------------------------------------------ ack util
  private ack<T = AckResult>(event: string, payload: unknown, timeoutMs = 15000): Promise<T & AckResult> {
    return new Promise((resolve, reject) => {
      let done = false
      const timer = setTimeout(() => {
        if (!done) {
          done = true
          reject(new Error('The session is not responding. Check your connection.'))
        }
      }, timeoutMs)
      this.socket.timeout(timeoutMs).emit(event, payload, (err: unknown, res: unknown) => {
        if (done) return
        done = true
        clearTimeout(timer)
        if (err) {
          reject(new Error('The session is not responding. Check your connection.'))
          return
        }
        resolve(res as T & AckResult)
      })
    })
  }

  private assertJoined() {
    if (!this.joined) throw new Error('Not connected to the session yet.')
  }

  /**
   * Hard-reset the transport and reconnect from scratch. Automatic
   * reconnection can get stuck (relay asleep after a long idle period,
   * engine backoff against a dead socket); this closes the underlying
   * engine connection and dials again — same room, same code.
   */
  forceReconnect() {
    try {
      this.socket.io.engine?.close()
    } catch {
      // engine may already be down; the connect() below re-dials anyway
    }
    if (!this.socket.connected) this.socket.connect()
  }

  // ----------------------------------------------------------------- actions
  async sendText(id: string, content: string) {
    this.assertJoined()
    const res = await this.ack('text:send', { id, content })
    if (!res.ok) throw new Error(res.error ?? 'Could not send')
  }

  async clearTexts() {
    this.assertJoined()
    const res = await this.ack('text:clear', {})
    if (!res.ok) throw new Error(res.error ?? 'Could not clear')
  }

  async sendFile(
    file: File,
    fileId: string,
    onProgress: (sentChunks: number, totalChunks: number) => void,
    relPath?: string,
    slot?: string,
  ) {
    this.assertJoined()
    const chunkCount = Math.max(1, Math.ceil(file.size / CHUNK_SIZE))
    const res = await this.ack('file:start', {
      fileId,
      name: file.name,
      relPath,
      slot,
      size: file.size,
      type: file.type || 'application/octet-stream',
      chunkCount,
    })
    if (!res.ok) throw new Error(res.error ?? 'Could not start the transfer')
    for (let i = 0; i < chunkCount; i++) {
      const blob = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      const data = await blobToBase64(blob)
      const cres = await this.ack('file:chunk', { fileId, index: i, data }, 30000)
      if (!cres.ok) throw new Error(cres.error ?? 'Transfer interrupted')
      onProgress(i + 1, chunkCount)
    }
    const eres = await this.ack('file:end', { fileId })
    if (!eres.ok) throw new Error(eres.error ?? 'Transfer interrupted at the end')
  }

  async removeFile(fileId: string) {
    this.assertJoined()
    await this.ack('file:remove', { fileId })
  }

  sendDrawSegment(stroke: Stroke) {
    // High-frequency, fire-and-forget (server relays to others and stores it).
    this.socket.emit('draw:segment', stroke)
  }

  async undoStroke(strokeId: string): Promise<boolean> {
    this.assertJoined()
    const res = await this.ack<{ removed: boolean }>('draw:undo', { strokeId })
    return Boolean(res.removed)
  }

  async clearDrawing() {
    this.assertJoined()
    const res = await this.ack('draw:clear', {})
    if (!res.ok) throw new Error(res.error ?? 'Could not clear the board')
  }

  async sendChat(id: string, content: string) {
    this.assertJoined()
    const res = await this.ack('chat:send', { id, content })
    if (!res.ok) throw new Error(res.error ?? 'Could not send')
  }

  async createPoll(pollId: string, question: string, options: string[]) {
    this.assertJoined()
    const res = await this.ack('poll:create', { pollId, question, options })
    if (!res.ok) throw new Error(res.error ?? 'Could not create the poll')
  }

  async votePoll(pollId: string, optionIndex: number) {
    this.assertJoined()
    const res = await this.ack('poll:vote', { pollId, optionIndex })
    if (!res.ok) throw new Error(res.error ?? 'Could not vote')
  }

  /**
   * Save the shared note. `baseRev` is the revision this edit started from;
   * on conflict the ack carries the current doc (ok=false, conflict=true).
   */
  async sendDoc(
    content: string,
    baseRev: number,
  ): Promise<{ ok: boolean; conflict?: boolean; doc?: NoteDoc }> {
    this.assertJoined()
    return this.ack('doc:update', { content, baseRev })
  }

  /** Relay a WebRTC signaling envelope to one participant (or the whole room). */
  async sendSignal(data: unknown, to?: string) {
    this.assertJoined()
    const res = await this.ack('rtc:signal', { data, to })
    if (!res.ok) throw new Error(res.error ?? 'Could not deliver the connection signal')
  }

  /**
   * Generic room-scoped app event (hand raise, reactions, slides, captions…).
   * - persist: true  → stored in the room, echoed to EVERYONE (sender included)
   *   so all clients share one apply-path; optimistic senders dedupe via `from`.
   * - persist: false → forwarded only: direct to `to`, or to everyone else.
   */
  async sendAppEvent(type: string, payload?: unknown, opts?: { persist?: boolean; to?: string }) {
    this.assertJoined()
    const res = await this.ack('app:emit', {
      type,
      payload: payload ?? null,
      persist: opts?.persist === true,
      to: opts?.to,
    })
    if (!res.ok) throw new Error(res.error ?? 'Could not send')
  }

  /** Update the display name by re-joining (server upserts the participant). */
  rename(name: string) {
    this.profile.name = name
    if (this.socket.connected) {
      this.socket.emit(
        'join',
        {
          code: this.code,
          name: this.profile.name,
          device: this.profile.device,
          clientId: getClientId(),
        },
        () => undefined,
      )
    }
  }

  disconnect() {
    this.socket.removeAllListeners()
    this.socket.io.removeAllListeners()
    this.socket.disconnect()
    this.listeners.clear()
  }
}
