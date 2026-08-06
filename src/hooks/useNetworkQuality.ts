/**
 * Network quality detector using the Network Information API
 * and a lightweight bandwidth probe.
 * Returns: 'fast' | 'medium' | 'slow' | 'unknown'
 */
import { useState, useEffect, useRef } from 'react';

export type NetworkQuality = 'fast' | 'medium' | 'slow' | 'unknown';

interface NetworkInfoConnection {
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function getConnectionInfo(): NetworkInfoConnection | null {
  const nav = navigator as Navigator & { connection?: NetworkInfoConnection; mozConnection?: NetworkInfoConnection; webkitConnection?: NetworkInfoConnection };
  return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

function classifyQuality(conn: NetworkInfoConnection | null, measuredMbps?: number): NetworkQuality {
  if (measuredMbps !== undefined) {
    if (measuredMbps >= 5)  return 'fast';
    if (measuredMbps >= 1)  return 'medium';
    if (measuredMbps > 0)   return 'slow';
  }
  if (!conn) return 'unknown';
  if (conn.saveData)          return 'slow';
  const et = conn.effectiveType;
  if (et === '4g')            return conn.downlink && conn.downlink >= 5 ? 'fast' : 'medium';
  if (et === '3g')            return 'medium';
  if (et === '2g' || et === 'slow-2g') return 'slow';
  if (conn.downlink) {
    if (conn.downlink >= 5)   return 'fast';
    if (conn.downlink >= 1)   return 'medium';
    return 'slow';
  }
  return 'unknown';
}

// Map quality to HLS startLevel preference
export function qualityToHlsLevel(quality: NetworkQuality): number {
  // -1 = auto ABR, but we bias the initial estimate
  return -1; // always auto — HLS.js handles ABR correctly
}

export function qualityToInitialBitrate(quality: NetworkQuality): number {
  switch (quality) {
    case 'fast':    return 4_000_000;  // 4 Mbps — start high
    case 'medium':  return 1_500_000;  // 1.5 Mbps
    case 'slow':    return 400_000;    // 400 kbps
    default:        return 1_500_000;
  }
}

export function useNetworkQuality(): NetworkQuality {
  const [quality, setQuality] = useState<NetworkQuality>('unknown');
  const probeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const conn = getConnectionInfo();

    const update = () => {
      setQuality(classifyQuality(getConnectionInfo()));
    };

    // Initial from Network API
    update();

    // Listen for changes
    if (conn?.addEventListener) {
      conn.addEventListener('change', update);
    }

    // Lightweight bandwidth probe every 30 seconds
    const probe = async () => {
      try {
        const start = performance.now();
        // Fetch a small known-size resource (iptv-org favicon ~4KB)
        const res = await fetch('https://iptv-org.github.io/iptv/categories/news.m3u', {
          method: 'HEAD',
          cache:  'no-store',
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const elapsed = (performance.now() - start) / 1000;
          // HEAD response has no body — use RTT as proxy
          const rttMs = elapsed * 1000;
          const estQuality: NetworkQuality = rttMs < 200 ? 'fast' : rttMs < 600 ? 'medium' : 'slow';
          setQuality(estQuality);
        }
      } catch {
        // network error — don't change quality rating
      }
      probeTimer.current = setTimeout(probe, 30_000);
    };

    probeTimer.current = setTimeout(probe, 5_000);

    return () => {
      if (conn?.removeEventListener) conn.removeEventListener('change', update);
      clearTimeout(probeTimer.current);
    };
  }, []);

  return quality;
}
