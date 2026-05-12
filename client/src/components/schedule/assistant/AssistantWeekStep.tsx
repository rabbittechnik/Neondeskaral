import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { AssistantMode } from '../../../types/scheduleAssistant'
import { addDays, formatDE, getISOWeek, startOfWeekMonday } from '../scheduleWeekUtils'
import { toISODate } from '../../../data/mockSchedule'
import { Button } from '../../ui/Button'

type Props = {
  weekStartIso: string
  onWeekStartIso: (iso: string) => void
  mode: AssistantMode
  onMode: (m: AssistantMode) => void
}

const MODE_OPTIONS: { id: AssistantMode; label: string; hint: string }[] = [
  {
    id: 'fill_gaps',
    label: 'Lücken füllen',
    hint: 'Bestehende Schichten behalten, nur offene/fehlende vorschlagen (Standard).',
  },
  {
    id: 'replace_drafts',
    label: 'Assistent-Entwürfe ersetzen',
    hint: 'Entwürfe vom Assistenten in der Woche löschen und neu vorschlagen.',
  },
  {
    id: 'full_refresh',
    label: 'Komplett neu',
    hint: 'Alle Entwurfs-Schichten der Woche entfernen und neu aufbauen.',
  },
]

export function AssistantWeekStep({ weekStartIso, onWeekStartIso, mode, onMode }: Props) {
  const start = new Date(`${weekStartIso}T12:00:00`)
  const end = addDays(start, 6)
  const kw = getISOWeek(start)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="px-2"
          onClick={() => onWeekStartIso(toISODate(addDays(start, -7)))}
          aria-label="Vorherige Woche"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="px-2"
          onClick={() => onWeekStartIso(toISODate(addDays(start, 7)))}
          aria-label="Nächste Woche"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          onClick={() => onWeekStartIso(toISODate(startOfWeekMonday(new Date())))}
        >
          Aktuelle Woche
        </Button>
        <span className="text-sm text-[var(--text-main)]">
          KW {kw}: {formatDE(start)} – {formatDE(end)}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--text-muted)]">Umgang mit bestehenden Schichten</p>
        <div className="grid gap-2 sm:grid-cols-1">
          {MODE_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onMode(o.id)}
              className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-sm transition ${
                mode === o.id
                  ? 'border-cyan-400/55 bg-cyan-500/12 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.15)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-card)]/60 text-[var(--text-muted)] hover:border-cyan-400/25'
              }`}
            >
              <span className="font-medium text-[var(--text-main)]">{o.label}</span>
              <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{o.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
