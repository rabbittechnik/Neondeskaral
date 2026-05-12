import type { Task, TaskRecurrence } from '../../types/task'
import type { Employee } from '../../types/employee'
import type { WorkAreaDefinition } from '../../types/employee'
import { TASK_RECURRENCE_LABELS } from './taskLabels'

const WD = [
  { v: 1, l: 'Mo' },
  { v: 2, l: 'Di' },
  { v: 3, l: 'Mi' },
  { v: 4, l: 'Do' },
  { v: 5, l: 'Fr' },
  { v: 6, l: 'Sa' },
  { v: 0, l: 'So' },
]

const ICONS = [
  { id: '', l: '—' },
  { id: 'package', l: 'Paket' },
  { id: 'sparkles', l: 'Reinigung' },
  { id: 'sunrise', l: 'Sonnenaufgang' },
  { id: 'coffee', l: 'Kaffee' },
  { id: 'shopping-cart', l: 'Waren' },
  { id: 'clipboard-list', l: 'Liste' },
  { id: 'clock', l: 'Uhr' },
  { id: 'map-pin', l: 'Ort' },
  { id: 'droplets', l: 'Wasser' },
  { id: 'brush', l: 'Bürste' },
  { id: 'fuel', l: 'Kraftstoff' },
  { id: 'file-check', l: 'Dokument' },
]

type Props = {
  value: Task
  onChange: (patch: Partial<Task>) => void
  employees: Employee[]
  workAreas: WorkAreaDefinition[]
}

export function TaskForm({ value: t, onChange, employees, workAreas }: Props) {
  const toggleWeekday = (v: number) => {
    const cur = t.weekdays ?? []
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v].sort((a, b) => a - b)
    onChange({ weekdays: next })
  }

  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
      <label className="block text-xs text-[var(--text-muted)]">
        Titel *
        <input
          value={t.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
        />
      </label>
      <label className="block text-xs text-[var(--text-muted)]">
        Beschreibung
        <textarea
          value={t.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-[var(--text-muted)]">
          Arbeitsbereich *
          <select
            value={t.workAreaId}
            onChange={(e) => onChange({ workAreaId: e.target.value })}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          >
            {workAreas.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[var(--text-muted)]">
          Icon / Kategorie
          <select
            value={t.icon ?? ''}
            onChange={(e) => onChange({ icon: e.target.value || undefined })}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          >
            {ICONS.map((i) => (
              <option key={i.id || 'none'} value={i.id}>
                {i.l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs text-[var(--text-muted)]">
        Zuständigkeitsart
        <select
          value={t.assignedType}
          onChange={(e) => onChange({ assignedType: e.target.value as Task['assignedType'] })}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
        >
          <option value="all">Alle</option>
          <option value="employee">Bestimmter Mitarbeiter</option>
          <option value="role">Rolle</option>
          <option value="workArea">Arbeitsbereich</option>
        </select>
      </label>
      {t.assignedType === 'employee' ? (
        <label className="block text-xs text-[var(--text-muted)]">
          Mitarbeiter
          <select
            value={t.assignedEmployeeId ?? ''}
            onChange={(e) => onChange({ assignedEmployeeId: e.target.value || undefined })}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          >
            <option value="">— wählen —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {t.assignedType === 'role' ? (
        <label className="block text-xs text-[var(--text-muted)]">
          Rolle (Freitext)
          <input
            value={t.assignedRole ?? ''}
            onChange={(e) => onChange({ assignedRole: e.target.value || undefined })}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            placeholder="z. B. Schichtleiter"
          />
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-[var(--text-muted)]">
          Zeitfenster Start *
          <input
            type="time"
            value={t.startTime}
            onChange={(e) => onChange({ startTime: e.target.value })}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          />
        </label>
        <label className="block text-xs text-[var(--text-muted)]">
          Zeitfenster Ende *
          <input
            type="time"
            value={t.endTime}
            onChange={(e) => onChange({ endTime: e.target.value })}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          />
        </label>
      </div>

      <label className="block text-xs text-[var(--text-muted)]">
        Wiederholung
        <select
          value={t.recurrenceType}
          onChange={(e) => onChange({ recurrenceType: e.target.value as TaskRecurrence })}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
        >
          {(Object.keys(TASK_RECURRENCE_LABELS) as TaskRecurrence[]).map((r) => (
            <option key={r} value={r}>
              {TASK_RECURRENCE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-[var(--text-muted)]">
          Startdatum *
          <input
            type="date"
            value={t.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          />
        </label>
        <label className="block text-xs text-[var(--text-muted)]">
          Enddatum (optional)
          <input
            type="date"
            value={t.endDate ?? ''}
            onChange={(e) => onChange({ endDate: e.target.value || undefined })}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          />
        </label>
      </div>

      {t.recurrenceType === 'weekly' ? (
        <fieldset>
          <legend className="text-xs text-[var(--text-muted)]">Wochentage</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {WD.map((d) => (
              <label
                key={d.v}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-black/25 px-2 py-1 text-xs text-[var(--text-main)]"
              >
                <input
                  type="checkbox"
                  checked={(t.weekdays ?? []).includes(d.v)}
                  onChange={() => toggleWeekday(d.v)}
                />
                {d.l}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {t.recurrenceType === 'monthly' ? (
        <label className="block text-xs text-[var(--text-muted)]">
          Tag im Monat (1–31)
          <input
            type="number"
            min={1}
            max={31}
            value={t.monthDay ?? 1}
            onChange={(e) => onChange({ monthDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          />
        </label>
      ) : null}

      <label className="block text-xs text-[var(--text-muted)]">
        Schicht-Hinweis (optional)
        <select
          value={t.shiftHint ?? ''}
          onChange={(e) =>
            onChange({
              shiftHint: (e.target.value || undefined) as Task['shiftHint'],
            })
          }
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
        >
          <option value="">Keiner</option>
          <option value="frueh">Frühschicht</option>
          <option value="spaet">Spätschicht</option>
        </select>
      </label>

      <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={t.mandatory} onChange={(e) => onChange({ mandatory: e.target.checked })} />
          Pflichtaufgabe
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={t.confirmRequired}
            onChange={(e) => onChange({ confirmRequired: e.target.checked })}
          />
          Bestätigung erforderlich
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={t.controlRequired}
            onChange={(e) => onChange({ controlRequired: e.target.checked })}
          />
          Kontrolle erforderlich
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={t.active} onChange={(e) => onChange({ active: e.target.checked })} />
          Aktiv
        </label>
      </div>

      <label className="block text-xs text-[var(--text-muted)]">
        Priorität
        <select
          value={t.priority}
          onChange={(e) => onChange({ priority: e.target.value as Task['priority'] })}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
        >
          <option value="niedrig">Niedrig</option>
          <option value="normal">Normal</option>
          <option value="hoch">Hoch</option>
          <option value="kritisch">Kritisch</option>
        </select>
      </label>

      <label className="block text-xs text-[var(--text-muted)]">
        Notiz
        <textarea
          value={t.note ?? ''}
          onChange={(e) => onChange({ note: e.target.value || undefined })}
          rows={2}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
        />
      </label>
    </div>
  )
}
