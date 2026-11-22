'use client'

// Global command palette (⌘K / Ctrl+K): start any live tool, join a session
// by code, or jump to a section. The open state lives in a tiny zustand store
// so the header button can trigger it from anywhere.

import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { AppIcon } from '@/components/platform/app-icon'
import { APPS, getLiveApps } from '@/lib/registry'
import { quickStart } from '@/lib/quick-start'
import { normalizeCode } from '@/lib/code'
import { usePlatform } from '@/lib/store'
import { toast } from 'sonner'
import { fetchSession } from '@/lib/api'
import {
  Compass,
  History,
  CircleHelp,
  KeyRound,
  Moon,
  Sun,
  CornerDownLeft,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn, humanError } from '@/lib/utils'

interface PaletteStore {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useCommandPalette = create<PaletteStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

const QUICK_START_LABELS: Record<string, string> = {
  beam: 'Send files between devices now',
  call: 'Start a video call now',
  screen: 'Share my screen now',
  camera: 'Share my camera live now',
  voice: 'Open a walkie-talkie now',
  notepad: 'Write a note together now',
  present: 'Present slides live now',
  canvas: 'Draw together on a board now',
  roundtable: 'Open a discussion room now',
  'co-browse': 'Browse a page together now',
  'location-share': 'Share my live location now',
  'live-captions': 'Start live captions now',
}

export function CommandPalette() {
  const open = useCommandPalette((s) => s.open)
  const setOpen = useCommandPalette((s) => s.setOpen)
  const openJoin = usePlatform((s) => s.openJoin)
  const navigate = usePlatform((s) => s.navigate)
  const openApp = usePlatform((s) => s.openApp)
  const setActiveSession = usePlatform((s) => s.setActiveSession)
  const addRecent = usePlatform((s) => s.addRecent)
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [query, setQuery] = useState('')

  // Global hotkey.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!useCommandPalette.getState().open)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setOpen])

  // Fetch + enter a session by code from the palette input.
  async function joinByCode(raw: string) {
    const code = normalizeCode(raw)
    if (code.length < 4) {
      toast.error('Codes are 4–8 characters, check the code and try again.')
      return
    }
    try {
      const session = await fetchSession(code)
      setActiveSession(session)
      addRecent({
        code: session.code,
        appId: session.appId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        title: session.title,
      })
      navigate({ name: 'session', code: session.code })
      setOpen(false)
    } catch (err) {
      toast.error(humanError(err, 'That code is not live right now.'))
    }
  }

  const liveApps = getLiveApps()
  const dark = theme === 'dark'
  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
      title="Quick actions"
      description="Start a tool, join a session or jump to a section"
      className="sm:max-w-lg"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Type a command, a tool name, or a session code…"
        aria-label="Command palette input"
      />
      <CommandList className="max-h-96">
        <CommandEmpty>
          {(() => {
            const q = query.trim()
            if (q && normalizeCode(q).length >= 4) {
              return (
                <button
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent"
                  onClick={() => void joinByCode(q)}
                >
                  <KeyRound className="size-4 text-primary" aria-hidden="true" />
                  <span>
                    Join session{' '}
                    <span className="font-mono font-semibold">{normalizeCode(q).slice(0, 8)}</span>
                  </span>
                  <CornerDownLeft className="ml-auto size-3.5 text-muted-foreground" aria-hidden="true" />
                </button>
              )
            }
            return 'No matching command. Try “note”, “screen”, or paste a session code.'
          })()}
        </CommandEmpty>

        <CommandGroup heading="Start now, one click, no account">
          {liveApps.map((app) => (
            <CommandItem
              key={app.id}
              value={`start ${app.name} ${QUICK_START_LABELS[app.id] ?? ''} ${app.id}`}
              onSelect={() => {
                setOpen(false)
                void quickStart(app.id)
              }}
            >
              <AppIcon name={app.icon} className="size-4 text-primary" />
              <span className="text-sm">{QUICK_START_LABELS[app.id] ?? app.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {app.name}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Join">
          <CommandItem
            value="join session code dialog"
            onSelect={() => {
              setOpen(false)
              openJoin()
            }}
          >
            <KeyRound className="text-muted-foreground" />
            <span className="text-sm">I have a session code…</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Browse the catalog">
          {APPS.map((app) => (
            <CommandItem
              key={app.id}
              value={`open ${app.name} ${app.tagline} ${app.intents.join(' ')} ${app.id}`}
              onSelect={() => {
                setOpen(false)
                openApp(app.id)
              }}
            >
              <AppIcon
                name={app.icon}
                className={cn(
                  'size-4',
                  app.status === 'live' ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <span className="text-sm">{app.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {app.status === 'live' ? 'live' : 'soon'} · {app.category}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Platform">
          <CommandItem
            value="discover tools home"
            onSelect={() => {
              setOpen(false)
              navigate({ name: 'home' })
            }}
          >
            <Compass className="text-muted-foreground" />
            <span className="text-sm">Discover tools</span>
          </CommandItem>
          <CommandItem
            value="my sessions recent history"
            onSelect={() => {
              setOpen(false)
              navigate({ name: 'sessions' })
            }}
          >
            <History className="text-muted-foreground" />
            <span className="text-sm">My Sessions</span>
          </CommandItem>
          <CommandItem
            value="help center troubleshoot"
            onSelect={() => {
              setOpen(false)
              navigate({ name: 'help' })
            }}
          >
            <CircleHelp className="text-muted-foreground" />
            <span className="text-sm">Help Center</span>
          </CommandItem>
          <CommandItem
            value="toggle theme dark light"
            onSelect={() => {
              setTheme(dark ? 'light' : 'dark')
              setOpen(false)
            }}
          >
            {dark ? <Sun className="text-muted-foreground" /> : <Moon className="text-muted-foreground" />}
            <span className="text-sm">Switch to {dark ? 'light' : 'dark'} mode</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
