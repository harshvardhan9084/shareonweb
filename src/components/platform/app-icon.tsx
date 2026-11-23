'use client'

// Maps registry icon keys to lucide icons.

import { cn } from '@/lib/utils'
import {
  ArrowRightLeft,
  AudioLines,
  Baby,
  BookOpen,
  Braces,
  Brush,
  Briefcase,
  Camera,
  Captions,
  Code,
  FileSearch,
  FileStack,
  FileText,
  Fingerprint,
  FolderUp,
  GraduationCap,
  HandHelping,
  Image,
  Images,
  KeyRound,
  LifeBuoy,
  MapPin,
  MessagesSquare,
  Mic,
  Monitor,
  MonitorSmartphone,
  MonitorUp,
  MousePointerClick,
  Phone,
  Pointer,
  Presentation,
  Projector,
  QrCode,
  Radio,
  RadioTower,
  Smartphone,
  Sparkles,
  Table2,
  Type,
  Users,
  Video,
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
  // category + brand icons
  way: Waypoints,
  screencast: Monitor,
}

export function AppIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Sparkles
  return <Icon className={className} aria-hidden="true" />
}

// The Toolhive "hive" mark (v4): three honeycomb cells — a filled cyan cell
// on top, two green cells beneath. Drawn inline (not an <img>) so the
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
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true" focusable="false">
      <path d="M170 178 L213 103 L299 103 L342 178 L299 252 L213 252 Z" fill={node} />
      <g fill="none" stroke={edge} strokeWidth="16" strokeLinejoin="round">
        <path d="M80 336 L123 261 L209 261 L252 336 L209 411 L123 411 Z" />
        <path d="M260 336 L303 261 L389 261 L432 336 L389 411 L303 411 Z" />
      </g>
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
      <span className={cn(wordClassName, 'text-[var(--brand-wordmark)]')}>Toolhive</span>
    </span>
  )
}
