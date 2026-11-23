'use client'

// InstantSurface — renders an instant tool at its own URL (/zip, /image…).
// Instant tools have no session, no code, no relay: the whole page is the
// tool, running locally. Layout mirrors the session-tool landing pages so
// the surfaces stay consistent. ACTION FIRST: header, then the working tool,
// then everything else (how-it-works, what-it-does, FAQs) below the fold.
// Doctrine: DESIGN.md at the repo root.

import { AppIcon } from '@/components/platform/app-icon'
import { BrandMark } from '@/components/platform/app-icon'
import { getTopApp, type AppDef } from '@/lib/registry'
import { getArticle } from '@/lib/content'
import { APP_FAQS } from '@/lib/seo'
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
import { AudioTool } from '@/components/instant/audio-tool'
import { GifTool } from '@/components/instant/gif-tool'
import { FrameGrabTool } from '@/components/instant/frame-grab-tool'
import { RecorderTool } from '@/components/instant/recorder-tool'
import { UpscalerTool } from '@/components/instant/upscaler-tool'
import { ArchiveTool } from '@/components/instant/archive-tool'
import { FileToolsTool } from '@/components/instant/file-tools-tool'
import { EncryptTool } from '@/components/instant/encrypt-tool'
import { MetaScrubTool } from '@/components/instant/meta-scrub-tool'
import { JwtTool } from '@/components/instant/jwt-tool'
import { BatchHashTool } from '@/components/instant/hash-file-batch-tool'
import { CronTool } from '@/components/instant/cron-tool'
import { Check, ShieldCheck } from 'lucide-react'

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
  audio: AudioTool,
  gif: GifTool,
  'frame-grab': FrameGrabTool,
  recorder: RecorderTool,
  upscaler: UpscalerTool,
  archive: ArchiveTool,
  'file-tools': FileToolsTool,
  encrypt: EncryptTool,
  'meta-scrub': MetaScrubTool,
  jwt: JwtTool,
  'hash-file-batch': BatchHashTool,
  cron: CronTool,
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

function cnInstant(...classes: Array<string | false>): string {
  return classes.filter(Boolean).join(' ')
}

export function InstantSurface({ appId }: { appId: string }) {
  const app = getTopApp(appId)
  const Tool = TOOLS[appId]
  if (!app || app.kind !== 'instant' || !Tool) return null

  const faqs = (APP_FAQS[app.id] ?? []).slice(0, 4)

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

      {/* --------------------------------- the written page (below the action) */}
      <div className="mt-8 grid gap-10 border-t pt-6 lg:grid-cols-[1fr_300px] lg:gap-12">
        <div>
          <section aria-labelledby="what-it-does">
            <h2
              id="what-it-does"
              className="font-display text-lg font-semibold tracking-[-0.02em]"
            >
              What {app.name} does
            </h2>
            {/* the article: importance-ordered long-form, written for reading */}
            {(() => {
              const article = getArticle(app.id)
              if (!article) {
                return (
                  <p className="mt-3 max-w-[62ch] text-pretty leading-relaxed text-foreground/90">
                    {app.description}
                  </p>
                )
              }
              return (
                <div className="mt-4 max-w-[68ch]">
                  {article.lede.map((p, i) => (
                    <p
                      key={i}
                      className={cnInstant(
                        'text-pretty leading-relaxed',
                        i === 0 ? 'text-foreground' : 'mt-4 text-foreground/85',
                      )}
                    >
                      {p}
                    </p>
                  ))}
                  {article.sections.map((section) => (
                    <section key={section.heading} className="mt-7">
                      <h3 className="text-lg font-semibold tracking-tight">{section.heading}</h3>
                      {section.paragraphs.map((p, i) => (
                        <p
                          key={i}
                          className={cnInstant(
                            'text-pretty leading-relaxed text-foreground/85',
                            i === 0 ? 'mt-4' : 'mt-3',
                          )}
                        >
                          {p}
                        </p>
                      ))}
                      {section.list && (
                        <ul className="mt-4 space-y-2">
                          {section.list.map((item) => (
                            <li key={item} className="flex items-start gap-2.5 text-sm">
                              <Check
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              <span className="text-foreground/90">{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>
              )
            })()}
            <ul className="mt-4 space-y-2.5">
              {app.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-foreground/90">{f}</span>
                </li>
              ))}
            </ul>
          </section>

          {faqs.length > 0 && (
            <section className="mt-8" aria-labelledby={`faq-${app.id}`}>
              <h2
                id={`faq-${app.id}`}
                className="font-display text-lg font-semibold tracking-[-0.02em]"
              >
                Quick answers about {app.name}
              </h2>
              <ul className="mt-3">
                {faqs.map((f) => (
                  <li key={f.q} className="border-t border-border py-4">
                    <h3 className="text-sm font-semibold">{f.q}</h3>
                    <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
                      {f.a}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-6 lg:pt-1">
          <div className="rounded-lg border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              Private by construction
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {app.name} runs entirely in this browser tab. Your files are processed on your
              device and never touch a server — there is no upload step to trust, because there
              is no upload.
            </p>
          </div>
          <div className="border-t pt-4 text-sm">
            <p className="text-xs font-semibold text-muted-foreground">Free to use</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              No account, no watermark, no daily limit. It is a tool, not a trial.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
