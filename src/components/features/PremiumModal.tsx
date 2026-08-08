/**
 * PremiumModal — KES-native pricing (100 KES Unlimited / 200 KES Pro)
 */
import { useState } from 'react';
import { X, Lock, Star, Zap, CheckCircle2, Loader2, ExternalLink, Crown, Infinity, Sparkles } from 'lucide-react';
import { usePremium } from '@/hooks/usePremium';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  onClose: () => void;
  channelName?: string;
}

const PLANS = [
  {
    id: 'unlimited' as const,
    label: 'Unlimited',
    price: 'KES 100',
    priceNote: 'per month',
    badge: 'POPULAR',
    badgeColor: 'from-primary to-secondary',
    description: 'Watch any channel, no time limits.',
    highlight: false,
    features: ['All channels unlocked', 'No watch-time limits', 'HD streams', 'Cancel anytime'],
    icon: Infinity,
    iconColor: 'text-primary',
    borderActive: 'border-primary/60',
    bgActive: 'bg-primary/15',
  },
  {
    id: 'pro' as const,
    label: 'Pro',
    price: 'KES 200',
    priceNote: 'per month',
    badge: 'PRO',
    badgeColor: 'from-amber-400 to-orange-500',
    description: 'Everything in Unlimited + Pro perks.',
    highlight: true,
    features: ['Everything in Unlimited', 'Priority HD/4K quality', 'Early access features', 'Premium support'],
    icon: Sparkles,
    iconColor: 'text-amber-400',
    borderActive: 'border-amber-500/60',
    bgActive: 'bg-amber-500/15',
  },
];

const PAYMENT_METHODS = [
  { icon: '📱', label: 'M-Pesa' },
  { icon: '💳', label: 'Airtel Money' },
  { icon: '🏦', label: 'Card' },
  { icon: '🌐', label: 'Bank' },
];

export default function PremiumModal({ onClose, channelName }: Props) {
  const [plan, setPlan]       = useState<'unlimited' | 'pro'>('unlimited');
  const [loading, setLoading] = useState(false);
  const { initiatePurchase }  = usePremium();

  const selectedPlan = PLANS.find(p => p.id === plan)!;

  const handlePurchase = async () => {
    setLoading(true);
    const result = await initiatePurchase(plan);
    setLoading(false);

    if ('error' in result && result.error) {
      toast.error(`Payment error: ${result.error}`);
      return;
    }
    if (result.data?.redirect_url) {
      window.open(result.data.redirect_url, '_blank', 'noopener,noreferrer');
      toast.success('PesaPal page opened. Complete payment to unlock all channels!');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-gradient-to-b from-zinc-900 to-black border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-primary/20 via-amber-500/20 to-primary/20 px-6 pt-8 pb-5 text-center border-b border-white/8">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30">
              <Crown className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-white font-bold text-xl">Upgrade to Premium</h2>
          {channelName && (
            <p className="text-white/50 text-sm mt-1">
              Unlock <span className="text-amber-400 font-semibold">{channelName}</span> and 100k+ channels
            </p>
          )}
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Plan selector */}
          <div className="grid grid-cols-2 gap-2.5">
            {PLANS.map(p => {
              const Icon = p.icon;
              const active = plan === p.id;
              return (
                <button key={p.id} onClick={() => setPlan(p.id)}
                  className={cn(
                    'relative flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition-all',
                    active ? `${p.bgActive} ${p.borderActive} shadow-lg` : 'bg-white/5 border-white/10 hover:border-white/25'
                  )}>
                  {p.badge && (
                    <span className={cn('absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r text-black text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap', p.badgeColor)}>
                      {p.badge}
                    </span>
                  )}
                  <Icon className={cn('w-5 h-5', active ? p.iconColor : 'text-white/30')} />
                  <span className={cn('text-xs font-bold', active ? 'text-white' : 'text-white/50')}>{p.label}</span>
                  <span className={cn('text-lg font-bold leading-none', active ? 'text-white' : 'text-white/70')}>{p.price}</span>
                  <span className={cn('text-[10px]', active ? 'text-white/50' : 'text-white/25')}>{p.priceNote}</span>
                </button>
              );
            })}
          </div>

          {/* Features of selected plan */}
          <div className="bg-white/5 border border-white/8 rounded-2xl p-4 space-y-2.5">
            {selectedPlan.features.map(f => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-none" />
                <span className="text-white/80 text-sm">{f}</span>
              </div>
            ))}
          </div>

          {/* Payment methods */}
          <div>
            <p className="text-white/30 text-[10px] uppercase font-semibold tracking-wider mb-2 text-center">Pay with</p>
            <div className="flex justify-center gap-3">
              {PAYMENT_METHODS.map(m => (
                <div key={m.label} className="flex flex-col items-center gap-1">
                  <span className="text-xl">{m.icon}</span>
                  <span className="text-white/30 text-[9px]">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handlePurchase}
            disabled={loading}
            className={cn(
              'w-full flex items-center justify-center gap-2 font-bold text-base py-4 rounded-2xl transition-all active:scale-95 shadow-xl disabled:opacity-60',
              plan === 'pro'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-amber-500/20'
                : 'bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white shadow-primary/20'
            )}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Pay {selectedPlan.price} via PesaPal</span>
                <ExternalLink className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-center text-white/20 text-[10px]">
            Secured by PesaPal · M-Pesa, Airtel, Cards & more · Kenya
          </p>
        </div>
      </div>
    </div>
  );
}
