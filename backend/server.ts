import { config } from 'dotenv'
import express from 'express'
import axios from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'
import qs from 'qs'
import OpenAI from 'openai'

// Explicitly load .env file (fixes Windows/tsx watch issues)
config()

const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 5174
app.use(express.json({ limit: '1mb' }))

app.get('/api/spacetrack/conjunctions', async (req, res) => {
  try {
    const identity = process.env.SPACETRACK_USER
    const password = process.env.SPACETRACK_PASS
    if (!identity || !password) {
      res.status(500).json({ error: 'Missing SPACETRACK_USER or SPACETRACK_PASS env vars' })
      return
    }

    const jar = new CookieJar()
    const session = wrapper(axios.create({ jar, withCredentials: true, validateStatus: s => s >= 200 && s < 400 }))

    const loginResp = await session.post('https://www.space-track.org/ajaxauth/login', qs.stringify({ identity, password }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'sat-trajectory-app/1.0',
        'Accept': 'application/json, text/plain, */*'
      }
    })
    const loginFailed = ((loginResp.data as any)?.Login?.toString?.().toLowerCase?.() === 'failed')
    if (loginFailed) {
      res.status(401).json({ error: 'Space-Track login failed' })
      return
    }

    // Support either "range" (past) or a symmetric window in days around now
    const range = typeof req.query.range === 'string' ? req.query.range : null
    const windowDays = Number.parseInt(String(req.query.windowDays || '7'), 10)
    let url: string
    if (range) {
      // past-only, e.g., now-3
      url = `https://www.space-track.org/basicspacedata/query/class/cdm_public/TCA/%3E${encodeURIComponent(range)}/orderby/TCA%20desc/format/json`
    } else {
      // symmetric window: now-<windowDays> .. now+<windowDays>
      const past = `now-${Math.max(1, Math.min(30, windowDays))}`
      const future = `now%2B${Math.max(1, Math.min(30, windowDays))}` // encode '+' as %2B
      url = `https://www.space-track.org/basicspacedata/query/class/cdm_public/TCA/%3E${past}/TCA/%3C${future}/orderby/TCA%20desc/format/json`
    }

    const response = await session.get(url, { headers: { 'Accept': 'application/json' } })

    const data = Array.isArray(response.data) ? response.data : []

    const firstVal = (obj: any, keys: string[]): any => {
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k]
      }
      return undefined
    }
    const parseMeters = (v: any, unitHint?: string): number | undefined => {
      if (v === undefined || v === null) return undefined
      if (typeof v === 'number') return isFinite(v) ? v : undefined
      const s = String(v).toLowerCase().trim()
      if (!s) return undefined
      if (s.endsWith('km')) return Number(s.replace('km','').trim()) * 1000
      if (s.endsWith('m')) return Number(s.replace('m','').trim())
      const n = Number(s)
      if (isFinite(n)) {
        if (unitHint?.toLowerCase() === 'km') return n * 1000
        return n
      }
      return undefined
    }
    const parseSpeedKmS = (v: any, unitHint?: string): number | undefined => {
      if (v === undefined || v === null) return undefined
      if (typeof v === 'number') return isFinite(v) ? v : undefined
      const s = String(v).toLowerCase().trim()
      if (!s) return undefined
      if (s.endsWith('km/s')) return Number(s.replace('km/s','').trim())
      if (s.endsWith('m/s')) return (Number(s.replace('m/s','').trim()) / 1000)
      const n = Number(s)
      if (isFinite(n)) {
        if (unitHint?.toLowerCase() === 'm/s') return n / 1000
        return n
      }
      return undefined
    }

    const items = data.map(d => {
      const id = firstVal(d, ['CDM_ID','ID','REPORT_ID'])
      const object1Name = firstVal(d, [ 'OBJECT1_NAME','OBJECT1','OBJECT_1','PRIMARY_OBJECT','SAT_1_NAME' ])
      const object2Name = firstVal(d, [ 'OBJECT2_NAME','OBJECT2','OBJECT_2','SECONDARY_OBJECT','SAT_2_NAME' ])
      const object1Id = String(firstVal(d, ['SAT_1_ID','OBJECT1_CATID','OBJECT1_ID','CATALOG_ID_1']) || '').replace(/[^0-9]/g,'')
      const object2Id = String(firstVal(d, ['SAT_2_ID','OBJECT2_CATID','OBJECT2_ID','CATALOG_ID_2']) || '').replace(/[^0-9]/g,'')
      const mdUnits = firstVal(d, ['MISS_DISTANCE_UNITS','MISS_DISTANCE_UNIT','MD_UNITS'])
      const rvUnits = firstVal(d, ['RELATIVE_SPEED_UNITS','RELATIVE_VELOCITY_UNITS','V_REL_UNITS'])
      const mdMeters = parseMeters(firstVal(d, ['MISS_DISTANCE','MISS_DISTANCE_KM','RANGE_AT_TCA','RANGE','MISS_DIST','MD','MIN_RNG']), mdUnits)
      const rvKms = parseSpeedKmS(firstVal(d, ['RELATIVE_SPEED','RELATIVE_SPEED_KM_S','V_REL','RELATIVE_VELOCITY','TCA_RELATIVE_SPEED']), rvUnits)
      const tca = firstVal(d, ['TCA','TIME_OF_CLOSEST_APPROACH','TCA_TIME'])
      return {
        id,
        object1: object1Name,
        object2: object2Name,
        object1Name,
        object2Name,
        object1Id,
        object2Id,
        missDistanceMeters: mdMeters ?? null,
        missDistanceKm: typeof mdMeters === 'number' ? mdMeters / 1000 : undefined,
        relativeSpeedKmS: rvKms ?? null,
        relativeSpeedKms: rvKms ?? undefined,
        tca,
        raw: d
      }
    })

    res.json({ normalized: true, items })
  } catch (err: any) {
    const status = err?.response?.status || 500
    res.status(status).json({ error: 'Failed to fetch Space-Track CDM', detail: err?.response?.data || err?.message })
  }
})

app.get('/api/spacetrack/resolve', async (req, res) => {
  try {
    const name = typeof req.query.name === 'string' ? req.query.name.trim() : ''
    if (!name) {
      res.status(400).json({ error: 'Missing name' })
      return
    }
    const identity = process.env.SPACETRACK_USER
    const password = process.env.SPACETRACK_PASS
    if (!identity || !password) {
      res.status(500).json({ error: 'Missing SPACETRACK_USER or SPACETRACK_PASS env vars' })
      return
    }

    const jar = new CookieJar()
    const session = wrapper(axios.create({ jar, withCredentials: true, validateStatus: s => s >= 200 && s < 400 }))

    const loginResp = await session.post('https://www.space-track.org/ajaxauth/login', qs.stringify({ identity, password }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'sat-trajectory-app/1.0',
        'Accept': 'application/json, text/plain, */*'
      }
    })
    const loginFailed = ((loginResp.data as any)?.Login?.toString?.().toLowerCase?.() === 'failed')
    if (loginFailed) {
      res.status(401).json({ error: 'Space-Track login failed' })
      return
    }

    const qName = encodeURIComponent(name)
    const url = `https://www.space-track.org/basicspacedata/query/class/satcat/OBJECT_NAME/${qName}/orderby/NORAD_CAT_ID%20asc/format/json`
    const response = await session.get(url, { headers: { 'Accept': 'application/json' } })
    const arr = Array.isArray(response.data) ? response.data : []
    const exactLower = name.toLowerCase()
    const exact = arr.find((x: any) => String(x?.OBJECT_NAME || '').toLowerCase() === exactLower)
    const best = exact || arr[0]
    if (!best) {
      res.json({ results: [] })
      return
    }
    res.json({
      results: [{ name: best.OBJECT_NAME, noradId: String(best.NORAD_CAT_ID || '').replace(/[^0-9]/g,'') }]
    })
  } catch (err: any) {
    res.status(500).json({ error: 'resolve_failed', detail: err?.response?.data || err?.message })
  }
})

// Aliases for frontend examples
app.get('/api/conjunctions', async (req, res) => {
  ;(req as any).query.range = (typeof req.query.range === 'string' ? req.query.range : 'now-3')
  return (app._router as any).handle({ ...req, url: '/api/spacetrack/conjunctions' }, res, () => {})
})

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// Alternative TLE source using Space-Track (more reliable for automated access)
app.get('/api/tle/satellite/:noradId', async (req, res) => {
  try {
    const { noradId } = req.params
    
    // Try multiple TLE sources in order
    const sources = [
      // 1. Try Space-Track (requires auth but most reliable)
      async () => {
        const identity = process.env.SPACETRACK_USER
        const password = process.env.SPACETRACK_PASS
        if (!identity || !password) return null
        
        const jar = new CookieJar()
        const session = wrapper(axios.create({ jar, withCredentials: true }))
        
        await session.post('https://www.space-track.org/ajaxauth/login', 
          qs.stringify({ identity, password }), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
        
        const tleResp = await session.get(
          `https://www.space-track.org/basicspacedata/query/class/gp/NORAD_CAT_ID/${noradId}/orderby/EPOCH%20desc/limit/1/format/3le`,
          { timeout: 15000 }
        )
        return tleResp.data
      },
      // 2. Try N2YO as backup
      async () => {
        const apiKey = process.env.N2YO_API_KEY
        if (!apiKey) return null
        
        const resp = await axios.get(
          `https://api.n2yo.com/rest/v1/satellite/tle/${noradId}`,
          { 
            params: { apiKey },
            timeout: 15000 
          }
        )
        const tle = resp.data?.tle
        if (tle) {
          return `${resp.data?.info?.satname || `SAT ${noradId}`}\n${tle.split('\n')[0]}\n${tle.split('\n')[1]}`
        }
        return null
      }
    ]
    
    for (const source of sources) {
      try {
        const data = await source()
        if (data) {
          res.set('Content-Type', 'text/plain')
          res.send(data)
          return
        }
      } catch (e) {
        console.log(`TLE source failed, trying next...`)
      }
    }
    
    res.status(404).json({ error: 'No TLE data available', noradId })
  } catch (error: any) {
    console.error('TLE fetch error:', error?.message)
    res.status(500).json({ error: 'Failed to fetch TLE', details: error?.message })
  }
})

// Group TLE endpoint (stations, active, etc.)
app.get('/api/tle/group/:group', async (req, res) => {
  try {
    const { group } = req.params
    const limit = parseInt(req.query.limit as string) || 20
    
    const identity = process.env.SPACETRACK_USER
    const password = process.env.SPACETRACK_PASS
    
    if (!identity || !password) {
      res.status(503).json({ 
        error: 'Space-Track credentials required',
        hint: 'Set SPACETRACK_USER and SPACETRACK_PASS in .env'
      })
      return
    }
    
    const jar = new CookieJar()
    const session = wrapper(axios.create({ jar, withCredentials: true }))
    
    await session.post('https://www.space-track.org/ajaxauth/login', 
      qs.stringify({ identity, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    
    // Map group names to Space-Track queries
    const groupQueries: Record<string, string> = {
      'stations': 'OBJECT_TYPE/PAYLOAD/OBJECT_NAME/~~ISS,TIANGONG,ZARYA/orderby/LAUNCH_DATE%20desc',
      'active': 'DECAY_DATE/null-val/OBJECT_TYPE/PAYLOAD/orderby/LAUNCH_DATE%20desc',
      'starlink': 'OBJECT_NAME/~~STARLINK/orderby/LAUNCH_DATE%20desc',
      'weather': 'OBJECT_NAME/~~NOAA,GOES,METEOR/OBJECT_TYPE/PAYLOAD/orderby/LAUNCH_DATE%20desc'
    }
    
    const query = groupQueries[group.toLowerCase()] || groupQueries['active']
    
    const resp = await session.get(
      `https://www.space-track.org/basicspacedata/query/class/gp/${query}/limit/${limit}/format/json`,
      { timeout: 20000 }
    )
    
    const satellites = Array.isArray(resp.data) ? resp.data : []
    const formatted = satellites.map((s: any) => ({
      OBJECT_NAME: s.OBJECT_NAME,
      NORAD_CAT_ID: s.NORAD_CAT_ID,
      TLE_LINE1: s.TLE_LINE1,
      TLE_LINE2: s.TLE_LINE2,
      EPOCH: s.EPOCH,
      MEAN_MOTION: s.MEAN_MOTION,
      ECCENTRICITY: s.ECCENTRICITY,
      INCLINATION: s.INCLINATION,
      RA_OF_ASC_NODE: s.RA_OF_ASC_NODE,
      ARG_OF_PERICENTER: s.ARG_OF_PERICENTER,
      MEAN_ANOMALY: s.MEAN_ANOMALY
    }))
    
    res.json(formatted)
  } catch (error: any) {
    console.error('Group TLE fetch error:', error?.message)
    res.status(error?.response?.status || 500).json({ 
      error: 'Failed to fetch group TLEs',
      details: error?.message 
    })
  }
})

// Keep old celestrak endpoint for compatibility but mark as deprecated
app.get('/api/celestrak/*', async (req, res) => {
  res.status(503).json({ 
    error: 'CelesTrak endpoint deprecated',
    message: 'Use /api/tle/satellite/:noradId or /api/tle/group/:group instead'
  })
})

// Simple assistant route – returns safe JSON suggestions
app.post('/api/assistant', async (req, res) => {
  try {
    const { state, userMessage, trigger } = req.body || {}

    // Check for AI/ML API, OpenRouter, or OpenAI key
    const aimlApiKey = process.env.AIML_API_KEY
    const openRouterKey = process.env.OPENROUTER_API_KEY
    const openAIKey = process.env.OPENAI_API_KEY
    
    // DEMO MODE: If no API key, use intelligent rule-based responses
    const demoMode = !aimlApiKey && !openRouterKey && !openAIKey
    
    if (demoMode) {
      console.log('[AI DEMO MODE] Using rule-based assistant for demonstration')
      
      // Intelligent demo responses based on trigger type
      if (trigger === 'collision_alert' && state?.detectedCollisionRisks?.length > 0) {
        const risk = state.detectedCollisionRisks[0]
        const altChange = risk.missDistanceKm < 0.5 ? 8 : risk.missDistanceKm < 1 ? 5 : 3
        
        return res.json({
          title: 'COLLISION ALERT DETECTED',
          rationale: `Critical conjunction with ${risk.targetName} detected at ${risk.missDistanceKm.toFixed(2)}km miss distance. Risk level: ${risk.riskLevel}. Immediate altitude adjustment of +${altChange}km recommended to ensure safe separation and avoid potential collision.`,
          commands: [
            { name: 'openOrbitControl', args: { satelliteId: state.selectedSatelliteId || state.satellites[0]?.id, suggestedManeuver: { altitudeChange: altChange, inclinationChange: 0, raanChange: 0 } } },
            { name: 'focusSatellite', args: { id: state.selectedSatelliteId || state.satellites[0]?.id } }
          ]
        })
      }
      
      if (trigger === 'space_weather_alert' && state?.spaceWeatherThreats?.length > 0) {
        const threat = state.spaceWeatherThreats[state.spaceWeatherThreats.length - 1]
        const measures = threat.eventType.includes('CME') || threat.eventType.includes('Solar') 
          ? 'Power down non-essential systems, enable radiation shielding mode, reorient solar panels to minimize exposure'
          : threat.eventType.includes('Geomagnetic')
          ? 'Monitor attitude control systems, prepare for communication disruption, consider orbit adjustment to reduce drag'
          : 'Activate radiation hardening protocols, reduce electronics usage, enter safe mode if radiation levels critical'
        
        return res.json({
          title: 'SPACE WEATHER THREAT DETECTED',
          rationale: `${threat.eventType} (${threat.severity} severity) affecting tracked satellites: ${threat.affectedSatellites.join(', ')}. Protective measures: ${measures}`,
          commands: [
            { name: 'focusSatellite', args: { id: state.satellites[0]?.id } }
          ]
        })
      }
      
      // General helpful responses
      const lowerMsg = (userMessage || '').toLowerCase()
      if (lowerMsg.includes('orbit') || lowerMsg.includes('show')) {
        return res.json({
          title: 'Display Satellite Orbits',
          rationale: 'Enabling orbit visualization to show satellite trajectories and paths.',
          commands: [{ name: 'toggleOrbits', args: { on: true } }]
        })
      }
      
      if (lowerMsg.includes('now') || lowerMsg.includes('current') || lowerMsg.includes('reset')) {
        return res.json({
          title: 'Reset to Current Time',
          rationale: 'Jumping to current time to view real-time satellite positions and potential conjunctions.',
          commands: [{ name: 'jumpToNow', args: {} }]
        })
      }
      
      // Default welcome response
      return res.json({
        title: 'AI Operations Assistant Ready',
        rationale: 'Welcome to the satellite operations control system. I can help with collision detection, orbit adjustments, and space weather monitoring. Try viewing orbits or checking for conjunctions.',
        commands: [
          { name: 'toggleOrbits', args: { on: true } },
          { name: 'jumpToNow', args: {} }
        ]
      })
    }

    // Use AI/ML API if available (best free tier), then OpenRouter, then OpenAI
    const oa = new OpenAI({ 
      apiKey: aimlApiKey || openRouterKey || openAIKey,
      baseURL: aimlApiKey ? 'https://api.aimlapi.com/v1' : (openRouterKey ? 'https://openrouter.ai/api/v1' : undefined)
    })

    const system = `You are a satellite operations safety assistant. Return JSON with commands.
Format: {"title":"string","rationale":"string","commands":[{"name":"command","args":{}}]}

Commands:
- toggleOrbits (args: {on:true/false}) - toggle orbit visibility
- jumpToNow (no args) - reset to current time
- focusSatellite (args: {id:"string"}) - select a satellite
- openOrbitControl (args: {satelliteId:"string", suggestedManeuver: {altitudeChange:number, inclinationChange:number, raanChange:number}}) - open orbit control panel

COLLISION ALERTS (HIGH/CRITICAL):
1. Explain conjunction risk with miss distance and TCA
2. Calculate avoidance maneuver:
   - Miss distance < 1km: +2 to +5 km altitude
   - Miss distance < 0.5km: +5 to +10 km altitude (critical)
3. Suggest: openOrbitControl with maneuver parameters

SPACE WEATHER ALERTS (Critical/High):
Recommend protective actions based on event type:
- CME/Solar Flare: "Power down non-essential systems, enable radiation shielding mode, reorient to minimize solar panel exposure"
- Geomagnetic Storm: "Adjust orbit altitude to reduce drag, monitor attitude control, prepare for communication disruption"
- Radiation Event: "Activate radiation hardening protocols, reduce electronics usage, safe mode if needed"

Example space weather: {"title":"SPACE WEATHER ALERT","rationale":"Critical CME affecting ISS. Immediate protective measures required: power down non-critical systems, enable radiation mode, reorient solar panels.","commands":[{"name":"focusSatellite","args":{"id":"25544"}}]}`

    // Build detailed prompt for different alert types
    let userPrompt = ''
    if (trigger === 'collision_alert' && state?.detectedCollisionRisks?.length > 0) {
      const risk = state.detectedCollisionRisks[0]
      userPrompt = `COLLISION ALERT: ${risk.targetName} detected at ${risk.missDistanceKm}km miss distance, TCA in ${Math.abs((new Date(risk.tcaDate).getTime() - Date.now()) / 60000).toFixed(0)} minutes. Risk level: ${risk.riskLevel}. Tracked satellite needs immediate action. State: ${JSON.stringify(state).substring(0, 400)}`
    } else if (trigger === 'space_weather_alert' && state?.spaceWeatherThreats?.length > 0) {
      const threat = state.spaceWeatherThreats[state.spaceWeatherThreats.length - 1]
      userPrompt = `SPACE WEATHER ALERT: ${threat.eventType} (${threat.severity}) affecting tracked satellites: ${threat.affectedSatellites.join(', ')}. Description: ${threat.description}. Recommend protective measures: power down non-critical systems, enable radiation hardening mode, reorient solar panels, or adjust orbit to minimize exposure. State: ${JSON.stringify(state).substring(0, 400)}`
    } else {
      userPrompt = `User said: "${userMessage || 'hi'}". State: ${JSON.stringify(state).substring(0, 200)}. Suggest 1 helpful command.`
    }

    // Choose model based on provider
    const model = aimlApiKey
      ? 'google/gemma-2-9b-it' // AI/ML API - Gemma 2 9B (closest to Gemma 3 12B)
      : (openRouterKey 
        ? 'google/gemini-2.0-flash-exp:free' 
        : 'gpt-4o-mini')
    
    console.log(`Using model: ${model}`)
    
    const r = await oa.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3
    })

    const content = r.choices?.[0]?.message?.content || '{}'
    console.log('AI Response:', content)
    
    let parsed
    try {
      // Try to extract JSON from markdown code blocks if present
      let jsonStr = content
      const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1]
      }
      
      // Try to fix common JSON errors
      jsonStr = jsonStr
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":') // Fix unquoted keys
        .replace(/"openOrbitControl":\s*\{/g, '{"name":"openOrbitControl","args":{') // Fix malformed openOrbitControl
      
      parsed = JSON.parse(jsonStr)
    } catch (parseErr) {
      console.error('Failed to parse AI response:', parseErr)
      console.error('Raw content:', content)
      // Fallback with a helpful command
      return res.json({
        title: 'Assistant Response',
        rationale: 'Unable to process AI response. Please try again.',
        commands: []
      })
    }
    
    // Ensure commands array exists and is valid
    if (!parsed.commands || !Array.isArray(parsed.commands)) {
      parsed.commands = []
    }
    
    // Validate each command has a name
    parsed.commands = parsed.commands.filter((cmd: any) => cmd && cmd.name)
    
    return res.json(parsed)
  } catch (e: any) {
    // Gracefully handle quota/rate limit errors
    if (e?.status === 429 || e?.code === 'insufficient_quota') {
      console.warn('[AI] API quota exceeded - assistant disabled')
      return res.json({ 
        title: 'AI Assistant Unavailable', 
        rationale: 'API quota exceeded. The AI assistant is temporarily disabled. Manual controls remain fully functional.', 
        commands: [] 
      })
    }
    
    // Handle invalid API key / bad request errors
    if (e?.status === 400 || e?.status === 401 || e?.status === 403) {
      console.warn('[AI] API authentication/validation error - falling back to demo mode')
      console.error('Error:', e?.status, e?.message)
      
      // Return demo mode response
      return res.json({
        title: 'AI Operations Assistant (Demo Mode)',
        rationale: 'AI API unavailable. Using rule-based assistant for demonstration. All manual controls fully functional.',
        commands: [
          { name: 'toggleOrbits', args: { on: true } },
          { name: 'jumpToNow', args: {} }
        ]
      })
    }
    
    console.error('assistant_failed', e?.message || e)
    return res.json({ 
      title: 'Assistant Fallback', 
      rationale: 'AI assistant unavailable. Manual controls still work.', 
      commands: [] 
    })
  }
})

// NASA DONKI API proxy for space weather data
app.get('/api/donki/*', async (req, res) => {
  try {
    const donkiPath = req.params[0]
    const queryString = req.url.split('?')[1] || ''
    const donkiUrl = `https://api.nasa.gov/DONKI/${donkiPath}?${queryString}&api_key=DEMO_KEY`
    
    console.log(`[DONKI] Fetching: ${donkiPath}`)
    
    const response = await fetch(donkiUrl)
    const data = await response.json()
    
    if (!response.ok) {
      console.error('[DONKI] API error:', response.status, data)
      return res.status(response.status).json(data)
    }
    
    res.json(data)
  } catch (error: any) {
    console.error('[DONKI] Proxy error:', error.message)
    res.status(500).json({ error: 'Failed to fetch space weather data' })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.listen(port, () => {
  console.log(`[spacetrack-backend] listening on http://localhost:${port}`)
})


