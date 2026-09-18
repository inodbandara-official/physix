'use client';

import Link from 'next/link';
import { useState } from 'react';
import { KeyRound, UserPlus, Users } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StudentListItem } from '@/features/students/queries';

import { CredentialsDialog } from './credentials-dialog';
import { StatusBadge } from './status-badge';
import { StudentRowActions } from './student-row-actions';

type DialogTarget = {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  loginEmail: string | null;
  hasAccount: boolean;
} | null;

export function StudentsTable({ students, filtered }: { students: StudentListItem[]; filtered: boolean }) {
  const [credentialTarget, setCredentialTarget] = useState<DialogTarget>(null);

  if (students.length === 0) {
    return filtered ? (
      <EmptyState
        icon={Users}
        title="No students match these filters"
        description="Try a different batch, status, or clear the search term."
      />
    ) : (
      <EmptyState
        icon={UserPlus}
        title="No students on the roll yet"
        description="Add your first student to start building classes, assessments and rankings."
        action={
          <Button asChild size="sm">
            <Link href="/t/students/new">Add a student</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      {/* Desktop: a dense table. Mobile: the same data as cards (§44). */}
      <div className="hidden overflow-hidden rounded-xl border bg-background md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Student ID</TableHead>
              <TableHead>Batches</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Login</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id} className={student.archived_at ? 'opacity-60' : undefined}>
                <TableCell>
                  <Link href={`/t/students/${student.id}`} className="font-medium hover:underline">
                    {student.full_name}
                  </Link>
                  {student.preferred_name ? (
                    <span className="block text-xs text-muted-foreground">“{student.preferred_name}”</span>
                  ) : null}
                </TableCell>
                <TableCell className="font-mono text-xs">{student.student_code}</TableCell>
                <TableCell>
                  <BatchBadges batches={student.batches} />
                </TableCell>
                <TableCell className="max-w-40 truncate text-sm text-muted-foreground">
                  {student.school ?? '—'}
                </TableCell>
                <TableCell>
                  <StatusBadge status={student.status} />
                </TableCell>
                <TableCell>
                  {student.has_account ? (
                    <span className="block max-w-44 truncate font-mono text-xs text-muted-foreground">
                      {student.login_email ?? student.username}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCredentialTarget({
                          id: student.id,
                          full_name: student.full_name,
                          username: student.username,
                          email: student.email,
                          loginEmail: student.login_email,
                          hasAccount: false,
                        })
                      }
                    >
                      <KeyRound className="size-3.5" aria-hidden />
                      Create
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <StudentRowActions
                    studentId={student.id}
                    status={student.status}
                    archived={student.archived_at !== null}
                    hasAccount={student.has_account}
                    onIssueCredentials={() =>
                      setCredentialTarget({
                        id: student.id,
                        full_name: student.full_name,
                        username: student.username,
                        email: student.email,
                        loginEmail: student.login_email,
                        hasAccount: student.has_account,
                      })
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {students.map((student) => (
          <li key={student.id} className="rounded-xl border bg-background p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/t/students/${student.id}`} className="font-medium hover:underline">
                  {student.full_name}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">{student.student_code}</p>
              </div>
              <StudentRowActions
                studentId={student.id}
                status={student.status}
                archived={student.archived_at !== null}
                hasAccount={student.has_account}
                onIssueCredentials={() =>
                  setCredentialTarget({
                    id: student.id,
                    full_name: student.full_name,
                    username: student.username,
                    email: student.email,
                    loginEmail: student.login_email,
                    hasAccount: student.has_account,
                  })
                }
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={student.status} />
              <BatchBadges batches={student.batches} />
              {!student.has_account ? <Badge variant="outline">No login yet</Badge> : null}
            </div>
          </li>
        ))}
      </ul>

      <CredentialsDialog
        student={credentialTarget}
        onOpenChange={(open) => !open && setCredentialTarget(null)}
      />
    </>
  );
}

function BatchBadges({ batches }: { batches: { id: string; name: string }[] }) {
  if (batches.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {batches.slice(0, 2).map((batch) => (
        <Badge key={batch.id} variant="secondary" className="font-normal">
          {batch.name}
        </Badge>
      ))}
      {batches.length > 2 ? <Badge variant="outline">+{batches.length - 2}</Badge> : null}
    </span>
  );
}
