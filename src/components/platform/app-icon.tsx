'use client'

// Maps registry icon keys to lucide icons.

import { cn } from '@/lib/utils'
import {
  ArrowRightLeft,
  AudioLines,
  Baby,
  Brush,
  Briefcase,
  Camera,
  Captions,
  Code,
  FileText,
  FolderUp,
  GraduationCap,
  HandHelping,
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
  // category + brand icons
  way: Waypoints,
  screencast: Monitor,
}

export function AppIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Sparkles
  return <Icon className={className} aria-hidden="true" />
}

// The ShareOnWeb "network diamond" mark (v3): four blue nodes + a blue hub
// circle, green edges and junctions — the drawing from the user's reference.
// Drawn inline (not an <img>) so the favicon, the PWA icons and the in-app
// marks are the same drawing. Source of truth: brand/*.svg (see
// brand/README.md); geometry mirrored there — keep both in sync.
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
      <g fill="none" stroke={edge} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
        <path d="M256 134 L256 172" />
        <path d="M256 172 L136 234" />
        <path d="M256 172 L376 234" />
        <path d="M136 234 L256 414" />
        <path d="M376 234 L256 414" />
      </g>
      <rect x="220" y="62" width="72" height="72" rx="8" fill={node} />
      <rect x="60" y="248" width="72" height="72" rx="8" fill={node} />
      <rect x="380" y="248" width="72" height="72" rx="8" fill={node} />
      <rect x="220" y="378" width="72" height="72" rx="8" fill={node} />
      <rect x="243" y="159" width="26" height="26" rx="6" fill={edge} />
      <rect x="123" y="221" width="26" height="26" rx="6" fill={edge} />
      <rect x="363" y="221" width="26" height="26" rx="6" fill={edge} />
      <circle cx="256" cy="274" r="46" fill={node} />
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
      <span className={cn(wordClassName, 'text-[var(--brand-wordmark)]')}>ShareOnWeb</span>
    </span>
  )
}
