import { useEffect, useState, useMemo, useRef } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
// import { Earth3DVisualization } from './components/Earth3DVisualization';
import { Earth2DVisualization } from './components/Earth2DVisualization';
import { Earth3DVisualization } from './components/Earth3DVisualization';
import { AssistantPanel } from './components/AssistantPanel';
import { OrbitControlPanel } from './components/OrbitControlPanel';
import { SpaceWeatherMonitor } from './components/SpaceWeatherMonitor';
import { TopBar } from './components/TopBar';
import { useConjunctions } from './hooks/useConjunctions';
import { generateOrbitPath, currentGeodeticFromTLE, createTLEFromKeplerian, KeplerianElements, geodeticFromTLEAt, eciFromTLEAt, generateEciTrack } from './utils/orbit';
import { calculateCollisionProbability, assessRiskLevel, CollisionRisk } from './utils/collisionRisk';
import { gstime } from 'satellite.js';

interface Satellite {
  id: string;
  name: string;
  noradId: string;
  tle1?: string;
  tle2?: string;
  status: string;
  orbitalParams: {
    semiMajorAxis: number;
    inclination: number;
    eccentricity: number;
    raan: number;
    argumentOfPerigee: number;
    meanAnomaly: number;
    meanMotion: number;
    period: number;
  };
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  lastUpdate: Date;
}

interface SpaceWeatherEvent {
  id: string;
  type: 'CME' | 'Solar Flare' | 'Geomagnetic Storm' | 'SEP';
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  timestamp: string;
  impact?: string;
}

function App() {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<'operational' | 'warning' | 'critical'>('operational');
  const [spaceWeatherEvents, setSpaceWeatherEvents] = useState<SpaceWeatherEvent[]>([]);
  const [view, setView] = useState<'3d' | '2d'>('3d');
  const [adding, setAdding] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);
  const [newNoradId, setNewNoradId] = useState<string>("");
  const { data: cdmData, loading: cdmLoading, error: cdmError } = useConjunctions('now-3');
  const [activeTab, setActiveTab] = useState<'dashboard' | '3d' | '2d' | 'conjunctions' | 'weather' | 'settings'>('dashboard');
  const [nameToNorad, setNameToNorad] = useState<Record<string, string>>({});
  const [userOrbits, setUserOrbits] = useState<{ id: string; path: { lat: number; lon: number; altKm: number }[]; color?: string }[]>([]);
  const [sidePanelTab, setSidePanelTab] = useState<'tracked' | 'myconj' | 'weather' | 'maneuvers'>('tracked');
  const [elements, setElements] = useState<KeplerianElements>({
    inclinationDeg: 98.0,
    raanDeg: 0,
    eccentricity: 0.001,
    argumentOfPerigeeDeg: 0,
    meanAnomalyDeg: 0,
    meanMotionRevPerDay: 15.0,
    name: 'CUSTOM'
  });
  const [paramCheck, setParamCheck] = useState<{ status: 'ok' | 'error' | null; text: string }>({ status: null, text: '' });
  const [n2yoKey] = useState<string | undefined>(() => (import.meta as any).env?.VITE_N2YO_API_KEY || (window as any)?.REACT_APP_N2YO_API_KEY);
  const [showAffected, setShowAffected] = useState<boolean>(false)
  const [kpIndex, setKpIndex] = useState<number>(0)
  const [affectedSatIds, setAffectedSatIds] = useState<Set<string>>(new Set())
  const [affectedCone, setAffectedCone] = useState<{ lonCenter: number; halfAngle: number } | null>(null)
  const [nameLookupRequested, setNameLookupRequested] = useState<Record<string, boolean>>({})
  const [simMinutes, setSimMinutes] = useState<number>(0)
  const [simRunning, setSimRunning] = useState<boolean>(false)
  // simSpeed is minutes advanced per real second
  const [simSpeed, setSimSpeed] = useState<number>(5)
  const tleLookupRequestedRef = useRef<Record<string, boolean>>({})
  const [conjunctionPoint, setConjunctionPoint] = useState<{ lat: number; lon: number; altKm: number; tca: string } | null>(null)
  const [showOrbits, setShowOrbits] = useState<boolean>(true)
  
  // Orbit control and collision avoidance
  const [orbitControlOpen, setOrbitControlOpen] = useState<boolean>(false)
  const [orbitControlSatellite, setOrbitControlSatellite] = useState<Satellite | null>(null)
  const [orbitControlCollisionRisk, setOrbitControlCollisionRisk] = useState<CollisionRisk | null>(null)
  const [maneuverHistory, setManeuverHistory] = useState<Array<{
    id: string;
    satelliteId: string;
    satelliteName: string;
    timestamp: Date;
    description: string;
    oldTle1: string;
    oldTle2: string;
    newTle1: string;
    newTle2: string;
  }>>([])
  const [detectedCollisionRisks, setDetectedCollisionRisks] = useState<CollisionRisk[]>([])
  const [autoAlertShown, setAutoAlertShown] = useState<Set<string>>(new Set()) // Track which conjunctions we've alerted about
  const [spaceWeatherThreats, setSpaceWeatherThreats] = useState<Array<{
    eventType: string;
    severity: string;
    affectedSatellites: string[];
    description: string;
    startTime: Date;
  }>>([])
  const [weatherAlertShown, setWeatherAlertShown] = useState<Set<string>>(new Set())
  const [demoMode, setDemoMode] = useState<boolean>(false)

  const estimateMeanMotionFromAlt = (altKm: number): number => {
    const R = 6371
    const mu = 398600.4418 // km^3/s^2
    const a = Math.max(R + Math.max(altKm, 200), R + 200) // clamp >=200 km
    const nRadPerSec = Math.sqrt(mu / (a * a * a))
    const revPerDay = (nRadPerSec * 86400) / (2 * Math.PI)
    return revPerDay
  }

  // Smooth playback using requestAnimationFrame
  useEffect(() => {
    if (!simRunning) return
    console.log('[SIM] Playback started, speed=', simSpeed)
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dtSec = Math.max(0, (now - last) / 1000)
      last = now
      setSimMinutes(prev => prev + simSpeed * dtSec)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      console.log('[SIM] Playback stopped')
      cancelAnimationFrame(raf)
    }
  }, [simRunning, simSpeed])

  const simDate = useMemo(() => new Date(Date.now() + simMinutes * 60000), [simMinutes])
  const gmstRad = useMemo(() => gstime(simDate), [simDate])
  
  // DEMO MODE: Simulates collision and space weather threats for demonstration
  useEffect(() => {
    if (!demoMode) {
      // Clear demo threats when demo mode is disabled
      setDetectedCollisionRisks([]);
      setSpaceWeatherThreats([]);
      return;
    }

    console.log('[DEMO MODE] Activating simulated threats...');
    
    // Simulate collision threat
    const demoCollisionTimer = setTimeout(() => {
      if (satellites.length === 0) return;
      
      const targetSat = satellites[0];
      console.log('[DEMO] Creating simulated collision risk for', targetSat.name);
      
      const demoRisk: CollisionRisk = {
        targetName: 'DEMO DEBRIS OBJECT',
        targetId: 'demo_debris_99999',
        missDistanceKm: 0.4,
        tcaDate: new Date(Date.now() + 8 * 60000), // 8 minutes from now
        relativeVelocityKmS: 7.8,
        probability: calculateCollisionProbability(0.4, 7.8),
        riskLevel: 'CRITICAL'
      };
      
      setDetectedCollisionRisks([demoRisk]);
      
      // Auto-open Orbit Control Panel with collision risk after a short delay
      setTimeout(() => {
        handleOpenOrbitControl(targetSat.id, demoRisk, {
          altitudeChange: 7,
          inclinationChange: 0,
          raanChange: 0
        });
      }, 4000); // 4 seconds after collision detected (6 seconds total)
    }, 2000);
    
    // Simulate space weather threat
    const demoWeatherTimer = setTimeout(() => {
      if (satellites.length === 0) return;
      
      const affectedSats = satellites.slice(0, 2).map(s => s.name);
      console.log('[DEMO] Creating simulated space weather threat for', affectedSats.join(', '));
      
      const demoWeatherThreat = {
        eventType: 'Coronal Mass Ejection (CME)',
        severity: 'Critical',
        affectedSatellites: affectedSats,
        description: 'High-speed solar wind and radiation detected. Immediate protective measures required.',
        startTime: new Date()
      };
      
      setSpaceWeatherThreats([demoWeatherThreat]);
      
      // Simulate affected satellites
      const affectedIds = new Set(satellites.slice(0, 2).map(s => s.id));
      setAffectedSatIds(affectedIds);
    }, 5000);
    
    return () => {
      clearTimeout(demoCollisionTimer);
      clearTimeout(demoWeatherTimer);
    };
  }, [demoMode, satellites])
  
  // Auto-detect conjunctions for tracked satellites
  useEffect(() => {
    if (!cdmData || (cdmData as any[]).length === 0) return;
    if (satellites.length === 0) return;
    
    const trackedNoradIds = new Set(satellites.map(s => s.noradId));
    const risks: CollisionRisk[] = [];
    
    // Check all conjunctions for tracked satellites
    (cdmData as any[]).forEach((conj: any) => {
      const { o1Id, o2Id, o1Name, o2Name } = resolveCdmNamesAndIds(conj);
      
      // Check if either satellite is tracked
      if (!o1Id || !o2Id) return;
      if (!trackedNoradIds.has(o1Id) && !trackedNoradIds.has(o2Id)) return;
      
      // Calculate risk
      const firstVal = (obj: any, keys: string[]): any => {
        for (const k of keys) {
          if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
        }
        return undefined;
      };
      
      const missDistKm = parseFloat(firstVal(conj, ['missDistanceKm', 'MISS_DISTANCE']) || '999');
      const tcaStr = firstVal(conj, ['tca', 'TCA']);
      const relVel = parseFloat(firstVal(conj, ['relativeSpeedKmS', 'RELATIVE_SPEED']) || '7.5');
      
      if (!tcaStr) return;
      const tcaDate = new Date(tcaStr);
      const timeToTcaMinutes = (tcaDate.getTime() - Date.now()) / 60000;
      
      const collisionProb = calculateCollisionProbability(missDistKm, relVel);
      const riskLevel = assessRiskLevel(missDistKm, Math.abs(timeToTcaMinutes));
      
      // Only alert for HIGH and CRITICAL risks
      if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
        const riskId = `${o1Id}-${o2Id}-${tcaStr}`;
        
        // Auto-alert through AI if not already shown
        if (!autoAlertShown.has(riskId)) {
          risks.push({
            targetName: trackedNoradIds.has(o1Id) ? o2Name : o1Name,
            targetId: trackedNoradIds.has(o1Id) ? o2Id : o1Id,
            missDistanceKm: missDistKm,
            tcaDate: tcaDate,
            relativeVelocityKmS: relVel,
            probability: collisionProb,
            riskLevel: riskLevel
          });
          
          console.log(`🚨 ${riskLevel} CONJUNCTION DETECTED:`);
          console.log(`   ${o1Name} ↔ ${o2Name}`);
          console.log(`   Miss Distance: ${missDistKm.toFixed(2)} km`);
          console.log(`   TCA: ${tcaDate.toUTCString()}`);
          console.log(`   Time to TCA: ${Math.abs(timeToTcaMinutes).toFixed(0)} minutes`);
          
          // Mark as shown
          setAutoAlertShown(prev => new Set([...prev, riskId]));
        }
      }
    });
    
    setDetectedCollisionRisks(risks);
  }, [cdmData, satellites, autoAlertShown]);
  
  // Assistant state snapshot (kept minimal)
  const buildAssistantState = () => ({
    simMinutes,
    simRunning,
    simDate: simDate.toISOString(),
    view,
    selectedSatelliteId,
    showOrbits,
    detectedCollisionRisks: detectedCollisionRisks.map(r => ({
      targetName: r.targetName,
      missDistanceKm: r.missDistanceKm,
      riskLevel: r.riskLevel,
      tcaDate: r.tcaDate.toISOString()
    })),
    spaceWeatherThreats: spaceWeatherThreats.map(t => ({
      eventType: t.eventType,
      severity: t.severity,
      affectedSatellites: t.affectedSatellites,
      description: t.description,
      startTime: t.startTime.toISOString()
    })),
    satellites: satellites.map(s => ({ id: s.id, name: s.name, altitude: s.position.z })).slice(0, 10),
    recentManeuvers: maneuverHistory.slice(0, 5).map(m => ({
      satelliteName: m.satelliteName,
      description: m.description,
      timestamp: m.timestamp.toISOString()
    }))
  })

  const executeAssistantPlan = (commands: Array<{ name: string; args?: any }>) => {
    for (const c of commands) {
      if (c.name === 'jumpToNow') { 
        setSimRunning(false); 
        setSimMinutes(0); 
        // Update satellite positions to current time
        setSatellites(prev => prev.map(s => {
          if (!s.tle1 || !s.tle2) return s;
          const currentPos = geodeticFromTLEAt(s.tle1, s.tle2, new Date());
          if (!currentPos) return s;
          return {
            ...s,
            position: {
              x: currentPos.lon,
              y: currentPos.lat,
              z: currentPos.altKm
            }
          };
        }));
        continue;
      }
      if (c.name === 'setSimMinutes') { const m = Number(c.args?.minutes)||0; setSimMinutes(m); continue }
      if (c.name === 'toggleOrbits') { setShowOrbits(!!c.args?.on); continue }
      if (c.name === 'focusSatellite') { if (c.args?.id) setSelectedSatelliteId(String(c.args.id)); continue }
      if (c.name === 'visualizeConjunction') { /* you can wire handleConjunctionClick here if you keep last feed */ continue }
      if (c.name === 'addSatelliteByNorad') { /* call handleAddSatelliteByNorad with args.noradId if available */ continue }
      if (c.name === 'openOrbitControl') {
        if (c.args?.satelliteId) {
          const satellite = satellites.find(s => s.id === String(c.args.satelliteId));
          if (satellite) {
            handleOpenOrbitControl(
              String(c.args.satelliteId), 
              undefined, 
              c.args?.suggestedManeuver
            );
          }
        }
        continue;
      }
      if (c.name === 'executeManeuver') {
        // AI can suggest maneuver parameters, but execution requires user approval in the panel
        console.log('⚠️ Maneuver execution requires manual approval via Orbit Control Panel');
        continue;
      }
    }
  }

  // ECI positions for 3D (single time)
  const eciLiveSatellites = useMemo(() => {
    const when = (simRunning || simMinutes !== 0) ? simDate : new Date()
    const out: Array<{ id: string; name: string; eci: { x: number; y: number; z: number }; altKm: number; color?: string }> = []
    for (const s of satellites) {
      if (!s.tle1 || !s.tle2) continue
      const e = eciFromTLEAt(s.tle1, s.tle2, when)
      if (!e) continue
      out.push({ id: s.id, name: s.name, eci: e.eci, altKm: e.altKm, color: s.id === selectedSatelliteId ? '#ffd700' : '#93c5fd' })
    }
    return out
  }, [satellites, simDate, simRunning, simMinutes, selectedSatelliteId])

  // ECI orbit trails for 3D (one period centered at view time)
  const eciOrbitTrails = useMemo(() => {
    const centerTime = (simRunning || simMinutes !== 0) ? simDate : new Date();
    const userOrbitIds = new Set(userOrbits.map(o => o.id));
    return satellites
      .filter(s => s.tle1 && s.tle2 && !userOrbitIds.has(s.id))
      .slice(0, 8)
      .map(s => {
        // derive orbital period minutes from TLE line2 (cols 52-63)
        let duration = 90;
        try {
          const mm = parseFloat((s.tle2 as string).substring(52, 63));
          if (isFinite(mm) && mm > 0) duration = 1440 / mm;
        } catch {}
        const points = generateEciTrack(s.tle1 as string, s.tle2 as string, duration, 2, centerTime).map(p => p.eci);
        return { id: s.id, points, color: s.id === selectedSatelliteId ? '#ffd700' : '#60a5fa' };
      });
  }, [satellites, userOrbits, selectedSatelliteId, simRunning, simMinutes, simDate])

  // Precompute simulated satellite positions at simDate
  const simulatedSatellitePositions = useMemo(() => {
    if (!simRunning && simMinutes === 0) return null
    const positions: Array<{ id: string; name: string; lat: number; lon: number; altKm: number; color: string }> = []
    for (const s of satellites) {
      let tle1 = s.tle1, tle2 = s.tle2
      if ((!tle1 || !tle2) && s.orbitalParams) {
        const synth = createTLEFromKeplerian({
          inclinationDeg: s.orbitalParams.inclination,
          raanDeg: s.orbitalParams.raan,
          eccentricity: s.orbitalParams.eccentricity,
          argumentOfPerigeeDeg: s.orbitalParams.argumentOfPerigee,
          meanAnomalyDeg: s.orbitalParams.meanAnomaly,
          meanMotionRevPerDay: s.orbitalParams.meanMotion,
          name: s.name,
        })
        tle1 = synth.line1; tle2 = synth.line2
      }
      if (!tle1 || !tle2) {
        const mm = estimateMeanMotionFromAlt(Number(s.position?.z) || 500)
        const synth = createTLEFromKeplerian({
          inclinationDeg: 51.6,
          raanDeg: 0,
          eccentricity: 0.0001,
          argumentOfPerigeeDeg: 0,
          meanAnomalyDeg: 0,
          meanMotionRevPerDay: mm,
          name: s.name || 'CUSTOM',
        })
        tle1 = synth.line1; tle2 = synth.line2
      }
      if (tle1 && tle2) {
        const p = geodeticFromTLEAt(tle1, tle2, simDate)
        if (p) {
          positions.push({
            id: s.id,
            name: s.name,
            lat: p.lat,
            lon: p.lon,
            altKm: p.altKm,
            color: s.id === selectedSatelliteId ? '#ffd700' : '#93c5fd'
          })
        }
      }
    }
    return positions
  }, [satellites, simDate, simRunning, simMinutes, selectedSatelliteId])

  // Convert simulated positions back to satellite format for 2D view
  const displaySatellites = useMemo(() => {
    if (!simulatedSatellitePositions) return satellites;
    
    return satellites.map(s => {
      const simPos = simulatedSatellitePositions.find(sp => sp.id === s.id);
      if (!simPos) return s;
      
      return {
        ...s,
        position: {
          x: simPos.lon,
          y: simPos.lat,
          z: simPos.altKm
        }
      };
    });
  }, [satellites, simulatedSatellitePositions]);

  // Debug: Log when userOrbits changes
  useEffect(() => {
    console.log('🔄 userOrbits changed:', userOrbits.length, 'orbits');
    userOrbits.forEach(orbit => {
      console.log(`   - ${orbit.id}: ${orbit.path.length} points, color: ${orbit.color}`);
    });
  }, [userOrbits]);

  // Recompute user orbit paths around simDate when simulation is active
  const simulatedUserOrbits = useMemo(() => {
    if (!simRunning && simMinutes === 0) {
      console.log('📍 Using userOrbits directly (no simulation):', userOrbits.length, 'orbits');
      return userOrbits;
    }
    
    console.log('📍 Regenerating userOrbits for simulated time:', userOrbits.length, 'base orbits');
    const paths: { id: string; path: { lat: number; lon: number; altKm: number }[]; color: string }[] = []
    
    for (const userOrbit of userOrbits) {
      const satellite = satellites.find(s => s.id === userOrbit.id)
      if (!satellite || !satellite.tle1 || !satellite.tle2) continue
      
      // Generate full orbit around simulated time (not partial path)
      const path = generateOrbitPath(satellite.tle1, satellite.tle2, undefined, 2, simDate)
      
      if (path.length > 0) {
        paths.push({ 
          id: userOrbit.id, 
          path, 
          color: userOrbit.color || '#60a5fa' 
        })
      }
    }
    
    return paths.length > 0 ? paths : userOrbits
  }, [userOrbits, satellites, simDate, simRunning, simMinutes])

  const normalizeName = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

  // Load persistent cache once
  useEffect(() => {
    try {
      const cached = localStorage.getItem('nameToNoradCache')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && typeof parsed === 'object') setNameToNorad(prev => ({ ...parsed, ...prev }))
      }
    } catch {}
  }, [])

  // Merge satellites->map after load (keeps any cached ids)
  useEffect(() => {
    if (!satellites || satellites.length === 0) return;
    const map: Record<string, string> = {}
    for (const s of satellites) {
      if (!s.name) continue
      const rawKey = s.name.toLowerCase()
      const normKey = normalizeName(s.name)
      map[rawKey] = s.noradId
      if (normKey) map[normKey] = s.noradId
    }
    setNameToNorad(prev => ({ ...prev, ...map }))
    try { localStorage.setItem('nameToNoradCache', JSON.stringify({ ...map, ...nameToNorad })) } catch {}
  }, [satellites])

  const persistMap = (name: string, id: string) => {
    const rawKey = name.toLowerCase()
    const normKey = normalizeName(name)
    setNameToNorad(prev => {
      const next = { ...prev, [rawKey]: id, ...(normKey ? { [normKey]: id } : {}) }
      try { localStorage.setItem('nameToNoradCache', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const removeSatellite = (id: string) => {
    setSatellites(prev => prev.filter(s => s.id !== id));
    setUserOrbits(prev => prev.filter(p => p.id !== id));
    if (selectedSatelliteId === id) setSelectedSatelliteId(undefined);
    
    // Clear conjunction marker if no satellites left
    const remaining = satellites.filter(s => s.id !== id);
    if (remaining.length === 0) {
      setConjunctionPoint(null);
    }
  };

  const extractNoradFromL1 = (l1?: string): number | undefined => {
    if (!l1) return undefined
    const m = l1.match(/^1\s*(\d{1,5})/)
    if (m && m[1]) return Number(m[1])
    // fallback to fixed columns: columns 3-7 in TLE are sat number
    const num = l1.substring(2, 7).trim()
    const n = Number(num)
    return Number.isFinite(n) ? n : undefined
  }

  const parseFromTLE = (obj: any, idx: number): Satellite | null => {
    const tle1 = obj.TLE_LINE1;
    const tle2 = obj.TLE_LINE2;
    if (!tle1 || !tle2) return null;
    const inclination = parseFloat(tle2.substring(8, 16));
    const raan = parseFloat(tle2.substring(17, 25));
    const eccentricity = parseFloat('0.' + tle2.substring(26, 33));
    const argumentOfPerigee = parseFloat(tle2.substring(34, 42));
    const meanAnomaly = parseFloat(tle2.substring(43, 51));
    const meanMotion = parseFloat(tle2.substring(52, 63));
    const mu = 398600.4418; // km^3/s^2
    const n = meanMotion * 2 * Math.PI / 86400; // rad/s
    const semiMajorAxis = Math.pow(mu / (n * n), 1/3);
    const period = 1440 / meanMotion;
    const geo = currentGeodeticFromTLE(tle1, tle2);
    const norad = obj.NORAD_CAT_ID || extractNoradFromL1(tle1) || undefined
    return {
      id: `sat_${norad ?? (idx + 1)}`,
      name: obj.OBJECT_NAME || `Satellite ${idx + 1}`,
      noradId: String(norad ?? (idx + 1)),
      tle1,
      tle2,
      status: 'active',
      orbitalParams: {
        semiMajorAxis,
        inclination,
        eccentricity,
        raan,
        argumentOfPerigee,
        meanAnomaly,
        meanMotion,
        period
      },
      position: { x: geo?.lon || 0, y: geo?.lat || 0, z: geo?.altKm || Math.max(0, semiMajorAxis - 6371) },
      velocity: { x: 0, y: 0, z: 0 },
      lastUpdate: new Date()
    };
  };

  useEffect(() => {
    const fallback = [
      {
        OBJECT_NAME: 'ISS (ZARYA)',
        NORAD_CAT_ID: 25544,
        TLE_LINE1: '1 25544U 98067A   24300.54791667  .00004230  00000-0  99188-4 0  9990',
        TLE_LINE2: '2 25544  51.6440  31.7492 0009013  77.5070 282.6464 15.50008891 99188'
      },
      {
        OBJECT_NAME: 'HST',
        NORAD_CAT_ID: 20580,
        TLE_LINE1: '1 20580U 90037B   24300.50000000  .00000000  00000-0  00000-0 0  9999',
        TLE_LINE2: '2 20580  28.4690  82.2000 0002830   0.0000   0.0000 14.23333333 99999'
      },
      {
        OBJECT_NAME: 'STARLINK-1007',
        NORAD_CAT_ID: 44713,
        TLE_LINE1: '1 44713U 19074A   24300.50000000  .00001234  00000-0  12345-3 0  9998',
        TLE_LINE2: '2 44713  53.0534 123.4567 0001234  89.1234 270.9876 15.06492345123456'
      },
      {
        OBJECT_NAME: 'NOAA 18',
        NORAD_CAT_ID: 28654,
        TLE_LINE1: '1 28654U 05018A   24300.50000000  .00000123  00000-0  12345-4 0  9997',
        TLE_LINE2: '2 28654  99.0534  12.3456 0012345  23.4567 336.6543 14.12345678123456'
      }
    ];

    const seeded = fallback.map((d, i) => parseFromTLE(d, i)).filter(Boolean) as Satellite[];
    if (seeded.length > 0) {
      setSatellites(seeded)
      setUsingFallback(true)
    }

    const loadInitialSatellites = async () => {
      try {
        setLoading(true);
        const tryFetch = async (url: string, timeoutMs = 15000) => {
        const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const res = await fetch(url, { signal: controller.signal });
            return res;
          } finally {
        clearTimeout(timer);
          }
        };

        // Try new Space-Track-based API first
        const urls = [
          '/api/tle/group/stations?limit=12',
          '/api/tle/group/active?limit=12'
        ];

        let response: Response | null = null;
        for (const url of urls) {
          try {
            const res = await tryFetch(url, 10000);
            if (res.ok) { response = res; break; }
          } catch (_) {}
        }
        if (!response || !response.ok) throw new Error('All Celestrak attempts failed');

        let parsedSatellites: Satellite[] = []
        try {
          const tleData: any[] = await response.json();
          if (Array.isArray(tleData) && tleData.length) {
            // Space-Track returns objects with OBJECT_NAME, TLE_LINE1, TLE_LINE2
            parsedSatellites = tleData
              .filter((d: any) => d.TLE_LINE1 && d.TLE_LINE2) // Must have valid TLEs
              .slice(0, 12)
          .map((data: any, index: number) => parseFromTLE(data, index))
          .filter(Boolean) as Satellite[];
            
            if (parsedSatellites.length === 0) {
              throw new Error('No valid TLE data in response')
            }
          } else {
            throw new Error('Invalid TLE data format')
          }
        } catch (e) {
          console.warn('Failed to load live TLE data:', e)
          throw new Error('Failed to obtain live TLEs')
        }

        setSatellites(parsedSatellites);
        setError(null);
        setUsingFallback(false);
      } catch (error) {
        setError(null);
        setUsingFallback(true);
      } finally {
        setLoading(false);
      }
    };
    loadInitialSatellites();
  }, []);

  useEffect(() => {
    if (satellites.length === 0) return;
    const id = setInterval(() => {
      setSatellites(prev => prev.map(s => {
        if (!s.tle1 || !s.tle2) return s;
        const geo = currentGeodeticFromTLE(s.tle1, s.tle2);
        if (!geo) return s;
        return {
          ...s,
          position: { x: geo.lon, y: geo.lat, z: geo.altKm },
          lastUpdate: new Date()
        };
      }));
    }, 2000);
    return () => clearInterval(id);
  }, [satellites.length]);

  // Listen for high severity GST from SpaceWeatherMonitor via global listener
  // We can also compute a simple Kp from processed events; for now keep local setter via callback
  const handleThreatDetected = (event: any) => {
    setSpaceWeatherEvents(prev => [...prev, event]);
    if (event.type === 'Geomagnetic Storm') {
      const m = String(event.impact || '').match(/Kp\s*Index:\s*(\d+(?:\.\d+)?)/i)
      if (m && m[1]) setKpIndex(Number(m[1]))
    }
    if (event.severity === 'Critical' || event.severity === 'High') setSystemStatus('critical');
    else if (event.severity === 'Medium') setSystemStatus('warning');
    
    // Check if tracked satellites are affected
    if (affectedSatIds.size > 0 && satellites.length > 0) {
      const affectedSats = satellites.filter(s => affectedSatIds.has(s.id));
      if (affectedSats.length > 0 && (event.severity === 'Critical' || event.severity === 'High')) {
        const threatId = `${event.type}_${event.startTime}_${affectedSats.map(s => s.id).join('_')}`;
        
        if (!weatherAlertShown.has(threatId)) {
          console.log('[SpaceWeather] THREAT DETECTED:', event.type, event.severity);
          console.log('[SpaceWeather] Affected satellites:', affectedSats.map(s => s.name).join(', '));
          
          const threat = {
            eventType: event.type,
            severity: event.severity,
            affectedSatellites: affectedSats.map(s => s.name),
            description: event.impact || event.description || 'Space weather event detected',
            startTime: new Date(event.startTime || Date.now())
          };
          
          setSpaceWeatherThreats(prev => [...prev, threat]);
          setWeatherAlertShown(prev => new Set([...prev, threatId]));
        }
      }
    }
  };

  // When clicking an event in the Space Weather panel
  const handleEventSelect = (event: any) => {
    try {
      // Reset
      setAffectedSatIds(new Set())
      setAffectedCone(null)
      setShowAffected(true)

      if (event.type === 'Geomagnetic Storm') {
        // Use Kp to compute auroral boundary; highlight sats with |lat| above threshold
        const m = String(event.impact || '').match(/Kp\s*Index:\s*(\d+(?:\.\d+)?)/i)
        const kp = m && m[1] ? Number(m[1]) : kpIndex
        const latThr = Math.max(40, Math.min(80, 67 - 0.9 * (kp || 0)))
        const affected = new Set<string>()
        satellites.forEach(s => {
          if (Math.abs(s.position.y || 0) >= latThr) affected.add(s.id)
        })
        setAffectedSatIds(affected)
      } else if (event.type === 'CME') {
        // Estimate CME cone from DONKI cmeAnalyses
        const analyses = event?.source?.cmeAnalyses || []
        const best = analyses.find((a: any) => a?.isMostAccurate) || analyses[0]
        const lon = Number(best?.longitude)
        const halfAngle = Number(best?.halfAngle || 30)
        if (Number.isFinite(lon)) setAffectedCone({ lonCenter: lon, halfAngle: halfAngle || 30 })
        const affected = new Set<string>()
        satellites.forEach(s => {
          const slon = (s.position.x || 0)
          const d = Math.abs(((slon - lon + 540) % 360) - 180)
          if (d <= (halfAngle || 30)) affected.add(s.id)
        })
        setAffectedSatIds(affected)
      } else if (event.type === 'Solar Flare') {
        // Dayside impact: highlight sats with local day (approx lon close to Sun sublon ~ 0)
        const affected = new Set<string>()
        satellites.forEach(s => {
          const lon = (s.position.x || 0)
          const d = Math.abs(((lon - 0 + 540) % 360) - 180)
          if (d >= 90) affected.add(s.id) // rough dayside/nightside heuristic
        })
        setAffectedSatIds(affected)
      }
    } catch {}
  }

  const handleSatelliteSelect = (satelliteId: string) => {
    setSelectedSatelliteId(satelliteId);
  };

  // Execute maneuver to update satellite TLE
  const handleApplyManeuver = (satelliteId: string, newTle1: string, newTle2: string, description: string) => {
    const satellite = satellites.find(s => s.id === satelliteId);
    if (!satellite) return;
    
    // Record maneuver in history
    const maneuver = {
      id: `maneuver_${Date.now()}_${satelliteId}`,
      satelliteId,
      satelliteName: satellite.name,
      timestamp: new Date(),
      description,
      oldTle1: satellite.tle1 || '',
      oldTle2: satellite.tle2 || '',
      newTle1,
      newTle2
    };
    setManeuverHistory(prev => [maneuver, ...prev]);
    
    // Update satellite TLE
    setSatellites(prev => prev.map(s => 
      s.id === satelliteId 
        ? { ...s, tle1: newTle1, tle2: newTle2 }
        : s
    ));
    
    // Regenerate orbit for this satellite
    const centerTime = simMinutes !== 0 ? simDate : new Date();
    const newOrbitPath = generateOrbitPath(newTle1, newTle2, undefined, 2, centerTime);
    
    setUserOrbits(prev => {
      const others = prev.filter(o => o.id !== satelliteId);
      return [...others, { id: satelliteId, path: newOrbitPath, color: '#10b981' }]; // Green for maneuvered
    });
    
    console.log(`✅ Maneuver applied to ${satellite.name}:`, description);
  };
  
  // Open orbit control panel for a satellite (with optional collision risk)
  const handleOpenOrbitControl = (satelliteId: string, collisionRisk?: CollisionRisk, suggestedManeuver?: {altitudeChange?: number, inclinationChange?: number, raanChange?: number, eccentricityChange?: number}) => {
    const satellite = satellites.find(s => s.id === satelliteId);
    if (!satellite) return;
    
    setOrbitControlSatellite(satellite);
    setOrbitControlCollisionRisk(collisionRisk || null);
    setOrbitControlOpen(true);
    
    // Store suggested maneuver for the panel to use
    if (suggestedManeuver) {
      (window as any).__aiSuggestedManeuver = suggestedManeuver;
    }
  };

  const handleConjunctionClick = async (conjunction: any) => {
    const { o1Id, o2Id, o1Name, o2Name } = resolveCdmNamesAndIds(conjunction);
    
    if (!o1Id || !o2Id) {
      console.warn('Cannot visualize conjunction: NORAD IDs not available', { o1Name, o2Name, o1Id, o2Id });
      setAddError('Cannot visualize: NORAD IDs not available for one or both satellites');
      return;
    }
    
    // Helper to extract field values from conjunction data
    const firstVal = (obj: any, keys: string[]): any => {
      for (const k of keys) {
        if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
      }
      return undefined;
    };

    // Clear previous conjunction marker and user orbits
    setConjunctionPoint(null);
    setUserOrbits([]);
    
    setAdding(true);
    setAddError(null);

    const addSatelliteByNorad = async (noradId: string, name: string) => {
      try {
        const tryWithTimeout = async (url: string, timeoutMs = 15000) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const r = await fetch(url, { signal: controller.signal });
            return r;
          } finally {
            clearTimeout(timer);
          }
        };

        const tleUrl = `/api/tle/satellite/${encodeURIComponent(noradId)}`;
        const r = await tryWithTimeout(tleUrl, 15000);
        if (!r.ok) return null;

        const tleText = await r.text();
        if (!tleText) return null;

        const lines = tleText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        let satName = name;
        let l1 = '', l2 = '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const firstChar = line.charAt(0);
          const secondChar = line.charAt(1);

          if (firstChar === '0' && secondChar === ' ') {
            satName = line.substring(2).trim();
          } else if (firstChar === '1' && secondChar === ' ' && !l1) {
            l1 = line;
          } else if (firstChar === '2' && secondChar === ' ' && !l2) {
            l2 = line;
          }
        }

        if (!l1 || !l2) return null;

        const inclination = parseFloat(l2.substring(8, 16));
        const raan = parseFloat(l2.substring(17, 25));
        const eccentricity = parseFloat('0.' + l2.substring(26, 33));
        const argumentOfPerigee = parseFloat(l2.substring(34, 42));
        const meanAnomaly = parseFloat(l2.substring(43, 51));
        const meanMotion = parseFloat(l2.substring(52, 63));
        const mu = 398600.4418;
        const n = meanMotion * 2 * Math.PI / 86400;
        const semiMajorAxis = Math.pow(mu / (n * n), 1/3);
        const period = 1440 / meanMotion;

        const geo = currentGeodeticFromTLE(l1, l2);
        const altKm = geo?.altKm ?? Math.max(0, semiMajorAxis - 6371);

        const sat: Satellite = {
          id: `sat_${noradId}`,
          name: satName,
          noradId: String(noradId),
          tle1: l1,
          tle2: l2,
          status: 'active',
          orbitalParams: {
            semiMajorAxis,
            inclination,
            eccentricity,
            raan,
            argumentOfPerigee,
            meanAnomaly,
            meanMotion,
            period
          },
          position: { x: geo?.lon ?? 0, y: geo?.lat ?? 0, z: altKm },
          velocity: { x: 0, y: 0, z: 0 },
          lastUpdate: new Date()
        };

        return { sat, tle1: l1, tle2: l2 };
      } catch (e) {
        console.error(`Failed to add satellite ${noradId}:`, e);
        return null;
      }
    };

    try {
      // CLEAR all previous satellites and orbits for clean visualization
      setSatellites([]);
      setUserOrbits([]);
      setConjunctionPoint(null);
      
      // Add both satellites
      const [result1, result2] = await Promise.all([
        addSatelliteByNorad(o1Id, o1Name),
        addSatelliteByNorad(o2Id, o2Name)
      ]);

      const newSatellites: Satellite[] = [];
      const newOrbits: { id: string; path: { lat: number; lon: number; altKm: number }[]; color: string }[] = [];

      // Calculate TCA first
      const tcaStr = (conjunction as any).tca || (conjunction as any).TCA || (conjunction as any).raw?.TCA;
      const tcaDate = tcaStr ? new Date(tcaStr) : new Date();

      if (result1) {
        // Update satellite position to TCA time
        const tcaPos1 = geodeticFromTLEAt(result1.tle1, result1.tle2, tcaDate);
        if (tcaPos1) {
          result1.sat.position = {
            x: tcaPos1.lon,
            y: tcaPos1.lat,
            z: tcaPos1.altKm
          };
        }
        newSatellites.push(result1.sat);
        // Generate orbit AROUND TCA time, not current time
        const path1 = generateOrbitPath(result1.tle1, result1.tle2, undefined, 2, tcaDate);
        newOrbits.push({ id: result1.sat.id, path: path1, color: '#ef4444' }); // Red for first satellite
      }

      if (result2) {
        // Update satellite position to TCA time
        const tcaPos2 = geodeticFromTLEAt(result2.tle1, result2.tle2, tcaDate);
        if (tcaPos2) {
          result2.sat.position = {
            x: tcaPos2.lon,
            y: tcaPos2.lat,
            z: tcaPos2.altKm
          };
        }
        newSatellites.push(result2.sat);
        // Generate orbit AROUND TCA time, not current time
        const path2 = generateOrbitPath(result2.tle1, result2.tle2, undefined, 2, tcaDate);
        newOrbits.push({ id: result2.sat.id, path: path2, color: '#f59e0b' }); // Orange for second satellite
      }

      if (newSatellites.length > 0) {
        // Replace with ONLY the conjunction satellites
        setSatellites(newSatellites);
        setUserOrbits(newOrbits);
        let conjunctionMarker = null;
        
        if (tcaStr && result1 && result2) {
          try {
            const now = new Date();
            const minutesUntilTCA = (tcaDate.getTime() - now.getTime()) / (1000 * 60);
            
            // Fast-forward simulation to TCA time
            setSimMinutes(minutesUntilTCA);
            setSimRunning(false); // Pause at TCA
            
            const pos1 = geodeticFromTLEAt(result1.tle1, result1.tle2, tcaDate);
            const pos2 = geodeticFromTLEAt(result2.tle1, result2.tle2, tcaDate);
            
            if (pos1 && pos2) {
              // Calculate accurate distance using haversine formula + altitude difference
              const R = 6371; // Earth radius in km
              const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
              const dLon = (pos2.lon - pos1.lon) * Math.PI / 180;
              const lat1Rad = pos1.lat * Math.PI / 180;
              const lat2Rad = pos2.lat * Math.PI / 180;
              
              const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const groundDistance = R * c;
              
              const altitudeDiff = pos2.altKm - pos1.altKm;
              const totalDistance = Math.sqrt(groundDistance * groundDistance + altitudeDiff * altitudeDiff);
              
              // Calculate collision risk
              const relativeVelocityKmS = parseFloat(firstVal(conjunction, ['RELATIVE_VELOCITY', 'RELATIVE_SPEED']) || '7.5'); // Default ~7.5 km/s for LEO
              const timeToTcaMinutes = (tcaDate.getTime() - Date.now()) / 60000;
              const collisionProb = calculateCollisionProbability(totalDistance, relativeVelocityKmS);
              const riskLevel = assessRiskLevel(totalDistance, Math.abs(timeToTcaMinutes));
              
              // Use midpoint between satellites for marker
              conjunctionMarker = {
                lat: (pos1.lat + pos2.lat) / 2,
                lon: (pos1.lon + pos2.lon) / 2,
                altKm: (pos1.altKm + pos2.altKm) / 2,
                tca: tcaDate.toISOString()
              };
              
              // Store conjunction marker for visualization
              setConjunctionPoint(conjunctionMarker);
              
              console.log(`📍 Conjunction at TCA (${tcaDate.toUTCString()})`);
              console.log(`   Sat1 position: ${pos1.lat.toFixed(4)}°, ${pos1.lon.toFixed(4)}°, ${pos1.altKm.toFixed(2)}km`);
              console.log(`   Sat2 position: ${pos2.lat.toFixed(4)}°, ${pos2.lon.toFixed(4)}°, ${pos2.altKm.toFixed(2)}km`);
              console.log(`   ⚠️ Miss distance: ${totalDistance.toFixed(3)} km`);
              console.log(`   Ground distance: ${groundDistance.toFixed(3)} km, Altitude diff: ${Math.abs(altitudeDiff).toFixed(3)} km`);
              console.log(`   🎯 Collision probability: ${(collisionProb * 100).toFixed(4)}%`);
              console.log(`   ⚠️ Risk level: ${riskLevel}`);
              
              // Auto-open orbit control for CRITICAL or HIGH risk conjunctions
              if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
                const collisionRisk: CollisionRisk = {
                  targetName: result2.sat.name,
                  targetId: result2.sat.id,
                  missDistanceKm: totalDistance,
                  tcaDate: tcaDate,
                  relativeVelocityKmS: relativeVelocityKmS,
                  probability: collisionProb,
                  riskLevel: riskLevel
                };
                
                // Open orbit control for the first satellite (we can control)
                setTimeout(() => {
                  handleOpenOrbitControl(result1.sat.id, collisionRisk);
                }, 500); // Small delay to let UI settle
                
                console.log(`🚨 ${riskLevel} RISK DETECTED - Opening orbit control panel`);
              }
            }
          } catch (e) {
            console.error('Failed to calculate conjunction point:', e);
          }
        }

        // Switch to 3D view to visualize conjunction
        setActiveTab('3d');
        
        // Select the first satellite
        if (result1) {
          setSelectedSatelliteId(result1.sat.id);
        }

        console.log(`✅ Added ${newSatellites.length} satellite(s) for conjunction visualization!`);
      } else {
        console.error('❌ Failed to add satellites. Check console for errors.');
        setAddError('Failed to add satellites for conjunction visualization');
      }
    } catch (e: any) {
      setAddError(e?.message || 'Failed to visualize conjunction');
    } finally {
      setAdding(false);
    }
  };

  const handleAddSatelliteByNorad = async () => {
    try {
      setAdding(true);
      setAddError(null);
      const noradId = newNoradId.trim();
      if (!/^[0-9]{3,9}$/.test(noradId)) {
        throw new Error('Enter a valid NORAD ID (3-9 digits)');
      }
      const tryWithTimeout = async (url: string, timeoutMs = 10000) => {
      const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const r = await fetch(url, { signal: controller.signal });
          return r;
        } finally {
      clearTimeout(timer);
        }
      };
      const tleUrl = `/api/tle/satellite/${encodeURIComponent(noradId)}`;
      const r = await tryWithTimeout(tleUrl, 15000);
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}))
        throw new Error(errData.error || errData.hint || 'No TLE data available. Check Space-Track credentials.')
      }
      const tleText = await r.text();
      if (!tleText) throw new Error('Empty TLE response');

      const lines = tleText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      let name = `SAT ${noradId}`;
      let l1 = '', l2 = '';
      
      console.log('Parsing TLE for', noradId, '- Lines:', lines);
      
      // Handle 3LE format: "0 NAME\n1 LINE1\n2 LINE2"
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const firstChar = line.charAt(0);
        const secondChar = line.charAt(1);
        
        if (firstChar === '0' && secondChar === ' ') {
          // Line 0 contains the name
          name = line.substring(2).trim();
        } else if (firstChar === '1' && secondChar === ' ' && !l1) {
          // Line 1 (TLE line 1)
          l1 = line;
        } else if (firstChar === '2' && secondChar === ' ' && !l2) {
          // Line 2 (TLE line 2)
          l2 = line;
        }
      }
      
      if (!l1 || !l2) {
        console.error('TLE parse failed for NORAD', noradId);
        console.error('Raw text:', tleText);
        console.error('Split lines:', lines);
        console.error('Found line1:', l1);
        console.error('Found line2:', l2);
        throw new Error(`Failed to parse TLE for ${noradId} - missing line1 or line2`);
      }
      
      console.log('Successfully parsed TLE:', name, l1.substring(0, 20) + '...', l2.substring(0, 20) + '...');

      const inclination = parseFloat(l2.substring(8, 16));
      const raan = parseFloat(l2.substring(17, 25));
      const eccentricity = parseFloat('0.' + l2.substring(26, 33));
      const argumentOfPerigee = parseFloat(l2.substring(34, 42));
      const meanAnomaly = parseFloat(l2.substring(43, 51));
      const meanMotion = parseFloat(l2.substring(52, 63));
      
      // Validate orbital parameters
      if (!isFinite(inclination) || !isFinite(raan) || !isFinite(eccentricity) || 
          !isFinite(argumentOfPerigee) || !isFinite(meanAnomaly) || !isFinite(meanMotion)) {
        throw new Error(`Invalid orbital parameters in TLE for ${noradId}`);
      }
      
      const mu = 398600.4418;
      const n = meanMotion * 2 * Math.PI / 86400;
      const semiMajorAxis = Math.pow(mu / (n * n), 1/3);
      const period = 1440 / meanMotion;

      let geo = null;
      try {
        geo = currentGeodeticFromTLE(l1, l2);
      } catch (geoErr) {
        console.warn('Failed to get current position, using calculated altitude:', geoErr);
      }
      const altKm = geo?.altKm ?? Math.max(0, semiMajorAxis - 6371);

      const sat: Satellite = {
        id: `sat_${noradId}`,
        name,
        noradId: String(noradId),
        tle1: l1,
        tle2: l2,
        status: 'active',
        orbitalParams: {
          semiMajorAxis,
          inclination,
          eccentricity,
          raan,
          argumentOfPerigee,
          meanAnomaly,
          meanMotion,
          period
        },
        position: { x: geo?.lon ?? 0, y: geo?.lat ?? 0, z: altKm },
        velocity: { x: 0, y: 0, z: 0 },
        lastUpdate: new Date()
      };

      // Generate orbit centered around current time (or simulated time if active)
      let centerTime = new Date();
      try {
        if (simMinutes !== 0 && simDate) {
          centerTime = simDate;
        }
      } catch (timeErr) {
        console.warn('Using current time for orbit generation:', timeErr);
      }
      
      let path: { lat: number; lon: number; altKm: number }[] = [];
      try {
        path = generateOrbitPath(l1, l2, undefined, 2, centerTime);
        if (path.length === 0) {
          throw new Error('Orbit generation returned no points');
        }
      } catch (orbitErr: any) {
        console.error('Failed to generate orbit path:', orbitErr);
        setAddError(`Satellite added but orbit failed to generate: ${orbitErr.message}`);
        // Continue anyway - satellite will be added without orbit
      }
      
      console.log(`✅ Added satellite: ${name} (NORAD ${noradId})`);
      console.log(`   Altitude: ${altKm.toFixed(0)} km, Inclination: ${inclination.toFixed(1)}°`);
      console.log(`   Orbit points generated: ${path.length}`);
      
      // Add satellite to state
      setSatellites(prev => {
        const exists = prev.find(p => p.noradId === sat.noradId);
        return exists ? prev.map(p => (p.noradId === sat.noradId ? sat : p)) : [...prev, sat];
      });
      
      // Add orbit only if generation succeeded
      if (path.length > 0) {
        console.log(`✅ Adding orbit for ${sat.id} with ${path.length} points and color #10b981`);
        setUserOrbits(prev => {
          const others = prev.filter(p => p.id !== sat.id);
          const newOrbit = { id: sat.id, path, color: '#10b981' }; // Green for custom added
          console.log('Current userOrbits:', prev.length, '→ New:', [...others, newOrbit].length);
          return [...others, newOrbit];
        });
      } else {
        console.warn(`⚠️ No orbit points generated for ${sat.id}`);
      }
      
      setNewNoradId("");
    } catch (e: any) {
      console.error('❌ Failed to add satellite:', e);
      const errorMessage = e?.message || 'Failed to add satellite. Check console for details.';
      setAddError(errorMessage);
      
      // Show user-friendly error messages
      if (errorMessage.includes('401') || errorMessage.includes('logged in')) {
        setAddError('Authentication failed. Check Space-Track credentials in backend .env file.');
      } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setAddError(`Satellite ${newNoradId} not found in catalog. Check NORAD ID.`);
      } else if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
        setAddError('Request timed out. Check your internet connection and try again.');
      } else if (errorMessage.includes('parse') || errorMessage.includes('Invalid')) {
        setAddError('Failed to parse satellite data. TLE may be corrupted.');
      }
    } finally {
      setAdding(false);
    }
  };

  const autoOrbitPaths = useMemo(() => {
    // Only generate orbits for satellites that DON'T have user-defined orbits
    const userOrbitIds = new Set(userOrbits.map(o => o.id));
    const centerTime = (simRunning || simMinutes !== 0) ? simDate : new Date();
    
    const orbits = satellites
      .filter(s => s.tle1 && s.tle2 && !userOrbitIds.has(s.id))
      .slice(0, 8)
      .map(s => ({ 
        id: s.id, 
        path: generateOrbitPath(s.tle1 as string, s.tle2 as string, undefined, 2, centerTime), 
        color: s.id === selectedSatelliteId ? '#ffd700' : '#60a5fa' 
      }));
    
    console.log('[AutoOrbits] Generated', orbits.length, 'auto orbits, excluding', userOrbitIds.size, 'user orbits');
    orbits.forEach(orbit => {
      console.log(`   - ${orbit.id}: ${orbit.path.length} points, color: ${orbit.color}`);
    });
    return orbits;
  }, [satellites, selectedSatelliteId, userOrbits, simRunning, simMinutes, simDate]);
  
  // Combined orbit paths for rendering
  const combinedOrbitPaths = useMemo(() => {
    const combined = [...autoOrbitPaths, ...simulatedUserOrbits];
    console.log('[CombinedOrbits] Total orbits for rendering:', combined.length, '(', autoOrbitPaths.length, 'auto +', simulatedUserOrbits.length, 'user)');
    return combined;
  }, [autoOrbitPaths, simulatedUserOrbits]);

  // Seed local name→NORAD cache from CDM data to improve stability
  useEffect(() => {
    if (!cdmData || !Array.isArray(cdmData)) return
    for (const d of cdmData as any[]) {
      const raw = (d as any).raw || {}
      const n1 = (d as any).object1Name || (d as any).object1 || raw.OBJECT1_NAME || raw.OBJECT1
      const n2 = (d as any).object2Name || (d as any).object2 || raw.OBJECT2_NAME || raw.OBJECT2
      const id1 = String((d as any).object1Id || raw.OBJECT1_CATID || '').replace(/[^0-9]/g,'')
      const id2 = String((d as any).object2Id || raw.OBJECT2_CATID || '').replace(/[^0-9]/g,'')
      if (n1 && id1) persistMap(n1, id1)
      if (n2 && id2) persistMap(n2, id2)
    }
  }, [cdmData])

  const resolveCdmNamesAndIds = (d: any) => {
    const firstVal = (obj: any, keys: string[]): any => {
      for (const k of keys) { if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k] }
      return undefined
    }
    const raw = (d as any).raw || {}
    const primaryO1Name = (d as any).object1Name || (d as any).object1
    const primaryO2Name = (d as any).object2Name || (d as any).object2
    const o1Name = primaryO1Name || firstVal(raw, ['OBJECT1_NAME','OBJECT1']) || 'Unknown'
    const o2Name = primaryO2Name || firstVal(raw, ['OBJECT2_NAME','OBJECT2']) || 'Unknown'

    let o1Id = String((d as any).object1Id ?? firstVal(d, ['OBJECT1_CATID','OBJECT1_ID']) ?? firstVal(raw, ['OBJECT1_CATID','OBJECT1_ID']) ?? '').replace(/[^0-9]/g,'')
    let o2Id = String((d as any).object2Id ?? firstVal(d, ['OBJECT2_CATID','OBJECT2_ID']) ?? firstVal(raw, ['OBJECT2_CATID','OBJECT2_ID']) ?? '').replace(/[^0-9]/g,'')

    const normalizeLocal = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const o1RawKey = o1Name.toLowerCase()
    const o2RawKey = o2Name.toLowerCase()
    const o1NormKey = normalizeLocal(o1Name)
    const o2NormKey = normalizeLocal(o2Name)
    if (!o1Id) { o1Id = nameToNorad[o1RawKey] || (o1NormKey ? nameToNorad[o1NormKey] : '') || '' }
    if (!o2Id) { o2Id = nameToNorad[o2RawKey] || (o2NormKey ? nameToNorad[o2NormKey] : '') || '' }

    const requestLookup = (name: string) => {
      const key = normalizeLocal(name) || name.toLowerCase()
      if (!key || nameLookupRequested[key] || !n2yoKey) return
      if (/^unknown$|^object\s/i.test(name.toLowerCase())) return
      setNameLookupRequested(prev => ({ ...prev, [key]: true }))
      ;(async () => {
        try {
          const q = encodeURIComponent(name)
          const r = await fetch(`/api/n2yo/rest/v1/satellite/search/${q}&apiKey=${n2yoKey}`)
          if (!r.ok) return
          const j = await r.json()
          const arr = Array.isArray(j?.satellites) ? j.satellites : []
          const lower = name.toLowerCase()
          const exact = arr.find((s: any) => String(s?.satname || s?.name || '').toLowerCase() === lower)
          const id = exact ? String(exact?.satid || exact?.norad_id || exact?.id || '') : undefined
          if (id) persistMap(name, id)
        } catch {}
      })()
    }

    if (!o1Id && o1Name && !nameToNorad[o1RawKey] && !(o1NormKey && nameToNorad[o1NormKey])) requestLookup(o1Name)
    if (!o2Id && o2Name && !nameToNorad[o2RawKey] && !(o2NormKey && nameToNorad[o2NormKey])) requestLookup(o2Name)

    return { o1Name, o2Name, o1Id, o2Id }
  }

  // Compute auroral boundary latitude from Kp (approx): 67 - 0.9*Kp
  const affectedArea = useMemo(() => {
    if (!showAffected) return undefined
    if (affectedCone) {
      // Represent CME cone as wide auroral cap for now by converting halfAngle to pseudo-lat threshold
      const lat = Math.max(10, Math.min(80, 90 - affectedCone.halfAngle))
      return { latThresholdDeg: lat, color: 0xff5500, opacity: 0.2 }
    }
    const lat = Math.max(40, Math.min(80, 67 - 0.9 * (kpIndex || 0)))
    return { latThresholdDeg: lat, color: 0xff5500, opacity: 0.2 }
  }, [showAffected, kpIndex, affectedCone])

  // Hydrate missing TLEs from Celestrak or synthesize from orbital params
  useEffect(() => {
    const doLookup = async (sat: Satellite) => {
      const key = sat.id || sat.noradId || sat.name
      if (!key) return
      if (tleLookupRequestedRef.current[key]) return
      tleLookupRequestedRef.current[key] = true
      try {
        const tryFetch = async (url: string, ms = 12000) => {
          const ctl = new AbortController(); const id = setTimeout(() => ctl.abort(), ms)
          try { const r = await fetch(url, { signal: ctl.signal }); return r } finally { clearTimeout(id) }
        }
        let tle1: string | undefined
        let tle2: string | undefined
        const norad = String(sat.noradId || '').replace(/[^0-9]/g,'')
        // Try new TLE endpoint
        if (norad) {
          try {
            const r = await tryFetch(`/api/tle/satellite/${norad}`, 15000)
            if (r.ok) {
              const txt = await r.text()
              const lines = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
              const l1 = lines.find(s => s.match(/^1\s/))
              const l2 = lines.find(s => s.match(/^2\s/))
              if (l1 && l2) { tle1 = l1; tle2 = l2 }
            }
          } catch {}
        }
        if (!tle1 || !tle2) {
          if (sat.orbitalParams) {
            const synth = createTLEFromKeplerian({
              inclinationDeg: sat.orbitalParams.inclination,
              raanDeg: sat.orbitalParams.raan,
              eccentricity: sat.orbitalParams.eccentricity,
              argumentOfPerigeeDeg: sat.orbitalParams.argumentOfPerigee,
              meanAnomalyDeg: sat.orbitalParams.meanAnomaly,
              meanMotionRevPerDay: sat.orbitalParams.meanMotion,
              name: sat.name,
              noradId: Number(norad) || undefined,
            })
            tle1 = synth.line1; tle2 = synth.line2
          }
        }
        if (tle1 && tle2) {
          setSatellites(prev => prev.map(s => s.id === sat.id ? { ...s, tle1, tle2 } : s))
        }
      } catch {}
    }
    satellites.forEach(s => {
      if (!s.tle1 || !s.tle2) doLookup(s)
    })
  }, [satellites])

  if (loading) {
    return (
      <div style={{
        padding: '2rem',
        background: '#1a237e',
        color: '#fff',
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Loading Satellite System...</h1>
          <p>Initializing 3D visualization and APIs...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: 0,
      background: '#070b14',
      color: '#e5e7eb',
      minHeight: '100vh',
      fontFamily: 'Inter, system-ui, Arial'
    }}>
      <TopBar active={activeTab} onChange={setActiveTab} />
      <div style={{ display: 'flex', gap: '0.75rem', padding: '12px 16px', borderBottom: '1px solid rgba(51,65,85,0.5)', background: 'rgba(15,23,42,0.8)' }}>
        <span style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(7,11,20,0.8)', border: '1px solid rgba(71,85,105,0.4)', fontSize: 14 }}>
          STATUS: <b style={{ color: systemStatus === 'critical' ? '#ef4444' : systemStatus === 'warning' ? '#f59e0b' : '#10b981' }}>{systemStatus.toUpperCase()}</b>
          </span>
        <span style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(7,11,20,0.8)', border: '1px solid rgba(71,85,105,0.4)', fontSize: 14 }}>Satellites: <b style={{color:'#60a5fa'}}>{satellites.length}</b></span>
        <span style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(7,11,20,0.8)', border: '1px solid rgba(71,85,105,0.4)', fontSize: 14 }}>Threats: <b style={{color:'#fbbf24'}}>{spaceWeatherEvents.length}</b></span>
        <span style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(7,11,20,0.8)', border: '1px solid rgba(71,85,105,0.4)', fontSize: 14 }}>CDMs: <b style={{color:'#a78bfa'}}>{cdmData?.length || 0}</b></span>
        
        <button 
          onClick={() => setDemoMode(!demoMode)}
          style={{ 
            marginLeft: 'auto',
            padding: '6px 12px', 
            borderRadius: 6, 
            background: demoMode ? 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' : 'rgba(7,11,20,0.8)', 
            border: demoMode ? '1px solid #f59e0b' : '1px solid rgba(71,85,105,0.4)', 
            color: demoMode ? '#fff' : '#94a3b8',
            fontSize: 14,
            fontWeight: demoMode ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: demoMode ? '0 0 12px rgba(245,158,11,0.4)' : 'none'
          }}
        >
          {demoMode ? 'DEMO MODE ON' : 'Enable Demo Mode'}
        </button>
        </div>

      {error && (
        <div style={{
          background: 'rgba(244, 67, 54, 0.2)',
          border: '1px solid #f44336',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ color: '#f44336', margin: '0 0 0.5rem 0' }}>ERROR</h3>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {usingFallback && !error && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.15)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '8px',
          padding: '0.75rem',
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}>
          <strong>DEMO MODE:</strong> Using built-in satellite TLEs (ISS, HST, Starlink, NOAA 18). CelesTrak temporarily unavailable. All orbital mechanics and movement simulation are fully functional.
        </div>
      )}

      <main>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '0.75rem 0', padding: '0.75rem', background: 'rgba(100,181,246,0.1)', borderRadius: 8, border: '1px solid rgba(100,181,246,0.3)' }}>
  <button onClick={() => setSimRunning(r => !r)} style={{ padding: '8px 16px', fontWeight: 'bold', background: simRunning ? '#ef4444' : '#10b981', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{simRunning ? '⏸ Pause' : '▶ Play'}</button>
  <label style={{ opacity: 0.9, fontWeight: 500 }}>Speed (min/sec)</label>
  <input type="range" min={0.5} max={60} step={0.5} value={simSpeed} onChange={(e) => setSimSpeed(Number(e.target.value))} style={{ width: 200 }} />
  <span style={{ width: 60, textAlign: 'right', fontWeight: 'bold', color: '#64b5f6' }}>{simSpeed.toFixed(1)}x</span>
  <label style={{ opacity: 0.9, marginLeft: 12, fontWeight: 500 }}>Time offset</label>
  <input type="range" min={-1440} max={1440} step={1} value={simMinutes} onChange={(e) => setSimMinutes(Number(e.target.value))} style={{ width: 300 }} />
  <span style={{ width: 100, textAlign: 'left', fontWeight: 'bold', color: '#fbbf24' }}>{simMinutes >= 0 ? '+' : ''}{simMinutes.toFixed(0)} min</span>
  <span style={{ width: 200, textAlign: 'left', opacity: 0.9, fontSize: '0.9rem', color: '#93c5fd' }}>{simDate.toUTCString().slice(0, 25)}</span>
  <button onClick={() => { setSimRunning(false); setSimSpeed(5); setSimMinutes(0); }} style={{ marginLeft: 8, padding: '6px 10px', background: '#374151', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Now</button>
</div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {activeTab === 'dashboard' && (
            <>
          <div style={{
                background: 'rgba(7,11,20,0.85)',
                border: '1px solid rgba(71,85,105,0.35)',
            borderRadius: '12px',
                padding: '1.25rem'
          }}>
            <h2 style={{ color: '#64b5f6', marginBottom: '1rem' }}>
              🌍 3D Earth & Satellite Orbits
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button onClick={() => setView('3d')} style={{ padding: '0.25rem 0.5rem' }}>
                3D
              </button>
              <button onClick={() => setView('2d')} style={{ padding: '0.25rem 0.5rem' }}>
                2D
              </button>
              <button onClick={() => setShowOrbits(s => !s)} style={{ padding: '0.25rem 0.5rem', background: showOrbits ? '#10b981' : '#6b7280' }}>
                {showOrbits ? 'Orbits ON' : 'Orbits OFF'}
              </button>
              <button onClick={() => setShowAffected(s => !s)} style={{ padding: '0.25rem 0.5rem' }}>
                {showAffected ? 'Hide Affected Area' : 'Show Affected Area'}
              </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <input
                value={newNoradId}
                onChange={(e) => setNewNoradId(e.target.value)}
                placeholder="NORAD ID (e.g. 25544)"
                style={{ padding: '0.25rem 0.5rem' }}
              />
              <button onClick={handleAddSatelliteByNorad} disabled={adding} style={{ padding: '0.25rem 0.5rem' }}>
                {adding ? 'Adding...' : 'Add Satellite'}
              </button>
            </div>
            </div>
            <ErrorBoundary onError={(e) => console.log('3D error:', e?.message)}>
              {view === '3d' ? (
                <Earth3DVisualization
                  liveSatellites={(simulatedSatellitePositions || satellites.map(s => ({
                    id: s.id,
                    name: s.name,
                    lat: s.position.y || 0,
                    lon: s.position.x || 0,
                    altKm: s.position.z || 0,
                    color: s.id === selectedSatelliteId ? '#ffd700' : '#93c5fd'
                  }))).slice(0, 10).map(sat => ({
                    ...sat,
                    color: affectedSatIds.has(sat.id) ? '#ef4444' : sat.color
                  }))}
                  orbitPaths={showOrbits ? combinedOrbitPaths : []}
                  links={[]}
                  autoRotate={false}
                  onSelectSatellite={(id) => setSelectedSatelliteId(id)}
                  affectedArea={affectedArea as any}
                  conjunctionPoint={conjunctionPoint}
                  gmstRad={gmstRad}
                  eciLiveSatellites={eciLiveSatellites}
                  eciOrbitTrails={showOrbits ? eciOrbitTrails : []}
                />
              ) : (
                <Earth2DVisualization
              satellites={displaySatellites}
                  selectedSatelliteId={selectedSatelliteId}
              onSatelliteSelect={handleSatelliteSelect}
              orbitPaths={showOrbits ? combinedOrbitPaths : []}
            />
              )}
            </ErrorBoundary>
                {addError && (
                  <div style={{ marginTop: '0.5rem', color: '#ffbdbd' }}>
                    {addError}
                  </div>
                )}
            <div style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.8 }}>
              <p>Click and drag to rotate • Scroll to zoom • Click satellites to select</p>
            </div>
          </div>

          {/* Assistant panel moved to top-right - see bottom of file */}

          <div style={{
            background: 'rgba(7,11,20,0.85)',
            border: '1px solid rgba(71,85,105,0.35)',
            borderRadius: 12,
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem' }}>
              <button onClick={() => setSidePanelTab('tracked')} style={{
                padding: '6px 10px',
                background: sidePanelTab === 'tracked' ? 'linear-gradient(90deg,#111827,#0b1220)' : 'transparent',
                border: sidePanelTab === 'tracked' ? '1px solid rgba(100,181,246,0.35)' : '1px solid rgba(255,255,255,0.12)',
                color: sidePanelTab === 'tracked' ? '#93c5fd' : '#cbd5e1',
                borderRadius: 8,
                cursor: 'pointer'
              }}>Tracked</button>
              <button onClick={() => setSidePanelTab('myconj')} style={{
                padding: '6px 10px',
                background: sidePanelTab === 'myconj' ? 'linear-gradient(90deg,#111827,#0b1220)' : 'transparent',
                border: sidePanelTab === 'myconj' ? '1px solid rgba(100,181,246,0.35)' : '1px solid rgba(255,255,255,0.12)',
                color: sidePanelTab === 'myconj' ? '#93c5fd' : '#cbd5e1',
                borderRadius: 8,
                cursor: 'pointer'
              }}>Conjunctions</button>
              <button onClick={() => setSidePanelTab('weather')} style={{
                padding: '6px 10px',
                background: sidePanelTab === 'weather' ? 'linear-gradient(90deg,#111827,#0b1220)' : 'transparent',
                border: sidePanelTab === 'weather' ? '1px solid rgba(100,181,246,0.35)' : '1px solid rgba(255,255,255,0.12)',
                color: sidePanelTab === 'weather' ? '#93c5fd' : '#cbd5e1',
                borderRadius: 8,
                cursor: 'pointer'
              }}>Weather</button>
              <button onClick={() => setSidePanelTab('maneuvers')} style={{
                padding: '6px 10px',
                background: sidePanelTab === 'maneuvers' ? 'linear-gradient(90deg,#111827,#0b1220)' : 'transparent',
                border: sidePanelTab === 'maneuvers' ? '1px solid rgba(100,181,246,0.35)' : '1px solid rgba(255,255,255,0.12)',
                color: sidePanelTab === 'maneuvers' ? '#93c5fd' : '#cbd5e1',
                borderRadius: 8,
                cursor: 'pointer'
              }}>Maneuvers {maneuverHistory.length > 0 && `(${maneuverHistory.length})`}</button>
          </div>
            {sidePanelTab === 'tracked' ? (
              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: 8,
                  padding: '10px',
                  marginBottom: '12px'
                }}>
                  <h4 style={{ margin: 0, color: '#93c5fd' }}>Add via Orbital Parameters</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <label>Inc (deg)
                      <input type="number" step="0.001" value={elements.inclinationDeg}
                        onChange={e=>setElements(prev=>({...prev, inclinationDeg: Number(e.target.value)}))}
                        style={{ width: '100%' }} />
                    </label>
                    <label>RAAN (deg)
                      <input type="number" step="0.001" value={elements.raanDeg}
                        onChange={e=>setElements(prev=>({...prev, raanDeg: Number(e.target.value)}))}
                        style={{ width: '100%' }} />
                    </label>
                    <label>Ecc (0-1)
                      <input type="number" step="0.000001" value={elements.eccentricity}
                        onChange={e=>setElements(prev=>({...prev, eccentricity: Number(e.target.value)}))}
                        style={{ width: '100%' }} />
                    </label>
                    <label>Arg Per (deg)
                      <input type="number" step="0.001" value={elements.argumentOfPerigeeDeg}
                        onChange={e=>setElements(prev=>({...prev, argumentOfPerigeeDeg: Number(e.target.value)}))}
                        style={{ width: '100%' }} />
                    </label>
                    <label>Mean Anom (deg)
                      <input type="number" step="0.001" value={elements.meanAnomalyDeg}
                        onChange={e=>setElements(prev=>({...prev, meanAnomalyDeg: Number(e.target.value)}))}
                        style={{ width: '100%' }} />
                    </label>
                    <label>Mean Motion (rev/day)
                      <input type="number" step="0.000001" value={elements.meanMotionRevPerDay}
                        onChange={e=>setElements(prev=>({...prev, meanMotionRevPerDay: Number(e.target.value)}))}
                        style={{ width: '100%' }} />
                    </label>
                    <label style={{ gridColumn: 'span 2' }}>Name
                      <input type="text" value={elements.name || ''}
                        onChange={e=>setElements(prev=>({...prev, name: e.target.value }))}
                        style={{ width: '100%' }} />
                    </label>
                  </div>
                  <button onClick={async () => {
                    try {
                      setParamCheck({ status: null, text: '' })
                      if (!elements.name || !elements.name.trim()) {
                        setParamCheck({ status: 'error', text: 'Enter a name to validate against catalog' })
                        return
                      }
                      // For orbital params, just allow custom input
                      // (Space-Track doesn't have good name search, would need separate implementation)
                      let candidates: any[] = []
                      const tol = {
                        inc: 0.25,
                        raan: 0.5,
                        ecc: 0.0008,
                        argp: 1.5,
                        meanAnom: 2.0,
                        meanMotion: 0.015
                      }
                      let matched: any | null = null
                      if (Array.isArray(candidates)) {
                        for (const c of candidates) {
                          const di = Math.abs(Number(c.INCLINATION) - elements.inclinationDeg)
                          const dr = Math.abs(Number(c.RA_OF_ASC_NODE) - elements.raanDeg)
                          const de = Math.abs(Number(c.ECCENTRICITY) - elements.eccentricity)
                          const dap = Math.abs(Number(c.ARG_OF_PERICENTER) - elements.argumentOfPerigeeDeg)
                          const dma = Math.abs(Number(c.MEAN_ANOMALY) - elements.meanAnomalyDeg)
                          const dmm = Math.abs(Number(c.MEAN_MOTION) - elements.meanMotionRevPerDay)
                          if (di <= tol.inc && dr <= tol.raan && de <= tol.ecc && dap <= tol.argp && dma <= tol.meanAnom && dmm <= tol.meanMotion) {
                            matched = c; break;
                          }
                        }
                      }
                      // If no match, proceed with custom parameters (no blocking)
                      if (!matched) {
                        setParamCheck({ status: 'ok', text: 'Using custom orbital parameters' })
                      } else {
                        setParamCheck({ status: 'ok', text: `Matched: ${matched.OBJECT_NAME} (NORAD ${matched.NORAD_CAT_ID})` })
                      }
                      // Use matched TLE if present; else synthesize
                      let tle1 = matched?.TLE_LINE1 as string | undefined
                      let tle2 = matched?.TLE_LINE2 as string | undefined
                      if (!tle1 || !tle2) {
                        const synth = createTLEFromKeplerian({ ...elements, noradId: Number(matched?.NORAD_CAT_ID) || undefined })
                        tle1 = synth.line1; tle2 = synth.line2
                      }
                      const geo = currentGeodeticFromTLE(tle1!, tle2!)
                      const meanMotion = elements.meanMotionRevPerDay
                      const mu = 398600.4418
                      const n = meanMotion * 2 * Math.PI / 86400
                      const semiMajorAxis = Math.pow(mu / (n * n), 1/3)
                      const period = 1440 / meanMotion
                      const sat = {
                        id: `sat_${matched?.NORAD_CAT_ID || elements.name || Math.random().toString(36).slice(2)}`,
                        name: matched?.OBJECT_NAME || elements.name || 'CUSTOM',
                        noradId: String(matched?.NORAD_CAT_ID || '').replace(/[^0-9]/g,'') || 'CUSTOM',
                        tle1,
                        tle2,
                        status: 'active',
                        orbitalParams: {
                          semiMajorAxis,
                          inclination: elements.inclinationDeg,
                          eccentricity: elements.eccentricity,
                          raan: elements.raanDeg,
                          argumentOfPerigee: elements.argumentOfPerigeeDeg,
                          meanAnomaly: elements.meanAnomalyDeg,
                          meanMotion,
                          period
                        },
                        position: { x: geo?.lon || 0, y: geo?.lat || 0, z: geo?.altKm || Math.max(0, semiMajorAxis - 6371) },
                        velocity: { x: 0, y: 0, z: 0 },
                        lastUpdate: new Date()
                      } as Satellite
                      setSatellites(prev => [...prev, sat])
                      const path = generateOrbitPath(tle1!, tle2!) // Full orbit
                      setUserOrbits(prev => [...prev, { id: sat.id, path, color: '#60a5fa' }])
                    } catch (e) {
                      setParamCheck({ status: 'error', text: 'Validation failed. Try again.' })
                    }
                  }} style={{ marginTop: 8 }}>Add Satellite</button>
                  {paramCheck.status && (
                    <div style={{ marginTop: 6, fontSize: '0.9rem', color: paramCheck.status === 'ok' ? '#86efac' : '#fca5a5' }}>
                      {paramCheck.text}
                    </div>
                  )}
                </div>
              {satellites.map(satellite => (
                <div 
                  key={satellite.id} 
                  style={{
                      background: selectedSatelliteId === satellite.id ? 'rgba(100, 181, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: selectedSatelliteId === satellite.id ? '2px solid #64b5f6' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                    padding: '1rem',
                  marginBottom: '0.8rem',
                    transition: 'all 0.2s'
                  }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setSelectedSatelliteId(satellite.id)} style={{ padding: '4px 8px' }}>Select</button>
                      <button onClick={() => removeSatellite(satellite.id)} style={{ padding: '4px 8px', color: '#fca5a5', border: '1px solid rgba(252,165,165,0.4)', background: 'transparent' }}>Remove</button>
                    </div>
                    <h3 style={{ color: '#64b5f6', margin: '0.5rem 0 0.5rem 0' }}>🛰️ {satellite.name}</h3>
                    <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>NORAD ID: {satellite.noradId}</p>
                    <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Altitude: {(satellite.position.z || 0).toFixed(1)} km</p>
                    <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Inclination: {satellite.orbitalParams.inclination.toFixed(2)}°</p>
                </div>
              ))}
          </div>
            ) : sidePanelTab === 'myconj' ? (
              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <h3 style={{ color: '#93c5fd', marginTop: 0 }}>Conjunctions for Tracked</h3>
                {!cdmData || (cdmData as any[]).length === 0 ? (
                  <p style={{ opacity: 0.8 }}>No recent conjunctions.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                        <th align="left">Obj 1</th>
                        <th align="left">ID 1</th>
                        <th align="left">Obj 2</th>
                        <th align="left">ID 2</th>
                        <th align="left">Miss (km)</th>
                        <th align="left">Rel (km/s)</th>
                        <th align="left">TCA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cdmData as any[]).map((d: any, i) => {
                        const { o1Name, o2Name, o1Id, o2Id } = resolveCdmNamesAndIds(d)
                        const firstVal = (obj: any, keys: string[]): any => {
                          for (const k of keys) { if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k] }
                          return undefined
                        }
                        const raw = (d as any).raw || {}
                        const md = firstVal(d, ['MISS_DISTANCE','MISS_DISTANCE_KM']) ?? firstVal(raw, ['MISS_DISTANCE','MISS_DISTANCE_KM'])
                        const rv = firstVal(d, ['RELATIVE_SPEED']) ?? firstVal(raw, ['RELATIVE_SPEED'])
                        const tca = firstVal(d, ['TCA']) ?? firstVal(raw, ['TCA'])
                        const km = (() => {
                          if (md == null) return '—'
                          const s = String(md).toLowerCase();
                          if (s.endsWith('km')) return Number(s.replace('km','').trim()).toFixed(2)
                          const n = Number(s); return isFinite(n) ? (n / 1000).toFixed(2) : '—'
                        })()
                        const rvs = (() => {
                          if (rv == null) return '—'
                          const s = String(rv).toLowerCase();
                          if (s.endsWith('km/s')) return Number(s.replace('km/s','').trim()).toFixed(2)
                          const n = Number(s); return isFinite(n) ? (n).toFixed(2) : '—'
                        })()
                        return (
                          <tr 
                            key={i}
                            onClick={() => handleConjunctionClick(d)}
                            style={{
                              cursor: 'pointer',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(100,181,246,0.15)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td>{o1Name}</td>
                            <td>{o1Id || '—'}</td>
                            <td>{o2Name}</td>
                            <td>{o2Id || '—'}</td>
                            <td>{km}</td>
                            <td>{rvs}</td>
                            <td>{tca ? new Date(tca).toUTCString() : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
        </div>
            ) : sidePanelTab === 'weather' ? (
            <ErrorBoundary>
              <SpaceWeatherMonitor 
                onThreatDetected={handleThreatDetected} 
                onEventSelect={handleEventSelect}
              />
            </ErrorBoundary>
            ) : sidePanelTab === 'maneuvers' ? (
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <h3 style={{ color: '#93c5fd', marginTop: 0 }}>Maneuver History</h3>
              {maneuverHistory.length === 0 ? (
                <p style={{ opacity: 0.8, fontStyle: 'italic' }}>No maneuvers executed yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {maneuverHistory.map((m) => (
                    <div key={m.id} style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 8,
                      padding: 12
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <strong style={{ color: '#10b981' }}>{m.satelliteName}</strong>
                        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                          {new Date(m.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '0.85rem', lineHeight: 1.4 }}>
                        {m.description}
                      </p>
                      <details style={{ marginTop: 8, fontSize: '0.75rem', opacity: 0.7 }}>
                        <summary style={{ cursor: 'pointer' }}>TLE Details</summary>
                        <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: '0.7rem' }}>
                          <div><strong>Old TLE:</strong></div>
                          <div>{m.oldTle1}</div>
                          <div>{m.oldTle2}</div>
                          <div style={{ marginTop: 4 }}><strong>New TLE:</strong></div>
                          <div>{m.newTle1}</div>
                          <div>{m.newTle2}</div>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
            ) : null}
          </div>
            </>
          )}
        </div>

        {activeTab === '3d' && (
          <div style={{ background: 'rgba(16,24,40,0.6)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 12, padding: '1.25rem' }}>
            <ErrorBoundary onError={(e) => console.log('3D error:', e?.message)}>
              <Earth3DVisualization
                liveSatellites={simulatedSatellitePositions || satellites.map(s => ({
                  id: s.id,
                  name: s.name,
                  lat: s.position.y || 0,
                  lon: s.position.x || 0,
                  altKm: s.position.z || 0,
                  color: s.id === selectedSatelliteId ? '#ffd700' : '#93c5fd'
                }))}
    orbitPaths={showOrbits ? combinedOrbitPaths : []}
    onSelectSatellite={(id) => setSelectedSatelliteId(id)}
    conjunctionPoint={conjunctionPoint}
  />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === '2d' && (
          <div style={{ background: 'rgba(16,24,40,0.6)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 12, padding: '1.25rem' }}>
            <Earth2DVisualization 
              satellites={displaySatellites} 
              selectedSatelliteId={selectedSatelliteId} 
              onSatelliteSelect={handleSatelliteSelect}
              orbitPaths={showOrbits ? combinedOrbitPaths : []}
            />
          </div>
        )}

        {activeTab === 'conjunctions' && (
        <div style={{
          background: 'rgba(7,11,20,0.85)',
          border: '1px solid rgba(71,85,105,0.35)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginTop: '2rem'
        }}>
          <h2 style={{ color: '#64b5f6', marginBottom: '1rem' }}>🚨 Real Conjunction Alerts</h2>
          {cdmError && (
            <div style={{ color: '#ffbdbd', marginBottom: '0.5rem' }}>Failed to load CDM feed</div>
          )}
          {cdmLoading ? (
            <p style={{ opacity: 0.7 }}>Loading conjunctions…</p>
          ) : !cdmData || (cdmData as any[]).length === 0 ? (
            <p style={{ opacity: 0.7 }}>No conjunctions detected in the past 3 days.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                  <th align="left">Object 1</th>
                  <th align="left">NORAD 1</th>
                  <th align="left">Object 2</th>
                  <th align="left">NORAD 2</th>
                  <th align="left">Miss Distance (km)</th>
                  <th align="left">Relative Speed (km/s)</th>
                  <th align="left">TCA (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {(cdmData as any[]).map((d: any) => {
                  const { o1Name, o2Name, o1Id, o2Id } = resolveCdmNamesAndIds(d)
                  const firstVal = (obj: any, keys: string[]): any => {
                    for (const k of keys) {
                      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k]
                    }
                    return undefined
                  }
                  const raw = (d as any).raw || {}

                  const parseMeters = (v: any, unitHint?: string): number | undefined => {
                    if (v === undefined || v === null) return undefined
                    if (typeof v === 'number') return isFinite(v) ? v : undefined
                    const s = String(v).toLowerCase().trim()
                    if (!s) return undefined
                    if (s.endsWith('km')) return Number(s.replace('km','').trim()) * 1000
                    if (s.endsWith('m')) return Number(s.replace('m','').trim())
                    const n = Number(s)
                    if (isFinite(n)) {
                      if (unitHint?.toLowerCase() === 'km') return n * 1000
                      return n
                    }
                    return undefined
                  }
                  const parseSpeedKmS = (v: any, unitHint?: string): number | undefined => {
                    if (v === undefined || v === null) return undefined
                    if (typeof v === 'number') return isFinite(v) ? v : undefined
                    const s = String(v).toLowerCase().trim()
                    if (!s) return undefined
                    if (s.endsWith('km/s')) return Number(s.replace('km/s','').trim())
                    if (s.endsWith('m/s')) return (Number(s.replace('m/s','').trim()) / 1000)
                    const n = Number(s)
                    if (isFinite(n)) {
                      if (unitHint?.toLowerCase() === 'm/s') return n / 1000
                      return n
                    }
                    return undefined
                  }

                  const mdUnits = firstVal(raw, ['MISS_DISTANCE_UNITS','MISS_DISTANCE_UNIT','MD_UNITS'])
                  const rvUnits = firstVal(raw, ['RELATIVE_SPEED_UNITS','RELATIVE_VELOCITY_UNITS','V_REL_UNITS'])
                  const md = typeof (d as any).missDistanceMeters === 'number'
                    ? (d as any).missDistanceMeters
                    : parseMeters(firstVal(d, ['MISS_DISTANCE','MISS_DISTANCE_VALUE','MISS_DIST','MD','MISS_DISTANCE_KM','RANGE_AT_TCA','RANGE'])
                      ?? firstVal(raw, ['MISS_DISTANCE','MISS_DISTANCE_KM','RANGE_AT_TCA','RANGE']), mdUnits)
                  const rv = typeof (d as any).relativeSpeedKmS === 'number'
                    ? (d as any).relativeSpeedKmS
                    : parseSpeedKmS(firstVal(d, ['RELATIVE_SPEED','RELATIVE_VELOCITY','V_REL','RELATIVE_SPEED_KM_S','REL_SPEED'])
                      ?? firstVal(raw, ['RELATIVE_SPEED','RELATIVE_VELOCITY','V_REL']), rvUnits)
                  const tca = firstVal(d, ['TCA','TIME_OF_CLOSEST_APPROACH']) ?? firstVal(raw, ['TCA','TIME_OF_CLOSEST_APPROACH'])
                  const displayedKm = (() => {
                    if (md !== undefined) return md / 1000
                    const rawMd = firstVal(d, ['MISS_DISTANCE','MISS_DISTANCE_VALUE','MISS_DIST','MD','MISS_DISTANCE_KM','RANGE_AT_TCA','RANGE'])
                      ?? firstVal(raw, ['MISS_DISTANCE','MISS_DISTANCE_KM','RANGE_AT_TCA','RANGE'])
                    const mParsed = parseMeters(rawMd, mdUnits)
                    return mParsed !== undefined ? (mParsed / 1000) : undefined
                  })()

                  return (
                    <tr 
                      key={(d as any).id || d.CDM_ID}
                      onClick={() => handleConjunctionClick(d)}
                      style={{
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(100,181,246,0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td>{o1Name}</td>
                      <td>{o1Id || '—'}</td>
                      <td>{o2Name}</td>
                      <td>{o2Id || '—'}</td>
                      <td>{displayedKm !== undefined ? displayedKm.toFixed(2) : 'N/A'}</td>
                      <td>{rv !== undefined ? rv.toFixed(2) : (firstVal(d, ['RELATIVE_SPEED']) ?? firstVal(raw, ['RELATIVE_SPEED']) ?? 'N/A')}</td>
                      <td>{tca ? new Date(tca).toUTCString() : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        )}
      </main>

      <footer style={{
        marginTop: '2rem',
        paddingTop: '1rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center',
        opacity: 0.6,
        fontSize: '0.8rem'
      }}>
        <p>ANT61 Hackathon - Professional Satellite Safety System</p>
        <p>Real APIs • Live Data • 3D Visualization • Space Operations</p>
      </footer>
      
      {/* Orbit Control Panel for collision avoidance */}
      {orbitControlOpen && (
        <OrbitControlPanel
          satellite={orbitControlSatellite as any}
          collisionRisk={orbitControlCollisionRisk}
          onApplyManeuver={handleApplyManeuver}
          onClose={() => {
            setOrbitControlOpen(false);
            setOrbitControlSatellite(null);
            setOrbitControlCollisionRisk(null);
          }}
        />
      )}
      
      {/* Background Space Weather Monitor - always mounted for threat detection */}
      <div style={{ display: 'none' }}>
        <ErrorBoundary>
          <SpaceWeatherMonitor 
            onThreatDetected={handleThreatDetected} 
            onEventSelect={handleEventSelect}
            isVisible={false}
          />
        </ErrorBoundary>
      </div>
      
      {/* AI Assistant Panel */}
      <AssistantPanel
        buildState={buildAssistantState}
        onExecutePlan={executeAssistantPlan}
      />
    </div>
  );
}

export default App;


