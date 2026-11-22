'use client'

// Family panels: one session, every mode of the tool.
//
// The user's law: if modes live on one page, they must live in one session —
// a single code covers text, files and folders; a single call code covers
// every room shape. The session's stored appId (the variant it was started
// from, or the tool id) only seeds the initial mode; switching modes inside
// the session is always available and never costs a new code.
//
// Legacy sessions (created before the merge) render the same family panel —
// their variant id just picks the initial tab, so nothing breaks.

import { useEffect, useState } from 'react'
import type { RoomClient } from '@/lib/room-client'
import type { AppEvent, ChatMsg, DeviceType, FileMeta, NoteDoc, Participant, TextItem } from '@/lib/types'
import type { RoomFile } from '@/components/session/drop-panel'
import type { FolderItem } from '@/lib/folder-files'
import type { AppVariant } from '@/lib/registry'
import { BeamPanel } from '@/components/session/beam-panel'
import { DropPanel } from '@/components/session/drop-panel'
import { FolderPanel } from '@/components/session/folder-panel'
import { ScreenPanel } from '@/components/session/screen-panel'
import { NotePanel } from '@/components/session/note-panel'
import { CodeEditorPanel } from '@/components/session/code-editor-panel'
import { CallPanel, callConfigFor, type CallAppConfig } from '@/components/session/call-panel'
import { PresentPanel } from '@/components/session/present-panel'
import { ClickerPanel } from '@/components/session/clicker-panel'
import { AssistPanel } from '@/components/session/assist-panel'
import { AppIcon } from '@/components/platform/app-icon'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------- mode tabs

export function ModeTabs({
  modes,
  active,
  onChange,
  label,
}: {
  modes: Array<{ id: string; name: string; icon: string }>
  active: string
  onChange: (id: string) => void
  label: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="mb-4 flex flex-wrap items-center gap-1.5 rounded-full border bg-muted/40 p-1"
    >
      {modes.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={active === m.id}
          onClick={() => onChange(m.id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            active === m.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background',
          )}
        >
          <AppIcon name={m.icon} className="size-3.5" />
          {m.name}
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------- Share

export type ShareMode = 'text' | 'files' | 'folder'

const SHARE_TABS: Array<{ id: ShareMode; name: string; icon: string }> = [
  { id: 'text', name: 'Text', icon: 'zap' },
  { id: 'files', name: 'Files', icon: 'transfer' },
  { id: 'folder', name: 'Folder', icon: 'folder' },
]

/** Legacy session appId -> the in-session tab it started from. */
export function shareModeForAppId(appId: string): ShareMode {
  switch (appId) {
    case 'beam':
    case 'quick-pair':
      return 'text'
    case 'folder-share':
      return 'folder'
    default:
      return 'files'
  }
}

interface ShareFamilyProps {
  client: RoomClient | null
  texts: TextItem[]
  sentIdsRef: React.RefObject<Set<string>>
  files: RoomFile[]
  connected: boolean
  onSendText: (content: string) => Promise<void>
  onClearTexts: () => Promise<void>
  onSendFiles: (files: FileList | File[]) => Promise<void>
  onSendFolder: (items: FolderItem[]) => Promise<void>
  onRemoveFile: (fileId: string) => Promise<void>
  onRetryFile?: (fileId: string) => Promise<void>
  onRetryAll?: () => Promise<void>
  initialMode: ShareMode
  /** Open the invite QR immediately (Quick Pair start). */
  showInviteOnMount?: boolean
  onRequestInvite?: () => void
}

/**
 * One session for text, files and folders. All three panels stay mounted
 * (hidden with CSS) so drafts, progress and transfer state survive tab
 * switches — switching modes must never lose a half-written message.
 */
export function ShareFamilyPanel({
  client,
  texts,
  sentIdsRef,
  files,
  connected,
  onSendText,
  onClearTexts,
  onSendFiles,
  onSendFolder,
  onRemoveFile,
  onRetryFile,
  onRetryAll,
  initialMode,
  showInviteOnMount,
  onRequestInvite,
}: ShareFamilyProps) {
  const [mode, setMode] = useState<ShareMode>(initialMode)

  useEffect(() => {
    if (showInviteOnMount) onRequestInvite?.()
  }, [])

  return (
    <div>
      <ModeTabs
        modes={SHARE_TABS}
        active={mode}
        onChange={(id) => setMode(id as ShareMode)}
        label="Share modes"
      />
      <div className={cn(mode !== 'text' && 'hidden')}>
        <BeamPanel
          client={client}
          texts={texts}
          sentIdsRef={sentIdsRef}
          onSend={onSendText}
          onClear={onClearTexts}
          connected={connected}
        />
      </div>
      <div className={cn(mode !== 'files' && 'hidden')}>
        <DropPanel
          files={files}
          onSendFiles={onSendFiles}
          onRemove={onRemoveFile}
          onRetry={onRetryFile}
          onRetryAll={onRetryAll}
          connected={connected}
        />
      </div>
      <div className={cn(mode !== 'folder' && 'hidden')}>
        <FolderPanel
          files={files}
          onSendItems={onSendFolder}
          onRemove={onRemoveFile}
          onRetry={onRetryFile}
          onRetryAll={onRetryAll}
          connected={connected}
        />
      </div>
    </div>
  )
}

// ------------------------------------------- Call / Camera / Voice families

interface MediaFamilyProps {
  client: RoomClient | null
  selfId: string
  participants: Participant[]
  chat: ChatMsg[]
  connected: boolean
  /** Variant ids of this tool, in display order. */
  styles: AppVariant[]
  /** The variant this session was started from (or default). */
  initialStyleId: string
  /** Live roomId label for the switch note. */
  toolName: string
}

/**
 * Call, Camera and Voice all run on the same media engine; the "mode" is a
 * configuration of that engine. Switching style remounts the panel with the
 * new config — an honest restart of the media, in the same room and code.
 */
export function MediaFamilyPanel({
  client,
  selfId,
  participants,
  chat,
  connected,
  styles,
  initialStyleId,
  toolName,
}: MediaFamilyProps) {
  const valid = styles.some((s) => s.id === initialStyleId) ? initialStyleId : styles[0]?.id
  const [styleId, setStyleId] = useState(valid)
  const [switched, setSwitched] = useState(false)

  const config: CallAppConfig | null = callConfigFor(styleId)
  if (!config) return null

  return (
    <div>
      <ModeTabs
        modes={styles.map((s) => ({ id: s.id, name: s.name, icon: s.icon }))}
        active={styleId}
        onChange={(id) => {
          if (id !== styleId) {
            setStyleId(id)
            setSwitched(true)
          }
        }}
        label={`${toolName} modes`}
      />
      {switched && (
        <p className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          Switching the style restarts this device&apos;s media in the same session — the
          code, chat and participants stay exactly as they were.
        </p>
      )}
      <CallPanel
        key={styleId}
        client={client}
        config={config}
        selfId={selfId}
        participants={participants}
        chat={chat}
        connected={connected}
      />
    </div>
  )
}

// ------------------------------------------------------------------- Screen

interface ScreenFamilyProps {
  client: RoomClient | null
  selfId: string
  participants: Participant[]
  connected: boolean
  initialAppId: string
  initialEvents: AppEvent[]
  isHost: boolean
  profileName: string
  device: DeviceType
}

const SCREEN_TABS: Array<{ id: string; name: string; icon: string }> = [
  { id: 'mine', name: 'My screen', icon: 'monitor-up' },
  { id: 'theirs', name: 'Their screen', icon: 'help' },
]

/** Share my screen or help on theirs — same room, both directions. */
export function ScreenFamilyPanel({
  client,
  selfId,
  participants,
  connected,
  initialAppId,
  initialEvents,
  isHost,
  profileName,
  device,
}: ScreenFamilyProps) {
  const [tab, setTab] = useState(() =>
    ['remote-assist', 'guided-pointer', 'support-session'].includes(initialAppId) ? 'theirs' : 'mine',
  )
  const assistVariant = (['remote-assist', 'guided-pointer', 'support-session'].includes(initialAppId)
    ? initialAppId
    : 'remote-assist') as 'remote-assist' | 'guided-pointer' | 'support-session'

  return (
    <div>
      <ModeTabs modes={SCREEN_TABS} active={tab} onChange={setTab} label="Screen modes" />
      <div className={cn(tab !== 'mine' && 'hidden')}>
        <ScreenPanel client={client} selfId={selfId} participants={participants} connected={connected} />
      </div>
      <div className={cn(tab !== 'theirs' && 'hidden')}>
        <AssistPanel
          client={client}
          selfId={selfId}
          participants={participants}
          initialEvents={initialEvents}
          connected={connected}
          isHost={isHost}
          profileName={profileName}
          device={device}
          variant={assistVariant}
        />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Notepad

interface NotepadFamilyProps {
  client: RoomClient | null
  selfId: string
  participants: Participant[]
  connected: boolean
  initialAppId: string
  initialDoc: NoteDoc | null
  initialEvents: AppEvent[]
  isHost: boolean
  profileName: string
  device: DeviceType
}

const NOTEPAD_TABS: Array<{ id: string; name: string; icon: string }> = [
  { id: 'docs', name: 'Document', icon: 'note' },
  { id: 'code', name: 'Code', icon: 'code' },
]

/** Prose document and code editor in one room. */
export function NotepadFamilyPanel({
  client,
  selfId,
  participants,
  connected,
  initialAppId,
  initialDoc,
  initialEvents,
  isHost,
  profileName,
  device,
}: NotepadFamilyProps) {
  const [tab, setTab] = useState(() => (initialAppId === 'code-editor' ? 'code' : 'docs'))
  return (
    <div>
      <ModeTabs modes={NOTEPAD_TABS} active={tab} onChange={setTab} label="Notepad modes" />
      <div className={cn(tab !== 'docs' && 'hidden')}>
        <NotePanel
          client={client}
          initialDoc={initialDoc}
          participants={participants}
          selfId={selfId}
          connected={connected}
        />
      </div>
      <div className={cn(tab !== 'code' && 'hidden')}>
        <CodeEditorPanel
          client={client}
          selfId={selfId}
          participants={participants}
          initialEvents={initialEvents}
          connected={connected}
          isHost={isHost}
          profileName={profileName}
          device={device}
        />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Present

interface PresentFamilyProps {
  client: RoomClient | null
  selfId: string
  participants: Participant[]
  connected: boolean
  initialAppId: string
  initialEvents: AppEvent[]
  isHost: boolean
  profileName: string
  device: DeviceType
  files: RoomFile[]
  sessionCode: string
}

const PRESENT_TABS: Array<{ id: string; name: string; icon: string }> = [
  { id: 'present', name: 'Present', icon: 'present' },
  { id: 'clicker', name: 'Clicker', icon: 'click' },
]

/** Drive the deck from this device or from a phone, in one room. */
export function PresentFamilyPanel({
  client,
  selfId,
  participants,
  connected,
  initialAppId,
  initialEvents,
  isHost,
  profileName,
  device,
  files,
  sessionCode,
}: PresentFamilyProps) {
  const [tab, setTab] = useState(() => (initialAppId === 'presentation-clicker' ? 'clicker' : 'present'))
  return (
    <div>
      <ModeTabs modes={PRESENT_TABS} active={tab} onChange={setTab} label="Present modes" />
      <div className={cn(tab !== 'present' && 'hidden')}>
        <PresentPanel
          client={client}
          selfId={selfId}
          participants={participants}
          initialEvents={initialEvents}
          connected={connected}
          isHost={isHost}
          profileName={profileName}
          device={device}
          files={files}
          sessionCode={sessionCode}
        />
      </div>
      <div className={cn(tab !== 'clicker' && 'hidden')}>
        <ClickerPanel
          client={client}
          selfId={selfId}
          participants={participants}
          initialEvents={initialEvents}
          connected={connected}
          isHost={isHost}
          profileName={profileName}
          device={device}
        />
      </div>
    </div>
  )
}
