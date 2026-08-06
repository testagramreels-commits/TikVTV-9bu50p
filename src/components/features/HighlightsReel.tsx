/**
 * Horizontal swipeable row of 45-second clips from the channel_clips table.
 * Inserted into the feed every N cards.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Play, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getChannelById } from '@/lib/iptvApi';
import { cn } from '@/lib/utils';

interface ClipItem {
  id: string;
  channel_id: string;
  public_url: string;
  duration_secs: number;
  created_at: string;
}

export default function HighlightsReel() {
  const navigate = useNavigate();
  const [clips,   setClips]   = useState<ClipItem[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    supabase
      .from('channel_clips')
      .select('id, channel_id, public_url, duration_secs, created_at')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => setClips(data || []));
  }, []);

  if (clips.length === 0) return null;

  const handlePlay = (id: string) => {
    Object.entries(videoRefs.current).forEach(([vid, el]) => {
      if (vid !== id && el) { el.pause(); el.currentTime = 0; }
    });
    const el = videoRefs.current[id];
    if (!el) return;
    if (playing === id) { el.pause(); setPlaying(null); }
    else { el.play().catch(() => {}); setPlaying(id); }
  };

  return (
    <div className="px-4 py-4 bg-card/40">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" />
          <span className="text-foreground text-sm font-bold">Highlights</span>
          <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {clips.length} clips
          </span>
        </div>
        <button
          onClick={() => navigate('/clips')}
          className="flex items-center gap-1 text-primary text-xs font-semibold"
        >
          See all <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-0 pb-1">
        {clips.map(clip => {
          const ch = getChannelById(clip.channel_id);
          const isPlaying = playing === clip.id;

          return (
            <div
              key={clip.id}
              className="flex-none w-28 rounded-xl overflow-hidden bg-muted border border-border/50"
            >
              {/* Video thumbnail */}
              <div className="relative aspect-[9/16] bg-black">
                <video
                  ref={el => { videoRefs.current[clip.id] = el; }}
                  src={clip.public_url}
                  className="w-full h-full object-contain"
                  playsInline
                  loop
                  muted
                />

                <button
                  onClick={() => handlePlay(clip.id)}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center transition-all',
                    'bg-black/60 backdrop-blur border border-white/20',
                    isPlaying && 'opacity-0'
                  )}>
                    <Play className="w-4 h-4 text-white" fill="white" />
                  </div>
                </button>

                {/* Duration */}
                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-mono px-1 py-0.5 rounded">
                  {clip.duration_secs}s
                </div>
              </div>

              {/* Channel name */}
              {ch && (
                <div className="px-2 py-1.5">
                  <p className="text-foreground text-[10px] font-semibold truncate">{ch.name}</p>
                  <p className="text-muted-foreground text-[9px] truncate uppercase">{ch.countryCode}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
