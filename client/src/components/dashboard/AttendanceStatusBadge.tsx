import { Badge } from '../ui/Badge'
import type { AttendanceStatus } from '../../utils/timeTrackingUtils'

const LABELS: Record<AttendanceStatus, string> = {
  geplant: 'Geplant',
  anwesend: 'Anwesend',
  läuft: 'Läuft',
  nicht_eingestempelt: 'Nicht eingestempelt',
  zu_spaet: 'Zu spät',
  zu_frueh: 'Zu früh',
  beendet: 'Schicht beendet',
  kommt_danach: 'Kommt danach',
}

const TONE: Record<AttendanceStatus, 'default' | 'cyan' | 'success' | 'amber' | 'danger' | 'lime'> = {
  geplant: 'default',
  anwesend: 'cyan',
  läuft: 'success',
  nicht_eingestempelt: 'amber',
  zu_spaet: 'danger',
  zu_frueh: 'amber',
  beendet: 'lime',
  kommt_danach: 'cyan',
}

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return <Badge tone={TONE[status]}>{LABELS[status]}</Badge>
}
