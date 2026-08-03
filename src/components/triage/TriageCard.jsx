import React from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIER_BORDER = {
  blank: 'border-l-rose-400',
  shaky: 'border-l-amber-400',
  know_it: 'border-l-emerald-400',
};

export default function TriageCard({ item, tier, index, animationDelay }) {
  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => {
        const card = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={cn(
              'group rounded-lg border-l-4 bg-card p-2.5 shadow-sm flex items-center justify-between gap-2 select-none transition-shadow',
              snapshot.isDragging ? 'w-72 max-w-[80vw]' : 'w-full',
              TIER_BORDER[tier],
              snapshot.isDragging && 'shadow-xl ring-2 ring-ring/40 z-[9999]'
            )}
          >
            <p
              className={cn(
                'text-sm font-semibold leading-tight text-card-foreground',
                snapshot.isDragging ? 'line-clamp-none whitespace-normal' : 'line-clamp-2'
              )}
            >
              {item.term}
            </p>
            <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0 cursor-grab" />
          </div>
        );
        return (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: animationDelay, duration: 0.35, ease: 'easeOut' }}
            className="w-full"
          >
            {snapshot.isDragging ? createPortal(card, document.body) : card}
          </motion.div>
        );
      }}
    </Draggable>
  );
}