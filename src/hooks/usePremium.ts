/**
 * Premium subscription hook — KES plans (unlimited=KES 100, pro=KES 200)
 * Passes window.location.origin as callback so PesaPal redirects correctly.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { FunctionsHttpError } from '@supabase/supabase-js';

const CACHE_KEY = 'tikvtv_premium_v4';
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export interface PremiumSubscription {
  isPremium:  boolean;
  plan?:      string;
  expiresAt?: string;
  amount?:    number;
  currency?:  string;
}

interface PremiumState extends PremiumSubscription {
  loading: boolean;
}

function getCached(): PremiumSubscription | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCache(data: PremiumSubscription) {
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

    const { data: sub } = await supabase
      .from('premium_subscriptions')
      .select('status, expires_at, plan, amount, currency')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const result: PremiumSubscription = {
      isPremium: !!sub,
      plan:      sub?.plan,
      expiresAt: sub?.expires_at,
      amount:    sub?.amount,
      currency:  sub?.currency,
    };
    setCache(result);
    setState({ ...result, loading: false });
  }, [user]);

  useEffect(() => { checkPremium(); }, [checkPremium]);

  // Fetch all subscriptions for the subscription management UI
  const getSubscriptionHistory = async () => {
    if (!user) return [];
    const { data } = await supabase
      .from('premium_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    return data || [];
  };

  const initiatePurchase = async (plan: 'unlimited' | 'pro' = 'unlimited') => {
    if (!user) return { error: 'Not authenticated' };

    // Pass the real app origin so PesaPal redirects back here
    const callback_url = `${window.location.origin}/premium/callback`;

    const { data, error } = await supabase.functions.invoke('pesapal-payment', {
      body: { action: 'initiate', plan, callback_url, origin: window.location.origin },
    });

    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          const statusCode = error.context?.status ?? 500;
          const textContent = await error.context?.text();
          msg = `[Code: ${statusCode}] ${textContent || error.message || 'Unknown error'}`;
        } catch { msg = error.message || 'Failed to read response'; }
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

  return { ...state, checkPremium, initiatePurchase, checkOrderStatus, getSubscriptionHistory };
}
