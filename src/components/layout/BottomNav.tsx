import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Search, Compass, Flame,
  Film, User, Moon, Sun, Shield, Radio, Users, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiSuggestions } from '@/hooks/useAiSuggestions';
import { useThemeStore } from '@/stores/themeStore';
import { useNotifications } from '@/hooks/useNotifications';

const tabs = [
  { id: 'home',          path: '/',               icon: Home,    label: 'Home' },
  { id: 'search',        path: '/search',          icon: Search,  label: 'Search' },
  { id: 'explore',       path: '/explore',         icon: Compass, label: 'Explore', ai: true },
  { id: 'social',        path: '/social',          icon: Users,   label: 'Social' },
  { id: 'notifications', path: '/notifications',   icon: Bell,    label: 'Alerts', notif: true },
  { id: 'party',         path: '/party',           icon: Radio,   label: 'Party' },
  { id: 'profile',       path: '/profile',         icon: User,    label: 'Me' },
];

export default function BottomNav() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { topCategories, hasData } = useAiSuggestions();
  const { theme, toggleTheme } = useThemeStore();
  const { unreadCount } = useNotifications();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border">
      {/* AI suggestion strip — only on home */}
      {hasData && location.pathname === '/' && topCategories.length > 0 && (
        <AiSuggestionStrip categories={topCategories} />
      )}

      <div className="flex items-center justify-around px-0.5 pb-safe">
        {tabs.map(tab => {
          const Icon     = tab.icon;
          const isActive = location.pathname === tab.path ||
            (tab.path !== '/' && location.pathname.startsWith(tab.path));

          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 py-2 px-1.5 rounded-xl transition-all duration-200 flex-1 min-w-[44px] min-h-[44px]',
                isActive ? 'scale-105' : 'opacity-55 hover:opacity-80'
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20" />
              )}
              {tab.ai && (
                <span className="absolute -top-0.5 -right-0.5 text-[7px] font-bold bg-gradient-to-r from-primary to-secondary text-white px-1 py-0.5 rounded-full leading-none z-10">
                  AI
                </span>
              )}
              {tab.notif && unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5 leading-none z-10">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              <Icon
                className={cn('w-[17px] h-[17px] transition-colors',
                  isActive ? 'text-primary drop-shadow-[0_0_6px_rgba(254,44,85,0.6)]' : 'text-foreground/70')}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className={cn('text-[9px] font-medium transition-colors leading-none',
                isActive ? 'text-primary' : 'text-foreground/45')}>
                {tab.label}
              </span>
              {isActive && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
            </button>
          );
        })}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="relative flex flex-col items-center justify-center gap-0.5 py-2 px-1.5 rounded-xl transition-all duration-200 flex-1 opacity-55 hover:opacity-80 min-w-[44px] min-h-[44px]"
          aria-label="Toggle theme"
        >
          {theme === 'dark'
            ? <Sun className="w-[17px] h-[17px] text-foreground/70" strokeWidth={1.8} />
            : <Moon className="w-[17px] h-[17px] text-foreground/70" strokeWidth={1.8} />}
          <span className="text-[9px] font-medium text-foreground/45 leading-none">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </span>
        </button>

        {/* Admin shortcut */}
        <button
          onClick={() => navigate('/admin')}
          className={cn(
            'relative flex flex-col items-center justify-center gap-0.5 py-2 px-1.5 rounded-xl transition-all duration-200 flex-1 min-w-[44px] min-h-[44px]',
            location.pathname === '/admin' ? 'scale-105' : 'opacity-55 hover:opacity-80'
          )}
          aria-label="Admin"
        >
          {location.pathname === '/admin' && (
            <div className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20" />
          )}
          <Shield
            className={cn('w-[17px] h-[17px]',
              location.pathname === '/admin' ? 'text-primary' : 'text-foreground/70')}
            strokeWidth={1.8}
          />
          <span className={cn('text-[9px] font-medium leading-none',
            location.pathname === '/admin' ? 'text-primary' : 'text-foreground/45')}>
            Admin
          </span>
        </button>
      </div>
    </nav>
  );
}

function AiSuggestionStrip({ categories }: { categories: string[] }) {
  const navigate = useNavigate();
  return (
    <div className="px-3 pt-2 pb-1 border-b border-border/50">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] text-muted-foreground font-medium flex-shrink-0 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-primary to-secondary inline-block" />
          AI picks:
        </span>
        {categories.map(cat => (
          <button key={cat} onClick={() => navigate(`/?cat=${cat}`)}
            className="flex-shrink-0 text-[10px] font-semibold text-foreground/70 bg-muted hover:bg-primary/20 hover:text-primary border border-border px-2.5 py-1 rounded-full transition-colors capitalize">
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
