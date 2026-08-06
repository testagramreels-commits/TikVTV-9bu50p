import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { IPTVChannel, Favorite } from '@/types';
import { toast } from 'sonner';

export function useFavorites(userId?: string) {
  const [favorites, setFavorites]   = useState<Favorite[]>([]);
  const [favIds,    setFavIds]      = useState<Set<string>>(new Set());
  const [loading,   setLoading]     = useState(false);

  useEffect(() => {
    if (!userId) { setFavorites([]); setFavIds(new Set()); return; }
    setLoading(true);
    supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const items = (data as Favorite[]) || [];
        setFavorites(items);
        setFavIds(new Set(items.map(f => f.channel_id)));
        setLoading(false);
      });
  }, [userId]);

  const isFavorite = useCallback(
    (channelId: string) => favIds.has(channelId),
    [favIds]
  );

  const toggleFavorite = useCallback(async (channel: IPTVChannel) => {
    if (!userId) return;

    if (favIds.has(channel.id)) {
      // Remove
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('channel_id', channel.id);
      if (!error) {
        setFavorites(prev => prev.filter(f => f.channel_id !== channel.id));
        setFavIds(prev => { const s = new Set(prev); s.delete(channel.id); return s; });
        toast.success('Removed from favorites');
      }
    } else {
      // Add
      const { data, error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, channel_id: channel.id, channel_data: channel })
        .select()
        .single();
      if (!error && data) {
        setFavorites(prev => [data as Favorite, ...prev]);
        setFavIds(prev => new Set([...prev, channel.id]));
        toast.success('Saved to favorites ✨');
      }
    }
  }, [userId, favIds]);

  return { favorites, loading, isFavorite, toggleFavorite };
}
