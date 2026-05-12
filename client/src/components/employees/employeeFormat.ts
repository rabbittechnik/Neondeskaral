export function formatHoursDe(h: number): string {
  return `${h.toFixed(1).replace('.', ',')} Std.`
}

export function formatEuroDe(n: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(n)
}

export function formatDateDe(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`
}
