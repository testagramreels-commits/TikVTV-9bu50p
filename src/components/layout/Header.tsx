import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Globe, LogIn, LogOut, Settings, ChevronDown, Tv, Radio } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useLangStore } from '@/stores/langStore';
import { useT, LANGUAGE_OPTIONS } from '@/lib/i18n';
import { formatCount, cn } from '@/lib/utils';
import AuthModal from '@/components/features/AuthModal';
import NotificationPanel from '@/components/features/NotificationPanel';
import type { Language } from '@/types';

interface Props {
  liveCount:     number;
  totalChannels: number;
}

export default function Header({ liveCount, totalChannels }: Props) {
  const { user, logout }  = useAuthStore();
  const navigate          = useNavigate();
  const t                 = useT();
  const { lang, setLang } = useLangStore();

  const [showAuth, setShowAuth] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [showUser, setShowUser] = useState(false);

  const handleLogout = () => {
    logout();
    setShowUser(false);
  };

  return (
    <>
      <header className="relative z-30 flex items-center justify-between px-4 py-2.5 bg-black/95 backdrop-blur-xl border-b border-white/8">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 group"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary via-red-500 to-secondary flex items-center justify-center shadow-lg">
            <Tv className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-black text-lg tracking-tight leading-none">
            Tik<span className="text-primary">V</span>TV
          </span>
        </button>

        {/* Live badge + channel count */}
        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1">
          {liveCount > 0 && (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot flex-shrink-0" />
              <span className="text-green-400 text-[11px] font-bold">{liveCount}</span>
              <span className="text-white/30 text-[11px]">live</span>
              <span className="text-white/10 text-[11px] mx-0.5">·</span>
            </>
          )}
          <span className="text-white/50 text-[11px]">{formatCount(totalChannels)} ch</span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {/* Search */}
          <button
            onClick={() => navigate('/search')}
            aria-label="Search"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <Search className="w-4 h-4 text-white/70" />
          </button>

          {/* Watch Party shortcut */}
          <button
            onClick={() => navigate('/party')}
            aria-label="Watch Party"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors relative"
          >
            <Radio className="w-4 h-4 text-white/70" />
          </button>

          {/* Notification bell — uses new component */}
          <NotificationPanel />

          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => { setShowLang(v => !v); setShowUser(false); }}
              className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <span className="text-white/70 text-[11px] font-semibold uppercase">{lang}</span>
              <ChevronDown className="w-3 h-3 text-white/40" />
            </button>

            {showLang && (
              <div className="absolute right-0 top-full mt-1 bg-black/95 backdrop-blur-xl border border-white/15 rounded-xl overflow-hidden min-w-[130px] z-50 shadow-xl">
                {LANGUAGE_OPTIONS.map(opt => (
                  <button
                    key={opt.code}
                    onClick={() => { setLang(opt.code as Language); setShowLang(false); }}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors',
                      lang === opt.code ? 'text-primary bg-primary/10 font-semibold' : 'text-white/70 hover:bg-white/5'
                    )}
                  >
                    <span>{opt.native}</span>
                    {lang === opt.code && <span className="text-primary text-xs">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User / auth */}
          <div className="relative">
            {user ? (
              <>
                <button
                  onClick={() => { setShowUser(v => !v); setShowLang(false); }}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold border border-white/20"
                >
                  {user.username.charAt(0).toUpperCase()}
                </button>

                {showUser && (
                  <div className="absolute right-0 top-full mt-1 bg-black/95 backdrop-blur-xl border border-white/15 rounded-xl overflow-hidden min-w-[160px] z-50 shadow-xl">
                    <div className="px-3 py-2.5 border-b border-white/10">
                      <p className="text-white font-semibold text-sm truncate">@{user.username}</p>
                      <p className="text-white/30 text-[11px] truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { navigate('/favorites'); setShowUser(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
                    >
                      <Globe className="w-4 h-4" /> My Favorites
                    </button>
                    <button
                      onClick={() => { navigate('/history'); setShowUser(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
                    >
                      <Settings className="w-4 h-4" /> Watch History
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> {t('logout')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-1.5 bg-primary/90 hover:bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                {t('login')}
              </button>
            )}
          </div>
        </div>
      </header>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
