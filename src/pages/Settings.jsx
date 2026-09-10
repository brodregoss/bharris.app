import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  ArrowLeft,
  Moon,
  Sun,
  User,
  Info,
  Shield,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  APP_NAME,
  APP_VERSION,
  ABOUT_SECTIONS,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
} from '@/lib/legal';

const DOCS = {
  about: {
    title: 'About',
    description: `${APP_NAME} ${APP_VERSION}`,
    sections: ABOUT_SECTIONS,
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How this app handles your notes and data.',
    sections: PRIVACY_SECTIONS,
  },
  terms: {
    title: 'Terms of Service',
    description: 'The rules for using Last Minute Study.',
    sections: TERMS_SECTIONS,
  },
};

function Row({ icon: Icon, label, value, onClick }) {
  const inner = (
    <>
      {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
      <span className="flex-1 text-sm font-semibold text-left">{label}</span>
      {value && (
        <span className="text-sm text-muted-foreground shrink-0">{value}</span>
      )}
      {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-accent/60 transition text-left"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="w-full flex items-center gap-3 px-5 py-3.5">
      {inner}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [ready, setReady] = React.useState(false);
  const [doc, setDoc] = React.useState(null);

  React.useEffect(() => {
    setReady(true);
  }, []);

  const dark = ready && (resolvedTheme || theme) === 'dark';
  const open = DOCS[doc];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-1 px-3 pt-safe pb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold tracking-tight">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-24 flex flex-col">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col gap-4">
          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 p-5">
              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-tight">Not signed in</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No account needed. Notes and sessions stay on this device.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                {dark ? (
                  <Moon className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <Sun className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <Label htmlFor="dark-mode" className="text-sm font-bold tracking-tight">
                    Dark mode
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dark ? 'On — easier on the eyes at night' : 'Off — light background'}
                  </p>
                </div>
              </div>
              <Switch
                id="dark-mode"
                checked={dark}
                onCheckedChange={(on) => setTheme(on ? 'dark' : 'light')}
                disabled={!ready}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            <Row label="Version" value={APP_VERSION} />
            <Row icon={Info} label="About" onClick={() => setDoc('about')} />
            <Row icon={Shield} label="Privacy Policy" onClick={() => setDoc('privacy')} />
            <Row icon={FileText} label="Terms of Service" onClick={() => setDoc('terms')} />
          </section>

          <p className="mt-auto pt-8 text-center text-xs font-bold text-muted-foreground">
            Honorable Mention – Room 91B
          </p>
        </div>
      </div>

      <Sheet open={!!doc} onOpenChange={(on) => { if (!on) setDoc(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85dvh] overflow-y-auto">
          {open && (
            <>
              <SheetHeader className="text-left pr-10">
                <SheetTitle>{open.title}</SheetTitle>
                <SheetDescription>{open.description}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 pt-4 pb-6">
                {open.sections.map((s) => (
                  <div key={s.title}>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
