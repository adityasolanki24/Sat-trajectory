# 📡 API Documentation

Complete API reference for the Satellite Trajectory Monitor system, including backend endpoints, external API integrations, request/response formats, and usage examples.

## Table of Contents
- [Backend API Endpoints](#backend-api-endpoints)
- [External API Integrations](#external-api-integrations)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Rate Limits & Best Practices](#rate-limits--best-practices)
- [Usage Examples](#usage-examples)

## Backend API Endpoints

All backend endpoints are accessed via `/api/*` and proxied through the Express server running on port 5174.

### Health Check

#### `GET /api/health`

**Description**: Returns server health status

**Authentication**: None required

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-10-27T10:30:00.000Z"
}
```

**Status Codes**:
- `200 OK`: Server is operational

**Example**:
```bash
curl http://localhost:5174/api/health
```

---

### TLE Data - Single Satellite

#### `GET /api/tle/satellite/:noradId`

**Description**: Fetch Two-Line Element (TLE) data for a specific satellite by NORAD Catalog ID

**Authentication**: Handled server-side (Space-Track credentials)

**Parameters**:
- `noradId` (path, required): NORAD Catalog ID (e.g., 25544 for ISS)

**Response Format**: Plain text (3LE format)
```
0 ISS (ZARYA)
1 25544U 98067A   24300.54791667  .00004230  00000-0  99188-4 0  9990
2 25544  51.6440  31.7492 0009013  77.5070 282.6464 15.50008891 99188
```

**Status Codes**:
- `200 OK`: TLE data found
- `404 Not Found`: Satellite not in catalog
- `401 Unauthorized`: Authentication failed (check backend .env)
- `500 Internal Server Error`: Space-Track unavailable

**Example**:
```bash
curl http://localhost:5174/api/tle/satellite/25544
```

**Frontend Usage**:
```typescript
const response = await fetch('/api/tle/satellite/25544')
const tleText = await response.text()
const lines = tleText.split('\n')
const name = lines[0].substring(2)  // "ISS (ZARYA)"
const tle1 = lines[1]
const tle2 = lines[2]
```

---

### TLE Data - Satellite Group

#### `GET /api/tle/group/:groupName`

**Description**: Fetch TLE data for a group of satellites

**Authentication**: Handled server-side

**Parameters**:
- `groupName` (path, required): Group name (e.g., `stations`, `active`, `weather`, `starlink`)
- `limit` (query, optional): Maximum number of satellites to return (default: 50)

**Available Groups**:
- `stations` - Space stations (ISS, Tiangong)
- `active` - Active satellites
- `weather` - Weather satellites
- `starlink` - Starlink constellation
- `gps-ops` - GPS operational satellites
- `galileo` - Galileo navigation satellites
- `science` - Scientific satellites

**Response Format**: JSON array
```json
[
  {
    "OBJECT_NAME": "ISS (ZARYA)",
    "NORAD_CAT_ID": 25544,
    "TLE_LINE1": "1 25544U 98067A   24300.54791667 ...",
    "TLE_LINE2": "2 25544  51.6440  31.7492 ...",
    "EPOCH": "2024-10-26T13:09:00.000Z",
    "MEAN_MOTION": 15.50008891,
    "ECCENTRICITY": 0.0009013,
    "INCLINATION": 51.6440,
    "RA_OF_ASC_NODE": 31.7492,
    "ARG_OF_PERICENTER": 77.5070,
    "MEAN_ANOMALY": 282.6464
  }
]
```

**Status Codes**:
- `200 OK`: Success
- `400 Bad Request`: Invalid group name
- `500 Internal Server Error`: API failure

**Example**:
```bash
curl "http://localhost:5174/api/tle/group/stations?limit=5"
```

**Frontend Usage**:
```typescript
const response = await fetch('/api/tle/group/stations?limit=12')
const satellites = await response.json()

satellites.forEach(sat => {
  console.log(sat.OBJECT_NAME, sat.NORAD_CAT_ID)
})
```

---

### Conjunction Data (Normalized)

#### `GET /api/conjunctions`

**Description**: Fetch normalized Conjunction Data Messages (CDMs) from Space-Track

**Authentication**: Handled server-side

**Query Parameters**:
- `range` (optional): Time range for TCA (Time of Closest Approach)
  - Format: `now-N` where N is days
  - Examples: `now-3` (last 3 days), `now-7` (last 7 days)
  - Default: `now-3`
- `limit` (optional): Maximum results (default: 100)

**Response Format**: JSON array
```json
[
  {
    "object1Name": "ISS (ZARYA)",
    "object2Name": "COSMOS 2251 DEB",
    "object1Id": "25544",
    "object2Id": "34454",
    "missDistanceKm": 1.234,
    "relativeSpeedKms": 14.567,
    "tca": "2024-10-27T15:30:00.000Z",
    "raw": {
      "CDM_ID": "12345",
      "CREATION_DATE": "2024-10-26T10:00:00.000Z",
      "TCA": "2024-10-27T15:30:00.000Z",
      "MISS_DISTANCE": "1234",
      "RELATIVE_SPEED": "14.567",
      "OBJECT1_NAME": "ISS (ZARYA)",
      "OBJECT1_CATID": "25544",
      "OBJECT2_NAME": "COSMOS 2251 DEB",
      "OBJECT2_CATID": "34454"
    }
  }
]
```

**Status Codes**:
- `200 OK`: Success (may return empty array if no conjunctions)
- `401 Unauthorized`: Authentication failed
- `500 Internal Server Error`: API failure

**Example**:
```bash
curl "http://localhost:5174/api/conjunctions?range=now-3"
```

**Frontend Usage**:
```typescript
const response = await fetch('/api/conjunctions?range=now-3')
const conjunctions = await response.json()

conjunctions.forEach(cdm => {
  console.log(`${cdm.object1Name} vs ${cdm.object2Name}`)
  console.log(`Miss distance: ${cdm.missDistanceKm} km`)
  console.log(`TCA: ${new Date(cdm.tca).toLocaleString()}`)
})
```

---

### Conjunction Data (Space-Track Raw)

#### `GET /api/spacetrack/conjunctions`

**Description**: Direct proxy to Space-Track CDM API (returns raw Space-Track format)

**Authentication**: Handled server-side

**Query Parameters**:
- `TCA` (optional): Time range, e.g., `>now-3` (greater than 3 days ago)
- `OBJECT1_CATID` (optional): Filter by object 1 NORAD ID
- `OBJECT2_CATID` (optional): Filter by object 2 NORAD ID
- `FORMAT` (optional): Response format (`json`, `xml`, `html`) - default: `json`
- `orderby` (optional): Sort order, e.g., `TCA desc`
- `limit` (optional): Max results

**Response Format**: Space-Track CDM format (see Space-Track documentation)

**Example**:
```bash
curl "http://localhost:5174/api/spacetrack/conjunctions?TCA=>now-3&orderby=TCA desc&limit=50"
```

---

## External API Integrations

### Space-Track.org

**Base URL**: `https://www.space-track.org`

**Authentication**: Required (handled by backend)

**Rate Limits**: 30 requests per minute per user

**Available Classes**:
- `tle_latest` - Latest TLE for each satellite
- `cdm_public` - Conjunction Data Messages
- `satcat` - Satellite catalog
- `launch_site` - Launch sites

**Query Syntax**:
```
/basicspacedata/query/class/{class}/[predicates]/format/{format}
```

**Example Predicates**:
- `NORAD_CAT_ID/25544` - Specific satellite
- `TCA/>now-3` - TCA greater than 3 days ago
- `orderby/TCA desc` - Sort by TCA descending
- `limit/100` - Limit results

**Documentation**: [https://www.space-track.org/documentation](https://www.space-track.org/documentation)

---

### CelesTrak

**Base URL**: `https://celestrak.org`

**Authentication**: Not required (public API)

**Rate Limits**: Reasonable use policy (no hard limit specified)

**TLE Endpoints**:
```
/NORAD/elements/gp.php?GROUP={group}&FORMAT={format}
/NORAD/elements/gp.php?CATNR={noradId}&FORMAT={format}
/NORAD/elements/gp.php?INTDES={intlDesignator}&FORMAT={format}
```

**Formats**:
- `tle` - Classic 3-line format
- `json` - JSON format
- `xml` - XML format
- `csv` - CSV format

**Groups**: See `/api/tle/group/:groupName` documentation above

**Example**:
```bash
curl "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle"
```

---

### NASA DONKI (Space Weather)

**Base URL**: `https://kauai.ccmc.gsfc.nasa.gov`

**Authentication**: Not required (public API)

**Rate Limits**: Not specified (reasonable use)

#### Coronal Mass Ejections (CME)

**Endpoint**: `GET /DONKI/WS/get/CME`

**Query Parameters**:
- `startDate` (required): YYYY-MM-DD
- `endDate` (required): YYYY-MM-DD

**Response**:
```json
[
  {
    "activityID": "2024-10-25T12:00:00-CME-001",
    "startTime": "2024-10-25T12:00:00Z",
    "sourceLocation": "N15W30",
    "note": "CME detected in LASCO C2 imagery",
    "instruments": [
      { "displayName": "SOHO: LASCO/C2" }
    ],
    "cmeAnalyses": [
      {
        "time21_5": "2024-10-25T12:30:00Z",
        "latitude": 15.0,
        "longitude": -30.0,
        "halfAngle": 45.0,
        "speed": 850.0,
        "type": "C",
        "isMostAccurate": true
      }
    ]
  }
]
```

---

#### Solar Flares (FLR)

**Endpoint**: `GET /DONKI/WS/get/FLR`

**Query Parameters**:
- `startDate` (required): YYYY-MM-DD
- `endDate` (required): YYYY-MM-DD

**Response**:
```json
[
  {
    "flrID": "2024-10-25T14:30:00-FLR-001",
    "beginTime": "2024-10-25T14:30:00Z",
    "peakTime": "2024-10-25T14:45:00Z",
    "endTime": "2024-10-25T15:00:00Z",
    "classType": "M2.5",
    "sourceLocation": "N15W30",
    "activeRegionNum": 12345
  }
]
```

**Class Types**: C (weak), M (medium), X (strong)

---

#### Geomagnetic Storms (GST)

**Endpoint**: `GET /DONKI/WS/get/GST`

**Query Parameters**:
- `startDate` (required): YYYY-MM-DD
- `endDate` (required): YYYY-MM-DD

**Response**:
```json
[
  {
    "gstID": "2024-10-26T00:00:00-GST-001",
    "startTime": "2024-10-26T00:00:00Z",
    "kpIndex": 6,
    "linkedEvents": [
      { "activityID": "2024-10-25T12:00:00-CME-001" }
    ]
  }
]
```

**Kp Index**: 0-9 (0 = quiet, 5+ = storm, 9 = extreme)

---

## Data Models

### Satellite

```typescript
interface Satellite {
  id: string                    // Internal ID (e.g., "sat_25544")
  name: string                  // Display name (e.g., "ISS (ZARYA)")
  noradId: string               // NORAD Catalog ID (e.g., "25544")
  tle1?: string                 // TLE line 1
  tle2?: string                 // TLE line 2
  status: 'active' | 'safe_mode' | 'maneuvering' | 'offline'
  orbitalParams: {
    semiMajorAxis: number       // km
    inclination: number         // degrees
    eccentricity: number        // 0-1
    raan: number                // Right Ascension of Ascending Node (deg)
    argumentOfPerigee: number   // degrees
    meanAnomaly: number         // degrees
    meanMotion: number          // revolutions per day
    period: number              // minutes
  }
  position: {
    x: number                   // Longitude (degrees)
    y: number                   // Latitude (degrees)
    z: number                   // Altitude (km)
  }
  velocity: {
    x: number                   // km/s
    y: number                   // km/s
    z: number                   // km/s
  }
  lastUpdate: Date
}
```

### Orbit Path

```typescript
interface OrbitPath {
  id: string                    // Matches satellite ID
  path: OrbitPoint[]            // Array of positions
  color?: string                // Hex color (e.g., "#60a5fa")
}

interface OrbitPoint {
  lat: number                   // Latitude (degrees)
  lon: number                   // Longitude (degrees)
  altKm: number                 // Altitude (km)
}
```

### Conjunction Event

```typescript
interface ConjunctionEvent {
  object1Name: string           // Primary object name
  object2Name: string           // Secondary object name
  object1Id: string             // NORAD ID (primary)
  object2Id: string             // NORAD ID (secondary)
  missDistanceKm?: number       // Closest approach distance (km)
  relativeSpeedKms?: number     // Relative velocity (km/s)
  tca?: string                  // Time of Closest Approach (ISO 8601)
  raw?: any                     // Original CDM data
}
```

### Space Weather Event

```typescript
interface SpaceWeatherEvent {
  id: string                              // Unique identifier
  type: 'CME' | 'Solar Flare' | 'Geomagnetic Storm' | 'SEP'
  title: string                           // Display title
  description: string                     // Event details
  severity: 'Low' | 'Medium' | 'High' | 'Critical'
  timestamp: string                       // ISO 8601 datetime
  impact?: string                         // Impact description
  source?: any                            // Raw DONKI data
}
```

## Error Handling

### Backend Error Responses

```json
{
  "error": "Error message",
  "hint": "Suggested fix",
  "details": "Additional context"
}
```

### Common Error Codes

**401 Unauthorized**
```json
{
  "error": "You must be logged in",
  "hint": "Check SPACETRACK_USER and SPACETRACK_PASS in .env"
}
```

**404 Not Found**
```json
{
  "error": "Satellite not found",
  "hint": "NORAD ID 99999 not in catalog"
}
```

**429 Too Many Requests**
```json
{
  "error": "Rate limit exceeded",
  "hint": "Space-Track allows 30 requests per minute"
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to fetch TLE data",
  "details": "Connection timeout to Space-Track.org"
}
```

### Frontend Error Handling

```typescript
try {
  const response = await fetch('/api/tle/satellite/25544')
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }
  
  const tleText = await response.text()
  // ... process TLE ...
  
} catch (error) {
  console.error('Failed to fetch satellite:', error)
  setError(error.message || 'Network error')
}
```

## Rate Limits & Best Practices

### Space-Track.org Limits
- **30 requests per minute per user**
- **Session expires after 2 hours of inactivity**
- **Cookie-based authentication** (handled by backend)

**Best Practices**:
1. Cache TLE data (valid for ~24 hours)
2. Batch requests when possible
3. Use conjunction endpoint pagination
4. Implement exponential backoff on failures

### CelesTrak
- **No hard limit specified**
- **Reasonable use policy**

**Best Practices**:
1. Don't hammer the API with rapid requests
2. Cache group TLE data
3. Use Space-Track as primary, CelesTrak as fallback

### NASA DONKI
- **No hard limit specified**
- **Public API**

**Best Practices**:
1. Query by date range (max 30 days recommended)
2. Refresh every 5-10 minutes
3. Cache responses

## Usage Examples

### Example 1: Load ISS and Track Position

```typescript
// Fetch ISS TLE
const response = await fetch('/api/tle/satellite/25544')
const tleText = await response.text()
const lines = tleText.split('\n')

const tle1 = lines[1]
const tle2 = lines[2]

// Propagate to current time
import * as satellite from 'satellite.js'

const satrec = satellite.twoline2satrec(tle1, tle2)
const now = new Date()
const positionAndVelocity = satellite.propagate(satrec, now)

if (typeof positionAndVelocity.position !== 'boolean') {
  const positionEci = positionAndVelocity.position
  const gmst = satellite.gstime(now)
  const positionGd = satellite.eciToGeodetic(positionEci, gmst)
  
  console.log('ISS Position:')
  console.log('Latitude:', satellite.degreesLat(positionGd.latitude))
  console.log('Longitude:', satellite.degreesLong(positionGd.longitude))
  console.log('Altitude:', positionGd.height, 'km')
}
```

### Example 2: Visualize Conjunction

```typescript
// Fetch conjunction data
const response = await fetch('/api/conjunctions?range=now-3')
const conjunctions = await response.json()

// Get first conjunction
const cdm = conjunctions[0]

// Fetch TLEs for both objects
const [tle1Response, tle2Response] = await Promise.all([
  fetch(`/api/tle/satellite/${cdm.object1Id}`),
  fetch(`/api/tle/satellite/${cdm.object2Id}`)
])

const tle1Text = await tle1Response.text()
const tle2Text = await tle2Response.text()

// Generate orbit paths
function generateOrbitPath(tleText) {
  const lines = tleText.split('\n')
  const satrec = satellite.twoline2satrec(lines[1], lines[2])
  const path = []
  
  for (let m = 0; m <= 120; m += 2) {
    const futureDate = new Date(Date.now() + m * 60000)
    const pv = satellite.propagate(satrec, futureDate)
    if (typeof pv.position !== 'boolean') {
      const gmst = satellite.gstime(futureDate)
      const gd = satellite.eciToGeodetic(pv.position, gmst)
      path.push({
        lat: satellite.degreesLat(gd.latitude),
        lon: satellite.degreesLong(gd.longitude),
        altKm: gd.height
      })
    }
  }
  
  return path
}

const orbit1 = generateOrbitPath(tle1Text)
const orbit2 = generateOrbitPath(tle2Text)

// Render on 3D globe...
```

### Example 3: Monitor Space Weather

```typescript
// Fetch space weather events
const endDate = new Date()
const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)

function toISO(date) {
  return date.toISOString().split('T')[0]
}

const params = `?startDate=${toISO(startDate)}&endDate=${toISO(endDate)}`

const [cmeRes, flareRes, gstRes] = await Promise.all([
  fetch(`/api/donki/DONKI/WS/get/CME${params}`),
  fetch(`/api/donki/DONKI/WS/get/FLR${params}`),
  fetch(`/api/donki/DONKI/WS/get/GST${params}`)
])

const [cmeData, flareData, gstData] = await Promise.all([
  cmeRes.json(),
  flareRes.json(),
  gstRes.json()
])

// Process CMEs
cmeData.forEach(cme => {
  const analysis = cme.cmeAnalyses?.find(a => a.isMostAccurate)
  if (analysis && analysis.speed > 1000) {
    console.log(`High-speed CME detected: ${analysis.speed} km/s`)
  }
})

// Process flares
flareData.forEach(flare => {
  if (flare.classType && flare.classType.startsWith('X')) {
    console.log(`X-class solar flare: ${flare.classType}`)
  }
})

// Process storms
gstData.forEach(storm => {
  if (storm.kpIndex >= 7) {
    console.log(`Severe geomagnetic storm: Kp = ${storm.kpIndex}`)
  }
})
```

---

**See Also**:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design
- [FILE_GUIDE.md](./FILE_GUIDE.md) - File-by-file code explanations
- [API_SETUP.md](./API_SETUP.md) - API key configuration guide

