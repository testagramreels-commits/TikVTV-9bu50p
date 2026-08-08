/**
 * useReferral — manage referral codes for the premium referral program.
 * Each user gets one unique referral code. When a new user subscribes using
 * the code, the referrer gets 1 month free (marked in DB).
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

interface Referral {
  id: string;
  code: string;
  used: boolean;
  rewarded: boolean;
  used_at?: string;
  referred?: { username?: string; email?: string };
}

function generateCode(userId: string): string {
  // Deterministic: first 6 chars of userId + 4 random alphanumeric
  const base = userId.replace(/-/g, '').slice(0, 6).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TIK-${base}-${rand}`;
}

export function useReferral() {
  const { user } = useAuthStore();
  const [myCode,     setMyCode]    = useState<string | null>(null);
  const [referrals,  setReferrals] = useState<Referral[]>([]);
  const [loading,    setLoading]   = useState(false);
  const [creating,   setCreating]  = useState(false);

  const loadReferrals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('premium_referrals')
      .select('id, code, used, rewarded, used_at, referred_id')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    setReferrals((data || []) as Referral[]);

    // Find existing code (unused or any)
    const existing = (data || []).find((r: Referral) => !r.used || true);
    if (existing) setMyCode(existing.code);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadReferrals(); }, [loadReferrals]);

  const createCode = useCallback(async () => {
    if (!user) return;
    setCreating(true);
    const code = generateCode(user.id);
    const { error } = await supabase.from('premium_referrals').insert({
      referrer_id: user.id,
      code,
    });
    if (error) {
      toast.error('Could not create referral code');
    } else {
      setMyCode(code);
      await loadReferrals();
      toast.success('Referral code created!');
    }
    setCreating(false);
  }, [user, loadReferrals]);

  const applyReferralCode = useCallback(async (code: string): Promise<boolean> => {
    if (!user) return false;
    const { data, error } = await supabase
      .from('premium_referrals')
      .select('id, referrer_id, used')
      .eq('code', code.toUpperCase().trim())
      .maybeSingle();

    if (error || !data) { toast.error('Invalid referral code'); return false; }
    if (data.used)       { toast.error('This referral code has already been used'); return false; }
    if (data.referrer_id === user.id) { toast.error("You can't use your own referral code"); return false; }

    // Mark as used
    const { error: updateErr } = await supabase
      .from('premium_referrals')
      .update({ used: true, referred_id: user.id, used_at: new Date().toISOString() })
      .eq('id', data.id);

    if (updateErr) { toast.error('Failed to apply code'); return false; }
    toast.success('Referral code applied! 🎉 Your friend gets a free month bonus!');
    return true;
  }, [user]);

  const copyLink = useCallback(() => {
    if (!myCode) return;
    const link = `${window.location.origin}/?ref=${myCode}`;
    navigator.clipboard.writeText(link)
      .then(() => toast.success('Referral link copied! Share it to earn free months.'));
  }, [myCode]);

  const shareLink = useCallback(() => {
    if (!myCode) return;
    const link = `${window.location.origin}/?ref=${myCode}`;
    const text  = `Use my referral code ${myCode} on TikVTV and we both get perks! 🎁`;
    if (navigator.share) {
      navigator.share({ title: 'Join TikVTV Premium', text, url: link });
    } else {
      copyLink();
    }
  }, [myCode, copyLink]);

  const usedCount   = referrals.filter(r => r.used).length;
  const rewardCount = referrals.filter(r => r.rewarded).length;

  return {
    myCode, referrals, loading, creating,
    createCode, applyReferralCode,
    copyLink, shareLink,
    usedCount, rewardCount,
  };
}
