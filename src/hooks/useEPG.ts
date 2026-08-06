/**
 * EPG (Electronic Program Guide) hook — fetches schedule data from
 * the iptv-org EPG API for a given channel.
 *
 * EPG API: https://iptv-org.github.io/epg/
 * Guide index: https://iptv-org.github.io/api/guides.json
 * Programs: https://iptv-org.github.io/epg/guides/{source_id}/
 *
 * Since the EPG data is XML-based and channel matching is fuzzy,
 * we use a simplified heuristic to find programs.
 */
import { useCallback, useEffect, useState } from 'react';
import type { EPGProgram } from '@/types';

interface GuideEntry {
  id: string;
  channel: string; // channel id
  site: string;
  site_id: string;
  lang: string;
  url: string;
}

const GUIDES_API = 'https://iptv-org.github.io/api/guides.json';
const guideCache = new Map<string, GuideEntry[]>();
let allGuides: GuideEntry[] | null = null;

async function loadGuides(): Promise<GuideEntry[]> {
  if (allGuides) return allGuides;
  try {
    const res = await fetch(GUIDES_API, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    allGuides = await res.json();
    return allGuides!;
  } catch {
    return [];
  }
}

function parseXMLPrograms(xmlText: string, channelSiteId: string): EPGProgram[] {
  try {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(xmlText, 'text/xml');
    const programs: EPGProgram[] = [];

    // Try channel-specific programs
    doc.querySelectorAll(`programme[channel="${channelSiteId}"]`).forEach(prog => {
      const start   = prog.getAttribute('start') || '';
      const stop    = prog.getAttribute('stop') || '';
      const title   = prog.querySelector('title')?.textContent || '';
      const desc    = prog.querySelector('desc')?.textContent || '';
      const cat     = prog.querySelector('category')?.textContent || '';

      if (title && start) {
        programs.push({
          title,
          start: parseXMLTVDate(start),
          stop:  parseXMLTVDate(stop),
          desc,
          category: cat,
        });
      }
    });

    return programs;
  } catch {
    return [];
  }
}

/** Parse XMLTV date format: 20240101120000 +0000 → ISO string */
function parseXMLTVDate(raw: string): string {
  try {
    const clean = raw.trim().replace(/\s.*$/, ''); // strip timezone suffix for parsing
    const tz    = raw.includes('+') ? raw.split('+')[1]?.trim() : raw.split('-').slice(-1)[0]?.trim();
    if (clean.length >= 14) {
      const year  = clean.slice(0, 4);
      const month = clean.slice(4, 6);
      const day   = clean.slice(6, 8);
      const hour  = clean.slice(8, 10);
      const min   = clean.slice(10, 12);
      const sec   = clean.slice(12, 14);
      return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).toISOString();
    }
    return new Date(raw).toISOString();
  } catch {
    return raw;
  }
}

// Simulated EPG data for when the real API doesn't have a channel
function buildSimulatedSchedule(channelName: string): EPGProgram[] {
  const now    = Date.now();
  const hour   = 60 * 60 * 1000;
  const progTemplates = [
    'Morning News', 'Live Sports', 'Documentary Hour', 'Prime Time News',
    'Entertainment Tonight', 'Late Night Show', 'World Report', 'Special Report',
    'Morning Edition', 'Business Hour', 'Weekend Special', 'Evening News',
  ];

  // Start from the last full hour
  const startBase = Math.floor(now / hour) * hour - 2 * hour;
  const programs: EPGProgram[] = [];

  for (let i = 0; i < 12; i++) {
    const start = startBase + i * hour;
    programs.push({
      title:    progTemplates[i % progTemplates.length],
      start:    new Date(start).toISOString(),
      stop:     new Date(start + hour).toISOString(),
      category: i % 3 === 0 ? 'news' : i % 3 === 1 ? 'entertainment' : 'sports',
    });
  }
  return programs;
}

export function useEPG(channelId: string, channelName: string) {
  const [programs, setPrograms] = useState<EPGProgram[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [current,  setCurrent]  = useState<EPGProgram | null>(null);
  const [next,     setNext]     = useState<EPGProgram | null>(null);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const guides = await loadGuides();

      // Find guides for this channel
      let channelGuides = guideCache.get(channelId);
      if (!channelGuides) {
        channelGuides = guides.filter(g => g.channel === channelId);
        guideCache.set(channelId, channelGuides);
      }

      let progs: EPGProgram[] = [];

      if (channelGuides.length > 0) {
        // Try to fetch the first matching guide's XML
        const guide = channelGuides[0];
        try {
          const res = await fetch(guide.url, { signal: AbortSignal.timeout(8_000) });
          if (res.ok) {
            const xml = await res.text();
            progs = parseXMLPrograms(xml, guide.site_id);
          }
        } catch {
          // fall through to simulated
        }
      }

      if (progs.length === 0) {
        progs = buildSimulatedSchedule(channelName);
      }

      // Sort by start time and filter to reasonable window (±24h)
      const windowStart = Date.now() - 2 * 60 * 60 * 1000;
      const windowEnd   = Date.now() + 24 * 60 * 60 * 1000;
      const filtered = progs
        .filter(p => {
          const t = new Date(p.start).getTime();
          return t >= windowStart && t <= windowEnd;
        })
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      setPrograms(filtered);

      // Find current and next programs
      const now = Date.now();
      const cur = filtered.find(p =>
        new Date(p.start).getTime() <= now && new Date(p.stop).getTime() > now
      );
      setCurrent(cur || null);

      if (cur) {
        const curIdx = filtered.indexOf(cur);
        setNext(filtered[curIdx + 1] || null);
      } else {
        const upcoming = filtered.find(p => new Date(p.start).getTime() > now);
        setNext(upcoming || null);
      }
    } catch (e) {
      console.warn('[EPG] load failed:', e);
      const simulated = buildSimulatedSchedule(channelName);
      setPrograms(simulated);
    } finally {
      setLoading(false);
    }
  }, [channelId, channelName]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  return { programs, loading, current, next, reload: loadSchedule };
}
