import { Moon, X, AlarmClock, BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SleepTimerState } from '@/hooks/useSleepTimer';

const OPTIONS = [
  { label: '15 min', value: 15, icon: '🌙' },
  { label: '30 min', value: 30, icon: '🌙' },
  { label: '45 min', value: 45, icon: '😴' },
  { label: '1 hr',   value: 60, icon: '😴' },
  { label: '1.5 hr', value: 90, icon: '💤' },
  { label: '2 hr',   value: 120, icon: '💤' },
];

function formatRemaining(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function progressPercent(timer: SleepTimerState): number {
  if (!timer.active || !timer.durationMins) return 0;
  const total = timer.durationMins * 60;
  return Math.max(0, Math.min(100, ((total - timer.remaining) / total) * 100));
}

interface Props {
  timer:   SleepTimerState;
  onClose: () => void;
}

export default function SleepTimerOverlay({ timer, onClose }: Props) {
  const pct = progressPercent(timer);

  return (
    <div
      className="absolute inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl border border-white/10 overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#0f0f1a 0%,#1a1a2e 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <Moon className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <p className="text-white font-bold text-base">Sleep Timer</p>
              <p className="text-white/40 text-xs">Pause playback automatically</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* Active countdown ring */}
        {timer.active && (
          <div className="mx-6 mb-5 rounded-2xl overflow-hidden border border-indigo-500/25 bg-indigo-900/20">
            <div className="px-5 py-4 flex items-center gap-4">
              {/* Circular progress */}
              <div className="relative w-16 h-16 flex-none">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="5" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke="#818cf8" strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - pct / 100)}`}
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <BedDouble className="w-5 h-5 text-indigo-300" />
                </div>
              </div>

              <div className="flex-1">
                <p className="text-indigo-300/60 text-xs mb-0.5">Pausing in</p>
                <p className="text-white text-3xl font-mono font-bold leading-none">
                  {formatRemaining(timer.remaining)}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-indigo-900/40">
              <div
                className="h-full bg-indigo-400 transition-all duration-1000"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex justify-end px-4 py-2">
              <button
                onClick={timer.cancel}
                className="text-xs text-red-400/80 hover:text-red-300 font-semibold transition-colors"
              >
                Cancel timer ×
              </button>
            </div>
          </div>
        )}

        {/* Options grid */}
        <div className="grid grid-cols-3 gap-2 px-6 pb-10">
          {OPTIONS.map(opt => {
            const isActive = timer.active && timer.durationMins === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { timer.set(opt.value); onClose(); }}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border text-sm font-semibold transition-all active:scale-95',
                  isActive
                    ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300 shadow-lg shadow-indigo-500/10'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'
                )}
              >
                <span className="text-lg">{opt.icon}</span>
                <AlarmClock className={cn('w-4 h-4', isActive ? 'text-indigo-300' : 'text-white/30')} />
                <span className={isActive ? 'text-indigo-200' : ''}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
