'use client';

import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useActionForm } from '@/lib/use-action-form';

import { markAttemptQuestionAction } from '../actions';

interface MarkFormProps {
  attemptQuestionId: string;
  maxMarks: number;
  marks: number | null;
  comment: string | null;
  /** Structured questions are marked part by part; the total follows. */
  parts: { id: string; label: string; maxMarks: number; marks: number | null; needsMarking: boolean }[];
  needsMarking: boolean;
}

/**
 * Awards marks by hand — for an essay, a written part, or to override the
 * engine where the teacher disagrees. Every save is audited.
 */
export function MarkForm({ attemptQuestionId, maxMarks, marks, comment, parts, needsMarking }: MarkFormProps) {
  const { state, formAction } = useActionForm(markAttemptQuestionAction);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  const form = (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="attempt_question_id" value={attemptQuestionId} />
      <FormAlert state={state} />

      {parts.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {parts.map((part) => {
            const id = `${attemptQuestionId}-${part.id}`;
            return (
              <div key={part.id} className="space-y-1">
                <Label htmlFor={id} className="text-xs">
                  Part ({part.label}) <span className="text-muted-foreground">of {part.maxMarks}</span>
                </Label>
                <Input
                  id={id}
                  name={`part_marks[${part.id}]`}
                  type="number"
                  inputMode="decimal"
                  step={0.5}
                  min={0}
                  max={part.maxMarks}
                  defaultValue={part.marks ?? ''}
                  className={`w-24 ${part.needsMarking ? 'border-primary' : ''}`}
                  aria-invalid={Boolean(errors?.[`part_marks.${part.id}`]) || undefined}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1">
          <Label htmlFor={`${attemptQuestionId}-marks`} className="text-xs">
            Marks <span className="text-muted-foreground">of {maxMarks}</span>
          </Label>
          <Input
            id={`${attemptQuestionId}-marks`}
            name="marks"
            type="number"
            inputMode="decimal"
            step={0.5}
            max={maxMarks}
            defaultValue={marks ?? ''}
            className="w-28"
            aria-invalid={Boolean(errors?.marks) || undefined}
          />
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor={`${attemptQuestionId}-comment`} className="text-xs">
          Comment for the student <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={`${attemptQuestionId}-comment`}
          name="teacher_comment"
          rows={2}
          defaultValue={comment ?? ''}
        />
      </div>

      <SubmitButton size="sm" pendingLabel="Saving…">
        Save marks
      </SubmitButton>
    </form>
  );

  // An answer waiting for the teacher gets the form open; an auto-marked
  // one keeps it folded away, so a 40-question paper is not 40 forms.
  if (needsMarking) {
    return (
      <div className="space-y-3 rounded-lg border border-primary/50 bg-primary/5 p-4">
        <p className="text-sm font-medium">Needs your marks</p>
        {form}
      </div>
    );
  }

  return (
    <details className="group rounded-lg border bg-muted/30 open:p-4 [&:not([open])]:px-4 [&:not([open])]:py-2.5">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none group-open:mb-3 group-open:text-foreground">
        Override marks or add a comment
      </summary>
      {form}
    </details>
  );
}
