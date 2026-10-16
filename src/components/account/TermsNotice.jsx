import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsNotice({ action }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground text-left">
      By {action}, you agree to our{' '}
      <Link to="/terms" className="font-medium text-foreground underline underline-offset-4">
        Terms of Service
      </Link>
      {' '}and{' '}
      <Link to="/privacy" className="font-medium text-foreground underline underline-offset-4">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
