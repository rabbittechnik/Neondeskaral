import { Link } from 'react-router-dom'
import { Tablet } from 'lucide-react'

/** `/tablet` ohne Token — kein Redirect zur Admin-Anmeldung. */
export function TabletLandingPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#070b12] px-6 py-12 text-slate-100">
      <Tablet className="h-14 w-14 text-cyan-400/90" aria-hidden />
      <h1 className="mt-6 text-center text-xl font-semibold text-white">Kein Tablet-Zugang angegeben</h1>
      <p className="mt-3 max-w-md text-center text-sm text-slate-400">
        Scannt die Leitung oder den Supervisor den Stations-QR in „Mein Konto · Geräte & Apps“, wird das Tablet
        automatisch für die richtige Tankstelle geöffnet.
      </p>
      <p className="mt-4 max-w-md text-center text-xs text-slate-500">
        Für Entwicklung: Terminal ohne Stations-QR weiterhin unter{' '}
        <Link to="/tablet/dev" className="text-cyan-300 underline hover:text-cyan-200">
          /tablet/dev
        </Link>
        .
      </p>
      <Link
        to="/"
        className="mt-10 text-sm font-medium text-cyan-400/90 underline-offset-4 hover:underline hover:text-cyan-300"
      >
        Zur Startauswahl
      </Link>
    </div>
  )
}
