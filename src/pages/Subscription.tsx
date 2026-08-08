/**
 * Subscription Management — shows current plan, expiry, payment history,
 * renewal button, and upgrade options. All prices in KES.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Crown, Infinity, Sparkles, CheckCircle2, Clock,
  Calendar, RefreshCw, Loader2, ExternalLink, Shield, Zap, AlertCircle,
} from 'lucide-react';
import { usePremium } from '@/hooks/usePremium';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AuthModal from '@/components/features/AuthModal';

const PLANS = [
  {
    id: 'unlimited' as const,
    label: 'Unlimited',
    price: 'KES 100',
    priceSub: '/month',
    icon: Infinity,
    color: 'from-primary to-secondary',
    border: 'border-primary/50',
    bg: 'bg-primary/10',
    features: ['All channels unlocked', 'No watch-time limits', 'HD streaming', 'Cancel anytime'],
  },
  {
    id: 'pro' as const,
    label: 'Pro',
    price: 'KES 200',
    priceSub: '/month',
    icon: Sparkles,
    color: 'from-amber-400 to-orange-500',
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    features: ['Everything in Unlimited', 'Priority HD/4K quality', 'Early access features', 'Premium support'],
  },
];

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cfg =
    s === 'completed' ? 'bg-green-500/15 text-green-400 border-green-500/30' :
    s === 'pending'   ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                        'bg-red-500/15 text-red-400 border-red-500/30';
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize', cfg)}>
      {status}
    </span>
  );
}

export default function Subscription() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isPremium, plan, expiresAt, amount, currency, loading, initiatePurchase, getSubscriptionHistory } = usePremium();
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [renewPlan, setRenewPlan] = useState<'unlimited' | 'pro'>('unlimited');
  const [paying, setPaying] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (!user) return;
    setHistLoading(true);
    getSubscriptionHistory().then(h => { setHistory(h); setHistLoading(false); });
  }, [user]);

  const handlePay = async (p: 'unlimited' | 'pro') => {
    if (!user) { setShowAuth(true); return; }
    setPaying(true);
    const result = await initiatePurchase(p);
    setPaying(false);
    if ('error' in result && result.error) {
      toast.error(`Payment error: ${result.error}`);
      return;
    }
    if (result.data?.redirect_url) {
      window.open(result.data.redirect_url, '_blank', 'noopener,noreferrer');
      toast.success('PesaPal opened — complete payment to activate your plan!');
    }
  };

  if (!user) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 px-8">
      <Crown className="w-16 h-16 text-amber-400/40" />
      <p className="text-white/50 text-center">Sign in to manage your subscription</p>
      <button onClick={() => setShowAuth(true)} className="bg-primary text-white px-6 py-3 rounded-full font-semibold">
        Sign In
      </button>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-12 pb-4 bg-black/95 backdrop-blur border-b border-white/8 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-bold text-lg">Subscription</h1>
          <p className="text-white/40 text-xs">Manage your TikVTV plan</p>
        </div>
        <Crown className="w-5 h-5 text-amber-400" />
      </div>

      <div className="px-4 py-5 space-y-6">
        {/* Current plan status */}
        <div className={cn(
          'rounded-2xl p-5 border',
          isPremium
            ? 'bg-gradient-to-br from-amber-500/15 to-orange-500/10 border-amber-500/30'
            : 'bg-white/5 border-white/10'
        )}>
          {loading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
              <span className="text-white/40 text-sm">Checking subscription…</span>
            </div>
          ) : isPremium ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-none">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-lg capitalize">{plan || 'Premium'} Member</p>
                  <p className="text-amber-400/70 text-sm">
                    {amount} {currency || 'KES'}/month
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-green-400 ml-auto flex-none" />
              </div>

              {expiresAt && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-white/60">
                      <Calendar className="w-3.5 h-3.5" />
                      Renews {fmtDate(expiresAt)}
                    </div>
                    <span className="text-amber-400 font-semibold text-xs">
                      {daysUntil(expiresAt)} days left
                    </span>
                  </div>
                  {/* Expiry progress bar */}
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                      style={{ width: `${Math.min(100, (daysUntil(expiresAt) / 30) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => handlePay(plan as 'unlimited' | 'pro' || 'unlimited')}
                disabled={paying}
                className="w-full flex items-center justify-center gap-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 font-semibold text-sm py-2.5 rounded-xl hover:bg-amber-500/30 transition-colors disabled:opacity-50"
              >
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Renew Now via PesaPal
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/8 flex items-center justify-center flex-none">
                  <Shield className="w-6 h-6 text-white/30" />
                </div>
                <div>
                  <p className="text-white font-bold text-base">Free Plan</p>
                  <p className="text-white/40 text-sm">15 min per channel, then locked</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-none" />
                <p className="text-amber-300/80 text-xs">Upgrade to unlock all 100k+ channels with no time limits</p>
              </div>
            </div>
          )}
        </div>

        {/* Plan options */}
        <div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Available Plans</p>
          <div className="space-y-3">
            {PLANS.map(p => {
              const Icon = p.icon;
              const isCurrent = isPremium && plan === p.id;
              return (
                <div key={p.id} className={cn('rounded-2xl border p-4', isCurrent ? `${p.bg} ${p.border}` : 'bg-white/5 border-white/10')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-none', p.color)}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-bold">{p.label}</p>
                        {isCurrent && <span className="text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">ACTIVE</span>}
                      </div>
                      <p className="text-white/50 text-sm">{p.price}<span className="text-white/30 text-xs">{p.priceSub}</span></p>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={() => handlePay(p.id)}
                        disabled={paying}
                        className={cn(
                          'flex items-center gap-1.5 font-bold text-xs px-3 py-2 rounded-xl transition-all disabled:opacity-50',
                          p.id === 'pro'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black'
                            : 'bg-primary text-white hover:bg-primary/90'
                        )}
                      >
                        {paying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        Pay {p.price}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {p.features.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-none" />
                        <span className="text-white/60 text-xs">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment methods */}
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Payment Methods</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: '📱', name: 'M-Pesa', desc: 'Safaricom mobile money' },
              { icon: '💳', name: 'Airtel Money', desc: 'Airtel mobile money' },
              { icon: '🏦', name: 'Card', desc: 'Visa, Mastercard' },
              { icon: '🌐', name: 'Bank', desc: 'Bank transfer' },
            ].map(m => (
              <div key={m.name} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/5">
                <span className="text-xl">{m.icon}</span>
                <div>
                  <p className="text-white text-xs font-semibold">{m.name}</p>
                  <p className="text-white/30 text-[10px]">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-white/20 text-[10px] text-center mt-3">
            Secured by PesaPal · Payments processed in Kenya (KES)
          </p>
        </div>

        {/* Payment history */}
        <div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Payment History</p>
          {histLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 bg-white/5 rounded-2xl border border-white/8">
              <Clock className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-white/30 text-sm">No payment history yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((sub: Record<string, unknown>) => (
                <div key={sub.id as string} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                  <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-none">
                    <Crown className="w-4 h-4 text-amber-400/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white text-xs font-semibold capitalize">{String(sub.plan || 'Plan')} Plan</p>
                      <StatusBadge status={String(sub.status)} />
                    </div>
                    <p className="text-white/40 text-[10px]">
                      {Number(sub.amount)} {String(sub.currency || 'KES')} · {fmtDate(String(sub.created_at))}
                    </p>
                  </div>
                  {sub.expires_at && (
                    <div className="text-right flex-none">
                      <p className="text-white/30 text-[9px]">Expires</p>
                      <p className="text-white/50 text-[10px]">{fmtDate(String(sub.expires_at))}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-white/15 text-[10px] pb-4">
          Subscriptions auto-expire after 30 days · Renew anytime via PesaPal · Contact support at contact@onspace.ai
        </p>
      </div>
    </div>
  );
}
