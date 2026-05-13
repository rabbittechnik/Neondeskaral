import { API_BASE } from '../services/api'
import { getEmployeeAppDeviceHeaders } from '../pages/employee-app/employeeAppStorage'
import { validateTabletSession } from './tabletQrToken'

export type EmployeeSessionProbeOk = {
  ok: true
  employee: { displayName: string }
  station: { id: string; name: string }
}

/** GET /api/employee-access/:token/session — gleiche Zugriffsregeln wie volle App. */
export async function probeEmployeeAccessSession(token: string): Promise<EmployeeSessionProbeOk | { ok: false }> {
  const url = `${API_BASE}/employee-access/${encodeURIComponent(token)}/session`
  try {
    const res = await fetch(url, { headers: { ...getEmployeeAppDeviceHeaders() } })
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      data?: { employee?: { displayName?: string }; station?: { id?: string; name?: string } }
    }
    if (!res.ok || json.ok === false) return { ok: false }
    const d = json.data
    const name = String(d?.employee?.displayName ?? '').trim() || 'Mitarbeitender'
    const sid = String(d?.station?.id ?? '').trim()
    if (!sid) return { ok: false }
    const sname = String(d?.station?.name ?? '').trim() || 'Station'
    return { ok: true, employee: { displayName: name }, station: { id: sid, name: sname } }
  } catch {
    return { ok: false }
  }
}

export async function probeTabletSession(token: string): Promise<boolean> {
  const v = await validateTabletSession(token)
  return v.ok === true
}
