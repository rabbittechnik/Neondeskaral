type Props = {
  value: string
  onChange: (v: string) => void
  /** Wenn false: kein OK auf dem Pad (Submit nur über den Hauptbutton / Enter). */
  showOkKey?: boolean
}

const KEYS_WITH_OK = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'] as const
const KEYS_NO_OK = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0'] as const

export function OnScreenNumberPad({ value, onChange, showOkKey = false }: Props) {
  const KEYS = showOkKey ? KEYS_WITH_OK : KEYS_NO_OK

  const press = (k: string) => {
    if (k === 'del') {
      onChange(value.slice(0, -1))
      return
    }
    if (k === 'ok') {
      return
    }
    if (value.length >= 8) return
    onChange(value + k)
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className={`min-h-[52px] rounded-xl border text-xl font-semibold transition sm:min-h-[60px] sm:text-2xl ${
            k === 'ok'
              ? 'border-cyan-400/50 bg-cyan-500/25 text-cyan-50 hover:bg-cyan-500/35'
              : k === 'del'
                ? 'border-white/15 bg-white/5 text-[var(--text-muted)] hover:bg-white/10'
                : 'border-white/10 bg-black/30 text-[var(--text-main)] hover:border-cyan-400/30 hover:bg-cyan-500/10'
          }`}
        >
          {k === 'del' ? 'Löschen' : k === 'ok' ? 'OK' : k}
        </button>
      ))}
    </div>
  )
}
