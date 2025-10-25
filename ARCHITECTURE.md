# 🏗️ System Architecture

This document provides a comprehensive overview of the Satellite Trajectory Monitor's architecture, data flows, and design decisions.

## Table of Contents
- [High-Level Overview](#high-level-overview)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [Orbital Mechanics](#orbital-mechanics)
- [3D Rendering Pipeline](#3d-rendering-pipeline)
- [API Integration](#api-integration)
- [Performance Optimizations](#performance-optimizations)

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Port 5173)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React Application (Vite Dev Server)                  │  │
│  │  ├── Components (Earth3D, TopBar, SpaceWeather)      │  │
│  │  ├── Hooks (useConjunctions, useOrbitPath)           │  │
│  │  ├── Utils (orbit.ts - SGP4 propagation)             │  │
│  │  └── Services (spacetrack.ts - API client)           │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓ HTTP                              │
│                    /api/* requests                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Express Server (Port 5174)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Backend API (server.ts)                              │  │
│  │  ├── Space-Track Authentication (cookie jar)         │  │
│  │  ├── TLE Data Proxy                                  │  │
│  │  ├── CDM Data Proxy                                  │  │
│  │  └── CelesTrak Fallback                              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      External APIs                           │
│  ├── Space-Track.org (CDM, TLE data - requires auth)       │
│  ├── CelesTrak (TLE data - public)                         │
│  └── NASA DONKI (Space weather - public)                   │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Component Hierarchy

```
App.tsx (Root)
├── ErrorBoundary (Error handling wrapper)
├── TopBar (Navigation)
├── Dashboard View
│   ├── Earth3DVisualization (3D Globe)
│   │   ├── Three.js Scene
│   │   ├── OrbitControls
│   │   ├── Satellite Meshes
│   │   ├── Orbit Lines
│   │   └── Conjunction Markers
│   └── Side Panel
│       ├── Tracked Satellites (Add/Remove)
│       ├── Conjunctions Table
│       └── SpaceWeatherMonitor
├── 3D Map View (Full-screen 3D)
├── 2D Map View (Earth2DVisualization)
├── Conjunctions View (Table)
└── Space Weather View (SpaceWeatherMonitor)
```

### Key Components

#### `App.tsx` (1509 lines)
**Purpose**: Main application orchestrator and state manager

**Responsibilities**:
- Manages global state (satellites, conjunctions, space weather, UI state)
- Handles satellite addition (NORAD ID, orbital parameters, conjunction visualization)
- Time simulation (play/pause, speed control, time offset)
- Tab navigation
- Satellite removal and cleanup
- Orbit path management (auto-generated vs user-defined)

**Key State Variables**:
```typescript
satellites: Satellite[]              // All tracked satellites
selectedSatelliteId: string          // Currently selected satellite
userOrbits: OrbitPath[]              // User-defined orbit paths (conjunctions)
cdmData: ConjunctionEvent[]          // Conjunction data from Space-Track
spaceWeatherEvents: SpaceWeatherEvent[]  // NASA DONKI events
simMinutes: number                   // Time simulation offset
simRunning: boolean                  // Playback state
showOrbits: boolean                  // Orbit visibility toggle
```

**Key Functions**:
- `handleConjunctionClick()`: Loads both satellites from a conjunction, generates orbits, fast-forwards to TCA
- `handleAddSatelliteByNorad()`: Fetches TLE data and adds satellite
- `removeSatellite()`: Removes satellite and its orbit paths
- `autoOrbitPaths` (memoized): Auto-generates orbit paths for first 8 satellites (excludes user-defined)
- `simOrbitPaths` (memoized): Generates orbit paths around simulated time

#### `Earth3DVisualization.tsx` (354 lines)
**Purpose**: 3D interactive globe using Three.js

**Technologies**:
- Three.js for 3D rendering
- OrbitControls for camera manipulation
- WebGL for hardware-accelerated graphics

**Rendering Pipeline**:
1. **Scene Setup**: Creates scene, camera, renderer
2. **Earth Mesh**: Loads NASA Blue Marble textures
3. **Cloud Layer**: Semi-transparent cloud mesh
4. **Stars**: Particle system for background stars
5. **Satellites**: Dynamic sphere meshes positioned using geodetic coordinates
6. **Orbits**: Line geometries traced from TLE propagation
7. **Conjunction Markers**: Special markers at TCA locations
8. **Affected Areas**: Auroral cap meshes for space weather visualization

**Coordinate System**:
- Input: Geodetic (lat, lon, altKm)
- Conversion: `(lat, lon, altKm) → (x, y, z)` in Earth-centered Cartesian
- Earth radius: 6371 km (normalized to 1.0 in Three.js units)

**Performance**:
- 60 FPS target
- Memoized orbit paths (only recompute when satellites change)
- Geometry disposal on cleanup to prevent memory leaks

#### `Earth2DVisualization.tsx` (105 lines)
**Purpose**: Lightweight 2D fallback view

**Projection**: Equirectangular (Plate Carrée)
```
x = ((lon + 180) / 360) * width
y = ((90 - lat) / 180) * height
```

**Features**:
- World map background with graticule
- Satellite markers
- Selected satellite trail (green → yellow → red gradient)
- Click to select satellites

#### `SpaceWeatherMonitor.tsx` (202 lines)
**Purpose**: Real-time space weather integration

**Data Sources**:
- CME (Coronal Mass Ejections)
- FLR (Solar Flares)
- GST (Geomagnetic Storms)

**Update Frequency**: Every 5 minutes (300000ms interval)

**Event Processing**:
1. Fetch data from NASA DONKI (last 7 days)
2. Parse and normalize event structure
3. Calculate severity (Low/Medium/High/Critical)
4. Emit high-severity events to parent component
5. Display in scrollable list with icons

**Severity Calculation**:
- **CME**: Speed > 1000 km/s = High, else Medium
- **Solar Flare**: X-class = High, M-class = Medium, C-class = Low
- **Geomagnetic Storm**: Kp > 7 = High, Kp > 5 = Medium, else Low

### Hooks

#### `useConjunctions.ts` (87 lines)
**Purpose**: Fetches conjunction data from Space-Track

**Usage**:
```typescript
const { data, loading, error } = useConjunctions('now-3'); // Last 3 days
```

**Flow**:
1. Attempts multiple endpoint URLs (ordered by priority)
2. Parses CDM data into normalized format
3. Extracts object names, NORAD IDs, miss distance, relative speed, TCA
4. Handles various data formats from Space-Track API

#### `useOrbitPath.ts` (15 lines)
**Purpose**: Memoizes orbit path generation

**Usage**:
```typescript
const path = useOrbitPath(tle1, tle2, minutesAhead, stepMinutes);
```

**Optimization**: Only recomputes when TLE lines change

#### `useRealTimeUpdates.ts` (146 lines)
**Purpose**: Simulates real-time satellite position updates (currently unused but available for future enhancements)

## Backend Architecture

### `server.ts` (332 lines)

**Purpose**: Express API server with Space-Track authentication proxy

**Key Features**:
1. **Cookie-based Authentication**: Persists Space-Track login session
2. **TLE Data Proxy**: Fetches TLE data securely
3. **CDM Proxy**: Returns conjunction data
4. **CelesTrak Fallback**: If Space-Track fails, uses CelesTrak

**Endpoints**:

```typescript
GET /api/health
// Health check endpoint
// Response: { status: 'ok', timestamp: '...' }

GET /api/tle/satellite/:noradId
// Fetch TLE for specific satellite
// Example: /api/tle/satellite/25544
// Response: "0 ISS (ZARYA)\n1 25544U...\n2 25544..."

GET /api/tle/group/:groupName
// Fetch TLEs for satellite group
// Example: /api/tle/group/stations?limit=12
// Response: [{ OBJECT_NAME, NORAD_CAT_ID, TLE_LINE1, TLE_LINE2 }]

GET /api/conjunctions?range=now-3
// Fetch conjunction data (last 3 days)
// Response: [{ object1Name, object2Name, missDistanceKm, tca, ... }]

GET /api/spacetrack/conjunctions?TCA=now-3
// Direct Space-Track CDM proxy
// Requires authentication (handled server-side)
```

**Authentication Flow**:
```
1. Client requests /api/tle/satellite/25544
2. Server checks if authenticated (cookie jar)
3. If not authenticated:
   a. POST to space-track.org/ajaxauth/login
   b. Store session cookie
4. Make authenticated request to Space-Track
5. Return data to client
```

**Error Handling**:
- Automatic retry with exponential backoff
- Fallback to CelesTrak if Space-Track fails
- Timeout handling (15 seconds default)
- Detailed error messages for debugging

## Data Flow

### Satellite Addition Flow

```
User enters NORAD ID "25544" → Click "Add Satellite"
    ↓
handleAddSatelliteByNorad()
    ↓
fetch('/api/tle/satellite/25544')
    ↓
Backend: authenticate with Space-Track → fetch TLE
    ↓
Parse TLE lines (line1, line2)
    ↓
Extract orbital parameters:
    - Inclination
    - RAAN (Right Ascension of Ascending Node)
    - Eccentricity
    - Argument of Perigee
    - Mean Anomaly
    - Mean Motion
    ↓
Create Satellite object with TLE + orbital params
    ↓
setSatellites([...prev, newSatellite])
    ↓
generateOrbitPath(tle1, tle2) using satellite.js
    ↓
setUserOrbits([...prev, { id, path, color }])
    ↓
React re-renders → Earth3DVisualization updates
```

### Conjunction Visualization Flow

```
User clicks conjunction row in table
    ↓
handleConjunctionClick(conjunction)
    ↓
Extract object1 and object2 NORAD IDs
    ↓
Fetch TLEs for both satellites (parallel)
    ↓
Add both satellites to state
    ↓
Generate full orbit paths (360° propagation)
    ↓
Add orbit paths with distinct colors:
    - Object 1: Red (#ef4444)
    - Object 2: Orange (#f59e0b)
    ↓
Extract TCA (Time of Closest Approach)
    ↓
Calculate minutes until TCA
    ↓
setSimMinutes(minutesUntilTCA) → Fast-forward
    ↓
Calculate positions at TCA using geodeticFromTLEAt()
    ↓
Create conjunction marker at TCA position
    ↓
Switch to 3D view + zoom camera to conjunction point
```

### Space Weather Impact Flow

```
SpaceWeatherMonitor fetches NASA DONKI data
    ↓
User clicks Geomagnetic Storm event
    ↓
handleEventSelect(event)
    ↓
Extract Kp Index from event.impact
    ↓
Calculate auroral boundary latitude:
    latThreshold = 67 - 0.9 * kpIndex
    ↓
Filter satellites with |latitude| >= latThreshold
    ↓
setAffectedSatIds(Set of affected satellite IDs)
    ↓
setShowAffected(true)
    ↓
Render affected area (auroral caps) on 3D globe
    ↓
Highlight affected satellites in red
```

## State Management

### Global State (in App.tsx)

```typescript
// Core data
const [satellites, setSatellites] = useState<Satellite[]>([])
const [userOrbits, setUserOrbits] = useState<OrbitPath[]>([])
const [selectedSatelliteId, setSelectedSatelliteId] = useState<string>()

// Space weather
const [spaceWeatherEvents, setSpaceWeatherEvents] = useState<SpaceWeatherEvent[]>([])
const [kpIndex, setKpIndex] = useState<number>(0)
const [affectedSatIds, setAffectedSatIds] = useState<Set<string>>(new Set())

// Time simulation
const [simMinutes, setSimMinutes] = useState<number>(0)
const [simRunning, setSimRunning] = useState<boolean>(false)
const [simSpeed, setSimSpeed] = useState<number>(5) // minutes/second

// UI state
const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
const [showOrbits, setShowOrbits] = useState<boolean>(true)
const [sidePanelTab, setSidePanelTab] = useState<'tracked' | 'myconj' | 'weather'>('tracked')
```

### Computed State (Memoized)

```typescript
// Auto-generated orbit paths (first 8 satellites, excluding user-defined)
const autoOrbitPaths = useMemo(() => {
  const userOrbitIds = new Set(userOrbits.map(o => o.id))
  return satellites
    .filter(s => s.tle1 && s.tle2 && !userOrbitIds.has(s.id))
    .slice(0, 8)
    .map(s => ({ id: s.id, path: generateOrbitPath(s.tle1, s.tle2), color: ... }))
}, [satellites, selectedSatelliteId, userOrbits])

// Simulated orbit paths around simDate
const simOrbitPaths = useMemo(() => {
  // ... generates orbits at simDate ± 180 minutes
}, [satellites, selectedSatelliteId, simDate, userOrbits])

// Simulated satellite positions
const simulatedSatellitePositions = useMemo(() => {
  return satellites.map(s => geodeticFromTLEAt(s.tle1, s.tle2, simDate))
}, [satellites, simDate, simRunning, simMinutes])
```

### Why User Orbits vs Auto Orbits?

**Problem**: Duplicate orbit rendering
- `autoOrbitPaths` generates orbits for all satellites automatically
- Conjunction-added satellites need custom colors (red/orange)
- Without separation, satellites would have 2 orbits (auto + user)

**Solution**: Two-tier orbit system
1. **Auto Orbits**: Generated for first 8 satellites (excluding user-defined)
2. **User Orbits**: Explicitly added with custom colors

**Benefit**:
- Conjunction orbits have distinct colors
- No duplication
- Performance: Only 8 auto orbits max
- When removing satellite, both orbit sources update correctly

## Orbital Mechanics

### TLE (Two-Line Element) Format

```
0 ISS (ZARYA)                        ← Line 0: Name (optional)
1 25544U 98067A   24300.54791667    ← Line 1: Orbital elements
2 25544  51.6440  31.7492 0009013   ← Line 2: More elements
```

**Line 1 Fields**:
- Catalog number (25544)
- Epoch year and day (24300.54791667 = Oct 26, 2024)
- Ballistic coefficient
- Drag term

**Line 2 Fields**:
- Inclination (51.6440°)
- RAAN - Right Ascension of Ascending Node (31.7492°)
- Eccentricity (0.0009013)
- Argument of Perigee (77.5070°)
- Mean Anomaly (282.6464°)
- Mean Motion (15.50008891 rev/day)

### SGP4/SDP4 Propagation

The `satellite.js` library implements SGP4 (Simplified General Perturbations 4) for near-Earth satellites and SDP4 for deep-space objects.

**Algorithm**:
1. Parse TLE into satellite record
2. Initialize SGP4 model with orbital elements
3. Propagate to target time (minutes since epoch)
4. Output: ECI (Earth-Centered Inertial) coordinates
5. Convert ECI → ECEF (Earth-Centered Earth-Fixed)
6. Convert ECEF → Geodetic (lat, lon, alt)

**Code Flow** (`orbit.ts`):
```typescript
function currentGeodeticFromTLE(tle1: string, tle2: string): { lat, lon, altKm } {
  const satrec = satellite.twoline2satrec(tle1, tle2)
  const now = new Date()
  const positionAndVelocity = satellite.propagate(satrec, now)
  const positionEci = positionAndVelocity.position
  const gmst = satellite.gstime(now)
  const positionGd = satellite.eciToGeodetic(positionEci, gmst)
  return {
    lat: satellite.degreesLat(positionGd.latitude),
    lon: satellite.degreesLong(positionGd.longitude),
    altKm: positionGd.height
  }
}
```

### Orbit Path Generation

```typescript
function generateOrbitPath(tle1: string, tle2: string, minutesAhead = 120, stepMinutes = 2) {
  const path = []
  const satrec = satellite.twoline2satrec(tle1, tle2)
  
  for (let m = 0; m <= minutesAhead; m += stepMinutes) {
    const futureDate = new Date(Date.now() + m * 60000)
    const posVel = satellite.propagate(satrec, futureDate)
    // ... convert to geodetic ...
    path.push({ lat, lon, altKm })
  }
  
  return path
}
```

**Default Parameters**:
- `minutesAhead = 120`: 2 hours into future
- `stepMinutes = 2`: One point every 2 minutes
- Result: ~60 points per orbit path

## 3D Rendering Pipeline

### Three.js Scene Graph

```
Scene
├── Earth Mesh (radius: 1.0)
│   └── MeshPhongMaterial (Blue Marble texture)
├── Clouds Mesh (radius: 1.02)
│   └── MeshLambertMaterial (clouds texture, opacity: 0.5)
├── Star Field (Points, radius: 40-50)
├── Satellite Group (dynamic)
│   └── Satellite Meshes (SphereGeometry, radius: 0.065)
├── Orbit Group (dynamic)
│   └── Orbit Lines (BufferGeometry, LineBasicMaterial)
├── Link Group (dynamic)
│   └── Conjunction Links (Line between two satellites)
├── Area Group (dynamic)
│   └── Auroral Caps (Mesh, semi-transparent)
└── Conjunction Group (dynamic)
    └── Conjunction Marker (Sphere, pink color)
```

### Rendering Loop

```typescript
function animate() {
  if (autoRotate) {
    earth.rotation.y += 0.0035  // Slow rotation
    clouds.rotation.y += 0.0045 // Faster clouds
  }
  controls.update()             // Update camera controls
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
```

**Frame Rate**: 60 FPS target (16.67ms per frame)

### Coordinate Conversion

```typescript
// Geodetic to Cartesian (for Three.js)
function geodeticToCartesian(lat, lon, altKm) {
  const R = 6371 // Earth radius in km
  const latRad = lat * Math.PI / 180
  const lonRad = lon * Math.PI / 180
  const r = 1 + altKm / R  // Normalize to Earth radius = 1.0
  
  const x = r * Math.cos(latRad) * Math.cos(lonRad)
  const y = r * Math.sin(latRad)
  const z = r * Math.cos(latRad) * Math.sin(lonRad)
  
  return { x, y, z }
}
```

### Performance Optimizations

1. **Geometry Reuse**: Satellites use shared SphereGeometry
2. **Material Pooling**: Limited material instances
3. **Frustum Culling**: Three.js automatically culls off-screen objects
4. **LOD (Level of Detail)**: Could be added for distant satellites
5. **Orbit Path Limit**: Max 8 auto-generated orbits
6. **Memoization**: Orbits only recompute when satellites change
7. **Dispose on Unmount**: Prevents memory leaks

## API Integration

### Space-Track.org

**Base URL**: `https://www.space-track.org`

**Authentication**:
```http
POST /ajaxauth/login
Content-Type: application/x-www-form-urlencoded

identity=username&password=password
```

**Response**: Set-Cookie header with session token

**TLE Query**:
```http
GET /basicspacedata/query/class/tle_latest/NORAD_CAT_ID/25544/format/tle
Cookie: <session cookie>
```

**CDM Query**:
```http
GET /basicspacedata/query/class/cdm_public/TCA/>now-3/orderby/TCA desc/format/json
Cookie: <session cookie>
```

**Rate Limits**:
- 30 requests per minute per user
- Backend caches authenticated session

### CelesTrak

**Base URL**: `https://celestrak.org`

**TLE Groups**:
```
GET /NORAD/elements/gp.php?GROUP=stations&FORMAT=tle
GET /NORAD/elements/gp.php?GROUP=active&FORMAT=tle
```

**Single Satellite**:
```
GET /NORAD/elements/gp.php?CATNR=25544&FORMAT=tle
```

**No Authentication Required**: Public data

### NASA DONKI

**Base URL**: `https://kauai.ccmc.gsfc.nasa.gov`

**Endpoints**:
```
GET /DONKI/WS/get/CME?startDate=2024-10-20&endDate=2024-10-27
GET /DONKI/WS/get/FLR?startDate=2024-10-20&endDate=2024-10-27
GET /DONKI/WS/get/GST?startDate=2024-10-20&endDate=2024-10-27
```

**No Authentication Required**: Public data

## Performance Optimizations

### Frontend

1. **React.memo**: Memoize expensive components
2. **useMemo**: Cache computed values (orbit paths, positions)
3. **useCallback**: Prevent function recreation
4. **Lazy Loading**: Could load 3D visualization on-demand
5. **Virtual Scrolling**: For large satellite lists (not yet implemented)
6. **Debouncing**: Input handlers (e.g., search)

### Backend

1. **Cookie Jar**: Persist Space-Track session (avoid re-authentication)
2. **Request Timeout**: 15-second limit prevents hanging
3. **Abort Controller**: Cancel pending requests
4. **Response Caching**: Could cache TLE data (expires after 24h)
5. **Connection Pooling**: axios reuses HTTP connections

### 3D Rendering

1. **Orbit Path Limit**: Max 8 auto paths + user paths
2. **Point Reduction**: 2-minute steps (not 1-second)
3. **Material Sharing**: Reuse materials across satellites
4. **Geometry Disposal**: Clean up on component unmount
5. **requestAnimationFrame**: Sync with browser refresh rate

### Memory Management

1. **Cleanup Effects**: useEffect returns cleanup functions
2. **Dispose Geometries**: Explicit `.dispose()` calls
3. **Remove Event Listeners**: Clean up on unmount
4. **Cancel Intervals**: Clear setInterval/setTimeout
5. **Abort Fetches**: Cancel in-flight requests

---

## Design Decisions & Rationale

### Why Express Backend?

**Problem**: Space-Track requires authentication, credentials can't be exposed in browser

**Solution**: Express proxy server handles authentication server-side

**Alternative Considered**: Direct browser requests to Space-Track
**Rejected Because**: Would expose credentials in client code

### Why Two Orbit Systems (Auto + User)?

**Problem**: Conjunction orbits need custom colors, but all satellites need orbits

**Solution**: Auto-generate orbits for general satellites, user-defined for special cases

**Benefit**: No duplication, custom styling, better performance

### Why satellite.js Instead of Custom SGP4?

**Reason**: Mature, tested, widely-used library (official Celestrak implementation)

**Alternative**: Implement SGP4 from scratch
**Rejected**: Complex algorithm, high risk of bugs, reinventing wheel

### Why Three.js Instead of Canvas 2D?

**Reason**: Hardware-accelerated WebGL, true 3D perspective, better performance

**Alternative**: HTML5 Canvas 2D
**Benefit**: 60 FPS with many satellites, realistic globe

### Why Vite Instead of Create React App?

**Reason**: Faster dev server, faster builds, modern tooling, better HMR

**Performance**: 
- CRA: ~5-10s cold start
- Vite: <1s cold start

---

**Next Steps**: See [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) for detailed API reference and [`FILE_GUIDE.md`](./FILE_GUIDE.md) for file-by-file explanations.

