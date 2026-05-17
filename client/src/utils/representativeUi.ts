import type { RepresentativeApi } from '../types/representative'

export function telHref(raw: string): string | undefined {
  const t = raw.trim()
  if (!t) return undefined
  const cleaned = t.replace(/[^\d+]/g, '')
  return cleaned ? `tel:${cleaned}` : undefined
}

export function mailHref(email: string): string | undefined {
  const e = email.trim()
  return e ? `mailto:${e}` : undefined
}

export function webHref(url: string): string | undefined {
  const u = url.trim()
  if (!u) return undefined
  if (/^https?:\/\//i.test(u)) return u
  return `https://${u.replace(/^\/\//, '')}`
}

export function formatAddress(r: RepresentativeApi): string {
  const parts: string[] = []
  const line1 = [r.street, r.houseNumber].filter(Boolean).join(' ').trim()
  if (line1) parts.push(line1)
  const line2 = [r.postCode, r.city].filter(Boolean).join(' ').trim()
  if (line2) parts.push(line2)
  return parts.join(', ')
}

export function primaryPhone(r: RepresentativeApi): string {
  return r.mobile1.trim() || r.mobile2.trim() || r.phone.trim()
}

const CATEGORY_BADGE: Record<string, string> = {
  Tabak: 'border-amber-400/40 bg-amber-500/15 text-amber-100',
  Gas: 'border-sky-400/40 bg-sky-500/15 text-sky-100',
  'Hauptlieferant / Aral': 'border-rose-400/50 bg-rose-500/20 text-rose-50 ring-1 ring-rose-400/30',
  Technik: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100',
  'Bank / Kasse': 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
  Lotto: 'border-violet-400/40 bg-violet-500/15 text-violet-100',
  Lebensmittel: 'border-lime-400/40 bg-lime-500/15 text-lime-100',
  Waschanlage: 'border-blue-400/40 bg-blue-500/15 text-blue-100',
  'TÜV / Sicherheit': 'border-orange-400/40 bg-orange-500/15 text-orange-100',
  'Getränke / Energy': 'border-red-400/40 bg-red-500/15 text-red-100',
  'Shop / Warenlieferant': 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100',
  'Papier / Hygiene': 'border-stone-400/40 bg-stone-500/15 text-stone-100',
  'Ausbildung / IHK': 'border-indigo-400/40 bg-indigo-500/15 text-indigo-100',
  'E-Zigaretten / Liquids': 'border-teal-400/40 bg-teal-500/15 text-teal-100',
  Lederwaren: 'border-yellow-400/40 bg-yellow-500/15 text-yellow-100',
  'Tankstelle / Energie': 'border-purple-400/40 bg-purple-500/15 text-purple-100',
  Sonstige: 'border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-muted)]',
}

export function categoryBadgeClass(category: string): string {
  return CATEGORY_BADGE[category] ?? CATEGORY_BADGE.Sonstige
}
