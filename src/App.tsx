import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/useAuth';
import { useThemeStore, applyTheme } from '@/stores/themeStore';

import BottomNav from '@/components/layout/BottomNav';
import PWABanner from '@/components/features/PWABanner';

import Index from './pages/Index';
import Search from './pages/Search';
import CountryExplorer from './pages/CountryExplorer';
import ChannelDetail from './pages/ChannelDetail';
import Favorites from './pages/Favorites';
import TrendingPage from './pages/Trending';
import History from './pages/History';
import EPG from './pages/EPG';
import ClipGallery from './pages/ClipGallery';
import Profile from './pages/Profile';
import StreamHealth from './pages/StreamHealth';
import AdminReports from './pages/AdminReports';
import WatchParty from './pages/WatchParty';
import Social from './pages/Social';
import SocialDM from './pages/SocialDM';
import SocialProfile from './pages/SocialProfile';
import PaymentCallback from './pages/PaymentCallback';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function AppShell({ children }: { children: React.ReactNode }) {
  useAuth();

  const location = useLocation();
  const { theme } = useThemeStore();

  const lastBackPress = useRef(0);

  const hideNav = location.pathname.startsWith('/channel/');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const listener = CapacitorApp.addListener('backButton', () => {
      // Go back if not on home screen
      if (location.pathname !== '/') {
        window.history.back();
        return;
      }

      const now = Date.now();

      if (now - lastBackPress.current < 2000) {
        CapacitorApp.exitApp();
      } else {
        lastBackPress.current = now;
        toast('Press back again to exit');
      }
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [location]);

  return (
    <>
      {children}
      {!hideNav && <BottomNav />}
      {!hideNav && <PWABanner />}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner
        position="top-center"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
          },
        }}
      />

      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/search" element={<Search />} />
            <Route path="/explore" element={<CountryExplorer />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/trending" element={<TrendingPage />} />
            <Route path="/history" element={<History />} />
            <Route path="/epg" element={<EPG />} />
            <Route path="/clips" element={<ClipGallery />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/health" element={<StreamHealth />} />
            <Route path="/admin" element={<AdminReports />} />
            <Route path="/party" element={<WatchParty />} />
            <Route path="/social" element={<Social />} />
            <Route path="/social/dm" element={<SocialDM />} />
            <Route path="/social/profile/:userId" element={<SocialProfile />} />
            <Route path="/social/profile" element={<SocialProfile />} />
            <Route path="/premium/callback" element={<PaymentCallback />} />
            <Route path="/channel/:id" element={<ChannelDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
