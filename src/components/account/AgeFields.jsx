import React from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { REFERRAL_OPTIONS, assessAge, showsGuardianPrompt } from '@/lib/age';

function localIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AgeFields({
  birthDate,
  onBirthDate,
  guardianConsent,
  onGuardianConsent,
  referral = '',
  onReferral,
  showReferral = false,
}) {
  const today = localIso(new Date());
  const earliest = `${new Date().getFullYear() - 120}-01-01`;
  const decision = birthDate ? assessAge(birthDate, { guardianConsent: false }) : null;
  const underage = decision?.code === 'under_13';
  const askGuardian = showsGuardianPrompt(birthDate);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="birthday">Birthday</Label>
        <Input
          id="birthday"
          type="date"
          autoComplete="bday"
          required
          min={earliest}
          max={today}
          value={birthDate}
          onChange={(event) => onBirthDate(event.target.value)}
          className="h-12 rounded-full dark:[color-scheme:dark]"
        />
        <p className={`text-xs ${underage ? 'text-destructive' : 'text-muted-foreground'}`}>
          {underage
            ? 'bharris.app is not for anyone under 13.'
            : 'Used only to check that you are 13 or older. Ages 13–17 need a parent or guardian’s permission.'}
        </p>
      </div>
      {askGuardian && (
        <label className="flex items-start gap-3 rounded-card border border-border bg-card p-3">
          <Checkbox
            checked={guardianConsent}
            onCheckedChange={(value) => onGuardianConsent(value === true)}
            className="mt-0.5 h-5 w-5"
            aria-label="Parent or guardian permission"
          />
          <span className="text-sm leading-snug">
            A parent or legal guardian gives me permission to use bharris.app, and they have gone through the{' '}
            <Link to="/terms" className="font-medium underline underline-offset-4">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="font-medium underline underline-offset-4">Privacy Policy</Link>
            {' '}with me.
          </span>
        </label>
      )}
      {showReferral && (
        <div className="space-y-2">
          <Label htmlFor="referral">How did you hear about us? <span className="font-normal text-muted-foreground">Optional</span></Label>
          <select
            id="referral"
            value={referral}
            onChange={(event) => onReferral?.(event.target.value)}
            className="flex h-12 w-full rounded-full border border-input bg-transparent px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Skip</option>
            {REFERRAL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
