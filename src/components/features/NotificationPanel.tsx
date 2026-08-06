/**
 * Slide-down notification panel with bell icon badge.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, Check, Trash2, Heart, MessageCircle, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { AppNotification } from '@/types';

function getIcon(type: AppNotification['type']): LucideIcon {
  if (type === 'reaction') return Heart;
  if (type === 'comment')  return MessageCircle;
  return Info;
}

export default function NotificationPanel() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    notifications, unreadCount, permission,
    requestPermission, markRead, markAllRead, clearAll,
  } = usePushNotifications();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleNotifClick(n: AppNotification) {
    markRead(n.id);
    setOpen(false);
    if (n.channelId) navigate(`/channel/${n.channelId}`);
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative w-9 h-9 rounded-full flex items-center justify-center transition-all',
          open ? 'bg-primary/20 border border-primary/30' : 'bg-white/8 hover:bg-white/15'
        )}
        aria-label="Notifications"
      >
        {permission === 'denied'
          ? <BellOff className="w-4 h-4 text-white/40" />
          : <Bell className={cn('w-4 h-4', open ? 'text-primary' : 'text-white/70')} />
        }
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-primary text-white text-[9px] font-bold rounded-full px-0.5 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-gray-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span className="text-white font-bold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    title="Mark all read"
                  >
                    <Check className="w-3.5 h-3.5 text-white/50" />
                  </button>
                  <button
                    onClick={clearAll}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    title="Clear all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white/50" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Permission prompt */}
          {permission === 'default' && (
            <div className="px-4 py-3 bg-primary/8 border-b border-primary/15">
              <p className="text-white/70 text-xs mb-2">Enable browser notifications for live alerts</p>
              <button
                onClick={requestPermission}
                className="w-full bg-primary text-white text-xs font-bold py-2 rounded-xl hover:bg-primary/90 transition-colors"
              >
                Enable Notifications
              </button>
            </div>
          )}

          {/* Notifications list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <Bell className="w-10 h-10 text-white/10" />
                <p className="text-white/30 text-sm">No notifications yet</p>
                <p className="text-white/20 text-xs text-center px-6">
                  Favorite channels to get notified about new activity
                </p>
              </div>
            ) : (
              notifications.map(n => {
                const IconComp = getIcon(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-white/4 last:border-0',
                      n.read ? 'hover:bg-white/5' : 'bg-primary/5 hover:bg-primary/8'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex-none flex items-center justify-center',
                      n.type === 'reaction' ? 'bg-pink-500/15' :
                      n.type === 'comment'  ? 'bg-blue-500/15' : 'bg-white/10'
                    )}>
                      <IconComp className={cn(
                        'w-4 h-4',
                        n.type === 'reaction' ? 'text-pink-400' :
                        n.type === 'comment'  ? 'text-blue-400' : 'text-white/50'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-white text-xs font-semibold truncate">{n.title}</p>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-none" />}
                      </div>
                      <p className="text-white/50 text-[11px] truncate mt-0.5">{n.body}</p>
                      <p className="text-white/25 text-[10px] mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
