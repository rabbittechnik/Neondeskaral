type Props = {
  status: 'draft' | 'published'
  hasUnpublishedChanges: boolean
  loading?: boolean
}

export function WeekPublicationBadge({ status, hasUnpublishedChanges, loading }: Props) {
  if (loading) {
    return (
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
        Wochenstatus…
      </span>
    )
  }

  if (status === 'published' && hasUnpublishedChanges) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-100">
        Veröffentlicht · Änderungen
      </span>
    )
  }

  if (status === 'published') {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-100">
        Veröffentlicht
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full border border-slate-400/35 bg-slate-500/15 px-2.5 py-0.5 text-xs font-medium text-slate-200">
      Nicht veröffentlicht
    </span>
  )
}
