/**
 * Relay-service watchdog — Node runtime only, sandbox only.
 *
 * Hosts a lightweight watchdog for the relay-service mini service. The relay
 * is an independent Bun process (mini-services/relay-service, port 3003) and
 * the sandbox can reap background processes at any time — the Next server is
 * the most stable process in the container, so it keeps an eye on the relay
 * and respawns it whenever the port goes quiet. Self-healing, no external
 * supervisor required.
 *
 * Lives in its own module, loaded through a runtime-guarded dynamic import in
 * instrumentation.ts: `process.getBuiltinModule` and `process.cwd` are
 * Node-only APIs, and keeping them out of instrumentation.ts means the Edge
 * runtime compile never parses this file (it used to emit four build warnings
 * on Vercel).
 */

export function startRelayWatchdog(): void {
  const net = process.getBuiltinModule('net')
  const childProcess = process.getBuiltinModule('node:child_process')
  const path = process.getBuiltinModule('node:path')
  if (!net || !childProcess || !path) return

  const RELAY_PORT = 3003
  const RELAY_DIR = path.join(process.cwd(), 'mini-services', 'relay-service')
  const CHECK_INTERVAL_MS = 15_000
  const RESTART_COOLDOWN_MS = 10_000

  let restarting = false

  function isRelayUp(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port: RELAY_PORT })
      socket.setTimeout(1500)
      socket.once('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.once('timeout', () => {
        socket.destroy()
        resolve(false)
      })
      socket.once('error', () => {
        socket.destroy()
        resolve(false)
      })
    })
  }

  setInterval(() => {
    void (async () => {
      if (restarting) return
      let up = false
      try {
        up = await isRelayUp()
      } catch {
        up = false
      }
      if (up) return

      restarting = true
      console.warn(
        `[relay-watchdog] relay-service not responding on :${RELAY_PORT} — spawning a fresh instance`,
      )
      try {
        const child = childProcess.spawn('bun', ['index.ts'], {
          cwd: RELAY_DIR,
          detached: true,
          stdio: 'ignore',
          // The relay must bind :3003 no matter what PORT the app host
          // injected into this process (an inherited PORT=3000 made the
          // child fight the Next server for its own port and die on boot).
          env: { ...process.env, SOW_RELAY_WATCHDOG: '1', PORT: String(RELAY_PORT) },
        })
        child.unref()
        child.on('error', (err) => {
          console.error('[relay-watchdog] spawn failed:', err)
        })
        child.on('exit', (code, signal) => {
          console.error(
            `[relay-watchdog] spawned relay exited early: code=${code} signal=${signal}`,
          )
        })
      } catch (err) {
        console.error('[relay-watchdog] spawn threw:', err)
      } finally {
        setTimeout(() => {
          restarting = false
        }, RESTART_COOLDOWN_MS)
      }
    })()
  }, CHECK_INTERVAL_MS)
}
