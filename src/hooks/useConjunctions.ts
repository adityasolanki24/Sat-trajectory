import { useEffect, useMemo, useState } from 'react'
import { fetchConjunctions, type CdmPublic } from '../services/spacetrack'

type Conjunction = CdmPublic & { missDistanceMeters?: number; severity: 'red' | 'yellow' | 'green'; missDistanceKm?: number; relativeSpeedKms?: number }

function parseMissDistanceToMeters(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().toLowerCase()
  if (trimmed.endsWith('km')) {
    const n = Number(trimmed.replace('km', '').trim())
    return isFinite(n) ? n * 1000 : undefined
  }
  if (trimmed.endsWith('m')) {
    const n = Number(trimmed.replace('m', '').trim())
    return isFinite(n) ? n : undefined
  }
  const n = Number(trimmed)
  return isFinite(n) ? n : undefined
}

export function useConjunctions(range: string = 'now-3') {
  const [data, setData] = useState<Conjunction[] | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    fetchConjunctions()
      .then(resp => {
        if (!mounted) return
        if (Array.isArray(resp)) {
          const withSeverity: Conjunction[] = resp.map((it: any) => {
            const mdKm = typeof it.missDistanceKm === 'number' ? it.missDistanceKm : (typeof it.missDistanceMeters === 'number' ? it.missDistanceMeters / 1000 : undefined)
            const rvKms = typeof it.relativeSpeedKms === 'number' ? it.relativeSpeedKms : undefined
            const mdMeters = typeof it.missDistanceMeters === 'number' ? it.missDistanceMeters : (typeof mdKm === 'number' ? mdKm * 1000 : parseMissDistanceToMeters(it?.raw?.MISS_DISTANCE))
            const severity: 'red' | 'yellow' | 'green' = mdMeters !== undefined ? (mdMeters < 1000 ? 'red' : mdMeters < 5000 ? 'yellow' : 'green') : 'green'
            return { ...it, missDistanceMeters: mdMeters, missDistanceKm: mdKm, relativeSpeedKms: rvKms, severity }
          })
          setData(withSeverity)
        } else if (resp && typeof resp === 'object' && 'normalized' in resp && 'items' in resp && Array.isArray((resp as any).items)) {
          const withSeverity: Conjunction[] = ((resp as any).items as any[]).map((it: any) => {
            const mdKm = typeof it.missDistanceKm === 'number' ? it.missDistanceKm : (typeof it.missDistanceMeters === 'number' ? it.missDistanceMeters / 1000 : undefined)
            const rvKms = typeof it.relativeSpeedKms === 'number' ? it.relativeSpeedKms : undefined
            const mdMeters = typeof it.missDistanceMeters === 'number' ? it.missDistanceMeters : (typeof mdKm === 'number' ? mdKm * 1000 : parseMissDistanceToMeters(it?.raw?.MISS_DISTANCE))
            const severity: 'red' | 'yellow' | 'green' = mdMeters !== undefined ? (mdMeters < 1000 ? 'red' : mdMeters < 5000 ? 'yellow' : 'green') : 'green'
            return { ...it, MISS_DISTANCE: it.missDistanceMeters ?? it.raw?.MISS_DISTANCE, missDistanceMeters: mdMeters, missDistanceKm: mdKm, relativeSpeedKms: rvKms, severity } as Conjunction
          })
          setData(withSeverity)
        } else {
          setData([])
        }
      })
      .catch(e => {
        if (!mounted) return
        console.warn('Conjunctions load failed, showing empty.', e)
        setData([])
        setError(null)
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [range])

  const summary = useMemo(() => {
    if (!data) return null
    const counts = data.reduce(
      (acc, d) => {
        acc[d.severity] += 1
        return acc
      },
      { red: 0, yellow: 0, green: 0 } as { red: number; yellow: number; green: number }
    )
    return counts
  }, [data])

  return { data, loading, error, summary }
}


