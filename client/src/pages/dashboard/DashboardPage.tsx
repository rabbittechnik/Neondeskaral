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
    <div className="min-w-0 max-w-full space-y-4 pb-6">
      <section className="grid min-w-0 grid-cols-1 gap-3 min-[1400px]:grid-cols-12 min-[1400px]:items-stretch">
        <div className="min-w-0 space-y-3 min-[1400px]:col-span-8">
          <TuvReportDashboardReminder />
          <WelcomeBanner />
        </div>
        <div className="min-w-0 min-[1400px]:col-span-4">
          <DashboardStats />
        </div>
      </section>

      <ActiveAttendanceBar />

      <section className="grid min-w-0 grid-cols-1 gap-3 min-[1400px]:grid-cols-12 min-[1400px]:items-stretch">
        <div className="min-w-0 space-y-3 min-[1400px]:col-span-8">
          <WeeklySchedule />
        </div>
        <div className="min-w-0 space-y-3 min-[1400px]:col-span-4">
          <PendingTimeApprovalsCard />
          <PendingAbsencesCard />
          <UnfilledShiftsCard />
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-3 min-[1024px]:grid-cols-2 min-[1400px]:grid-cols-12">
        <div className="min-w-0 min-[1400px]:col-span-4">
          <QuickActions />
        </div>
        <div className="min-w-0 min-[1400px]:col-span-4">
          <BirthdaysCard />
        </div>
        <div className="min-w-0 min-[1400px]:col-span-4">
          <WeatherCard />
        </div>
      </section>
    </div>
  )
}
