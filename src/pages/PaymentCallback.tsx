/**
 * Payment callback page — shown after PesaPal redirect.
 * Polls order status and confirms premium activation.
 */
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle, Crown } from 'lucide-react';
import { usePremium, clearPremiumCache } from '@/hooks/usePremium';

export default function PaymentCallback() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const { checkOrderStatus } = usePremium();
  const [status, setStatus]  = useState<'checking' | 'success' | 'failed'>('checking');

  useEffect(() => {
    const trackingId = params.get('OrderTrackingId') || params.get('orderTrackingId');
    if (!trackingId) { setStatus('failed'); return; }

    let attempts = 0;
    const poll = async () => {
      attempts++;
      const { isPaid } = await checkOrderStatus(trackingId);
      if (isPaid) {
        clearPremiumCache();
        setStatus('success');
      } else if (attempts < 8) {
        setTimeout(poll, 3000);
      } else {
        setStatus('failed');
      }
    };
    setTimeout(poll, 2000);
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 px-8 text-center">
      {status === 'checking' && (
        <>
          <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
          <div>
            <h2 className="text-white font-bold text-xl mb-2">Verifying Payment…</h2>
            <p className="text-white/40 text-sm">Please wait while we confirm your payment</p>
          </div>
        </>
      )}
      {status === 'success' && (
        <>
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Crown className="w-10 h-10 text-white" />
          </div>
          <div>
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <h2 className="text-white font-bold text-2xl mb-2">Premium Activated!</h2>
            <p className="text-white/60 text-sm">Enjoy unlimited access to all channels</p>
          </div>
          <button onClick={() => navigate('/')}
            className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-8 py-3 rounded-full">
            Start Watching
          </button>
        </>
      )}
      {status === 'failed' && (
        <>
          <XCircle className="w-16 h-16 text-red-400" />
          <div>
            <h2 className="text-white font-bold text-xl mb-2">Payment Not Confirmed</h2>
            <p className="text-white/40 text-sm">Payment may still be processing. Check your profile for status.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/')} className="bg-white/10 text-white font-semibold px-6 py-3 rounded-full border border-white/20">
              Go Home
            </button>
            <button onClick={() => navigate('/profile')} className="bg-primary text-white font-bold px-6 py-3 rounded-full">
              My Profile
            </button>
          </div>
        </>
      )}
    </div>
  );
}
