/**
 * AI-powered channel suggestion engine.
 * Builds a frequency + recency score from watch history,
 * then returns the top N channel IDs / categories / networks.
 */
import { useMemo } from 'react';
import { useWatchHistory } from './useWatchHistory';
import type { WatchHistoryItem } from '@/types';

interface ChannelScore {
  channelId: string;
  name:      string;
  logo:      string;
  score:     number;
  categories: string[];
  countryCode: string;
}

function computeScores(history: WatchHistoryItem[]): ChannelScore[] {
  const now = Date.now();
  const map  = new Map<string, ChannelScore>();

  history.forEach((item, idx) => {
    // Recency weight: older items are exponentially less important
    const ageMs      = now - new Date(item.watchedAt).getTime();
    const ageDays    = ageMs / (1000 * 60 * 60 * 24);
    const recency    = Math.exp(-0.3 * ageDays);          // half-life ~2.3 days
    const position   = Math.exp(-0.05 * idx);              // earlier in list = slightly higher
    const score      = recency * position;

    const existing = map.get(item.channelId);
    if (existing) {
      existing.score += score;
    } else {
      map.set(item.channelId, {
        channelId:   item.channelId,
        name:        item.name,
        logo:        item.logo,
        score,
        categories:  item.categories,
        countryCode: item.countryCode,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

export function useAiSuggestions() {
  const { history } = useWatchHistory();

  const scores = useMemo(() => computeScores(history), [history]);

  const topChannels = useMemo(() => scores.slice(0, 10), [scores]);

  const topCategories = useMemo((): string[] => {
    const catScore = new Map<string, number>();
    scores.forEach(s => {
      s.categories.forEach(c => {
        catScore.set(c, (catScore.get(c) || 0) + s.score);
      });
    });
    return Array.from(catScore.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => c);
  }, [scores]);

  const topCountries = useMemo((): string[] => {
    const ccScore = new Map<string, number>();
    scores.forEach(s => {
      if (s.countryCode) {
        ccScore.set(s.countryCode, (ccScore.get(s.countryCode) || 0) + s.score);
      }
    });
    return Array.from(ccScore.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => c);
  }, [scores]);

  const hasData = history.length >= 3;

  return { topChannels, topCategories, topCountries, hasData };
}
