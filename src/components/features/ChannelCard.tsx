import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';
import type { IPTVChannel, AuthUser } from '@/types';
import VideoPlayer, { type VideoPlayerHandle } from './VideoPlayer';
import ChannelInfo from './ChannelInfo';
import ReactionBar from './ReactionBar';
import CommentSheet from './CommentSheet';
import ChannelLockOverlay from './ChannelLockOverlay';
import WatchProgressBar from './WatchProgressBar';
import { useComments } from '@/hooks/useComments';
import { useAutoClipRecorder } from '@/hooks/useAutoClipRecorder';
import { useChannelLock } from '@/hooks/useChannelLock';
import { markChannelDead } from '@/lib/iptvApi';

interface Props {
  channel:        IPTVChannel;
  isActive:       boolean;
  shouldLoad:     boolean;
  index:          number;
  user:           AuthUser | null;
  onAuthRequired: () => void;
  onChannelDead:  (id: string) => void;
  onChannelReady: (id: string) => void;
}

export default function ChannelCard({
  channel, isActive, shouldLoad, index,
  user, onAuthRequired, onChannelDead, onChannelReady,
}: Props) {
  const [showComments, setShowComments] = useState(false);
  const [dead,         setDead]         = useState(false);
  const [videoEl,      setVideoEl]      = useState<HTMLVideoElement | null>(null);
  const [isReady,      setIsReady]      = useState(false);
  const { count, fetchCount }           = useComments(channel.id);
  const navigate                        = useNavigate();
  const playerRef                       = useRef<VideoPlayerHandle>(null);
  const sharedOnReady                   = useRef(false);

  // Channel lock — track cumulative watch time
  const { locked, watchedPercent, remainingSecs } = useChannelLock(channel.id, isActive, isReady);

  useEffect(() => {
    if (isActive) fetchCount();
  }, [isActive, fetchCount]);

  // Auto-clip recording: capture 45s once user has watched long enough
  useAutoClipRecorder({ channel, videoEl, isActive: isActive && !locked });

  // Get the video element from the player once it mounts
  useEffect(() => {
    if (playerRef.current) {
      setVideoEl(playerRef.current.getEl());
    }
  }, [isActive]);

  const handleError = useCallback(() => {
    markChannelDead(channel.id);
    setDead(true);
    onChannelDead(channel.id);
  }, [channel.id, onChannelDead]);

  const handleReady = useCallback(() => {
    if (playerRef.current) setVideoEl(playerRef.current.getEl());
    setIsReady(true);
    if (!sharedOnReady.current) {
      sharedOnReady.current = true;
      onChannelReady(channel.id);
    }
  }, [channel.id, onChannelReady]);

  // Pause video when locked
  useEffect(() => {
    if (locked && playerRef.current) {
      playerRef.current.pause();
    }
  }, [locked]);

  if (dead) return null;

  return (
    <div
      data-index={index}
      className="relative w-full bg-black"
      style={{ height: '100dvh', scrollSnapAlign: 'start' }}
    >
      {/* Video */}
      <VideoPlayer
        ref={playerRef}
        src={channel.streamUrl}
        isActive={isActive && !locked}
        shouldLoad={shouldLoad}
        channelName={channel.name}
        channelLogo={channel.logo}
        onError={handleError}
        onReady={handleReady}
      />

      {/* Lock overlay — shown after 10 min */}
      {locked && (
        <ChannelLockOverlay
          channel={channel}
          onUnlock={() => {/* future: open payment sheet */}}
        />
      )}

      {/* Gradient overlays */}
      {!locked && (
        <>
          <div className="absolute inset-0 pointer-events-none gradient-overlay" />
          <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none gradient-top" />
        </>
      )}

      {/* Free preview progress bar + countdown timer */}
      {!locked && (
        <>
          <WatchProgressBar percent={watchedPercent} locked={locked} />
          {/* Countdown: show when within last 5 minutes */}
          {remainingSecs <= 300 && remainingSecs > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <div className="flex items-center gap-1.5 bg-amber-500/20 backdrop-blur border border-amber-500/40 rounded-full px-3 py-1">
                <Crown className="w-3 h-3 text-amber-400" />
                <span className="text-amber-300 text-xs font-bold">
                  Free: {Math.floor(remainingSecs / 60)}:{String(remainingSecs % 60).padStart(2, '0')}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Bottom content — hidden when locked */}
      {!locked && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 flex items-end justify-between gap-4">
          <div className="flex-1 min-w-0 pb-1">
            <button className="text-left w-full" onClick={() => navigate(`/channel/${channel.id}`)}>
              <ChannelInfo channel={channel} />
            </button>
          </div>
          <div className="flex-shrink-0 pb-2">
            <ReactionBar
              channel={channel}
              user={user}
              commentCount={count}
              onCommentClick={() => setShowComments(true)}
              onAuthRequired={onAuthRequired}
            />
          </div>
        </div>
      )}

      {showComments && !locked && (
        <CommentSheet
          channelId={channel.id}
          channelName={channel.name}
          user={user}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
}
