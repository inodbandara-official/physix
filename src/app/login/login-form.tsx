'use client';

import Link from 'next/link';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { signInAction } from '@/features/auth/actions';
import { useActionForm } from '@/lib/use-action-form';

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  // A successful sign-in redirects server-side, so there is nothing to toast.
  const { state, formAction } = useActionForm(signInAction, { toastOnSuccess: false });
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4" noValidate>
          {notice ? (
            <Alert variant="destructive">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}
          <FormAlert state={state} />

          {next ? <input type="hidden" name="next" value={next} /> : null}

          <Field name="identifier" label="Username or email" errors={fieldErrors?.identifier} required>
            <Input
              id="identifier"
              name="identifier"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </Field>

          <Field name="password" label="Password" errors={fieldErrors?.password} required>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>

          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot your password?
            </Link>
          </div>

          <SubmitButton className="w-full" pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
