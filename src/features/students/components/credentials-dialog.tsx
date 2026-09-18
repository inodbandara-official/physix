'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { issueCredentialsAction } from '@/features/students/actions';
import type { CredentialResult } from '@/features/students/types';
import { useActionForm } from '@/lib/use-action-form';

interface CredentialsDialogProps {
  student: {
    id: string;
    full_name: string;
    username: string;
    email: string | null;
    loginEmail: string | null;
    hasAccount: boolean;
  } | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shows a generated password exactly once. It is not stored anywhere in our
 * tables, so if the teacher closes this dialog without copying it, the only
 * remedy is another reset — which is the intended behaviour.
 */
export function CredentialsDialog({ student, onOpenChange }: CredentialsDialogProps) {
  // The dialog renders the credentials itself, so no success toast is shown.
  const { state, formAction } = useActionForm(issueCredentialsAction, { toastOnSuccess: false });

  const credentials = state.status === 'success' ? state.data : undefined;

  return (
    <Dialog open={student !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {student?.hasAccount ? 'Reset password' : 'Create login account'}
          </DialogTitle>
          <DialogDescription>
            {student?.hasAccount
              ? `A new password will be generated for ${student?.full_name}. The old one stops working immediately.`
              : `${student?.full_name} will be able to sign in with the username below.`}
          </DialogDescription>
        </DialogHeader>

        {credentials ? (
          <CredentialsReadout credentials={credentials} />
        ) : (
          <form action={formAction} className="space-y-4">
            <FormAlert state={state} />
            <input type="hidden" name="student_id" value={student?.id ?? ''} />

            <div className="space-y-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <p>
                Signs in as{' '}
                <span className="font-mono font-medium">
                  {student?.loginEmail ?? student?.email ?? student?.username}
                </span>
              </p>
              {student?.email ? (
                <p className="text-xs text-muted-foreground">
                  Their own address, so they can reset this password themselves later.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No email on file, so they sign in by username — and only you can reset their password.
                  Add an email to their record to change that.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <SubmitButton pendingLabel="Generating…">
                {student?.hasAccount ? 'Generate new password' : 'Create account'}
              </SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CredentialsReadout({ credentials }: { credentials: CredentialResult }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const text = `Username: ${credentials.username}\nPassword: ${credentials.password}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border bg-muted/50 p-4 font-mono text-sm">
        <p>
          <span className="text-muted-foreground">Sign in as </span>
          {credentials.loginEmail}
        </p>
        <p>
          <span className="text-muted-foreground">Password </span>
          {credentials.password}
        </p>
      </div>
      <p className="text-xs text-pretty text-muted-foreground">
        Copy this now — it is not stored and cannot be shown again. Ask the student to change it after
        their first sign-in.
        {credentials.usesOwnEmail
          ? ' If they forget it, they can reset it themselves from the sign-in page.'
          : ' They have no email address, so only you can reset it for them.'}
      </p>
      <DialogFooter>
        <Button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy credentials'}
        </Button>
      </DialogFooter>
    </div>
  );
}
