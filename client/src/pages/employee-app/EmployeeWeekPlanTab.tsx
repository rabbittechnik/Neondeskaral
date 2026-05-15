import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { employeeAccessGetWeekSchedule } from '../../services/api'
import type { EmployeeWeekSchedulePayload, EmployeeWeekScheduleShift } from '../../types/employeeApp'
import { Button } from '../../components/ui/Button'
import {
  addDaysYmd,
  formatDateDE,
  formatShiftTimeRangeDE,
  formatWeekdayLongDE,
  getIsoCalendarWeekForMonday,
  getMondayOfWeekContaining,
} from '../../utils/dateFormat'

type Props = { accessToken: string; viewerEmployeeId?: string }

function employeeLabel(emp: EmployeeWeekScheduleShift['employee']): string {
  if (!emp) return 'Offene Schicht'
  const s = emp.shortName?.trim()
  if (s) return s
  return emp.displayName || 'Mitarbeiter'
}

export function EmployeeWeekPlanTab({ accessToken, viewerEmployeeId }: Props) {
  const [weekMonday, setWeekMonday] = useState(() => getMondayOfWeekContaining())
  const weekSunday = useMemo(() => addDaysYmd(weekMonday, 6), [weekMonday])
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading')
  const [data, setData] = useState<EmployeeWeekSchedulePayload | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    const res = await employeeAccessGetWeekSchedule<EmployeeWeekSchedulePayload>(accessToken, weekMonday)
    if (!res.ok) {
      setState('err')
      setData(null)
      return
    }
    setData(res.data)
    setState('ok')
  }, [accessToken, weekMonday])

  useEffect(() => {
    void load()
  }, [load])

  const byDate = useMemo(() => {
    if (!data) return new Map<string, EmployeeWeekScheduleShift[]>()
    const m = new Map<string, EmployeeWeekScheduleShift[]>()
    for (const s of data.shifts) {
      const arr = m.get(s.date) ?? []
      arr.push(s)
      m.set(s.date, arr)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return m
  }, [data])

  const dayKeys = useMemo(() => {
    const keys: string[] = []
    for (let i = 0; i < 7; i++) keys.push(addDaysYmd(weekMonday, i))
    return keys
  }, [weekMonday])

  const waName = (id: string) => data?.workAreas.find((w) => w.id === id)?.name ?? id

  const { week: kw } = getIsoCalendarWeekForMonday(weekMonday)

  const isViewerShift = (s: EmployeeWeekScheduleShift) =>
    Boolean(viewerEmployeeId) && (s.employeeId === viewerEmployeeId || s.employee?.id === viewerEmployeeId)

  if (state === 'err') {
    return (
      <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
        Der Wochenplan konnte nicht geladen werden.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-white/15 px-3 py-2"
            onClick={() => setWeekMonday((w) => addDaysYmd(w, -7))}
          >
            <ChevronLeft className="h-4 w-4 sm:mr-1" aria-hidden />
            <span className="hidden text-xs sm:inline">Vorherige Woche</span>
          </Button>
          <Button type="button" variant="outline" className="border-white/15 px-3 py-2" onClick={() => setWeekMonday(getMondayOfWeekContaining())}>
            Heute
          </Button>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-white/15 px-3 py-2"
            onClick={() => setWeekMonday((w) => addDaysYmd(w, 7))}
          >
            <span className="hidden text-xs sm:inline">Nächste Woche</span>
            <ChevronRight className="h-4 w-4 sm:ml-1" aria-hidden />
          </Button>
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-right">
          <p className="text-sm font-semibold text-cyan-100">KW {kw}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {formatDateDE(weekMonday)} – {formatDateDE(weekSunday)}
          </p>
        </div>
      </div>

      {state === 'loading' ? <p className="text-slate-400">Wochenplan wird geladen…</p> : null}

      {state === 'ok' && data && data.weekPublished === false ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Der Dienstplan für KW {kw} wurde noch nicht veröffentlicht. Es werden keine Schichten angezeigt.
        </p>
      ) : null}

      {/* Mobil: Tageskarten */}
      <div className="space-y-4 md:hidden">
        {dayKeys.map((date) => {
          const list = byDate.get(date) ?? []
          return (
            <section key={date} className="rounded-2xl border border-white/10 bg-slate-900/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <h3 className="text-xl font-bold tracking-tight text-white">{formatWeekdayLongDE(date)}</h3>
              <p className="mt-0.5 text-sm text-slate-400">{formatDateDE(date)}</p>
              {list.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Keine Schichten.</p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {list.map((s) => {
                    const col = s.employee?.color ?? '#64748b'
                    const label = employeeLabel(s.employee)
                    const mine = isViewerShift(s)
                    return (
                      <li
                        key={s.id}
                        className={`rounded-xl border px-3 py-3 text-sm ${mine ? 'ring-2 ring-cyan-400/50' : ''}`}
                        style={{
                          borderColor: mine ? `${col}99` : `${col}66`,
                          background: mine
                            ? `linear-gradient(135deg, ${col}28, rgba(15,23,42,0.92))`
                            : `linear-gradient(135deg, ${col}18, rgba(15,23,42,0.9))`,
                          boxShadow: mine ? `0 0 28px ${col}55, 0 0 12px rgba(34,211,238,0.25)` : `0 0 16px ${col}22`,
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{label}</p>
                          {mine ? (
                            <span className="rounded-full border border-cyan-400/50 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100">
                              Deine Schicht
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-slate-100">{formatShiftTimeRangeDE(s.startTime, s.endTime)}</p>
                        <p className="mt-0.5 text-xs text-slate-400">Arbeitsbereich: {waName(s.workAreaId)}</p>
                        {s.publicationStatus === 'draft' ? (
                          <span className="mt-1 inline-block rounded border border-amber-400/40 px-1.5 py-0.5 text-[10px] text-amber-100">
                            Entwurf
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {/* Desktop: 7 Spalten */}
      <div className="hidden overflow-x-auto md:block">
        <div className="grid min-w-[720px] grid-cols-7 gap-2">
          {dayKeys.map((date) => {
            const list = byDate.get(date) ?? []
            return (
              <div key={date} className="flex flex-col rounded-xl border border-white/10 bg-slate-900/40 p-2">
                <p className="border-b border-white/10 pb-2 text-center leading-tight">
                  <span className="block text-[10px] font-bold text-white">{formatWeekdayLongDE(date)}</span>
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-500">{formatDateDE(date)}</span>
                </p>
                <ul className="mt-2 flex flex-1 flex-col gap-2">
                  {list.length === 0 ? <li className="text-center text-[10px] text-slate-500">—</li> : null}
                  {list.map((s) => {
                    const col = s.employee?.color ?? '#64748b'
                    const mine = isViewerShift(s)
                    return (
                      <li
                        key={s.id}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] leading-snug ${mine ? 'ring-1 ring-cyan-400/45' : ''}`}
                        style={{
                          borderColor: mine ? `${col}88` : `${col}55`,
                          background: mine ? `${col}22` : `${col}14`,
                          boxShadow: mine ? `0 0 14px ${col}44` : undefined,
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-1">
                          <p className="font-medium text-white">{employeeLabel(s.employee)}</p>
                          {mine ? (
                            <span className="rounded bg-cyan-500/20 px-1 py-0 text-[9px] font-semibold text-cyan-100">Du</span>
                          ) : null}
                        </div>
                        <p className="text-slate-200">{formatShiftTimeRangeDE(s.startTime, s.endTime)}</p>
                        <p className="text-slate-500">{waName(s.workAreaId)}</p>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-500">Nur Ansicht · Schichten der Station ({data?.stationName ?? '…'})</p>
    </div>
  )
}
