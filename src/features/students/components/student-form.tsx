'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createStudentAction, updateStudentAction } from '@/features/students/actions';
import { useActionForm } from '@/lib/use-action-form';
import type { StudentRow } from '@/types/database';

interface StudentFormProps {
  mode: 'create' | 'edit';
  student?: StudentRow;
  selectedBatchIds?: string[];
  batches: { id: string; name: string; al_year: number | null }[];
  suggestedCode?: string;
}

export function StudentForm({ mode, student, selectedBatchIds = [], batches, suggestedCode }: StudentFormProps) {
  const router = useRouter();
  const action = mode === 'create' ? createStudentAction : updateStudentAction;
  const [status, setStatus] = useState(student?.status ?? 'active');
  const { state, formAction } = useActionForm(action, {
    onSuccess: ({ data }) => data && router.push(`/t/students/${data.id}`),
  });

  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {student ? <input type="hidden" name="id" value={student.id} /> : null}
      <input type="hidden" name="status" value={status} />

      <FormAlert state={state} />

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>
            The Student ID and username must be unique. The username is what the student types to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field name="student_code" label="Student ID" errors={errors?.student_code} required>
            <Input
              id="student_code"
              name="student_code"
              defaultValue={student?.student_code ?? suggestedCode}
              placeholder="PHY-2026-001"
              required
            />
          </Field>

          <Field
            name="username"
            label="Username"
            hint="Their fallback sign-in, used only when they have no email address."
            errors={errors?.username}
            required
          >
            <Input
              id="username"
              name="username"
              defaultValue={student?.username}
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </Field>

          <Field name="full_name" label="Full name" errors={errors?.full_name} required>
            <Input id="full_name" name="full_name" defaultValue={student?.full_name} required />
          </Field>

          <Field name="preferred_name" label="Preferred name" errors={errors?.preferred_name}>
            <Input id="preferred_name" name="preferred_name" defaultValue={student?.preferred_name ?? ''} />
          </Field>

          <div className="space-y-2">
            <Label htmlFor="status-trigger">Account status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger id="status-trigger" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Field name="joined_on" label="Joined on" errors={errors?.joined_on}>
            <Input
              id="joined_on"
              name="joined_on"
              type="date"
              defaultValue={student?.joined_on ?? new Date().toISOString().slice(0, 10)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>Only what you need to reach the student or their guardian.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field
            name="email"
            label="Email"
            hint="They sign in with this, reset their own password with it, and receive notifications at it. Leave blank if they have no email — they will sign in with their username instead."
            errors={errors?.email}
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={student?.email ?? ''}
            />
          </Field>

          <Field name="phone" label="Phone" errors={errors?.phone}>
            <Input id="phone" name="phone" type="tel" defaultValue={student?.phone ?? ''} />
          </Field>

          <Field name="guardian_name" label="Parent / guardian" errors={errors?.guardian_name}>
            <Input id="guardian_name" name="guardian_name" defaultValue={student?.guardian_name ?? ''} />
          </Field>

          <Field name="guardian_phone" label="Guardian phone" errors={errors?.guardian_phone}>
            <Input id="guardian_phone" name="guardian_phone" type="tel" defaultValue={student?.guardian_phone ?? ''} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>School and batches</CardTitle>
          <CardDescription>A student may sit in more than one batch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field name="school" label="School" errors={errors?.school}>
              <Input id="school" name="school" defaultValue={student?.school ?? ''} />
            </Field>

            <Field name="district" label="District" errors={errors?.district}>
              <Input id="district" name="district" defaultValue={student?.district ?? ''} placeholder="Colombo" />
            </Field>

            <Field name="al_year" label="A/L year" errors={errors?.al_year}>
              <Input
                id="al_year"
                name="al_year"
                type="number"
                inputMode="numeric"
                min={2000}
                max={2100}
                defaultValue={student?.al_year ?? ''}
                placeholder="2026"
              />
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Batches</legend>
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No batches yet. You can create one later and add this student to it.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {batches.map((batch) => (
                  <label
                    key={batch.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
                  >
                    <Checkbox name="batch_ids[]" value={batch.id} defaultChecked={selectedBatchIds.includes(batch.id)} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{batch.name}</span>
                      {batch.al_year ? (
                        <span className="block text-xs text-muted-foreground">{batch.al_year} A/L</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <Field name="notes" label="Record note" hint="A short note on the record itself. Students never see this." errors={errors?.notes}>
            <Textarea id="notes" name="notes" rows={3} defaultValue={student?.notes ?? ''} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving…">
          {mode === 'create' ? 'Add student' : 'Save changes'}
        </SubmitButton>
      </div>
    </form>
  );
}
