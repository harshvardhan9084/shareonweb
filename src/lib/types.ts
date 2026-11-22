// Shared types used by both the Next.js app and (mirrored) by the relay service.

export type DeviceType = 'phone' | 'tablet' | 'desktop'

export interface SessionInfo {
  id: string
  code: string // raw 6-character code, e.g. "K7T29Q"
  appId: string
  title: string | null
  createdAt: string // ISO
  expiresAt: string // ISO
  closed: boolean
}

export interface Participant {
  id: string
  name: string
  device: DeviceType
  joinedAt: string
}

export interface TextItem {
  id: string
  content: string
  from: string
  device: string
  at: string
}

export type ChatMsg = TextItem

export interface FileMeta {
  fileId: string
  name: string
  /** Relative path inside the sender's folder (Folder Share only). */
  relPath?: string
  /** Logical bucket (e.g. "presentation") — lets panels filter files by purpose. */
  slot?: string
  /** Stable per-tab sender id — clients compare with their own to mark "mine". */
  ownerId?: string
  size: number
  type: string
  chunkCount: number
  complete: boolean
  from: string
  device: string
  at: string
  /** Only present in room-state snapshots (full history for late joiners). */
  chunks?: (string | null)[]
}

export interface Stroke {
  strokeId: string
  ownerId: string
  color: string
  size: number
  mode: 'draw' | 'erase'
  points: number[][] // [[x, y], ...] normalized 0..1
}

export interface Poll {
  id: string
  question: string
  options: { text: string; votes: number }[]
  createdAt: string
}

/** One shared plain-text note per room (the Notepad app). */
export interface NoteDoc {
  content: string
  rev: number
  updatedBy: string
  updatedAt: string
}

/**
 * Generic app-level event (hand raise, reactions, slide changes, captions,
 * location pings…). Persisted events ride the room snapshot so late joiners
 * can rebuild state; volatile events are live-only.
 */
export interface AppEvent {
  from: string
  name: string
  device: string
  type: string
  payload: unknown
  at: string
}

export interface RoomSnapshot {
  code: string
  createdAt: string
  selfId: string
  participants: Participant[]
  texts: TextItem[]
  chat: ChatMsg[]
  polls: Poll[]
  strokes: Stroke[]
  files: FileMeta[]
  doc: NoteDoc | null
  appEvents: AppEvent[]
}
