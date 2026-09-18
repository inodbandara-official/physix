import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/page-header';
import { listBatchOptions } from '@/features/batches/queries';
import { StudentForm } from '@/features/students/components/student-form';
import { getStudent } from '@/features/students/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Edit student' };

export default async function EditStudentPage(props: PageProps<'/t/students/[id]/edit'>) {
  await requireTeacher();
  const { id } = await props.params;

  const [student, batches] = await Promise.all([getStudent(id), listBatchOptions()]);
  if (!student) notFound();

  return (
    <>
      <PageHeader title={student.full_name} description={`Editing ${student.student_code}.`} />
      <StudentForm
        mode="edit"
        student={student}
        selectedBatchIds={student.batches.map((batch) => batch.id)}
        batches={batches}
      />
    </>
  );
}
