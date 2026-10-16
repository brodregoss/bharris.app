import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Lock, AlertTriangle, User } from 'lucide-react';

export default function AiConsentModal({ open, onAccept, onDecline }) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">Do you want to use AI?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            Your notes will be shared with OpenAI to extract terms and generate study materials.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Shared with OpenAI</p>
              <p className="text-xs text-muted-foreground">
                Text and photos you share are sent to OpenAI to generate responses.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Avoid sharing sensitive information</p>
              <p className="text-xs text-muted-foreground">
                Don't upload personal, private, or confidential content.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Double-check information</p>
              <p className="text-xs text-muted-foreground">
                AI-generated answers may not always be correct.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Age requirement</p>
              <p className="text-xs text-muted-foreground">
                You must be 18 or older, or 13–17 with parental permission.
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-row gap-3 sm:gap-3">
          <Button variant="outline" onClick={onDecline} className="flex-1">
            Decline
          </Button>
          <Button onClick={onAccept} className="flex-1">
            Yes, use AI
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
