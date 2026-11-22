'use client'

// Registers the offline-shell service worker (public/sw.js) in production
// builds only — Next dev keeps its hot-reloading pipeline SW-free so local QA
// never serves a stale shell. Registration happens after the load event so it
// never competes with first-paint resources. Any failure is silent: the app
// is a normal website when the worker is absent.
import { useEffect } from 'react'

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }

    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
