import { labelClass, selectClass } from './fieldStyles'

export type ShiftEmployeeOption = {
  id: string
  displayName: string
  role: string
}

type Props = {
  id?: string
  value: string
  onChange: (employeeId: string) => void
  disabled?: boolean
  options: ShiftEmployeeOption[]
}

export function EmployeeSelect({ id, value, onChange, disabled, options }: Props) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Mitarbeiter <span className="text-[var(--text-faint)]">(optional)</span>
      </label>
      <select
        id={id}
        className={selectClass}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Offene Schicht (unbesetzt)</option>
        {options.map((e) => (
          <option key={e.id} value={e.id}>
            {e.displayName} · {e.role}
          </option>
        ))}
      </select>
    </div>
  )
}
