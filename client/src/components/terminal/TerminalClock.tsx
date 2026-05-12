import { useEffect, useState } from 'react'

type Props = {
  className?: string
}

export function TerminalClock({ className = '' }: Props) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const dateStr = now.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`text-center ${className}`}>
      <p className="text-5xl font-bold tabular-nums tracking-tight text-cyan-200 sm:text-6xl md:text-7xl drop-shadow-[0_0_24px_rgba(34,211,238,0.35)]">
        {timeStr}
      </p>
      <p className="mt-3 text-lg text-[var(--text-muted)] sm:text-xl md:text-2xl">{dateStr}</p>
    </div>
  )
}
