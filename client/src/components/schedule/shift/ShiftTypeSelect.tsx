import { getShiftTypeDef } from '../../../data/mockSchedule'
import type { ShiftTypeId } from '../../../data/mockSchedule'
import { FORM_SHIFT_TYPES } from './shiftDefaults'
import { labelClass, selectClass } from './fieldStyles'

type Props = {
  id?: string
  value: ShiftTypeId
  onChange: (v: ShiftTypeId) => void
  disabled?: boolean
  error?: string
}

export function ShiftTypeSelect({ id, value, onChange, disabled, error }: Props) {
  const optionIds: ShiftTypeId[] = FORM_SHIFT_TYPES.includes(value)
    ? FORM_SHIFT_TYPES
    : [value, ...FORM_SHIFT_TYPES]

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Schichttyp
      </label>
      <select
        id={id}
        className={`${selectClass} ${error ? 'border-red-400/50' : ''}`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ShiftTypeId)}
      >
        {optionIds.map((tid) => {
          const def = getShiftTypeDef(tid)
          return (
            <option key={tid} value={tid}>
              {def.label}
              {def.legendTime ? ` · ${def.legendTime}` : ''}
            </option>
          )
        })}
      </select>
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
    </div>
  )
}
