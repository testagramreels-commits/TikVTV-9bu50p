/**
 * Social feed — world-class X-like platform with Stories.
 * Improved: file uploads that actually work, media preview, social notifications,
 * clip sharing, hashtag search, profile navigation, emoji reactions.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Heart, Repeat2, MessageCircle, Share2, Image, Video,
  Hash, Search, ArrowLeft, Send, X, MoreHorizontal,
  Bookmark, TrendingUp, Users, AtSign, Loader2, BadgeCheck,
  Film, Bell, Smile,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { cn, timeAgo as timeAgoUtil } from '@/lib/utils';
import { toast } from 'sonner';
import AuthModal from '@/components/features/AuthModal';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import SocialStories from '@/components/features/SocialStories';
import type { AppNotification } from '@/types';

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
  const sz   = size === 'lg' ? 'w-14 h-14 text-xl' : size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';
  const init = (user?.username || user?.email || '?').slice(0, 1).toUpperCase();
  return (
    <div className={cn('rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white flex-none', sz)}>
      {init}
    </div>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────
function PostCard({ post, onRepost, onLike, depth = 0, onNavigateProfile }: {
  post: SocialPost;
  onRepost?: (p: SocialPost) => void;
  onLike: (id: string, liked: boolean) => void;
  depth?: number;
  onNavigateProfile?: (userId: string) => void;
}) {
  const { user } = useAuthStore();
  const [localLiked, setLocalLiked] = useState(post.isLiked ?? false);
  const [localLikes, setLocalLikes] = useState(post.like_count);
  const [saved, setSaved]           = useState(false);

  if (post.repost_of && !post.content && post.repost_data) {
    return (
      <div className="px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-2">
          <Repeat2 className="w-3.5 h-3.5 text-green-400" />
          <span className="font-semibold">{post.user_profiles?.username} reposted</span>
        </div>
        <PostCard post={post.repost_data} onLike={onLike} depth={depth + 1} onNavigateProfile={onNavigateProfile} />
      </div>
    );
  }

  const handleLikeClick = async () => {
    if (!user) { toast.error('Sign in to like'); return; }
    const next = !localLiked;
    setLocalLiked(next);
    setLocalLikes(c => next ? c + 1 : Math.max(0, c - 1));
    onLike(post.id, next);
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(#[\w]+|@[\w]+)/g);
    return parts.map((p, i) => {
      if (p.startsWith('#')) {
        return <span key={i} className="text-primary font-medium cursor-pointer hover:underline">{p}</span>;
      }
      if (p.startsWith('@')) {
        return <span key={i} className="text-sky-400 font-medium cursor-pointer hover:underline">{p}</span>;
      }
      return <span key={i}>{p}</span>;
    });
  };

  return (
    <article className={cn('border-b border-border/40', depth === 0 ? 'px-4 py-3' : 'px-3 py-2 bg-muted/20 rounded-xl')}>
      <div className="flex gap-3">
        <button onClick={() => onNavigateProfile?.(post.user_id)}>
          <Avatar user={post.user_profiles} size={depth > 0 ? 'sm' : 'md'} />
        </button>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <button
              className="font-bold text-foreground text-sm hover:underline"
              onClick={() => onNavigateProfile?.(post.user_id)}
            >
              @{post.user_profiles?.username || 'user'}
            </button>
            <BadgeCheck className="w-3.5 h-3.5 text-primary flex-none" />
            <span className="text-muted-foreground text-xs">· {timeAgo(post.created_at)}</span>
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
            <div className={cn(
              'grid gap-1.5 mb-2 rounded-xl overflow-hidden',
              post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
            )}>
              {post.media_urls.slice(0, 4).map((url, i) => (
                url.match(/\.(mp4|webm|ogg)$/i) ? (
                  <video key={i} src={url} controls playsInline
                    className="w-full rounded-xl aspect-video object-cover bg-black border border-border/40"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <img key={i} src={url} alt=""
                    className="w-full rounded-xl object-cover aspect-square bg-muted border border-border/40"
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
              <p className="text-foreground/80 text-xs leading-relaxed line-clamp-3">{post.quote_data.content}</p>
            </div>
          )}

          {/* Actions */}
          {depth === 0 && (
            <div className="flex items-center gap-4 mt-2">
              <ActionBtn icon={MessageCircle} count={post.reply_count} onClick={() => {}} />
              <ActionBtn icon={Repeat2} count={post.repost_count}
                onClick={() => { if (!user) { toast.error('Sign in'); return; } onRepost?.(post); }}
                active={post.isReposted} activeColor="text-green-400" />
              <ActionBtn icon={Heart} count={localLikes} onClick={handleLikeClick}
                active={localLiked} activeColor="text-rose-400" />
              <ActionBtn icon={saved ? Bookmark : Bookmark} count={0}
                onClick={() => setSaved(s => !s)} active={saved} activeColor="text-primary" />
              <ActionBtn icon={Share2} count={0} onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/social?post=${post.id}`);
                toast.success('Link copied!');
              }} />
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
      className={cn(
        'flex items-center gap-1.5 group transition-colors min-h-[44px] min-w-[44px] justify-center',
        active ? activeColor : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="w-4 h-4" />
      {count > 0 && (
        <span className="text-xs font-medium">
          {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
        </span>
      )}
    </button>
  );
}

// ── ComposeBox ─────────────────────────────────────────────────────────
function ComposeBox({ replyTo, quoteTo, onPost, onCancel }: {
  replyTo?: SocialPost; quoteTo?: SocialPost;
  onPost: (post: SocialPost) => void; onCancel?: () => void;
}) {
  const { user }  = useAuthStore();
  const [text, setTxt]           = useState('');
  const [files, setFiles]        = useState<File[]>([]);
  const [previews, setPreviews]  = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting]    = useState(false);
  const imgRef  = useRef<HTMLInputElement>(null);
  const vidRef  = useRef<HTMLInputElement>(null);
  const MAX     = 280;

  const EMOJIS = ['😂', '❤️', '🔥', '👏', '😍', '🎉', '🤔', '💯'];
  const [showEmoji, setShowEmoji] = useState(false);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).slice(0, 4 - files.length);
    setFiles(prev => [...prev, ...arr]);
    arr.forEach(f => {
      const url = URL.createObjectURL(f);
      setPreviews(prev => [...prev, url]);
    });
  };

  const removeFile = (i: number) => {
    setFiles(prev => prev.filter((_, j) => j !== i));
    setPreviews(prev => { URL.revokeObjectURL(prev[i]); return prev.filter((_, j) => j !== i); });
  };

  const uploadFiles = async (): Promise<string[]> => {
    if (!user || files.length === 0) return [];
    setUploading(true);
    const urls: string[] = [];
    for (const file of files) {
      const ext  = file.name.split('.').pop() || 'bin';
      const path = `${user.id}/social-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('channel-clips').upload(path, file, {
        contentType: file.type,
        upsert:      false,
      });
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        console.error('[Social upload]', error);
        continue;
      }
      const { data: { publicUrl } } = supabase.storage.from('channel-clips').getPublicUrl(path);
      urls.push(publicUrl);
    }
    setUploading(false);
    return urls;
  };

  const handlePost = async () => {
    if (!user || (!text.trim() && files.length === 0) || posting) return;
    setPosting(true);

    const mediaUrls = await uploadFiles();
    const hashtags  = extractHashtags(text);

    const { data, error } = await supabase.from('social_posts').insert({
      user_id:    user.id,
      content:    text.trim(),
      media_urls: mediaUrls,
      hashtags,
      quote_of:   quoteTo?.id ?? null,
    }).select('*, user_profiles(id, username, email)').single();

    setPosting(false);
    if (error) { toast.error(`Post failed: ${error.message}`); return; }
    setTxt('');
    setFiles([]);
    setPreviews([]);
    toast.success('Posted!');
    onPost(data as SocialPost);
  };

  if (!user) return null;

  return (
    <div className="border-b border-border/50 px-4 py-3 bg-card/30">
      {(replyTo || quoteTo) && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2 bg-muted/30 rounded-xl px-3 py-2">
          {replyTo  && <><MessageCircle className="w-3.5 h-3.5" /><span>Replying to @{replyTo.user_profiles?.username}</span></>}
          {quoteTo  && <><Repeat2 className="w-3.5 h-3.5" /><span>Quoting @{quoteTo.user_profiles?.username}</span></>}
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

          {/* Media previews */}
          {previews.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {previews.map((url, i) => (
                <div key={i} className="relative">
                  {files[i]?.type.startsWith('video') ? (
                    <video src={url} className="w-20 h-20 object-cover rounded-xl border border-border/40" muted />
                  ) : (
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded-xl border border-border/40" />
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-black border border-white/20 flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Emoji picker */}
          {showEmoji && (
            <div className="flex gap-2 flex-wrap mb-2 p-2 bg-muted/30 rounded-xl border border-border/40">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => { setTxt(t => t + e); setShowEmoji(false); }}
                  className="text-xl hover:scale-125 transition-transform">{e}</button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 border-t border-border/30 mt-2">
            {/* Image upload */}
            <button
              onClick={() => imgRef.current?.click()}
              disabled={uploading || files.length >= 4}
              title="Upload image"
              className="w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
            </button>
            <input
              ref={imgRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />

            {/* Video upload */}
            <button
              onClick={() => vidRef.current?.click()}
              disabled={uploading || files.length >= 4}
              title="Upload video"
              className="w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              <Video className="w-4 h-4" />
            </button>
            <input
              ref={vidRef}
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime"
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />

            {/* Clip shortcut */}
            <button
              onClick={() => { toast('Go to Clips tab to share a clip!'); }}
              title="Share a clip"
              className="w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
            >
              <Film className="w-4 h-4" />
            </button>

            {/* Emoji */}
            <button
              onClick={() => setShowEmoji(v => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
            >
              <Smile className="w-4 h-4" />
            </button>

            {/* Character count */}
            <span className={cn('ml-auto text-xs font-mono', text.length > MAX * 0.8 ? 'text-amber-400' : 'text-muted-foreground')}>
              {MAX - text.length}
            </span>

            {/* Post button */}
            <button
              onClick={handlePost}
              disabled={(!text.trim() && files.length === 0) || posting || uploading}
              className="flex items-center gap-1.5 bg-primary text-white font-bold text-sm px-4 py-2 rounded-full disabled:opacity-50 transition-all hover:bg-primary/90 active:scale-95"
            >
              {posting || uploading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading…' : posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Trending Sidebar ───────────────────────────────────────────────────
function TrendingSidebar({ onTag }: { onTag: (t: string) => void }) {
  const navigate = useNavigate();
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
        setTags(
          Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag, count]) => ({ tag, count }))
        );
      });
  }, []);

  return (
    <div className="bg-card/40 border border-border/50 rounded-2xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="font-bold text-foreground text-sm">Trending</span>
      </div>
      {tags.length === 0 && (
        <p className="text-muted-foreground text-xs text-center py-6">No tags yet</p>
      )}
      {tags.map(({ tag, count }) => (
        <button key={tag} onClick={() => onTag(tag)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/20 last:border-0">
          <div className="flex items-center gap-2">
            <Hash className="w-3.5 h-3.5 text-primary" />
            <span className="text-foreground text-sm font-medium">#{tag}</span>
          </div>
          <span className="text-muted-foreground text-xs">{count} posts</span>
        </button>
      ))}

      {/* Navigation shortcuts */}
      <div className="p-3 border-t border-border/40 flex flex-col gap-1.5">
        <button onClick={() => navigate('/social/dm')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-xs px-2 py-1.5 rounded-lg hover:bg-muted/40 transition-colors">
          <AtSign className="w-3.5 h-3.5" /> Messages
        </button>
        <button onClick={() => navigate('/clips')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-xs px-2 py-1.5 rounded-lg hover:bg-muted/40 transition-colors">
          <Film className="w-3.5 h-3.5" /> Clips Gallery
        </button>
      </div>
    </div>
  );
}

// ── Notification Bell ──────────────────────────────────────────────────
function NotificationBell() {
  const { unreadCount, notifications, markAllRead } = usePushNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(v => !v); if (unreadCount > 0) markAllRead(); }}
        className="w-9 h-9 rounded-full bg-muted flex items-center justify-center relative"
      >
        <Bell className="w-4 h-4 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-background border border-border/60 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="font-bold text-foreground text-sm">Notifications</span>
          </div>
          {notifications.length === 0 ? (
            <p className="text-muted-foreground text-xs text-center py-8">No notifications yet</p>
          ) : (
            notifications.slice(0, 8).map(n => (
              <div key={n.id} className={cn('px-4 py-3 border-b border-border/20 last:border-0', !n.read && 'bg-primary/5')}>
                <p className="text-foreground text-xs font-semibold">{n.title}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{n.body}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Inline Bell icon component
function Bell({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// ── Main Social page ────────────────────────────────────────────────────
type FeedTab = 'for-you' | 'following' | 'trending';

export default function Social() {
  const { user }     = useAuthStore();
  const navigate     = useNavigate();
  const [searchParams] = useSearchParams();
  const tagParam     = searchParams.get('tag') || '';

  const [tab, setTab]            = useState<FeedTab>('for-you');
  const [posts, setPosts]        = useState<SocialPost[]>([]);
  const [loading, setLoading]    = useState(true);
  const [searchQ, setSearchQ]    = useState(tagParam ? `#${tagParam}` : '');
  const [activeTag, setTag]      = useState(tagParam);
  const [showAuth, setAuth]      = useState(false);
  const [repostTarget, setRepostTarget] = useState<SocialPost | null>(null);
  const [quoteTarget, setQuoteTarget]   = useState<SocialPost | null>(null);
  const [page, setPage]          = useState(0);
  const [hasMore, setHasMore]    = useState(true);
  const loaderRef                = useRef<HTMLDivElement>(null);
  const pageRef                  = useRef(0);

  const loadPosts = useCallback(async (reset = false) => {
    setLoading(true);
    const from = reset ? 0 : pageRef.current * 20;
    let query  = supabase
      .from('social_posts')
      .select('*, user_profiles(id, username, email)')
      .order('created_at', { ascending: false })
      .range(from, from + 19);

    if (activeTag) query = query.contains('hashtags', [activeTag]);

    const { data, error } = await query;
    if (error) { setLoading(false); return; }

    let enriched = (data || []) as SocialPost[];

    // Fetch like status
    if (user && enriched.length) {
      const ids = enriched.map(p => p.id);
      const { data: likes } = await supabase
        .from('social_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', ids);
      const likedSet = new Set((likes || []).map((l: { post_id: string }) => l.post_id));
      enriched = enriched.map(p => ({ ...p, isLiked: likedSet.has(p.id) }));
    }

    setPosts(prev => reset ? enriched : [...prev, ...enriched]);
    setHasMore(enriched.length === 20);
    if (!reset) { pageRef.current += 1; setPage(p => p + 1); }
    else         { pageRef.current = 1; setPage(1); }
    setLoading(false);
  }, [activeTag, user]);

  useEffect(() => { loadPosts(true); }, [activeTag, tab]);

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current || !hasMore) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && hasMore) loadPosts(false);
    }, { threshold: 0.1 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, loadPosts]);

  const handleLike = useCallback(async (postId: string, liked: boolean) => {
    if (!user) return;
    if (liked) {
      await supabase.from('social_likes').upsert({ post_id: postId, user_id: user.id });
    } else {
      await supabase.from('social_likes').delete().match({ post_id: postId, user_id: user.id });
    }
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, isLiked: liked, like_count: liked ? p.like_count + 1 : Math.max(0, p.like_count - 1) } : p
    ));
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
    if (tagMatch) { setTag(tagMatch[1]); pageRef.current = 0; }
    else if (!q)  { setTag(''); pageRef.current = 0; }
  };

  const TABS: { id: FeedTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'for-you',   label: 'For You',  icon: TrendingUp },
    { id: 'following', label: 'Following', icon: Users },
    { id: 'trending',  label: 'Trending',  icon: Hash },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3 px-4 pt-safe-top pt-12 pb-2">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-none">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <h1 className="font-bold text-foreground text-lg flex-1">Social</h1>
          <NotificationBell />
          <button onClick={() => navigate('/social/dm')}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
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
              <Hash className="w-3.5 h-3.5" />#{activeTag}
            </div>
            <button onClick={() => { setTag(''); setSearchQ(''); }}
              className="text-muted-foreground text-xs hover:text-foreground">Clear ×</button>
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

      {/* Layout: feed + sidebar on desktop */}
      <div className="max-w-3xl mx-auto lg:grid lg:grid-cols-[1fr_260px] lg:gap-4 lg:px-4 lg:pt-4">
        <div>
          {/* Stories */}
          <SocialStories />

          {/* Compose */}
          {user ? (
            <ComposeBox
              quoteTo={quoteTarget ?? undefined}
              onPost={p => { setPosts(prev => [p, ...prev]); setQuoteTarget(null); }}
              onCancel={() => setQuoteTarget(null)}
            />
          ) : (
            <div className="px-4 py-4 border-b border-border/40">
              <button onClick={() => setAuth(true)}
                className="w-full flex items-center gap-3 bg-muted/50 hover:bg-muted rounded-2xl px-4 py-3 text-muted-foreground text-sm transition-colors border border-border/40 hover:border-border">
                <AtSign className="w-5 h-5" />
                Sign in to post…
              </button>
            </div>
          )}

          {/* Repost quick action */}
          {repostTarget && (
            <div className="px-4 py-3 bg-muted/30 border-b border-border/40 flex items-center gap-3">
              <Repeat2 className="w-5 h-5 text-green-400 flex-none" />
              <div className="flex-1 min-w-0">
                <p className="text-foreground text-sm font-semibold">Repost from @{repostTarget.user_profiles?.username}?</p>
                <p className="text-muted-foreground text-xs line-clamp-1">{repostTarget.content}</p>
              </div>
              <div className="flex gap-2 flex-none">
                <button onClick={() => handleRepost(repostTarget)}
                  className="text-xs font-semibold bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full hover:bg-green-500/30">Repost</button>
                <button onClick={() => { setQuoteTarget(repostTarget); setRepostTarget(null); }}
                  className="text-xs font-semibold bg-primary/20 text-primary px-3 py-1.5 rounded-full hover:bg-primary/30">Quote</button>
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
                  onNavigateProfile={id => navigate(`/social/profile/${id}`)}
                />
              ))}
              <div ref={loaderRef} className="py-4 flex items-center justify-center">
                {loading && <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />}
                {!hasMore && posts.length > 0 && (
                  <p className="text-muted-foreground text-xs">You're all caught up ✓</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Trending sidebar (desktop) */}
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
