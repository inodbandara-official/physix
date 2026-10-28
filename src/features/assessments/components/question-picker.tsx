'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FileQuestion } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { mathToPlainText } from '@/components/math-text';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DifficultyBadge, MarksBadge, QuestionTypeBadge } from '@/features/questions/components/question-badges';
import { useActionForm } from '@/lib/use-action-form';
import type { DifficultyLevel, QuestionType } from '@/types/database';

import { addQuestionsAction } from '../actions';

export interface PickerRow {
  id: string;
  code: string;
  title: string | null;
  stem: string;
  type: QuestionType | null;
  difficulty: DifficultyLevel | null;
  marks: number;
  nodeLabel: string | null;
  hasSinhala: boolean;
}

export function QuestionPicker({ assessmentId, rows }: { assessmentId: string; rows: PickerRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const { state, formAction } = useActionForm(addQuestionsAction, {
    onSuccess: () => router.push(`/t/assessments/${assessmentId}`),
  });

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="No published questions match"
        description="Only published questions can go into an assessment. Try other filters, or publish questions from the bank."
      />
    );
  }

  const allSelected = selected.length === rows.length;
  const marks = rows.filter((row) => selected.includes(row.id)).reduce((sum, row) => sum + row.marks, 0);

  return (
    <form action={formAction} className="space-y-3">
      <FormAlert state={state} />
      <input type="hidden" name="assessment_id" value={assessmentId} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="question_ids[]" value={id} />
      ))}

      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-3 rounded-lg border bg-background/95 px-3 py-2 backdrop-blur">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => setSelected(checked ? rows.map((row) => row.id) : [])}
            aria-label="Select all shown"
          />
          Select all shown
        </label>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {selected.length} selected{selected.length > 0 ? ` · ${Math.round(marks * 100) / 100} marks` : ''}
        </span>
        <SubmitButton className="ml-auto" disabled={selected.length === 0} pendingLabel="Adding…">
          Add {selected.length > 0 ? selected.length : ''} to assessment
        </SubmitButton>
      </div>

      <ul className="space-y-2">
        {rows.map((row) => {
          const checked = selected.includes(row.id);
          return (
            <li key={row.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-4 hover:bg-muted/40 has-data-[state=checked]:border-primary">
                <Checkbox
                  className="mt-0.5"
                  checked={checked}
                  onCheckedChange={(value) =>
                    setSelected((current) => (value ? [...current, row.id] : current.filter((id) => id !== row.id)))
                  }
                />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="block text-sm">
                    <span className="font-medium text-muted-foreground">{row.code}</span>{' '}
                    {row.title || mathToPlainText(row.stem, 140)}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {row.type ? <QuestionTypeBadge type={row.type} /> : null}
                    {row.difficulty ? <DifficultyBadge difficulty={row.difficulty} /> : null}
                    <MarksBadge marks={row.marks} />
                    {row.nodeLabel ? (
                      <Badge variant="secondary" className="font-normal">
                        {row.nodeLabel}
                      </Badge>
                    ) : null}
                    {row.hasSinhala ? (
                      <Badge variant="outline" className="font-normal">
                        සිං
                      </Badge>
                    ) : null}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
