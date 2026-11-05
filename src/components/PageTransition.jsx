import React from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';
import { EdgeClaimContext, useEdgeSwipe } from '@/components/edgeSwipe';

const SLIDE_MS = 320;
const SWIPE_PAGES = new Set(['/settings', '/practice', '/panic', '/history']);
const HOME_LOCATION = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'under-home',
};

let skipNextTransition = false;
let forceSlide = false;

export const PAGE_SLIDE_MS = SLIDE_MS;

export function armPageSlide() {
  forceSlide = true;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function slidesOn() {
  return Capacitor.isNativePlatform();
}

function isAncestor(from, to) {
  if (to === '/') return from !== '/';
  return from.startsWith(`${to}/`);
}

/** 1 = forward, -1 = back, 0 = a replace such as a redirect. */
function rememberDirection(stack, from, to, navType) {
  if (from === to) return 0;
  if (navType === 'REPLACE') {
    stack[stack.length - 1] = to;
    return 0;
  }
  const previous = stack[stack.length - 2];
  const goingBack = navType === 'POP' || previous === to || isAncestor(from, to);
  if (goingBack) {
    while (stack.length > 1 && stack[stack.length - 1] !== to) stack.pop();
    if (stack[stack.length - 1] !== to) stack[stack.length - 1] = to;
    return -1;
  }
  stack.push(to);
  return 1;
}

export default function PageTransition({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const navType = useNavigationType();
  const currentKey = React.useRef(location.key);
  const stackRef = React.useRef([location.pathname]);
  const openingRef = React.useRef(true);
  const sheetRef = React.useRef(null);
  const claims = React.useRef(0);
  const claimApi = React.useMemo(() => ({
    claimed: () => claims.current > 0,
    register: () => {
      claims.current += 1;
      return () => {
        claims.current -= 1;
      };
    },
  }), []);
  const [pages, setPages] = React.useState(() => [
    { id: location.key, location, role: 'current', className: '' },
  ]);
  const pagesRef = React.useRef(pages);
  pagesRef.current = pages;

  const swipeable = slidesOn()
    && SWIPE_PAGES.has(location.pathname)
    && pages.some((page) => page.role === 'under')
    && !pages.some((page) => page.role === 'leaving');

  const swipe = useEdgeSwipe({
    enabled: swipeable,
    sheetRef,
    onGrab: () => {
      setPages((prev) => {
        if (!prev.some((page) => page.role === 'current' && page.className)) return prev;
        return prev.map((page) => (
          page.role === 'current' ? { ...page, className: '' } : page
        ));
      });
    },
    onCommit: () => {
      skipNextTransition = true;
      if (stackRef.current.length > 1) navigate(-1);
      else navigate(pagesRef.current.find((page) => page.role === 'under')?.location?.pathname || '/');
    },
  });
  const cancelSwipe = React.useRef(swipe.cancel);
  cancelSwipe.current = swipe.cancel;

  React.useLayoutEffect(() => {
    if (!slidesOn() || !SWIPE_PAGES.has(location.pathname)) return;
    setPages((prev) => {
      if (prev.some((page) => page.role === 'under' || page.role === 'leaving')) return prev;
      if (prev.some((page) => page.location.pathname === '/')) return prev;
      return [
        { id: 'under-home', location: HOME_LOCATION, role: 'under', className: '' },
        ...prev,
      ];
    });
  }, [location.pathname]);

  React.useLayoutEffect(() => {
    if (location.key === currentKey.current) return;

    const prevPages = pagesRef.current;
    const current = prevPages.find((page) => page.role === 'current') || prevPages[prevPages.length - 1];
    const under = prevPages.find((page) => page.role === 'under');
    rememberDirection(stackRef.current, current?.location.pathname, location.pathname, navType);
    currentKey.current = location.key;
    cancelSwipe.current();

    const showDestination = () => {
      setPages((prev) => {
        const parked = prev.find((page) => page.role === 'under' && page.location.pathname === location.pathname)
          || (under && under.location.pathname === location.pathname ? under : null);
        if (parked) return [{ ...parked, role: 'current', className: '' }];
        return [{ id: location.key, location, role: 'current', className: '' }];
      });
    };

    const opening = openingRef.current && navType === 'REPLACE';
    const forced = forceSlide;
    forceSlide = false;
    if (navType !== 'REPLACE') openingRef.current = false;
    if ((!slidesOn() && !forced) || opening || skipNextTransition || prefersReducedMotion()) {
      skipNextTransition = false;
      showDestination();
      if (navType !== 'POP') window.scrollTo(0, 0);
      return;
    }

    document.documentElement.classList.add('page-transitioning');
    if (navType !== 'POP') window.scrollTo(0, 0);

    let timer = 0;
    if (under && under.location.pathname === location.pathname) {
      setPages([
        under,
        { ...current, role: 'leaving', className: 'page-slide-away' },
      ]);
      timer = window.setTimeout(() => {
        setPages([{ ...under, role: 'current', className: '' }]);
        if (!swipe.activeRef.current) document.documentElement.classList.remove('page-transitioning');
      }, SLIDE_MS + 40);
    } else {
      setPages([
        { ...current, role: 'under', className: '' },
        { id: location.key, location, role: 'current', className: 'page-slide-over' },
      ]);
      timer = window.setTimeout(() => {
        setPages((prev) => prev.map((page) => (
          page.role === 'current' ? { ...page, className: '' } : page
        )));
        if (!swipe.activeRef.current) document.documentElement.classList.remove('page-transitioning');
      }, SLIDE_MS + 40);
    }

    return () => {
      window.clearTimeout(timer);
      document.documentElement.classList.remove('page-transitioning');
    };
  }, [location, navType]);

  const onPointerDown = (event) => {
    if (claimApi.claimed()) return;
    swipe.onPointerDown(event);
  };

  return (
    <EdgeClaimContext.Provider value={claimApi}>
    <div className="relative min-h-[100dvh]">
      {pages.map((page) => (
        <div
          key={page.id}
          ref={page.role === 'current' ? sheetRef : undefined}
          className={cn(
            'bg-background',
            page.role === 'under' && 'fixed inset-0 z-20 overflow-hidden pointer-events-none',
            page.role === 'current' && 'relative z-30 min-h-[100dvh] touch-pan-y',
            page.role === 'leaving' && 'fixed inset-0 z-40 overflow-hidden pointer-events-none',
            page.className
          )}
          onPointerDownCapture={page.role === 'current' ? onPointerDown : undefined}
          aria-hidden={page.role === 'current' ? undefined : true}
        >
          {children(page.location)}
        </div>
      ))}
    </div>
    </EdgeClaimContext.Provider>
  );
}
