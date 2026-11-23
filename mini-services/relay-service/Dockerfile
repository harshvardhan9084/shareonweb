# Production image for the Kontivo relay service.
#
# Render setup: Runtime "Docker", Root Directory "mini-services/relay-service"
# — Render finds this Dockerfile automatically. All configuration is via
# environment variables (PORT, RELAY_KEY, UPSTASH_REDIS_REST_URL +
# UPSTASH_REDIS_REST_TOKEN or RELAY_DATA_DIR, RELAY_PERSIST_*): see
# README.md in this folder.
#
# Runs plain bun (no --hot reload) — that is a dev-only flag.

FROM oven/bun:1

WORKDIR /app

# Install production dependencies first so Docker layer caching skips the
# install whenever only the source changes.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY index.ts store.ts ./

# Optional runtime dir for the disk persistence backend — set
# RELAY_DATA_DIR=/data and mount a Render Disk here.
RUN mkdir -p /data

EXPOSE 3003

# Platforms probe /healthz themselves; this also catches a wedged process
# when running outside a managed host.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3003)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "index.ts"]
