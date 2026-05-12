import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { VacationBlock } from '../../types/absence'
import { useAbsences } from '../../context/absences-context'
import { WORK_AREA_DEFINITIONS } from '../../data/mockEmployees'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmDialog } from '../ui/ConfirmDialog'

type Props = {
  onAdd: () => void
  onEdit: (b: VacationBlock) => void
}

export function VacationBlocksView({ onAdd, onEdit }: Props) {
  const { vacationBlocks, removeVacationBlock } = useAbsences()
  const [delId, setDelId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" type="button" onClick={onAdd} leftIcon={<Plus className="h-4 w-4" />}>
          Urlaubssperre
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {vacationBlocks.map((vb) => (
          <Card key={vb.id} padding="md" className="border-orange-400/20">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-main)]">{vb.title}</h4>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {vb.startDate} – {vb.endDate}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  vb.active
                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                    : 'border-white/15 bg-white/5 text-[var(--text-faint)]'
                }`}
              >
                {vb.active ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--text-faint)]">{vb.description}</p>
            <p className="mt-2 text-[10px] font-medium text-[var(--text-muted)]">
              Bereiche:{' '}
              {vb.workAreaIds
                .map((id) => WORK_AREA_DEFINITIONS.find((w) => w.id === id)?.shortCode ?? id)
                .join(', ')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => onEdit(vb)} leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                Bearbeiten
              </Button>
              <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-300" onClick={() => setDelId(vb.id)} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
                Löschen
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(delId)}
        title="Urlaubssperre löschen?"
        message="Die Sperre wird entfernt."
        confirmLabel="Löschen"
        variant="danger"
        onCancel={() => setDelId(null)}
        onConfirm={() => {
          if (delId) removeVacationBlock(delId)
          setDelId(null)
        }}
      />
    </div>
  )
}
