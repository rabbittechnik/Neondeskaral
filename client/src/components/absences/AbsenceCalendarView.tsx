import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { AbsenceMonthCalendar } from './AbsenceMonthCalendar'
import type { Absence } from '../../types/absence'
import type { Employee } from '../../types/employee'
import type { GermanState } from '../../data/germanHolidays'

type Props = {
  absences: Absence[]
  employees: Employee[]
  federalState: GermanState
}

export function AbsenceCalendarView({ absences, employees, federalState }: Props) {
  const [anchor, setAnchor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const employeesById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  const prev = () => setAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const next = () => setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  const today = () => {
    const n = new Date()
    setAnchor(new Date(n.getFullYear(), n.getMonth(), 1))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" type="button" onClick={prev} leftIcon={<ChevronLeft className="h-4 w-4" />}>
          Monat
        </Button>
        <Button variant="outline" type="button" onClick={today} leftIcon={<RotateCcw className="h-4 w-4" />}>
          Heute
        </Button>
        <Button variant="outline" type="button" onClick={next} leftIcon={<ChevronRight className="h-4 w-4" />}>
          Monat
        </Button>
      </div>
      <AbsenceMonthCalendar
        anchorMonth={anchor}
        absences={absences}
        employeesById={employeesById}
        federalState={federalState}
      />
    </div>
  )
}
