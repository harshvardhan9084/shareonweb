import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { AppShell } from '@/components/platform/app-shell'
import { APP_ALIASES, APPS, getCategory, getTopApp } from '@/lib/registry'
import { CODE_PATH_RE, normalizeCode } from '@/lib/code'
import { SITE_URL, SITE_NAME } from '@/lib/site'
import { appMeta } from '@/lib/seo'

// One dynamic segment resolves the shared namespace:
//   /beam        -> the Beam tool page (statically generated, indexable)
//   /drop        -> a legacy variant slug, redirects to /beam
//   /K7T29Q      -> a session path (private, never indexed, client-hydrated)
//   /garbage     -> a real 404
// Static tool routes take precedence; session paths render dynamically.

type Params = Promise<{ slug: string }>

const CATEGORY_SCHEMA: Record<string, string> = {
  communicate: 'CommunicationApplication',
  share: 'UtilitiesApplication',
  collaborate: 'BusinessApplication',
  remote: 'BusinessApplication',
  utilities: 'UtilitiesApplication',
}

export const dynamicParams = true

export function generateStaticParams(): Array<{ slug: string }> {
  return APPS.filter((a) => a.status === 'live').map((a) => ({ slug: a.id }))
}

function toolJsonLd(appId: string): string {
  const app = getTopApp(appId)!
  const category = getCategory(app.category)
  const url = `${SITE_URL}/${app.id}`
  const graph: Array<Record<string, unknown>> = [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ShareOnWeb', item: `${SITE_URL}/` },
        {
          '@type': 'ListItem',
          position: 2,
          name: category.label,
          item: `${SITE_URL}/`,
        },
        { '@type': 'ListItem', position: 3, name: app.name, item: url },
      ],
    },
    {
      '@type': 'WebApplication',
      '@id': `${url}#app`,
      name: app.name,
      url,
      applicationCategory: CATEGORY_SCHEMA[app.category] ?? 'UtilitiesApplication',
      operatingSystem: 'Any modern web browser',
      browserRequirements: 'Requires JavaScript',
      description: app.description,
      featureList: app.features,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      isPartOf: { '@id': `${SITE_URL}/#website` },
    },
  ]
  if (app.howItWorks?.length) {
    graph.push({
      '@type': 'HowTo',
      name: `How ${app.name} works`,
      step: app.howItWorks.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        text: s,
      })),
    })
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
}

/** Per-tool OG card if it has been generated, else the site card. */
function ogImageFor(appId: string): string {
  try {
    if (existsSync(join(process.cwd(), 'public', 'og', `${appId}.png`))) {
      return `/og/${appId}.png`
    }
  } catch {
    // fall through
  }
  return '/og.png'
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const app = getTopApp(slug)

  if (app && app.status === 'live') {
    const meta = appMeta(app)
    const url = `${SITE_URL}/${app.id}`
    const og = ogImageFor(app.id)
    return {
      title: meta.title,
      description: meta.description,
      keywords: meta.keywords,
      alternates: { canonical: url },
      openGraph: {
        title: meta.title,
        description: meta.description,
        siteName: SITE_NAME,
        type: 'website',
        url,
        locale: 'en_US',
        images: [
          {
            url: og,
            width: 1200,
            height: 630,
            alt: `${app.name} — ${app.tagline}`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: meta.title,
        description: meta.description,
        images: [og],
      },
    }
  }

  // Session deep links are private and ephemeral — never indexed.
  if (CODE_PATH_RE.test(slug.toUpperCase())) {
    return {
      title: 'Join a ShareOnWeb session',
      robots: { index: false, follow: false },
    }
  }

  return {}
}

export default async function Page({ params }: { params: Params }) {
  const { slug } = await params

  // Case-insensitive canonicalization: /Beam -> /beam.
  const lower = slug.toLowerCase()
  if (slug !== lower && getTopApp(lower)) redirect(`/${lower}`)

  const app = getTopApp(lower)
  if (app) {
    if (app.status !== 'live') notFound()
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toolJsonLd(app.id) }}
        />
        <AppShell initialView={{ name: 'app', appId: app.id }} />
      </>
    )
  }

  // Legacy variant slugs (/drop, /video-call) redirect to the merged tool.
  if (APP_ALIASES[lower]) redirect(`/${APP_ALIASES[lower]}`)

  // A session path: the shell hydrates it against the session API and shows
  // an honest dead-end if it does not resolve.
  if (CODE_PATH_RE.test(slug.toUpperCase())) {
    return <AppShell initialView={{ name: 'session', code: normalizeCode(slug) }} />
  }

  notFound()
}
