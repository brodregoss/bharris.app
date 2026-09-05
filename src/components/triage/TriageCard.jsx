import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIER_BORDER = {
  blank: 'border-l-rose-400',
  shaky: 'border-l-amber-400',
  know_it: 'border-l-emerald-400',
};

function columnAtPoint(clientX, clientY) {
  const cols = document.querySelectorAll('[data-triage-col]');
  for (const col of cols) {
    const r = col.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
      return col.getAttribute('data-triage-col');
    }
  }
  return null;
}

function CardFace({ item, tier, dragging, className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-lg border-l-4 bg-card p-2.5 shadow-sm flex items-center justify-between gap-2 select-none',
        TIER_BORDER[tier],
        dragging && 'shadow-xl ring-2 ring-ring/40',
        className
      )}
      {...props}
    >
      <p
        className={cn(
          'text-sm font-semibold leading-tight text-card-foreground',
          dragging ? 'whitespace-normal' : 'line-clamp-2'
        )}
      >
        {item.term}
      </p>
      <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0 pointer-events-none" />
    </div>
  );
}

export default function TriageCard({ item, tier, animationDelay, onMove, onDragOver }) {
  const [dragging, setDragging] = React.useState(false);
  const dragRef = React.useRef(null);
  const ghostRef = React.useRef(null);

  const clearDrag = React.useCallback(() => {
    dragRef.current = null;
    onDragOver(null);
    setDragging(false);
  }, [onDragOver]);

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      w: rect.width,
      x: rect.left,
      y: rect.top,
    };
    setDragging(true);
    onDragOver(tier);
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    drag.x = e.clientX - drag.offsetX;
    drag.y = e.clientY - drag.offsetY;
    if (ghostRef.current) {
      ghostRef.current.style.left = `${drag.x}px`;
      ghostRef.current.style.top = `${drag.y}px`;
    }
    onDragOver(columnAtPoint(e.clientX, e.clientY));
  };

  const onPointerUp = (e) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dest = columnAtPoint(e.clientX, e.clientY);
    if (dest && dest !== tier) onMove(item.id, dest);
    clearDrag();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.94 }}
        animate={{ opacity: dragging ? 0.35 : 1, y: 0, scale: 1 }}
        transition={{ delay: dragging ? 0 : animationDelay, duration: dragging ? 0 : 0.35, ease: 'easeOut' }}
        className="w-full"
      >
        <CardFace
          item={item}
          tier={tier}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={clearDrag}
          className="w-full cursor-grab active:cursor-grabbing touch-none"
        />
      </motion.div>
      {dragging && dragRef.current &&
        createPortal(
          <div
            ref={ghostRef}
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: dragRef.current.x,
              top: dragRef.current.y,
              width: dragRef.current.w,
              transform: 'scale(1.04)',
            }}
          >
            <CardFace item={item} tier={tier} dragging />
          </div>,
          document.body
        )}
    </>
  );
}
