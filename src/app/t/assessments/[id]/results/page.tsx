import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BarChart3, CheckCircle2, ClipboardCheck, Users } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AssessmentLifecycle } from '@/features/assessments/components/assessment-lifecycle';
import { AssessmentAnalyticsView } from '@/features/analytics/components/assessment-analytics-view';
import { getAssessmentAnalytics } from '@/features/analytics/queries';
import { getAssessmentResults } from '@/features/assessments/queries';
import { ATTEMPT_STATUS_LABELS } from '@/features/assessments/types';
import { resultsVisible } from '@/features/attempts/scoring';
import { requireTeacher } from '@/lib/auth/session';
import { formatDateTime, formatPercent } from '@/lib/format';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatDuration } from '@/lib/time';

export const metadata: Metadata = { title: 'Results' };

export default async function AssessmentResultsPage(props: PageProps<'/t/assessments/[id]/results'>) {
  await requireTeacher();
  const { id } = await props.params;

  const supabase = await createSupabaseServerClient();
  const { data: assessment } = await supabase.from('assessments').select('*').eq('id', id).maybeSingle();
  if (!assessment) notFound();

  const [{ attempts, stats }, analytics] = await Promise.all([
    getAssessmentResults(assessment),
    getAssessmentAnalytics(assessment.id),
  ]);

  // Assessment ranking: each student's best finished attempt, ties sharing a rank.
  const best = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    if (attempt.status !== 'graded' || attempt.percentage === null) continue;
    const current = best.get(attempt.student_id);
    if (!current || Number(attempt.percentage) > Number(current.percentage)) best.set(attempt.student_id, attempt);
  }
  const ordered = [...best.values()].sort((a, b) => Number(b.percentage) - Number(a.percentage));
  const rankOf = new Map<string, number>();
  ordered.forEach((attempt, index) => {
    const previous = ordered[index - 1];
    rankOf.set(
      attempt.id,
      previous && Number(previous.percentage) === Number(attempt.percentage) ? rankOf.get(previous.id)! : index + 1,
    );
  });
  const held = !resultsVisible(assessment);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/t/assessments/${id}`}>
          <ArrowLeft className="size-4" aria-hidden />
          {assessment.title}
        </Link>
      </Button>

      <PageHeader
        title="Results"
        description={
          held
            ? 'Students cannot see their results yet.'
            : 'Averages use each student’s best finished attempt.'
        }
        actions={
          <AssessmentLifecycle
            id={assessment.id}
            status={assessment.status}
            archived={assessment.archived_at !== null}
            attemptCount={stats.attempts}
            canRelease={held && stats.attempts > 0 && !assessment.results_released_at}
          />
        }
      />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value={stats.students} hint={`${stats.attempts} attempts`} icon={Users} />
        <StatCard label="Average" value={formatPercent(stats.average)} icon={BarChart3}
          hint={stats.highest !== null ? `Highest ${formatPercent(stats.highest)} · lowest ${formatPercent(stats.lowest)}` : undefined}
        />
        <StatCard
          label="Pass rate"
          value={stats.passRate === null ? '—' : formatPercent(stats.passRate)}
          hint={assessment.pass_percentage === null ? 'No pass mark set' : `Pass mark ${Number(assessment.pass_percentage)}%`}
          icon={CheckCircle2}
        />
        <StatCard
          label="To mark"
          value={stats.awaitingMarking}
          hint={stats.inProgress > 0 ? `${stats.inProgress} still sitting` : undefined}
          icon={ClipboardCheck}
        />
      </section>

      <AssessmentAnalyticsView analytics={analytics} />

      {attempts.length === 0 ? (
        <EmptyState
          title="No attempts yet"
          description={
            assessment.status === 'draft'
              ? 'Publish the assessment so students in its batches can start.'
              : 'Attempts appear here as soon as a student starts.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Rank</TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="text-right">Attempt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell className="font-semibold tabular-nums">
                    {rankOf.has(attempt.id) ? `#${rankOf.get(attempt.id)}` : ''}
                  </TableCell>
                  <TableCell>
                    <Link href={`/t/attempts/${attempt.id}`} className="font-medium hover:underline">
                      {attempt.student?.full_name ?? 'Unknown student'}
                    </Link>
                    <p className="text-xs text-muted-foreground">{attempt.student?.student_code}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{attempt.attempt_number}</TableCell>
                  <TableCell>
                    <Badge
                      variant={attempt.status === 'graded' ? 'secondary' : attempt.status === 'submitted' ? 'default' : 'outline'}
                      className="font-normal"
                    >
                      {attempt.status === 'submitted'
                        ? `${attempt.pending_manual} to mark`
                        : ATTEMPT_STATUS_LABELS[attempt.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {attempt.status === 'in_progress' ? '—' : `${Number(attempt.score)} / ${Number(attempt.max_score)}`}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {attempt.status === 'in_progress' ? '—' : formatPercent(attempt.percentage === null ? null : Number(attempt.percentage))}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                    {formatDateTime(attempt.submitted_at)}
                  </TableCell>
                  <TableCell className="text-right text-sm whitespace-nowrap text-muted-foreground">
                    {attempt.submitted_at
                      ? formatDuration(
                          (new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 1000,
                        )
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
