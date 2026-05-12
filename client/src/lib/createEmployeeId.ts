export function createEmployeeId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `emp-${crypto.randomUUID()}`
  }
  return `emp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
