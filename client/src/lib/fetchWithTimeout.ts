export const DEFAULT_FETCH_TIMEOUT_MS = 15_000

export type FetchWithTimeoutInit = RequestInit & {
  timeoutMs?: number
}

/** `fetch` mit Abort nach `timeoutMs` (Standard 15s). Vorhandenes `signal` bricht ebenfalls ab. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: FetchWithTimeoutInit,
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const userSignal = init?.signal
  if (userSignal) {
    if (userSignal.aborted) controller.abort()
    else userSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const { timeoutMs: _omit, signal: _sig, ...rest } = init ?? {}
    void _omit
    void _sig
    return await fetch(input, { ...rest, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}
