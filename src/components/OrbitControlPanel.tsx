import React, { useState, useEffect } from 'react';
import { createTLEFromKeplerian } from '../utils/orbit';

// Local interface for internal state management
interface LocalKeplerianElements {
  semiMajorAxisKm: number;
  eccentricity: number;
  inclinationDeg: number;
  raanDeg: number;
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  epochYear: number;
  epochDay: number;
}

// Import the actual type for TLE generation
import type { KeplerianElements } from '../utils/orbit';

// Local Satellite interface matching App.tsx format
interface Satellite {
  id: string;
  name: string;
  noradId: string;
  tle1?: string;
  tle2?: string;
  status: string;
  orbitalParams: any;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  lastUpdate: Date;
}

interface OrbitControlPanelProps {
  satellite: Satellite | null;
  onApplyManeuver: (satelliteId: string, newTle1: string, newTle2: string, description: string) => void;
  onClose: () => void;
  collisionRisk?: {
    targetName: string;
    missDistanceKm: number;
    tcaDate: Date;
    relativeVelocityKmS: number;
    probability: number;
  } | null;
}

export function OrbitControlPanel({ satellite, onApplyManeuver, onClose, collisionRisk }: OrbitControlPanelProps) {
  const [elements, setElements] = useState<LocalKeplerianElements | null>(null);
  const [adjustments, setAdjustments] = useState({
    altitudeChange: 0, // km
    inclinationChange: 0, // degrees
    raanChange: 0, // degrees
    eccentricityChange: 0,
    argPerigeeChange: 0, // degrees
    meanAnomalyChange: 0 // degrees
  });
  const [maneuverDescription, setManeuverDescription] = useState('');
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (!satellite || !satellite.tle2) return;
    
    // Parse current orbital elements from TLE
    const tle2 = satellite.tle2;
    const inclinationDeg = parseFloat(tle2.substring(8, 16).trim());
    const raanDeg = parseFloat(tle2.substring(17, 25).trim());
    const eccentricity = parseFloat('0.' + tle2.substring(26, 33).trim());
    const argPerigeeDeg = parseFloat(tle2.substring(34, 42).trim());
    const meanAnomalyDeg = parseFloat(tle2.substring(43, 51).trim());
    const meanMotion = parseFloat(tle2.substring(52, 63).trim());
    
    // Calculate semi-major axis from mean motion
    const mu = 398600.4418; // Earth's gravitational parameter (km³/s²)
    const n = meanMotion * 2 * Math.PI / 86400; // Convert rev/day to rad/s
    const a = Math.pow(mu / (n * n), 1/3); // Semi-major axis in km
    // const altitudeKm = a - 6371; // Approximate altitude (unused)
    
    setElements({
      semiMajorAxisKm: a,
      eccentricity,
      inclinationDeg,
      raanDeg,
      argPerigeeDeg,
      meanAnomalyDeg,
      epochYear: 24,
      epochDay: 1.0
    });
    
    // Check for AI-suggested maneuver from window object
    const aiSuggestion = (window as any).__aiSuggestedManeuver;
    if (aiSuggestion) {
      console.log('🤖 Applying AI-suggested maneuver:', aiSuggestion);
      setAdjustments({
        altitudeChange: aiSuggestion.altitudeChange || 0,
        inclinationChange: aiSuggestion.inclinationChange || 0,
        raanChange: aiSuggestion.raanChange || 0,
        eccentricityChange: aiSuggestion.eccentricityChange || 0,
        argPerigeeChange: 0,
        meanAnomalyChange: 0
      });
      setManeuverDescription(`[AI] Collision avoidance maneuver for ${satellite.name}`);
      
      // Clear the suggestion so it doesn't re-apply
      delete (window as any).__aiSuggestedManeuver;
    } else {
      setManeuverDescription(`Adjustment for ${satellite.name}`);
    }
  }, [satellite]);

  const calculateAvoidanceManeuver = () => {
    console.log('🤖 Auto-calculating avoidance maneuver...');
    console.log('Collision Risk:', collisionRisk);
    console.log('Elements:', elements);
    
    if (!collisionRisk || !elements) {
      console.error('❌ Missing collision risk or elements data');
      return;
    }
    
    setCalculating(true);
    
    // Simple avoidance strategy: raise/lower altitude by 2-10 km
    const missDistance = collisionRisk.missDistanceKm;
    console.log('Miss Distance:', missDistance, 'km');
    
    let altChange = 0;
    let desc = '';
    
    if (missDistance < 0.5) {
      // Critical - very large maneuver
      altChange = 10;
      desc = `CRITICAL AVOIDANCE: Raise altitude by ${altChange}km to avoid collision with ${collisionRisk.targetName}`;
    } else if (missDistance < 1) {
      // Critical - large maneuver
      altChange = 8;
      desc = `CRITICAL AVOIDANCE: Raise altitude by ${altChange}km to avoid collision with ${collisionRisk.targetName}`;
    } else if (missDistance < 5) {
      // High risk - medium maneuver
      altChange = 5;
      desc = `⚠️ HIGH RISK AVOIDANCE: Raise altitude by ${altChange}km to increase separation from ${collisionRisk.targetName}`;
    } else if (missDistance < 10) {
      // Moderate risk - small maneuver
      altChange = 3;
      desc = `⚠️ MODERATE RISK AVOIDANCE: Raise altitude by ${altChange}km for safer separation from ${collisionRisk.targetName}`;
    } else {
      // Low risk
      altChange = 2;
      desc = `ℹ️ PRECAUTIONARY AVOIDANCE: Raise altitude by ${altChange}km for safer separation from ${collisionRisk.targetName}`;
    }
    
    console.log('✅ Calculated maneuver:', { altChange, desc });
    
    setAdjustments({
      altitudeChange: altChange,
      inclinationChange: 0,
      raanChange: 0,
      eccentricityChange: 0,
      argPerigeeChange: 0,
      meanAnomalyChange: 0
    });
    setManeuverDescription(desc);
    setCalculating(false);
  };

  const applyManeuver = () => {
    if (!satellite || !elements) return;
    
    try {
      console.log('🚀 Applying maneuver...');
      console.log('Current elements:', elements);
      console.log('Adjustments:', adjustments);
      
      // Calculate new semi-major axis from altitude change
      const currentAltitude = elements.semiMajorAxisKm - 6371;
      const newAltitude = currentAltitude + adjustments.altitudeChange;
      const newSemiMajorAxis = newAltitude + 6371;
      
      console.log('Altitude:', currentAltitude, '→', newAltitude, 'km');
      
      // Calculate new mean motion from semi-major axis
      const mu = 398600.4418; // Earth's gravitational parameter (km³/s²)
      const newMeanMotionRadPerSec = Math.sqrt(mu / Math.pow(newSemiMajorAxis, 3));
      const newMeanMotionRevPerDay = newMeanMotionRadPerSec * 86400 / (2 * Math.PI);
      
      console.log('New mean motion:', newMeanMotionRevPerDay, 'rev/day');
      
      // Build new elements for TLE generation
      const newElements: KeplerianElements = {
        inclinationDeg: elements.inclinationDeg + adjustments.inclinationChange,
        raanDeg: (elements.raanDeg + adjustments.raanChange + 360) % 360,
        eccentricity: Math.max(0, Math.min(0.9, elements.eccentricity + adjustments.eccentricityChange)),
        argumentOfPerigeeDeg: (elements.argPerigeeDeg + adjustments.argPerigeeChange + 360) % 360,
        meanAnomalyDeg: (elements.meanAnomalyDeg + adjustments.meanAnomalyChange + 360) % 360,
        meanMotionRevPerDay: newMeanMotionRevPerDay,
        epoch: new Date(),
        noradId: parseInt(satellite.noradId) || undefined,
        name: satellite.name
      };
      
      console.log('New Keplerian elements:', newElements);
      
      // Generate new TLE
      const { line1, line2 } = createTLEFromKeplerian(newElements);
      
      console.log('Generated TLE:');
      console.log('Line 1:', line1);
      console.log('Line 2:', line2);
      
      // Calculate delta-v estimate (simplified Hohmann transfer)
      const v1 = Math.sqrt(mu / elements.semiMajorAxisKm);
      const v2 = Math.sqrt(mu / newSemiMajorAxis);
      const deltaV = Math.abs(v2 - v1) * 1000; // Convert to m/s
      
      const fullDescription = `${maneuverDescription} | ΔV ≈ ${deltaV.toFixed(2)} m/s | Alt change: ${adjustments.altitudeChange.toFixed(2)}km`;
      
      console.log('✅ Maneuver calculated:', fullDescription);
      
      onApplyManeuver(satellite.id, line1, line2, fullDescription);
      onClose();
    } catch (err: any) {
      console.error('❌ Failed to apply maneuver:', err);
      console.error('Error details:', err.message, err.stack);
      alert(`Failed to calculate new orbit parameters:\n${err.message}\n\nCheck console for details.`);
    }
  };

  if (!satellite) {
    return (
      <div style={styles.overlay}>
        <div style={styles.panel}>
          <h3>No satellite selected</h3>
          <button onClick={onClose} style={styles.closeBtn}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.title}>🛰️ Orbit Control: {satellite.name}</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        
        {collisionRisk && (
          <div style={styles.warningBox}>
            <h3 style={styles.warningTitle}>⚠️ COLLISION RISK DETECTED</h3>
            <div style={styles.riskDetails}>
              <p><strong>Target:</strong> {collisionRisk.targetName}</p>
              <p><strong>Miss Distance:</strong> {collisionRisk.missDistanceKm.toFixed(2)} km</p>
              <p><strong>Time to TCA:</strong> {Math.abs((collisionRisk.tcaDate.getTime() - Date.now()) / 60000).toFixed(0)} minutes</p>
              <p><strong>Relative Velocity:</strong> {collisionRisk.relativeVelocityKmS.toFixed(2)} km/s</p>
              <p><strong>Collision Probability:</strong> {(collisionRisk.probability * 100).toFixed(4)}%</p>
            </div>
            <button 
              onClick={calculateAvoidanceManeuver} 
              disabled={calculating}
              style={styles.autoBtn}
            >
              {calculating ? 'Calculating...' : 'Auto-Calculate Avoidance'}
            </button>
          </div>
        )}
        
        {elements && (
          <div style={styles.content}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Current Orbital Elements</h3>
              <div style={styles.paramGrid}>
                <div style={styles.param}>
                  <span>Altitude:</span>
                  <span>{(elements.semiMajorAxisKm - 6371).toFixed(2)} km</span>
                </div>
                <div style={styles.param}>
                  <span>Eccentricity:</span>
                  <span>{elements.eccentricity.toFixed(6)}</span>
                </div>
                <div style={styles.param}>
                  <span>Inclination:</span>
                  <span>{elements.inclinationDeg.toFixed(2)}°</span>
                </div>
                <div style={styles.param}>
                  <span>RAAN:</span>
                  <span>{elements.raanDeg.toFixed(2)}°</span>
                </div>
                <div style={styles.param}>
                  <span>Arg of Perigee:</span>
                  <span>{elements.argPerigeeDeg.toFixed(2)}°</span>
                </div>
                <div style={styles.param}>
                  <span>Mean Anomaly:</span>
                  <span>{elements.meanAnomalyDeg.toFixed(2)}°</span>
                </div>
              </div>
            </div>
            
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Maneuver Adjustments</h3>
              <div style={styles.adjustmentGrid}>
                <label style={styles.label}>
                  Altitude Change (km):
                  <input
                    type="number"
                    step="0.1"
                    value={adjustments.altitudeChange}
                    onChange={(e) => setAdjustments({ ...adjustments, altitudeChange: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                  />
                </label>
                
                <label style={styles.label}>
                  Inclination Change (°):
                  <input
                    type="number"
                    step="0.01"
                    value={adjustments.inclinationChange}
                    onChange={(e) => setAdjustments({ ...adjustments, inclinationChange: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                  />
                </label>
                
                <label style={styles.label}>
                  RAAN Change (°):
                  <input
                    type="number"
                    step="0.1"
                    value={adjustments.raanChange}
                    onChange={(e) => setAdjustments({ ...adjustments, raanChange: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                  />
                </label>
                
                <label style={styles.label}>
                  Eccentricity Change:
                  <input
                    type="number"
                    step="0.0001"
                    value={adjustments.eccentricityChange}
                    onChange={(e) => setAdjustments({ ...adjustments, eccentricityChange: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                  />
                </label>
              </div>
              
              <label style={styles.label}>
                Maneuver Description:
                <textarea
                  value={maneuverDescription}
                  onChange={(e) => setManeuverDescription(e.target.value)}
                  style={styles.textarea}
                  rows={3}
                />
              </label>
            </div>
            
            <div style={styles.actions}>
              <button onClick={applyManeuver} style={styles.applyBtn}>
                🚀 Apply Maneuver
              </button>
              <button onClick={onClose} style={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000
  },
  panel: {
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    borderRadius: 16,
    padding: 24,
    maxWidth: 800,
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff'
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: 24,
    cursor: 'pointer',
    padding: 8
  },
  warningBox: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '2px solid #ef4444',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20
  },
  warningTitle: {
    margin: '0 0 12px 0',
    color: '#fca5a5',
    fontSize: 18
  },
  riskDetails: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 12
  },
  autoBtn: {
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 'bold',
    width: '100%'
  },
  content: {
    color: '#e2e8f0'
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: 18,
    color: '#60a5fa',
    borderBottom: '1px solid rgba(59, 130, 246, 0.3)',
    paddingBottom: 8
  },
  paramGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12
  },
  param: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: 8,
    background: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 6,
    fontSize: 14
  },
  adjustmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 16
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 14,
    color: '#cbd5e1'
  },
  input: {
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(59, 130, 246, 0.5)',
    borderRadius: 6,
    padding: 8,
    color: '#fff',
    fontSize: 14
  },
  textarea: {
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(59, 130, 246, 0.5)',
    borderRadius: 6,
    padding: 8,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'vertical'
  },
  actions: {
    display: 'flex',
    gap: 12,
    marginTop: 24
  },
  applyBtn: {
    flex: 1,
    background: '#10b981',
    color: '#fff',
    border: 'none',
    padding: '12px 24px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: 16
  },
  cancelBtn: {
    background: '#6b7280',
    color: '#fff',
    border: 'none',
    padding: '12px 24px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: 16
  }
};

