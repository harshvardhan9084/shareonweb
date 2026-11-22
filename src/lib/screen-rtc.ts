'use client'

// ScreenRtc — peer-to-peer media connections for the Screen Sharing app.
//
// Signaling rides the existing session room (RoomClient -> relay-service
// `rtc:signal`), so joining works exactly like every other tool: one 6-character
// code. Media itself flows directly between browsers.
//
// Uses the "perfect negotiation" pattern so any participant can become a
// presenter at any time without offer glare, and connections survive
// renegotiation when sharing starts/stops mid-session.

import { IceWatch } from '@/lib/ice-watch'
import type { RoomClient } from '@/lib/room-client'
import type { Participant, RoomSnapshot } from '@/lib/types'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

/** Payload shapes the relay forwards verbatim inside `rtc:signal`. */
export interface RtcSignalData {
  description?: { type: RTCSdpType; sdp: string }
  candidate?: RTCIceCandidateInit
  sharing?: { active: boolean }
}

export interface ScreenPeerState {
  peerId: string
  state: RTCPeerConnectionState
}

type Listener = (payload: unknown) => void

interface PeerEntry {
  pc: RTCPeerConnection
  polite: boolean
  makingOffer: boolean
  ignoreOffer: boolean
  settingRemoteAnswerPending: boolean
  iceWatch: IceWatch
}

export class ScreenRtc {
  private client: RoomClient
  private peers = new Map<string, PeerEntry>()
  private listeners = new Map<string, Set<Listener>>()
  private selfId = ''
  private localStream: MediaStream | null = null
  private offs: (() => void)[] = []
  private destroyed = false

  constructor(client: RoomClient) {
    this.client = client
    this.offs = [
      client.on('state', (payload) => {
        const snap = payload as RoomSnapshot
        this.selfId = snap.selfId
        this.reconcile(snap.participants)
      }),
      client.on('presence', (payload) => {
        const p = payload as { participants: Participant[] }
        this.reconcile(p.participants)
      }),
      client.on('rtcsignal', (payload) => {
        const m = payload as { from: string; data: RtcSignalData }
        void this.handleSignal(m)
      }),
    ]
  }

  // ------------------------------------------------------------- subscription
  on(event: 'stream' | 'streamended' | 'peerstate' | 'peerleft' | 'sharingflag', cb: Listener): () => void {
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

  private emit(
    event: 'stream' | 'streamended' | 'peerstate' | 'peerleft' | 'sharingflag',
    payload: unknown,
  ) {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(payload)
      } catch (e) {
        console.error('screen-rtc listener error', e)
      }
    })
  }

  // ---------------------------------------------------------------- media
  /** Presenter side: attach (or detach) the local share on every connection. */
  setLocalStream(stream: MediaStream | null) {
    this.localStream = stream
    for (const entry of this.peers.values()) this.syncTracks(entry)
  }

  /** Broadcast a simple flag (e.g. sharing stopped) to the whole room. */
  broadcast(data: RtcSignalData) {
    void this.client.sendSignal(data).catch(() => undefined)
  }

  private syncTracks(entry: PeerEntry) {
    const pc = entry.pc
    const senders = pc.getSenders()
    const localTracks = this.localStream ? this.localStream.getTracks() : []

    for (const sender of senders) {
      if (sender.track && !localTracks.some((t) => t === sender.track)) {
        try {
          pc.removeTrack(sender)
        } catch {
          // already gone
        }
      }
    }
    for (const track of localTracks) {
      if (!senders.some((s) => s.track === track)) {
        try {
          pc.addTrack(track, this.localStream as MediaStream)
        } catch (e) {
          console.error('screen-rtc addTrack failed', e)
        }
      }
    }
    // onnegotiationneeded fires automatically when tracks were added/removed.
  }

  // ------------------------------------------------------------- peers
  private politeFor(peerId: string): boolean {
    if (!this.selfId) return true
    return this.selfId < peerId
  }

  private createPeer(peerId: string): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const iceWatch = new IceWatch(pc)
    const entry: PeerEntry = {
      pc,
      polite: this.politeFor(peerId),
      makingOffer: false,
      ignoreOffer: false,
      settingRemoteAnswerPending: false,
      iceWatch,
    }
    this.peers.set(peerId, entry)

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && !this.destroyed) {
        void this.client
          .sendSignal({ candidate: candidate.toJSON() }, peerId)
          .catch(() => undefined)
      }
    }

    pc.onnegotiationneeded = () => {
      void (async () => {
        try {
          entry.makingOffer = true
          await pc.setLocalDescription()
          if (pc.localDescription && !this.destroyed) {
            await this.client.sendSignal(
              { description: pc.localDescription.toJSON() },
              peerId,
            )
          }
        } catch {
          // renegotiation can race a disconnect — the next ICE round recovers
        } finally {
          entry.makingOffer = false
        }
      })()
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (!stream) return
      this.emit('stream', { peerId, stream })

      const video = stream.getVideoTracks()[0]
      const handleEnd = () => {
        // Keep only streams that still have a live video track.
        if (!stream.getVideoTracks().some((t) => t.readyState === 'live')) {
          this.emit('streamended', { peerId, streamId: stream.id })
        }
      }
      video?.addEventListener('ended', handleEnd)
      video?.addEventListener('muted', handleEnd)
    }

    pc.onconnectionstatechange = () => {
      this.emit('peerstate', { peerId, state: pc.connectionState } satisfies ScreenPeerState)
      // Prolonged `disconnected` and repeated `failed` both get automatic ICE
      // restarts — viewers see the reconnecting overlay meanwhile.
      iceWatch.onStateChange(pc.connectionState)
    }

    // If the presenter is already sharing, new peers get the tracks at once.
    this.syncTracks(entry)
    return entry
  }

  private closePeer(peerId: string) {
    const entry = this.peers.get(peerId)
    if (!entry) return
    entry.iceWatch.close()
    try {
      entry.pc.onicecandidate = null
      entry.pc.ontrack = null
      entry.pc.onnegotiationneeded = null
      entry.pc.onconnectionstatechange = null
      entry.pc.close()
    } catch {
      // ignore
    }
    this.peers.delete(peerId)
    this.emit('peerleft', { peerId })
  }

  /** Match the peer set to the live participant list (handles joins AND leaves). */
  private reconcile(participants: Participant[]) {
    if (this.destroyed) return
    const ids = new Set(participants.map((p) => p.id))
    for (const id of [...this.peers.keys()]) {
      if (!ids.has(id)) this.closePeer(id)
    }
    for (const p of participants) {
      if (p.id !== this.selfId && !this.peers.has(p.id)) this.createPeer(p.id)
    }
  }

  // ------------------------------------------------------------- signaling
  private async handleSignal(msg: { from: string; data: RtcSignalData }) {
    const from = msg?.from
    const data = msg?.data
    if (!from || from === this.selfId || !data) return
    if (this.destroyed) return

    // Simple room-wide flags skip the peer connections entirely.
    if (data.sharing) {
      this.emit('sharingflag', { peerId: from, active: data.sharing.active })
      return
    }

    let entry = this.peers.get(from)
    if (!entry) entry = this.createPeer(from)
    const pc = entry.pc

    try {
      if (data.description) {
        const offerCollision =
          data.description.type === 'offer' &&
          (entry.makingOffer || pc.signalingState !== 'stable')
        entry.ignoreOffer = !entry.polite && offerCollision
        if (entry.ignoreOffer) return

        entry.settingRemoteAnswerPending = data.description.type === 'answer'
        await pc.setRemoteDescription(data.description)
        entry.settingRemoteAnswerPending = false

        if (data.description.type === 'offer') {
          await pc.setLocalDescription()
          if (pc.localDescription && !this.destroyed) {
            await this.client.sendSignal(
              { description: pc.localDescription.toJSON() },
              from,
            )
          }
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate)
        } catch (err) {
          if (!entry.ignoreOffer) throw err
        }
      }
    } catch {
      // malformed/racing signal — ICE restart or reconciliation recovers
    }
  }

  destroy() {
    this.destroyed = true
    for (const off of this.offs) off()
    this.offs = []
    for (const id of [...this.peers.keys()]) this.closePeer(id)
    this.listeners.clear()
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop()
    }
    this.localStream = null
  }
}
