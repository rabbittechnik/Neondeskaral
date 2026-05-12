import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Building2,
  Home,
  Layers,
  LayoutGrid,
  MessageSquare,
  Settings,
  Shield,
  UserCircle,
} from 'lucide-react'

export type NavLeaf = { to: string; label: string }

export type NavGroup = {
  type: 'group'
  id: string
  label: string
  icon: LucideIcon
  children: NavLeaf[]
}

export type NavSingle = {
  type: 'single'
  to: string
  label: string
  icon: LucideIcon
}

export type NavEntry = NavGroup | NavSingle

export const navEntries: NavEntry[] = [
  { type: 'single', to: '/', label: 'Startseite', icon: Home },
  {
    type: 'group',
    id: 'kommunikation',
    label: 'Kommunikation',
    icon: MessageSquare,
    children: [
      { to: '/communication/chat-groups', label: 'Chat-Gruppen' },
      { to: '/communication/announcements', label: 'Mitteilungen' },
    ],
  },
  {
    type: 'group',
    id: 'organisation',
    label: 'Organisation',
    icon: LayoutGrid,
    children: [
      { to: '/schedule', label: 'Schichtplan' },
      { to: '/absences', label: 'Abwesenheiten' },
      { to: '/tasks', label: 'Aufgaben' },
      { to: '/lists', label: 'Listen' },
      { to: '/documents', label: 'Dokumente' },
      { to: '/calendar', label: 'Terminkalender' },
      { to: '/contacts', label: 'Kontakte' },
      { to: '/counters', label: 'Zählerstände' },
    ],
  },
  {
    type: 'group',
    id: 'verwaltung',
    label: 'Verwaltung',
    icon: Shield,
    children: [
      { to: '/employees', label: 'Mitarbeiter' },
      { to: '/work-areas', label: 'Arbeitsbereiche' },
      { to: '/vacation-blocks', label: 'Urlaubssperren' },
      { to: '/holidays', label: 'Feiertage' },
    ],
  },
  {
    type: 'group',
    id: 'auswertungen',
    label: 'Auswertungen',
    icon: BarChart3,
    children: [
      { to: '/reports/payroll-time', label: 'Lohnabrechnung (Zeiterfassung)' },
      { to: '/reports/payroll-schedule', label: 'Lohnabrechnung (Schichtplan)' },
      { to: '/reports/tasks', label: 'Aufgaben' },
      { to: '/reports/absences', label: 'Abwesenheiten' },
    ],
  },
  {
    type: 'group',
    id: 'einstellungen',
    label: 'Einstellungen',
    icon: Settings,
    children: [
      { to: '/settings/general', label: 'Allgemein' },
      { to: '/settings/email', label: 'E-Mail-Benachrichtigungen' },
      { to: '/settings/appearance', label: 'Ansicht / Darstellung' },
    ],
  },
  {
    type: 'group',
    id: 'mein-konto',
    label: 'Mein Konto',
    icon: UserCircle,
    children: [
      { to: '/account', label: 'Profil' },
      { to: '/account/devices', label: 'Geräte & Apps' },
      { to: '/account/users', label: 'Benutzer verwalten' },
      { to: '/account/billing', label: 'Rechnungen' },
      { to: '/account/billing-documents', label: 'Abrechnungsunterlagen' },
    ],
  },
  {
    type: 'single',
    to: '/stations',
    label: 'Stationen verwalten',
    icon: Building2,
  },
  {
    type: 'single',
    to: '/modules',
    label: 'Module verwalten',
    icon: Layers,
  },
]
