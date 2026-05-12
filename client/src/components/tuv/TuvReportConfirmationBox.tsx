type Props = {
  disabled?: boolean
  busy?: boolean
  alreadyConfirmed: boolean
  onConfirm: () => void | Promise<void>
}

export function TuvReportConfirmationBox({ disabled, busy, alreadyConfirmed, onConfirm }: Props) {
  if (alreadyConfirmed) {
    return (
      <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        Bericht wurde verbindlich bestätigt.
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/90 p-4">
      <p className="text-sm text-[var(--text-muted)] leading-relaxed">
        Mit dem Drücken dieses Buttons bestätige ich, dass ich diesen TÜV-Bericht sorgfältig und nach bestem Wissen
        ausgefüllt habe.
      </p>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void onConfirm()}
        className="mt-3 rounded-lg bg-gradient-to-r from-cyan-500/80 to-fuchsia-500/70 px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--glow-cyan)] disabled:opacity-40"
      >
        {busy ? 'Wird gespeichert…' : 'Bericht verbindlich bestätigen'}
      </button>
    </div>
  )
}
