import { Download, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { cn } from '@/lib/utils';

export default function PWABanner() {
  const { canInstall, promptInstall, dismiss } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <div
      className={cn(
        'fixed bottom-20 left-3 right-3 z-50',
        'bg-gradient-to-r from-gray-900 to-gray-800',
        'border border-white/15 rounded-2xl px-4 py-3',
        'shadow-2xl shadow-black/60 backdrop-blur-xl',
        'flex items-center gap-3',
        'animate-in slide-in-from-bottom-4 duration-300'
      )}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-none">
        <span className="text-xl">📺</span>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-tight">Install TikVTV</p>
        <p className="text-white/50 text-xs leading-tight mt-0.5">Add to home screen for the best experience</p>
      </div>

      {/* Install button */}
      <button
        onClick={async () => {
          const accepted = await promptInstall();
          if (accepted) dismiss();
        }}
        className="flex-none flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-primary/90 active:scale-95 transition-all"
      >
        <Smartphone className="w-3.5 h-3.5" />
        Install
      </button>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        className="flex-none w-7 h-7 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
      >
        <X className="w-3.5 h-3.5 text-white/50" />
      </button>
    </div>
  );
}
