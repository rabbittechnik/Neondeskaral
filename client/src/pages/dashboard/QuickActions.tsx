import { CalendarPlus, ClipboardPlus, Plane, UserPlus } from 'lucide-react'
import { Card } from '../../components/ui/Card'

const actions = [
  {
    label: 'Neue Schicht',
    icon: CalendarPlus,
    className:
      'border-cyan-400/45 text-cyan-100 hover:bg-cyan-500/10 shadow-[var(--glow-cyan)]',
  },
  {
    label: 'Neue Aufgabe',
    icon: ClipboardPlus,
    className:
      'border-lime-400/45 text-lime-100 hover:bg-lime-500/10 shadow-[var(--glow-lime)]',
  },
  {
    label: 'Neue Abwesenheit',
    icon: Plane,
    className:
      'border-pink-400/45 text-pink-100 hover:bg-pink-500/10 shadow-[var(--glow-pink)]',
  },
  {
    label: 'Neuer Mitarbeiter',
    icon: UserPlus,
    className:
      'border-amber-400/45 text-amber-100 hover:bg-amber-500/10 shadow-[var(--glow-amber)]',
  },
] as const

export function QuickActions() {
  return (
    <Card>
      <h3 className="text-base font-semibold text-[var(--text-main)]">
        Schnellaktionen
      </h3>
      <div className="mt-4 flex flex-col gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={`flex w-full items-center gap-3 rounded-[var(--radius-sm)] border bg-transparent px-4 py-3 text-left text-sm font-medium transition ${a.className}`}
          >
            <a.icon className="h-5 w-5 shrink-0" aria-hidden />
            {a.label}
          </button>
        ))}
      </div>
    </Card>
  )
}
