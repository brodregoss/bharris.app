import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LegalSections, { LegalText } from '@/components/account/LegalSections';
import {
  LEGAL_UPDATED,
  PRIVACY_LEAD,
  PRIVACY_SECTIONS,
  TERMS_LEAD,
  TERMS_SECTIONS,
} from '@/lib/legal';

const PAGES = {
  terms: {
    title: 'Terms of Service',
    lead: TERMS_LEAD,
    sections: TERMS_SECTIONS,
  },
  privacy: {
    title: 'Privacy Policy',
    lead: PRIVACY_LEAD,
    sections: PRIVACY_SECTIONS,
  },
};

export default function LegalDocument({ doc }) {
  const navigate = useNavigate();
  const page = PAGES[doc];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-1 px-3 pt-safe pb-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate('/account');
          }}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="min-w-0 truncate text-base font-bold tracking-tight">{page.title}</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-16">
        <div className="max-w-md mx-auto w-full space-y-4">
          <p className="text-xs text-muted-foreground">Effective {LEGAL_UPDATED}</p>
          {page.lead.map((line) => (
            <p key={line} className="text-sm text-muted-foreground leading-relaxed">
              <LegalText text={line} />
            </p>
          ))}
          <p className="text-xs text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
          <LegalSections sections={page.sections} />
        </div>
      </div>
    </div>
  );
}
