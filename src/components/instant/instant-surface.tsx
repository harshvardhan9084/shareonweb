'use client'

// InstantSurface — renders an instant tool at its own URL (/zip, /image…).
// Instant tools have no session, no code, no relay: the whole page is the
// tool, running locally. Layout mirrors the session-tool landing pages so
// the surfaces stay consistent.

import { AppIcon } from '@/components/platform/app-icon'
import { BrandMark } from '@/components/platform/app-icon'
import { getTopApp, type AppDef } from '@/lib/registry'
import { ZipTool } from '@/components/instant/zip-tool'
import { ImageTool } from '@/components/instant/image-tool'
import { HashTool } from '@/components/instant/hash-tool'
import { EncodeTool } from '@/components/instant/encode-tool'
import { JsonTool } from '@/components/instant/json-tool'
import { TextTool } from '@/components/instant/text-tool'
import { PasswordTool } from '@/components/instant/password-tool'
import { QrTool } from '@/components/instant/qr-tool'
import { PdfTool } from '@/components/instant/pdf-tool'
import { PdfViewTool } from '@/components/instant/pdf-view-tool'
import { PdfTextTool } from '@/components/instant/pdf-text-tool'
import { ImagesToPdfTool } from '@/components/instant/images-to-pdf-tool'
import { OfficeViewTool } from '@/components/instant/office-view-tool'
import { EpubViewTool } from '@/components/instant/epub-view-tool'

const TOOLS: Record<string, () => React.ReactElement> = {
  zip: ZipTool,
  image: ImageTool,
  hash: HashTool,
  encode: EncodeTool,
  json: JsonTool,
  text: TextTool,
  password: PasswordTool,
  qr: QrTool,
  pdf: PdfTool,
  'pdf-view': PdfViewTool,
  'pdf-text': PdfTextTool,
  'images-to-pdf': ImagesToPdfTool,
  'office-view': OfficeViewTool,
  'epub-view': EpubViewTool,
}

function ToolHeader({ app }: { app: AppDef }) {
  return (
    <header className="border-b pb-5">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl border bg-card">
          <AppIcon name={app.icon} className="size-5 text-primary" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">{app.name}</h1>
        </div>
        <span className="ml-auto hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground sm:flex">
          <BrandMark className="size-3.5" variant="mono" aria-hidden="true" />
          Instant — no session, no code
        </span>
      </div>
      <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{app.tagline}</p>
    </header>
  )
}

export function InstantSurface({ appId }: { appId: string }) {
  const app = getTopApp(appId)
  const Tool = TOOLS[appId]
  if (!app || app.kind !== 'instant' || !Tool) return null

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <ToolHeader app={app} />
      <div className="mt-6">
        <Tool />
      </div>
      {app.howItWorks?.length ? (
        <section className="mt-8 border-t pt-6" aria-label={`How ${app.name} works`}>
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">How it works</h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {app.howItWorks.map((step, i) => (
              <li key={step} className="flex gap-3 rounded-xl border bg-card p-3.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}
