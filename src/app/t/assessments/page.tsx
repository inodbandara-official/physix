import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardList, Plus } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listAssessments } from '@/features/assessments/queries';
import { ASSESSMENT_KIND_LABELS } from '@/features/assessments/types';
import { assessmentWindow } from '@/features/attempts/scoring';
import { requireTeacher } from '@/lib/auth/session';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Assessments' };

export default async function AssessmentsPage(props: PageProps<'/t/assessments'>) {
  await requireTeacher();
  const searchParams = await props.searchParams;
  const view = searchParams.view === 'archived' ? 'archived' : 'active';
  const assessments = await listAssessments(view);

  return (
    <>
      <PageHeader
        title="Assessments"
        description="Quizzes, tests and mock exams. Each one is a recipe of hand-picked questions and random rules, resolved fresh for every attempt."
        actions={
          <Button asChild>
            <Link href="/t/assessments/new">
              <Plus className="size-4" aria-hidden />
              New assessment
            </Link>
          </Button>
        }
      />

      <nav aria-label="Assessment views" className="flex gap-1">
        {(['active', 'archived'] as const).map((option) => (
          <Link
            key={option}
            href={option === 'active' ? '/t/assessments' : '/t/assessments?view=archived'}
            aria-current={view === option ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              view === option ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {option === 'active' ? 'Current' : 'Archived'}
          </Link>
        ))}
      </nav>

      {assessments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={view === 'active' ? 'No assessments yet' : 'Nothing archived'}
          description={
            view === 'active'
              ? 'Create a quiz or test, add questions from your bank, choose the batches, and publish.'
              : 'Archived assessments keep every student result. Archive one from its menu when it is finished.'
          }
          action={
            view === 'active' ? (
              <Button asChild size="sm">
                <Link href="/t/assessments/new">
                  <Plus className="size-4" aria-hidden />
                  Create an assessment
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment</TableHead>
                <TableHead>Batches</TableHead>
                <TableHead>Window</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.map((assessment) => {
                const window = assessmentWindow(assessment);
                return (
                  <TableRow key={assessment.id}>
                    <TableCell className="max-w-xs">
                      <Link href={`/t/assessments/${assessment.id}`} className="font-medium hover:underline">
                        {assessment.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{ASSESSMENT_KIND_LABELS[assessment.kind]}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {assessment.batchNames.length ? (
                        assessment.batchNames.join(', ')
                      ) : (
                        <span className="text-muted-foreground">None yet</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      {assessment.closes_at ? `Closes ${formatDateTime(assessment.closes_at)}` : 'No closing date'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{assessment.questionCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {assessment.attemptCount > 0 ? (
                        <Link href={`/t/assessments/${assessment.id}/results`} className="hover:underline">
                          {assessment.attemptCount}
                        </Link>
                      ) : (
                        0
                      )}
                      {assessment.awaitingMarking > 0 ? (
                        <Badge variant="secondary" className="ml-2 font-normal">
                          {assessment.awaitingMarking} to mark
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {assessment.status === 'draft' ? (
                        <Badge variant="outline">Draft</Badge>
                      ) : window === 'upcoming' ? (
                        <Badge variant="secondary">Scheduled</Badge>
                      ) : window === 'closed' ? (
                        <Badge variant="secondary">Closed</Badge>
                      ) : (
                        <Badge>Open</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
