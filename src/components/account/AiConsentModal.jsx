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
      <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">Do you want to use AI?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            When you use AI-powered study features, the text, notes, answers, or photos needed for
            that feature are sent to our servers and may be sent to OpenAI for processing.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Shared with OpenAI</p>
              <p className="text-xs text-muted-foreground">
                We use OpenAI to generate study materials, explanations, practice questions, and
                answer feedback. Original photos are not permanently stored; extracted text may be
                saved in your account.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Protect your privacy</p>
              <p className="text-xs text-muted-foreground">
                Do not submit passwords, private records, or sensitive information that is
                unnecessary for studying.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Check AI answers</p>
              <p className="text-xs text-muted-foreground">
                AI-generated content may be inaccurate. Verify important information against
                reliable course materials.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Age and permission</p>
              <p className="text-xs text-muted-foreground">
                You must be at least 13 to use the Service. If you are 13–17, you must have
                permission from a parent or legal guardian.
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          If you decline, AI features will not be available, although sample material may remain
          available. You can withdraw consent for future processing by contacting bharris.app@gmail.com.
        </p>

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
