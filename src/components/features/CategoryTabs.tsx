import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CATEGORIES } from '@/constants/categories';

interface Props {
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  channelCounts?: Record<string, number>;
}

export default function CategoryTabs({ activeCategory, onCategoryChange, channelCounts }: Props) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const activeRef  = useRef<HTMLButtonElement>(null);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategory]);

  return (
    <div className="flex-none border-b border-white/5 bg-black/90 backdrop-blur-sm">
      <div
        ref={scrollRef}
        className="flex gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-none"
      >
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.id;
          const count    = channelCounts?.[cat.id];

          return (
            <button
              key={cat.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onCategoryChange(cat.id)}
              className={cn(
                'relative flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap active:scale-95',
                isActive
                  ? 'bg-primary text-white shadow-[0_0_16px_rgba(254,44,85,0.5)] scale-105'
                  : 'bg-white/8 text-white/60 hover:bg-white/15 hover:text-white border border-white/10'
              )}
            >
              <span className="text-sm leading-none">{cat.emoji}</span>
              <span>{cat.label}</span>
              {/* Live channel count badge */}
              {count !== undefined && count > 0 && (
                <span className={cn(
                  'text-[9px] font-bold px-1 py-0.5 rounded-full leading-none min-w-[14px] text-center',
                  isActive
                    ? 'bg-white/25 text-white'
                    : 'bg-white/12 text-white/50'
                )}>
                  {count > 999 ? '999+' : count}
                </span>
              )}
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
