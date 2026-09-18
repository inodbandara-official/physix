import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, FileQuestion, KeyRound, Layers, Users } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTeacherOverview } from '@/features/dashboard/queries';
import { formatDate, formatRelative, pluralize } from '@/lib/format';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function TeacherDashboardPage() {
  const overview = await getTeacherOverview();
  const maxBatchSize = Math.max(1, ...overview.batchSizes.map((batch) => batch.students));

  return (
    <>
      <PageHeader
        title="Control centre"
        description="Everything running in your Physics academy, at a glance."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/t/batches">Manage batches</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/t/questions/new">New question</Link>
            </Button>
            <Button asChild>
              <Link href="/t/students/new">Add student</Link>
            </Button>
          </>
        }
      />

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Students"
          value={overview.students.total}
          hint={`${overview.students.active} active`}
          icon={Users}
        />
        <StatCard
          label="Batches"
          value={overview.batches.active}
          hint={
            overview.batches.total > overview.batches.active
              ? `${overview.batches.total - overview.batches.active} archived`
              : 'All active'
          }
          icon={Layers}
        />
        <StatCard
          label="Syllabus topics"
          value={overview.syllabus.topics}
          hint={`${pluralize(overview.syllabus.units, 'unit')}, ${overview.syllabus.subtopics} subtopics`}
          icon={BookOpen}
        />
        <StatCard
          label="Questions"
          value={overview.questions.published}
          hint={
            overview.questions.drafts > 0
              ? `${overview.questions.drafts} still in draft`
              : 'All published'
          }
          icon={FileQuestion}
        />
        <StatCard
          label="Awaiting login details"
          value={overview.students.withoutAccount}
          hint={
            overview.students.withoutAccount === 0
              ? 'Every student can sign in'
              : 'Issue credentials from the student page'
          }
          icon={KeyRound}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Batch sizes</CardTitle>
            <CardDescription>Active students in each batch.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.batchSizes.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No batches yet"
                description="Create a batch such as “2026 A/L — Colombo Saturday”, then add students to it."
                action={
                  <Button asChild size="sm">
                    <Link href="/t/batches">Create a batch</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {overview.batchSizes.map((batch) => (
                  <li key={batch.name} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{batch.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {pluralize(batch.students, 'student')}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(4, (batch.students / maxBatchSize) * 100)}%`,
                          background: 'var(--brand-primary)',
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recently added</CardTitle>
            <CardDescription>The latest students on your roll.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.newestStudents.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No students yet"
                description="Add your first student, or import a class list from CSV."
                action={
                  <Button asChild size="sm">
                    <Link href="/t/students/new">Add a student</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y">
                {overview.newestStudents.map((student) => (
                  <li key={student.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                    <Link
                      href={`/t/students/${student.id}`}
                      className="min-w-0 text-sm font-medium hover:underline"
                    >
                      <span className="block truncate">{student.full_name}</span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {student.student_code}
                      </span>
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(student.joined_on)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Assessment activity</CardTitle>
            <CardDescription>
              Scores, rankings and topic weaknesses appear here once the assessment engine is in place.
            </CardDescription>
          </div>
          <Badge variant="secondary">Phase 3</Badge>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No assessments yet"
            description="The question bank is ready. Once assessments are built on top of it, averages, rankings and topic weaknesses fill in here automatically."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>An audit trail of changes made in this LMS.</CardDescription>
        </CardHeader>
        <CardContent>
          {overview.recentActivity.length === 0 ? (
            <EmptyState title="Nothing logged yet" description="Actions you take are recorded here." />
          ) : (
            <ul className="divide-y">
              {overview.recentActivity.map((entry) => (
                <li key={entry.id} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0">
                  <span className="min-w-0 text-sm">{entry.summary}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(entry.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
