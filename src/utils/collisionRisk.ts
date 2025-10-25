/**
 * Collision risk assessment utilities
 */

export interface CollisionRisk {
  targetName: string;
  targetId: string;
  missDistanceKm: number;
  tcaDate: Date;
  relativeVelocityKmS: number;
  probability: number;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
}

/**
 * Calculate collision probability based on miss distance and relative velocity
 * Uses simplified formula - production systems use more sophisticated models
 */
export function calculateCollisionProbability(
  missDistanceKm: number,
  relativeVelocityKmS: number,
  primaryRadiusKm: number = 0.01, // ~10m typical satellite
  secondaryRadiusKm: number = 0.01
): number {
  // Combined radius (sum of both object radii)
  const combinedRadiusKm = primaryRadiusKm + secondaryRadiusKm;
  
  // If miss distance is less than combined radius, collision is certain
  if (missDistanceKm <= combinedRadiusKm) {
    return 1.0;
  }
  
  // Simplified probability model using normal distribution
  // Assumes positional uncertainty grows with distance
  const sigma = Math.max(0.5, missDistanceKm * 0.1); // Positional uncertainty in km
  
  // Probability density function of collision
  const probability = Math.exp(-Math.pow(missDistanceKm / sigma, 2) / 2) * 
                     (combinedRadiusKm / missDistanceKm);
  
  return Math.min(1.0, Math.max(0, probability));
}

/**
 * Assess risk level based on miss distance and time to TCA
 */
export function assessRiskLevel(
  missDistanceKm: number,
  timeToTcaMinutes: number
): 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' {
  // Immediate threats (< 1 hour)
  if (timeToTcaMinutes < 60) {
    if (missDistanceKm < 1) return 'CRITICAL';
    if (missDistanceKm < 5) return 'HIGH';
    if (missDistanceKm < 10) return 'MODERATE';
    return 'LOW';
  }
  
  // Near-term threats (1-24 hours)
  if (timeToTcaMinutes < 1440) {
    if (missDistanceKm < 0.5) return 'CRITICAL';
    if (missDistanceKm < 2) return 'HIGH';
    if (missDistanceKm < 5) return 'MODERATE';
    return 'LOW';
  }
  
  // Long-term monitoring (> 24 hours)
  if (missDistanceKm < 0.5) return 'HIGH';
  if (missDistanceKm < 1) return 'MODERATE';
  return 'LOW';
}

/**
 * Calculate required delta-v for collision avoidance maneuver
 * Returns altitude change needed and estimated delta-v
 */
export function calculateAvoidanceManeuver(
  currentAltitudeKm: number,
  missDistanceKm: number,
  timeToTcaMinutes: number
): {
  altitudeChangeKm: number;
  deltaVMs: number;
  description: string;
} {
  const earthRadius = 6371; // km
  const mu = 398600.4418; // Earth's gravitational parameter (km³/s²)
  
  // Determine maneuver magnitude based on risk
  let altitudeChangeKm = 0;
  let description = '';
  
  if (missDistanceKm < 1) {
    // Critical - large maneuver
    altitudeChangeKm = Math.max(5, missDistanceKm * 5);
    description = 'CRITICAL avoidance maneuver';
  } else if (missDistanceKm < 5) {
    // High risk - medium maneuver
    altitudeChangeKm = Math.max(3, missDistanceKm * 2);
    description = 'HIGH RISK avoidance maneuver';
  } else if (missDistanceKm < 10) {
    // Moderate risk - small maneuver
    altitudeChangeKm = Math.max(2, missDistanceKm);
    description = 'MODERATE RISK avoidance maneuver';
  } else {
    // Low risk - minimal adjustment
    altitudeChangeKm = 1;
    description = 'Precautionary maneuver';
  }
  
  // Calculate delta-v (simplified circular orbit assumption)
  const r1 = earthRadius + currentAltitudeKm;
  const r2 = earthRadius + currentAltitudeKm + altitudeChangeKm;
  
  const v1 = Math.sqrt(mu / r1); // km/s
  const v2 = Math.sqrt(mu / r2); // km/s
  
  const deltaVKmS = Math.abs(v2 - v1);
  const deltaVMs = deltaVKmS * 1000; // Convert to m/s
  
  return {
    altitudeChangeKm,
    deltaVMs,
    description
  };
}

/**
 * Estimate time until next maneuver opportunity
 * Based on orbital period and ground station passes
 */
export function estimateManeuverWindow(
  altitudeKm: number,
  timeToTcaMinutes: number
): {
  canManeuverNow: boolean;
  nextWindowMinutes: number;
  windowDescription: string;
} {
  const earthRadius = 6371;
  const mu = 398600.4418;
  const r = earthRadius + altitudeKm;
  
  // Calculate orbital period
  const periodMinutes = 2 * Math.PI * Math.sqrt(Math.pow(r, 3) / mu) / 60;
  
  // Assume ground station contact every ~90 minutes (simplified)
  const nextContactMinutes = 45; // Average time to next pass
  
  // Can maneuver if we have enough time before TCA
  const canManeuverNow = timeToTcaMinutes > nextContactMinutes + 10;
  
  let windowDescription = '';
  if (canManeuverNow) {
    windowDescription = `Maneuver window available. Execute within ${Math.floor(timeToTcaMinutes - nextContactMinutes)} minutes.`;
  } else {
    windowDescription = `URGENT: Limited time before TCA. Immediate action required.`;
  }
  
  return {
    canManeuverNow,
    nextWindowMinutes: nextContactMinutes,
    windowDescription
  };
}

