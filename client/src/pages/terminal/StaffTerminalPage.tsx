import { useCallback, useState } from 'react'
import { STATION_NAME, STATION } from '../../data/station'
import { useEmployees } from '../../context/employees-context'
import { useScheduleShifts } from '../../context/schedule-shifts-context'
import { useTimeTracking } from '../../context/time-tracking-context'
import type { CheckInEvaluation, CheckOutEvaluation } from '../../utils/timeTrackingUtils'
import { calculateWorkedMinutes, evaluateCheckIn, evaluateCheckOut, formatWorkedDuration } from '../../utils/timeTrackingUtils'
import type { TimeEntry } from '../../types/timeTracking'
import type { CashRegisterCardEvent } from '../../types/timeTracking'
import { TerminalClock } from '../../components/terminal/TerminalClock'
import { TerminalActionButtons } from '../../components/terminal/TerminalActionButtons'
import { CashRegisterNumberModal } from '../../components/terminal/CashRegisterNumberModal'
import { TerminalResultMessage } from '../../components/terminal/TerminalResultMessage'
import { RunningStaffPanel } from '../../components/terminal/RunningStaffPanel'
import { ShiftCloseChecklistModal } from '../../components/terminal/ShiftCloseChecklistModal'
import { ShiftCloseSuccessCard } from '../../components/terminal/ShiftCloseSuccessCard'
import { Button } from '../../components/ui/Button'

type ModalMode = null | 'check-in' | 'check-out'

export function StaffTerminalPage() {
  const { employees } = useEmployees()
  const { shifts } = useScheduleShifts()
  const { timeEntries, startShiftForEmployee, completeShiftWithChecklist, logCardEvent } = useTimeTracking()

  const [modal, setModal] = useState<ModalMode>(null)
  const [checkInStep, setCheckInStep] = useState<CheckInEvaluation | null>(null)
  const [checkOutMsg, setCheckOutMsg] = useState<CheckOutEvaluation | null>(null)
  const [checkOutEntry, setCheckOutEntry] = useState<TimeEntry | null>(null)
  const [inSuccess, setInSuccess] = useState<{ name: string; time: string } | null>(null)
  const [outSuccess, setOutSuccess] = useState<{ name: string; end: string; dur: string } | null>(null)

  const log = useCallback(
    (partial: Omit<CashRegisterCardEvent, 'id' | 'scannedAt' | 'stationId'>) => {
      logCardEvent({ ...partial, stationId: STATION.id })
    },
    [logCardEvent],
  )

  const closeModal = () => {
    setModal(null)
    setCheckInStep(null)
    setCheckOutMsg(null)
  }

  const finalizeCheckIn = async (employeeId: string, note?: string) => {
    try {
      const entry = await startShiftForEmployee(employeeId, note)
      const emp = employees.find((e) => e.id === employeeId)
      const t = new Date(entry.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      setCheckInStep(null)
      setModal(null)
      setInSuccess({ name: emp?.displayName ?? 'Mitarbeiter', time: t })
      log({
        cardNumber: emp?.cashRegisterCardNumber ?? '',
        employeeId,
        actionType: 'check_in',
        result: 'success',
        message: `Schicht gestartet ${t}`,
      })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Check-in fehlgeschlagen')
    }
  }

  const onCardSubmit = (card: string) => {
    setCheckOutMsg(null)
    if (modal === 'check-in') {
      const ev = evaluateCheckIn(card, employees, shifts, timeEntries, new Date())
      if (ev.kind === 'unknown_card') {
        log({ cardNumber: card, actionType: 'check_in', result: 'unknown_card', message: 'Unbekannte Karte' })
        setCheckInStep(ev)
        return
      }
      if (ev.kind === 'already_checked_in') {
        log({
          cardNumber: card,
          employeeId: ev.employee.id,
          actionType: 'check_in',
          result: 'already_checked_in',
          message: 'Bereits eingestempelt',
        })
        setCheckInStep(ev)
        return
      }
      if (ev.kind === 'not_scheduled') {
        log({
          cardNumber: card,
          employeeId: ev.employee.id,
          actionType: 'check_in',
          result: 'not_scheduled',
          message: 'Nicht geplant',
        })
        setCheckInStep(ev)
        return
      }
      if (ev.kind === 'too_early') {
        log({
          cardNumber: card,
          employeeId: ev.employee.id,
          actionType: 'check_in',
          result: 'too_early',
          message: `${ev.minutesEarly} Min. zu früh`,
        })
        setCheckInStep(ev)
        return
      }
      if (ev.kind === 'too_late') {
        log({
          cardNumber: card,
          employeeId: ev.employee.id,
          actionType: 'check_in',
          result: 'too_late',
          message: `${ev.minutesLate} Min. zu spät`,
        })
        void finalizeCheckIn(ev.employee.id, `Zu spät: ${ev.minutesLate} Min.`)
        return
      }
      log({
        cardNumber: card,
        employeeId: ev.employee.id,
        actionType: 'check_in',
        result: 'success',
        message: 'Check-in',
      })
      void finalizeCheckIn(ev.employee.id)
      return
    }

    if (modal === 'check-out') {
      const ev = evaluateCheckOut(card, employees, timeEntries)
      if (ev.kind === 'unknown_card') {
        log({ cardNumber: card, actionType: 'check_out', result: 'unknown_card', message: 'Unbekannte Karte' })
        setCheckOutMsg(ev)
        return
      }
      if (ev.kind === 'not_checked_in') {
        log({
          cardNumber: card,
          employeeId: ev.employee.id,
          actionType: 'check_out',
          result: 'not_checked_in',
          message: 'Keine laufende Schicht',
        })
        setCheckOutMsg(ev)
        return
      }
      setModal(null)
      setCheckOutEntry(ev.entry)
      log({
        cardNumber: card,
        employeeId: ev.employee.id,
        actionType: 'check_out',
        result: 'checklist_required',
        message: 'Checkliste',
      })
    }
  }

  const renderCheckInFollowUp = () => {
    if (!checkInStep) return null
    if (checkInStep.kind === 'unknown_card') {
      return (
        <TerminalResultMessage
          variant="error"
          title="Kassenkartennummer nicht bekannt"
          message="Bitte wende dich an den Teamleiter."
        />
      )
    }
    if (checkInStep.kind === 'already_checked_in') {
      const t = new Date(checkInStep.entry.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      return (
        <TerminalResultMessage
          variant="warning"
          title="Du bist bereits eingestempelt."
          message={`Deine Schicht läuft seit ${t} Uhr.`}
        />
      )
    }
    if (checkInStep.kind === 'not_scheduled') {
      return (
        <TerminalResultMessage
          variant="warning"
          title="Für dich ist heute keine Schicht geplant."
          message={`${checkInStep.employee.displayName} — du kannst trotzdem starten oder abbrechen.`}
        >
          <Button variant="primary" type="button" onClick={() => void finalizeCheckIn(checkInStep.employee.id, 'Nicht geplant — trotzdem gestartet')}>
            Trotzdem Schicht starten
          </Button>
          <Button variant="ghost" type="button" onClick={() => setCheckInStep(null)}>
            Abbrechen
          </Button>
        </TerminalResultMessage>
      )
    }
    if (checkInStep.kind === 'too_early') {
      return (
        <TerminalResultMessage
          variant="warning"
          title="Zu früh"
          message={`Deine geplante Schicht beginnt erst um ${checkInStep.plannedStart} Uhr. Du bist ${checkInStep.minutesEarly} Minuten zu früh.`}
        >
          <Button variant="primary" type="button" onClick={() => void finalizeCheckIn(checkInStep.employee.id, 'Zu früh — trotzdem gestartet')}>
            Trotzdem Schicht starten
          </Button>
          <Button variant="ghost" type="button" onClick={() => setCheckInStep(null)}>
            Abbrechen
          </Button>
        </TerminalResultMessage>
      )
    }
    return null
  }

  const renderCheckOutMsg = () => {
    if (!checkOutMsg) return null
    if (checkOutMsg.kind === 'unknown_card') {
      return (
        <TerminalResultMessage variant="error" title="Kartennummer unbekannt" message="Bitte wende dich an den Teamleiter." />
      )
    }
    if (checkOutMsg.kind === 'not_checked_in') {
      return (
        <TerminalResultMessage
          variant="error"
          title="Keine laufende Schicht"
          message="Für diesen Mitarbeiter läuft aktuell keine Schicht. Bitte prüfe die Eingabe oder wende dich an den Teamleiter."
        />
      )
    }
    return null
  }

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-8 sm:py-12">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400/80">Neondesk</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--text-main)] sm:text-4xl md:text-5xl">Mitarbeiter-Terminal</h1>
      <p className="mt-2 text-xl text-cyan-200/90 sm:text-2xl">{STATION_NAME}</p>
      <p className="mt-1 text-sm text-[var(--text-faint)]">Mitarbeiter-Terminal</p>

      <div className="mt-8 w-full max-w-4xl">
        <TerminalClock />
      </div>

      <p className="mt-10 text-center text-lg text-[var(--text-muted)] sm:text-xl">Bitte wähle eine Aktion.</p>

      <div className="mt-8 flex w-full max-w-4xl justify-center">
        <TerminalActionButtons
          onCheckIn={() => {
            setCheckInStep(null)
            setCheckOutMsg(null)
            setInSuccess(null)
            setModal('check-in')
          }}
          onCheckOut={() => {
            setCheckInStep(null)
            setCheckOutMsg(null)
            setModal('check-out')
          }}
        />
      </div>

      <RunningStaffPanel entries={timeEntries} employees={employees} />

      <div className="mt-10 w-full max-w-3xl space-y-4">
        {inSuccess ? (
          <TerminalResultMessage
            variant="success"
            title={`Willkommen, ${inSuccess.name}`}
            message={`Deine Schicht wurde um ${inSuccess.time} Uhr gestartet.`}
          >
            <Button variant="ghost" type="button" onClick={() => setInSuccess(null)}>
              Schließen
            </Button>
          </TerminalResultMessage>
        ) : null}
        {renderCheckInFollowUp()}
        {renderCheckOutMsg()}
      </div>

      <CashRegisterNumberModal open={modal !== null} mode={modal === 'check-out' ? 'check-out' : 'check-in'} onClose={closeModal} onSubmit={onCardSubmit} />

      {checkOutEntry ? (
        <ShiftCloseChecklistModal
          open
          employeeName={employees.find((e) => e.id === checkOutEntry.employeeId)?.displayName ?? 'Mitarbeiter'}
          timeEntryId={checkOutEntry.id}
          employeeId={checkOutEntry.employeeId}
          onClose={() => setCheckOutEntry(null)}
          onComplete={async (checklist) => {
            const end = new Date().toISOString()
            try {
              await completeShiftWithChecklist(checkOutEntry.id, checklist)
            } catch (err) {
              window.alert(err instanceof Error ? err.message : 'Ausstempeln fehlgeschlagen')
              return
            }
            const mins = calculateWorkedMinutes(checkOutEntry.startAt, end, new Date())
            const name = employees.find((e) => e.id === checkOutEntry.employeeId)?.displayName ?? ''
            const endLabel = new Date(end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            setCheckOutEntry(null)
            setOutSuccess({ name, end: endLabel, dur: formatWorkedDuration(mins) })
            log({
              cardNumber: employees.find((e) => e.id === checkOutEntry.employeeId)?.cashRegisterCardNumber ?? '',
              employeeId: checkOutEntry.employeeId,
              actionType: 'check_out',
              result: 'success',
              message: 'Schicht beendet',
            })
          }}
        />
      ) : null}

      {outSuccess ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <ShiftCloseSuccessCard
            employeeName={outSuccess.name}
            endTimeLabel={outSuccess.end}
            durationLabel={outSuccess.dur}
            onDismiss={() => setOutSuccess(null)}
          />
        </div>
      ) : null}
    </div>
  )
}
