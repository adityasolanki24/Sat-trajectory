import React from 'react';

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
}

interface Props {
  satellites: Satellite[];
  selectedSatelliteId?: string;
  onSatelliteSelect?: (satelliteId: string) => void;
}

export function Earth2DVisualization({ satellites, selectedSatelliteId, onSatelliteSelect }: Props) {
  const size = 400;
  const center = size / 2;
  const earthRadius = 80;
  const orbits = satellites.map(s => {
    const alt = s.orbitalParams.semiMajorAxis - 637; // km
    const r = earthRadius + Math.min(Math.max(alt, 0), 2000) * 0.05;
    const inc = (s.orbitalParams.inclination * Math.PI) / 180;
    const M = (s.orbitalParams.meanAnomaly * Math.PI) / 180;
    let x = center + r * Math.cos(M) * Math.cos(inc);
    let y = center + r * Math.sin(M);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { x = center; y = center; }
    return { r, x, y, id: s.id, selected: selectedSatelliteId === s.id, color: s.status === 'debris' ? '#9e9e9e' : '#ff6b6b' };
  });

  return (
    <div style={{ width: '100%', height: '400px', background: '#000011', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={earthRadius} fill="#1e88e5" stroke="#64b5f6" strokeWidth={1} />
        {orbits.map(o => (
          <g key={o.id} onClick={() => onSatelliteSelect?.(o.id)} style={{ cursor: 'pointer' }}>
            <circle cx={center} cy={center} r={o.r} fill="none" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={1} />
            <circle cx={o.x} cy={o.y} r={o.selected ? 4 : 3} fill={o.selected ? '#ffd700' : o.color} />
          </g>
        ))}
        {orbits.length === 0 && (
          <text x={center} y={center} fill="#ffffff" fontSize="12" textAnchor="middle">No satellites</text>
        )}
      </svg>
    </div>
  );
}


