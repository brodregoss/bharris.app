import React from 'react';

// Size an element to the space between its top and the bottom of the screen,
// leaving room for a footer that follows it. Keeps the action button in view.
export default function useFillBelow(enabled) {
  const ref = React.useRef(null);
  const [height, setHeight] = React.useState(null);

  React.useLayoutEffect(() => {
    if (!enabled) {
      setHeight(null);
      return undefined;
    }
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      const top = el.getBoundingClientRect().top;
      let reserve = 0;
      let node = el.parentElement;
      while (node) {
        let sib = node.nextElementSibling;
        while (sib) {
          if (sib.tagName === 'FOOTER') {
            reserve = Math.max(reserve, sib.getBoundingClientRect().height);
          }
          sib = sib.nextElementSibling;
        }
        node = node.parentElement;
      }
      const next = Math.max(240, Math.floor(window.innerHeight - top - reserve));
      setHeight((prev) => (prev != null && Math.abs(prev - next) < 2 ? prev : next));
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      ro?.disconnect();
    };
  }, [enabled]);

  return {
    ref,
    style: height ? { height, maxHeight: height } : undefined,
  };
}
