/**
 * Stream health checker — tries fetching the first few bytes of an HLS
 * manifest URL.  Returns 'online' | 'offline' | 'checking'.
 */
import { useState, useEffect, useRef } from 'react';

export type HealthStatus = 'online' | 'offline' | 'checking' | 'unknown';

const CACHE = new Map<string, { status: HealthStatus; ts: number }>();
const TTL   = 5 * 60 * 1000; // 5 minutes

export async function checkStreamHealth(url: string): Promise<HealthStatus> {
  const cached = CACHE.get(url);
  if (cached && Date.now() - cached.ts < TTL) return cached.status;

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);
    const res        = await fetch(url, { signal: controller.signal, method: 'HEAD', cache: 'no-store' });
    clearTimeout(timeout);
    const status: HealthStatus = res.ok ? 'online' : 'offline';
    CACHE.set(url, { status, ts: Date.now() });
    return status;
  } catch {
    const status: HealthStatus = 'offline';
    CACHE.set(url, { status, ts: Date.now() });
    return status;
  }
}

export function useStreamHealth(url: string, enabled = true) {
  const [status, setStatus] = useState<HealthStatus>('unknown');
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (!enabled || !url) { setStatus('unknown'); return; }
    setStatus('checking');
    checkStreamHealth(url).then(s => { if (isMounted.current) setStatus(s); });
    return () => { isMounted.current = false; };
  }, [url, enabled]);

  return status;
}
