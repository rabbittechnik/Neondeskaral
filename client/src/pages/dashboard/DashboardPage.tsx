import { DashboardStats } from './DashboardStats'
import {
  BirthdaysCard,
  PendingAbsencesCard,
  UnfilledShiftsCard,
  WeatherCard,
} from './DashboardSideColumn'
import { CurrentShiftPanel, UpcomingShiftPanel } from './ShiftPanels'
import { QuickActions } from './QuickActions'
import { WeeklySchedule } from './WeeklySchedule'
import { WelcomeBanner } from './WelcomeBanner'

export function DashboardPage() {
  return (
    <div className="space-y-5 pb-6">
      <section className="grid gap-4 xl:grid-cols-12 xl:items-stretch">
        <div className="xl:col-span-8">
          <WelcomeBanner />
        </div>
        <div className="xl:col-span-4">
          <DashboardStats />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <CurrentShiftPanel />
        </div>
        <div className="space-y-4 lg:col-span-4">
          <UpcomingShiftPanel />
        </div>
        <div className="lg:col-span-3">
          <QuickActions />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <WeeklySchedule />
        </div>
        <div className="space-y-4 xl:col-span-4">
          <PendingAbsencesCard />
          <UnfilledShiftsCard />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <BirthdaysCard />
        <WeatherCard />
      </section>
    </div>
  )
}
