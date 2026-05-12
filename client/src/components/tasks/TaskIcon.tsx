import type { LucideIcon } from 'lucide-react'
import {
  Brush,
  ClipboardList,
  Clock,
  Coffee,
  Droplets,
  FileCheck,
  Fuel,
  MapPin,
  Package,
  ShoppingCart,
  Sparkles,
  Sunrise,
} from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  package: Package,
  sparkles: Sparkles,
  sunrise: Sunrise,
  coffee: Coffee,
  'shopping-cart': ShoppingCart,
  'clipboard-list': ClipboardList,
  clock: Clock,
  'map-pin': MapPin,
  droplets: Droplets,
  brush: Brush,
  fuel: Fuel,
  'file-check': FileCheck,
}

type Props = {
  name?: string
  className?: string
}

export function TaskIcon({ name, className = 'h-4 w-4' }: Props) {
  const Icon = (name && MAP[name]) || ClipboardList
  return <Icon className={className} aria-hidden />
}
