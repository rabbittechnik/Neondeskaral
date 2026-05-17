type Props = {
  className?: string
  /** Kurzlabel auf Karten; Standard: Reserve aktiv */
  label?: string
}

/** Badge für Einsatzreserve bei Personalengpass (lesbar in Dark & Light Mode). */
export function EmployeeReserveBadge({ className = '', label = 'Reserve aktiv' }: Props) {
  return (
    <span
      className={`inline-flex rounded-full border border-amber-500/45 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 shadow-[0_0_10px_rgba(251,191,36,0.15)] dark:text-amber-100 ${className}`}
      title="Darf bei Personalengpass vom Schichtplan-Assistenten vorgeschlagen werden"
    >
      {label}
    </span>
  )
}
