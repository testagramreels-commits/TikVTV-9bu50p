/**
 * Social Stories — Instagram-like story rings with 24h auto-expiry.
 * Stories are backed by Supabase storage (channel-clips bucket).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Camera, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  created_at: string;
  expires_at: string;
  username: string;
  avatar_color: string;
  viewed?: boolean;
}

interface StoryGroup {
  userId: string;
  username: string;
  avatarColor: string;
  stories: Story[];
  hasUnviewed: boolean;
}

const AVATAR_COLORS = [
  'from-pink-500 to-rose-500',
  'from-purple-500 to-indigo-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-amber-500 to-orange-500',
  'from-red-500 to-pink-500',
];

function userColor(userId: string): string {
  const idx = userId.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ── Story Viewer ───────────────────────────────────────────────────────
function StoryViewer({
  group, allGroups, groupIndex,
  onClose, onPrev, onNext,
}: {
  group: StoryGroup;
  allGroups: StoryGroup[];
  groupIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [idx, setIdx]         = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef               = useRef<ReturnType<typeof setInterval>>();
  const STORY_DURATION         = 5000;

  const story = group.stories[idx];

  useEffect(() => {
    setProgress(0);
    clearInterval(timerRef.current);
    const step = 100 / (STORY_DURATION / 100);
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(timerRef.current);
          if (idx < group.stories.length - 1) setIdx(i => i + 1);
          else onNext();
          return 0;
        }
        return p + step;
      });
    }, 100);
    return () => clearInterval(timerRef.current);
  }, [idx, group.stories.length, onNext]);

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center" onClick={onClose}>
      {/* Story media */}
      <div className="relative w-full max-w-sm h-full max-h-[100dvh] mx-auto" onClick={e => e.stopPropagation()}>
        {story.media_type === 'video'
          ? <video src={story.media_url} autoPlay muted playsInline className="w-full h-full object-cover" />
          : <img src={story.media_url} alt="" className="w-full h-full object-cover" />
        }

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 pointer-events-none" />

        {/* Progress bars */}
        <div className="absolute top-4 left-4 right-4 flex gap-1">
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-none"
                style={{ width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-4 right-4 flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold flex-none border-2 border-white/40', group.avatarColor)}>
            {group.username.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">@{group.username}</p>
            <p className="text-white/60 text-xs">{timeAgo(story.created_at)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Caption */}
        {story.caption && (
          <div className="absolute bottom-16 left-4 right-4">
            <p className="text-white text-sm font-medium text-center bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2">{story.caption}</p>
          </div>
        )}

        {/* Side nav */}
        <button onClick={e => { e.stopPropagation(); if (idx > 0) setIdx(i => i - 1); else onPrev(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-20 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6 text-white/70" />
        </button>
        <button onClick={e => { e.stopPropagation(); if (idx < group.stories.length - 1) setIdx(i => i + 1); else onNext(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-20 flex items-center justify-center">
          <ChevronRight className="w-6 h-6 text-white/70" />
        </button>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'just now';
  return `${h}h ago`;
}

// ── Story Ring ─────────────────────────────────────────────────────────
function StoryRing({ group, onClick }: { group: StoryGroup; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 flex-none">
      <div className={cn(
        'w-16 h-16 rounded-full p-[2px]',
        group.hasUnviewed
          ? 'bg-gradient-to-br from-primary via-secondary to-amber-400'
          : 'bg-white/20'
      )}>
        <div className={cn('w-full h-full rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-xl border-2 border-background', group.avatarColor)}>
          {group.username.slice(0, 1).toUpperCase()}
        </div>
      </div>
      <span className="text-foreground text-[10px] font-medium max-w-[60px] truncate">{group.username}</span>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────
export default function SocialStories() {
  const { user }                        = useAuthStore();
  const [groups, setGroups]             = useState<StoryGroup[]>([]);
  const [viewing, setViewing]           = useState<number | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [showCaption, setShowCaption]   = useState(false);
  const [pendingFile, setPendingFile]   = useState<File | null>(null);
  const [caption, setCaption]           = useState('');
  const fileRef                         = useRef<HTMLInputElement>(null);
  const navigate                        = useNavigate();

  const loadStories = useCallback(async () => {
    const { data } = await supabase
      .from('social_stories')
      .select('*, user_profiles(id, username)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (!data) return;

    // Group by user
    const map = new Map<string, StoryGroup>();
    for (const s of data) {
      const uid  = s.user_id;
      const uname = s.user_profiles?.username || 'user';
      if (!map.has(uid)) {
        map.set(uid, {
          userId: uid, username: uname,
          avatarColor: userColor(uid),
          stories: [], hasUnviewed: false,
        });
      }
      const g = map.get(uid)!;
      g.stories.push({ ...s, username: uname, avatar_color: userColor(uid) });
    }

    const list = Array.from(map.values());
    // Own stories first
    if (user) {
      const ownIdx = list.findIndex(g => g.userId === user.id);
      if (ownIdx > 0) { const [own] = list.splice(ownIdx, 1); list.unshift(own); }
    }
    setGroups(list);
  }, [user]);

  useEffect(() => {
    // Create table if not exists (best-effort)
    loadStories();
  }, [loadStories]);

  const handleFileSelect = async (file: File) => {
    setPendingFile(file);
    setShowCaption(true);
  };

  const handleUpload = async () => {
    if (!user || !pendingFile) return;
    setUploading(true);
    setShowCaption(false);

    const ext  = pendingFile.name.split('.').pop() || 'jpg';
    const path = `${user.id}/story-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('channel-clips')
      .upload(path, pendingFile, { contentType: pendingFile.type, upsert: false });

    if (upErr) { toast.error('Upload failed'); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from('channel-clips').getPublicUrl(path);
    const isVideo = pendingFile.type.startsWith('video');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: dbErr } = await supabase.from('social_stories').insert({
      user_id:    user.id,
      media_url:  publicUrl,
      media_type: isVideo ? 'video' : 'image',
      caption:    caption.trim() || null,
      expires_at: expiresAt,
    });

    if (dbErr) { toast.error('Failed to post story'); }
    else { toast.success('Story posted! Visible for 24h'); await loadStories(); }

    setUploading(false);
    setPendingFile(null);
    setCaption('');
  };

  return (
    <>
      {/* Stories row */}
      <div className="flex gap-4 px-4 py-3 overflow-x-auto scrollbar-none border-b border-border/30">
        {/* Add story button */}
        <button
          onClick={() => {
            if (!user) { navigate('/profile'); return; }
            fileRef.current?.click();
          }}
          className="flex flex-col items-center gap-1.5 flex-none"
        >
          <div className="relative w-16 h-16 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center hover:bg-muted/80 transition-colors">
            {uploading
              ? <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              : <><Camera className="w-5 h-5 text-muted-foreground" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                    <Plus className="w-2.5 h-2.5 text-white" />
                  </div></>
            }
          </div>
          <span className="text-foreground text-[10px]">Your story</span>
        </button>

        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />

        {/* Story rings */}
        {groups.map((g, i) => (
          <StoryRing key={g.userId} group={g} onClick={() => setViewing(i)} />
        ))}
      </div>

      {/* Caption dialog */}
      {showCaption && pendingFile && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur flex items-center justify-center px-6">
          <div className="bg-card border border-border/60 rounded-2xl p-5 w-full max-w-sm space-y-4">
            <h3 className="text-foreground font-bold">Add caption (optional)</h3>
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-muted">
              {pendingFile.type.startsWith('video')
                ? <video src={URL.createObjectURL(pendingFile)} className="w-full h-full object-cover" muted />
                : <img src={URL.createObjectURL(pendingFile)} alt="" className="w-full h-full object-cover" />}
            </div>
            <textarea value={caption} onChange={e => setCaption(e.target.value.slice(0, 150))}
              placeholder="Write a caption…"
              rows={2}
              className="w-full bg-muted text-foreground text-sm rounded-xl px-3 py-2 outline-none resize-none placeholder:text-muted-foreground border border-border/50 focus:border-primary/50" />
            <div className="flex gap-2">
              <button onClick={() => { setShowCaption(false); setPendingFile(null); setCaption(''); }}
                className="flex-1 py-2.5 rounded-xl border border-border/50 text-muted-foreground text-sm font-semibold">Cancel</button>
              <button onClick={handleUpload}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold">Share Story</button>
            </div>
          </div>
        </div>
      )}

      {/* Viewer */}
      {viewing !== null && groups[viewing] && (
        <StoryViewer
          group={groups[viewing]}
          allGroups={groups}
          groupIndex={viewing}
          onClose={() => setViewing(null)}
          onPrev={() => setViewing(i => Math.max(0, (i ?? 0) - 1))}
          onNext={() => {
            if (viewing < groups.length - 1) setViewing(viewing + 1);
            else setViewing(null);
          }}
        />
      )}
    </>
  );
}
