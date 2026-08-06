import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function getCountryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌍';
  try {
    return String.fromCodePoint(
      ...[...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65)
    );
  } catch {
    return '🌍';
  }
}

export function timeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

export function getCountryName(code: string): string {
  if (!code || code.length !== 2) return 'Global';
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(code.toUpperCase()) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function categoryColor(cat: string): string {
  const colors: Record<string, string> = {
    news:          'bg-blue-600',
    sports:        'bg-green-600',
    entertainment: 'bg-purple-600',
    music:         'bg-pink-600',
    movies:        'bg-orange-600',
    kids:          'bg-yellow-500',
    documentary:   'bg-teal-600',
    cooking:       'bg-amber-600',
    travel:        'bg-cyan-600',
    religious:     'bg-indigo-600',
    business:      'bg-slate-600',
    weather:       'bg-sky-600',
    science:       'bg-emerald-600',
    auto:          'bg-red-700',
    general:       'bg-gray-600',
  };
  return colors[cat.toLowerCase()] || 'bg-gray-600';
}
