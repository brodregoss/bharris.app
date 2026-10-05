import React from 'react';

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

export const EdgeClaimContext = React.createContext(null);

export function useEdgeClaim(active) {
  const api = React.useContext(EdgeClaimContext);
  React.useLayoutEffect(() => {
    if (!active || !api) return undefined;
    return api.register();
  }, [active, api]);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isTextField(target) {
  return !!target?.closest?.('input, textarea, select, [contenteditable="true"]');
}

export function paintSheet(sheet, x, animateMs) {
  if (!sheet) return;
  sheet.style.transition = animateMs ? `transform ${animateMs}ms ${EASE}` : 'none';
  sheet.style.transform = `translate3d(${x}px, 0, 0)`;
  sheet.style.boxShadow = x > 0 ? '-24px 0 48px hsl(0 0% 0% / 0.16)' : '';
}

export function clearSheet(sheet) {
  if (!sheet) return;
  sheet.style.animation = '';
  sheet.style.transition = '';
  sheet.style.transform = '';
  sheet.style.boxShadow = '';
  sheet.style.touchAction = '';
}

function sheetOffset(sheet) {
  if (!sheet) return 0;
  const transform = window.getComputedStyle(sheet).transform;
  if (!transform || transform === 'none') return 0;
  const parts = transform.match(/[-0-9.]+/g)?.map(Number) || [];
  const x = parts.length === 6 ? parts[4] : parts[12];
  return Number.isFinite(x) ? x : 0;
}

/** Stop a CSS slide and keep the sheet where it is painted right now. */
function holdSheet(sheet) {
  const x = Math.max(0, sheetOffset(sheet));
  if (!sheet) return x;
  sheet.style.animation = 'none';
  sheet.classList.remove('page-slide-over', 'page-slide-away');
  paintSheet(sheet, x, 0);
  return x;
}

export function useEdgeSwipe({ enabled, sheetRef, onCommit, onGrab }) {
  const dragRef = React.useRef(null);
  const settleRef = React.useRef(null);
  const settleTimer = React.useRef(0);
  const activeRef = React.useRef(false);
  const onCommitRef = React.useRef(onCommit);
  const onGrabRef = React.useRef(onGrab);
  onCommitRef.current = onCommit;
  onGrabRef.current = onGrab;

  const cancel = React.useCallback(() => {
    dragRef.current?.stop?.();
    dragRef.current = null;
    settleRef.current = null;
    activeRef.current = false;
    window.clearTimeout(settleTimer.current);
    clearSheet(sheetRef.current);
    document.documentElement.classList.remove('page-transitioning');
  }, [sheetRef]);

  const onPointerDown = (event) => {
    if (!enabled || settleRef.current || dragRef.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (isTextField(event.target)) return;
    if (event.clientX > window.innerWidth / 2) return;

    const sheet = sheetRef.current;
    const drag = {
      id: event.pointerId,
      touch: event.pointerType === 'touch',
      x: event.clientX,
      y: event.clientY,
      base: 0,
      offset: 0,
      axis: null,
      done: false,
    };

    const stopListening = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchmove', onTouchMove, true);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
    drag.stop = stopListening;
    dragRef.current = drag;

    const follow = (clientX, clientY) => {
      if (drag.done || settleRef.current) return;
      const dx = clientX - drag.x;
      const dy = clientY - drag.y;
      if (!drag.axis) {
        if (Math.hypot(dx, dy) < 8) return;
        if (!(dx > 0 && dx >= Math.abs(dy))) {
          drag.done = true;
          dragRef.current = null;
          stopListening();
          return;
        }
        drag.axis = 'x';
        activeRef.current = true;
        const grabbed = holdSheet(sheet);
        drag.base = grabbed - dx;
        onGrabRef.current?.();
        document.documentElement.classList.add('page-transitioning');
      }
      const x = Math.max(0, Math.min(window.innerWidth, drag.base + dx));
      drag.offset = x;
      paintSheet(sheet, x, 0);
    };

    const finish = () => {
      if (drag.done) return;
      drag.done = true;
      const moved = drag.axis === 'x';
      const x = drag.offset;
      dragRef.current = null;
      stopListening();
      if (!moved) return;

      const blockClick = (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        window.removeEventListener('click', blockClick, true);
      };
      window.addEventListener('click', blockClick, true);
      window.setTimeout(() => window.removeEventListener('click', blockClick, true), 400);

      const width = window.innerWidth;
      const commit = x >= width * 0.2;
      const distance = commit ? width - x : x;
      const ms = prefersReducedMotion()
        ? 0
        : Math.round(Math.min(260, Math.max(110, (distance / width) * 260)));

      if (sheet) void sheet.offsetWidth;
      if (!commit) {
        settleRef.current = 'cancel';
        paintSheet(sheet, 0, ms);
        settleTimer.current = window.setTimeout(() => {
          if (settleRef.current !== 'cancel') return;
          settleRef.current = null;
          activeRef.current = false;
          clearSheet(sheet);
          document.documentElement.classList.remove('page-transitioning');
        }, ms + 40);
        return;
      }

      settleRef.current = 'commit';
      paintSheet(sheet, width, ms);
      settleTimer.current = window.setTimeout(() => {
        if (settleRef.current !== 'commit') return;
        settleRef.current = null;
        activeRef.current = false;
        onCommitRef.current?.();
      }, ms + 30);
    };

    const onPointerMove = (moveEvent) => {
      if (drag.touch || moveEvent.pointerId !== drag.id) return;
      follow(moveEvent.clientX, moveEvent.clientY);
    };

    const onPointerUp = (upEvent) => {
      if (drag.touch || upEvent.pointerId !== drag.id) return;
      finish();
    };

    const onTouchMove = (touchEvent) => {
      const touch = touchEvent.touches[0];
      if (!touch) return;
      const dx = touch.clientX - drag.x;
      const dragging = drag.axis === 'x' || (dx > 8 && dx >= Math.abs(touch.clientY - drag.y));
      if (dragging && touchEvent.cancelable) touchEvent.preventDefault();
      follow(touch.clientX, touch.clientY);
    };

    const onTouchEnd = (touchEvent) => {
      if (!drag.touch) return;
      const stillHeld = Array.from(touchEvent.touches).some((touch) => touch.identifier === drag.id);
      if (stillHeld) return;
      finish();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
  };

  return { onPointerDown, cancel, activeRef };
}
