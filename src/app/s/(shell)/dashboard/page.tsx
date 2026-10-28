import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, CalendarClock, ClipboardList, Trophy } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentAssessmentCard } from '@/features/attempts/components/student-assessment-card';
import { listStudentAssessments } from '@/features/attempts/queries';
import { getStudentOverview } from '@/features/dashboard/queries';
import { t } from '@/features/language/labels';
import { requireStudent } from '@/lib/auth/session';
import { formatDate, formatPercent } from '@/lib/format';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function StudentDashboardPage() {
  const session = await requireStudent();
  const language = session.profile.language;
  const [overview, assessments] = await Promise.all([
    getStudentOverview(session.student.id),
    listStudentAssessments(session.student.id),
  ]);

  // Only results the teacher has let the student see count towards these.
  const bests = assessments
    .map((assessment) => assessment.best?.percentage ?? null)
    .filter((value): value is number => value !== null);
  const average = bests.length ? bests.reduce((sum, value) => sum + value, 0) / bests.length : null;
  const best = bests.length ? Math.max(...bests) : null;
  const completed = assessments.filter((assessment) =>
    assessment.attempts.some((attempt) => attempt.status !== 'in_progress'),
  ).length;
  const current = assessments.filter(
    (assessment) =>
      assessment.active &&
      (assessment.openAttemptId !== null ||
        (assessment.window === 'open' && assessment.canStart && assessment.attempts.length === 0) ||
        assessment.window === 'upcoming'),
  );

  const firstName = session.student.preferred_name || session.student.full_name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        description="Your Physics work, progress and results live here."
      />

      <section aria-label="Your performance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('averageScore', language)} value={formatPercent(average)} icon={ClipboardList} />
        <StatCard label={t('bestScore', language)} value={formatPercent(best)} icon={Trophy} />
        <StatCard label={t('completed', language)} value={completed} icon={BookOpen} />
        <StatCard label="Rank" value="—" pending icon={Trophy} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>{t('assignedWork', language)}</CardTitle>
              <CardDescription>{t('assignedWorkIntro', language)}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/s/assessments">{t('seeAll', language)}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {current.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={t('nothingAssigned', language)}
                description={t('nothingAssignedHint', language)}
              />
            ) : (
              <ul className="space-y-3" lang={language}>
                {current.slice(0, 5).map((assessment) => (
                  <StudentAssessmentCard key={assessment.id} assessment={assessment} language={language} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your classes</CardTitle>
            <CardDescription>The batches you are enrolled in.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.batches.length === 0 ? (
              <EmptyState
                title="No class yet"
                description="Your teacher has not added you to a batch. Ask them if you think this is wrong."
                className="py-8"
              />
            ) : (
              <ul className="space-y-3">
                {overview.batches.map((batch) => (
                  <li key={batch.id} className="rounded-lg border p-3">
                    <p className="font-medium">{batch.name}</p>
                    {batch.schedule_note ? (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarClock className="size-4" aria-hidden />
                        {batch.schedule_note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What you will study</CardTitle>
            <CardDescription>The units in your teacher’s Physics syllabus.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.syllabusUnits.length === 0 ? (
              <EmptyState title="Syllabus not published yet" className="py-8" />
            ) : (
              <>
                <ul className="flex flex-wrap gap-2">
                  {overview.syllabusUnits.map((unit) => (
                    <li key={unit.id}>
                      <Badge variant="secondary" className="font-normal">
                        {unit.name}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="link" className="mt-3 px-0">
                  <Link href="/s/syllabus">See the full syllabus</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes from your teacher</CardTitle>
            <CardDescription>Only notes your teacher has chosen to share.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.publishedNotes.length === 0 ? (
              <EmptyState title="No notes shared" className="py-8" />
            ) : (
              <ul className="space-y-3">
                {overview.publishedNotes.map((note) => (
                  <li key={note.id} className="rounded-lg border p-3">
                    <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDate(note.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
