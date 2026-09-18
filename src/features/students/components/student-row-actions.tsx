'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { Archive, ArchiveRestore, KeyRound, MoreHorizontal, PencilLine, UserCheck, UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { archiveStudentAction, setStudentStatusAction } from '@/features/students/actions';
import { runWithToast } from '@/lib/run-action';
import type { ActionState } from '@/lib/action';
import type { AccountStatus } from '@/types/database';

interface StudentRowActionsProps {
  studentId: string;
  status: AccountStatus;
  archived: boolean;
  hasAccount: boolean;
  onIssueCredentials: () => void;
}

export function StudentRowActions({
  studentId,
  status,
  archived,
  hasAccount,
  onIssueCredentials,
}: StudentRowActionsProps) {
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionState>) => startTransition(() => runWithToast(action));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending} aria-label="Student actions">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/t/students/${studentId}/edit`}>
            <PencilLine className="size-4" aria-hidden />
            Edit details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onIssueCredentials}>
          <KeyRound className="size-4" aria-hidden />
          {hasAccount ? 'Reset password' : 'Create login'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {status === 'active' ? (
          <DropdownMenuItem onSelect={() => run(() => setStudentStatusAction(studentId, 'inactive'))}>
            <UserX className="size-4" aria-hidden />
            Deactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => run(() => setStudentStatusAction(studentId, 'active'))}>
            <UserCheck className="size-4" aria-hidden />
            Reactivate
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant={archived ? 'default' : 'destructive'}
          onSelect={() => run(() => archiveStudentAction(studentId, !archived))}
        >
          {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
          {archived ? 'Restore record' : 'Archive record'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
