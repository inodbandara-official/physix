'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { setNewPasswordAction } from '@/features/auth/actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useActionForm } from '@/lib/use-action-form';

type LinkState = 'checking' | 'ready' | 'invalid';

export function ResetPasswordForm() {
  const [linkState, setLinkState] = useState<LinkState>('checking');
  const { state, formAction } = useActionForm(setNewPasswordAction, { toastOnSuccess: false });
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // The recovery token arrives in the URL and is exchanged for a session by
    // the browser client. Subscribing first avoids racing that exchange.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setLinkState('ready');
    });

    supabase.auth.getSession().then(({ data }) => {
      setLinkState(data.session ? 'ready' : 'invalid');
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  if (linkState === 'checking') {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Checking your link…
        </CardContent>
      </Card>
    );
  }

  if (linkState === 'invalid') {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Alert variant="destructive">
            <AlertDescription>
              This reset link has expired or has already been used. Reset links last one hour.
            </AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state.status === 'success') {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <FormAlert state={state} />
          <Button asChild className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4" noValidate>
          <FormAlert state={state} />

          <Field
            name="new_password"
            label="New password"
            hint="At least 8 characters."
            errors={fieldErrors?.new_password}
            required
          >
            <Input id="new_password" name="new_password" type="password" autoComplete="new-password" required />
          </Field>

          <Field
            name="confirm_password"
            label="Repeat new password"
            errors={fieldErrors?.confirm_password}
            required
          >
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <SubmitButton className="w-full" pendingLabel="Saving…">
            Set new password
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
