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

export function DashboardPage() {
  return (
    <div className="space-y-4 pb-6">
      <section className="grid gap-3 xl:grid-cols-12 xl:items-stretch">
        <div className="space-y-3 xl:col-span-8">
          <TuvReportDashboardReminder />
          <WelcomeBanner />
        </div>
        <div className="xl:col-span-4">
          <DashboardStats />
        </div>
      </section>

      <ActiveAttendanceBar />

      <section className="grid gap-3 xl:grid-cols-12 xl:items-stretch">
        <div className="space-y-3 xl:col-span-8">
          <WeeklySchedule />
        </div>
        <div className="space-y-3 xl:col-span-4">
          <PendingTimeApprovalsCard />
          <PendingAbsencesCard />
          <UnfilledShiftsCard />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <QuickActions />
        </div>
        <div className="lg:col-span-4">
          <BirthdaysCard />
        </div>
        <div className="lg:col-span-4">
          <WeatherCard />
        </div>
      </section>
    </div>
  )
}
