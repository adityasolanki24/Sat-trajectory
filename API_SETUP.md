# API & Keys Setup

Securely configure keys and credentials. Frontend uses Vite env vars; backend keeps private secrets.

## Frontend (Vite) – `.env.local`

No frontend keys are required for CelesTrak or NASA DONKI. If you add other sources, create `Sat-trajectory/.env.local` and restart dev.

## Backend (Express) – `.env`

Create `Sat-trajectory/.env`:

```
SPACETRACK_USER=your_spacetrack_username
SPACETRACK_PASS=your_spacetrack_password
PORT=5174
```

Run: `npm run dev:server` (backend) or `npm run dev:all` (backend+frontend).

## Dev proxy endpoints

- `GET /api/health` → backend heartbeat
- `GET /api/conjunctions` → normalized CDM data
- `GET /api/spacetrack/conjunctions?...` → raw Space‑Track CDM (requires auth)

Examples:

```
/api/conjunctions?days=3
/api/spacetrack/conjunctions?TCA=now-3&FORMAT=json
```

## Notes

- Space‑Track auth uses cookie jar; credentials never leave the server.
- Celestrak JSON can miss TLE lines; the app falls back to `FORMAT=tle` and parses them.
 -

## Troubleshooting

- `You must be logged in` → check `.env` and restart backend.
- Port `5174` busy → stop extra backend processes.
 -
