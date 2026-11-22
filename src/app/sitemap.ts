import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { getLiveApps } from '@/lib/registry'

// Every live tool lives at its own real path (/beam, /call) — self-canonical,
// with its own metadata and structured data — so each tool can rank on its
// own search terms. Session paths are private and never listed.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...getLiveApps().map((app) => ({
      url: `${SITE_URL}/${app.id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
