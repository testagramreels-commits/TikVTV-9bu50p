import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllChannels, getChannelById } from '@/lib/iptvApi';
import type { TrendingChannel } from '@/types';

export function useTrending(limit = 30) {
  const [trending, setTrending] = useState<TrendingChannel[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      await fetchAllChannels();

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [{ data: reactionData }, { data: commentData }] = await Promise.all([
        supabase.from('reactions').select('channel_id, type').gte('created_at', since),
        supabase.from('comments').select('channel_id').gte('created_at', since),
      ]);

      if (!mounted) return;

      // Weighted scoring: like=3, repost=5 (reposts are more valuable for discovery), comment=2
      const scoreMap = new Map<string, number>();
      for (const r of reactionData || []) {
        const weight = r.type === 'repost' ? 5 : r.type === 'like' ? 3 : 1;
        scoreMap.set(r.channel_id, (scoreMap.get(r.channel_id) || 0) + weight);
      }
      for (const c of commentData || []) {
        scoreMap.set(c.channel_id, (scoreMap.get(c.channel_id) || 0) + 2);
      }

      const sorted = Array.from(scoreMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([channel_id, score]) => ({
          channel_id,
          score,
          channel: getChannelById(channel_id),
        }))
        .filter(t => !!t.channel);

      setTrending(sorted as TrendingChannel[]);
      setLoading(false);
    };

    load();
    return () => { mounted = false; };
  }, [limit]);

  return { trending, loading };
}
