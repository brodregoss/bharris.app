import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIER_BORDER = {
  blank: 'border-l-rose-400',
  shaky: 'border-l-amber-400',
  know_it: 'border-l-emerald-400',
};

export default function TriageCard({ item, tier, index }) {
  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => {
        const baseStyle = provided.draggableProps.style || {};
        const draggingBox = snapshot.isDragging
          ? {
              height: 'auto',
              width: 'auto',
              minWidth: Math.max(parseFloat(baseStyle.width) || 0, 168),
              maxWidth: 'min(22rem, calc(100vw - 1.5rem))',
              overflow: 'visible',
              zIndex: 10000,
            }
          : {};

        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={{ ...baseStyle, ...draggingBox }}
            className={cn(
              'rounded-lg border-l-4 bg-card p-2.5 shadow-sm flex items-start justify-between gap-2 select-none touch-none',
              snapshot.isDragging
                ? 'shadow-xl ring-2 ring-ring/40 p-3'
                : 'min-w-0 w-full overflow-hidden',
              TIER_BORDER[tier]
            )}
          >
            <p
              className={cn(
                'text-sm font-semibold leading-snug text-card-foreground',
                snapshot.isDragging
                  ? 'whitespace-normal break-words'
                  : 'min-w-0 line-clamp-2 break-words'
              )}
            >
              {item.term}
            </p>
            <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
          </div>
        );
      }}
    </Draggable>
  );
}
