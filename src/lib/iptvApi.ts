import type { IPTVChannel, ChannelPage } from '@/types';
import { PAGE_SIZE } from '@/constants/categories';

// ── Primary JSON API ──────────────────────────────────────────────────────────
const CHANNELS_API = 'https://iptv-org.github.io/api/channels.json';
const STREAMS_API  = 'https://iptv-org.github.io/api/streams.json';

// ── Community curated M3U sources (loaded first for fast startup) ─────────────
const FAST_SOURCES: Array<[string, string]> = [
  ['freetv',     'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8'],
  ['int-backup', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/int.m3u'],
  ['news',       'https://iptv-org.github.io/iptv/categories/news.m3u'],
  ['sports',     'https://iptv-org.github.io/iptv/categories/sports.m3u'],
  ['entertainment', 'https://iptv-org.github.io/iptv/categories/entertainment.m3u'],
  ['music',      'https://iptv-org.github.io/iptv/categories/music.m3u'],
  ['us',         'https://iptv-org.github.io/iptv/countries/us.m3u'],
  ['gb',         'https://iptv-org.github.io/iptv/countries/gb.m3u'],
  ['fr',         'https://iptv-org.github.io/iptv/countries/fr.m3u'],
  ['de',         'https://iptv-org.github.io/iptv/countries/de.m3u'],
  ['br',         'https://iptv-org.github.io/iptv/countries/br.m3u'],
  ['in',         'https://iptv-org.github.io/iptv/countries/in.m3u'],
  ['ng',         'https://iptv-org.github.io/iptv/countries/ng.m3u'],
  ['za',         'https://iptv-org.github.io/iptv/countries/za.m3u'],
  ['anik-bd',    'https://raw.githubusercontent.com/aniksarakash/IPTV/main/playlist.m3u8'],
  // Extra sources for 100k+ channels
  ['tv-af',      'https://iptv-org.github.io/iptv/countries/af.m3u'],
  ['tv-dz',      'https://iptv-org.github.io/iptv/countries/dz.m3u'],
  ['tv-ao',      'https://iptv-org.github.io/iptv/countries/ao.m3u'],
  ['tv-ar',      'https://iptv-org.github.io/iptv/countries/ar.m3u'],
  ['tv-au',      'https://iptv-org.github.io/iptv/countries/au.m3u'],
  ['tv-bd',      'https://iptv-org.github.io/iptv/countries/bd.m3u'],
  ['tv-ca',      'https://iptv-org.github.io/iptv/countries/ca.m3u'],
  ['tv-cn',      'https://iptv-org.github.io/iptv/countries/cn.m3u'],
  ['tv-co',      'https://iptv-org.github.io/iptv/countries/co.m3u'],
  ['tv-eg',      'https://iptv-org.github.io/iptv/countries/eg.m3u'],
  ['tv-et',      'https://iptv-org.github.io/iptv/countries/et.m3u'],
  ['tv-gh',      'https://iptv-org.github.io/iptv/countries/gh.m3u'],
  ['tv-id',      'https://iptv-org.github.io/iptv/countries/id.m3u'],
  ['tv-ir',      'https://iptv-org.github.io/iptv/countries/ir.m3u'],
  ['tv-iq',      'https://iptv-org.github.io/iptv/countries/iq.m3u'],
  ['tv-it',      'https://iptv-org.github.io/iptv/countries/it.m3u'],
  ['tv-jp',      'https://iptv-org.github.io/iptv/countries/jp.m3u'],
  ['tv-ke',      'https://iptv-org.github.io/iptv/countries/ke.m3u'],
  ['tv-kr',      'https://iptv-org.github.io/iptv/countries/kr.m3u'],
  ['tv-kw',      'https://iptv-org.github.io/iptv/countries/kw.m3u'],
  ['tv-ly',      'https://iptv-org.github.io/iptv/countries/ly.m3u'],
  ['tv-ma',      'https://iptv-org.github.io/iptv/countries/ma.m3u'],
  ['tv-mx',      'https://iptv-org.github.io/iptv/countries/mx.m3u'],
  ['tv-mm',      'https://iptv-org.github.io/iptv/countries/mm.m3u'],
  ['tv-np',      'https://iptv-org.github.io/iptv/countries/np.m3u'],
  ['tv-nl',      'https://iptv-org.github.io/iptv/countries/nl.m3u'],
  ['tv-pk',      'https://iptv-org.github.io/iptv/countries/pk.m3u'],
  ['tv-ph',      'https://iptv-org.github.io/iptv/countries/ph.m3u'],
  ['tv-pl',      'https://iptv-org.github.io/iptv/countries/pl.m3u'],
  ['tv-pt',      'https://iptv-org.github.io/iptv/countries/pt.m3u'],
  ['tv-qa',      'https://iptv-org.github.io/iptv/countries/qa.m3u'],
  ['tv-ro',      'https://iptv-org.github.io/iptv/countries/ro.m3u'],
  ['tv-ru',      'https://iptv-org.github.io/iptv/countries/ru.m3u'],
  ['tv-sa',      'https://iptv-org.github.io/iptv/countries/sa.m3u'],
  ['tv-sd',      'https://iptv-org.github.io/iptv/countries/sd.m3u'],
  ['tv-sn',      'https://iptv-org.github.io/iptv/countries/sn.m3u'],
  ['tv-so',      'https://iptv-org.github.io/iptv/countries/so.m3u'],
  ['tv-es',      'https://iptv-org.github.io/iptv/countries/es.m3u'],
  ['tv-lk',      'https://iptv-org.github.io/iptv/countries/lk.m3u'],
  ['tv-sy',      'https://iptv-org.github.io/iptv/countries/sy.m3u'],
  ['tv-tz',      'https://iptv-org.github.io/iptv/countries/tz.m3u'],
  ['tv-th',      'https://iptv-org.github.io/iptv/countries/th.m3u'],
  ['tv-tn',      'https://iptv-org.github.io/iptv/countries/tn.m3u'],
  ['tv-tr',      'https://iptv-org.github.io/iptv/countries/tr.m3u'],
  ['tv-ug',      'https://iptv-org.github.io/iptv/countries/ug.m3u'],
  ['tv-ua',      'https://iptv-org.github.io/iptv/countries/ua.m3u'],
  ['tv-ae',      'https://iptv-org.github.io/iptv/countries/ae.m3u'],
  ['tv-vn',      'https://iptv-org.github.io/iptv/countries/vn.m3u'],
  ['tv-ye',      'https://iptv-org.github.io/iptv/countries/ye.m3u'],
  ['tv-zm',      'https://iptv-org.github.io/iptv/countries/zm.m3u'],
  ['tv-zw',      'https://iptv-org.github.io/iptv/countries/zw.m3u'],
  // Extra categories for deeper coverage
  ['cat-general',    'https://iptv-org.github.io/iptv/categories/general.m3u'],
  ['cat-documentary','https://iptv-org.github.io/iptv/categories/documentary.m3u'],
  ['cat-kids',       'https://iptv-org.github.io/iptv/categories/kids.m3u'],
  ['cat-movies',     'https://iptv-org.github.io/iptv/categories/movies.m3u'],
  ['cat-religious',  'https://iptv-org.github.io/iptv/categories/religious.m3u'],
  ['cat-travel',     'https://iptv-org.github.io/iptv/categories/travel.m3u'],
  ['cat-business',   'https://iptv-org.github.io/iptv/categories/business.m3u'],
  ['cat-lifestyle',  'https://iptv-org.github.io/iptv/categories/lifestyle.m3u'],
  // Region coverage
  ['reg-afr',   'https://iptv-org.github.io/iptv/regions/afr.m3u'],
  ['reg-amer',  'https://iptv-org.github.io/iptv/regions/amer.m3u'],
  ['reg-asia',  'https://iptv-org.github.io/iptv/regions/asia.m3u'],
  ['reg-arab',  'https://iptv-org.github.io/iptv/regions/arab.m3u'],
  ['reg-eur',   'https://iptv-org.github.io/iptv/regions/eur.m3u'],
  ['reg-mea',   'https://iptv-org.github.io/iptv/regions/mea.m3u'],
  ['reg-samer', 'https://iptv-org.github.io/iptv/regions/samer.m3u'],
  ['reg-seasia','https://iptv-org.github.io/iptv/regions/seasia.m3u'],
  // Lukmanika extra feeds
  ['luk-1', 'https://raw.githubusercontent.com/Lukmanika/iptv_public/main/IPTV_list.m3u'],
];

// ── All iptv-org country codes (250+) ─────────────────────────────────────────
const COUNTRY_CODES = [
  'ad','ae','af','ag','ai','al','am','ao','ar','as','at','au','aw','az',
  'ba','bb','bd','be','bf','bg','bh','bi','bj','bm','bn','bo','bq','br',
  'bs','bt','bw','by','bz','ca','cd','cf','cg','ch','ci','ck','cl','cm',
  'cn','co','cr','cu','cv','cw','cy','cz','de','dj','dk','dm','do','dz',
  'ec','ee','eg','er','es','et','fi','fj','fk','fm','fo','fr','ga','gb',
  'gd','ge','gf','gh','gi','gl','gm','gn','gp','gq','gr','gs','gt','gu',
  'gw','gy','hk','hn','hr','ht','hu','id','ie','il','in','iq','ir','is',
  'it','jm','jo','jp','ke','kg','kh','ki','km','kn','kp','kr','kw','ky',
  'kz','la','lb','lc','li','lk','lr','ls','lt','lu','lv','ly','ma','mc',
  'md','me','mf','mg','mh','mk','ml','mm','mn','mo','mp','mq','mr','ms',
  'mt','mu','mv','mw','mx','my','mz','na','nc','ne','nf','ng','ni','nl',
  'no','np','nr','nu','nz','om','pa','pe','pf','pg','ph','pk','pl','pm',
  'pr','ps','pt','pw','py','qa','re','ro','rs','ru','rw','sa','sb','sc',
  'sd','se','sg','sh','si','sk','sl','sm','sn','so','sr','ss','st','sv',
  'sx','sy','sz','tc','td','tg','th','tj','tk','tl','tm','tn','to','tr',
  'tt','tv','tw','tz','ua','ug','us','uy','uz','va','vc','ve','vg','vi',
  'vn','vu','wf','ws','xk','ye','yt','za','zm','zw',
];

// ── All iptv-org categories ───────────────────────────────────────────────────
const CATEGORIES = [
  'animation','auto','business','classic','comedy','cooking','culture',
  'documentary','education','entertainment','family','fashion','food',
  'general','health','history','hobby','kids','legislative','lifestyle',
  'local','movies','music','nature','news','outdoor','pets','police',
  'religious','sci-fi','science','series','shop','sports','travel','weather',
];

// ── All iptv-org regions ──────────────────────────────────────────────────────
const REGIONS = [
  'afr','amer','apa','arab','asia','carib','casia','eafrica','easia',
  'eeur','eur','mea','nafrica','namer','neur','oce','safrica','samer',
  'sasia','seur','seasia','wafrica','weur','cis','camer',
];

// ── All iptv-org languages ────────────────────────────────────────────────────
const LANGUAGES = [
  'ara','ben','bul','cat','ces','dan','deu','ell','eng','spa','fas','fin',
  'fra','hau','heb','hin','hrv','hun','ind','ita','jpn','kor','lin','lit',
  'lav','msa','mkd','mlt','mon','mya','nld','nor','orm','pol','por','pus',
  'ron','rus','sin','slk','slv','som','srp','swa','swe','tam','tel','tgl',
  'tha','tur','ukr','urd','uzb','vie','yor','zho',
];

// ── Storage ───────────────────────────────────────────────────────────────────
const CACHE_KEY     = 'tikvtv_iptv_v12';
const CACHE_TTL     = 20 * 60 * 60 * 1000; // 20 hours

// ── Dead channel tracking ─────────────────────────────────────────────────────
const deadIds      = new Set<string>();
const offlineUntil = new Map<string, number>();

export function markChannelDead(id: string) {
  deadIds.add(id);
  offlineUntil.set(id, Date.now() + 10 * 60 * 1000);
  if (memCache) memCache = memCache.filter(ch => ch.id !== id);
}

export function isChannelDead(id: string): boolean {
  if (!deadIds.has(id)) return false;
  const until = offlineUntil.get(id);
  if (until && Date.now() > until) {
    deadIds.delete(id);
    offlineUntil.delete(id);
    return false;
  }
  return true;
}

export function getChannelById(id: string): IPTVChannel | undefined {
  return memCache?.find(ch => ch.id === id);
}

export function searchChannels(query: string, category = 'all', countryCode = '', limit = 80): IPTVChannel[] {
  if (!memCache) return [];
  const q = query.toLowerCase().trim();
  return memCache.filter(ch => {
    if (deadIds.has(ch.id)) return false;
    if (category !== 'all' && !ch.categories.some(c => c.toLowerCase() === category)) return false;
    if (countryCode && ch.countryCode.toLowerCase() !== countryCode.toLowerCase()) return false;
    if (!q) return true;
    return ch.name.toLowerCase().includes(q)
      || ch.countryCode.toLowerCase().includes(q)
      || ch.country.toLowerCase().includes(q)
      || ch.categories.some(c => c.toLowerCase().includes(q))
      || (ch.network?.toLowerCase().includes(q) ?? false)
      || (ch.alt_names?.some(a => a.toLowerCase().includes(q)) ?? false);
  }).slice(0, limit);
}

export function getCountries(): { code: string; count: number }[] {
  if (!memCache) return [];
  const map = new Map<string, number>();
  for (const ch of memCache) {
    if (!deadIds.has(ch.id) && ch.countryCode) {
      map.set(ch.countryCode, (map.get(ch.countryCode) || 0) + 1);
    }
  }
  return Array.from(map.entries()).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeCategory(raw: string): string {
  const r = raw.toLowerCase().trim();
  if (r.includes('news') || r.includes('actualit') || r.includes('noticias') || r.includes('info')) return 'news';
  if (r.includes('sport') || r.includes('football') || r.includes('soccer') || r.includes('cricket')) return 'sports';
  if (r.includes('entertain') || r.includes('variety') || r.includes('serie') || r.includes('drama')) return 'entertainment';
  if (r.includes('music') || r.includes('musique') || r.includes('clip') || r.includes('hits')) return 'music';
  if (r.includes('movie') || r.includes('film') || r.includes('cinema')) return 'movies';
  if (r.includes('kid') || r.includes('child') || r.includes('cartoon') || r.includes('junior')) return 'kids';
  if (r.includes('doc') || r.includes('nature') || r.includes('history') || r.includes('science')) return 'documentary';
  if (r.includes('cook') || r.includes('food') || r.includes('cuisine')) return 'cooking';
  if (r.includes('travel') || r.includes('voyage') || r.includes('tourism')) return 'travel';
  if (r.includes('relig') || r.includes('faith') || r.includes('islam') || r.includes('christian')) return 'religious';
  if (r.includes('business') || r.includes('finance') || r.includes('economy')) return 'business';
  if (r.includes('weather') || r.includes('météo')) return 'weather';
  if (r.includes('lifestyle') || r.includes('fashion') || r.includes('health')) return 'lifestyle';
  if (r.includes('animation') || r.includes('anime')) return 'animation';
  return 'general';
}

function genLogoUrl(name: string): string {
  const colors = ['1a1a2e', '16213e', '0f3460', '1b1b2f', '2d1b69', '1a2744'];
  const c   = colors[name.charCodeAt(0) % colors.length];
  const init = encodeURIComponent((name || 'TV').replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 2).toUpperCase() || 'TV');
  return `https://ui-avatars.com/api/?name=${init}&background=${c}&color=f59e0b&size=128&bold=true&font-size=0.4`;
}

function parseM3U(text: string, sourceTag: string): IPTVChannel[] {
  const lines = text.split('\n');
  const channels: IPTVChannel[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx].trim();
    if (line.startsWith('#EXTINF:')) {
      const nextLine = (lines[idx + 1] || '').trim();
      if (nextLine && !nextLine.startsWith('#') && (nextLine.startsWith('http') || nextLine.startsWith('rtsp'))) {
        if (nextLine.includes('youtube.com') || nextLine.includes('twitch.tv') || nextLine.includes('youtu.be')) {
          idx += 2; continue;
        }

        const tvgName    = line.match(/tvg-name="([^"]+)"/);
        const logoMatch  = line.match(/tvg-logo="([^"]+)"/);
        const groupMatch = line.match(/group-title="([^"]+)"/);
        const idMatch    = line.match(/tvg-id="([^"]*)"/);
        const countryM   = line.match(/tvg-country="([^"]*)"/);
        const langM      = line.match(/tvg-language="([^"]*)"/);

        const comma   = line.lastIndexOf(',');
        const rawName = comma !== -1
          ? line.slice(comma + 1).replace(/[⓪①②③④⑤⑥⑦⑧⑨🅷🅳ⓢⓣⓨ]/g, '').replace(/\s*\[.*?\]\s*/g, '').trim()
          : '';
        const name = (tvgName?.[1] || rawName || `Channel-${channels.length}`).trim();
        if (!name || name.length < 2) { idx += 2; continue; }

        const rawId = (idMatch?.[1] || '').trim();
        const cc    = (countryM?.[1] || '').split(';')[0].trim().toUpperCase().slice(0, 2);
        const id    = rawId
          ? rawId.toLowerCase().replace(/\s+/g, '-')
          : `${sourceTag}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32)}-${channels.length}`;

        const logo = (logoMatch?.[1] || '').startsWith('http') ? logoMatch![1] : genLogoUrl(name);

        channels.push({
          id, name, logo,
          country:     cc || 'INT',
          countryCode: cc || 'INT',
          languages:   langM?.[1] ? [langM[1].toLowerCase()] : [],
          categories:  [normalizeCategory(groupMatch?.[1] || 'general')],
          streamUrl:   nextLine,
          alt_names:   [],
        });
        idx += 2; continue;
      }
    }
    idx++;
  }
  return channels;
}

async function fetchM3U(url: string, tag: string, timeout = 10_000): Promise<IPTVChannel[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text.includes('#EXTINF')) return [];
    const parsed = parseM3U(text, tag);
    console.log(`[IPTV] ${tag}: ${parsed.length} channels`);
    return parsed;
  } catch (e) {
    console.warn(`[IPTV] ${tag} failed:`, (e as Error).message);
    return [];
  }
}

// Deduplicate a list of channels
function dedup(arr: IPTVChannel[], existingIds?: Set<string>, existingUrls?: Set<string>): IPTVChannel[] {
  const ids  = existingIds  || new Set<string>();
  const urls = existingUrls || new Set<string>();
  const result: IPTVChannel[] = [];
  for (const ch of arr) {
    if (!ids.has(ch.id) && !urls.has(ch.streamUrl)) {
      ids.add(ch.id);
      urls.add(ch.streamUrl);
      result.push(ch);
    }
  }
  return result;
}

interface RawChannel { id: string; name: string; logo: string; country: string; languages: string[]; categories: string[]; is_nsfw: boolean; website?: string; network?: string; alt_names?: string[]; }
interface RawStream  { channel: string; url: string; }
interface CacheData  { channels: IPTVChannel[]; timestamp: number; loaded: boolean; }

// Memory cache — starts empty, fills as channels load
let memCache: IPTVChannel[] | null = null;
// Whether background loading is done
let bgLoadDone = false;
let bgLoadPromise: Promise<void> | null = null;

// Callbacks to notify subscribers when more channels are available
const onMoreChannelsCallbacks: Set<() => void> = new Set();

export function subscribeToChannelUpdates(cb: () => void): () => void {
  onMoreChannelsCallbacks.add(cb);
  return () => onMoreChannelsCallbacks.delete(cb);
}

function notifyChannelUpdate() {
  for (const cb of onMoreChannelsCallbacks) cb();
}

/** Force clear memory cache (used by auto-updater) */
export function clearMemCache() {
  memCache = null;
  bgLoadDone = false;
  bgLoadPromise = null;
  localStorage.removeItem(CACHE_KEY);
}

/** Returns true when background loading is complete */
export function isFullyCached(): boolean {
  return bgLoadDone;
}

/**
 * Fast first load: returns first ~300 channels quickly (within 3-5s),
 * then continues loading in the background.
 */
export async function fetchAllChannels(): Promise<IPTVChannel[]> {
  // Already in memory
  if (memCache && memCache.length > 0) return memCache;

  // Try localStorage cache
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const data: CacheData = JSON.parse(raw);
      if (Date.now() - data.timestamp < CACHE_TTL && data.channels.length > 50) {
        console.log('[IPTV] Cache hit:', data.channels.length, 'channels');
        memCache = data.channels;
        // If not fully loaded previously, continue in background
        if (!data.loaded) {
          startBackgroundLoad();
        } else {
          bgLoadDone = true;
        }
        return memCache;
      }
    }
  } catch {}

  console.log('[IPTV] Starting fast initial load…');

  // Phase 1: Fast sources (fallback + primary API + fast M3U)
  const fastChannels = await loadFastChannels();
  memCache = fastChannels;
  
  // Save partial cache immediately so UI can render
  saveToStorage(fastChannels, false);

  // Phase 2: Load everything else in background
  startBackgroundLoad();

  return memCache;
}

async function loadFastChannels(): Promise<IPTVChannel[]> {
  // Start both primary API and fast M3U sources simultaneously
  const [primaryResult, fastM3uResults] = await Promise.all([
    loadPrimaryAPI().catch(() => []),
    loadFastM3USources(),
  ]);

  const combined = [...primaryResult, ...fastM3uResults];
  const deduped = dedup(combined.length > 0 ? combined : getFallbackChannels());

  console.log('[IPTV] Fast load complete:', deduped.length, 'channels');
  return shuffle(deduped);
}

async function loadPrimaryAPI(): Promise<IPTVChannel[]> {
  try {
    const [chanRes, streamRes] = await Promise.all([
      fetch(CHANNELS_API, { signal: AbortSignal.timeout(15_000) }),
      fetch(STREAMS_API,  { signal: AbortSignal.timeout(15_000) }),
    ]);
    if (!chanRes.ok || !streamRes.ok) return [];

    const rawChannels: RawChannel[] = await chanRes.json();
    const rawStreams:  RawStream[]  = await streamRes.json();

    const streamMap = new Map<string, string>();
    for (const s of rawStreams) {
      if (s.channel && s.url && !streamMap.has(s.channel)) streamMap.set(s.channel, s.url);
    }

    return rawChannels
      .filter(ch => !ch.is_nsfw && ch.name && streamMap.has(ch.id))
      .map(ch => ({
        id:          ch.id,
        name:        ch.name,
        logo:        ch.logo || genLogoUrl(ch.name),
        country:     ch.country || 'INT',
        countryCode: ch.country || 'INT',
        languages:   ch.languages || [],
        categories:  ch.categories?.length ? ch.categories : ['general'],
        streamUrl:   streamMap.get(ch.id)!,
        alt_names:   ch.alt_names || [],
        website:     ch.website,
        network:     ch.network,
      }));
  } catch {
    return [];
  }
}

async function loadFastM3USources(): Promise<IPTVChannel[]> {
  const results = await Promise.allSettled(
    FAST_SOURCES.map(([tag, url]) => fetchM3U(url, tag, 8_000))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<IPTVChannel[]> => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

function startBackgroundLoad() {
  if (bgLoadPromise) return;
  bgLoadPromise = doBackgroundLoad().finally(() => {
    bgLoadDone = true;
    bgLoadPromise = null;
  });
}

async function doBackgroundLoad() {
  if (!memCache) return;
  
  const existingIds  = new Set(memCache.map(ch => ch.id));
  const existingUrls = new Set(memCache.map(ch => ch.streamUrl));

  // Build remaining sources (all countries + remaining categories + regions + languages)
  // excluding ones already in FAST_SOURCES
  const fastCountries = new Set(['us', 'gb', 'fr', 'de', 'br', 'in', 'ng', 'za']);
  const fastCats      = new Set(['news', 'sports', 'entertainment', 'music']);

  const remainingSources: Array<[string, string]> = [
    // Remaining categories
    ...CATEGORIES
      .filter(c => !fastCats.has(c))
      .map(cat => [`cat-${cat}`, `https://iptv-org.github.io/iptv/categories/${cat}.m3u`] as [string, string]),
    // Remaining countries
    ...COUNTRY_CODES
      .filter(cc => !fastCountries.has(cc))
      .map(cc => [`cc-${cc}`, `https://iptv-org.github.io/iptv/countries/${cc}.m3u`] as [string, string]),
    // All regions
    ...REGIONS.map(r => [`reg-${r}`, `https://iptv-org.github.io/iptv/regions/${r}.m3u`] as [string, string]),
    // All languages
    ...LANGUAGES.map(l => [`lang-${l}`, `https://iptv-org.github.io/iptv/languages/${l}.m3u`] as [string, string]),
  ];

  // Fetch in batches of 6 — slower but won't saturate network
  let newCount = 0;
  for (let i = 0; i < remainingSources.length; i += 6) {
    if (!memCache) break; // cache was cleared
    const batch = remainingSources.slice(i, i + 6);
    const results = await Promise.allSettled(batch.map(([tag, url]) => fetchM3U(url, tag, 10_000)));
    
    let batchNew: IPTVChannel[] = [];
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const ch of r.value) {
        if (!existingIds.has(ch.id) && !existingUrls.has(ch.streamUrl)) {
          existingIds.add(ch.id);
          existingUrls.add(ch.streamUrl);
          batchNew.push(ch);
          newCount++;
        }
      }
    }

    if (batchNew.length > 0 && memCache) {
      // Insert new channels at random positions within the existing feed
      const insertPos = Math.floor(Math.random() * Math.max(1, memCache.length));
      memCache = [
        ...memCache.slice(0, insertPos),
        ...shuffle(batchNew),
        ...memCache.slice(insertPos),
      ];
      notifyChannelUpdate();
      
      // Persist to storage periodically
      if (i % 30 === 0) saveToStorage(memCache, false);
    }

    // Small delay between batches to reduce CPU/network pressure
    await new Promise(r => setTimeout(r, 300));
  }

  if (memCache) {
    console.log(`[IPTV] Background load complete. Total: ${memCache.length} channels`);
    saveToStorage(memCache, true);
    notifyChannelUpdate();
  }
}

function saveToStorage(channels: IPTVChannel[], loaded: boolean) {
  try {
    const toStore = channels.slice(0, 60_000);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ channels: toStore, timestamp: Date.now(), loaded }));
  } catch {
    try {
      const toStore = channels.slice(0, 15_000);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ channels: toStore, timestamp: Date.now(), loaded: false }));
    } catch {
      // Storage full — skip
    }
  }
}

export function getChannelPage(channels: IPTVChannel[], category: string, page: number, countryCode = ''): ChannelPage {
  let filtered = channels.filter(ch => !deadIds.has(ch.id));
  if (category !== 'all') {
    filtered = filtered.filter(ch => ch.categories.some(c => c.toLowerCase() === category.toLowerCase()));
  }
  if (countryCode) {
    filtered = filtered.filter(ch => ch.countryCode.toLowerCase() === countryCode.toLowerCase());
  }
  const start = (page - 1) * PAGE_SIZE;
  return { items: filtered.slice(start, start + PAGE_SIZE), hasMore: start + PAGE_SIZE < filtered.length, total: filtered.length };
}

function getFallbackChannels(): IPTVChannel[] {
  return [
    { id: 'euronews.en', name: 'Euronews English', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Euronews_logo_RGB.svg/200px-Euronews_logo_RGB.svg.png', country: 'FR', countryCode: 'FR', languages: ['en'], categories: ['news'], streamUrl: 'https://euronews-euronews-en-live.1m.wurl.io/playlist.m3u8' },
    { id: 'bloomberg.us', name: 'Bloomberg TV', logo: genLogoUrl('Bloomberg'), country: 'US', countryCode: 'US', languages: ['en'], categories: ['business', 'news'], streamUrl: 'https://bloombergtv.akamaized.net/hls/live/571308/Bloomberg_Embeddable/master.m3u8' },
    { id: 'nhkworld.jp', name: 'NHK World', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/1/11/NHK_World-Japan.svg/200px-NHK_World-Japan.svg.png', country: 'JP', countryCode: 'JP', languages: ['en', 'ja'], categories: ['news', 'entertainment'], streamUrl: 'https://nhkworld-vh.akamaihd.net/i/nhkworld/liveed_g3/sd_w/index_0_av-b.m3u8' },
    { id: 'france24.en', name: 'France 24 English', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/France_24_English.svg/200px-France_24_English.svg.png', country: 'FR', countryCode: 'FR', languages: ['en', 'fr'], categories: ['news'], streamUrl: 'https://static.france24.com/live/F24_EN_LO_HLS/live_web.m3u8' },
    { id: 'dw.en', name: 'DW English', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/200px-Deutsche_Welle_symbol_2012.svg.png', country: 'DE', countryCode: 'DE', languages: ['en', 'de'], categories: ['news'], streamUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8' },
    { id: 'aljazeera.en', name: 'Al Jazeera English', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_English.svg/200px-Al_Jazeera_English.svg.png', country: 'QA', countryCode: 'QA', languages: ['en', 'ar'], categories: ['news'], streamUrl: 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8' },
    { id: 'france24.fr', name: 'France 24 Français', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/France_24_English.svg/200px-France_24_English.svg.png', country: 'FR', countryCode: 'FR', languages: ['fr'], categories: ['news'], streamUrl: 'https://static.france24.com/live/F24_FR_LO_HLS/live_web.m3u8' },
    { id: 'cgtn.en', name: 'CGTN English', logo: genLogoUrl('CGTN'), country: 'CN', countryCode: 'CN', languages: ['en', 'zh'], categories: ['news'], streamUrl: 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8' },
    { id: 'nasa.tv', name: 'NASA TV', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/200px-NASA_logo.svg.png', country: 'US', countryCode: 'US', languages: ['en'], categories: ['science', 'documentary'], streamUrl: 'https://ntv3.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8' },
    { id: 'trt.world', name: 'TRT World', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/TRT_World_logo.svg/200px-TRT_World_logo.svg.png', country: 'TR', countryCode: 'TR', languages: ['en', 'tr'], categories: ['news'], streamUrl: 'https://trtworldshift.akamaized.net/hls/live/681867/trtworld/index.m3u8' },
    { id: 'tv5monde.fr', name: 'TV5MONDE', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/TV5MONDE_logo.svg/200px-TV5MONDE_logo.svg.png', country: 'FR', countryCode: 'FR', languages: ['fr'], categories: ['entertainment', 'news'], streamUrl: 'https://tv5monde.akamaized.net/hls/live/689741/TV5MONDE_GP/index.m3u8' },
    { id: 'arirang.kr', name: 'Arirang TV Korea', logo: genLogoUrl('Arirang'), country: 'KR', countryCode: 'KR', languages: ['en', 'ko'], categories: ['entertainment', 'news'], streamUrl: 'https://amdlive-ctnd02.akamaized.net/arirang/smil:arirang_1ch.smil/playlist.m3u8' },
    { id: 'dd.national', name: 'DD National India', logo: genLogoUrl('DD'), country: 'IN', countryCode: 'IN', languages: ['hi', 'en'], categories: ['news', 'entertainment'], streamUrl: 'https://ddinational.akamaized.net/hls/live/2006258/ddinational/index.m3u8' },
    { id: 'sabc.za', name: 'SABC News', logo: genLogoUrl('SABC'), country: 'ZA', countryCode: 'ZA', languages: ['en', 'zu', 'af'], categories: ['news'], streamUrl: 'https://cdn.dvr.tv/stream/rssz_5002/live/index.m3u8' },
    { id: 'trt.doc', name: 'RT Documentary', logo: genLogoUrl('RT'), country: 'RU', countryCode: 'RU', languages: ['en', 'ru'], categories: ['documentary', 'news'], streamUrl: 'https://rt-rtd.rttv.com/live/rtdoc/playlist.m3u8' },
    { id: 'abc.au', name: 'ABC Australia', logo: genLogoUrl('ABC'), country: 'AU', countryCode: 'AU', languages: ['en'], categories: ['news', 'entertainment'], streamUrl: 'https://abc-iview-mediapackagestreams-2.akamaized.net/out/v1/d9b8d5f88e694e26b16a4e0da3a0bff7/index.m3u8' },
    { id: 'rfi.fr', name: 'RFI French', logo: genLogoUrl('RFI'), country: 'FR', countryCode: 'FR', languages: ['fr'], categories: ['news'], streamUrl: 'https://rfi-live.akamaized.net/hls/live/2023434/rfi-fra-high/master.m3u8' },
    { id: 'voa.en', name: 'VOA News', logo: genLogoUrl('VOA'), country: 'US', countryCode: 'US', languages: ['en'], categories: ['news'], streamUrl: 'https://voa-lh.akamaihd.net/i/voa_english@114062/index_256p_av-p.m3u8' },
    { id: 'cnn.us', name: 'CNN International', logo: genLogoUrl('CNN'), country: 'US', countryCode: 'US', languages: ['en'], categories: ['news'], streamUrl: 'https://cnnios-f.akamaihd.net/hls/live/237674/CNNi/master.m3u8' },
    { id: 'bbcworld.gb', name: 'BBC World News', logo: genLogoUrl('BBC'), country: 'GB', countryCode: 'GB', languages: ['en'], categories: ['news'], streamUrl: 'https://vs-hls-push-ww-live.akamaized.net/x=3/i=urn:bbc:pips:service:bbc_world_service/pc_hd.m3u8' },
  ];
}
