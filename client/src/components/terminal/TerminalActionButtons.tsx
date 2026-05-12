import { LogIn, LogOut } from 'lucide-react'

type Props = {
  onCheckIn: () => void
  onCheckOut: () => void
}

export function TerminalActionButtons({ onCheckIn, onCheckOut }: Props) {
  return (
    <div className="grid max-w-4xl gap-4 sm:grid-cols-2 sm:gap-6">
      <button
        type="button"
        onClick={onCheckIn}
        className="group flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-emerald-400/50 bg-gradient-to-br from-emerald-500/25 to-cyan-500/20 px-6 py-8 text-xl font-bold text-emerald-100 shadow-[0_0_32px_rgba(52,211,153,0.25)] transition hover:border-emerald-300 hover:shadow-[0_0_48px_rgba(52,211,153,0.4)] active:scale-[0.99] sm:min-h-[140px] sm:text-2xl md:text-3xl"
      >
        <LogIn className="h-10 w-10 shrink-0 text-emerald-200 sm:h-12 sm:w-12" aria-hidden />
        <span>Mitarbeiter kommt</span>
      </button>
      <button
        type="button"
        onClick={onCheckOut}
        className="group flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-orange-400/55 bg-gradient-to-br from-orange-600/30 to-rose-600/25 px-6 py-8 text-xl font-bold text-orange-50 shadow-[0_0_32px_rgba(251,113,133,0.22)] transition hover:border-orange-300 hover:shadow-[0_0_48px_rgba(251,146,60,0.35)] active:scale-[0.99] sm:min-h-[140px] sm:text-2xl md:text-3xl"
      >
        <LogOut className="h-10 w-10 shrink-0 text-orange-100 sm:h-12 sm:w-12" aria-hidden />
        <span>Mitarbeiter geht / Schicht beenden</span>
      </button>
    </div>
  )
}
