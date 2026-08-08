/**
 * Profile page — enhanced with Premium badge, social stats, and
 * navigation to Social profile.
 */
import { useState, useRef } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, Edit2, LogOut, Heart, Bookmark, Clock,
  Film, Globe, Check, Loader2, User, Settings, Crown,
  Users, MessageCircle, Shield,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { useLangStore } from '@/stores/langStore';
import { usePremium } from '@/hooks/usePremium';
import { cn, getCountryFlag } from '@/lib/utils';
import AuthModal from '@/components/features/AuthModal';
import PremiumModal from '@/components/features/PremiumModal';
import { toast } from 'sonner';

const LANGUAGES = [
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español',  flag: '🇪🇸' },
  { code: 'ar', label: 'العربية',  flag: '🇸🇦' },
  { code: 'zh', label: '中文',      flag: '🇨🇳' },
] as const;

export default function Profile() {
  const navigate               = useNavigate();
  const { user, logout }       = useAuthStore();
  const { history, clearHistory } = useWatchHistory();
  const { lang, setLang }      = useLangStore();
  const { isPremium, loading: premiumLoading } = usePremium();
  const [showAuth,    setShowAuth]    = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const { theme, toggleTheme }        = useThemeStore();
  const [editing,    setEditing]    = useState(false);
  const [username,   setUsername]   = useState(user?.username || '');
  const [saving,     setSaving]     = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef      = useRef<HTMLInputElement>(null);

  const stats = [
    { icon: Clock,    label: 'Watched',   value: history.length,  path: '/history' },
    { icon: Bookmark, label: 'Saved',     value: '—',            path: '/favorites' },
    { icon: Film,     label: 'Clips',     value: '—',            path: '/clips' },
    { icon: Heart,    label: 'Liked',     value: '—',            path: '/' },
  ];

  const topCountries = (() => {
    const counts: Record<string, number> = {};
    history.forEach(h => { counts[h.countryCode] = (counts[h.countryCode] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  })();

  const topCategories = (() => {
    const counts: Record<string, number> = {};
    history.forEach(h => h.categories.forEach(c => { counts[c] = (counts[c] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  })();

  async function saveUsername() {
    if (!user || !username.trim()) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { username: username.trim() } });
    if (!error) {
      await supabase.from('user_profiles').update({ username: username.trim() }).eq('id', user.id);
      toast.success('Username updated');
      setEditing(false);
    } else {
      toast.error(error.message);
    }
    setSaving(false);
  }

  async function handleAvatarUpload(file: File) {
    if (!user) return;
    setUploadingAvatar(true);
    const ext  = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('channel-clips').upload(path, file, { upsert: true });
    if (uploadError) { toast.error('Upload failed'); setUploadingAvatar(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('channel-clips').getPublicUrl(path);
    const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
    if (updateError) { toast.error('Update failed'); } else { toast.success('Avatar updated'); }
    setUploadingAvatar(false);
  }

  if (!user) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 px-8">
      <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
        <User className="w-10 h-10 text-white/30" />
      </div>
      <div className="text-center">
        <h2 className="text-white font-bold text-xl mb-2">Sign in to TikVTV</h2>
        <p className="text-white/40 text-sm">Save favorites, like channels, and track your watch history</p>
      </div>
      <button onClick={() => setShowAuth(true)}
        className="bg-primary text-white font-semibold px-8 py-3 rounded-full text-sm">
        Sign In / Sign Up
      </button>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );

  const initials = (user.username || user.email || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-12 pb-4 bg-black/95 backdrop-blur border-b border-white/8 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-bold text-lg flex-1">Profile</h1>
        <Settings className="w-5 h-5 text-white/40" />
      </div>

      {/* Avatar + name */}
      <div className="flex flex-col items-center pt-8 pb-4 px-6">
        <div className="relative mb-4">
          {user.avatar ? (
            <img src={user.avatar} alt={user.username}
              className={cn('w-24 h-24 rounded-full object-cover', isPremium ? 'border-4 border-amber-400' : 'border-2 border-primary')} />
          ) : (
            <div className={cn(
              'w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center',
              isPremium ? 'border-4 border-amber-400' : 'border-2 border-primary'
            )}>
              <span className="text-white text-3xl font-bold">{initials}</span>
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center border-2 border-black"
          >
            {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
        </div>

        {/* Premium badge */}
        {!premiumLoading && isPremium && (
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-full px-4 py-1.5 mb-3">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-amber-300 text-sm font-bold">Premium Member</span>
          </div>
        )}

        {/* Free tier upgrade prompt */}
        {!premiumLoading && !isPremium && (
          <button
            onClick={() => setShowPremium(true)}
            className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-3 hover:bg-amber-500/20 transition-colors"
          >
            <Crown className="w-3.5 h-3.5 text-amber-400/60" />
            <span className="text-amber-400/60 text-xs font-semibold">Upgrade to Premium</span>
          </button>
        )}

        {/* Username */}
        {editing ? (
          <div className="flex items-center gap-2 mb-1">
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveUsername()}
              className="bg-white/10 text-white text-lg font-bold text-center rounded-xl px-4 py-2 outline-none focus:ring-1 focus:ring-primary/50 w-48"
              autoFocus
            />
            <button onClick={saveUsername} disabled={saving}
              className="w-9 h-9 rounded-full bg-primary flex items-center justify-center disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Check className="w-4 h-4 text-white" />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-white font-bold text-xl">@{user.username}</h2>
            {isPremium && <Crown className="w-4 h-4 text-amber-400" />}
            <button onClick={() => setEditing(true)}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
              <Edit2 className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>
        )}
        <p className="text-white/40 text-sm">{user.email}</p>

        {/* Social profile link */}
        <button
          onClick={() => navigate(`/social/profile/${user.id}`)}
          className="mt-3 flex items-center gap-2 text-primary text-xs font-semibold hover:underline"
        >
          <Users className="w-3.5 h-3.5" />
          View Social Profile
          <MessageCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 px-4 mb-6">
        {stats.map(({ icon: Icon, label, value, path }) => (
          <button key={label} onClick={() => navigate(path)}
            className="bg-white/5 border border-white/8 rounded-2xl p-3 flex flex-col items-center gap-1 hover:bg-white/10 transition-colors">
            <Icon className="w-4 h-4 text-primary/80" />
            <span className="text-white font-bold text-lg leading-tight">{value}</span>
            <span className="text-white/30 text-[10px]">{label}</span>
          </button>
        ))}
      </div>

      {/* Top countries */}
      {topCountries.length > 0 && (
        <Section title="Top Countries Watched">
          <div className="flex flex-wrap gap-2 px-4">
            {topCountries.map(([cc, count]) => (
              <div key={cc} className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-full px-3 py-1.5">
                <span className="text-base">{getCountryFlag(cc)}</span>
                <span className="text-white text-xs font-semibold">{cc}</span>
                <span className="text-white/30 text-xs">{count}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Top categories */}
      {topCategories.length > 0 && (
        <Section title="Favorite Categories">
          <div className="flex flex-wrap gap-2 px-4">
            {topCategories.map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5">
                <span className="text-white text-xs font-semibold capitalize">{cat}</span>
                <span className="text-primary/60 text-xs">{count}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Language */}
      <Section title="Language">
        <div className="flex flex-wrap gap-2 px-4">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border',
                lang === l.code
                  ? 'bg-primary/20 border-primary/50 text-white font-semibold'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
              )}>
              <span>{l.flag}</span>
              <span>{l.label}</span>
              {lang === l.code && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>
          ))}
        </div>
      </Section>

      {/* Actions */}
      <Section title="Actions">
        <div className="px-4 space-y-2">
          {!isPremium && (
            <button onClick={() => setShowPremium(true)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 rounded-xl text-amber-400 text-sm hover:from-amber-500/25 hover:to-orange-500/25 transition-colors">
              <Crown className="w-4 h-4" />
              Upgrade to Premium · Unlock all channels
            </button>
          )}
          <button onClick={() => { if (confirm('Clear all watch history?')) clearHistory(); }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/8 rounded-xl text-white/70 text-sm hover:bg-white/10 transition-colors">
            <Clock className="w-4 h-4 text-white/40" />Clear watch history
          </button>
          <button onClick={() => navigate('/explore')}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/8 rounded-xl text-white/70 text-sm hover:bg-white/10 transition-colors">
            <Globe className="w-4 h-4 text-white/40" />Browse by country
          </button>
          <button onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/8 rounded-xl text-white/70 text-sm hover:bg-white/10 transition-colors">
            <span className="text-white/40 text-base">{theme === 'dark' ? '☀️' : '🌙'}</span>
            Switch to {theme === 'dark' ? 'Light' : 'Dark'} theme
          </button>
          <button onClick={() => navigate('/subscription')}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/8 rounded-xl text-white/70 text-sm hover:bg-white/10 transition-colors">
            <Crown className="w-4 h-4 text-amber-400/60" />Manage Subscription
          </button>
          <button onClick={() => navigate('/notifications')}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/8 rounded-xl text-white/70 text-sm hover:bg-white/10 transition-colors">
            <span className="text-white/40 text-base">🔔</span>Notification Centre
          </button>
          <button onClick={() => navigate('/health')}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/8 rounded-xl text-white/70 text-sm hover:bg-white/10 transition-colors">
            <span className="text-white/40 text-base">📡</span>Stream health monitor
          </button>
          <button onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/8 rounded-xl text-white/70 text-sm hover:bg-white/10 transition-colors">
            <Shield className="w-4 h-4 text-white/40" />Admin Dashboard
          </button>
          <button onClick={() => { logout(); navigate('/'); toast.success('Signed out'); }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm hover:bg-red-500/20 transition-colors">
            <LogOut className="w-4 h-4" />Sign out
          </button>
        </div>
      </Section>

      {showPremium && <PremiumModal channelName="Premium Access" onClose={() => setShowPremium(false)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-white/40 text-xs font-semibold uppercase tracking-wider px-4 mb-3">{title}</p>
      {children}
    </div>
  );
}
