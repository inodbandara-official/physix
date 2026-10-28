'use client';

import { useState } from 'react';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ASSESSMENT_KIND_LABELS, ASSESSMENT_KIND_ORDER } from '@/features/assessments/types';
import { useActionForm } from '@/lib/use-action-form';
import { cn } from '@/lib/utils';
import type { AssessmentKind, RankingBasis, RankingVisibility } from '@/types/database';

import { saveRankingSettingsAction } from '../actions';
import { BASIS_LABELS, VISIBILITY_LABELS } from '../schema';

interface RankingSettingsFormProps {
  basis: RankingBasis;
  recentCount: number;
  weights: Record<AssessmentKind, number>;
  missedCountsZero: boolean;
  visibility: RankingVisibility;
}

const BASIS_HELP: Record<RankingBasis, string> = {
  average: 'Mean of each student’s best percentage per counted test. Fair when tests differ in length.',
  total: 'Sum of marks scored. Longer papers weigh more, as in an exam total.',
  weighted: 'Mean percentage within each test type, combined by the weights below — e.g. term tests 50%.',
  recent: 'Mean of the most recent tests only, to reward current form.',
};

export function RankingSettingsForm(props: RankingSettingsFormProps) {
  const { state, formAction } = useActionForm(saveRankingSettingsAction);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;
  const [basis, setBasis] = useState<RankingBasis>(props.basis);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormAlert state={state} />

      <Card>
        <CardHeader>
          <CardTitle>Ranking basis</CardTitle>
          <CardDescription>The rule is printed above every ranking, for you and for students.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Ranking basis</legend>
            {(Object.keys(BASIS_LABELS) as RankingBasis[]).map((option) => (
              <label
                key={option}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring',
                  basis === option ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="basis"
                    value={option}
                    checked={basis === option}
                    onChange={() => setBasis(option)}
                    className="accent-[var(--primary)]"
                  />
                  {BASIS_LABELS[option]}
                </span>
                <span className="text-xs text-muted-foreground">{BASIS_HELP[option]}</span>
              </label>
            ))}
          </fieldset>

          {basis === 'recent' ? (
            <Field name="recent_count" label="Number of recent tests" errors={errors?.recent_count} className="max-w-48">
              <Input id="recent_count" name="recent_count" type="number" min={1} max={50} defaultValue={props.recentCount} />
            </Field>
          ) : (
            <input type="hidden" name="recent_count" value={props.recentCount} />
          )}

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="missed_counts_zero" className="text-sm font-medium">
                Count a missed test as 0%
              </Label>
              <p className="text-xs text-muted-foreground">
                Only for tests that have closed and were set for the student’s batch while they were in it. Without
                this, skipping a hard test would raise a rank.
              </p>
            </div>
            <Switch id="missed_counts_zero" name="missed_counts_zero" defaultChecked={props.missedCountsZero} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test-type weights</CardTitle>
          <CardDescription>
            A type weighted 0 does not count towards any ranking. Practice is 0 by default: unlimited retries reward
            persistence, not attainment. The weights matter most for the weighted basis.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ASSESSMENT_KIND_ORDER.map((kind) => (
            <Field key={kind} name={`weight_${kind}`} label={ASSESSMENT_KIND_LABELS[kind]} errors={errors?.[`weight_${kind}`]}>
              <Input
                id={`weight_${kind}`}
                name={`weight_${kind}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                defaultValue={props.weights[kind]}
              />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What students see</CardTitle>
          <CardDescription>
            Students only ever see their own batch. You always see everything.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset className="space-y-2">
            <legend className="sr-only">Student visibility</legend>
            {(Object.keys(VISIBILITY_LABELS) as RankingVisibility[]).map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50">
                <input type="radio" name="student_visibility" value={option} defaultChecked={props.visibility === option} />
                {VISIBILITY_LABELS[option]}
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save ranking settings</SubmitButton>
      </div>
    </form>
  );
}
