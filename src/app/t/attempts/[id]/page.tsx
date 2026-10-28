import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, History } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getTeacherAttempt } from '@/features/assessments/queries';
import { ATTEMPT_STATUS_LABELS } from '@/features/assessments/types';
import { MarkForm } from '@/features/attempts/components/mark-form';
import { ReviewQuestion } from '@/features/attempts/components/review-question';
import { requireTeacher } from '@/lib/auth/session';
import { formatDateTime, formatPercent } from '@/lib/format';
import { formatDuration } from '@/lib/time';

export const metadata: Metadata = { title: 'Attempt' };

export default async function TeacherAttemptPage(props: PageProps<'/t/attempts/[id]'>) {
  await requireTeacher();
  const { id } = await props.params;

  const result = await getTeacherAttempt(id);
  if (!result) notFound();

  const { attempt, assessment, items, student, figureUrls, supersededVersionIds } = result;
  const toMark = items.filter((item) => item.awaitingTeacher);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/t/assessments/${assessment.id}/results`}>
          <ArrowLeft className="size-4" aria-hidden />
          {assessment.title} — results
        </Link>
      </Button>

      <PageHeader
        title={student.full_name}
        description={`${student.student_code} · attempt ${attempt.attemptNumber} · ${assessment.title}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/t/students/${student.id}`}>Student record</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
          <div>
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="text-2xl font-semibold tabular-nums">
              {attempt.status === 'in_progress' ? '—' : `${attempt.score} / ${attempt.maxScore}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Percentage</p>
            <p className="text-2xl font-semibold tabular-nums">{formatPercent(attempt.percentage)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={attempt.status === 'submitted' ? 'default' : 'secondary'} className="mt-1 font-normal">
              {attempt.status === 'submitted' ? `${attempt.pendingManual} to mark` : ATTEMPT_STATUS_LABELS[attempt.status]}
            </Badge>
          </div>
          <div className="text-sm">
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p>{formatDateTime(attempt.submittedAt)}</p>
          </div>
          {attempt.submittedAt ? (
            <div className="text-sm">
              <p className="text-xs text-muted-foreground">Time taken</p>
              <p>
                {formatDuration((new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000)}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {attempt.status === 'in_progress' ? (
        <p className="text-sm text-muted-foreground">
          The student is still sitting this attempt. Answers and marks appear here once it is submitted.
        </p>
      ) : (
        <>
          {toMark.length > 0 ? (
            <nav
              aria-label="Answers to mark"
              className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm"
            >
              <span className="font-medium">{toMark.length} to mark:</span>
              {toMark.map((item) => {
                const number = items.indexOf(item) + 1;
                return (
                  <a key={item.attemptQuestionId} href={`#q-${number}`} className="font-medium text-primary hover:underline">
                    Q{number}
                  </a>
                );
              })}
            </nav>
          ) : null}

          <div className="space-y-4">
            {items.map((item, index) => {
              const body = item.content.body;
              const parts =
                body.kind === 'structured'
                  ? body.parts.map((part) => ({
                      id: part.id,
                      label: part.label,
                      maxMarks: part.marks,
                      marks: item.partResults?.[part.id]?.marks ?? null,
                      needsMarking: Boolean(item.partResults?.[part.id]?.requiresManual),
                    }))
                  : [];

              return (
                <ReviewQuestion
                  key={item.attemptQuestionId}
                  item={item}
                  number={index + 1}
                  language="en"
                  revealAnswers
                  revealExplanations={false}
                  shuffleOptions={assessment.shuffleOptions}
                  figureUrls={figureUrls}
                  teacher
                >
                  {supersededVersionIds.has(item.versionId) ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <History className="size-3.5" aria-hidden />
                      This question has been edited since. Shown and marked as the version the student sat.{' '}
                      <Link
                        href={`/t/questions/${item.questionId}?version=${item.versionId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        View that version
                      </Link>
                    </p>
                  ) : null}
                  <MarkForm
                    attemptQuestionId={item.attemptQuestionId}
                    maxMarks={item.maxMarks}
                    marks={item.marksAwarded}
                    comment={item.teacherComment}
                    parts={parts}
                    needsMarking={item.awaitingTeacher}
                  />
                </ReviewQuestion>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
