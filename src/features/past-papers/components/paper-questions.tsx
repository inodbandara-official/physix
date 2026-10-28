'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';

import { SubmitButton } from '@/components/form/submit-button';
import { mathToPlainText } from '@/components/math-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarksBadge, QuestionTypeBadge } from '@/features/questions/components/question-badges';
import { runWithToast } from '@/lib/run-action';
import { useActionForm } from '@/lib/use-action-form';
import { cn } from '@/lib/utils';

import { movePaperQuestionAction, removePaperQuestionAction, updatePaperQuestionAction } from '../actions';
import type { PaperQuestion } from '../queries';

export function PaperQuestions({
  paperId,
  questions,
  nodeLabels,
}: {
  paperId: string;
  questions: PaperQuestion[];
  nodeLabels: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <ol className={cn('space-y-2', isPending && 'opacity-70')}>
      {questions.map((item, index) => (
        <li key={item.questionId} className="flex flex-col gap-3 rounded-xl border bg-background p-4 lg:flex-row lg:items-start">
          <NumberForm paperId={paperId} item={item} />

          <div className="min-w-0 flex-1 space-y-2">
            {item.question ? (
              <>
                <Link href={`/t/questions/${item.question.id}`} className="block text-sm font-medium hover:underline">
                  <span className="text-muted-foreground">{item.question.question_code}</span>{' '}
                  {item.question.current_title || mathToPlainText(item.question.current_stem ?? '', 110)}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.question.current_type ? <QuestionTypeBadge type={item.question.current_type} /> : null}
                  <MarksBadge marks={Number(item.question.current_marks ?? 0)} />
                  {item.question.current_node_id && nodeLabels[item.question.current_node_id] ? (
                    <Badge variant="secondary" className="font-normal">
                      {nodeLabels[item.question.current_node_id]}
                    </Badge>
                  ) : null}
                  {item.question.status !== 'published' || item.question.archived_at ? (
                    <Badge variant="destructive" className="font-normal">
                      Not published
                    </Badge>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-destructive">This question no longer exists.</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Move up"
              disabled={isPending || index === 0}
              onClick={() => startTransition(() => runWithToast(() => movePaperQuestionAction(paperId, item.questionId, 'up')))}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Move down"
              disabled={isPending || index === questions.length - 1}
              onClick={() => startTransition(() => runWithToast(() => movePaperQuestionAction(paperId, item.questionId, 'down')))}
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove from paper"
              disabled={isPending}
              onClick={() => startTransition(() => runWithToast(() => removePaperQuestionAction(paperId, item.questionId)))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Question number and section, as printed on the real paper. */
function NumberForm({ paperId, item }: { paperId: string; item: PaperQuestion }) {
  const { state, formAction } = useActionForm(updatePaperQuestionAction);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;
  const base = `${item.questionId}`;

  return (
    <form action={formAction} className="flex shrink-0 items-end gap-2" noValidate>
      <input type="hidden" name="paper_id" value={paperId} />
      <input type="hidden" name="question_id" value={item.questionId} />
      <div className="space-y-1">
        <Label htmlFor={`${base}-number`} className="text-xs text-muted-foreground">
          No.
        </Label>
        <Input
          id={`${base}-number`}
          name="question_number"
          defaultValue={item.number}
          className="h-8 w-16"
          aria-invalid={Boolean(errors?.question_number) || undefined}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${base}-section`} className="text-xs text-muted-foreground">
          Section
        </Label>
        <Input id={`${base}-section`} name="section" defaultValue={item.section ?? ''} placeholder="A" className="h-8 w-20" />
      </div>
      <SubmitButton size="sm" variant="outline" className="h-8" pendingLabel="…">
        Save
      </SubmitButton>
    </form>
  );
}
