/**
 * Premium subscription hook — KES plans (unlimited=100, pro=200)
 * Checks via DB directly for speed, falls back to edge function.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { FunctionsHttpError } from '@supabase/supabase-js';

const CACHE_KEY = 'tikvtv_premium_v3';
const CACHE_TTL = 5 * 60 * 1000; // 5 min

interface PremiumState {
  isPremium: boolean;
  loading: boolean;
  plan?: string;
  expiresAt?: string;
}

function getCached(): { isPremium: boolean; plan?: string; expiresAt?: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCache(data: { isPremium: boolean; plan?: string; expiresAt?: string }) {
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

    const cached = getCached();
    if (cached) { setState({ ...cached, loading: false }); return; }

    setState(s => ({ ...s, loading: true }));

    // Fast DB check first (no edge function round-trip)
    const { data: sub } = await supabase
      .from('premium_subscriptions')
      .select('status, expires_at, plan')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const result = {
      isPremium:  !!sub,
      plan:       sub?.plan,
      expiresAt:  sub?.expires_at,
    };
    setCache(result);
    setState({ ...result, loading: false });
  }, [user]);

  useEffect(() => { checkPremium(); }, [checkPremium]);

  const initiatePurchase = async (plan: 'unlimited' | 'pro' = 'unlimited') => {
    if (!user) return { error: 'Not authenticated' };
    const callback_url = `${window.location.origin}/premium/callback`;

    const { data, error } = await supabase.functions.invoke('pesapal-payment', {
      body: { action: 'initiate', plan, callback_url },
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
