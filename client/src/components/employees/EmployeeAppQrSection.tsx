import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Copy, Download, RefreshCw, ShieldOff, ShieldCheck } from 'lucide-react'
import type { Employee } from '../../types/employee'
import { buildEmployeeAccessUrl } from '../../utils/employeeAccessUrl'
import { Button } from '../ui/Button'
import { useEmployees } from '../../context/employees-context'

type Props = {
  employee: Employee
}

export function EmployeeAppQrSection({ employee }: Props) {
  const { regenerateEmployeeAccess, disableEmployeeAccess, enableEmployeeAccess } = useEmployees()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)

  const tok = employee.employeeAccessToken?.trim() ?? ''
  const url = tok ? buildEmployeeAccessUrl(tok) : ''
  const accessOn = Boolean(employee.employeeAccessEnabled && tok)

  const copyLink = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Link kopieren:', url)
    }
  }

  const downloadQr = () => {
    const canvas = canvasWrapRef.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `qr-${employee.id}.png`
    a.click()
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fehler')
    }
    setBusy(false)
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-md)] border border-cyan-500/25 bg-[var(--bg-card)]/80 p-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-main)]">Mitarbeiter-App / QR-Code</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Diesen QR-Code kann der Mitarbeiter mit dem Handy scannen, um seine persönliche Mitarbeiter-App zu öffnen.
        </p>
      </div>

      <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 p-4">
        <p className="text-sm font-medium text-[var(--text-main)]">{employee.displayName}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Status:{' '}
          <span className={accessOn ? 'text-emerald-300' : 'text-amber-200'}>
            {accessOn ? 'Zugang aktiv' : 'Zugang deaktiviert oder nicht konfiguriert'}
          </span>
        </p>
        {url ? (
          <p className="mt-2 break-all text-xs text-cyan-200/90">{url}</p>
        ) : (
          <p className="mt-2 text-xs text-amber-200/90">Kein Token vorhanden. Bitte neu generieren.</p>
        )}
      </div>

      {err ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{err}</p>
      ) : null}

      {url ? (
        <div ref={canvasWrapRef} className="flex justify-center rounded-[var(--radius-sm)] bg-white p-4">
          <QRCodeCanvas value={url} size={200} level="M" includeMargin />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="text-xs" leftIcon={<Copy className="h-4 w-4" />} disabled={!url || busy} onClick={() => void copyLink()}>
          Link kopieren
        </Button>
        <Button type="button" variant="outline" className="text-xs" leftIcon={<Download className="h-4 w-4" />} disabled={!url || busy} onClick={downloadQr}>
          QR-Code herunterladen
        </Button>
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await regenerateEmployeeAccess(employee.id)
            })
          }
        >
          Neu generieren
        </Button>
        {accessOn ? (
          <Button
            type="button"
            variant="danger"
            className="text-xs"
            leftIcon={<ShieldOff className="h-4 w-4" />}
            disabled={busy}
            onClick={() => void run(async () => disableEmployeeAccess(employee.id))}
          >
            Zugang deaktivieren
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            className="text-xs"
            leftIcon={<ShieldCheck className="h-4 w-4" />}
            disabled={busy || !tok}
            onClick={() => void run(async () => enableEmployeeAccess(employee.id))}
          >
            Zugang aktivieren
          </Button>
        )}
      </div>
    </div>
  )
}
