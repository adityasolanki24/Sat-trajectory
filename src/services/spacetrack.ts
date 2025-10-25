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

export async function fetchConjunctions(range: string = 'now-3'): Promise<any> {
  const resp = await fetch(`/api/spacetrack/conjunctions?range=${encodeURIComponent(range)}`)
  if (!resp.ok) throw new Error(`Failed to fetch conjunctions: ${resp.status}`)
  return await resp.json()
}


