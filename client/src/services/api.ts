const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(
      typeof err === 'object' && err && 'error' in err
        ? String((err as { error: string }).error)
        : res.statusText,
    )
  }
  return res.json() as Promise<T>
}
