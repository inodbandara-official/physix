'use client';

import { useRouter } from 'next/navigation';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toLocalInput } from '@/lib/time';
import { useActionForm } from '@/lib/use-action-form';
import type { AssessmentRow } from '@/types/database';

import { createAssessmentAction, updateAssessmentAction } from '../actions';
import { ASSESSMENT_KIND_LABELS, ASSESSMENT_KIND_ORDER, MAX_ATTEMPT_OPTIONS, NEGATIVE_MARKING_OPTIONS } from '../types';

interface AssessmentSettingsFormProps {
  mode: 'create' | 'edit';
  assessment?: AssessmentRow;
  batches: { id: string; name: string; al_year: number | null }[];
  selectedBatchIds?: string[];
  /** Once students have started, the recipe is frozen but settings are not. */
  hasAttempts?: boolean;
}

export function AssessmentSettingsForm({
  mode,
  assessment,
  batches,
  selectedBatchIds = [],
  hasAttempts = false,
}: AssessmentSettingsFormProps) {
  const router = useRouter();
  const action = mode === 'create' ? createAssessmentAction : updateAssessmentAction;
  const { state, formAction } = useActionForm(action, {
    onSuccess: ({ data }) => data && router.push(`/t/assessments/${data.id}`),
  });
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  const maxAttempts =
    assessment === undefined ? '1' : assessment.max_attempts === null ? 'unlimited' : String(assessment.max_attempts);
  const attemptOptions = MAX_ATTEMPT_OPTIONS.some((option) => option.value === maxAttempts)
    ? MAX_ATTEMPT_OPTIONS
    : [...MAX_ATTEMPT_OPTIONS, { value: maxAttempts, label: `${maxAttempts} attempts` }];

  const negative = assessment ? String(Number(assessment.negative_marking)) : '0';

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {assessment ? <input type="hidden" name="id" value={assessment.id} /> : null}
      <FormAlert state={state} />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>What students see on their list and on the instructions page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field name="title" label="Title" errors={errors?.title} required className="sm:col-span-2">
            <Input id="title" name="title" defaultValue={assessment?.title} placeholder="Mechanics — Class test 3" required />
          </Field>

          <Field name="kind" label="Type" errors={errors?.kind}>
            <Select name="kind" defaultValue={assessment?.kind ?? 'class_test'}>
              <SelectTrigger id="kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSESSMENT_KIND_ORDER.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {ASSESSMENT_KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            name="pass_percentage"
            label="Pass mark (%)"
            hint="Leave blank for no pass mark."
            errors={errors?.pass_percentage}
          >
            <Input
              id="pass_percentage"
              name="pass_percentage"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="any"
              defaultValue={assessment?.pass_percentage === null || !assessment ? '' : Number(assessment.pass_percentage)}
              placeholder="50"
            />
          </Field>

          <Field
            name="description"
            label="Instructions"
            hint="Shown before a student starts. Plain text."
            errors={errors?.description}
            className="sm:col-span-2"
          >
            <Textarea id="description" name="description" rows={3} defaultValue={assessment?.description ?? ''} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who and when</CardTitle>
          <CardDescription>All times are Sri Lanka time. Leave a date blank for no limit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Batches</legend>
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Create a batch first — an assessment is set for batches.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {batches.map((batch) => (
                  <label
                    key={batch.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
                  >
                    <Checkbox name="batch_ids[]" value={batch.id} defaultChecked={selectedBatchIds.includes(batch.id)} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{batch.name}</span>
                      {batch.al_year ? <span className="block text-xs text-muted-foreground">{batch.al_year} A/L</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {errors?.batch_ids ? <p className="text-xs font-medium text-destructive">{errors.batch_ids.join(' ')}</p> : null}
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="opens_at" label="Opens" errors={errors?.opens_at}>
              <Input id="opens_at" name="opens_at" type="datetime-local" defaultValue={toLocalInput(assessment?.opens_at)} />
            </Field>
            <Field name="closes_at" label="Closes" errors={errors?.closes_at}>
              <Input id="closes_at" name="closes_at" type="datetime-local" defaultValue={toLocalInput(assessment?.closes_at)} />
            </Field>
            <Field
              name="time_limit_minutes"
              label="Time limit (minutes)"
              hint="Blank for untimed. An attempt also ends when the assessment closes."
              errors={errors?.time_limit_minutes}
            >
              <Input
                id="time_limit_minutes"
                name="time_limit_minutes"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                defaultValue={assessment?.time_limit_minutes ?? ''}
                placeholder="45"
              />
            </Field>
            <Field name="max_attempts" label="Attempts allowed" errors={errors?.max_attempts}>
              <Select name="max_attempts" defaultValue={maxAttempts}>
                <SelectTrigger id="max_attempts" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {attemptOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marking and feedback</CardTitle>
          <CardDescription>
            {hasAttempts
              ? 'Changes apply to what students see from now on. Marks already given do not change.'
              : 'What students see after they submit.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field
            name="negative_marking"
            label="Negative marking"
            hint="Taken off a wrong multiple-choice or true/false answer. A blank answer never loses marks."
            errors={errors?.negative_marking}
            className="max-w-md"
          >
            <Select name="negative_marking" defaultValue={negative}>
              <SelectTrigger id="negative_marking" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NEGATIVE_MARKING_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              name="show_results_immediately"
              label="Show results straight away"
              hint="Off: held until the closing time, or until you release them."
              defaultChecked={assessment?.show_results_immediately ?? true}
            />
            <Toggle
              name="allow_review"
              label="Let students review each question"
              hint="Their answer, marks and the marking engine's feedback."
              defaultChecked={assessment?.allow_review ?? true}
            />
            <Toggle
              name="show_correct_answers"
              label="Show correct answers in review"
              defaultChecked={assessment?.show_correct_answers ?? true}
            />
            <Toggle
              name="show_explanations"
              label="Show explanations and worked solutions"
              defaultChecked={assessment?.show_explanations ?? true}
            />
            <Toggle
              name="shuffle_questions"
              label="Shuffle question order"
              hint="Each attempt gets its own order."
              defaultChecked={assessment?.shuffle_questions ?? false}
            />
            <Toggle
              name="shuffle_options"
              label="Shuffle answer options"
              hint="Only for questions that allow it."
              defaultChecked={assessment?.shuffle_options ?? true}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving…">{mode === 'create' ? 'Create and add questions' : 'Save settings'}</SubmitButton>
      </div>
    </form>
  );
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="space-y-0.5">
        <Label htmlFor={name} className="text-sm font-medium">
          {label}
        </Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={name} name={name} defaultChecked={defaultChecked} />
    </div>
  );
}
