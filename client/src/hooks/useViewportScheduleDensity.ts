import { useEffect, useState } from 'react'
import type { TimelineViewportDensity } from '../components/schedule/timelineLayout'

function densityFromWidth(w: number): TimelineViewportDensity {
  if (w < 1180) return 'cramped'
  if (w < 1680) return 'compact'
  return 'comfort'
}

/**
 * Standard kompakt; etwas luftiger nur auf sehr breiten Screens („comfort“).
 */
export function useViewportScheduleDensity(): TimelineViewportDensity {
  const [density, setDensity] = useState<TimelineViewportDensity>('compact')

  useEffect(() => {
    const update = () => setDensity(densityFromWidth(window.innerWidth))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return density
}
