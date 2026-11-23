/**
 * relay-service
 *
 * Real-time relay for a platform of small web tools (text sharing, file
 * transfer, whiteboard, live rooms). Devices join "rooms" via a 6-character
 * session code; this service forwards events between all devices in a room
 * and keeps per-room state so late joiners receive history.
 *
 * Bun runtime. Plain node:http server + socket.io (path "/", forwarded by
 * the Caddy gateway). Port hardcoded to 3003.
 *
 * Also exposes an internal-only HTTP POST /close/:code endpoint (guarded by
 * the `x-relay-key` header) to manually end a session.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  buildRoomSnapshot,
  createStoreBackend,
  hydrateRoom,
  type SnapshotRoomInput,
} from "./store";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// PORT: platform-provided when hosted (Railway/Render/Fly/Docker pass PORT).
// RELAY_KEY: shared secret for the control endpoints (session registry +
// close). Override in production; the default only suits local development.
const PORT = Number(process.env.PORT) || 3003;
const RELAY_KEY = process.env.RELAY_KEY || "relay-internal-key-2024";
const SOCKET_IO_PATH = "/"; // DO NOT change — the Caddy gateway forwards this path in the sandbox

// Capacity limits
const MAX_TEXTS = 50;
const MAX_CHAT = 200;
const MAX_STROKES = 4000;
const MAX_STROKE_POINTS = 5000;
const MAX_CHUNK_COUNT = 2048;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_ROOM_FILE_BYTES = 80 * 1024 * 1024;
const MAX_TEXT_CHARS = 100_000;
const MAX_CHAT_CHARS = 2_000;
const MAX_POLL_QUESTION_CHARS = 200;
const MAX_POLL_OPTIONS = 6;
const MAX_POLL_OPTION_CHARS = 100;
const MAX_NAME_CHARS = 24;
const MAX_DOC_CHARS = 100_000;
const MAX_APP_EVENTS = 400; // persisted app events per room (late-joiner history)
const MAX_APP_EVENT_BYTES = 48 * 1024; // per-event payload cap (JSON length)

// Session registry
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h — mirrors the Next.js API
const MAX_SESSIONS = 5000;
const TITLE_MAX = 80;

// Housekeeping
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes
const EMPTY_ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours empty -> delete

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Device = "phone" | "tablet" | "desktop";

interface Participant {
  id: string;
  /** Client-generated stable id (per browser tab) — survives reconnects. */
  clientId: string;
  name: string;
  device: Device;
  joinedAt: string; // ISO string
}

interface TextItem {
  id: string;
  content: string;
  from: string;
  device: string;
  at: string;
}

interface ChatMsg {
  id: string;
  content: string;
  from: string;
  device: string;
  at: string;
}

interface FileItem {
  fileId: string;
  name: string;
  /** Optional relative path from the sender's chosen folder (Folder Share). */
  relPath?: string;
  /** Optional logical bucket ("presentation") so panels can filter by purpose. */
  slot?: string;
  /** clientId of the sender — clients use it to attribute "mine". */
  ownerId?: string;
  size: number;
  type: string;
  chunkCount: number;
  chunks: (string | null)[]; // base64 strings
  receivedCount: number;
  complete: boolean;
  from: string;
  device: string;
  at: string;
}

interface Stroke {
  strokeId: string;
  ownerId: string;
  color: string;
  size: number;
  mode: "draw" | "erase";
  points: number[][]; // [[x, y], ...] normalized 0..1
}

interface Poll {
  id: string;
  question: string;
  options: { text: string; votes: number }[];
  voters: Record<string, number>; // socketId -> optionIndex
  createdAt: string;
}

/** One shared plain-text note per room (the Notepad app). */
interface NoteDoc {
  content: string;
  rev: number; // bumped on every accepted update — optimistic concurrency
  updatedBy: string; // display name of the last editor
  updatedAt: string;
}

/** Generic app-level event (hand raise, reactions, slides, captions, pings…). */
interface AppEventRow {
  from: string;
  name: string;
  device: string;
  type: string;
  payload: unknown;
  at: string;
}

/** Session registry row — metadata for a joinable code (see POST /api/session). */
interface SessionMeta {
  code: string;
  appId: string;
  title: string | null;
  createdAt: string; // ISO
  expiresAt: string; // ISO
  closed: boolean;
}

interface Room {
  code: string;
  createdAt: string;
  participants: Map<string, Participant>;
  texts: TextItem[];
  chat: ChatMsg[];
  files: Map<string, FileItem>;
  strokes: Stroke[];
  polls: Map<string, Poll>;
  doc: NoteDoc | null;
  appEvents: AppEventRow[]; // persisted custom events for late joiners
  emptySince: number | null; // timestamp when participant count went to 0
}

type Ack = (res: unknown) => void;

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
const rooms = new Map<string, Room>();
const closedCodes = new Set<string>(); // codes ended via /close — permanent
const socketRooms = new Map<string, string>(); // socket.id -> room code
const sessions = new Map<string, SessionMeta>(); // session registry (see /api/session)

// ---------------------------------------------------------------------------
// Durable persistence (see ./store.ts)
//
// The registry is written through on create/close/rename; room content is
// snapshotted on a short debounce after every content mutation. Backends:
//   redis  — Upstash REST (survives restarts on hosts WITHOUT a persistent
//            disk, e.g. Render free tier)
//   disk   — RELAY_DATA_DIR snapshot file (persistent disks / volumes)
//   memory — default, no env configured (previous behavior)
// ---------------------------------------------------------------------------
const store = createStoreBackend();
const dirtyRooms = new Set<string>();
const PERSIST_FLUSH_MS = positiveInt(process.env.RELAY_PERSIST_INTERVAL_MS, 4000);

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function touchRoom(code: string): void {
  dirtyRooms.add(code);
}

function roomTtlSec(code: string): number {
  const meta = sessions.get(code);
  if (meta) {
    return Math.max(60, Math.ceil((new Date(meta.expiresAt).getTime() - Date.now()) / 1000) + 60);
  }
  return SESSION_TTL_MS / 1000;
}

async function flushDirtyRooms(): Promise<void> {
  if (dirtyRooms.size === 0) return;
  const codes = Array.from(dirtyRooms);
  dirtyRooms.clear();
  for (const code of codes) {
    const room = rooms.get(code);
    if (!room) continue;
    try {
      // The cast drops live-only fields (participants, receive counters) that
      // intentionally never enter a snapshot.
      await store.putRoom(buildRoomSnapshot(room as unknown as SnapshotRoomInput), roomTtlSec(code));
    } catch (err) {
      console.error(`[relay-service] failed to persist room ${code}:`, err);
      dirtyRooms.add(code); // retried on the next flush tick
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Session codes use the same unambiguous alphabet as the web app (no I, L,
 * O, 0, 1) so people can read them out loud or type them without confusion.
 * Collides against live rooms, ended codes and existing registry rows.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateSessionCode(): string {
  let code = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!sessions.has(code) && !rooms.has(code) && !closedCodes.has(code)) return code;
  }
  return code;
}

function sessionResponse(meta: SessionMeta) {
  return {
    session: {
      id: meta.code,
      code: meta.code,
      appId: meta.appId,
      title: meta.title,
      createdAt: meta.createdAt,
      expiresAt: meta.expiresAt,
      closed: meta.closed,
    },
  };
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 16_000) req.destroy(); // abuse guard
    });
    req.on("end", () => {
      try {
        const parsed = raw ? JSON.parse(raw) : {};
        resolve(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
    req.on("close", () => resolve({}));
  });
}

function isAuthorized(req: IncomingMessage): boolean {
  const key = req.headers["x-relay-key"];
  return typeof key === "string" && key === RELAY_KEY;
}

/**
 * Control-plane HTTP API, served on the same port as socket.io.
 *
 * The Next.js API routes (src/app/api/sessions/*) proxy here, so the session
 * registry lives with the relay — the one long-running process in a WebRTC
 * deployment. Serverless hosts (Vercel) keep no shared state between
 * instances, so codes must resolve against this service, not a per-instance
 * database.
 *
 *   GET  /healthz              — liveness probe for hosting platforms
 *   POST /api/session          — register a code  (x-relay-key)
 *   GET  /api/session/:code    — resolve a code (public; metadata only)
 *   PATCH /api/session/:code   — rename           (x-relay-key)
 *   POST /close/:code          — end session+room (x-relay-key)
 */
async function handleControlRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url || "/").split("?")[0];
  const method = req.method || "";

  // -- liveness -------------------------------------------------------------
  if (method === "GET" && (url === "/healthz" || url === "/health")) {
    sendJson(res, 200, {
      ok: true,
      uptime: process.uptime(),
      rooms: rooms.size,
      sessions: sessions.size,
      store: store.kind,
    });
    return true;
  }

  // -- create -----------------------------------------------------------------
  if (method === "POST" && url === "/api/session") {
    if (!isAuthorized(req)) return sendJson(res, 401, { error: "Unauthorized" }), true;
    const body = await readJson(req);
    const appId = typeof body.appId === "string" ? body.appId.trim().slice(0, 64) : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, TITLE_MAX) : "";
    if (!appId) {
      sendJson(res, 400, { error: "appId is required" });
      return true;
    }
    if (sessions.size >= MAX_SESSIONS) {
      const now = Date.now();
      for (const [code, meta] of sessions) {
        if (new Date(meta.expiresAt).getTime() < now) sessions.delete(code);
      }
      if (sessions.size >= MAX_SESSIONS) {
        sendJson(res, 429, { error: "Session capacity reached, try again later" });
        return true;
      }
    }
    const now = new Date();
    const meta: SessionMeta = {
      code: generateSessionCode(),
      appId,
      title: title || null,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
      closed: false,
    };
    sessions.set(meta.code, meta);
    try {
      await store.putSession(meta); // durable before the code is handed out
    } catch (err) {
      console.error(`[relay-service] failed to persist session ${meta.code}:`, err);
    }
    console.log(`[relay-service] session ${meta.code} registered (appId=${meta.appId})`);
    sendJson(res, 201, sessionResponse(meta));
    return true;
  }

  // -- lookup / rename --------------------------------------------------------
  const sessionMatch = /^\/api\/session\/([^/]+)$/.exec(url);
  if (sessionMatch) {
    let rawCode = sessionMatch[1];
    try {
      rawCode = decodeURIComponent(rawCode);
    } catch {
      // keep raw value; normalizeCode strips invalid characters anyway
    }
    const code = normalizeCode(rawCode);
    const meta = code ? sessions.get(code) : undefined;

    if (method === "GET") {
      if (!meta) {
        sendJson(res, 404, {
          error: "We could not find that session. Codes look like K7T-29Q; double-check it, or ask for a new code.",
          reason: "not_found",
        });
      } else if (meta.closed) {
        sendJson(res, 410, {
          error: "This session was ended by a participant. You can start a new one in seconds.",
          reason: "closed",
        });
      } else if (new Date(meta.expiresAt).getTime() < Date.now()) {
        sendJson(res, 410, {
          error: "This session has expired. Sessions live for 24 hours, so start a new one.",
          reason: "expired",
        });
      } else {
        sendJson(res, 200, sessionResponse(meta));
      }
      return true;
    }

    if (method === "PATCH") {
      if (!isAuthorized(req)) return sendJson(res, 401, { error: "Unauthorized" }), true;
      if (!meta) {
        sendJson(res, 404, { error: "Session not found.", reason: "not_found" });
        return true;
      }
      if (meta.closed) {
        sendJson(res, 410, { error: "This session was ended.", reason: "closed" });
        return true;
      }
      const body = await readJson(req);
      if (typeof body.title !== "string") {
        sendJson(res, 400, { error: "A title string is required." });
        return true;
      }
      meta.title = body.title.trim().slice(0, TITLE_MAX) || null;
      store.putSession(meta).catch((err) =>
        console.error(`[relay-service] failed to persist rename for ${code}:`, err),
      );
      sendJson(res, 200, sessionResponse(meta));
      return true;
    }
  }

  // -- close ------------------------------------------------------------------
  if (method === "POST" && /^\/close\/[^/]+$/.test(url)) {
    await handleCloseRequest(req, res);
    return true;
  }

  return false; // not a control route — let engine.io handle it
}

/** Uppercase, strip anything that is not A-Z or 2-9, max 8 chars. */
function normalizeCode(code: unknown): string {
  if (typeof code !== "string") return "";
  return code.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 8);
}

function getOrCreateRoom(code: string): Room {
  let room = rooms.get(code);
  if (!room) {
    room = {
      code,
      createdAt: nowIso(),
      participants: new Map(),
      texts: [],
      chat: [],
      files: new Map(),
      strokes: [],
      polls: new Map(),
      doc: null,
      appEvents: [],
      emptySince: null,
    };
    rooms.set(code, room);
  }
  return room;
}

function sortedParticipants(room: Room): Participant[] {
  return Array.from(room.participants.values()).sort((a, b) =>
    a.joinedAt < b.joinedAt ? -1 : a.joinedAt > b.joinedAt ? 1 : 0,
  );
}

/** Poll without the internal `voters` map. */
function sanitizedPoll(poll: Poll) {
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options.map((o) => ({ text: o.text, votes: o.votes })),
    createdAt: poll.createdAt,
  };
}

/** Full room snapshot; files include the whole chunks array for late joiners. */
function roomStatePayload(room: Room, selfId: string) {
  return {
    code: room.code,
    createdAt: room.createdAt,
    selfId,
    participants: sortedParticipants(room),
    texts: room.texts.slice(),
    chat: room.chat.slice(),
    polls: Array.from(room.polls.values()).map(sanitizedPoll),
    strokes: room.strokes.slice(),
    doc: room.doc ? { ...room.doc } : null,
    appEvents: room.appEvents.slice(),
    files: Array.from(room.files.values()).map((f) => ({
      fileId: f.fileId,
      name: f.name,
      relPath: f.relPath,
      slot: f.slot,
      ownerId: f.ownerId,
      size: f.size,
      type: f.type,
      chunkCount: f.chunkCount,
      chunks: f.chunks.slice(),
      complete: f.complete,
      from: f.from,
      device: f.device,
      at: f.at,
    })),
  };
}

function broadcastPresence(room: Room): void {
  io.to(room.code).emit("presence", { participants: sortedParticipants(room) });
}

/**
 * Remove a socket from the room it is tracked in. Broadcasts presence to the
 * remaining sockets and marks `emptySince` when the room becomes empty.
 */
function removeFromRoom(socketId: string): void {
  const code = socketRooms.get(socketId);
  if (!code) return;
  socketRooms.delete(socketId);
  const room = rooms.get(code);
  if (!room) return;
  if (room.participants.delete(socketId)) {
    if (room.participants.size === 0) {
      room.emptySince = Date.now();
    } else {
      broadcastPresence(room);
    }
  }
}

interface Ctx {
  room: Room;
  code: string;
  participant: Participant;
}

/** Resolve the (room, participant) context for a socket, if any. */
function roomCtx(socketId: string): Ctx | null {
  const code = socketRooms.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) {
    socketRooms.delete(socketId);
    return null;
  }
  const participant = room.participants.get(socketId);
  if (!participant) return null;
  return { room, code, participant };
}

function roomFileBytes(room: Room): number {
  let total = 0;
  for (const f of room.files.values()) total += f.size;
  return total;
}

// ---------------------------------------------------------------------------
// HTTP server + internal control endpoint (POST /close/:code)
// ---------------------------------------------------------------------------
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Fallback only. With socket.io attached at path "/", engine.io intercepts
  // every http request (see the handleRequest patch below), so this listener
  // effectively never runs. Kept for robustness if the path ever changes.
  res.setHeader("Content-Type", "application/json");
  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false }));
});

/**
 * POST /close/:code with header `x-relay-key`.
 * Broadcasts `room:closed`, disconnects the room's sockets, deletes room
 * state and permanently marks the code as closed (registry row too, in
 * memory and in the durable store).
 */
async function handleCloseRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = (req.url || "/").split("?")[0];
  const match = /^\/close\/([^/]+)$/.exec(url);
  if (!match) {
    return sendJson(res, 404, { ok: false });
  }

  if (!isAuthorized(req)) {
    return sendJson(res, 401, { ok: false });
  }

  let rawCode = match[1];
  try {
    rawCode = decodeURIComponent(rawCode);
  } catch {
    // keep raw value; normalizeCode strips invalid characters anyway
  }
  const code = normalizeCode(rawCode);
  if (!code) {
    return sendJson(res, 400, { ok: false });
  }

  // Registry: mark the session ended even when no room was ever opened.
  const meta = sessions.get(code);
  if (meta && !meta.closed) meta.closed = true;

  const room = rooms.get(code);
  if (!room && !meta) {
    return sendJson(res, 404, { ok: false });
  }

  if (room) {
    // Broadcast, kick everyone, wipe state, remember the code as closed.
    io.to(code).emit("room:closed", { code, reason: "ended" });
    for (const [sid, roomCode] of Array.from(socketRooms.entries())) {
      if (roomCode === code) socketRooms.delete(sid);
    }
    rooms.delete(code);
    dirtyRooms.delete(code);
    // Give the room:closed emit a moment to flush before kicking the sockets —
    // disconnecting synchronously races the async transport write.
    setTimeout(() => io.in(code).disconnectSockets(true), 150);
  }
  closedCodes.add(code);

  // Durable close: the registry row flips to closed=true and a closed marker
  // keeps socket joins refusing this code until the original expiry. The
  // room snapshot is dropped — its content is gone for good.
  try {
    if (meta) {
      await store.putSession(meta);
      await store.putClosed({ code, until: meta.expiresAt });
    } else {
      await store.putClosed({ code, until: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
    }
    await store.forgetRoom(code);
  } catch (err) {
    console.error(`[relay-service] failed to persist close for ${code}:`, err);
  }

  console.log(`[relay-service] room ${code} closed via /close endpoint`);
  return sendJson(res, 200, { ok: true });
}

// ---------------------------------------------------------------------------
// socket.io server
// ---------------------------------------------------------------------------
const io = new Server(httpServer, {
  path: SOCKET_IO_PATH,
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 5e6,
  pingTimeout: 60000,
  pingInterval: 25000,
});

/**
 * Because socket.io is attached with path "/", engine.io treats EVERY http
 * request on this server as its own (its check is a prefix match of "/" vs
 * the request URL) and plain `request` listeners never fire. To keep the
 * mandated socket.io path untouched while still exposing POST /close/:code
 * on the same port, we intercept exactly that route inside engine.io's
 * request handler and delegate all other requests to the original engine.io
 * logic (handshakes, polling, etc.).
 */
const engineWithHandleRequest = io.engine as unknown as {
  handleRequest: (req: IncomingMessage, res: ServerResponse) => void;
};
const originalEngineHandleRequest = engineWithHandleRequest.handleRequest.bind(io.engine);
engineWithHandleRequest.handleRequest = (req, res) => {
  Promise.resolve(handleControlRequest(req, res))
    .then((handled) => {
      if (!handled) originalEngineHandleRequest(req, res);
    })
    .catch((err) => {
      console.error("[relay-service] control request failed:", err);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: "Internal server error" });
    });
};

/**
 * Register an event whose client may pass an acknowledgement callback.
 * Guarantees the ack is invoked exactly once per invocation, and that a
 * thrown error in a handler does not crash the process.
 */
function registerAcked(socket: Socket, event: string, handler: (payload: any, ack: Ack) => void): void {
  socket.on(event, (...args: any[]) => {
    const last = args.length > 0 ? args[args.length - 1] : undefined;
    const ack: Ack = typeof last === "function" ? (last as Ack) : () => {};
    const payload = args.length > 0 ? args[0] : undefined;
    try {
      handler(payload, ack);
    } catch (err) {
      console.error(`[relay-service] handler error for "${event}":`, err);
      ack({ ok: false, error: "Internal server error" });
    }
  });
}

io.on("connection", (socket) => {
  // -- join -----------------------------------------------------------------
  registerAcked(socket, "join", (payload, ack) => {
    const code = normalizeCode(payload?.code);
    if (!code) {
      return ack({ ok: false, error: "Invalid session code" });
    }
    if (closedCodes.has(code)) {
      return ack({ ok: false, reason: "closed", error: "This session was ended" });
    }

    const room = getOrCreateRoom(code);

    // A socket lives in exactly ONE room — detach it from any previous one.
    const prevCode = socketRooms.get(socket.id);
    if (prevCode && prevCode !== code) {
      socket.leave(prevCode);
      removeFromRoom(socket.id);
    }

    socket.join(code);
    socketRooms.set(socket.id, code);

    let name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!name) name = "Guest";
    if (name.length > MAX_NAME_CHARS) name = name.slice(0, MAX_NAME_CHARS);
    const device: Device =
      payload?.device === "tablet" || payload?.device === "desktop" ? payload.device : "phone";
    const clientId =
      typeof payload?.clientId === "string" && payload.clientId
        ? payload.clientId.slice(0, 64)
        : socket.id;

    room.participants.set(socket.id, { id: socket.id, clientId, name, device, joinedAt: nowIso() });
    room.emptySince = null;

    ack({ ok: true, selfId: socket.id, state: roomStatePayload(room, socket.id) });
    broadcastPresence(room); // to the whole room, including the new socket
    console.log(`[relay-service] ${socket.id} joined ${code} as ${name} (${device})`);
  });

  // -- leave ----------------------------------------------------------------
  registerAcked(socket, "leave", (_payload, ack) => {
    const code = socketRooms.get(socket.id);
    if (code) {
      socket.leave(code);
      removeFromRoom(socket.id);
      console.log(`[relay-service] ${socket.id} left ${code}`);
    }
    ack({ ok: true });
  });

  // -- room state (refresh snapshot for the requesting socket) ---------------
  registerAcked(socket, "room:state", (_payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    ack({ ok: true, selfId: socket.id, state: roomStatePayload(ctx.room, socket.id) });
  });

  // -- text sharing ----------------------------------------------------------
  registerAcked(socket, "text:send", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    const content = typeof payload?.content === "string" ? payload.content : "";
    if (typeof payload?.content !== "string") {
      return ack({ ok: false, error: "Text content required" });
    }
    if (content.length > MAX_TEXT_CHARS) {
      return ack({ ok: false, error: `Text too long (max ${MAX_TEXT_CHARS} chars)` });
    }
    const item: TextItem = {
      id: typeof payload?.id === "string" && payload.id ? payload.id : makeId(),
      content,
      from: ctx.participant.name,
      device: ctx.participant.device,
      at: nowIso(),
    };
    ctx.room.texts.push(item);
    if (ctx.room.texts.length > MAX_TEXTS) {
      ctx.room.texts.splice(0, ctx.room.texts.length - MAX_TEXTS);
    }
    io.to(ctx.code).emit("text:new", item); // ALL sockets, including sender
    touchRoom(ctx.code);
    ack({ ok: true, item });
  });

  registerAcked(socket, "text:clear", (_payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    ctx.room.texts = [];
    io.to(ctx.code).emit("text:cleared", {}); // ALL sockets, including sender
    touchRoom(ctx.code);
    ack({ ok: true });
  });

  // -- file transfer ---------------------------------------------------------
  registerAcked(socket, "file:start", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    const fileId = typeof payload?.fileId === "string" ? payload.fileId : "";
    const size = Number(payload?.size);
    const chunkCount = Number(payload?.chunkCount);
    if (!fileId || !Number.isFinite(size) || size < 0 || !Number.isInteger(chunkCount) || chunkCount < 1) {
      return ack({ ok: false, error: "Invalid file metadata" });
    }
    if (chunkCount > MAX_CHUNK_COUNT) {
      return ack({ ok: false, error: `Too many chunks (max ${MAX_CHUNK_COUNT})` });
    }
    if (size > MAX_FILE_BYTES) {
      return ack({ ok: false, error: "File too large (max 50MB)" });
    }
    if (roomFileBytes(ctx.room) + size > MAX_ROOM_FILE_BYTES) {
      return ack({ ok: false, error: "Room file storage limit (80MB) reached" });
    }

    const item: FileItem = {
      fileId,
      name: typeof payload?.name === "string" ? payload.name : "file",
      relPath:
        typeof payload?.relPath === "string" && payload.relPath
          ? payload.relPath.slice(0, 1024)
          : undefined,
      slot:
        typeof payload?.slot === "string" && /^[a-z][a-z0-9-]{0,23}$/.test(payload.slot)
          ? payload.slot
          : undefined,
      ownerId: ctx.participant.clientId,
      size,
      type: typeof payload?.type === "string" ? payload.type : "application/octet-stream",
      chunkCount,
      chunks: new Array<string | null>(chunkCount).fill(null),
      receivedCount: 0,
      complete: false,
      from: ctx.participant.name,
      device: ctx.participant.device,
      at: nowIso(),
    };
    ctx.room.files.set(fileId, item);

    socket.to(ctx.code).emit("file:new", {
      // everyone EXCEPT the sender
      fileId: item.fileId,
      name: item.name,
      relPath: item.relPath,
      slot: item.slot,
      ownerId: item.ownerId,
      size: item.size,
      type: item.type,
      chunkCount: item.chunkCount,
      from: item.from,
      device: item.device,
      at: item.at,
    });
    ack({ ok: true });
  });

  registerAcked(socket, "file:chunk", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    const fileId = typeof payload?.fileId === "string" ? payload.fileId : "";
    const file = fileId ? ctx.room.files.get(fileId) : undefined;
    if (!file) return ack({ ok: false, error: "Unknown file" });
    if (file.complete) return ack({ ok: false, error: "File transfer already finished" });
    const index = Number(payload?.index);
    const data = typeof payload?.data === "string" ? payload.data : "";
    if (!Number.isInteger(index) || index < 0 || index >= file.chunkCount) {
      return ack({ ok: false, error: "Invalid chunk index" });
    }
    if (!data) return ack({ ok: false, error: "Invalid chunk data" });

    if (file.chunks[index] === null) {
      file.receivedCount++;
    }
    file.chunks[index] = data;

    socket.to(ctx.code).emit("file:chunk", { fileId, index, data }); // EXCEPT sender
    ack({ ok: true, received: file.receivedCount });
  });

  registerAcked(socket, "file:end", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    const fileId = typeof payload?.fileId === "string" ? payload.fileId : "";
    const file = fileId ? ctx.room.files.get(fileId) : undefined;
    if (!file) return ack({ ok: false, error: "Unknown file" });
    file.complete = true;
    socket.to(ctx.code).emit("file:complete", { fileId }); // EXCEPT sender
    touchRoom(ctx.code); // completed files (within the size cap) now persist
    ack({ ok: true });
  });

  registerAcked(socket, "file:remove", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    const fileId = typeof payload?.fileId === "string" ? payload.fileId : "";
    if (!fileId || !ctx.room.files.delete(fileId)) {
      return ack({ ok: false, error: "Unknown file" });
    }
    io.to(ctx.code).emit("file:removed", { fileId }); // ALL sockets, including sender
    touchRoom(ctx.code);
    ack({ ok: true });
  });

  // -- whiteboard --------------------------------------------------------------
  registerAcked(socket, "draw:segment", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    const strokeId = typeof payload?.strokeId === "string" ? payload.strokeId : "";
    if (!strokeId) return ack({ ok: false, error: "Invalid strokeId" });

    let stroke = ctx.room.strokes.find((s) => s.strokeId === strokeId);
    if (!stroke) {
      stroke = {
        strokeId,
        // Key ownership by the STABLE per-tab clientId, not the volatile
        // socket.id — a reconnect (new socket.id) or reload must not forfeit
        // undo rights over strokes that are still on the board.
        ownerId: ctx.participant.clientId,
        color: typeof payload?.color === "string" ? payload.color : "#000000",
        size: Number.isFinite(Number(payload?.size)) ? Number(payload?.size) : 4,
        mode: payload?.mode === "erase" ? "erase" : "draw",
        points: [],
      };
      ctx.room.strokes.push(stroke);
      if (ctx.room.strokes.length > MAX_STROKES) {
        ctx.room.strokes.splice(0, ctx.room.strokes.length - MAX_STROKES);
      }
    }

    if (Array.isArray(payload?.points)) {
      for (const p of payload.points as unknown[]) {
        if (stroke.points.length >= MAX_STROKE_POINTS) break;
        if (Array.isArray(p) && p.length >= 2) {
          const x = Number(p[0]);
          const y = Number(p[1]);
          if (Number.isFinite(x) && Number.isFinite(y)) stroke.points.push([x, y]);
        }
      }
    }

    socket.to(ctx.code).emit("draw:segment", payload); // EXCEPT sender, same payload
    touchRoom(ctx.code);
    ack({ ok: true });
  });

  registerAcked(socket, "draw:undo", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    const strokeId = typeof payload?.strokeId === "string" ? payload.strokeId : "";
    const idx = strokeId ? ctx.room.strokes.findIndex((s) => s.strokeId === strokeId) : -1;
    let removed = false;
    if (idx >= 0 && ctx.room.strokes[idx].ownerId === ctx.participant.clientId) {
      ctx.room.strokes.splice(idx, 1);
      removed = true;
      socket.to(ctx.code).emit("draw:undo", { strokeId }); // EXCEPT sender
      touchRoom(ctx.code);
    }
    ack({ ok: true, removed });
  });

  registerAcked(socket, "draw:clear", (_payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    ctx.room.strokes = [];
    socket.to(ctx.code).emit("draw:cleared", {}); // EXCEPT sender
    touchRoom(ctx.code);
    ack({ ok: true });
  });

  // -- chat ------------------------------------------------------------------
  registerAcked(socket, "chat:send", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    const content = typeof payload?.content === "string" ? payload.content : "";
    if (typeof payload?.content !== "string") {
      return ack({ ok: false, error: "Message content required" });
    }
    if (content.length > MAX_CHAT_CHARS) {
      return ack({ ok: false, error: `Message too long (max ${MAX_CHAT_CHARS} chars)` });
    }
    const msg: ChatMsg = {
      id: typeof payload?.id === "string" && payload.id ? payload.id : makeId(),
      content,
      from: ctx.participant.name,
      device: ctx.participant.device,
      at: nowIso(),
    };
    ctx.room.chat.push(msg);
    if (ctx.room.chat.length > MAX_CHAT) {
      ctx.room.chat.splice(0, ctx.room.chat.length - MAX_CHAT);
    }
    io.to(ctx.code).emit("chat:new", msg); // ALL sockets, including sender
    touchRoom(ctx.code);
    ack({ ok: true, item: msg });
  });

  // -- polls -----------------------------------------------------------------
  registerAcked(socket, "poll:create", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });

    const question = typeof payload?.question === "string" ? payload.question.trim() : "";
    if (!question) return ack({ ok: false, error: "Poll question required" });
    if (question.length > MAX_POLL_QUESTION_CHARS) {
      return ack({ ok: false, error: `Poll question too long (max ${MAX_POLL_QUESTION_CHARS} chars)` });
    }

    const rawOptions = Array.isArray(payload?.options) ? payload.options : [];
    const options: string[] = [];
    for (const o of rawOptions) {
      if (typeof o === "string" && o.trim()) options.push(o.trim());
    }
    if (options.length < 1 || options.length > MAX_POLL_OPTIONS) {
      return ack({ ok: false, error: `Poll needs 1-${MAX_POLL_OPTIONS} options` });
    }
    if (options.some((o) => o.length > MAX_POLL_OPTION_CHARS)) {
      return ack({ ok: false, error: `Poll option text too long (max ${MAX_POLL_OPTION_CHARS} chars)` });
    }

    const poll: Poll = {
      id: typeof payload?.pollId === "string" && payload.pollId ? payload.pollId : makeId(),
      question,
      options: options.map((text) => ({ text, votes: 0 })),
      voters: {},
      createdAt: nowIso(),
    };
    ctx.room.polls.set(poll.id, poll);

    io.to(ctx.code).emit("poll:update", { poll: sanitizedPoll(poll) }); // ALL, incl. sender
    touchRoom(ctx.code);
    ack({ ok: true });
  });

  registerAcked(socket, "poll:vote", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    const pollId = typeof payload?.pollId === "string" ? payload.pollId : "";
    const poll = pollId ? ctx.room.polls.get(pollId) : undefined;
    if (!poll) return ack({ ok: false, error: "Unknown poll" });
    const optionIndex = Number(payload?.optionIndex);
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
      return ack({ ok: false, error: "Invalid option index" });
    }

    const prev = poll.voters[socket.id];
    if (prev === undefined) {
      poll.options[optionIndex].votes++;
      poll.voters[socket.id] = optionIndex;
    } else if (prev !== optionIndex) {
      poll.options[prev].votes = Math.max(0, poll.options[prev].votes - 1);
      poll.options[optionIndex].votes++;
      poll.voters[socket.id] = optionIndex;
    }

    io.to(ctx.code).emit("poll:update", { poll: sanitizedPoll(poll) }); // ALL, incl. sender
    touchRoom(ctx.code);
    ack({ ok: true });
  });

  // -- shared doc (Notepad) ---------------------------------------------------
  registerAcked(socket, "doc:update", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    const content = payload?.content;
    if (typeof content !== "string") {
      return ack({ ok: false, error: "Document content required" });
    }
    if (content.length > MAX_DOC_CHARS) {
      return ack({ ok: false, error: `Note too long (max ${MAX_DOC_CHARS} chars)` });
    }

    const baseRev = Number(payload?.baseRev);
    if (!Number.isFinite(baseRev)) {
      return ack({ ok: false, error: "Invalid revision" });
    }

    // Lazy-init: first write adopts rev 0 as its base.
    const doc = ctx.room.doc ?? { content: "", rev: 0, updatedBy: "", updatedAt: nowIso() };
    if (doc.rev !== baseRev) {
      // Someone else saved first — hand the writer the current truth.
      return ack({ ok: false, conflict: true, doc: { ...doc } });
    }

    doc.content = content;
    doc.rev += 1;
    doc.updatedBy = ctx.participant.name;
    doc.updatedAt = nowIso();
    ctx.room.doc = doc;

    io.to(ctx.code).emit("doc:changed", { doc: { ...doc } }); // ALL, incl. sender (rev confirm)
    touchRoom(ctx.code);
    ack({ ok: true, doc: { ...doc } });
  });

  // -- WebRTC signaling relay (screen sharing, video calls) -------------------
  // Forwards small signaling envelopes (offer/answer/ICE + simple flags)
  // between room members. The relay never inspects the media plan — it only
  // routes JSON. `to` targets one participant id (participant ids ARE socket
  // ids); omitting `to` broadcasts to everyone else in the room.
  registerAcked(socket, "rtc:signal", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    if (!payload || typeof payload !== "object" || !payload.data || typeof payload.data !== "object") {
      return ack({ ok: false, error: "Invalid signal payload" });
    }

    const envelope = { from: socket.id, data: payload.data };
    const to = typeof payload.to === "string" ? payload.to : "";

    if (to) {
      if (to === socket.id || !ctx.room.participants.has(to)) {
        return ack({ ok: false, error: "Unknown recipient" });
      }
      io.to(to).emit("rtc:signal", envelope);
    } else {
      socket.to(ctx.code).emit("rtc:signal", envelope); // everyone EXCEPT sender
    }
    ack({ ok: true });
  });

  // -- generic app events (hand raise, reactions, slides, captions, pings…) ---
  // Room-scoped custom channel for the newer tools. `persist: true` stores the
  // event in the room so late joiners receive it in their snapshot; persisted
  // events are echoed to EVERYONE (sender included) so all clients share one
  // apply-path — senders that applied optimistically dedupe via `from`.
  // Volatile events are forwarded only (direct to `to`, or to everyone else).
  registerAcked(socket, "app:emit", (payload, ack) => {
    const ctx = roomCtx(socket.id);
    if (!ctx) return ack({ ok: false, error: "Not in a room" });
    const type = typeof payload?.type === "string" ? payload.type.trim().slice(0, 64) : "";
    if (!type) return ack({ ok: false, error: "Event type required" });

    const data = payload?.payload ?? null;
    let jsonSize = 0;
    try {
      jsonSize = JSON.stringify(data ?? null).length;
    } catch {
      return ack({ ok: false, error: "Event payload is not serializable" });
    }
    if (jsonSize > MAX_APP_EVENT_BYTES) {
      return ack({ ok: false, error: "Event payload too large" });
    }

    const envelope: AppEventRow = {
      from: socket.id,
      name: ctx.participant.name,
      device: ctx.participant.device,
      type,
      payload: data,
      at: nowIso(),
    };

    if (payload?.persist === true) {
      ctx.room.appEvents.push(envelope);
      if (ctx.room.appEvents.length > MAX_APP_EVENTS) {
        ctx.room.appEvents.splice(0, ctx.room.appEvents.length - MAX_APP_EVENTS);
      }
      io.to(ctx.code).emit("app:event", envelope); // ALL sockets, incl. sender
      touchRoom(ctx.code);
    } else {
      const to = typeof payload?.to === "string" ? payload.to : "";
      if (to) {
        if (to === socket.id || !ctx.room.participants.has(to)) {
          return ack({ ok: false, error: "Unknown recipient" });
        }
        io.to(to).emit("app:event", envelope);
      } else {
        socket.to(ctx.code).emit("app:event", envelope); // everyone EXCEPT sender
      }
    }
    ack({ ok: true });
  });

  // -- disconnect --------------------------------------------------------------
  socket.on("disconnect", () => {
    removeFromRoom(socket.id);
    console.log(`[relay-service] ${socket.id} disconnected`);
  });
});

// ---------------------------------------------------------------------------
// Housekeeping sweep: delete empty rooms after 2 hours
// ---------------------------------------------------------------------------
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.participants.size === 0 && room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
      rooms.delete(code);
      dirtyRooms.delete(code);
      store.forgetRoom(code).catch((err) =>
        console.error(`[relay-service] failed to forget room ${code}:`, err),
      );
      console.log(`[relay-service] swept empty room ${code}`);
    }
  }
  // Registry rows live 24h max — drop expired ones (memory + store).
  for (const [code, meta] of sessions) {
    if (new Date(meta.expiresAt).getTime() < now) {
      sessions.delete(code);
      closedCodes.delete(code);
      dirtyRooms.delete(code);
      store.forgetSession(code).catch((err) =>
        console.error(`[relay-service] failed to forget session ${code}:`, err),
      );
    }
  }
}, SWEEP_INTERVAL_MS);
(sweepTimer as unknown as { unref?: () => void }).unref?.();

// ---------------------------------------------------------------------------
// Persistence flush loop + boot restore + graceful shutdown
// ---------------------------------------------------------------------------
const flushTimer = setInterval(() => void flushDirtyRooms(), PERSIST_FLUSH_MS);
(flushTimer as unknown as { unref?: () => void }).unref?.();

(async () => {
  try {
    const state = await store.load();
    for (const row of state.sessions) {
      if (!sessions.has(row.code)) sessions.set(row.code, row);
    }
    for (const row of state.closed) closedCodes.add(row.code);
    for (const snap of state.rooms) {
      if (!rooms.has(snap.code)) {
        // Participants are connections, not data — a restored room starts
        // empty (emptySince set) and devices simply rejoin by code.
        rooms.set(snap.code, hydrateRoom(snap) as unknown as Room);
      }
    }
    if (state.sessions.length > 0 || state.rooms.length > 0 || state.closed.length > 0) {
      console.log(
        `[relay-service] restored from ${store.kind}: ${state.sessions.length} sessions, ` +
          `${state.rooms.length} rooms, ${state.closed.length} closed codes`,
      );
    }
  } catch (err) {
    console.error("[relay-service] failed to restore persisted state:", err);
  }
})();

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[relay-service] ${signal} received — flushing durable state before exit`);
  try {
    await flushDirtyRooms();
    await store.flush?.();
  } catch (err) {
    console.error("[relay-service] shutdown flush failed:", err);
  }
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
httpServer.listen(PORT, () => {
  console.log(
    `[relay-service] listening on http://0.0.0.0:${PORT} (socket.io path "${SOCKET_IO_PATH}", ` +
      `control API: /healthz, /api/session, /close/:code, persistence: ${store.kind})`,
  );
});

httpServer.on("error", (err) => {
  console.error("[relay-service] server error:", err);
});

process.on("uncaughtException", (err) => {
  console.error("[relay-service] uncaught exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[relay-service] unhandled rejection:", err);
});
