import type { EmployeeHRStatus } from '../../types/employee'
import type { ScheduleEmployeeRow } from '../../types/employee'
import { STATUS_LABELS } from './employeeLabels'

const hrStyles: Record<EmployeeHRStatus, string> = {
  aktiv:
    'border-emerald-400/45 bg-emerald-500/15 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.2)]',
  inaktiv: 'border-white/15 bg-white/[0.06] text-[var(--text-faint)]',
  urlaub:
    'border-cyan-400/45 bg-cyan-500/15 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.18)]',
  krank:
    'border-rose-400/45 bg-rose-500/15 text-rose-100 shadow-[0_0_12px_rgba(251,113,133,0.2)]',
  gesperrt:
    'border-red-500/50 bg-red-500/15 text-red-100 shadow-[0_0_12px_rgba(248,113,113,0.2)]',
}

const presenceStyles: Record<ScheduleEmployeeRow['schedulePresence'], string> = {
  aktiv: hrStyles.aktiv,
  inaktiv: hrStyles.inaktiv,
  urlaub: hrStyles.urlaub,
  krank: hrStyles.krank,
  gesperrt: hrStyles.gesperrt,
  frei: 'border-violet-400/45 bg-violet-500/15 text-violet-100 shadow-[0_0_12px_rgba(167,139,250,0.2)]',
  ueberstunden:
    'border-amber-400/50 bg-amber-500/15 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.22)]',
}

const presenceLabels: Record<ScheduleEmployeeRow['schedulePresence'], string> = {
  aktiv: 'Aktiv',
  inaktiv: 'Inaktiv',
  urlaub: 'Urlaub',
  krank: 'Krank',
  gesperrt: 'Gesperrt',
  frei: 'Frei',
  ueberstunden: 'Überstunden',
}

type HrProps = { variant: 'hr'; status: EmployeeHRStatus; className?: string }

type PresenceProps = {
  variant: 'presence'
  presence: ScheduleEmployeeRow['schedulePresence']
  className?: string
}

type Props = HrProps | PresenceProps

export function EmployeeStatusBadge(props: Props) {
  const base =
    'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide'
  if (props.variant === 'hr') {
    return (
      <span className={`${base} ${hrStyles[props.status]} ${props.className ?? ''}`}>
        {STATUS_LABELS[props.status]}
      </span>
    )
  }
  return (
    <span
      className={`${base} ${presenceStyles[props.presence]} ${props.className ?? ''}`}
    >
      {presenceLabels[props.presence]}
    </span>
  )
}
