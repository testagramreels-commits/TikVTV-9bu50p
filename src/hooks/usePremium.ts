/**
 * Premium subscription hook — checks & manages user's premium status via PesaPal.
 * Caches result for 5 minutes to avoid repeated edge function calls.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { FunctionsHttpError } from '@supabase/supabase-js';

const CACHE_KEY = 'tikvtv_premium_status';
const CACHE_TTL = 5 * 60 * 1000; // 5 min

interface PremiumState {
  isPremium: boolean;
  loading: boolean;
  plan?: string;
  expiresAt?: string;
}

function getCachedPremium(): { isPremium: boolean; plan?: string; expiresAt?: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function cachePremium(data: { isPremium: boolean; plan?: string; expiresAt?: string }) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

export function clearPremiumCache() {
  localStorage.removeItem(CACHE_KEY);
}

export function usePremium() {
  const { user } = useAuthStore();
  const [state, setState] = useState<PremiumState>({ isPremium: false, loading: !!user });

  const checkPremium = useCallback(async () => {
    if (!user) { setState({ isPremium: false, loading: false }); return; }

    // Check cache first
    const cached = getCachedPremium();
    if (cached) { setState({ ...cached, loading: false }); return; }

    setState(s => ({ ...s, loading: true }));
    const { data, error } = await supabase.functions.invoke('pesapal-payment', {
      body: { action: 'check_premium' },
    });
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { msg = await error.context.text(); } catch {}
      }
      console.warn('[Premium] check failed:', msg);
      setState({ isPremium: false, loading: false });
      return;
    }
    const result = { isPremium: data.isPremium, plan: data.subscription?.plan, expiresAt: data.subscription?.expires_at };
    cachePremium(result);
    setState({ ...result, loading: false });
  }, [user]);

  useEffect(() => { checkPremium(); }, [checkPremium]);

  const initiatePurchase = async (plan: 'monthly' | 'yearly' = 'monthly') => {
    if (!user) return { error: 'Not authenticated' };
    const amount   = plan === 'yearly' ? 59.99 : 9.99;
    const currency = 'USD';
    const callback_url = `${window.location.origin}/premium/callback`;

    const { data, error } = await supabase.functions.invoke('pesapal-payment', {
      body: { action: 'initiate', amount, currency, plan, callback_url },
    });
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { const txt = await error.context.text(); msg = `[${error.context.status}] ${txt}`; } catch {}
      }
      return { error: msg };
    }
    return { data };
  };

  const checkOrderStatus = async (orderTrackingId: string) => {
    const { data, error } = await supabase.functions.invoke('pesapal-payment', {
      body: { action: 'check_status', order_tracking_id: orderTrackingId },
    });
    if (error) return { isPaid: false };
    if (data?.isPaid) { clearPremiumCache(); await checkPremium(); }
    return { isPaid: data?.isPaid ?? false, status: data?.status };
  };

  return { ...state, checkPremium, initiatePurchase, checkOrderStatus };
}
