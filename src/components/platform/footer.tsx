'use client'

import { BrandMark } from '@/components/platform/app-icon'
import { usePlatform } from '@/lib/store'
import { CATEGORIES } from '@/lib/registry'

export function Footer() {
  const navigate = usePlatform((s) => s.navigate)
  const openJoin = usePlatform((s) => s.openJoin)

  return (
    <footer className="mt-auto border-t bg-muted/40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BrandMark className="size-6" />
              <span className="font-display text-base font-semibold tracking-tight">
                ShareOnWeb
              </span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Practical online services that run straight between browsers. A session exists
              when you open it; when it ends or expires, everything inside it is discarded.
            </p>
            <button
              onClick={() => openJoin()}
              className="whitespace-nowrap text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              Have a code? Join a session
            </button>
          </div>

          <nav aria-label="Footer navigation" className="space-y-2.5 text-sm">
            <p className="font-medium">Explore</p>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <button
                  className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => navigate({ name: 'home' })}
                >
                  Discover tools
                </button>
              </li>
              <li>
                <button
                  className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => navigate({ name: 'sessions' })}
                >
                  My Sessions
                </button>
              </li>
              <li>
                <button
                  className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => navigate({ name: 'help' })}
                >
                  Help Center
                </button>
              </li>
            </ul>
          </nav>

          <nav aria-label="Categories" className="space-y-2.5 text-sm">
            <p className="font-medium">Sections</p>
            <ul className="space-y-2 text-muted-foreground">
              {CATEGORIES.map((c) => (
                <li key={c.id}>
                  <button
                    className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => navigate({ name: 'home' })}
                  >
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 border-t pt-5 text-xs text-muted-foreground">
          <span>
            ShareOnWeb works device to device. Nothing you share is stored beyond the life of
            its session.
          </span>
        </div>
      </div>
    </footer>
  )
}
