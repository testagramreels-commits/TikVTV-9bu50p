import { Tv2 } from 'lucide-react';
import { useChromecast, type CastStatus } from '@/lib/chromecast';
import { cn } from '@/lib/utils';
import type { IPTVChannel } from '@/types';

interface Props {
  channel: IPTVChannel;
  className?: string;
}

const statusColors: Record<CastStatus, string> = {
  unavailable: 'hidden',
  idle:        'text-foreground/50 hover:text-white',
  connecting:  'text-yellow-400 animate-pulse',
  connected:   'text-primary',
};

const statusLabels: Record<CastStatus, string> = {
  unavailable: '',
  idle:        'Cast to TV',
  connecting:  'Connecting…',
  connected:   'Casting',
};

export default function CastButton({ channel, className }: Props) {
  const { status, startCasting } = useChromecast(channel.streamUrl, channel.name, channel.logo);

  if (status === 'unavailable') return null;

  return (
    <button
      onClick={startCasting}
      title={statusLabels[status]}
      aria-label={statusLabels[status]}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200',
        'bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60',
        statusColors[status],
        className
      )}
    >
      <Tv2 className={cn('w-4 h-4', status === 'connecting' && 'animate-pulse')} />
      <span className="hidden sm:inline">{statusLabels[status]}</span>
    </button>
  );
}
