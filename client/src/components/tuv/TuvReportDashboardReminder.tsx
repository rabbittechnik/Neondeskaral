import { useEffect, useState } from 'react'
import { useStation } from '../../context/station-context'
import { apiGet } from '../../services/api'
import type { TuvCurrentMonthCheck } from '../../types/tuvReport'
import { TuvReportReminderCard } from './TuvReportReminderCard'

export function TuvReportDashboardReminder() {
  const { stationId, hasPermission } = useStation()
  const [check, setCheck] = useState<TuvCurrentMonthCheck | null>(null)

  const show =
    hasPermission('tuvReports.view') ||
    hasPermission('tuvReports.create') ||
    hasPermission('tuvReports.edit')

  useEffect(() => {
    let cancelled = false
    if (!stationId || !show) {
      setCheck(null)
      return
    }
    void (async () => {
      const res = await apiGet<TuvCurrentMonthCheck>('/tuv-reports/check-current-month', {
        stationId,
      })
      if (!cancelled && res.ok) setCheck(res.data)
    })()
    return () => {
      cancelled = true
    }
  }, [stationId, show])

  if (!show) return null

  return <TuvReportReminderCard check={check} />
}
