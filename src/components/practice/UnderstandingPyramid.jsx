import React from 'react';
import { cn } from '@/lib/utils';
import { MASTERY_LEVELS } from '@/lib/mastery';

const FILL = {
  1: 'bg-blank/40',
  2: 'bg-shaky',
  3: 'bg-know/70',
  4: 'bg-know',
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
            'mb-2 text-label uppercase',
            level >= 4 ? 'text-know' : 'text-muted-foreground'
          )}
        >
          Mastered
        </p>
      )}
      <div className="flex w-full flex-col-reverse items-center gap-1">
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
