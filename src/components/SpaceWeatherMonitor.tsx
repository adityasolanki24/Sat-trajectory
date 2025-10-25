import { useState, useEffect } from 'react';

export interface SpaceWeatherEvent {
  id: string;
  type: 'CME' | 'Solar Flare' | 'Geomagnetic Storm' | 'SEP';
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  timestamp: string;
  impact?: string;
  source?: any;
}

export interface SpaceWeatherMonitorProps {
  onThreatDetected?: (event: SpaceWeatherEvent) => void;
  onEventSelect?: (event: SpaceWeatherEvent) => void;
  isVisible?: boolean;
}

export function SpaceWeatherMonitor({ onThreatDetected, onEventSelect, isVisible = true }: SpaceWeatherMonitorProps) {
  const [events, setEvents] = useState<SpaceWeatherEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch space weather events from NASA DONKI
  const fetchSpaceWeatherEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
      const toIso = (d: Date) => d.toISOString().split('T')[0]

      console.log('[SpaceWeather] Fetching CME data...');
      const cmeResponse = await fetch(`/api/donki/CME?startDate=${toIso(startDate)}&endDate=${toIso(endDate)}`);
      console.log('[SpaceWeather] CME response status:', cmeResponse.status);
      const cmeData = cmeResponse.ok ? await cmeResponse.json() : [];
      console.log('[SpaceWeather] CME events:', cmeData.length);
      
      console.log('[SpaceWeather] Fetching FLR data...');
      const flareResponse = await fetch(`/api/donki/FLR?startDate=${toIso(startDate)}&endDate=${toIso(endDate)}`);
      console.log('[SpaceWeather] FLR response status:', flareResponse.status);
      const flareData = flareResponse.ok ? await flareResponse.json() : [];
      console.log('[SpaceWeather] FLR events:', flareData.length);
      
      console.log('[SpaceWeather] Fetching GST data...');
      const gstResponse = await fetch(`/api/donki/GST?startDate=${toIso(startDate)}&endDate=${toIso(endDate)}`);
      console.log('[SpaceWeather] GST response status:', gstResponse.status);
      const gstData = gstResponse.ok ? await gstResponse.json() : [];
      console.log('[SpaceWeather] GST events:', gstData.length);
      
      const processedEvents: SpaceWeatherEvent[] = [];
      
      // Process CME events
      cmeData.slice(0, 5).forEach((cme: any, index: number) => {
        const speed = cme?.cmeAnalyses?.find?.((a: any) => a?.isMostAccurate) ?.speed || cme?.speed
        processedEvents.push({
          id: `cme_${cme.activityID || index}`,
          type: 'CME',
          title: `Coronal Mass Ejection`,
          description: cme.note || 'CME detected in solar wind',
          severity: speed ? (speed > 1000 ? 'High' : 'Medium') : 'Low',
          timestamp: cme.startTime || new Date().toISOString(),
          impact: speed ? `Speed: ${speed} km/s` : undefined,
          source: cme
        });
      });
      
      // Process Solar Flares
      flareData.slice(0, 5).forEach((flare: any, index: number) => {
        processedEvents.push({
          id: `flare_${flare.flrID || index}`,
          type: 'Solar Flare',
          title: `Solar Flare ${flare.classType || 'M-Class'}`,
          description: flare.flrID || 'Solar flare detected',
          severity: flare.classType?.includes('X') ? 'High' : flare.classType?.includes('M') ? 'Medium' : 'Low',
          timestamp: flare.beginTime || new Date().toISOString(),
          impact: flare.classType ? `Class: ${flare.classType}` : undefined,
          source: flare
        });
      });
      
      // Process Geomagnetic Storms
      gstData.slice(0, 5).forEach((storm: any, index: number) => {
        const kp = storm.kpIndex
        processedEvents.push({
          id: `storm_${storm.gstID || index}`,
          type: 'Geomagnetic Storm',
          title: `Geomagnetic Storm`,
          description: storm.gstID || 'Geomagnetic activity detected',
          severity: kp ? (kp > 7 ? 'High' : kp > 5 ? 'Medium' : 'Low') : 'Low',
          timestamp: storm.startTime || new Date().toISOString(),
          impact: kp ? `Kp Index: ${kp}` : undefined,
          source: storm
        });
      });
      
      setEvents(processedEvents);
      processedEvents
        .filter(e => e.severity === 'High' || e.severity === 'Critical')
        .forEach(e => onThreatDetected?.(e));
    } catch (error) {
      setError('Failed to fetch space weather data');
      const mockEvents: SpaceWeatherEvent[] = [
        {
          id: 'mock_1',
          type: 'CME',
          title: 'Coronal Mass Ejection',
          description: 'CME detected in solar wind - moderate impact expected',
          severity: 'Medium',
          timestamp: new Date().toISOString(),
          impact: 'Speed: 800 km/s'
        },
        {
          id: 'mock_2',
          type: 'Solar Flare',
          title: 'Solar Flare M-Class',
          description: 'M2.5 solar flare detected',
          severity: 'Medium',
          timestamp: new Date().toISOString(),
          impact: 'Class: M2.5'
        }
      ];
      setEvents(mockEvents);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaceWeatherEvents();
    const interval = setInterval(fetchSpaceWeatherEvents, 300000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return '#f44336';
      case 'High': return '#ff9800';
      case 'Medium': return '#ffc107';
      case 'Low': return '#4caf50';
      default: return '#64b5f6';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CME': return '🌊';
      case 'Solar Flare': return '☀️';
      case 'Geomagnetic Storm': return '⚡';
      case 'SEP': return '🔋';
      default: return '🌍';
    }
  };

  // If not visible, just return null (but data still loads in background via useEffect)
  if (!isVisible) {
    return null;
  }

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '12px',
      padding: '1.5rem'
    }}>
      <h2 style={{ color: '#64b5f6', marginBottom: '1rem' }}>
        🌍 Space Weather Monitor
      </h2>
      {loading && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <p>🌍 Loading space weather data...</p>
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(244, 67, 54, 0.2)', border: '1px solid #f44336', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ color: '#f44336', margin: 0 }}>⚠️ {error}</p>
        </div>
      )}
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {events.map((event) => (
          <div key={event.id}
            onClick={() => onEventSelect?.(event)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '0.8rem', cursor: 'pointer'
            }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>
                {getTypeIcon(event.type)}
              </span>
              <h4 style={{ color: '#64b5f6', margin: 0, fontSize: '0.9rem' }}>
                {event.title}
              </h4>
              <span style={{ marginLeft: 'auto', padding: '0.2rem 0.5rem', background: getSeverityColor(event.severity), borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                {event.severity}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: '0.3rem 0' }}>{event.description}</p>
            {event.impact && (
              <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: '0.3rem 0' }}>Impact: {event.impact}</p>
            )}
            <p style={{ fontSize: '0.7rem', opacity: 0.6, margin: '0.3rem 0 0 0' }}>{new Date(event.timestamp).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
        <h4 style={{ color: '#64b5f6', margin: '0 0 0.5rem 0' }}>Data Sources</h4>
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>• NASA DONKI: CME, Solar Flares, Geomagnetic Storms</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>• Updates: Every 5 minutes</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>• Events Monitored: {events.length}</p>
      </div>
    </div>
  );
}