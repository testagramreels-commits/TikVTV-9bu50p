/**
 * Unified Search — searches channels, social posts, users, hashtags, and clips.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search as SearchIcon, X, Tv, Loader2, Hash,
  Users, Film, MessageSquare, Star, Compass,
} from 'lucide-react';
import { fetchAllChannels, searchChannels } from '@/lib/iptvApi';
import { getCountryFlag, categoryColor, cn } from '@/lib/utils';
import { CATEGORIES } from '@/constants/categories';
import { supabase } from '@/lib/supabase';
import type { IPTVChannel } from '@/types';

type SearchTab = 'channels' | 'social' | 'users' | 'hashtags' | 'clips';

interface SocialResult {
  id: string;
  content: string;
  created_at: string;
  hashtags: string[];
  user_profiles?: { username: string; email: string };
}
interface UserResult { id: string; username: string; email: string; }
interface ClipResult { id: string; channel_id: string; public_url: string; duration_secs: number; }

const TABS: { id: SearchTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'channels',  label: 'Channels',  icon: Tv },
  { id: 'social',    label: 'Posts',     icon: MessageSquare },
  { id: 'users',     label: 'People',    icon: Users },
  { id: 'hashtags',  label: 'Hashtags',  icon: Hash },
  { id: 'clips',     label: 'Clips',     icon: Film },
];

export default function Search() {
  const navigate              = useNavigate();
  const [query,   setQuery]   = useState('');
  const [tab,     setTab]     = useState<SearchTab>('channels');
  const [cat,     setCat]     = useState('all');
  const [loading, setLoading] = useState(false);
  const [ready,   setReady]   = useState(false);
  const debounceRef           = useRef<ReturnType<typeof setTimeout>>();
  const inputRef              = useRef<HTMLInputElement>(null);

  // Channel results
  const [channels,  setChannels]  = useState<IPTVChannel[]>([]);
  // Social results
  const [posts,     setPosts]     = useState<SocialResult[]>([]);
  const [users,     setUsers]     = useState<UserResult[]>([]);
  const [hashtags,  setHashtags]  = useState<{ tag: string; count: number }[]>([]);
  const [clips,     setClips]     = useState<ClipResult[]>([]);

  useEffect(() => {
    fetchAllChannels().then(() => {
      setReady(true);
      setChannels(searchChannels('', 'all', '', 60));
    });
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const runSearch = useCallback(async (q: string, category: string, activeTab: SearchTab) => {
    clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        if (activeTab === 'channels') {
          setChannels(searchChannels(q, category, '', 80));
        } else if (activeTab === 'social' && q.trim()) {
          const { data } = await supabase
            .from('social_posts')
            .select('id, content, created_at, hashtags, user_profiles(username, email)')
            .ilike('content', `%${q}%`)
            .order('created_at', { ascending: false })
            .limit(30);
          setPosts(data as SocialResult[] || []);
        } else if (activeTab === 'users' && q.trim()) {
          const { data } = await supabase
            .from('user_profiles')
            .select('id, username, email')
            .or(`username.ilike.%${q}%,email.ilike.%${q}%`)
            .limit(20);
          setUsers(data as UserResult[] || []);
        } else if (activeTab === 'hashtags') {
          const { data } = await supabase
            .from('social_posts')
            .select('hashtags')
            .order('created_at', { ascending: false })
            .limit(500);
          if (data) {
            const map: Record<string, number> = {};
            for (const row of data) {
              for (const t of (row.hashtags || [])) {
                if (!q.trim() || t.includes(q.replace('#', '').toLowerCase())) {
                  map[t] = (map[t] || 0) + 1;
                }
              }
            }
            setHashtags(Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([tag, count]) => ({ tag, count })));
          }
        } else if (activeTab === 'clips') {
          let qb = supabase.from('channel_clips').select('id, channel_id, public_url, duration_secs').gt('expires_at', new Date().toISOString()).limit(40);
          if (q.trim()) qb = qb.ilike('channel_id', `%${q}%`);
          const { data } = await qb;
          setClips(data as ClipResult[] || []);
        }
      } catch (e) {
        console.error('[Search]', e);
      }
      setLoading(false);
    }, 300);
  }, []);

  const handleQuery = (v: string) => {
    setQuery(v);
    runSearch(v, cat, tab);
  };
  const handleTab = (t: SearchTab) => {
    setTab(t);
    runSearch(query, cat, t);
  };
  const handleCat = (c: string) => {
    setCat(c);
    runSearch(query, c, tab);
  };

  useEffect(() => {
    runSearch(query, cat, tab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur border-b border-white/10">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-white/10 rounded-full px-4 py-2.5 border border-white/15">
            <SearchIcon className="w-4 h-4 text-white/40 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => handleQuery(e.target.value)}
              placeholder="Search channels, posts, people, #tags…"
              className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none"
            />
            {query && (
              <button onClick={() => handleQuery('')}>
                <X className="w-4 h-4 text-white/40 hover:text-white/80 transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex px-3 gap-1 pb-1 overflow-x-auto scrollbar-none">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => handleTab(t.id)}
                className={cn('flex-none flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap',
                  tab === t.id
                    ? 'bg-primary text-white'
                    : 'bg-white/8 text-white/50 hover:bg-white/15 hover:text-white')}>
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Category pills (channels only) */}
        {tab === 'channels' && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
            {CATEGORIES.slice(0, 10).map(c => (
              <button key={c.id} onClick={() => handleCat(c.id)}
                className={cn('flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                  cat === c.id ? 'bg-primary/20 border border-primary/40 text-primary' : 'bg-white/8 text-white/50 hover:bg-white/15')}>
                <span>{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!ready && tab === 'channels' ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
            <p className="text-white/30 text-sm">Loading channels…</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Channels ── */}
            {tab === 'channels' && (
              channels.length === 0 ? (
                <EmptyState icon={Tv} message="No channels found" sub={query ? `Try a different term` : ''} />
              ) : (
                <>
                  <ResultCount count={channels.length} unit="channel" query={query} />
                  {channels.map(ch => (
                    <ChannelRow key={ch.id} channel={ch} onClick={() => navigate(`/channel/${ch.id}`)} />
                  ))}
                </>
              )
            )}

            {/* ── Social posts ── */}
            {tab === 'social' && (
              !query.trim() ? (
                <EmptyState icon={MessageSquare} message="Type to search posts" sub="Search by keywords or phrases" />
              ) : posts.length === 0 ? (
                <EmptyState icon={MessageSquare} message="No posts found" sub={`No posts matching "${query}"`} />
              ) : (
                <>
                  <ResultCount count={posts.length} unit="post" query={query} />
                  {posts.map(p => (
                    <button key={p.id} onClick={() => navigate('/social')}
                      className="w-full text-left px-4 py-4 border-b border-white/5 hover:bg-white/4 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold flex-none">
                          {(p.user_profiles?.username || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-primary text-sm font-semibold">@{p.user_profiles?.username || 'user'}</span>
                        <span className="text-white/30 text-xs ml-auto">{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-white/80 text-sm line-clamp-2 leading-relaxed">{p.content}</p>
                      {p.hashtags?.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mt-1.5">
                          {p.hashtags.slice(0, 4).map(t => (
                            <span key={t} className="text-primary text-xs">#{t}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </>
              )
            )}

            {/* ── Users ── */}
            {tab === 'users' && (
              !query.trim() ? (
                <EmptyState icon={Users} message="Search for people" sub="Type a username to find users" />
              ) : users.length === 0 ? (
                <EmptyState icon={Users} message="No users found" sub={`No user matching "${query}"`} />
              ) : (
                <>
                  <ResultCount count={users.length} unit="user" query={query} />
                  {users.map(u => (
                    <button key={u.id} onClick={() => navigate(`/social/profile/${u.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-4 border-b border-white/5 hover:bg-white/4 transition-colors text-left">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg flex-none">
                        {(u.username || u.email || '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">@{u.username}</p>
                        <p className="text-white/40 text-xs truncate">{u.email}</p>
                      </div>
                      <Compass className="w-4 h-4 text-white/20 flex-none" />
                    </button>
                  ))}
                </>
              )
            )}

            {/* ── Hashtags ── */}
            {tab === 'hashtags' && (
              hashtags.length === 0 ? (
                <EmptyState icon={Hash} message="No hashtags yet" sub="Post with #hashtags to get started" />
              ) : (
                <>
                  <ResultCount count={hashtags.length} unit="hashtag" query={query} />
                  <div className="p-4 flex flex-wrap gap-2">
                    {hashtags.map(({ tag, count }) => (
                      <button key={tag} onClick={() => navigate(`/social?tag=${tag}`)}
                        className="flex items-center gap-2 bg-white/8 border border-white/12 text-white px-3 py-2 rounded-full hover:bg-primary/20 hover:border-primary/30 hover:text-primary transition-all">
                        <Hash className="w-3.5 h-3.5 text-primary/60" />
                        <span className="font-semibold text-sm">#{tag}</span>
                        <span className="text-white/40 text-xs">{count}</span>
                        <Star className="w-3 h-3 text-white/20" />
                      </button>
                    ))}
                  </div>
                </>
              )
            )}

            {/* ── Clips ── */}
            {tab === 'clips' && (
              clips.length === 0 ? (
                <EmptyState icon={Film} message="No clips available" sub="Watch channels to auto-record 60s clips" />
              ) : (
                <>
                  <ResultCount count={clips.length} unit="clip" query={query} />
                  <div className="grid grid-cols-3 gap-2 p-3">
                    {clips.map(clip => (
                      <button key={clip.id} onClick={() => navigate('/clips')}
                        className="relative aspect-[9/16] rounded-xl overflow-hidden bg-gray-900 border border-white/10 hover:border-white/25 transition-colors">
                        <video src={clip.public_url} className="w-full h-full object-contain bg-black" preload="metadata" muted playsInline />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center border border-white/20">
                            <Film className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[9px] px-1 py-0.5 rounded font-mono">
                          {clip.duration_secs}s
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ResultCount({ count, unit, query }: { count: number; unit: string; query: string }) {
  return (
    <p className="text-white/30 text-xs px-4 pt-4 pb-2">
      {count} {unit}{count !== 1 ? 's' : ''}{query ? ` for "${query}"` : ''}
    </p>
  );
}

function EmptyState({ icon: Icon, message, sub }: { icon: React.FC<{ className?: string }>; message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 px-8">
      <Icon className="w-12 h-12 text-white/10" />
      <p className="text-white/30 text-sm">{message}</p>
      {sub && <p className="text-white/20 text-xs text-center">{sub}</p>}
    </div>
  );
}

function ChannelRow({ channel: ch, onClick }: { channel: IPTVChannel; onClick: () => void }) {
  const flag = getCountryFlag(ch.countryCode);
  const cat  = ch.categories[0] || 'general';
  const [imgErr, setImgErr] = useState(false);

  return (
    <button onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 active:bg-white/10 transition-colors text-left w-full">
      <div className="w-12 h-12 rounded-xl bg-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center border border-white/8">
        {ch.logo && !imgErr ? (
          <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain p-1" onError={() => setImgErr(true)} />
        ) : (
          <span className="text-white/50 text-lg font-bold">{ch.name.charAt(0)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{ch.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-base leading-none">{flag}</span>
          <span className="text-white/40 text-xs">{ch.country || 'Global'}</span>
          {ch.languages[0] && <span className="text-white/25 text-xs uppercase">· {ch.languages[0]}</span>}
        </div>
      </div>
      <span className={cn('text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', categoryColor(cat))}>
        {cat.charAt(0).toUpperCase() + cat.slice(1)}
      </span>
    </button>
  );
}
