'use client';

import { useRef } from 'react';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { changePasswordAction } from '@/features/auth/actions';
import { useActionForm } from '@/lib/use-action-form';

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { state, formAction } = useActionForm(changePasswordAction, {
    onSuccess: () => formRef.current?.reset(),
  });

  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} className="max-w-sm space-y-4" noValidate>
      <FormAlert state={state} />

      <Field name="current_password" label="Current password" errors={errors?.current_password} required>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field name="new_password" label="New password" hint="At least 8 characters." errors={errors?.new_password} required>
        <Input id="new_password" name="new_password" type="password" autoComplete="new-password" required />
      </Field>

      <Field name="confirm_password" label="Repeat new password" errors={errors?.confirm_password} required>
        <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required />
      </Field>

      <SubmitButton>Change password</SubmitButton>
    </form>
  );
}
