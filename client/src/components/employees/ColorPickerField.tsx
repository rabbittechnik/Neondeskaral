import { labelClass } from '../schedule/shift/fieldStyles'

const PRESETS = [
  '#22d3ee',
  '#a3e635',
  '#f472b6',
  '#c084fc',
  '#fbbf24',
  '#38bdf8',
  '#34d399',
  '#fb923c',
  '#f43f5e',
  '#a78bfa',
  '#2dd4bf',
  '#eab308',
]

type Props = {
  id?: string
  value: string
  onChange: (hex: string) => void
  disabled?: boolean
}

export function ColorPickerField({ id, value, onChange, disabled }: Props) {
  return (
    <div>
      <span id={id} className={labelClass}>
        Farbe im Schichtplan
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            title={c}
            onClick={() => onChange(c)}
            className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:opacity-40 ${
              value.toLowerCase() === c.toLowerCase()
                ? 'border-white ring-2 ring-cyan-400/60'
                : 'border-white/20'
            }`}
            style={{
              backgroundColor: c,
              boxShadow: `0 0 12px ${c}66`,
            }}
            aria-label={`Farbe ${c}`}
          />
        ))}
      </div>
      <input
        type="text"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#22d3ee"
        className="mt-2 w-full max-w-[11rem] rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2 py-1.5 font-mono text-xs text-[var(--text-main)]"
      />
    </div>
  )
}
