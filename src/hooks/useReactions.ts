import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useReactions(channelId: string, userId?: string) {
  const [liked,     setLiked]     = useState(false);
  const [reposted,  setReposted]  = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [repostCount, setRepostCount] = useState(0);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      // Like count
      const { count: lc } = await supabase
        .from('reactions')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('type', 'like');
      if (mounted) setLikeCount(lc || 0);

      // Repost count
      const { count: rc } = await supabase
        .from('reactions')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('type', 'repost');
      if (mounted) setRepostCount(rc || 0);

      if (userId) {
        // Check liked
        const { data: likeData } = await supabase
          .from('reactions')
          .select('id')
          .eq('channel_id', channelId)
          .eq('user_id', userId)
          .eq('type', 'like')
          .maybeSingle();
        if (mounted) setLiked(!!likeData);

        // Check reposted
        const { data: repostData } = await supabase
          .from('reactions')
          .select('id')
          .eq('channel_id', channelId)
          .eq('user_id', userId)
          .eq('type', 'repost')
          .maybeSingle();
        if (mounted) setReposted(!!repostData);
      }
    };

    load();
    return () => { mounted = false; };
  }, [channelId, userId]);

  const toggleLike = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    setLoading(true);

    if (liked) {
      await supabase
        .from('reactions')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .eq('type', 'like');
      setLiked(false);
      setLikeCount(n => Math.max(0, n - 1));
    } else {
      await supabase
        .from('reactions')
        .insert({ channel_id: channelId, user_id: userId, type: 'like' });
      setLiked(true);
      setLikeCount(n => n + 1);
    }

    setLoading(false);
    return true;
  }, [channelId, userId, liked]);

  const toggleRepost = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    setLoading(true);

    if (reposted) {
      await supabase
        .from('reactions')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .eq('type', 'repost');
      setReposted(false);
      setRepostCount(n => Math.max(0, n - 1));
    } else {
      // Repost uses a separate row (not unique-constrained per channel+user, allow multiple reposts over time is business logic,
      // but for simplicity we toggle based on whether user has already reposted)
      await supabase
        .from('reactions')
        .insert({ channel_id: channelId, user_id: userId, type: 'repost' });
      setReposted(true);
      setRepostCount(n => n + 1);
    }

    setLoading(false);
    return true;
  }, [channelId, userId, reposted]);

  return { liked, reposted, likeCount, repostCount, loading, toggleLike, toggleRepost };
}
