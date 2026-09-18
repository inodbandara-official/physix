'use client';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { updateBrandAction } from '@/features/settings/actions';
import { useActionForm } from '@/lib/use-action-form';
import type { AppSettingsRow } from '@/types/database';

export function BrandForm({ brand }: { brand: AppSettingsRow }) {
  const { state, formAction } = useActionForm(updateBrandAction);

  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormAlert state={state} />

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>
            What students see across the app. Nothing here is hardcoded — change it whenever you like.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field name="lms_name" label="LMS name" errors={errors?.lms_name} required>
            <Input id="lms_name" name="lms_name" defaultValue={brand.lms_name} required />
          </Field>

          <Field name="tagline" label="Tagline" errors={errors?.tagline} required>
            <Input id="tagline" name="tagline" defaultValue={brand.tagline} required />
          </Field>

          <Field name="teacher_name" label="Teacher name" errors={errors?.teacher_name}>
            <Input id="teacher_name" name="teacher_name" defaultValue={brand.teacher_name ?? ''} />
          </Field>

          <Field name="logo_url" label="Logo URL" hint="Leave blank to use the lettermark." errors={errors?.logo_url}>
            <Input id="logo_url" name="logo_url" type="url" defaultValue={brand.logo_url ?? ''} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colours</CardTitle>
          <CardDescription>Used for the lettermark, highlights and progress bars.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field name="primary_color" label="Primary colour" errors={errors?.primary_color} required>
            <div className="flex items-center gap-2">
              <Input
                id="primary_color"
                name="primary_color"
                defaultValue={brand.primary_color}
                className="font-mono"
                required
              />
              <span
                className="size-9 shrink-0 rounded-md border"
                style={{ background: brand.primary_color }}
                aria-hidden
              />
            </div>
          </Field>

          <Field name="secondary_color" label="Secondary colour" errors={errors?.secondary_color} required>
            <div className="flex items-center gap-2">
              <Input
                id="secondary_color"
                name="secondary_color"
                defaultValue={brand.secondary_color}
                className="font-mono"
                required
              />
              <span
                className="size-9 shrink-0 rounded-md border"
                style={{ background: brand.secondary_color }}
                aria-hidden
              />
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>Shown on the sign-in page so students know who to ask for help.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field name="contact_email" label="Contact email" errors={errors?.contact_email}>
            <Input id="contact_email" name="contact_email" type="email" defaultValue={brand.contact_email ?? ''} />
          </Field>

          <Field name="contact_phone" label="Contact phone" errors={errors?.contact_phone}>
            <Input id="contact_phone" name="contact_phone" type="tel" defaultValue={brand.contact_phone ?? ''} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </form>
  );
}
