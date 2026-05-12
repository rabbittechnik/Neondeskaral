/** Zentraler REST-Client (Phase 8/9). Base-URL aus VITE_API_URL, Fallback Port 3001. */

import type { ScheduleAssistantApplyResult, ScheduleAssistantGenerateResult } from '../types/scheduleAssistant'

const rawBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
export const API_BASE = rawBase || 'http://localhost:3001/api'

const TOKEN_LOCAL = 'neonshift_admin_token'
const TOKEN_SESSION = 'neonshift_admin_token_session'

export type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string }

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_LOCAL) ?? sessionStorage.getItem(TOKEN_SESSION)
}

export function setAdminToken(token: string, rememberMe: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_LOCAL)
  sessionStorage.removeItem(TOKEN_SESSION)
  if (rememberMe) localStorage.setItem(TOKEN_LOCAL, token)
  else sessionStorage.setItem(TOKEN_SESSION, token)
}

export function clearAdminToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_LOCAL)
  sessionStorage.removeItem(TOKEN_SESSION)
}

function authHeaders(): HeadersInit {
  const t = getAdminToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

function onUnauthorized(): void {
  clearAdminToken()
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login')
  }
}

function buildQuery(params?: Record<string, string | undefined>): string {
  if (!params) return ''
  const e = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') e.set(k, v)
  }
  const s = e.toString()
  return s ? `?${s}` : ''
}

export async function apiGet<T>(path: string, params?: Record<string, string | undefined>): Promise<ApiEnvelope<T>> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}${buildQuery(params)}`
  const res = await fetch(url, { headers: { ...authHeaders() } })
  if (res.status === 401) onUnauthorized()
  const json = (await res.json()) as ApiEnvelope<T> & { result?: string; employee?: unknown; timeEntry?: unknown }
  if (!res.ok && json && typeof json === 'object' && 'ok' in json && json.ok === false) {
    return json as ApiEnvelope<T>
  }
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` }
  }
  return json as ApiEnvelope<T>
}

export async function apiSend<T>(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  params?: Record<string, string | undefined>,
): Promise<ApiEnvelope<T>> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}${buildQuery(params)}`
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: method === 'DELETE' ? undefined : JSON.stringify(body ?? {}),
  })
  if (res.status === 401) onUnauthorized()
  const json = (await res.json()) as ApiEnvelope<T>
  if (!res.ok && json && typeof json === 'object' && 'ok' in json && json.ok === false) {
    return json as ApiEnvelope<T>
  }
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` }
  }
  return json as ApiEnvelope<T>
}

export async function scheduleAssistantGenerate(
  body: unknown,
): Promise<ApiEnvelope<ScheduleAssistantGenerateResult>> {
  return apiSend('POST', '/schedule-assistant/generate', body)
}

export async function scheduleAssistantApply(body: unknown): Promise<ApiEnvelope<ScheduleAssistantApplyResult>> {
  return apiSend('POST', '/schedule-assistant/apply', body)
}

/** Öffentliche Mitarbeiter-Zugangs-API (nur Token, kein Admin-Bearer). */
export async function employeeAccessGet<T>(token: string): Promise<ApiEnvelope<T>> {
  const url = `${API_BASE}/employee-access/${encodeURIComponent(token)}`
  const res = await fetch(url)
  const json = (await res.json()) as ApiEnvelope<T>
  if (!res.ok && json && typeof json === 'object' && 'ok' in json && json.ok === false) {
    return json as ApiEnvelope<T>
  }
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
  return json as ApiEnvelope<T>
}

/** Öffentliche Mitarbeiter-Zugangs-POST (Antwort kann ok:false bei HTTP 200 enthalten). */
export async function employeeAccessPost(
  token: string,
  subPath: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const url = `${API_BASE}/employee-access/${encodeURIComponent(token)}/${subPath.replace(/^\//, '')}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok && json.ok !== false) {
    return { ok: false, error: `HTTP ${res.status}` }
  }
  return json
}
