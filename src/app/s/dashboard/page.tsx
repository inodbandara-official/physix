import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, CalendarClock, ClipboardList, Trophy } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getStudentOverview } from '@/features/dashboard/queries';
import { requireStudent } from '@/lib/auth/session';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function StudentDashboardPage() {
  const session = await requireStudent();
  const overview = await getStudentOverview(session.student.id);

  const firstName = session.student.preferred_name || session.student.full_name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        description="Your Physics work, progress and results live here."
      />

      <section aria-label="Your performance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Average score" value="—" pending icon={ClipboardList} />
        <StatCard label="Best score" value="—" pending icon={Trophy} />
        <StatCard label="Questions solved" value="—" pending icon={BookOpen} />
        <StatCard label="Rank" value="—" pending icon={Trophy} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Assigned work</CardTitle>
              <CardDescription>Quizzes, tests and practice sets your teacher has set.</CardDescription>
            </div>
            <Badge variant="secondary">Phase 3</Badge>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={ClipboardList}
              title="Nothing assigned yet"
              description="When your teacher publishes a quiz or test, it appears here with its deadline."
            />
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
