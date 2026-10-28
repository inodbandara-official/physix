'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Archive, ArchiveRestore, Copy, Eye, MoreHorizontal, Send, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ActionState } from '@/lib/action';
import { runWithToast } from '@/lib/run-action';

import {
  archiveAssessmentAction,
  deleteAssessmentAction,
  duplicateAssessmentAction,
  publishAssessmentAction,
  releaseResultsAction,
  unpublishAssessmentAction,
} from '../actions';

interface AssessmentLifecycleProps {
  id: string;
  status: 'draft' | 'published';
  archived: boolean;
  attemptCount: number;
  /** Results are held back and have not been released. */
  canRelease: boolean;
}

export function AssessmentLifecycle({ id, status, archived, attemptCount, canRelease }: AssessmentLifecycleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);

  const run = (action: () => Promise<ActionState<unknown>>) => startTransition(() => runWithToast(action));

  const publish = () =>
    startTransition(async () => {
      const result = await publishAssessmentAction(id);
      if (result.status === 'success') {
        toast.success(result.message);
        setIssues([]);
      } else if (result.status === 'error') {
        setIssues(result.fieldErrors?._form ?? [result.message]);
      }
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canRelease ? (
          <Button variant="outline" disabled={isPending} onClick={() => run(() => releaseResultsAction(id))}>
            <Eye className="size-4" aria-hidden />
            Release results
          </Button>
        ) : null}

        {status === 'draft' && !archived ? (
          <Button disabled={isPending} onClick={publish}>
            <Send className="size-4" aria-hidden />
            Publish
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions" disabled={isPending}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onSelect={() =>
                startTransition(async () => {
                  const result = await duplicateAssessmentAction(id);
                  if (result.status === 'success' && result.data) {
                    toast.success(result.message);
                    router.push(`/t/assessments/${result.data.id}`);
                  } else if (result.status === 'error') toast.error(result.message);
                })
              }
            >
              <Copy className="size-4" aria-hidden />
              Duplicate as new draft
            </DropdownMenuItem>
            {status === 'published' && attemptCount === 0 ? (
              <DropdownMenuItem onSelect={() => run(() => unpublishAssessmentAction(id))}>
                <Undo2 className="size-4" aria-hidden />
                Move back to draft
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => run(() => archiveAssessmentAction(id, !archived))}>
              {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
              {archived ? 'Restore' : 'Archive'}
            </DropdownMenuItem>
            {attemptCount === 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" aria-hidden />
                  Delete
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {issues.length > 0 ? (
        <div role="alert" className="max-w-md rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm">
          <p className="font-medium text-destructive">Not ready to publish</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              Nobody has sat it, so nothing is lost but the settings and the question list. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteAssessmentAction(id);
                  if (result.status === 'success') {
                    toast.success(result.message);
                    router.push('/t/assessments');
                  } else if (result.status === 'error') toast.error(result.message);
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
