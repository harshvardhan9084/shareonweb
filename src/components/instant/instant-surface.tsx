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
import { DiffTool } from '@/components/instant/diff-tool'
import { UuidTool } from '@/components/instant/uuid-tool'
import { ConvertUnitsTool } from '@/components/instant/convert-units-tool'
import { LoremTool } from '@/components/instant/lorem-tool'
import { FakeDataTool } from '@/components/instant/fake-data-tool'
import { CssToolsTool } from '@/components/instant/css-tools-tool'
import { MetaTagsTool } from '@/components/instant/meta-tags-tool'
import { BarcodeTool } from '@/components/instant/barcode-tool'
import { CalculatorTool } from '@/components/instant/calculator-tool'
import { PercentageTool } from '@/components/instant/percentage-tool'
import { DateMathTool } from '@/components/instant/date-calculator-tool'
import { BmiTool } from '@/components/instant/bmi-tool'
import { LoanTool } from '@/components/instant/loan-tool'
import { TimerTool } from '@/components/instant/timer-tool'
import { PickerTool } from '@/components/instant/picker-tool'
import { RegexTool } from '@/components/instant/regex-tool'
import { CsvTool } from '@/components/instant/csv-tool'
import { ColorTool } from '@/components/instant/color-tool'
import { SignatureTool } from '@/components/instant/signature-tool'
import { InvoiceTool } from '@/components/instant/invoice-tool'
import { TimeZoneTool } from '@/components/instant/timezone-tool'
import { PdfToImageTool } from '@/components/instant/pdf-to-image-tool'
import { DeviceTestTool } from '@/components/instant/device-test-tool'
import { BeautifyTool } from '@/components/instant/beautify-tool'
import { FaviconTool } from '@/components/instant/favicon-tool'
import { WatermarkTool } from '@/components/instant/watermark-tool'
import { TypingTestTool } from '@/components/instant/typing-test-tool'
import { MarkdownTool } from '@/components/instant/markdown-tool'
import { StatsTool } from '@/components/instant/stats-tool'
import { NumberToWordsTool } from '@/components/instant/number-to-words-tool'
import { MorseTool } from '@/components/instant/morse-tool'
import { FontChangerTool } from '@/components/instant/font-changer-tool'
import { EmojiTool } from '@/components/instant/emoji-tool'
import { JsonToTsTool } from '@/components/instant/json-to-ts-tool'
import { PdfCompressTool } from '@/components/instant/compress-pdf-tool'
import { TimeCardTool } from '@/components/instant/time-card-tool'
import { GradeTool } from '@/components/instant/grade-tool'
import { TodoTool } from '@/components/instant/todo-tool'
import { MemeTool } from '@/components/instant/meme-tool'
import { SvgConvertTool } from '@/components/instant/svg-convert-tool'
import { CipherTool } from '@/components/instant/cipher-tool'
import { DueDateTool } from '@/components/instant/due-date-tool'
import { WordFrequencyTool } from '@/components/instant/word-frequency-tool'
import { VCardTool } from '@/components/instant/vcard-tool'
import { CalendarLinkTool } from '@/components/instant/calendar-link-tool'
import { PxRemTool } from '@/components/instant/px-rem-tool'
import { BinaryTool } from '@/components/instant/binary-tool'
import { SoundToolsTool } from '@/components/instant/sound-tools-tool'
import { TtsTool } from '@/components/instant/tts-tool'
import { FuelCostTool } from '@/components/instant/fuel-cost-tool'
import { SalaryTool } from '@/components/instant/salary-tool'
import { SleepTool } from '@/components/instant/sleep-tool'
import { PaceTool } from '@/components/instant/pace-tool'
import { OneRepMaxTool } from '@/components/instant/one-rep-max-tool'
import { FractionTool } from '@/components/instant/fraction-tool'
import { QuadraticTool } from '@/components/instant/quadratic-tool'
import { SpreadsheetTool } from '@/components/instant/spreadsheet-tool'
import { ChartMakerTool } from '@/components/instant/chart-maker-tool'
import { ResumeTool } from '@/components/instant/resume-tool'
import { VideoStudioTool } from '@/components/instant/video-studio-tool'
import { BgRemoveTool } from '@/components/instant/bg-remove-tool'
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
  diff: DiffTool,
  uuid: UuidTool,
  'convert-units': ConvertUnitsTool,
  lorem: LoremTool,
  'fake-data': FakeDataTool,
  'css-tools': CssToolsTool,
  'meta-tags': MetaTagsTool,
  barcode: BarcodeTool,
  calculator: CalculatorTool,
  percentage: PercentageTool,
  'date-calculator': DateMathTool,
  bmi: BmiTool,
  loan: LoanTool,
  timer: TimerTool,
  picker: PickerTool,
  regex: RegexTool,
  csv: CsvTool,
  color: ColorTool,
  signature: SignatureTool,
  invoice: InvoiceTool,
  timezone: TimeZoneTool,
  'pdf-to-image': PdfToImageTool,
  'device-test': DeviceTestTool,
  beautify: BeautifyTool,
  favicon: FaviconTool,
  watermark: WatermarkTool,
  'typing-test': TypingTestTool,
  markdown: MarkdownTool,
  stats: StatsTool,
  'number-to-words': NumberToWordsTool,
  morse: MorseTool,
  'font-changer': FontChangerTool,
  emoji: EmojiTool,
  'json-to-ts': JsonToTsTool,
  'compress-pdf': PdfCompressTool,
  'time-card': TimeCardTool,
  grade: GradeTool,
  todo: TodoTool,
  meme: MemeTool,
  'svg-convert': SvgConvertTool,
  cipher: CipherTool,
  'due-date': DueDateTool,
  'word-frequency': WordFrequencyTool,
  vcard: VCardTool,
  'calendar-link': CalendarLinkTool,
  'px-rem': PxRemTool,
  binary: BinaryTool,
  'sound-tools': SoundToolsTool,
  tts: TtsTool,
  'fuel-cost': FuelCostTool,
  salary: SalaryTool,
  sleep: SleepTool,
  pace: PaceTool,
  'one-rep-max': OneRepMaxTool,
  fraction: FractionTool,
  quadratic: QuadraticTool,
  spreadsheet: SpreadsheetTool,
  'chart-maker': ChartMakerTool,
  resume: ResumeTool,
  'video-studio': VideoStudioTool,
  'bg-remove': BgRemoveTool,
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
