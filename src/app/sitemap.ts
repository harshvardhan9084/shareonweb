import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { getLiveApps } from '@/lib/registry'

// The home URL carries the index; every live tool's deep link (/?app=…)
// is its own indexable page — self-canonical, with its own metadata and
// structured data — so each tool can rank on its own search terms.
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
      url: `${SITE_URL}/?app=${app.id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
