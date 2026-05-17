import { useMemo, useState } from 'react'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { labelClass } from '../schedule/shift/fieldStyles'
import { Button } from '../ui/Button'
import {
  EMPLOYEE_COLOR_PRESET_ENTRIES,
  EMPLOYEE_COLOR_PRESETS,
  colorsMatch,
  findEmployeesUsingColor,
  getReadableTextColor,
  isValidHexColor,
  normalizeHexColor,
  presetLabelForHex,
  suggestNextEmployeeColor,
  type EmployeeColorUsage,
} from '../../utils/employeeColors'

type EmployeeColorRef = {
  id: string
  displayName?: string
  color?: string
  status?: string
}

type Props = {
  id?: string
  value: string
  onChange: (hex: string) => void
  disabled?: boolean
  employees?: EmployeeColorRef[]
  currentEmployeeId?: string
}

export function ColorPickerField({
  id,
  value,
  onChange,
  disabled,
  employees = [],
  currentEmployeeId,
}: Props) {
  const [hexDraft, setHexDraft] = useState('')
  const normalized = normalizeHexColor(value) ?? ''
  const displayHex = normalized || value.trim()
  const valid = isValidHexColor(value)
  const textOnColor = getReadableTextColor(valid ? normalized : '#22d3ee')

  const usedByHex = useMemo(() => {
    const map = new Map<string, EmployeeColorUsage[]>()
    for (const e of employees) {
      if (e.status === 'geloescht') continue
      const hex = normalizeHexColor(e.color)
      if (!hex) continue
      const list = map.get(hex) ?? []
      list.push({ employeeId: e.id, displayName: e.displayName?.trim() || 'Mitarbeiter' })
      map.set(hex, list)
    }
    return map
  }, [employees])

  const duplicates = useMemo(
    () => (valid ? findEmployeesUsingColor(employees, normalized, currentEmployeeId) : []),
    [employees, normalized, valid, currentEmployeeId],
  )

  const freePresetCount = useMemo(() => {
    let n = 0
    for (const hex of EMPLOYEE_COLOR_PRESETS) {
      const users = usedByHex.get(hex) ?? []
      const onlySelf =
        users.length === 1 && currentEmployeeId && users[0]?.employeeId === currentEmployeeId
      if (users.length === 0 || onlySelf) n++
    }
    return n
  }, [usedByHex, currentEmployeeId])

  const applyHex = (raw: string) => {
    const n = normalizeHexColor(raw)
    if (n) onChange(n)
    else onChange(raw)
  }

  const pickerValue = valid ? normalized : '#22d3ee'

  return (
    <div className="space-y-3">
      <span id={id} className={labelClass}>
        Farbe im Schichtplan
      </span>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex h-12 min-w-[8.5rem] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 text-sm font-semibold shadow-[0_0_16px_rgba(0,0,0,0.25)]"
          style={{
            backgroundColor: valid ? normalized : 'var(--bg-elevated)',
            color: valid ? textOnColor : 'var(--text-muted)',
          }}
          title={valid ? displayHex : 'Ungültige Farbe'}
        >
          {valid ? (presetLabelForHex(normalized) ?? displayHex) : 'Vorschau'}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
            Farbwähler
          </label>
          <input
            type="color"
            disabled={disabled}
            value={pickerValue}
            onChange={(e) => applyHex(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-[var(--border-strong)] bg-transparent p-0.5 disabled:opacity-40"
            aria-label="Farbe frei wählen"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
            HEX-Code
          </label>
          <input
            type="text"
            disabled={disabled}
            value={hexDraft || displayHex}
            onFocus={() => setHexDraft(displayHex)}
            onBlur={() => setHexDraft('')}
            onChange={(e) => {
              const v = e.target.value
              setHexDraft(v)
              if (normalizeHexColor(v)) applyHex(v)
            }}
            placeholder="#22d3ee"
            className="mt-0.5 w-full max-w-[11rem] rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2 py-1.5 font-mono text-xs text-[var(--text-main)]"
          />
          {!valid && value.trim() ? (
            <p className="mt-1 text-[10px] text-amber-200/90">Bitte gültigen HEX-Code eingeben (z. B. #22d3ee).</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="gap-1.5 text-xs"
          onClick={() => applyHex(suggestNextEmployeeColor(employees, currentEmployeeId))}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Freie Farbe vorschlagen
        </Button>
        <span className="text-[10px] text-[var(--text-faint)]">
          {freePresetCount} Preset-Farben noch unvergeben
        </span>
      </div>

      {duplicates.length > 0 ? (
        <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-amber-400/35 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-100/95">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Diese Farbe wird bereits von{' '}
            <span className="font-medium">{duplicates.map((d) => d.displayName).join(', ')}</span> verwendet. Sie können
            sie trotzdem speichern.
          </span>
        </p>
      ) : null}

      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
          Farbpalette ({EMPLOYEE_COLOR_PRESETS.length} Farben)
        </p>
        <div className="max-h-44 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-black/10 p-2 [scrollbar-width:thin]">
          <div className="flex flex-wrap gap-1.5">
            {EMPLOYEE_COLOR_PRESET_ENTRIES.map((preset) => {
              const hex = normalizeHexColor(preset.hex)!
              const users = usedByHex.get(hex) ?? []
              const usedByOthers = users.filter((u) => u.employeeId !== currentEmployeeId)
              const selected = colorsMatch(value, hex)
              return (
                <button
                  key={hex}
                  type="button"
                  disabled={disabled}
                  title={`${preset.label} (${hex})${usedByOthers.length ? ` — belegt: ${usedByOthers.map((u) => u.displayName).join(', ')}` : ''}`}
                  onClick={() => applyHex(hex)}
                  className={`relative h-8 w-8 rounded-full border-2 transition hover:scale-110 focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:opacity-40 ${
                    selected
                      ? 'border-white ring-2 ring-cyan-400/70'
                      : usedByOthers.length
                        ? 'border-amber-300/50 opacity-75'
                        : 'border-white/25'
                  }`}
                  style={{
                    backgroundColor: hex,
                    boxShadow: `0 0 10px ${hex}55`,
                  }}
                  aria-label={`${preset.label} ${hex}`}
                >
                  {usedByOthers.length ? (
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-black"
                      aria-hidden
                    >
                      !
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-[var(--text-faint)]">
          Orange markiert = bereits von anderem Mitarbeiter vergeben. Bestehende Farben in der Datenbank bleiben
          unverändert.
        </p>
      </div>
    </div>
  )
}

