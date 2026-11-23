'use client'

import { create } from 'zustand'
import type { SessionInfo, DeviceType } from '@/lib/types'
import { getApp, resolveAppId } from '@/lib/registry'
import { appMeta } from '@/lib/seo'
import { CODE_PATH_RE } from '@/lib/code'
import { SITE_NAME, SITE_TITLE } from '@/lib/site'

export type View =
  | { name: 'home' }
  | { name: 'app'; appId: string }
  | { name: 'session'; code: string }
  | { name: 'sessions' }
  | { name: 'help' }

/**
 * Parse a location pathname into a view. Session codes and tool slugs share
 * one namespace (/share is a tool, /K7T29Q is a session), resolved here from
 * the registry; anything that is neither returns null so callers decide
 * (the server 404s; the shell falls back to home).
 */
export function parsePath(pathname: string): View | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { name: 'home' }
  if (path === '/sessions') return { name: 'sessions' }
  if (path === '/help') return { name: 'help' }
  const slug = decodeURIComponent(path.slice(1))
  if (slug.includes('/')) return null
  const resolved = resolveAppId(slug.toLowerCase())
  if (resolved) return { name: 'app', appId: resolved }
  if (CODE_PATH_RE.test(slug.toUpperCase())) {
    return { name: 'session', code: slug.toUpperCase() }
  }
  return null
}

export interface RecentSession {
  code: string
  appId: string
  createdAt: string
  expiresAt: string
  /** Optional cosmetic label the owner can set from the session view. */
  title?: string | null
}

const RECENT_KEY = 'sow.recent.v1'
const LEGACY_RECENT_KEY = 'relay.recent.v1'
const NAME_KEY = 'sow.profile.name'
const LEGACY_NAME_KEY = 'relay.profile.name'
const MAX_RECENT = 20

/** Real paths: /share for tools, /K7T29Q for sessions, /help, /sessions. */
function urlForView(v: View): string {
  if (v.name === 'home') return '/'
  if (v.name === 'app') return `/${v.appId}`
  if (v.name === 'session') return `/${v.code}`
  return `/${v.name}`
}

/** Every view change lands at the top of the page — never mid-scroll. */
function scrollTop() {
  if (typeof window !== 'undefined') window.scrollTo(0, 0)
}

/** The tab title always matches what the URL would have served server-side. */
export function syncTitle(v: View) {
  if (typeof document === 'undefined') return
  let title = SITE_TITLE
  if (v.name === 'app') {
    const app = getApp(v.appId)
    if (app) title = appMeta(app).title
  } else if (v.name === 'session') {
    title = 'Join a Kontivo session'
  } else if (v.name === 'sessions') {
    title = 'My Sessions · Kontivo'
  } else if (v.name === 'help') {
    title = `Help Center · ${SITE_NAME}`
  }
  document.title = title
}

function loadRecent(): RecentSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw =
      window.localStorage.getItem(RECENT_KEY) ?? window.localStorage.getItem(LEGACY_RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentSession[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function saveRecent(list: RecentSession[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
  } catch {
    // ignore quota errors
  }
}

export function loadProfileName(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(NAME_KEY) ?? window.localStorage.getItem(LEGACY_NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveProfileName(name: string) {
  if (typeof window === 'undefined') return
  try {
    if (name) window.localStorage.setItem(NAME_KEY, name)
    else window.localStorage.removeItem(NAME_KEY)
    // Remove the pre-rename key so the value does not resurface later.
    window.localStorage.removeItem(LEGACY_NAME_KEY)
  } catch {
    // ignore
  }
}

export function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop'
  const ua = window.navigator.userAgent
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet'
  if (/Mobi|Android|iPhone/i.test(ua)) return 'phone'
  if (window.innerWidth < 768 && 'ontouchstart' in window) return 'phone'
  return 'desktop'
}

interface PlatformStore {
  view: View
  activeAppId: string | null
  activeSession: SessionInfo | null
  joinOpen: boolean
  joinPrefill: string
  joinScan: boolean
  recent: RecentSession[]

  navigate: (v: View) => void
  openApp: (appId: string) => void
  setActiveSession: (s: SessionInfo | null) => void
  openJoin: (prefill?: string, scan?: boolean) => void
  setJoinOpen: (open: boolean) => void
  loadRecent: () => void
  addRecent: (r: RecentSession) => void
  removeRecent: (code: string) => void
  clearRecent: () => void
}

export const usePlatform = create<PlatformStore>((set, get) => ({
  view: { name: 'home' },
  activeAppId: null,
  activeSession: null,
  joinOpen: false,
  joinPrefill: '',
  joinScan: false,
  recent: [],

  navigate: (v) => {
    set({ view: v })
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', urlForView(v))
      syncTitle(v)
      scrollTop()
    }
  },

  openApp: (appId) => {
    // Variant ids ('drop', 'video-call') land on the merged tool's page.
    const id = resolveAppId(appId) ?? appId
    set({ activeAppId: id, view: { name: 'app', appId: id } })
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/${id}`)
      syncTitle({ name: 'app', appId: id })
      scrollTop()
    }
  },

  setActiveSession: (s) => set({ activeSession: s }),

  openJoin: (prefill = '', scan = false) =>
    set({ joinOpen: true, joinPrefill: prefill, joinScan: scan }),
  setJoinOpen: (open) =>
    set({
      joinOpen: open,
      joinPrefill: open ? get().joinPrefill : '',
      joinScan: open ? get().joinScan : false,
    }),

  loadRecent: () => set({ recent: loadRecent() }),

  addRecent: (r) => {
    const list = [r, ...loadRecent().filter((x) => x.code !== r.code)].slice(0, MAX_RECENT)
    saveRecent(list)
    set({ recent: list })
  },

  removeRecent: (code) => {
    const list = loadRecent().filter((x) => x.code !== code)
    saveRecent(list)
    set({ recent: list })
  },

  clearRecent: () => {
    saveRecent([])
    set({ recent: [] })
  },
}))

/** Replace the URL without adding a history entry (used during hydration). */
export function replaceUrlForView(v: View) {
  if (typeof window === 'undefined') return
  window.history.replaceState(null, '', urlForView(v))
}
