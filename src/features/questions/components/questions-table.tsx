'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  Archive,
  ArchiveRestore,
  Copy,
  FileQuestion,
  MoreHorizontal,
  PencilLine,
  Plus,
  Send,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/empty-state';
import { mathToPlainText } from '@/components/math-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ActionState } from '@/lib/action';
import { runWithToast } from '@/lib/run-action';

import {
  archiveQuestionAction,
  bulkQuestionAction,
  duplicateQuestionAction,
  setQuestionStatusAction,
} from '../actions';
import type { QuestionListItem } from '../queries';
import { DifficultyBadge, MarksBadge, QuestionStatusBadge, QuestionTypeBadge } from './question-badges';

interface QuestionsTableProps {
  questions: QuestionListItem[];
  filtered: boolean;
  /** Syllabus node id → breadcrumb label, for showing where a question sits. */
  nodeLabels: Record<string, string>;
}

export function QuestionsTable({ questions, filtered, nodeLabels }: QuestionsTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const allSelected = questions.length > 0 && selected.length === questions.length;

  const run = (action: () => Promise<ActionState<unknown>>) =>
    startTransition(async () => {
      await runWithToast(action);
      setSelected([]);
    });

  const bulk = (operation: 'publish' | 'draft' | 'archive' | 'restore') =>
    startTransition(async () => {
      // The action applies these one at a time, so a question that cannot be
      // published (an incomplete answer key, say) reports why rather than
      // failing the whole batch.
      const formData = new FormData();
      formData.set('operation', operation);
      for (const id of selected) formData.append('question_ids[]', id);

      const result = await bulkQuestionAction({ status: 'idle' }, formData);
      if (result.status === 'error') toast.error(result.message);
      else if (result.status === 'success') toast.success(result.message);
      setSelected([]);
    });

  if (questions.length === 0) {
    return filtered ? (
      <EmptyState
        icon={FileQuestion}
        title="No questions match these filters"
        description="Try a different unit, type or difficulty, or clear the search."
      />
    ) : (
      <EmptyState
        icon={FileQuestion}
        title="Your question bank is empty"
        description="Create your first Physics question. Questions live here independently of any assessment, so you can reuse them across quizzes, tests and past-paper practice."
        action={
          <Button asChild size="sm">
            <Link href="/t/questions/new">
              <Plus className="size-4" aria-hidden />
              Create a question
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
          <span className="text-sm font-medium" aria-live="polite">
            {selected.length} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => bulk('publish')}>
              <Send className="size-4" aria-hidden />
              Publish
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => bulk('draft')}>
              <Undo2 className="size-4" aria-hidden />
              Back to draft
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => bulk('archive')}>
              <Archive className="size-4" aria-hidden />
              Archive
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <div className="hidden overflow-hidden rounded-xl border bg-background lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => setSelected(allSelected ? [] : questions.map((question) => question.id))}
                  aria-label="Select all questions on this page"
                />
              </TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Marks</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((question) => (
              <TableRow key={question.id} className={question.archived_at ? 'opacity-60' : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selected.includes(question.id)}
                    onCheckedChange={() => toggle(question.id)}
                    aria-label={`Select ${question.question_code}`}
                  />
                </TableCell>
                <TableCell className="max-w-md">
                  <Link href={`/t/questions/${question.id}`} className="font-medium hover:underline">
                    {question.title || mathToPlainText(question.stem, 70)}
                  </Link>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{question.question_code}</span>
                    {question.version_number > 1 ? <span>v{question.version_number}</span> : null}
                    {question.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </span>
                </TableCell>
                <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                  {question.syllabus_node_id ? (nodeLabels[question.syllabus_node_id] ?? '—') : '—'}
                </TableCell>
                <TableCell>
                  <QuestionTypeBadge type={question.type} />
                </TableCell>
                <TableCell>
                  <DifficultyBadge difficulty={question.difficulty} />
                </TableCell>
                <TableCell className="tabular-nums">{question.marks}</TableCell>
                <TableCell>
                  <QuestionStatusBadge status={question.archived_at ? 'archived' : question.status} />
                </TableCell>
                <TableCell>
                  <RowActions
                    question={question}
                    disabled={isPending}
                    onRun={run}
                    onDuplicated={(id) => router.push(`/t/questions/${id}/edit`)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 lg:hidden">
        {questions.map((question) => (
          <li key={question.id} className="rounded-xl border bg-background p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/t/questions/${question.id}`} className="font-medium hover:underline">
                  {question.title || mathToPlainText(question.stem, 60)}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">{question.question_code}</p>
              </div>
              <RowActions
                question={question}
                disabled={isPending}
                onRun={run}
                onDuplicated={(id) => router.push(`/t/questions/${id}/edit`)}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <QuestionStatusBadge status={question.archived_at ? 'archived' : question.status} />
              <QuestionTypeBadge type={question.type} />
              <DifficultyBadge difficulty={question.difficulty} />
              <MarksBadge marks={question.marks} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RowActions({
  question,
  disabled,
  onRun,
  onDuplicated,
}: {
  question: QuestionListItem;
  disabled: boolean;
  onRun: (action: () => Promise<ActionState<unknown>>) => void;
  onDuplicated: (id: string) => void;
}) {
  const archived = question.archived_at !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled} aria-label={`Actions for ${question.question_code}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/t/questions/${question.id}/edit`}>
            <PencilLine className="size-4" aria-hidden />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            onRun(async () => {
              const result = await duplicateQuestionAction(question.id);
              if (result.status === 'success' && result.data) onDuplicated(result.data.id);
              return result;
            })
          }
        >
          <Copy className="size-4" aria-hidden />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {question.status === 'published' ? (
          <DropdownMenuItem onSelect={() => onRun(() => setQuestionStatusAction(question.id, 'draft'))}>
            <Undo2 className="size-4" aria-hidden />
            Back to draft
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onRun(() => setQuestionStatusAction(question.id, 'published'))}>
            <Send className="size-4" aria-hidden />
            Publish
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant={archived ? 'default' : 'destructive'}
          onSelect={() => onRun(() => archiveQuestionAction(question.id, !archived))}
        >
          {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
          {archived ? 'Restore' : 'Archive'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
