'use client'

// Maps registry icon keys to lucide icons.

import { cn } from '@/lib/utils'
import {
  Archive,
  ArrowRightLeft,
  AudioLines,
  Award,
  Baby,
  Banknote,
  Barcode,
  BookOpen,
  Braces,
  Brush,
  Briefcase,
  Calculator,
  CalendarClock,
  CalendarDays,
  Camera,
  CaseSensitive,
  Captions,
  CircleDot,
  Clock,
  Code,
  Dices,
  Diff,
  Expand,
  Eraser,
  FileCog,
  FileCode2,
  FileDown,
  FileImage,
  FileJson,
  FileKey,
  FileSearch,
  FileSpreadsheet,
  FileStack,
  FileText,
  Fingerprint,
  Film,
  FolderUp,
  Frame,
  Globe2,
  GraduationCap,
  HandHelping,
  HeartPulse,
  Image,
  ImageDown,
  Images,
  KeyRound,
  Keyboard,
  Landmark,
  LifeBuoy,
  ListChecks,
  ListTodo,
  Lock,
  MapPin,
  MessagesSquare,
  Binary,
  CalendarPlus,
  ChartColumn,
  Contact,
  Laugh,
  Ruler,
  Shapes,
  Mic,
  Monitor,
  MonitorSmartphone,
  MonitorUp,
  MousePointerClick,
  Paintbrush,
  Palette,
  Percent,
  Phone,
  Pointer,
  Presentation,
  Projector,
  QrCode,
  Radio,
  RadioTower,
  ReceiptText,
  Regex,
  Scale,
  Shuffle,
  Signature,
  Smartphone,
  Smile,
  Sparkles,
  Stamp,
  Sigma,
  TableProperties,
  Table2,
  Tags,
  TextQuote,
  Timer,
  Type,
  Users,
  Video,
  Waves,
  Waypoints,
  Webcam,
  Zap,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  video: Video,
  users: Users,
  phone: Phone,
  briefcase: Briefcase,
  school: GraduationCap,
  presentation: Presentation,
  monitor: MonitorUp,
  zap: Zap,
  transfer: ArrowRightLeft,
  folder: FolderUp,
  qr: QrCode,
  brush: Brush,
  chat: MessagesSquare,
  doc: FileText,
  code: Code,
  slides: Projector,
  help: HandHelping,
  'pointer-click': MousePointerClick,
  pointer: Pointer,
  lifesaver: LifeBuoy,
  radio: Radio,
  mic: Mic,
  camera: Camera,
  baby: Baby,
  tower: RadioTower,
  mappin: MapPin,
  captions: Captions,
  webcam: Webcam,
  audiolines: AudioLines,
  smartphone: Smartphone,
  monitorsmartphone: MonitorSmartphone,
  // instant tool icons
  image: Image,
  fingerprint: Fingerprint,
  braces: Braces,
  type: Type,
  key: KeyRound,
  'file-stack': FileStack,
  'file-scan': FileSearch,
  images: Images,
  sheet: Table2,
  'book-open': BookOpen,
  film: Film,
  frame: Frame,
  'circle-dot': CircleDot,
  expand: Expand,
  archive: Archive,
  'file-tools': FileCog,
  encrypt: Lock,
  'meta-scrub': Eraser,
  jwt: FileKey,
  'hash-file-batch': ListChecks,
  cron: Clock,
  diff: Diff,
  uuid: Dices,
  'convert-units': Scale,
  lorem: TextQuote,
  'fake-data': TableProperties,
  'css-tools': Paintbrush,
  'meta-tags': Tags,
  barcode: Barcode,
  calculator: Calculator,
  percentage: Percent,
  'calendar-days': CalendarDays,
  'heart-pulse': HeartPulse,
  landmark: Landmark,
  timer: Timer,
  shuffle: Shuffle,
  regex: Regex,
  'file-spreadsheet': FileSpreadsheet,
  palette: Palette,
  signature: Signature,
  receipt: ReceiptText,
  globe: Globe2,
  'file-image': FileImage,
  'file-code': FileCode2,
  'image-down': ImageDown,
  stamp: Stamp,
  keyboard: Keyboard,
  'file-text': FileText,
  sigma: Sigma,
  banknote: Banknote,
  waves: Waves,
  'case-sensitive': CaseSensitive,
  smile: Smile,
  'file-json': FileJson,
  'file-down': FileDown,
  'calendar-clock': CalendarClock,
  award: Award,
  'list-todo': ListTodo,
  laugh: Laugh,
  shapes: Shapes,
  'key-round': KeyRound,
  'chart-column': ChartColumn,
  contact: Contact,
  'calendar-plus': CalendarPlus,
  ruler: Ruler,
  binary: Binary,
  // category + brand icons
  way: Waypoints,
  screencast: Monitor,
}

export function AppIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Sparkles
  return <Icon className={className} aria-hidden="true" />
}

// The Kontivo "focus frame" mark (v5): four context brackets around a filled
// node. Drawn inline (not an <img>) so the
// favicon, the PWA icons and the in-app marks are the same drawing. Source
// of truth: brand/*.svg (see brand/README.md); geometry mirrored there —
// keep both in sync.
// Colours come from tokens.css (--brand-node / --brand-edge) so dark mode can
// brighten them; "mono" swaps everything for currentColor.
export function BrandMark({
  className,
  variant = 'color',
}: {
  className?: string
  variant?: 'color' | 'mono'
}) {
  const node = variant === 'mono' ? 'currentColor' : 'var(--brand-node)'
  const edge = variant === 'mono' ? 'currentColor' : 'var(--brand-edge)'
  // Kontivo mark (v5): a focus frame — four context brackets around a filled
  // node. The visual grammar of "context aware": attention drawn to the thing
  // in the middle, framed by what surrounds it. Keep in sync with
  // brand/brandmark.svg and brand/brandmark-mono.svg.
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true" focusable="false">
      <g fill="none" stroke={edge} strokeWidth="40" strokeLinecap="round" strokeLinejoin="round">
        <path d="M96 208 L96 96 L208 96" />
        <path d="M304 96 L416 96 L416 208" />
        <path d="M416 304 L416 416 L304 416" />
        <path d="M208 416 L96 416 L96 304" />
      </g>
      <circle cx="256" cy="256" r="64" fill={node} />
    </svg>
  )
}

// Full lockup: mark + wordmark, for brand-forward surfaces (hero, OG sheet,
// empty states). The wordmark renders in the app display face — the same
// pairing as the favicon tile + header wordmark.
export function BrandLockup({
  className,
  markClassName = 'size-8',
  wordClassName = 'font-display text-xl font-bold tracking-tight',
}: {
  className?: string
  markClassName?: string
  wordClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark className={markClassName} />
      <span className={cn(wordClassName, 'text-[var(--brand-wordmark)]')}>Kontivo</span>
    </span>
  )
}
