import { CheckCircle2 } from 'lucide-react'

type Props = {
  employeeName: string
  endTimeLabel: string
  durationLabel: string
  /** Optionaler Hinweis z. B. bei leichter Früh-End-Abweichung (≤30 Min.). */
  hint?: string
  onDismiss: () => void
}

export function ShiftCloseSuccessCard({ employeeName, endTimeLabel, durationLabel, hint, onDismiss }: Props) {
  return (
    <div className="w-full max-w-lg rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-6 text-center shadow-[0_0_32px_rgba(52,211,153,0.2)]">
      <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-300" aria-hidden />
      <p className="mt-4 text-2xl font-bold text-emerald-100">Danke, {employeeName}</p>
      <p className="mt-2 text-lg text-emerald-100/90">Deine Schicht wurde um {endTimeLabel} beendet.</p>
      <p className="mt-2 text-base text-[var(--text-muted)]">Arbeitszeit: {durationLabel}</p>
      {hint ? <p className="mt-3 text-sm text-amber-100/90">{hint}</p> : null}
      <button
        type="button"
        onClick={onDismiss}
        className="mt-6 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-6 py-3 text-base font-semibold text-emerald-50 hover:bg-emerald-500/30"
      >
        OK
      </button>
    </div>
  )
}
