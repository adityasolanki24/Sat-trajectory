import { useEffect, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
// import { Earth3DVisualization } from './components/Earth3DVisualization';
import { Earth2DVisualization } from './components/Earth2DVisualization';
import { Earth3DVisualization } from './components/Earth3DVisualization';
import { useSatellitePositions } from './hooks/useSatellitePositions';
import { SpaceWeatherMonitor } from './components/SpaceWeatherMonitor';
import { TopBar } from './components/TopBar';
import { useConjunctions } from './hooks/useConjunctions';
import { generateOrbitPath } from './utils/orbit';

interface Satellite {
  id: string;
  name: string;
  noradId: string;
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
  const [userOrbits, setUserOrbits] = useState<{ id: string; path: { lat: number; lon: number; altKm: number }[]; color?: string }[]>([]);

  // Live ISS position (optional, improves user perception even if Celestrak is down)
  const { position: issPos } = useSatellitePositions(25544, 0, 0, 0);

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
    // Semi-major axis in km from mean motion (rev/day)
    const mu = 398600.4418; // km^3/s^2
    const n = meanMotion * 2 * Math.PI / 86400; // rad/s
    const semiMajorAxis = Math.pow(mu / (n * n), 1/3);
    const period = 1440 / meanMotion;
    return {
      id: `sat_${obj.NORAD_CAT_ID || idx}`,
      name: obj.OBJECT_NAME || `Satellite ${idx + 1}`,
      noradId: String(obj.NORAD_CAT_ID || idx + 1),
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
      position: { x: 0, y: 0, z: 0 },
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
      }
    ];

    // Seed fallback immediately so UI is never empty
    const seeded = fallback.map((d, i) => parseFromTLE(d, i)).filter(Boolean) as Satellite[];
    if (seeded.length > 0) setSatellites(seeded);

    const loadInitialSatellites = async () => {
      try {
        setLoading(true);
        console.log('🛰️ Loading satellite data from Celestrak...');
        const tryFetch = async (url: string, timeoutMs = 10000) => {
        const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const res = await fetch(url, { signal: controller.signal });
            return res;
          } finally {
        clearTimeout(timer);
          }
        };

        const urls = [
          '/api/celestrak/NORAD/elements/gp.php?GROUP=active&FORMAT=json',
          'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json',
          '/api/celestrak/NORAD/elements/gp.php?GROUP=stations&FORMAT=json',
          'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json'
        ];

        let response: Response | null = null;
        for (const url of urls) {
          try {
            const res = await tryFetch(url, 10000);
            if (res.ok) { response = res; break; }
          } catch (_) {
            // ignore and try next
          }
        }
        if (!response || !response.ok) throw new Error('All Celestrak attempts failed');

        // Try JSON (gp) first
        let parsedSatellites: Satellite[] = []
        try {
          const celestrakData: any[] = await response.json();
          // If JSON has TLE lines, use them
          if (Array.isArray(celestrakData) && celestrakData.length && (celestrakData[0] as any)?.TLE_LINE1) {
            parsedSatellites = celestrakData
          .slice(0, 8)
          .map((data: any, index: number) => parseFromTLE(data, index))
          .filter(Boolean) as Satellite[];
          } else {
            // Fallback: fetch TLE text and parse
            const fetchTleText = async (group: string) => {
              const tryText = async (url: string) => {
                const res = await tryFetch(url, 10000)
                if (!res.ok) return ''
                return await res.text()
              }
              const tlp = await tryText(`/api/celestrak/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`)
              if (tlp) return tlp
              return await tryText(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`)
            }
            const tleText = (await fetchTleText('active')) || (await fetchTleText('stations')) || ''
            const lines = tleText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
            const tleObjs: any[] = []
            for (let i = 0; i + 2 < lines.length; i += 3) {
              const name = lines[i]
              const l1 = lines[i + 1]
              const l2 = lines[i + 2]
              if (l1?.startsWith('1 ') && l2?.startsWith('2 ')) {
                tleObjs.push({ OBJECT_NAME: name, TLE_LINE1: l1, TLE_LINE2: l2 })
              } else {
                // If format not aligned, back off to next line
                i -= 2
                break
              }
            }
            parsedSatellites = tleObjs
              .slice(0, 8)
              .map((data: any, index: number) => parseFromTLE(data, index))
              .filter(Boolean) as Satellite[]
          }
        } catch (e) {
          throw new Error('Failed to obtain Celestrak TLEs')
        }

        setSatellites(parsedSatellites);
        setError(null);
        setUsingFallback(false);
      } catch (error) {
        console.error('❌ Failed to load satellites:', error);
        // Use built-in TLEs quietly without showing the red error banner
        setError(null);
        setUsingFallback(true);
        if (seeded.length === 0) {
          setSatellites(fallback.map((d, i) => parseFromTLE(d, i)).filter(Boolean) as Satellite[]);
        }
      } finally {
        setLoading(false);
      }
    };
    loadInitialSatellites();
  }, []);

  // Decide initial view based on WebGL support
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const supported = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      if (!supported) setView('2d');
    } catch {
      setView('2d');
    }
  }, []);

  // If ISS live position is available, update the ISS-like entry
  useEffect(() => {
    if (!issPos) return;
    setSatellites(prev => {
      if (prev.length === 0) return prev;
      const idx = prev.findIndex(s => s.noradId === '25544');
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        position: {
          x: issPos.satlongitude,
          y: issPos.satlatitude,
          z: issPos.sataltitude
        },
        lastUpdate: new Date()
      };
      return next;
    });
  }, [issPos]);

  // Animate mean anomaly at 1 Hz (avoid heavy re-renders)
  useEffect(() => {
    const id = setInterval(() => {
      setSatellites(prev => prev.map(s => {
        const degPerSec = (s.orbitalParams.meanMotion * 360) / 86400;
        let newAnomaly = s.orbitalParams.meanAnomaly + degPerSec;
        if (newAnomaly >= 360) newAnomaly -= 360;
        return {
          ...s,
          orbitalParams: { ...s.orbitalParams, meanAnomaly: newAnomaly },
          lastUpdate: new Date()
        };
      }));
    }, 1000);
    return () => clearInterval(id);
  }, [satellites.length]);

  const handleThreatDetected = (event: SpaceWeatherEvent) => {
    setSpaceWeatherEvents(prev => [...prev, event]);
    if (event.severity === 'Critical' || event.severity === 'High') setSystemStatus('critical');
    else if (event.severity === 'Medium') setSystemStatus('warning');
  };

  const handleSatelliteSelect = (satelliteId: string) => {
    setSelectedSatelliteId(satelliteId);
  };

  const handleAddSatelliteByNorad = async () => {
    try {
      setAdding(true);
      setAddError(null);
      const noradId = newNoradId.trim();
      if (!/^[0-9]{3,6}$/.test(noradId)) {
        throw new Error('Enter a valid NORAD ID (3-6 digits)');
      }
      const apiKey = (import.meta as any).env?.VITE_N2YO_API_KEY || (window as any)?.REACT_APP_N2YO_API_KEY || '';
      // Try dev proxy, then direct
      const proxyUrl = `/api/n2yo/rest/v1/satellite/positions/${noradId}/0/0/0/1/&apiKey=${apiKey}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      let res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        const direct = `https://api.n2yo.com/rest/v1/satellite/positions/${noradId}/0/0/0/1/&apiKey=${apiKey}`;
        res = await fetch(direct);
      }
      if (!res.ok) throw new Error(`N2YO error ${res.status}`);
      const data = await res.json();
      const pos = data?.positions?.[0];
      const satname = data?.info?.satname || `SAT ${noradId}`;
      if (!pos) throw new Error('No position returned');

      // Build Satellite object (position x=lon, y=lat, z=altKm)
      const altKm = Number(pos.sataltitude) || 400;
      const semiMajor = 6371 + altKm;
      const sat: Satellite = {
        id: `sat_${noradId}`,
        name: satname,
        noradId: String(noradId),
        status: 'active',
        orbitalParams: {
          semiMajorAxis: semiMajor,
          inclination: 0,
          eccentricity: 0,
          raan: 0,
          argumentOfPerigee: 0,
          meanAnomaly: 0,
          meanMotion: 15.0,
          period: 96
        },
        position: { x: Number(pos.satlongitude) || 0, y: Number(pos.satlatitude) || 0, z: altKm },
        velocity: { x: 0, y: 0, z: 0 },
        lastUpdate: new Date()
      };
      setSatellites(prev => {
        const exists = prev.find(p => p.noradId === sat.noradId);
        return exists ? prev.map(p => (p.noradId === sat.noradId ? sat : p)) : [...prev, sat];
      });
      setNewNoradId("");

      // Fetch TLE for accurate orbit from Celestrak and generate orbit path
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
      const tleUrls = [
        `/api/celestrak/NORAD/elements/gp.php?CATNR=${encodeURIComponent(noradId)}&FORMAT=tle`,
        `https://celestrak.org/NORAD/elements/gp.php?CATNR=${encodeURIComponent(noradId)}&FORMAT=tle`
      ];
      let tleText = '';
      for (const u of tleUrls) {
        try {
          const r = await tryWithTimeout(u, 12000);
          if (r.ok) { tleText = await r.text(); if (tleText) break; }
        } catch {}
      }
      if (tleText) {
        const lines = tleText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        // Expect either 2 lines (L1,L2) or 3 lines (NAME,L1,L2)
        let l1 = '', l2 = '';
        if (lines.length >= 2 && lines[0].startsWith('1 ') && lines[1].startsWith('2 ')) {
          l1 = lines[0]; l2 = lines[1];
        } else if (lines.length >= 3 && lines[1].startsWith('1 ') && lines[2].startsWith('2 ')) {
          l1 = lines[1]; l2 = lines[2];
        }
        if (l1 && l2) {
          const path = generateOrbitPath(l1, l2, 120, 2);
          setUserOrbits(prev => {
            const others = prev.filter(p => p.id !== sat.id);
            return [...others, { id: sat.id, path, color: '#60a5fa' }];
          });
        }
      }
    } catch (e: any) {
      setAddError(e?.message || 'Failed to add satellite');
    } finally {
      setAdding(false);
    }
  };

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
          <h1>🚀 Loading Satellite System...</h1>
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
      <div style={{ display: 'flex', gap: '0.75rem', padding: '12px 16px', borderBottom: '1px solid rgba(148,163,184,0.18)' }}>
        <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(16,24,40,0.6)', border: '1px solid rgba(148,163,184,0.18)' }}>
          STATUS: <b style={{ color: systemStatus === 'critical' ? '#f87171' : systemStatus === 'warning' ? '#f59e0b' : '#22c55e' }}>{systemStatus.toUpperCase()}</b>
          </span>
        <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(16,24,40,0.6)', border: '1px solid rgba(148,163,184,0.18)' }}>Satellites: {satellites.length}</span>
        <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(16,24,40,0.6)', border: '1px solid rgba(148,163,184,0.18)' }}>Threats: {spaceWeatherEvents.length}</span>
        <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(16,24,40,0.6)', border: '1px solid rgba(148,163,184,0.18)' }}>CDMs: {cdmData?.length || 0}</span>
        </div>

      {error && (
        <div style={{
          background: 'rgba(244, 67, 54, 0.2)',
          border: '1px solid #f44336',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ color: '#f44336', margin: '0 0 0.5rem 0' }}>⚠️ Error</h3>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {usingFallback && !error && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          padding: '0.75rem',
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}>
          Using built-in TLEs while Celestrak is slow. Live data will appear when available.
        </div>
      )}

      <main>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {activeTab === 'dashboard' && (
            <>
          <div style={{
                background: 'rgba(16,24,40,0.6)',
                border: '1px solid rgba(148,163,184,0.18)',
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
                  liveSatellites={satellites.slice(0, 10).map(s => ({
                    id: s.id,
                    name: s.name,
                    lat: s.position.y || 0,
                    lon: s.position.x || 0,
                    altKm: (s.orbitalParams.semiMajorAxis || 6771) - 6371,
                        color: s.id === selectedSatelliteId ? '#ffd700' : '#93c5fd'
                  }))}
                  orbitPaths={[
                    // If ISS fallback present, draw its orbit
                    (() => {
                      const iss = satellites.find(x => x.noradId === '25544')
                      if (!iss) return null
                      const tle1 = '1 25544U 98067A   24300.54791667  .00004230  00000-0  99188-4 0  9990'
                      const tle2 = '2 25544  51.6440  31.7492 0009013  77.5070 282.6464 15.50008891 99188'
                      const path = generateOrbitPath(tle1, tle2, 90, 2)
                      return { id: 'iss', path, color: '#60a5fa' }
                    })(),
                    ...userOrbits
                  ].filter(Boolean) as any}
                  links={(() => {
                    if (!cdmData || cdmData.length === 0) return []
                    // Build up to 1-2 demo links from CDM raw using current sat positions if names roughly match
                    const links: any[] = []
                    for (const d of cdmData.slice(0, 3)) {
                      const raw: any = (d as any).raw || {}
                      const n1 = d.object1 || raw.SAT_1_NAME || raw.OBJECT1_NAME
                      const n2 = d.object2 || raw.SAT_2_NAME || raw.OBJECT2_NAME
                      if (!n1 || !n2) continue
                      const a = satellites.find(s => n1 && s.name && String(s.name).toLowerCase().includes(String(n1).toLowerCase()))
                      const b = satellites.find(s => n2 && s.name && String(s.name).toLowerCase().includes(String(n2).toLowerCase()))
                      if (!a || !b) continue
                      links.push({ id: String((d as any).id || raw.CDM_ID), a: { id: a.id, name: a.name, lat: a.position.y || 0, lon: a.position.x || 0, altKm: (a.orbitalParams.semiMajorAxis || 6771) - 6371 }, b: { id: b.id, name: b.name, lat: b.position.y || 0, lon: b.position.x || 0, altKm: (b.orbitalParams.semiMajorAxis || 6771) - 6371 }, color: '#ef4444' })
                    }
                    return links
                  })()}
                  autoRotate={false}
                />
              ) : (
                <Earth2DVisualization
              satellites={satellites}
                  selectedSatelliteId={selectedSatelliteId}
              onSatelliteSelect={handleSatelliteSelect}
            />
              )}
            </ErrorBoundary>
                {addError && (
                  <div style={{ marginTop: '0.5rem', color: '#ffbdbd' }}>
                    {addError}
                  </div>
                )}
            <div style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.8 }}>
              <p>🖱️ Click and drag to rotate • Scroll to zoom • Click satellites to select</p>
            </div>
          </div>

          <div>
            <ErrorBoundary>
              <SpaceWeatherMonitor onThreatDetected={handleThreatDetected} />
            </ErrorBoundary>
          </div>
            </>
          )}
        </div>

        {activeTab === '3d' && (
          <div style={{ background: 'rgba(16,24,40,0.6)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 12, padding: '1.25rem' }}>
            <ErrorBoundary onError={(e) => console.log('3D error:', e?.message)}>
              <Earth3DVisualization
                liveSatellites={satellites.slice(0, 15).map(s => ({
                  id: s.id, name: s.name, lat: s.position.y || 0, lon: s.position.x || 0,
                  altKm: (s.orbitalParams.semiMajorAxis || 6771) - 6371,
                  color: s.id === selectedSatelliteId ? '#ffd700' : '#93c5fd'
                }))}
              />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === '2d' && (
          <div style={{ background: 'rgba(16,24,40,0.6)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 12, padding: '1.25rem' }}>
            <Earth2DVisualization satellites={satellites} selectedSatelliteId={selectedSatelliteId} onSatelliteSelect={handleSatelliteSelect} />
          </div>
        )}

        {activeTab === 'dashboard' && (
        <div style={{
          background: 'rgba(16,24,40,0.6)',
          border: '1px solid rgba(148,163,184,0.18)',
          borderRadius: '12px',
          padding: '1.25rem'
        }}>
          <h2 style={{ color: '#64b5f6', marginBottom: '1rem' }}>
            🛰️ Tracked Satellites ({satellites.length})
          </h2>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {satellites.map(satellite => (
                <div 
                  key={satellite.id} 
                  onClick={() => handleSatelliteSelect(satellite.id)}
                  style={{
                    background: selectedSatelliteId === satellite.id ? 
                    'rgba(100, 181, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: selectedSatelliteId === satellite.id ? 
                    '2px solid #64b5f6' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                    padding: '1rem',
                  marginBottom: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <h3 style={{ color: '#64b5f6', margin: '0 0 0.5rem 0' }}>
                    🛰️ {satellite.name}
                  </h3>
                  <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                    NORAD ID: {satellite.noradId}
                  </p>
                  <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                    Status: {satellite.status}
                  </p>
                  <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                    Altitude: {(satellite.orbitalParams.semiMajorAxis - 637).toFixed(1)} km
                  </p>
                <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  Inclination: {satellite.orbitalParams.inclination.toFixed(2)}°
                </p>
                <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  Period: {satellite.orbitalParams.period.toFixed(1)} min
                </p>
                  {selectedSatelliteId === satellite.id && (
                    <p style={{ fontSize: '0.8rem', color: '#64b5f6', marginTop: '0.5rem' }}>
                      ✓ Selected
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
        )}

        {activeTab === 'conjunctions' && (
        <div style={{
          background: 'rgba(16,24,40,0.6)',
          border: '1px solid rgba(148,163,184,0.18)',
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
          ) : !cdmData || cdmData.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No conjunctions detected in the past 3 days.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                  <th align="left">Object 1</th>
                  <th align="left">Object 2</th>
                  <th align="left">Miss Distance (km)</th>
                  <th align="left">Relative Speed (km/s)</th>
                  <th align="left">TCA (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {cdmData.map((d: any) => {
                  const firstVal = (obj: any, keys: string[]): any => {
                    for (const k of keys) {
                      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k]
                    }
                    return undefined
                  }
                  const raw = (d as any).raw || {}
                  const o1 = (d as any).object1
                    || firstVal(raw, ['OBJECT1_NAME','OBJECT1','OBJECT_1','PRIMARY_OBJECT','OBJECT1_ID','OBJECT1_CATID','OBJECT1_DESIGNATOR'])
                    || firstVal(d, ['OBJECT1_NAME','OBJECT1','OBJECT_1','PRIMARY_OBJECT'])
                    || 'Unknown'
                  const o2 = (d as any).object2
                    || firstVal(raw, ['OBJECT2_NAME','OBJECT2','OBJECT_2','SECONDARY_OBJECT','OBJECT2_ID','OBJECT2_CATID','OBJECT2_DESIGNATOR'])
                    || firstVal(d, ['OBJECT2_NAME','OBJECT2','OBJECT_2','SECONDARY_OBJECT'])
                    || 'Unknown'

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
                    <tr key={(d as any).id || d.CDM_ID}>
                      <td>{o1}</td>
                      <td>{o2}</td>
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
        <p>🚀 ANT61 Hackathon - Professional Satellite Safety System</p>
        <p>Real APIs • Live Data • 3D Visualization • Space Operations</p>
      </footer>
    </div>
  );
}

export default App;


