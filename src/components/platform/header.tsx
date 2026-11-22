'use client'

import { useRouter } from 'next/navigation'
import { BrandMark } from '@/components/platform/app-icon'
import { ThemeToggle } from '@/components/platform/theme'
import { useCommandPalette } from '@/components/platform/command-palette'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { usePlatform } from '@/lib/store'
import { INSTANT_START_APPS, getVariant, getLiveApps } from '@/lib/registry'
import { quickStart } from '@/lib/quick-start'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Menu, Plus, ChevronDown, Command, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function Header() {
  const navigate = usePlatform((s) => s.navigate)
  const view = usePlatform((s) => s.view)
  const openJoin = usePlatform((s) => s.openJoin)
  const openPalette = useCommandPalette((s) => s.setOpen)
  const { canInstall, promptInstall } = usePwaInstall()
  const router = useRouter()
  const liveApps = getLiveApps()

  const current =
    view.name === 'sessions' ? 'sessions' : view.name === 'help' ? 'help' : 'home'

  const nav = [
    { key: 'home', label: 'Discover', action: () => navigate({ name: 'home' }) },
    { key: 'sessions', label: 'My Sessions', action: () => navigate({ name: 'sessions' }) },
    { key: 'help', label: 'Help Center', action: () => navigate({ name: 'help' }) },
  ]

  const goHome = () => {
    navigate({ name: 'home' })
    router.refresh()
  }

  // One-tap install straight from the chrome — only offered when the browser
  // actually supports the native prompt (hidden everywhere else).
  const onHeaderInstall = async () => {
    const outcome = await promptInstall()
    if (outcome === 'accepted')
      toast.success('Toolhive was installed. Find it on your home screen.')
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:gap-4">
        <button
          onClick={goHome}
          className="flex items-center gap-2 rounded-md py-1 pr-2 focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Toolhive home"
        >
          <BrandMark className="size-7" />
          <span className="font-display text-lg font-semibold tracking-[-0.01em]">Toolhive</span>
        </button>

        <nav className="ml-3 hidden items-center gap-0.5 sm:flex" aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.key}
              onClick={item.action}
              aria-current={current === item.key ? 'page' : undefined}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent/60 hover:text-foreground active:bg-accent focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none',
                current === item.key
                  ? 'bg-accent font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => openPalette(true)}
            className="hidden h-9 items-center gap-2 rounded-lg border bg-muted/50 px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:flex"
            aria-label="Open quick actions (Command palette)"
            title="Quick actions (⌘K)"
          >
            <Command className="size-3.5" aria-hidden="true" />
            <span>Quick actions</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 md:hidden"
            onClick={() => openPalette(true)}
            aria-label="Open quick actions (Command palette)"
          >
            <Command className="size-4" aria-hidden="true" />
          </Button>

          {canInstall && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 bg-transparent"
              onClick={() => void onHeaderInstall()}
            >
              <Download className="size-4" aria-hidden="true" />
              <span className="hidden xs:inline sm:inline">Install</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 gap-1.5">
                <Plus className="size-4" aria-hidden="true" />
                <span className="hidden xs:inline sm:inline">New session</span>
                <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Start a live tool in one click
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {INSTANT_START_APPS.map((id) => {
                const found = getVariant(id)
                if (!found) return null
                const { app, variant } = found
                return (
                  <DropdownMenuItem key={id} onClick={() => void quickStart(id)}>
                    <span className="text-sm font-medium">
                      {app.name}
                      {app.variants?.length ? (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          · {variant.name}
                        </span>
                      ) : null}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">starts now</span>
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ name: 'home' })}>
                <span className="text-sm font-medium">
                  All {getLiveApps().length} tools
                </span>
                <span className="ml-auto text-xs text-muted-foreground">Discover</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openJoin()}>
                <span className="text-sm font-medium">I have a code</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle />

          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9" aria-label="Open menu">
                  <Menu className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {nav.map((item) => (
                  <DropdownMenuItem key={item.key} onClick={item.action}>
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
