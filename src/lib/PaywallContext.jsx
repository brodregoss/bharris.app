import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import PaywallSheet from '@/components/account/PaywallSheet';
import { logProductEvent } from '@/lib/productEvents';

const PaywallContext = createContext(null);

export function PaywallProvider({ children }) {
  const [open, setOpen] = useState(false);
  const wasOpen = React.useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) logProductEvent('pass_shown', { feature: 'plans' });
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('lms:paywall', onOpen);
    return () => window.removeEventListener('lms:paywall', onOpen);
  }, []);

  const value = useMemo(
    () => ({
      openPaywall: () => setOpen(true),
      closePaywall: () => setOpen(false),
    }),
    [],
  );

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <PaywallSheet open={open} onOpenChange={setOpen} />
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  const ctx = useContext(PaywallContext);
  return ctx || { openPaywall: () => window.dispatchEvent(new CustomEvent('lms:paywall')), closePaywall: () => {} };
}
