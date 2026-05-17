import type { TuvReportFormData } from '../../types/tuvReport'

type Props = {
  formData: TuvReportFormData
  disabled?: boolean
  onChange: (next: TuvReportFormData) => void
}

function updateDefect(
  form: TuvReportFormData,
  id: string,
  patch: Partial<TuvReportFormData['defects'][0]>,
): TuvReportFormData {
  return {
    ...form,
    defects: form.defects.map((d) => (d.id === id ? { ...d, ...patch } : d)),
  }
}

export function TuvReportClosureSection({ formData, disabled, onChange }: Props) {
  const addDefect = () => {
    onChange({
      ...formData,
      defects: [
        ...formData.defects,
        {
          id: `def-${Date.now()}`,
          position: '',
          defectText: '',
          doneByName: '',
          dueUntil: '',
          fixedAt: '',
          fixedBySignature: '',
        },
      ],
    })
  }

  const block = (
    title: string,
    key: 'safetyCheck' | 'hsseInspection',
  ) => {
    const b = formData[key]
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/80 p-4">
        <h3 className="text-sm font-semibold text-[var(--text-main)]">{title}</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="text-[var(--text-muted)]">Name</span>
            <input
              disabled={disabled}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
              value={b.name}
              onChange={(e) => onChange({ ...formData, [key]: { ...b, name: e.target.value } })}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--text-muted)]">Funktion</span>
            <input
              disabled={disabled}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
              value={b.role}
              onChange={(e) => onChange({ ...formData, [key]: { ...b, role: e.target.value } })}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--text-muted)]">Datum</span>
            <input
              type="date"
              disabled={disabled}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
              value={b.date}
              onChange={(e) => onChange({ ...formData, [key]: { ...b, date: e.target.value } })}
            />
          </label>
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--text-main)]">Mängeltabelle</h2>
          {!disabled ? (
            <button type="button" className="text-sm text-cyan-300 hover:underline" onClick={addDefect}>
              Zeile hinzufügen
            </button>
          ) : null}
        </div>
        <div className="space-y-3">
          {formData.defects.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Keine Mängel erfasst.</p>
          ) : (
            formData.defects.map((d) => (
              <div key={d.id} className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 md:grid-cols-3">
                <input
                  disabled={disabled}
                  placeholder="Prüf-Position"
                  className="rounded border border-white/15 bg-black/30 px-2 py-1 text-sm"
                  value={d.position}
                  onChange={(e) => onChange(updateDefect(formData, d.id, { position: e.target.value }))}
                />
                <input
                  disabled={disabled}
                  placeholder="Festgestellter Mangel"
                  className="rounded border border-white/15 bg-black/30 px-2 py-1 text-sm md:col-span-2"
                  value={d.defectText}
                  onChange={(e) => onChange(updateDefect(formData, d.id, { defectText: e.target.value }))}
                />
                <input
                  disabled={disabled}
                  placeholder="Erledigung durch"
                  className="rounded border border-white/15 bg-black/30 px-2 py-1 text-sm"
                  value={d.doneByName}
                  onChange={(e) => onChange(updateDefect(formData, d.id, { doneByName: e.target.value }))}
                />
                <input
                  type="date"
                  disabled={disabled}
                  placeholder="bis"
                  className="rounded border border-white/15 bg-black/30 px-2 py-1 text-sm"
                  value={d.dueUntil}
                  onChange={(e) => onChange(updateDefect(formData, d.id, { dueUntil: e.target.value }))}
                />
                <input
                  type="date"
                  disabled={disabled}
                  placeholder="behoben am"
                  className="rounded border border-white/15 bg-black/30 px-2 py-1 text-sm"
                  value={d.fixedAt}
                  onChange={(e) => onChange(updateDefect(formData, d.id, { fixedAt: e.target.value }))}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {block('Sicherheits-Check durchgeführt', 'safetyCheck')}
      {block('HSSE-Management Inspektion durchgeführt', 'hsseInspection')}

      <label className="block text-sm">
        <span className="text-[var(--text-muted)]">Zusätzliche Anmerkungen</span>
        <textarea
          disabled={disabled}
          rows={3}
          className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
          value={formData.additionalNotes}
          onChange={(e) => onChange({ ...formData, additionalNotes: e.target.value })}
        />
      </label>
    </section>
  )
}
