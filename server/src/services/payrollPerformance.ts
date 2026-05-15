/** Timing-Hilfen für Payroll-Endpunkte (Railway-Logs). */

export type PayrollPerfMeta = {
  endpoint: string
  stationId: string
  from: string
  to: string
  mode?: string
  employeeCount?: number
  shiftCount?: number
  timeEntryCount?: number
  absenceCount?: number
  daysCount?: number
  resultRowsCount?: number
  cached?: boolean
}

export class PayrollPerfTimer {
  private readonly startedAt = Date.now()
  private readonly marks = new Map<string, number>()

  constructor(readonly meta: PayrollPerfMeta) {
    console.time('[Payroll] total')
  }

  start(label: string): void {
    this.marks.set(label, Date.now())
    console.time(`[Payroll] ${label}`)
  }

  end(label: string): void {
    if (this.marks.has(label)) {
      console.timeEnd(`[Payroll] ${label}`)
      this.marks.delete(label)
    }
  }

  finish(extra?: Partial<PayrollPerfMeta>): void {
    for (const label of [...this.marks.keys()]) {
      this.end(label)
    }
    console.timeEnd('[Payroll] total')
    const elapsedMs = Date.now() - this.startedAt
    const payload = { ...this.meta, ...extra, elapsedMs }
    console.info('[Payroll] done', JSON.stringify(payload))
    if (elapsedMs > 20_000) {
      console.warn('[Payroll] SLOW', elapsedMs, 'ms', payload.endpoint, payload.stationId, payload.from, payload.to)
    }
  }
}

export class PayrollTimeoutError extends Error {
  constructor(ms: number) {
    super(
      `Berechnung dauert zu lange (>${Math.round(ms / 1000)} s). Bitte Zeitraum verkleinern oder Logs prüfen.`,
    )
    this.name = 'PayrollTimeoutError'
  }
}

export function runWithPayrollTimeout<T>(ms: number, fn: () => T): T {
  const start = Date.now()
  const out = fn()
  if (Date.now() - start > ms) {
    throw new PayrollTimeoutError(ms)
  }
  return out
}
