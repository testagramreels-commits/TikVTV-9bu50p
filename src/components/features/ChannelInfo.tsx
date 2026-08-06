import { cn, getCountryFlag, categoryColor } from '@/lib/utils';
import type { IPTVChannel } from '@/types';
import { Globe } from 'lucide-react';

interface Props {
  channel: IPTVChannel;
}

export default function ChannelInfo({ channel }: Props) {
  const primaryCat = channel.categories[0] || 'general';
  const flag       = getCountryFlag(channel.countryCode);

  return (
    <div className="space-y-2 max-w-[72vw]">
      {/* Channel name */}
      <h2 className="text-white font-bold text-lg leading-tight text-shadow line-clamp-1">
        {channel.name}
      </h2>

      {/* Country + language */}
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">{flag}</span>
        <span className="text-white/80 text-sm text-shadow-sm">
          {channel.country || 'Global'}
        </span>
        {channel.languages[0] && (
          <span className="text-white/50 text-xs uppercase tracking-wide">
            · {channel.languages[0]}
          </span>
        )}
      </div>

      {/* Categories */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {channel.categories.slice(0, 3).map(cat => (
          <span
            key={cat}
            className={cn(
              'text-white text-[11px] font-semibold px-2 py-0.5 rounded-full',
              categoryColor(cat)
            )}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </span>
        ))}
      </div>

      {/* Network */}
      {channel.network && (
        <div className="flex items-center gap-1 text-white/50 text-xs">
          <Globe className="w-3 h-3" />
          <span className="line-clamp-1">{channel.network}</span>
        </div>
      )}
    </div>
  );
}
