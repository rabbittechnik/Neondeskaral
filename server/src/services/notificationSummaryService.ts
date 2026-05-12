import type { Database } from 'better-sqlite3'
import type { AccessContext } from './stationAccessService.js'
import { hasPermission } from './stationAccessService.js'
import { countPendingApproval } from './timeTrackingService.js'
import { checkCurrentMonth } from './tuvReportService.js'
import { countRequestedAbsences, getLatestRequestedAbsenceSnippet } from './absenceService.js'

const MONTHS_DE = [
  '',
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

export type NotificationSummaryItem = {
  id: string
  type: 'time_approval' | 'tuv_report' | 'absence_request'
  severity: 'warning' | 'info'
  title: string
  message: string
  actionLabel: string
  actionRoute: string
  /** Anzahl zugrundeliegender Vorgänge (z. B. offene Zeiten) */
  detailCount?: number
}

export type NotificationSummaryResult = {
  count: number
  items: NotificationSummaryItem[]
}

export function buildNotificationsSummary(db: Database, ctx: AccessContext, stationId: string): NotificationSummaryResult {
  const items: NotificationSummaryItem[] = []

  if (hasPermission(ctx, stationId, 'time.approve')) {
    const n = countPendingApproval(db, stationId)
    if (n > 0) {
      items.push({
        id: 'pending-time-approvals',
        type: 'time_approval',
        severity: 'warning',
        title: 'Offene Zeitfreigaben',
        message: `${n} Arbeitszeit${n === 1 ? '' : 'en'} müssen geprüft werden.`,
        actionLabel: 'Zeitfreigaben öffnen',
        actionRoute: '/zeiterfassung/freigaben',
        detailCount: n,
      })
    }
  }

  if (hasPermission(ctx, stationId, 'tuvReports.view')) {
    const tuv = checkCurrentMonth(db, stationId)
    if (tuv.required && (tuv.status === 'missing' || tuv.status === 'in_progress')) {
      const mname = MONTHS_DE[tuv.month] ?? String(tuv.month)
      items.push({
        id: 'tuv-current-month',
        type: 'tuv_report',
        severity: 'warning',
        title: 'TÜV-Bericht fehlt',
        message:
          tuv.status === 'missing'
            ? `Für ${mname} ${tuv.year} wurde noch kein TÜV-Bericht angelegt.`
            : `Der TÜV-Bericht für ${mname} ${tuv.year} ist noch nicht abgeschlossen.`,
        actionLabel: 'TÜV-Bericht erstellen',
        actionRoute: '/tuv-berichte',
      })
    }
  }

  if (hasPermission(ctx, stationId, 'absences.approve')) {
    const n = countRequestedAbsences(db, stationId)
    if (n > 0) {
      const latest = getLatestRequestedAbsenceSnippet(db, stationId)
      const message =
        n === 1 && latest
          ? latest
          : `${n} Antrag${n === 1 ? '' : 'e'} warten auf Genehmigung.${latest ? ` Zuletzt: ${latest}` : ''}`
      items.push({
        id: 'pending-absence-requests',
        type: 'absence_request',
        severity: 'warning',
        title: n === 1 ? 'Neuer Urlaubsantrag' : 'Urlaubsanträge offen',
        message,
        actionLabel: 'Anträge prüfen',
        actionRoute: '/abwesenheiten?tab=antraege',
        detailCount: n,
      })
    }
  }

  const count = items.reduce((acc, it) => acc + (it.detailCount ?? 1), 0)
  return { count, items }
}
