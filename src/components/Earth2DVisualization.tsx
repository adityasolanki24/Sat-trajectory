import { useMemo, useState } from 'react';
import { WorldMapPaths } from './WorldMapSVG';

interface OrbitPoint { lat: number; lon: number; altKm: number }

interface Satellite {
  id: string;
  name: string;
  noradId: string;
  status: string;
  position?: { x: number; y: number; z: number }; // lon, lat, altKm
}

interface OrbitPath {
  id: string;
  path: OrbitPoint[];
  color?: string;
}

interface Props {
  satellites: Satellite[];
  selectedSatelliteId?: string;
  onSatelliteSelect?: (satelliteId: string) => void;
  selectedOrbitPath?: OrbitPoint[];
  orbitPaths?: OrbitPath[];
}

const width = 700;
const height = 360;

function project(lon: number, lat: number) {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function rgb(r: number, g: number, b: number) { return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})` }

export function Earth2DVisualization({ satellites, selectedSatelliteId, onSatelliteSelect, selectedOrbitPath, orbitPaths = [] }: Props) {
  const [imageIndex, setImageIndex] = useState(0);
  
  // Multiple reliable world map IMAGE sources (PNG/JPG) with equirectangular projection
  const mapSources = [
    // Wikimedia Commons - very reliable
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Equirectangular_projection_SW.jpg/1024px-Equirectangular_projection_SW.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1024px-Blue_Marble_2002.png',
    // OpenStreetMap static tile
    'https://tile.openstreetmap.org/0/0/0.png',
  ];

  const points = useMemo(() => {
    return satellites.map(s => {
      const lon = Number(s.position?.x) || 0;
      const lat = Number(s.position?.y) || 0;
      const { x, y } = project(((lon + 540) % 360) - 180, Math.max(-89.99, Math.min(89.99, lat)));
      return { id: s.id, x, y, selected: s.id === selectedSatelliteId, color: s.status === 'debris' ? '#d4d4d4' : '#7dd3fc' };
    });
  }, [satellites, selectedSatelliteId]);

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    // longitudes every 20°
    for (let lon = -160; lon <= 180; lon += 20) {
      const { x: x1 } = project(lon, -85);
      const { x: x2 } = project(lon, 85);
      lines.push({ x1, y1: project(0, -85).y, x2, y2: project(0, 85).y });
    }
    // latitudes every 20°
    for (let lat = -60; lat <= 60; lat += 20) {
      const { y } = project(0, lat);
      lines.push({ x1: project(-180, lat).x, y1: y, x2: project(180, lat).x, y2: y });
    }
    return lines;
  }, []);

  // Convert orbit paths to SVG paths
  const orbitPathsData = useMemo(() => {
    return orbitPaths.map(orbit => {
      if (!orbit.path || orbit.path.length === 0) return null;
      
      // Convert orbit points to screen coordinates
      const screenPoints = orbit.path.map(p => {
        const lon = ((p.lon + 540) % 360) - 180;
        const lat = Math.max(-89.99, Math.min(89.99, p.lat));
        return { ...project(lon, lat), lon, lat };
      });
      
      // Handle date line wrapping by breaking path into segments
      const segments: string[] = [];
      let currentSegment: typeof screenPoints = [];
      
      for (let i = 0; i < screenPoints.length; i++) {
        const point = screenPoints[i];
        currentSegment.push(point);
        
        // Check if next point wraps around date line
        if (i < screenPoints.length - 1) {
          const nextPoint = screenPoints[i + 1];
          const lonDiff = Math.abs(nextPoint.lon - point.lon);
          
          if (lonDiff > 180) {
            // Date line wrap detected - finish current segment
            if (currentSegment.length > 1) {
              const pathData = currentSegment.map((p, idx) => 
                `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
              ).join(' ');
              segments.push(pathData);
            }
            currentSegment = [];
          }
        }
      }
      
      // Add final segment
      if (currentSegment.length > 1) {
        const pathData = currentSegment.map((p, idx) => 
          `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
        ).join(' ');
        segments.push(pathData);
      }
      
      return {
        id: orbit.id,
        segments,
        color: orbit.color || '#60a5fa',
        isSelected: orbit.id === selectedSatelliteId
      };
    }).filter(Boolean);
  }, [orbitPaths, selectedSatelliteId]);

  const trail = useMemo(() => {
    if (!selectedOrbitPath || selectedOrbitPath.length === 0) return [] as { x: number; y: number; color: string; r: number }[]
    const pts: { x: number; y: number; color: string; r: number }[] = []
    const n = selectedOrbitPath.length
    selectedOrbitPath.forEach((p, i) => {
      const { x, y } = project(((p.lon + 540) % 360) - 180, Math.max(-89.99, Math.min(89.99, p.lat)))
      // gradient green (start) -> yellow -> red (end)
      const t = i / Math.max(1, n - 1)
      const c = t < 0.5
        ? rgb(lerp(0, 255, t * 2), 255, 0) // green -> yellow
        : rgb(255, lerp(255, 0, (t - 0.5) * 2), 0) // yellow -> red
      const r = i === n - 1 ? 4 : 2.5
      pts.push({ x, y, color: c, r })
    })
    return pts
  }, [selectedOrbitPath])

  return (
    <div style={{ width: '100%', background: '#111827', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', margin: '0 auto', background: '#0a1929' }}>
        {/* World map background */}
        {imageIndex < mapSources.length ? (
          <>
            {/* Ocean background */}
            <rect x={0} y={0} width={width} height={height} fill="#0e1621" />
            {/* World map image */}
            <image 
              href={mapSources[imageIndex]} 
              x={0} 
              y={0} 
              width={width} 
              height={height} 
              preserveAspectRatio="xMidYMid slice"
              opacity={0.65}
              onError={() => {
                console.warn(`Map source ${imageIndex} failed to load: ${mapSources[imageIndex]}`);
                const nextIndex = imageIndex + 1;
                if (nextIndex < mapSources.length) {
                  console.log(`Trying fallback ${nextIndex}...`);
                  setImageIndex(nextIndex);
                } else {
                  console.log('All image sources failed, using SVG fallback');
                  setImageIndex(999); // Use SVG fallback
                }
              }}
              onLoad={() => {
                console.log(`✓ World map loaded successfully from source ${imageIndex}`);
              }}
            />
            {/* Subtle darkening overlay for better satellite visibility */}
            <rect x={0} y={0} width={width} height={height} fill="#0a0f1a" opacity={0.3} />
          </>
        ) : (
          <>
            {/* Fallback: embedded SVG world map */}
            <rect x={0} y={0} width={width} height={height} fill="#0e1621" />
            <WorldMapPaths />
          </>
        )}
        {/* Graticule */}
        {gridLines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#3f3a36" strokeWidth={1} opacity={0.7} />
        ))}
        
        {/* Orbit paths */}
        {orbitPathsData.map((orbit: any) => (
          <g key={orbit.id}>
            {orbit.segments.map((segment: string, idx: number) => (
              <path
                key={`${orbit.id}-${idx}`}
                d={segment}
                fill="none"
                stroke={orbit.color}
                strokeWidth={orbit.isSelected ? 2.5 : 1.5}
                strokeOpacity={orbit.isSelected ? 0.9 : 0.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        ))}
        
        {/* Selected satellite trail (green->red) */}
        {trail.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.color} stroke="none" />
        ))}
        {/* Satellites */}
        {points.map(p => (
          <g key={p.id} onClick={() => onSatelliteSelect?.(p.id)} style={{ cursor: 'pointer' }}>
            <circle cx={p.x} cy={p.y} r={p.selected ? 5 : 3.2} fill={p.selected ? '#ffd700' : p.color} />
          </g>
        ))}
        {points.length === 0 && (
          <text x={width/2} y={height/2} fill="#e5e7eb" fontSize="12" textAnchor="middle">No satellites</text>
        )}
      </svg>
    </div>
  );
}


