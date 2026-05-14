import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiGetBlob } from '../../services/api'

type InvRow = Record<string, unknown>

function formatEur(cents: unknown) {
  const n = Math.round(Number(cents ?? 0))
  return (n / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export function BillingPage() {
  const { stationId, hasPermission } = useStation()
  const { user } = useAuth()
  const ok = Boolean(user?.globalAdmin || hasPermission('settings.view'))
  const [items, setItems] = useState<InvRow[]>([])
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !ok) return
    const res = await apiGet<InvRow[]>('/station-hub/invoices', { stationId })
    if (!res.ok) {
      setErr(res.error)
      setItems([])
    } else setItems(Array.isArray(res.data) ? res.data : [])
  }, [stationId, ok])

  useEffect(() => {
    void load()
  }, [load])

  const downloadPdf = async (id: string) => {
    if (!stationId) return
    const res = await apiGetBlob(`/station-hub/invoices/${encodeURIComponent(id)}/file`, { stationId })
    if (!res.ok) {
      setErr(res.error)
      return
    }
    const url = URL.createObjectURL(res.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rechnung-${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!ok) return <div className="p-6 text-sm text-[var(--text-muted)]">Keine Berechtigung.</div>

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 pb-16">
      <PageHeader title="Rechnungen" description="Rechnungen und Belege für diese Station" />
      {err ? <p className="text-sm text-red-200/90">{err}</p> : null}
      <Button type="button" variant="outline" onClick={() => void load()}>
        Aktualisieren
      </Button>
      {items.length === 0 ? (
        <Card padding="lg" className="border-[var(--border-subtle)]">
          <p className="text-[var(--text-muted)]">Keine Rechnungen vorhanden.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Nr.</th>
                <th className="px-3 py-2">Datum</th>
                <th className="px-3 py-2">Zeitraum</th>
                <th className="px-3 py-2">Betrag</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((r) => {
                const id = String(r.id ?? '')
                const pdfPath = r.pdf_path != null ? String(r.pdf_path) : ''
                return (
                  <tr key={id} className="hover:bg-white/5">
                    <td className="px-3 py-2 text-[var(--text-main)]">{String(r.invoice_number ?? '')}</td>
                    <td className="px-3 py-2 text-[var(--text-muted)]">{String(r.invoice_date ?? '')}</td>
                    <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
                      {r.period_from || r.period_to ? `${String(r.period_from ?? '—')} – ${String(r.period_to ?? '—')}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-main)]">{formatEur(r.amount_cents)}</td>
                    <td className="px-3 py-2 text-[var(--text-muted)]">{String(r.status ?? '')}</td>
                    <td className="px-3 py-2">
                      {pdfPath.trim() ? (
                        <Button type="button" variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => void downloadPdf(id)}>
                          Herunterladen
                        </Button>
                      ) : (
                        <span className="text-xs text-[var(--text-faint)]">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
