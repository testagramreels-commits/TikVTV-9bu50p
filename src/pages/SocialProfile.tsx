/**
 * Social Profile — displays a user's posts, follower/following counts,
 * follow/unfollow button, and premium badge.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, UserPlus, UserCheck, MessageCircle,
  Hash, Heart, Repeat2, BadgeCheck, Crown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { cn, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

interface Profile {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
}

interface Post {
  id: string;
  content: string;
  media_urls: string[];
  hashtags: string[];
  like_count: number;
  repost_count: number;
  reply_count: number;
  created_at: string;
  user_profiles?: Profile;
}

export default function SocialProfile() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate   = useNavigate();
  const { user }   = useAuthStore();

  // If no userId param, show own profile
  const targetId   = userId || user?.id;

  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [posts,      setPosts]      = useState<Post[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [following,  setFollowing]  = useState(false);
  const [followerCount,  setFollowerCount]  = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postCount,      setPostCount]      = useState(0);
  const [isPremium,      setIsPremium]      = useState(false);

  const isOwnProfile = user?.id === targetId;

  const loadProfile = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);

    const [profileRes, postsRes, followersRes, followingRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', targetId).single(),
      supabase.from('social_posts').select('*').eq('user_id', targetId)
        .order('created_at', { ascending: false }).limit(30),
      supabase.from('social_follows').select('id', { count: 'exact', head: true }).eq('following_id', targetId),
      supabase.from('social_follows').select('id', { count: 'exact', head: true }).eq('follower_id', targetId),
    ]);

    setProfile(profileRes.data);
    setPosts((postsRes.data || []) as Post[]);
    setFollowerCount(followersRes.count || 0);
    setFollowingCount(followingRes.count || 0);
    setPostCount(postsRes.data?.length || 0);

    // Check if current user follows this profile
    if (user && !isOwnProfile) {
      const { data: followData } = await supabase
        .from('social_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetId)
        .maybeSingle();
      setFollowing(!!followData);
    }

    // Check premium
    const { data: premSub } = await supabase
      .from('premium_subscriptions')
      .select('id')
      .eq('user_id', targetId)
      .eq('status', 'completed')
      .maybeSingle();
    setIsPremium(!!premSub);

    setLoading(false);
  }, [targetId, user, isOwnProfile]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleFollowToggle = async () => {
    if (!user) { toast.error('Sign in to follow'); return; }
    if (!targetId) return;

    if (following) {
      await supabase.from('social_follows').delete()
        .match({ follower_id: user.id, following_id: targetId });
      setFollowing(false);
      setFollowerCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from('social_follows').insert({
        follower_id: user.id, following_id: targetId,
      });
      setFollowing(true);
      setFollowerCount(c => c + 1);

      // Create notification for the followed user
      if (targetId !== user.id) {
        await supabase.from('social_notifications').insert({
          user_id:  targetId,
          actor_id: user.id,
          type:     'follow',
          message:  `@${user.username} started following you`,
        });
      }
    }
  };

  const sendDM = () => {
    navigate('/social/dm');
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-foreground font-semibold">User not found</p>
        <button onClick={() => navigate(-1)} className="text-primary text-sm mt-2">Go back</button>
      </div>
    </div>
  );

  const initials = (profile.username || profile.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50 px-4 pt-safe-top pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-foreground text-base">@{profile.username}</p>
          <p className="text-muted-foreground text-xs">{postCount} posts</p>
        </div>
      </div>

      {/* Profile header */}
      <div className="px-4 pt-6 pb-4 border-b border-border/40">
        <div className="flex items-start justify-between gap-4 mb-4">
          {/* Avatar */}
          <div className="relative">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username}
                className={cn('w-20 h-20 rounded-full object-cover',
                  isPremium ? 'border-4 border-amber-400' : 'border-2 border-border')} />
            ) : (
              <div className={cn('w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center',
                isPremium ? 'border-4 border-amber-400' : 'border-2 border-border')}>
                <span className="text-white font-bold text-2xl">{initials}</span>
              </div>
            )}
            {isPremium && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center border-2 border-background">
                <Crown className="w-3.5 h-3.5 text-black" />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            {!isOwnProfile && (
              <>
                <button
                  onClick={handleFollowToggle}
                  className={cn(
                    'flex items-center gap-1.5 font-bold text-sm px-4 py-2 rounded-full transition-all',
                    following
                      ? 'bg-muted text-foreground border border-border hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/30'
                      : 'bg-primary text-white hover:bg-primary/90'
                  )}
                >
                  {following
                    ? <><UserCheck className="w-4 h-4" /> Following</>
                    : <><UserPlus className="w-4 h-4" /> Follow</>}
                </button>
                <button onClick={sendDM}
                  className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-muted/80 transition-colors">
                  <MessageCircle className="w-4 h-4 text-foreground" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Name + badges */}
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-bold text-foreground text-lg">@{profile.username}</h2>
          <BadgeCheck className="w-5 h-5 text-primary" />
          {isPremium && <Crown className="w-4 h-4 text-amber-400" />}
        </div>
        <p className="text-muted-foreground text-sm mb-3">{profile.email}</p>

        {/* Stats row */}
        <div className="flex gap-6">
          {[
            { label: 'Posts',     value: postCount },
            { label: 'Followers', value: followerCount },
            { label: 'Following', value: followingCount },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="font-bold text-foreground text-base">{s.value}</p>
              <p className="text-muted-foreground text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div>
        {posts.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Hash className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-foreground font-semibold">No posts yet</p>
          </div>
        ) : (
          posts.map(post => (
            <article key={post.id} className="px-4 py-4 border-b border-border/40">
              <p className="text-foreground text-sm leading-relaxed mb-2 break-words">
                {post.content.split(/(#[\w]+|@[\w]+)/g).map((p, i) => {
                  if (p.startsWith('#')) return <span key={i} className="text-primary font-medium">{p}</span>;
                  if (p.startsWith('@')) return <span key={i} className="text-sky-400 font-medium">{p}</span>;
                  return <span key={i}>{p}</span>;
                })}
              </p>

              {/* Media */}
              {post.media_urls?.length > 0 && (
                <div className={cn('grid gap-1 mb-2 rounded-xl overflow-hidden',
                  post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                  {post.media_urls.slice(0, 4).map((url, i) => (
                    url.match(/\.(mp4|webm|ogg)$/i) ? (
                      <video key={i} src={url} controls playsInline className="w-full rounded-xl aspect-video object-cover bg-black" />
                    ) : (
                      <img key={i} src={url} alt="" className="w-full rounded-xl object-cover aspect-square bg-muted"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )
                  ))}
                </div>
              )}

              {/* Engagement */}
              <div className="flex items-center gap-6 mt-2 text-muted-foreground">
                <div className="flex items-center gap-1.5 text-xs">
                  <Heart className="w-3.5 h-3.5" />
                  <span>{post.like_count}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Repeat2 className="w-3.5 h-3.5" />
                  <span>{post.repost_count}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{post.reply_count}</span>
                </div>
                <span className="text-xs ml-auto">{timeAgo(post.created_at)}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
