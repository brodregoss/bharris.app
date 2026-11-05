import React from 'react';
import { Link } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { usePaywall } from '@/lib/PaywallContext';

export default function TermsAgreement({ checked, onCheckedChange, id = 'agree-terms' }) {
  const { closePaywall } = usePaywall();

  return (
    <div className="flex items-start gap-3 text-left">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <label htmlFor={id} className="text-sm leading-relaxed text-muted-foreground">
        I agree to the{' '}
        <Link to="/terms" onClick={closePaywall} className="font-medium text-foreground underline underline-offset-4">
          Terms of Service
        </Link>
        {' '}and{' '}
        <Link to="/privacy" onClick={closePaywall} className="font-medium text-foreground underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </label>
    </div>
  );
}
