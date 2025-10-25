import { useEffect, useMemo, useState } from 'react'
import { fetchConjunctions, type CdmPublic } from '../services/spacetrack'

type Conjunction = CdmPublic & { missDistanceMeters?: number; severity: 'red' | 'yellow' | 'green' }

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
    fetchConjunctions(range)
      .then(resp => {
        if (!mounted) return
        if (resp?.normalized && Array.isArray(resp.items)) {
          const withSeverity: Conjunction[] = resp.items.map((it: any) => {
            const md = typeof it.missDistanceMeters === 'number' ? it.missDistanceMeters : parseMissDistanceToMeters(it.raw?.MISS_DISTANCE)
            const severity: 'red' | 'yellow' | 'green' = md !== undefined ? (md < 1000 ? 'red' : md < 5000 ? 'yellow' : 'green') : 'green'
            return { ...it, MISS_DISTANCE: it.missDistanceMeters ?? it.raw?.MISS_DISTANCE, missDistanceMeters: md, severity } as Conjunction
          })
          setData(withSeverity)
        } else if (Array.isArray(resp)) {
          const withSeverity: Conjunction[] = resp.map((item: any) => {
            const md = parseMissDistanceToMeters(item.MISS_DISTANCE)
            const severity: 'red' | 'yellow' | 'green' = md !== undefined ? (md < 1000 ? 'red' : md < 5000 ? 'yellow' : 'green') : 'green'
            return { ...item, missDistanceMeters: md, severity }
          })
          setData(withSeverity)
        } else {
          setData([])
        }
      })
      .catch(e => {
        if (!mounted) return
        setError(String(e?.message || e))
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


