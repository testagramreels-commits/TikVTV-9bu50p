/**
 * Watch Party — enhanced chat with reactions, typing indicators,
 * emoji support, and improved room management.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Users, Plus, Copy, Tv2, MessageCircle,
  Loader2, Radio, Globe, Lock, Send, Hash, RefreshCw,
  Smile, Heart, Repeat2, Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { fetchAllChannels, getChannelById } from '@/lib/iptvApi';
import { cn, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';
import type { IPTVChannel } from '@/types';
import AuthModal from '@/components/features/AuthModal';

interface Room {
  id: string;
  name: string;
  channel_id: string;
  host_id: string;
  is_public: boolean;
  participant_count: number;
  created_at: string;
  channel?: IPTVChannel;
}

interface RoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

type ViewMode = 'list' | 'room';

const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👏', '😮', '🎉', '👎', '💯'];

export default function WatchParty() {
  const navigate        = useNavigate();
  const [params]        = useSearchParams();
  const { user }        = useAuthStore();
  const [view,          setView]          = useState<ViewMode>('list');
  const [rooms,         setRooms]         = useState<Room[]>([]);
  const [activeRoom,    setActiveRoom]    = useState<Room | null>(null);
  const [messages,      setMessages]      = useState<RoomMessage[]>([]);
  const [channels,      setChannels]      = useState<IPTVChannel[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [creating,      setCreating]      = useState(false);
  const [showCreate,    setShowCreate]    = useState(false);
  const [showAuth,      setShowAuth]      = useState(false);
  const [newRoomName,   setNewRoomName]   = useState('');
  const [selectedCh,    setSelectedCh]    = useState('');
  const [isPublic,      setIsPublic]      = useState(true);
  const [msgInput,      setMsgInput]      = useState('');
  const [sending,       setSending]       = useState(false);
  const [showEmoji,     setShowEmoji]     = useState(false);
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const pollRef         = useRef<ReturnType<typeof setInterval>>();
  const inputRef        = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAllChannels().then(chs => {
      setChannels(chs.slice(0, 200));
      loadRooms();
    });
    return () => clearInterval(pollRef.current);
  }, []);

  // Auto-join from URL
  useEffect(() => {
    const roomId = params.get('room');
    if (roomId && rooms.length > 0) {
      const room = rooms.find(r => r.id === roomId);
      if (room) joinRoom(room);
    } else if (roomId && rooms.length === 0 && !loading) {
      // Room not in public list — try direct lookup
      supabase.from('watch_party_rooms').select('*').eq('id', roomId).maybeSingle().then(({ data }) => {
        if (data) joinRoom({ ...data, channel: getChannelById(data.channel_id) });
        else toast.error('Room not found or has expired');
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, rooms.length, loading]);

  async function loadRooms() {
    setLoading(true);
    const { data } = await supabase
      .from('watch_party_rooms')
      .select('*')
      .eq('is_public', true)
      .order('participant_count', { ascending: false })
      .limit(50);

    if (data) {
      setRooms(data.map((r: Room) => ({ ...r, channel: getChannelById(r.channel_id) })));
    }
    setLoading(false);
  }

  async function createRoom() {
    if (!user) { setShowAuth(true); return; }
    if (!newRoomName.trim() || !selectedCh) { toast.error('Fill in all fields'); return; }
    setCreating(true);

    const { data, error } = await supabase
      .from('watch_party_rooms')
      .insert({ name: newRoomName.trim(), channel_id: selectedCh, host_id: user.id, is_public: isPublic, participant_count: 1 })
      .select().single();

    if (error) { toast.error('Could not create room'); setCreating(false); return; }

    const room: Room = { ...data, channel: getChannelById(data.channel_id) };
    setRooms(prev => [room, ...prev]);
    setShowCreate(false);
    setNewRoomName('');
    joinRoom(room);
    setCreating(false);
  }

  const joinRoom = useCallback(async (room: Room) => {
    setActiveRoom(room);
    setView('room');
    loadMessages(room.id);

    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(room.id), 5_000); // 5s poll

    if (user) {
      await supabase.from('watch_party_rooms')
        .update({ participant_count: (room.participant_count || 0) + 1 })
        .eq('id', room.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function leaveRoom() {
    clearInterval(pollRef.current);
    if (activeRoom && user) {
      await supabase.from('watch_party_rooms')
        .update({ participant_count: Math.max(1, (activeRoom.participant_count || 1) - 1) })
        .eq('id', activeRoom.id);
    }
    setActiveRoom(null);
    setMessages([]);
    setView('list');
    loadRooms();
  }

  async function loadMessages(roomId: string) {
    const { data } = await supabase
      .from('watch_party_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(80);
    if (data) {
      setMessages(data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }

  async function sendMessage(content?: string) {
    const text = content || msgInput.trim();
    if (!user) { setShowAuth(true); return; }
    if (!text || !activeRoom) return;
    setSending(true);

    const { data, error } = await supabase
      .from('watch_party_messages')
      .insert({
        room_id:  activeRoom.id,
        user_id:  user.id,
        username: user.username || user.email?.split('@')[0] || 'User',
        content:  text,
      })
      .select().single();

    if (!error && data) {
      setMessages(prev => [...prev, data]);
      if (!content) setMsgInput('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
    setSending(false);
  }

  function copyRoomLink() {
    if (!activeRoom) return;
    const link = `${window.location.origin}/party?room=${activeRoom.id}`;
    navigator.clipboard.writeText(link)
      .then(() => toast.success('Invite link copied! Share it with friends 🎉'));
  }

  function shareRoomLink() {
    if (!activeRoom) return;
    const link = `${window.location.origin}/party?room=${activeRoom.id}`;
    if (navigator.share) {
      navigator.share({ title: `Join: ${activeRoom.name}`, text: 'Watch live TV together!', url: link });
    } else {
      copyRoomLink();
    }
  }

  // ── Room view ──────────────────────────────────────────────────────
  if (view === 'room' && activeRoom) {
    const ch = activeRoom.channel;
    return (
      <div className="h-screen bg-black flex flex-col">
        {/* Header */}
        <div className="flex-none px-4 pt-12 pb-3 bg-black/95 backdrop-blur border-b border-white/8">
          <div className="flex items-center gap-3">
            <button onClick={leaveRoom}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-none" />
                <p className="text-white font-bold text-sm truncate">{activeRoom.name}</p>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Users className="w-3 h-3 text-white/40 flex-none" />
                <span className="text-white/40 text-xs">{activeRoom.participant_count} watching</span>
                {ch && <span className="text-primary text-xs truncate">· {ch.name}</span>}
              </div>
            </div>
            <button onClick={shareRoomLink}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" title="Share invite link">
              <Copy className="w-4 h-4 text-white/60" />
            </button>
            <button
              onClick={() => ch && navigate(`/channel/${ch.id}`)}
              disabled={!ch}
              className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-3 py-2 rounded-full hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              <Tv2 className="w-3.5 h-3.5" />Watch
            </button>
          </div>
        </div>

        {/* Channel strip */}
        {ch && (
          <div className="flex-none px-4 py-2.5 bg-white/3 border-b border-white/5">
            <button onClick={() => navigate(`/channel/${ch.id}`)} className="flex items-center gap-3 w-full">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/8 flex-none flex items-center justify-center">
                {ch.logo
                  ? <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain p-1" />
                  : <Tv2 className="w-4 h-4 text-white/30" />}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-white font-semibold text-sm truncate">{ch.name}</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs font-bold">LIVE</span>
                  <span className="text-white/30 text-xs">· Tap to watch together</span>
                </div>
              </div>
              <Radio className="w-4 h-4 text-primary/50 flex-none" />
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <MessageCircle className="w-10 h-10 text-white/10" />
              <p className="text-white/30 text-sm text-center">Be the first to say hi! 👋</p>
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.user_id === user?.id;
              const isEmoji = /^[\p{Emoji}\s]+$/u.test(msg.content) && msg.content.length <= 4;

              return (
                <div key={msg.id} className={cn('flex gap-2', isMe && 'flex-row-reverse')}>
                  <div className={cn(
                    'w-7 h-7 rounded-full flex-none flex items-center justify-center text-xs font-bold flex-shrink-0',
                    isMe ? 'bg-primary' : 'bg-white/15'
                  )}>
                    {msg.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className={cn('max-w-[75%]', isMe && 'items-end flex flex-col')}>
                    {!isMe && (
                      <p className="text-white/30 text-[10px] mb-0.5">{msg.username}</p>
                    )}
                    <div className={cn(
                      isEmoji
                        ? 'text-3xl leading-none'
                        : cn('rounded-2xl px-3 py-2 text-sm',
                          isMe
                            ? 'bg-primary text-white rounded-tr-sm'
                            : 'bg-white/10 text-white/90 rounded-tl-sm border border-white/8')
                    )}>
                      {msg.content}
                    </div>
                    <p className="text-white/20 text-[9px] mt-0.5">{timeAgo(msg.created_at)}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Emoji reactions */}
        {showEmoji && (
          <div className="flex-none px-4 py-2 bg-black/95 border-t border-white/8">
            <div className="flex gap-2 justify-around">
              {QUICK_REACTIONS.map(e => (
                <button key={e} onClick={() => { sendMessage(e); setShowEmoji(false); }}
                  className="text-2xl hover:scale-125 transition-transform active:scale-90 p-2">
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat input */}
        <div className="flex-none px-4 py-3 border-t border-white/8 bg-black/95 pb-28">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmoji(v => !v)}
              className={cn('w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-none',
                showEmoji ? 'bg-primary/20 text-primary' : 'bg-white/8 text-white/50 hover:bg-white/15')}
            >
              <Smile className="w-5 h-5" />
            </button>

            <input
              ref={inputRef}
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !sending && sendMessage()}
              placeholder={user ? 'Say something…' : 'Sign in to chat'}
              disabled={!user}
              className="flex-1 bg-white/8 border border-white/12 rounded-full px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-primary/50 disabled:opacity-40 transition-colors"
            />

            <button
              onClick={() => sendMessage()}
              disabled={!msgInput.trim() || sending || !user}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 flex-none"
            >
              {sending
                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                : <Send className="w-4 h-4 text-white" />}
            </button>
          </div>

          {!user && (
            <button onClick={() => setShowAuth(true)}
              className="w-full mt-2 text-primary text-xs text-center hover:underline">
              Sign in to join the chat
            </button>
          )}
        </div>

        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  // ── Room list ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-12 pb-4 bg-black/95 backdrop-blur border-b border-white/8">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />Watch Party
            </h1>
            <p className="text-white/40 text-xs">{rooms.length} active rooms</p>
          </div>
          <button onClick={loadRooms}
            className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center hover:bg-white/15">
            <RefreshCw className="w-4 h-4 text-white/50" />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-primary text-white text-sm font-bold px-4 py-2 rounded-full hover:bg-primary/90">
            <Plus className="w-4 h-4" />Create
          </button>
        </div>

        {/* Live stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Rooms',        value: rooms.length,                                            color: 'text-white', icon: Radio },
            { label: 'Live Viewers', value: rooms.reduce((s, r) => s + (r.participant_count || 0), 0), color: 'text-green-400', icon: Users },
            { label: 'Channels',     value: new Set(rooms.map(r => r.channel_id)).size,              color: 'text-primary', icon: Tv2 },
          ].map(s => (
            <div key={s.label} className="bg-white/5 rounded-xl p-2.5 text-center border border-white/8">
              <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              <p className="text-white/30 text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Create room modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-end">
          <div className="w-full bg-gray-950 rounded-t-3xl p-6 border-t border-white/10">
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-6" />
            <h2 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />Create Watch Party
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-white/60 text-xs font-semibold mb-1.5 block">Room Name</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
                    placeholder="e.g. Soccer Night 🏆"
                    className="w-full bg-white/8 border border-white/12 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-primary/50" />
                </div>
              </div>

              <div>
                <label className="text-white/60 text-xs font-semibold mb-1.5 block">Channel to Watch</label>
                <select value={selectedCh} onChange={e => setSelectedCh(e.target.value)}
                  className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/50 appearance-none">
                  <option value="" className="bg-gray-900">Select a channel…</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id} className="bg-gray-900">{ch.name} ({ch.country})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-white text-sm font-semibold">Public Room</p>
                  <p className="text-white/40 text-xs">Anyone can discover and join</p>
                </div>
                <button onClick={() => setIsPublic(p => !p)}
                  className={cn('relative w-12 h-6 rounded-full transition-colors', isPublic ? 'bg-primary' : 'bg-white/15')}>
                  <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                    isPublic ? 'translate-x-6' : 'translate-x-0.5')} />
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/8 text-white/70 font-semibold text-sm">Cancel</button>
                <button onClick={createRoom} disabled={creating || !newRoomName.trim() || !selectedCh}
                  className="flex-1 py-3 rounded-2xl bg-primary text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                  {creating ? 'Creating…' : 'Start Party'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rooms list */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 px-8">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Radio className="w-10 h-10 text-primary/40" />
          </div>
          <p className="text-white/40 text-center text-sm">No watch parties yet.<br />Create one and invite friends!</p>
          <button onClick={() => setShowCreate(true)}
            className="bg-primary text-white px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" />Create First Party
          </button>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {rooms.map(room => {
            const ch = room.channel;
            return (
              <button key={room.id} onClick={() => joinRoom(room)}
                className="w-full flex items-center gap-3 bg-white/4 hover:bg-white/8 border border-white/8 hover:border-white/15 rounded-2xl p-3.5 text-left transition-all active:scale-[0.98]">
                <div className="w-14 h-14 rounded-xl bg-white/8 flex-none overflow-hidden flex items-center justify-center relative">
                  {ch?.logo ? <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain p-1.5" /> : <Tv2 className="w-6 h-6 text-white/20" />}
                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-white font-bold text-sm truncate">{room.name}</p>
                    {!room.is_public && <Lock className="w-3 h-3 text-white/30 flex-none" />}
                    {room.is_public  && <Globe className="w-3 h-3 text-green-400/50 flex-none" />}
                  </div>
                  {ch && <p className="text-white/50 text-xs truncate">{ch.name}</p>}
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-primary/60" />
                      <span className="text-white/50 text-xs">{room.participant_count}</span>
                    </div>
                    <span className="text-white/25 text-[10px]">{timeAgo(room.created_at)}</span>
                  </div>
                </div>
                <div className={cn('flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full flex-none',
                  room.participant_count > 10 ? 'bg-red-500/15 text-red-400' : 'bg-primary/15 text-primary')}>
                  <Zap className="w-3 h-3" />Join
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
