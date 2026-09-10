import React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export const LIMIT_PRESETS = [1, 3, 5, 10];

export default function LimitPicker({
  value,
  unlimited,
  onChange,
  onUnlimited,
}) {
  const presetMatch = !unlimited && LIMIT_PRESETS.includes(Number(value));
  const [custom, setCustom] = React.useState(
    presetMatch || unlimited || value == null ? '' : String(value),
  );

  const pickPreset = (amount) => {
    setCustom('');
    onChange(amount);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {LIMIT_PRESETS.map((amount) => {
          const selected = !unlimited && Number(value) === amount;
          return (
            <button
              key={amount}
              type="button"
              onClick={() => pickPreset(amount)}
              className={cn(
                'h-14 rounded-2xl border text-sm font-bold transition',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card hover:bg-accent',
              )}
            >
              ${amount}
            </button>
          );
        })}
      </div>
      <div className="space-y-2">
        <label htmlFor="custom-limit" className="text-sm font-medium">
          Or a custom monthly cap
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
          <Input
            id="custom-limit"
            type="number"
            min="0.5"
            max="100"
            step="0.5"
            inputMode="decimal"
            placeholder="e.g. 2.50"
            value={custom}
            onChange={(e) => {
              const next = e.target.value;
              setCustom(next);
              const amount = Number(next);
              if (Number.isFinite(amount) && amount > 0) onChange(amount);
            }}
            className="h-12 rounded-2xl pl-8"
          />
        </div>
      </div>
      {onUnlimited && (
        <button
          type="button"
          onClick={onUnlimited}
          className={cn(
            'text-sm underline-offset-4 hover:underline self-start',
            unlimited ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {unlimited ? 'No monthly cap — tap a dollar amount to add one' : 'No monthly cap'}
        </button>
      )}
    </div>
  );
}
