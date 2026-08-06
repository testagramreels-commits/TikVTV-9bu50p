import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types';

interface AuthStore {
  user:       AuthUser | null;
  loading:    boolean;
  login:      (user: AuthUser) => void;
  logout:     () => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user:       null,
      loading:    true,
      login:      (user) => set({ user }),
      logout:     () => set({ user: null }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name:        'tikvtv-auth',
      partialize:  (state) => ({ user: state.user }),
    }
  )
);
