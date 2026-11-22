import type { Metadata } from 'next'
import { AppShell } from '@/components/platform/app-shell'
import { getApp, getCategory } from '@/lib/registry'
import { APP_FAQS, HOME_FAQS, appMeta } from '@/lib/seo'
import { SITE_URL, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from '@/lib/site'

// Server page for the single-route app. The metadata is URL-aware: each tool
// deep link (/?app=…) carries its own title, description, keywords, canonical
// and structured data so every tool can rank on its own search terms, while
// session links (?s=…) stay private and unindexed. The body itself is also
// URL-aware: AppShell server-renders the tool's action-first landing view for
// its URL, so crawlers see the real content of every tool.

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams
}): Promise<Metadata> {
  const params = await searchParams
  const appParam = one(params.app)
  const app = appParam ? getApp(appParam) : undefined

  // Each live tool is its own indexable page.
  if (app && app.status === 'live') {
    const meta = appMeta(app)
    const url = `${SITE_URL}/?app=${app.id}`
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
            // One branded card per tool, built by brand/build-og.mjs.
            url: `/og/${app.id}.png`,
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
        images: [`/og/${app.id}.png`],
      },
    }
  }

  // Session deep links are private and ephemeral — never indexed.
  const s = one(params.s)
  const join = one(params.join)
  const view = one(params.view)

  if (s || join || view === 'sessions') {
    return {
      title: s || join ? 'Join a ShareOnWeb session' : SITE_TITLE,
      robots: { index: false, follow: false },
    }
  }

  if (view === 'help') {
    return {
      title: `Help Center · ${SITE_NAME}`,
      description:
        'How joining works, how sessions expire, and answers to common questions about every ShareOnWeb tool.',
      alternates: { canonical: `${SITE_URL}/?view=help` },
    }
  }

  return {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  }
}

// ---------------------------------------------------------------------------
// URL-aware structured data. The site-level graph (WebSite, the platform
// WebApplication, the full ItemList) ships from the layout on every URL;
// here each URL adds what belongs to it: the tool's own WebApplication,
// its FAQs and its breadcrumb — or, on home, the site-wide FAQ.
// ---------------------------------------------------------------------------

const CATEGORY_SCHEMA: Record<string, string> = {
  communicate: 'CommunicationApplication',
  share: 'UtilitiesApplication',
  collaborate: 'BusinessApplication',
  remote: 'BusinessApplication',
  utilities: 'UtilitiesApplication',
  productivity: 'BusinessApplication',
}

function faqJsonLd(faqs: { q: string; a: string }[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  })
}

function toolJsonLd(app: NonNullable<ReturnType<typeof getApp>>): string {
  const category = getCategory(app.category)
  const url = `${SITE_URL}/?app=${app.id}`
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
  const faqs = APP_FAQS[app.id]
  if (faqs?.length) graph.push(JSON.parse(faqJsonLd(faqs)))
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
}

function homeJsonLd(): string {
  return faqJsonLd(HOME_FAQS)
}

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const appParam = one(params.app)
  const app = appParam ? getApp(appParam) : undefined
  const bootAppId = app && app.status === 'live' ? app.id : undefined

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: bootAppId ? toolJsonLd(getApp(bootAppId)!) : homeJsonLd(),
        }}
      />
      <AppShell initialAppId={bootAppId} />
    </>
  )
}
