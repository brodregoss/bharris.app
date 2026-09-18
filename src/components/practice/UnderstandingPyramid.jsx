import React from 'react';
import { cn } from '@/lib/utils';
import { MASTERY_LEVELS } from '@/lib/mastery';

const FILL = {
  1: 'bg-amber-300 dark:bg-amber-600',
  2: 'bg-amber-400 dark:bg-amber-500',
  3: 'bg-lime-400 dark:bg-lime-600',
  4: 'bg-emerald-500 dark:bg-emerald-600',
};

export default function UnderstandingPyramid({
  level = 0,
  size = 'md',
  showLabels = false,
  className,
}) {
  const tall = size === 'lg';
  const widths = [100, 78, 56, 34];

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {tall && (
        <p
          className={cn(
            'text-[11px] font-bold tracking-wide uppercase mb-1.5',
            level >= 4 ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'
          )}
        >
          Mastered
        </p>
      )}
      <div className="w-full flex flex-col-reverse items-center gap-[3px]">
        {MASTERY_LEVELS.map(({ level: step, label }, i) => {
          const filled = level >= step;
          return (
            <div
              key={step}
              className="flex flex-col items-center"
              style={{ width: `${widths[i]}%` }}
            >
              <div
                className={cn(
                  'w-full rounded-[3px] transition-colors duration-500',
                  tall ? 'h-7' : size === 'sm' ? 'h-1.5' : 'h-2.5',
                  filled ? FILL[step] : 'bg-muted'
                )}
              />
              {showLabels && tall && (
                <span
                  className={cn(
                    'text-[10px] mt-0.5 font-medium',
                    filled ? 'text-foreground' : 'text-muted-foreground/70'
                  )}
                >
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
