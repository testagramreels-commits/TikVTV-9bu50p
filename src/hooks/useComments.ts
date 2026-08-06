import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Comment } from '@/types';
import { toast } from 'sonner';

export function useComments(channelId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading]   = useState(false);
  const [count, setCount]       = useState(0);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .select('*, user_profiles(username)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[Comments] Fetch error:', error);
    } else {
      setComments((data as Comment[]) || []);
      setCount((data || []).length);
    }
    setLoading(false);
  }, [channelId]);

  const fetchCount = useCallback(async () => {
    const { count: c } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId);
    setCount(c || 0);
  }, [channelId]);

  const addComment = useCallback(async (content: string, userId: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const { data, error } = await supabase
      .from('comments')
      .insert({ channel_id: channelId, user_id: userId, content: trimmed })
      .select('*, user_profiles(username)')
      .single();

    if (error) {
      toast.error('Failed to post comment');
      console.error('[Comments] Insert error:', error);
    } else {
      setComments(prev => [data as Comment, ...prev]);
      setCount(n => n + 1);
    }
  }, [channelId]);

  const deleteComment = useCallback(async (commentId: string) => {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (!error) {
      setComments(prev => prev.filter(c => c.id !== commentId));
      setCount(n => Math.max(0, n - 1));
    }
  }, []);

  return { comments, loading, count, fetchComments, fetchCount, addComment, deleteComment };
}
