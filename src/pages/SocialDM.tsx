/**
 * Direct Messages — X-like DM experience
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Search, MessageCircle, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import AuthModal from '@/components/features/AuthModal';

interface DM {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url?: string;
  read_at?: string;
  created_at: string;
}

interface Profile {
  id: string;
  username: string;
  email: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Avatar({ user }: { user: Profile | null }) {
  const init = (user?.username || user?.email || '?').slice(0, 1).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-base flex-none">
      {init}
    </div>
  );
}

export default function SocialDM() {
  const { user }    = useAuthStore();
  const navigate    = useNavigate();
  const [showAuth, setShowAuth] = useState(false);
  const [conversations, setConvs] = useState<{ profile: Profile; lastMsg: DM }[]>([]);
  const [activeChat, setActiveChat] = useState<Profile | null>(null);
  const [messages,   setMessages]   = useState<DM[]>([]);
  const [msg,        setMsg]        = useState('');
  const [sending,    setSending]    = useState(false);
  const [searchQ,    setSearchQ]    = useState('');
  const [searchRes,  setSearchRes]  = useState<Profile[]>([]);
  const [searching,  setSearching]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval>>();

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('social_dms')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (!data) return;

    // Group by partner
    const seen = new Map<string, DM>();
    for (const dm of data) {
      const partner = dm.sender_id === user.id ? dm.receiver_id : dm.sender_id;
      if (!seen.has(partner)) seen.set(partner, dm);
    }

    const partnerIds = Array.from(seen.keys());
    if (!partnerIds.length) { setConvs([]); return; }
    const { data: profiles } = await supabase.from('user_profiles').select('*').in('id', partnerIds);
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    setConvs(partnerIds.map(id => ({ profile: profileMap[id], lastMsg: seen.get(id)! })).filter(c => c.profile));
  }, [user]);

  // Load messages for active chat
  const loadMessages = useCallback(async () => {
    if (!user || !activeChat) return;
    const { data } = await supabase.from('social_dms')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data || []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [user, activeChat]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    loadMessages();
    clearInterval(pollRef.current);
    if (activeChat) {
      pollRef.current = setInterval(loadMessages, 3000); // poll every 3s
    }
    return () => clearInterval(pollRef.current);
  }, [activeChat, loadMessages]);

  const handleSearch = async (q: string) => {
    setSearchQ(q);
    if (!q.trim()) { setSearchRes([]); return; }
    setSearching(true);
    const { data } = await supabase.from('user_profiles').select('*').ilike('username', `%${q}%`).limit(8);
    setSearchRes((data || []).filter(p => p.id !== user?.id));
    setSearching(false);
  };

  const sendMessage = async () => {
    if (!user || !activeChat || !msg.trim() || sending) return;
    setSending(true);
    const { data } = await supabase.from('social_dms').insert({
      sender_id: user.id, receiver_id: activeChat.id, content: msg.trim(),
    }).select().single();
    if (data) {
      setMessages(m => [...m, data as DM]);
      setMsg('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      loadConversations();
    }
    setSending(false);
  };

  if (!user) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-8">
      <MessageCircle className="w-12 h-12 text-muted-foreground/30" />
      <div className="text-center">
        <h2 className="text-foreground font-bold text-xl mb-1">Direct Messages</h2>
        <p className="text-muted-foreground text-sm">Sign in to chat with other users</p>
      </div>
      <button onClick={() => setShowAuth(true)} className="bg-primary text-white font-bold px-8 py-3 rounded-full">Sign In</button>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );

  if (activeChat) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-24">
        {/* Chat header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50 px-4 pt-safe-top pt-12 pb-3 flex items-center gap-3">
          <button onClick={() => setActiveChat(null)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <Avatar user={activeChat} />
          <div className="flex-1">
            <p className="font-bold text-foreground text-sm">@{activeChat.username}</p>
            <p className="text-muted-foreground text-xs">{activeChat.email}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 px-4 py-3 space-y-2 overflow-y-auto">
          {messages.map(dm => {
            const isMine = dm.sender_id === user.id;
            return (
              <div key={dm.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm',
                  isMine ? 'bg-primary text-white rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm')}>
                  <p className="leading-relaxed break-words">{dm.content}</p>
                  <p className={cn('text-[10px] mt-0.5 text-right', isMine ? 'text-white/60' : 'text-muted-foreground')}>
                    {timeAgo(dm.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-20 bg-background/95 backdrop-blur border-t border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Message..."
              className="flex-1 bg-muted text-foreground placeholder:text-muted-foreground text-sm rounded-full px-4 py-3 outline-none border border-border/50 focus:border-primary/50"
            />
            <button
              onClick={sendMessage}
              disabled={!msg.trim() || sending}
              className="w-11 h-11 rounded-full bg-primary flex items-center justify-center disabled:opacity-50 transition-all"
            >
              {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50 px-4 pt-safe-top pt-12 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <h1 className="font-bold text-foreground text-lg flex-1">Messages</h1>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-full px-4 py-2.5 border border-border/50">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={searchQ}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search people…"
            className="flex-1 bg-transparent text-foreground text-sm placeholder:text-muted-foreground outline-none"
          />
          {searchQ && <button onClick={() => handleSearch('')}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
        </div>
      </div>

      {/* Search results */}
      {searchQ && (
        <div className="border-b border-border/40">
          {searching && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-muted-foreground animate-spin" /></div>}
          {searchRes.map(p => (
            <button key={p.id} onClick={() => { setActiveChat(p); setSearchQ(''); setSearchRes([]); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0">
              <Avatar user={p} />
              <div className="text-left">
                <p className="font-semibold text-foreground text-sm">@{p.username}</p>
                <p className="text-muted-foreground text-xs">{p.email}</p>
              </div>
            </button>
          ))}
          {!searching && searchRes.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">No users found</p>
          )}
        </div>
      )}

      {/* Conversations */}
      {conversations.length === 0 && !searchQ ? (
        <div className="text-center py-16 px-6">
          <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-foreground font-semibold">No conversations yet</p>
          <p className="text-muted-foreground text-sm mt-1">Search for people to start chatting</p>
        </div>
      ) : (
        conversations.map(({ profile, lastMsg }) => (
          <button key={profile.id} onClick={() => setActiveChat(profile)}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/30 transition-colors border-b border-border/30">
            <Avatar user={profile} />
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-sm">@{profile.username}</span>
                <span className="text-muted-foreground text-xs">{timeAgo(lastMsg.created_at)}</span>
              </div>
              <p className="text-muted-foreground text-xs truncate mt-0.5">{lastMsg.content}</p>
            </div>
            {!lastMsg.read_at && lastMsg.receiver_id === user.id && (
              <div className="w-2 h-2 rounded-full bg-primary flex-none" />
            )}
          </button>
        ))
      )}
    </div>
  );
}
