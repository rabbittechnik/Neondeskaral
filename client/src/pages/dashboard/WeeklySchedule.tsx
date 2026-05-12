import { Fragment } from 'react'
import { Card } from '../../components/ui/Card'
import {
  scheduleRows,
  shiftLegend,
  weekDays,
  type ShiftCell,
} from './dashboardData'

const extraStyles: Partial<Record<ShiftCell, string>> = {
  mittel: 'bg-sky-500/80 text-white',
  kurz: 'bg-teal-500/85 text-teal-950',
}

function cellClass(cell: ShiftCell) {
  const fromLegend = shiftLegend.find((l) => l.key === cell)
  if (fromLegend) return fromLegend.className
  return extraStyles[cell] ?? 'bg-white/10 text-[var(--text-main)]'
}

function cellLabel(cell: ShiftCell) {
  const fromLegend = shiftLegend.find((l) => l.key === cell)
  if (fromLegend) return fromLegend.label
  if (cell === 'mittel') return 'Mittel'
  if (cell === 'kurz') return 'Kurz'
  return cell
}

export function WeeklySchedule() {
  return (
    <Card className="overflow-x-auto">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="text-base font-semibold text-[var(--text-main)]">
          Schichtplan – Diese Woche
        </h3>
        <div className="flex flex-wrap gap-2">
          {shiftLegend.map((l) => (
            <span
              key={l.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-[var(--text-muted)]"
            >
              <span className={`h-2.5 w-2.5 rounded-sm ${l.className}`} />
              {l.label}
              {l.time ? <span className="text-[var(--text-faint)]">· {l.time}</span> : null}
            </span>
          ))}
        </div>
      </div>

      <div className="min-w-[720px]">
        <div
          className="grid gap-px rounded-[var(--radius-sm)] bg-[var(--border-subtle)] text-xs"
          style={{
            gridTemplateColumns: `160px repeat(${weekDays.length}, minmax(0,1fr))`,
          }}
        >
          <div className="rounded-tl-[var(--radius-sm)] bg-[var(--bg-elevated)] p-2 font-medium text-[var(--text-muted)]">
            Mitarbeiter
          </div>
          {weekDays.map((d) => (
            <div
              key={d.date}
              className="bg-[var(--bg-elevated)] p-2 text-center font-medium text-[var(--text-muted)]"
            >
              <div>{d.short}</div>
              <div className="text-[10px] text-[var(--text-faint)]">{d.date}</div>
            </div>
          ))}

          {scheduleRows.map((row, ri) => (
            <Fragment key={row.name}>
              <div
                className={`bg-[var(--bg-card)] p-2 text-[11px] font-medium text-[var(--text-main)] ${
                  ri === scheduleRows.length - 1 ? 'rounded-bl-[var(--radius-sm)]' : ''
                }`}
              >
                {row.name}
              </div>
              {row.cells.map((c, ci) => (
                <div
                  key={`${row.name}-${ci}`}
                  className={`flex items-center justify-center bg-[var(--bg-card)] p-1.5 ${
                    ri === scheduleRows.length - 1 && ci === row.cells.length - 1
                      ? 'rounded-br-[var(--radius-sm)]'
                      : ''
                  }`}
                >
                  <span
                    className={`flex h-8 w-full items-center justify-center rounded-[6px] text-[10px] font-semibold uppercase tracking-wide ${cellClass(c)}`}
                  >
                    {cellLabel(c)}
                  </span>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </Card>
  )
}
