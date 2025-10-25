import { propagate, gstime, twoline2satrec, eciToGeodetic } from 'satellite.js'

export type OrbitPoint = { lat: number; lon: number; altKm: number }
export type EciVector = { x: number; y: number; z: number }

const radiansToDegrees = (rad: number) => rad * (180 / Math.PI)

export function generateOrbitPath(tle1: string, tle2: string, minutesAhead?: number, stepMinutes: number = 2, centerTime?: Date): OrbitPoint[] {
  const points: OrbitPoint[] = []
  if (!tle1 || !tle2) {
    console.error('❌ generateOrbitPath: Missing TLE lines');
    return points;
  }
  
  // Validate TLE format
  if (tle1.length < 69 || tle2.length < 69) {
    console.error('❌ generateOrbitPath: TLE lines too short (expected ≥69 chars)');
    return points;
  }
  
  if (!tle1.trim().startsWith('1 ') || !tle2.trim().startsWith('2 ')) {
    console.error('❌ generateOrbitPath: Invalid TLE line format');
    return points;
  }
  
  try {
    const satrec = twoline2satrec(tle1.trim(), tle2.trim())
    
    // Check if SGP4 initialization succeeded
    if (!satrec || satrec.error) {
      console.error('❌ SGP4 initialization failed:', satrec?.error);
      return points;
    }
    
    // Calculate orbital period from mean motion (TLE line 2, columns 52-63)
    const meanMotionRevPerDay = parseFloat(tle2.substring(52, 63))
    
    if (!isFinite(meanMotionRevPerDay) || meanMotionRevPerDay <= 0) {
      console.error('❌ Invalid mean motion:', meanMotionRevPerDay);
      return points;
    }
    
    const orbitalPeriodMinutes = 1440 / meanMotionRevPerDay // 1440 minutes in a day
    
    // Generate points for EXACTLY one complete orbit only
    const duration = minutesAhead !== undefined ? minutesAhead : orbitalPeriodMinutes
    const centerDate = centerTime || new Date()
    
    // Use smaller steps for smoother orbits
    const step = Math.min(stepMinutes, orbitalPeriodMinutes / 100) // At least 100 points per orbit
    
    // ALWAYS center orbit around the specified time (satellites appear in middle of visible path)
    const startTime = centerDate.getTime() - (duration / 2) * 60 * 1000
    
    for (let m = 0; m <= duration; m += step) {
      const t = new Date(startTime + m * 60 * 1000)
      const prop = propagate(satrec, t)
      const positionEci = prop.position
      if (!positionEci || typeof positionEci === 'boolean') continue
      
      // Use actual GMST for each time point (proper Earth rotation)
      const gmst = gstime(t)
      const geo = eciToGeodetic(positionEci, gmst)
      const lat = radiansToDegrees(geo.latitude)
      const lon = radiansToDegrees(geo.longitude)
      const altKm = geo.height
      
      // Filter out invalid orbits (negative altitude or extremely high orbits)
      // Note: GEO satellites are at ~36,000 km, so allow up to 100,000 km for high orbits
      if (altKm < 100 || altKm > 100000) {
        console.warn('Invalid orbit altitude detected:', altKm, 'km - skipping point');
        continue; // Skip this point but continue generating orbit
      }
      
      // Additional validation: check for NaN or Infinity
      if (!isFinite(altKm) || !isFinite(lat) || !isFinite(lon)) {
        console.warn('Non-finite orbit values detected - skipping entire orbit');
        return [];
      }
      
      points.push({ lat, lon, altKm })
    }
    
    // Log orbit statistics for debugging
    if (points.length > 0) {
      const altitudes = points.map(p => p.altKm);
      const minAlt = Math.min(...altitudes);
      const maxAlt = Math.max(...altitudes);
      const avgAlt = altitudes.reduce((a, b) => a + b, 0) / altitudes.length;
      
      // Determine orbit type
      let orbitType = 'Unknown';
      if (avgAlt < 2000) orbitType = 'LEO (Low Earth Orbit)';
      else if (avgAlt < 35000) orbitType = 'MEO (Medium Earth Orbit)';
      else if (avgAlt < 40000) orbitType = 'GEO (Geostationary)';
      else orbitType = 'HEO (High Earth Orbit)';
      
      console.log(`✅ Orbit generated: ${points.length} points over ${duration.toFixed(0)} min`);
      console.log(`   Type: ${orbitType}, Alt: ${minAlt.toFixed(0)}-${maxAlt.toFixed(0)}km (avg ${avgAlt.toFixed(0)}km)`);
      console.log(`   Period: ${orbitalPeriodMinutes.toFixed(1)} min, Mean Motion: ${meanMotionRevPerDay.toFixed(2)} rev/day`);
      
      // Warn if orbit has suspicious characteristics
      if (maxAlt - minAlt > 2000) {
        console.warn('⚠️ Highly elliptical orbit - altitude variation:', (maxAlt - minAlt).toFixed(0), 'km');
      }
    } else {
      console.error('❌ Failed to generate any orbit points - check TLE data validity');
    }
  } catch (e) {
    console.error('Failed to generate orbit path:', e)
  }
  
  return points
}

export function geodeticFromTLEAt(tle1: string, tle2: string, at: Date): OrbitPoint | null {
  if (!tle1 || !tle2) return null
  try {
    const satrec = twoline2satrec(tle1.trim(), tle2.trim())
    const gmst = gstime(at)
    const prop = propagate(satrec, at)
    const positionEci = prop.position
    if (!positionEci || typeof positionEci === 'boolean') return null
    const geo = eciToGeodetic(positionEci, gmst)
    return {
      lat: radiansToDegrees(geo.latitude),
      lon: radiansToDegrees(geo.longitude),
      altKm: geo.height
    }
  } catch {
    return null
  }
}

// --- ECI helpers (for 3D rendering like SatMap) ---
export function eciFromTLEAt(tle1: string, tle2: string, at: Date): { eci: EciVector; altKm: number } | null {
  if (!tle1 || !tle2) return null
  try {
    const satrec = twoline2satrec(tle1.trim(), tle2.trim())
    const gmst = gstime(at)
    const prop = propagate(satrec, at)
    const positionEci = prop.position
    if (!positionEci || typeof positionEci === 'boolean') return null
    const geo = eciToGeodetic(positionEci, gmst)
    return { eci: { x: positionEci.x, y: positionEci.y, z: positionEci.z }, altKm: geo.height }
  } catch {
    return null
  }
}

export function generateEciTrack(tle1: string, tle2: string, durationMin: number, stepMin: number, centerTime?: Date): { eci: EciVector; altKm: number }[] {
  const out: { eci: EciVector; altKm: number }[] = []
  if (!tle1 || !tle2) return out
  try {
    const satrec = twoline2satrec(tle1.trim(), tle2.trim())
    const center = centerTime || new Date()
    const start = center.getTime() - (durationMin / 2) * 60000
    for (let m = 0; m <= durationMin; m += stepMin) {
      const t = new Date(start + m * 60000)
      const prop = propagate(satrec, t)
      const p = prop.position
      if (!p || typeof p === 'boolean') continue
      const gmst = gstime(t)
      const geo = eciToGeodetic(p, gmst)
      out.push({ eci: { x: p.x, y: p.y, z: p.z }, altKm: geo.height })
    }
  } catch {}
  return out
}

export function currentGeodeticFromTLE(tle1: string, tle2: string): OrbitPoint | null {
  if (!tle1 || !tle2) return null
  try {
    const satrec = twoline2satrec(tle1.trim(), tle2.trim())
    const now = new Date()
    const gmst = gstime(now)
    const prop = propagate(satrec, now)
    const positionEci = prop.position
    if (!positionEci || typeof positionEci === 'boolean') return null
    const geo = eciToGeodetic(positionEci, gmst)
    return {
      lat: radiansToDegrees(geo.latitude),
      lon: radiansToDegrees(geo.longitude),
      altKm: geo.height
    }
  } catch {
    return null
  }
}

// Helpers to create a minimal TLE from orbital elements (approximate, for visualization)
const padRight = (s: string, w: number) => (s.length >= w ? s : s + ' '.repeat(w - s.length))

const tleChecksum = (line: string): number => {
  let sum = 0
  for (let i = 0; i < 68 && i < line.length; i++) {
    const c = line[i]
    if (c >= '0' && c <= '9') sum += Number(c)
    else if (c === '-') sum += 1
  }
  return sum % 10
}

const formatEpochYYDDD = (date: Date): string => {
  const year = date.getUTCFullYear() % 100
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const diff = date.getTime() - start
  const day = Math.floor(diff / 86400000)
  const fraction = ((diff % 86400000) / 86400000).toFixed(8).slice(2)
  return `${year.toString().padStart(2, '0')}${day.toString().padStart(3, '0')}.${fraction}`
}

export type KeplerianElements = {
  inclinationDeg: number
  raanDeg: number
  eccentricity: number
  argumentOfPerigeeDeg: number
  meanAnomalyDeg: number
  meanMotionRevPerDay: number
  epoch?: Date
  noradId?: number
  name?: string
}

export function createTLEFromKeplerian(elements: KeplerianElements): { line1: string; line2: string; name: string } {
  const norad = (elements.noradId && elements.noradId > 0 ? elements.noradId : 99990 + Math.floor(Math.random() * 9))
  const name = elements.name || `CUSTOM-${norad}`
  const epoch = elements.epoch || new Date()
  const epochStr = formatEpochYYDDD(epoch)
  const i = elements.inclinationDeg.toFixed(4).padStart(8, ' ')
  const raan = elements.raanDeg.toFixed(4).padStart(8, ' ')
  const ecc = Math.round(Math.abs(elements.eccentricity) * 1e7).toString().padStart(7, '0')
  const argPer = elements.argumentOfPerigeeDeg.toFixed(4).padStart(8, ' ')
  const meanAnom = elements.meanAnomalyDeg.toFixed(4).padStart(8, ' ')
  const meanMotion = elements.meanMotionRevPerDay.toFixed(8).padStart(11, ' ')
  const revNum = '0'.padStart(5, ' ')

  // Line 1 (drag/bstar set to zero; classification U; element set 999)
  let l1 = `1 ${norad.toString().padStart(5, '0')}U 00000A   ${epochStr}  .00000000  00000-0  00000-0 0  999`
  l1 = padRight(l1, 68)
  l1 = l1 + tleChecksum(l1)
  // Line 2
  let l2 = `2 ${norad.toString().padStart(5, '0')}${i}${raan} ${ecc} ${argPer} ${meanAnom} ${meanMotion}${revNum}`
  l2 = padRight(l2, 68)
  l2 = l2 + tleChecksum(l2)
  return { line1: l1, line2: l2, name }
}


