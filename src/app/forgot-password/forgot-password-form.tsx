'use client';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { requestPasswordResetAction } from '@/features/auth/actions';
import { useActionForm } from '@/lib/use-action-form';

export function ForgotPasswordForm() {
  // The confirmation is shown in the form itself, so a toast would repeat it.
  const { state, formAction } = useActionForm(requestPasswordResetAction, { toastOnSuccess: false });
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <Card>
      <CardContent className="pt-6">
        {state.status === 'success' ? (
          <FormAlert state={state} />
        ) : (
          <form action={formAction} className="space-y-4" noValidate>
            <FormAlert state={state} />

            <Field name="email" label="Email address" errors={fieldErrors?.email} required>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </Field>

            <SubmitButton className="w-full" pendingLabel="Sending…">
              Send reset link
            </SubmitButton>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
