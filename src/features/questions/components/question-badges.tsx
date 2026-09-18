import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DifficultyLevel, QuestionStatus, QuestionType } from '@/types/database';

import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS, STATUS_LABELS } from '../types';

const DIFFICULTY_STYLES: Record<DifficultyLevel, string> = {
  very_easy: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
  easy: 'bg-teal-500/12 text-teal-700 dark:text-teal-400',
  medium: 'bg-amber-500/12 text-amber-700 dark:text-amber-400',
  hard: 'bg-orange-500/14 text-orange-700 dark:text-orange-400',
  very_hard: 'bg-destructive/12 text-destructive',
};

const STATUS_STYLES: Record<QuestionStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
  archived: 'bg-muted text-muted-foreground',
};

export function DifficultyBadge({ difficulty }: { difficulty: DifficultyLevel }) {
  return (
    <Badge variant="secondary" className={cn('font-normal', DIFFICULTY_STYLES[difficulty])}>
      {DIFFICULTY_LABELS[difficulty]}
    </Badge>
  );
}

export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  return (
    <Badge variant="secondary" className={cn('font-normal', STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function QuestionTypeBadge({ type }: { type: QuestionType }) {
  return (
    <Badge variant="outline" className="font-normal">
      {QUESTION_TYPE_LABELS[type]}
    </Badge>
  );
}

export function MarksBadge({ marks }: { marks: number }) {
  return (
    <Badge variant="outline" className="font-normal tabular-nums">
      {marks} {marks === 1 ? 'mark' : 'marks'}
    </Badge>
  );
}
