import { MIDDAY_COLLECTIVE_SUBMISSION_KIND } from '../constants/middayStandardHandover.js'

export function isCollectiveMiddayHandoverSubmission(c: Record<string, unknown>): boolean {
  return (
    String(c.checklistType ?? '').trim() === 'handover' &&
    String(c.submissionKind ?? '').trim() === MIDDAY_COLLECTIVE_SUBMISSION_KIND
  )
}

export function validateCollectiveMiddayHandover(checklist: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  const truth =
    checklist.confirmTruth === true ||
    checklist.confirmTruth === 1 ||
    String(checklist.confirmTruth ?? '').toLowerCase() === 'true'
  if (!truth) {
    return { ok: false, error: 'Bitte die Bestätigung zur Schichtübergabe setzen.' }
  }
  const conf =
    checklist.collectiveConfirmed === true ||
    checklist.collectiveConfirmed === 1 ||
    String(checklist.collectiveConfirmed ?? '').toLowerCase() === 'true'
  if (!conf) {
    return { ok: false, error: 'Bitte bestätigen, dass alle Punkte zur Schichtübergabe erledigt sind.' }
  }
  const remark = String(checklist.remark ?? checklist.comment ?? '').trim()
  if (remark.length > 4000) {
    return { ok: false, error: 'Bemerkung ist zu lang (max. 4000 Zeichen).' }
  }
  return { ok: true }
}
