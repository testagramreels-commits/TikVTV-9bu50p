/**
 * Paywall overlay shown when a channel has been watched for 15+ minutes.
 * Opens PesaPal premium purchase modal.
 */
import { useState } from 'react';
import { Lock, Star, Zap, ArrowRight, Crown } from 'lucide-react';
import type { IPTVChannel } from '@/types';
import PremiumModal from './PremiumModal';

interface Props {
  channel: IPTVChannel;
  onUnlock?: () => void;
}

export default function ChannelLockOverlay({ channel, onUnlock }: Props) {
  const [showPayment, setShowPayment] = useState(false);

  const handleUpgrade = () => {
    setShowPayment(true);
    onUnlock?.();
  };

  return (
    <>
      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/92 backdrop-blur-xl">
        {channel.logo && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img src={channel.logo} alt="" className="w-full h-full object-cover opacity-5 scale-150 blur-2xl" />
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center gap-5 px-8 max-w-sm w-full text-center">
          {/* Lock icon */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/40 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-400/30 flex items-center justify-center">
                <Lock className="w-8 h-8 text-amber-400" />
              </div>
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-amber-400/20 animate-ping" />
          </div>

          <div className="space-y-1">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Channel Locked</p>
            <h2 className="text-white text-2xl font-bold leading-tight">{channel.name}</h2>
            <p className="text-white/50 text-sm">You've watched your 15-minute free preview.</p>
          </div>

          <div className="w-full h-px bg-white/10" />

          <div className="w-full space-y-3 text-left">
            <p className="text-white/30 text-[11px] font-bold uppercase tracking-wider text-center">What you get with Premium</p>
            {[
              { icon: Zap,   label: 'Unlimited watch time on all channels' },
              { icon: Star,  label: 'HD & 4K streams with zero buffering' },
              { icon: Crown, label: 'Pay via M-Pesa, Airtel, Cards & more' },
              { icon: Lock,  label: 'No ads, no interruptions' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-none">
                  <Icon className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-white/70 text-sm">{label}</p>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpgrade}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-base py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-amber-500/30"
          >
            <Crown className="w-5 h-5" />
            Upgrade to Premium
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-white/25 text-xs">
            From $9.99/mo · Secured by <span className="text-amber-400/60">PesaPal</span>
          </p>
        </div>
      </div>

      {showPayment && (
        <PremiumModal
          channelName={channel.name}
          onClose={() => setShowPayment(false)}
        />
      )}
    </>
  );
}
