# relay-service

Signaling + room-state relay for Kontivo's live session tools. Plain
node:http server + socket.io (Bun runtime), one port.

- **socket.io path `/`** — all device traffic: join, texts, chat, file
  chunks, whiteboard, polls, shared note, WebRTC signaling envelopes,
  app events.
- **Control API on the same port** — session registry + liveness:
  - `GET /healthz` (or `/health`) — liveness probe for hosting platforms
  - `POST /api/session` — register a join code (header `x-relay-key`)
  - `GET /api/session/:code` — resolve a code (public; metadata only)
  - `PATCH /api/session/:code` — rename (header `x-relay-key`)
  - `POST /close/:code` — end session + room (header `x-relay-key`)

The Next.js API routes (`src/app/api/sessions/*`) proxy to the control API
when `RELAY_URL` is set, so in a hosted deployment the registry lives here —
with the one long-running process.

## Rooms vs sessions (the two numbers in `/healthz`)

```json
{"ok":true,"uptime":1332.13,"rooms":1,"sessions":2,"store":"memory"}
```

- **`sessions`** — the *registry*: join codes that exist and can be
  resolved/opened. One row per "Start" tap (code, app, title, expiry).
  A registry row does NOT mean anyone is connected.
- **`rooms`** — *live rooms*: actual shared content (participants, texts,
  chat, file buffers, strokes, polls, note). A room is created the first
  time a device joins a code and swept after 2 hours empty.

`rooms:1, sessions:2` therefore reads: two codes exist, one is currently in
use. Uptime resets whenever this process restarts — see below.

## Persistence — making sessions survive restarts (24 h)

Everything used to live only in RAM. Every process restart — deploy, crash,
or a hosting platform's idle spin-down (Render free tier: 15 minutes) —
wiped the registry and all rooms, and every existing code became
unconnectable until its users gave up. The persistence layer fixes that:
the registry is written through on create/close/rename, and room content is
snapshotted on a short debounce after every content mutation. On boot the
relay restores everything that has not expired. Codes stay joinable and
room history comes back for the full 24-hour session lifetime.

### Backend selection (checked in order)

| Backend | When | Survives |
| --- | --- | --- |
| `redis` | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set | restarts, redeploys, spin-downs — best option on Render **free** tier |
| `disk` | `RELAY_DATA_DIR` set | restarts + redeploys on hosts with a **persistent disk/volume** (Render paid disks, Railway/Fly volumes, any VPS) |
| `memory` | nothing set (default) | nothing — same as before the layer existed |

The `disk` backend writes one JSON snapshot file atomically (tmp + rename)
into `RELAY_DATA_DIR`; it does NOT help on hosts with an ephemeral disk.

### Deploying on Render with Docker (this folder's Dockerfile)

The repo ships `mini-services/relay-service/Dockerfile` (plus
`.dockerignore`): oven/bun base, production-only dependency install, a
`/healthz` HEALTHCHECK, and a pre-created `/data` mount point for the disk
backend. On Render: create the service from this repo with **Runtime:
Docker** and **Root Directory: `mini-services/relay-service`** — Render
picks the Dockerfile up automatically, injects `PORT`, and uses your health
check path (`/healthz`). Add the env vars below in the dashboard; for the
redis backend no disk is needed, for the disk backend mount a Render Disk
at `/data` and set `RELAY_DATA_DIR=/data`.

> The image runs as root so a freshly mounted Render Disk is writable out
> of the box. If you harden it to a non-root user, `chown` the mount path
> first or the disk backend cannot write its snapshot.

**Free tier (recommended setup):** Render's free instances have an ephemeral
disk and spin down after 15 minutes idle, so point the relay at a free
[Upstash](https://upstash.com) Redis (REST API, no client dependency here):

1. Create an Upstash Redis (any region close to your Render region).
2. On the Render service set environment variables:
   - `UPSTASH_REDIS_REST_URL` = the REST URL Upstash shows in its console
   - `UPSTASH_REDIS_REST_TOKEN` = the REST token
   - `RELAY_KEY` = any long random string
   - (`PORT` is provided by Render automatically)
3. Set the Next.js app's `RELAY_URL` to this service's public URL and the
   same `RELAY_KEY`.

Notes for the free tier: after a spin-down the first request pays a ~30–60 s
cold start (a joining device retries and gets in); an external uptime pinger
hitting `/healthz` every few minutes prevents spin-downs entirely.

**Paid tier with a persistent disk:** mount a Render Disk (e.g. at `/data`)
and set `RELAY_DATA_DIR=/data`. The snapshot file is written atomically
(tmp + rename) and flushed on SIGTERM, so restarts and redeploys keep state.

### What persists — and what deliberately does not

Persisted for 24 h (bounded by the session's own expiry):

- the session registry (codes + metadata) and closed-code markers
- room content: texts, chat, whiteboard strokes, polls, the shared note,
  persisted app events
- **completed files up to `RELAY_PERSIST_FILE_MAX` bytes each** (default
  20 MB, including their base64 chunks)

Not persisted (by design):

- live participants — they are socket connections; a restored room starts
  empty and devices simply rejoin by code
- in-flight file transfers and files above the 20 MB persistence cap —
  they are relay-side buffers for room history; the sender re-shares after
  a restart (the 50 MB live transfer cap is unchanged)
- WebRTC media (calls, screen share) — peer-to-peer, dies with the
  connection regardless of persistence

Oversized room snapshots shed content in a fixed priority order (files
first, then app events, then strokes) so the small conversational state
always survives. Nothing outlives its session's 24-hour expiry in any
backend; expired rows are pruned on load and by the 10-minute sweep.

### Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3003` | listen port (hosting platforms set it) |
| `RELAY_KEY` | dev default | shared secret for control endpoints — **set it in production** |
| `UPSTASH_REDIS_REST_URL` | — | enables the redis backend |
| `UPSTASH_REDIS_REST_TOKEN` | — | redis auth token |
| `RELAY_DATA_DIR` | — | enables the disk backend (snapshot file inside) |
| `RELAY_PERSIST_FILE_MAX` | `20971520` | per-file persistence cap (bytes) |
| `RELAY_PERSIST_SNAPSHOT_MAX` | `50331648` | per-room snapshot cap (bytes) |
| `RELAY_PERSIST_INTERVAL_MS` | `4000` | dirty-room flush debounce |

### Capacity limits (unchanged)

50 MB per file, 80 MB per room of file buffers, 2048 chunks/file,
4000 strokes, 5000 sessions, 100k chars per text, 200 chat messages,
400 persisted app events. WebSocket buffer 5 MB; ping interval 25 s,
ping timeout 60 s.
