import 'dotenv/config'
import express from 'express'
import axios from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'
import qs from 'qs'

const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 5174

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
    if ((loginResp.data as any)?.Login?.toString?.().toLowerCase?.() === 'failed') {
      res.status(401).json({ error: 'Space-Track login failed' })
      return
    }

    const range = typeof req.query.range === 'string' ? req.query.range : 'now-3'
    const url = `https://www.space-track.org/basicspacedata/query/class/cdm_public/TCA/>${range}/orderby/TCA%20desc/format/json`
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
      const object1 = firstVal(d, [
        'OBJECT1_NAME','OBJECT1','OBJECT_1','PRIMARY_OBJECT','OBJECT1_DESIGNATOR','OBJECT1_CATID','OBJECT1_ID',
        'SAT_1_NAME','SAT_1_ID'
      ])
      const object2 = firstVal(d, [
        'OBJECT2_NAME','OBJECT2','OBJECT_2','SECONDARY_OBJECT','OBJECT2_DESIGNATOR','OBJECT2_CATID','OBJECT2_ID',
        'SAT_2_NAME','SAT_2_ID'
      ])
      const mdUnits = firstVal(d, ['MISS_DISTANCE_UNITS','MISS_DISTANCE_UNIT','MD_UNITS'])
      const rvUnits = firstVal(d, ['RELATIVE_SPEED_UNITS','RELATIVE_VELOCITY_UNITS','V_REL_UNITS'])
      // Some feeds use MIN_RNG (minimum range) with no units; treat as meters if numeric
      const md = parseMeters(firstVal(d, ['MISS_DISTANCE','MISS_DISTANCE_KM','RANGE_AT_TCA','RANGE','MISS_DIST','MD','MIN_RNG']), mdUnits)
      const rv = parseSpeedKmS(firstVal(d, ['RELATIVE_SPEED','RELATIVE_SPEED_KM_S','V_REL','RELATIVE_VELOCITY','TCA_RELATIVE_SPEED']), rvUnits)
      const tca = firstVal(d, ['TCA','TIME_OF_CLOSEST_APPROACH','TCA_TIME'])
      return { id, object1, object2, missDistanceMeters: md ?? null, relativeSpeedKmS: rv ?? null, tca, raw: d }
    })

    res.json({ normalized: true, items })
  } catch (err: any) {
    const status = err?.response?.status || 500
    res.status(status).json({ error: 'Failed to fetch Space-Track CDM', detail: err?.response?.data || err?.message })
  }
})

// Aliases for frontend examples
app.get('/api/conjunctions', async (req, res) => {
  // forward to the main handler with default range now-3
  (req as any).query.range = (typeof req.query.range === 'string' ? req.query.range : 'now-3')
  // reuse code by calling the above handler
  return (app._router as any).handle({ ...req, url: '/api/spacetrack/conjunctions' }, res, () => {})
})

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.listen(port, () => {
  console.log(`[spacetrack-backend] listening on http://localhost:${port}`)
})


