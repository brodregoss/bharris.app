import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { ArrowLeft, Moon, Sun, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { clearOpenAIKey, getOpenAIKey, maskOpenAIKey, setOpenAIKey } from '@/lib/openaiKey';
import { hasSharedAi } from '@/api/invokeLlm';

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [ready, setReady] = React.useState(false);
  const [savedKey, setSavedKey] = React.useState('');
  const [draft, setDraft] = React.useState('');
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    setReady(true);
    setSavedKey(getOpenAIKey());
  }, []);

  const dark = ready && (resolvedTheme || theme) === 'dark';

  const saveKey = () => {
    const next = draft.trim();
    if (!next) return;
    setOpenAIKey(next);
    setSavedKey(next);
    setDraft('');
    setStatus('Saved on this device');
  };

  const removeKey = () => {
    clearOpenAIKey();
    setSavedKey('');
    setDraft('');
    setStatus('Removed');
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-1 px-3 pt-safe pb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold tracking-tight">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-safe">
        <div className="max-w-md mx-auto space-y-4">
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

          <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm font-bold tracking-tight">OpenAI API key</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {hasSharedAi()
                    ? 'Optional. This build already includes shared AI, so you and your testers do not need a key.'
                    : 'Optional personal key. For friends, put the key on the server instead (see README) so nobody has to paste it.'}
                </p>
              </div>
            </div>
            {savedKey ? (
              <p className="text-xs font-medium text-foreground">
                Saved: {maskOpenAIKey(savedKey)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Not set yet.</p>
            )}
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveKey();
              }}
              aria-label="OpenAI API key"
            />
            <div className="flex items-center gap-2">
              <Button type="button" className="rounded-2xl" onClick={saveKey} disabled={!draft.trim()}>
                Save
              </Button>
              {savedKey ? (
                <Button type="button" variant="ghost" className="rounded-2xl" onClick={removeKey}>
                  Remove
                </Button>
              ) : null}
            </div>
            {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Moon className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold tracking-tight">Why we ask when you're sleeping</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your brain does real work locking in what you studied <em>while you sleep</em> — this is called
              memory consolidation. Cramming more new material in the last 30–45 minutes before bed usually
              doesn't help, and can even cost you sleep that would have helped more. So once you're close to
              your stop time, we stop introducing new material and just help you review what's already shaky.
              You're always free to keep going — we just won't push new stuff on you that late.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
