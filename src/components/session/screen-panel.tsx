'use client'

// Screen Sharing workspace.
//
// Presenter: one click starts the browser's screen picker; the chosen surface
// streams directly to every other device in the session (WebRTC, no server in
// the media path). Viewer: streams appear as they arrive, with fullscreen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RoomClient } from '@/lib/room-client'
import { ScreenRtc } from '@/lib/screen-rtc'
import type { Participant } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  CircleAlert,
  CircleCheck,
  Loader2,
  Maximize2,
  MonitorUp,
  Square,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'

interface ScreenPanelProps {
  client: RoomClient | null
  selfId: string
  participants: Participant[]
  connected: boolean
}

interface RemoteStream {
  peerId: string
  stream: MediaStream
}

function humanizeMediaError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError')
    return 'Screen sharing was cancelled or blocked. Pick a screen or tab in your browser\u2019s share picker, or allow it via the icon in the address bar and try again.'
  if (name === 'NotFoundError') return 'There is nothing available to share on this device.'
  if (name === 'NotReadableError')
    return 'Your screen cannot be captured right now. Another app (often protected video) is blocking it.'
  if (err instanceof Error && err.message) return err.message
  return 'Could not start screen sharing, please try again.'
}

export function ScreenPanel({ client, selfId, participants, connected }: ScreenPanelProps) {
  const rtcRef = useRef<ScreenRtc | null>(null)
  const [ready, setReady] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([])
  const [peerStates, setPeerStates] = useState<Map<string, RTCPeerConnectionState>>(new Map())
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)

  // ------------------------------------------------------------ rtc lifecycle
  useEffect(() => {
    if (!client) return
    const rtc = new ScreenRtc(client)
    rtcRef.current = rtc
    setReady(true)

    const offs = [
      rtc.on('stream', (payload) => {
        const { peerId, stream } = payload as { peerId: string; stream: MediaStream }
        setRemoteStreams((prev) =>
          prev.some((s) => s.stream.id === stream.id)
            ? prev
            : [...prev.filter((s) => s.peerId !== peerId), { peerId, stream }],
        )
        toast.success('A screen share just went live.')
      }),
      rtc.on('streamended', (payload) => {
        const { streamId } = payload as { peerId: string; streamId: string }
        setRemoteStreams((prev) => prev.filter((s) => s.stream.id !== streamId))
      }),
      rtc.on('peerleft', (payload) => {
        const { peerId } = payload as { peerId: string }
        setRemoteStreams((prev) => prev.filter((s) => s.peerId !== peerId))
        setPeerStates((prev) => {
          const next = new Map(prev)
          next.delete(peerId)
          return next
        })
      }),
      rtc.on('peerstate', (payload) => {
        const { peerId, state } = payload as { peerId: string; state: RTCPeerConnectionState }
        setPeerStates((prev) => {
          const next = new Map(prev)
          next.set(peerId, state)
          return next
        })
      }),
    ]

    return () => {
      offs.forEach((off) => off())
      rtc.destroy()
      rtcRef.current = null
      setReady(false)
    }
  }, [client])

  // Attach the local preview.
  useEffect(() => {
    const video = localVideoRef.current
    if (video && localStream) {
      video.srcObject = localStream
      video.play().catch(() => undefined)
    }
  }, [localStream])

  const nameFor = useCallback(
    (peerId: string) => participants.find((p) => p.id === peerId)?.name ?? 'Someone',
    [participants],
  )

  // ---------------------------------------------------------------- presenter
  const stopSharing = useCallback(async () => {
    const rtc = rtcRef.current
    if (!rtc) return
    const stream = localStream
    setLocalStream(null)
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
    }
    rtc.setLocalStream(null)
    rtc.broadcast({ sharing: { active: false } })
  }, [localStream])

  const startSharing = useCallback(async () => {
    const rtc = rtcRef.current
    if (!rtc || !connected) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      setError('This browser or connection cannot share a screen; a secure (https) window is required.')
      return
    }
    setStarting(true)
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: true,
      })
      // The browser fires 'ended' when the user presses its native "Stop sharing".
      stream.getVideoTracks()[0]?.addEventListener('ended', () => void stopSharing())
      rtc.setLocalStream(stream)
      rtc.broadcast({ sharing: { active: true } })
      setLocalStream(stream)
    } catch (err) {
      setError(humanizeMediaError(err))
    } finally {
      setStarting(false)
    }
  }, [connected, stopSharing])

  const viewers = useMemo(
    () => participants.filter((p) => p.id !== selfId),
    [participants, selfId],
  )

  // ------------------------------------------------------------------ render
  if (!ready) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Preparing the connection…
        </CardContent>
      </Card>
    )
  }

  const isPresenter = Boolean(localStream)

  return (
    <div className="space-y-4">
      {!connected && (
        <Card>
          <CardContent className="flex items-center gap-2.5 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            Establishing the live connection. The share controls appear the moment it is up.
          </CardContent>
        </Card>
      )}

      {connected && !isPresenter && remoteStreams.length === 0 && (
        <Card>
          <CardContent className="p-5">
            {/* Presenter action — the do-it surface, always first */}
            <Button
              size="lg"
              className="h-13 w-full text-base sm:w-auto sm:min-w-72"
              onClick={startSharing}
              disabled={starting}
            >
              {starting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Waiting for your
                  pick…
                </>
              ) : (
                <>
                  <MonitorUp className="size-5" aria-hidden="true" /> Share my screen
                </>
              )}
            </Button>
            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
              Your browser asks which screen, window or tab to share. Nothing is shared before
              you pick. Optional system audio comes through too.
            </p>

            {error && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col items-center border-t pt-6 text-center">
              <p className="text-sm font-medium">
                {viewers.length === 0
                  ? 'Waiting for another device to join'
                  : 'Nobody is sharing yet'}
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                {viewers.length === 0
                  ? 'Scan the QR or type the code on the other device; it appears here the second it joins.'
                  : `Open this session on the other device, or press “Share my screen” here, and the live view appears instantly for ${viewers.length === 1 ? nameFor(viewers[0].id) : 'everyone'}.`}
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Users className="size-3.5" aria-hidden="true" />
                {viewers.length === 0
                  ? 'You are the first device in this session'
                  : `${viewers.length} other device${viewers.length === 1 ? '' : 's'} connected`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* presenter preview */}
      {isPresenter && localStream && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge className="gap-1 border-0 bg-primary/15 text-primary hover:bg-primary/15">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-2 animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                Live
              </Badge>
              <p className="text-sm font-semibold">You are sharing</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wifi className="size-3.5" aria-hidden="true" />
                {viewers.length} device{viewers.length === 1 ? '' : 's'} watching
              </p>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-9 gap-1.5 text-destructive hover:text-destructive"
                onClick={() => void stopSharing()}
              >
                <Square className="size-3.5" aria-hidden="true" /> Stop sharing
              </Button>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border bg-black">
              <video
                ref={localVideoRef}
                muted
                autoPlay
                playsInline
                className="aspect-video w-full"
                aria-label="Your shared screen preview"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The stream ends when you stop it, close the tab, or when the session ends. Viewers
              see the share in real time; nothing is recorded.
            </p>
          </CardContent>
        </Card>
      )}

      {/* remote streams */}
      {remoteStreams.map(({ peerId, stream }) => {
        const st = peerStates.get(peerId)
        const dropped = st === 'disconnected' || st === 'failed' || st === 'closed'
        return (
          <RemoteVideo
            key={stream.id}
            stream={stream}
            label={nameFor(peerId)}
            dropped={dropped}
          />
        )
      })}
    </div>
  )
}

function RemoteVideo({
  stream,
  label,
  dropped,
}: {
  stream: MediaStream
  label: string
  dropped: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.srcObject = stream
      video.play().catch(() => undefined)
    }
  }, [stream])

  function fullscreen() {
    videoRef.current?.requestFullscreen?.().catch(() => undefined)
  }

  const hasAudio = stream.getAudioTracks().length > 0

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {dropped ? (
            <Badge className="gap-1 border-0 bg-warning/15 text-warning hover:bg-warning/15">
              <WifiOff className="size-3 animate-pulse" aria-hidden="true" /> Reconnecting…
            </Badge>
          ) : (
            <Badge className="gap-1 border-0 bg-primary/15 text-primary hover:bg-primary/15">
              <CircleCheck className="size-3" aria-hidden="true" /> Live
            </Badge>
          )}
          <p className="text-sm font-semibold">{label}&rsquo;s screen</p>
          {hasAudio && (
            <span className="text-xs text-muted-foreground">with sound</span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-9 gap-1.5"
            onClick={fullscreen}
          >
            <Maximize2 className="size-3.5" aria-hidden="true" /> Fullscreen
          </Button>
        </div>
        <div className="relative mt-3 overflow-hidden rounded-xl border bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-video w-full"
            aria-label={`Live screen shared by ${label}`}
          />
          {dropped && (
            <div
              role="status"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stage/70 text-center backdrop-blur-[3px]"
            >
              <span className="flex size-11 items-center justify-center rounded-full border border-warning/40 bg-warning/15 text-warning">
                <WifiOff className="size-5 animate-pulse" aria-hidden="true" />
              </span>
              <p className="px-4 text-sm font-semibold text-warning">
                The link to {label} dropped. Bringing the screen back…
              </p>
              <p className="max-w-xs px-4 text-xs leading-snug text-stage-muted">
                The connection re-establishes itself automatically; this overlay
                clears the moment the picture returns.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
