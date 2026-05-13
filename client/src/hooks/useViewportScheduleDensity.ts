import { useEffect, useState } from 'react'
import type { TimelineViewportDensity } from '../components/schedule/timelineLayout'

function densityFromWidth(w: number): TimelineViewportDensity {
  if (w < 1200) return 'cramped'
  if (w < 1400) return 'compact'
  return 'comfort'
}

/**
 * Automatischer Kompaktmodus für Schichtplan / Dashboard (Breakpoints 1400 / 1200).
 */
export function useViewportScheduleDensity(): TimelineViewportDensity {
  const [density, setDensity] = useState<TimelineViewportDensity>('comfort')

  useEffect(() => {
    const update = () => setDensity(densityFromWidth(window.innerWidth))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return density
}
