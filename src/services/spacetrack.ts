export type CdmPublic = {
  CDM_ID?: string
  CREATION_DATE?: string
  TCA?: string
  MISS_DISTANCE?: string | number
  RELATIVE_SPEED?: string | number
  OBJECT1?: string
  OBJECT2?: string
  [k: string]: unknown
}

export type CdmItem = {
  object1Name: string
  object2Name: string
  object1Id: string
  object2Id: string
  missDistanceKm?: number
  relativeSpeedKms?: number
  tca?: string
  raw?: any
}

const pickFirst = (obj: any, keys: string[], sanitize?: (v: any) => any) => {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      const v = sanitize ? sanitize(obj[k]) : obj[k]
      return v
    }
  }
  return undefined
}

const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

const normalizeCdmItem = (d: any): CdmItem => {
  const raw = d?.raw || d || {}
  const object1Name = d?.object1Name || d?.object1 || pickFirst(raw, ['OBJECT1_NAME','OBJECT1']) || 'Unknown'
  const object2Name = d?.object2Name || d?.object2 || pickFirst(raw, ['OBJECT2_NAME','OBJECT2']) || 'Unknown'
  const object1Id = String(
    pickFirst(d, ['object1Id','OBJECT1_CATID','OBJECT1_ID'], String) ?? pickFirst(raw, ['OBJECT1_CATID','OBJECT1_ID'], String) ?? ''
  ).replace(/[^0-9]/g,'')
  const object2Id = String(
    pickFirst(d, ['object2Id','OBJECT2_CATID','OBJECT2_ID'], String) ?? pickFirst(raw, ['OBJECT2_CATID','OBJECT2_ID'], String) ?? ''
  ).replace(/[^0-9]/g,'')

  let missDistanceKm = toNum(
    pickFirst(d, ['missDistanceKm','MISS_DISTANCE_KM'], toNum) ?? pickFirst(raw, ['MISS_DISTANCE','MISS_DISTANCE_KM'], toNum)
  )
  if (missDistanceKm === undefined) {
    const meters = toNum((d as any)?.missDistanceMeters) ?? toNum((raw as any)?.missDistanceMeters)
    if (meters !== undefined) missDistanceKm = meters / 1000
  }

  let relativeSpeedKms = toNum(
    pickFirst(d, ['relativeSpeedKms','RELATIVE_SPEED_KMS'], toNum) ?? pickFirst(raw, ['RELATIVE_SPEED','RELATIVE_VELOCITY'], toNum)
  )
  if (relativeSpeedKms === undefined) {
    const v = toNum((d as any)?.relativeSpeedKmS) ?? toNum((raw as any)?.relativeSpeedKmS)
    if (v !== undefined) relativeSpeedKms = v
  }

  const tca = pickFirst(d, ['tca','TCA'], (v) => new Date(v).toISOString()) ?? pickFirst(raw, ['TCA','TIME_TCA'], (v) => new Date(v).toISOString())

  return { object1Name, object2Name, object1Id, object2Id, missDistanceKm, relativeSpeedKms, tca, raw }
}

const fetchJson = async (url: string, timeoutMs = 12000): Promise<any> => {
  const ctl = new AbortController()
  const id = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: { 'accept': 'application/json' }, signal: ctl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(id)
  }
}

const toArray = (j: any): any[] => {
  if (Array.isArray(j)) return j
  if (Array.isArray(j?.items)) return j.items
  if (Array.isArray(j?.results)) return j.results
  if (Array.isArray(j?.data)) return j.data
  return []
}

export async function fetchConjunctions(): Promise<CdmItem[]> {
  const candidates = [
    '/api/conjunctions?range=now-3',
    '/api/spacetrack/conjunctions?range=now-3',
    '/api/conjunctions?range=now-7',
    '/api/spacetrack/conjunctions?range=now-7',
  ]

  for (const url of candidates) {
    try {
      const j = await fetchJson(url)
      const arr = toArray(j)
      if (arr.length > 0) return arr.map(normalizeCdmItem)
    } catch (e) {
      console.warn('CDM fetch failed at', url, e)
    }
  }

  return []
}

export default { fetchConjunctions }


