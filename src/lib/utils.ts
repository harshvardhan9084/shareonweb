import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const NETWORK_MSG = "Couldn't reach Kontivo. Check your connection and try again."

/**
 * Human copy for failed calls — raw browser errors ("Failed to fetch",
 * "Load failed") never belong in a toast. Server-provided messages pass
 * through unchanged; everything else falls back to the caller's copy.
 */
export function humanError(err: unknown, fallback: string): string {
  if (err instanceof TypeError) return NETWORK_MSG
  if (err instanceof Error && err.message) {
    return /^(Failed to fetch|Load failed|NetworkError|The Internet connection)/i.test(err.message)
      ? NETWORK_MSG
      : err.message
  }
  return fallback
}
