# 📁 File Guide

Complete guide to every file in the Satellite Trajectory Monitor project. Each section explains the purpose, key functions, dependencies, and how the file fits into the overall system.

## Table of Contents
- [Root Configuration Files](#root-configuration-files)
- [Backend](#backend)
- [Frontend Source](#frontend-source)
  - [Main Entry](#main-entry)
  - [Components](#components)
  - [Hooks](#hooks)
  - [Services](#services)
  - [Utils](#utils)
  - [Types](#types)

---

## Root Configuration Files

### `package.json`
**Purpose**: Project metadata and dependency management

**Key Dependencies**:
- **Production**:
  - `react` (18.2) - UI framework
  - `three` (0.159) - 3D rendering engine
  - `@react-three/fiber` - React bindings for Three.js
  - `@react-three/drei` - Three.js helpers
  - `satellite.js` (4.1) - SGP4/SDP4 orbit propagation
  - `express` (4.19) - Backend server
  - `axios` (1.7) - HTTP client
  - `axios-cookiejar-support` - Cookie jar for axios
  - `tough-cookie` - Cookie parsing/storage
  - `dotenv` - Environment variable loading

- **Development**:
  - `typescript` (5.2) - Type safety
  - `vite` (5.0) - Build tool and dev server
  - `@vitejs/plugin-react` - React support for Vite
  - `tsx` - TypeScript execution for backend
  - `concurrently` - Run multiple commands simultaneously
  - `cross-env` - Cross-platform env vars

**Scripts**:
```bash
npm run dev            # Frontend only (port 5173)
npm run dev:server     # Backend only (port 5174)
npm run dev:all        # Both frontend + backend
npm run build          # Production build
npm run preview        # Preview production build
npm run lint           # ESLint
```

---

### `vite.config.ts`
**Purpose**: Vite configuration for development and production builds

**Key Configuration**:
```typescript
{
  plugins: [react()],           // React support
  server: {
    port: 3000,                 // Dev server port
    host: true,                 // Expose to network
    proxy: {
      '/api/spacetrack': 'http://localhost:5174',
      '/api/conjunctions': 'http://localhost:5174',
      '/api/health': 'http://localhost:5174',
      '/api/tle': 'http://localhost:5174',
      '/api/celestrak': 'http://localhost:5174',
      '/api/donki': 'https://kauai.ccmc.gsfc.nasa.gov',
      '/api/n2yo': 'https://api.n2yo.com'
    }
  },
  build: {
    outDir: 'dist',             // Output directory
    sourcemap: true             // Generate source maps
  }
}
```

**Why This Matters**:
- Dev proxy forwards `/api/*` requests to backend
- Avoids CORS issues during development
- Enables hot module replacement (HMR)

---

### `tsconfig.json`
**Purpose**: TypeScript compiler configuration

**Key Settings**:
- `target: "ES2020"` - Modern JavaScript features
- `lib: ["ES2020", "DOM"]` - Browser APIs + modern JS
- `jsx: "react-jsx"` - React 17+ JSX transform
- `module: "ESNext"` - Modern module system
- `moduleResolution: "bundler"` - Vite-compatible resolution
- `strict: true` - Strict type checking
- `skipLibCheck: true` - Skip checking node_modules types (faster builds)

---

### `tsconfig.node.json`
**Purpose**: TypeScript config for Node.js files (e.g., vite.config.ts)

**Extends**: tsconfig.json

**Differences**:
- `module: "ESNext"` - Node.js module system
- `moduleResolution: "bundler"` - Bundler-compatible resolution

---

### `.env` (not in repo)
**Purpose**: Backend environment variables

**Required Variables**:
```env
SPACETRACK_USER=your_username
SPACETRACK_PASS=your_password
PORT=5174
```

**Security**: 
- Never commit to version control
- Backend only (frontend never accesses)
- Use `.gitignore` to exclude

---

### `README.md`
**Purpose**: Project overview and quick start guide

**Sections**:
- Features
- Quick start
- Installation
- Configuration
- Usage guide
- Troubleshooting

---

### `API_SETUP.md`
**Purpose**: Detailed API configuration and authentication

**Contents**:
- Space-Track.org registration
- Environment variable setup
- Endpoint documentation
- Troubleshooting auth issues

---

### `ARCHITECTURE.md`
**Purpose**: System architecture and design decisions

**Contents**:
- High-level overview
- Component hierarchy
- Data flow diagrams
- State management
- Orbital mechanics
- 3D rendering pipeline
- Performance optimizations

---

### `API_DOCUMENTATION.md`
**Purpose**: Complete API reference

**Contents**:
- Backend endpoint specifications
- Request/response formats
- Data models
- Error handling
- Rate limits
- Usage examples

---

## Backend

### `backend/server.ts` (332 lines)
**Purpose**: Express server with Space-Track authentication and API proxying

**Key Features**:
1. **Space-Track Authentication**:
   ```typescript
   const jar = new CookieJar()
   const client = axios.create({ jar })
   
   async function ensureAuth() {
     // Check if already authenticated
     // If not, POST to /ajaxauth/login
     // Store session cookie in jar
   }
   ```

2. **TLE Endpoints**:
   - `GET /api/tle/satellite/:noradId` - Single satellite TLE
   - `GET /api/tle/group/:groupName` - Group TLE data

3. **Conjunction Endpoints**:
   - `GET /api/conjunctions` - Normalized CDM data
   - `GET /api/spacetrack/conjunctions` - Raw Space-Track CDM

4. **Health Check**:
   - `GET /api/health` - Server status

**Dependencies**:
- `express` - Web framework
- `axios` - HTTP client
- `axios-cookiejar-support` - Cookie persistence
- `tough-cookie` - Cookie parsing
- `dotenv` - Environment variables
- `qs` - Query string parsing

**Error Handling**:
- Automatic retry with exponential backoff
- Timeout handling (15 seconds)
- CelesTrak fallback if Space-Track fails
- Detailed error messages

**Why Cookie Jar?**:
- Space-Track uses cookie-based sessions
- Cookie jar persists session across requests
- Avoids re-authentication on every request
- Improves performance (30 req/min limit)

---

## Frontend Source

### Main Entry

#### `src/main.tsx` (16 lines)
**Purpose**: React application entry point

**What It Does**:
```typescript
import ReactDOM from 'react-dom/client'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App'

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <ErrorBoundary fullScreen>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
```

**Why StrictMode?**:
- Detects potential problems in development
- Double-invokes effects to catch side effects
- Warns about deprecated APIs
- No impact in production

**Why ErrorBoundary?**:
- Catches unhandled errors in React tree
- Prevents white screen of death
- Shows user-friendly error message

---

#### `src/App.tsx` (1509 lines)
**Purpose**: Main application orchestrator and state manager

**Sections**:
1. **State Management** (lines 44-82):
   ```typescript
   const [satellites, setSatellites] = useState<Satellite[]>([])
   const [userOrbits, setUserOrbits] = useState<OrbitPath[]>([])
   const [selectedSatelliteId, setSelectedSatelliteId] = useState<string>()
   const [simMinutes, setSimMinutes] = useState<number>(0)
   const [simRunning, setSimRunning] = useState<boolean>(false)
   const [showOrbits, setShowOrbits] = useState<boolean>(true)
   // ... many more state variables
   ```

2. **Time Simulation** (lines 94-112):
   - `requestAnimationFrame` loop
   - Smooth playback at user-defined speed
   - Updates satellite positions in real-time

3. **Memoized Computed Values**:
   - `simDate` (line 112): Current simulated time
   - `simulatedSatellitePositions` (lines 115-160): Positions at simDate
   - `simOrbitPaths` (lines 163-206): Orbit paths around simDate
   - `autoOrbitPaths` (lines 792-799): Auto-generated orbits (excludes user orbits)

4. **Satellite Management**:
   - `handleAddSatelliteByNorad()` (lines 680-793): Add by NORAD ID
   - `removeSatellite()` (lines 244-254): Remove satellite and orbits
   - `handleConjunctionClick()` (lines 481-678): Visualize conjunction

5. **Space Weather Integration**:
   - `handleThreatDetected()` (lines 422-430): Process space weather events
   - `handleEventSelect()` (lines 433-475): Highlight affected satellites

6. **Render Tree** (lines 949-1503):
   - TopBar (navigation)
   - Status bar
   - Dashboard view (3D globe + side panel)
   - 3D Map view (full-screen)
   - 2D Map view
   - Conjunctions table
   - Space Weather view

**Key Functions**:

##### `removeSatellite(id: string)`
```typescript
const removeSatellite = (id: string) => {
  setSatellites(prev => prev.filter(s => s.id !== id))
  setUserOrbits(prev => prev.filter(p => p.id !== id))
  if (selectedSatelliteId === id) setSelectedSatelliteId(undefined)
  
  // Clear conjunction marker if no satellites left
  const remaining = satellites.filter(s => s.id !== id)
  if (remaining.length === 0) {
    setConjunctionPoint(null)
  }
}
```

##### `handleConjunctionClick(conjunction)`
**Flow**:
1. Extract NORAD IDs for both objects
2. Fetch TLEs in parallel
3. Parse TLE data
4. Create Satellite objects
5. Add to `satellites` state
6. Generate full orbit paths
7. Add to `userOrbits` with custom colors (red/orange)
8. Extract TCA timestamp
9. Calculate minutes until TCA
10. Fast-forward simulation to TCA
11. Calculate positions at TCA
12. Create conjunction marker
13. Switch to 3D view
14. Zoom camera to conjunction point

**Why Complex?**:
- Needs to handle missing data
- Must coordinate multiple async operations
- Updates multiple state variables atomically
- Provides smooth user experience

---

### Components

#### `src/components/TopBar.tsx` (43 lines)
**Purpose**: Navigation tab bar

**Props**:
```typescript
{
  active: TabKey                // Current active tab
  onChange: (k: TabKey) => void // Tab change handler
}
```

**Tabs**:
- Dashboard
- 3D Map
- 2D Map
- Conjunctions
- Space Weather
- Settings (placeholder)

**Styling**: SpaceX-inspired dark theme with blue accents

---

#### `src/components/ErrorBoundary.tsx` (93 lines)
**Purpose**: React error boundary for graceful error handling

**Features**:
- Catches unhandled errors in component tree
- Two display modes:
  - **Full Screen**: For root-level errors
  - **Inline**: For component-level errors
- Shows error details (expandable)
- "Refresh Page" button
- Calls optional `onError` callback

**Usage**:
```typescript
<ErrorBoundary fullScreen>
  <App />
</ErrorBoundary>

<ErrorBoundary onError={(e) => console.log('3D error:', e.message)}>
  <Earth3DVisualization />
</ErrorBoundary>
```

**Why?**:
- Prevents entire app crash from single component error
- User sees friendly message instead of white screen
- Development: Shows stack trace for debugging

---

#### `src/components/Earth3DVisualization.tsx` (354 lines)
**Purpose**: Interactive 3D globe using Three.js

**Props**:
```typescript
{
  liveSatellites?: LiveSat[]        // Satellite positions
  orbitPaths?: OrbitPath[]          // Orbit lines
  links?: Link[]                    // Links between satellites
  autoRotate?: boolean              // Auto-rotate globe
  onSelectSatellite?: (id: string) => void
  affectedArea?: AffectedArea       // Space weather visualization
  conjunctionPoint?: ConjunctionPoint | null
}
```

**Initialization** (useEffect, lines 27-183):
1. WebGL capability check
2. Create Three.js scene
3. Setup camera (PerspectiveCamera, FOV 50°)
4. Create WebGL renderer
5. Load Earth textures (Blue Marble, specular map)
6. Create Earth mesh (radius: 1.0)
7. Create cloud layer (radius: 1.02, semi-transparent)
8. Generate star field (500 particles, radius: 40-50)
9. Setup lights (ambient + directional)
10. Create OrbitControls (drag, zoom)
11. Create render groups (satellites, orbits, links, areas, conjunctions)
12. Add click handler (raycasting for satellite selection)
13. Start animation loop
14. Setup resize handler
15. Return cleanup function

**Content Rendering** (useEffect, lines 186-298):
- Triggered when props change
- Clears previous content
- Converts geodetic to Cartesian coordinates
- Creates satellite meshes (SphereGeometry, radius: 0.065)
- Creates orbit lines (BufferGeometry, LineBasicMaterial)
- Creates conjunction links
- Renders affected areas (auroral caps)

**Conjunction Marker Rendering** (useEffect, lines 301-350):
- Separate effect for conjunction points
- Creates small pink sphere at TCA location
- Zooms camera to conjunction point
- Triggered when `conjunctionPoint` prop changes

**Coordinate Conversion**:
```typescript
// Geodetic (lat, lon, altKm) → Cartesian (x, y, z)
const lat = THREE.MathUtils.degToRad(latitude)
const lon = THREE.MathUtils.degToRad(longitude)
const r = 1 + altKm / 6371  // Normalize to Earth radius

const x = r * Math.cos(lat) * Math.cos(lon)
const y = r * Math.sin(lat)
const z = r * Math.cos(lat) * Math.sin(lon)
```

**Performance Optimizations**:
- Geometry disposal on cleanup
- Material reuse
- Memoized orbit paths (parent component)
- Limited number of orbits (8 auto + user-defined)
- `depthWrite: false` for transparent objects

**Why Three.js?**:
- Hardware-accelerated WebGL
- 60 FPS with many objects
- Rich ecosystem (OrbitControls, loaders, helpers)
- Realistic 3D perspective
- Large community and documentation

---

#### `src/components/Earth2DVisualization.tsx` (105 lines)
**Purpose**: Lightweight 2D map fallback

**Props**:
```typescript
{
  satellites: Satellite[]
  selectedSatelliteId?: string
  onSatelliteSelect?: (id: string) => void
  selectedOrbitPath?: OrbitPoint[]
}
```

**Features**:
1. **Equirectangular Projection**:
   ```typescript
   function project(lon, lat) {
     const x = ((lon + 180) / 360) * width
     const y = ((90 - lat) / 180) * height
     return { x, y }
   }
   ```

2. **World Map Background**:
   - Low-res atlas image
   - Brown tint overlay for vintage look

3. **Graticule** (grid lines):
   - Longitude lines every 20°
   - Latitude lines every 20°

4. **Satellite Markers**:
   - Circle at projected position
   - Selected satellite highlighted (gold)
   - Click to select

5. **Orbit Trail** (for selected satellite):
   - Gradient: green (start) → yellow → red (end)
   - Larger circle at end point

**Why 2D?**:
- Fallback for systems without WebGL
- Lower resource usage
- Simpler implementation
- Still functional for tracking

---

#### `src/components/SpaceWeatherMonitor.tsx` (202 lines)
**Purpose**: Real-time space weather integration with NASA DONKI

**Props**:
```typescript
{
  onThreatDetected?: (event: SpaceWeatherEvent) => void
  onEventSelect?: (event: SpaceWeatherEvent) => void
}
```

**State**:
```typescript
const [events, setEvents] = useState<SpaceWeatherEvent[]>([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

**Data Fetching** (`fetchSpaceWeatherEvents`, lines 25-120):
1. Calculate date range (last 7 days)
2. Fetch from NASA DONKI (parallel):
   - CME (Coronal Mass Ejections)
   - FLR (Solar Flares)
   - GST (Geomagnetic Storms)
3. Parse and normalize events
4. Calculate severity:
   - **CME**: Speed > 1000 km/s = High
   - **Flare**: X-class = High, M-class = Medium
   - **Storm**: Kp > 7 = High, Kp > 5 = Medium
5. Emit high-severity events via `onThreatDetected`
6. If API fails, show mock data (for demo)

**Update Frequency**: Every 5 minutes (300000ms)

**Display** (lines 148-201):
- Scrollable event list (max height: 300px)
- Event cards with:
  - Icon (based on type)
  - Title
  - Severity badge (color-coded)
  - Description
  - Impact details
  - Timestamp
- Click to select (triggers `onEventSelect`)
- Data sources footer

**Event Processing Examples**:

**CME**:
```typescript
{
  type: 'CME',
  title: 'Coronal Mass Ejection',
  severity: speed > 1000 ? 'High' : 'Medium',
  impact: `Speed: ${speed} km/s`,
  source: cme  // Raw DONKI data
}
```

**Solar Flare**:
```typescript
{
  type: 'Solar Flare',
  title: `Solar Flare ${classType}`,
  severity: classType.includes('X') ? 'High' : 'Medium',
  impact: `Class: ${classType}`
}
```

**Geomagnetic Storm**:
```typescript
{
  type: 'Geomagnetic Storm',
  severity: kp > 7 ? 'High' : kp > 5 ? 'Medium' : 'Low',
  impact: `Kp Index: ${kp}`
}
```

**Why NASA DONKI?**:
- Official NASA space weather data
- Public API (no auth required)
- Comprehensive event coverage
- Real-time updates
- Well-documented

---

### Hooks

#### `src/hooks/useConjunctions.ts` (87 lines)
**Purpose**: Fetch and normalize conjunction data from Space-Track

**Signature**:
```typescript
function useConjunctions(range: string): {
  data: CdmItem[] | null
  loading: boolean
  error: string | null
}
```

**Parameters**:
- `range`: Time range for TCA (e.g., "now-3" for last 3 days)

**Implementation**:
```typescript
useEffect(() => {
  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await spacetrack.fetchConjunctions()
      setData(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  
  fetchData()
  const interval = setInterval(fetchData, 300000) // Every 5 minutes
  return () => clearInterval(interval)
}, [range])
```

**Normalization** (in spacetrack.ts):
- Handles various field names (OBJECT1_NAME, OBJECT1, object1Name)
- Converts units (meters → km, m/s → km/s)
- Extracts NORAD IDs from mixed-format fields
- Parses timestamps to ISO 8601

**Why Hook?**:
- Encapsulates data fetching logic
- Automatic refresh
- Reusable across components
- Clean separation of concerns

---

#### `src/hooks/useOrbitPath.ts` (15 lines)
**Purpose**: Memoize orbit path generation

**Signature**:
```typescript
function useOrbitPath(
  tle1?: string,
  tle2?: string,
  minutesAhead: number = 120,
  stepMinutes: number = 2
): OrbitPoint[] | null
```

**Implementation**:
```typescript
return useMemo(() => {
  if (!tle1 || !tle2) return null
  try {
    return generateOrbitPath(tle1, tle2, minutesAhead, stepMinutes)
  } catch {
    return null
  }
}, [tle1, tle2, minutesAhead, stepMinutes])
```

**Why Memoize?**:
- Orbit generation is expensive (SGP4 propagation)
- Only recompute when TLE changes
- Prevents unnecessary re-renders
- Improves performance

---

#### `src/hooks/useRealTimeUpdates.ts` (146 lines)
**Purpose**: Simulate real-time satellite position updates (currently unused)

**Features**:
- Position updates every 10 seconds
- Orbital motion simulation using Keplerian elements
- Occasional random action suggestions
- WebSocket simulation (for future enhancements)
- Space weather listener

**Why Unused?**:
- Current implementation uses direct TLE propagation in App.tsx
- More accurate than Keplerian approximation
- Kept for potential future use or testing

---

### Services

#### `src/services/spacetrack.ts` (114 lines)
**Purpose**: Space-Track API client with CDM normalization

**Key Functions**:

##### `fetchConjunctions(): Promise<CdmItem[]>`
**Flow**:
1. Try multiple endpoint URLs (priority order):
   - `/api/conjunctions?range=now-3`
   - `/api/spacetrack/conjunctions?range=now-3`
   - `/api/conjunctions?range=now-7`
   - `/api/spacetrack/conjunctions?range=now-7`
2. For each URL, attempt fetch with timeout
3. If successful, normalize data and return
4. If all fail, return empty array

##### `normalizeCdmItem(d: any): CdmItem`
**Purpose**: Convert raw CDM data to consistent format

**Handles**:
- Various field name variations
- Unit conversions (m → km, m/s → km/s)
- NORAD ID extraction (removes non-digits)
- Missing fields (returns undefined)
- Timestamp parsing

**Input Examples**:
```json
// Space-Track format
{
  "OBJECT1_NAME": "ISS (ZARYA)",
  "OBJECT1_CATID": "25544",
  "MISS_DISTANCE": "1234",  // meters
  "TCA": "2024-10-27T15:30:00Z"
}

// Alternative format
{
  "object1": "ISS",
  "object1Id": "25544",
  "missDistanceKm": 1.234,
  "tca": "2024-10-27T15:30:00Z"
}
```

**Output** (normalized):
```typescript
{
  object1Name: "ISS (ZARYA)",
  object2Name: "COSMOS 2251 DEB",
  object1Id: "25544",
  object2Id: "34454",
  missDistanceKm: 1.234,
  relativeSpeedKms: 14.567,
  tca: "2024-10-27T15:30:00.000Z",
  raw: { /* original data */ }
}
```

**Why Normalize?**:
- Space-Track API has inconsistent formats
- Different endpoints use different field names
- Units vary (m vs km, m/s vs km/s)
- Frontend expects consistent structure

---

### Utils

#### `src/utils/orbit.ts` (170 lines)
**Purpose**: Orbital mechanics using satellite.js (SGP4/SDP4)

**Key Functions**:

##### `currentGeodeticFromTLE(tle1: string, tle2: string): { lat, lon, altKm }`
**Purpose**: Get current satellite position

**Flow**:
1. Parse TLE into satellite record
2. Get current time
3. Propagate to current time using SGP4
4. Result: ECI (Earth-Centered Inertial) position
5. Calculate GMST (Greenwich Mean Sidereal Time)
6. Convert ECI → Geodetic (lat, lon, alt)
7. Convert radians → degrees

**Code**:
```typescript
const satrec = satellite.twoline2satrec(tle1, tle2)
const now = new Date()
const positionAndVelocity = satellite.propagate(satrec, now)

if (typeof positionAndVelocity.position === 'boolean') {
  return null // Propagation failed
}

const positionEci = positionAndVelocity.position
const gmst = satellite.gstime(now)
const positionGd = satellite.eciToGeodetic(positionEci, gmst)

return {
  lat: satellite.degreesLat(positionGd.latitude),
  lon: satellite.degreesLong(positionGd.longitude),
  altKm: positionGd.height
}
```

##### `geodeticFromTLEAt(tle1: string, tle2: string, date: Date)`
**Purpose**: Get satellite position at specific time

**Same as `currentGeodeticFromTLE` but accepts custom `date` parameter**

##### `generateOrbitPath(tle1: string, tle2: string, minutesAhead = 120, stepMinutes = 2): OrbitPoint[]`
**Purpose**: Generate orbit path (array of positions over time)

**Flow**:
1. Parse TLE
2. Loop from now to now + minutesAhead
3. Step size: stepMinutes
4. Propagate to each time point
5. Convert to geodetic
6. Collect positions into array

**Example**:
```typescript
// Generate 2-hour orbit path with 2-minute steps
const path = generateOrbitPath(tle1, tle2, 120, 2)
// Result: 60 points, each 2 minutes apart
```

**Performance**:
- Default: 120 minutes ahead, 2-minute steps = 60 points
- Each propagation takes ~0.1ms
- Total: ~6ms per orbit path

##### `createTLEFromKeplerian(elements: KeplerianElements): { line1: string, line2: string }`
**Purpose**: Generate synthetic TLE from orbital parameters

**Use Cases**:
- User-defined orbits (manual parameter entry)
- Satellites without TLE data
- Testing/simulation

**Parameters**:
```typescript
{
  inclinationDeg: number          // 0-180°
  raanDeg: number                 // 0-360°
  eccentricity: number            // 0-1
  argumentOfPerigeeDeg: number    // 0-360°
  meanAnomalyDeg: number          // 0-360°
  meanMotionRevPerDay: number     // revolutions per day
  name?: string                   // Satellite name
  noradId?: number                // NORAD ID (optional)
}
```

**Output**: Valid TLE lines that can be used with satellite.js

**Why Needed?**:
- Some data sources only provide Keplerian elements
- User may want to design custom orbits
- Fallback when TLE unavailable

---

### Types

#### `src/types/index.ts` (167 lines)
**Purpose**: TypeScript type definitions for entire project

**Key Types**:

##### `Satellite`
```typescript
interface Satellite {
  id: string
  name: string
  noradId: string
  tle: { line1: string; line2: string }
  orbitalParams: OrbitalParams
  position: { x: number; y: number; z: number }
  velocity: { x: number; y: number; z: number }
  status: 'active' | 'safe_mode' | 'maneuvering' | 'offline'
  lastUpdate: Date
}
```

##### `ConjunctionEvent`
```typescript
interface ConjunctionEvent {
  id: string
  satelliteId: string
  debrisId: string
  debrisName: string
  closestApproachTime: Date
  closestApproachDistance: number  // km
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  probabilityOfCollision: number   // 0-1
  relativeVelocity: number          // km/s
  actionRequired: boolean
}
```

##### `SpaceWeatherEvent`
```typescript
interface SpaceWeatherEvent {
  id: string
  type: 'cme' | 'solar_flare' | 'geomagnetic_storm'
  severity: 'minor' | 'moderate' | 'strong' | 'severe' | 'extreme'
  startTime: Date
  peakTime: Date
  endTime: Date
  kIndex?: number
  description: string
  impactOnSatellites: 'minimal' | 'moderate' | 'severe'
  actionRequired: boolean
}
```

**Why TypeScript?**:
- Type safety catches bugs at compile time
- Better IDE autocomplete
- Self-documenting code
- Refactoring confidence
- Improved collaboration

---

### `src/vite-env.d.ts`
**Purpose**: Vite-specific type declarations

**Contents**:
```typescript
/// <reference types="vite/client" />
```

**Why?**:
- Enables Vite-specific features (HMR, env vars)
- TypeScript recognizes `import.meta.env`
- Required for Vite projects

---

## File Organization Summary

```
Sat-trajectory/
├── Configuration (root)
│   ├── package.json          # Dependencies & scripts
│   ├── vite.config.ts        # Build tool config
│   ├── tsconfig.json         # TypeScript config
│   └── .env                  # Environment variables (not in repo)
│
├── Documentation
│   ├── README.md             # Quick start
│   ├── API_SETUP.md          # API configuration
│   ├── ARCHITECTURE.md       # System design
│   ├── API_DOCUMENTATION.md  # API reference
│   └── FILE_GUIDE.md         # This file
│
├── Backend
│   └── server.ts             # Express API server
│
└── Frontend (src/)
    ├── main.tsx              # React entry point
    ├── App.tsx               # Main orchestrator
    │
    ├── components/           # UI components
    │   ├── Earth3DVisualization.tsx    # 3D globe
    │   ├── Earth2DVisualization.tsx    # 2D map
    │   ├── SpaceWeatherMonitor.tsx     # Space weather
    │   ├── TopBar.tsx                  # Navigation
    │   └── ErrorBoundary.tsx           # Error handling
    │
    ├── hooks/                # Custom React hooks
    │   ├── useConjunctions.ts          # CDM data
    │   ├── useOrbitPath.ts             # Orbit generation
    │   └── useRealTimeUpdates.ts       # Position updates
    │
    ├── services/             # API clients
    │   └── spacetrack.ts               # Space-Track client
    │
    ├── utils/                # Utility functions
    │   └── orbit.ts                    # SGP4 propagation
    │
    └── types/                # TypeScript types
        └── index.ts                    # Type definitions
```

---

**Total Lines of Code**: ~3,600 lines (excluding dependencies)
- Backend: ~330 lines
- Frontend: ~3,270 lines
  - App.tsx: ~1,510 lines
  - Components: ~800 lines
  - Hooks: ~250 lines
  - Services: ~110 lines
  - Utils: ~170 lines
  - Types: ~170 lines

**Complexity Level**: **Intermediate to Advanced**
- Orbital mechanics (SGP4/SDP4)
- 3D rendering (Three.js/WebGL)
- State management (React hooks)
- API integration (multiple sources)
- TypeScript (strict mode)
- Real-time updates (requestAnimationFrame)

---

**See Also**:
- [README.md](./README.md) - Project overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference

