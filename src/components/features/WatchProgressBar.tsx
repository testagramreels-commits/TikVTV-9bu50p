/**
 * Thin progress bar shown at the bottom of a channel card
 * indicating how much of the free 10-minute preview has been consumed.
 */
interface Props {
  percent: number;     // 0–100
  locked:  boolean;
}

export default function WatchProgressBar({ percent, locked }: Props) {
  if (locked) return null;
  if (percent < 1) return null;

  const color =
    percent < 60  ? 'from-green-500 to-emerald-400' :
    percent < 85  ? 'from-yellow-500 to-amber-400'  :
                    'from-red-500 to-orange-500';

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 z-30 pointer-events-none">
      <div
        className={`h-full bg-gradient-to-r ${color} transition-all duration-1000`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
