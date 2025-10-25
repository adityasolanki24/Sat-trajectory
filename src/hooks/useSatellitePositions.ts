import { useEffect, useState } from 'react';

interface Position {
  satlatitude: number;
  satlongitude: number;
  sataltitude: number;
}

async function fetchWithTimeout(resource: string, options: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 5000, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(resource, { ...rest, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(id);
  }
}

export function useSatellitePositions(
  noradId: number,
  observerLat = 0,
  observerLng = 0,
  observerAlt = 0
) {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiKey = (import.meta as any).env?.VITE_N2YO_API_KEY || (typeof window !== 'undefined' ? (window as any).REACT_APP_N2YO_API_KEY : undefined);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        setError(null);
        // Try dev proxy first to avoid CORS; fallback to direct URL
        const proxyUrl = `/api/n2yo/rest/v1/satellite/positions/${noradId}/${observerLat}/${observerLng}/${observerAlt}/1/&apiKey=${apiKey || ''}`;
        let res = await fetchWithTimeout(proxyUrl, { timeoutMs: 5000 });
        if (!res.ok) {
          // Fallback to direct
          const directUrl = `https://api.n2yo.com/rest/v1/satellite/positions/${noradId}/${observerLat}/${observerLng}/${observerAlt}/1/&apiKey=${apiKey || ''}`;
          res = await fetchWithTimeout(directUrl, { timeoutMs: 5000 });
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const first = data?.positions?.[0];
        if (!first) throw new Error('No positions returned');
        if (mounted) setPosition({
          satlatitude: Number(first.satlatitude),
          satlongitude: Number(first.satlongitude),
          sataltitude: Number(first.sataltitude)
        });
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Failed to fetch');
      }
    }
    run();
    const id = setInterval(run, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, [noradId, observerLat, observerLng, observerAlt, apiKey]);

  return { position, error };
}


