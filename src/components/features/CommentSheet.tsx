import { useEffect, useState, useRef } from 'react';
import { X, Send, Loader2, Trash2 } from 'lucide-react';
import { useComments } from '@/hooks/useComments';
import { timeAgo } from '@/lib/utils';
import type { AuthUser } from '@/types';

interface Props {
  channelId:  string;
  channelName: string;
  user:       AuthUser | null;
  onClose:    () => void;
}

export default function CommentSheet({ channelId, channelName, user, onClose }: Props) {
  const { comments, loading, addComment, deleteComment, fetchComments } = useComments(channelId);
  const [text,   setText]   = useState('');
  const [sending, setSending] = useState(false);
  const inputRef             = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchComments();
    // Focus input after sheet opens
    setTimeout(() => inputRef.current?.focus(), 400);
  }, [fetchComments]);

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    await addComment(text, user.id);
    setText('');
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 slide-up max-w-lg mx-auto">
        <div className="bg-[#1a1a1a] rounded-t-2xl overflow-hidden" style={{ maxHeight: '75vh' }}>
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-white font-semibold text-base">Comments</h3>
              <p className="text-white/40 text-xs mt-0.5">{channelName}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Comments list */}
          <div className="overflow-y-auto px-4 py-3 space-y-4" style={{ maxHeight: '50vh' }}>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-white/30 text-sm">No comments yet</p>
                <p className="text-white/20 text-xs mt-1">Be the first to comment!</p>
              </div>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex-shrink-0 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {(c.user_profiles?.username || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-white text-xs font-semibold">
                        @{c.user_profiles?.username || 'user'}
                      </span>
                      <span className="text-white/30 text-[11px]">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-white/80 text-sm mt-0.5 break-words">{c.content}</p>
                  </div>
                  {user?.id === c.user_id && (
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="border-t border-white/10 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex-shrink-0 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {(user?.username || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment..."
              maxLength={280}
              className="flex-1 bg-white/10 text-white placeholder-white/30 text-sm rounded-full px-4 py-2 outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-9 h-9 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 transition-opacity hover:bg-primary/90 active:scale-95"
            >
              {sending
                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                : <Send className="w-4 h-4 text-white" />
              }
            </button>
          </div>
          <div className="h-safe-area-inset-bottom pb-4" />
        </div>
      </div>
    </>
  );
}
