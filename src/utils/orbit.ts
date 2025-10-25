import { propagate, gstime, twoline2satrec, eciToGeodetic, radiansToDegrees } from 'satellite.js'

export type OrbitPoint = { lat: number; lon: number; altKm: number }

export function generateOrbitPath(tle1: string, tle2: string, minutesAhead: number = 120, stepMinutes: number = 2): OrbitPoint[] {
  const points: OrbitPoint[] = []
  if (!tle1 || !tle2) return points
  const satrec = twoline2satrec(tle1.trim(), tle2.trim())
  const now = new Date()
  for (let m = 0; m <= minutesAhead; m += stepMinutes) {
    const t = new Date(now.getTime() + m * 60 * 1000)
    const jd = (t.getTime() / 86400000.0) + 2440587.5
    const gmst = gstime(jd)
    const prop = propagate(satrec, t)
    const positionEci = prop.position
    if (!positionEci) continue
    const geo = eciToGeodetic(positionEci, gmst)
    const lat = radiansToDegrees(geo.latitude)
    const lon = radiansToDegrees(geo.longitude)
    const altKm = geo.height
    points.push({ lat, lon, altKm })
  }
  return points
}


