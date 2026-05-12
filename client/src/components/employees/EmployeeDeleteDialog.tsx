import { Button } from '../ui/Button'
import type { Employee } from '../../types/employee'

type Props = {
  open: boolean
  employee: Employee | null
  busy: boolean
  onClose: () => void
  onDeactivateInstead: () => void | Promise<void>
  onHardDelete: () => void | Promise<void>
}

export function EmployeeDeleteDialog({ open, employee, busy, onClose, onDeactivateInstead, onHardDelete }: Props) {
  if (!open || !employee) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-lg rounded-[var(--radius-md)] border border-red-400/35 bg-[var(--bg-card)] p-6 shadow-[0_0_40px_rgba(248,113,113,0.15)]"
      >
        <h2 className="text-lg font-semibold text-[var(--text-main)]">Mitarbeiter wirklich löschen?</h2>
        <p className="mt-2 text-sm font-medium text-[var(--text-main)]">{employee.displayName}</p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
          Dieser Vorgang kann Auswirkungen auf Schichtplan, Arbeitszeiten und historische Daten haben. Wenn bereits
          Schichten oder Arbeitszeiten vorhanden sind, wird empfohlen, den Mitarbeiter nur zu deaktivieren.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button variant="ghost" type="button" disabled={busy} onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="outline"
            type="button"
            disabled={busy}
            onClick={() => {
              void onDeactivateInstead()
            }}
          >
            Deaktivieren statt löschen
          </Button>
          <Button variant="danger" type="button" disabled={busy} onClick={() => void onHardDelete()}>
            Endgültig löschen
          </Button>
        </div>
      </div>
    </div>
  )
}
