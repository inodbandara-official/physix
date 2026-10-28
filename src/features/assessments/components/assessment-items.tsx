'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, PencilLine, Shuffle, Trash2 } from 'lucide-react';

import { mathToPlainText } from '@/components/math-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DifficultyBadge, MarksBadge, QuestionTypeBadge } from '@/features/questions/components/question-badges';
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from '@/features/questions/types';
import { runWithToast } from '@/lib/run-action';
import { cn } from '@/lib/utils';

import { moveItemAction, removeItemAction } from '../actions';
import type { BuilderItem } from '../queries';
import { RandomRuleDialog } from './random-rule-dialog';

interface AssessmentItemsProps {
  assessmentId: string;
  items: BuilderItem[];
  nodeLabels: Record<string, string>;
  nodes: { id: string; label: string; kind: string }[];
  /** Frozen once any student has started. */
  locked: boolean;
}

export function AssessmentItems({ assessmentId, items, nodeLabels, nodes, locked }: AssessmentItemsProps) {
  const [isPending, startTransition] = useTransition();

  // "Q4–6" for a rule drawing three: the numbers a student will see.
  const ranges = items.reduce<{ end: number; labels: string[] }>(
    (acc, item) => {
      const size = item.kind === 'question' ? 1 : item.pickCount;
      const first = acc.end + 1;
      const end = acc.end + size;
      return { end, labels: [...acc.labels, size === 1 ? `${first}` : `${first}–${end}`] };
    },
    { end: 0, labels: [] },
  ).labels;

  return (
    <ol className="space-y-2">
      {items.map((item, index) => {
        const range = ranges[index];

        return (
          <li
            key={item.id}
            className={cn('flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-start', isPending && 'opacity-70')}
          >
            <span className="w-14 shrink-0 text-sm font-medium text-muted-foreground tabular-nums">Q{range}</span>

            <div className="min-w-0 flex-1 space-y-2">
              {item.kind === 'question' ? (
                item.question ? (
                  <>
                    <Link href={`/t/questions/${item.question.id}`} className="block text-sm font-medium hover:underline">
                      <span className="text-muted-foreground">{item.question.question_code}</span>{' '}
                      {item.question.current_title || mathToPlainText(item.question.current_stem ?? '', 110)}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.question.current_type ? <QuestionTypeBadge type={item.question.current_type} /> : null}
                      {item.question.current_difficulty ? <DifficultyBadge difficulty={item.question.current_difficulty} /> : null}
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
                )
              ) : (
                <>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Shuffle className="size-4 text-muted-foreground" aria-hidden />
                    {item.pickCount} random {item.pickCount === 1 ? 'question' : 'questions'} from{' '}
                    {item.nodeId ? (nodeLabels[item.nodeId] ?? 'a removed topic') : 'the whole syllabus'}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-normal">
                      {item.difficulties.length ? item.difficulties.map((level) => DIFFICULTY_LABELS[level]).join(' / ') : 'Any difficulty'}
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      {item.types.length ? item.types.map((type) => QUESTION_TYPE_LABELS[type]).join(' / ') : 'Any type'}
                    </Badge>
                    {item.marks !== null ? (
                      <Badge variant="outline" className="font-normal">
                        {item.marks} marks each
                      </Badge>
                    ) : null}
                    <span
                      className={cn(
                        'flex items-center gap-1',
                        item.available < item.pickCount && 'font-medium text-destructive',
                      )}
                    >
                      {item.available < item.pickCount ? <AlertTriangle className="size-3.5" aria-hidden /> : null}
                      {item.available} published {item.available === 1 ? 'question matches' : 'questions match'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {!locked ? (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move up"
                  disabled={isPending || index === 0}
                  onClick={() => startTransition(() => runWithToast(() => moveItemAction(item.id, 'up')))}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move down"
                  disabled={isPending || index === items.length - 1}
                  onClick={() => startTransition(() => runWithToast(() => moveItemAction(item.id, 'down')))}
                >
                  <ArrowDown className="size-4" />
                </Button>
                {item.kind === 'random' ? (
                  <RandomRuleDialog
                    assessmentId={assessmentId}
                    nodes={nodes}
                    rule={{
                      itemId: item.id,
                      pickCount: item.pickCount,
                      nodeId: item.nodeId,
                      difficulties: item.difficulties,
                      types: item.types,
                      marks: item.marks,
                    }}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Edit rule">
                        <PencilLine className="size-4" />
                      </Button>
                    }
                  />
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove"
                  disabled={isPending}
                  onClick={() => startTransition(() => runWithToast(() => removeItemAction(item.id)))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
