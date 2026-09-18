import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PencilLine } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/features/students/components/status-badge';
import { StudentCredentialsCard } from '@/features/students/components/student-credentials-card';
import { StudentNotes } from '@/features/students/components/student-notes';
import { getStudent } from '@/features/students/queries';
import { requireTeacher } from '@/lib/auth/session';
import { formatDate } from '@/lib/format';

export async function generateMetadata(props: PageProps<'/t/students/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const student = await getStudent(id);
  return { title: student?.full_name ?? 'Student' };
}

export default async function StudentDetailPage(props: PageProps<'/t/students/[id]'>) {
  await requireTeacher();
  const { id } = await props.params;

  const student = await getStudent(id);
  if (!student) notFound();

  const details: { label: string; value: string }[] = [
    { label: 'Student ID', value: student.student_code },
    { label: 'Preferred name', value: student.preferred_name ?? '—' },
    { label: 'School', value: student.school ?? '—' },
    { label: 'District', value: student.district ?? '—' },
    { label: 'A/L year', value: student.al_year ? String(student.al_year) : '—' },
    { label: 'Email', value: student.email ?? 'None — signs in by username' },
    { label: 'Phone', value: student.phone ?? '—' },
    { label: 'Guardian', value: student.guardian_name ?? '—' },
    { label: 'Guardian phone', value: student.guardian_phone ?? '—' },
    { label: 'Joined', value: formatDate(student.joined_on) },
  ];

  return (
    <>
      <PageHeader
        title={student.full_name}
        description={student.school ?? undefined}
        actions={
          <Button asChild variant="outline">
            <Link href={`/t/students/${student.id}/edit`}>
              <PencilLine className="size-4" aria-hidden />
              Edit
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={student.status} />
        {student.archived_at ? <Badge variant="outline">Archived</Badge> : null}
        {student.batches.map((batch) => (
          <Badge key={batch.id} variant="secondary" className="font-normal">
            <Link href={`/t/batches/${batch.id}`}>{batch.name}</Link>
          </Badge>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {details.map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {item.label}
                    </dt>
                    <dd className="mt-0.5 text-sm">{item.value}</dd>
                  </div>
                ))}
              </dl>
              {student.notes ? (
                <div className="mt-6 border-t pt-4">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Record note
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{student.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Performance</CardTitle>
                <CardDescription>Scores, topic strengths and rank progression.</CardDescription>
              </div>
              <Badge variant="secondary">Phase 4</Badge>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="Nothing to analyse yet"
                description="Once this student has attempted assessments, their averages, weak topics and rank appear here."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <StudentCredentialsCard
            student={{
              id: student.id,
              full_name: student.full_name,
              username: student.username,
              email: student.email,
              loginEmail: student.login_email,
              hasAccount: student.has_account,
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle>Teacher journal</CardTitle>
              <CardDescription>Private unless you choose to share a note.</CardDescription>
            </CardHeader>
            <CardContent>
              <StudentNotes studentId={student.id} notes={student.notes_journal} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
