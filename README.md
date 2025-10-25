# 🛰️ Sat Trajectory —  Satellite Monitoring

TypeScript + React app with a Node/Express proxy. Features real Conjunction Data (Space‑Track), accurate orbit propagation (satellite.js), 3D/2D views, space weather (NASA DONKI), and N2YO add‑satellite.

## Quick start

```bash
cd Sat-trajectory
npm install
# Backend + frontend together
npm run dev:all
# Or run separately
npm run dev:server  # http://localhost:5174
npm run dev         # http://localhost:5173
```

## Environment

Create `.env.local` in `Sat-trajectory/` for frontend vars, and `.env` for backend.

Frontend (Vite):
```
VITE_N2YO_API_KEY=your_n2yo_key
```

Backend (Express proxy):
```
SPACETRACK_USER=your_spacetrack_username
SPACETRACK_PASS=your_spacetrack_password
PORT=5174
```

See `API_SETUP.md` for full details.

## Architecture

- **Frontend**: React + Vite, `@react-three/fiber` + `@react-three/drei` for 3D, `satellite.js` for orbit propagation.
- **Backend**: Node/Express + `axios` with cookie jar to authenticate Space‑Track and proxy CDM data; Vite proxy forwards `/api/*` to backend in dev.

### Key files

- `src/App.tsx`: Tabs, data orchestration, table views, add‑satellite flow.
- `src/components/Earth3DVisualization.tsx`: Globe, orbits, conjunction lines (auto‑rotation off).
- `src/components/Earth2DVisualization.tsx`: 2D fallback view.
- `src/components/TopBar.tsx`: SpaceX‑style tab bar.
- `src/components/SpaceWeatherMonitor.tsx`: NASA DONKI with date range, resilience.
- `src/hooks/useConjunctions.ts`: Fetches Space‑Track CDM via backend.
- `src/utils/orbit.ts`: `generateOrbitPath` using `satellite.js` TLEs.
- `backend/server.ts`: Space‑Track login + `/api/conjunctions` and `/api/spacetrack/conjunctions` routes.
- `vite.config.ts`: Dev proxy for `/api` routes.

## Tabs & Features

- **Dashboard**: 3D globe embed + add satellite by NORAD ID (N2YO), live CDM count, system status.
- **3D Map**: Real‑time satellites and orbits; conjunction links color‑coded.
- **2D Map**: Lightweight visualization.
- **Conjunctions**: Table of CDM with miss distance (km), relative speed (km/s), TCA.
- **Space Weather**: NASA DONKI events with processed summaries.
- **Settings**: Placeholder for keys/preferences.

## Celestrak note (TLEs)

The `gp.php?FORMAT=json` feed sometimes lacks `TLE_LINE1/2`. The app falls back to `FORMAT=tle` and parses raw lines. You should see accurate orbit tracks after the fallback completes.

## Security & Dev Notes

- Space‑Track username/password live only in backend `.env` and proxied via Express; the frontend never calls Space‑Track directly.
- N2YO key must be set in `.env.local` and requires a dev server restart.
- If you see port conflicts, stop extra backend instances occupying `5174`.

## Build & preview

```bash
npm run build
npm run preview
```
