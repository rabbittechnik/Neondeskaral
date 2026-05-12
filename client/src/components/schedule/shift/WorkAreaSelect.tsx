import { workAreas } from '../../../data/mockSchedule'
import { labelClass, selectClass } from './fieldStyles'

type Props = {
  id?: string
  value: string
  onChange: (workAreaId: string) => void
  disabled?: boolean
  error?: string
}

export function WorkAreaSelect({ id, value, onChange, disabled, error }: Props) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Arbeitsbereich
      </label>
      <select
        id={id}
        className={`${selectClass} ${error ? 'border-red-400/50' : ''}`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Bereich wählen —</option>
        {workAreas.map((w) => (
          <option key={w.id} value={w.id}>
            {w.shortCode} · {w.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
    </div>
  )
}
