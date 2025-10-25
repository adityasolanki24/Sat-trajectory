# 🐛 Debugging Guide

## Common Issues and Solutions

### Custom Satellite Addition Crashes

#### Symptoms
- App freezes when adding satellite
- White screen after clicking "Add Satellite"
- Browser console shows errors

#### Fixed Issues (v2.0)

✅ **TLE Validation** - Now validates TLE format before processing  
✅ **SGP4 Errors** - Catches initialization failures gracefully  
✅ **Orbit Generation** - Handles empty/failed orbit generation  
✅ **State Updates** - Protected against undefined values  
✅ **Time Simulation** - Safely handles simDate access  

#### How to Debug

1. **Open Browser Console** (F12)
2. **Try adding satellite** (e.g., NORAD ID: 25544)
3. **Look for these log messages:**

**Success:**
```
✅ Added satellite: ISS (ZARYA) (NORAD 25544)
   Altitude: 413 km, Inclination: 51.6°
   Orbit points generated: 93
```

**Errors:**
```
❌ Failed to add satellite: [error details]
❌ generateOrbitPath: Invalid TLE line format
❌ SGP4 initialization failed: [error code]
```

### Common Error Messages

#### "Authentication failed"
**Cause:** Space-Track credentials not set or invalid

**Fix:**
```bash
# Check backend/.env file
SPACETRACK_USER=your_username
SPACETRACK_PASS=your_password

# Restart backend
npm run dev:server
```

#### "Satellite not found in catalog"
**Cause:** Invalid NORAD ID or satellite no longer tracked

**Fix:**
- Verify NORAD ID at space-track.org
- Try a different satellite (e.g., 25544 for ISS)

#### "TLE lines too short"
**Cause:** Corrupted TLE data from API

**Fix:**
- Try different satellite
- Check Space-Track API status
- Restart backend server

#### "Orbit generation returned no points"
**Cause:** Invalid orbital parameters or TLE epoch too old

**Fix:**
- Satellite will still appear (just no orbit line)
- Try getting fresh TLE data
- Check if satellite is still active

### Testing Satellites

These should always work:

| NORAD ID | Name | Orbit Type | Period |
|----------|------|------------|--------|
| 25544 | ISS (ZARYA) | LEO | 93 min |
| 20580 | HST | LEO | 96 min |
| 43013 | STARLINK-1007 | LEO | 95 min |
| 28654 | NOAA 18 | LEO | 102 min |
| 41019 | GPS BIIA-25 | MEO | 718 min |
| 23398 | COSMOS 2294 | MEO | 676 min |

### Browser Console Commands

**Check current state:**
```javascript
// In browser console
console.log('Satellites:', satellites.length)
console.log('User orbits:', userOrbits.length)
console.log('Sim time:', simMinutes, 'min')
```

**Force reload without cache:**
```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

### Still Crashing?

1. **Clear browser cache and reload**
2. **Try different browser** (Chrome/Firefox recommended)
3. **Check browser console for errors**
4. **Restart backend server**
5. **Check NORAD ID is valid**
6. **Open GitHub issue with:**
   - NORAD ID you tried
   - Console error messages
   - Browser version
   - Steps to reproduce

---

## Network Issues

### API Timeout
```
Request timed out. Check your internet connection.
```

**Fix:**
- Check internet connection
- Increase timeout in code (currently 15 seconds)
- Try different network

### CORS Errors
```
Access to fetch blocked by CORS policy
```

**Fix:**
- Ensure backend is running on port 5174
- Check vite.config.ts proxy settings
- Restart both frontend and backend

---

## Performance Issues

### Slow 3D Rendering

**Symptoms:**
- Low frame rate
- Laggy rotation
- Stuttering

**Solutions:**
1. Switch to 2D view
2. Reduce satellites (limit to 5-10)
3. Turn off orbits
4. Close other browser tabs
5. Update graphics drivers

### High Memory Usage

**Symptoms:**
- Browser tab using >1GB RAM
- Browser warns "Page is slowing down"

**Solutions:**
1. Reduce number of satellites
2. Clear cached satellites (remove all, refresh)
3. Restart browser
4. Limit orbit resolution (increase stepMinutes)

---

## Development Debugging

### Enable Verbose Logging

In `App.tsx`, add at the top:
```typescript
const DEBUG = true;

// Then use throughout:
if (DEBUG) console.log('Debug info:', data);
```

### Track State Changes

Add this in `App.tsx`:
```typescript
useEffect(() => {
  console.log('Satellites changed:', satellites.length);
}, [satellites]);

useEffect(() => {
  console.log('User orbits changed:', userOrbits.length);
}, [userOrbits]);
```

### Monitor API Calls

In `backend/server.ts`, add:
```typescript
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

---

## Stack Traces

If you see an error with a stack trace, look for:

### React Error Boundaries
```
Error: Failed to add satellite
    at handleAddSatelliteByNorad (App.tsx:823)
```
→ Check line 823 in App.tsx

### Three.js Errors
```
THREE.WebGLRenderer: Context Lost
```
→ WebGL crashed, refresh browser

### satellite.js Errors
```
Propagation error
```
→ Bad TLE data or expired epoch

---

## Emergency Fixes

### Nuclear Option (Reset Everything)

```bash
# Stop all processes
# Delete and reinstall
rm -rf node_modules dist
npm install
npm run dev:all
```

### Reset Browser State

```javascript
// In browser console
localStorage.clear()
sessionStorage.clear()
location.reload()
```

### Backend Reset

```bash
# Kill backend process
pkill -f "tsx watch backend/server.ts"

# Restart
cd Sat-trajectory
npm run dev:server
```

---

## Reporting Bugs

When opening a GitHub issue, include:

1. **Steps to reproduce:**
   ```
   1. Open app
   2. Enter NORAD ID: 25544
   3. Click "Add Satellite"
   4. App crashes
   ```

2. **Console logs:**
   - Open DevTools (F12)
   - Go to Console tab
   - Copy all red errors

3. **Environment:**
   - Browser: Chrome 120
   - OS: Windows 11
   - Node: 18.17.0
   - Date/Time: 2024-10-27 12:00 UTC

4. **Expected vs Actual:**
   - Expected: Satellite adds successfully
   - Actual: App crashes with white screen

---

## Success Indicators

Your app is working correctly when:

✅ Console shows orbit generation logs  
✅ Satellites appear on 3D globe  
✅ Clicking conjunction visualizes it  
✅ Adding custom satellite shows orbit  
✅ Time slider moves satellites smoothly  
✅ No red errors in console  

---

**Still stuck? Open a GitHub issue with details above!** 🚀

