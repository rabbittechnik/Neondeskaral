import { ActiveAttendanceBar } from '../../components/dashboard/ActiveAttendanceBar'
import { DashboardStats } from './DashboardStats'
import { PendingTimeApprovalsCard } from './PendingTimeApprovalsCard'
import {
  BirthdaysCard,
  PendingAbsencesCard,
  UnfilledShiftsCard,
  WeatherCard,
} from './DashboardSideColumn'
import { QuickActions } from './QuickActions'
import { WeeklySchedule } from './WeeklySchedule'
import { WelcomeBanner } from './WelcomeBanner'
import { TuvReportDashboardReminder } from '../../components/tuv/TuvReportDashboardReminder'

const dashboardCardGrid =
  'grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]'

export function DashboardPage() {
  return (
    <div className="min-w-0 w-full max-w-full space-y-4 overflow-x-hidden pb-6">
      <TuvReportDashboardReminder />

      <section className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-stretch xl:gap-4">
        <div className="min-w-0 w-full flex-1 xl:min-w-0">
          <WelcomeBanner />
        </div>
        <div className="min-w-0 w-full shrink-0 xl:w-[min(100%,26rem)]">
          <DashboardStats />
        </div>
      </section>

      <ActiveAttendanceBar />

      <section className="min-w-0 w-full">
        <WeeklySchedule />
      </section>

      <section className={dashboardCardGrid} aria-label="Aktuelle Freigaben und offene Schichten">
        <PendingTimeApprovalsCard />
        <PendingAbsencesCard />
        <UnfilledShiftsCard />
      </section>

      <section className={dashboardCardGrid} aria-label="Weitere Dashboard-Infos">
        <QuickActions />
        <BirthdaysCard />
        <WeatherCard />
      </section>
    </div>
  )
}
