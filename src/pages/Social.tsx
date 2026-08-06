/**
 * Social feed — X (Twitter)-like world-class social platform.
 * Features: posts, reposts, quote posts, hashtags, media upload, unified search.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Heart, Repeat2, MessageCircle, Share2, Image, Video,
  Hash, Search, ArrowLeft, Send, X, MoreHorizontal,
  Bookmark, TrendingUp, Users, AtSign, Loader2, BadgeCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AuthModal from '@/components/features/AuthModal';

interface SocialUser {
  id: string;
  username: string;
  email: string;
}

interface SocialPost {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[];
  hashtags: string[];
  channel_id?: string;
  repost_of?: string;
  quote_of?: string;
  like_count: number;
  repost_count: number;
  reply_count: number;
  view_count: number;
  created_at: string;
  user_profiles?: SocialUser;
  repost_data?: SocialPost;
  quote_data?: SocialPost;
  isLiked?: boolean;
  isReposted?: boolean;
}

function extractHashtags(text: string): string[] {
  return (text.match(/#[\w]+/g) || []).map(h => h.toLowerCase().slice(1));
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Avatar({ user, size = 'md' }: { user?: SocialUser | null; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'w-14 h-14 text-xl' : size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';
  const init = (user?.username || user?.email || '?').slice(0, 1).toUpperCase();
  return (
    <div className={cn('rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white flex-none', sz)}>
      {init}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PostCard
// ─────────────────────────────────────────────────────────────────────
function PostCard({ post, onRepost, onLike, depth = 0 }: {
  post: SocialPost;
  onRepost?: (p: SocialPost) => void;
  onLike: (id: string, liked: boolean) => void;
  depth?: number;
}) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [localLiked, setLocalLiked] = useState(post.isLiked ?? false);
  const [localLikes, setLocalLikes] = useState(post.like_count);

  // Pure repost (no content) — show quoted style
  if (post.repost_of && !post.content && post.repost_data) {
    return (
      <div className="px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-2">
          <Repeat2 className="w-3.5 h-3.5" />
          <span className="font-semibold">{post.user_profiles?.username} reposted</span>
        </div>
        <PostCard post={post.repost_data} onLike={onLike} depth={depth + 1} />
      </div>
    );
  }

  const handleLikeClick = async () => {
    if (!user) { toast.error('Sign in to like posts'); return; }
    const next = !localLiked;
    setLocalLiked(next);
    setLocalLikes(c => next ? c + 1 : Math.max(0, c - 1));
    onLike(post.id, next);
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(#[\w]+|@[\w]+)/g);
    return parts.map((p, i) => {
      if (p.startsWith('#')) return <span key={i} className="text-primary font-medium cursor-pointer hover:underline" onClick={() => navigate(`/social?tag=${p.slice(1)}`)}>{p}</span>;
      if (p.startsWith('@')) return <span key={i} className="text-sky-400 font-medium cursor-pointer hover:underline">{p}</span>;
      return <span key={i}>{p}</span>;
    });
  };

  return (
    <article className={cn('border-b border-border/40', depth === 0 ? 'px-4 py-3' : 'px-3 py-2 bg-muted/20 rounded-xl')}>
      <div className="flex gap-3">
        <Avatar user={post.user_profiles} size={depth > 0 ? 'sm' : 'md'} />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-bold text-foreground text-sm">@{post.user_profiles?.username || 'user'}</span>
            <BadgeCheck className="w-3.5 h-3.5 text-primary flex-none" />
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs">{timeAgo(post.created_at)}</span>
            <button className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          {post.content && (
            <p className="text-foreground text-sm leading-relaxed mb-2 break-words">
              {renderContent(post.content)}
            </p>
          )}

          {/* Media */}
          {post.media_urls?.length > 0 && (
            <div className={cn('grid gap-1.5 mb-2 rounded-xl overflow-hidden',
              post.media_urls.length === 1 ? 'grid-cols-1' :
              post.media_urls.length === 2 ? 'grid-cols-2' : 'grid-cols-2')}>
              {post.media_urls.slice(0, 4).map((url, i) => (
                url.match(/\.(mp4|webm|ogg)$/i) ? (
                  <video key={i} src={url} controls className="w-full rounded-lg aspect-video object-cover bg-black" />
                ) : (
                  <img key={i} src={url} alt="" className="w-full rounded-lg object-cover aspect-square bg-muted"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )
              ))}
            </div>
          )}

          {/* Quote post */}
          {post.quote_of && post.quote_data && (
            <div className="border border-border/60 rounded-xl p-3 mb-2 bg-muted/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Avatar user={post.quote_data.user_profiles} size="sm" />
                <span className="font-bold text-foreground text-xs">@{post.quote_data.user_profiles?.username}</span>
                <span className="text-muted-foreground text-xs">· {timeAgo(post.quote_data.created_at)}</span>
              </div>
              <p className="text-foreground/80 text-xs leading-relaxed">{post.quote_data.content}</p>
            </div>
          )}

          {/* Actions */}
          {depth === 0 && (
            <div className="flex items-center gap-5 mt-1">
              <ActionBtn icon={MessageCircle} count={post.reply_count} onClick={() => {}} />
              <ActionBtn icon={Repeat2}       count={post.repost_count}
                onClick={() => { if (!user) { toast.error('Sign in to repost'); return; } onRepost?.(post); }}
                active={post.isReposted} activeColor="text-green-400" />
              <ActionBtn icon={Heart}         count={localLikes} onClick={handleLikeClick}
                active={localLiked} activeColor="text-rose-400" />
              <ActionBtn icon={Share2}        count={0} onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/social?post=${post.id}`);
                toast.success('Link copied!');
              }} />
              <ActionBtn icon={Bookmark} count={0} onClick={() => {}} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ActionBtn({
  icon: Icon, count, onClick, active = false, activeColor = 'text-primary',
}: {
  icon: React.FC<{ className?: string }>; count: number;
  onClick: () => void; active?: boolean; activeColor?: string;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={cn('flex items-center gap-1.5 group transition-colors', active ? activeColor : 'text-muted-foreground hover:text-foreground')}
    >
      <Icon className="w-4 h-4" />
      {count > 0 && <span className="text-xs font-medium">{count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}</span>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ComposeBox
// ─────────────────────────────────────────────────────────────────────
function ComposeBox({ replyTo, quoteTo, onPost, onCancel }: {
  replyTo?: SocialPost; quoteTo?: SocialPost;
  onPost: (post: SocialPost) => void; onCancel?: () => void;
}) {
  const { user }  = useAuthStore();
  const [text, setTxt]        = useState('');
  const [media, setMedia]     = useState<string[]>([]);
  const [uploading, setUpl]   = useState(false);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const MAX = 280;

  const uploadMedia = async (file: File) => {
    if (!user) return;
    setUpl(true);
    const ext  = file.name.split('.').pop();
    const path = `${user.id}/social-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('channel-clips').upload(path, file, { upsert: true });
    if (error) { toast.error('Upload failed'); setUpl(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('channel-clips').getPublicUrl(path);
    setMedia(m => [...m, publicUrl]);
    setUpl(false);
  };

  const handlePost = async () => {
    if (!user || !text.trim() || posting) return;
    setPosting(true);
    const hashtags = extractHashtags(text);
    const { data, error } = await supabase.from('social_posts').insert({
      user_id: user.id, content: text.trim(), media_urls: media,
      hashtags, quote_of: quoteTo?.id ?? null,
    }).select('*, user_profiles(id, username, email)').single();
    setPosting(false);
    if (error) { toast.error('Post failed'); return; }
    setTxt(''); setMedia([]);
    toast.success('Posted!');
    onPost(data as SocialPost);
  };

  if (!user) return null;

  return (
    <div className="border-b border-border/50 px-4 py-3 bg-card/30">
      {(replyTo || quoteTo) && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
          {replyTo && <><MessageCircle className="w-3.5 h-3.5" /> Replying to @{replyTo.user_profiles?.username}</>}
          {quoteTo && <><Repeat2 className="w-3.5 h-3.5" /> Quoting @{quoteTo.user_profiles?.username}</>}
          {onCancel && <button onClick={onCancel} className="ml-auto"><X className="w-3.5 h-3.5" /></button>}
        </div>
      )}
      <div className="flex gap-3">
        <Avatar user={{ id: user.id, username: user.username, email: user.email }} />
        <div className="flex-1">
          <textarea
            value={text}
            onChange={e => setTxt(e.target.value.slice(0, MAX))}
            placeholder="What's happening?"
            rows={3}
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground text-sm resize-none outline-none"
          />
          {/* Media preview */}
          {media.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {media.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                  <button onClick={() => setMedia(m => m.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/80 flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-8 h-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-8 h-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors">
              <Video className="w-4 h-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f); }} />
            <span className={cn('ml-auto text-xs', text.length > MAX * 0.8 ? 'text-amber-400' : 'text-muted-foreground')}>
              {MAX - text.length}
            </span>
            <button
              onClick={handlePost}
              disabled={!text.trim() || posting}
              className="flex items-center gap-1.5 bg-primary text-white font-bold text-sm px-4 py-2 rounded-full disabled:opacity-50 transition-all hover:bg-primary/90"
            >
              {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TrendingHashtags sidebar
// ─────────────────────────────────────────────────────────────────────
function TrendingSidebar({ onTag }: { onTag: (t: string) => void }) {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  useEffect(() => {
    supabase.from('social_posts')
      .select('hashtags')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        for (const row of data) {
          for (const t of (row.hashtags || [])) map[t] = (map[t] || 0) + 1;
        }
        setTags(Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count })));
      });
  }, []);

  return (
    <div className="bg-card/40 border border-border/50 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="font-bold text-foreground text-sm">Trending</span>
      </div>
      {tags.length === 0 && <p className="text-muted-foreground text-xs text-center py-4">No tags yet — post something!</p>}
      {tags.map(({ tag, count }) => (
        <button key={tag} onClick={() => onTag(tag)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors border-b border-border/20 last:border-0">
          <div className="flex items-center gap-2">
            <Hash className="w-3.5 h-3.5 text-primary" />
            <span className="text-foreground text-sm font-medium">#{tag}</span>
          </div>
          <span className="text-muted-foreground text-xs">{count} posts</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main Social page
// ─────────────────────────────────────────────────────────────────────
type FeedTab = 'for-you' | 'following' | 'trending';

export default function Social() {
  const { user }     = useAuthStore();
  const navigate     = useNavigate();
  const [searchParams] = useSearchParams();
  const tagParam     = searchParams.get('tag') || '';

  const [tab, setTab]       = useState<FeedTab>('for-you');
  const [posts, setPosts]   = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState(tagParam ? `#${tagParam}` : '');
  const [activeTag, setTag]  = useState(tagParam);
  const [showAuth, setAuth]  = useState(false);
  const [repostTarget, setRepostTarget] = useState<SocialPost | null>(null);
  const [quoteTarget,  setQuoteTarget]  = useState<SocialPost | null>(null);
  const [page, setPage]     = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadPosts = useCallback(async (reset = false) => {
    setLoading(true);
    const from = reset ? 0 : page * 20;
    let query = supabase.from('social_posts')
      .select('*, user_profiles(id, username, email)')
      .order('created_at', { ascending: false })
      .range(from, from + 19);

    if (activeTag) query = query.contains('hashtags', [activeTag]);

    const { data, error } = await query;
    if (error) { setLoading(false); return; }

    // Fetch liked/repost status for logged-in user
    let enriched = (data || []) as SocialPost[];
    if (user && enriched.length) {
      const ids = enriched.map(p => p.id);
      const { data: likes } = await supabase.from('social_likes')
        .select('post_id').eq('user_id', user.id).in('post_id', ids);
      const likedSet = new Set((likes || []).map(l => l.post_id));
      enriched = enriched.map(p => ({ ...p, isLiked: likedSet.has(p.id) }));
    }

    setPosts(prev => reset ? enriched : [...prev, ...enriched]);
    setHasMore(enriched.length === 20);
    if (!reset) setPage(p => p + 1);
    setLoading(false);
  }, [activeTag, user, page]);

  useEffect(() => { loadPosts(true); }, [activeTag, tab]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!loaderRef.current || !hasMore) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && hasMore) loadPosts();
    }, { threshold: 0.1 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, loadPosts]);

  const handleLike = useCallback(async (postId: string, liked: boolean) => {
    if (!user) return;
    if (liked) {
      await supabase.from('social_likes').upsert({ post_id: postId, user_id: user.id });
      await supabase.from('social_posts').update({ like_count: supabase.rpc('increment', { x: 1 }) as unknown as number }).eq('id', postId);
    } else {
      await supabase.from('social_likes').delete().match({ post_id: postId, user_id: user.id });
    }
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, isLiked: liked, like_count: liked ? p.like_count + 1 : Math.max(0, p.like_count - 1) } : p));
  }, [user]);

  const handleRepost = useCallback(async (target: SocialPost) => {
    if (!user) return;
    const { data } = await supabase.from('social_posts').insert({
      user_id: user.id, content: '', media_urls: [], hashtags: [],
      repost_of: target.id,
    }).select('*, user_profiles(id, username, email)').single();
    if (data) {
      setPosts(prev => [{ ...data as SocialPost, repost_data: target }, ...prev]);
      toast.success('Reposted!');
    }
    setRepostTarget(null);
  }, [user]);

  const handleSearch = (q: string) => {
    setSearchQ(q);
    const tagMatch = q.match(/^#?([\w]+)$/);
    if (tagMatch) { setTag(tagMatch[1]); setPage(0); }
    else if (!q) { setTag(''); setPage(0); }
  };

  const handleNewPost = (p: SocialPost) => {
    setPosts(prev => [p, ...prev]);
  };

  const TABS: { id: FeedTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'for-you',   label: 'For You',   icon: TrendingUp },
    { id: 'following', label: 'Following',  icon: Users },
    { id: 'trending',  label: 'Trending',   icon: Hash },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3 px-4 pt-safe-top pt-12 pb-2">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-none">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <h1 className="font-bold text-foreground text-lg flex-1">Social</h1>
          <button
            onClick={() => navigate('/social/dm')}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
          >
            <AtSign className="w-4 h-4 text-foreground" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-muted rounded-full px-4 py-2.5 border border-border/50">
            <Search className="w-4 h-4 text-muted-foreground flex-none" />
            <input
              value={searchQ}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search posts, #hashtags, @users"
              className="flex-1 bg-transparent text-foreground text-sm placeholder:text-muted-foreground outline-none"
            />
            {searchQ && (
              <button onClick={() => handleSearch('')}>
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Active tag banner */}
        {activeTag && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-primary/15 border border-primary/30 text-primary text-sm font-medium px-3 py-1 rounded-full">
              <Hash className="w-3.5 h-3.5" />
              #{activeTag}
            </div>
            <button onClick={() => { setTag(''); setSearchQ(''); }} className="text-muted-foreground text-xs hover:text-foreground">
              Clear ×
            </button>
          </div>
        )}

        {/* Tabs */}
        {!activeTag && (
          <div className="flex px-4 gap-1 pb-0">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-all',
                    tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Layout: feed + trending sidebar on desktop */}
      <div className="max-w-3xl mx-auto lg:grid lg:grid-cols-[1fr_280px] lg:gap-4 lg:px-4 lg:pt-4">
        <div>
          {/* Compose */}
          {user ? (
            <ComposeBox
              quoteTo={quoteTarget ?? undefined}
              onPost={p => { handleNewPost(p); setQuoteTarget(null); }}
              onCancel={() => setQuoteTarget(null)}
            />
          ) : (
            <div className="px-4 py-4 border-b border-border/40 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <AtSign className="w-5 h-5 text-muted-foreground" />
              </div>
              <button onClick={() => setAuth(true)}
                className="flex-1 text-left text-muted-foreground text-sm bg-muted rounded-full px-4 py-2.5">
                Sign in to post…
              </button>
            </div>
          )}

          {/* Repost quick action */}
          {repostTarget && (
            <div className="px-4 py-3 bg-muted/30 border-b border-border/40 flex items-center gap-3">
              <Repeat2 className="w-5 h-5 text-green-400" />
              <div className="flex-1">
                <p className="text-foreground text-sm font-semibold">Repost from @{repostTarget.user_profiles?.username}?</p>
                <p className="text-muted-foreground text-xs line-clamp-1">{repostTarget.content}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleRepost(repostTarget)}
                  className="text-xs font-semibold bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full hover:bg-green-500/30 transition-colors">
                  Repost
                </button>
                <button onClick={() => { setQuoteTarget(repostTarget); setRepostTarget(null); }}
                  className="text-xs font-semibold bg-primary/20 text-primary px-3 py-1.5 rounded-full hover:bg-primary/30 transition-colors">
                  Quote
                </button>
                <button onClick={() => setRepostTarget(null)}
                  className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Posts feed */}
          {loading && posts.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 px-6">
              <Hash className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-foreground font-semibold">No posts yet</p>
              <p className="text-muted-foreground text-sm mt-1">Be the first to post!</p>
            </div>
          ) : (
            <>
              {posts.map(p => (
                <PostCard
                  key={p.id}
                  post={p}
                  onLike={handleLike}
                  onRepost={t => setRepostTarget(t)}
                />
              ))}
              <div ref={loaderRef} className="py-4 flex items-center justify-center">
                {loading && <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />}
                {!hasMore && posts.length > 0 && <p className="text-muted-foreground text-xs">You're all caught up</p>}
              </div>
            </>
          )}
        </div>

        {/* Trending sidebar (desktop only) */}
        <div className="hidden lg:block pt-0">
          <div className="sticky top-36">
            <TrendingSidebar onTag={t => { setTag(t); setSearchQ(`#${t}`); }} />
          </div>
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setAuth(false)} />}
    </div>
  );
}
