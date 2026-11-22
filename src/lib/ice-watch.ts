'use client'

// ICE resilience watchdog — shared by MediaRtc (calls) and ScreenRtc (screens).
//
// Browsers report `disconnected` when the media path hiccups (Wi-Fi switch,
// laptop lid, NAT rebind). Left alone, a `disconnected` peer often sits frozen
// forever: the user sees a still frame with no explanation. And after a hard
// `failed`, one restartIce() attempt is not always enough.
//
// This helper watches each RTCPeerConnection and:
//   - restarts ICE when `disconnected` persists longer than DISCONNECT_GRACE_MS
//   - retries the restart twice more (with backoff) while the peer stays `failed`
//   - cleans up all timers on `connected` or `close()`
//
// Restarting ICE re-runs negotiation through the existing signaling channel, so
// it works without any extra relay protocol.

const DISCONNECT_GRACE_MS = 4000
const RETRY_DELAYS_MS = [2500, 6000] as const

export class IceWatch {
  private pc: RTCPeerConnection
  private graceTimer: ReturnType<typeof setTimeout> | null = null
  private retryTimers: ReturnType<typeof setTimeout>[] = []
  private restartsUsed = 0
  private closed = false

  constructor(pc: RTCPeerConnection) {
    this.pc = pc
  }

  /** Feed every `connectionstatechange` into here. Cheap — call unconditionally. */
  onStateChange(state: RTCPeerConnectionState) {
    if (this.closed) return
    if (state === 'connected') {
      this.clearAll()
      return
    }
    if (state === 'disconnected') {
      if (this.graceTimer || this.retryTimers.length > 0) return
      this.graceTimer = setTimeout(() => {
        this.graceTimer = null
        this.restart('stayed disconnected too long')
      }, DISCONNECT_GRACE_MS)
      return
    }
    if (state === 'failed') {
      this.clearGrace()
      this.restart('failed')
      // One failed → restartIce usually fixes it. If it degrades again, retry
      // with backoff before giving up (reconciliation rebuilds eventually).
      for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
        const delay = RETRY_DELAYS_MS[i]
        const t = setTimeout(() => {
          this.retryTimers = this.retryTimers.filter((x) => x !== t)
          if (this.closed) return
          if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'disconnected') {
            this.restart(`still ${this.pc.connectionState} after retry ${i + 1}`)
          }
        }, delay)
        this.retryTimers.push(t)
      }
    }
  }

  private restart(reason: string) {
    if (this.closed) return
    this.restartsUsed += 1
    try {
      this.pc.restartIce()
    } catch {
      // not restartable — presence reconciliation will rebuild the peer
      return
    }
    // restartIce() only marks ICE as needing restart; the next negotiation
    // needed event carries it. If the pc never fires negotiation (edge case
    // when signaling is broken), there is nothing more we can do here.
    if (typeof console !== 'undefined') {
      console.debug(`ice-watch: restart #${this.restartsUsed} (${reason})`)
    }
  }

  private clearGrace() {
    if (this.graceTimer) {
      clearTimeout(this.graceTimer)
      this.graceTimer = null
    }
  }

  private clearAll() {
    this.clearGrace()
    for (const t of this.retryTimers) clearTimeout(t)
    this.retryTimers = []
  }

  close() {
    this.closed = true
    this.clearAll()
  }
}
