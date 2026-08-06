import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Clock, Trash2, Loader2, Film, Download,
  Volume2, VolumeX
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { getChannelById, fetchAllChannels } from '@/lib/iptvApi';
import { cn, getCountryFlag, timeAgo } from '@/lib/utils';
import type { IPTVChannel } from '@/types';
import { toast } from 'sonner';

interface ClipRow {
  id: string;
  channel_id: string;
  storage_path: string;
  public_url: string;
  duration_secs: number;
  recorded_by: string | null;
  expires_at: string;
  created_at: string;
  channel?: IPTVChannel;
}

type FilterType = 'all' | 'mine' | 'recent';

export default function ClipGallery() {
  const navigate     = useNavigate();
  const { user }     = useAuthStore();
  const [clips,      setClips]    = useState<ClipRow[]>([]);
  const [loading,    setLoading]  = useState(true);
  const [playing,    setPlaying]  = useState<string | null>(null);
  const [muted,      setMuted]    = useState(true);
  const [deleting,   setDeleting] = useState<string | null>(null);
  const [filter,     setFilter]   = useState<FilterType>('all');
  const videoRefs    = useRef<Record<string, HTMLVideoElement | null>>({});
  const audioCtxRef  = useRef<AudioContext | null>(null);

  useEffect(() => {
    loadClips();
  }, []);

  async function loadClips() {
    setLoading(true);
    const { data, error } = await supabase
      .from('channel_clips')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) { console.error(error); setLoading(false); return; }

    await fetchAllChannels();

    const enriched = (data || []).map(clip => ({
      ...clip,
      channel: getChannelById(clip.channel_id) ?? undefined,
    }));

    setClips(enriched);
    setLoading(false);
  }

  async function deleteClip(clip: ClipRow) {
    if (!user || clip.recorded_by !== user.id) { toast.error('Not your clip'); return; }
    setDeleting(clip.id);
    await supabase.storage.from('channel-clips').remove([clip.storage_path]);
    const { error } = await supabase.from('channel_clips').delete().eq('id', clip.id);
    if (error) { toast.error('Delete failed'); }
    else {
      setClips(prev => prev.filter(c => c.id !== clip.id));
      toast.success('Clip deleted');
    }
    setDeleting(null);
  }

  function handlePlay(clipId: string) {
    // Initialize AudioContext on first interaction (required by browsers)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    // Pause all others
    Object.entries(videoRefs.current).forEach(([id, el]) => {
      if (id !== clipId && el) { el.pause(); el.currentTime = 0; }
    });

    const el = videoRefs.current[clipId];
    if (!el) return;

    if (playing === clipId) {
      el.pause();
      setPlaying(null);
    } else {
      el.muted = muted;
      el.play().catch(() => {});
      setPlaying(clipId);
    }
  }

  function handleToggleMute() {
    const newMuted = !muted;
    setMuted(newMuted);
    // Apply to currently playing video
    if (playing && videoRefs.current[playing]) {
      videoRefs.current[playing]!.muted = newMuted;
    }
  }

  function expiresIn(expiresAt: string): string {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms < 0) return 'Expired';
    const h = Math.floor(ms / 3600000);
    if (h < 1) return 'Expires soon';
    return `${h}h left`;
  }

  const filteredClips = clips.filter(clip => {
    if (filter === 'mine')   return clip.recorded_by === user?.id;
    if (filter === 'recent') return Date.now() - new Date(clip.created_at).getTime() < 3 * 60 * 60 * 1000;
    return true;
  });

  const totalDuration = clips.reduce((s, c) => s + c.duration_secs, 0);
  const myClips = clips.filter(c => c.recorded_by === user?.id).length;

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-12 pb-4 bg-black/95 backdrop-blur border-b border-white/8">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-bold text-lg">Clip Gallery</h1>
            <p className="text-white/40 text-xs">{clips.length} clips · auto-expire after 24h</p>
          </div>
          {/* Mute toggle for playing clips */}
          <button
            onClick={handleToggleMute}
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center transition-all',
              playing ? 'bg-white/15 border border-white/20' : 'bg-white/8'
            )}
          >
            {muted
              ? <VolumeX className="w-4 h-4 text-white/60" />
              : <Volume2 className="w-4 h-4 text-white" />}
          </button>
          <Film className="w-5 h-5 text-primary" />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Total Clips',   value: clips.length },
            { label: 'My Clips',      value: myClips },
            { label: 'Total Duration', value: `${Math.round(totalDuration / 60)}m` },
          ].map(s => (
            <div key={s.label} className="bg-white/5 rounded-xl p-2.5 text-center border border-white/8">
              <p className="text-white font-bold text-lg">{s.value}</p>
              <p className="text-white/30 text-[10px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          {(['all', 'mine', 'recent'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-none text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition-colors',
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-white/8 text-white/50 hover:bg-white/15 hover:text-white'
              )}
            >
              {f === 'recent' ? 'Last 3h' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Clips grid */}
      {filteredClips.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 px-8">
          <Film className="w-16 h-16 text-white/10" />
          <p className="text-white/30 text-sm text-center">
            {filter === 'mine'
              ? 'No clips recorded by you yet. Watch channels to auto-record.'
              : 'No clips match this filter.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold"
          >
            Watch Live TV
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-4 pt-4">
          {filteredClips.map(clip => {
            const ch = clip.channel;
            const isPlaying = playing === clip.id;
            const isOwn = user?.id === clip.recorded_by;

            return (
              <div
                key={clip.id}
                className={cn(
                  'relative rounded-2xl overflow-hidden bg-gray-900 border group transition-all',
                  isPlaying
                    ? 'border-primary/60 ring-2 ring-primary/20'
                    : 'border-white/8 hover:border-white/20'
                )}
              >
                {/* Video */}
                <div className="relative aspect-[9/16] bg-black">
                  <video
                    ref={el => { videoRefs.current[clip.id] = el; }}
                    src={clip.public_url}
                    className="w-full h-full object-contain bg-black"
                    playsInline
                    loop
                    muted={muted}
                    onEnded={() => setPlaying(null)}
                  />

                  {/* Play overlay */}
                  <button
                    onClick={() => handlePlay(clip.id)}
                    className={cn(
                      'absolute inset-0 flex items-center justify-center transition-opacity',
                      isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'
                    )}
                  >
                    <div className={cn(
                      'w-14 h-14 rounded-full flex items-center justify-center transition-all',
                      'bg-black/60 backdrop-blur border border-white/20 group-hover:scale-110',
                      isPlaying && 'opacity-0 group-hover:opacity-100'
                    )}>
                      <Play className="w-6 h-6 text-white" fill="white" />
                    </div>
                  </button>

                  {/* Now playing indicator */}
                  {isPlaying && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-primary/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                      <div className="flex gap-0.5">
                        <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
                        <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                      </div>
                      PLAYING
                    </div>
                  )}

                  {/* Sound indicator */}
                  {isPlaying && (
                    <button
                      onClick={e => { e.stopPropagation(); handleToggleMute(); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center"
                    >
                      {muted
                        ? <VolumeX className="w-3.5 h-3.5 text-white/70" />
                        : <Volume2 className="w-3.5 h-3.5 text-white" />}
                    </button>
                  )}

                  {/* Gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />

                  {/* Duration badge */}
                  <div className="absolute bottom-8 right-2 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                    {clip.duration_secs}s
                  </div>

                  {/* Channel info */}
                  <div className="absolute bottom-2 left-2 right-2">
                    {ch && (
                      <div className="flex items-center gap-1.5">
                        {ch.logo && (
                          <img src={ch.logo} alt={ch.name} className="w-5 h-5 rounded object-contain bg-white/10 flex-none" />
                        )}
                        <p className="text-white text-[11px] font-semibold truncate">{ch.name}</p>
                        <span className="text-white/50 text-[10px] flex-none">{getCountryFlag(ch.countryCode)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-2 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-white/30 text-[10px]">
                      <Clock className="w-3 h-3 flex-none" />
                      <span className="truncate">{expiresIn(clip.expires_at)}</span>
                    </div>
                    <p className="text-white/20 text-[9px] mt-0.5">{timeAgo(clip.created_at)}</p>
                  </div>

                  <div className="flex items-center gap-1 flex-none">
                    <a
                      href={clip.public_url}
                      download
                      onClick={e => e.stopPropagation()}
                      className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-white/50" />
                    </a>
                    {isOwn && (
                      <button
                        onClick={() => deleteClip(clip)}
                        disabled={deleting === clip.id}
                        className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        {deleting === clip.id
                          ? <Loader2 className="w-3 h-3 text-red-400 animate-spin" />
                          : <Trash2 className="w-3 h-3 text-red-400" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
