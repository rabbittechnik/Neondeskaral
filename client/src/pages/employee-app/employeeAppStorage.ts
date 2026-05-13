const KEY_TOKEN = 'rabbit_technik_employee_app_token'
const KEY_TOKEN_LEGACY = 'employeeAccessToken'
const KEY_NAME = 'employeeAccessEmployeeName'
const KEY_STATION = 'employeeAccessStationName'
const KEY_DEVICE = 'employeeAppDeviceId'

export function getOrCreateEmployeeAppDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(KEY_DEVICE)?.trim()
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY_DEVICE, id)
  }
  return id
}

export function getEmployeeAppPlatformLabel(): string {
  if (typeof window === 'undefined') return ''
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  return navigator.platform || ''
}

export function getEmployeeAppDeviceHeaders(): Record<string, string> {
  const id = getOrCreateEmployeeAppDeviceId()
  if (!id) return {}
  return {
    'X-Employee-Device-Id': id,
    'X-Employee-App-Platform': getEmployeeAppPlatformLabel(),
    'X-Employee-App-Version': '1',
  }
}

export function getStoredEmployeeAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  const primary = localStorage.getItem(KEY_TOKEN)?.trim()
  if (primary) return primary
  const leg = localStorage.getItem(KEY_TOKEN_LEGACY)?.trim()
  if (leg) {
    localStorage.setItem(KEY_TOKEN, leg)
    localStorage.removeItem(KEY_TOKEN_LEGACY)
    return leg
  }
  return null
}

export function setStoredEmployeeAccessSession(token: string, employeeName?: string, stationName?: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY_TOKEN, token.trim())
  localStorage.removeItem(KEY_TOKEN_LEGACY)
  if (employeeName != null) localStorage.setItem(KEY_NAME, employeeName)
  if (stationName != null) localStorage.setItem(KEY_STATION, stationName)
}

export function getStoredEmployeeAccessMeta(): { employeeName: string | null; stationName: string | null } {
  if (typeof window === 'undefined') return { employeeName: null, stationName: null }
  return {
    employeeName: localStorage.getItem(KEY_NAME),
    stationName: localStorage.getItem(KEY_STATION),
  }
}

export function clearStoredEmployeeAccessSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY_TOKEN)
  localStorage.removeItem(KEY_TOKEN_LEGACY)
  localStorage.removeItem(KEY_NAME)
  localStorage.removeItem(KEY_STATION)
  localStorage.removeItem(KEY_DEVICE)
}

import { parseAccessPasteInput } from '../../utils/accessPasteInput'

/** Aus URL, Roh-Token oder eingefügtem Link (inkl. /employee/… und Legacy /employee-access/…). */
export function parseEmployeeAccessTokenFromInput(raw: string): string {
  const p = parseAccessPasteInput(raw)
  if (p.kind === 'employee' || p.kind === 'ambiguous') return p.token
  return ''
}
