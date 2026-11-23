import type { Metadata } from 'next'
import { AppShell } from '@/components/platform/app-shell'
import { SITE_URL, SITE_NAME } from '@/lib/site'

// Help Center at its own real path.

export const metadata: Metadata = {
  title: `Help Center · ${SITE_NAME}`,
  description:
    'How joining works, how sessions expire, and answers to common questions about every Kontivo tool.',
  alternates: { canonical: `${SITE_URL}/help` },
}

export default function HelpPage() {
  return <AppShell initialView={{ name: 'help' }} />
}
