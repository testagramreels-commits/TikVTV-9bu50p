/**
 * PremiumModal — PesaPal-powered channel unlock paywall.
 * Shows plan selection and redirects to PesaPal payment page.
 */
import { useState } from 'react';
import { X, Lock, Star, Zap, CheckCircle2, Loader2, ExternalLink, Crown } from 'lucide-react';
import { usePremium } from '@/hooks/usePremium';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  onClose: () => void;
  channelName?: string;
}

const PLANS = [
  {
    id: 'monthly' as const,
    label: 'Monthly',
    price: '$9.99',
    period: '/month',
    badge: null,
    description: 'Billed monthly. Cancel anytime.',
  },
  {
    id: 'yearly' as const,
    label: 'Yearly',
    price: '$59.99',
    period: '/year',
    badge: 'SAVE 50%',
    description: 'Best value — only $5/month.',
  },
];

const FEATURES = [
  { icon: Zap,  text: 'Unlimited watch time on all channels' },
  { icon: Star, text: 'HD & 4K streams, no buffering' },
  { icon: Lock, text: 'No ads, no interruptions' },
  { icon: Crown, text: 'Early access to new features' },
];

export default function PremiumModal({ onClose, channelName }: Props) {
  const [plan, setPlan]       = useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState(false);
  const { initiatePurchase }  = usePremium();

  const handlePurchase = async () => {
    setLoading(true);
    const result = await initiatePurchase(plan);
    setLoading(false);
    if ('error' in result && result.error) {
      toast.error(`Payment error: ${result.error}`);
      return;
    }
    if (result.data?.redirect_url) {
      // Open PesaPal payment page in new tab
      window.open(result.data.redirect_url, '_blank', 'noopener');
      toast.success('PesaPal payment page opened. Complete payment to unlock!');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-sm bg-gradient-to-b from-zinc-900 to-black border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Header gradient band */}
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 px-6 pt-8 pb-6 text-center border-b border-white/8">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Crown className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-white font-bold text-xl">Upgrade to Premium</h2>
          {channelName && (
            <p className="text-white/50 text-sm mt-1">Unlock <span className="text-amber-400 font-medium">{channelName}</span> and all channels</p>
          )}
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Features */}
          <div className="space-y-2.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-none">
                  <Icon className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-white/80 text-sm">{text}</span>
                <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto flex-none" />
              </div>
            ))}
          </div>

          <div className="h-px bg-white/8" />

          {/* Plan selector */}
          <div className="grid grid-cols-2 gap-2">
            {PLANS.map(p => (
              <button
                key={p.id}
                onClick={() => setPlan(p.id)}
                className={cn(
                  'relative flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all',
                  plan === p.id
                    ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/10'
                    : 'bg-white/5 border-white/10 hover:border-white/25'
                )}
              >
                {p.badge && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    {p.badge}
                  </span>
                )}
                <span className={cn('text-xs font-semibold', plan === p.id ? 'text-amber-300' : 'text-white/60')}>{p.label}</span>
                <span className={cn('text-xl font-bold', plan === p.id ? 'text-white' : 'text-white/80')}>{p.price}</span>
                <span className={cn('text-[10px]', plan === p.id ? 'text-amber-300/70' : 'text-white/30')}>{p.period}</span>
              </button>
            ))}
          </div>

          <p className="text-center text-white/30 text-[11px]">
            {PLANS.find(p => p.id === plan)?.description}
          </p>

          {/* CTA */}
          <button
            onClick={handlePurchase}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-black font-bold text-base py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-amber-500/20"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Pay with PesaPal</span>
                <ExternalLink className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-center text-white/25 text-[10px]">
            Secured by PesaPal · Cards, M-Pesa, Airtel Money & more
          </p>
        </div>
      </div>
    </div>
  );
}
