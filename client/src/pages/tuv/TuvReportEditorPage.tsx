import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStation } from '../../context/station-context'
import { apiGet, apiSend } from '../../services/api'
import { dispatchNotificationsRefresh } from '../../utils/notificationsRefresh'
import type { TuvReportDetail, TuvReportStatus } from '../../types/tuvReport'
import { PageHeader } from '../../components/ui/PageHeader'
import { TuvReportForm } from '../../components/tuv/TuvReportForm'
import { TuvReportPrintView } from '../../components/tuv/TuvReportPrintView'

function mergeItem(items: TuvReportDetail['items'], id: string, patch: Partial<TuvReportDetail['items'][0]>) {
  return items.map((i) => (i.id === id ? { ...i, ...patch } : i))
}

export function TuvReportEditorPage() {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const { availableStations, hasPermission } = useStation()
  const [detail, setDetail] = useState<TuvReportDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [signatureDraft, setSignatureDraft] = useState('')
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [correctionMode, setCorrectionMode] = useState(false)

  const stationName = useMemo(() => {
    const sid = detail?.report.stationId
    return availableStations.find((s) => s.id === sid)?.name ?? sid ?? ''
  }, [detail, availableStations])

  const load = useCallback(async () => {
    if (!reportId) return
    setErr(null)
    const res = await apiGet<TuvReportDetail>(`/tuv-reports/${reportId}`)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setDetail(res.data)
    setSignatureDraft(res.data.report.signatureDataUrl || '')
  }, [reportId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    document.body.classList.add('tuv-print-session')
    return () => document.body.classList.remove('tuv-print-session')
  }, [])

  const canView = hasPermission('tuvReports.view')
  const canEdit = hasPermission('tuvReports.edit')
  const canComplete = hasPermission('tuvReports.complete')
  const canSign = hasPermission('tuvReports.sign')
  const canPrint = hasPermission('tuvReports.print')
  const canManage = hasPermission('tuvReports.manage')

  const r = detail?.report
  const completedLike = r?.status === 'completed' || r?.status === 'printed'
  const readOnlyForm = Boolean(completedLike && !correctionMode)
  const effectiveManageUnlock = Boolean(correctionMode && canManage && completedLike)

  async function saveDraft() {
    if (!detail || !canEdit) return
    setBusy(true)
    setErr(null)
    const body = {
      reportDate: detail.report.reportDate,
      inspectorRole: detail.report.inspectorRole,
      weatherNote: detail.report.weatherNote,
      generalNote: detail.report.generalNote,
      status: 'in_progress' as TuvReportStatus,
      items: detail.items.map((i) => ({
        id: i.id,
        status: i.status || undefined,
        note: i.note,
        actionRequired: i.actionRequired,
        responsible: i.responsible,
        dueDate: i.dueDate,
      })),
    }
    const res = await apiSend<TuvReportDetail>('PUT', `/tuv-reports/${detail.report.id}`, body)
    setBusy(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setDetail(res.data)
  }

  async function saveSignatureToServer() {
    if (!detail || !canSign) return
    setBusy(true)
    setErr(null)
    const res = await apiSend<TuvReportDetail>('POST', `/tuv-reports/${detail.report.id}/confirm`, {
      signatureDataUrl: signatureDraft || undefined,
      confirmationText: undefined,
    })
    setBusy(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setDetail(res.data)
  }

  async function confirmButton() {
    if (!detail || !canSign) return
    setConfirmBusy(true)
    setErr(null)
    const res = await apiSend<TuvReportDetail>('POST', `/tuv-reports/${detail.report.id}/confirm`, {
      confirmationText:
        'Mit dem Drücken dieses Buttons bestätige ich, dass ich diesen TÜV-Bericht sorgfältig und nach bestem Wissen ausgefüllt habe.',
    })
    setConfirmBusy(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setDetail(res.data)
  }

  async function completeReport() {
    if (!detail || !canComplete) return
    setBusy(true)
    setErr(null)
    const res = await apiSend<TuvReportDetail>('POST', `/tuv-reports/${detail.report.id}/complete`, {})
    setBusy(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setDetail(res.data)
    dispatchNotificationsRefresh()
  }

  function doPrint() {
    window.print()
  }

  async function markPrinted() {
    if (!detail || !canPrint) return
    setBusy(true)
    setErr(null)
    const res = await apiSend<TuvReportDetail>('POST', `/tuv-reports/${detail.report.id}/mark-printed`, {})
    setBusy(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setDetail(res.data)
  }

  if (!reportId) {
    return null
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 text-sm text-[var(--text-muted)]">
        Keine Berechtigung für TÜV-Berichte.
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="text-sm text-[var(--text-muted)]">
        {err ?? 'Lade Bericht…'}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Monatlicher TÜV-Bericht"
        description="Bearbeiten, bestätigen und drucken."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/tuv-berichte')}
              className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm hover:bg-white/5"
            >
              Zurück
            </button>
            {canManage && completedLike ? (
              <button
                type="button"
                onClick={() => setCorrectionMode((v) => !v)}
                className="rounded-lg border border-amber-400/40 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
              >
                {correctionMode ? 'Korrekturmodus aus' : 'Korrekturmodus'}
              </button>
            ) : null}
          </div>
        }
      />

      {err ? (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{err}</div>
      ) : null}

      <TuvReportForm
        detail={detail}
        stationName={stationName}
        readOnly={readOnlyForm && !effectiveManageUnlock}
        manageUnlock={effectiveManageUnlock}
        onChangeReport={(patch) => setDetail((d) => (d ? { ...d, report: { ...d.report, ...patch } } : d))}
        onChangeItem={(id, patch) =>
          setDetail((d) => (d ? { ...d, items: mergeItem(d.items, id, patch) } : d))
        }
        signatureDraft={signatureDraft}
        onSignatureDraft={(v) => setSignatureDraft(v)}
        onConfirmClick={confirmButton}
        confirmBusy={confirmBusy}
        canSign={canSign && (!completedLike || effectiveManageUnlock)}
      />

      <div className="flex flex-wrap gap-3 tuv-no-print">
        {canEdit && (!completedLike || effectiveManageUnlock) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveDraft()}
            className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-40"
          >
            Entwurf speichern
          </button>
        ) : null}
        {canSign && signatureDraft && signatureDraft !== detail.report.signatureDataUrl && (!completedLike || effectiveManageUnlock) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveSignatureToServer()}
            className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            Unterschrift speichern
          </button>
        ) : null}
        {canComplete && !completedLike ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void completeReport()}
            className="rounded-lg bg-gradient-to-r from-emerald-500/80 to-cyan-500/70 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Bericht abschließen
          </button>
        ) : null}
        {canPrint && (detail.report.status === 'completed' || detail.report.status === 'printed') ? (
          <>
            <button
              type="button"
              onClick={doPrint}
              className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm hover:bg-white/5"
            >
              Drucken / PDF
            </button>
            {detail.report.status === 'completed' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void markPrinted()}
                className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
              >
                Als gedruckt markieren
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="tuv-print-only">
        <TuvReportPrintView detail={detail} stationName={stationName} />
      </div>
    </div>
  )
}
