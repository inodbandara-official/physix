import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { StudentReportView } from '@/features/analytics/components/student-report-view';
import { getStudentReportForTeacher } from '@/features/analytics/queries';
import { getStudent } from '@/features/students/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Student progress' };

/** The student's own progress page, seen by the teacher — same numbers, held-back results included. */
export default async function TeacherStudentProgressPage(props: PageProps<'/t/students/[id]/progress'>) {
  await requireTeacher();
  const { id } = await props.params;

  const [student, report] = await Promise.all([getStudent(id), getStudentReportForTeacher(id)]);
  if (!student) notFound();

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/t/students/${id}`}>
          <ArrowLeft className="size-4" aria-hidden />
          {student.full_name}
        </Link>
      </Button>
      <PageHeader
        title={`${student.full_name} — progress`}
        description="What the student sees on their Progress page, plus any results you have not released yet."
      />
      <StudentReportView report={report} language="en" resultHref={(attemptId) => `/t/attempts/${attemptId}`} />
    </>
  );
}
