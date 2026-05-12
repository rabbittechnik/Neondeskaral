import { inputClass, labelClass } from '../../schedule/shift/fieldStyles'

type Props = {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

export function PlanningNotesField({ value, onChange, disabled }: Props) {
  return (
    <div>
      <label className={labelClass} htmlFor="planning-notes">
        Hinweise zur Planung
      </label>
      <textarea
        id="planning-notes"
        rows={3}
        disabled={disabled}
        placeholder="z. B. Kinderbetreuung, bevorzugte Zeiten, Einschränkungen …"
        className={`${inputClass} min-h-[4.5rem] resize-y`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
