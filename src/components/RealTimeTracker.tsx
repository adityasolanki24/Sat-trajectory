import { useState, useEffect } from 'react';

interface RealTimeTrackerProps {
  onSatelliteUpdate?: (satellites: any[]) => void;
}

export function RealTimeTracker({ onSatelliteUpdate }: RealTimeTrackerProps) {
  const [satellitesAbove, setSatellitesAbove] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          // Default to New York if geolocation fails
          setLocation({ lat: 40.7128, lng: -74.0060 });
        }
      );
    } else {
      // Default to New York if geolocation not supported
      setLocation({ lat: 40.7128, lng: -74.0060 });
    }
  }, []);

  // Fetch satellites above current location
  const fetchSatellitesAbove = async () => {
    if (!location) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('🛰️ Fetching satellites above location...');
      
      // Use N2YO API to get satellites above current location
      const apiKey = import.meta.env.VITE_N2YO_API_KEY || '5FV9Y8-XDX22Z-MKUATT-5LAX';
      const response = await fetch(
        `/api/n2yo/rest/v1/satellite/above/${location.lat}/${location.lng}/0/70/2/&apiKey=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`N2YO API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📡 N2YO API response:', data);
      
      if (data.above && data.above.length > 0) {
        setSatellitesAbove(data.above);
        onSatelliteUpdate?.(data.above);
        console.log(`✅ Found ${data.above.length} satellites above location`);
      } else {
        console.log('ℹ️ No satellites found above location');
      }
    } catch (error) {
      console.error('❌ Failed to fetch satellites above:', error);
      setError('Failed to fetch satellite data');
      
      // Fallback to mock data
      const mockSatellites = [
        {
          satid: 25544,
          satname: "SPACE STATION",
          satlat: location.lat + Math.random() * 0.1,
          satlng: location.lng + Math.random() * 0.1,
          satalt: 408.0
        },
        {
          satid: 20580,
          satname: "HST",
          satlat: location.lat + Math.random() * 0.1,
          satlng: location.lng + Math.random() * 0.1,
          satalt: 540.0
        }
      ];
      setSatellitesAbove(mockSatellites);
      onSatelliteUpdate?.(mockSatellites);
    } finally {
      setLoading(false);
    }
  };

  // Fetch satellite positions for a specific satellite
  const fetchSatellitePositions = async (satId: number) => {
    if (!location) return;
    
    try {
      console.log(`📍 Fetching positions for satellite ${satId}...`);
      
      const apiKey = import.meta.env.VITE_N2YO_API_KEY || '5FV9Y8-XDX22Z-MKUATT-5LAX';
      const response = await fetch(
        `/api/n2yo/rest/v1/satellite/positions/${satId}/${location.lat}/${location.lng}/0/60/&apiKey=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`N2YO Positions API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Fetched ${data.positions?.length || 0} positions for ${data.info?.satname}`);
      return data.positions || [];
    } catch (error) {
      console.error('❌ Failed to fetch satellite positions:', error);
      return [];
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (location) {
      fetchSatellitesAbove();
      const interval = setInterval(fetchSatellitesAbove, 30000);
      return () => clearInterval(interval);
    }
  }, [location]);

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '12px',
      padding: '1.5rem'
    }}>
      <h2 style={{ color: '#64b5f6', marginBottom: '1rem' }}>
        📍 Real-Time Satellite Tracker
      </h2>
      
      {location && (
        <div style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1rem' }}>
          <p>📍 Location: {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°</p>
          <p>🔄 Updates: Every 30 seconds</p>
        </div>
      )}
      
      {loading && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <p>🛰️ Loading satellite data...</p>
        </div>
      )}
      
      {error && (
        <div style={{
          background: 'rgba(244, 67, 54, 0.2)',
          border: '1px solid #f44336',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <p style={{ color: '#f44336', margin: 0 }}>⚠️ {error}</p>
        </div>
      )}
      
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {satellitesAbove.map((satellite, index) => (
          <div key={satellite.satid || index} style={{
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '0.8rem',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            marginBottom: '0.5rem'
          }}>
            <h4 style={{ color: '#64b5f6', margin: '0 0 0.3rem 0', fontSize: '0.9rem' }}>
              🛰️ {satellite.satname}
            </h4>
            <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: '0.2rem 0' }}>
              NORAD ID: {satellite.satid}
            </p>
            <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: '0.2rem 0' }}>
              Position: {satellite.satlat?.toFixed(2)}°, {satellite.satlng?.toFixed(2)}°
            </p>
            <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: '0.2rem 0' }}>
              Altitude: {satellite.satalt?.toFixed(1)} km
            </p>
          </div>
        ))}
      </div>
      
      {satellitesAbove.length === 0 && !loading && (
        <div style={{ textAlign: 'center', opacity: 0.6, padding: '1rem' }}>
          <p>No satellites detected above your location</p>
        </div>
      )}
      
      <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
        <h4 style={{ color: '#64b5f6', margin: '0 0 0.5rem 0' }}>Live Data Sources</h4>
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          • N2YO API: Real-time satellite positions
        </p>
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          • GPS Location: {location ? 'Detected' : 'Detecting...'}
        </p>
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          • Satellites Found: {satellitesAbove.length}
        </p>
        <button 
          onClick={() => satellitesAbove.length > 0 && fetchSatellitePositions(satellitesAbove[0].satid)}
          style={{ marginTop: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
        >
          Get Detailed Positions
        </button>
      </div>
    </div>
  );
}