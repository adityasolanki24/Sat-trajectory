# Satellite Trajectory Monitor - ANT61 Hackathon

A professional-grade satellite tracking and collision avoidance system with AI-powered decision support. Built with TypeScript, React, Three.js, Node.js, and LLM integration for autonomous space operations.

![Mission Control Dashboard](https://img.shields.io/badge/Status-Operational-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![Three.js](https://img.shields.io/badge/Three.js-0.159-black)
![AI Powered](https://img.shields.io/badge/AI-Powered-orange)

## 🌟 Features

### Core Capabilities
- **3D Earth Visualization**: Interactive globe with draggable camera, zoom, and real-time satellite rendering
- **2D Map View**: Lightweight equirectangular projection with satellite tracking and orbit trajectories
- **Real-Time Orbital Propagation**: Accurate satellite positions using `satellite.js` (SGP4/SDP4 models)
- **Conjunction Detection**: Live conjunction data messages (CDMs) from Space-Track.org with automatic risk assessment
- **Space Weather Monitoring**: CMEs, solar flares, and geomagnetic storms from NASA DONKI with threat detection
- **Time Simulation**: Fast-forward/rewind satellite positions with adjustable playback speed
- **Custom Satellite Addition**: Add satellites by NORAD ID or orbital parameters

### AI-Powered Features (NEW)
- **AI Operations Assistant**: LLM-powered chatbot for satellite operations and decision support
- **Automatic Collision Detection**: Real-time risk calculation with probability assessment (CRITICAL/HIGH/MODERATE/LOW)
- **Orbit Control Panel**: Adjust orbital parameters (altitude, inclination, RAAN, eccentricity) with delta-v calculation
- **AI Collision Avoidance**: Automatic maneuver suggestions with one-click execution
- **Space Weather Alerts**: AI-powered alerts for CME/solar flare threats with protective measures
- **Maneuver History**: Complete log of all executed orbit adjustments
- **Demo Mode**: Showcase collision and space weather avoidance without live data

### Data Sources
- **Space-Track.org**: Conjunction Data Messages (CDMs), TLE data
- **CelesTrak**: Backup TLE data for active satellites
- **NASA DONKI**: Coronal Mass Ejections (CME), Solar Flares, Geomagnetic Storms
- **satellite.js**: SGP4/SDP4 orbital propagation algorithms

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Space-Track.org account (free registration at [https://www.space-track.org/auth/createAccount](https://www.space-track.org/auth/createAccount))

### Installation

```bash
cd Sat-trajectory
npm install
```

### Configuration

Create `.env` in the `Sat-trajectory/` directory for backend configuration:

```env
# Required for Space-Track API
SPACETRACK_USER=your_spacetrack_username
SPACETRACK_PASS=your_spacetrack_password

# Backend server port
PORT=5174

# Optional: AI Assistant (choose one)
AIML_API_KEY=your_aiml_api_key              # Recommended: https://aimlapi.com (supports GPT-4o, Llama 3.3, Gemma 2)
OPENROUTER_API_KEY=your_openrouter_key       # Alternative: https://openrouter.ai (free models available)
OPENAI_API_KEY=your_openai_key               # Alternative: https://platform.openai.com

# Note: AI Assistant is optional. Without API keys, demo mode provides rule-based responses.
```

### Run Development Server

```bash
# Run both frontend and backend together (recommended)
npm run dev:all

# Or run separately:
npm run dev:server  # Backend on http://localhost:5174
npm run dev         # Frontend on http://localhost:5173
```

Visit [http://localhost:5173](http://localhost:5173) to see the application.

## 🚀 Deployment

Ready to deploy? See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete deployment guide.

**Quick Deploy to Vercel (Recommended):**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd Sat-trajectory
vercel

# Add environment variables
vercel env add SPACETRACK_USER production
vercel env add SPACETRACK_PASS production

# Deploy to production
vercel --prod
```

**Or use the Vercel Dashboard:**
1. Push code to GitHub
2. Import project at [vercel.com](https://vercel.com)
3. Add environment variables
4. Click "Deploy"

**Continue Development After Deployment:**
- Every commit to `main` → automatic production deployment
- Every PR → preview deployment with unique URL
- Easy rollback to previous versions
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for full workflow

---

## 📁 Project Structure

```
Sat-trajectory/
├── backend/
│   └── server.ts              # Express server with Space-Track/DONKI/AI proxies
├── src/
│   ├── components/
│   │   ├── Earth3DVisualization.tsx    # Three.js 3D globe with ECI rendering
│   │   ├── Earth2DVisualization.tsx    # 2D map with orbit trajectories
│   │   ├── SpaceWeatherMonitor.tsx     # NASA DONKI integration + threat detection
│   │   ├── AssistantPanel.tsx          # AI chatbot interface (NEW)
│   │   ├── OrbitControlPanel.tsx       # Orbital parameter adjustment UI (NEW)
│   │   ├── TopBar.tsx                  # Navigation tabs
│   │   └── ErrorBoundary.tsx           # Error handling
│   ├── hooks/
│   │   ├── useConjunctions.ts          # CDM data fetching
│   │   ├── useOrbitPath.ts             # Orbit path generation
│   │   └── useRealTimeUpdates.ts       # Live position updates
│   ├── services/
│   │   └── spacetrack.ts               # Space-Track API client
│   ├── utils/
│   │   ├── orbit.ts                    # SGP4 propagation, TLE parsing, Keplerian conversion
│   │   └── collisionRisk.ts            # Collision probability calculations (NEW)
│   ├── types/
│   │   └── index.ts                    # TypeScript type definitions
│   ├── App.tsx                         # Main application with AI integration
│   └── main.tsx                        # React entry point
├── vite.config.ts             # Vite config with API proxies
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

## 🎯 Usage Guide

### Dashboard Tab
- **3D Globe**: Drag to rotate, scroll to zoom, click satellites to select
- **Add Satellite**: Enter NORAD ID (e.g., 25544 for ISS) and click "Add Satellite"
- **Orbits Toggle**: Show/hide orbital paths (auto-generated for tracked satellites)
- **AI Operations Assistant**: Chatbot in top-right corner for queries and alerts
- **Side Panel Tabs**:
  - **Tracked**: View all tracked satellites
  - **Conjunctions**: Recent conjunction events with risk levels
  - **Maneuvers**: History of executed orbit adjustments

### 3D Map Tab
- Full-screen 3D visualization with ECI coordinate system
- Time simulation controls (play/pause, speed adjustment)
- View satellites at specific times relative to conjunction events
- Orbit paths synchronized with simulated time

### 2D Map Tab
- Lightweight equirectangular projection with orbit trajectories
- Fast rendering for systems without WebGL
- Shows real-time satellite positions and ground tracks

### Conjunctions Tab
- Table of all recent conjunction events with automatic risk assessment
- Color-coded by severity: CRITICAL (red), HIGH (orange), MODERATE (yellow), LOW (green)
- Click any row to:
  - Load both satellites
  - Generate orbit paths centered at TCA
  - Fast-forward simulation to TCA
  - Auto-open Orbit Control Panel for CRITICAL/HIGH risks
- Shows miss distance, relative velocity, collision probability, and TCA

### AI Operations Assistant (NEW)
- **Chatbot Interface**: Top-right corner, collapsible
- **Auto-Alerts**: Automatically expands for CRITICAL/HIGH risks
- **Commands**:
  - Ask questions: "Show orbits", "What's the ISS status?"
  - Jump to time: "Go to current time"
  - Focus satellite: AI can highlight specific satellites
  - Open Orbit Control: AI suggests collision avoidance maneuvers
- **Emergency Mode**: Red border + alert title for active threats
- **Demo Mode**: Toggle button in top bar for demonstration without live data

### Orbit Control Panel (NEW)
- **Triggered by**:
  - AI suggestion (auto-opens for high-risk conjunctions)
  - Manual selection from tracked satellites
- **Current Orbit Display**: Altitude, eccentricity, inclination, RAAN, arg of perigee, mean anomaly
- **Adjustment Controls**:
  - Altitude Change (km)
  - Inclination Change (°)
  - RAAN Change (°)
  - Eccentricity Change
- **Auto-Calculate Avoidance**: AI suggests optimal maneuver based on collision risk
- **Apply Maneuver**: Calculates new TLE, estimates ΔV, updates orbit
- **Collision Risk Display**: Shows target, miss distance, TCA, probability

### Time Simulation
- **Play/Pause**: Start/stop time simulation
- **Speed Slider**: Adjust simulation speed (0.5-60 minutes per real second)
- **Time Offset**: Manually adjust time position (-1440 to +1440 minutes)
- **Current Time Display**: Shows simulated UTC time
- **"Now" Button**: Reset to current real-time

### Demo Mode (NEW)
- **Enable**: Click "Enable Demo Mode" in top bar
- **Simulated Threats**:
  - T+2s: Collision alert with DEMO DEBRIS (miss distance 0.4km, CRITICAL)
  - T+6s: Orbit Control Panel auto-opens with AI-suggested maneuver
  - T+5s: Space weather alert (CME) affecting tracked satellites
- **Perfect for**: Hackathon presentations, demonstrations without live API data
- **Disable**: Click "DEMO MODE ON" to turn off and clear simulated threats

## 🔧 Architecture

### Frontend (React + Vite)
- **React 18**: Component-based UI with hooks and state management
- **Three.js + @react-three/fiber**: 3D rendering engine with ECI coordinate system
- **satellite.js**: SGP4/SDP4 orbital mechanics for real-time propagation
- **react-simple-maps**: 2D map rendering with orbit trajectories
- **Vite**: Fast development server with HMR

### Backend (Node.js + Express)
- **Express**: REST API server with multiple proxy endpoints
- **axios + tough-cookie**: Space-Track authentication with cookie persistence
- **LLM Integration**: OpenAI SDK for AI assistant (supports OpenAI, OpenRouter, AI/ML API)
- **CORS**: Enables frontend-backend communication
- **Proxy endpoints**: 
  - Space-Track (TLE, CDM data)
  - NASA DONKI (space weather)
  - AI/LLM APIs (secure key handling)

### AI Assistant Architecture
1. **Frontend** (`AssistantPanel.tsx`): Chatbot UI with message history
2. **State Builder** (`buildAssistantState` in `App.tsx`): Collects app state (satellites, conjunctions, risks, maneuvers)
3. **Backend** (`/api/assistant`): LLM API calls with structured prompts
4. **Command Parser**: Extracts structured commands from LLM responses
5. **Command Executor** (`executeAssistantPlan` in `App.tsx`): Maps commands to React state updates
6. **Supported Commands**:
   - `toggleOrbits`: Show/hide orbits
   - `jumpToNow`: Reset to current time
   - `focusSatellite`: Highlight specific satellite
   - `openOrbitControl`: Open Orbit Control Panel with suggested maneuvers

### Collision Avoidance Workflow
1. **Detection**: CDM data fetched from Space-Track, parsed in `App.tsx`
2. **Risk Calculation**: `calculateCollisionProbability` + `assessRiskLevel` in `collisionRisk.ts`
3. **Auto-Alert**: High/Critical risks trigger AI assistant with collision details
4. **AI Suggestion**: LLM analyzes risk and suggests maneuver (altitude/inclination/RAAN changes)
5. **Orbit Control Panel**: Opens with pre-filled AI suggestions
6. **Maneuver Execution**: `handleApplyManeuver` calculates new TLE using `createTLEFromKeplerian`
7. **History Logging**: All maneuvers recorded in `maneuverHistory` state

### Data Flow
1. Frontend requests data from `/api/*` endpoints
2. Vite dev proxy forwards to Express backend (port 5174)
3. Backend authenticates with Space-Track (cookie jar) and fetches CDM/TLE data
4. Backend proxies NASA DONKI for space weather events
5. Frontend uses satellite.js to propagate orbits and render visualization
6. AI Assistant sends queries to `/api/assistant`
7. Backend calls LLM API (OpenAI/OpenRouter/AI/ML) with app state
8. LLM returns structured commands (JSON)
9. Frontend executes commands via `executeAssistantPlan`

## 📡 API Endpoints

### Backend Endpoints (via `/api/*`)

#### Health Check
```
GET /api/health
Response: { ok: true }
```

#### Conjunctions
```
GET /api/conjunctions?range=now-3
Response: [{ object1Name, object2Name, object1Id, object2Id, missDistanceKm, relativeSpeedKms, tca, raw }]
```

#### TLE Data (Single Satellite)
```
GET /api/tle/satellite/:noradId
Response: "0 ISS (ZARYA)\n1 25544U 98067A ...\n2 25544  51.6440 ..."
```

#### TLE Data (Group)
```
GET /api/tle/group/stations?limit=12
GET /api/tle/group/active?limit=12
Response: [{ OBJECT_NAME, NORAD_CAT_ID, TLE_LINE1, TLE_LINE2 }]
```

#### Space-Track Proxy
```
GET /api/spacetrack/conjunctions?range=now-3
Response: Space-Track CDM data (proxied with authentication)
```

#### NASA DONKI (Space Weather)
```
GET /api/donki/DONKI/WS/get/CME?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET /api/donki/DONKI/WS/get/FLR?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET /api/donki/DONKI/WS/get/GST?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
Response: NASA DONKI space weather events (proxied)
```

#### AI Assistant (NEW)
```
POST /api/assistant
Body: { 
  message: "Show me satellite orbits",
  appState: { satellites: [...], conjunctions: [...], collisionRisks: [...], ... }
}
Response: { 
  title: "Command Response",
  rationale: "Explanation of AI decision",
  commands: [
    { name: "toggleOrbits", args: { on: true } },
    { name: "focusSatellite", args: { id: "sat_25544" } }
  ]
}
```

## 🛡️ Security Notes

- **Space-Track credentials** stored only in backend `.env` file (never in frontend)
- **AI API keys** (OpenAI/OpenRouter/AI/ML) secured server-side
- Frontend never accesses external APIs directly
- All authentication handled server-side with cookie jar
- Credentials never exposed in browser or client code
- LLM prompts sanitized to prevent injection attacks

## 🏗️ Build & Deploy

### Development Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```
<<<<<<< HEAD

### Production Deployment
1. Build frontend: `npm run build`
2. Deploy backend server with `.env` file
3. Serve `dist/` directory as static files
4. Configure reverse proxy to route `/api/*` to backend

## 🐛 Troubleshooting

### "You must be logged in" error
- Check Space-Track credentials in `.env` (must be in `Sat-trajectory/.env`, not project root)
- Restart backend server: `npm run dev:server`
- Verify Space-Track account is active at [space-track.org](https://www.space-track.org)

### "Demo Mode: Using built-in satellite TLEs"
- Space-Track credentials are missing or invalid
- Check `.env` file has `SPACETRACK_USER` and `SPACETRACK_PASS`
- Restart backend after adding credentials

### AI Assistant not working / "Assistant Unavailable"
- **No API Key**: System falls back to demo mode (rule-based responses)
- **Quota Exceeded**: OpenAI/OpenRouter free tier limits reached
- **Invalid Key**: Check `.env` for correct API key format
- **Solution**: Add `AIML_API_KEY`, `OPENROUTER_API_KEY`, or `OPENAI_API_KEY` to `.env`
- **Demo Mode**: Works without API keys using rule-based logic

### Port 5174 already in use
- **Windows**: `Stop-Process -Name node -Force` (PowerShell)
- **macOS/Linux**: `lsof -ti:5174 | xargs kill`
- Or change `PORT` in `.env`

### WebGL not available
- Use 2D Map tab as fallback
- Update graphics drivers
- Try different browser (Chrome/Firefox recommended)

### Satellites not loading
- Check browser console for errors (F12)
- Verify internet connection
- CelesTrak may be temporarily unavailable (app uses fallback data)

### Conjunctions not showing / "No TLE data available"
- Space-Track credentials required for conjunction data
- Create account at [space-track.org/auth/createAccount](https://www.space-track.org/auth/createAccount)
- Add credentials to `.env` and restart backend

### Orbit Control Panel "Failed to calculate new orbit parameters"
- Check console for detailed error messages
- Verify satellite has valid TLE data
- Extreme parameter changes may fail validation
- Try smaller adjustments (e.g., ±5km altitude instead of ±50km)

## 🤝 Contributing

This project was built for the ANT61 Hackathon. Contributions welcome!

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit pull request

## 📄 License

MIT License - Built for educational purposes

## 🙏 Acknowledgments

- **Space-Track.org**: Conjunction Data Messages and TLE data
- **CelesTrak**: Satellite catalog and TLE data
- **NASA DONKI**: Space weather data (CME, solar flares, geomagnetic storms)
- **satellite.js**: SGP4/SDP4 orbital propagation algorithms
- **Three.js**: 3D rendering engine with ECI coordinate support
- **OpenAI / OpenRouter / AI/ML API**: LLM infrastructure for AI assistant
- **ANT61 Hackathon**: For the opportunity to build this autonomous space operations system

## 📚 Additional Documentation

### Core Documentation
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - Detailed system architecture and design decisions
- [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) - Complete API reference with examples
- [`FILE_GUIDE.md`](./FILE_GUIDE.md) - Explanation of every file in the project
- [`API_SETUP.md`](./API_SETUP.md) - API key setup and configuration guide

### Deployment Documentation
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Complete deployment guide (Vercel, Railway, Docker)
- [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) - Pre/post-deployment checklist
- [`QUICK_DEPLOY.md`](./QUICK_DEPLOY.md) - Fast reference for deployment commands

---

**Built for ANT61 Hackathon** 

