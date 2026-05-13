import { useNavigate, useParams } from 'react-router-dom'
import { clearStoredEmployeeAccessSession } from './employeeAppStorage'
import { EmployeeAppHome } from './EmployeeAppHome'

export function EmployeeAccessPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const t = token?.trim() ?? ''

  if (!t) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center text-slate-300">
        <p className="text-lg font-semibold text-white">Kein Zugangscode in der Adresse.</p>
        <p className="max-w-md text-slate-400">Bitte nutze den vollständigen Link aus deinem QR-Code.</p>
      </div>
    )
  }

  return (
    <EmployeeAppHome
      accessToken={t}
      persistSession
      onSessionStored={() => navigate('/employee', { replace: true })}
      onClearSession={() => {
        clearStoredEmployeeAccessSession()
        navigate('/employee', { replace: true })
      }}
    />
  )
}
