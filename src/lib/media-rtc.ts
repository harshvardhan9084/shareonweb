'use client'

// MediaRtc — peer-to-peer camera/microphone calls for Kontivo's media apps
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

/**
 * Microphone processing profile. Browsers ship echo cancellation, noise
 * suppression and auto gain as track constraints, so the profile is applied
 * live (applyConstraints) without re-opening the device.
 *  - auto  — the browser's defaults, best for voice/video calls
 *  - voice — forced single-channel processing for flaky networks
 *  - music — processing OFF, stereo when the device offers it: instruments
 *            and singing survive, at the cost of possible echo feedback
 */
export type AudioProfile = 'auto' | 'voice' | 'music'

export const AUDIO_PROFILES: Array<{ id: AudioProfile; label: string; blurb: string }> = [
  { id: 'auto', label: 'Auto', blurb: 'Browser defaults — balanced for talking' },
  { id: 'voice', label: 'Voice', blurb: 'Echo + noise cancellation forced on, mono' },
  { id: 'music', label: 'Music', blurb: 'Processing off, stereo when possible — instruments, singing' },
]

function audioConstraintsFor(profile: AudioProfile): MediaTrackConstraints {
  switch (profile) {
    case 'voice':
      return {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: { ideal: 48000 },
      }
    case 'music':
      return {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2 },
        sampleRate: { ideal: 48000 },
      }
    default:
      return {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
  }
}

/** Worst-case connection quality across all live peer connections. */
export interface ConnQuality {
  /** Max measured round-trip time in ms (null — no peer reported one yet). */
  rttMs: number | null
  /** Packet loss percentage, 0..100 (null — nothing received yet). */
  lossPct: number | null
  /** Max RTP jitter in ms. */
  jitterMs: number | null
  /** Inbound bitrate in kbps since the previous poll (null on first poll). */
  kbpsIn: number | null
  /** How many peer connections were sampled. */
  peers: number
  grade: 'good' | 'fair' | 'poor' | 'unknown'
}

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
  private audioProfile: AudioProfile = 'auto'
  // Bitrate history for connectionStats(): bytes seen on the last poll.
  private statsHistory = new Map<string, { bytes: number; at: number }>()
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
    const audio = audioConstraintsFor(this.audioProfile)
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

  // ------------------------------------------------------- audio quality
  getAudioProfile(): AudioProfile {
    return this.audioProfile
  }

  /**
   * Switch the microphone processing profile. Applies immediately to a live
   * track via applyConstraints; when the browser rejects a constraint the
   * error is surfaced to the caller (the UI explains it) and the profile is
   * still remembered for the next start().
   */
  async setAudioProfile(profile: AudioProfile): Promise<void> {
    this.audioProfile = profile
    const track = this.localStream?.getAudioTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints(audioConstraintsFor(profile))
    } catch (err) {
      const settings = track.getSettings()
      const applied = ['echoCancellation', 'noiseSuppression', 'autoGainControl']
        .filter((k) => settings[k as keyof MediaTrackSettings] !== undefined)
        .map((k) => `${k}=${settings[k as keyof MediaTrackSettings]}`)
        .join(', ')
      throw new Error(
        `This device kept its current processing (${applied || 'browser defaults'}). The profile applies fully on the next call.`,
        { cause: err },
      )
    }
  }

  /**
   * Worst-case connection quality across live peers, from getStats():
   * round-trip time, packet loss, jitter and inbound bitrate (delta of
   * received bytes between polls). Returns grade 'unknown' when no peer
   * connection is live or the stats have not arrived yet.
   */
  async connectionStats(): Promise<ConnQuality> {
    let rtt: number | null = null
    let lossPct: number | null = null
    let jitter: number | null = null
    let kbpsIn: number | null = null
    let sampled = 0

    const now = Date.now()
    const nextHistory = new Map<string, { bytes: number; at: number }>()
    let bytesDelta = 0
    let msDelta = 0

    for (const [peerId, entry] of this.peers) {
      if (entry.pc.connectionState !== 'connected') continue
      let stats: RTCStatsReport
      try {
        stats = await entry.pc.getStats()
      } catch {
        continue
      }
      sampled += 1
      let inBytes = 0
      for (const report of stats.values()) {
        const r = report as Record<string, unknown> & { type: string; kind?: string }
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && typeof r.currentRoundTripTime === 'number') {
          const ms = r.currentRoundTripTime * 1000
          if (rtt == null || ms > rtt) rtt = ms
        }
        if (r.type === 'inbound-rtp' && !r.isRemote) {
          if (typeof r.jitter === 'number') {
            const j = r.jitter * 1000
            if (jitter == null || j > jitter) jitter = j
          }
          const recv = typeof r.packetsReceived === 'number' ? r.packetsReceived : 0
          const lost = typeof r.packetsLost === 'number' ? r.packetsLost : 0
          if (recv + lost > 0) {
            const pct = (lost / (recv + lost)) * 100
            if (lossPct == null || pct > lossPct) lossPct = pct
          }
          if (typeof r.bytesReceived === 'number') inBytes += r.bytesReceived
        }
      }
      const prev = this.statsHistory.get(peerId)
      if (prev && inBytes >= prev.bytes) {
        bytesDelta += inBytes - prev.bytes
        msDelta += Math.max(1, now - prev.at)
      }
      nextHistory.set(peerId, { bytes: inBytes, at: now })
    }
    // Drop history for peers that disappeared between polls.
    this.statsHistory = nextHistory

    if (bytesDelta > 0 && msDelta > 0) kbpsIn = Math.round((bytesDelta * 8) / msDelta) // bytes*8/ms == kbit/s

    let grade: ConnQuality['grade'] = 'unknown'
    if (sampled > 0 && rtt != null) {
      if ((lossPct ?? 0) < 2 && rtt < 150) grade = 'good'
      else if ((lossPct ?? 0) > 8 || rtt > 400) grade = 'poor'
      else grade = 'fair'
    }
    return { rttMs: rtt, lossPct, jitterMs: jitter, kbpsIn, peers: sampled, grade }
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
    this.statsHistory.clear()
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
