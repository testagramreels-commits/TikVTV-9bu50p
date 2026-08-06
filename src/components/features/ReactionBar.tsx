import { useState } from 'react';
import {
  Heart, MessageCircle, Share2, Bookmark, Download,
  Flag, MoreVertical, X, Tv2, MonitorOff, Repeat2,
} from 'lucide-react';
import { cn, formatCount } from '@/lib/utils';
import { useReactions } from '@/hooks/useReactions';
import { useFavorites } from '@/hooks/useFavorites';
import { useCastToTV } from '@/hooks/useCastToTV';
import { generateAndDownloadShareCard } from '@/components/features/ShareCard';
import { supabase } from '@/lib/supabase';
import type { AuthUser, IPTVChannel } from '@/types';
import { toast } from 'sonner';

interface Props {
  channel:        IPTVChannel;
  user:           AuthUser | null;
  commentCount:   number;
  onCommentClick: () => void;
  onAuthRequired: () => void;
}

const REPORT_REASONS = [
  'Dead / offline stream',
  'Wrong channel content',
  'Inappropriate content',
  'Duplicate channel',
  'Poor quality',
  'Other',
];

export default function ReactionBar({ channel, user, commentCount, onCommentClick, onAuthRequired }: Props) {
  const { liked, reposted, likeCount, repostCount, toggleLike, toggleRepost } = useReactions(channel.id, user?.id);
  const { isFavorite, toggleFavorite }   = useFavorites(user?.id);
  const { available: castAvailable, casting, castStream, stopCasting } = useCastToTV();
  const [popping,     setPopping]    = useState(false);
  const [repostPop,   setRepostPop]  = useState(false);
  const [generating,  setGenerating] = useState(false);
  const [showMore,    setShowMore]   = useState(false);
  const [showReport,  setShowReport] = useState(false);
  const [reporting,   setReporting]  = useState(false);

  const handleLike = async () => {
    if (!user) { onAuthRequired(); return; }
    setPopping(true);
    await toggleLike();
    setTimeout(() => setPopping(false), 350);
  };

  const handleRepost = async () => {
    if (!user) { onAuthRequired(); return; }
    setRepostPop(true);
    const ok = await toggleRepost();
    setTimeout(() => setRepostPop(false), 350);
    if (ok && !reposted) {
      // Share natively when reposting
      const text = `📺 Watching ${channel.name} live on TikVTV! Check it out!`;
      if (navigator.share) {
        navigator.share({ title: channel.name, text, url: window.location.href }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(text).catch(() => {});
        toast.success('Channel link copied — reposted!');
      }
    }
  };

  const handleShare = async () => {
    const text = `Watching ${channel.name} live on TikVTV! 📺`;
    if (navigator.share) navigator.share({ title: channel.name, text }).catch(() => {});
    else { await navigator.clipboard.writeText(text).catch(() => {}); toast.success('Copied!'); }
  };

  const handleShareCard = async () => {
    setGenerating(true);
    try {
      await generateAndDownloadShareCard(channel);
      toast.success('Share card downloaded!');
    } catch { toast.error('Could not generate share card'); }
    finally { setGenerating(false); }
  };

  const handleSave = async () => {
    if (!user) { onAuthRequired(); return; }
    await toggleFavorite(channel);
  };

  const handleCast = async () => {
    if (!castAvailable) {
      toast.error('Chromecast not available on this device');
      return;
    }
    if (casting) { stopCasting(); return; }
    await castStream(channel.streamUrl, channel.name, channel.logo);
    if (casting) toast.success(`Casting ${channel.name} to TV`);
  };

  const handleReport = async (reason: string) => {
    setReporting(true);
    const { error } = await supabase.from('reports').insert({
      channel_id: channel.id,
      user_id:    user?.id || null,
      reason,
    });
    setReporting(false);
    setShowReport(false);
    setShowMore(false);
    if (error) toast.error('Could not submit report');
    else toast.success('Thanks — report submitted');
  };

  const faved = isFavorite(channel.id);

  return (
    <div className="flex flex-col items-center gap-3.5">
      {/* Like */}
      <Btn label={formatCount(likeCount)} active={liked} activeClass="bg-primary/30 border-primary/50" onClick={handleLike}>
        <Heart className={cn('w-6 h-6 transition-colors', liked ? 'text-primary fill-primary' : 'text-white', popping && 'heart-pop')} />
      </Btn>

      {/* Comment */}
      <Btn label={formatCount(commentCount)} onClick={() => { if (!user) { onAuthRequired(); return; } onCommentClick(); }}>
        <MessageCircle className="w-6 h-6 text-white" />
      </Btn>

      {/* Repost */}
      <Btn
        label={formatCount(repostCount)}
        active={reposted}
        activeClass="bg-green-500/30 border-green-500/50"
        onClick={handleRepost}
      >
        <Repeat2 className={cn('w-5 h-5 transition-all', reposted ? 'text-green-400' : 'text-white', repostPop && 'heart-pop')} />
      </Btn>

      {/* Save */}
      <Btn label="Save" active={faved} activeClass="bg-yellow-500/30 border-yellow-500/50" onClick={handleSave}>
        <Bookmark className={cn('w-6 h-6', faved ? 'text-yellow-400 fill-yellow-400' : 'text-white')} />
      </Btn>

      {/* Chromecast */}
      <Btn
        label={casting ? 'Casting' : 'Cast'}
        active={casting}
        activeClass="bg-blue-500/30 border-blue-500/50"
        onClick={handleCast}
      >
        {casting
          ? <MonitorOff className="w-5 h-5 text-blue-400" />
          : <Tv2 className={cn('w-5 h-5', castAvailable ? 'text-white' : 'text-white/30')} />}
      </Btn>

      {/* Share */}
      <Btn label="Share" onClick={handleShare}>
        <Share2 className="w-5 h-5 text-white" />
      </Btn>

      {/* More (download card + report) */}
      <div className="relative">
        <Btn label="More" onClick={() => setShowMore(v => !v)}>
          <MoreVertical className="w-5 h-5 text-white" />
        </Btn>

        {showMore && !showReport && (
          <div
            className="absolute right-14 bottom-0 bg-black/95 backdrop-blur-xl border border-white/15 rounded-2xl overflow-hidden w-48 z-50"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-2 border-b border-white/10">
              <p className="text-white/40 text-[10px] uppercase tracking-wide">Options</p>
            </div>
            <button
              onClick={handleShareCard}
              disabled={generating}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Download card
            </button>
            <button
              onClick={() => setShowReport(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <Flag className="w-4 h-4" />
              Report channel
            </button>
            <button
              onClick={() => setShowMore(false)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/40 hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        )}

        {showReport && (
          <div
            className="absolute right-14 bottom-0 bg-black/95 backdrop-blur-xl border border-white/15 rounded-2xl overflow-hidden w-52 z-50"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
              <p className="text-white/80 text-sm font-semibold">Report channel</p>
              <button onClick={() => { setShowReport(false); setShowMore(false); }}>
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>
            {REPORT_REASONS.map(reason => (
              <button
                key={reason}
                disabled={reporting}
                onClick={() => handleReport(reason)}
                className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:bg-white/8 hover:text-white transition-colors disabled:opacity-50"
              >
                {reason}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Channel logo */}
      {channel.logo && (
        <div className="w-11 h-11 rounded-full border-2 border-white/80 overflow-hidden bg-white/10 mt-1">
          <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain p-0.5"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
    </div>
  );
}

function Btn({ children, label, active, activeClass, onClick, disabled }: {
  children: React.ReactNode; label: string; active?: boolean;
  activeClass?: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex flex-col items-center gap-1 group disabled:opacity-50 min-w-[44px]" aria-label={label}>
      <div className={cn(
        'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200',
        'bg-black/30 backdrop-blur-sm border border-white/10',
        'group-hover:scale-110 group-active:scale-95',
        active && activeClass
      )}>
        {children}
      </div>
      <span className="text-white text-[10px] font-medium">{label}</span>
    </button>
  );
}
