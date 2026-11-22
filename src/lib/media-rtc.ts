'use client'

// MediaRtc — peer-to-peer camera/microphone calls for ShareOnWeb's media apps
// (Private Call, Group Meeting, Voice Call, Walkie-Talkie, Live Camera…).
//
// Signaling rides the existing session room (RoomClient -> relay-service
// `rtc:signal`), so every media app joins exactly like every other tool: one
// 6-character code. Media itself flows directly between browsers (mesh
// topology — every participant connects to every other participant).
//
// Uses the "perfect negotiation" pattern (same as ScreenRtc) so connections
// survive renegotiation when sharing starts/stops mid-session and any
// participant can join with media at any time without offer glare.

import { IceWatch } from '@/lib/ice-watch'
import type { RoomClient } from '@/lib/room-client'
import type { Participant, RoomSnapshot } from '@/lib/types'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

export type MediaKind = 'av' | 'audio' | 'camera'

/** Payload shapes the relay forwards verbatim inside `rtc:signal`. */
export interface MediaSignalData {
  description?: { type: RTCSdpType; sdp: string }
  candidate?: RTCIceCandidateInit
}

export interface MediaPeerState {
  peerId: string
  state: RTCPeerConnectionState
}

type MediaEvent =
  | 'localstream' // { stream, kind }        — acquired local media
  | 'stream' // { peerId, stream }        — remote media arrived
  | 'streamended' // { peerId }             — a remote stream went away
  | 'peerstate' // { peerId, state }
  | 'peerleft' // { peerId }
  | 'screen' // { active }                — local screen share replaced camera

type Listener = (payload: unknown) => void

interface PeerEntry {
  pc: RTCPeerConnection
  polite: boolean
  makingOffer: boolean
  ignoreOffer: boolean
  settingRemoteAnswerPending: boolean
  iceWatch: IceWatch
  videoSender?: RTCRtpSender
  audioSender?: RTCRtpSender
}

/** RMS level meter for one MediaStream (0..1). Feed with requestAnimationFrame. */
export class LevelMeter {
  private ctx: AudioContext
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private buf: Float32Array | null = null

  constructor(stream: MediaStream) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) throw new Error('Web Audio is not supported in this browser')
    this.ctx = new Ctor()
    this.attach(stream)
  }

  private attach(stream: MediaStream) {
    const track = stream.getAudioTracks()[0]
    if (!track) return
    this.source = this.ctx.createMediaStreamSource(new MediaStream([track]))
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 512
    this.source.connect(this.analyser)
    this.buf = new Float32Array(this.analyser.fftSize)
  }

  /** Swap to a new stream (e.g. mic re-acquired) without rebuilding the context. */
  reattach(stream: MediaStream) {
    try {
      this.source?.disconnect()
    } catch {
      // ignore
    }
    this.source = null
    this.analyser = null
    this.attach(stream)
  }

  /** Current RMS level in 0..1. Returns 0 when no audio is attached. */
  level(): number {
    if (!this.analyser || !this.buf) return 0
    this.analyser.getFloatTimeDomainData(this.buf as Float32Array<ArrayBuffer>)
    let sum = 0
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i]
    const rms = Math.sqrt(sum / this.buf.length)
    // perceptual-ish curve: quiet speech maps well into the bar
    return Math.min(1, rms * 4)
  }

  stop() {
    try {
      this.source?.disconnect()
      void this.ctx.close()
    } catch {
      // ignore
    }
    this.source = null
    this.analyser = null
    this.buf = null
  }
}

export class MediaRtc {
  private client: RoomClient
  private peers = new Map<string, PeerEntry>()
  private listeners = new Map<string, Set<Listener>>()
  private selfId = ''
  private offs: (() => void)[] = []
  private destroyed = false

  localStream: MediaStream | null = null
  localKind: MediaKind | null = null
  facing: 'user' | 'environment' = 'user'
  private screenVideoTrack: MediaStreamTrack | null = null
  private screenStream: MediaStream | null = null

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
        const m = payload as { from: string; data: MediaSignalData }
        void this.handleSignal(m)
      }),
    ]
  }

  // ------------------------------------------------------------- subscription
  on(event: MediaEvent, cb: Listener): () => void {
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

  private emit(event: MediaEvent, payload: unknown) {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(payload)
      } catch (e) {
        console.error('media-rtc listener error', e)
      }
    })
  }

  // ---------------------------------------------------------------- media
  /**
   * Ask for local media and attach it to every peer connection.
   * kind: 'av' = camera+mic, 'audio' = mic only, 'camera' = camera only.
   */
  async start(kind: MediaKind, opts?: { facingMode?: 'user' | 'environment' }): Promise<MediaStream> {
    if (opts?.facingMode) this.facing = opts.facingMode
    const video = kind === 'audio' ? false : { facingMode: this.facing, width: { ideal: 1280 }, height: { ideal: 720 } }
    const audio = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }
    // Stop any previous local stream first (e.g. switching kinds mid-session).
    this.stopLocal()
    const stream = await navigator.mediaDevices.getUserMedia({ video: video as MediaTrackConstraints, audio })
    this.localStream = stream
    this.localKind = kind
    for (const entry of this.peers.values()) this.syncTracks(entry)
    this.emit('localstream', { stream, kind })
    return stream
  }

  /** Stop local media entirely (leave the call surface empty). */
  stopLocal() {
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop()
      this.localStream = null
      this.localKind = null
    }
    for (const entry of this.peers.values()) this.syncTracks(entry)
    this.emit('localstream', { stream: null, kind: null })
  }

  setMicEnabled(on: boolean) {
    const track = this.localStream?.getAudioTracks()[0]
    if (track) track.enabled = on
  }

  isMicEnabled(): boolean {
    const track = this.localStream?.getAudioTracks()[0]
    return track ? track.enabled : false
  }

  setCameraEnabled(on: boolean) {
    const track = this.localStream?.getVideoTracks()[0]
    if (track) track.enabled = on
  }

  isCameraEnabled(): boolean {
    const track = this.localStream?.getVideoTracks()[0]
    return track ? track.enabled : false
  }

  /** Toggle front/back camera on phones (re-acquires with the other lens). */
  async switchCamera(): Promise<void> {
    if (!this.localStream || this.localKind === 'audio') return
    this.facing = this.facing === 'user' ? 'environment' : 'user'
    const old = this.localStream
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: this.facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: old.getAudioTracks().length > 0,
    })
    for (const t of old.getTracks()) t.stop()
    this.localStream = stream
    for (const entry of this.peers.values()) this.syncTracks(entry)
    this.emit('localstream', { stream, kind: this.localKind })
  }

  // ------------------------------------------------------------ screen share
  isScreenActive(): boolean {
    return this.screenVideoTrack != null
  }

  /** Replace the outgoing camera track with the screen on every peer. */
  async startScreenShare(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    const track = stream.getVideoTracks()[0]
    this.screenStream = stream
    this.screenVideoTrack = track
    track.addEventListener('ended', () => void this.stopScreenShare())
    for (const entry of this.peers.values()) this.syncTracks(entry)
    this.emit('screen', { active: true })
    return stream
  }

  async stopScreenShare(): Promise<void> {
    if (this.screenStream) {
      for (const t of this.screenStream.getTracks()) t.stop()
      this.screenStream = null
    }
    this.screenVideoTrack = null
    for (const entry of this.peers.values()) this.syncTracks(entry)
    this.emit('screen', { active: false })
  }

  // ------------------------------------------------------------- peers
  private politeFor(peerId: string): boolean {
    if (!this.selfId) return true
    return this.selfId < peerId
  }

  /** The track that should currently be sent as video (screen wins). */
  private effectiveVideoTrack(): MediaStreamTrack | null {
    if (this.screenVideoTrack) return this.screenVideoTrack
    return this.localStream?.getVideoTracks()[0] ?? null
  }

  private syncTracks(entry: PeerEntry) {
    const pc = entry.pc
    const vTrack = this.effectiveVideoTrack()
    const aTrack = this.localStream?.getAudioTracks()[0] ?? null

    // video
    if (entry.videoSender && entry.videoSender.track !== vTrack) {
      if (vTrack) {
        try {
          void entry.videoSender.replaceTrack(vTrack)
        } catch {
          try {
            pc.removeTrack(entry.videoSender)
          } catch {
            // ignore
          }
          entry.videoSender = undefined
        }
      } else {
        try {
          pc.removeTrack(entry.videoSender)
        } catch {
          // ignore
        }
        entry.videoSender = undefined
      }
    } else if (!entry.videoSender && vTrack) {
      try {
        entry.videoSender = pc.addTrack(vTrack, this.screenStream ?? (this.localStream as MediaStream))
      } catch (e) {
        console.error('media-rtc addTrack(video) failed', e)
      }
    }

    // audio
    if (entry.audioSender && entry.audioSender.track !== aTrack) {
      if (aTrack) {
        try {
          void entry.audioSender.replaceTrack(aTrack)
        } catch {
          try {
            pc.removeTrack(entry.audioSender)
          } catch {
            // ignore
          }
          entry.audioSender = undefined
        }
      } else {
        try {
          pc.removeTrack(entry.audioSender)
        } catch {
          // ignore
        }
        entry.audioSender = undefined
      }
    } else if (!entry.audioSender && aTrack) {
      try {
        entry.audioSender = pc.addTrack(aTrack, this.localStream as MediaStream)
      } catch (e) {
        console.error('media-rtc addTrack(audio) failed', e)
      }
    }
    // onnegotiationneeded fires automatically when tracks were added/removed.
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
      const cleanup = () => {
        const live = stream.getTracks().some((t) => t.readyState === 'live')
        if (!live) {
          this.emit('streamended', { peerId })
        }
      }
      for (const track of stream.getTracks()) {
        track.addEventListener('ended', cleanup)
        track.addEventListener('mute', cleanup)
      }
    }

    pc.onconnectionstatechange = () => {
      this.emit('peerstate', { peerId, state: pc.connectionState } satisfies MediaPeerState)
      // Prolonged `disconnected` and repeated `failed` both get automatic ICE
      // restarts — the tile overlay explains the state to the user meanwhile.
      iceWatch.onStateChange(pc.connectionState)
    }

    // If we already have media, new peers get the tracks at once.
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
  private async handleSignal(msg: { from: string; data: MediaSignalData }) {
    const from = msg?.from
    const data = msg?.data
    if (!from || from === this.selfId || !data) return
    if (this.destroyed) return

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
    if (this.screenStream) {
      for (const track of this.screenStream.getTracks()) track.stop()
      this.screenStream = null
      this.screenVideoTrack = null
    }
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop()
      this.localStream = null
    }
  }
}
