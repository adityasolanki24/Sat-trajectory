import { useMemo } from 'react'
import { generateOrbitPath, OrbitPoint } from '../utils/orbit'

export function useOrbitPath(tle1?: string, tle2?: string, minutesAhead: number = 120, stepMinutes: number = 2) {
  return useMemo<OrbitPoint[] | null>(() => {
    if (!tle1 || !tle2) return null
    try {
      return generateOrbitPath(tle1, tle2, minutesAhead, stepMinutes)
    } catch {
      return null
    }
  }, [tle1, tle2, minutesAhead, stepMinutes])
}

