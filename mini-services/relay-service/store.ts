/**
 * Durable persistence for the relay service.
 *
 * Why this exists: the relay held its session registry and every room
 * (texts, chat, files, strokes, notes) ONLY in RAM. Hosting platforms
 * restart that process freely — every deploy, every crash, and on Render's
 * free tier a spin-down after 15 minutes of inactivity — and all codes went
 * dead ("sessions become unconnectable"). This module gives the same state a
 * durable home so codes and room content survive restarts for the full
 * 24-hour session lifetime.
 *
 * Backends, chosen automatically from the environment (checked in order):
 *
 *   redis  — Upstash Redis REST API. Works everywhere INCLUDING Render's
 *            free tier (their disk is ephemeral, but an external Redis is
 *            not). Env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 *   disk   — one JSON snapshot file written atomically (tmp + rename) into
 *            RELAY_DATA_DIR. Use on any host with a persistent disk/volume
 *            (Render paid disks mounted at e.g. /data, Railway volumes,
 *            Fly volumes, a plain VPS). Does NOT survive on ephemeral disks.
 *   memory — in-process only (default, zero config). Same behavior as
 *            before this module existed.
 *
 * What is persisted:
 *   - the session registry (join codes + metadata, TTL = session expiry)
 *   - closed-code markers (so an ended session stays "closed" after restart)
 *   - room content: texts, chat, whiteboard strokes, polls, the shared note,
 *     persisted app events, and COMPLETED files up to RELAY_PERSIST_FILE_MAX
 *     bytes each (default 20 MB). Larger files and in-flight transfers stay
 *     live-only buffers — the sender simply re-shares after a restart.
 *   - live participants are NOT persisted (they are socket connections; a
 *     restored room starts empty and devices simply rejoin).
 *
 * All TTLs mirror the session contract: nothing outlives its session's
 * 24-hour expiry.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Configuration (env)
// ---------------------------------------------------------------------------
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const DATA_DIR = process.env.RELAY_DATA_DIR || "";

/** Completed files up to this size ride along in snapshots (default 20 MB). */
const FILE_MAX_BYTES = positiveInt(process.env.RELAY_PERSIST_FILE_MAX, 20 * 1024 * 1024);
/** Hard cap on one room's snapshot size; heavier content sheds (files first).
 *  Defaults to 48 MB so a full 20 MB file (≈27 MB once base64-chunked inside
 *  the snapshot JSON) still fits alongside the room's conversational state. */
const SNAPSHOT_MAX_BYTES = positiveInt(process.env.RELAY_PERSIST_SNAPSHOT_MAX, 48 * 1024 * 1024);

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// ---------------------------------------------------------------------------
// Shared row shapes (mirrors the in-memory types in index.ts)
// ---------------------------------------------------------------------------
export interface SessionRow {
  code: string;
  appId: string;
  title: string | null;
  createdAt: string; // ISO
  expiresAt: string; // ISO
  closed: boolean;
}

export interface ClosedRow {
  code: string;
  until: string; // ISO — original session expiry; the marker dies with it
}

export interface StoredFile {
  fileId: string;
  name: string;
  relPath?: string;
  slot?: string;
  ownerId?: string;
  size: number;
  type: string;
  chunkCount: number;
  chunks: (string | null)[];
  receivedCount?: number; // live-only bookkeeping — never restored
  complete: boolean;
  from: string;
  device: string;
  at: string;
}

/** The slice of a live Room that a snapshot is built from (see index.ts). */
export interface SnapshotRoomInput {
  code: string;
  createdAt: string;
  texts: unknown[];
  chat: unknown[];
  strokes: unknown[];
  polls: Map<string, unknown>;
  doc: unknown;
  appEvents: unknown[];
  files: Map<string, StoredFile>;
}

export interface RoomSnapshot {
  code: string;
  createdAt: string;
  texts: unknown[];
  chat: unknown[];
  strokes: unknown[];
  polls: unknown[];
  doc: unknown;
  appEvents: unknown[];
  files: StoredFile[];
}

export interface PersistedState {
  sessions: SessionRow[];
  closed: ClosedRow[];
  rooms: RoomSnapshot[];
}

export interface RelayStoreBackend {
  readonly kind: "redis" | "disk" | "memory";
  /** Read everything durable at boot. Always prunes expired rows. */
  load(): Promise<PersistedState>;
  putSession(row: SessionRow): Promise<void>;
  putClosed(row: ClosedRow): Promise<void>;
  /** ttlSec bounds the snapshot's lifetime (the session's remaining TTL). */
  putRoom(snapshot: RoomSnapshot, ttlSec: number): Promise<void>;
  /** Remove a session row and its closed marker. */
  forgetSession(code: string): Promise<void>;
  forgetRoom(code: string): Promise<void>;
  /** Optional best-effort flush for graceful shutdown. */
  flush?(): Promise<void>;
}

function isExpired(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

function secUntil(iso: string): number {
  return Math.max(60, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000) + 60);
}

// ---------------------------------------------------------------------------
// Room snapshotting (called by index.ts)
// ---------------------------------------------------------------------------

/**
 * Build a persisted snapshot from a live room. Oversized snapshots shed in a
 * fixed priority order — files first, then app events, then strokes — so the
 * small conversational state (texts, chat, note, polls) survives even when
 * a giant whiteboard blew the budget. All inputs here are plain JSON-ready
 * structures owned by index.ts; they are shallow-copied into the snapshot.
 */
export function buildRoomSnapshot(room: SnapshotRoomInput): RoomSnapshot {
  const snapshot: RoomSnapshot = {
    code: room.code,
    createdAt: room.createdAt,
    texts: room.texts.slice(),
    chat: room.chat.slice(),
    strokes: room.strokes.slice(),
    polls: Array.from(room.polls.values()).map((poll) => {
      const p = poll as { options?: { text: string; votes: number }[]; id?: string; question?: string; createdAt?: string };
      return {
        id: p.id,
        question: p.question,
        options: (p.options ?? []).map((o) => ({ text: o.text, votes: o.votes })),
        createdAt: p.createdAt,
      };
    }),
    doc: room.doc ? { ...(room.doc as object) } : null,
    appEvents: room.appEvents.slice(),
    files: [],
  };

  // Completed files within the per-file cap carry their chunks; everything
  // else (in-flight transfers, oversized files) is deliberately left out.
  for (const file of room.files.values()) {
    if (file.complete && file.size <= FILE_MAX_BYTES && !file.chunks.includes(null)) {
      snapshot.files.push({ ...file, chunks: file.chunks.slice() });
    }
  }

  // Size guard with progressive shedding.
  if (JSON.stringify(snapshot).length > SNAPSHOT_MAX_BYTES) snapshot.files = [];
  if (JSON.stringify(snapshot).length > SNAPSHOT_MAX_BYTES) snapshot.appEvents = [];
  if (JSON.stringify(snapshot).length > SNAPSHOT_MAX_BYTES) snapshot.strokes = [];
  return snapshot;
}

/** Rebuild a live Room-shaped object from a snapshot (participants empty). */
export function hydrateRoom(snapshot: RoomSnapshot): {
  code: string;
  createdAt: string;
  participants: Map<string, unknown>;
  texts: unknown[];
  chat: unknown[];
  files: Map<string, StoredFile>;
  strokes: unknown[];
  polls: Map<string, unknown>;
  doc: unknown;
  appEvents: unknown[];
  emptySince: number;
} {
  return {
    code: snapshot.code,
    createdAt: snapshot.createdAt,
    participants: new Map(),
    texts: snapshot.texts ?? [],
    chat: snapshot.chat ?? [],
    files: new Map((snapshot.files ?? []).map((f) => [f.fileId, f])),
    strokes: snapshot.strokes ?? [],
    polls: new Map((snapshot.polls ?? []).map((p) => [(p as { id: string }).id, p])),
    doc: snapshot.doc ?? null,
    appEvents: snapshot.appEvents ?? [],
    emptySince: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Backend: Upstash Redis over REST (no client dependency — plain fetch)
// ---------------------------------------------------------------------------

class RedisStore implements RelayStoreBackend {
  readonly kind = "redis" as const;
  private readonly url: string;
  private readonly token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/+$/, "");
    this.token = token;
  }

  private async cmd(parts: (string | number)[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parts),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`redis REST ${res.status}`);
    const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (body.error) throw new Error(`redis error: ${body.error}`);
    return body.result;
  }

  private async pipeline(commands: (string | number)[][]): Promise<(unknown | null)[]> {
    const res = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`redis REST pipeline ${res.status}`);
    const body = (await res.json().catch(() => [])) as { result?: unknown; error?: string }[];
    if (!Array.isArray(body)) throw new Error("redis pipeline: unexpected response");
    for (const row of body) if (row?.error) throw new Error(`redis pipeline error: ${row.error}`);
    return body.map((row) => (row ? row.result : null));
  }

  // Key layout: sow:s:<code> session row · sow:c:<code> closed marker ·
  // sow:r:<code> room snapshot · sow:ix:* index sets (boot reads use
  // SMEMBERS, avoiding SCAN round-trips).
  private static readonly K = {
    session: (code: string) => `sow:s:${code}`,
    closed: (code: string) => `sow:c:${code}`,
    room: (code: string) => `sow:r:${code}`,
    ixSession: "sow:ix:s",
    ixClosed: "sow:ix:c",
    ixRoom: "sow:ix:r",
  };

  async load(): Promise<PersistedState> {
    const state: PersistedState = { sessions: [], closed: [], rooms: [] };

    const sessionMembers = (await this.cmd(["SMEMBERS", RedisStore.K.ixSession])) as string[] | null;
    const closedMembers = (await this.cmd(["SMEMBERS", RedisStore.K.ixClosed])) as string[] | null;
    const roomMembers = (await this.cmd(["SMEMBERS", RedisStore.K.ixRoom])) as string[] | null;

    const sessionCodes = (sessionMembers ?? []).filter(Boolean) as string[];
    const closedCodes = (closedMembers ?? []).filter(Boolean) as string[];
    const roomCodes = (roomMembers ?? []).filter(Boolean) as string[];

    const commands = [
      ...sessionCodes.map((code) => ["GET", RedisStore.K.session(code)]),
      ...closedCodes.map((code) => ["GET", RedisStore.K.closed(code)]),
      ...roomCodes.map((code) => ["GET", RedisStore.K.room(code)]),
    ];
    if (commands.length === 0) return state;

    const results = await this.pipeline(commands);
    let cursor = 0;
    const staleSessions: string[] = [];
    const staleClosed: string[] = [];
    const staleRooms: string[] = [];

    for (const code of sessionCodes) {
      const raw = results[cursor++];
      const row = parseJson<SessionRow>(raw);
      if (row && row.code && !isExpired(row.expiresAt)) state.sessions.push(row);
      else staleSessions.push(code);
    }
    for (const code of closedCodes) {
      const raw = results[cursor++];
      const row = parseJson<ClosedRow>(raw);
      if (row && row.code && !isExpired(row.until)) state.closed.push(row);
      else staleClosed.push(code);
    }
    for (const code of roomCodes) {
      const raw = results[cursor++];
      const snap = parseJson<RoomSnapshot>(raw);
      if (snap && snap.code) state.rooms.push(snap);
      else staleRooms.push(code);
    }

    // Clean indexes of entries whose TTL already lapsed or failed to parse.
    const cleanup = [
      ...staleSessions.map((code) => ["SREM", RedisStore.K.ixSession, code]),
      ...staleClosed.map((code) => ["SREM", RedisStore.K.ixClosed, code]),
      ...staleRooms.map((code) => ["SREM", RedisStore.K.ixRoom, code]),
    ];
    if (cleanup.length > 0) this.pipeline(cleanup).catch(() => {});

    return state;
  }

  async putSession(row: SessionRow): Promise<void> {
    await this.pipeline([
      ["SET", RedisStore.K.session(row.code), JSON.stringify(row), "EX", secUntil(row.expiresAt)],
      ["SADD", RedisStore.K.ixSession, row.code],
    ]);
  }

  async putClosed(row: ClosedRow): Promise<void> {
    await this.pipeline([
      ["SET", RedisStore.K.closed(row.code), JSON.stringify(row), "EX", secUntil(row.until)],
      ["SADD", RedisStore.K.ixClosed, row.code],
    ]);
  }

  async putRoom(snapshot: RoomSnapshot, ttlSec: number): Promise<void> {
    const ttl = Math.max(60, Math.ceil(ttlSec));
    await this.pipeline([
      ["SET", RedisStore.K.room(snapshot.code), JSON.stringify(snapshot), "EX", ttl],
      ["SADD", RedisStore.K.ixRoom, snapshot.code],
    ]);
  }

  async forgetSession(code: string): Promise<void> {
    await this.pipeline([
      ["DEL", RedisStore.K.session(code)],
      ["DEL", RedisStore.K.closed(code)],
      ["SREM", RedisStore.K.ixSession, code],
      ["SREM", RedisStore.K.ixClosed, code],
    ]);
  }

  async forgetRoom(code: string): Promise<void> {
    await this.pipeline([
      ["DEL", RedisStore.K.room(code)],
      ["SREM", RedisStore.K.ixRoom, code],
    ]);
  }
}

function parseJson<T>(raw: unknown): T | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Backend: one atomically-written JSON file (persistent disks / volumes)
// ---------------------------------------------------------------------------

interface DiskState {
  version: 1;
  savedAt: string;
  sessions: SessionRow[];
  closed: ClosedRow[];
  rooms: RoomSnapshot[];
}

class DiskStore implements RelayStoreBackend {
  readonly kind = "disk" as const;
  private readonly file: string;
  private sessions = new Map<string, SessionRow>();
  private closed = new Map<string, ClosedRow>();
  private rooms = new Map<string, RoomSnapshot>();
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private writing = false;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, "relay-state.json");
  }

  async load(): Promise<PersistedState> {
    try {
      const raw = readFileSync(this.file, "utf8");
      const parsed = JSON.parse(raw) as DiskState;
      for (const row of parsed.sessions ?? []) {
        if (row?.code && !isExpired(row.expiresAt)) this.sessions.set(row.code, row);
      }
      for (const row of parsed.closed ?? []) {
        if (row?.code && !isExpired(row.until)) this.closed.set(row.code, row);
      }
      for (const snap of parsed.rooms ?? []) {
        if (snap?.code) this.rooms.set(snap.code, snap);
      }
    } catch {
      // Missing or unreadable file — start from a clean slate.
    }
    return {
      sessions: Array.from(this.sessions.values()),
      closed: Array.from(this.closed.values()),
      rooms: Array.from(this.rooms.values()),
    };
  }

  private scheduleWrite(): void {
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => void this.write(), 4000);
    (this.writeTimer as unknown as { unref?: () => void }).unref?.();
  }

  private async write(): Promise<void> {
    if (this.writing) return this.scheduleWrite();
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.writing = true;
    const state: DiskState = {
      version: 1,
      savedAt: new Date().toISOString(),
      sessions: Array.from(this.sessions.values()).filter((r) => !isExpired(r.expiresAt)),
      closed: Array.from(this.closed.values()).filter((r) => !isExpired(r.until)),
      rooms: Array.from(this.rooms.values()),
    };
    try {
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(state));
      renameSync(tmp, this.file);
    } catch (err) {
      console.error("[relay-service] disk snapshot write failed:", err);
    } finally {
      this.writing = false;
    }
  }

  async putSession(row: SessionRow): Promise<void> {
    this.sessions.set(row.code, row);
    this.scheduleWrite();
  }

  async putClosed(row: ClosedRow): Promise<void> {
    this.closed.set(row.code, row);
    this.scheduleWrite();
  }

  async putRoom(snapshot: RoomSnapshot, _ttlSec: number): Promise<void> {
    this.rooms.set(snapshot.code, snapshot);
    this.scheduleWrite();
  }

  async forgetSession(code: string): Promise<void> {
    this.sessions.delete(code);
    this.closed.delete(code);
    this.scheduleWrite();
  }

  async forgetRoom(code: string): Promise<void> {
    this.rooms.delete(code);
    this.scheduleWrite();
  }

  async flush(): Promise<void> {
    await this.write();
  }
}

// ---------------------------------------------------------------------------
// Backend: memory (default — identical to pre-persistence behavior)
// ---------------------------------------------------------------------------

class MemoryStore implements RelayStoreBackend {
  readonly kind = "memory" as const;
  async load(): Promise<PersistedState> {
    return { sessions: [], closed: [], rooms: [] };
  }
  async putSession(): Promise<void> {}
  async putClosed(): Promise<void> {}
  async putRoom(): Promise<void> {}
  async forgetSession(): Promise<void> {}
  async forgetRoom(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export function createStoreBackend(): RelayStoreBackend {
  if (REDIS_URL && REDIS_TOKEN) {
    console.log("[relay-service] persistence: redis (Upstash REST)");
    return new RedisStore(REDIS_URL, REDIS_TOKEN);
  }
  if (DATA_DIR) {
    console.log(`[relay-service] persistence: disk (${DATA_DIR})`);
    return new DiskStore(DATA_DIR);
  }
  console.log(
    "[relay-service] persistence: memory only — set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN " +
      "(Render free tier) or RELAY_DATA_DIR (persistent disk) to make sessions survive restarts",
  );
  return new MemoryStore();
}
