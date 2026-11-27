import type { MouseEvent } from 'react'

/**
 * Props for a real <a> that keeps plain SPA clicks in-app and hands every
 * modifier click to the browser untouched. The doctrine the tool cards have
 * followed since Batch R7: the browser shows the URL on hover, the context
 * menu offers "open in new tab", middle-click opens it — while a plain left
 * click stays inside the single-page shell (no full reload, scroll memory
 * intact). `go` performs the in-app navigation; `href` is the real path the
 * address bar, the status bar and direct loads all see.
 */
export function spaAnchorProps(href: string, go: () => void) {
  return {
    href,
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      go()
    },
  }
}
