/**
 * Referral Program page — share code, track referrals, earn free months.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Gift, Copy, Share2, CheckCircle2, Users, Crown,
  Loader2, Link2, Zap, ChevronRight,
} from 'lucide-react';
import { useReferral } from '@/hooks/useReferral';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AuthModal from '@/components/features/AuthModal';

export default function Referral() {
  const navigate    = useNavigate();
  const { user }    = useAuthStore();
  const {
    myCode, referrals, loading, creating,
    createCode, applyReferralCode,
    copyLink, shareLink,
    usedCount,
  } = useReferral();

  const [showAuth,   setShowAuth]   = useState(false);
  const [applyCode,  setApplyCode]  = useState('');
  const [applying,   setApplying]   = useState(false);

  const handleApply = async () => {
    if (!applyCode.trim()) return;
    setApplying(true);
    await applyReferralCode(applyCode);
    setApplying(false);
    setApplyCode('');
  };

  if (!user) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 px-8">
      <Gift className="w-16 h-16 text-primary/40" />
      <p className="text-white/50 text-center">Sign in to access the referral program</p>
      <button onClick={() => setShowAuth(true)} className="bg-primary text-white px-6 py-3 rounded-full font-semibold">Sign In</button>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );

  return (
    <div className="min-h-screen bg-black pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-12 pb-4 bg-black/95 backdrop-blur border-b border-white/8 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-bold text-lg flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />Referral Program
          </h1>
          <p className="text-white/40 text-xs">Invite friends, earn free months</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-6">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary/20 to-secondary/15 border border-primary/30 rounded-3xl p-6 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-white font-bold text-xl">Invite & Earn</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Share your code — when a friend subscribes to Premium, <strong className="text-white">you both get 1 month free</strong>.
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {[
              { label: 'Invited',    value: referrals.length, icon: Users,       color: 'text-white' },
              { label: 'Subscribed', value: usedCount,        icon: CheckCircle2, color: 'text-green-400' },
              { label: 'Free Months',value: usedCount,        icon: Crown,        color: 'text-amber-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/8 rounded-2xl p-3 text-center border border-white/10">
                <s.icon className={cn('w-4 h-4 mx-auto mb-1', s.color)} />
                <p className={cn('text-lg font-bold', s.color)}>{s.value}</p>
                <p className="text-white/30 text-[9px]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* My referral code */}
        <div className="space-y-2">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Your Referral Code</p>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
            </div>
          ) : myCode ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
              {/* Code display */}
              <div className="flex items-center justify-between bg-black/40 border border-white/15 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white/30 text-[10px] mb-0.5">Your code</p>
                  <p className="text-white font-black text-xl tracking-[0.2em] font-mono">{myCode}</p>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(myCode); toast.success('Code copied!'); }}
                  className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center hover:bg-primary/25 transition-colors"
                >
                  <Copy className="w-4 h-4 text-primary" />
                </button>
              </div>

              {/* Share buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={copyLink}
                  className="flex items-center justify-center gap-2 bg-white/8 border border-white/12 rounded-xl py-3 text-white/70 text-sm font-semibold hover:bg-white/15 transition-colors"
                >
                  <Link2 className="w-4 h-4" />Copy Link
                </button>
                <button
                  onClick={shareLink}
                  className="flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-3 text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  <Share2 className="w-4 h-4" />Share
                </button>
              </div>

              {/* How it works */}
              <div className="bg-white/4 border border-white/8 rounded-xl p-3 space-y-2">
                <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider">How it works</p>
                {[
                  'Share your code with friends',
                  'They subscribe to any Premium plan',
                  'You both get 1 month free!',
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center flex-none">{i + 1}</div>
                    <p className="text-white/50 text-xs">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
              <Gift className="w-10 h-10 text-white/15" />
              <p className="text-white/40 text-sm">You don't have a referral code yet</p>
              <button
                onClick={createCode}
                disabled={creating}
                className="flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Generate My Code
              </button>
            </div>
          )}
        </div>

        {/* Apply a code */}
        <div className="space-y-2">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Have a Friend's Code?</p>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <p className="text-white/50 text-sm">Enter a referral code to give your friend a reward when you subscribe.</p>
            <div className="flex gap-2">
              <input
                value={applyCode}
                onChange={e => setApplyCode(e.target.value.toUpperCase())}
                placeholder="TIK-XXXXXX-XXXX"
                className="flex-1 bg-white/8 border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-primary/50 font-mono tracking-wider uppercase"
              />
              <button
                onClick={handleApply}
                disabled={!applyCode.trim() || applying}
                className="flex items-center gap-1.5 bg-primary text-white font-bold px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Referral history */}
        {referrals.length > 0 && (
          <div className="space-y-2">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Your Referrals</p>
            <div className="space-y-2">
              {referrals.map(r => (
                <div key={r.id} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-none',
                    r.used ? 'bg-green-500/20' : 'bg-white/8')}>
                    {r.used
                      ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                      : <Users className="w-4 h-4 text-white/30" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold font-mono">{r.code}</p>
                    <p className="text-white/40 text-[10px]">
                      {r.used ? `Used${r.used_at ? ` · ${new Date(r.used_at).toLocaleDateString()}` : ''}` : 'Not used yet'}
                    </p>
                  </div>
                  {r.rewarded && (
                    <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] font-bold px-2 py-1 rounded-full flex-none">
                      <Crown className="w-2.5 h-2.5" />+1 Month
                    </div>
                  )}
                  {r.used && !r.rewarded && (
                    <div className="text-white/20 text-[10px] flex-none">Pending reward</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
