import { useEffect, useRef } from 'react';
import { Satellite, SuggestedAction } from '../types';

interface RealTimeUpdatesProps {
  satellites: Satellite[];
  onSatellitesUpdate: (satellites: Satellite[]) => void;
  onActionSuggested: (action: SuggestedAction) => void;
}

export const useRealTimeUpdates = ({
  satellites,
  onSatellitesUpdate,
  onActionSuggested
}: RealTimeUpdatesProps) => {
  const intervalRef = useRef<NodeJS.Timeout | number>();

  useEffect(() => {
    // Simulate real-time updates every 10 seconds
    intervalRef.current = setInterval(() => {
      // Update satellite positions (simulate orbital motion)
      const updatedSatellites = satellites.map(satellite => {
        const now = new Date();
        const timeDiff = (now.getTime() - satellite.lastUpdate.getTime()) / 1000; // seconds
        
        // Simple orbital motion simulation
        const meanMotionRadPerSec = (satellite.orbitalParams.meanMotion * 2 * Math.PI) / 86400;
        const newMeanAnomaly = (satellite.orbitalParams.meanAnomaly + meanMotionRadPerSec * timeDiff) % (2 * Math.PI);
        
        const altitude = satellite.orbitalParams.semiMajorAxis - 637; // Earth radius
        const inclination = (satellite.orbitalParams.inclination * Math.PI) / 180;
        
        const newPosition = {
          x: Math.cos(newMeanAnomaly) * altitude,
          y: Math.sin(newMeanAnomaly) * Math.sin(inclination) * altitude,
          z: Math.sin(newMeanAnomaly) * Math.cos(inclination) * altitude
        };

        return {
          ...satellite,
          orbitalParams: {
            ...satellite.orbitalParams,
            meanAnomaly: (newMeanAnomaly * 180) / Math.PI // Convert back to degrees
          },
          position: newPosition,
          lastUpdate: now
        };
      });

      onSatellitesUpdate(updatedSatellites);

      // Occasionally suggest random actions (simulate threat detection)
      if (Math.random() < 0.1 && satellites.length > 0) {
        const randomSatellite = satellites[Math.floor(Math.random() * satellites.length)];
        const actionTypes = ['orbit_adjustment', 'safe_mode', 'attitude_change'] as const;
        const randomType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
        
        const mockAction: SuggestedAction = {
          id: `realtime_action_${Date.now()}`,
          satelliteId: randomSatellite.id,
          type: randomType,
          priority: Math.random() > 0.7 ? 'high' : 'medium',
          description: `Simulated ${randomType.replace('_', ' ')} for ${randomSatellite.name}`,
          parameters: randomType === 'orbit_adjustment' ? {
            deltaV: Math.random() * 10 + 2,
            direction: 'prograde'
          } : randomType === 'safe_mode' ? {
            safeModeLevel: 'standard',
            duration: 30
          } : undefined,
          estimatedEffectiveness: 0.8 + Math.random() * 0.2,
          estimatedCost: Math.random() * 50 + 10,
          executeBy: new Date(Date.now() + Math.random() * 60 * 60 * 1000).toISOString() // Within 1 hour
        };

        onActionSuggested(mockAction);
      }
    }, 10000); // Update every 10 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [satellites, onSatellitesUpdate, onActionSuggested]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
};

// WebSocket simulation for real-time data
export const useWebSocketSimulation = () => {
  const wsRef = useRef<WebSocket>();

  useEffect(() => {
    // Simulate WebSocket connection (in real implementation, connect to actual WebSocket)
    const simulateConnection = () => {
      console.log('🔄 Simulating WebSocket connection to space data feeds...');
      
      // Simulate receiving data every 5 seconds
      const dataInterval = setInterval(() => {
        const mockData = {
          type: 'space_weather_update',
          timestamp: new Date().toISOString(),
          kpIndex: 2 + Math.random() * 4, // Kp index between 2-6
          solarFlareActivity: Math.random() > 0.8 ? 'moderate' : 'quiet',
          cmeDetected: Math.random() > 0.9
        };

        // Dispatch custom event for components to listen to
        window.dispatchEvent(new CustomEvent('spaceDataUpdate', { detail: mockData }));
      }, 5000);

      return () => clearInterval(dataInterval);
    };

    const cleanup = simulateConnection();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return wsRef.current;
};

// Hook for listening to space weather updates
export const useSpaceWeatherListener = (callback: (data: any) => void) => {
  useEffect(() => {
    const handleSpaceDataUpdate = (event: CustomEvent) => {
      callback(event.detail);
    };

    window.addEventListener('spaceDataUpdate', handleSpaceDataUpdate as EventListener);
    
    return () => {
      window.removeEventListener('spaceDataUpdate', handleSpaceDataUpdate as EventListener);
    };
  }, [callback]);
};
