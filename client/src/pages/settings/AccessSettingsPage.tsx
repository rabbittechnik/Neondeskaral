import { Navigate } from 'react-router-dom'

/** Benutzerverwaltung liegt unter „Mein Konto → Benutzer verwalten“. */
export function AccessSettingsPage() {
  return <Navigate to="/account/users" replace />
}
