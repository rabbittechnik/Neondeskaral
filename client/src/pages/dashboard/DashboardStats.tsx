import { CalendarClock, ClipboardList, Plane, UserX } from 'lucide-react'
import { StatCard } from '../../components/ui/StatCard'

export function DashboardStats() {
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <StatCard
        title="Heute im Dienst"
        value="7 von 11 geplant"
        icon={<CalendarClock className="h-5 w-5 text-cyan-200" />}
        accentClass="neon-border-cyan"
      />
      <StatCard
        title="Offene Aufgaben"
        value="12"
        hint={<span className="text-red-300">3 überfällig</span>}
        icon={<ClipboardList className="h-5 w-5 text-lime-200" />}
        accentClass="neon-border-lime"
      />
      <StatCard
        title="Abwesenheiten"
        value="3 heute"
        icon={<Plane className="h-5 w-5 text-pink-200" />}
        accentClass="neon-border-pink"
      />
      <StatCard
        title="Offene Schichten"
        value="2 diese Woche"
        icon={<UserX className="h-5 w-5 text-amber-200" />}
        accentClass="neon-border-amber"
      />
    </div>
  )
}
