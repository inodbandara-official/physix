'use client';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { NEU_FIELD } from '@/components/auth-shell';
import { requestPasswordResetAction } from '@/features/auth/actions';
import { useActionForm } from '@/lib/use-action-form';

export function ForgotPasswordForm() {
  // The confirmation is shown in the form itself, so a toast would repeat it.
  const { state, formAction } = useActionForm(requestPasswordResetAction, { toastOnSuccess: false });
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <div className="neu-raised rounded-3xl p-7">
      {state.status === 'success' ? (
        <FormAlert state={state} />
      ) : (
        <form action={formAction} className="space-y-5" noValidate>
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
              className={NEU_FIELD}
            />
          </Field>

          <SubmitButton
            className="neu-action h-11 w-full rounded-xl text-sm font-semibold"
            pendingLabel="Sending…"
          >
            Send reset link
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
