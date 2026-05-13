import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Copy, Download, RefreshCw, ShieldOff, ShieldCheck } from 'lucide-react'
import type { Employee } from '../../types/employee'
import { buildEmployeeAccessUrl } from '../../utils/employeeAccessUrl'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useEmployees } from '../../context/employees-context'
import { useStation } from '../../context/station-context'

type Props = {
  employee: Employee
}

type Op = 'regen' | 'enable' | 'disable'

const ERR: Record<Op, string> = {
  regen: 'Mitarbeiter-App-Zugang konnte nicht erstellt werden.',
  enable: 'Zugang konnte nicht aktiviert werden.',
  disable: 'Zugang konnte nicht deaktiviert werden.',
}

function formatAccessDateTime(iso?: string | null): string {
  if (!iso?.trim()) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const day = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const y = d.getFullYear()
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${day}.${mo}.${y}, ${h}:${mi} Uhr`
}

function maskAccessToken(tok: string): string {
  const t = tok.trim()
  if (!t) return '—'
  if (t.length <= 6) return '****'
  return `****${t.slice(-6)}`
}

function slugFileBase(displayName: string, id: string): string {
  const fromName = displayName
    .trim()
    .toLowerCase()
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return fromName || `mitarbeiter-${id.slice(0, 8)}`
}

export function EmployeeAppQrSection({ employee }: Props) {
  const { regenerateEmployeeAccess, disableEmployeeAccess, enableEmployeeAccess } = useEmployees()
  const { selectedStation } = useStation()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false)
  const canvasWrapRef = useRef<HTMLDivElement>(null)

  const tok = employee.employeeAccessToken?.trim() ?? ''
  const url = tok ? buildEmployeeAccessUrl(tok) : ''
  const enabledFlag = employee.employeeAccessEnabled !== false
  const accessOn = Boolean(tok && enabledFlag)

  const statusLabel = !tok
    ? 'Kein Zugang eingerichtet'
    : !enabledFlag
      ? 'Deaktiviert'
      : 'Aktiv'

  const copyLink = async () => {
    if (!url || !accessOn) return
    try {
      await navigator.clipboard.writeText(url)
      setOk('Mitarbeiter-App-Link kopiert.')
      setErr(null)
    } catch {
      window.prompt('Link kopieren:', url)
    }
  }

  const downloadQr = () => {
    const canvas = canvasWrapRef.current?.querySelector('canvas')
    if (!canvas || !accessOn) return
    try {
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `mitarbeiter-app-${slugFileBase(employee.displayName, employee.id)}.png`
      a.click()
    } catch (e) {
      console.error('[EmployeeAppQr] QR-Download', e)
      setErr('QR-Code konnte nicht heruntergeladen werden.')
    }
  }

  const run = async (op: Op, fn: () => Promise<void>) => {
    setBusy(true)
    setErr(null)
    setOk(null)
    try {
      await fn()
      if (op === 'regen') setOk('Mitarbeiter-App-Zugang ist eingerichtet. QR-Code und Link sind unten sichtbar.')
      if (op === 'enable') setOk('Zugang wurde aktiviert.')
      if (op === 'disable') setOk('Zugang wurde deaktiviert.')
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'Unbekannter Fehler'
      console.error('[EmployeeAppQr]', op, detail)
      if (detail.includes('nicht vollständig erstellt') || detail.includes('Token fehlt')) {
        setErr(detail)
      } else {
        setErr(detail.startsWith(ERR[op]) ? detail : `${ERR[op]} ${detail}`)
      }
    } finally {
      setBusy(false)
    }
  }

  const requestRegenerate = () => {
    if (busy) return
    if (tok) {
      setRegenConfirmOpen(true)
      return
    }
    void run('regen', async () => {
      await regenerateEmployeeAccess(employee.id)
    })
  }

  const confirmRegenerate = () => {
    setRegenConfirmOpen(false)
    void run('regen', async () => {
      await regenerateEmployeeAccess(employee.id)
    })
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
          Station:{' '}
          <span className="text-[var(--text-main)]">{selectedStation?.name ?? '—'}</span>
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Status:{' '}
          <span className={accessOn ? 'text-emerald-300' : !tok ? 'text-amber-200' : 'text-amber-200'}>
            {statusLabel}
          </span>
        </p>
        {tok ? (
          <dl className="mt-3 space-y-1.5 text-xs text-[var(--text-muted)]">
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Token</dt>
              <dd className="font-mono text-[var(--text-main)]">{maskAccessToken(tok)}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Erstellt am</dt>
              <dd className="text-[var(--text-main)]">{formatAccessDateTime(employee.employeeAccessCreatedAt)}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Zuletzt genutzt</dt>
              <dd className="text-[var(--text-main)]">
                {employee.employeeAccessLastUsedAt?.trim()
                  ? formatAccessDateTime(employee.employeeAccessLastUsedAt)
                  : 'Noch nie genutzt'}
              </dd>
            </div>
          </dl>
        ) : null}
        {!tok ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Es ist noch kein persönlicher Zugangslink eingerichtet. Erstellen Sie einen QR-Code, um die Mitarbeiter-App
            zu nutzen.
          </p>
        ) : !accessOn ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Der Zugang ist deaktiviert. Link kopieren und QR-Export stehen wieder zur Verfügung, sobald der Zugang
            aktiviert ist.
          </p>
        ) : (
          <p className="mt-2 break-all text-xs text-cyan-200/90">{url}</p>
        )}
      </div>

      {ok ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {ok}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{err}</p>
      ) : null}

      {accessOn && url ? (
        <div ref={canvasWrapRef} className="flex justify-center rounded-[var(--radius-sm)] bg-white p-4">
          <QRCodeCanvas value={url} size={200} level="M" includeMargin />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          leftIcon={<Copy className="h-4 w-4" />}
          disabled={!url || !accessOn || busy}
          onClick={() => void copyLink()}
        >
          Link kopieren
        </Button>
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          leftIcon={<Download className="h-4 w-4" />}
          disabled={!url || !accessOn || busy}
          onClick={downloadQr}
        >
          QR-Code herunterladen
        </Button>
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          disabled={busy}
          onClick={requestRegenerate}
        >
          {!tok ? 'QR-Code / Zugang erstellen' : 'Neu generieren'}
        </Button>
        {accessOn ? (
          <Button
            type="button"
            variant="danger"
            className="text-xs"
            leftIcon={<ShieldOff className="h-4 w-4" />}
            disabled={busy}
            onClick={() => void run('disable', async () => disableEmployeeAccess(employee.id))}
          >
            Zugang deaktivieren
          </Button>
        ) : tok ? (
          <Button
            type="button"
            variant="primary"
            className="text-xs"
            leftIcon={<ShieldCheck className="h-4 w-4" />}
            disabled={busy}
            onClick={() => void run('enable', async () => enableEmployeeAccess(employee.id))}
          >
            Zugang aktivieren
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={regenConfirmOpen}
        title="QR-Code neu generieren?"
        message="Alter QR-Code funktioniert danach nicht mehr. Bereits verbundene Geräte werden getrennt. Der Mitarbeiter muss den neuen QR-Code erneut scannen. Fortfahren?"
        cancelLabel="Abbrechen"
        confirmLabel="Neu generieren"
        variant="primary"
        onCancel={() => setRegenConfirmOpen(false)}
        onConfirm={confirmRegenerate}
      />
    </div>
  )
}
