import { employeeReserveBadgeClassName } from './planning/employeeReserveDisplay'

type Props = {
  className?: string
  /** Kurzlabel auf Karten; Standard: Reserve aktiv */
  label?: string
}

/** Badge für Einsatzreserve bei Personalengpass (lesbar in Dark & Light Mode). */
export function EmployeeReserveBadge({ className = '', label = 'Reserve aktiv' }: Props) {
  return (
    <span
      className={`${employeeReserveBadgeClassName} ${className}`}
      title="Darf bei Personalengpass vom Schichtplan-Assistenten vorgeschlagen werden"
    >
      {label}
    </span>
  )
}
