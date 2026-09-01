import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIER_BORDER = {
  blank: 'border-l-rose-400',
  shaky: 'border-l-amber-400',
  know_it: 'border-l-emerald-400',
};

export default function TriageCard({ item, tier, index, expanded = false, maxWidth }) {
  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => {
        const open = expanded || snapshot.isDragging;
        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={{
              ...provided.draggableProps.style,
              ...(open
                ? {
                    width: maxWidth || undefined,
                    maxWidth: maxWidth || '11rem',
                    minWidth: 0,
                    boxSizing: 'border-box',
                  }
                : null),
            }}
            className={cn(
              'rounded-lg border-l-4 bg-card shadow-sm select-none touch-none',
              open
                ? 'shadow-xl ring-2 ring-ring/40 px-3 py-2.5 mx-auto'
                : 'w-full min-w-0 overflow-hidden p-2.5 flex items-start justify-between gap-2',
              TIER_BORDER[tier]
            )}
          >
            <p
              className={cn(
                'text-sm font-semibold leading-snug text-card-foreground',
                open
                  ? 'whitespace-normal break-words text-center'
                  : 'min-w-0 line-clamp-2 break-words'
              )}
            >
              {item.term}
            </p>
            {!open && (
              <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
            )}
          </div>
        );
      }}
    </Draggable>
  );
}
