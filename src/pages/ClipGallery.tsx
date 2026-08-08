/**
 * Clip Gallery — full-screen TikTok-style clips with sound,
 * share-to-social integration, and classy card UI.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import VastPreRoll from '@/components/features/VastPreRoll';
import {
  ArrowLeft, Play, Pause, Clock, Trash2, Loader2, Film, Download,
  Volume2, VolumeX, Share2, Users, ExternalLink, Crown,
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

function expiresIn(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms < 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h < 1) return `${m}m left`;
  return `${h}h ${m}m left`;
}

// ── Full-screen clip viewer (TikTok style) ──────────────────────────────
function ClipViewer({ clips, startIndex, onClose }: {
  clips: ClipRow[];
  startIndex: number;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const [index,    setIndex]    = useState(startIndex);
  const [playing,  setPlaying]  = useState(false); // start paused until ad finishes
  const [muted,    setMuted]    = useState(false);
  const [progress, setProgress] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [showAd,   setShowAd]   = useState(true);  // VAST pre-roll per clip
  const videoRef = useRef<HTMLVideoElement>(null);
  const clip = clips[index];

  // Reset ad + playback on clip change
  useEffect(() => {
    setShowAd(true);
    setPlaying(false);
  }, [index]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = muted;
    if (playing && !showAd) video.play().catch(() => {});
    else video.pause();
  }, [index, playing, muted, showAd]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (video.duration) setProgress(video.currentTime / video.duration);
    };
    const onEnd = () => {
      // Auto-advance to next clip
      if (index < clips.length - 1) setIndex(i => i + 1);
      else setPlaying(false);
    };
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended', onEnd);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('ended', onEnd);
    };
  }, [index, clips.length]);

  const handleAdComplete = () => {
    setShowAd(false);
    setPlaying(true);
  };

  const shareToSocial = async () => {
    if (!user) { toast.error('Sign in to share'); return; }
    const ch = clip.channel;
    // Post directly to social feed
    const { error } = await (await import('@/lib/supabase')).supabase
      .from('social_posts')
      .insert({
        user_id:    user.id,
        content:    `Check out this 60-second clip from ${ch?.name || 'Live TV'} 📺\n\nRecorded live · expires in 24h #tikvtv ${ch?.categories?.[0] ? `#${ch.categories[0]}` : ''}`,
        media_urls: [clip.public_url],
        hashtags:   ['tikvtv', 'livetv', ch?.categories?.[0] || 'general'].filter(Boolean),
        channel_id: clip.channel_id,
      });
    if (error) {
      toast.error('Share failed — trying clipboard');
      await navigator.clipboard.writeText(`${ch?.name || 'Live TV'} clip: ${clip.public_url}`);
    } else {
      toast.success('Clip shared to Social! 🎉');
    }
  };

  const deleteClip = async () => {
    if (!user || clip.recorded_by !== user.id) { toast.error('Not your clip'); return; }
    setDeleting(true);
    await supabase.storage.from('channel-clips').remove([clip.storage_path]);
    await supabase.from('channel_clips').delete().eq('id', clip.id);
    toast.success('Clip deleted');
    if (clips.length <= 1) { onClose(); return; }
    setDeleting(false);
    if (index >= clips.length - 1) setIndex(i => i - 1);
  };

  if (!clip) return null;
  const ch = clip.channel;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* VAST pre-roll — shown before each clip */}
      {showAd && <VastPreRoll onComplete={handleAdComplete} showMessage />}

      {/* Progress bars row */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3 pt-safe-top pt-12">
        {clips.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-none"
              style={{ width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Close + channel info */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-safe-top pt-16 flex items-center gap-3">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        {ch && (
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur rounded-full pl-2 pr-3 py-1.5">
            {ch.logo && (
              <img src={ch.logo} alt={ch.name} className="w-5 h-5 rounded object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <span className="text-white text-xs font-semibold">{ch.name}</span>
            <span className="text-white/50 text-xs">{getCountryFlag(ch.countryCode)}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5 bg-red-600/80 backdrop-blur rounded-full px-2.5 py-1">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-white text-[10px] font-bold">CLIP</span>
        </div>
      </div>

      {/* Video */}
      <div
        className="flex-1 relative"
        onClick={() => !showAd && setPlaying(p => !p)}
      >
        <video
          ref={videoRef}
          src={clip.public_url}
          className="w-full h-full object-contain bg-black"
          playsInline
          muted={muted}
          preload="auto"
        />

        {/* Play/pause overlay */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/20">
              <Play className="w-10 h-10 text-white" fill="white" />
            </div>
          </div>
        )}
      </div>

      {/* Side action bar */}
      <div className="absolute right-4 bottom-32 flex flex-col gap-4 items-center">
        <ActionBtn
          icon={muted ? VolumeX : Volume2}
          label={muted ? 'Unmute' : 'Mute'}
          onClick={() => setMuted(m => !m)}
          active={!muted}
        />
        <ActionBtn icon={Share2}   label="Share"    onClick={shareToSocial} />
        <ActionBtn icon={Download} label="Save"     onClick={() => window.open(clip.public_url, '_blank')} />
        {user?.id === clip.recorded_by && (
          <ActionBtn
            icon={deleting ? Loader2 : Trash2}
            label="Delete"
            onClick={deleteClip}
            danger
          />
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-safe pb-6 bg-gradient-to-t from-black/80 to-transparent pt-16 pointer-events-none">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-white font-bold text-base">{ch?.name || 'Channel Clip'}</p>
            <p className="text-white/50 text-xs mt-0.5">{clip.duration_secs}s · {timeAgo(clip.created_at)}</p>
            <p className="text-white/30 text-[10px] mt-0.5">{expiresIn(clip.expires_at)}</p>
          </div>
          <div className="text-white/30 text-xs text-right">
            {index + 1} / {clips.length}
          </div>
        </div>
      </div>

      {/* Nav: tap left/right areas */}
      <button
        className="absolute left-0 top-0 w-1/3 h-full z-5 opacity-0"
        onClick={e => { e.stopPropagation(); if (index > 0) setIndex(i => i - 1); }}
      />
      <button
        className="absolute right-0 top-0 w-1/3 h-full z-5 opacity-0"
        onClick={e => { e.stopPropagation(); if (index < clips.length - 1) setIndex(i => i + 1); }}
      />
    </div>
  );
}

function ActionBtn({
  icon: Icon, label, onClick, active = true, danger = false,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }}
      className="flex flex-col items-center gap-1">
      <div className={cn('w-12 h-12 rounded-full flex items-center justify-center border',
        danger ? 'bg-red-500/20 border-red-400/30' : 'bg-white/15 border-white/20 backdrop-blur')}>
        <Icon className={cn('w-5 h-5', danger ? 'text-red-400' : active ? 'text-white' : 'text-white/50')} />
      </div>
      <span className="text-white/70 text-[10px]">{label}</span>
    </button>
  );
}

// ── Main Clip Gallery ──────────────────────────────────────────────────
export default function ClipGallery() {
  const navigate     = useNavigate();
  const { user }     = useAuthStore();
  const [clips,      setClips]     = useState<ClipRow[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [filter,     setFilter]    = useState<FilterType>('all');
  const [viewerIdx,  setViewerIdx] = useState<number | null>(null);

  useEffect(() => { loadClips(); }, []);

  async function loadClips() {
    setLoading(true);
    const { data, error } = await supabase
      .from('channel_clips')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(120);

    if (error) { console.error(error); setLoading(false); return; }

    await fetchAllChannels();
    const enriched = (data || []).map(clip => ({
      ...clip,
      channel: getChannelById(clip.channel_id) ?? undefined,
    }));

    setClips(enriched);
    setLoading(false);
  }

  const filteredClips = clips.filter(clip => {
    if (filter === 'mine')   return clip.recorded_by === user?.id;
    if (filter === 'recent') return Date.now() - new Date(clip.created_at).getTime() < 3 * 60 * 60 * 1000;
    return true;
  });

  const totalDuration = clips.reduce((s, c) => s + c.duration_secs, 0);
  const myClips       = clips.filter(c => c.recorded_by === user?.id).length;

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Film className="w-10 h-10 text-primary/40 animate-pulse" />
        <p className="text-white/30 text-sm">Loading clips…</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Fullscreen viewer */}
      {viewerIdx !== null && filteredClips.length > 0 && (
        <ClipViewer
          clips={filteredClips}
          startIndex={viewerIdx}
          onClose={() => setViewerIdx(null)}
        />
      )}

      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 px-4 pt-12 pb-4 bg-black/95 backdrop-blur border-b border-white/8">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-white font-bold text-lg flex items-center gap-2">
                <Film className="w-5 h-5 text-primary" />
                Clip Gallery
              </h1>
              <p className="text-white/40 text-xs">{clips.length} clips · 60s each · 24h expiry</p>
            </div>
            <button
              onClick={() => navigate('/social')}
              className="flex items-center gap-1.5 bg-primary/20 border border-primary/30 text-primary text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-primary/30 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              Social
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Total Clips',    value: clips.length,                            icon: Film },
              { label: 'My Clips',       value: myClips,                                 icon: Crown },
              { label: 'Total Duration', value: `${Math.round(totalDuration / 60)}m`,    icon: Clock },
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
              <button key={f} onClick={() => setFilter(f)}
                className={cn('flex-none text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition-colors',
                  filter === f ? 'bg-primary text-white' : 'bg-white/8 text-white/50 hover:bg-white/15 hover:text-white')}>
                {f === 'recent' ? 'Last 3h' : f}
              </button>
            ))}
          </div>
        </div>

        {filteredClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 px-8">
            <Film className="w-16 h-16 text-white/10" />
            <p className="text-white/30 text-sm text-center">
              {filter === 'mine' ? 'No clips yet. Watch channels to auto-record 60s clips.' : 'No clips match this filter.'}
            </p>
            <button onClick={() => navigate('/')}
              className="bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold">
              Watch Live TV
            </button>
          </div>
        ) : (
          <>
            {/* Tap any clip to open fullscreen viewer */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 px-3 pt-4">
              {filteredClips.map((clip, idx) => {
                const ch    = clip.channel;
                const isOwn = user?.id === clip.recorded_by;

                return (
                  <button
                    key={clip.id}
                    onClick={() => setViewerIdx(idx)}
                    className="relative rounded-2xl overflow-hidden bg-gray-900 border border-white/8 hover:border-white/20 transition-all group active:scale-95"
                  >
                    {/* Thumbnail (video poster) */}
                    <div className="relative aspect-[9/16] bg-black">
                      <video
                        src={clip.public_url}
                        className="w-full h-full object-contain bg-black"
                        preload="metadata"
                        muted
                        playsInline
                      />

                      {/* Play overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                        <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Play className="w-6 h-6 text-white" fill="white" />
                        </div>
                      </div>

                      {/* Duration badge */}
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur text-white text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10">
                        {clip.duration_secs}s
                      </div>

                      {/* Sound badge */}
                      <div className="absolute top-2 left-2 bg-green-500/20 backdrop-blur border border-green-400/30 text-green-300 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Volume2 className="w-2.5 h-2.5" />
                        SOUND
                      </div>

                      {/* My clip badge */}
                      {isOwn && (
                        <div className="absolute bottom-10 left-2 bg-primary/80 backdrop-blur text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          MINE
                        </div>
                      )}

                      {/* Channel info overlay */}
                      <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-6">
                        {ch && (
                          <div className="flex items-center gap-1.5">
                            {ch.logo && (
                              <img src={ch.logo} alt={ch.name}
                                className="w-4 h-4 rounded object-contain flex-none"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            )}
                            <p className="text-white text-[11px] font-semibold truncate">{ch.name}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-2 py-2 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 text-white/30 text-[9px]">
                        <Clock className="w-2.5 h-2.5" />
                        <span className="truncate">{expiresIn(clip.expires_at)}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-none">
                        <ExternalLink className="w-3 h-3 text-white/20" />
                        <Users className="w-3 h-3 text-white/20" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-white/20 text-xs text-center py-6">
              Tap any clip to watch · Swipe to browse all {filteredClips.length} clips
            </p>
          </>
        )}
      </div>
    </>
  );
}
