import type { Metadata } from 'next'
import { AppShell } from '@/components/platform/app-shell'

// My Sessions at its own real path. The list lives on this device only, so
// the page is never indexed.

export const metadata: Metadata = {
  title: 'My Sessions · Kontivo',
  robots: { index: false, follow: false },
}

export default function SessionsPage() {
  return <AppShell initialView={{ name: 'sessions' }} />
}
